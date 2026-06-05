const CONSTANTS = require('../constants');
const log = require('../../logger');
const { removeInvisibleChars } = require('../utils');

// ⚠️ Sesuaikan path import ini tergantung di mana Anda meletakkan folder 'service'
const NopechaSolver = require('../services/nopechaSolver'); 

module.exports = (state, configManager, loopManager, telegramService, channelManager, macrodroidService) => {
    
    const captchaHandler = {
        isHandlingProcess: false,

        isCaptcha(content) {
            const lowerContent = removeInvisibleChars(content).toLowerCase();
            return CONSTANTS.CAPTCHA_KEYWORDS.some(keyword => lowerContent.includes(keyword)) ||
                   /\b[1-5]\/5\b/.test(lowerContent);
        },

        // Auto-Login & Submit Sesi ke OwO
        async submitKeOwO(solvedToken) {
            log.info("Memulai proses auto-login (OAuth2) ke web OwO...");
            const discordToken = state.activeToken; 
            if (!discordToken) throw new Error("Discord token tidak ditemukan di state.activeToken.");

            const authUrl = "https://discord.com/api/v9/oauth2/authorize?client_id=408785106942164992&response_type=code&redirect_uri=https://owobot.com/api/auth/discord/redirect&scope=identify guilds";
            const payload = { authorize: true, integration_type: 0, permissions: "0", location_context: { guild_id: "10000", channel_id: "10000", channel_type: 10000 } };

            const oauthResp = await fetch(authUrl, {
                method: "POST",
                headers: { "Authorization": discordToken, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (oauthResp.status !== 200) throw new Error(`OAuth Discord gagal (HTTP ${oauthResp.status})`);
            const oauthJson = await oauthResp.json();
            const redirectUrl = oauthJson.location;
            if (!redirectUrl) throw new Error("Tidak mendapatkan redirect_url dari Discord");

            const redirectResp = await fetch(redirectUrl, { redirect: 'manual' });
            
            let owoCookies = "";
            if (redirectResp.headers.getSetCookie) {
                owoCookies = redirectResp.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
            } else {
                const setCookieStr = redirectResp.headers.get('set-cookie');
                if (setCookieStr) owoCookies = setCookieStr.split(',').map(c => c.split(';')[0]).join('; '); 
            }

            const authCheckResp = await fetch("https://owobot.com/api/auth", {
                method: "GET", headers: { "Cookie": owoCookies }
            });

            if (authCheckResp.status !== 200) throw new Error(`Sesi ditolak oleh OwO (HTTP ${authCheckResp.status})`);
            
            log.info("Sesi valid! Menyerahkan Token hCaptcha ke OwO...");

            const verifyResp = await fetch("https://owobot.com/api/captcha/verify", {
                method: "POST",
                headers: {
                    "Cookie": owoCookies, "Referer": "https://owobot.com/captcha",
                    "Origin": "https://owobot.com", "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ token: solvedToken })
            });

            if (verifyResp.status === 200) {
                log.success("🎉 Verifikasi Captcha di server OwO BERHASIL!");
                return true;
            } else {
                const errorText = await verifyResp.text();
                throw new Error(`OwO menolak token (HTTP ${verifyResp.status}): ${errorText}`);
            }
        },

        async handle() {
            if (this.isHandlingProcess) return;
            this.isHandlingProcess = true;

            log.captcha("⛔ CAPTCHA! Bot Paused.");
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            state.hasActiveCaptcha = true;
            configManager.save();
            loopManager.stopAll();
            
            const now = Date.now();
            const cooldownMs = 5000;

            if (!state.lastCaptchaAlertTime || (now - state.lastCaptchaAlertTime > cooldownMs)) {
                
                // 1. Kirim notifikasi awal Captcha ke Telegram
                telegramService.send(`🚨 <b>CAPTCHA DETEKSI!</b>\nBot: ${state.client.user.username}`);
                state.lastCaptchaAlertTime = now;

                // 2. Cek apakah autosolver ON atau OFF
                if (state.config.autosolver) { // Asumsi bernilai boolean (true/false)
                    
                    telegramService.send(`Bypass Gaib berjalan... 🤖⚡`);
                    
                    const NOPECHA_API_KEY = process.env.NOPECHA_API_KEY || "zze3wv8h4lhzv403";
                    const SITE_KEY = "a6a1d5ce-612d-472d-8e37-7601408fbc09";
                    const TARGET_URL = "https://owobot.com/captcha";

                    try {
                        // Inisialisasi Service Nopecha
                        const nopecha = new NopechaSolver(NOPECHA_API_KEY);
                        
                        // Cek dan tampilkan Saldo
                        const sisaCredit = await nopecha.getBalance();
                        log.info(`💰 Sisa Kuota NopeCha: ${sisaCredit} request`);

                        let solvedToken = null;
                        const startTime = Date.now();
                        const TEN_MINUTES = 10 * 60 * 1000;
                        let jobAttempts = 0;

                        // 🔁 Loop Luar: Ulangi terus selama belum 10 menit
                        while (Date.now() - startTime < TEN_MINUTES) {
                            jobAttempts++;
                            try {
                                if (jobAttempts > 1) {
                                    log.info(`🔄 Membuat job ulang ke NopeCha (Percobaan ke-${jobAttempts})`);
                                }
                                solvedToken = await nopecha.solve(SITE_KEY, TARGET_URL);
                                
                                // Jika dapat token, keluar dari loop
                                if (solvedToken) break; 
                            } catch (err) {
                                log.warn(`⚠️ NopeCha Gagal: ${err.message}`);
                                
                                // Cek jika waktu masih ada sebelum mencoba lagi
                                if (Date.now() - startTime < TEN_MINUTES) {
                                    log.info("Tunggu 5 detik sebelum membuat tugas baru...");
                                    await new Promise(r => setTimeout(r, 5000));
                                }
                            }
                        }

                        // Jika setelah 10 menit keluar loop tapi token masih kosong
                        if (!solvedToken) {
                            throw new Error("Waktu 10 Menit habis. Gagal mendapatkan solusi dari NopeCha.");
                        }

                        log.success("✅ Captcha sukses dipecahkan AI!");
                        log.info(`💰 Sisa Kuota NopeCha: ${sisaCredit} request`);
                        // Eksekusi fungsi Auto-Login dan Submit ke OwO
                        await this.submitKeOwO(solvedToken);
                        await this.resume();

                    } catch (error) {
                        log.error(`❌ Bypass Full-Auto Gagal Total: ${error.message}`);
                        telegramService.send(`❌ <b>Bypass Gagal (Atau Timeout)!</b>\nLog: ${error.message}\nMenunggu intervensi Manual di HP...`);
                        
                        if (macrodroidService) {
                            await macrodroidService.trigger("kena_captcha"); 
                        }
                    } finally {
                        this.isHandlingProcess = false;
                    }

                } else {
                    // JIKA AUTOSOLVER OFF (SKIP NOPECHA)
                    log.info("⏸️ Autosolver dimatikan (OFF). Melewati proses pemecahan Captcha otomatis.");
                    telegramService.send(`ℹ️ <b>Autosolver OFF!</b>\nBypass dibatalkan. Silakan selesaikan Captcha secara manual.`);
                    
                    // Tetap panggil Macrodroid jika ada, karena butuh intervensi manual
                    if (macrodroidService) {
                        await macrodroidService.trigger("kena_captcha"); 
                    }
                    
                    this.isHandlingProcess = false;
                }

            } else {
                log.warn("⚠️ Captcha spam terdeteksi, trigger ditahan.");
                this.isHandlingProcess = false;
            }
        },


        async resume() {
            log.success("✅ Resuming Bot...");
            telegramService.send("🎉 <b>Captcha Selesai Otomatis!</b>\nAkun terbebas.");
            
            if (macrodroidService) {
                await macrodroidService.trigger("captcha_selesai");
            }

            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            state.hasActiveCaptcha = false;
            configManager.save();
            loopManager.startAll();
        }
    };

    return captchaHandler;
};
