uniform sampler2D uTexture;
uniform bool uHorizontal;
uniform float uPreAdd;
uniform float uPostScale;
uniform int uMipLevel;

uniform float uBlurWeights[ 256 ];
uniform int uNumBlurWeights;

out vec4 outColor;

vec4 fetch( ivec2 coord ) {
    return max( vec4(0), texelFetch( uTexture, coord, uMipLevel ) + vec4(uPreAdd) );
}

void main( void ) {
    ivec2 pixel = uHorizontal ? ivec2( 1, 0 ) : ivec2( 0, 1 );
    ivec2 center = ivec2( gl_FragCoord.xy );

    outColor = fetch( center ) * uBlurWeights[ 0 ];
    for( int i = 1; i < uNumBlurWeights; i++ ) {
        outColor += fetch( center + i * pixel ) * uBlurWeights[ i ];
        outColor += fetch( center - i * pixel ) * uBlurWeights[ i ];
    }

    outColor *= uPostScale;
}
