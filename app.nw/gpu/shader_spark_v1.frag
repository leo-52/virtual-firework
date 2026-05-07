uniform vec2 uFramebufferSize;

in vec4 vDebugShade;
in vec3 vColor0;
in vec3 vColor1;
in float vScale0;
in float vScale1;
in float vExponent0;
in float vExponent1;

out vec4 outColor;

float gaussian( float x ) {
    float left = 1.0 / sqrt(2.0 * M_PI);
    float power = -(x*x) / 2.0;
    return left * exp( power );
}

void main(void) {
    vec4 result = vec4(0);

    const vec2 HALF = vec2(0.5);

    if(vScale0 != 0.0) {
        vec2 tc = (gl_PointCoord - HALF) / vScale0 + HALF;
        result.xyz += vColor0 * pow( texture(uSparkTexture, tc).r, vExponent0 );
    }

    if(vScale1 != 0.0) {
        vec2 tc = (gl_PointCoord - HALF) / vScale1 + HALF;
        float d = distance( tc, HALF );
        float c = sqrt(2.0 * M_PI) * gaussian( d*12.0 );
        result.xyz += vColor1 * pow( c, vExponent1 );
    }

#if 0
    if( vDebugShade != vec4(0) ) {
        vec2 pixelCoords = gl_PointCoord * 2.0;
        if( pixelCoords.x < 1.0 && pixelCoords.y < 1.0 ) {
            vec4 printColor = vec4(0);
            float BORDER = 1.0/32.0;
            if( (fract( pixelCoords.x ) < BORDER) || ( pixelCoords.x > (1.0-BORDER)) ) {
                printColor.xyz = vec3(1);
            } else if( (fract( pixelCoords.y ) < BORDER) || ( pixelCoords.y > (1.0-BORDER)) ) {
                printColor.xyz = vec3(1);
            } else {
                vec4 displayValue = vDebugShade;
                vec2 cellCoords = pixelCoords;
                cellCoords.y = 1.0 - cellCoords.y;
                if( true ) {
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(15,4.6)+vec2( 2,-3.4), displayValue.x, 11, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(15,4.6)+vec2( 2,-2.3), displayValue.y, 11, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(15,4.6)+vec2( 2,-1.2), displayValue.z, 11, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(15,4.6)+vec2( 2,-0.1), displayValue.w, 11, 3 ));
                }
                if( isinf(displayValue.x) || isinf(displayValue.y) || isinf(displayValue.z) || isinf(displayValue.w) ) {
                    printColor.r += 1.0;
                }
                if( isnan(displayValue.x) || isnan(displayValue.y) || isnan(displayValue.z) || isnan(displayValue.w) ) {
                    printColor.b += 1.0;
                }
            }
            result += printColor;
        }
    }
#else
    result += vDebugShade;
#endif
#if 0
        vec3 printColor = vec3(0);
        float PIXELS = 8.0;
        float BORDER = 1.0/32.0;
        vec2 pixelCoords = gl_PointCoord * PIXELS;
        if( (fract( pixelCoords.x ) < BORDER) || ( pixelCoords.x > (PIXELS-BORDER)) ) {
            printColor.xyz = vec3(1);
        } else if( (fract( pixelCoords.y ) < BORDER) || ( pixelCoords.y > (PIXELS-BORDER)) ) {
            printColor.xyz = vec3(1);
        } else {
            ivec2 ipc = ivec2(pixelCoords);
            ivec2 ts = textureSize(uParticleStatesTexture, 0);
            if( ipc.x < ts.x && ipc.y < ts.y ) {
                vec4 texel = texelFetch( uParticleStatesTexture, ipc, 0 );
                // result.xyz += texel.xyz;
                vec2 cellCoords = fract( pixelCoords ) * 1.0;
                cellCoords.y = 1.0 - cellCoords.y;
                if( ipc.x == 5 || ipc.x == 6 ) {
                    float fValue = float( floatBitsToUint( texel.x ) );
                    float fLog10Value = log2(abs(fValue)) / log2(10.0);
                    float fBiggestIndex = max(floor(fLog10Value), 0.0);

                    printColor.xyz = mix( printColor.xyz, vec3(1,1,0), PrintValue( cellCoords.xy * vec2(11,4.6)+vec2(-1,-3.4), float( floatBitsToUint( texel.x ) ), 9, 0 ));
                    printColor.xyz = mix( printColor.xyz, vec3(1,1,0), PrintValue( cellCoords.xy * vec2(11,4.6)+vec2(-1,-2.3), float( floatBitsToUint( texel.y ) ), 9, 0 ));
                    printColor.xyz = mix( printColor.xyz, vec3(1,1,0), PrintValue( cellCoords.xy * vec2(11,4.6)+vec2(-1,-1.2), float( floatBitsToUint( texel.z ) ), 9, 0 ));
                    printColor.xyz = mix( printColor.xyz, vec3(1,1,0), PrintValue( cellCoords.xy * vec2(11,4.6)+vec2(-1,-0.1), float( floatBitsToUint( texel.w ) ), 9, 0 ));
                } else {
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(10,4.6)+vec2(-3.9,-3.4), texel.x, 1, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(10,4.6)+vec2(-3.9,-2.3), texel.y, 1, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(10,4.6)+vec2(-3.9,-1.2), texel.z, 1, 3 ));
                    printColor.xyz = mix( printColor.xyz, vec3(0,1,0), PrintValue( cellCoords.xy * vec2(10,4.6)+vec2(-3.9,-0.1), texel.w, 1, 3 ));
                }
                if( isinf(texel.x) || isinf(texel.y) || isinf(texel.z) || isinf(texel.w) ) {
                    printColor.r += 1.0;
                }
                if( isnan(texel.x) || isnan(texel.y) || isnan(texel.z) || isnan(texel.w) ) {
                    printColor.b += 1.0;
                }
            }
        }
        result += printColor;
#endif

#if 0
    vec2 tc = vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y);
    float y = sampleCurve( 2, tc.x );
    if( abs(y-tc.y) < 1.0/256.0 ) {
        result = vec4(1);
    } else {
        result = vec4(0);
    }
    result += vDebugShade;
    // result.rg += tc;
#endif

#if 0
    vec2 tc = vec2(gl_PointCoord.x*10.0, 1.0-gl_PointCoord.y);
    ivec2 ts = textureSize(uCurveInfosTexture,0);
    result.rg = vec2(ts);
    result.ba = texelFetch(uCurveInfosTexture, ivec2(0,0), 0).ba;
    CurveInfo ci = getCurveInfoFromTexture(1);
    result.b = ci.aMaxX;
    result.a = ci.aMaxY;
#endif
    outColor = result;
}
