in vec3 aVertexPosition;

out vec4 vPosition;

void main(void) {
    if( gl_VertexID == 0 ) {
        gl_Position = vPosition = vec4(-1, 1,0,1);
    }
    else if( gl_VertexID == 1 ) {
        gl_Position = vPosition = vec4(-1,-1,0,1);
    }
    else if( gl_VertexID == 2 ) {
        gl_Position = vPosition = vec4( 1, 1,0,1);
    }
    else if( gl_VertexID == 3 ) {
        gl_Position = vPosition = vec4( 1,-1,0,1);
    }
}
