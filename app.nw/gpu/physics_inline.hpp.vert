
#define EPSILON 1.0e-6

vec3 fastQuatVecMultiply( vec4 q, vec3 v ) {
    vec3 t = 2.0f * cross(vec3(q), v );
    return v + q.w * t + cross(vec3(q), t );
}

vec3 rotateVectorAroundNormalizedVector( vec3 normalizedAxis, vec3 p, float theta ) {
    float ct = cos(theta/2.0f );
    float st = sin(theta/2.0f );
    vec4 q = vec4(st * vec3(normalizedAxis), ct );
    return fastQuatVecMultiply(q, p );
}

void basis_from_vector( IN(vec3) vec, OUT(vec3) dir, OUT(vec3) right ) {
  if(length(vec) <= EPSILON) {
    dir = vec3(0,1,0 );
    right = vec3(1,0,0 );
  } else {
    dir = normalize(vec );
    right = cross(dir, vec3(-1,-1,-1) );
    if(length(right) < EPSILON) {
      right = vec3(1,0,0 );
    } else {
      right = normalize(right );
    }
  }
}

void apply_spiro(bool forward, INOUT(ParticleState) ps, float dt, float radius, float frequency ) {
  float lf0 = ps.duration == 0.0 ? 1.0 : max(0.0f, dt-0.01f) / ps.duration;
  float lf1 = ps.duration == 0.0 ? 1.0 : dt / ps.duration;

  vec3 dir, right;
  basis_from_vector(ps.vel, dir, right );
  right = rotateVectorAroundNormalizedVector( dir, right, rand( ps.random_state ) * M_PI * 2.0 );

  if(forward) {
    vec3 tmp = dir;
    dir = right;
    right = tmp;
  }

  radius += sampleGaussian(ps.random_state, 0.0f, radius/10.0f );
  frequency += sampleGaussian(ps.random_state, 0.0f, frequency/10.0f );

  float phase_offset1 = rand(ps.random_state)*2.0f*M_PI;
  float phase_offset2 = rand(ps.random_state)*2.0f*M_PI;

  vec3 spiro0 = rotateVectorAroundNormalizedVector(dir, radius*right, frequency*lf0 + phase_offset1 );
  vec3 spiro1 = rotateVectorAroundNormalizedVector(dir, radius*right, frequency*lf1 + phase_offset2 );

  ps.pos += spiro1;
  ps.vel += (spiro1-spiro0) * 100.0f;
}

vec3 calc_meteor_elbow( INOUT(ParticleState) ps, float dt, float elbow_end_dt, float radius_scale ) {
  vec3 dir, right;
  basis_from_vector(ps.vel, dir, right );
  right = rotateVectorAroundNormalizedVector( dir, right, rand( ps.random_state ) * M_PI * 2.0 );

  float ramp_start = 0.15f * rand(ps.random_state );
  float ramp = smoothstep(ramp_start, elbow_end_dt, dt );

  float radius = 0.25f * radius_scale * length(ps.vel) * ramp * (rand(ps.random_state) + 0.5f );

  float cycles = rand(ps.random_state ); // random initial phase offset
  cycles += dt*1.0f;

  vec3 elbow = rotateVectorAroundNormalizedVector(dir, radius*right, cycles*2.0f*M_PI );
  return elbow;
}

vec3 calc_meteor_elbow2( INOUT(ParticleState) ps, float dt, vec3 initial_vel ) {
  vec3 dir, right;
  basis_from_vector( initial_vel, dir, right );
  right = rotateVectorAroundNormalizedVector( dir, right, rand( ps.random_state ) * M_PI * 2.0 );
  vec3 up = cross( dir, right );

  float lf = ps.duration == 0.0 ? 1.0 : dt / ps.duration;

//   float ramp_duration = sampleGaussian(ps.random_state, 0.7f, 0.05f );
//   float ramp = smoothstep( 1.0f - ramp_duration, 1.0f, lf );
  float ramp = smoothstep( 0.0f, 1.0f, lf );

  float initial_speed = length( initial_vel );
  float speed_scale = sampleGaussian(ps.random_state, 0.25f, 0.05f );
  float radius = ramp * initial_speed * speed_scale;
  float right_factor = rand( ps.random_state );
  float up_factor = sqrt( 1.0f - right_factor*right_factor );
  return radius * right * right_factor + radius * up * up_factor;
}

vec3 calc_whirl_elbow( INOUT(ParticleState) ps, float dt ) {
  vec3 dir, right;
  basis_from_vector(ps.vel, dir, right );
  right = rotateVectorAroundNormalizedVector( dir, right, rand( ps.random_state ) * M_PI * 2.0 );
  float lf = ps.duration == 0.0 ? 1.0 : dt / ps.duration;

  float ramp_start = 0.05f * rand(ps.random_state );
  float ramp_waist = ramp_start + sampleGaussian(ps.random_state, 0.5f, 0.1f );
  float ramp_end = 1.2f;
  float ramp = smoothstep(ramp_start, ramp_waist, lf) * (1-smoothstep(ramp_waist, ramp_end, lf) );

  float radius = 10.0f * ramp * rand(ps.random_state );

  float cycles = 0
    + (rand(ps.random_state)+0.5f) * 1.0f * lf;
  cycles += rand(ps.random_state ); // random initial phase offset

  vec3 elbow = rotateVectorAroundNormalizedVector(right, radius*dir, cycles*2.0f*M_PI );
  return elbow;
}

vec3 calc_whirl_spiro( INOUT(ParticleState) ps, float dt ) {
  vec3 dir, right;
  basis_from_vector(ps.vel, dir, right );
  right = rotateVectorAroundNormalizedVector( dir, right, rand( ps.random_state ) * M_PI * 2.0 );
  float lf = ps.duration == 0.0 ? 1.0 : dt / ps.duration;

  float ramp_start = max(0.0f, -0.0f + 0.1f * rand(ps.random_state) );
  float ramp_waist = ramp_start + sampleGaussian(ps.random_state, 0.5f, 0.1f );
  float ramp_end = 1.2f;
  float ramp = smoothstep(ramp_start, ramp_waist, lf) * (1-smoothstep(ramp_waist, ramp_end, lf) );

  float radius = (0.5f + 1.5f * rand(ps.random_state)) * ramp;

  float cycles_ramp = 15 * smoothstep(ramp_start, ramp_waist+0.2f, lf );
  float cycles = 0
    + (rand(ps.random_state)+0.5f) * 3 * lf
    + sampleGaussian(ps.random_state, 1.0f, 0.2f) * cycles_ramp;
  cycles += rand(ps.random_state ); // random initial phase offset

  vec3 spiro = rotateVectorAroundNormalizedVector(dir, radius*right, cycles*2.0f*M_PI );
  return spiro;
}

const float DELTA_T = 0.0001f;

void apply_meteor_elbow( INOUT(ParticleState) ps, float dt, float elbow_end_dt, float radius_scale ) {
  RandomState save_random_state = ps.random_state;
  vec3 v0 = calc_meteor_elbow(ps, max(0.0f, dt-DELTA_T), elbow_end_dt, radius_scale );
  ps.random_state = save_random_state;
  vec3 v1 = calc_meteor_elbow(ps, dt, elbow_end_dt, radius_scale );
  ps.pos += v1;
  ps.vel += (v1 - v0) * (1.0f / DELTA_T );
}

void apply_meteor_elbow2( INOUT(ParticleState) ps, float dt, vec3 initial_vel ) {
  RandomState save_random_state = ps.random_state;
  vec3 v0 = calc_meteor_elbow2(ps, max(0.0f, dt-DELTA_T), initial_vel );
  ps.random_state = save_random_state;
  vec3 v1 = calc_meteor_elbow2(ps, dt, initial_vel );
  ps.pos += v1;
  ps.vel += (v1 - v0) * (1.0f / DELTA_T );
}

void apply_whirl_elbow( INOUT(ParticleState) ps, float dt ) {
  RandomState save_random_state = ps.random_state;
  vec3 v0 = calc_whirl_elbow(ps, max(0.0f, dt-DELTA_T) );
  ps.random_state = save_random_state;
  vec3 v1 = calc_whirl_elbow(ps, dt );
  ps.pos += v1;
  ps.vel += (v1 - v0) * (1.0f / DELTA_T );
}

void apply_whirl_spiro( INOUT(ParticleState) ps, float dt ) {
  RandomState save_random_state = ps.random_state;
  vec3 v0 = calc_whirl_spiro(ps, max(0.0f, dt-DELTA_T) );
  ps.random_state = save_random_state;
  vec3 v1 = calc_whirl_spiro(ps, dt );
  ps.pos += v1;
  ps.vel += (v1 - v0) * (1.0f / DELTA_T );
}

void apply_meteor_motion( IN(vec3) windVelocity, INOUT(ParticleState) ps, float dt, float transition_dt, float radius_scale ) {
  if(dt <= transition_dt) {
    apply_ballistic_motion( windVelocity, ps, dt );
    apply_meteor_elbow(ps, dt, transition_dt, radius_scale );
  } else {
    apply_ballistic_motion( windVelocity, ps, transition_dt );
    apply_meteor_elbow(ps, transition_dt, transition_dt, radius_scale );
    apply_ballistic_motion( windVelocity, ps, dt-transition_dt );
  }
}

void step_physics( IN(vec3) windVelocity, INOUT(ParticleState) ps, float dt ) {
  if((int(ps.motion_flags) & C_MotionFlag_MotionStatic) != 0) {
    return;
  }

#ifdef DO_BALLISTIC_PHYSICS_ONLY
    apply_ballistic_motion( windVelocity, ps, dt );
#else

  float lf = ps.duration == 0.0 ? 1.0 : dt / ps.duration;

  if((int(ps.motion_flags) & C_MotionFlag_MotionSerpent) != 0) {
    float transition_dt = sampleGaussian(ps.random_state, 0.5f, 0.2f );
    apply_meteor_motion( windVelocity, ps, dt, transition_dt, 1.0f );
    float ramp1 = smoothstep(0.0f, 0.2f, lf );
    apply_spiro(false, ps, dt, ramp1 * 4.5f, 5.0f );
    apply_spiro(false, ps, dt, ramp1 * 0.35f, 40.0f );
  } else if((int(ps.motion_flags) & C_MotionFlag_MotionSmallSerpent) != 0) {
    float transition_dt = sampleGaussian(ps.random_state, 0.5f, 0.2f );
    apply_meteor_motion( windVelocity, ps, dt, transition_dt, 0.25f );
    float ramp1 = smoothstep(0.0f, 0.2f, lf );
    apply_spiro(false, ps, dt, ramp1 * 4.5f, 5.0f );
    apply_spiro(false, ps, dt, ramp1 * 0.35f, 40.0f );
  } else if((int(ps.motion_flags) & C_MotionFlag_MotionWhistle) != 0) {
    //whistle moves like serpent with less 'propulsion', giving it a more ballistic path
    float transition_dt = sampleGaussian(ps.random_state, 0.5f, 0.2f );
    apply_meteor_motion( windVelocity, ps, dt, transition_dt, 1.0f );
    float ramp1 = smoothstep(0.0f, 0.2f, lf );
  } else if((int(ps.motion_flags) & C_MotionFlag_MotionSmallWhistle) != 0) {
    //whistle moves like serpent with less 'propulsion', giving it a more ballistic path
    float transition_dt = sampleGaussian(ps.random_state, 0.5f, 0.2f );
    apply_meteor_motion( windVelocity, ps, dt, transition_dt, 0.25f );
  } else if((int(ps.motion_flags) & C_MotionFlag_MotionSpinner) != 0) {
    apply_ballistic_motion( windVelocity, ps, dt );

    float spiro1_lf0 = sampleGaussian(ps.random_state, 0.75f, 0.1f );
    float spiro1_radius = smoothstep(spiro1_lf0, spiro1_lf0+0.01f, lf) * sampleGaussian(ps.random_state, 2.0f, 0.0f );
    float spiro1_frequeny = sampleGaussian(ps.random_state, 145.0f, 0.0f );
    apply_spiro(false, ps, dt, spiro1_radius, spiro1_frequeny );

    float spiro2_lf0 = sampleGaussian(ps.random_state, 0.90f, 0.1f );
    float spiro2_radius = smoothstep(spiro2_lf0, spiro2_lf0+0.01f, lf) * sampleGaussian(ps.random_state, 4.0f, 0.0f );
    float spiro2_frequeny = sampleGaussian(ps.random_state, 65.0f, 0.0f );
    apply_spiro(true, ps, dt, spiro2_radius, spiro2_frequeny );

  } else if((int(ps.motion_flags) & C_MotionFlag_MotionWhirl) != 0) {
    float transition_dt = sampleGaussian(ps.random_state, 0.75f, 0.10f );
    apply_meteor_motion( windVelocity, ps, dt, transition_dt, 0.25f );
    apply_whirl_spiro(ps, dt );
  } else if((int(ps.motion_flags) & C_MotionFlag_MotionMeteor) != 0) {
    vec3 initial_vel = ps.vel;
    apply_ballistic_motion( windVelocity, ps, dt );
    apply_meteor_elbow2( ps, dt, initial_vel );

  } else {
    apply_ballistic_motion( windVelocity, ps, dt );
  }
#endif
}

