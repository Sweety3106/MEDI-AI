const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let error = err;

    // Convert known third-party errors to AppErrors
    if (err.name === 'CastError') {
        error = new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'CAST_ERROR');
    } else if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        error = new AppError(`Duplicate value for ${field}. Please use a different value.`, 400, 'DUPLICATE_KEY');
    } else if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message).join('. ');
        error = new AppError(messages, 400, 'VALIDATION_ERROR');
    } else if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token. Please log in again.', 401, 'JWT_INVALID');
    } else if (err.name === 'TokenExpiredError') {
        error = new AppError('Token expired. Please log in again.', 401, 'JWT_EXPIRED');
    }

    const statusCode = error.statusCode || 500;
    const isDev = process.env.NODE_ENV !== 'production';

    // Log error
    if (statusCode >= 500) {
        logger.error(error.message, { stack: error.stack, path: req.path, method: req.method });
    } else {
        logger.warn(error.message, { code: error.code, path: req.path, method: req.method });
    }

    res.status(statusCode).json({
        success: false,
        message: error.message || 'Something went wrong',
        code: error.code || 'INTERNAL_ERROR',
        ...(error.details && { details: error.details }),
        ...(isDev && statusCode >= 500 && { stack: error.stack }),
    });
};

module.exports = errorHandler;
