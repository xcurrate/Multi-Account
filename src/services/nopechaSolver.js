const log = require('../../logger'); // Sesuaikan path logger-nya jika letak file ini berbeda

class NopechaSolver {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.nopecha.com/v1";
    }

    // Mengambil sisa Credit / Kuota
    async getBalance() {
        try {
            const response = await fetch(`${this.baseUrl}/status`, {
                method: "GET",
                headers: { "Authorization": `Basic ${this.apiKey}` }
            });
            const data = await response.json();
            return data.credit !== undefined ? data.credit : "Tidak diketahui";
        } catch (error) {
            log.error(`Gagal cek saldo NopeCha: ${error.message}`);
            return "Error";
        }
    }

    // Membuat tugas dan menunggu hasilnya (Max 2 Menit per tugas)
    async solve(sitekey, url) {
        log.info("Memesan teka-teki hCaptcha ke NopeCha...");
        
        const submitResponse = await fetch(`${this.baseUrl}/token/hcaptcha`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${this.apiKey}`
            },
            body: JSON.stringify({ sitekey, url })
        });

        const submitData = await submitResponse.json();

        if (submitResponse.status !== 200 || !submitData.data) {
            throw new Error(submitData.message || "Gagal membuat tugas NopeCha");
        }

        const jobId = submitData.data;
        log.info(`NopeCha ID [${jobId.substring(0, 8)}...] terbit. Menunggu AI...`);

        let solvedToken = null;
        let attempt = 0;
        const maxPolls = 24; // 24 * 5 detik = 2 menit

        while (!solvedToken && attempt < maxPolls) {
            attempt++;
            await new Promise(resolve => setTimeout(resolve, 5000)); 
            
            const pollResponse = await fetch(`${this.baseUrl}/token/hcaptcha?id=${jobId}`, {
                method: "GET",
                headers: { "Authorization": `Basic ${this.apiKey}` }
            });
            
            const pollData = await pollResponse.json();

            if (pollResponse.status === 200 && pollData.data) {
                return pollData.data; // Berhasil! Kembalikan token
            } 
            else if (pollData.message && pollData.message.toLowerCase().includes("incomplete")) {
                // Biar tidak spam log, kita print status tiap 15 detik saja (attempt kelipatan 3)
                if (attempt % 3 === 0) {
                    log.info(`[NopeCha] AI masih bekerja... (${attempt * 5}s)`);
                }
            } else {
                throw new Error(pollData.message || "Error saat mengambil token API NopeCha.");
            }
        }

        throw new Error("Job Timeout (AI gagal menyelesaikan dalam 2 menit).");
    }
}

module.exports = NopechaSolver;
