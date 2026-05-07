#define M_PI 3.1415926535897932384626433832795

float
floatFromUintBits( uint m )
{
    const uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
    const uint ieeeOne = 0x3F800000u;      // 1.0 in IEEE binary32

    m &= ieeeMantissa; // Keep only mantissa bits (fractional part)
    m |= ieeeOne;      // Add fractional part to 1.0

    float f = uintBitsToFloat( m ); // Range [1:2]
    return f - 1.0;                 // Range [0:1]
}

uint
hash( uint x )
{
    x += ( x << 10u );
    x ^= ( x >> 6u );
    x += ( x << 3u );
    x ^= ( x >> 11u );
    x += ( x << 15u );
    return x;
}

bool
epsilonEquals( float a, float b, float e )
{
    return abs( a - b ) < e;
}

#define RandomState uint
void
mutate_RandomState( inout RandomState x )
{
    x = hash( x );
}

#define BIG_PRIME_1 4200000089u // just a big prime near 2^32
RandomState
init_random( uint a )
{
    return hash( a ^ BIG_PRIME_1 );
}
RandomState
init_random( uint a, uint b )
{
    return hash( a ^ BIG_PRIME_1 ) ^ hash( b ^ BIG_PRIME_1 );
}
RandomState
init_random( uint a, uint b, uint c )
{
    return hash( a ^ BIG_PRIME_1 ) ^ hash( b ^ BIG_PRIME_1 ) ^ hash( c ^ BIG_PRIME_1 );
}

uint
randUint( inout RandomState random_state )
{
    uint r = random_state;
    mutate_RandomState( random_state );
    return r;
}

float
rand( inout RandomState random_state )
{
    return floatFromUintBits( randUint( random_state ) );
}

// Box-Muller method, but we discard one of the two outputted gaussian values
float
sampleGaussian( inout RandomState random_state, float mean, float variance )
{
    float R = sqrt( -2.0 * log( rand( random_state ) ) );
    float O = 2.0 * M_PI * rand( random_state );
    float result = R * sin( O ) * variance + mean;
    float _clamped = clamp( result, mean - variance * 3.0, mean + variance * 3.0 );
    return _clamped;
}
float
sampleGaussian( inout RandomState random_state, vec2 g )
{
    return sampleGaussian( random_state, g.x, g.y );
}

vec2
pointOnDisc( inout RandomState random_state )
{
    float pt = rand( random_state ) * 2.0 * M_PI;
    float pr = sqrt( rand( random_state ) );
    return vec2( pr * cos( pt ), pr * sin( pt ) );
}

// this uses the 'cylinder maps to sphere' construction
vec3
pointOnSphere( inout RandomState random_state, float degsSigma )
{
    float deg = abs( sampleGaussian( random_state, 0.0, degsSigma / 2.0 ) );
    deg = mod( deg, 360.0 );

    float y = 1.0 - 2.0 * deg / 360.0;
    float theta = 2.0 * M_PI * rand( random_state );
    float radius_at_y = sqrt( 1.0 - y * y );
    return vec3( radius_at_y * cos( theta ), y, radius_at_y * sin( theta ) );
}

mat3
quatToMat3( vec4 q )
{
    mat3 result;
    float qxx = ( q.x * q.x );
    float qyy = ( q.y * q.y );
    float qzz = ( q.z * q.z );
    float qxz = ( q.x * q.z );
    float qxy = ( q.x * q.y );
    float qyz = ( q.y * q.z );
    float qwx = ( q.w * q.x );
    float qwy = ( q.w * q.y );
    float qwz = ( q.w * q.z );

    result[ 0 ][ 0 ] = 1.0 - 2.0 * ( qyy + qzz );
    result[ 0 ][ 1 ] = 2.0 * ( qxy + qwz );
    result[ 0 ][ 2 ] = 2.0 * ( qxz - qwy );

    result[ 1 ][ 0 ] = 2.0 * ( qxy - qwz );
    result[ 1 ][ 1 ] = 1.0 - 2.0 * ( qxx + qzz );
    result[ 1 ][ 2 ] = 2.0 * ( qyz + qwx );

    result[ 2 ][ 0 ] = 2.0 * ( qxz + qwy );
    result[ 2 ][ 1 ] = 2.0 * ( qyz - qwx );
    result[ 2 ][ 2 ] = 1.0 - 2.0 * ( qxx + qyy );
    return result;
}

vec4
quatSlerp( vec4 x, vec4 y, float a )
{
    vec4 z = y;

    float cosTheta = dot( x, y );

    // If cosTheta < 0, the interpolation will take the long way around the sphere.
    // To fix this, one quat must be negated.
    if( cosTheta < 0.0 ) {
        z = -y;
        cosTheta = -cosTheta;
    }

    // Perform a linear interpolation when cosTheta is close to 1 to avoid side effect of sin(angle) becoming a zero denominator
    if( cosTheta > 1.0 - 0.0001 ) {
        // Linear interpolation
        return vec4( mix( x.x, z.x, a ), mix( x.y, z.y, a ), mix( x.z, z.z, a ), mix( x.w, z.w, a ) );
    } else {
        // Essential Mathematics, page 467
        float angle = acos( cosTheta );
        return ( sin( ( 1.0 - a ) * angle ) * x + sin( a * angle ) * z ) / sin( angle );
    }
}

vec4
quatApply( vec4 a, vec4 b ) // matches u_math.cpp void U_fori::apply
{
    return vec4( ( b.w * a.x ) + ( b.x * a.w ) + ( b.y * a.z ) - ( b.z * a.y ), ( b.w * a.y ) + ( b.y * a.w ) + ( b.z * a.x ) - ( b.x * a.z ), ( b.w * a.z ) + ( b.z * a.w ) + ( b.x * a.y ) - ( b.y * a.x ), ( b.w * a.w ) - ( b.x * a.x ) - ( b.y * a.y ) - ( b.z * a.z ) );
}


uniform vec4 uDebugMouse;
uniform float uTimeInstant;
uniform vec3 uWindVelocity;

uniform float uSparkMinContribution;
uniform float uSparkTextureIntensityMax;

uniform sampler2D uSparkTexture;
uniform sampler2D uCurveTexture;
uniform sampler2DArray uCurve4Texture;
uniform sampler2D uBlackbodyTexture;
uniform sampler2D uSparkTextureIntensityRadiuses;

uniform sampler2D uParticleStatesTexture;
uniform sampler2D uSparkInfosTexture;
uniform sampler2D uCurveInfosTexture;
uniform sampler2D uFlameInfosTexture;
uniform sampler2D uSmokeInfosTexture;
uniform sampler2D uEmitterInfosTexture;
uniform sampler2D uLightBeamInfosTexture;
uniform sampler2D uStaticPointLightInfosTexture;

#ifdef FIN_UseUniformsForBatchData
#else
uniform samplerBuffer uStarBatchDatasTexture;
uniform samplerBuffer uTrailBatchDatasTexture;
uniform samplerBuffer uBatchSearchEntriesTexture;
uniform int uBatchSearchMaxDepth;
uniform int uBatchSearchStartId;
#endif

uniform int uStaticPointLightInfosCount;

ParticleState
getParticleStateFromTexture( int id )
{
    const int TexelsPerStruct = 8;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    vec4 t2 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 2, y ), 0 );
    vec4 t3 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 3, y ), 0 );
    vec4 t4 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 4, y ), 0 );
    vec4 t5 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 5, y ), 0 );
    vec4 t6 = texelFetch( uParticleStatesTexture, ivec2( x * TexelsPerStruct + 6, y ), 0 );
    ParticleState result;
    result.pos = t0.xyz;
    result.t0 = t0.w;
    result.vel = t1.xyz;
    result.duration = t1.w;
    result.gravity = t2.xyz;
    result.wind_friction = t2.w;
    result.ori0 = t3;
    result.ori1 = t4;
    result.random_state = floatBitsToUint( t5.x );
    result.motion_flags = t5.y;
    result.dmx_strobing_frequency = t5.z;
    result.pos_curve4_id = floatBitsToInt( t5.w );
    result.vel_curve4_id = floatBitsToInt( t6.x );
    result.ori_curve4_id = floatBitsToInt( t6.y );
    result.rgb_curve4_id = floatBitsToInt( t6.z );
    return result;
}

EmitterInfo
getEmitterInfoFromTexture( int id )
{
    const int TexelsPerStruct = 4;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uEmitterInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uEmitterInfosTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    vec4 t2 = texelFetch( uEmitterInfosTexture, ivec2( x * TexelsPerStruct + 2, y ), 0 );
    vec4 t3 = texelFetch( uEmitterInfosTexture, ivec2( x * TexelsPerStruct + 3, y ), 0 );
    EmitterInfo result;
    result.aEmitLifetimeGaussian = t0.xy;
    result.aEmitWindFrictionGaussian = t0.zw;
    result.aEmitVelGaussian = t1.xy;
    result.aEmitInheritVelocityGaussian = t1.zw;
    result.aEmitVelTaper = t2.x;
    result.aEmitDiscDiameter = t2.y;
    result.aEmitCurve = floatBitsToInt( t2.z );
    result.aEmitStyle = floatBitsToInt( t2.w );
    result.aEmitStyleArg0 = t3.x;
    result.aEmitFlags = floatBitsToInt( t3.y );
    result.aBreakRandomTweak = floatBitsToInt( t3.z );
    return result;
}

SparkInfo
getSparkInfoFromTexture( int id )
{
    const int TexelsPerStruct = 4;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uSparkInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uSparkInfosTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    vec4 t2 = texelFetch( uSparkInfosTexture, ivec2( x * TexelsPerStruct + 2, y ), 0 );
    vec4 t3 = texelFetch( uSparkInfosTexture, ivec2( x * TexelsPerStruct + 3, y ), 0 );
    SparkInfo result;
    result.aColor0 = t0.xyz;
    result.aIntensity1 = t0.w;
    result.aColor1 = t1.xyz;
    result.aIntensityCurve = floatBitsToInt( t1.w );
    result.aDiameterGaussian = t2.xy;
    result.aIntensityCurveLoopDuration = t2.z;
    result.aTemperature0 = t2.w;
    result.aTemperature1 = t3.x;
    result.aHotCircleDiameterGaussian = t3.yz;
    return result;
}

CurveInfo
getCurveInfoFromTexture( int id )
{
    const int TexelsPerStruct = 1;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uCurveInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    CurveInfo result;
    result.aMinX = t0.x;
    result.aMinY = t0.y;
    result.aMaxX = t0.z;
    result.aMaxY = t0.w;
    return result;
}

FlameInfo
getFlameInfoFromTexture( int id )
{
    const int TexelsPerStruct = 2;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uFlameInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uFlameInfosTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    FlameInfo result;
    result.aFlamePuffStartSize = t0.x;
    result.aFlamePuffEndSize = t0.y;
    result.aFlamePuffSizeCurve = floatBitsToInt( t0.z );
    result.aFlamePuffTempCurve = floatBitsToInt( t0.w );
    result.aFlamePuffAlphaCurve = floatBitsToInt( t1.x );
    return result;
}

SmokeInfo
getSmokeInfoFromTexture( int id )
{
    const int TexelsPerStruct = 1;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uSmokeInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    SmokeInfo result;
    result.aSmokeDensity = t0.x;
    result.aSmokePuffStartSize = t0.y;
    result.aSmokePuffEndSize = t0.z;
    result.aSmokePuffSizeCurve = floatBitsToInt( t0.w );
    return result;
}

LightBeamInfo
getLightBeamInfoFromTexture( int id )
{
    const int TexelsPerStruct = 4;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uLightBeamInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uLightBeamInfosTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    vec4 t2 = texelFetch( uLightBeamInfosTexture, ivec2( x * TexelsPerStruct + 2, y ), 0 );
    LightBeamInfo result;
    result.aColor0 = t0.xyz;
    result.aIntensity1 = t0.w;
    result.aColor1 = t1.xyz;
    result.aIntensityCurve = floatBitsToInt( t1.w );
    result.aAngleSpread0 = t2.x;
    result.aAngleSpread1 = t2.y;
    result.aDiameter0 = t2.z;
    result.aConeHeight0 = t2.w;
    return result;
}

StaticPointLightInfo
getStaticPointLightInfoFromTexture( int id )
{
    const int TexelsPerStruct = 4;
    int StructsPerRow = 1024 / TexelsPerStruct;
    int x = id % StructsPerRow;
    int y = id / StructsPerRow;
    vec4 t0 = texelFetch( uStaticPointLightInfosTexture, ivec2( x * TexelsPerStruct + 0, y ), 0 );
    vec4 t1 = texelFetch( uStaticPointLightInfosTexture, ivec2( x * TexelsPerStruct + 1, y ), 0 );
    vec4 t2 = texelFetch( uStaticPointLightInfosTexture, ivec2( x * TexelsPerStruct + 2, y ), 0 );
    StaticPointLightInfo result;
    result.aColor0 = t0.xyz;
    result.aIntensity1 = t0.w;
    result.pos = t1.xyz;
    result.st = t1.w;
    result.aIntensityCurve = floatBitsToInt( t2.x );
    result.et = t2.y;
    return result;
}

#ifdef FIN_UseUniformsForBatchData
#else
void
getStarBatchDataFromTexture( int id, out StarBatchData bd )
{
    vec4 t0 = texelFetch( uStarBatchDatasTexture, id );
    bd.num_particles = floatBitsToInt( t0.x );
    bd.first_particle_state_id = floatBitsToInt( t0.y );
    bd.info_id = floatBitsToInt( t0.z );
}

void
getTrailBatchDataFromTexture( int id, out TrailBatchData bd )
{
    vec4 t0 = texelFetch( uTrailBatchDatasTexture, id * 2 + 0 );
    vec4 t1 = texelFetch( uTrailBatchDatasTexture, id * 2 + 1 );
    bd.num_particles = floatBitsToInt( t0.x );
    bd.first_particle_state_id = floatBitsToInt( t0.y );
    bd.num_emitted_per_star = floatBitsToInt( t0.z );
    bd.emitter_info_id = floatBitsToInt( t0.w );
    bd.emitted_info_id = floatBitsToInt( t1.x );
    bd.trail_random_group_id = floatBitsToInt( t1.y );
}

void
getBatchSearchEntryFromTexture( int id, out BatchSearchEntry bse )
{
    vec4 t0 = texelFetch( uBatchSearchEntriesTexture, id );
    bse.compare_to = floatBitsToInt( t0.x );
    bse.bse_gte = floatBitsToInt( t0.y );
    bse.bse_else = floatBitsToInt( t0.z );
    bse.batch_id = floatBitsToInt( t0.w );
}

void
getBatchSearchEntryFromVertexId( int vertex_id, out BatchSearchEntry bse )
{
    // A terminal BatchSearchEntry looks like this:
    //    { compare_to: 0, bse_gte: my_bse_id, bse_else: my_vertex_id_offset, batch_id: my_batch_id }
    // Since compare_to is 0, then the bse_gte branch is always taken, which just
    // points right back to our terminal entry.
    // Since the bse_gte branch is always taken, that lets us re-use the bse_else
    // slot to be our vertex_id_offset.
    // It might even be the case that we don't need the if statements below.
    // If we do have the if statements, then we should only follow the terminal
    // node's pointer to itself at most once, since the binary tree will be
    // balanced.
    // If we do not have the if statements, then we will follow the terminal
    // node's pointer to itself possible a large number of times (especially the
    // case when there is a single batch to draw, for example).
    // note: if statements don't seem to matter on my parallels instance -- dusty 2019-08-06

    getBatchSearchEntryFromTexture( uBatchSearchStartId, bse );
    if( uBatchSearchMaxDepth > 1 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 2 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 3 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 4 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 5 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 6 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 7 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 8 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 9 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 10 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 11 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 12 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 13 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 14 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
    if( uBatchSearchMaxDepth > 15 ) { getBatchSearchEntryFromTexture( vertex_id >= bse.compare_to ? bse.bse_gte : bse.bse_else, bse ); }
}

#undef DO_LINEAR_BATCH_LOOKUP
void
getStarBatchDataFromVertexId( inout int vertex_id, out StarBatchData bd )
{
#ifdef DO_LINEAR_BATCH_LOOKUP
    int batch_id = 0;
    int sz = textureSize( uStarBatchDatasTexture );
    while( batch_id < sz ) {
        getStarBatchDataFromTexture( batch_id, bd );
        if( bd.num_particles > vertex_id ) { return; }
        vertex_id -= bd.num_particles;
        batch_id++;
    }
#else
    BatchSearchEntry bse;
    getBatchSearchEntryFromVertexId( vertex_id, bse );
    vertex_id -= bse.bse_else;
    getStarBatchDataFromTexture( bse.batch_id, bd );
#endif
}

void
getTrailBatchDataFromVertexId( inout int vertex_id, out TrailBatchData bd )
{
#ifdef DO_LINEAR_BATCH_LOOKUP
    int batch_id = 0;
    int sz = textureSize( uTrailBatchDatasTexture );
    while( batch_id < sz ) {
        getTrailBatchDataFromTexture( batch_id, bd );
        if( bd.num_particles > vertex_id ) { return; }
        vertex_id -= bd.num_particles;
        batch_id++;
    }
#else
    BatchSearchEntry bse;
    getBatchSearchEntryFromVertexId( vertex_id, bse );
    vertex_id -= bse.bse_else;
    getTrailBatchDataFromTexture( bse.batch_id, bd );
#endif
}
#endif // !FIN_UseUniformsForBatchData

#define BASE 1.5
#define encode_intensity( x ) ( log( x ) / log( BASE ) )
#define decode_intensity( x ) ( pow( BASE, x ) )

float
getSparkTextureRadiusFactor( float intensity )
{
    float min_intensity = uSparkMinContribution;

    float min_logi = encode_intensity( min_intensity );
    float max_logi = encode_intensity( uSparkTextureIntensityMax );

    float logi = encode_intensity( intensity );
    float sample_x = ( logi - min_logi ) / ( max_logi - min_logi );
    sample_x = min( sample_x, 1.0 );

    vec2 tc = vec2( sample_x, 0.5 / float( C_SparkTextureWidth ) );
    float radius_from_lookup = texture( uSparkTextureIntensityRadiuses, tc ).r;
    return 2.0 * float( radius_from_lookup ) / float( C_SparkTextureWidth );
}

#define CELL_SIZE 2.0
const vec3 CELL_HALF = vec3( CELL_SIZE / 2.0, CELL_SIZE / 2.0, CELL_SIZE / 2.0 );
const float CELL_HALF_DIAGONAL = length( CELL_HALF );
const float MAX_DISTANCE_FROM_CELL_CENTER = CELL_SIZE;

vec3
getWindVectorForCell( vec3 cell, vec3 p )
{
    uint random_state = init_random( uint( int( cell.x ) ), uint( int( cell.y ) ), uint( int( cell.z ) ) );
    float distance_from_cell_center = distance( cell + CELL_HALF, p );
    float distance_factor = 1.0 - distance_from_cell_center / MAX_DISTANCE_FROM_CELL_CENTER;
    distance_factor = clamp( distance_factor, 0.0, 1.0 );
    vec3 emit_dir = pointOnSphere( random_state, 720.0 );
    float random_factor = rand( random_state );
    return emit_dir * distance_factor * random_factor;
}

vec3
getSmokeInitialVelocity( vec3 p )
{
    vec3 cell1 = floor( ( p - CELL_HALF ) / CELL_SIZE ) * CELL_SIZE;
    vec3 result = vec3( 0 );
    float C = CELL_SIZE;
    result += getWindVectorForCell( cell1 + vec3( 0, 0, 0 ), p );
    result += getWindVectorForCell( cell1 + vec3( 0, 0, C ), p );
    result += getWindVectorForCell( cell1 + vec3( 0, C, 0 ), p );
    result += getWindVectorForCell( cell1 + vec3( 0, C, C ), p );
    result += getWindVectorForCell( cell1 + vec3( C, 0, 0 ), p );
    result += getWindVectorForCell( cell1 + vec3( C, 0, C ), p );
    result += getWindVectorForCell( cell1 + vec3( C, C, 0 ), p );
    result += getWindVectorForCell( cell1 + vec3( C, C, C ), p );
    return result;
}


int
getParticleInfoIndex( int info_id )
{
    return info_id % C_MaxParticleInfos;
}


float
sampleCurve( int curve, float x )
{
    CurveInfo ci = getCurveInfoFromTexture( curve );
    if( x < ci.aMinX ) return ci.aMinY;
    if( x > ci.aMaxX ) return ci.aMinY;
    float x_num = x - ci.aMinX;
    float x_den = ci.aMaxX - ci.aMinX;
    float tx = (x_den <= 1e-6) ? x_num : x_num / x_den;
    int x0 = clamp( int( tx * float( C_CurveTextureWidth ) ), 0, C_CurveTextureWidth - 1 );
    int x1 = clamp( int( tx * float( C_CurveTextureWidth ) + 1.0 ), 0, C_CurveTextureWidth - 1 );
    float i0 = texelFetch( uCurveTexture, ivec2( x0, curve ), 0 ).r;
    float i1 = texelFetch( uCurveTexture, ivec2( x1, curve ), 0 ).r;
    float mixfactor = mod( tx, 1.0 / float( C_CurveTextureWidth ) ) * float( C_CurveTextureWidth );

    float y_num = mix( i0, i1, mixfactor );
    float y_scale = ci.aMaxY - ci.aMinY;
    return ci.aMinY + y_scale * y_num;
}


vec4
sampleCurve4( int curve, float x )
{
    int x0 = clamp( int( x * float( C_CurveTextureWidth ) ), 0, C_CurveTextureWidth - 1 );
    int x1 = clamp( int( x * float( C_CurveTextureWidth ) + 1.0 ), 0, C_CurveTextureWidth - 1 );
    vec4 i0 = texelFetch( uCurve4Texture, ivec3( x0, curve % C_CurveTextureWidth, curve / C_CurveTextureWidth ), 0 );
    vec4 i1 = texelFetch( uCurve4Texture, ivec3( x1, curve % C_CurveTextureWidth, curve / C_CurveTextureWidth ), 0 );
    float mixfactor = mod( x, 1.0 / float( C_CurveTextureWidth ) ) * float( C_CurveTextureWidth );
    return mix( i0, i1, mixfactor );
}


const float EmitStrobeThreshold = 0.010;

float
sampleCurve_emitcurve( int curve, float x )
{
    int x0 = clamp( int( x * float( C_CurveTextureWidth ) ), 0, C_CurveTextureWidth - 1 );
    int x1 = clamp( int( x * float( C_CurveTextureWidth ) + 1.0 ), 0, C_CurveTextureWidth - 1 );
    float i0 = texelFetch( uCurveTexture, ivec2( x0, curve ), 0 ).r;
    float i1 = texelFetch( uCurveTexture, ivec2( x1, curve ), 0 ).r;
    float mixfactor = mod( x, 1.0 / float( C_CurveTextureWidth ) ) * float( C_CurveTextureWidth );
    if( abs( i1 - i0 ) < EmitStrobeThreshold ) {
        return mix( i0, i1, mixfactor );
    } else {
        return mixfactor > 0.5 ? i1 : i0;
    }
}

vec4
project( vec4 v )
{
    return v / v.w;
}

struct PosAndScreenWidth
{
    vec4 pos;
    float screenWidth;
};

float
deg2rad( float x )
{
    return x * M_PI / 180.0;
}

vec3
getBlackbodyColor_approx( float Temp )
{
    float u = ( 0.860117757f + 1.54118254e-4f * Temp + 1.28641212e-7f * Temp * Temp ) / ( 1.0f + 8.42420235e-4f * Temp + 7.08145163e-7f * Temp * Temp );
    float v = ( 0.317398726f + 4.22806245e-5f * Temp + 4.20481691e-8f * Temp * Temp ) / ( 1.0f - 2.89741816e-5f * Temp + 1.61456053e-7f * Temp * Temp );

    float x = 3.0 * u / ( 2.0 * u - 8.0 * v + 4.0 );
    float y = 2.0 * v / ( 2.0 * u - 8.0 * v + 4.0 );
    float z = 1.0 - x - y;

    float Y = 1.0;
    float X = Y / y * x;
    float Z = Y / y * z;

    mat3 XYZtoRGB = transpose( mat3( 3.2404542, -1.5371385, -0.4985314, -0.9692660, 1.8760108, 0.0415560, 0.0556434, -0.2040259, 1.0572252 ) );

    return ( XYZtoRGB * vec3( X, Y, Z ) ) * pow( 0.0004 * Temp, 4.0 );
}


vec3
getBlackbodyColor( float temp )
{
    float xcoord = ( temp - float( C_BlackbodyTextureTempMin ) ) / ( float( C_BlackbodyTextureTempMax ) - float( C_BlackbodyTextureTempMin ) );
    return texture( uBlackbodyTexture, vec2( xcoord, 0.5 ) ).rgb;
}


PosAndScreenWidth
calculateScreenPositionAndWidth( float particleRadius, vec3 particlePos, mat4 pMatrix, mat4 mvMatrix )
{
    // mat4 invertMv = inverse(mvMatrix);
    // vec3 cameraRight = project(invertMv * vec4(1.0,0.0,0.0,1.0)).xyz;
    // vec3 cameraUp = project(invertMv * vec4(0.0,1.0,0.0,1.0)).xyz;

    vec3 cameraUp = vec3( mvMatrix[ 0 ][ 1 ], mvMatrix[ 1 ][ 1 ], mvMatrix[ 2 ][ 1 ] );
    // cameraUp = normalize(cameraUp);

    vec3 dy = cameraUp * 2.0 * particleRadius;

    mat4 pmvMatrix = pMatrix * mvMatrix;
    vec4 screenP0 = project( pmvMatrix * vec4( particlePos, 1.0 ) );
    vec4 screenDy = project( pmvMatrix * vec4( particlePos + dy, 1.0 ) );

    float screenWidth = length( screenDy - screenP0 );

    return PosAndScreenWidth( screenP0, screenWidth );
}

vec3
getCameraPosFromViewMat( const mat4 viewMat )
{
    mat4 m = inverse( viewMat );
    return m[ 3 ].xyz;
}

float
linearToSrgb( float v )
{
    if( v <= 0.0031308 ) return v * 12.92;
    return 1.055 * pow( v, 1.0 / 2.4 ) - 0.055;
}

vec4
linearToSrgb( vec4 c )
{
    return vec4( linearToSrgb( c.r ), linearToSrgb( c.g ), linearToSrgb( c.b ), c.a );
}

float
srgbToLinear( float v )
{
    if( v <= 0.04045 ) return v / 12.92;
    return pow( ( v + 0.055 ) / 1.055, 2.4 );
}

vec3
srgbToLinear( vec3 c )
{
    return vec3( srgbToLinear( c.r ), srgbToLinear( c.g ), srgbToLinear( c.b ) );
}

vec4
srgbToLinear( vec4 c )
{
    return vec4( srgbToLinear( c.r ), srgbToLinear( c.g ), srgbToLinear( c.b ), c.a );
}

float
sampleTan( float x0, float x1, float v )
{
    float f0 = tan( x0 );
    float f1 = tan( x1 );
    float fv = tan( x0 + v * ( x1 - x0 ) );
    float normalized = ( fv - f0 ) / ( f1 - f0 );
    return normalized;
}

PhysicsParams
getPhysicsParamsFromUniforms()
{
    PhysicsParams pp;
    pp.wind_velocity = uWindVelocity;
    return pp;
}

void
apply_ballistic_motion( vec3 windVelocity, inout ParticleState ps, float dt )
{
    vec3 a = ps.gravity;
    vec3 n = windVelocity;

    vec3 p = ps.pos;
    vec3 v = ps.vel;
    float k = clamp( ps.wind_friction, 0.0, C_MaxK ) * 100.0;
    if( k < C_BallisticKThreshold ) {
        ps.pos = 0.5 * a * dt * dt + v * dt + p;
        ps.vel = a * dt + v;
    } else {
        float e_kt = exp( k * dt );
        float e_nkt = exp( -k * dt );
        ps.pos = ( e_nkt / ( k * k ) ) * ( a + k * ( n - v ) + e_kt * ( a * ( -1.0 + k * dt ) + k * ( k * p + n * ( -1.0 + k * dt ) + v ) ) );
        ps.vel = ( a + k * n - e_nkt * ( a + k * ( n - v ) ) ) / k;
    }
}

// ---- 8< ---- GLSL Number Printing - @P_Malin ---- 8< ----
// Creative Commons CC0 1.0 Universal (CC-0)
// https://www.shadertoy.com/view/4sBSWW

float
DigitBin( const int x )
{
    return x == 0 ? 480599.0 : x == 1 ? 139810.0 : x == 2 ? 476951.0 : x == 3 ? 476999.0 : x == 4 ? 350020.0 : x == 5 ? 464711.0 : x == 6 ? 464727.0 : x == 7 ? 476228.0 : x == 8 ? 481111.0 : x == 9 ? 481095.0 : 0.0;
}

float
PrintValue( vec2 vStringCoords, float fValue, float fMaxDigits, float fDecimalPlaces )
{
    if( ( vStringCoords.y < 0.0 ) || ( vStringCoords.y >= 1.0 ) ) return 0.0;

    bool bNeg = ( fValue < 0.0 );
    fValue = abs( fValue );

    float fLog10Value = log2( abs( fValue ) ) / log2( 10.0 );
    float fBiggestIndex = max( floor( fLog10Value ), 0.0 );
    float fDigitIndex = fMaxDigits - floor( vStringCoords.x );
    float fCharBin = 0.0;
    float fDebug = 0.0;
    if( fDigitIndex > ( -fDecimalPlaces - 1.01 ) ) {
        if( fDigitIndex > fBiggestIndex ) {
            if( ( bNeg ) && ( fDigitIndex < ( fBiggestIndex + 1.5 ) ) ) fCharBin = 1792.0;
        } else {
            if( fDigitIndex == -1.0 ) {
                if( fDecimalPlaces > 0.0 ) fCharBin = 2.0;
            } else {
                float fReducedRangeValue = fValue;
                if( fDigitIndex < 0.0 ) {
                    fReducedRangeValue = fract( fValue );
                    fDigitIndex += 1.0;
                }
                float fDigitValue = ( abs( fReducedRangeValue / ( pow( 10.0, fDigitIndex ) ) ) );
                fCharBin = DigitBin( int( floor( mod( 0.0001 + fDigitValue, 10.0 ) ) ) );
            }
        }
    }
    return fDebug + floor( mod( ( fCharBin / pow( 2.0, floor( fract( vStringCoords.x ) * 4.0 ) + ( floor( vStringCoords.y * 5.0 ) * 4.0 ) ) ), 2.0 ) );
}

// ---- 8< -------- 8< -------- 8< -------- 8< ----
