in vec4 vDebugShade;
in vec3 vColor;

out vec4 outColor;

void main(void) {
  vec3 result = vColor;
  outColor = vec4(result, 0) + vDebugShade;
}

