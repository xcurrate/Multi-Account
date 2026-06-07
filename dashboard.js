const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');
const state = require('./src/state');
const runtimeStatsService = require('./src/services/stats');

// --- CONSTANTS & CONFIGURATION ---
const CONSTANTS = {
    DEFAULT_PORT: 4002,
    MAX_LOG_LINES: 15,
    LOG_REFRESH_INTERVAL_MS: 1000,
    REDIRECT_DELAY_SECONDS: 1,
    CONFIG_FILE: 'config.json',
    PROFILES_META_FILE: 'profiles/meta.json',
    DEFAULT_DELAYS: {
        hunt: { min: 15000, max: 15000 },
        battle: { min: 15000, max: 15000 },
        pray: { min: 15000, max: 15000 },
        custom1: { min: 60000, max: 120000 },
        custom2: { min: 60000, max: 120000 }
    }
};

// --- LOGGER INITIALIZATION ---
const logger = require('./logger');

// --- FILE PATHS ---
const configPath = path.join(__dirname, CONSTANTS.CONFIG_FILE);

// --- UTILITY FUNCTIONS ---
const fileService = {
    readJson(filePath, defaultValue = {}) {
        try {
            if (!fs.existsSync(filePath)) return defaultValue;
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error reading JSON from ${filePath}:`, error.message);
            return defaultValue;
        }
    },

    writeJson(filePath, obj) {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing JSON to ${filePath}:`, error.message);
            return false;
        }
    }
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const serializeForScript = (value) => JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

// --- PROFILE MANAGER ---
const profileManager = {
    getUserId(token) {
        if (!token || typeof token !== 'string') return 'default';
        try {
            const base64Id = token.split('.')[0];
            const decodedId = Buffer.from(base64Id, 'base64').toString('utf8');
            return /^\d+$/.test(decodedId) ? decodedId : 'default';
        } catch {
            return 'default';
        }
    },

    getProfilePath(id) {
        const dir = path.join(__dirname, 'profiles');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, `config_${id}.json`);
    },

    getMetaPath() {
        const dir = path.join(__dirname, 'profiles');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, 'meta.json');
    },

    readMeta() {
        const meta = fileService.readJson(this.getMetaPath(), { profiles: {} });
        if (!meta.profiles || typeof meta.profiles !== 'object') meta.profiles = {};
        return meta;
    },

    getSavedProfiles() {
        const dir = path.join(__dirname, 'profiles');
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(f => f.startsWith('config_') && f.endsWith('.json'))
            .map(f => f.replace('config_', '').replace('.json', ''));
    },

    saveProfileMeta(id, username, globalName, avatar) {
        const metaPath = this.getMetaPath();
        let meta = this.readMeta();
        
        meta.profiles[id] = {
            username,
            globalName,
            avatar
        };
        
        fileService.writeJson(metaPath, meta);
    },

    getProfileMeta(id) {
        const meta = this.readMeta();
        return meta.profiles && meta.profiles[id] ? meta.profiles[id] : null;
    },

    getProfileDisplayName(id) {
        const meta = this.getProfileMeta(id);
        if (meta && meta.globalName) {
            return meta.globalName;
        } else if (meta && meta.username) {
            return `@${meta.username}`;
        }
        return `Akun ${id}`;
    }
};

// --- CONFIG MANAGER ---
const configManager = {
    get() {
        return fileService.readJson(configPath);
    },

    save(config) {
        return fileService.writeJson(configPath, config);
    },

    ensureShape(config) {
        config.port = config.port || CONSTANTS.DEFAULT_PORT;
        config.botStatus = config.botStatus || { running: false, paused: false };
        config.channels = Array.isArray(config.channels) ? config.channels : [];
        config.macrodroidId = config.macrodroidId || "";
        config.autosolver = config.autosolver || false;
        config.maxLogLines = config.maxLogLines || CONSTANTS.MAX_LOG_LINES;
        
        config.settings = config.settings || {};
        config.delays = config.delays || {};
        config.safety = config.safety || { cctv: false };
        config.tiketandhb = config.tiketandhb || { channelId: "" };
        config.huntbot = config.huntbot || { enabled: true, autoMode: true, defaultUpgrade: 'duration', defaultDuration: '1D', notifyProgress: true };

        config.settings.twoCaptchaKey = config.settings.twoCaptchaKey || "";
        config.settings.control = config.settings.control || { start: 'wcash', pause: 'wbuy 1', allowIds: [] };
        config.settings.channelRotation = config.settings.channelRotation || { enabled: false, minMs: 180000, maxMs: 360000 };
        config.settings.boss = config.settings.boss || { enabled: true, allowedGuilds: [] };
        config.settings.messageFilter = config.settings.messageFilter || { enabled: true, channelIds: [], guildIds: [], debug: false, debugOnlyOwO: false };
        config.settings.telegram = config.settings.telegram || { token: "", chatId: "" };
        config.settings.voice = config.settings.voice || { enabled: false, channelId: "" };

        Object.keys(CONSTANTS.DEFAULT_DELAYS).forEach(key => {
            config.delays[key] = {
                ...CONSTANTS.DEFAULT_DELAYS[key],
                ...(config.delays[key] || {})
            };
        });

        return config;
    },

    applySave(config, body) {
        config.token = body.token || config.token; 
        config.port = this.toInt(body.port, config.port);
        config.macrodroidId = body.macrodroidId || '';
        config.autosolver = this.toBool(body.autosolver);

        const channels = [body.chan1, body.chan2, body.chan3]
            .filter(ch => ch && String(ch).trim() !== '')
            .map(ch => String(ch).trim());
        config.channels = channels;

        config.settings.battle = this.toBool(body.battle);
        config.settings.hunt = this.toBool(body.hunt);
        config.settings.pray = this.toBool(body.pray);
        config.settings.custom = this.toBool(body.custom);
        config.settings.twoCaptchaKey = body.twoCaptchaKey || '';

        config.settings.text1 = body.text1 || '';
        config.settings.text2 = body.text2 || '';

        config.delays.hunt.min = this.toInt(body.huntMin, config.delays.hunt.min);
        config.delays.hunt.max = this.toInt(body.huntMax, config.delays.hunt.max);
        config.delays.battle.min = this.toInt(body.battleMin, config.delays.battle.min);
        config.delays.battle.max = this.toInt(body.battleMax, config.delays.battle.max);
        config.delays.pray.min = this.toInt(body.prayMin, config.delays.pray.min);
        config.delays.pray.max = this.toInt(body.prayMax, config.delays.pray.max);
        config.delays.custom1.min = this.toInt(body.c1Min, config.delays.custom1.min);
        config.delays.custom1.max = this.toInt(body.c1Max, config.delays.custom1.max);
        config.delays.custom2.min = this.toInt(body.c2Min, config.delays.custom2.min);
        config.delays.custom2.max = this.toInt(body.c2Max, config.delays.custom2.max);

        config.settings.telegram.token = body.tgToken || '';
        config.settings.telegram.chatId = body.tgChat || '';

        config.maxLogLines = this.toInt(body.maxLogLines, 15);
        config.settings.autoResume = this.toBool(body.autoResume);
        
        config.settings.control.start = body.ctrlStart || 'wcash';
        config.settings.control.pause = body.ctrlPause || 'wbuy 1';
        config.settings.control.allowIds = this.toArray(body.ctrlAllowIds);

        config.settings.channelRotation.enabled = this.toBool(body.crEnabled);
        config.settings.channelRotation.minMs = this.toInt(body.crMin, 180000);
        config.settings.channelRotation.maxMs = this.toInt(body.crMax, 360000);

        config.settings.boss.enabled = this.toBool(body.bossEnabled);
        config.settings.boss.allowedGuilds = this.toArray(body.bossGuilds);

        config.settings.messageFilter.enabled = this.toBool(body.mfEnabled);
        config.settings.messageFilter.channelIds = this.toArray(body.mfChannelIds);
        config.settings.messageFilter.guildIds = this.toArray(body.mfGuildIds);
        config.settings.messageFilter.debug = this.toBool(body.mfDebug);
        config.settings.messageFilter.debugOnlyOwO = this.toBool(body.mfDebugOnlyOwO);

        config.settings.voice.enabled = this.toBool(body.voiceEnabled);
        config.settings.voice.channelId = body.voiceChannelId || '';

        config.huntbot.enabled = this.toBool(body.hbEnabled);
        config.huntbot.autoMode = this.toBool(body.hbAutoMode);
        config.huntbot.notifyProgress = this.toBool(body.hbNotify);
        config.huntbot.defaultUpgrade = body.hbUpgrade || 'duration';
        config.huntbot.defaultDuration = body.hbDuration || '1D';
        config.tiketandhb.channelId = body.tiketandhbChannel || '';
        
        config.safety.cctv = this.toBool(body.cctvEnabled);

        return config;
    },

    applyAction(config, action) {
        switch (action) {
            case 'start':
                config.botStatus.running = true;
                config.botStatus.paused = false;
                break;
            case 'pause':
                config.botStatus.paused = true;
                config.botStatus.running = false;
                break;
        }
        return config;
    },

    toInt(value, fallback = 0) {
        const num = parseInt(value, 10);
        return Number.isFinite(num) ? num : fallback;
    },

    toBool(value) {
        return !!value;
    },

    toArray(value) {
        if (!value) return [];
        return value.split(',').map(s => s.trim()).filter(Boolean);
    },

    computeStatus(config) {
        const isPaused = !!config.botStatus?.paused;
        const isRunning = !!config.botStatus?.running;

        let statusText = '⏹ OFFLINE';
        let statusClass = 'offline';

        if (isRunning) {
            statusText = isPaused ? '⏸ PAUSED' : '▶ RUNNING';
            statusClass = isPaused ? 'paused' : 'running';
        }

        return { statusText, statusClass };
    }
};

// --- LOG SERVICE ---
const logService = {
    getRecentLines() {
        try {
            return logger && typeof logger.getRecent === 'function' 
                ? logger.getRecent() 
                : [];
        } catch {
            return [];
        }
    }
};

// --- STATS SERVICE ---
const statsService = {
    formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [];
        if (days) parts.push(`${days}d`);
        if (hours || days) parts.push(`${hours}h`);
        if (minutes || hours || days) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        return parts.join(' ');
    },

    formatTime(timestamp) {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: 'short'
        });
    },

    getSnapshot(config) {
        const accountStats = runtimeStatsService.ensureAccountStats(state, config.token);
        const snapshotAccountId = runtimeStatsService.getAccountIdFromToken(config.token);
        const activeAccountId = runtimeStatsService.getAccountIdFromToken(state.activeToken || state.config?.token);
        const commandStats = accountStats.commands || { total: 0, byType: {}, recent: [], last: null };
        const captchaStats = accountStats.captcha || { detected: 0, solved: 0, lastDetectedAt: null, lastSolvedAt: null };
        const uptimeMs = runtimeStatsService.getUptimeMs(state, config.token, {
            sync: snapshotAccountId === activeAccountId
        });
        const { statusText, statusClass } = configManager.computeStatus(config);

        return {
            status: {
                text: statusText,
                className: statusClass,
                activeChannelId: state.activeChannelId || '-',
                channelsTotal: Array.isArray(config.channels) ? config.channels.length : 0,
                running: !!config.botStatus?.running,
                paused: !!config.botStatus?.paused,
                captchaActive: !!state.hasActiveCaptcha,
                autosolver: !!config.autosolver,
                telegram: !!(config.settings?.telegram?.token && config.settings?.telegram?.chatId)
            },
            commands: {
                total: commandStats.total || 0,
                byType: commandStats.byType || {},
                recent: Array.isArray(commandStats.recent) ? commandStats.recent : [],
                last: commandStats.last || null
            },
            captcha: {
                detected: captchaStats.detected || 0,
                solved: captchaStats.solved || 0,
                active: !!state.hasActiveCaptcha,
                lastDetectedAt: captchaStats.lastDetectedAt || null,
                lastSolvedAt: captchaStats.lastSolvedAt || null
            },
            uptime: {
                ms: uptimeMs,
                text: this.formatDuration(uptimeMs),
                startedAt: this.formatTime(accountStats.uptime?.lastStartedAt)
            }
        };
    }
};

// --- UI COMPONENTS ---
const uiComponents = {
    getStyles() {
        return `
        <style>
            :root {
                --bg: #0c1118;
                --panel: #121923;
                --panel-soft: #182231;
                --panel-strong: #1d2939;
                --text: #eef2f6;
                --muted: #98a2b3;
                --border: #263345;
                --accent: #8ea4ff;
                --accent-solid: #5865f2;
                --green: #47cd89;
                --red: #f97066;
                --yellow: #fdb022;
                --blue-soft: #202b46;
                --green-soft: #163526;
                --red-soft: #3b1f23;
                --yellow-soft: #3a2d16;
                --mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, 'Segoe UI', system-ui, sans-serif; }
            html { background: var(--bg); }
            body { background: var(--bg); color: var(--text); padding: 18px; font-size: 14px; min-height: 100vh; }
            .container { max-width: 1120px; margin: 0 auto; padding-bottom: 48px; }
            h2 { text-align: center; color: var(--text); margin-bottom: 12px; font-weight: 850; letter-spacing: -0.03em; }
            .subtitle { text-align: center; color: var(--muted); margin: -6px 0 18px; line-height: 1.5; }
            .status-box { padding: 16px; border-radius: 18px; text-align: center; font-weight: 750; margin-bottom: 16px; border: 1px solid var(--border); background: var(--panel); }
            .running { color: var(--green); border-color: #23543a; background: var(--green-soft); }
            .paused { color: var(--red); border-color: #66343a; background: var(--red-soft); }
            .offline { color: var(--muted); border-color: var(--border); background: var(--panel); }
            .profile-box { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; padding: 10px; background: var(--panel-soft); border: 1px solid var(--border); border-radius: 12px; font-weight: 500; font-size: 13px; color: var(--muted); }
            .profile-box img { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); }
            .profile-preview { display: none; align-items: center; gap: 8px; margin-top: 8px; padding: 10px; background: var(--blue-soft); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 13px; }
            .profile-preview.visible { display: flex; }
            .profile-preview strong { color: var(--accent); }
            .tabs-wrapper { display: flex; background: var(--panel); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 15px; overflow: hidden; }
            .tab-btn { flex: 1; padding: 13px; background: transparent; color: var(--muted); border: none; cursor: pointer; font-weight: 750; font-size: 14px; }
            .tab-btn:hover { background: var(--panel-soft); color: var(--text); }
            .tab-btn.active { background: var(--panel-strong); color: var(--text); border-bottom: 2px solid var(--accent); }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .card { background: var(--panel); padding: 16px; border-radius: 18px; margin-bottom: 16px; border: 1px solid var(--border); }
            .card-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
            label, .section-label { display: block; margin-top: 10px; font-size: 0.78em; color: var(--muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
            label:first-child { margin-top: 0; }
            input[type=text], input[type=password], input[type=number], select.input-select {
                width: 100%; padding: 12px; margin-top: 5px; background: var(--panel-soft); border: 1px solid var(--border);
                color: var(--text); border-radius: 10px; outline: none; font-size: 14px; font-family: inherit;
            }
            select.input-select { appearance: auto; cursor: pointer; }
            input:focus, select.input-select:focus { border-color: var(--accent); }
            input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-solid); }
            .row { display: flex; gap: 10px; margin-top: 8px; }
            .col { flex: 1; }
            .toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
            .toggle-row:last-child { border-bottom: none; }
            .btn { width: 100%; padding: 14px; border: 1px solid transparent; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 14px; letter-spacing: 0.01em; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
            .btn-save { background: var(--accent-solid); color: white; }
            .btn-start { background: #208a5d; color: white; flex: 1; }
            .btn-pause { background: #b93838; color: white; flex: 1; }
            .btn-secondary { background: var(--panel-soft); color: var(--text); border-color: var(--border); }
            .action-group { display: flex; gap: 10px; margin-bottom: 16px; }
            .divider { border-top: 1px solid var(--border); margin: 16px 0; }
            .dashboard-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
            .stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 18px; padding: 15px; min-height: 118px; }
            .stat-label { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
            .stat-value { color: var(--text); font-size: 25px; font-weight: 850; line-height: 1.1; }
            .stat-note { color: var(--muted); font-size: 12px; margin-top: 7px; overflow-wrap: anywhere; line-height: 1.45; }
            .info-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
            .info-item { background: var(--panel-soft); border: 1px solid var(--border); border-radius: 12px; padding: 11px; }
            .pill-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
            .pill { border: 1px solid var(--border); background: var(--panel-soft); border-radius: 999px; padding: 7px 10px; font-size: 12px; color: var(--text); }
            .recent-list { display: grid; gap: 8px; margin-top: 10px; }
            .recent-item { display: grid; grid-template-columns: 92px 90px 1fr; gap: 10px; align-items: center; background: var(--panel-soft); border: 1px solid var(--border); border-radius: 12px; padding: 9px 10px; color: var(--text); font-size: 12px; }
            .recent-muted { color: var(--muted); }
            .log-box { background: #0a0f16; color: #d0d5dd; border: 1px solid var(--border); border-radius: 14px; padding: 0; font-family: var(--mono); font-size: 12px; line-height: 1.45; overflow-y: auto; max-height: 320px; }
            .log-line { display: grid; grid-template-columns: 78px 88px 1fr; gap: 10px; padding: 9px 12px; border-bottom: 1px solid #182231; white-space: pre-wrap; word-break: break-word; }
            .log-line:last-child { border-bottom: none; }
            .log-time { color: #98a2b3; }
            .log-level { color: #b9c7ff; font-weight: 800; }
            .log-message { color: #eaecf0; }
            .log-empty { padding: 16px; color: #98a2b3; }
            .input-hint { font-size: 11px; color: var(--muted); margin-top: 5px; line-height: 1.45; }
            .telegram-badge { background: var(--blue-soft); border: 1px solid var(--border); border-radius: 999px; padding: 5px 9px; font-size: 11px; color: var(--accent); display: inline-block; margin-top: 8px; }
            @media (max-width: 920px) { .dashboard-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .info-grid { grid-template-columns: 1fr; } }
            @media (max-width: 760px) { body { padding: 12px; } .dashboard-grid, .info-grid { grid-template-columns: 1fr; } .row, .action-group, .card-title { flex-direction: column; align-items: stretch; } .log-line, .recent-item { grid-template-columns: 1fr; gap: 3px; } .stat-card { min-height: auto; } }
        </style>
        `;
    },

    getDashboardStatsCard(snapshot) {
        const commandTypes = Object.entries(snapshot.commands.byType || {})
            .sort((a, b) => b[1] - a[1])
            .map(([type, total]) => `<span class="pill">${escapeHtml(type)}: <strong>${total}</strong></span>`)
            .join('') || '<span class="pill">Belum ada command</span>';

        const recentCommands = (snapshot.commands.recent || []).slice(-5).reverse()
            .map(item => `
                <div class="recent-item">
                    <span class="recent-muted">${escapeHtml(statsService.formatTime(item.at))}</span>
                    <strong>${escapeHtml(item.type || 'Command')}</strong>
                    <span>${escapeHtml(item.cmd || '-')}</span>
                </div>
            `)
            .join('') || '<div class="recent-item"><span class="recent-muted">Belum ada command terkirim sejak bot berjalan.</span></div>';

        const lastCommand = snapshot.commands.last
            ? `${snapshot.commands.last.cmd} • ${snapshot.commands.last.type}`
            : 'Belum ada command terkirim';

        return `
        <div class="dashboard-grid" id="statsGrid">
            <div class="stat-card">
                <div class="stat-label">Total Command</div>
                <div class="stat-value" data-stat="commandTotal">${snapshot.commands.total}</div>
                <div class="stat-note" data-stat="lastCommand">${escapeHtml(lastCommand)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Captcha</div>
                <div class="stat-value" data-stat="captchaSolved">${snapshot.captcha.solved}/${snapshot.captcha.detected}</div>
                <div class="stat-note" data-stat="captchaStatus">${snapshot.captcha.active ? 'Aktif - butuh perhatian' : 'Aman, tidak aktif'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value" data-stat="uptimeText">${escapeHtml(snapshot.uptime.text)}</div>
                <div class="stat-note" data-stat="startedAt">Start: ${escapeHtml(snapshot.uptime.startedAt)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Status Info</div>
                <div class="stat-value" data-stat="statusText" style="font-size: 18px;">${escapeHtml(snapshot.status.text)}</div>
                <div class="stat-note" data-stat="statusNote">Channel aktif: ${escapeHtml(snapshot.status.activeChannelId)}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">
                <label class="section-label">📊 Statistik Command per Tipe</label>
                <a class="btn btn-secondary" style="width:auto; padding: 9px 12px;" href="/export-config">⬇ Export Config</a>
            </div>
            <div id="commandTypes" class="pill-list">${commandTypes}</div>
            <div class="divider"></div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="stat-label">Captcha terselesaikan</div>
                    <div class="stat-value" data-stat="captchaSolvedOnly" style="font-size: 20px;">${snapshot.captcha.solved}</div>
                    <div class="stat-note" data-stat="captchaLastSolved">Terakhir: ${escapeHtml(statsService.formatTime(snapshot.captcha.lastSolvedAt))}</div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Captcha terdeteksi</div>
                    <div class="stat-value" data-stat="captchaDetectedOnly" style="font-size: 20px;">${snapshot.captcha.detected}</div>
                    <div class="stat-note" data-stat="captchaLastDetected">Terakhir: ${escapeHtml(statsService.formatTime(snapshot.captcha.lastDetectedAt))}</div>
                </div>
                <div class="info-item">
                    <div class="stat-label">Status layanan</div>
                    <div class="stat-note" data-stat="serviceFlags">Autosolver: ${snapshot.status.autosolver ? 'ON' : 'OFF'} • Telegram: ${snapshot.status.telegram ? 'ON' : 'OFF'} • Channel: ${snapshot.status.channelsTotal}</div>
                </div>
            </div>
            <div class="divider"></div>
            <label class="section-label">Command terbaru</label>
            <div id="recentCommands" class="recent-list">${recentCommands}</div>
        </div>
        `;
    },

    getLogCard() {
        return `
        <div class="card">
            <div class="card-title">
                <label class="section-label">🧾 Log Dashboard</label>
                <span class="stat-note">Rapi, ringan, tanpa efek</span>
            </div>
            <div id="logBox" class="log-box"><div class="log-empty">(loading...)</div></div>
        </div>
        `;
    },

    getLogRefreshScript(profileOptions = []) {
        const profileOptionsJson = serializeForScript(profileOptions);
        return `
        <script>
            (function() {
                let retryCount = 0;
                function parseLogLine(line) {
                    const match = String(line || '').match(/^(\[[^\]]+\])\s+(\[[^\]]+\])\s+(.*)$/);
                    if (!match) return { time: '', level: '', message: line || '' };
                    return { time: match[1], level: match[2], message: match[3] };
                }

                function renderLogs(lines) {
                    const logBox = document.getElementById('logBox');
                    if (!logBox) return;
                    if (!lines || !lines.length) {
                        logBox.innerHTML = '<div class="log-empty">✨ Belum ada log...</div>';
                        return;
                    }
                    logBox.innerHTML = lines.map(line => {
                        const item = parseLogLine(line);
                        return '<div class="log-line">' +
                            '<span class="log-time">' + escapeHtml(item.time) + '</span>' +
                            '<span class="log-level">' + escapeHtml(item.level) + '</span>' +
                            '<span class="log-message">' + escapeHtml(item.message) + '</span>' +
                        '</div>';
                    }).join('');
                    logBox.scrollTop = logBox.scrollHeight;
                }

                async function refreshLogs() {
                    try {
                        const res = await fetch('/logs', { cache: 'no-store', headers: { 'Accept': 'application/json' }});
                        if (!res.ok) throw new Error('HTTP Error');
                        const data = await res.json();
                        renderLogs(data.lines);
                        retryCount = 0;
                    } catch (err) {
                        retryCount++;
                        renderLogs([retryCount <= 3 ? '[--:--:--] [INFO] ⏳ Reconnecting...' : '[--:--:--] [WARN] 📡 Log service unavailable']);
                    }
                }

                function updateText(selector, text) {
                    const el = document.querySelector(selector);
                    if (el) el.textContent = text;
                }

                function renderCommandTypes(byType) {
                    const target = document.getElementById('commandTypes');
                    if (!target) return;
                    const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
                    target.innerHTML = entries.length
                        ? entries.map(([type, total]) => '<span class="pill">' + escapeHtml(type) + ': <strong>' + total + '</strong></span>').join('')
                        : '<span class="pill">Belum ada command</span>';
                }

                function renderRecentCommands(commands) {
                    const target = document.getElementById('recentCommands');
                    if (!target) return;
                    const entries = (commands || []).slice(-5).reverse();
                    target.innerHTML = entries.length
                        ? entries.map(item => '<div class="recent-item">' +
                            '<span class="recent-muted">' + escapeHtml(item.atFormatted || '-') + '</span>' +
                            '<strong>' + escapeHtml(item.type || 'Command') + '</strong>' +
                            '<span>' + escapeHtml(item.cmd || '-') + '</span>' +
                        '</div>').join('')
                        : '<div class="recent-item"><span class="recent-muted">Belum ada command terkirim sejak bot berjalan.</span></div>';
                }

                async function refreshStats() {
                    try {
                        const res = await fetch('/api/stats', { cache: 'no-store', headers: { 'Accept': 'application/json' }});
                        if (!res.ok) throw new Error('HTTP Error');
                        const data = await res.json();
                        const lastCommand = data.commands.last ? data.commands.last.cmd + ' • ' + data.commands.last.type : 'Belum ada command terkirim';
                        updateText('[data-stat="commandTotal"]', data.commands.total);
                        updateText('[data-stat="lastCommand"]', lastCommand);
                        updateText('[data-stat="captchaSolved"]', data.captcha.solved + '/' + data.captcha.detected);
                        updateText('[data-stat="captchaStatus"]', data.captcha.active ? 'Aktif - butuh perhatian' : 'Aman, tidak aktif');
                        updateText('[data-stat="uptimeText"]', data.uptime.text);
                        updateText('[data-stat="startedAt"]', 'Start: ' + data.uptime.startedAt);
                        updateText('[data-stat="statusText"]', data.status.text);
                        updateText('[data-stat="statusNote"]', 'Channel aktif: ' + data.status.activeChannelId);
                        updateText('[data-stat="captchaSolvedOnly"]', data.captcha.solved);
                        updateText('[data-stat="captchaDetectedOnly"]', data.captcha.detected);
                        updateText('[data-stat="captchaLastSolved"]', 'Terakhir: ' + (data.captcha.lastSolvedAtFormatted || '-'));
                        updateText('[data-stat="captchaLastDetected"]', 'Terakhir: ' + (data.captcha.lastDetectedAtFormatted || '-'));
                        updateText('[data-stat="serviceFlags"]', 'Autosolver: ' + (data.status.autosolver ? 'ON' : 'OFF') + ' • Telegram: ' + (data.status.telegram ? 'ON' : 'OFF') + ' • Channel: ' + data.status.channelsTotal);
                        renderCommandTypes(data.commands.byType);
                        renderRecentCommands(data.commands.recent);
                    } catch (err) {
                        updateText('[data-stat="statusNote"]', 'Statistik belum bisa diperbarui');
                    }
                }

                refreshLogs(); setInterval(refreshLogs, ${CONSTANTS.LOG_REFRESH_INTERVAL_MS});
                refreshStats(); setInterval(refreshStats, 1000);
                
                // AUTO FETCH PROFILE SCRIPT
                async function fetchProfile() {
                    try {
                        const res = await fetch('/api/profile');
                        const data = await res.json();
                        const profileBox = document.getElementById('userProfileBox');
                        
                        if (data.username) {
                            const name = data.global_name || data.username;
                            const avatarUrl = data.avatar 
                                ? \`https://cdn.discordapp.com/avatars/\${data.id}/\${data.avatar}.png?size=64\`
                                : \`https://cdn.discordapp.com/embed/avatars/0.png\`;
                                
                            profileBox.innerHTML = \`
                                <img src="\${avatarUrl}" alt="Avatar">
                                <div>
                                    <div style="color: var(--text); font-weight: bold; font-size: 14px;">\${name}</div>
                                    <div style="font-size: 11px; color: #8e9297;">@\${data.username} (\${data.id})</div>
                                </div>
                            \`;
                        } else {
                            profileBox.innerHTML = '❌ Gagal memuat data akun. (Cek token)';
                        }
                    } catch (err) {
                        document.getElementById('userProfileBox').innerHTML = '⚠️ Koneksi ke Discord API gagal.';
                    }
                }
                fetchProfile(); // Panggil saat halaman dimuat

                const profileOptions = ${profileOptionsJson};
                const profileSelect = document.getElementById('selectedProfile');
                const profilePreview = document.getElementById('selectedProfilePreview');

                function getProfilePreviewLabel(profile) {
                    if (!profile) return '';
                    if (profile.meta && profile.meta.username) return '@' + profile.meta.username;
                    return 'Profil ' + profile.id;
                }

                function updateProfilePreview() {
                    if (!profileSelect || !profilePreview) return;
                    const selected = profileOptions.find(profile => profile.id === profileSelect.value);
                    if (!selected) {
                        profilePreview.classList.remove('visible');
                        profilePreview.textContent = '';
                        return;
                    }

                    const label = getProfilePreviewLabel(selected);
                    profilePreview.innerHTML = '<span>👁️ Preview:</span> <strong>' + escapeHtml(label) + '</strong>' + (selected.isActive ? '<span>(Aktif)</span>' : '');
                    profilePreview.classList.add('visible');
                }

                function escapeHtml(value) {
                    return String(value || '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }

                if (profileSelect) {
                    profileSelect.addEventListener('change', updateProfilePreview);
                    updateProfilePreview();
                }
            })();
            
            function switchTab(event, tabId) {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                event.currentTarget.classList.add('active');
            }
        </script>
        `;
    },

    getSavedResponse() {
        return `
        <!DOCTYPE html><html><head><meta http-equiv="refresh" content="${CONSTANTS.REDIRECT_DELAY_SECONDS};url=/" />
        <style>body { background: #0f0f13; color: white; text-align: center; padding-top: 50px; font-family: 'Segoe UI', sans-serif;}
        .success { color: #3ba55c; font-size: 48px; margin-bottom: 20px;} .msg { color: #dcddde; font-size: 18px;} .dt { color: #72767d; font-size: 14px; margin-top: 10px;}</style>
        </head><body><div class="success">✅</div><div class="msg">Configuration Processed!</div><div class="dt">Redirecting to dashboard...</div></body></html>
        `;
    },

    renderPage(config) {
        console.log('[DASHBOARD] Rendering page with config:', { port: config.port, token: config.token ? '***' : 'MISSING' });
        
        const { statusText, statusClass } = configManager.computeStatus(config);
        const channels = config.channels || [];
        const custom1 = config.delays.custom1 || CONSTANTS.DEFAULT_DELAYS.custom1;
        const custom2 = config.delays.custom2 || CONSTANTS.DEFAULT_DELAYS.custom2;
        const hasTelegram = config.settings?.telegram?.token && config.settings?.telegram?.chatId;

        const huntbot = config.huntbot || {};
        const control = config.settings.control || {};
        const rotation = config.settings.channelRotation || {};
        const boss = config.settings.boss || {};
        const msgFilter = config.settings.messageFilter || {};
        const voice = config.settings.voice || {};
        const statsSnapshot = statsService.getSnapshot(config);

        const profiles = profileManager.getSavedProfiles();
        const activeProfileId = profileManager.getUserId(config.token);
        const profileOptions = profiles.map(id => ({
            id,
            meta: profileManager.getProfileMeta(id),
            displayName: profileManager.getProfileDisplayName(id),
            isActive: id === activeProfileId
        }));

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OWO FARMING</title>
            ${this.getStyles()}
        </head>
        <body>
            <div class="container">
                <h2>OWO Farming Dashboard</h2>
                <div class="subtitle">Panel ringkas, nyaman, dan ringan untuk monitoring bot.</div>
                
                <div class="status-box ${statusClass}">
                    <span style="font-size: 16px;">${statusText}</span>
                    
                    <div id="userProfileBox" class="profile-box">
                        ⏳ Menghubungi Discord API...
                    </div>
                    
                    ${hasTelegram ? '<div class="telegram-badge">📱 Telegram Active</div>' : ''}
                </div>

                ${this.getDashboardStatsCard(statsSnapshot)}
                ${this.getLogCard()}

                <form action="/save" method="POST">
                    <div class="action-group">
                        <button type="submit" name="action" value="start" class="btn btn-start">▶ START BOT</button>
                        <button type="submit" name="action" value="pause" class="btn btn-pause">⏸ PAUSE BOT</button>
                    </div>

                    <div class="tabs-wrapper">
                        <button type="button" class="tab-btn active" onclick="switchTab(event, 'tab-main')">Main Settings</button>
                        <button type="button" class="tab-btn" onclick="switchTab(event, 'tab-advanced')">Advanced / Add-ons</button>
                    </div>

                    <div id="tab-main" class="tab-content active">

                        <div class="card" style="border-color: var(--accent);">
                            <label style="color: var(--accent);">👥 PROFILE MANAGER (GANTI AKUN)</label>
                            
                            <div style="margin-bottom: 12px;">
                                <div class="row">
                                    <div class="col">
                                        <select name="selectedProfile" id="selectedProfile" class="input-select">
                                            <option value="">-- Pilih Profil Tersimpan --</option>
                                            ${profileOptions.map(profile => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.isActive ? `✅ ${profile.displayName} (Aktif)` : profile.displayName)}</option>`).join('')}
                                        </select>
                                        <div id="selectedProfilePreview" class="profile-preview" aria-live="polite"></div>
                                    </div>
                                    <div class="col" style="flex: 0.4;">
                                        <button type="submit" name="action" value="loadProfile" class="btn" style="background: var(--yellow); color: black;">📂 LOAD</button>
                                    </div>
                                </div>
                                <div class="input-hint">Pilih akun lalu klik LOAD untuk memuat ulang pengaturan (config).</div>
                            </div>

                            <div class="divider"></div>

                            <div>
                                <label>ATAU MASUKKAN TOKEN AKUN BARU</label>
                                <div class="row">
                                    <div class="col">
                                        <input type="password" name="newToken" placeholder="Paste Token di sini...">
                                    </div>
                                    <div class="col" style="flex: 0.4;">
                                        <button type="submit" name="action" value="newProfile" class="btn" style="background: var(--green); color: white;">➕ BUAT</button>
                                    </div>
                                </div>
                                <div class="input-hint">Paste token akun baru dan klik BUAT. Pengaturan akan disamakan dengan akun saat ini.</div>
                            </div>
                        </div>
                        <div class="card">
                            <label>🔐 CURRENT DISCORD TOKEN</label>
                            <input type="password" name="token" value="${config.token || ''}" placeholder="Token aktif saat ini">
                            <div class="input-hint">Token yang sedang digunakan oleh bot saat ini.</div>
                        </div>

                        <div class="card">
                            <label>📡 ACTIVE CHANNELS (max 3)</label>
                            <input type="text" name="chan1" value="${channels[0] || ''}" placeholder="Channel ID 1">
                            <input type="text" name="chan2" value="${channels[1] || ''}" placeholder="Channel ID 2">
                            <input type="text" name="chan3" value="${channels[2] || ''}" placeholder="Channel ID 3">
                        </div>

                        <div class="card">
                            <label>⚔️ MAIN COMMANDS</label>

                            <div class="toggle-row">
                                <span><span style="margin-right: 8px;">🏹</span> Hunt</span>
                                <input type="checkbox" name="hunt" ${config.settings.hunt ? 'checked' : ''}>
                            </div>
                            <div class="row">
                                <div class="col"><input type="number" name="huntMin" value="${config.delays.hunt.min}" placeholder="Min"></div>
                                <div class="col"><input type="number" name="huntMax" value="${config.delays.hunt.max}" placeholder="Max"></div>
                            </div>

                            <div class="divider"></div>

                            <div class="toggle-row">
                                <span><span style="margin-right: 8px;">⚔️</span> Battle</span>
                                <input type="checkbox" name="battle" ${config.settings.battle ? 'checked' : ''}>
                            </div>
                            <div class="row">
                                <div class="col"><input type="number" name="battleMin" value="${config.delays.battle.min}" placeholder="Min"></div>
                                <div class="col"><input type="number" name="battleMax" value="${config.delays.battle.max}" placeholder="Max"></div>
                            </div>

                            <div class="divider"></div>

                            <div class="toggle-row">
                                <span><span style="margin-right: 8px;">🙏</span> Pray</span>
                                <input type="checkbox" name="pray" ${config.settings.pray ? 'checked' : ''}>
                            </div>
                            <div class="row">
                                <div class="col"><input type="number" name="prayMin" value="${config.delays.pray.min}" placeholder="Min"></div>
                                <div class="col"><input type="number" name="prayMax" value="${config.delays.pray.max}" placeholder="Max"></div>
                            </div>
                        </div>

                        <div class="card">
                            <label>💬 CUSTOM COMMANDS</label>
                            <div style="margin-bottom: 12px;">
                                <input type="text" name="text1" value="${config.settings.text1 || ''}" placeholder="Command 1 (e.g., owo inv)">
                                <div class="row" style="margin-top: 8px;">
                                    <div class="col"><input type="number" name="c1Min" value="${custom1.min}" placeholder="Min"></div>
                                    <div class="col"><input type="number" name="c1Max" value="${custom1.max}" placeholder="Max"></div>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <input type="text" name="text2" value="${config.settings.text2 || ''}" placeholder="Command 2 (e.g., owo cash)">
                                <div class="row" style="margin-top: 8px;">
                                    <div class="col"><input type="number" name="c2Min" value="${custom2.min}" placeholder="Min"></div>
                                    <div class="col"><input type="number" name="c2Max" value="${custom2.max}" placeholder="Max"></div>
                                </div>
                            </div>
                            <div class="toggle-row">
                                <span>🔘 Enable Custom Commands</span>
                                <input type="checkbox" name="custom" ${config.settings.custom ? 'checked' : ''}>
                            </div>
                        </div>
                    </div>

                    <div id="tab-advanced" class="tab-content">
                        
                        <div class="card">
                            <label>📱 TELEGRAM NOTIFICATIONS</label>
                            <input type="text" name="tgToken" value="${config.settings.telegram.token || ''}" placeholder="Bot Token">
                            <input type="text" name="tgChat" value="${config.settings.telegram.chatId || ''}" placeholder="Chat ID">
                            <div class="input-hint">Optional: Leave empty to disable</div>
                        </div>

                        <div class="card">
                            <label>🔌 SYSTEM INTEGRATIONS</label>
                            <label>Dashboard Port</label>
                            <input type="number" name="port" value="${config.port}">
                            <label>MacroDroid ID</label>
                            <input type="text" name="macrodroidId" value="${config.macrodroidId || ''}">
                            <label>2Captcha API Key</label>
                            <input type="password" name="twoCaptchaKey" value="${config.settings.twoCaptchaKey || ''}">
                            <div class="toggle-row">
                                <span>Enable Autosolver</span>
                                <input type="checkbox" name="autosolver" ${config.autosolver ? 'checked' : ''}>
                            </div>
                        </div>

                        <div class="card">
                            <label>🛡️ SAFETY & FILTER</label>
                            <div class="toggle-row">
                                <span>Enable CCTV Monitoring</span>
                                <input type="checkbox" name="cctvEnabled" ${config.safety?.cctv ? 'checked' : ''}>
                            </div>
                            
                            <div class="divider"></div>
                            
                            <label>📨 Message Filter</label>
                            <div class="toggle-row">
                                <span>Enable Filter</span>
                                <input type="checkbox" name="mfEnabled" ${msgFilter.enabled ? 'checked' : ''}>
                            </div>
                            <label>Channel IDs (Comma separated)</label>
                            <input type="text" name="mfChannelIds" value="${(msgFilter.channelIds || []).join(',')}" placeholder="Channel IDs">
                            <label>Guild IDs (Comma separated)</label>
                            <input type="text" name="mfGuildIds" value="${(msgFilter.guildIds || []).join(',')}" placeholder="Guild IDs">
                            <div class="toggle-row">
                                <span>Debug Mode</span>
                                <input type="checkbox" name="mfDebug" ${msgFilter.debug ? 'checked' : ''}>
                            </div>
                            <div class="toggle-row">
                                <span>Debug Only OwO</span>
                                <input type="checkbox" name="mfDebugOnlyOwO" ${msgFilter.debugOnlyOwO ? 'checked' : ''}>
                            </div>
                        </div>
                                                                        
                        <div class="card">
                            <label>🤖 HUNTBOT AUTOMATION</label>
                            <div class="toggle-row">
                                <span>Enable HuntBot</span>
                                <input type="checkbox" name="hbEnabled" ${huntbot.enabled ? 'checked' : ''}>
                            </div>
                            <div class="toggle-row">
                                <span>Auto Mode (Claim & Upgrade)</span>
                                <input type="checkbox" name="hbAutoMode" ${huntbot.autoMode ? 'checked' : ''}>
                            </div>
                            <div class="toggle-row">
                                <span>Notify Progress</span>
                                <input type="checkbox" name="hbNotify" ${huntbot.notifyProgress ? 'checked' : ''}>
                            </div>
                            <div class="divider"></div>
                            <label>Default Upgrade Type</label>
                            <input type="text" name="hbUpgrade" value="${huntbot.defaultUpgrade || 'duration'}" placeholder="duration / efficiency">
                            <label>Default Hunt Duration</label>
                            <input type="text" name="hbDuration" value="${huntbot.defaultDuration || '1D'}" placeholder="1D">
                            
                            <div class="divider"></div>
                            <label>Tiket & Huntbot Channel ID</label>
                            <input type="text" name="tiketandhbChannel" value="${config.tiketandhb?.channelId || ''}" placeholder="Channel ID">
                        </div>


                        <div class="card">
                            <label>🔊 VOICE CHANNEL</label>
                            <div class="toggle-row">
                                <span>Auto Join Voice Channel</span>
                                <input type="checkbox" name="voiceEnabled" ${voice.enabled ? 'checked' : ''}>
                            </div>
                            <label>Voice Channel ID</label>
                            <input type="text" name="voiceChannelId" value="${voice.channelId || ''}" placeholder="Voice Channel ID">
                            <div class="input-hint">Jika aktif, bot otomatis join VC ini setelah login/restart. Command vjoin juga menyimpan VC terakhir ke field ini.</div>
                        </div>

                        <div class="card">
                            <label>🐉 BOSS AUTOMATION</label>
                            <div class="toggle-row">
                                <span>Enable Auto-Boss</span>
                                <input type="checkbox" name="bossEnabled" ${boss.enabled ? 'checked' : ''}>
                            </div>
                            <label>Allowed Guilds (Comma separated)</label>
                            <input type="text" name="bossGuilds" value="${(boss.allowedGuilds || []).join(',')}" placeholder="Guild ID">
                        </div>

                        <div class="card">
                            <label>🔄 CHANNEL ROTATION</label>
                            <div class="toggle-row">
                                <span>Enable Rotation</span>
                                <input type="checkbox" name="crEnabled" ${rotation.enabled ? 'checked' : ''}>
                            </div>
                            <div class="row">
                                <div class="col"><input type="number" name="crMin" value="${rotation.minMs}" placeholder="Min delay"></div>
                                <div class="col"><input type="number" name="crMax" value="${rotation.maxMs}" placeholder="Max delay"></div>
                            </div>
                        </div>

                        <div class="card">
                            <label>🎮 CONTROL & SYSTEM</label>
                            <div class="toggle-row">
                                <span>Auto Resume (After restart)</span>
                                <input type="checkbox" name="autoResume" ${config.settings.autoResume ? 'checked' : ''}>
                            </div>
                            <div class="divider"></div>
                            <div class="row">
                                <div class="col">
                                    <label>Start Word</label>
                                    <input type="text" name="ctrlStart" value="${control.start || 'wcash'}" placeholder="wcash">
                                </div>
                                <div class="col">
                                    <label>Pause Word</label>
                                    <input type="text" name="ctrlPause" value="${control.pause || 'wbuy 1'}" placeholder="wbuy 1">
                                </div>
                            </div>
                            <label>Allowed User IDs (Comma separated)</label>
                            <input type="text" name="ctrlAllowIds" value="${(control.allowIds || []).join(',')}" placeholder="Leave blank to allow all">
                            
                            <div class="divider"></div>
                            <label>Max Log Lines in Dashboard</label>
                            <input type="number" name="maxLogLines" value="${config.maxLogLines || 15}">
                        </div>

                    </div>
                    <button type="submit" name="action" value="save" class="btn btn-save" style="margin-top: 10px;">💾 SAVE CONFIGURATION</button>
                </form>
            </div>

            ${this.getLogRefreshScript(profileOptions)}
        </body>
        </html>
        `;
    }
};

// --- EXPRESS APP SETUP ---
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const initialConfig = configManager.ensureShape(configManager.get());
const PORT = process.env.SERVER_PORT || process.env.PORT || initialConfig.port || CONSTANTS.DEFAULT_PORT;

console.log(`[DASHBOARD] Initial port check: PORT=${PORT}, initialConfig.port=${initialConfig.port}`);

// --- ROUTES ---

app.get('/api/profile', (req, res) => {
    const config = configManager.get();
    const token = config.token;
    
    if (!token) return res.status(400).json({ error: 'Tidak ada token.' });

    const options = {
        hostname: 'discord.com',
        path: '/api/v9/users/@me',
        method: 'GET',
        headers: {
            'Authorization': token,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
            try {
                const parsedData = JSON.parse(data);
                if (parsedData && parsedData.id && parsedData.username) {
                    profileManager.saveProfileMeta(
                        parsedData.id,
                        parsedData.username,
                        parsedData.global_name,
                        parsedData.avatar
                    );
                }
                res.json(parsedData);
            } catch (e) {
                res.status(500).json({ error: 'Gagal membaca data dari Discord' });
            }
        });
    });

    request.on('error', (error) => {
        console.error('API Profile Error:', error.message);
        res.status(500).json({ error: error.message });
    });

    request.end();
});

app.get('/', (req, res) => {
    console.log('[DASHBOARD] GET / - Rendering dashboard');
    try {
        const config = configManager.ensureShape(configManager.get());
        const html = uiComponents.renderPage(config);
        console.log('[DASHBOARD] Dashboard HTML generated, size:', html.length, 'bytes');
        res.send(html);
    } catch (error) {
        console.error('[DASHBOARD] Error rendering dashboard:', error);
        res.status(500).send(`<pre>Error: ${error.message}\n${error.stack}</pre>`);
    }
});

app.get('/logs', (req, res) => {
    try {
        const lines = logService.getRecentLines();
        res.setHeader('Cache-Control', 'no-store');
        res.json({ lines });
    } catch {
        res.status(500).json({ lines: [] });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const config = configManager.ensureShape(configManager.get());
        const snapshot = statsService.getSnapshot(config);
        snapshot.captcha.lastDetectedAtFormatted = statsService.formatTime(snapshot.captcha.lastDetectedAt);
        snapshot.captcha.lastSolvedAtFormatted = statsService.formatTime(snapshot.captcha.lastSolvedAt);
        snapshot.commands.recent = (snapshot.commands.recent || []).map(item => ({
            ...item,
            atFormatted: statsService.formatTime(item.at)
        }));
        res.setHeader('Cache-Control', 'no-store');
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/export-config', (req, res) => {
    try {
        const config = configManager.ensureShape(configManager.get());
        const activeId = profileManager.getUserId(config.token);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `owo-config-${activeId}-${timestamp}.json`;

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(JSON.stringify(config, null, 2));
    } catch (error) {
        res.status(500).send(`Failed to export config: ${error.message}`);
    }
});

app.post('/save', (req, res) => {
    try {
        const body = req.body;
        
        if (body.action === 'loadProfile') {
            const targetId = body.selectedProfile;
            if (targetId) {
                const profilePath = profileManager.getProfilePath(targetId);
                if (fs.existsSync(profilePath)) {
                    const loadedConfig = fileService.readJson(profilePath);
                    configManager.save(loadedConfig); 
                    console.log(`[PROFILE] Akun ${targetId} berhasil dimuat.`);
                }
            }
            return res.send(uiComponents.getSavedResponse());
        }

        if (body.action === 'newProfile') {
            const newToken = body.newToken;
            if (newToken) {
                const targetId = profileManager.getUserId(newToken);
                const profilePath = profileManager.getProfilePath(targetId);
                
                let currentConfig = configManager.ensureShape(configManager.get());
                let newConfig = JSON.parse(JSON.stringify(currentConfig));
                newConfig.token = newToken;
                
                configManager.save(newConfig);
                fileService.writeJson(profilePath, newConfig);
                console.log(`[PROFILE] Profil baru untuk akun ${targetId} berhasil dibuat dengan pengaturan dari akun saat ini.`);
            }
            return res.send(uiComponents.getSavedResponse());
        }

        let config = configManager.ensureShape(configManager.get());
        config = configManager.applySave(config, body);
        config = configManager.applyAction(config, body.action);
        
        if (configManager.save(config)) {
            const activeId = profileManager.getUserId(config.token);
            if (activeId !== 'default') {
                fileService.writeJson(profileManager.getProfilePath(activeId), config);
            }
            res.send(uiComponents.getSavedResponse());
        } else {
            res.status(500).send('Failed to save configuration');
        }
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).send('Internal Server Error');
    }
});

// --- START SERVER ---
function start() {
    try {
        console.log(`[DASHBOARD] Starting server on port ${PORT} (0.0.0.0)...`);
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[DASHBOARD] ✅ Running on http://0.0.0.0:${PORT}`);
            console.log(`[DASHBOARD] 🌐 Access from external: http://PerkasaHost:${PORT}`);
        });
    } catch (error) {
        console.error('[DASHBOARD] ❌ Failed to start:', error.message);
    }
}

module.exports = start;
