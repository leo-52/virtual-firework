uniform vec4 uRect;

out vec2 vTextureCoords;

const vec2 data[4] = vec2[]
(
  vec2(0.0, 1.0),
  vec2(1.0, 1.0),
  vec2(0.0, 0.0),
  vec2(1.0, 0.0)
);

void main(void) {
    vec2 p = data[gl_VertexID]*uRect.zw + uRect.xy;
    p = mix(vec2(-1,-1), vec2(1,1), p);
    p.y *= -1;

    gl_Position = vec4(p, 0, 1);
    vTextureCoords = data[gl_VertexID];
}

