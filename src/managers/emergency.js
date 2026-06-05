const log = require('../../logger');

module.exports = (state, configManager, loopManager, channelManager, telegramService) => ({
    pause(reason) {
        log.error(`⛔ ${reason} -> PAUSE.`);
        state.config.botStatus.paused = true;
        state.config.botStatus.running = false;
        configManager.save();
        
        // ✅ Null check
// emergency.js - Final fix
if (loopManager && typeof loopManager.stopAll === 'function') {
    loopManager.stopAll();
}
 else {
            log.warn('loopManager not available, skipping stopAll');
        }
        
        if (channelManager) {
            channelManager.stopRotation();
        }
        
        telegramService.send(`⛔ <b>Bot Paused</b>\nAlasan: ${reason}`);
    }
});
