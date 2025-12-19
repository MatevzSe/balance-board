// --- GAME VARIABLES ---
let playerX = 160;
let playerY = 160;
let inputPitch = 0;
let inputRoll = 0;
let score = 0;

// Constants
const GAME_SIZE = 350;
const PLAYER_SIZE = 30;
const COIN_SIZE = 20;
const SPEED_FACTOR = 1.5;

// DOM Elements
const playerDiv = document.getElementById('player');
const coinDiv = document.getElementById('coin');
const scoreDiv = document.getElementById('score-display');
const display = document.getElementById('data-display');
const connectBtn = document.getElementById('connectBtn');

// --- BLUETOOTH SETUP ---
const serviceUUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
const charUUID    = "19b10001-e8f2-537e-4f6c-d104768a1214";
let device, server, service, characteristic;

connectBtn.addEventListener('click', async () => {
    try {
        device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'BalanceBoard' }],
            optionalServices: [serviceUUID]
        });

        display.innerText = "Connecting...";
        server = await device.gatt.connect();
        service = await server.getPrimaryService(serviceUUID);
        characteristic = await service.getCharacteristic(charUUID);

        await characteristic.startNotifications();
        characteristic.addEventListener('characteristicvaluechanged', handleData);

        display.innerText = "Connected! Tilt to move.";
        connectBtn.style.display = 'none';

        // Start the Game Loop
        requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error(error);
        alert("Connection Failed: " + error);
    }
});

// --- DATA HANDLER ---
function handleData(event) {
    const value = event.target.value;
    const pitchInt = value.getInt16(0, true);
    const rollInt  = value.getInt16(2, true);

    // 1. Process Raw Data
    // FIX: Removed negative sign so "Forward" moves "Up" (Negative Y in CSS)
    // Remember: In CSS, Y=0 is top, Y=350 is bottom.
    // If tilting forward gives negative pitch, we need negative Y to go up.
    inputPitch = (pitchInt / 100.0);
    inputRoll  = (rollInt / 100.0);

    // Update Debug Text
    display.innerText = `Pitch: ${inputPitch.toFixed(1)}° | Roll: ${inputRoll.toFixed(1)}°`;
}

// --- GAME LOOP ---
function gameLoop() {
    // 1. Update Position
    playerX += inputRoll * SPEED_FACTOR;
    playerY += inputPitch * SPEED_FACTOR; // CSS: +Y is Down, -Y is Up

    // 2. Wall Collisions
    if (playerX < 0) playerX = 0;
    if (playerX > GAME_SIZE - PLAYER_SIZE) playerX = GAME_SIZE - PLAYER_SIZE;
    if (playerY < 0) playerY = 0;
    if (playerY > GAME_SIZE - PLAYER_SIZE) playerY = GAME_SIZE - PLAYER_SIZE;

    // 3. Update Visuals
    playerDiv.style.left = playerX + 'px';
    playerDiv.style.top = playerY + 'px';

    // 4. Check Coin
    checkCoinCollision();

    // 5. Repeat
    requestAnimationFrame(gameLoop);
}

function checkCoinCollision() {
    let pCenterX = playerX + (PLAYER_SIZE / 2);
    let pCenterY = playerY + (PLAYER_SIZE / 2);

    let coinX = parseFloat(coinDiv.style.left || 50);
    let coinY = parseFloat(coinDiv.style.top || 50);
    let cCenterX = coinX + (COIN_SIZE / 2);
    let cCenterY = coinY + (COIN_SIZE / 2);

    let distance = Math.sqrt(
        Math.pow(pCenterX - cCenterX, 2) +
        Math.pow(pCenterY - cCenterY, 2)
    );

    if (distance < (PLAYER_SIZE/2 + COIN_SIZE/2)) {
        score++;
        scoreDiv.innerText = "Score: " + score;
        moveCoin();
    }
}

function moveCoin() {
    let newX = Math.random() * (GAME_SIZE - COIN_SIZE);
    let newY = Math.random() * (GAME_SIZE - COIN_SIZE);
    coinDiv.style.left = newX + 'px';
    coinDiv.style.top = newY + 'px';
}

moveCoin();