const rateLimit = require('express-rate-limit');

const createLimiter = (windowMinutes, max, message) =>
    rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message, code: 'RATE_LIMIT_EXCEEDED' },
    });

// Global — 100 requests per minute per IP
const globalLimiter = createLimiter(1, 100, 'Too many requests. Please slow down.');

// Auth routes — 5 per minute (brute-force protection)
const authLimiter = createLimiter(1, 5, 'Too many login attempts. Try again in 1 minute.');

// AI routes — 10 per minute per user (GPT is expensive)
const aiLimiter = createLimiter(1, 10, 'AI request limit reached. Max 10 AI requests per minute.');

module.exports = { globalLimiter, authLimiter, aiLimiter };
