// --- STATE MANAGEMENT ---
module.exports = {
    startedAt: Date.now(),
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
    hasActiveCaptcha: false,
    hasRunInitialReadyCommands: false,
    hasUsedFirstLoopStartupStagger: false,
    captchaSolverAbortController: null,
    captchaSolveRunId: 0,
    stats: {
        commands: {
            total: 0,
            byType: {},
            recent: [],
            last: null
        },
        captcha: {
            detected: 0,
            solved: 0,
            lastDetectedAt: null,
            lastSolvedAt: null
        }
    },
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
