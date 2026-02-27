const winston = require('winston');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
    level: isDev ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        // Console (coloured in dev)
        new winston.transports.Console({
            format: isDev
                ? winston.format.combine(
                    winston.format.colorize(),
                    winston.format.printf(({ timestamp, level, message, stack }) =>
                        stack
                            ? `${timestamp} [${level}] ${message}\n${stack}`
                            : `${timestamp} [${level}] ${message}`
                    )
                )
                : winston.format.json(),
        }),
        // Error log file
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join('logs', 'combined.log'),
        }),
    ],
});

// AI-specific logger with structured metadata
logger.logAI = ({ endpoint, inputLength, outputLength, model, latencyMs, success }) => {
    logger.info('AI service call', {
        type: 'ai_call',
        endpoint,
        inputLength,
        outputLength,
        model: model || 'gpt-4o',
        latencyMs,
        success,
    });
};

module.exports = logger;
