out vec4 outColor;

in vec2 vTEXCOORD_0;
in vec3 vNORMAL;
in vec3 vEyeSpace;
in vec3 vWorldSpace;

uniform bool uMaterialHasBaseColorTexture;
uniform sampler2D uMaterialBaseColorTexture;
uniform vec4 uMaterialBaseColorFactor;
uniform vec4 uFinaleTintFactor;

uniform bool uMaterialAlphaMaskEnabled;
uniform float uMaterialAlphaCutoff;

uniform vec3 uAmbientColor;

uniform vec3 uSunDirection;
uniform vec3 uSunColor;

uniform bool uFogEnabled;
uniform bool uSelfIlluminated;
uniform bool uLightingEnabled;
uniform bool uTextureMesh;
uniform bool uMaterialIsUnlit;

uniform bool uModelDrawFlagLightingEnabled;
uniform bool uModelDrawFlagHighlighted;
// uniform bool uModelDrawFlagSelected;

uniform int uGeoClipDiscardInsideCount;
uniform vec4 uGeoClipDiscardInsideBounds[2];
uniform int uGeoClipDiscardOutsideCount;
uniform vec4 uGeoClipDiscardOutsideBounds[2];

uniform float uFogNear;
uniform float uFogFar;

in vec4 vColor;

uniform float uBreakFlashIntensity;

const float STATIC_POINT_LIGHT_INTENSITY_SCALE_FACTOR = 0.15;

void main(void) {
#if 1
    vec4 baseColor = uMaterialBaseColorFactor;
    if(uMaterialHasBaseColorTexture) {
        baseColor *= texture(uMaterialBaseColorTexture, vTEXCOORD_0);
    }
    baseColor = baseColor * (1.0-uFinaleTintFactor.a) + vec4(uFinaleTintFactor.rgb,0.0) * uFinaleTintFactor.a;

    baseColor = srgbToLinear(baseColor);

    if(true) {
      float L = 0.2126 * baseColor.r + 0.7152 * baseColor.g + 0.0722 * baseColor.b;
      baseColor = (baseColor + vec4(L,L,L,baseColor.a)) / 2;
    }

    baseColor *= vColor;

    if( uGeoClipDiscardInsideCount != 0 ) {
        for(int i=0; i<uGeoClipDiscardInsideCount; i++) {
            bool inside = vWorldSpace.x >= uGeoClipDiscardInsideBounds[i].x && vWorldSpace.x < uGeoClipDiscardInsideBounds[i].z &&  vWorldSpace.z >= uGeoClipDiscardInsideBounds[i].y && vWorldSpace.z < uGeoClipDiscardInsideBounds[i].w;
            if( inside ) { discard; }
        }
    }
    if( uGeoClipDiscardOutsideCount != 0 ) {
        bool outside_all = true;
        for(int i=0; i<uGeoClipDiscardOutsideCount; i++) {
            bool inside = vWorldSpace.x >= uGeoClipDiscardOutsideBounds[i].x && vWorldSpace.x < uGeoClipDiscardOutsideBounds[i].z &&  vWorldSpace.z >= uGeoClipDiscardOutsideBounds[i].y && vWorldSpace.z < uGeoClipDiscardOutsideBounds[i].w;
            if( inside ) {
                outside_all = false;
            }
        }
        if( outside_all ) {
            discard;
        }
    }

    float irradiance = max(0.0, dot(normalize(-1 * uSunDirection), normalize(vNORMAL)));
    vec3 sunlit = uSunColor * irradiance;

    vec3 lit = sunlit + uAmbientColor + uBreakFlashIntensity * 0.1;

    if(uFogEnabled) {
        float distanceFromEye = length(vEyeSpace);
        float fogf = (uFogFar- distanceFromEye) / (uFogFar - uFogNear);
        fogf = clamp(fogf, 0, 1);
        lit *= fogf;
    }

    for( int i=0; i<uStaticPointLightInfosCount; i++ ) {
      StaticPointLightInfo spli = getStaticPointLightInfoFromTexture( i );
      float lightTimeFactor = (uTimeInstant - spli.st) / (spli.et - spli.st);
      if( lightTimeFactor < 0 || lightTimeFactor >= 1 ) {
        continue;
      }
      float lightIntensity = STATIC_POINT_LIGHT_INTENSITY_SCALE_FACTOR * spli.aIntensity1 * sampleCurve( spli.aIntensityCurve, lightTimeFactor );
      float d = distance( spli.pos, vWorldSpace );
      lightIntensity /= d*d;

      lit += spli.aColor0 * lightIntensity;
    }
    if( !uModelDrawFlagLightingEnabled ) {
        lit = vec3( 1 );
    }

    if( uModelDrawFlagHighlighted ) {
        // for a normal material, we turn off lighting
        // for a lit material, we increase the lighting
        if( uModelDrawFlagLightingEnabled ) {
            lit = vec3( 1 );
        } else {
            lit = vec3( 2 );
        }
    }
    lit *= 0.5;

    vec3 f_diffuse = baseColor.rgb * lit;
    outColor = vec4(f_diffuse , baseColor.a);
    if(uMaterialAlphaMaskEnabled && outColor.a < uMaterialAlphaCutoff) { discard; }
#else
    outColor = vec4(abs(vNormal),1);
#endif
}

