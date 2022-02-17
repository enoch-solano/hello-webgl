#version 300 es

#define BUMPINESS 0.1
#define FREQ 4.0
#define EPSILON 0.1

uniform mat4 u_Model;       // The matrix that defines the transformation of the
                            // object we're rendering

uniform mat4 u_ModelInvTr;  // The inverse transpose of the model matrix.
                            // This allows us to transform the object's normals properly
                            // if the object has been non-uniformly scaled.

uniform mat4 u_ViewProj;    // The matrix that defines the camera's transformation

in vec4 vs_Pos;             // The array of vertex positions passed to the shader
in vec4 vs_Nor;             // The array of vertex normals passed to the shader
in vec4 vs_Col;             // The array of vertex colors passed to the shader

out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex
out vec4 fs_Col;            // The color of each vertex
out vec4 fs_Pos;            // The position of each vertex

const vec4 lightPos = vec4(5, 5, 3, 1); //The position of our virtual light, which is used to compute the shading of
                                        //the geometry in the fragment shader.

float perlinNoise(vec3 P, float samplingFreq);

vec4 calcNor(vec3 nor);
float f(vec3 pos);

void main() {
    mat3 invTranspose = mat3(u_ModelInvTr);
    fs_Nor = vec4(invTranspose * vec3(vs_Nor), 0);          // Transform the geometry's normals by the inverse transpose of the
                                                            // model matrix. This is necessary to ensure the normals remain
                                                            // perpendicular to the surface after the surface is transformed by
                                                            // the model matrix.


    vec4 modelposition = vs_Pos + f(vs_Pos.xyz) * vs_Nor;
    // vec4 modelposition = vs_Pos;
    modelposition = u_Model * modelposition;

    fs_Nor = vec4(invTranspose * vec3(vs_Nor), 0);
    fs_Nor = calcNor(fs_Nor.xyz);
    fs_Col = vs_Col;
    fs_Pos = modelposition;

    fs_LightVec = lightPos - modelposition;  // Compute the direction in which the light source lies

    gl_Position = u_ViewProj * modelposition;// gl_Position is a built-in variable of OpenGL which is
                                             // used to render the final positions of the geometry's vertices
}

/********** noise function definitions **********/

vec3 random3(vec3 p);
float surflet(vec3 P, vec3 Gp_ijk);
float fade(float t);

float perlinNoise(vec3 P, float samplingFreq) {
    P = P * samplingFreq;
    
    float sum = 0.f;
    vec3 Gp = floor(P);
    
    for (int x = 0; x <= 1; x++) {
        for (int y = 0; y <= 1; y++) {
            for (int z = 0; z <= 1; z++) {
                sum += surflet(P, Gp + vec3(x, y, z));
            }
        }
    }
    
    return sum;
}

/********** helper function definitions **********/

float f(vec3 pos) {
    return BUMPINESS * perlinNoise(pos.xyz, FREQ);
}

// computes the normal as defined here
// https://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch05.html
vec4 calcNor(vec3 nor) {
    float F_0 = f(vs_Pos.xyz);
    float F_x = f(vs_Pos.xyz + vec3(EPSILON, 0, 0));
    float F_y = f(vs_Pos.xyz + vec3(0, EPSILON, 0));
    float F_z = f(vs_Pos.xyz + vec3(0, 0, EPSILON));

    vec3 dF = (vec3(F_x, F_y, F_z) - vec3(F_0)) / EPSILON;

    return vec4(normalize(nor - dF), 0);
}

float surflet(vec3 P, vec3 Gp_ijk) {
    // Get the vector from the grid point to P
    vec3 diff = P - Gp_ijk;
    
    float tX = 1.f - fade(abs(diff.x));
    float tY = 1.f - fade(abs(diff.y));
    float tZ = 1.f - fade(abs(diff.z));
    
    // Get the random vector for the grid point
    vec3 gradient = random3(Gp_ijk);
    
    
    // Get the noise contribution from this grid point
    float n_ijk = dot(diff, gradient);
    
    // Get the interpolated noise contribution frmo this grid point
    return n_ijk * tX * tY * tZ;
}

vec3 random3(vec3 p) {
    return fract(sin(vec3(dot(p, vec3(127.1f, 311.7f, 420.69f)),
                          dot(p, vec3(269.5f, 183.3f, 632.897f)),
                          dot(p - vec3(5.555, 10.95645, 70.266), vec3(765.54f, 631.2f, 109.21f)))) * 43758.5453f);
}

float fade(float t) {
    return t * t * t * ( t * (6.f*t - 15.f) + 10.f );
}
