uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;
uniform float uCameraFovY;
uniform float uEffectScaleIntensity;
uniform float uVertexIdScalar;

uniform bool uIsSpritePass;
uniform bool uIsAuraPass;

uniform float R_sparkSpriteWidthScale;
uniform float R_spark_intensity;
uniform float R_spark_pointsize;
uniform float R_spark_aura_intensity;
uniform float R_spark_aura_pointsize;
uniform float R_spark_aura_exponent;
uniform float R_sparkPhase0Lifetime;
uniform float R_sparkPhase0WidthMultiplier;

#ifdef FIN_UseUniformsForBatchData
uniform int uTrailRandomGroupId;
uniform int uFirstParticleStateId;
uniform int uNumEmittedPerStar;
uniform int uEmitterInfoId;
uniform int uEmittedInfoId;
#endif

out vec4 vDebugShade;
out vec3 vColor0;
out vec3 vColor1;
out float vScale0;
out float vScale1;
out float vExponent0;
out float vExponent1;


void main() {
    vDebugShade = vec4( 0 );
    vScale0 = vScale1 = 0.0;

    int vertex_id = int( float(gl_VertexID) * uVertexIdScalar );
#ifdef FIN_UseUniformsForBatchData
#else
    TrailBatchData bd;
    getTrailBatchDataFromVertexId( vertex_id, bd );
    int uFirstParticleStateId = bd.first_particle_state_id;
    int uNumEmittedPerStar = bd.num_emitted_per_star;
    int uEmitterInfoId = bd.emitter_info_id;
    int uEmittedInfoId = bd.emitted_info_id;
    int uTrailRandomGroupId = bd.trail_random_group_id;
#endif

    int ps_id = uFirstParticleStateId + vertex_id/uNumEmittedPerStar;
    ParticleState ps;

    EmitterInfo ei = getEmitterInfoFromTexture( getParticleInfoIndex( uEmitterInfoId ) );
    if( !do_emitter_logic( ps, ei, uWindVelocity, 1.0, vertex_id, ps_id, uTrailRandomGroupId, uTimeInstant ) ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    SparkInfo si = getSparkInfoFromTexture( getParticleInfoIndex( uEmittedInfoId ) );

    float life_time = uTimeInstant - ps.t0;
    float life_factor = ps.duration == 0.0 ? 1.0 : life_time / ps.duration;









    float intensity = 1.0;
    float radius = 0.5 * max( 0.0, sampleGaussian( ps.random_state, si.aDiameterGaussian ) );

    float dist = length( project( ViewMat * vec4( ps.pos, 1 ) ).xyz );
    float fov_factor = tan( deg2rad( 60.0 ) ) / tan( deg2rad( uCameraFovY ) );

    intensity *= si.aIntensity1;
    intensity *= radius * radius;
    intensity *= 1e2;
    intensity *= pow( fov_factor, 0.5 );
    intensity /= dist * dist;

    if( intensity <= 0.0 ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    vec3 color;
    color = mix( si.aColor0, si.aColor1, life_factor ) * 7e9;
    float temp_factor = sampleTan( -1.4, 1.2, life_factor );
    float temp = mix( si.aTemperature0, si.aTemperature1, temp_factor );
    color += getBlackbodyColor( temp ).rgb * 3e-5;

    if( 0.0 != si.aIntensityCurveLoopDuration ) {
        float time_in_loop = mod( uTimeInstant - ps.t0, si.aIntensityCurveLoopDuration );
        float t = time_in_loop / si.aIntensityCurveLoopDuration + rand( ps.random_state );
        intensity *= sampleCurve( si.aIntensityCurve, mod( t, 1.0 ) );
        if( life_factor > 0.8 ) { intensity *= ( 1.0 - life_factor ) * 5.0; }
    } else {
        intensity *= sampleCurve( si.aIntensityCurve, life_factor );
    }

    intensity *= uEffectScaleIntensity;

    if( intensity <= 0.0 ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    float maxcomp = max( color.r, max( color.g, color.b ) );

    // normalize color to 1.0 and intensity to match, for the the shrinkwrapping operation.
    // output colors get multiplied by intensity later to reverse this.
    color /= maxcomp;
    intensity *= maxcomp;

    gl_Position = ProjMat * ViewMat * vec4( ps.pos, 1 );

    float Intensity0 = 0.0;
    float Intensity1 = 0.0;

    float PointSize0 = 0.0;
    float PointSize1 = 0.0;

    float Exponent0 = 1.0;
    float Exponent1 = 1.0;

    if( uIsSpritePass ) {
        Intensity0 = R_spark_intensity * intensity;
        PointSize0 = R_spark_pointsize;
    }
    if( uIsAuraPass ) {
        Intensity1 = R_spark_aura_intensity;
        PointSize1 = R_spark_aura_pointsize * pow( intensity, 0.25 );
        Exponent1 = R_spark_aura_exponent;
    }

    float RadiusFactor0 = getSparkTextureRadiusFactor( Intensity0 );
    float RadiusFactor1 = log( 1.4 + Intensity1 );

    if( life_time < R_sparkPhase0Lifetime ) {
        RadiusFactor0 *= R_sparkPhase0WidthMultiplier;
        RadiusFactor1 *= R_sparkPhase0WidthMultiplier;
    }

    float ContractedSize0 = ceil( PointSize0 * RadiusFactor0 );
    float ContractedSize1 = ceil( PointSize1 * RadiusFactor1 );

    gl_PointSize = max( ContractedSize0, ContractedSize1 );
    if( gl_PointSize <= 0.0 ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    vScale0 = PointSize0 / gl_PointSize;
    vScale1 = PointSize1 / gl_PointSize;

    vColor0 = color * Intensity0 * uVertexIdScalar;
    vColor1 = color * Intensity1 * uVertexIdScalar;

    vExponent0 = Exponent0;
    vExponent1 = Exponent1;

    gl_PointSize *= R_sparkSpriteWidthScale * ( uFramebufferSize.y / 765.0 );
    gl_PointSize *= fov_factor;

    #if 0
        gl_PointSize = 256.0;
        if( ei.aEmitCurve == 2 ) {
            vDebugShade.g = 0.25;
        } else {
            vDebugShade.r = 0.25;
        }
    #endif
}
