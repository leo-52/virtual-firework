uniform vec2 uFramebufferSize;
uniform mat4 ViewMat;
uniform mat4 ProjMat;

uniform float R_v2_core_sample_count;

out vec4 outColor;

in vec4 vDebugShade;

in vec3 vPositionWorldSpace;
in vec4 vPositionClipSpace;
in vec4 vPointColor;
in float vHotCircleDiameter;
in float vHotCircleScreenSpaceDiameterMin;

float CameraRayDistanceToPoint(vec3 rayOri, vec3 rayDir, vec3 point)
{
     return length(cross(rayDir, point - rayOri));
}

vec4 colorForscreenSpace( vec2 screenSpace, mat4 invViewProj, vec3 camPos )
{
    vec4 fragNearPlane = invViewProj * vec4(screenSpace,0.0,1.0);
    fragNearPlane /= fragNearPlane.w;

    vec3 rayDir = fragNearPlane.xyz - camPos;
    float d = CameraRayDistanceToPoint(camPos, rayDir, vPositionWorldSpace);
    if( d < vHotCircleDiameter ) {
        return vPointColor;
    }
    return vec4(0);
}


void main(void) {
    if( vHotCircleScreenSpaceDiameterMin != 0.0 ) {
        outColor = vPointColor;
    } else {
        mat4 invViewProj = inverse(ProjMat * ViewMat);
        vec3 camPos = getCameraPosFromViewMat( ViewMat );
#if 0
        const float SUBPIXEL_SAMPLES = 4.0;
        for( float y=0.0; y<SUBPIXEL_SAMPLES; y++ ) {
            for( float x=0.0; x<SUBPIXEL_SAMPLES; x++ ) {
                vec2 newFragCoord = floor(gl_FragCoord.xy) + vec2( x/(SUBPIXEL_SAMPLES+1.0), y/(SUBPIXEL_SAMPLES+1.0) );
                vec2 fragScreenSpace = (newFragCoord / uFramebufferSize) * 2.0 - 1.0;
                outColor += colorForscreenSpace( fragScreenSpace, invViewProj, camPos ) / (SUBPIXEL_SAMPLES * SUBPIXEL_SAMPLES);
            }
        }
#else
        for( float i=0.0; i<R_v2_core_sample_count; i++ ) {
            vec2 newFragCoord = floor(gl_FragCoord.xy) + fract(vec2(i*1523.0*1.618033988749894,i*1009.0*1.618033988749894));
            vec2 fragScreenSpace = (newFragCoord / uFramebufferSize) * 2.0 - 1.0;
            outColor += colorForscreenSpace( fragScreenSpace, invViewProj, camPos ) / R_v2_core_sample_count;
        }
#endif
    }
}