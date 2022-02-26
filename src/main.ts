import { vec2, vec3, vec4, mat4 } from 'gl-matrix';
const Stats = require('stats-js');
import * as DAT from 'dat.gui';
import Icosphere from './geometry/Icosphere';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Camera from './Camera';
import { setGL } from './globals';
import ShaderProgram, { Shader } from './rendering/gl/ShaderProgram';

let planetShaderSelected: boolean = true;
let planetModsFolderAdded: boolean = false;
let planetModsFolder: DAT.GUI = null;

let planetOctaveAmps: DAT.GUI = null;

let noiseFragShaderSelected: boolean = false;
let noiseModsFolderAdded: boolean = false;
let noiseModsFolder: DAT.GUI = null;

let colorableShaderSelected: boolean = false;
let colorModsFolderAdded: boolean = false;
let colorModsFolder: DAT.GUI = null;

const BLINN_PHONG_SHADER = 1;
const NORMALS_SHADER = 2;
const FBM_SHADER = 3;
const FRACT_PERL_SHADER = 4;
const FRACT_WORL_SHADER = 5;

const NOISE_VIZ_VERT = 5;
const NOISE_VIZ_FRAG = 6;

const PLANET_VERT_SHADER = 6;
const PLANET_FRAG_SHADER = 7;


// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
const controls = {
    Tesselations: 7,

    'Load Scene': loadScene, // A function pointer, essentially

    // base color of geometry //
    red: 77,
    green: 142,
    blue: 187,

    // current shader selected //
    'Vertex Shader': PLANET_VERT_SHADER,
    'Fragment Shader': PLANET_FRAG_SHADER,

    // speed of tickers //
    'Vert Tick Speed': 1,
    'Frag Tick Speed': 1,

    // scale modifiers // 
    'x-Scale': 1.0,
    'y-Scale': 1.0,
    'z-Scale': 1.0,

    // frag shader noise modifiers //
    'Octaves': 4,
    'Base Frequency': 2,

    // elevation controls //
    'Elevation Octaves': 6,
    'Elevation Base Freq': 2,
    'Elevation Scale': 0.35,
    'Exponent': 0.5,
    'Terraces': 12,

    // elevation octave amplitudes //
    'Octave 1': 1.0,
    'Octave 2': 0.5,
    'Octave 3': 0.25,
    'Octave 4': 0.13,
    'Octave 5': 0.06,
    'Octave 6': 0.03,
};

let icosphere: Icosphere;
let prevTesselations: number = controls.Tesselations;

let prevRed: number = controls.red;
let prevGreen: number = controls.green;
let prevBlue: number = controls.blue;

let prevVertexShader: number = controls['Vertex Shader'];
let prevFragmentShader: number = controls['Fragment Shader'];

let prevElevationOctaves: number = controls['Elevation Octaves'];

let vertexShaders: Array<Shader> = [];
let fragmentShaders: Array<Shader> = [];

let currentShaderProgram: ShaderProgram;
let moonShaderProgram: ShaderProgram;

let moonVertShader: Shader;

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
    const bumpMap = new Shader(context.VERTEX_SHADER, require('./shaders/bump-map-vert.glsl'));
    const crinkledBumpMap = new Shader(context.VERTEX_SHADER, require('./shaders/crinkled-bump-map-vert.glsl'));
    const noiseVisualizer = new Shader(context.VERTEX_SHADER, require('./shaders/noise-visualizer-vert.glsl'));
    const planetVertShader = new Shader(context.VERTEX_SHADER, require('./shaders/planet-terrain-vert.glsl'));

    vertexShaders.push(noop);
    vertexShaders.push(vertexDeformator);
    vertexShaders.push(twistDeformator);
    vertexShaders.push(bumpMap);
    vertexShaders.push(crinkledBumpMap);
    vertexShaders.push(noiseVisualizer);
    vertexShaders.push(planetVertShader);
}

function initializeFragmentShaders(context: WebGL2RenderingContext) {
    const lambert = new Shader(context.FRAGMENT_SHADER, require('./shaders/lambert-frag.glsl'));
    const blinnPhong = new Shader(context.FRAGMENT_SHADER, require('./shaders/blinn-phong-frag.glsl'));
    const normal = new Shader(context.FRAGMENT_SHADER, require('./shaders/normal-viewer-frag.glsl'));
    const fbmNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/fbm-noisy-color-frag.glsl'));
    const perlinNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/perlin-noisy-color-frag.glsl'));
    const worleyNoisyColor = new Shader(context.FRAGMENT_SHADER, require('./shaders/worley-noisy-color-frag.glsl'));
    const noiseVisualizer = new Shader(context.FRAGMENT_SHADER, require('./shaders/noise-visualizer-frag.glsl'));
    const planetFragShader = new Shader(context.FRAGMENT_SHADER, require('./shaders/planet-terrain-frag.glsl'));

    fragmentShaders.push(lambert);
    fragmentShaders.push(blinnPhong);
    fragmentShaders.push(normal);
    fragmentShaders.push(fbmNoisyColor);
    fragmentShaders.push(perlinNoisyColor);
    fragmentShaders.push(worleyNoisyColor);
    fragmentShaders.push(noiseVisualizer);
    fragmentShaders.push(planetFragShader);
}

function initializeGUI(gui: DAT.GUI) {
    gui.add(controls, 'Load Scene');
    gui.add(controls, 'Vertex Shader', 
                        { 'NoOp': 0, 
                          'Vertex Deformator': 1,
                          'Twist Deformator': 2,
                          'Bump Map': 3,
                          'Crinkled Bump Map': 4,
                          'Noise Visualizer': NOISE_VIZ_VERT,
                          'Planet': PLANET_VERT_SHADER, });

    gui.add(controls, 'Fragment Shader', 
                        { 'Lambert': 0, 
                          'Blinn Phong': BLINN_PHONG_SHADER, 
                          'Normals': NORMALS_SHADER, 
                          'Fractal Brownian Motion': FBM_SHADER,
                          'Fractal Perlin Noise': FRACT_PERL_SHADER,
                          'Fractal Worley Noise': FRACT_WORL_SHADER,
                          'Noise Visualizer': NOISE_VIZ_FRAG,
                          'Planet': PLANET_FRAG_SHADER, });
                      
    gui.add(controls, 'Tesselations', 0, 8).step(1);
    gui.add(controls, 'Vert Tick Speed', 0, 5).step(1);
    gui.add(controls, 'Frag Tick Speed', 0, 5).step(1);

    let scaleModifiers = gui.addFolder("Scale Geometry");
    scaleModifiers.add(controls, 'x-Scale', 0, 3).step(0.1);
    scaleModifiers.add(controls, 'y-Scale', 0, 3).step(0.1);
    scaleModifiers.add(controls, 'z-Scale', 0, 3).step(0.1);

    // increase width of gui
    gui.width += 25;
}

/****************** helper functions to add folders ******************/

function addElevationOctavesAmps(gui: DAT.GUI, numOctaves: number) {
    planetOctaveAmps = gui.addFolder('Octave Amplitudes');

    for (let i = 1; i <= numOctaves; i++) {
        planetOctaveAmps.add(controls, `Octave ${i}`, 0, 1).step(0.01);
    }
}

function addPlanetMods(gui: DAT.GUI) {
    planetModsFolder = gui.addFolder("Modify Planet");
    planetModsFolder.add(controls, 'Elevation Octaves', 1, 6).step(1);
    planetModsFolder.add(controls, 'Elevation Base Freq', 0, 4).step(0.01);
    planetModsFolder.add(controls, 'Elevation Scale', 0, 2).step(0.01);
    planetModsFolder.add(controls, 'Exponent', 0.5, 15).step(0.01);
    planetModsFolder.add(controls, 'Terraces', 1, 32).step(1);

    addElevationOctavesAmps(planetModsFolder, controls['Elevation Octaves']);

    gui.width += 35;
    gui.updateDisplay();

    planetModsFolderAdded = true;
}

function addNoiseMods(gui: DAT.GUI) {
    noiseModsFolder = gui.addFolder("Modify Fractal Noise");
    noiseModsFolder.add(controls, 'Octaves', 1, 8).step(1);
    noiseModsFolder.add(controls, 'Base Frequency', 0, 3).step(1);

    gui.updateDisplay();

    noiseModsFolderAdded = true;
}

function addColorMods(gui: DAT.GUI) {
    colorModsFolder = gui.addFolder("Modify Color");
    colorModsFolder.add(controls, 'red',   0, 255).step(1);
    colorModsFolder.add(controls, 'green', 0, 255).step(1);
    colorModsFolder.add(controls, 'blue',  0, 255).step(1);

    gui.updateDisplay();

    colorModsFolderAdded = true;
}

/****************** helper functions to remove folders ******************/

function removeFolder(folder: DAT.GUI, subFolder: DAT.GUI) {
    folder.removeFolder(subFolder);
    folder.updateDisplay();

    return false;
}

function removePlanetMods(gui: DAT.GUI) {
    gui.width -= 35;
    planetModsFolderAdded = removeFolder(gui, planetModsFolder);
}

function removeNoiseMods(gui: DAT.GUI) {
    noiseModsFolderAdded = removeFolder(gui, noiseModsFolder);
}

function removeColorMods(gui: DAT.GUI) {
    colorModsFolderAdded = removeFolder(gui, colorModsFolder);
}

/****************** helper functions to check shader type ******************/

function vertShaderIsPlanet(vertShader: number) {
    return vertShader == PLANET_VERT_SHADER;
}

function fragShaderIsPlanet(fragShader: number) {
    return fragShader == PLANET_FRAG_SHADER;
}

function shaderIsPlanet(vertShader: number, fragShader: number) {
    return vertShaderIsPlanet(vertShader) || fragShaderIsPlanet(fragShader);
}

function fragShaderIsFractal(shader: number) {
    return shader == FBM_SHADER || shader == FRACT_PERL_SHADER || shader == FRACT_WORL_SHADER;
}

function shaderIsColorable(shader: number) {
    return shader != NORMALS_SHADER && shader != NOISE_VIZ_FRAG && shader != PLANET_FRAG_SHADER;
}

/***************************************************************************/

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
    initializeGUI(gui);
    
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

    const camera = new Camera(vec3.fromValues(0, 0, 7.5), vec3.fromValues(0, 0, 0));
    const renderer = new OpenGLRenderer(canvas);
    renderer.setClearColor(0.2, 0.2, 0.2, 1);
    gl.enable(gl.DEPTH_TEST);

    // set up shaders
    initializeVertexShaders(gl);
    initializeFragmentShaders(gl);

    currentShaderProgram = new ShaderProgram([vertexShaders[controls['Vertex Shader']], fragmentShaders[controls['Fragment Shader']]]);
    currentShaderProgram.setGeometryColorRGB(prevRed, prevBlue, prevGreen);

    // create shader to draw the moon with
    moonVertShader = new Shader(gl.VERTEX_SHADER, require('./shaders/moon-vert.glsl'));
    moonShaderProgram = new ShaderProgram([moonVertShader, fragmentShaders[BLINN_PHONG_SHADER]]);
    moonShaderProgram.setGeometryColorRGB(151, 158, 184);

    // This function will be called every frame
    function tick() {
        camera.update();
        stats.begin();
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.clear();
        gui.updateDisplay();

        // updates nunber of tesselations of icosphere
        if (controls.Tesselations != prevTesselations) {
            prevTesselations = controls.Tesselations;

            icosphere = new Icosphere(vec3.fromValues(0, 0, 0), 1, prevTesselations);
            icosphere.create();
        }

        if (prevElevationOctaves != controls['Elevation Octaves']) {
            prevElevationOctaves = controls['Elevation Octaves'];

            let folderWasClosed = planetOctaveAmps.closed;

            removeFolder(planetModsFolder, planetOctaveAmps);
            addElevationOctavesAmps(planetModsFolder, controls['Elevation Octaves']);

            if (!folderWasClosed) {
                planetOctaveAmps.open();
            }
        }
        
        // handles vertex shader update
        if (controls['Vertex Shader'] != prevVertexShader) {
            planetShaderSelected = vertShaderIsPlanet(controls['Vertex Shader']);

            if (planetShaderSelected) {
                // update fragment shader IF it's not already a planet shader
                if (!fragShaderIsPlanet(controls['Fragment Shader'])) {
                    controls['Fragment Shader'] = PLANET_FRAG_SHADER;
                    prevFragmentShader = controls['Fragment Shader'];
                }
            } else if (fragShaderIsPlanet(controls['Fragment Shader'])) {
                controls['Fragment Shader'] = controls['Vertex Shader'] == NOISE_VIZ_VERT ? NOISE_VIZ_FRAG : 0;
                prevFragmentShader = controls['Fragment Shader'];
            } else if (controls['Vertex Shader'] == NOISE_VIZ_VERT || prevVertexShader == NOISE_VIZ_VERT) {
                controls['Fragment Shader'] = controls['Vertex Shader'] == NOISE_VIZ_VERT ? NOISE_VIZ_FRAG : 0;
                prevFragmentShader = controls['Fragment Shader'];
            }

            gui.updateDisplay();
        }

        // handles fragment shader update
        if (controls['Fragment Shader'] != prevFragmentShader) {
            planetShaderSelected = fragShaderIsPlanet(controls['Fragment Shader']);

            if (planetShaderSelected) {
                // update vertex shader IF it's not already a planet shader
                if (!vertShaderIsPlanet(controls['Vertex Shader'])) {
                    controls['Vertex Shader'] = PLANET_VERT_SHADER;
                    prevVertexShader = controls['Vertex Shader'];
                }
            } else if (vertShaderIsPlanet(controls['Vertex Shader'])) {
                // attempting to change the planet fragment shader, while
                // the vertex shader is planet
                controls['Fragment Shader'] = prevFragmentShader;
                planetShaderSelected = true;
            } else if (controls['Fragment Shader'] == NOISE_VIZ_FRAG || prevFragmentShader == NOISE_VIZ_FRAG) {
                controls['Vertex Shader'] = controls['Fragment Shader'] == NOISE_VIZ_FRAG ? NOISE_VIZ_VERT : 0;
                prevVertexShader = controls['Vertex Shader'];
            }

            gui.updateDisplay();
        }

        // handles shader program update
        if (controls['Vertex Shader'] != prevVertexShader || controls['Fragment Shader'] != prevFragmentShader) {
            prevVertexShader = controls['Vertex Shader'];
            prevFragmentShader = controls['Fragment Shader'];

            currentShaderProgram = new ShaderProgram([vertexShaders[prevVertexShader], fragmentShaders[prevFragmentShader]]);
            currentShaderProgram.setGeometryColorRGB(controls.red, controls.green, controls.blue);

            noiseFragShaderSelected = fragShaderIsFractal(controls['Fragment Shader']);
            colorableShaderSelected = shaderIsColorable(controls['Fragment Shader']);
        }

        // logic to add planets modifiers to GUI
        if (planetShaderSelected && !planetModsFolderAdded) {
            addPlanetMods(gui);
        } else if (!planetShaderSelected && planetModsFolderAdded) {
            removePlanetMods(gui);
        }

        // logic to add colors modifiers to GUI
        if (colorableShaderSelected && !colorModsFolderAdded) {
            addColorMods(gui);
        } else if (!colorableShaderSelected && colorModsFolderAdded) {
            removeColorMods(gui);
        }

        // logic to add fractal noise modifiers to GUI
        if (noiseFragShaderSelected && !noiseModsFolderAdded) {
            addNoiseMods(gui);
        } else if (!noiseFragShaderSelected && noiseModsFolderAdded) {
            removeNoiseMods(gui);
        }

        // updates the geometry color
        if (controls.red != prevRed || controls.green != prevGreen || controls.blue != prevBlue) {
            prevRed = controls.red;
            prevGreen = controls.green;
            prevBlue = controls.blue;

            currentShaderProgram.setGeometryColorRGB(controls.red, controls.green, controls.blue);
        }

        // updates the current time
        currentShaderProgram.setTimes(vertTimeCounter, fragTimeCounter);
        moonShaderProgram.setTimes(vertTimeCounter, fragTimeCounter);

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
            icosphere
        ]);

        // set up shader for the moon
        if (planetShaderSelected) {
            scaleVec = vec3.fromValues(0.45, 0.45, 0.45);
            mat4.fromScaling(scaleMat, scaleVec);
            moonShaderProgram.setModelMatrix(scaleMat);

            renderer.render(camera, moonShaderProgram, [
                icosphere
            ]);

        }
        
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
