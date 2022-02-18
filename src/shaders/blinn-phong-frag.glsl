#version 300 es

#define SHININESS 55.0

precision highp float;

uniform vec4 u_Color;   // The material color
uniform vec3 u_CamPos;

in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec4 fs_Pos;

out vec4 out_Col; 

void main() {
    // Material base color (before shading)
    vec4 diffuseColor = u_Color;

    // Calculate the diffuse term for Lambert shading
    float diffuseTerm = dot(normalize(fs_Nor), normalize(fs_LightVec));
    float ambientTerm = 0.2;

    vec4 L = normalize(fs_LightVec);
    vec4 V = normalize(vec4((u_CamPos - fs_Pos.xyz), 0.0));

    vec4 H = normalize((V + L) / 2.0);
    vec4 N = normalize(fs_Nor);

    float specularTerm = max(pow(dot(H, N), SHININESS), 0.0) * 0.5;

    float lightIntensity = diffuseTerm + ambientTerm + specularTerm;  
    // Compute final shaded color
    out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
}
