const fs = require('fs');
const path = require('path');
const { handleDiscordOAuth } = require('./oauth');

const STATUSES = {
    SUCCESS: 'SUCCESS',
    ALREADY_VOTED: 'ALREADY_VOTED',
    CAPTCHA_DETECTED: 'CAPTCHA_DETECTED',
    FAILED: 'FAILED'
};

const SUCCESS_TEXTS = [
    'Thanks for Voting',
    'Voted Successfully',
    'You Have Voted'
];

const ALREADY_VOTED_TEXTS = [
    'Come Back Later',
    'already voted',
    'try again',
    'vote again'
];

const CAPTCHA_PATTERNS = [
    'captcha',
    'hcaptcha',
    'recaptcha',
    'verify you are human',
    'cloudflare'
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const ensureScreenshotDir = () => {
    const dir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const saveScreenshot = async (page, filename, logger) => {
    const dir = ensureScreenshotDir();
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath, fullPage: true });
    logger.info(`Screenshot tersimpan: ${fullPath}`);
    return fullPath;
};

const getPageText = async (page) => page.evaluate(() => document.body?.innerText || '');

const detectCaptcha = async (page) => {
    const text = await getPageText(page);
    const hasCaptchaText = CAPTCHA_PATTERNS.some(pattern => text.toLowerCase().includes(pattern));
    if (hasCaptchaText) return true;

    return page.evaluate(() => Boolean(
        document.querySelector('iframe[src*="captcha"], iframe[src*="hcaptcha"], iframe[src*="recaptcha"], .h-captcha, .g-recaptcha')
    ));
};

const detectVoteResult = async (page, logger) => {
    const text = await getPageText(page);
    const normalized = text.toLowerCase();

    if (SUCCESS_TEXTS.some(item => normalized.includes(item.toLowerCase()))) {
        logger.success('Vote berhasil terdeteksi dari teks halaman');
        return STATUSES.SUCCESS;
    }

    if (ALREADY_VOTED_TEXTS.some(item => normalized.includes(item.toLowerCase()))) {
        logger.info('Status sudah pernah vote / perlu kembali lagi terdeteksi');
        return STATUSES.ALREADY_VOTED;
    }

    return null;
};

const findVoteButton = async (page, logger) => {
    logger.info('Mencari tombol Vote pada button, anchor, role button, dan class button-primary');
    const handles = await page.$$('button, a, [role="button"], .button-primary, [class*="button-primary"]');

    for (const handle of handles) {
        const candidate = await page.evaluate(el => {
            const text = (el.innerText || el.textContent || '').trim();
            const className = String(el.className || '');
            const href = el.getAttribute('href') || '';
            const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true';

            return {
                text,
                className,
                href,
                disabled,
                visible: Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
            };
        }, handle);

        const isVote = /vote/i.test(`${candidate.text} ${candidate.className} ${candidate.href}`);
        const isPrimaryButton = /button-primary/i.test(candidate.className);

        if (!candidate.disabled && candidate.visible && (isVote || isPrimaryButton)) {
            logger.info(`Tombol vote ditemukan: "${candidate.text || candidate.className}"`);
            return handle;
        }
    }

    logger.error('Gagal menemukan tombol Vote');
    return null;
};

const openTopggAndAuthorize = async (page, topggUrl, logger) => {
    logger.info(`Membuka URL Top.gg: ${topggUrl}`);
    await page.goto(topggUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const pageText = await getPageText(page);
    if (/login|sign in|discord|authorize|authorise|continue|yetkilendir|devam et/i.test(pageText)) {
        await handleDiscordOAuth(page, logger);
    }
};

const performVote = async (page, topggConfig, logger) => {
    if (!topggConfig.topggUrl) {
        logger.error('topggUrl kosong; proses vote dibatalkan');
        return STATUSES.FAILED;
    }

    const maxRetry = Math.max(0, Number(topggConfig.maxRetry) || 0);

    for (let attempt = 0; attempt <= maxRetry; attempt += 1) {
        logger.info(`Memulai percobaan vote Top.gg ${attempt + 1}/${maxRetry + 1}`);
        await openTopggAndAuthorize(page, topggConfig.topggUrl, logger);

        const currentResult = await detectVoteResult(page, logger);
        if (currentResult) return currentResult;

        if (await detectCaptcha(page)) {
            logger.warn('Captcha terdeteksi sebelum klik vote');
            await saveScreenshot(page, `captcha_attempt_${attempt + 1}.png`, logger);
            if (attempt >= maxRetry) return STATUSES.CAPTCHA_DETECTED;
            await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
            continue;
        }

        const voteButton = await findVoteButton(page, logger);
        if (!voteButton) {
            await saveScreenshot(page, 'vote_error.png', logger);
            return STATUSES.FAILED;
        }

        logger.info('Mengeklik tombol Vote');
        await voteButton.click();
        await wait(3000);
        await handleDiscordOAuth(page, logger);
        await wait(3000);

        const afterClickResult = await detectVoteResult(page, logger);
        if (afterClickResult) return afterClickResult;

        if (await detectCaptcha(page)) {
            logger.warn('Captcha terdeteksi setelah klik vote');
            await saveScreenshot(page, `captcha_attempt_${attempt + 1}.png`, logger);
            if (attempt >= maxRetry) return STATUSES.CAPTCHA_DETECTED;
            logger.info('Reload halaman dan mengulang pencarian tombol Vote');
            await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
            continue;
        }

        if (attempt < maxRetry) {
            logger.warn('Hasil vote belum jelas, mencoba ulang');
            await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        }
    }

    logger.error('Proses vote gagal setelah semua percobaan');
    await saveScreenshot(page, 'vote_error.png', logger);
    return STATUSES.FAILED;
};

module.exports = {
    STATUSES,
    performVote,
    detectCaptcha,
    findVoteButton,
    detectVoteResult,
    saveScreenshot
};
