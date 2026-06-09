function getStyles() {
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
    }

module.exports = getStyles;
