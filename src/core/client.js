const { Client } = require('discord.js-selfbot-v13');
const log = require('../../logger');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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

            // Di bagian setelah client ready, tambahkan:
            setTimeout(async () => {
                // 1. Init tetap dipertahankan
                if (huntbotManager) {
                    huntbotManager.init();
                }

                // 2. Langsung tembak "whb" dan "wboss t"
                try {
                    // Mengambil channelId secara dinamis dari config
                    const channelId = state.config.tiketandhb.channelId;
                    const channel = state.client.channels.cache.get(channelId);
                    
                    if (channel) {
                        log.info("🚀 Menembak command awal secara langsung...");
                        
                        // Tembak whb
                        await channel.send("whb 1d");
                        
                        // Jeda 1 detik biar tidak terlalu cepat (anti-spam)
                        await new Promise(resolve => setTimeout(resolve, 5000)); 
                        
                        // Tembak wboss t
                        await channel.send("wboss t");
                        
                        log.info("✅ Auto-command whb dan wboss t berhasil terkirim.");
                    } else {
                        log.warn(`⚠️ Channel ${channelId} tidak ditemukan untuk mengirim command awal.`);
                    }
                } catch (err) {
                    log.error(`❌ Gagal mengirim command awal: ${err.message}`);
                }

            }, 2000);
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