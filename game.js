/**
 * BALANCE FLOW - PLATFORM ENGINE
 * Handles Multi-Game logic, Profile persistence, and Bluetooth connectivity.
 */

// --- CONFIGURATION ---
const GAME_SIZE = 350;
const PLAYER_SIZE = 30;
const COIN_SIZE = 20;

// Bluetooth UUIDs
const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
const CHAR_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214";

// --- PROFILE MANAGER ---
const ProfileManager = {
    data: {
        totalTimeSec: 0,
        totalCoins: 0,
        mazesCompleted: 0,
        sessions: []
    },

    load() {
        const stored = localStorage.getItem('balance_profile');
        if (stored) {
            this.data = JSON.parse(stored);
        }
    },

    save() {
        localStorage.setItem('balance_profile', JSON.stringify(this.data));
        this.updateUI();
    },

    addSession(stats) {
        this.data.totalTimeSec += stats.time || 0;
        this.data.totalCoins += stats.coins || 0;
        this.data.mazesCompleted += stats.mazes || 0;

        // Keep last 10 sessions
        this.data.sessions.unshift(stats);
        if (this.data.sessions.length > 10) this.data.sessions.pop();

        this.save();
    },

    getAgilityScore() {
        // Simple heuristic: Coins per minute * 10
        if (this.data.totalTimeSec === 0) return 0;
        const mins = this.data.totalTimeSec / 60;
        const score = (this.data.totalCoins / mins) * 1;
        return score.toFixed(1);
    },

    updateUI() {
        document.getElementById('menu-total-score').innerText = Math.floor(this.data.totalCoins * 10);
        document.getElementById('profile-coins').innerText = this.data.totalCoins;
        document.getElementById('profile-time').innerText = Math.floor(this.data.totalTimeSec / 60) + " min";
        document.getElementById('profile-agility').innerText = this.getAgilityScore();

        // History
        const list = document.getElementById('history-list');
        list.innerHTML = "";
        this.data.sessions.slice(0, 5).forEach((s, i) => {
            const div = document.createElement('div');
            div.className = "flex justify-between border-b border-slate-100 pb-1";
            div.innerHTML = `<span>${s.game} (${s.diff})</span> <span>${s.score} točk</span>`;
            list.appendChild(div);
        });
    }
};

// --- APP MANAGER ---
const app = {
    device: null,
    server: null,
    characteristic: null,
    isConnected: false,

    // Game State
    activeGame: null, // 'COIN', 'MAZE', 'HOLD'
    difficulty: 'MEDIUM', // 'EASY', 'MEDIUM', 'HARD'
    isPlaying: false,
    inputPitch: 0,
    inputRoll: 0,

    // Game Vars
    playerX: 160,
    playerY: 160,
    score: 0,
    timeLeft: 120, // 2 minutes default
    gameLoopId: null,
    timerId: null,
    level: 1, // Current level

    // Specific Mode Vars
    coinsCollected: 0,
    coinIdleTime: 0, // Time coin has sat uncollected

    holdTarget: { x: 175, y: 175, r: 60 }, // Center target
    holdTimer: 0, // How long currently holding
    isHolding: false, // Visual feedback for HOLD mode

    // Entities
    coinElem: null, // Will be created dynamically
    playerElem: document.getElementById('player'),
    gameScoreElem: document.getElementById('game-score'),
    gameTimerElem: document.getElementById('game-timer'),

    init() {
        ProfileManager.load();
        ProfileManager.updateUI();

        // Connect Button
        document.getElementById('connectBtn').addEventListener('click', () => this.connectBluetooth());

        // Responsive Scaling
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize(); // Initial call

        // Initial View
        this.switchView('menu');
    },

    handleResize() {
        const appContainer = document.getElementById('main-app');
        const minWidth = 380;
        const width = window.innerWidth;

        if (width < minWidth) {
            const scale = width / minWidth;
            appContainer.style.transform = `scale(${scale})`;
        } else {
            appContainer.style.transform = `scale(1)`;
        }
    },

    switchView(viewName) {
        ['menu', 'difficulty', 'game', 'profile'].forEach(v => {
            const el = document.getElementById('view-' + v);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById('view-' + viewName);
        if (target) target.classList.remove('hidden');
    },

    showProfile() {
        this.switchView('profile');
    },

    showMenu() {
        this.endGameLogic(false); // Force stop without saving if just navigating
        this.switchView('menu');
    },

    selectGame(gameMode) {
        if (!this.isConnected) {
            alert("Prosim, najprej poveži desko!");
            return;
        }
        this.activeGame = gameMode;

        let title = "Igra";
        if (gameMode === 'COIN') title = "Lov za kovanci";
        if (gameMode === 'MAZE') title = "Zen labirint";
        if (gameMode === 'HOLD') title = "Drži sredino";

        document.getElementById('diff-game-name').innerText = title;
        this.switchView('difficulty');
    },

    startGame(difficulty) {
        this.difficulty = difficulty;
        this.switchView('game');

        // Reset Game Data
        this.score = 0;
        this.timeLeft = 120; // 2 min limit for all games as per user req
        this.playerX = 160;
        this.playerY = 160;
        this.isPlaying = true;
        this.level = 1;

        // Mode Specific Resets
        this.coinsCollected = 0;
        this.coinIdleTime = 0;
        this.holdTimer = 0;
        this.isHolding = false;
        // Reset Hold Target to center initially
        this.holdTarget = { x: GAME_SIZE / 2, y: GAME_SIZE / 2, r: 80 };

        this.updateHUD();

        // Setup Board based on game
        const gameArea = document.getElementById('game-area');
        // Clear old dynamic elements
        Array.from(gameArea.children).forEach(child => {
            if (child.id !== 'player') child.remove();
        });

        gameArea.style.borderRadius = "10px"; // Default rect

        if (this.activeGame === 'COIN') {
            gameArea.style.borderRadius = "50%"; // Circle
            this.spawnCoin();
        } else if (this.activeGame === 'MAZE') {
            gameArea.style.borderRadius = "10px";
            MazeManager.generate(difficulty);
        } else if (this.activeGame === 'HOLD') {
            gameArea.style.borderRadius = "50%";
            this.updateHoldTargetVisual();
        }

        // Start Loop
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
        this.gameLoop();

        // Start Timer
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => {
            this.timeLeft--;
            this.updateHUD();

            // Mode Specific Seconds Logic
            if (this.activeGame === 'COIN') {
                this.coinIdleTime++;
                if (this.coinIdleTime > 4) { // Move every ~5s if idle
                    if (this.coinElem) this.coinElem.remove();
                    this.spawnCoin();
                    this.coinIdleTime = 0;
                }
            }

            if (this.timeLeft <= 0) this.endGameLogic(true); // Time's up
        }, 1000);
    },

    endGameLogic(finished) {
        this.isPlaying = false;
        clearInterval(this.timerId);
        cancelAnimationFrame(this.gameLoopId);

        if (!finished) return; // Just stopped

        // Win/Loss Condition
        // HOLD: Time up = Bad? Or just end? User said "if you dont manage [10s hold] in 2 min game over"
        // COIN: If < 20 coins = Game Over.
        // MAZE: If not completed = Game Over.

        let success = false;
        let message = `Čas je potekel! Rezultat: ${this.score}`;

        if (this.activeGame === 'COIN') {
            if (this.coinsCollected >= 20) {
                success = true;
                message = `Čestitke! Zbral si ${this.coinsCollected} kovancev!`;
            } else {
                message = `Konec igre! Premalo kovancev (${this.coinsCollected}/20).`;
            }
        } else if (this.activeGame === 'HOLD') {
            // Score in HOLD is basically max level reached or time held?
            // Let's rely on Score accumulated
            message = `Konec vaje! Dosegel si stopnjo ${this.level}.`;
        } else if (this.activeGame === 'MAZE') {
            message = `Čas je potekel!`;
        }

        // Save Stats
        if (this.score > 0) {
            ProfileManager.addSession({
                game: this.activeGame === 'COIN' ? "Kovanci" : (this.activeGame === 'MAZE' ? "Labirint" : "Drži sredino"),
                diff: this.difficulty,
                score: this.score,
                time: 120 - this.timeLeft,
                coins: this.coinsCollected,
                mazes: this.activeGame === 'MAZE' ? Math.floor(this.score / 100) : 0
            });
        }

        alert(message);
        this.showMenu();
    },

    updateHUD() {
        this.gameScoreElem.innerText = this.score;
        this.gameTimerElem.innerText = this.timeLeft + 's';

        if (this.activeGame === 'COIN') {
            this.gameScoreElem.innerText = `${this.coinsCollected}/20`;
        }
        if (this.activeGame === 'HOLD') {
            this.gameScoreElem.innerText = `Lvl ${this.level}`;
        }
    },

    // --- MODE: HOLD ---
    updateHoldTargetVisual() {
        let el = document.getElementById('hold-target');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hold-target';
            el.className = 'absolute rounded-full border-4 border-teal-300 transition-all duration-300';
            document.getElementById('game-area').appendChild(el);
        }

        const r = this.holdTarget.r * 2;
        el.style.width = r + 'px';
        el.style.height = r + 'px';
        el.style.left = (this.holdTarget.x - this.holdTarget.r) + 'px';
        el.style.top = (this.holdTarget.y - this.holdTarget.r) + 'px';

        // Visual feedback for holding
        if (this.isHolding) {
            el.style.borderColor = "#4ade80"; // Green
            el.style.backgroundColor = "rgba(74, 222, 128, 0.2)";
        } else {
            el.style.borderColor = "#f97316"; // Orange
            el.style.backgroundColor = "transparent";
        }
    },

    checkHoldLogic(dt) {
        // Distance check
        const pCx = this.playerX + PLAYER_SIZE / 2;
        const pCy = this.playerY + PLAYER_SIZE / 2;
        const dist = Math.sqrt(Math.pow(pCx - this.holdTarget.x, 2) + Math.pow(pCy - this.holdTarget.y, 2));

        // Are we inside the target circle (allowing for player radius)?
        // Strictly center means distance is small. 
        // User said "hold center". Let's say player center must be within target radius.
        if (dist < this.holdTarget.r) {
            this.isHolding = true;
            this.holdTimer += dt;

            // 10 seconds hold to level up
            if (this.holdTimer >= 10.0) {
                this.levelUpHold();
            }
        } else {
            this.isHolding = false;
            this.holdTimer = 0; // Reset if left
        }
        this.updateHoldTargetVisual();
    },

    levelUpHold() {
        this.level++;
        this.holdTimer = 0;
        this.score += 100 * this.level;

        // Make harder: Smaller radius
        this.holdTarget.r = Math.max(20, this.holdTarget.r - 10);

        // Higher levels: Offset center
        if (this.level > 2) {
            // max offset +/- 50px
            const offset = 50;
            this.holdTarget.x = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);
            this.holdTarget.y = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);

            // Clamp to board
            this.holdTarget.x = Math.max(60, Math.min(GAME_SIZE - 60, this.holdTarget.x));
            this.holdTarget.y = Math.max(60, Math.min(GAME_SIZE - 60, this.holdTarget.y));
        }

        alert(`Stopnja ${this.level}!`);
        this.updateHUD();
    },

    // --- MODE: COIN ---
    spawnCoin() {
        // Clean old
        if (this.coinElem) this.coinElem.remove();

        this.coinElem = document.createElement('div');
        this.coinElem.id = 'coin';
        this.coinElem.className = 'absolute w-5 h-5 rounded-full bg-yellow-400 shadow-md animate-bounce';

        const newX = Math.random() * (GAME_SIZE - COIN_SIZE);
        const newY = Math.random() * (GAME_SIZE - COIN_SIZE);
        this.coinElem.style.left = newX + 'px';
        this.coinElem.style.top = newY + 'px';
        document.getElementById('game-area').appendChild(this.coinElem);

        this.coinIdleTime = 0; // Reset idle timer
    },

    // BLUETOOTH
    async connectBluetooth() {
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'BalanceBoard' }],
                optionalServices: [SERVICE_UUID]
            });

            document.getElementById('device-status').innerText = "Povezovanje...";
            this.server = await this.device.gatt.connect();
            const service = await this.server.getPrimaryService(SERVICE_UUID);
            this.characteristic = await service.getCharacteristic(CHAR_UUID);

            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (e) => this.handleData(e));

            this.isConnected = true;
            document.getElementById('device-status').innerText = "Povezano";
            document.getElementById('device-status').className = "text-center mb-2 text-teal-600 font-bold";
            document.getElementById('connectBtn').classList.add('hidden'); // Hide connect button

        } catch (error) {
            console.error(error);
            alert("Povezava ni uspela");
        }
    },

    handleData(event) {
        const value = event.target.value;
        const pitchInt = value.getInt16(0, true);
        const rollInt = value.getInt16(2, true);
        this.inputPitch = (pitchInt / 100.0);
        this.inputRoll = (rollInt / 100.0);
    },

    gameLoop() {
        if (!this.isPlaying) return;

        // Difficulty Multiplier
        let speed = 1.0;
        if (this.difficulty === 'MEDIUM') speed = 1.5;
        if (this.difficulty === 'HARD') speed = 2.0;

        // Update Physics
        this.playerX += this.inputRoll * speed;
        this.playerY += this.inputPitch * speed;

        // Boundary Checks
        if (this.playerX < 0) this.playerX = 0;
        if (this.playerX > GAME_SIZE - PLAYER_SIZE) this.playerX = GAME_SIZE - PLAYER_SIZE;
        if (this.playerY < 0) this.playerY = 0;
        if (this.playerY > GAME_SIZE - PLAYER_SIZE) this.playerY = GAME_SIZE - PLAYER_SIZE;

        // Render Player
        this.playerElem.style.left = this.playerX + 'px';
        this.playerElem.style.top = this.playerY + 'px';

        // Collision Logic
        if (this.activeGame === 'COIN') {
            this.checkCoinCollision();
        } else if (this.activeGame === 'MAZE') {
            MazeManager.checkCollision(this.playerX, this.playerY);
        } else if (this.activeGame === 'HOLD') {
            this.checkHoldLogic(1 / 60); // approx dt
        }

        this.gameLoopId = requestAnimationFrame(() => this.gameLoop());
    },

    checkCoinCollision() {
        if (!this.coinElem) return;
        const pCenterX = this.playerX + (PLAYER_SIZE / 2);
        const pCenterY = this.playerY + (PLAYER_SIZE / 2);

        const coinX = parseFloat(this.coinElem.style.left);
        const coinY = parseFloat(this.coinElem.style.top);
        const cCenterX = coinX + (COIN_SIZE / 2);
        const cCenterY = coinY + (COIN_SIZE / 2);

        const dist = Math.sqrt(Math.pow(pCenterX - cCenterX, 2) + Math.pow(pCenterY - cCenterY, 2));

        if (dist < (PLAYER_SIZE / 2 + COIN_SIZE / 2)) {
            // Collect
            this.score += 10; // Each coin is 10 points
            this.coinsCollected++;
            this.updateHUD();
            this.coinElem.remove();

            if (this.coinsCollected >= 20) {
                // Next level / Win logic
                // User said "move to next level"
                this.coinsCollected = 0; // Reset for next batch? Or just Keep going? 
                // Let's reset counter but keep score, and maybe speed up?
                this.level++;
                alert(`Stopnja ${this.level}! Kovanci so hitrejši.`);
            }

            this.spawnCoin();
        }
    }
};

// --- MAZE MANAGER ---
const MazeManager = {
    walls: [],

    generate(difficulty) {
        const area = document.getElementById('game-area');
        this.walls = [];

        let wallCount = 5;
        if (difficulty === 'MEDIUM') wallCount = 8;
        if (difficulty === 'HARD') wallCount = 12;

        // Simple Random Walls for prototype
        // In real game, use a maze algorithm or static designs
        for (let i = 0; i < wallCount; i++) {
            const w = document.createElement('div');
            w.className = 'maze-wall absolute bg-slate-400 rounded';

            const isHoriz = Math.random() > 0.5;
            const wW = isHoriz ? 100 : 20;
            const wH = isHoriz ? 20 : 100;
            const wX = Math.random() * (GAME_SIZE - wW);
            const wY = Math.random() * (GAME_SIZE - wH);

            w.style.width = wW + 'px';
            w.style.height = wH + 'px';
            w.style.left = wX + 'px';
            w.style.top = wY + 'px';

            area.appendChild(w);
            this.walls.push({ x: wX, y: wY, w: wW, h: wH });
        }

        // Add Goal
        const goal = document.createElement('div');
        goal.className = 'maze-goal absolute w-8 h-8 bg-red-400 rounded-full animate-pulse';
        goal.style.right = '20px';
        goal.style.bottom = '20px';
        goal.id = 'maze-goal';
        area.appendChild(goal);
    },

    checkCollision(pX, pY) {
        // Check Walls
        // Simple AABB
        for (let w of this.walls) {
            if (pX < w.x + w.w &&
                pX + PLAYER_SIZE > w.x &&
                pY < w.y + w.h &&
                pY + PLAYER_SIZE > w.y) {

                // Hit Wall - Bounce / Penalty
                // For 'Zen' mode, maybe just slow down or stop? 
                // Let's bounce back a bit
                app.playerX -= (app.inputRoll * 5);
                app.playerY -= (app.inputPitch * 5);
            }
        }

        // Check Goal
        const goal = document.getElementById('maze-goal');
        if (goal) {
            const gX = parseFloat(goal.style.left || (GAME_SIZE - 40));
            const gY = parseFloat(goal.style.top || (GAME_SIZE - 40));

            // Just check distance to bottom right corner area roughly
            if (pX > GAME_SIZE - 60 && pY > GAME_SIZE - 60) {
                // Win Level
                app.score += 100 + (app.timeLeft * 10);
                // NO Bonus time! strict limit.
                app.updateHUD();

                alert("Labirint rešen! +100 točk");
                app.selectGame('MAZE'); // quick reset
                app.startGame(app.difficulty);
            }
        }
    }
}

// Start App
app.init();