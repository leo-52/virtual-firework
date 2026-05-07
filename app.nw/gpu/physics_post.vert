
bool
do_emitter_logic( out ParticleState ps, EmitterInfo ei, vec3 windVelocity, float gravity_factor, int vertex_id, int ps_id, int trail_random_group_id, float time_instant )
{
    ps = getParticleStateFromTexture( ps_id );
    ps.random_state = init_random( randUint( ps.random_state ), uint( trail_random_group_id ), uint( vertex_id ) );

    float emitter_life_factor = sampleCurve_emitcurve( ei.aEmitCurve, rand( ps.random_state ) );

    float time_remaining = time_instant - ps.t0;

    bool do_random_emit_time_offset = 0 != (ei.aEmitFlags & C_EmitFlag_RandomizeEmitTimeOffset);
    if( do_random_emit_time_offset ) {
        float emit_time_offset = rand( ps.random_state );
        emitter_life_factor = mod( emitter_life_factor + emit_time_offset, 1.0 );
    } else {
        emitter_life_factor = clamp( emitter_life_factor, 0.0, 1.0 );
    }
    float time_before_emit = emitter_life_factor * ps.duration;
    if( time_remaining < time_before_emit ) { return false; }


    ///////////////////////////////////////////////////////////////////
    // this code blob is duplicated, keep it up-to-date in:
    // shader_spark_star_v1.vert
    // shader_spark_star_v2.vert
    // shader_smoke_star.vert
    // shader_light_beam_star.vert
    // physics_post.vert (not quite the same as the others)
    float posCurveLifeFactor = emitter_life_factor;
    bool didOri = false;
    vec4 ori = vec4(0,0,0,1);
    if( ps.ori0 != vec4(0) ) {
        ori = quatSlerp( ps.ori0, ps.ori1, emitter_life_factor );
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
        apply_ballistic_motion( uWindVelocity, ps, time_before_emit );
    }
    ///////////////////////////////////////////////////////////////////


    vec3 emitter_dir;
    vec3 emitter_right;
    vec3 emitter_up;

    basis_from_vector( ps.vel, emitter_dir, emitter_right );
    bool randomize_emitter_spin = (ei.aEmitStyle == C_EmitStyle_Uniform) || (ei.aEmitStyle == C_EmitStyle_Fountain);
    if( randomize_emitter_spin ) {
        emitter_right = rotateVectorAroundNormalizedVector( emitter_dir, emitter_right, rand( ps.random_state ) * M_PI * 2.0 );
    }
    emitter_up = cross( emitter_dir, emitter_right );

    float taper_emit_vel_factor = mix( 1.0, ei.aEmitVelTaper, emitter_life_factor );

    vec3 inherited_vel = ps.vel * sampleGaussian( ps.random_state, ei.aEmitInheritVelocityGaussian );
    vec2 emitPos = pointOnDisc( ps.random_state );
    float emitDiscDiameter = abs( sampleGaussian( ps.random_state, ei.aEmitDiscDiameter, ei.aEmitDiscDiameter * 0.4 ) );
    float emitDiscRadius = emitDiscDiameter / 2.0;

    vec3 emitterPosAtBirthTime = ps.pos;
    float wind_cell_scale = mix( 2.0, 5.0, clamp( length( windVelocity ), 0.0, 10.0 ) / 10.0 );
    vec3 smoke_initial_velocity = wind_cell_scale * getSmokeInitialVelocity( emitterPosAtBirthTime );
    if( ps.motion_flags == float(C_MotionFlag_MotionStatic) ) {
        //fountains don't have smoke_initial_velocity because it angles the stream too much
        smoke_initial_velocity = vec3(0);
    }

    vec3 emit_vel;
    if( false ) {
    } else if( ei.aEmitStyle == C_EmitStyle_Turbulent ) {
        float theta = time_before_emit * 10.0;
        theta = cos( 7.0 * time_before_emit + 2.0 );
        theta += cos( 17.0 * time_before_emit + 5.0 );
        theta += cos( 29.0 * time_before_emit + 31.0 );
        float n = 3.0;
        theta = ( theta / n ) * M_PI;
        vec3 emit_dir = rotateVectorAroundNormalizedVector( emitter_dir, emitter_right, theta );
        float emit_speed = max( 0.0, sampleGaussian( ps.random_state, ei.aEmitVelGaussian ) );
        emit_vel = emit_speed * emit_dir * taper_emit_vel_factor + inherited_vel + smoke_initial_velocity;
    } else if( ei.aEmitStyle == C_EmitStyle_Uniform ) {
        float theta = rand( ps.random_state ) * M_PI * 2.0;
        vec3 emit_dir = pointOnSphere( ps.random_state, 720.0 );
        float emit_speed = max( 0.0, sampleGaussian( ps.random_state, ei.aEmitVelGaussian ) );
        emit_vel = emit_speed * emit_dir * taper_emit_vel_factor + inherited_vel + smoke_initial_velocity;
    } else if( ei.aEmitStyle == C_EmitStyle_TigerTail ) {
        float theta = time_before_emit * ei.aEmitStyleArg0 * 2.0 * M_PI;
        vec3 sideways = rotateVectorAroundNormalizedVector( emitter_dir, emitter_right, theta );
        vec3 sphere = pointOnSphere( ps.random_state, 720.0 );
        vec3 emit_dir = mix( sideways, sphere, 0.3 );
        float emit_speed = max( 0.0, sampleGaussian( ps.random_state, ei.aEmitVelGaussian ) );
        emit_vel = emit_speed * emit_dir * taper_emit_vel_factor + inherited_vel + smoke_initial_velocity;
    } else if( ei.aEmitStyle == C_EmitStyle_Fountain ) {
        vec3 emit_dir = pointOnSphere( ps.random_state, ei.aEmitStyleArg0 );
        emit_dir = emit_dir.x * emitter_right + emit_dir.y * emitter_dir + emit_dir.z * emitter_up;
        float emit_speed = max( 0.0, sampleGaussian( ps.random_state, ei.aEmitVelGaussian ) );
        emit_vel = emit_speed * emit_dir * taper_emit_vel_factor + inherited_vel + smoke_initial_velocity;
    }

    ps.pos = emitterPosAtBirthTime + emitDiscRadius * emitPos.y * emitter_up + emitDiscRadius * emitPos.x * emitter_right;
    ps.wind_friction = sampleGaussian( ps.random_state, ei.aEmitWindFrictionGaussian );
    ps.duration = max( C_MinParticleDuration, sampleGaussian( ps.random_state, ei.aEmitLifetimeGaussian ) );
    ps.motion_flags = 0.0;
    ps.gravity = vec3( 0, -9.8 * gravity_factor, 0 );
    ps.vel = emit_vel;
    ps.t0 += time_before_emit;

    if( ( ps.t0 + ps.duration ) < time_instant ) { return false; }

    apply_ballistic_motion( windVelocity, ps, time_instant - ps.t0 );

    return true;
}
