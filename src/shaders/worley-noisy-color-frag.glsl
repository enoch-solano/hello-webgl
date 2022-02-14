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
uniform vec2 u_Fractal; // The base frequency and the persistence for fractal noise

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec4 fs_Pos;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

vec3 random3(vec3 p) {
    return fract(sin(vec3(dot(p, vec3(127.1f, 311.7f, 420.69f)),
                          dot(p, vec3(269.5f, 183.3f, 632.897f)),
                          dot(p - vec3(5.555, 10.95645, 70.266), vec3(765.54f, 631.2f, 109.21f)))) * 43758.5453f);
}

float worleyNoise(vec3 P, float samplingFreq) {
    P = P * samplingFreq;

    // tilespace coords
    vec3 uvw = fract(P);
    vec3 Gp  = floor(P);

    // set minDist to max value
    float minDist = 2.0;

    // Search all neighboring cells and this cell for their point
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 offset = vec3(float(x), float(y), float(z));

                // point in neighbors cell
                vec3 point = random3(Gp + offset);

                // compute distance between this frag
                // and the point generated in neighbor cell
                vec3 diff = point + offset - uvw;
                float dist = length(diff);
                minDist = min(minDist, dist);
            }
        }
    }

    return minDist;
}

float fractalWorley(vec3 P, int octaves) {
    float amp = 0.5;
    float freq = u_Fractal.x;
    float sum = 0.0;

    for (int i = 0; i < octaves; i++) {
        sum += worleyNoise(P, freq) * amp;
        amp *= u_Fractal.y;
        freq *= 2.0;
    }

    return sum + 0.25 + pow(0.25, float(octaves));
}

void main() {
    float time = float(u_FragTime) * 0.003;
    vec3 P = vec3(fs_Pos.xy, fs_Pos.z + time);

    float amount = fractalWorley(P, u_Octaves);
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
