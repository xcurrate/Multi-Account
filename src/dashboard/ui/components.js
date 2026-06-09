module.exports = function createUiComponents({ CONSTANTS, serializeForScript, escapeHtml, statsService, configManager, profileManager }) {
    return {
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
                            '<strong>' + escapeHtml(item.type || 'Command') + '</span>' +
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
                        .replace(/&/g, '&')
                        .replace(/</g, '<')
                        .replace(/>/g, '>')
                        .replace(/"/g, '"')
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

        // Captcha config
        const captchaConfig = config.captcha || {};
        const nopechaKey = (captchaConfig.apiKeys && captchaConfig.apiKeys.NopechaSolver) || '';
        const twoCaptchaKey = (captchaConfig.apiKeys && captchaConfig.apiKeys.TwoCaptchaSolver) || '';
        const fallbackSolvers = captchaConfig.fallbackSolvers || [];

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
                                <label>ATAU MASUKKUN TOKEN AKUN BARU</label>
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
                            <input type="password" name="token" value="${config.token || ''}" placeholder="Token aktif saat ini.">
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

                        <!-- === CAPTCHA SETTINGS (Full Fallback UI) === -->
                        <div class="card" style="border-color: #f59e0b;">
                            <label style="color: #f59e0b;">🛡️ CAPTCHA SETTINGS (CaptchaAsu)</label>
                            
                            <div class="toggle-row">
                                <span>Enable Auto Solver (CaptchaAsu)</span>
                                <input type="checkbox" name="autosolver" ${config.autosolver ? 'checked' : ''}>
                            </div>

                            <div class="divider"></div>

                            <label>Primary Solver</label>
                            <select name="captchaPrimary" class="input-select">
                                <option value="NopechaSolver" ${captchaConfig.primarySolver === 'NopechaSolver' ? 'selected' : ''}>NopechaSolver</option>
                                <option value="TwoCaptchaSolver" ${captchaConfig.primarySolver === 'TwoCaptchaSolver' ? 'selected' : ''}>TwoCaptchaSolver</option>
                            </select>

                            <div class="divider"></div>

                            <label>Fallback Solvers (akan dicoba jika Primary gagal)</label>
                            <div style="margin: 8px 0;">
                                <label style="display: inline-flex; align-items: center; gap: 8px; margin-right: 20px;">
                                    <input type="checkbox" name="fallbackNopecha" value="NopechaSolver" ${fallbackSolvers.includes('NopechaSolver') ? 'checked' : ''}>
                                    <span>NopechaSolver</span>
                                </label>
                                <label style="display: inline-flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" name="fallbackTwoCaptcha" value="TwoCaptchaSolver" ${fallbackSolvers.includes('TwoCaptchaSolver') ? 'checked' : ''}>
                                    <span>TwoCaptchaSolver</span>
                                </label>
                            </div>
                            <div class="input-hint">Centang solver yang ingin digunakan sebagai cadangan (sequential).</div>

                            <div class="divider"></div>

                            <label>Nopecha API Key</label>
                            <input type="password" name="nopechaApiKey" value="${escapeHtml(nopechaKey)}" placeholder="Masukkan Nopecha API Key">

                            <label style="margin-top: 12px;">TwoCaptcha API Key</label>
                            <input type="password" name="twoCaptchaApiKey" value="${escapeHtml(twoCaptchaKey)}" placeholder="Masukkan TwoCaptcha API Key">

                            <div class="input-hint" style="margin-top: 8px; color: #f59e0b;">
                                Sistem akan mencoba Primary terlebih dahulu, lalu fallback secara berurutan jika gagal.
                            </div>
                        </div>

                        <div class="card">
                            <label>🔌 SYSTEM INTEGRATIONS</label>
                            <label>Dashboard Port</label>
                            <input type="number" name="port" value="${config.port}">
                            <label>MacroDroid ID</label>
                            <input type="text" name="macrodroidId" value="${config.macrodroidId || ''}">
                            <label>2Captcha API Key</label>
                            <input type="password" name="twoCaptchaKey" value="${config.settings.twoCaptchaKey || ''}">
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
};
