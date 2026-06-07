const DISCORD_APP_URL = 'https://discord.com/app';
const DISCORD_LOGIN_URL = 'https://discord.com/login';

const LOGIN_SELECTORS = [
    '[aria-label="Servers"]',
    '[data-list-id="guildsnav"]',
    '[aria-label="Direct Messages"]',
    '[class*="avatar"]',
    'nav[class*="guilds"]'
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const setDiscordToken = async (page, token) => {
    await page.evaluateOnNewDocument((discordToken) => {
        window.localStorage.setItem('token', JSON.stringify(discordToken));
    }, token);

    await page.evaluate((discordToken) => {
        window.localStorage.setItem('token', JSON.stringify(discordToken));
    }, token);
};

const verifyDiscordLogin = async (page, logger, timeoutMs = 30000) => {
    logger.info('Memverifikasi login Discord melalui avatar/guild list/direct messages');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        for (const selector of LOGIN_SELECTORS) {
            const element = await page.$(selector);
            if (element) {
                logger.success(`Login Discord terverifikasi via selector: ${selector}`);
                return true;
            }
        }

        const pageText = await page.evaluate(() => document.body?.innerText || '');
        if (/direct messages|friends|nitro|servers/i.test(pageText)) {
            logger.success('Login Discord terverifikasi via teks antarmuka');
            return true;
        }

        if (/email or phone number|password|required/i.test(pageText)) {
            logger.warn('Discord masih menampilkan form login; token mungkin tidak valid');
        }

        await wait(1000);
    }

    logger.error('Gagal memverifikasi login Discord sebelum timeout');
    return false;
};

const loginDiscord = async (page, discordToken, logger) => {
    if (!discordToken) {
        logger.error('discordToken kosong; login Discord dibatalkan');
        return false;
    }

    logger.info('Membuka halaman login Discord');
    await page.goto(DISCORD_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await setDiscordToken(page, discordToken);

    logger.info('Token Discord disimpan ke localStorage, membuka Discord App');
    await page.goto(DISCORD_APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    return verifyDiscordLogin(page, logger);
};

module.exports = { loginDiscord, verifyDiscordLogin };
