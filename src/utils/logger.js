const LEVELS = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    success: 'SUCCESS'
};

const createLogger = (scope = 'TOPGG') => {
    const write = (level, message, details) => {
        const timestamp = new Date().toISOString();
        const suffix = details ? ` ${typeof details === 'string' ? details : JSON.stringify(details)}` : '';
        console.log(`[${timestamp}] [${scope}] [${LEVELS[level] || level.toUpperCase()}] ${message}${suffix}`);
    };

    return {
        info: (message, details) => write('info', message, details),
        warn: (message, details) => write('warn', message, details),
        error: (message, details) => write('error', message, details),
        success: (message, details) => write('success', message, details)
    };
};

module.exports = createLogger;
