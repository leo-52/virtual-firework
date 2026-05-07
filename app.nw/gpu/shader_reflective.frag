uniform sampler2D uReflectionTexture;
uniform sampler2D uWaterNormalMap;
uniform vec2 uFramebufferSize;
uniform float R_reflectionIntensity;

in vec3 vEye;
in vec2 vWaterUV;

out vec4 outColor;

const float WaveHeight = 0.025;

void main(void) {
#if 0
    outColor = vec4(0,0,1,1);
#else

    vec2 tc = gl_FragCoord.xy / uFramebufferSize;

    vec2 timeOffset = vec2(uTimeInstant/60, 0.5 * sin(uTimeInstant/10));
    vec3 bumpColor1 = texture( uWaterNormalMap, vWaterUV + timeOffset).xyz;
    //bumpColor1 = vec3(0.5, 0.5, 1.0);
    vec3 waterNormal = ((bumpColor1 - 0.5) * 2.0).xzy;

    //fresnel term
    const float AirIOR = 1.0;
    const float WaterIOR = 1.34235;
    float R_0 = (AirIOR - WaterIOR) / (AirIOR + WaterIOR);
    R_0 *= R_0;

    float cosTheta = dot(normalize(vEye), waterNormal);
    float R_theta = R_0 + (1.0 - R_0) * pow(1.0 - cosTheta, 2.0);

    tc += WaveHeight*waterNormal.xz;
    outColor = texture( uReflectionTexture, tc) * R_theta * R_reflectionIntensity;
#endif
}

