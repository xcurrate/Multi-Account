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

const tokenStorageScript = (discordToken) => {
    const serializedToken = JSON.stringify(discordToken);
    const errors = [];

    const persistToStorage = (storageName) => {
        try {
            const storage = window[storageName];
            if (!storage || typeof storage.setItem !== 'function') {
                errors.push(`${storageName}.setItem tidak tersedia`);
                return false;
            }

            storage.setItem('token', serializedToken);
            return true;
        } catch (error) {
            errors.push(`${storageName}: ${error.message}`);
            return false;
        }
    };

    const localOk = persistToStorage('localStorage');
    const sessionOk = persistToStorage('sessionStorage');

    return {
        ok: localOk || sessionOk,
        localOk,
        sessionOk,
        errors
    };
};

const setDiscordToken = async (page, token, logger) => {
    await page.evaluateOnNewDocument(tokenStorageScript, token);

    const result = await page.evaluate(tokenStorageScript, token);
    if (!result.ok) {
        logger.warn(`Gagal menyimpan token Discord ke browser storage: ${result.errors.join('; ')}`);
        return false;
    }

    logger.info(`Token Discord tersimpan di browser storage (localStorage=${result.localOk}, sessionStorage=${result.sessionOk})`);
    return true;
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
        logger.error('Token akun aktif kosong; login Discord dibatalkan');
        return false;
    }

    logger.info('Membuka halaman login Discord');
    await page.goto(DISCORD_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const tokenStored = await setDiscordToken(page, discordToken, logger);
    if (!tokenStored) {
        logger.error('Login Discord dibatalkan karena token gagal disimpan ke browser storage');
        return false;
    }

    logger.info('Token Discord disimpan, membuka Discord App');
    await page.goto(DISCORD_APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    return verifyDiscordLogin(page, logger);
};

module.exports = { loginDiscord, verifyDiscordLogin, setDiscordToken };
