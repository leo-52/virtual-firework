uniform vec2 uFramebufferSize;

uniform sampler2D uTextures[ 4 ];
uniform float uPrescales[ 4 ];
uniform int uNumTextures;

uniform float uPostscale;

uniform sampler3D uTonemapTexture;

uniform float R_cubemap_power;

out vec4 outColor;

vec4
sample_input()
{
    vec2 tc = gl_FragCoord.xy / uFramebufferSize;

    // these calculations have to be identical in shader_tone_map.frag and shader_accumulate_luminance_stats.frag
    vec4 color = vec4( 0 );
    if( uNumTextures > 0 ) color += uPrescales[ 0 ] * texture( uTextures[ 0 ], tc );
    if( uNumTextures > 1 ) color += uPrescales[ 1 ] * texture( uTextures[ 1 ], tc );
    if( uNumTextures > 2 ) color += uPrescales[ 2 ] * texture( uTextures[ 2 ], tc );
    if( uNumTextures > 3 ) color += uPrescales[ 3 ] * texture( uTextures[ 3 ], tc );

    if( uNumTextures > 4 ) color = vec4( 1, 0, 1, 1 );

    color *= uPostscale;
    return color;
}


void
main()
{
    vec4 input_color = sample_input();
    vec3 color = input_color.rgb;

    color = clamp( color, 0, 65535.0 );

    // outColor = vec4( texture( uTonemap1Texture, color ).rgb, 0 );
    vec3 idx = vec3( pow( color.x / 2047, 1.0 / R_cubemap_power ), pow( color.y / 2047, 1.0 / R_cubemap_power ), pow( color.z / 2047, 1.0 / R_cubemap_power ) );

    outColor = textureGrad( uTonemapTexture, idx, vec3( 0 ), vec3( 0 ) );
    outColor.a = input_color.a;

#if 0
    const float DISPLAY_PIXELS = 1024.0;
    vec2 curveTextureSize = textureSize( uCurve4Texture, 0 ).xy;
    vec2 fragCoord = vec2( gl_FragCoord.x, uFramebufferSize.y-gl_FragCoord.y ); // origin top left
    if( fragCoord.x < DISPLAY_PIXELS && fragCoord.y < DISPLAY_PIXELS ) {
        vec2 displayTC = fragCoord / DISPLAY_PIXELS;
        vec2 curveTC = displayTC;
        float curveId = mix( 0.0, 16.0, curveTC.y );
        vec4 sample = sampleCurve4( int(curveId), curveTC.x );
        outColor = sample;
    }
#endif

#if 0
    const float DISPLAY_PIXELS = 512.0;
    vec2 curveTextureSize = textureSize( uCurve4Texture, 0 ).xy;
    vec2 fragCoord = vec2( gl_FragCoord.x, uFramebufferSize.y-gl_FragCoord.y ); // origin top left
    if( fragCoord.x < DISPLAY_PIXELS && fragCoord.y < DISPLAY_PIXELS ) {
        vec2 displayTC = fragCoord / DISPLAY_PIXELS;
        vec3 printColor = vec3(0);
        float BORDER = 1.0/32.0;
        if( (fract( displayTC.x ) < BORDER) || ( displayTC.x > (1.0-BORDER)) ) {
            printColor.xyz = vec3(1);
        } else if( (fract( displayTC.y ) < BORDER) || ( displayTC.y > (1.0-BORDER)) ) {
            printColor.xyz = vec3(1);
        } else {
            vec2 curveTC = displayTC;
            float curveId = mix( 360.0, 370.0, curveTC.y );
            curveTC.y = curveId / curveTextureSize.y;
            ivec2 itc = ivec2( 0.513 * curveTextureSize.x, 368.0 / curveTextureSize.y );
            //vec4 sample = texture( uCurve4Texture, curveTC );
            vec4 sample = texelFetch( uCurve4Texture, itc, 0 );

            vec4 displayValue = sample;
            vec2 cellCoords = displayTC;
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
        outColor.rgb = printColor;
    }
#endif

#if 0
    vec2 fc = vec2( gl_FragCoord.x, uFramebufferSize.y - gl_FragCoord.y );
    vec2 displayTC = fc / 1024.0;
    if( displayTC.x <= 1.0 && displayTC.y <= 1.0 ) {
        vec3 printColor = vec3(0);
        float PIXELS = 8.0;
        float BORDER = 1.0/32.0;
        vec2 pixelCoords = displayTC * PIXELS;
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
        outColor.rgb = printColor;
    }
#endif
}
