getSavedProfiles() {
        const dir = path.join(__dirname, 'profiles');
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
            .filter(f => f.startsWith('config_') && f.endsWith('.json'))
            .map(f => f.replace('config_', '').replace('.json', ''));
    },