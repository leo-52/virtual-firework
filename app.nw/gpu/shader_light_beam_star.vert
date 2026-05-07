uniform mat4 ViewMat;
uniform mat4 ProjMat;
uniform vec2 uFramebufferSize;

uniform int uBaseParticleStateId;
uniform int uLightBeamInfoId;
uniform float R_light_beam_segments_count;
uniform float R_light_beam_intensity_factor;

out vec4 vDebugShade;
out vec3 vColor;


void
main()
{
    vDebugShade = vec4( 0, 0, 0, 0 );

    int ps_id = uBaseParticleStateId;
    ParticleState ps = getParticleStateFromTexture( ps_id );
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


    // vec3 ps_right = vec3( m[0][0], m[0][1], m[0][2] );
    // vec3 ps_dir   = vec3( m[1][0], m[1][1], m[1][2] );
    // vec3 ps_up    = vec3( m[2][0], m[2][1], m[2][2] );

    vec3 ps_right;
    vec3 ps_dir;
    vec3 ps_up;

    basis_from_vector( ps.vel, ps_dir, ps_right );
    ps_right = rotateVectorAroundNormalizedVector( ps_dir, ps_right, rand( ps.random_state ) * M_PI * 2.0 );
    ps_up = cross( ps_dir, ps_right );


    LightBeamInfo lbi = getLightBeamInfoFromTexture( getParticleInfoIndex( uLightBeamInfoId ) );

    float intensity = 1.0;
    intensity *= lbi.aIntensity1;
    intensity *= R_light_beam_intensity_factor;
    intensity *= sampleCurve( lbi.aIntensityCurve, life_factor );

    if( ps.dmx_strobing_frequency != 0.0 ) {
        float strobingPeriod = 1.0/ps.dmx_strobing_frequency;
        if( fract(life_time/strobingPeriod + rand( ps.random_state )) > 0.5 ) {
            intensity = 0.0;
        }
    }

    if( ps.rgb_curve4_id != 0 ) {
        vColor = sampleCurve4( ps.rgb_curve4_id, life_factor ).rgb;
    } else {
        vColor = mix( lbi.aColor0, lbi.aColor1, life_factor );
    }
    vColor *= intensity;

    float angleSpreadDegrees = mix( lbi.aAngleSpread0, lbi.aAngleSpread1, life_factor );
    float d0 = lbi.aDiameter0 / 2.0;
    float coneHeight = lbi.aConeHeight0;
    float d1 = d0 + coneHeight * tan( ( angleSpreadDegrees / 2.0 ) * M_PI / 180.0 );

    int triangleID = gl_VertexID / 3;
    if( triangleID < R_light_beam_segments_count ) {
        // inner fan
        float segmentID = triangleID;
        vec3 pos;
        if( ( gl_VertexID % 3 ) == 0 ) {
            pos = ps.pos;
        } else if( ( gl_VertexID % 3 ) == 1 ) {
            float clockAngle = float( segmentID + 1 ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + d0 * ps_right * cos( clockAngle ) + d0 * ps_up * sin( clockAngle );
        } else {
            float clockAngle = float( segmentID ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + d0 * ps_right * cos( clockAngle ) + d0 * ps_up * sin( clockAngle );
        }
        gl_Position = ProjMat * ViewMat * vec4( pos, 1 );
    } else if( triangleID < ( R_light_beam_segments_count * 2 ) ) {
        // outer fan
        vColor = vec3( 0 );
        float segmentID = triangleID - R_light_beam_segments_count;
        vec3 pos;
        if( ( gl_VertexID % 3 ) == 0 ) {
            pos = ps.pos + coneHeight * ps_dir;
        } else if( ( gl_VertexID % 3 ) == 1 ) {
            float clockAngle = float( segmentID ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + coneHeight * ps_dir + d1 * ps_right * cos( clockAngle ) + d1 * ps_up * sin( clockAngle );
        } else {
            float clockAngle = float( segmentID + 1 ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + coneHeight * ps_dir + d1 * ps_right * cos( clockAngle ) + d1 * ps_up * sin( clockAngle );
        }
        gl_Position = ProjMat * ViewMat * vec4( pos, 1 );
    } else {
        // sides
        float segmentID = floor( ( triangleID - R_light_beam_segments_count * 2 ) / 2.0 );
        vec3 pos;
        if( ( gl_VertexID % 6 ) == 0 ) {
            float clockAngle = float( segmentID ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + d0 * ps_right * cos( clockAngle ) + d0 * ps_up * sin( clockAngle );
        } else if( ( gl_VertexID % 6 ) == 2 || ( gl_VertexID % 6 ) == 3 ) {
            float clockAngle = float( segmentID ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + coneHeight * ps_dir + d1 * ps_right * cos( clockAngle ) + d1 * ps_up * sin( clockAngle );
            vColor = vec3( 0 );
        } else if( ( gl_VertexID % 6 ) == 1 || ( gl_VertexID % 6 ) == 4 ) {
            float clockAngle = float( segmentID + 1 ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + d0 * ps_right * cos( clockAngle ) + d0 * ps_up * sin( clockAngle );
        } else {
            float clockAngle = float( segmentID + 1 ) / R_light_beam_segments_count * 2.0 * M_PI;
            pos = ps.pos + coneHeight * ps_dir + d1 * ps_right * cos( clockAngle ) + d1 * ps_up * sin( clockAngle );
            vColor = vec3( 0 );
        }
        gl_Position = ProjMat * ViewMat * vec4( pos, 1 );
    }
}
