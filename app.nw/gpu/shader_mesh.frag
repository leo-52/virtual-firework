out vec4 outColor;

in vec2 vDiffuseUV;
in vec3 vNormal;
in vec3 vEyeSpace;
in vec3 vWorldSpace;

uniform sampler2D uDiffuseTexture;

uniform int uGroundSplatCount;
uniform sampler2DArray uGroundSplatsTexture;
uniform int uGroundSplatTextureIds[C_MaxGroundSplatsCount];
uniform vec4 uGroundSplatCoords[C_MaxGroundSplatsCount];
uniform bool uGroundSplatsNegateZ;

uniform vec3 uAmbientColor;

uniform vec3 uSunDirection;
uniform vec3 uSunColor;

uniform bool uFogEnabled;
uniform bool uSelfIlluminated;
uniform bool uAlphaTestEnabled;
uniform bool uLightingEnabled;
uniform bool uTextureMesh;
uniform bool uDrawFakePositionShadows;

uniform float uFogNear;
uniform float uFogFar;

uniform int uFakePositionCount;
uniform vec3 uFakePositionLocations[C_MaxFakePositionCount];

uniform int uGeoClipDiscardInsideCount;
uniform vec4 uGeoClipDiscardInsideBounds[2];

in vec4 vColor;

uniform float uBreakFlashIntensity;

const float STATIC_POINT_LIGHT_INTENSITY_SCALE_FACTOR = 0.15;

void main(void) {
#if 1
    vec4 diffuseTexture = vec4(1,1,1,1);
    if(uTextureMesh) {
        diffuseTexture = texture(uDiffuseTexture, vDiffuseUV);
    }
    float SC=1.0;
    for(int i=0; i<uGroundSplatCount; i++ ) {
      float z = uGroundSplatsNegateZ ? -vWorldSpace.z : vWorldSpace.z;
      vec3 splatCoord = vec3(
        (vWorldSpace.x-uGroundSplatCoords[i].x*SC) / (uGroundSplatCoords[i].z*SC-uGroundSplatCoords[i].x*SC),
        (z-uGroundSplatCoords[i].y*SC) / (uGroundSplatCoords[i].w*SC-uGroundSplatCoords[i].y*SC),
        uGroundSplatTextureIds[i]
        );
      splatCoord.y = 1.0 - splatCoord.y;
      if( true
          && splatCoord.x >= 0.0 && splatCoord.x < 1.0
          && splatCoord.y >= 0.0 && splatCoord.y < 1.0
      ) {
        diffuseTexture = texture(uGroundSplatsTexture, splatCoord);
      }
    }

    diffuseTexture = srgbToLinear(diffuseTexture);

    if(true) {
      float L = 0.2126 * diffuseTexture.r + 0.7152 * diffuseTexture.g + 0.0722 * diffuseTexture.b;
      diffuseTexture = (diffuseTexture + vec4(L,L,L,diffuseTexture.a)) / 2;
    }

    if( uGeoClipDiscardInsideCount != 0 ) {
        for(int i=0; i<uGeoClipDiscardInsideCount; i++) {
            bool inside = vWorldSpace.x >= uGeoClipDiscardInsideBounds[i].x && vWorldSpace.x < uGeoClipDiscardInsideBounds[i].z &&  vWorldSpace.z >= uGeoClipDiscardInsideBounds[i].y && vWorldSpace.z < uGeoClipDiscardInsideBounds[i].w;
            if( inside ) { discard; }
        }
    }

    if(uDrawFakePositionShadows) {
      float d = 1e6;
      for(int i=0; i<uFakePositionCount; i++) {
        d = min(d, distance(vWorldSpace.xz, uFakePositionLocations[i].xz));
      }
      d = min(d, length(vWorldSpace.xz)*1.5+0); //origin man
      if(d < 3) {
        d -= 1;
        diffuseTexture *= mix(0.45, 1.0, d/2.0);
      }
    }

    diffuseTexture *= vColor;

    float irradiance = max(0.0, dot(normalize(-1 * uSunDirection), normalize(vNormal)));
    vec3 sunlit = uSunColor * irradiance;

    vec3 lit = sunlit + uAmbientColor + uBreakFlashIntensity * 0.1;

    if(uFogEnabled) {
        float distanceFromEye = length(vEyeSpace);
        float fogf = (uFogFar- distanceFromEye) / (uFogFar - uFogNear);
        fogf = clamp(fogf, 0, 1);
        lit *= fogf;
    }
  
    if(!uLightingEnabled || uSelfIlluminated) {
        lit = vec3(1);
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

    outColor = vec4(diffuseTexture.rgb * lit, diffuseTexture.a);
    if(uAlphaTestEnabled && outColor.a < 0.25) { discard; }
#else
    outColor = vec4(vNormal,1);
#endif
}

