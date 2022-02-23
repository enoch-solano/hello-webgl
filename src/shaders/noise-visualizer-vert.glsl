#version 300 es

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

float perlinNoise(vec3 P, float samplingFreq);

// returns a psuedo-random between 0 and 1
float noise(vec3 P, float samplingFreq) {
    return perlinNoise(P, samplingFreq);
}

void main() {
    vec4 modelposition = vs_Pos;
    modelposition = u_Model * modelposition;
    fs_Pos = modelposition;

    // compute the new normal of the vertex
    mat3 invTranspose = mat3(u_ModelInvTr);
    fs_Nor = vec4(invTranspose * vec3(vs_Nor), 0);

    vec3 noiseSeed = vs_Pos.xyz; 
    float value = noise(noiseSeed, 32.0);

    // checks for out of bounds
    if (value < 0.0) {
        fs_Col = vec4(1, 0, 1, 1);
    } else if (value > 1.0) {
        fs_Col = vec4(0, 1, 0, 1);
    } else {
        fs_Col = vec4(vec3(value), 1);
    }

    gl_Position = u_ViewProj * modelposition;
}

/********** noise function definitions **********/

float surflet(vec3 P, vec3 Gp_ijk);

// returns a number between 0 and 1
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
    
    return clamp(sum + 0.5, 0.0, 1.0);
}

/********** helper function definitions **********/

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
