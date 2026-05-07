uniform sampler2D uTexture;
uniform vec4 uTextureExtents;
uniform vec4 uModulateColor;
uniform int uBlockifyDownsamples;

out vec4 outColor;
in vec4 vPosition;

void main(void) {
    vec2 tc = vPosition.xy*0.5 + 0.5;
    tc.x = mix(uTextureExtents.x, uTextureExtents.z, tc.x);
    tc.y = mix(uTextureExtents.y, uTextureExtents.w, tc.y);
    if( uBlockifyDownsamples != 0 ) {
      float block_scale = pow( 2.0, float(uBlockifyDownsamples) );
      vec2 sz = textureSize( uTexture, 0 );
      tc = round((tc * sz) / block_scale) * block_scale / sz;
    }
    vec4 color = texture(uTexture, tc);
    outColor = color * uModulateColor;
}

