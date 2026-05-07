uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;
uniform float uCameraFovY;
uniform float uEffectScaleIntensity;
uniform float uVertexIdScalar;

uniform float R_v2_core_intensity;
uniform float R_v2_core_screenSpaceDiameterMin;

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

out vec3 vPositionWorldSpace;
out vec4 vPositionClipSpace;
out vec4 vPointColor;
out float vHotCircleDiameter;
out float vHotCircleScreenSpaceDiameterMin;

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
    // intensity *= radius * radius;
    intensity *= 2e5;
    // intensity *= pow( fov_factor, 0.5 );
    // intensity /= dist * dist;

    if( 0.0 != si.aIntensityCurveLoopDuration ) {
        float time_in_loop = mod( uTimeInstant - ps.t0, si.aIntensityCurveLoopDuration );
        float t = time_in_loop / si.aIntensityCurveLoopDuration + rand( ps.random_state );
        intensity *= sampleCurve( si.aIntensityCurve, mod( t, 1.0 ) );
        if( life_factor > 0.8 ) { intensity *= ( 1.0 - life_factor ) * 5.0; }
    } else {
        intensity *= sampleCurve( si.aIntensityCurve, life_factor );
    }

    intensity *= uEffectScaleIntensity;
    intensity *= R_v2_core_intensity;

    if( intensity <= 0.0 ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    vec3 color;
    color = mix( si.aColor0, si.aColor1, life_factor );



    float temp_factor = sampleTan( -1.4, 1.2, life_factor );
    float temp = mix( si.aTemperature0, si.aTemperature1, temp_factor );
    color += getBlackbodyColor( temp ).rgb * 3e-15;

    float hot_circle_diameter = 0.001 * max( 0.0, sampleGaussian( ps.random_state, si.aHotCircleDiameterGaussian ) );
    vHotCircleDiameter = hot_circle_diameter;

    vPositionWorldSpace = ps.pos;
    vec4 glPos = ProjMat * ViewMat * vec4( ps.pos, 1 );
    vPositionClipSpace = glPos / glPos.w;
    vec3 sideways = hot_circle_diameter * transpose(ViewMat)[0].xyz;
    vec4 posClipSpace2 = ProjMat * ViewMat * vec4( ps.pos + sideways, 1 );

    float hotCircleDiameterClipSpace = abs(posClipSpace2.x/posClipSpace2.w - vPositionClipSpace.x/vPositionClipSpace.w);
    float diameterPx = hotCircleDiameterClipSpace * uFramebufferSize.x / 2.0;

    gl_Position = glPos;
    if( diameterPx < R_v2_core_screenSpaceDiameterMin ) {
        vHotCircleScreenSpaceDiameterMin = R_v2_core_screenSpaceDiameterMin;
        gl_PointSize = R_v2_core_screenSpaceDiameterMin;
        float subpixel_intensity_factor = pow( diameterPx / R_v2_core_screenSpaceDiameterMin, 2.0 );
        // subpixel_intensity_factor = 1.0;
        vPointColor = vec4(color,0) * intensity * subpixel_intensity_factor;
    } else {
        gl_PointSize = diameterPx + 2.0;
        vPointColor = vec4(color,0) * intensity;
        vHotCircleScreenSpaceDiameterMin = 0.0;
    }
}
