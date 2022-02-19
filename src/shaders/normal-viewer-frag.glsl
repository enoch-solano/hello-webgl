#version 300 es

precision highp float;

in vec4 fs_Nor;
out vec4 out_Col; 

void main() {
    // transforms fragment normal to a color
    out_Col = vec4((fs_Nor.xyz + 1.0) / 2.0, 1);
}
