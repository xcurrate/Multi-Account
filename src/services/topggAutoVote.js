const createLogger = require('../utils/logger');
const { initBrowser } = require('../utils/browser');
const { loginDiscord } = require('../login');
const { performVote, STATUSES } = require('../vote');

const DISABLED_CHECK_INTERVAL_MS = 60000;

const DEFAULT_TOPGG_CONFIG = {
    enabled: false,
    discordToken: '',
    topggUrl: '',
    headless: true,
    maxRetry: 3,
    voteInterval: 43200000
};

const normalizeTopggConfig = (config = {}) => {
    const topgg = { ...DEFAULT_TOPGG_CONFIG, ...(config.topgg || {}) };
    topgg.enabled = topgg.enabled === true;
    topgg.headless = topgg.headless !== false;
    topgg.maxRetry = Math.max(0, parseInt(topgg.maxRetry, 10) || DEFAULT_TOPGG_CONFIG.maxRetry);
    topgg.voteInterval = Math.max(60000, parseInt(topgg.voteInterval, 10) || DEFAULT_TOPGG_CONFIG.voteInterval);
    topgg.discordToken = String(topgg.discordToken || config.token || '');
    topgg.topggUrl = String(topgg.topggUrl || '');
    return topgg;
};

const createTopggAutoVoteService = (configManager) => {
    const logger = createLogger('TOPGG');
    let timer = null;
    let running = false;
    let lastStatus = null;

    const clearTimer = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    const getConfig = () => normalizeTopggConfig(configManager.read ? configManager.read() : {});

    const scheduleNext = (delayMs) => {
        clearTimer();
        timer = setTimeout(runOnce, delayMs);
        if (typeof timer.unref === 'function') timer.unref();
        logger.info(`Auto Vote Top.gg dijadwalkan ulang dalam ${delayMs} ms`);
    };

    const runOnce = async () => {
        const topggConfig = getConfig();

        if (!topggConfig.enabled) {
            logger.info('Auto Vote Top.gg nonaktif; mengecek ulang konfigurasi dashboard nanti');
            scheduleNext(DISABLED_CHECK_INTERVAL_MS);
            return STATUSES.FAILED;
        }

        if (running) {
            logger.warn('Siklus vote sebelumnya masih berjalan; melewati eksekusi ini');
            scheduleNext(topggConfig.voteInterval);
            return lastStatus || STATUSES.FAILED;
        }

        running = true;
        let browser;

        try {
            logger.info('Memulai siklus Auto Vote Top.gg');
            browser = await initBrowser(topggConfig, logger);
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const loggedIn = await loginDiscord(page, topggConfig.discordToken, logger);
            if (!loggedIn) {
                lastStatus = STATUSES.FAILED;
                return lastStatus;
            }

            lastStatus = await performVote(page, topggConfig, logger);
            logger.info(`Status akhir Auto Vote Top.gg: ${lastStatus}`);
            return lastStatus;
        } catch (error) {
            logger.error(`Exception Auto Vote Top.gg: ${error.message}`);
            lastStatus = STATUSES.FAILED;
            return lastStatus;
        } finally {
            if (browser) {
                try {
                    await browser.close();
                    logger.info('Browser Puppeteer ditutup dengan aman');
                } catch (error) {
                    logger.warn(`Gagal menutup browser: ${error.message}`);
                }
            }

            running = false;
            const latestConfig = getConfig();
            if (latestConfig.enabled) scheduleNext(latestConfig.voteInterval);
        }
    };

    return {
        start() {
            const topggConfig = getConfig();
            logger.info(topggConfig.enabled
                ? 'Auto Vote Top.gg aktif dari config; menjalankan siklus awal'
                : 'Auto Vote Top.gg standby; toggle dashboard akan dicek berkala');
            scheduleNext(1000);
        },
        stop() {
            clearTimer();
            logger.info('Auto Vote Top.gg dihentikan');
        },
        runOnce,
        getStatus() {
            return { running, lastStatus, enabled: getConfig().enabled };
        }
    };
};

module.exports = createTopggAutoVoteService;
module.exports.DEFAULT_TOPGG_CONFIG = DEFAULT_TOPGG_CONFIG;
module.exports.normalizeTopggConfig = normalizeTopggConfig;
