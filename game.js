
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// ===================================
// 1. GAME CONFIGURATION
// ===================================

const container = document.getElementById('game-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 35, 130);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
);

camera.position.set(0, 9, 15);
camera.lookAt(0, 0, -18);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

// ===================================
// 2. LIGHTING
// ===================================

const ambient = new THREE.HemisphereLight(
    0xffffff,
    0x526044,
    2
);

scene.add(ambient);

const sunlight = new THREE.DirectionalLight(
    0xffffff,
    2.5
);

sunlight.position.set(-10, 20, 10);
sunlight.castShadow = true;
scene.add(sunlight);

// ===================================
// 3. ROAD
// ===================================

const road = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.2, 120),
    new THREE.MeshStandardMaterial({
        color: 0x292d33,
        roughness: 0.9
    })
);

road.position.set(0, -0.15, -35);
road.receiveShadow = true;
scene.add(road);

// Grass on both sides
const grass = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.2, 130),
    new THREE.MeshStandardMaterial({
        color: 0x388344
    })
);

grass.position.set(0, -0.3, -35);
scene.add(grass);

// White road borders
for (const x of [-5.3, 5.3]) {
    const border = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.12, 120),
        new THREE.MeshStandardMaterial({
            color: 0xffffff
        })
    );

    border.position.set(x, 0, -35);
    scene.add(border);
}

// Moving lane markings
const roadLines = [];

for (const x of [-1.7, 1.7]) {
    for (let i = 0; i < 12; i++) {
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.04, 4),
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            })
        );

        line.position.set(x, 0, -85 + i * 9);
        scene.add(line);
        roadLines.push(line);
    }
}

// ===================================
// 4. CREATE PLAYER CAR
// ===================================

function createCar(color) {

    const car = new THREE.Group();

    const paint = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.35,
        roughness: 0.35
    });

    const black = new THREE.MeshStandardMaterial({
        color: 0x151515
    });

    // Main car body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.55, 2.8),
        paint
    );

    body.position.y = 0.65;
    body.castShadow = true;
    car.add(body);

    // Roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.65, 1.4),
        new THREE.MeshStandardMaterial({
            color: 0x263d52,
            metalness: 0.2,
            roughness: 0.25
        })
    );

    roof.position.set(0, 1.15, -0.15);
    roof.castShadow = true;
    car.add(roof);

    // Wheels
    for (const x of [-0.85, 0.85]) {
        for (const z of [-0.85, 0.85]) {

            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(
                    0.34, 0.34, 0.2, 16
                ),
                black
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.35, z);
            car.add(wheel);
        }
    }

    // Front lights
    for (const x of [-0.5, 0.5]) {
        const light = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.16, 0.08),
            new THREE.MeshBasicMaterial({
                color: 0xffffcc
            })
        );

        light.position.set(x, 0.7, -1.43);
        car.add(light);
    }

    return car;
}

const player = createCar(0xff3030);
player.position.set(0, 0, 5);
scene.add(player);

// ===================================
// 5. GAME VARIABLES
// ===================================

const lanes = [-3.3, 0, 3.3];

let currentLane = 1;
let targetX = 0;

let running = false;
let gameOver = false;

let score = 0;
let coins = 0;
let totalCoins = 0;
let level = 1;

let speed = 22;
let obstacleTimer = 0;
let coinTimer = 0;

const maxLevel = 5;

const levelTargets = [
    0,
    300,
    700,
    1200,
    1800,
    2500
];

const objects = [];

// ===================================
// 6. SOUND EFFECTS
// ===================================

let audioContext;

function sound(frequency, duration = 0.12, type = 'sine') {

    try {
        if (!audioContext) {
            audioContext = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(
            0.12,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(
            audioContext.currentTime + duration
        );

    } catch (error) {
        console.log('Sound unavailable:', error);
    }
}

// ===================================
// 7. SPAWN TRAFFIC
// ===================================

function spawnObstacle() {

    const lane = Math.floor(Math.random() * 3);

    const colors = [
        0x2878ff,
        0xffa500,
        0xeeeeee,
        0x9b59b6,
        0x222222
    ];

    const enemy = createCar(
        colors[Math.floor(Math.random() * colors.length)]
    );

    enemy.position.set(
        lanes[lane],
        0,
        -90
    );

    scene.add(enemy);

    objects.push({
        mesh: enemy,
        type: 'obstacle',
        lane: lane
    });
}

// ===================================
// 8. SPAWN COINS
// ===================================

function spawnCoins() {

    const lane = Math.floor(Math.random() * 3);

    for (let i = 0; i < 5; i++) {

        const coin = new THREE.Mesh(
            new THREE.TorusGeometry(0.38, 0.12, 8, 18),
            new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x664400
            })
        );

        coin.position.set(
            lanes[lane],
            1,
            -75 - i * 3
        );

        coin.castShadow = true;

        scene.add(coin);

        objects.push({
            mesh: coin,
            type: 'coin',
            lane: lane
        });
    }
}

// ===================================
// 9. CHANGE LANES
// ===================================

function moveLeft() {

    if (!running) return;

    if (currentLane > 0) {
        currentLane--;
        targetX = lanes[currentLane];
        sound(350);
    }
}

function moveRight() {

    if (!running) return;

    if (currentLane < 2) {
        currentLane++;
        targetX = lanes[currentLane];
        sound(450);
    }
}

window.addEventListener('keydown', (event) => {

    if (
        ['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)
    ) {
        event.preventDefault();
    }

    if (
        event.code === 'ArrowLeft' ||
        event.code === 'KeyA'
    ) {
        moveLeft();
    }

    if (
        event.code === 'ArrowRight' ||
        event.code === 'KeyD'
    ) {
        moveRight();
    }
});

document.getElementById('left-btn')
    .addEventListener('click', moveLeft);

document.getElementById('right-btn')
    .addEventListener('click', moveRight);

// ===================================
// 10. LEADERBOARD
// ===================================

function getLeaderboard() {

    try {
        return JSON.parse(
            localStorage.getItem('highwayLeaderboard') || '[]'
        );
    } catch {
        return [];
    }
}

function saveLeaderboard() {

    const board = getLeaderboard();

    if (score <= 0) return;

    const name = prompt(
        'Enter your player name:',
        'Player'
    );

    board.push({
        name: (name || 'Player').slice(0, 16),
        score: Math.floor(score),
        coins: coins
    });

    board.sort((a, b) => b.score - a.score);

    localStorage.setItem(
        'highwayLeaderboard',
        JSON.stringify(board.slice(0, 10))
    );
}

function displayLeaderboard() {

    const list = document.getElementById(
        'leaderboard-list'
    );

    list.innerHTML = '';

    const board = getLeaderboard();

    if (board.length === 0) {
        list.innerHTML = '<li>No scores yet. Play first!</li>';
    }

    board.forEach((entry) => {

        const item = document.createElement('li');

        item.textContent =
            `${entry.name} — ${entry.score} points — ${entry.coins} coins`;

        list.appendChild(item);
    });
}

// ===================================
// 11. GAME OVER
// ===================================

function endGame() {

    if (!running) return;

    running = false;
    gameOver = true;

    sound(100, 0.6, 'sawtooth');

    document.getElementById('final-score').textContent =
        Math.floor(score);

    document.getElementById('final-coins').textContent =
        coins;


   saveCoins();
saveLeaderboard();
loadSavedData();
}

// ===================================
// 12. UPDATE HUD
// ===================================

function updateHUD() {

    document.getElementById('score').textContent =
        Math.floor(score);

    document.getElementById('coins').textContent =
        coins;

    document.getElementById('level').textContent =
        level;

    const target = levelTargets[level];

    const previous = levelTargets[level - 1];

    const progress = level === maxLevel
        ? 100
        : ((score - previous) / (target - previous)) * 100;

    document.getElementById('progress-bar').style.width =
        Math.min(100, Math.max(0, progress)) + '%';
}

// ===================================
// 13. LEVEL SYSTEM
// ===================================

function updateLevel() {

    if (level >= maxLevel) return;

    if (score >= levelTargets[level]) {

        level++;

        speed += 4;

        sound(700, 0.3);

        const message = document.getElementById(
            'level-message'
        );

        message.textContent = `LEVEL ${level} UNLOCKED!`;

        message.classList.remove('hidden');

        setTimeout(() => {
            message.classList.add('hidden');
        }, 1800);
    }
}

// ===================================
// 14. GAME UPDATE
// ===================================

const clock = new THREE.Clock();

function updateGame(delta) {

    if (!running) return;

    // Smooth car movement
    player.position.x = THREE.MathUtils.lerp(
        player.position.x,
        targetX,
        Math.min(1, delta * 10)
    );

    // Road movement
    roadLines.forEach((line) => {

        line.position.z += speed * delta;

        if (line.position.z > 15) {
            line.position.z = -90;
        }
    });

    // Score
    score += delta * 12;

    // Difficulty
    obstacleTimer += delta;
    coinTimer += delta;

    if (obstacleTimer > Math.max(0.65, 1.8 - level * 0.18)) {
        spawnObstacle();
        obstacleTimer = 0;
    }

    if (coinTimer > 2.8) {
        spawnCoins();
        coinTimer = 0;
    }

    // Update traffic and coins
    for (let i = objects.length - 1; i >= 0; i--) {

        const object = objects[i];
        const mesh = object.mesh;

        mesh.position.z += speed * delta;

        if (object.type === 'coin') {

            mesh.rotation.y += delta * 4;

            const distance = Math.hypot(
                player.position.x - mesh.position.x,
                player.position.z - mesh.position.z
            );

            if (distance < 1.35) {

                coins++;
                totalCoins++;

                sound(950, 0.15);

                scene.remove(mesh);
                objects.splice(i, 1);

                continue;
            }

        } else {

            const distance = Math.hypot(
                player.position.x - mesh.position.x,
                player.position.z - mesh.position.z
            );

            if (distance < 1.65) {
                endGame();
                return;
            }
        }

        // Remove objects behind the player
        if (mesh.position.z > 15) {

            scene.remove(mesh);
            objects.splice(i, 1);
        }
    }

    updateLevel();
    updateHUD();
}

// ===================================
// 15. RESET GAME
// ===================================

function resetGame() {

    objects.forEach((object) => {
        scene.remove(object.mesh);
    });

    objects.length = 0;

    score = 0;
    coins = 0;
    level = 1;
    speed = 22;

    currentLane = 1;
    targetX = 0;

    player.position.set(0, 0, 5);

    obstacleTimer = 0;
    coinTimer = 0;

    gameOver = false;
    running = true;

    clock.getDelta();

    document.getElementById('menu')
        .classList.add('hidden');

    document.getElementById('game-over')
        .classList.add('hidden');

    document.getElementById('leaderboard')
        .classList.add('hidden');

    updateHUD();
}

// ===================================
// 16. BUTTONS
// ===================================

document.getElementById('start-btn')
    .addEventListener('click', resetGame);

document.getElementById('restart-btn')
    .addEventListener('click', resetGame);

document.getElementById('home-btn')
    .addEventListener('click', () => {

        document.getElementById('game-over')
            .classList.add('hidden');

        document.getElementById('menu')
            .classList.remove('hidden');
    });

document.getElementById('leaderboard-btn')
    .addEventListener('click', () => {

        displayLeaderboard();

        document.getElementById('leaderboard')
            .classList.remove('hidden');
    });

document.getElementById('close-leaderboard')
    .addEventListener('click', () => {

        document.getElementById('leaderboard')
            .classList.add('hidden');
    });

// ===================================
// 17. DISPLAY SAVED DATA
// ===================================

function loadSavedData() {

    const board = getLeaderboard();

    const best = board.length > 0
        ? board[0].score
        : 0;

    document.getElementById('best-score').textContent =
        best;

    const savedCoins = Number(
        localStorage.getItem('highwayTotalCoins') || 0
    );

    document.getElementById('total-coins').textContent =
        savedCoins;
}

// Save collected coins between games
function saveCoins() {

    const oldCoins = Number(
        localStorage.getItem('highwayTotalCoins') || 0
    );

    localStorage.setItem(
        'highwayTotalCoins',
        oldCoins + coins
    );

    loadSavedData();
}

// ===================================
// 18. MAIN ANIMATION LOOP
// ===================================

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    if (running) {
        updateGame(delta);
    }

    renderer.render(scene, camera);
}

animate();

// ===================================
// 19. WINDOW RESIZE
// ===================================

window.addEventListener('resize', () => {

    camera.aspect =
        window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
});

// Save coins and update menu after each gam