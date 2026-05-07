uniform sampler2D uPuffTexture;
uniform sampler2D uSparkAuraTexture;
uniform vec2 uFramebufferSize;

uniform float uBreakFlashIntensity;

in vec4 vDebugShade;
in float vSmokeBlack;
in float vSmokeAmbient;
in float vSmokeLight;
in float vRotate;

out vec4 outColor;

vec3 linear_to_luminosity(vec3 c) {
  float g = 0.21 * c.r + 0.72 * c.g + 0.07 * c.b;
  return vec3(g,g,g);
}

void main() {
  vec2 tc = gl_PointCoord.xy;
#if 1
  float cv = cos(vRotate);
  float sv = sin(vRotate);
  mat2 rot = mat2(cv, -sv, sv, cv);

  vec2 offset = vec2(0.5,0.5);
  tc = (tc-offset)*rot + offset;
  tc = clamp(tc,0,1);
#endif
  float t = texture(uPuffTexture, tc).x;

  vec3 aura_texture = texture(uSparkAuraTexture, gl_FragCoord.xy / uFramebufferSize).xyz;

  vec3 aura_color = aura_texture;
  aura_color = vec3(0);
  vec3 grey_color = linear_to_luminosity(aura_color);
  vec3 breakflash_color = vec3(uBreakFlashIntensity);
  //breakflash_color = vec3(5.0);
  //breakflash_color = vec3(0);
  vec3 light_color = mix(aura_color, grey_color, 0.8) + breakflash_color;

  vec3 light = (light_color * vSmokeLight + vSmokeAmbient) * t;
  outColor = vec4(light, vSmokeBlack * t) + vDebugShade;
}

