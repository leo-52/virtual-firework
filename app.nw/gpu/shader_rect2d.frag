out vec4 outColor;

in vec2 vTextureCoords;
uniform sampler2D uTexture;

void main(void) {
    outColor = texture(uTexture, vTextureCoords);
}

