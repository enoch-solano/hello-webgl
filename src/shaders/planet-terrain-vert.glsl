#version 300 es

#define BUMPINESS 0.1
#define FREQ 4.0
#define EPSILON 1.0
#define MAX_ELEVATION 0.35

#define ELEVATION_OCTAVES 0
#define ELEVATION_BASE_FREQ 1
#define ELEVATION_SCALE 2
#define EXPONENT 3
#define TERRACES 4

uniform mat4 u_Model;       // The matrix that defines the transformation of the
                            // object we're rendering

uniform mat4 u_ModelInvTr;  // The inverse transpose of the model matrix.
                            // This allows us to transform the object's normals properly
                            // if the object has been non-uniformly scaled.

uniform mat4 u_ViewProj;    // The matrix that defines the camera's transformation

uniform int u_VertTime;

uniform float[5] u_ElevationParams;
uniform float[6] u_OctaveAmps;

in vec4 vs_Pos;             // The array of vertex positions passed to the shader
in vec4 vs_Nor;             // The array of vertex normals passed to the shader
in vec4 vs_Col;             // The array of vertex colors passed to the shader

out vec4 fs_Nor;            // The array of normals that has been transformed by u_ModelInvTr
out vec4 fs_LightVec;       // The direction in which our virtual light lies, relative to each vertex
out vec4 fs_Col;            // The color of each vertex
out vec4 fs_Pos;            // The position of each vertex

out float fs_Elevation;

const vec4 lightPos = vec4(5, 5, 3, 1); 

float f(vec3 pos);      // returns the amount to offset the vertex position
vec4 calcNor(vec3 pos, vec3 nor);

mat4 rotateY(float theta);

void main() {
    vec3 noiseSeed = vs_Pos.xyz; // + 0.1 * 0.05 * vec3(0, u_VertTime, 0);

    // offset the vertex position by the bump map as defined by perlin noise
    fs_Elevation = f(noiseSeed);
    vec4 modelposition = vs_Pos + fs_Elevation * vs_Nor;
    modelposition = u_Model * modelposition;

    // rotate planet about y-axis
    float amount = float(u_VertTime) * 0.005;
    mat4 spinRot = rotateY(amount);
    modelposition = spinRot * modelposition;

    // compute the new normal of the vertex
    mat3 invTranspose = mat3(spinRot * u_ModelInvTr);
    fs_Nor = calcNor(noiseSeed, invTranspose * vec3(vs_Nor));

    // pass on data to be interpolated and passed on to frag shader
    fs_Pos = modelposition;
    fs_Col = vs_Col;
    fs_LightVec = lightPos - modelposition; 

    // normalize elevation back to be in [0,1] for frag shader
    fs_Elevation /= u_ElevationParams[ELEVATION_SCALE];

    gl_Position = u_ViewProj * modelposition;
}

/********** noise function definitions **********/

vec3 random3(vec3 p);
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

// compute elevation as described here:
// https://www.redblobgames.com/maps/terrain-from-noise/
float elevation(vec3 pos) {
    float freq = u_ElevationParams[ELEVATION_BASE_FREQ];
    float amp = 0.5;
    int numOctaves = int(u_ElevationParams[ELEVATION_OCTAVES]);

    float elevation = 0.0;
    float ampTotal = 0.0;

    for (int i = 0; i < numOctaves; i++) {
        // random offset helps remove artifacts along the axis
        vec3 randOffset = random3(vec3(i));

        elevation += u_OctaveAmps[i] * perlinNoise(pos + randOffset, freq);
        ampTotal += u_OctaveAmps[i];

        freq *= 1.618;
    }

    // normalized back to be between 0 and 1
    elevation = clamp(elevation / ampTotal, 0.0, 1.0);

    float alpha = 1.2;
    float exponent = u_ElevationParams[EXPONENT];
    
    return pow(alpha * elevation, exponent);
}

float terracize(float e, float numTerraces) {
    return round(e * numTerraces) / numTerraces;
}

/********** helper function definitions **********/

// offset to create a bump map as defined here
float f(vec3 pos) {
    float maxHeight = u_ElevationParams[ELEVATION_SCALE];
    float numTerraces = u_ElevationParams[TERRACES];
    return maxHeight * terracize(elevation(pos), numTerraces);
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
