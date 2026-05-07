uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;
uniform float uCameraFovY;
uniform float uEffectScaleIntensity;
uniform float uVertexIdScalar;

uniform float R_v2_core_intensity;
uniform float R_v2_core_screenSpaceDiameterMin;

#ifdef FIN_UseUniformsForBatchData
uniform int uInfoId;
uniform int uFirstParticleStateId;
#endif

out vec4 vDebugShade;
out vec3 vPositionWorldSpace;
out vec4 vPositionClipSpace;
out vec4 vPointColor;
out float vHotCircleDiameter;
out float vHotCircleScreenSpaceDiameterMin;

void
main()
{
    vDebugShade = vec4(0);
    vPointColor = vec4(0);

    int vertex_id = int( float(gl_VertexID) * uVertexIdScalar );
#ifdef FIN_UseUniformsForBatchData
#else
    StarBatchData bd;
    getStarBatchDataFromVertexId( vertex_id, bd );
    int uFirstParticleStateId = bd.first_particle_state_id;
    int uInfoId = bd.info_id;
#endif

    ParticleState ps = getParticleStateFromTexture( uFirstParticleStateId + vertex_id );
    if(uTimeInstant < ps.t0 || uTimeInstant >= (ps.t0 + ps.duration) ) {
        gl_Position = vec4( 100.0, 100.0, 100.0, 0.1 );
        gl_PointSize = 0.0;
        return;
    }

    SparkInfo si = getSparkInfoFromTexture( getParticleInfoIndex( uInfoId ) );

    float life_time = uTimeInstant - ps.t0;
    float life_factor = ps.duration == 0.0 ? 1.0 : life_time / ps.duration;


    ///////////////////////////////////////////////////////////////////
    // this code blob is duplicated, keep it up-to-date in:
    // shader_spark_star_v1.vert
    // shader_spark_star_v2.vert
    // shader_smoke_star.vert
    // shader_light_beam_star.vert
    // physics_post.vert (not quite the same as the others)
    float posCurveLifeFactor = life_factor;
    bool didOri = false;
    vec4 ori = vec4(0,0,0,1);
    if( ps.ori0 != vec4(0) ) {
        ori = quatSlerp( ps.ori0, ps.ori1, life_factor );
        didOri = true;
    }
    if( ps.ori_curve4_id != 0 ) {
        vec4 relativeOri = sampleCurve4( ps.ori_curve4_id, posCurveLifeFactor );
        ori = quatApply( ori, relativeOri );
        didOri = true;
    }
    if( didOri ) {
        mat3 m = quatToMat3( ori );
        float speed = length( ps.vel );
        ps.vel = m * vec3( 0, speed, 0 );
    }
    if( ps.pos_curve4_id != 0 ) {
        ps.pos = sampleCurve4( ps.pos_curve4_id, posCurveLifeFactor ).rgb;
    }
    if( ps.vel_curve4_id != 0 ) {
        ps.vel = sampleCurve4( ps.vel_curve4_id, posCurveLifeFactor ).rgb;
    }
    if( ps.motion_flags == 0.0 ) {
        apply_ballistic_motion( uWindVelocity, ps, uTimeInstant - ps.t0 );
    }
    ///////////////////////////////////////////////////////////////////


    float intensity = 1.0;
    float radius = 0.5 * max( 0.0, sampleGaussian( ps.random_state, si.aDiameterGaussian ) );

    float dist = length( project( ViewMat * vec4( ps.pos, 1 ) ).xyz );
    float fov_factor = tan( deg2rad( 60.0 ) ) / tan( deg2rad( uCameraFovY ) );

    intensity *= si.aIntensity1;
    // intensity *= radius * radius;
    intensity *= 1e3;
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
    if( ps.rgb_curve4_id != 0 ) {
        color = sampleCurve4( ps.rgb_curve4_id, life_factor ).rgb;
    } else {
        color = mix( si.aColor0, si.aColor1, life_factor );
    }
    float temp_factor = sampleTan( -1.4, 1.2, life_factor );
    float temp = mix( si.aTemperature0, si.aTemperature1, temp_factor );
    color += getBlackbodyColor( temp ).rgb * 1e-15;

    float hot_circle_diameter = 0.001 * max( 0.0, sampleGaussian( ps.random_state, si.aHotCircleDiameterGaussian ) );
    vHotCircleDiameter = hot_circle_diameter;

    vPositionWorldSpace = ps.pos;
    vec4 glPos = ProjMat * ViewMat * vec4( ps.pos, 1 );
    vPositionClipSpace = glPos / glPos.w;
    vec3 sideways = hot_circle_diameter * transpose(ViewMat)[0].xyz;
    vec4 posClipSpace2 = ProjMat * ViewMat * vec4( ps.pos + sideways, 1 );

    float hotCircleDiameterClipSpace = abs(posClipSpace2.x/posClipSpace2.w - vPositionClipSpace.x/vPositionClipSpace.w);
    float diameter1080p = hotCircleDiameterClipSpace * 1920.0 / 2.0;

    gl_Position = glPos;
    if( diameter1080p < R_v2_core_screenSpaceDiameterMin ) {
        vHotCircleScreenSpaceDiameterMin = R_v2_core_screenSpaceDiameterMin;
        gl_PointSize = R_v2_core_screenSpaceDiameterMin * uFramebufferSize.x / 1920.0;
        float subpixel_intensity_factor = pow( diameter1080p / R_v2_core_screenSpaceDiameterMin, 2.0 );
        vPointColor = vec4(color,0) * intensity * subpixel_intensity_factor;
        // vPointColor = vec4(2,0,0,0);
    } else {
        gl_PointSize = diameter1080p * uFramebufferSize.x / 1920.0 + 2.0;
        vPointColor = vec4(color,0) * intensity;
        vHotCircleScreenSpaceDiameterMin = 0.0;
    }
}
