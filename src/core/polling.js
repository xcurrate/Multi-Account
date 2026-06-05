const CONSTANTS = require('../constants');
const log = require('../../logger');

module.exports = (state, configManager, clientManager, channelManager, loopManager, telegramService) => ({
    start() {
        setInterval(() => {
            const result = configManager.updateFromDisk();

            if (result.tokenChanged) {
                log.warn('⚠️ Token berubah! Login ulang...');
                state.activeToken = state.config.token;
                clientManager.initialize();
                return;
            }

            if (result.channelsChanged) {
                log.info('🔄 Daftar Channel berubah. Mengupdate target...');
                channelManager.updateActive();
            }

            if (result.statusChanged) {
                this.handleStatusChange(result);
            }
        }, CONSTANTS.POLLING_INTERVAL_MS);
    },

    handleStatusChange(result) {
        const { wasPaused, wasRunning, nowPaused, nowRunning } = result;

        if (wasPaused && !nowPaused && nowRunning) {
            log.success('▶️ Bot di-START dari dashboard');
            state.config.botStatus.paused = false;
            state.config.botStatus.running = true;
            
            if (!state.client?.isReady()) {
                clientManager.initialize();
            } else {
                loopManager.startAll();
                channelManager.scheduleRotation();
            }
            
            telegramService.send(`▶️ <b>Bot Started</b> via Dashboard`);
        }
        
        else if (!wasPaused && nowPaused && !nowRunning) {
            log.warn('⏸️ Bot di-PAUSE dari dashboard');
            state.config.botStatus.paused = true;
            state.config.botStatus.running = false;
            
            loopManager.stopAll();
            channelManager.stopRotation();
            
            telegramService.send(`⏸️ <b>Bot Paused</b> via Dashboard`);
        }
    }
});