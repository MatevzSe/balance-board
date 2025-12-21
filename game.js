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
// --- PROFILE MANAGER ---
const ProfileManager = {
    data: {
        totalTimeSec: 0,
        totalScore: 0,
        gamesPlayed: 0,
        sessions: []
    },

    load() {
        const stored = localStorage.getItem('balance_profile');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Migration: If totalScore is missing
            if (parsed.totalScore === undefined) parsed.totalScore = parsed.totalCoins * 10 || 0;
            if (parsed.gamesPlayed === undefined) parsed.gamesPlayed = parsed.sessions.length || 0;
            this.data = parsed;
        }
    },

    save() {
        localStorage.setItem('balance_profile', JSON.stringify(this.data));
        this.updateUI();
    },

    addSession(stats) {
        this.data.totalTimeSec += stats.time || 0;
        this.data.totalScore += stats.score || 0;
        this.data.gamesPlayed++;

        // Keep last 20 sessions (increased info)
        this.data.sessions.unshift({
            ...stats,
            date: new Date().toISOString()
        });
        if (this.data.sessions.length > 20) this.data.sessions.pop();

        this.save();
    },

    updateUI() {
        // Stats - Safety checks added
        const elMenuScore = document.getElementById('menu-total-score');
        if (elMenuScore) elMenuScore.innerText = this.data.totalScore;

        const elProfileScore = document.getElementById('profile-total-score');
        if (elProfileScore) elProfileScore.innerText = this.data.totalScore;

        const elProfileTime = document.getElementById('profile-time');
        if (elProfileTime) elProfileTime.innerText = Math.floor(this.data.totalTimeSec / 60) + " min";

        const elProfileGames = document.getElementById('profile-games');
        if (elProfileGames) elProfileGames.innerText = this.data.gamesPlayed;

        // Graph (Last 5)
        const recent = this.data.sessions.slice(0, 5).reverse(); // Oldest to newest for graph L->R
        const graphContainer = document.getElementById('profile-graph');

        if (recent.length > 0) {
            graphContainer.innerHTML = "";
            const maxScore = Math.max(...recent.map(s => s.score)) || 100;

            recent.forEach(s => {
                const h = Math.max(10, (s.score / maxScore) * 100);
                const bar = document.createElement('div');
                bar.className = "flex-1 mx-1 bg-teal-400 rounded-t-sm hover:bg-teal-500 transition-all relative group";
                bar.style.height = h + "%";
                // Tooltip
                bar.innerHTML = `<div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">${s.score}</div>`;
                graphContainer.appendChild(bar);
            });
        } else {
            graphContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-300 text-xs italic">Ni podatkov</div>`;
        }

        // History List
        const list = document.getElementById('history-list');
        list.innerHTML = "";

        const icons = {
            'Kovanci': '🪙',
            'Labirint': '🌀',
            'Slalom': '⛷️',
            'Drži sredino': '🎯',
            'Test': '🛠️' // Fallback
        };

        this.data.sessions.slice(0, 10).forEach((s) => {
            const icon = icons[s.game] || '🎮';
            const date = s.date ? new Date(s.date).toLocaleDateString() : 'Pred kratkim';

            const div = document.createElement('div');
            div.className = "flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100";
            div.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-slate-100">${icon}</div>
                <div class="flex-1">
                    <div class="font-bold text-slate-700 text-sm">${s.game}</div>
                    <div class="text-[10px] text-slate-400 font-medium uppercase tracking-wide">${s.diff} • ${date}</div>
                </div>
                <div class="text-teal-600 font-bold text-lg">+${s.score}</div>
            `;
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

    // Battery
    batteryLevel: -1,


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

    // Fix: Add explicit endGame alias for the HTML button
    endGame() {
        this.showMenu();
    },

    // --- NOTIFICATION SYSTEM ---
    showNotification(message, duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = "bg-slate-800 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce-in opacity-0 translate-y-4 transition-all duration-300 transform";
        toast.innerHTML = `<span class="text-xl">🔔</span> <span class="font-medium">${message}</span>`;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-4');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', '-translate-y-4');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    selectGame(gameMode) {
        if (!this.isConnected) {
            this.showNotification("Prosim, najprej poveži desko!");
            return;
        }
        this.activeGame = gameMode;

        // TEST Mode: Skip difficulty select
        if (gameMode === 'TEST') {
            this.activeGame = 'TEST';
            this.startGame('MEDIUM'); // Default to medium for test
            document.getElementById('diff-game-name').innerText = "Testno okolje";
            return;
        }

        let title = "Igra";
        if (gameMode === 'COIN') title = "Lov za kovanci";
        if (gameMode === 'MAZE') title = "Zen labirint";
        if (gameMode === 'HOLD') title = "Drži sredino";
        if (gameMode === 'SLALOM') title = "Smučarski Slalom";

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

        // FIX: Always use square/rounded-rect for consistency so user doesn't fall off
        gameArea.style.borderRadius = "10px";

        if (this.activeGame === 'COIN') {
            this.spawnCoin();
        } else if (this.activeGame === 'MAZE') {
            MazeManager.generate(difficulty);
        } else if (this.activeGame === 'HOLD') {
            this.updateHoldTargetVisual();
        } else if (this.activeGame === 'SLALOM') {
            // Player is fixed at bottom
            this.playerY = GAME_SIZE - 80;
            SlalomManager.start(difficulty);
        } else if (this.activeGame === 'TEST') {
            // Test Mode: Just an empty square. No extra elements.
            // Maybe add a center marker for reference?
            const center = document.createElement('div');
            center.className = 'absolute w-2 h-2 bg-slate-300 rounded-full';
            center.style.left = (GAME_SIZE / 2 - 1) + 'px';
            center.style.top = (GAME_SIZE / 2 - 1) + 'px';
            gameArea.appendChild(center);
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
                // Dynamic Speed: Starts at 10s, decreases by 1s per level, min 2s
                const idleLimit = Math.max(2, 11 - this.level);

                if (this.coinIdleTime > idleLimit) {
                    if (this.coinElem) this.coinElem.remove();
                    this.spawnCoin();
                    this.coinIdleTime = 0;
                }
            }

            if (this.timeLeft <= 0) {
                if (this.activeGame === 'SLALOM') {
                    this.levelUpSlalom();
                } else if (this.activeGame === 'TEST') {
                    // In Test mode, just loop infinite time or reset?
                    // Let's just reset timer so it doesn't end.
                    this.timeLeft = 120;
                } else {
                    this.endGameLogic(true); // Time's up
                }
            }
        }, 1000);
    },

    levelUpSlalom() {
        this.level++;
        // NO Time Reset for Slalom - strict 2 min limit
        this.showNotification(`Odlično! Stopnja ${this.level} - Hitreje!`);
        this.updateHUD();
    },

    endGameLogic(finished) {
        this.isPlaying = false;
        clearInterval(this.timerId);
        cancelAnimationFrame(this.gameLoopId);

        if (!finished) return; // Just stopped

        // Win/Loss Condition
        let success = false;
        let message = `Čas je potekel! Rezultat: ${this.score}`;

        if (this.activeGame === 'COIN') {
            if (this.coinsCollected >= 20) {
                message = `Čestitke! Zbral si ${this.coinsCollected} kovancev!`;
            } else {
                message = `Konec igre! Premalo kovancev (${this.coinsCollected}/20).`;
            }
        } else if (this.activeGame === 'HOLD') {
            message = `Konec vaje! Dosegel si stopnjo ${this.level}.`;
        } else if (this.activeGame === 'MAZE') {
            message = `Čas je potekel!`;
        } else if (this.activeGame === 'SLALOM') {
            if (finished === 'CRASH') {
                message = `Zadeli ste vratca! Konec igre.`;
            } else {
                message = `Cilj! Prevoženih vratc: ${Math.floor(this.score / 10)}.`;
            }
        } else if (this.activeGame === 'TEST') {
            message = "Konec testiranja.";
        }

        // Save Stats
        if (this.score > 0) {
            ProfileManager.addSession({
                game: this.activeGame === 'COIN' ? "Kovanci" : (this.activeGame === 'MAZE' ? "Labirint" : (this.activeGame === 'SLALOM' ? "Slalom" : "Drži sredino")),
                diff: this.difficulty,
                score: this.score,
                time: 120 - this.timeLeft,
                coins: this.coinsCollected,
                mazes: this.activeGame === 'MAZE' ? Math.floor(this.score / 100) : 0
            });
        }

        this.showNotification(message, 5000);
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
        if (this.activeGame === 'SLALOM') {
            this.gameScoreElem.innerText = `Hitr: ${app.level}`;
        }
    },

    // --- MODE: HOLD ---
    updateHoldTargetVisual() {
        let el = document.getElementById('hold-target');
        if (!el) {
            el = document.createElement('div');
            el.id = 'hold-target';
            el.className = 'absolute rounded-full border-4 transition-all duration-300 flex items-center justify-center';
            document.getElementById('game-area').appendChild(el);
        }

        const r = this.holdTarget.r * 2;
        el.style.width = r + 'px';
        el.style.height = r + 'px';
        el.style.left = (this.holdTarget.x - this.holdTarget.r) + 'px';
        el.style.top = (this.holdTarget.y - this.holdTarget.r) + 'px';

        // Color Progression Logic
        // 0-3s: Red/Orange, 3-6s: Yellow, 6-9s: Yellow-Green, 9-10s: Green
        let colorClass = "border-red-500 bg-red-500/10";
        if (this.isHolding) {
            if (this.holdTimer > 9.0) colorClass = "border-emerald-500 bg-emerald-500/40 animate-pulse";
            else if (this.holdTimer > 6.0) colorClass = "border-lime-500 bg-lime-500/30";
            else if (this.holdTimer > 3.0) colorClass = "border-yellow-500 bg-yellow-500/20";
            else colorClass = "border-orange-500 bg-orange-500/10";
        } else {
            colorClass = "border-slate-300 bg-transparent";
        }

        el.className = `absolute rounded-full border-4 transition-all duration-300 flex items-center justify-center ${colorClass}`;

        // Optional: Show timer inside?
        if (this.isHolding) {
            el.innerHTML = `<span class="text-white font-bold text-lg drop-shadow-md">${Math.floor(this.holdTimer)}</span>`;
        } else {
            el.innerHTML = "";
        }
    },

    checkHoldLogic(dt) {
        // Distance check
        const pCx = this.playerX + PLAYER_SIZE / 2;
        const pCy = this.playerY + PLAYER_SIZE / 2;
        const dist = Math.sqrt(Math.pow(pCx - this.holdTarget.x, 2) + Math.pow(pCy - this.holdTarget.y, 2));

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
        if (this.level > 1) { // Changed to > 1 so it happens earlier
            const offset = 60;
            this.holdTarget.x = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);
            this.holdTarget.y = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);

            this.holdTarget.x = Math.max(80, Math.min(GAME_SIZE - 80, this.holdTarget.x));
            this.holdTarget.y = Math.max(80, Math.min(GAME_SIZE - 80, this.holdTarget.y));
        }

        this.showNotification(`Stopnja ${this.level}!`);
        this.updateHUD();
    },

    // --- MODE: COIN ---
    spawnCoin() {
        if (this.coinElem) this.coinElem.remove();

        this.coinElem = document.createElement('div');
        this.coinElem.id = 'coin';
        this.coinElem.className = 'absolute w-6 h-6 rounded-full bg-yellow-400 shadow-lg border-2 border-yellow-200 animate-bounce flex items-center justify-center';
        this.coinElem.innerHTML = '<span class="text-[10px]">🪙</span>';

        // Safe Spawn Logic: Don't spawn on player
        let safe = false;
        let newX, newY;
        let attempts = 0;

        const pCx = this.playerX + PLAYER_SIZE / 2;
        const pCy = this.playerY + PLAYER_SIZE / 2;

        while (!safe && attempts < 10) {
            newX = Math.random() * (GAME_SIZE - COIN_SIZE * 2) + COIN_SIZE;
            newY = Math.random() * (GAME_SIZE - COIN_SIZE * 2) + COIN_SIZE;

            const dist = Math.sqrt(Math.pow(pCx - (newX + COIN_SIZE / 2), 2) + Math.pow(pCy - (newY + COIN_SIZE / 2), 2));
            if (dist > 100) safe = true; // At least 100px away
            attempts++;
        }

        this.coinElem.style.left = newX + 'px';
        this.coinElem.style.top = newY + 'px';
        document.getElementById('game-area').appendChild(this.coinElem);

        this.coinIdleTime = 0;
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

        // Debug View Update
        const dbgPitch = document.getElementById('dbg-pitch');
        const dbgRoll = document.getElementById('dbg-roll');
        if (dbgPitch) dbgPitch.innerText = pitchInt;
        if (dbgRoll) dbgRoll.innerText = rollInt;

        // Battery Parsing (Bytes 4-5) - only if packet is long enough
        if (value.byteLength >= 6) {
            const batteryInt = value.getInt16(4, true);

            // Debug Battery
            const dbgBat = document.getElementById('dbg-bat');
            const dbgBatPerc = document.getElementById('dbg-bat-perc');
            if (dbgBat) dbgBat.innerText = batteryInt;
            if (dbgBatPerc) dbgBatPerc.innerText = batteryInt + '%';

            // Only update DOM if value changed to save resources
            if (batteryInt !== this.batteryLevel) {
                this.batteryLevel = batteryInt;
                this.updateBatteryUI();
            }
        }
    },

    updateBatteryUI() {
        const indicator = document.getElementById('battery-indicator');
        const levelText = document.getElementById('battery-level');
        const fill = document.getElementById('battery-fill');

        if (!indicator || !levelText || !fill) return;

        // Show indicator if we have valid data
        if (this.batteryLevel >= 0) {
            indicator.classList.remove('opacity-0');
        } else {
            indicator.classList.add('opacity-0');
            return;
        }

        levelText.innerText = this.batteryLevel + '%';
        fill.style.width = this.batteryLevel + '%';

        // Color Logic
        if (this.batteryLevel > 50) {
            fill.className = "h-full bg-teal-500 rounded-sm transition-all duration-500";
        } else if (this.batteryLevel > 20) {
            fill.className = "h-full bg-yellow-500 rounded-sm transition-all duration-500";
        } else {
            fill.className = "h-full bg-red-500 rounded-sm animate-pulse transition-all duration-500";
        }
    },

    gameLoop() {
        if (!this.isPlaying) return;

        // Difficulty Multiplier check
        let speed = 1.0;
        if (this.difficulty === 'EASY') speed = 0.5; // Slower (was ~1.0)
        if (this.difficulty === 'MEDIUM') speed = 1.0; // Normal (was 1.5)
        if (this.difficulty === 'HARD') speed = 1.25; // Faster (was 2.0)

        // Player Move Logic
        let prevX = this.playerX;
        let prevY = this.playerY;

        if (this.activeGame === 'SLALOM') {
            // Slalom: Only X moves. Y is fixed.
            this.playerX += this.inputRoll * speed * 1.5;
            // Keep player Y fixed
            this.playerElem.style.top = this.playerY + 'px';
        } else {
            // Normal 2D movement
            this.playerX += this.inputRoll * speed;
            this.playerY += this.inputPitch * speed;
            this.playerElem.style.top = this.playerY + 'px';
        }

        // Boundary Checks
        if (this.playerX < 0) this.playerX = 0;
        if (this.playerX > GAME_SIZE - PLAYER_SIZE) this.playerX = GAME_SIZE - PLAYER_SIZE;
        if (this.playerY < 0) this.playerY = 0;
        if (this.playerY > GAME_SIZE - PLAYER_SIZE) this.playerY = GAME_SIZE - PLAYER_SIZE;

        this.playerElem.style.left = this.playerX + 'px';

        // Collision Logic
        if (this.activeGame === 'COIN') {
            this.checkCoinCollision();
        } else if (this.activeGame === 'MAZE') {
            if (MazeManager.checkCollision(this.playerX, this.playerY)) {
                // Collision prevented: Revert position
                this.playerX = prevX;
                this.playerY = prevY;
                this.playerElem.style.left = this.playerX + 'px';
                this.playerElem.style.top = this.playerY + 'px';
            }
        } else if (this.activeGame === 'HOLD') {
            this.checkHoldLogic(1 / 60); // approx dt
        } else if (this.activeGame === 'SLALOM') {
            SlalomManager.update();
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
            this.score += 10;
            this.coinsCollected++;
            this.updateHUD();
            this.coinElem.remove();

            if (this.coinsCollected >= 10) {
                this.coinsCollected = 0;
                this.level++;
                this.showNotification(`Stopnja ${this.level}! Kovanci so hitrejši.`);
            }
            this.spawnCoin();
        }
    }
};

// --- SLALOM MANAGER ---
const SlalomManager = {
    gates: [],
    baseSpeed: 2.0,
    gatesPassed: 0,

    start(difficulty) {
        this.gates = [];
        this.gatesPassed = 0;
        this.baseSpeed = difficulty === 'HARD' ? 3.0 : (difficulty === 'MEDIUM' ? 2.0 : 1.5);
        // Pre-spawn some gates
        this.spawnGate(-100);
        this.spawnGate(-300);
    },

    spawnGate(yPos) {
        // Gap width (variable by level)
        // Start wider (160px) and narrow down by 5px per level, min 60px
        const baseGap = 160;
        const currentGap = Math.max(60, baseGap - (app.level * 5));

        const gap = currentGap;
        // Gap X center random (avoid edges)
        const minX = 40;
        const maxX = GAME_SIZE - 40;
        const gapX = Math.random() * (maxX - minX - gap) + minX;

        // We actually draw 2 divs: Left Wall and Right Wall
        const area = document.getElementById('game-area');

        const gateL = document.createElement('div');
        gateL.className = 'slalom-gate absolute bg-red-400 rounded-r';
        gateL.style.height = '10px';
        gateL.style.width = gapX + 'px';
        gateL.style.left = '0px';
        gateL.style.top = yPos + 'px';

        const gateR = document.createElement('div');
        gateR.className = 'slalom-gate absolute bg-blue-400 rounded-l';
        gateR.style.height = '10px';
        gateR.style.width = (GAME_SIZE - (gapX + gap)) + 'px';
        gateR.style.right = '0px';
        gateR.style.top = yPos + 'px';

        area.appendChild(gateL);
        area.appendChild(gateR);

        this.gates.push({
            y: yPos,
            gapX: gapX,
            gapW: gap,
            elL: gateL,
            elR: gateR,
            passed: false
        });
    },

    update() {
        // Update Logic: Move gates down
        // Speed increases with level
        const currentSpeed = this.baseSpeed + (app.level * 0.5);

        for (let i = this.gates.length - 1; i >= 0; i--) {
            const g = this.gates[i];
            g.y += currentSpeed;

            g.elL.style.top = g.y + 'px';
            g.elR.style.top = g.y + 'px';

            // Check Collision / Pass
            // Player is at app.playerY (bottom of screen)
            // Gate must intersect Player lines

            const playerTop = app.playerY;
            const playerBot = app.playerY + PLAYER_SIZE;

            // Overlapping Y? gate is 10px high
            if (g.y + 10 > playerTop && g.y < playerBot) {
                // Check X Logic
                // We are SAFE if player is within gap
                const pLeft = app.playerX;
                const pRight = app.playerX + PLAYER_SIZE;

                const gapLeft = g.gapX;
                const gapRight = g.gapX + g.gapW;

                if (pLeft > gapLeft && pRight < gapRight) {
                    // Inside Gap - OK
                    if (!g.passed) {
                        // Just entering visual feedback?
                        g.elL.style.backgroundColor = '#4ade80'; // Green
                        g.elR.style.backgroundColor = '#4ade80';
                    }
                } else {
                    // Hit Wall
                    if (!g.passed) { // Only hit once
                        g.elL.style.backgroundColor = '#f87171'; // Red
                        g.elR.style.backgroundColor = '#f87171';
                        app.endGameLogic(true, 'CRASH');
                        return;
                    }
                }
            }

            // Passed Player
            if (g.y > playerBot && !g.passed) {
                g.passed = true;
                this.gatesPassed++;

                // Score: 10 pts per gate
                app.score += 10;

                // Level Up Check: Every 10 gates
                if (this.gatesPassed % 10 === 0) {
                    app.levelUpSlalom();
                }

                app.updateHUD();
            }

            // Remove if off screen
            if (g.y > GAME_SIZE) {
                g.elL.remove();
                g.elR.remove();
                this.gates.splice(i, 1);

                // Spawn new one on top
                // Random gap vertical distance (~200px)
                const lastY = this.gates.length > 0 ? Math.min(...this.gates.map(x => x.y)) : 0;
                this.spawnGate(lastY - 200);
            }
        }

        // Ensure we always have gates coming
        if (this.gates.length < 3) {
            const lastY = this.gates.length > 0 ? Math.min(...this.gates.map(x => x.y)) : 0;
            this.spawnGate(lastY - 200);
        }
    }
};

// --- MAZE MANAGER ---
// --- MAZE MANAGER ---
const MazeManager = {
    walls: [],
    cellSize: 50,

    // Simple maps for prototype (1 = wall, 0 = empty)
    // 7x7 grid for GAME_SIZE 350
    maps: [
        [ // Level 1 (Easy)
            [1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0], // Opened right side
            [1, 1, 1, 1, 1, 0, 0]  // Opened goal area
        ],
        [ // Level 2 (Med)
            [1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 1],
            [1, 0, 0, 1, 0, 0, 1],
            [1, 0, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 0, 0, 0, 0], // Opened right side
            [1, 1, 1, 1, 1, 0, 0]  // Opened goal area
        ],
        [ // Level 3 (Hard)
            [1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 0, 1],
            [1, 1, 1, 0, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0], // Opened right side
            [1, 1, 1, 1, 1, 0, 0]  // Opened goal area
        ]
    ],

    generate(difficulty) {
        const area = document.getElementById('game-area');
        // Clear previous
        Array.from(document.getElementsByClassName('maze-wall')).forEach(el => el.remove());
        const existingGoal = document.getElementById('maze-goal');
        if (existingGoal) existingGoal.remove();

        this.walls = [];

        let mapIndex = 0;
        if (difficulty === 'MEDIUM') mapIndex = 1;
        if (difficulty === 'HARD') mapIndex = 2;

        // Randomly flip map for variety? Or just stick to static for robustness
        const map = this.maps[mapIndex];

        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (map[r][c] === 1) {
                    this.createWall(c * this.cellSize, r * this.cellSize);
                }
            }
        }

        // Add Goal
        const goal = document.createElement('div');
        goal.className = 'maze-goal absolute w-8 h-8 rounded-full animate-pulse flex items-center justify-center';
        goal.style.backgroundColor = '#ec4899'; // Pink
        goal.innerHTML = '🏁';
        // Place goal at bottom right (6,5) roughly
        goal.style.right = '25px';
        goal.style.bottom = '25px';
        goal.id = 'maze-goal';
        area.appendChild(goal);

        // Place player at top left (1,1) safe spot
        app.playerX = 60;
        app.playerY = 60;
    },

    createWall(x, y) {
        const area = document.getElementById('game-area');
        const w = document.createElement('div');
        w.className = 'maze-wall absolute bg-slate-500 rounded-sm shadow-sm';
        w.style.width = this.cellSize + 'px';
        w.style.height = this.cellSize + 'px';
        w.style.left = x + 'px';
        w.style.top = y + 'px';
        area.appendChild(w);

        this.walls.push({ x: x, y: y, w: this.cellSize, h: this.cellSize });
    },

    checkCollision(pX, pY) {
        // Simple AABB vs Walls
        for (let w of this.walls) {
            if (pX < w.x + w.w &&
                pX + PLAYER_SIZE > w.x &&
                pY < w.y + w.h &&
                pY + PLAYER_SIZE > w.y) {

                // Collision Detected!
                return true;
            }
        }

        // Check Goal
        const goal = document.getElementById('maze-goal');
        if (goal) {
            // Check distance to goal center
            // Goal is roughly at (325, 325)
            // Player center
            const pCx = pX + PLAYER_SIZE / 2;
            const pCy = pY + PLAYER_SIZE / 2;

            // Simple hack: if we are in the bottom right corner cell
            if (pCx > 300 && pCy > 300) {
                app.score += 100 + (app.timeLeft * 10);
                app.showNotification("Labirint rešen! +100 točk");
                // Reset / Next Level
                app.selectGame('MAZE');
                app.startGame(app.difficulty);
            }
        }

        return false;
    }
};

// Start App
app.init();