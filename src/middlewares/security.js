import { timingSafeEqual } from 'node:crypto';

export const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // 👇 EL FIX ESTÁ AQUÍ: 'self' permite cargar CSS y JS del mismo servidor
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
    next();
};

export const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const serverKey = process.env.API_KEY;

    if (!serverKey) {
        console.error('❌ FATAL: API_KEY no definida en .env');
        return res.status(500).json({ mensaje: 'Error de configuración del servidor' });
    }
    if (!apiKey) {
        return res.status(401).json({ mensaje: 'No autorizado: API Key ausente' });
    }

    try {
        const keyBuffer = Buffer.from(apiKey);
        const serverBuffer = Buffer.from(serverKey);
        
        if (keyBuffer.length !== serverBuffer.length || !timingSafeEqual(keyBuffer, serverBuffer)) {
            return res.status(401).json({ mensaje: 'No autorizado: API Key inválida' });
        }
        next();
    } catch {
        return res.status(401).json({ mensaje: 'No autorizado' });
    }
};

const requestCounts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;

setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestCounts.entries()) {
        if (now > data.resetTime) requestCounts.delete(ip);
    }
}, 5 * 60 * 1000).unref();

export const rateLimiter = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();

    if (!requestCounts.has(ip)) {
        requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return next();
    }

    const data = requestCounts.get(ip);

    if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + WINDOW_MS;
        return next();
    }

    if (data.count >= MAX_REQUESTS) {
        return res.status(429).json({ mensaje: 'Too Many Requests' });
    }

    data.count++;
    next();
};