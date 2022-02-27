import { vec2, vec3, vec4, mat4 } from 'gl-matrix';
import Drawable from './Drawable';
import { gl } from '../../globals';

var activeProgram: WebGLProgram = null;

export class Shader {
    shader: WebGLShader;

    constructor(type: number, source: string) {
        this.shader = gl.createShader(type);
        gl.shaderSource(this.shader, source);
        gl.compileShader(this.shader);

        if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(this.shader);
        }
    }
};

class ShaderProgram {
    prog: WebGLProgram;

    attrPos: number;
    attrNor: number;
    attrCol: number;

    unifModel: WebGLUniformLocation;
    unifModelInvTr: WebGLUniformLocation;
    unifViewProj: WebGLUniformLocation;
    unifColor: WebGLUniformLocation;
    unifTime: WebGLUniformLocation;
    unifVertTime: WebGLUniformLocation;
    unifFragTime: WebGLUniformLocation;
    unifWarp: WebGLUniformLocation;
    unifOctaves: WebGLUniformLocation;
    unifFractal: WebGLUniformLocation;
    unifCamPos: WebGLUniformLocation;
    unifElevParams: WebGLUniformLocation;
    unifOctaveAmps: WebGLUniformLocation;

    constructor(shaders: Array<Shader>) {
        this.prog = gl.createProgram();

        for (let shader of shaders) {
            gl.attachShader(this.prog, shader.shader);
        }

        gl.linkProgram(this.prog);
        if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
            throw gl.getProgramInfoLog(this.prog);
        }

        this.attrPos = gl.getAttribLocation(this.prog, "vs_Pos");
        this.attrNor = gl.getAttribLocation(this.prog, "vs_Nor");
        this.attrCol = gl.getAttribLocation(this.prog, "vs_Col");

        this.unifModel = gl.getUniformLocation(this.prog, "u_Model");
        this.unifModelInvTr = gl.getUniformLocation(this.prog, "u_ModelInvTr");
        this.unifViewProj = gl.getUniformLocation(this.prog, "u_ViewProj");
        this.unifColor = gl.getUniformLocation(this.prog, "u_Color");
        this.unifTime = gl.getUniformLocation(this.prog, "u_Time");
        this.unifVertTime = gl.getUniformLocation(this.prog, "u_VertTime");
        this.unifFragTime = gl.getUniformLocation(this.prog, "u_FragTime");
        this.unifWarp = gl.getUniformLocation(this.prog, "u_Warp");
        this.unifOctaves = gl.getUniformLocation(this.prog, "u_Octaves");
        this.unifFractal = gl.getUniformLocation(this.prog, "u_Fractal");
        this.unifCamPos =  gl.getUniformLocation(this.prog, "u_CamPos");
        this.unifElevParams = gl.getUniformLocation(this.prog, "u_ElevationParams");
        this.unifOctaveAmps = gl.getUniformLocation(this.prog, "u_OctaveAmps");
    }

    use() {
        if (activeProgram !== this.prog) {
            gl.useProgram(this.prog);
            activeProgram = this.prog;
        }
    }

    setModelMatrix(model: mat4) {
        this.use();

        if (this.unifModel !== -1) {
            gl.uniformMatrix4fv(this.unifModel, false, model);
        }

        if (this.unifModelInvTr !== -1) {
            let modelinvtr: mat4 = mat4.create();
            mat4.transpose(modelinvtr, model);
            mat4.invert(modelinvtr, modelinvtr);
            gl.uniformMatrix4fv(this.unifModelInvTr, false, modelinvtr);
        }
    }

    setViewProjMatrix(vp: mat4) {
        this.use();

        if (this.unifViewProj !== -1) {
            gl.uniformMatrix4fv(this.unifViewProj, false, vp);
        }
    }

    setGeometryColor(color: vec4) {
        this.use();

        if (this.unifColor !== -1) {
            gl.uniform4fv(this.unifColor, color);
        }
    }

    setGeometryColorRGB(red: number, green: number, blue: number) {
        this.setGeometryColor(vec4.fromValues(red / 255.0, green / 255.0, blue / 255.0, 1.));
    }

    setTime(time: number) {
        this.use();

        if (this.unifTime !== -1) {
            gl.uniform1i(this.unifTime, time);
        }
    }

    setVertTime(time: number) {
        this.use();

        if (this.unifVertTime !== -1) {
            gl.uniform1i(this.unifVertTime, time);
        }
    }

    setFragTime(time: number) {
        this.use();

        if (this.unifFragTime !== -1) {
            gl.uniform1i(this.unifFragTime, time);
        }
    }

    setTimes(vertTime: number, fragTime: number) { 
        this.setVertTime(vertTime);
        this.setFragTime(fragTime);
    }

    setWarp(warp: vec2) {
        this.use();

        if (this.unifWarp !== -1) {
            gl.uniform2fv(this.unifWarp, warp);
        }
    }

    setOctaves(octaves: number) {
        this.use();

        if (this.unifOctaves !== -1) {
            gl.uniform1i(this.unifOctaves, octaves);
        }
    }

    setFractal(fractal: vec2) {
        this.use();

        if (this.unifFractal !== -1) {
            gl.uniform2fv(this.unifFractal, fractal);
        }
    }

    setCamPos(pos: vec3) {
        this.use();

        if (this.unifCamPos !== -1) {
            gl.uniform3fv(this.unifCamPos, pos);
        }
    }

    setElevationParams(params: number[]) {
        this.use();

        if (this.unifElevParams !== -1) {
            gl.uniform1fv(this.unifElevParams, params, 0, params.length);
        }
    }

    setOctaveAmps(amps: number[]) {
        this.use();

        if (this.unifOctaveAmps !== -1) {
            gl.uniform1fv(this.unifOctaveAmps, amps, 0, amps.length);
        }
    }

    draw(d: Drawable) {
        this.use();

        if (this.attrPos != -1 && d.bindPos()) {
            gl.enableVertexAttribArray(this.attrPos);
            gl.vertexAttribPointer(this.attrPos, 4, gl.FLOAT, false, 0, 0);
        }

        if (this.attrNor != -1 && d.bindNor()) {
            gl.enableVertexAttribArray(this.attrNor);
            gl.vertexAttribPointer(this.attrNor, 4, gl.FLOAT, false, 0, 0);
        }

        d.bindIdx();
        gl.drawElements(d.drawMode(), d.elemCount(), gl.UNSIGNED_INT, 0);

        if (this.attrPos != -1) gl.disableVertexAttribArray(this.attrPos);
        if (this.attrNor != -1) gl.disableVertexAttribArray(this.attrNor);
    }
};

export default ShaderProgram;
