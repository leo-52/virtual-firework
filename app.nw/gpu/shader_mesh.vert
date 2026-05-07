in vec3 aPos0;
in vec3 aNormal;
in vec2 aDiffuseUV;
in vec4 aColor;

uniform mat4 ProjMat;
uniform mat4 ViewMat;
uniform mat4 ModelMat;

uniform mat4 LightProjMat;
uniform mat4 LightViewMat;

uniform vec4 uMaterialColor;

uniform bool uIsInReflection;
uniform vec4 uClipPlane =vec4(0.0, 2.0, 0.0, 1.0);

out vec2 vDiffuseUV;
out vec3 vNormal;
out vec3 vEyeSpace;
out vec4 vColor;
out vec3 vWorldSpace;

void main(void) {
    mat4 ModelViewMat = ViewMat * ModelMat;

    vEyeSpace = project(ModelViewMat * vec4(aPos0, 1)).xyz;
    vWorldSpace = project(ModelMat * vec4(aPos0, 1)).xyz;
    gl_Position = ProjMat * ModelViewMat * vec4(aPos0, 1);
    vDiffuseUV = aDiffuseUV;
    vec3 nrm = mat3(ModelMat) * aNormal;
    vNormal = nrm;
    vColor = aColor * uMaterialColor;
    vColor = srgbToLinear(vColor);
    vColor.a = 1.0;

    if(uIsInReflection) {
      vec4 worldPosition = ModelMat * vec4(aPos0, 1.0);
      gl_ClipDistance[0] = dot(worldPosition, uClipPlane);
    }
}
