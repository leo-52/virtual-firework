uniform sampler2D uTexture;
uniform vec2 uDepthRange;

out vec4 outColor;
in vec4 vPosition;

void main(void) {
    vec2 tc = vPosition.xy*0.5 + 0.5;
    float d;
    if(uDepthRange.y != uDepthRange.x) {
      d = texture(uTexture, tc).r;
      d = (d - uDepthRange.x) / (uDepthRange.y - uDepthRange.x);
    } else {
      d = 0.5;
    }
    outColor = vec4(d,d,d,1);
}

