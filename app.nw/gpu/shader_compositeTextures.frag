uniform vec2 uFramebufferSize;
uniform sampler2D uTextures[8];
uniform float uTextureWeights[8];
uniform int uNumTextures;

out vec4 outColor;

void main(void) {
  vec2 tc = gl_FragCoord.xy / uFramebufferSize;
#if 1
  outColor = vec4(0);
  if(uNumTextures > 0) outColor += uTextureWeights[0] * texture(uTextures[0], tc);
  if(uNumTextures > 1) outColor += uTextureWeights[1] * texture(uTextures[1], tc);
  if(uNumTextures > 2) outColor += uTextureWeights[2] * texture(uTextures[2], tc);
  if(uNumTextures > 3) outColor += uTextureWeights[3] * texture(uTextures[3], tc);
  if(uNumTextures > 4) outColor += uTextureWeights[4] * texture(uTextures[4], tc);
  if(uNumTextures > 5) outColor += uTextureWeights[5] * texture(uTextures[5], tc);
  if(uNumTextures > 6) outColor += uTextureWeights[6] * texture(uTextures[6], tc);
  if(uNumTextures > 7) outColor += uTextureWeights[7] * texture(uTextures[7], tc);
#else
  outColor = vec4(gl_FragCoord.xy / uFramebufferSize, 0, 0);
#endif
}

