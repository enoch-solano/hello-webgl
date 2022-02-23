#version 300 es

#define SHININESS 40.0

precision highp float;

uniform vec4 u_Color;   // material color
uniform vec3 u_CamPos;  // camera position

in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec4 fs_Pos;

in float fs_Elevation;

out vec4 out_Col; 


vec4 smoothStep(vec4 a, vec4 b, float t) {
    t = t * t * t * ( t * (6.f*t - 15.f) + 10.f );
    return mix(a, b, t);
}

void main() {
    // Material base color (before shading)
    vec4 diffuseColor = mix(vec4(0,0,1,1), vec4(0,1,0,1), fs_Elevation);

    // Calculate the diffuse term for Lambert shading
    float diffuseTerm = dot(normalize(fs_Nor), normalize(fs_LightVec));
    float ambientTerm = 0.2;

    // light vector
    vec4 L = normalize(fs_LightVec);
    // view vector
    vec4 V = normalize(vec4((u_CamPos - fs_Pos.xyz), 0.0));
    // vector between the view and light vector
    vec4 H = normalize((V + L) / 2.0);
    // normal vector
    vec4 N = normalize(fs_Nor);

    float specularTerm = max(pow(dot(H, N), SHININESS), 0.0) * 0.5;

    float lightIntensity = diffuseTerm + ambientTerm + specularTerm;  
    // Compute final shaded color
    out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
}
