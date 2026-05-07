out vec4 fragColor;
in vec4 vPosition;

uniform vec2 uFramebufferSize;
uniform sampler2D uInputTexture;

void main() {
    vec2 tc = gl_FragCoord.xy / uFramebufferSize;
    vec4 inputColor = texture( uInputTexture, tc );
    fragColor = vec4(inputColor.rgb,1);
}
