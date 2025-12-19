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
    activeGame: null, // 'COIN', 'MAZE'
    difficulty: 'MEDIUM', // 'EASY', 'MEDIUM', 'HARD'
    isPlaying: false,
    inputPitch: 0,
    inputRoll: 0,

    // Game Vars
    playerX: 160,
    playerY: 160,
    score: 0,
    timeLeft: 60,
    gameLoopId: null,
    timerId: null,

    // Entities
    coinElem: document.getElementById('coin'),
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
        // We want to scale the entire app container to fit if width < 380px
        const appContainer = document.getElementById('main-app');
        const minWidth = 380;
        const width = window.innerWidth;
        const height = window.innerHeight;

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
        this.endGame();
        this.switchView('menu');
    },

    selectGame(gameMode) {
        if (!this.isConnected) {
            alert("Prosim, najprej poveži desko!");
            return;
        }
        this.activeGame = gameMode;
        document.getElementById('diff-game-name').innerText = gameMode === 'COIN' ? "Lov za kovanci" : "Zen labirint";
        this.switchView('difficulty');
    },

    startGame(difficulty) {
        this.difficulty = difficulty;
        this.switchView('game');

        // Reset Game Data
        this.score = 0;
        this.timeLeft = 60; // 1 min for Coin Game
        this.playerX = 160;
        this.playerY = 160;
        this.isPlaying = true;

        this.updateHUD();

        // Setup Board based on game
        const gameArea = document.getElementById('game-area');
        // Clear old dynamic elements (circles, walls)
        Array.from(gameArea.children).forEach(child => {
            if (child.id !== 'player') child.remove();
        });

        if (this.activeGame === 'COIN') {
            gameArea.style.borderRadius = "50%"; // Circle for coin game
            this.spawnCoin();
        } else if (this.activeGame === 'MAZE') {
            gameArea.style.borderRadius = "10px"; // Rectangle for maze
            MazeManager.generate(difficulty);
        }

        // Start Loop
        if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
        this.gameLoop();

        // Start Timer
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => {
            this.timeLeft--;
            this.updateHUD();
            if (this.timeLeft <= 0) this.endGame();
        }, 1000);
    },

    endGame() {
        this.isPlaying = false;
        clearInterval(this.timerId);
        cancelAnimationFrame(this.gameLoopId);

        // Save Stats
        if (this.score > 0) {
            ProfileManager.addSession({
                game: this.activeGame === 'COIN' ? "Kovanci" : "Labirint",
                diff: this.difficulty,
                score: this.score,
                time: 60 - this.timeLeft, // Time played
                coins: this.activeGame === 'COIN' ? this.score : 0,
                mazes: this.activeGame === 'MAZE' ? Math.floor(this.score / 100) : 0
            });
        }

        // If called from Menu button, we just stop. If time ran out, maybe show results?
        // For now, simple return to menu logic handled by user click.
        // If this was automatic (timer), go to menu.
        if (this.timeLeft <= 0) {
            alert(`Vaja končana! Rezultat: ${this.score}`);
            this.showMenu();
        }
    },

    updateHUD() {
        this.gameScoreElem.innerText = this.score;
        this.gameTimerElem.innerText = this.timeLeft + 's';
    },

    spawnCoin() {
        this.coinElem = document.createElement('div');
        this.coinElem.id = 'coin';
        // Re-apply style manually since we removed it
        this.coinElem.className = 'absolute w-5 h-5 rounded-full bg-orange-400 shadow-md animate-pulse';
        // Note: Tailwind/CSS classes might be lost if we don't apply them,
        // but 'coin' id has styles in CSS.

        const newX = Math.random() * (GAME_SIZE - COIN_SIZE);
        const newY = Math.random() * (GAME_SIZE - COIN_SIZE);
        this.coinElem.style.left = newX + 'px';
        this.coinElem.style.top = newY + 'px';
        document.getElementById('game-area').appendChild(this.coinElem);
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
            this.score += 10;
            this.updateHUD();
            this.coinElem.remove();
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
            const gX = parseFloat(goal.style.left || (GAME_SIZE - 40)); // rough pos
            const gY = parseFloat(goal.style.top || (GAME_SIZE - 40));

            // Just check distance to bottom right corner area roughly
            if (pX > GAME_SIZE - 60 && pY > GAME_SIZE - 60) {
                // Win Level
                app.score += 100;
                app.timeLeft += 20; // Bonus time
                app.updateHUD();

                // Regenerate logic could go here
                // For now, just respawn goal
                alert("Labirint rešen! +100 tčk");
                app.selectGame('MAZE'); // quick reset
                app.startGame(app.difficulty);
            }
        }
    }
}

// Start App
app.init();