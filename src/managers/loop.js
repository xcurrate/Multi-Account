const log = require('../../logger');
const { randomInt } = require('../utils');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
module.exports = (state, commandSender) => ({



    // Pastikan storage ada
    init() {
        state.nextAt = state.nextAt || {};
        state.loops = state.loops || {};
    },

    // Helper: schedule + simpan next run time
    _scheduleLoop(key, fn, delayMs) {
        const delay = Math.max(0, Number(delayMs) || 0);

        state.nextAt[key] = Date.now() + delay;

        if (state.loops[key]) clearTimeout(state.loops[key]);
        state.loops[key] = setTimeout(fn, delay);
    },

    // Delay normal (murni dari config)
    _getDefaultDelay(key) {
        const d = state.config?.delays?.[key];

        // delays battle/hunt/pray formatnya { min, max }
        if (d?.min != null && d?.max != null) return randomInt(d.min, d.max);

        // custom1/custom2 bisa punya delays.custom1 / delays.custom2 atau fallback
        if (key === 'custom1') {
            const min = state.config?.delays?.custom1?.min || 60000;
            const max = state.config?.delays?.custom1?.max || 120000;
            return randomInt(min, max);
        }

        if (key === 'custom2') {
            const min = state.config?.delays?.custom2?.min || 60000;
            const max = state.config?.delays?.custom2?.max || 120000;
            return randomInt(min, max);
        }

        // fallback aman
        return 1000;
    },

    // Helper: resume berdasarkan sisa waktu
    _resumeLoop(key, fn) {
        const next = state.nextAt[key];

        // Case 1: Tidak ada jadwal yang tersimpan → jalankan langsung
        if (typeof next !== 'number') {
            fn();
            return;
        }

        const remaining = next - Date.now();

        // Case 2: Waktu sudah lewat atau tepat waktu → eksekusi segera, jangan reschedule
        if (remaining <= 0) {
            fn();
            return;
        }

        // Case 3: Masih ada waktu tersisa → schedule seperti biasa
        this._scheduleLoop(key, fn, remaining);
    },

async battle() {
    if (state.config.botStatus.paused || !state.config.settings?.battle) return;

    // 1. TUNGGU: Jika bot sedang sibuk, tunggu 500ms lalu cek lagi
    while (state.isBusy) {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 2. KUNCI: Tandai bot sedang sibuk agar custom1 tidak menyela
    state.isBusy = true; 

    try {
        await commandSender.send('wb', 'Battle');
        
        // (Opsional) Tambahkan jeda aman antara wb dan wh agar tidak dikira spam
        await new Promise(resolve => setTimeout(resolve, 10)); 
            if (state.config.botStatus.paused || !state.config.settings?.battle) return;
        await commandSender.send('wh', 'Hunt');
    } catch (error) {
        console.error(`❌ Gagal Battle/Hunt: ${error.message || error}`);
    } finally {
        // 3. LEPAS: Tandai bot sudah tidak sibuk
        state.isBusy = false; 

        const d = randomInt(
            state.config.delays.battle.min,
            state.config.delays.battle.max
        );

        this._scheduleLoop('battle', () => this.battle(), d);
    }
},

/*
    async hunt() {
        if (state.config.botStatus.paused || !state.config.settings?.hunt) return;

        // HAPUS: commandSender.clearResponseTimeout();

        try {
            await commandSender.send('wh', 'Hunt');
        } catch (error) {
            console.error(`❌ Gagal Hunt: ${error.message || error}`);
        } finally {
            const d = randomInt(
                state.config.delays.hunt.min,
                state.config.delays.hunt.max
            );

            this._scheduleLoop('hunt', () => this.hunt(), d);
        }
    },
*/
    async pray() {
        if (state.config.botStatus.paused || !state.config.settings?.pray) return;

        // HAPUS: commandSender.clearResponseTimeout();

        try {
            await commandSender.send('wpray', 'Pray');
        } catch (error) {
            console.error(`❌ Gagal Pray: ${error.message || error}`);
        } finally {
            const d = randomInt(
                state.config.delays.pray.min,
                state.config.delays.pray.max
            );

            this._scheduleLoop('pray', () => this.pray(), d);
        }
    },

async custom1() {
    if (state.config.botStatus.paused || !state.config.settings?.custom) return;

    const text = state.config.settings.text1?.trim();
    if (!text) return;

    // 1. TUNGGU: Jika battle sedang jalan, custom1 akan menunggu di sini
    while (state.isBusy) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // 2. KUNCI: Cegah battle menyela saat custom1 sedang jalan
    state.isBusy = true; 

    try {
        await commandSender.send(text, 'Custom1');
    } catch (error) {
        console.error(`❌ Gagal Custom1: ${error.message || error}`);
    } finally {
        // 3. LEPAS: Buka kunci kembali
        state.isBusy = false; 

        const min = state.config.delays.custom1?.min || 60000;
        const max = state.config.delays.custom1?.max || 120000;
        const d = randomInt(min, max);

        this._scheduleLoop('custom1', () => this.custom1(), d);
    }
},

    async custom2() {
        if (state.config.botStatus.paused || !state.config.settings?.custom) return;

        const text = state.config.settings.text2?.trim();
        if (!text) return;

        // HAPUS: commandSender.clearResponseTimeout();

        try {
            await commandSender.send(text, 'Custom2');
        } catch (error) {
            console.error(`❌ Gagal Custom2: ${error.message || error}`);
        } finally {
            const min = state.config.delays.custom2?.min || 60000;
            const max = state.config.delays.custom2?.max || 120000;
            const d = randomInt(min, max);

            this._scheduleLoop('custom2', () => this.custom2(), d);
        }
    },

    startAll() {
        this.init();
        this.stopAll();

        // Boot gap kecil biar tidak "0.x detik beruntun" saat first start
        // Ini TIDAK mempengaruhi delay loop normal setelahnya.
        let stagger = 0;
        const bump = () => (stagger += randomInt(800, 1000));

        if (state.config.settings?.battle)
            setTimeout(() => this._resumeLoop('battle', () => this.battle()), bump());

        if (state.config.settings?.hunt)
            setTimeout(() => this._resumeLoop('hunt', () => this.hunt()), bump());

        if (state.config.settings?.pray)
            setTimeout(() => this._resumeLoop('pray', () => this.pray()), bump());

        if (state.config.settings?.custom) {
            if (state.config.settings.text1?.trim())
                setTimeout(() => this._resumeLoop('custom1', () => this.custom1()), bump());

            if (state.config.settings.text2?.trim())
                setTimeout(() => this._resumeLoop('custom2', () => this.custom2()), bump());
        }

        log.success('🔄 Semua loop dimulai / resume');
    },

    stopAll() {
        Object.keys(state.loops || {}).forEach(key => {
            if (state.loops[key]) {
                clearTimeout(state.loops[key]);
                state.loops[key] = null;
            }
        });

        if (state.responseTimeout) {
            clearTimeout(state.responseTimeout);
            state.responseTimeout = null;
        }

        log.info('⏹️ Semua loop dihentikan');
    }
});
