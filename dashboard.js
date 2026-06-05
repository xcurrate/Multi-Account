const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');

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
let logger = null;
try {
    logger = require('./logger');
} catch (_) {
    logger = null;
}

// --- FILE PATHS ---
const configPath = path.join(__dirname, CONSTANTS.CONFIG_FILE);

// --- UTILITY FUNCTIONS ---
const fileService = {
    readJson(filePath) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error reading JSON from ${filePath}:`, error.message);
            return {};
        }
    },

    writeJson(filePath, obj) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
            return true;
        } catch (error) {
            console.error(`Error writing JSON to ${filePath}:`, error.message);
            return false;
        }
    }
};

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
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        return path.join(dir, `config_${id}.json`);
    },

    getMetaPath() {
        const dir = path.join(__dirname, 'profiles');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        return path.join(dir, 'meta.json');
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
        let meta = fileService.readJson(metaPath);
        if (!meta.profiles) meta.profiles = {};
        
        meta.profiles[id] = {
            username,
            globalName,
            avatar
        };
        
        fileService.writeJson(metaPath, meta);
    },

    getProfileMeta(id) {
        const metaPath = this.getMetaPath();
        const meta = fileService.readJson(metaPath);
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

// --- UI COMPONENTS ---
const uiComponents = {
    getStyles() {
        return `
        <style>
            :root { 
                --bg: #0f0f13; --card: #1b1b22; --accent: #5865F2; 
                --text: #dcddde; --green: #3ba55c; --red: #ed4245;
                --yellow: #faa81a; --border: #2f2f36;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
            body { background: var(--bg); color: var(--text); padding: 20px; font-size: 14px; }
            .container { max-width: 500px; margin: 0 auto; padding-bottom: 50px; }
            h2 { text-align: center; color: var(--accent); margin-bottom: 20px; font-weight: 700; letter-spacing: -0.5px; }
            .status-box { padding: 15px; border-radius: 8px; text-align: center; font-weight: 700; margin-bottom: 20px; border: 1px solid var(--border); transition: all 0.2s; }
            .running { background: rgba(59, 165, 92, 0.15); color: var(--green); border-color: var(--green); }
            .paused { background: rgba(237, 66, 69, 0.15); color: var(--red); border-color: var(--red); }
            .offline { background: rgba(114, 118, 125, 0.15); color: #b9bbbe; border-color: #4f545c; }
            
            /* Profile Box Style */
            .profile-box {
                display: flex; align-items: center; justify-content: center; gap: 10px; 
                margin-top: 12px; padding: 8px; background: rgba(0,0,0,0.25); border-radius: 8px;
                font-weight: normal; font-size: 13px; color: #b9bbbe;
            }
            .profile-box img { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--accent); }
            
            .tabs-wrapper { display: flex; background: var(--card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
            .tab-btn { flex: 1; padding: 12px; background: transparent; color: #8e9297; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px; }
            .tab-btn:hover { color: white; background: rgba(255, 255, 255, 0.05); }
            .tab-btn.active { background: var(--accent); color: white; }
            .tab-content { display: none; animation: fadeIn 0.3s; }
            .tab-content.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            
            .card { background: var(--card); padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--border); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            label { display: block; margin-top: 10px; font-size: 0.8em; color: #8e9297; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
            label:first-child { margin-top: 0; }
            input[type=text], input[type=password], input[type=number], select.input-select { 
                width: 100%; padding: 12px; margin-top: 5px; background: #202225; border: 1px solid var(--border); 
                color: white; border-radius: 8px; outline: none; transition: all 0.2s; font-size: 14px; font-family: inherit;
            }
            select.input-select { appearance: auto; cursor: pointer; }
            input:focus, select.input-select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2); }
            input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent); }
            
            .row { display: flex; gap: 10px; margin-top: 8px; }
            .col { flex: 1; }
            .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
            .toggle-row:last-child { border-bottom: none; }
            .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px; transition: all 0.2s; letter-spacing: 0.3px; }
            .btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
            .btn:active { transform: translateY(0); }
            .btn-save { background: var(--accent); color: white; }
            .btn-start { background: var(--green); color: white; flex: 1; }
            .btn-pause { background: var(--red); color: white; flex: 1; }
            .action-group { display: flex; gap: 10px; margin-bottom: 16px; }
            .divider { border-top: 1px solid var(--border); margin: 16px 0; }
            
            .log-box { background: #0c0c10; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; overflow-y: auto; max-height: 200px; }
            .log-box::-webkit-scrollbar { width: 6px; }
            .log-box::-webkit-scrollbar-track { background: #0c0c10; }
            .log-box::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            .input-hint { font-size: 11px; color: #72767d; margin-top: 4px; }
            .telegram-badge { background: rgba(88, 101, 242, 0.1); border: 1px solid var(--accent); border-radius: 4px; padding: 4px 8px; font-size: 11px; color: var(--accent); display: inline-block; }
        </style>
        `;
    },

    getLogCard() {
        return `
        <div class="card">
            <label>🖥️ Console Log (Last ${CONSTANTS.MAX_LOG_LINES})</label>
            <pre id="logBox" class="log-box">(loading...)</pre>
        </div>
        `;
    },

    getLogRefreshScript() {
        return `
        <script>
            (function() {
                let retryCount = 0;
                async function refreshLogs() {
                    try {
                        const res = await fetch('/logs', { cache: 'no-store', headers: { 'Accept': 'application/json' }});
                        if (!res.ok) throw new Error('HTTP Error');
                        const data = await res.json();
                        const logBox = document.getElementById('logBox');
                        if (logBox) {
                            logBox.textContent = data.lines.length ? data.lines.join('\\n') : '✨ No logs yet...';
                            retryCount = 0;
                        }
                    } catch (err) {
                        retryCount++;
                        const logBox = document.getElementById('logBox');
                        if (logBox) logBox.textContent = retryCount <= 3 ? '⏳ Reconnecting...' : '📡 Log service unavailable';
                    }
                }
                refreshLogs(); setInterval(refreshLogs, ${CONSTANTS.LOG_REFRESH_INTERVAL_MS});
                
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
                                    <div style="color: white; font-weight: bold; font-size: 14px;">\${name}</div>
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

        const profiles = profileManager.getSavedProfiles();
        const activeProfileId = profileManager.getUserId(config.token);

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
                <h2>⚡ OWO 😘 PANEL</h2>
                
                <div class="status-box ${statusClass}">
                    <span style="font-size: 16px;">${statusText}</span>
                    
                    <div id="userProfileBox" class="profile-box">
                        ⏳ Menghubungi Discord API...
                    </div>
                    
                    ${hasTelegram ? '<div class="telegram-badge">📱 Telegram Active</div>' : ''}
                </div>

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
                                        <select name="selectedProfile" class="input-select">
                                            <option value="">-- Pilih Profil Tersimpan --</option>
                                            ${profiles.map(p => `<option value="${p}">${p === activeProfileId ? `✅ ${profileManager.getProfileDisplayName(p)} (Aktif)` : profileManager.getProfileDisplayName(p)}</option>`).join('')}
                                        </select>
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

            ${this.getLogRefreshScript()}
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
                res.json(JSON.parse(data));
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
