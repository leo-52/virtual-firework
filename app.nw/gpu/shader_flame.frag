uniform sampler2D uPuffTexture;
uniform sampler2D uSmokeFlipbookTexture;
uniform sampler2D uSmokePuffTexture;

in float vRotate;
in float vLifeFactor;
in float vAlpha;
in vec3 vTemperatureColor;

out vec4 outColor;

void main(void) {

  vec2 tc = gl_PointCoord.xy;

#if 1
  float cv = cos(vRotate);
  float sv = sin(vRotate);
  mat2 rot = mat2(cv, -sv, sv, cv);

  vec2 offset = vec2(0.5,0.5);
  tc = (tc-offset)*rot + offset;
  if(min(tc.x, tc.y) < 0 || max(tc.x, tc.y) > 1) {
    discard;
  }
#endif

  tc.y = -tc.y;

  vec4 smoke_puff_color = srgbToLinear(texture(uSmokePuffTexture, tc));

  int frame1 = int(vLifeFactor * 64);
  int frame2 = frame1 + 1;
  vec2 flipbook_tc1 = tc / 8.0 + vec2(int(frame1%8),-int(frame1/8)) / 8.0;
  vec2 flipbook_tc2 = tc / 8.0 + vec2(int(frame2%8),-int(frame2/8)) / 8.0;
  vec4 flipbook_color1 = srgbToLinear(texture(uSmokeFlipbookTexture, flipbook_tc1));
  vec4 flipbook_color2 = srgbToLinear(texture(uSmokeFlipbookTexture, flipbook_tc2));
  float frame2_factor = fract(vLifeFactor * 64);
  vec4 flipbook_color = mix(flipbook_color1, flipbook_color2, frame2_factor);

  float A = mix(vAlpha, vAlpha-0.5, smoke_puff_color.r);
  A = A * flipbook_color.a;
  A = clamp(A, 0.0, 1.0);

  vec3 color_mod = smoke_puff_color.rgb + flipbook_color.rgb;
  vec3 color = vTemperatureColor * color_mod;

  outColor = vec4(color*A, A);
}


