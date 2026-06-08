getUserId(token) {
        if (!token || typeof token !== 'string') return 'default';
        
        try {
            const parts = token.split('.');
            if (parts.length < 2) return 'default';

            const base64Id = parts[0];
            const padded = base64Id + '='.repeat((4 - base64Id.length % 4) % 4);
            const decodedId = Buffer.from(padded, 'base64').toString('utf8');

            if (/^\d{17,20}$/.test(decodedId)) {
                return decodedId;
            }
            return 'default';
        } catch (err) {
            console.error('[PROFILE] Gagal parse token:', err.message);
            return 'default';
        }
    },