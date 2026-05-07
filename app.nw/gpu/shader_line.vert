in vec3 aPos;
in vec4 aColor;

uniform mat4 ProjMat;
uniform mat4 ViewMat;
uniform mat4 ModelMat;
uniform mat4 ColorMat;

out vec4 vColor;
out vec3 vWorldSpace;

void main(void) {
    mat4 ModelViewMat = ViewMat * ModelMat;

    vWorldSpace = project(ModelMat * vec4(aPos, 1)).xyz;
    gl_Position = ProjMat * ModelViewMat * vec4(aPos, 1);
    vColor = ColorMat * aColor;
}
