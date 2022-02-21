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

uniform int u_VertTime;

in vec4 vs_Pos;             // The array of vertex positions passed to the shader
in vec4 vs_Nor;             // The array of vertex normals passed to the shader
in vec4 vs_Col;             // The array of vertex colors passed to the shader

out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex
out vec4 fs_Col;            // The color of each vertex
out vec4 fs_Pos;            // The position of each vertex

const vec4 lightPos = vec4(5, 5, 3, 1); 

float f(vec3 pos);      // returns the amount to offset the vertex position
vec4 calcNor(vec3 pos, vec3 nor);

mat4 rotateY(float theta);
mat4 translate(vec3 v);

void main() {
    vec3 noiseSeed = vs_Pos.xyz;

    // offset the vertex position by the bump map as defined by perlin noise
    vec4 modelposition = vs_Pos + f(noiseSeed) * vs_Nor;
    modelposition = u_Model * modelposition;

    float amount = float(u_VertTime) * 0.01;
    mat4 spinRot = rotateY(amount);         // rotation matrix to spin the moon
    modelposition = spinRot * modelposition;

    float orbitalRadius = 3.0;
    mat4 orbitTrans = translate(vec3(orbitalRadius, 0, 0));
    modelposition = orbitTrans * modelposition;

    mat4 orbitRot = rotateY(amount);  // rotation matrix to all moon to orbit planet
    modelposition = orbitRot * modelposition;

    fs_Pos = modelposition;

    // compute the new normal of the vertex
    // need to incorporate new rotaion to the normals as well
    mat3 invTranspose = mat3(orbitRot * spinRot * u_ModelInvTr);
    fs_Nor = calcNor(noiseSeed, invTranspose * vec3(vs_Nor));

    // pass on data to be interpolated and passed on to frag shader
    fs_Col = vs_Col;
    fs_LightVec = lightPos - modelposition; 

    gl_Position = u_ViewProj * modelposition;
}

/********** noise function definitions **********/

float surflet(vec3 P, vec3 Gp_ijk);

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

// TURBULENCE TEXTURE
float turbulence(vec3 pos, float baseFreq) {
    float t = -0.5;

    for (float f = baseFreq; f < 16.0; f *= 2.0) {
        t += abs(perlinNoise(pos, f) / f);
    }

    return t;
}

// offset to create a crinkled bump map as defined here
// https://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch05.html
float f(vec3 pos) {
    return -0.10 * turbulence(pos, 1.0);
}

// computes the normal as defined here
// https://developer.download.nvidia.com/books/HTML/gpugems/gpugems_ch05.html
vec4 calcNor(vec3 pos, vec3 nor) {
    float F_0 = f(pos);
    float F_x = f(pos + vec3(EPSILON, 0, 0));
    float F_y = f(pos + vec3(0, EPSILON, 0));
    float F_z = f(pos + vec3(0, 0, EPSILON));

    vec3 dF = (vec3(F_x, F_y, F_z) - vec3(F_0)) / EPSILON;

    return vec4(normalize(nor - dF), 0);
}


mat4 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);

    return mat4(vec4(c,0,-s,0), vec4(0,1,0,0), vec4(s,0,c,0), vec4(0,0,0,1));
}

mat4 translate(vec3 v) {
    return mat4(vec4(1,0,0,0), vec4(0,1,0,0), vec4(0,0,1,0), vec4(v,1));
}

vec3 random3(vec3 p) {
    return fract(sin(vec3(dot(p, vec3(127.1f, 311.7f, 420.69f)),
                          dot(p, vec3(269.5f, 183.3f, 632.897f)),
                          dot(p - vec3(5.555, 10.95645, 70.266), vec3(765.54f, 631.2f, 109.21f)))) * 43758.5453f);
}

float fade(float t) {
    return t * t * t * ( t * (6.f*t - 15.f) + 10.f );
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
