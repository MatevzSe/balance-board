/**
 * BALANCE FLOW - PLATFORM ENGINE
 * Handles Multi-Game logic, Profile persistence, and Bluetooth connectivity.
 */

// --- CONFIGURATION ---
const GAME_SIZE = 350;
const PLAYER_SIZE = 30;
const COIN_SIZE = 20;
const EDGE_CLIP = 8; // px the ball can clip beyond each edge before hard-stopping

// Bluetooth UUIDs
const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214";
const CHAR_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214";

// Game-specific difficulty descriptions shown on the difficulty selection screen
const DIFFICULTY_DESCRIPTIONS = {
    HOLD:   { EASY: "Velik cilj • Statično ravnotežje",      MEDIUM: "Srednji cilj • Propriocepcija",         HARD: "Majhen cilj • Mišična preciznost"     },
    SLALOM: { EASY: "Počasna vrata • Širok prehod",          MEDIUM: "Srednja hitrost • Ožji prehod",          HARD: "Hitra vrata • Natančno slalomiranje"   },
    COIN:   { EASY: "Kovanci se zadržijo dlje",               MEDIUM: "Standardni tempo zbiranja",              HARD: "Hitro menjavanje • Agilnost"            },
    MAZE:   { EASY: "Počasen tempo • Prostrani hodniki",      MEDIUM: "Normalna hitrost navigacije",            HARD: "Hitro • Ozki hodniki • Fokus"           }
};

const GAME_THEMES = {
    COIN: {
        icon: { cls: 'bg-teal-100 text-teal-600', path: 'M19 7a3 3 0 11-6 0 3 3 0 016 0zM4.5 19.5L10.5 12.5M6 13L10.5 12.5L11 17' },
        easy:   { btn: 'w-full py-4 bg-teal-50 hover:bg-teal-100 text-teal-800 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',   desc: 'text-xs text-teal-600/60 block' },
        medium: { btn: 'w-full py-4 bg-teal-100 hover:bg-teal-200 text-teal-900 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',  desc: 'text-xs text-teal-700/60 block' },
        hard:   { btn: 'w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-200 flex items-center px-5 gap-4 text-left', desc: 'text-xs text-white/70 block' },
        player: { bg: 'linear-gradient(135deg,#2dd4bf,#0d9488)', shadow: '0 4px 6px rgba(13,148,136,0.3)' },
        levelCls: 'text-2xl font-bold text-teal-600',
        areaBg: 'linear-gradient(135deg,#e0fdf4,#99f6e4)',
    },
    HOLD: {
        icon: { cls: 'bg-rose-100 text-rose-600', path: 'M7.5 3.75H6C4.75736 3.75 3.75 4.75736 3.75 6V7.5M16.5 3.75H18C19.2426 3.75 20.25 4.75736 20.25 6V7.5M20.25 16.5V18C20.25 19.2426 19.2426 20.25 18 20.25H16.5M7.5 20.25H6C4.75736 20.25 3.75 19.2426 3.75 18V16.5M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z' },
        easy:   { btn: 'w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-800 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',   desc: 'text-xs text-rose-600/60 block' },
        medium: { btn: 'w-full py-4 bg-rose-100 hover:bg-rose-200 text-rose-900 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',  desc: 'text-xs text-rose-700/60 block' },
        hard:   { btn: 'w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-rose-200 flex items-center px-5 gap-4 text-left', desc: 'text-xs text-white/70 block' },
        player: { bg: 'linear-gradient(135deg,#fb7185,#e11d48)', shadow: '0 4px 6px rgba(225,29,72,0.3)' },
        levelCls: 'text-2xl font-bold text-rose-600',
        areaBg: 'linear-gradient(135deg,#ffe4e6,#fecdd3)',
    },
    SLALOM: {
        icon: { cls: 'bg-sky-100 text-sky-600', path: 'M21 20H4C2 20 2 14 4 14H19C21 14 21 8 19 8H9V2M6 5L9 2L12 5' },
        easy:   { btn: 'w-full py-4 bg-sky-50 hover:bg-sky-100 text-sky-800 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',   desc: 'text-xs text-sky-600/60 block' },
        medium: { btn: 'w-full py-4 bg-sky-100 hover:bg-sky-200 text-sky-900 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',  desc: 'text-xs text-sky-700/60 block' },
        hard:   { btn: 'w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-sky-200 flex items-center px-5 gap-4 text-left', desc: 'text-xs text-white/70 block' },
        player: { bg: 'linear-gradient(135deg,#38bdf8,#0284c7)', shadow: '0 4px 6px rgba(2,132,199,0.3)' },
        levelCls: 'text-2xl font-bold text-sky-600',
        areaBg: 'linear-gradient(135deg,#e0f2fe,#bae6fd)',
    },
    MAZE: {
        icon: { cls: 'bg-orange-100 text-orange-600', path: 'M6 21V3M18 21V3M12 3V19M9 16L12 19L15 16' },
        easy:   { btn: 'w-full py-4 bg-orange-50 hover:bg-orange-100 text-orange-800 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',   desc: 'text-xs text-orange-600/60 block' },
        medium: { btn: 'w-full py-4 bg-orange-100 hover:bg-orange-200 text-orange-900 font-medium rounded-xl transition-all flex items-center px-5 gap-4 text-left',  desc: 'text-xs text-orange-700/60 block' },
        hard:   { btn: 'w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-orange-200 flex items-center px-5 gap-4 text-left', desc: 'text-xs text-white/70 block' },
        player: { bg: 'linear-gradient(135deg,#fb923c,#ea580c)', shadow: '0 4px 6px rgba(234,88,12,0.3)' },
        levelCls: 'text-2xl font-bold text-orange-600',
        areaBg: 'linear-gradient(135deg,#ffedd5,#fed7aa)',
    },
};

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
        },
        calibration: { // [NEW] Zero offsets
            pitch: 0,
            roll: 0
        }
    },

    ranks: [
        { min: 0,    title: "Začetnik" },
        { min: 100,  title: "Učenec" },
        { min: 300,  title: "Rekreativec" },
        { min: 600,  title: "Entuziast" },
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
                if (!this.data.calibration) {
                    this.data.calibration = { pitch: 0, roll: 0 };
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
        // Menu stats strip
        const elMenuScore = document.getElementById('menu-total-score');
        if (elMenuScore) elMenuScore.innerText = this.data.totalScore;

        const elMenuGames = document.getElementById('menu-games-played');
        if (elMenuGames) elMenuGames.innerText = this.data.gamesPlayed;

        const elMenuTime = document.getElementById('menu-play-time');
        if (elMenuTime) elMenuTime.innerText = Math.floor(this.data.totalTimeSec / 60);


        // Profile Stats
        const elProfileScore = document.getElementById('profile-total-score');
        if (elProfileScore) elProfileScore.innerText = this.data.totalScore;

        const elProfileTime = document.getElementById('profile-time');
        if (elProfileTime) elProfileTime.innerText = Math.floor(this.data.totalTimeSec / 60);

        const elProfileGames = document.getElementById('profile-games');
        if (elProfileGames) elProfileGames.innerText = this.data.gamesPlayed;

        // High Scores
        const elHsCoin = document.getElementById('hs-coin');
        if (elHsCoin) elHsCoin.innerText = this.data.highScores.COIN || '—';

        const elHsMaze = document.getElementById('hs-maze');
        if (elHsMaze) elHsMaze.innerText = this.data.highScores.MAZE || '—';

        const elHsHold = document.getElementById('hs-hold');
        if (elHsHold) elHsHold.innerText = this.data.highScores.HOLD || '—';

        const elHsSlalom = document.getElementById('hs-slalom');
        if (elHsSlalom) elHsSlalom.innerText = this.data.highScores.SLALOM || '—';

        // Experience / Rank
        const rank = this.getRankInfo();

        const elMenuRankTitle = document.getElementById('menu-rank-title');
        if (elMenuRankTitle) elMenuRankTitle.innerText = rank.title;

        const elMenuRankBar = document.getElementById('menu-rank-bar');
        if (elMenuRankBar) elMenuRankBar.style.width = rank.progress + '%';

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

// --- DAILY GOAL + STREAK MANAGER ---
const DailyGoalManager = {
    data: null,

    // 50 pts for first 3 ranks, 100 pts from Entuziast onward
    getGoal() {
        const score = ProfileManager.data?.totalScore ?? 0;
        return score >= ProfileManager.ranks[3].min ? 100 : 50;
    },

    _todayStr() {
        return new Date().toISOString().slice(0, 10);
    },

    _yesterdayStr() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    },

    init() {
        const today = this._todayStr();
        const stored = JSON.parse(localStorage.getItem('daily_goal_v1') || 'null');
        if (stored && stored.date === today) {
            this.data = stored;
            if (!this.data.goal) this.data.goal = this.getGoal();
        } else {
            this.data = {
                date: today,
                goal: this.getGoal(),
                progress: 0,
                achieved: false,
                streakCount: stored?.streakCount ?? 0,
                lastGoalDate: stored?.lastGoalDate ?? null,
                celebratedMilestones: stored?.celebratedMilestones ?? []
            };
            this._save();
        }
        this.updateUI();
    },

    addPoints(points) {
        if (!this.data || this.data.achieved || points <= 0) return;
        this.data.progress = Math.min(this.data.goal, this.data.progress + points);
        if (this.data.progress >= this.data.goal) {
            this.data.achieved = true;
            this._advanceStreak();
        }
        this._save();
        this.updateUI();
        if (this.data.achieved) this._celebrate();
    },

    _pendingMilestone: null,

    _advanceStreak() {
        const today = this._todayStr();
        if (this.data.lastGoalDate === today) return;
        this.data.streakCount = (this.data.lastGoalDate === this._yesterdayStr())
            ? this.data.streakCount + 1
            : 1;
        this.data.lastGoalDate = today;
        this._checkMilestone();
    },

    _checkMilestone() {
        const milestones = [
            { days: 7,   title: '7 dni zapored',    body: 'Navada se začne graditi.' },
            { days: 14,  title: 'Dva tedna zapored', body: 'Disciplina postaja del tebe.' },
            { days: 30,  title: '30 dni zapored',     body: 'To ni več naključje.' },
            { days: 100, title: '100 dni zapored',   body: 'Redki pridejo tako daleč.' },
        ];
        const celebrated = this.data.celebratedMilestones ?? [];
        const hit = milestones.find(m => m.days === this.data.streakCount && !celebrated.includes(m.days));
        if (hit) {
            this.data.celebratedMilestones = [...celebrated, hit.days];
            this._pendingMilestone = hit;
        }
    },

    _save() {
        localStorage.setItem('daily_goal_v1', JSON.stringify(this.data));
    },

    updateUI() {
        if (!this.data) return;
        const bar = document.getElementById('daily-goal-bar');
        const text = document.getElementById('daily-goal-text');

        const goal = this.data.goal;
        if (bar) bar.style.width = Math.min(100, (this.data.progress / goal) * 100) + '%';

        if (text) {
            if (this.data.achieved) {
                text.textContent = 'Doseženo ✓';
                text.className = 'text-xs font-bold text-teal-600 shrink-0';
            } else {
                text.textContent = `${this.data.progress} / ${goal}`;
                text.className = 'text-xs font-bold text-slate-600 shrink-0';
            }
        }

        const n = this.data.streakCount;
        const streakText = this._zapored(n);

        const streakLine = document.getElementById('streak-line');
        if (streakLine) {
            streakLine.textContent = streakText;
            streakLine.className = this.data.achieved ? 'text-xs font-medium text-teal-500' : 'text-xs text-slate-400';
        }

        const profileStreak = document.getElementById('profile-streak');
        if (profileStreak) profileStreak.textContent = streakText;
    },

    // Slovenian: 1 dan, 2+ dni, 101 dan, 11 dni (not 11 dan)
    _zapored(n) {
        const label = (n % 10 === 1 && n % 100 !== 11) ? 'dan' : 'dni';
        return `${n} ${label} zapored`;
    },

    _celebrate() {
        app.showNotification('Dnevni cilj dosežen! 🎯', 3000);
    }
};

// --- APP MANAGER ---
const app = {
    device: null,
    server: null,
    characteristic: null,
    isConnected: false,

    // Game State
    activeGame: 'COIN',
    isPlaying: false,
    difficulty: 'MEDIUM', // 'EASY', 'MEDIUM', 'HARD'
    rawPitch: 0,
    rawRoll: 0,
    batteryLevel: 0,
    displayedBatteryLevel: null,
    lastBatteryUpdateTimestamp: 0,
    isBatteryCharging: false,
    simInterval: null,
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
    gameDuration: 0, // Total seconds played in current session

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

    deferredPrompt: null,
    _simMouseHandler: null,
    onboardingSlide: 0,

    init() {
        ProfileManager.init();
        DailyGoalManager.init();

        // Connect Button
        document.getElementById('connectBtn').addEventListener('click', () => this.connectBluetooth());

        // Responsive Scaling
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize(); // Initial call

        // PWA Install Logic
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.deferredPrompt = e;
            // Update UI notify the user they can install the PWA
            const installUI = document.getElementById('install-ui');
            if (installUI) installUI.classList.remove('hidden');
        });

        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (!this.deferredPrompt) return;
                // Show the install prompt
                this.deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // We've used the prompt, and can't use it again, throw it away
                this.deferredPrompt = null;
                // Hide the install UI
                const installUI = document.getElementById('install-ui');
                if (installUI) installUI.classList.add('hidden');
            });
        }

        window.addEventListener('appinstalled', () => {
            // Log install to analytics
            console.log('PWA was installed');
            // Hide the install UI
            const installUI = document.getElementById('install-ui');
            if (installUI) installUI.classList.add('hidden');
            this.deferredPrompt = null;
        });

        // Initial View
        this.switchView('menu');

        // First-visit onboarding
        if (!localStorage.getItem('onboarding_seen')) {
            this.showOnboarding();
        }
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
        DailyGoalManager.updateUI();
    },

    showMenu() {
        this.endGameLogic(false); // Force stop without saving if just navigating
        this.switchView('menu');
        DailyGoalManager.updateUI();
        if (DailyGoalManager._pendingMilestone) {
            const m = DailyGoalManager._pendingMilestone;
            DailyGoalManager._pendingMilestone = null;
            setTimeout(() => this.showMilestoneModal(m), 400);
        }
    },

    showMilestoneModal(milestone) {
        document.getElementById('milestone-days').textContent = milestone.days;
        document.getElementById('milestone-title').textContent = milestone.title;
        document.getElementById('milestone-body').textContent = milestone.body;
        document.getElementById('milestone-modal').classList.remove('hidden');
    },

    closeMilestoneModal() {
        document.getElementById('milestone-modal').classList.add('hidden');
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
        toast.innerHTML = `<svg class="w-5 h-5 shrink-0 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg> <span class="font-medium">${message}</span>`;

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

        // Button Visibility Logic (Do this before branching for TEST)
        if (this.activeGame === 'TEST') {
            document.getElementById('cal-btn')?.classList.remove('hidden');
        } else {
            document.getElementById('cal-btn')?.classList.add('hidden');
        }

        // TEST Mode: Skip difficulty select
        if (gameMode === 'TEST') {
            this.startGame('MEDIUM'); // Default to medium for test
            return;
        }

        const theme = GAME_THEMES[gameMode];
        if (theme) {
            const iconEl = document.getElementById('diff-game-icon');
            if (iconEl) {
                iconEl.className = `w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${theme.icon.cls}`;
                iconEl.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="${theme.icon.path}"/></svg>`;
            }
            const easyBtn = document.getElementById('diff-btn-easy');
            const medBtn  = document.getElementById('diff-btn-medium');
            const hardBtn = document.getElementById('diff-btn-hard');
            if (easyBtn) easyBtn.className = theme.easy.btn;
            if (medBtn)  medBtn.className  = theme.medium.btn;
            if (hardBtn) hardBtn.className = theme.hard.btn;
            const easyDesc = document.getElementById('diff-easy-desc');
            const medDesc  = document.getElementById('diff-medium-desc');
            const hardDesc = document.getElementById('diff-hard-desc');
            if (easyDesc) easyDesc.className = theme.easy.desc;
            if (medDesc)  medDesc.className  = theme.medium.desc;
            if (hardDesc) hardDesc.className = theme.hard.desc;
        }

        const descs = DIFFICULTY_DESCRIPTIONS[gameMode] || {};
        const easyDesc = document.getElementById('diff-easy-desc');
        const medDesc  = document.getElementById('diff-medium-desc');
        const hardDesc = document.getElementById('diff-hard-desc');
        if (easyDesc) easyDesc.textContent = descs.EASY   || "Počasen tempo";
        if (medDesc)  medDesc.textContent  = descs.MEDIUM || "Normalna hitrost";
        if (hardDesc) hardDesc.textContent = descs.HARD   || "Visoka hitrost in natančnost";

        this.switchView('difficulty');
    },

    startGame(difficulty) {
        this.difficulty = difficulty;
        this.switchView('game');

        // Reset Game Data
        this.score = 0;
        this.timeLeft = 60; // 60s limit for most games
        if (this.activeGame === 'HOLD') this.timeLeft = 30; // 30s limit for Hold
        if (this.activeGame === 'MAZE') this.timeLeft = 60; // 60s limit for Maze
        if (this.activeGame === 'TEST') this.timeLeft = 600; // 10 min for Test/Calibration

        if (this.activeGame === 'MAZE') {
            this.playerX = 2;
            this.playerY = 2;
        } else {
            this.playerX = 160;
            this.playerY = 160;
        }
        this.isPlaying = true;
        this.level = 1;
        this.gameDuration = 0;

        // Mode Specific Resets
        this.coinsCollected = 0;
        this.coinIdleTime = 0;
        this.holdTimer = 0;
        this.isHolding = false;
        // Reset Hold Target to center initially
        this.holdTarget = { x: GAME_SIZE / 2, y: GAME_SIZE / 2, r: 80 };

        this.updateHUD();

        const theme = GAME_THEMES[this.activeGame];
        if (theme) {
            const player = document.getElementById('player');
            if (player) { player.style.background = theme.player.bg; player.style.boxShadow = theme.player.shadow; }
            const levelEl = document.getElementById('game-level');
            if (levelEl) levelEl.className = theme.levelCls;
        }

        // Setup Board based on game
        const gameArea = document.getElementById('game-area');
        // Clear old dynamic elements
        Array.from(gameArea.children).forEach(child => {
            if (child.id !== 'player') child.remove();
        });

        // FIX: Always use square/rounded-rect for consistency so user doesn't fall off
        gameArea.style.borderRadius = "10px";
        gameArea.style.background = theme?.areaBg || '#f1f5f9';
        gameArea.style.boxShadow = 'inset 0 0 20px rgba(0,0,0,0.05)';

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
            this.gameDuration++;

            // Skiing: No timer HUD update or countdown
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
        this.showLevelUp(this.level);
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
            message = `Igra prekinjena. Rezultat: ${this.score}`;
        } else if (this.activeGame === 'COIN') {
            // Coin is now endurance
            message = `Konec igre! Dosegel si stopnjo ${this.level}. Zbrani kovanci: ${this.score}`;
        } else if (this.activeGame === 'HOLD') {
            message = `Konec vaje! Dosegel si stopnjo ${this.level}.`;
        } else if (this.activeGame === 'MAZE') {
            message = `Čas je potekel!`;
        } else if (this.activeGame === 'SLALOM') {
            if (reason === 'CRASH') {
                message = `Napaka! Zadeli ste vratca.`;
            } else {
                message = `Vaja končana! Prevoženih vratc: ${this.score}.`;
            }
        } else if (this.activeGame === 'TEST') {
            message = "Konec testiranja.";
        }

        // Save Stats
        if (this.score > 0 && this.activeGame !== 'TEST') {
            DailyGoalManager.addPoints(this.score);
            ProfileManager.addSession({
                game: this.activeGame === 'COIN' ? "Kovanci" : (this.activeGame === 'MAZE' ? "Labirint" : (this.activeGame === 'SLALOM' ? "Slalom" : "Drži sredino")),
                diff: this.difficulty,
                score: this.score,
                time: this.gameDuration,
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
            if (reason === 'CRASH') {
                reasonText = (this.activeGame === 'SLALOM') ? "Napaka" : "Trk!";
            } else if (reason === 'QUIT') {
                reasonText = "Igra prekinjena";
            } else if (this.activeGame === 'TEST') {
                reasonText = "Test končan";
            } else if (this.activeGame === 'SLALOM') {
                reasonText = "Cilj!";
            }

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

    showOnboarding() {
        this.onboardingSlide = 0;
        this._updateOnboardingSlide();
        document.getElementById('onboarding-modal').classList.remove('hidden');
    },

    closeOnboarding() {
        document.getElementById('onboarding-modal').classList.add('hidden');
        localStorage.setItem('onboarding_seen', '1');
    },

    nextOnboardingSlide() {
        if (this.onboardingSlide < 3) {
            this.onboardingSlide++;
            this._updateOnboardingSlide();
        } else {
            this.closeOnboarding();
        }
    },

    prevOnboardingSlide() {
        if (this.onboardingSlide > 0) {
            this.onboardingSlide--;
            this._updateOnboardingSlide();
        }
    },

    _updateOnboardingSlide() {
        for (let i = 0; i < 4; i++) {
            document.getElementById(`onb-slide-${i}`).classList.toggle('hidden', i !== this.onboardingSlide);
            document.getElementById(`onb-dot-${i}`).className =
                `w-2 h-2 rounded-full transition-all ${i === this.onboardingSlide ? 'bg-teal-500' : 'bg-slate-200'}`;
        }
        document.getElementById('onb-prev').classList.toggle('hidden', this.onboardingSlide === 0);
        const nextBtn = document.getElementById('onb-next');
        nextBtn.textContent = this.onboardingSlide === 3 ? 'Začnimo!' : 'Naprej →';
    },

    showScorePop(x, y, text = '+1', color = '#0d9488') {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translateX(-50%);font-size:14px;font-weight:700;color:${color};pointer-events:none;z-index:20;animation:score-pop 0.6s ease-out forwards;`;
        el.textContent = text;
        document.getElementById('game-area').appendChild(el);
        setTimeout(() => el.remove(), 600);
    },

    showRingBurst(x, y, r) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;border:3px solid #fb7185;pointer-events:none;z-index:20;animation:ring-burst 0.5s ease-out forwards;`;
        document.getElementById('game-area').appendChild(el);
        setTimeout(() => el.remove(), 500);
    },

    showLevelUp(level) {
        this.updateHUD();
        const el = document.getElementById('game-level');
        if (!el) return;
        el.classList.remove('level-pop');
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add('level-pop');
        setTimeout(() => el.classList.remove('level-pop'), 650);
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
        this.showRingBurst(this.holdTarget.x, this.holdTarget.y, this.holdTarget.r);
        this.showScorePop(this.holdTarget.x, this.holdTarget.y, '+5', '#e11d48');
        this.holdTimer = 0;
        this.score += 5; // 5 points per hold

        // Level Up every 10 points (every 2 holds)
        if (this.score % 10 === 0) {
            this.level++;
            this.timeLeft = 30;
            this.holdTarget.r = Math.max(20, this.holdTarget.r - 5);
            this.showLevelUp(this.level);
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
        this.coinElem.style.cssText = `position:absolute;width:${COIN_SIZE}px;height:${COIN_SIZE}px;border-radius:50%;background:linear-gradient(135deg,#fde68a,#f59e0b);border:2px solid rgba(255,255,255,0.5);animation:coin-pulse 1.2s ease-out infinite;z-index:5;display:flex;align-items:center;justify-content:center;`;
        this.coinElem.innerHTML = `<svg style="width:12px;height:12px" fill="#92400e" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

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

    // --- CALIBRATION ---
    openCalibration() {
        const modal = document.getElementById('calibration-modal');
        if (modal) modal.classList.remove('hidden');

        // Start interval for live preview
        if (this.calInterval) clearInterval(this.calInterval);
        this.calInterval = setInterval(() => {
            const elP = document.getElementById('cal-pitch');
            const elR = document.getElementById('cal-roll');
            if (elP) {
                // Show corrected values using CURRENT offsets
                const correctedP = this.rawPitch - (ProfileManager.data.calibration.pitch || 0);
                elP.innerText = correctedP.toFixed(2);
            }
            if (elR) {
                const correctedR = this.rawRoll - (ProfileManager.data.calibration.roll || 0);
                elR.innerText = correctedR.toFixed(2);
            }
        }, 100);
    },

    closeCalibration() {
        const modal = document.getElementById('calibration-modal');
        if (modal) modal.classList.add('hidden');
        if (this.calInterval) clearInterval(this.calInterval);
    },

    saveCalibration() {
        // Use current raw values as new zero
        ProfileManager.data.calibration.pitch = this.rawPitch || 0;
        ProfileManager.data.calibration.roll = this.rawRoll || 0;
        ProfileManager.save();

        // Reset player in test environment to center
        if (this.activeGame === 'TEST') {
            this.playerX = 160;
            this.playerY = 160;
        }

        // Show success state on the button
        const btn = document.querySelector('#calibration-modal button[onclick="app.saveCalibration()"]');
        if (btn) {
            const oldText = btn.innerText;
            btn.innerText = "Ničelna točka nastavljena! ✓";
            btn.classList.replace('bg-teal-600', 'bg-green-600');

            setTimeout(() => {
                btn.innerText = oldText;
                btn.classList.replace('bg-green-600', 'bg-teal-600');
                this.closeCalibration();
                this.showNotification("Kalibracija shranjena!");
            }, 1000);
        } else {
            this.showNotification("Kalibracija shranjena!");
            this.closeCalibration();
        }
    },

    resetCalibration() {
        ProfileManager.data.calibration.pitch = 0;
        ProfileManager.data.calibration.roll = 0;
        ProfileManager.save();
        this.showNotification("Kalibracija ponastavljena na 0.");
        this.closeCalibration();
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
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());

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
            document.getElementById('device-status').innerText = "Povezava ni uspela";
            document.getElementById('device-status').className = "text-xs text-center text-rose-500 font-bold mb-2";
            const btn = document.getElementById('connectBtn');
            if (btn) btn.className = "w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl transition-all shadow-lg shadow-rose-200";
            this.showNotification("Povezava ni uspela. Preverite, če je deska vklopljena.", 5000);
        }
    },

    onDisconnect() {
        this.isConnected = false;
        this.isPlaying = false;
        cancelAnimationFrame(this.gameLoopId);

        const connUI = document.getElementById('connection-ui');
        if (connUI) connUI.classList.remove('hidden');

        document.getElementById('device-status').innerText = "Deska se je odklopila";
        document.getElementById('device-status').className = "text-xs text-center text-rose-500 font-bold mb-2";
        const btn = document.getElementById('connectBtn');
        if (btn) btn.className = "w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-200";

        this.showNotification("Deska se je odklopila!", 5000);
        this.showMenu();
    },

    // SIMULATION
    startSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);
        if (this._simMouseHandler) {
            document.removeEventListener('mousemove', this._simMouseHandler);
            document.removeEventListener('touchmove', this._simMouseHandler);
        }

        this.isConnected = true;
        document.getElementById('device-status').innerText = "Simulacija aktivna";
        document.getElementById('device-status').className = "text-center mb-2 text-teal-600 font-bold";

        const connUI = document.getElementById('connection-ui');
        if (connUI) connUI.classList.add('hidden');

        const batLabel = document.getElementById('battery-label-text');
        if (batLabel) batLabel.innerText = "Simulacija";

        // Move mouse over the game area to simulate board tilt
        this._simMouseHandler = (e) => {
            const gameArea = document.getElementById('game-area');
            if (!gameArea) return;
            const rect = gameArea.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const halfW = rect.width / 2;
            const halfH = rect.height / 2;
            this.rawRoll = Math.max(-5, Math.min(5, ((clientX - rect.left - halfW) / halfW) * 5));
            this.rawPitch = Math.max(-5, Math.min(5, ((clientY - rect.top - halfH) / halfH) * 5));
            this.inputRoll = this.rawRoll - (ProfileManager.data.calibration.roll || 0);
            this.inputPitch = this.rawPitch - (ProfileManager.data.calibration.pitch || 0);
        };
        document.addEventListener('mousemove', this._simMouseHandler);
        document.addEventListener('touchmove', this._simMouseHandler, { passive: true });

        this.simInterval = setInterval(() => {
            const bat = 52 + Math.floor(Math.random() * 4);

            const dbgPitch = document.getElementById('dbg-pitch');
            const dbgRoll = document.getElementById('dbg-roll');
            const dbgBat = document.getElementById('dbg-bat');
            const dbgBatPerc = document.getElementById('dbg-bat-perc');

            if (dbgPitch) dbgPitch.innerText = this.rawPitch.toFixed(2);
            if (dbgRoll) dbgRoll.innerText = this.rawRoll.toFixed(2);
            if (dbgBat) dbgBat.innerText = bat;
            if (dbgBatPerc) dbgBatPerc.innerText = bat + '%';

            this.processBatteryLevel(bat);
        }, 1000);

        this.showNotification("Simulacija zagnana. Premikaj miško nad igro.");
    },

    startChargingSimulation() {
        if (this.simInterval) clearInterval(this.simInterval);

        this.isConnected = true;
        document.getElementById('device-status').innerText = "Simulacija: POLNJENJE";
        document.getElementById('device-status').className = "text-center mb-2 text-indigo-600 font-bold";

        const connUI = document.getElementById('connection-ui');
        if (connUI) connUI.classList.add('hidden');

        const batLabel = document.getElementById('battery-label-text');
        if (batLabel) batLabel.innerText = "Simulacija";

        this.simInterval = setInterval(() => {
            // Simulate charging state (-1)
            const bat = -1;

            this.rawPitch = 0.0; // Stationary while charging
            this.rawRoll = 0.0;

            this.inputPitch = 0;
            this.inputRoll = 0;

            // Update Debug UI
            const dbgPitch = document.getElementById('dbg-pitch');
            const dbgRoll = document.getElementById('dbg-roll');
            const dbgBat = document.getElementById('dbg-bat');
            const dbgBatPerc = document.getElementById('dbg-bat-perc');

            if (dbgPitch) dbgPitch.innerText = "0.00";
            if (dbgRoll) dbgRoll.innerText = "0.00";
            if (dbgBat) dbgBat.innerText = bat;
            if (dbgBatPerc) dbgBatPerc.innerText = 'CHG';

            this.processBatteryLevel(bat);
        }, 1000);

        this.showNotification("Simulacija polnjenja zagnana.");
    },

    stopSimulation() {
        if (this.simInterval) {
            clearInterval(this.simInterval);
            this.simInterval = null;
        }
        if (this._simMouseHandler) {
            document.removeEventListener('mousemove', this._simMouseHandler);
            document.removeEventListener('touchmove', this._simMouseHandler);
            this._simMouseHandler = null;
        }
        this.onDisconnect();
        this.showNotification("Simulacija ustavljena.");
    },

    resetProfile() {
        localStorage.removeItem('balance_profile_v2');
        ProfileManager.data = {
            totalScore: 0,
            totalTimeSec: 0,
            gamesPlayed: 0,
            sessions: [],
            highScores: { COIN: 0, MAZE: 0, HOLD: 0, SLALOM: 0 },
            calibration: ProfileManager.data.calibration
        };
        ProfileManager.updateUI();
        this.showNotification("Zgodovina iger je bila izbrisana.");
    },

    handleData(event) {
        const value = event.target.value;
        const pitchInt = value.getInt16(0, true);
        const rollInt = value.getInt16(2, true);

        // Store raw for calibration view
        this.rawPitch = (pitchInt / 100.0);
        this.rawRoll = (rollInt / 100.0);

        // Apply Calibration
        this.inputPitch = this.rawPitch - (ProfileManager.data.calibration.pitch || 0);
        this.inputRoll = this.rawRoll - (ProfileManager.data.calibration.roll || 0);

        // Debug View Update
        const dbgPitch = document.getElementById('dbg-pitch');
        const dbgRoll = document.getElementById('dbg-roll');
        if (dbgPitch) dbgPitch.innerText = (pitchInt / 100.0).toFixed(2);
        if (dbgRoll) dbgRoll.innerText = (rollInt / 100.0).toFixed(2);

        // Battery Parsing (Bytes 4-5) - only if packet is long enough
        if (value.byteLength >= 6) {
            const batteryInt = value.getInt16(4, true);

            // Debug Battery
            const dbgBat = document.getElementById('dbg-bat');
            const dbgBatPerc = document.getElementById('dbg-bat-perc');
            if (dbgBat) dbgBat.innerText = batteryInt;
            if (dbgBatPerc) dbgBatPerc.innerText = batteryInt + '%';

            this.processBatteryLevel(batteryInt);
        }
    },

    processBatteryLevel(rawLevel) {
        const now = Date.now();
        const TWO_MINUTES_MS = 2 * 60 * 1000;

        if (rawLevel === -1) {
            // Charging state
            if (!this.isBatteryCharging) {
                this.isBatteryCharging = true;
                this.displayedBatteryLevel = null; // Reset so it updates immediately when unplugged
                this.updateBatteryUI();
            }
            return;
        }

        // Not charging
        if (this.isBatteryCharging) {
            this.isBatteryCharging = false;
            // Immediate update after charging
            this.batteryLevel = rawLevel;
            this.displayedBatteryLevel = rawLevel;
            this.lastBatteryUpdateTimestamp = now;
            this.updateBatteryUI();
            return;
        }

        this.batteryLevel = rawLevel;

        // First reading
        if (this.displayedBatteryLevel === null) {
            this.displayedBatteryLevel = rawLevel;
            this.lastBatteryUpdateTimestamp = now;
            this.updateBatteryUI();
            return;
        }

        // Check if 2 minutes passed
        if (now - this.lastBatteryUpdateTimestamp >= TWO_MINUTES_MS) {
            // Only update if it falls
            if (rawLevel < this.displayedBatteryLevel) {
                this.displayedBatteryLevel = rawLevel;
                this.updateBatteryUI();
            }
            // Always reset timer after 2 mins to keep the window moving
            this.lastBatteryUpdateTimestamp = now;
        }
    },

    updateBatteryUI() {
        const indicator = document.getElementById('battery-indicator');
        const levelText = document.getElementById('battery-level');
        const fill = document.getElementById('battery-fill');

        if (!indicator || !levelText || !fill) return;

        // Show indicator if we have valid data or charging
        if (this.isBatteryCharging || this.displayedBatteryLevel !== null) {
            indicator.classList.remove('opacity-0');
        } else {
            indicator.classList.add('opacity-0');
            return;
        }

        if (this.isBatteryCharging) {
            levelText.innerHTML = '<svg style="display:inline;width:14px;height:14px;vertical-align:middle" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
            fill.style.width = '100%';
            fill.className = "h-full bg-teal-500 rounded-sm animate-pulse transition-all duration-500";
        } else {
            levelText.innerHTML = this.displayedBatteryLevel + '%';
            fill.style.width = this.displayedBatteryLevel + '%';

            // Color Logic
            if (this.displayedBatteryLevel > 50) {
                fill.className = "h-full bg-teal-500 rounded-sm transition-all duration-500";
            } else if (this.displayedBatteryLevel > 20) {
                fill.className = "h-full bg-yellow-500 rounded-sm transition-all duration-500";
            } else {
                fill.className = "h-full bg-red-500 rounded-sm animate-pulse transition-all duration-500";
            }
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
            if (newX < -EDGE_CLIP) newX = -EDGE_CLIP;
            if (newX > GAME_SIZE - PLAYER_SIZE + EDGE_CLIP) newX = GAME_SIZE - PLAYER_SIZE + EDGE_CLIP;

            if (!MazeManager.checkCollision(newX, prevY)) {
                this.playerX = newX;
            }

            // Try Y movement
            let newY = prevY + dy;
            if (newY < -EDGE_CLIP) newY = -EDGE_CLIP;
            if (newY > GAME_SIZE - PLAYER_SIZE + EDGE_CLIP) newY = GAME_SIZE - PLAYER_SIZE + EDGE_CLIP;

            if (!MazeManager.checkCollision(this.playerX, newY)) {
                this.playerY = newY;
            }
        } else {
            // Normal 2D movement for COIN, HOLD, TEST
            this.playerX += dx;
            this.playerY += dy;
        }

        // Final Boundary Checks — allow EDGE_CLIP px of squash on each side
        if (this.playerX < -EDGE_CLIP) this.playerX = -EDGE_CLIP;
        if (this.playerX > GAME_SIZE - PLAYER_SIZE + EDGE_CLIP) this.playerX = GAME_SIZE - PLAYER_SIZE + EDGE_CLIP;
        if (this.playerY < -EDGE_CLIP) this.playerY = -EDGE_CLIP;
        if (this.playerY > GAME_SIZE - PLAYER_SIZE + EDGE_CLIP) this.playerY = GAME_SIZE - PLAYER_SIZE + EDGE_CLIP;

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
            this.showScorePop(cCenterX, cCenterY);
            this.coinElem.remove();

            if (this.coinsCollected >= 10) {
                this.coinsCollected = 0;
                this.level++;
                this.timeLeft = 60;
                this.showLevelUp(this.level);
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
        const baseGap = 160;
        const currentGap = Math.max(60, baseGap - (app.level * 5));
        const gap = currentGap;
        const minX = 40;
        const maxX = GAME_SIZE - 40;
        const gapX = Math.random() * (maxX - minX - gap) + minX;

        const area = document.getElementById('game-area');

        const poleHalfW = 4;

        // Poles only — no horizontal bars
        const poleL = document.createElement('div');
        poleL.className = 'slalom-gate absolute';
        poleL.style.cssText = `width:8px;height:30px;border-radius:4px;background:#f43f5e;left:${gapX - poleHalfW}px;top:${yPos - 5}px;z-index:3;box-shadow:0 0 6px rgba(244,63,94,0.5);`;

        const poleR = document.createElement('div');
        poleR.className = 'slalom-gate absolute';
        poleR.style.cssText = `width:8px;height:30px;border-radius:4px;background:#0ea5e9;left:${gapX + gap - poleHalfW}px;top:${yPos - 5}px;z-index:3;box-shadow:0 0 6px rgba(14,165,233,0.5);`;

        area.appendChild(poleL);
        area.appendChild(poleR);

        this.gates.push({ y: yPos, gapX, gapW: gap, elL: poleL, elR: poleR, elPL: poleL, elPR: poleR, passed: false });
    },

    update() {
        const currentSpeed = this.baseSpeed + (app.level * 0.5);

        for (let i = this.gates.length - 1; i >= 0; i--) {
            const g = this.gates[i];
            g.y += currentSpeed;

            g.elL.style.top = g.y + 'px';
            g.elR.style.top = g.y + 'px';
            g.elPL.style.top = (g.y - 5) + 'px';
            g.elPR.style.top = (g.y - 5) + 'px';

            const playerTop = app.playerY;
            const playerBot = app.playerY + PLAYER_SIZE;

            if (g.y + 25 > playerTop && g.y - 5 < playerBot) {
                const pLeft  = app.playerX;
                const pRight = app.playerX + PLAYER_SIZE;
                const gapLeft  = g.gapX;
                const gapRight = g.gapX + g.gapW;

                if (pLeft > gapLeft && pRight < gapRight) {
                    if (!g.passed) {
                        g.elL.style.background = '#4ade80';
                        g.elR.style.background = '#4ade80';
                        g.elPL.style.background = '#4ade80';
                        g.elPR.style.background = '#4ade80';
                    }
                } else {
                    if (!g.passed) {
                        g.elL.style.background = '#f87171';
                        g.elR.style.background = '#f87171';
                        g.elPL.style.background = '#f87171';
                        g.elPR.style.background = '#f87171';
                        app.endGameLogic(true, 'CRASH');
                        return;
                    }
                }
            }

            if (g.y > playerBot && !g.passed) {
                g.passed = true;
                this.gatesPassed++;
                app.score += 1;
                app.showScorePop(g.gapX + g.gapW / 2, app.playerY, '+1', '#0284c7');
                if (this.gatesPassed % 10 === 0) {
                    app.levelUpSlalom();
                }
                app.updateHUD();
            }

            if (g.y > GAME_SIZE) {
                g.elL.remove();
                g.elR.remove();
                g.elPL.remove();
                g.elPR.remove();
                this.gates.splice(i, 1);
                const lastY = this.gates.length > 0 ? Math.min(...this.gates.map(x => x.y)) : 0;
                this.spawnGate(lastY - 200);
            }
        }

        if (this.gates.length < 3) {
            const lastY = this.gates.length > 0 ? Math.min(...this.gates.map(x => x.y)) : 0;
            this.spawnGate(lastY - 200);
        }
    }
};

// --- MAZE MANAGER ---
const MazeManager = {
    cellSize: 10,
    gridDim: 35,
    map: [],
    logicalDim: 7,
    cellsPerRoom: 5,
    difficulty: 'MEDIUM',
    goalPhysical: 31,

    generate(difficulty) {
        this.difficulty = difficulty;
        this.cellsPerRoom = difficulty === 'EASY' ? 7 : 5;
        this.logicalDim   = difficulty === 'EASY' ? 5 : 7;
        this.goalPhysical = (this.logicalDim - 1) * this.cellsPerRoom;

        const cpr = this.cellsPerRoom;
        const dim = this.logicalDim;

        this.map = Array(this.gridDim).fill(0).map(() => Array(this.gridDim).fill(1));
        const logicalGrid = Array(dim).fill(0).map(() => Array(dim).fill(0));

        const stack = [];
        logicalGrid[0][0] = 1;
        stack.push({ r: 0, c: 0 });

        function carve(lr, lc) {
            const prStart = lr * cpr;
            const pcStart = lc * cpr;
            const prEnd = (lr === dim - 1) ? MazeManager.gridDim : prStart + cpr - 1;
            const pcEnd = (lc === dim - 1) ? MazeManager.gridDim : pcStart + cpr - 1;
            for (let i = prStart; i < prEnd; i++) {
                for (let j = pcStart; j < pcEnd; j++) {
                    MazeManager.map[i][j] = 0;
                }
            }
        }

        function carveWall(r1, c1, r2, c2) {
            if (r1 === r2) {
                const wallC = Math.max(c1, c2) * cpr - 1;
                const prStart = r1 * cpr;
                const prEnd = (r1 === dim - 1) ? MazeManager.gridDim - 1 : prStart + cpr - 2;
                for (let i = prStart; i <= prEnd; i++) MazeManager.map[i][wallC] = 0;
            } else {
                const wallR = Math.max(r1, r2) * cpr - 1;
                const pcStart = c1 * cpr;
                const pcEnd = (c1 === dim - 1) ? MazeManager.gridDim - 1 : pcStart + cpr - 2;
                for (let j = pcStart; j <= pcEnd; j++) MazeManager.map[wallR][j] = 0;
            }
        }

        carve(0, 0);

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr, dc]) => {
                const nr = current.r + dr;
                const nc = current.c + dc;
                if (nr >= 0 && nr < dim && nc >= 0 && nc < dim && logicalGrid[nr][nc] === 0) {
                    neighbors.push({ r: nr, c: nc });
                }
            });

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                carveWall(current.r, current.c, next.r, next.c);
                carve(next.r, next.c);
                logicalGrid[next.r][next.c] = 1;
                stack.push(next);
            } else {
                stack.pop();
            }
        }

        this.render();
    },

    render() {
        const gameArea = document.getElementById('game-area');

        const oldGoal = document.getElementById('maze-goal');
        if (oldGoal) oldGoal.remove();

        let canvas = document.getElementById('maze-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'maze-canvas';
            canvas.width = GAME_SIZE;
            canvas.height = GAME_SIZE;
            canvas.style.cssText = 'position:absolute;top:0;left:0;z-index:1;';
            gameArea.appendChild(canvas);
        }

        const ctx = canvas.getContext('2d');
        // Fill everything as wall, then punch out passable cells so gradient shows through
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, 0, GAME_SIZE, GAME_SIZE);

        for (let r = 0; r < this.gridDim; r++) {
            for (let c = 0; c < this.gridDim; c++) {
                if (this.map[r][c] === 0) {
                    ctx.clearRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }

        const goalSize = (this.gridDim - this.goalPhysical) * this.cellSize;
        const goalPx   = this.goalPhysical * this.cellSize;
        const iconSize = Math.min(24, goalSize - 8);

        const goal = document.createElement('div');
        goal.id = 'maze-goal';
        goal.className = 'absolute bg-orange-400/30 border-2 border-orange-500 animate-pulse flex items-center justify-center';
        goal.style.left   = goalPx + 'px';
        goal.style.top    = goalPx + 'px';
        goal.style.width  = goalSize + 'px';
        goal.style.height = goalSize + 'px';
        goal.style.zIndex = '2';
        goal.innerHTML = `<svg style="width:${iconSize}px;height:${iconSize}px;display:block;margin:auto" fill="none" stroke="#ea580c" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/></svg>`;
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
        const c1 = Math.max(0, Math.floor((pLeft + margin) / this.cellSize));
        const c2 = Math.min(this.gridDim - 1, Math.floor((pRight - margin) / this.cellSize));
        const r1 = Math.max(0, Math.floor((pTop + margin) / this.cellSize));
        const r2 = Math.min(this.gridDim - 1, Math.floor((pBot - margin) / this.cellSize));

        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                if (this.map[r][c] === 1) return true;
            }
        }
        return false;
    },

    checkGoal(pX, pY) {
        const margin = 4;
        const c1 = Math.floor((pX + margin) / this.cellSize);
        const r1 = Math.floor((pY + margin) / this.cellSize);

        if (c1 >= this.goalPhysical && r1 >= this.goalPhysical) {
            const goalPx = this.goalPhysical * this.cellSize;
            const goalCenter = goalPx + (this.gridDim - this.goalPhysical) * this.cellSize / 2;
            app.showScorePop(goalCenter, goalCenter, '+10', '#ea580c');
            app.score += 10;
            app.level++;
            app.timeLeft = 60;
            app.showLevelUp(app.level);
            app.playerX = 2;
            app.playerY = 2;
            this.generate(this.difficulty);
            return true;
        }
        return false;
    }
};

// Start App
app.init();