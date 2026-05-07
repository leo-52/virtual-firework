uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;
uniform float uVertexIdScalar;

uniform vec3 uAmbientColor;
uniform float uSmokeLightResponse;

#ifdef FIN_UseUniformsForBatchData
uniform int uTrailRandomGroupId;
uniform int uFirstParticleStateId;
uniform int uNumEmittedPerStar;
uniform int uEmitterInfoId;
uniform int uEmittedInfoId;
#endif

out vec4 vDebugShade;
out float vSmokeBlack;
out float vSmokeAmbient;
out float vSmokeLight;
out float vRotate;


void main() {
    vDebugShade = vec4( 0 );

    int vertex_id = int( gl_VertexID * uVertexIdScalar );
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

    int ps_id = uFirstParticleStateId + vertex_id / uNumEmittedPerStar;
    ParticleState ps;
    EmitterInfo ei = getEmitterInfoFromTexture( getParticleInfoIndex( uEmitterInfoId ) );
    if( !do_emitter_logic( ps, ei, uWindVelocity, C_PuffGravityFactor, vertex_id, ps_id, uTrailRandomGroupId, uTimeInstant ) ) {
        gl_Position = vec4( 100, 100, 100, 0.1 );
        gl_PointSize = 0;
        return;
    }

    SmokeInfo si = getSmokeInfoFromTexture( getParticleInfoIndex( uEmittedInfoId ) );

    float life_time = uTimeInstant - ps.t0;
    float life_factor = ps.duration == 0.0 ? 1.0 : life_time / ps.duration;

    float size_curve = sampleCurve( si.aSmokePuffSizeCurve, life_factor );
    float radius = mix( si.aSmokePuffStartSize, si.aSmokePuffEndSize, size_curve );
    float start_size_ratio = radius / si.aSmokePuffStartSize;
    float dist = length( project( ViewMat * vec4( ps.pos, 1 ) ).xyz );

    float fraction_alive = pow( 1.0 / start_size_ratio, 2.0 );
    float my_life_threshold = rand( ps.random_state );
    float decimation_fade_factor = ( fraction_alive - my_life_threshold ) / my_life_threshold * 1.5;
    decimation_fade_factor = smoothstep( 0.0, 1.0, decimation_fade_factor );
    if( decimation_fade_factor <= 0.0 ) {
        gl_Position = vec4( 100, 100, 100, 0.1 );
        gl_PointSize = 0;
        return;
    }

    float sprite_width = 5000.0 * radius / dist;
    float point_size = sprite_width * ( uFramebufferSize.y / 1080.0 );

    gl_Position = ProjMat * ViewMat * vec4( ps.pos, 1 );
    gl_PointSize = point_size;

    float size_factor = pow( 0.5, start_size_ratio );
    float smoke_density = 1.0 * si.aSmokeDensity * size_factor * decimation_fade_factor;

    vSmokeBlack = 0.05 * smoke_density;
    vSmokeAmbient = length( uAmbientColor ) * 0.01 * smoke_density;
    vSmokeLight = 0.25 * uSmokeLightResponse * smoke_density / 800;
    vRotate = rand( ps.random_state ) * M_PI * 2;
}
