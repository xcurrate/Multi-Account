const OAUTH_BUTTON_TEXTS = ['Authorize', 'Authorise', 'Continue', 'Yetkilendir', 'Devam Et'];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const clickButtonByText = async (page, labels, logger) => {
    const handles = await page.$$('button, a, [role="button"]');

    for (const handle of handles) {
        const text = await page.evaluate(el => (el.innerText || el.textContent || '').trim(), handle);
        if (labels.some(label => text.toLowerCase().includes(label.toLowerCase()))) {
            logger.info(`Menekan tombol OAuth: ${text}`);
            await handle.click();
            return true;
        }
    }

    return false;
};

const handleDiscordOAuth = async (page, logger, maxSteps = 5) => {
    logger.info('Memeriksa kebutuhan login/otorisasi Discord OAuth');

    for (let step = 1; step <= maxSteps; step += 1) {
        const url = page.url();
        const text = await page.evaluate(() => document.body?.innerText || '');
        const needsOAuth = /discord\.com\/oauth2|discord\.com\/api\/oauth2|authorize|authorise|continue|yetkilendir|devam et/i.test(`${url}\n${text}`);

        if (!needsOAuth) {
            logger.info('OAuth Discord tidak diperlukan atau sudah selesai');
            return true;
        }

        logger.info(`OAuth Discord terdeteksi (step ${step}/${maxSteps})`);
        const clicked = await clickButtonByText(page, OAUTH_BUTTON_TEXTS, logger);

        if (!clicked) {
            logger.warn('Tombol OAuth belum ditemukan; menunggu perubahan halaman');
        }

        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        } catch {
            await wait(2000);
        }
    }

    const finalText = await page.evaluate(() => document.body?.innerText || '');
    const stillNeedsOAuth = /authorize|authorise|continue|yetkilendir|devam et/i.test(finalText);
    if (stillNeedsOAuth) {
        logger.error('OAuth Discord gagal diselesaikan otomatis');
        return false;
    }

    logger.success('OAuth Discord selesai');
    return true;
};

module.exports = { handleDiscordOAuth };
