const { Client } = require('discord.js-selfbot-v13');
const log = require('../../logger');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntilCaptchaClear(state) {
    while (state.hasActiveCaptcha) {
        log.warn('⏸️ Startup command ditahan: CAPTCHA sedang aktif. Menunggu verifikasi...');
        await wait(1000);
    }
}

async function sendStartupCommand(state, channel, cmd) {
    await waitUntilCaptchaClear(state);
    if (!state.client?.isReady()) return false;

    await channel.send(cmd);
    log.info(`🚀 [Startup Ready] Terkirim: ${cmd}`);

    const startedWait = Date.now();
    while (Date.now() - startedWait < 5000) {
        await waitUntilCaptchaClear(state);
        const remaining = 5000 - (Date.now() - startedWait);
        if (remaining > 0) await wait(Math.min(1000, remaining));
    }

    return true;
}

// TAMBAH PARAMETER huntbotManager
module.exports = (state, configManager, channelManager, messageHandler, telegramService, huntbotManager, voiceManager) => ({
    initialize() {
        if (state.client) {
            log.warn('🔄 Merestart sesi Discord...');
            try {
                state.client.destroy();
            } catch (e) { }
            state.client = null;
        }

        state.client = new Client({ checkUpdate: false });

        state.client.on('ready', () => {
            log.success(`✅ Login Sukses: ${state.client.user.tag}`);
            telegramService.send(`🤖 <b>Bot Started</b>\nUser: ${state.client.user.tag}`);
            channelManager.updateActive();

            state.config.botStatus = state.config.botStatus || {};
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            configManager.save();

            if (voiceManager) {
                voiceManager.joinConfigured('restart').catch(err => log.error(`❌ Auto Join VC gagal: ${err.message}`));
            }

            if (huntbotManager) {
                huntbotManager.init({ skipInitialCheck: true });
            }

            if (!state.hasRunInitialReadyCommands) {
                state.hasRunInitialReadyCommands = true;

                setTimeout(async () => {
                    try {
                        const channelId = state.config.tiketandhb?.channelId;
                        const channel = state.client.channels.cache.get(channelId);

                        if (!channel) {
                            log.warn(`⚠️ Channel ${channelId} tidak ditemukan untuk mengirim command awal.`);
                            return;
                        }

                        log.info("🚀 Menjalankan command awal client-ready secara berurutan...");
                        await sendStartupCommand(state, channel, "whb 1d");
                        await sendStartupCommand(state, channel, "wboss t");
                        log.info("✅ Command awal client-ready selesai terkirim berurutan.");
                    } catch (err) {
                        log.error(`❌ Gagal mengirim command awal: ${err.message}`);
                    }
                }, 2000);
            }
        });


        state.client.on('messageCreate', (msg) => messageHandler.handle(msg));

        if (state.activeToken && state.activeToken.length > 20) {
            state.client.login(state.activeToken).catch(e => {
                log.error(`❌ Token Invalid / Login Gagal: ${e.message}`);
            });
        } else {
            log.error('❌ Tidak ada token yang valid di config!');
        }
    }
});