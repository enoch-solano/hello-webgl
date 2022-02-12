import { vec3 } from 'gl-matrix';
import { vec4 } from 'gl-matrix';
import { mat4 } from 'gl-matrix';
const Stats = require('stats-js');
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import Square from './geometry/Square';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import { setGL } from './globals';
import ShaderProgram, { Shader } from './rendering/gl/ShaderProgram';

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
    tesselations: 5,
    'Load Scene': loadScene, // A function pointer, essentially
    red: 212,
    green: 100,
    blue: 100,
    'Surface Shader': 0,
    'Ticker Speed': 1,
    'x-Scale': 1.0,
    'y-Scale': 1.0,
    'z-Scale': 1.0,
};

let icosphere: Icosphere;
let square: Square;
let prevTesselations: number = 5;

let prevRed: number = 212;
let prevGreen: number = 100;
let prevBlue: number = 100;

let prevSurfaceShader: number = 0;

let currentShader: ShaderProgram;
let surfaceShaders: Array<ShaderProgram> = [];

let timeCounter: number = 0;

let scaleVec: vec3 = vec3.fromValues(1, 1, 1);
let scaleMat: mat4 = mat4.create();

function loadScene() {
    icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, controls.tesselations);
    icosphere.create();
    square = new Square(vec3.fromValues(0, 0, 0));
    square.create();
}

function initializeShaders(context: WebGL2RenderingContext) {
    const lambert = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/lambert-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/lambert-frag.glsl')),
    ]);

    const noisyColor = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/noisy-color-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/noisy-color-frag.glsl')),
    ]);

    const fbmNoisyColor = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/fbm-noisy-color-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/fbm-noisy-color-frag.glsl')),
    ]);

    const worleyoisyColor = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/worley-noisy-color-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/worley-noisy-color-frag.glsl')),
    ]);

    const vertexDeformator = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/vertex-deformator-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/vertex-deformator-frag.glsl')),
    ]);

    const twistDeformator = new ShaderProgram([
        new Shader(context.VERTEX_SHADER, require('./shaders/twist-deformator-vert.glsl')),
        new Shader(context.FRAGMENT_SHADER, require('./shaders/twist-deformator-frag.glsl')),
    ]);

    surfaceShaders.push(lambert);
    surfaceShaders.push(noisyColor);
    surfaceShaders.push(fbmNoisyColor);
    surfaceShaders.push(worleyoisyColor);
    surfaceShaders.push(vertexDeformator);
    surfaceShaders.push(twistDeformator);
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
    gui.add(controls, 'tesselations', 0, 8).step(1);
    gui.add(controls, 'Ticker Speed', 0, 5).step(1);
    gui.add(controls, 'Surface Shader', {'Lambert': 0, 
                                         'Noisy Color': 1,
                                         'FBM Noisy Color': 2,
                                         'Worley Noisy Color': 3,
                                         'Vertex Deformator': 4,
                                         'Twist Deformator': 5, });
    

    let colorModifiers = gui.addFolder("Modify Color");
    colorModifiers.add(controls, 'red', 0, 255).step(1);
    colorModifiers.add(controls, 'green', 0, 255).step(1);
    colorModifiers.add(controls, 'blue', 0, 255).step(1);

    let scaleModifiers = gui.addFolder("Scale Geometry");
    scaleModifiers.add(controls, 'x-Scale', 0, 3).step(0.05);
    scaleModifiers.add(controls, 'y-Scale', 0, 3).step(0.05);
    scaleModifiers.add(controls, 'z-Scale', 0, 3).step(0.05);

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
    initializeShaders(gl);

    currentShader = surfaceShaders[0];

    for (let surfaceShader of surfaceShaders) {
        surfaceShader.setGeometryColor(vec4.fromValues(prevRed / 255.0, prevGreen / 255.0 , prevBlue / 255.0, 1));
    }

    // This function will be called every frame
    function tick() {
        camera.update();
        stats.begin();
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.clear();

        // updates nunber of tesselations of icosphere
        if (controls.tesselations != prevTesselations) {
            prevTesselations = controls.tesselations;

            icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, prevTesselations);
            icosphere.create();
        }

        // updates the geometry color
        if (controls.red != prevRed || controls.green != prevGreen || controls.blue != prevBlue) {
            prevRed = controls.red;
            prevGreen = controls.green;
            prevBlue = controls.blue;

            for (let surfaceShader of surfaceShaders) {
                surfaceShader.setGeometryColor(vec4.fromValues(controls.red / 255.0, controls.green / 255.0, controls.blue / 255.0, 1.));
            }
        }

        // updates current shader
        if (controls['Surface Shader'] != prevSurfaceShader) {
            prevSurfaceShader = controls['Surface Shader'];

            currentShader = surfaceShaders[controls['Surface Shader']];
        }

        // updates the current time
        currentShader.setTime(timeCounter);
        timeCounter += controls['Ticker Speed'];

        // updates scale matrix
        scaleVec = vec3.fromValues(controls['x-Scale'], controls['y-Scale'], controls['z-Scale']);
        mat4.fromScaling(scaleMat, scaleVec);
        currentShader.setModelMatrix(scaleMat);

        renderer.render(camera, currentShader, [
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
