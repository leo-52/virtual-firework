in vec3 aPos0;
in vec3 aNormal;
in vec2 aDiffuseUV;
in vec4 aColor;

uniform mat4 ProjMat;
uniform mat4 ViewMat;
uniform mat4 ModelMat;

out vec3 vEye;
out vec2 vWaterUV;

void main(void) {
    mat4 ModelViewMat = ViewMat * ModelMat;

    vWaterUV = aPos0.xz/50;
    vEye = getCameraPosFromViewMat(ViewMat) - aPos0;
    gl_Position = ProjMat * ModelViewMat * vec4(aPos0, 1);
}

