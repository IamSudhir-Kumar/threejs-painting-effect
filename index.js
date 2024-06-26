import * as THREE from "three";
import { ImprovedNoise } from "jsm/math/ImprovedNoise.js";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { EffectComposer } from 'jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'jsm/postprocessing/UnrealBloomPass.js';
import GUI from 'lil-gui';

// Basic scene setup
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.dampingFactor = 0.05;
controls.enableDamping = true;

// Adding lights
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xff00ff, 2, 50);
pointLight1.position.set(5, 5, 5);
pointLight1.castShadow = true;
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x00ffff, 2, 50);
pointLight2.position.set(-5, -5, 5);
pointLight2.castShadow = true;
scene.add(pointLight2);

// Adding GUI controls
const gui = new GUI();
const params = {
    rotationSpeed: 0.01,
    squareColor: '#ffffff',
    emissiveColor: '#ff0000',
    resetCamera: () => {
        camera.position.set(0, 0, 8);
        controls.update();
    }
};

gui.add(params, 'rotationSpeed', 0, 0.1).name('Rotation Speed');
gui.addColor(params, 'squareColor').name('Square Color').onChange((value) => {
    squares.forEach(s => s.mesh.material.color.set(value));
});
gui.addColor(params, 'emissiveColor').name('Emissive Color').onChange((value) => {
    squares.forEach(s => s.mesh.material.emissive.set(value));
});
gui.add(params, 'resetCamera').name('Reset Camera');

// Create squares with added glow effect
const squaresGroup = new THREE.Object3D();
const squares = [];
const spacingX = 0.2;
const spacingY = 0.4;
const numCols = 50;
const numRows = 26;
const startX = -5;
const startY = -5;
let offsetY = 0;

const textureLoader = new THREE.TextureLoader();
const glowTexture = textureLoader.load('path/to/glowTexture.png');

for (let i = 0; i < numCols; i += 1) {
    for (let j = 0; j < numRows; j += 1) {
        offsetY = (i % 2) * -spacingX;
        let square = getSquare({
            x: startX + i * spacingX,
            y: offsetY + startY + j * spacingY,
        });
        squares.push(square);
        squaresGroup.add(square.mesh);
    }
}
scene.add(squaresGroup);

function getSquare(pos) {
    let { x, y } = pos;
    let z = 0;
    let targetColor = new THREE.Color(0, 0, 0);
    const emissive = new THREE.Color(params.emissiveColor);
    const highlightedColor = new THREE.Color(0xFF9900);
    let isHighlighted = false;
    const material = new THREE.MeshStandardMaterial({
        color: params.squareColor,
        flatShading: true,
        emissive,
        emissiveMap: glowTexture,
        emissiveIntensity: 0.5,
    });

    const sqLength = 0.2;
    const squareShape = new THREE.Shape()
        .moveTo(0, 0)
        .lineTo(0, sqLength)
        .lineTo(sqLength, sqLength)
        .lineTo(sqLength, 0)
        .lineTo(0, 0);
    const extrudeSettings = {
        depth: 0.2,
        bevelEnabled: true,
        bevelSegments: 12,
        steps: 1,
        bevelSize: 0.03,
        bevelThickness: 0.02,
    };
    const geometry = new THREE.ExtrudeGeometry(squareShape, extrudeSettings);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.z = 45 * (Math.PI / 180);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    let ns;
    const nFreq = 0.33;
    const nScale = 0.5;
    let lerpAlpha = 1.0;
    let emissiveIntensity = 0.0;
    function update(t) {
        ns = Noise.noise(mesh.position.x * nFreq, mesh.position.y * nFreq, t);
        mesh.position.z = ns * nScale;
        const distance = mesh.position.distanceTo(mousePos);
        if (distance < 0.5) {
            let hue = t - distance * 0.1;
            mesh.material.color.setHSL(hue, 1.0, 0.5);
            mesh.material.emissive.setHSL(hue, 1.0, 0.5);
            emissiveIntensity = 0.5;
        } else {
            emissiveIntensity -= 0.005;
        }
        mesh.material.emissiveIntensity = Math.max(0.0, emissiveIntensity);
        mesh.rotation.y += params.rotationSpeed; // Add rotation based on GUI control
    }
    function setFocused(isFocused) {
        isHighlighted = isFocused;
        targetColor.set(highlightedColor);
        material.emissive.set(targetColor);
        lerpAlpha = 0.0;
    }
    const box = { mesh, update, setFocused };
    mesh.userData.box = box;
    return box;
}

// Add background
const loader = new THREE.CubeTextureLoader();
const texture = loader.load([
    './images/px.png', './images/nx.png',
    './images/py.png', './images/ny.png',
    './images/pz.png', './images/nz.png'
]);
scene.background = texture;

// Plane for raycasting
const planeGeo = new THREE.PlaneGeometry(12, 12, 12, 12);
const planeMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.0,
    wireframe: true,
});
const drawingPlaneGroup = new THREE.Group();
scene.add(drawingPlaneGroup);
const planeObj = new THREE.Mesh(planeGeo, planeMat);
drawingPlaneGroup.add(planeObj);

// Raycasting and interaction
const raycaster = new THREE.Raycaster();
const mousePos = new THREE.Vector3(20, 20, 0);
const pointer = new THREE.Vector2();
document.addEventListener('mousemove', handlePointerMove);
document.addEventListener('click', handlePointerclick);
let currentIntersectedObject = null;

function handlePointerMove(evt) {
    pointer.set(
        (evt.clientX / window.innerWidth) * 2 - 1,
        -(evt.clientY / window.innerHeight) * 2 + 1
    );
}

function handlePointerclick(evt) {
    console.log(currentIntersectedObject);
}

function handleRaycast() {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(
        drawingPlaneGroup.children,
        false
    );
    if (intersects.length > 0) {
        mousePos.copy(intersects[0].point);
    }
}

const Noise = new ImprovedNoise();
const timeScale = 0.0005;

// Post-processing setup
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 2;
bloomPass.radius = 0;
composer.addPass(bloomPass);

function animate(timeStep) {
    requestAnimationFrame(animate);
    handleRaycast();
    squares.forEach(s => s.update(timeStep * timeScale));
    pointLight1.position.x = 5 * Math.sin(timeStep * 0.001);
    pointLight2.position.x = 5 * Math.cos(timeStep * 0.001);
   
    composer.render();
    controls.update();
    }
    
    animate();