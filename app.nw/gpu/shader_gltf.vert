in vec3 POSITION;
in vec3 NORMAL;
in vec2 TEXCOORD_0;
in vec2 TEXCOORD_1;
in vec4 COLOR_0;

uniform bool uHasAttributeNORMAL;
uniform bool uHasAttributeCOLOR_0;

uniform mat4 ProjMat;
uniform mat4 ViewMat;
uniform mat4 ModelMat;

uniform mat4 LightProjMat;
uniform mat4 LightViewMat;

uniform vec4 uMaterialColor;
uniform float uModelIntensity;

uniform bool uIsInReflection;
uniform vec4 uClipPlane =vec4(0.0, 2.0, 0.0, 1.0);

out vec2 vTEXCOORD_0;
out vec3 vNORMAL;
out vec3 vEyeSpace;
out vec4 vColor;
out vec3 vWorldSpace;

void main(void) {
    mat4 ModelViewMat = ViewMat * ModelMat;

    vEyeSpace = project(ModelViewMat * vec4(POSITION, 1)).xyz;
    vWorldSpace = project(ModelMat * vec4(POSITION, 1)).xyz;
    gl_Position = ProjMat * ModelViewMat * vec4(POSITION, 1);
    vTEXCOORD_0 = TEXCOORD_0;

    if( uHasAttributeNORMAL ) {
        vec3 nrm = mat3(ModelMat) * NORMAL;
        vNORMAL = nrm;
    } else {
        vNORMAL = vec3(0,0,1);
    }

    if( uHasAttributeCOLOR_0 ) {
        vColor = vec4( COLOR_0.xyz * uModelIntensity, COLOR_0.a );
    } else {
        vColor = vec4( uModelIntensity, uModelIntensity, uModelIntensity, 1.0 );
        vColor = srgbToLinear(vColor);
    }

    if(uIsInReflection) {
      vec4 worldPosition = ModelMat * vec4(POSITION, 1.0);
      gl_ClipDistance[0] = dot(worldPosition, uClipPlane);
    }
}
