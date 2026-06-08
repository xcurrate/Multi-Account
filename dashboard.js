if (body.action === 'newProfile') {
            const newToken = body.newToken?.trim();
            if (!newToken) {
                return res.send(uiComponents.getSavedResponse());
            }

            const targetId = profileManager.getUserId(newToken);
            
            if (targetId === 'default') {
                console.error('[PROFILE] Gagal membuat profil baru: Token tidak valid atau bukan user token.');
                // Tetap simpan token baru ke config utama meskipun ID default
                let currentConfig = configManager.ensureShape(configManager.get());
                currentConfig.token = newToken;
                configManager.save(currentConfig);
                return res.send(uiComponents.getSavedResponse());
            }

            const profilePath = profileManager.getProfilePath(targetId);
            
            // Buat config baru berdasarkan shape
            let newConfig = configManager.ensureShape({});
            newConfig.token = newToken;

            // Simpan ke file profil terpisah
            fileService.writeJson(profilePath, newConfig);
            
            // Jadikan aktif di config utama
            configManager.save(newConfig);

            console.log(`[PROFILE] Akun baru berhasil dibuat sebagai profil mandiri: ${targetId}`);
            return res.send(uiComponents.getSavedResponse());
        }