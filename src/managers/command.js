const CONSTANTS = require('../constants');
const log = require('../../logger');
const { sleep, randomInt } = require('../utils');

module.exports = (state, channelManager, emergencyHandler) => ({
    async send(cmd, type = '') {
        if (state.hasActiveCaptcha) {
            log.warn(`⚠️ Command [${cmd}] ditahan: CAPTCHA sedang aktif.`);
            return;
        }
        if (state.config.botStatus.paused || !state.config.botStatus.running) return;
        if (!state.client?.isReady()) return;

        if (!state.activeChannelId && !channelManager.updateActive()) return;

        const channel = state.client.channels.cache.get(state.activeChannelId);
        if (!channel) return;

        await channel.sendTyping();
        await sleep(randomInt(CONSTANTS.MIN_TYPING_DELAY, CONSTANTS.MAX_TYPING_DELAY));

        if (state.hasActiveCaptcha) {
            log.warn(`⚠️ Command [${cmd}] dibatalkan setelah typing: CAPTCHA sedang aktif.`);
            return;
        }

        try {
            await channel.send(cmd);

            const commandType = type || 'Other';
            state.stats = state.stats || {};
            state.stats.commands = state.stats.commands || { total: 0, byType: {}, recent: [], last: null };
            state.stats.commands.total += 1;
            state.stats.commands.byType[commandType] = (state.stats.commands.byType[commandType] || 0) + 1;
            state.stats.commands.last = { cmd, type: commandType, at: Date.now() };
            state.stats.commands.recent.unshift(state.stats.commands.last);
            state.stats.commands.recent = state.stats.commands.recent.slice(0, 8);

            log.info(`📨 Sent: ${cmd} [${type}]`);

            // TIMEOUT HANYA UNTUK BATTLE DAN HUNT
            if (type === 'Battle' || type === 'Hunt') {
                this.setResponseTimeout(type);
            }
        } catch (e) {
            log.error(`Gagal kirim: ${e.message}`);
        }
    },

    setResponseTimeout(type) {
        // ✅ HANYA set timeout kalau belum ada yang aktif
        if (state.responseTimeout) {
            log.warn(`⏳ Timeout already active, skipping new timeout for ${type}`);
            return;  
        }
        
        // Set new timeout
        state.responseTimeout = setTimeout(() => {
            log.error(`⛔ TIMEOUT 40s - No response from OwO for ${type}`);
            
            // ✅ FIX: Hapus telegramService.send di sini.
            // emergencyHandler.pause() sudah otomatis handle notifikasi telegram di file emergency.js!
            emergencyHandler.pause('TIMEOUT 40s (OwO No Response)');
        }, CONSTANTS.RESPONSE_TIMEOUT_MS);
        
        log.info(`⏲️ Response timeout set for ${type}: ${CONSTANTS.RESPONSE_TIMEOUT_MS/1000}s`);
    },

    clearResponseTimeout() {
        if (state.responseTimeout) {
            clearTimeout(state.responseTimeout);
            state.responseTimeout = null;
            log.info(`✅ Response timeout cleared - OwO responded in time`);
        }
    }
});
