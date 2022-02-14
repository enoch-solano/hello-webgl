#version 300 es

// This is a fragment shader. If you've opened this file first, please
// open and read lambert.vert.glsl before reading on.
// Unlike the vertex shader, the fragment shader actually does compute
// the shading of geometry. For every pixel in your program's output
// screen, the fragment shader is run for every bit of geometry that
// particular pixel overlaps. By implicitly interpolating the position
// data passed into the fragment shader by the vertex shader, the fragment shader
// can compute what color to apply to its pixel based on things like vertex
// position, light position, and vertex color.
precision highp float;

uniform vec4 u_Color; // The color with which to render this instance of geometry.

uniform int u_FragTime;

uniform int u_Octaves;  // The number of octaves to compute for fractal noise
uniform vec2 u_Fractal; // The starting frequency and the persistence for fractal noise

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec4 fs_Pos;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.


vec2 random2(vec3 p) {
    return fract(sin(vec2(dot(p, vec3(127.1f, 311.7f, 420.69f)),
                          dot(p, vec3(269.5f, 183.3f, 632.897f)))) * 43758.5453f);
}

float random1(vec2 p) {
    return fract(sin(dot(p, vec2(420.6f, 631.2f)))*43758.5453f);
}

float random1(vec3 p) {
    return random1(random2(p));
}

float smoothStep(float a, float b, float t) {
    t = t * t * t * ( t * (6.f*t - 15.f) + 10.f );
    return mix(a, b, t);
}

float brownianMotion(vec3 P, float samplingFreq) {
    P = P * samplingFreq;

    // tilespace coords
    vec3 uvw = fract(P);
    vec3 Gp = floor(P);

    // grid points
    vec3 Gp000 = Gp;
    vec3 Gp100 = Gp + vec3(1,0,0);
    
    vec3 Gp010 = Gp + vec3(0,1,0);
    vec3 Gp110 = Gp + vec3(1,1,0);

    vec3 Gp001 = Gp + vec3(0,0,1);
    vec3 Gp101 = Gp + vec3(1,0,1);

    vec3 Gp011 = Gp + vec3(0,1,1);
    vec3 Gp111 = Gp + vec3(1,1,1);

    // noise contribution from each grid point
    float n000 = random1(Gp000);
    float n100 = random1(Gp100);

    float n010 = random1(Gp010);
    float n110 = random1(Gp110);

    float n001 = random1(Gp001);
    float n101 = random1(Gp101);

    float n011 = random1(Gp011);
    float n111 = random1(Gp111);
    

    // Interpolate along x the contributions from each of the corners
    float nx00 = smoothStep(n000, n100, uvw.x);
    float nx10 = smoothStep(n010, n110, uvw.x);
    float nx01 = smoothStep(n001, n101, uvw.x);
    float nx11 = smoothStep(n011, n111, uvw.x);
    
    // Interpolate the four results along y
    float nxy0 = smoothStep(nx00, nx10, uvw.y);
    float nxy1 = smoothStep(nx01, nx11, uvw.y);
    
    // Interpolate the two last results along z
    float nxyz = smoothStep(nxy0, nxy1, uvw.z);

    return nxyz;
}

// fractal brownian motion
float fbm(vec3 P, int octaves) {
    float amp = 0.5;
    float freq = u_Fractal.x;
    float sum = 0.0;

    for (int i = 0; i < octaves; i++) {
        sum += brownianMotion(P, freq) * amp;
        amp *= u_Fractal.y;
        freq *= 2.0;
    }

    return sum + 0.25 + pow(0.25, float(octaves));
}

void main() {
    float time = float(u_FragTime) * 0.003;
    vec3 P = vec3(fs_Pos.xy, fs_Pos.z + time);

    float amount = fbm(P, u_Octaves);
    vec3 diffuseColor = mix(vec3(0), u_Color.rgb, amount);

    // Calculate the diffuse term for Lambert shading
    float diffuseTerm = dot(normalize(fs_Nor), normalize(fs_LightVec));
    // Avoid negative lighting values
    // diffuseTerm = clamp(diffuseTerm, 0, 1);

    float ambientTerm = 0.2;

    float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
                                                            //to simulate ambient lighting. This ensures that faces that are not
                                                            //lit by our point light are not completely black.

    // Compute final shaded color
    out_Col = vec4(diffuseColor * lightIntensity, 1);
}
