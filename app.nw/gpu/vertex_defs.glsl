// AUTO-GENERATED, edit vertex_defs.rb instead of this file
const int C_SIM_HZ = 100;
const int C_MaxParticleInfos = 65536;
const int C_MaxFakePositionCount = 128;
const int C_MaxStaticPointLightInfosCount = 128;
const int C_MaxGroundSplatsCount = 128;
const int C_MaxBatchSearchDepth = 20;
const int C_NumBreakSpherePoints = 1024;
const float C_LoopingCurvePeriod = 4.0;
const float C_MaxK = 1.0;
const float C_BallisticKThreshold = 0.0001;
const int C_TextureUnit_MAX = 31;
const int C_TextureUnit_CurveInfosTexture = 27;
const int C_TextureUnit_BatchSearchEntriesTexture = 26;
const int C_TextureUnit_TrailBatchDatas = 25;
const int C_TextureUnit_StarBatchDatas = 24;
const int C_TextureUnit_LightBeamInfosTexture = 23;
const int C_TextureUnit_StaticPointLightInfosTexture = 22;
const int C_TextureUnit_WaterNormalTexture = 21;
const int C_TextureUnit_ReflectionTexture = 20;
const int C_TextureUnit_SpectralRgbTexture = 19;
const int C_TextureUnit_SmokePuffTexture = 18;
const int C_TextureUnit_SmokeFlipbookTexture = 17;
const int C_TextureUnit_SparkTextureIntensityRadiuses = 16;
const int C_TextureUnit_CurveTexture = 15;
const int C_TextureUnit_SparkTexture = 14;
const int C_TextureUnit_PuffTexture = 13;
const int C_TextureUnit_DiffuseTexture = 12;
const int C_TextureUnit_GroundSplatsTexture = 11;
const int C_TextureUnit_BlackbodyTexture = 10;
const int C_TextureUnit_ParticleStatesTexture = 9;
const int C_TextureUnit_SparkInfosTexture = 8;
const int C_TextureUnit_SmokeInfosTexture = 7;
const int C_TextureUnit_FlameInfosTexture = 6;
const int C_TextureUnit_EmitterInfosTexture = 5;
const int C_TextureUnit_Curve4Texture = 4;
const int C_TextureUnit_Misc3 = 3;
const int C_TextureUnit_Misc2 = 2;
const int C_TextureUnit_Misc1 = 1;
const int C_BlackbodyTextureTempMin = 500;
const int C_BlackbodyTextureTempMax = 20000;
const float C_SpectralRgbTextureWavelengthMin = 389.9;
const float C_SpectralRgbTextureWavelengthMax = 830.1;
const int C_SkyDomeNumDivisions = 36;
const int C_SkyDomeNumSlices = 10;
const int C_CurveTextureWidth = 1024;
const int C_SparkTextureWidth = 2048;
const float C_MinParticleDuration = 0.016666666666666666;
const float C_PuffGravityFactor = 0.1;
const int C_EmitStyle_Uniform = 0;
const int C_EmitStyle_Turbulent = 1;
const int C_EmitStyle_TigerTail = 2;
const int C_EmitStyle_Break = 3;
const int C_EmitStyle_Fountain = 4;
const int C_MotionFlag_MotionSerpent = 2;
const int C_MotionFlag_MotionSpinner = 4;
const int C_MotionFlag_MotionWhirl = 8;
const int C_MotionFlag_MotionMeteor = 16;
const int C_MotionFlag_MotionSwimming = 32;
const int C_MotionFlag_MotionStatic = 64;
const int C_MotionFlag_MotionWhistle = 128;
const int C_MotionFlag_MotionSmallSerpent = 256;
const int C_MotionFlag_MotionSmallWhistle = 512;
const int C_EmitFlag_RandomizeEmitTimeOffset = 1;
const int C_CurveId_zero = 0;
const int C_CurveId_one = 1;
const int C_CurveId_gaussian = 2;
const int C_EmitCurve_Taper1 = 3;
const int C_EmitCurve_Linear = 4;
const int C_EmitCurve_Linear20 = 5;
const int C_EmitCurve_Farfalle = 6;
const int C_EmitCurve_PopcornCrackle = 7;
const int C_EmitCurve_Spinner = 8;
const int C_EmitCurve_GroundStrobe = 9;
const int C_Field_sparkColor = 1;
const int C_Field_sparkRadiusGaussian = 2;
const int C_Field_sparkIntensityCurve = 3;
const int C_Field_sparkScaleIntensity = 4;
const int C_Field_sparkFlags = 5;
const int C_Field_smokePuffEndSizeTime = 6;
const int C_Field_smokePuffSizeCurve = 7;
const int C_Field_smokePuffStartSize = 8;
const int C_Field_smokePuffEndSize = 9;
const int C_Field_smokeDensity = 10;
const int C_Field_flamePuffStartSize = 11;
const int C_Field_flamePuffEndSize = 12;
const int C_Field_flamePuffSizeCurve = 13;
const int C_Field_flamePuffTempCurve = 14;
const int C_Field_flamePuffAlphaCurve = 15;
const int C_Field_emitLifetimeGaussian = 16;
const int C_Field_emitWindFrictionGaussian = 17;
const int C_Field_emitVelGaussian = 18;
const int C_Field_emitInheritVelocityGaussian = 19;
const int C_Field_emitVelTaper = 20;
const int C_Field_emitDiscRadius = 21;
const int C_Field_emitCurve = 22;
const int C_Field_emitStyle = 23;
const int C_Field_emitStyleArg0 = 24;
const int C_Field_emitFlags = 25;
const int C_Field_breakRandomTweak = 26;
const int C_Field_COUNT = 32;





struct BatchSearchEntry {
    int compare_to;
    int bse_gte;
    int bse_else;
    int batch_id;

};
#define INPUTS_IN_BatchSearchEntry in int IN_compare_to; in int IN_bse_gte; in int IN_bse_else; in int IN_batch_id; BatchSearchEntry COPY_IN_BatchSearchEntry() { BatchSearchEntry result; result.compare_to = IN_compare_to;  result.bse_gte = IN_bse_gte;  result.bse_else = IN_bse_else;  result.batch_id = IN_batch_id;  return result; }






struct BlurStage {
    int downsamples;
    float radius;
    float preAdd;
    float postScale;

};
#define INPUTS_IN_BlurStage in int IN_downsamples; in float IN_radius; in float IN_preAdd; in float IN_postScale; BlurStage COPY_IN_BlurStage() { BlurStage result; result.downsamples = IN_downsamples;  result.radius = IN_radius;  result.preAdd = IN_preAdd;  result.postScale = IN_postScale;  return result; }






struct CurveInfo {
    float aMinX;
    float aMinY;
    float aMaxX;
    float aMaxY;

};
#define INPUTS_IN_CurveInfo in float IN_aMinX; in float IN_aMinY; in float IN_aMaxX; in float IN_aMaxY; CurveInfo COPY_IN_CurveInfo() { CurveInfo result; result.aMinX = IN_aMinX;  result.aMinY = IN_aMinY;  result.aMaxX = IN_aMaxX;  result.aMaxY = IN_aMaxY;  return result; }






struct EmitterInfo {
    vec2 aEmitLifetimeGaussian;
    vec2 aEmitWindFrictionGaussian;
    vec2 aEmitVelGaussian;
    vec2 aEmitInheritVelocityGaussian;
    float aEmitVelTaper;
    float aEmitDiscDiameter;
    int aEmitCurve;
    int aEmitStyle;
    float aEmitStyleArg0;
    int aEmitFlags;
    int aBreakRandomTweak;

  float _alignmentPad0;
};
#define INPUTS_IN_EmitterInfo in vec2 IN_aEmitLifetimeGaussian; in vec2 IN_aEmitWindFrictionGaussian; in vec2 IN_aEmitVelGaussian; in vec2 IN_aEmitInheritVelocityGaussian; in float IN_aEmitVelTaper; in float IN_aEmitDiscDiameter; in int IN_aEmitCurve; in int IN_aEmitStyle; in float IN_aEmitStyleArg0; in int IN_aEmitFlags; in int IN_aBreakRandomTweak; EmitterInfo COPY_IN_EmitterInfo() { EmitterInfo result; result.aEmitLifetimeGaussian = IN_aEmitLifetimeGaussian;  result.aEmitWindFrictionGaussian = IN_aEmitWindFrictionGaussian;  result.aEmitVelGaussian = IN_aEmitVelGaussian;  result.aEmitInheritVelocityGaussian = IN_aEmitInheritVelocityGaussian;  result.aEmitVelTaper = IN_aEmitVelTaper;  result.aEmitDiscDiameter = IN_aEmitDiscDiameter;  result.aEmitCurve = IN_aEmitCurve;  result.aEmitStyle = IN_aEmitStyle;  result.aEmitStyleArg0 = IN_aEmitStyleArg0;  result.aEmitFlags = IN_aEmitFlags;  result.aBreakRandomTweak = IN_aBreakRandomTweak;  return result; }






struct FlameInfo {
    float aFlamePuffStartSize;
    float aFlamePuffEndSize;
    int aFlamePuffSizeCurve;
    int aFlamePuffTempCurve;
    int aFlamePuffAlphaCurve;

  float _alignmentPad0;
  float _alignmentPad1;
  float _alignmentPad2;
};
#define INPUTS_IN_FlameInfo in float IN_aFlamePuffStartSize; in float IN_aFlamePuffEndSize; in int IN_aFlamePuffSizeCurve; in int IN_aFlamePuffTempCurve; in int IN_aFlamePuffAlphaCurve; FlameInfo COPY_IN_FlameInfo() { FlameInfo result; result.aFlamePuffStartSize = IN_aFlamePuffStartSize;  result.aFlamePuffEndSize = IN_aFlamePuffEndSize;  result.aFlamePuffSizeCurve = IN_aFlamePuffSizeCurve;  result.aFlamePuffTempCurve = IN_aFlamePuffTempCurve;  result.aFlamePuffAlphaCurve = IN_aFlamePuffAlphaCurve;  return result; }






struct LightBeamInfo {
    vec3 aColor0;
    float aIntensity1;
    vec3 aColor1;
    int aIntensityCurve;
    float aAngleSpread0;
    float aAngleSpread1;
    float aDiameter0;
    float aConeHeight0;

  float _alignmentPad0;
  float _alignmentPad1;
  float _alignmentPad2;
  float _alignmentPad3;
};
#define INPUTS_IN_LightBeamInfo in vec3 IN_aColor0; in float IN_aIntensity1; in vec3 IN_aColor1; in int IN_aIntensityCurve; in float IN_aAngleSpread0; in float IN_aAngleSpread1; in float IN_aDiameter0; in float IN_aConeHeight0; LightBeamInfo COPY_IN_LightBeamInfo() { LightBeamInfo result; result.aColor0 = IN_aColor0;  result.aIntensity1 = IN_aIntensity1;  result.aColor1 = IN_aColor1;  result.aIntensityCurve = IN_aIntensityCurve;  result.aAngleSpread0 = IN_aAngleSpread0;  result.aAngleSpread1 = IN_aAngleSpread1;  result.aDiameter0 = IN_aDiameter0;  result.aConeHeight0 = IN_aConeHeight0;  return result; }






struct MeshVertexPCD {
    vec3 aPos;
    vec3 aColor;
    vec2 aDiffuseUV;

  float _alignmentPad0;
  float _alignmentPad1;
  float _alignmentPad2;
  float _alignmentPad3;
  float _alignmentPad4;
  float _alignmentPad5;
};
#define INPUTS_IN_MeshVertexPCD in vec3 IN_aPos; in vec3 IN_aColor; in vec2 IN_aDiffuseUV; MeshVertexPCD COPY_IN_MeshVertexPCD() { MeshVertexPCD result; result.aPos = IN_aPos;  result.aColor = IN_aColor;  result.aDiffuseUV = IN_aDiffuseUV;  return result; }






struct ParticleState {
    vec3 pos;
    float t0;
    vec3 vel;
    float duration;
    vec3 gravity;
    float wind_friction;
    vec4 ori0;
    vec4 ori1;
    uint random_state;
    float motion_flags;
    float dmx_strobing_frequency;
    int pos_curve4_id;
    int vel_curve4_id;
    int ori_curve4_id;
    int rgb_curve4_id;

  float _alignmentPad0;
  float _alignmentPad1;
  float _alignmentPad2;
  float _alignmentPad3;
  float _alignmentPad4;
};
#define INPUTS_IN_ParticleState in vec3 IN_pos; in float IN_t0; in vec3 IN_vel; in float IN_duration; in vec3 IN_gravity; in float IN_wind_friction; in vec4 IN_ori0; in vec4 IN_ori1; in uint IN_random_state; in float IN_motion_flags; in float IN_dmx_strobing_frequency; in int IN_pos_curve4_id; in int IN_vel_curve4_id; in int IN_ori_curve4_id; in int IN_rgb_curve4_id; ParticleState COPY_IN_ParticleState() { ParticleState result; result.pos = IN_pos;  result.t0 = IN_t0;  result.vel = IN_vel;  result.duration = IN_duration;  result.gravity = IN_gravity;  result.wind_friction = IN_wind_friction;  result.ori0 = IN_ori0;  result.ori1 = IN_ori1;  result.random_state = IN_random_state;  result.motion_flags = IN_motion_flags;  result.dmx_strobing_frequency = IN_dmx_strobing_frequency;  result.pos_curve4_id = IN_pos_curve4_id;  result.vel_curve4_id = IN_vel_curve4_id;  result.ori_curve4_id = IN_ori_curve4_id;  result.rgb_curve4_id = IN_rgb_curve4_id;  return result; }






struct PhysicsParams {
    vec3 wind_velocity;

  float _alignmentPad0;
};
#define INPUTS_IN_PhysicsParams in vec3 IN_wind_velocity; PhysicsParams COPY_IN_PhysicsParams() { PhysicsParams result; result.wind_velocity = IN_wind_velocity;  return result; }






struct PhysicsResult {
    vec3 pos;
    float st;
    float et;
    int info_id;
    uint random_seed;
    float distribution_x;
    vec4 debug1;
    vec4 debug2;

};
#define INPUTS_IN_PhysicsResult in vec3 IN_pos; in float IN_st; in float IN_et; in int IN_info_id; in uint IN_random_seed; in float IN_distribution_x; in vec4 IN_debug1; in vec4 IN_debug2; PhysicsResult COPY_IN_PhysicsResult() { PhysicsResult result; result.pos = IN_pos;  result.st = IN_st;  result.et = IN_et;  result.info_id = IN_info_id;  result.random_seed = IN_random_seed;  result.distribution_x = IN_distribution_x;  result.debug1 = IN_debug1;  result.debug2 = IN_debug2;  return result; }






struct SmokeInfo {
    float aSmokeDensity;
    float aSmokePuffStartSize;
    float aSmokePuffEndSize;
    int aSmokePuffSizeCurve;

};
#define INPUTS_IN_SmokeInfo in float IN_aSmokeDensity; in float IN_aSmokePuffStartSize; in float IN_aSmokePuffEndSize; in int IN_aSmokePuffSizeCurve; SmokeInfo COPY_IN_SmokeInfo() { SmokeInfo result; result.aSmokeDensity = IN_aSmokeDensity;  result.aSmokePuffStartSize = IN_aSmokePuffStartSize;  result.aSmokePuffEndSize = IN_aSmokePuffEndSize;  result.aSmokePuffSizeCurve = IN_aSmokePuffSizeCurve;  return result; }






struct SparkInfo {
    vec3 aColor0;
    float aIntensity1;
    vec3 aColor1;
    int aIntensityCurve;
    vec2 aDiameterGaussian;
    float aIntensityCurveLoopDuration;
    float aTemperature0;
    float aTemperature1;
    vec2 aHotCircleDiameterGaussian;

};
#define INPUTS_IN_SparkInfo in vec3 IN_aColor0; in float IN_aIntensity1; in vec3 IN_aColor1; in int IN_aIntensityCurve; in vec2 IN_aDiameterGaussian; in float IN_aIntensityCurveLoopDuration; in float IN_aTemperature0; in float IN_aTemperature1; in vec2 IN_aHotCircleDiameterGaussian; SparkInfo COPY_IN_SparkInfo() { SparkInfo result; result.aColor0 = IN_aColor0;  result.aIntensity1 = IN_aIntensity1;  result.aColor1 = IN_aColor1;  result.aIntensityCurve = IN_aIntensityCurve;  result.aDiameterGaussian = IN_aDiameterGaussian;  result.aIntensityCurveLoopDuration = IN_aIntensityCurveLoopDuration;  result.aTemperature0 = IN_aTemperature0;  result.aTemperature1 = IN_aTemperature1;  result.aHotCircleDiameterGaussian = IN_aHotCircleDiameterGaussian;  return result; }






struct StarBatchData {
    int num_particles;
    int first_particle_state_id;
    int info_id;

  float _alignmentPad0;
};
#define INPUTS_IN_StarBatchData in int IN_num_particles; in int IN_first_particle_state_id; in int IN_info_id; StarBatchData COPY_IN_StarBatchData() { StarBatchData result; result.num_particles = IN_num_particles;  result.first_particle_state_id = IN_first_particle_state_id;  result.info_id = IN_info_id;  return result; }






struct StaticPointLightInfo {
    vec3 aColor0;
    float aIntensity1;
    vec3 pos;
    float st;
    int aIntensityCurve;
    float et;

  float _alignmentPad0;
  float _alignmentPad1;
  float _alignmentPad2;
  float _alignmentPad3;
  float _alignmentPad4;
  float _alignmentPad5;
};
#define INPUTS_IN_StaticPointLightInfo in vec3 IN_aColor0; in float IN_aIntensity1; in vec3 IN_pos; in float IN_st; in int IN_aIntensityCurve; in float IN_et; StaticPointLightInfo COPY_IN_StaticPointLightInfo() { StaticPointLightInfo result; result.aColor0 = IN_aColor0;  result.aIntensity1 = IN_aIntensity1;  result.pos = IN_pos;  result.st = IN_st;  result.aIntensityCurve = IN_aIntensityCurve;  result.et = IN_et;  return result; }






struct TrailBatchData {
    int num_particles;
    int first_particle_state_id;
    int num_emitted_per_star;
    int emitter_info_id;
    int emitted_info_id;
    int trail_random_group_id;

  float _alignmentPad0;
  float _alignmentPad1;
};
#define INPUTS_IN_TrailBatchData in int IN_num_particles; in int IN_first_particle_state_id; in int IN_num_emitted_per_star; in int IN_emitter_info_id; in int IN_emitted_info_id; in int IN_trail_random_group_id; TrailBatchData COPY_IN_TrailBatchData() { TrailBatchData result; result.num_particles = IN_num_particles;  result.first_particle_state_id = IN_first_particle_state_id;  result.num_emitted_per_star = IN_num_emitted_per_star;  result.emitter_info_id = IN_emitter_info_id;  result.emitted_info_id = IN_emitted_info_id;  result.trail_random_group_id = IN_trail_random_group_id;  return result; }

