if (body.action === 'newProfile') {
            const newToken = body.newToken?.trim();
            if (!newToken) return res.send(uiComponents.getSavedResponse());

            const targetId = profileManager.getUserId(newToken);

            if (targetId === 'default') {
                console.error('[PROFILE] Token tidak valid. Tidak bisa membuat profil mandiri.');
                let currentConfig = configManager.ensureShape(configManager.get());
                currentConfig.token = newToken;
                configManager.save(currentConfig);
                return res.send(uiComponents.getSavedResponse());
            }

            const profilePath = profileManager.getProfilePath(targetId);
            let newConfig = configManager.ensureShape({});
            newConfig.token = newToken;

            fileService.writeJson(profilePath, newConfig);
            configManager.save(newConfig);

            console.log(`[PROFILE] Akun baru berhasil dibuat: ${targetId}`);
            return res.send(uiComponents.getSavedResponse());
        }