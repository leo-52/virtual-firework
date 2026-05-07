uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;
uniform float uVertexIdScalar;

uniform vec3 uAmbientColor;
uniform float uSmokeLightResponse;

#ifdef FIN_UseUniformsForBatchData
uniform int uInfoId;
uniform int uFirstParticleStateId;
#endif

out vec4 vDebugShade;
out float vSmokeBlack;
out float vSmokeAmbient;
out float vSmokeLight;
out float vRotate;


void
main()
{
    vDebugShade = vec4( 0 );

    int vertex_id = int( gl_VertexID * uVertexIdScalar );
#ifdef FIN_UseUniformsForBatchData
#else
    StarBatchData bd;
    getStarBatchDataFromVertexId( vertex_id, bd );
    int uFirstParticleStateId = bd.first_particle_state_id;
    int uInfoId = bd.info_id;
#endif

    ParticleState ps = getParticleStateFromTexture( uFirstParticleStateId + vertex_id );
    if( uTimeInstant < ps.t0 || uTimeInstant >= ( ps.t0 + ps.duration ) ) {
        gl_Position = vec4( 100, 100, 100, 0.1 );
        gl_PointSize = 0;
        return;
    }

    SmokeInfo si = getSmokeInfoFromTexture( getParticleInfoIndex( uInfoId ) );

    ps.gravity = vec3( 0, -0.1, 0 );
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


    float size_curve = sampleCurve( si.aSmokePuffSizeCurve, life_factor );
    float radius = mix( si.aSmokePuffStartSize, si.aSmokePuffEndSize, size_curve );
    float start_size_ratio = radius / si.aSmokePuffStartSize;
    float dist = length( project( ViewMat * vec4( ps.pos, 1 ) ).xyz );

    float sprite_width = 5000.0 * radius / dist;
    float point_size = sprite_width * ( uFramebufferSize.y / 1080.0 );

    gl_Position = ProjMat * ViewMat * vec4( ps.pos, 1 );
    gl_PointSize = point_size;

    // fade away at the end of life
    float time_until_death = ps.duration - life_time;
    float fadeaway_time = 6.0;
    float terminal_fadeaway_factor = 1.0 - smoothstep( fadeaway_time, 0.0, time_until_death );

    float size_factor = pow( 0.5, start_size_ratio );
    float smoke_density = 1.0 * si.aSmokeDensity * size_factor * terminal_fadeaway_factor;

    vSmokeBlack = 0.05 * smoke_density;
    vSmokeAmbient = length( uAmbientColor ) * 0.01 * smoke_density;
    vSmokeLight = 0.25 * uSmokeLightResponse * smoke_density / 800;
    vRotate = rand( ps.random_state ) * M_PI * 2;
}
