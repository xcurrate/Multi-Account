// --- STATE MANAGEMENT ---
module.exports = {
    client: null,
    config: {},
    activeToken: '',
    activeChannelId: null,
    stopBossHunt: false,
    lastRefillTimestamp: 0,
    foughtBosses: new Set(),
    bossCooldowns: new Map(),
    bossRespawnTimers: new Map(),
    responseTimeout: null,
    channelRotateTimer: null,
    lastChannelId: null,
    lastTicketCheck: 0,
    loops: {
        battle: null,
        hunt: null,
        pray: null,
        custom1: null,
        custom2: null
    }
};