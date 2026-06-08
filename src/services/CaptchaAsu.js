const log = require('../../logger');
const NopechaSolver = require('./solvers/NopechaSolver');

/**
 * CaptchaAsu - Orchestrator untuk multi-solver captcha (Sequential Fallback)
 * Nama class sesuai permintaan user
 */
class CaptchaAsu {
    constructor(config = {}) {
        this.solvers = [];           // Daftar solver yang tersedia
        this.primarySolver = null;   // Solver utama
        this.fallbackSolvers = [];   // Solver cadangan (sequential)

        this.maxTotalTimeMs = config.maxTotalTimeMs || 10 * 60 * 1000; // 10 menit
        this.retryPerSolver = config.retryPerSolver || 2;
        this.timeoutPerAttemptMs = config.timeoutPerAttemptMs || 30000;

        this.stats = {
            totalAttempts: 0,
            success: 0,
            failed: 0
        };
    }

    /**
     * Register solver
     * @param {BaseSolver} solverInstance
     */
    registerSolver(solverInstance) {
        if (!solverInstance || typeof solverInstance.solve !== 'function') {
            throw new Error('Solver harus meng-extend BaseSolver');
        }
        this.solvers.push(solverInstance);
        log.info(`[CaptchaAsu] Solver registered: ${solverInstance.getName()}`);
    }

    /**
     * Set primary solver + fallback solvers
     * @param {string} primaryName - Nama solver utama
     * @param {string[]} fallbackNames - Array nama solver cadangan
     */
    setSolverOrder(primaryName, fallbackNames = []) {
        this.primarySolver = this.solvers.find(s => s.getName() === primaryName);
        this.fallbackSolvers = fallbackNames
            .map(name => this.solvers.find(s => s.getName() === name))
            .filter(Boolean);

        if (!this.primarySolver) {
            throw new Error(`Primary solver "${primaryName}" tidak ditemukan`);
        }

        log.info(`[CaptchaAsu] Primary: ${primaryName} | Fallback: ${fallbackNames.join(', ') || 'None'}`);
    }

    /**
     * Solve captcha dengan sequential fallback + retry
     */
    async solve(sitekey, url, options = {}) {
        const startTime = Date.now();
        const allSolvers = [this.primarySolver, ...this.fallbackSolvers].filter(Boolean);

        if (allSolvers.length === 0) {
            throw new Error('Tidak ada solver yang terdaftar di CaptchaAsu');
        }

        this.stats.totalAttempts++;

        for (const solver of allSolvers) {
            const solverStart = Date.now();

            for (let attempt = 1; attempt <= this.retryPerSolver; attempt++) {
                try {
                    // Cek apakah sudah melebihi total time
                    if (Date.now() - startTime > this.maxTotalTimeMs) {
                        throw new Error('Total solve time exceeded 10 minutes');
                    }

                    log.info(`[CaptchaAsu] Mencoba ${solver.getName()} (attempt ${attempt}/${this.retryPerSolver})`);

                    const token = await Promise.race([
                        solver.solve(sitekey, url, options),
                        this._timeout(this.timeoutPerAttemptMs, solver.getName())
                    ]);

                    const duration = ((Date.now() - solverStart) / 1000).toFixed(1);
                    log.success(`[CaptchaAsu] Berhasil dengan ${solver.getName()} dalam ${duration}s`);

                    this.stats.success++;
                    return token;

                } catch (error) {
                    const isTimeout = error.message.includes('timeout');
                    log.warn(`[CaptchaAsu] ${solver.getName()} gagal (attempt ${attempt}): ${error.message}`);

                    if (attempt === this.retryPerSolver) {
                        log.error(`[CaptchaAsu] ${solver.getName()} gagal setelah ${this.retryPerSolver} percobaan`);
                    }

                    // Jika ini bukan retry terakhir, lanjut ke attempt berikutnya
                    if (attempt < this.retryPerSolver) {
                        await new Promise(r => setTimeout(r, 2000)); // jeda 2 detik sebelum retry
                    }
                }
            }

            // Solver ini gagal total → lanjut ke solver berikutnya
            log.warn(`[CaptchaAsu] Beralih ke solver berikutnya...`);
        }

        this.stats.failed++;
        throw new Error('Semua solver gagal setelah mencoba semua fallback');
    }

    _timeout(ms, solverName) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${solverName} timeout setelah ${ms / 1000}s`)), ms)
        );
    }

    getStats() {
        return { ...this.stats };
    }
}

module.exports = CaptchaAsu;
