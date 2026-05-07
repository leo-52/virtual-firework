out vec4 outColor;

void main(void) {
  uint x = uint(gl_FragCoord.x);
  uint y = uint(gl_FragCoord.y);
  uint pixel = y*uint(20017) + x;

  RandomState random_state = init_random(pixel);
  float v = rand(random_state);

  outColor = vec4(v,v,v, 1);
}

