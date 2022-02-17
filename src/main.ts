import { vec2, vec3, vec4, mat4 } from 'gl-matrix';
const Stats = require('stats-js');
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import { setGL } from './globals';
import ShaderProgram, { Shader } from './rendering/gl/ShaderProgram';

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
    Tesselations: 6,
    'Load Scene': loadScene, // A function pointer, essentially
    red: 77,
    green: 142,
    blue: 187,
    'Vertex Shader': 0,
    'Fragment Shader': 0,
    'Vert Tick Speed': 1,
    'Frag Tick Speed': 1,
    'x-Scale': 1.0,
    'y-Scale': 1.0,
    'z-Scale': 1.0,
    'Octaves': 4,
    'Base Frequency': 2,
};

let icosphere: Icosphere;
let prevTesselations: number = 6;

let prevRed: number = 77;
let prevGreen: number = 142;
let prevBlue: number = 187;

let prevVertexShader: number = 0;
let prevFragmentShader: number = 0;

let vertexShaders: Array<Shader> = [];
let fragmentShaders: Array<Shader> = [];

let currentShaderProgram: ShaderProgram;

let vertTimeCounter: number = 0;
let fragTimeCounter: number = 0;

let scaleVec: vec3 = vec3.fromValues(1, 1, 1);
let scaleMat: mat4 = mat4.create();

let fractalParams: vec2 = vec2.create();

function loadScene() {
    icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, controls.Tesselations);
    icosphere.create();
}

function initializeVertexShaders(context: WebGL2RenderingContext) {
    const noop = new Shader(context.VERTEX_SHADER, require('./shaders/lambert-vert.glsl'));
    const vertexDeformator = new Shader(context.VERTEX_SHADER, require('./shaders/vertex-deformator-vert.glsl'));
    const twistDeformator = new Shader(context.VERTEX_SHADER, require('./shaders/twist-deformator-vert.glsl'));
    const planetShader = new Shader(context.VERTEX_SHADER, require('./shaders/planet-vert.glsl'));

    vertexShaders.push(noop);
    vertexShaders.push(vertexDeformator);
    vertexShaders.push(twistDeformator);
    vertexShaders.push(planetShader);
}

function initializeFragmentShaders(context: WebGL2RenderingContext) {
    const lambert = new Shader(context.FRAGMENT_SHADER, require('./shaders/lambert-frag.glsl'));
    const normal = new Shader(context.FRAGMENT_SHADER, require('./shaders/normal-viewer-frag.glsl'));
    const fbmNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/fbm-noisy-color-frag.glsl'));
    const perlinNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/perlin-noisy-color-frag.glsl'));
    const worleyNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/worley-noisy-color-frag.glsl'));

    fragmentShaders.push(lambert);
    fragmentShaders.push(normal);
    fragmentShaders.push(fbmNoisyColor);
    fragmentShaders.push(perlinNoisyColor);
    fragmentShaders.push(worleyNoisyColor);
}

function main() {
    // Initial display for framerate
    const stats = Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    // Add controls to the gui
    const gui = new DAT.GUI();
    gui.add(controls, 'Load Scene');
    gui.add(controls, 'Vertex Shader', 
                        { 'NoOp': 0, 
                          'Vertex Deformator': 1,
                          'Twist Deformator': 2,
                          'Planet': 3, });

    gui.add(controls, 'Fragment Shader', 
                        { 'Lambert': 0, 
                          'Normals': 1, 
                          'Fractal Brownian Motion': 2,
                          'Fractal Perlin Noise': 3,
                          'Fractal Worley Noise': 4, });
                      
    gui.add(controls, 'Tesselations', 0, 8).step(1);
    gui.add(controls, 'Vert Tick Speed', 0, 5).step(1);
    gui.add(controls, 'Frag Tick Speed', 0, 5).step(1);


    let colorModifiers = gui.addFolder("Modify Color");
    colorModifiers.add(controls, 'red', 0, 255).step(1);
    colorModifiers.add(controls, 'green', 0, 255).step(1);
    colorModifiers.add(controls, 'blue', 0, 255).step(1);

    let scaleModifiers = gui.addFolder("Scale Geometry");
    scaleModifiers.add(controls, 'x-Scale', 0, 3).step(0.1);
    scaleModifiers.add(controls, 'y-Scale', 0, 3).step(0.1);
    scaleModifiers.add(controls, 'z-Scale', 0, 3).step(0.1);

    let fractalNoiseModifiers = gui.addFolder("Modify Fractal Noise");
    fractalNoiseModifiers.add(controls, 'Octaves', 1, 8).step(1);
    fractalNoiseModifiers.add(controls, 'Base Frequency', 0, 3).step(1);

    // increase width of gui
    gui.width += 25;

    // get canvas and webgl context
    const canvas = <HTMLCanvasElement>document.getElementById('canvas');
    const gl = <WebGL2RenderingContext>canvas.getContext('webgl2');
    if (!gl) {
        alert('WebGL 2 not supported!');
    }

    // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
    // Later, we can import `gl` from `globals.ts` to access it
    setGL(gl);

    // Initial call to load scene
    loadScene();

    const camera = new Camera(vec3.fromValues(0, 0, 5), vec3.fromValues(0, 0, 0));

    const renderer = new OpenGLRenderer(canvas);
    renderer.setClearColor(0.2, 0.2, 0.2, 1);
    gl.enable(gl.DEPTH_TEST);

    // set up shaders
    initializeVertexShaders(gl);
    initializeFragmentShaders(gl);

    currentShaderProgram = new ShaderProgram([vertexShaders[prevVertexShader], fragmentShaders[prevFragmentShader]]);
    currentShaderProgram.setGeometryColor(vec4.fromValues(prevRed / 255.0, prevGreen / 255.0 , prevBlue / 255.0, 1));


    // This function will be called every frame
    function tick() {
        camera.update();
        stats.begin();
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.clear();

        // updates nunber of tesselations of icosphere
        if (controls.Tesselations != prevTesselations) {
            prevTesselations = controls.Tesselations;

            icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, prevTesselations);
            icosphere.create();
        }
        

        // updates current shader
        if (controls['Vertex Shader'] != prevVertexShader || controls['Fragment Shader'] != prevFragmentShader) {
            prevVertexShader = controls['Vertex Shader'];
            prevFragmentShader = controls['Fragment Shader'];

            currentShaderProgram = new ShaderProgram([vertexShaders[prevVertexShader], fragmentShaders[prevFragmentShader]]);
            currentShaderProgram.setGeometryColor(vec4.fromValues(controls.red / 255.0, controls.green / 255.0, controls.blue / 255.0, 1.));
        }

        // updates the geometry color
        if (controls.red != prevRed || controls.green != prevGreen || controls.blue != prevBlue) {
            prevRed = controls.red;
            prevGreen = controls.green;
            prevBlue = controls.blue;

            currentShaderProgram.setGeometryColor(vec4.fromValues(controls.red / 255.0, controls.green / 255.0, controls.blue / 255.0, 1.));
        }

        // updates the current time
        currentShaderProgram.setVertTime(vertTimeCounter);
        currentShaderProgram.setFragTime(fragTimeCounter);

        vertTimeCounter += controls['Vert Tick Speed'];
        fragTimeCounter += controls['Frag Tick Speed'];

        // updates scale matrix
        scaleVec = vec3.fromValues(controls['x-Scale'], controls['y-Scale'], controls['z-Scale']);
        mat4.fromScaling(scaleMat, scaleVec);
        currentShaderProgram.setModelMatrix(scaleMat);

        // updates number of octaves
        currentShaderProgram.setOctaves(controls.Octaves);

        // update fractal parameters
        fractalParams = vec2.fromValues(Math.pow(2, controls['Base Frequency']), 0.5);
        currentShaderProgram.setFractal(fractalParams);

        renderer.render(camera, currentShaderProgram, [
            icosphere,
            // square,
        ]);
        stats.end();

        // Tell the browser to call `tick` again whenever it renders a new frame
        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.setAspectRatio(window.innerWidth / window.innerHeight);
        camera.updateProjectionMatrix();
    }, false);

    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();

    // Start the render loop
    tick();
}

main();
