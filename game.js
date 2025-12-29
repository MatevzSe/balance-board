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
        totalScore: 0,
        totalTimeSec: 0,
        gamesPlayed: 0,
        sessions: [], // Keep for backward compat
        highScores: { // [NEW] Track bests
            COIN: 0,
            MAZE: 0,
            HOLD: 0,
            SLALOM: 0
        }
    },

    ranks: [
        { min: 0, title: "Začetnik" },
        { min: 100, title: "Učenec" },
        { min: 300, title: "Rekreativec" },
        { min: 600, title: "Entuziast" },
        { min: 1000, title: "Polprofesionalec" },
        { min: 1500, title: "Profesionalec" },
        { min: 2200, title: "Ekspert" },
        { min: 3000, title: "Mojster" },
        { min: 4000, title: "Velemojster" },
        { min: 5000, title: "Legenda" }
    ],

    init() {
        const stored = localStorage.getItem('balance_profile_v2');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                // Ensure highScores struct exists if migrated
                if (!this.data.highScores) {
                    this.data.highScores = { COIN: 0, MAZE: 0, HOLD: 0, SLALOM: 0 };
                }
            } catch (e) {
                console.error("Profile load error", e);
            }
        }
        this.updateUI();
    },

    save() {
        localStorage.setItem('balance_profile_v2', JSON.stringify(this.data));
        this.updateUI();
    },

    addSession(session) {
        this.data.totalScore += session.score;
        this.data.totalTimeSec += session.time;
        this.data.gamesPlayed++;
        this.data.sessions.unshift(session);
        if (this.data.sessions.length > 50) this.data.sessions.pop();

        // Update High Scores
        let gameKey = null;
        if (session.game === "Kovanci") gameKey = 'COIN';
        else if (session.game === "Labirint") gameKey = 'MAZE';
        else if (session.game === "Slalom") gameKey = 'SLALOM';
        else if (session.game === "Drži sredino") gameKey = 'HOLD';

        if (gameKey) {
            if (session.score > (this.data.highScores[gameKey] || 0)) {
                this.data.highScores[gameKey] = session.score;
            }
        }

        this.save();
    },

    getRankInfo() {
        const score = this.data.totalScore;
        let rankIndex = 0;
        for (let i = 0; i < this.ranks.length; i++) {
            if (score >= this.ranks[i].min) {
                rankIndex = i;
            } else {
                break;
            }
        }

        const currentRank = this.ranks[rankIndex];
        const nextRank = this.ranks[rankIndex + 1];

        let progress = 100;
        let nextScore = score; // Cap at max

        if (nextRank) {
            const range = nextRank.min - currentRank.min;
            const current = score - currentRank.min;
            progress = Math.min(100, Math.max(0, (current / range) * 100));
            nextScore = nextRank.min;
        }

        return {
            title: currentRank.title,
            progress: progress,
            currentScore: score,
            nextScore: nextRank ? nextRank.min : "MAX"
        };
    },

    updateUI() {
        // Menu Score
        const elMenuScore = document.getElementById('menu-total-score');
        if (elMenuScore) elMenuScore.innerText = this.data.totalScore;

        // Profile Stats
        const elProfileScore = document.getElementById('profile-total-score');
        if (elProfileScore) elProfileScore.innerText = this.data.totalScore;

        const elProfileTime = document.getElementById('profile-time');
        if (elProfileTime) elProfileTime.innerText = Math.floor(this.data.totalTimeSec / 60) + " min";

        const elProfileGames = document.getElementById('profile-games');
        if (elProfileGames) elProfileGames.innerText = this.data.gamesPlayed;

        // High Scores
        const elHsCoin = document.getElementById('hs-coin');
        if (elHsCoin) elHsCoin.innerText = this.data.highScores.COIN || 0;

        const elHsMaze = document.getElementById('hs-maze');
        if (elHsMaze) elHsMaze.innerText = this.data.highScores.MAZE || 0;

        const elHsHold = document.getElementById('hs-hold');
        if (elHsHold) elHsHold.innerText = this.data.highScores.HOLD || 0;

        const elHsSlalom = document.getElementById('hs-slalom');
        if (elHsSlalom) elHsSlalom.innerText = this.data.highScores.SLALOM || 0;

        // Experience / Rank
        const rank = this.getRankInfo();
        const elRankTitle = document.getElementById('profile-rank-title');
        if (elRankTitle) elRankTitle.innerText = rank.title;

        const elRankBar = document.getElementById('profile-rank-bar');
        if (elRankBar) elRankBar.style.width = rank.progress + "%";

        const elXpCur = document.getElementById('profile-xp-current');
        if (elXpCur) elXpCur.innerText = rank.currentScore;

        const elXpNext = document.getElementById('profile-xp-next');
        if (elXpNext) elXpNext.innerText = rank.nextScore;
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
    timeLeft: 60, // 60 seconds default
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
        ProfileManager.init();

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
        this.timeLeft = 60; // 60s limit for all games as per user req
        if (this.activeGame === 'HOLD') this.timeLeft = 30; // 30s limit for Hold
        if (this.activeGame === 'MAZE') this.timeLeft = 60; // 60s limit for Maze

        if (this.activeGame === 'MAZE') {
            this.playerX = 15; // Start in top-left cell 1,1 (10px wall + 5px margin)
            this.playerY = 15;
        } else {
            this.playerX = 160;
            this.playerY = 160;
        }
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
            // Skiing: No timer
            if (this.activeGame === 'SLALOM') return;

            this.timeLeft--;
            this.updateHUD();

            // Mode Specific Seconds Logic
            if (this.activeGame === 'COIN') {
                this.coinIdleTime++;
                // Dynamic Speed: Starts at 8s, decreases by 1s per level, min 2s
                const idleLimit = Math.max(2, 9 - this.level);

                if (this.coinIdleTime > idleLimit) {
                    if (this.coinElem) this.coinElem.remove();
                    this.spawnCoin();
                    this.coinIdleTime = 0;
                }
            }

            if (this.timeLeft <= 0) {
                if (this.activeGame === 'TEST') {
                    // In Test mode, just loop infinite time or reset?
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
        this.showNotification(`Odlično! Nivo ${this.level} - Hitreje!`);
        this.updateHUD();
    },

    endGameLogic(finished, reason) {
        this.isPlaying = false;
        clearInterval(this.timerId);
        cancelAnimationFrame(this.gameLoopId);

        if (!finished && reason !== 'QUIT') return; // Just stopped without showing results

        // Win/Loss Condition
        let message = `Čas je potekel! Rezultat: ${this.score}`;

        if (reason === 'QUIT') {
            message = `Vaja končana. Rezultat: ${this.score}`;
        } else if (this.activeGame === 'COIN') {
            // Coin is now endurance
            message = `Konec igre! Dosegel si stopnjo ${this.level}. Zbrani kovanci: ${this.score}`;
        } else if (this.activeGame === 'HOLD') {
            message = `Konec vaje! Dosegel si stopnjo ${this.level}.`;
        } else if (this.activeGame === 'MAZE') {
            message = `Čas je potekel!`;
        } else if (this.activeGame === 'SLALOM') {
            if (reason === 'CRASH') {
                message = `Konec igre! Zadeli ste vratca.`;
            } else {
                message = `Cilj! Prevoženih vratc: ${this.score}.`;
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

        // Show Game Over Modal instead of Alert/Notification
        const modal = document.getElementById('game-over-modal');
        if (modal) {
            document.getElementById('go-score').innerText = this.score;
            document.getElementById('go-level').innerText = this.level;

            let reasonText = "Čas je potekel";
            if (finished === 'CRASH') reasonText = "Trk!";
            else if (this.activeGame === 'MAZE') reasonText = "Labirint končan";
            else if (this.activeGame === 'TEST') reasonText = "Test končan";
            else if (this.activeGame === 'SLALOM' && reason !== 'CRASH') reasonText = "Cilj!";

            document.getElementById('go-reason').innerText = reasonText;
            modal.classList.remove('hidden');
        } else {
            this.showNotification(message, 5000);
            this.showMenu();
        }
    },

    closeGameOver() {
        const modal = document.getElementById('game-over-modal');
        if (modal) modal.classList.add('hidden');
        this.showMenu();
    },

    updateHUD() {
        const elScore = document.getElementById('game-score');
        const elTimer = document.getElementById('game-timer');
        const elLevel = document.getElementById('game-level');

        if (elScore) elScore.innerText = this.score;
        if (elLevel) elLevel.innerText = this.level;
        if (elTimer) elTimer.innerText = this.timeLeft + 's';

        // Timer Visibility Logic
        if (elTimer && elTimer.parentElement) {
            if (this.activeGame === 'SLALOM') {
                // Hide time for Slalom
                elTimer.parentElement.classList.add('opacity-0');
            } else {
                elTimer.parentElement.classList.remove('opacity-0');
            }
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

        // Color & Countdown Logic
        // Goal: 5 Seconds.
        // 0-2s: Red
        // 2-4s: Orange/Yellow
        // 4-5s: Green
        let colorClass = "border-slate-300 bg-transparent";
        let textContent = "";

        if (this.isHolding) {
            const timeLeft = Math.ceil(5.0 - this.holdTimer);
            textContent = `<span class="text-white font-bold text-2xl drop-shadow-md font-mono">${timeLeft}</span>`;

            if (this.holdTimer > 4.0) colorClass = "border-emerald-500 bg-emerald-500/50 animate-pulse";
            else if (this.holdTimer > 2.0) colorClass = "border-yellow-400 bg-yellow-400/30";
            else colorClass = "border-red-500 bg-red-500/20";
        }

        el.className = `absolute rounded-full border-4 transition-all duration-300 flex items-center justify-center ${colorClass}`;
        el.innerHTML = textContent;
    },

    checkHoldLogic(dt) {
        // Distance check
        const pCx = this.playerX + PLAYER_SIZE / 2;
        const pCy = this.playerY + PLAYER_SIZE / 2;
        const dist = Math.sqrt(Math.pow(pCx - this.holdTarget.x, 2) + Math.pow(pCy - this.holdTarget.y, 2));

        if (dist < this.holdTarget.r) {
            this.isHolding = true;
            this.holdTimer += dt;

            // 5 seconds hold to success
            if (this.holdTimer >= 5.0) {
                this.successHold();
            }
        } else {
            this.isHolding = false;
            this.holdTimer = 0; // Reset if left
        }
        this.updateHoldTargetVisual();
    },

    successHold() {
        // Success!
        this.holdTimer = 0;
        this.score += 5; // 5 points per hold

        // Level Up every 10 points (every 2 holds)
        if (this.score % 10 === 0) {
            this.level++;
            this.timeLeft = 30; // Reset time for Hold
            // Make harder: Smaller radius (slower reduction)
            this.holdTarget.r = Math.max(20, this.holdTarget.r - 5);
            this.showNotification(`Odlično! Nivo ${this.level}`);
        } else {
            this.showNotification(`Dobro! +5 točk`);
        }

        // Move target
        const offset = 60 + (this.level * 5);
        this.holdTarget.x = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);
        this.holdTarget.y = (GAME_SIZE / 2) + (Math.random() * offset * 2 - offset);

        this.holdTarget.x = Math.max(80, Math.min(GAME_SIZE - 80, this.holdTarget.x));
        this.holdTarget.y = Math.max(80, Math.min(GAME_SIZE - 80, this.holdTarget.y));

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
            // document.getElementById('connectBtn').classList.add('hidden'); // Old behavior

            // Hide entire Connection UI block
            const connUI = document.getElementById('connection-ui');
            if (connUI) connUI.classList.add('hidden');

            // Update Battery Label
            const batLabel = document.getElementById('battery-label-text');
            if (batLabel) batLabel.innerText = "Deska povezana";

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
        const dx = this.inputRoll * speed;
        const dy = this.inputPitch * speed;

        if (this.activeGame === 'SLALOM') {
            // Slalom: Only X moves. Y is fixed.
            this.playerX += dx * 1.5;
        } else if (this.activeGame === 'MAZE') {
            // Sliding Collision Logic: Try X and Y movements independently
            let prevX = this.playerX;
            let prevY = this.playerY;

            // Try X movement
            let newX = prevX + dx;
            // Boundary Check X
            if (newX < 0) newX = 0;
            if (newX > GAME_SIZE - PLAYER_SIZE) newX = GAME_SIZE - PLAYER_SIZE;

            if (!MazeManager.checkCollision(newX, prevY)) {
                this.playerX = newX;
            }

            // Try Y movement
            let newY = prevY + dy;
            // Boundary Check Y
            if (newY < 0) newY = 0;
            if (newY > GAME_SIZE - PLAYER_SIZE) newY = GAME_SIZE - PLAYER_SIZE;

            if (!MazeManager.checkCollision(this.playerX, newY)) {
                this.playerY = newY;
            }
        } else {
            // Normal 2D movement for COIN, HOLD, TEST
            this.playerX += dx;
            this.playerY += dy;
        }

        // Final Boundary Checks for all modes (SLALOM only needs X, but Y is safe to check)
        if (this.playerX < 0) this.playerX = 0;
        if (this.playerX > GAME_SIZE - PLAYER_SIZE) this.playerX = GAME_SIZE - PLAYER_SIZE;
        if (this.playerY < 0) this.playerY = 0;
        if (this.playerY > GAME_SIZE - PLAYER_SIZE) this.playerY = GAME_SIZE - PLAYER_SIZE;

        // Apply visual position
        this.playerElem.style.left = this.playerX + 'px';
        this.playerElem.style.top = this.playerY + 'px';

        // Collision & Game Logic
        if (this.activeGame === 'COIN') {
            this.checkCoinCollision();
        } else if (this.activeGame === 'MAZE') {
            MazeManager.checkGoal(this.playerX, this.playerY);
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
            this.score += 1;
            this.coinsCollected++;
            this.updateHUD();
            this.coinElem.remove();

            if (this.coinsCollected >= 10) {
                this.coinsCollected = 0;
                this.level++;
                this.timeLeft = 60; // Reset timer was added by user, keep it? User didn't complain about it. "10 points means new level".
                // User said "10 points for new level is for every game". Didn't explicitly say "reset time". 
                // In Slalom user said "game ends after 2 min" (no reset).
                // In Coin, user previously added `this.timeLeft = 60`.
                // I'll keep the time reset for Coin as it's an "Endurance" style potentially?
                // Actually, user said "game of coins ... ups the level with each coin ... change that to 10".
                // Let's keep strict to "10 pts = level".
                this.showNotification(`Nivo ${this.level}! Kovanci so hitrejši.`);
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
        this.baseSpeed = difficulty === 'HARD' ? 2.5 : (difficulty === 'MEDIUM' ? 1.5 : 1.0);
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

                // Score: 1 pts per gate
                app.score += 1;

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
    cellSize: 10, // 10px blocks
    gridDim: 35,  // 350px / 10px = 35
    map: [],      // 35x35 grid of 0/1

    generate(level) {
        // Init full wall grid
        this.map = Array(this.gridDim).fill(0).map(() => Array(this.gridDim).fill(1));

        // Logical Grid for Maze (Paths need to be ~40px wide to fit 30px player)
        // 40px path + 10px wall = 50px logical cell.
        // 350 / 50 = 7 logical cells.
        const logicalDim = 7;
        const logicalGrid = Array(logicalDim).fill(0).map(() => Array(logicalDim).fill(0)); // Visited

        // Recursive Backtracker (DFS)
        const stack = [];
        const startR = 0;
        const startC = 0;

        logicalGrid[startR][startC] = 1; // Visited
        stack.push({ r: startR, c: startC });

        // Helper to carve physical grid
        function carve(lr, lc) {
            const pr = lr * 5 + 1;
            const pc = lc * 5 + 1;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    if (pr + i < 35 && pc + j < 35) MazeManager.map[pr + i][pc + j] = 0;
                }
            }
        }

        function carveWall(r1, c1, r2, c2) {
            const prStart = r1 * 5 + 1; // Align with path rows
            const pcStart = c1 * 5 + 1; // Align with path cols

            if (r1 === r2) { // Horizontal
                const wallC = Math.max(c1, c2) * 5;
                for (let i = 0; i < 4; i++) {
                    MazeManager.map[prStart + i][wallC] = 0;
                }
            } else { // Vertical
                const wallR = Math.max(r1, r2) * 5;
                for (let j = 0; j < 4; j++) {
                    MazeManager.map[wallR][pcStart + j] = 0;
                }
            }
        }

        carve(startR, startC);

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];

            // Check NESW
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            dirs.forEach(([dr, dc]) => {
                const nr = current.r + dr;
                const nc = current.c + dc;
                if (nr >= 0 && nr < logicalDim && nc >= 0 && nc < logicalDim && logicalGrid[nr][nc] === 0) {
                    neighbors.push({ r: nr, c: nc });
                }
            });

            if (neighbors.length > 0) {
                // Pick random
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Carve path
                carveWall(current.r, current.c, next.r, next.c);
                carve(next.r, next.c); // Carve destination room

                logicalGrid[next.r][next.c] = 1;
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        // Render
        this.render();
    },

    render() {
        const gameArea = document.getElementById('game-area');
        // Clear previous walls & goal
        const oldWalls = document.querySelectorAll('.wall');
        oldWalls.forEach(w => w.remove());
        const oldMazeWalls = document.querySelectorAll('.maze-wall'); // Clean up old types
        oldMazeWalls.forEach(w => w.remove());
        const oldGoal = document.getElementById('maze-goal');
        if (oldGoal) oldGoal.remove();


        for (let r = 0; r < this.gridDim; r++) {
            for (let c = 0; c < this.gridDim; c++) {
                if (this.map[r][c] === 1) {
                    const w = document.createElement('div');
                    w.className = 'wall absolute bg-slate-400 border border-slate-500 rounded-sm shadow-sm';
                    w.style.width = this.cellSize + 'px';
                    w.style.height = this.cellSize + 'px';
                    w.style.left = (c * this.cellSize) + 'px';
                    w.style.top = (r * this.cellSize) + 'px';
                    gameArea.appendChild(w);
                }
            }
        }

        // Add Goal Zone (Bottom-Right Logical Cell)
        // 7th logical cell is index 6. 6*5+1 = 31. Range 31..34.
        const goal = document.createElement('div');
        goal.className = 'absolute bg-green-400/30 border-2 border-green-500 animate-pulse flex items-center justify-center';
        goal.style.left = (31 * this.cellSize) + 'px'; // 310px
        goal.style.top = (31 * this.cellSize) + 'px'; // 310px
        goal.style.width = '40px';
        goal.style.height = '40px';
        goal.innerHTML = "🏁";
        goal.id = "maze-goal";
        gameArea.appendChild(goal);
    },

    checkCollision(pX, pY) {
        // Player Box
        const pLeft = pX;
        const pRight = pX + PLAYER_SIZE;
        const pTop = pY;
        const pBot = pY + PLAYER_SIZE;

        // Convert to Grid coords (min/max cells touched)
        // Safety margin: Shrink player box slightly for collision to avoid "snagging"
        const margin = 4;
        const c1 = Math.floor((pLeft + margin) / this.cellSize);
        const c2 = Math.floor((pRight - margin) / this.cellSize);
        const r1 = Math.floor((pTop + margin) / this.cellSize);
        const r2 = Math.floor((pBot - margin) / this.cellSize);

        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                if (r >= 0 && r < this.gridDim && c >= 0 && c < this.gridDim) {
                    if (this.map[r][c] === 1) return true; // Collision
                } else {
                    return true; // Out of bounds
                }
            }
        }
        return false;
    },

    checkGoal(pX, pY) {
        const margin = 4;
        const c1 = Math.floor((pX + margin) / this.cellSize);
        const r1 = Math.floor((pY + margin) / this.cellSize);

        // Check Goal
        // Goal is at 31,31 (logical 6,6)
        if (c1 >= 31 && r1 >= 31) {
            // Victory
            app.score += 10;
            app.level++;
            app.timeLeft = 60; // Reset time to 60s
            app.showNotification(`Labirint rešen! +10 točk (Nivo ${app.level})`);

            // Move player back to start (Logical 0,0 -> 10,10)
            app.playerX = 15; // 1*10 + margin
            app.playerY = 15;
            this.generate(app.level);
            return true;
        }
        return false;
    }
};

// Start App
app.init();