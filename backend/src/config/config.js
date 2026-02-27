const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 5000,
    mongodb: {
        uri: process.env.MONGODB_URI,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    ai: {
        serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    }
};

const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
];

const validateConfig = () => {
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
    console.log('✅ Configuration validated');
};

module.exports = { config, validateConfig };
