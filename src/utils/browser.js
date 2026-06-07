const path = require('path');

const DEFAULT_VIEWPORT = { width: 1366, height: 768 };

const loadPuppeteer = () => {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
    return puppeteer;
};

const initBrowser = async (topggConfig = {}, logger) => {
    logger.info(`Menjalankan Chromium Puppeteer (headless=${topggConfig.headless === true})`);
    const puppeteer = loadPuppeteer();
    const userDataDir = path.join(process.cwd(), '.topgg-browser-profile');

    return puppeteer.launch({
        headless: topggConfig.headless === true,
        userDataDir,
        defaultViewport: DEFAULT_VIEWPORT,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1366,768'
        ]
    });
};

module.exports = { initBrowser };
