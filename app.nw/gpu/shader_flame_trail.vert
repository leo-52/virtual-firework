uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform float uVertexIdScalar;

#ifdef FIN_UseUniformsForBatchData
uniform int uTrailRandomGroupId;
uniform int uFirstParticleStateId;
uniform int uNumEmittedPerStar;
uniform int uEmitterInfoId;
uniform int uEmittedInfoId;
#endif

out float vRotate;
out float vLifeFactor;
out float vAlpha;
out vec3 vTemperatureColor;

void main() {
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

    int ps_id = uFirstParticleStateId + vertex_id/uNumEmittedPerStar;
    ParticleState ps;
    EmitterInfo ei = getEmitterInfoFromTexture( getParticleInfoIndex( uEmitterInfoId ) );
    if( !do_emitter_logic( ps, ei, uWindVelocity, C_PuffGravityFactor, vertex_id, ps_id, uTrailRandomGroupId, uTimeInstant ) ) {
        gl_Position = vec4( 100, 100, 100, 0.1 );
        gl_PointSize = 0;
        return;
    }

    FlameInfo fi = getFlameInfoFromTexture( getParticleInfoIndex( uEmittedInfoId ) );

    float life_time = uTimeInstant - ps.t0;
    float life_factor = ps.duration == 0.0 ? 1.0 : life_time / ps.duration;

    if( life_factor < 0 || life_factor > 1 ) {
        gl_Position = vec4( 100, 100, 100, 0.1 );
        gl_PointSize = 0;
        return;
    }


    float size_curve = sampleCurve( fi.aFlamePuffSizeCurve, life_factor );
    float puff_size = mix( fi.aFlamePuffStartSize, fi.aFlamePuffEndSize, size_curve );

    float dist = length( project( ViewMat * vec4( ps.pos, 1 ) ).xyz );

    float sprite_width = 100.0 * puff_size / dist;

    gl_Position = ProjMat * ViewMat * vec4( ps.pos, 1 );
    gl_PointSize = sprite_width;
    vRotate = rand( ps.random_state ) * M_PI * 2 + uTimeInstant * ( rand( ps.random_state ) * 2.0 - 1.0 ) * 1.2;
    vLifeFactor = life_factor;

    vTemperatureColor = 5e-13 * getBlackbodyColor( sampleCurve( fi.aFlamePuffTempCurve, life_factor ) );

    vAlpha = sampleCurve( fi.aFlamePuffAlphaCurve, life_factor );
}
