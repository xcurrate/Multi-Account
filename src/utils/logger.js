const appLogger = require('../../logger');

const createLogger = (scope = 'TOPGG') => {
    const prefix = (message) => `[${scope}] ${message}`;

    return {
        info: (message) => appLogger.info(prefix(message)),
        warn: (message) => appLogger.warn(prefix(message)),
        error: (message) => appLogger.error(prefix(message)),
        success: (message) => appLogger.success(prefix(message))
    };
};

module.exports = createLogger;
