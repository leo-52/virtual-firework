out vec4 outColor;

in vec3 vWorldSpace;
in vec4 vColor;

void main(void) {
#if 1
  outColor = vColor;
#else
  outColor = vec4(1,0,0,1);
#endif
}

