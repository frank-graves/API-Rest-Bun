import express from 'express';
import vehiculoRuta from './routes/vehiculo.routes.js';
import { securityHeaders, apiKeyAuth, rateLimiter } from './middlewares/security.js';
import { obtenerConexion } from './database/conexion.js';
import db from './database/sqlite.js';

const app = express();

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(express.json());
app.use(express.static('public'));

app.get('/health', async (req, res) => {
    const start = Date.now();
    let dbStatus = 'offline (sqlite)';
    
    try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
        const dbPromise = (async () => {
            const pool = await obtenerConexion();
            await pool.request().query('SELECT 1');
        })();
        
        await Promise.race([dbPromise, timeoutPromise]);
        dbStatus = 'online (sqlserver)';
    } catch (e) {}

    let pendingSync = 0;
    try {
        pendingSync = db.query('SELECT COUNT(*) as count FROM operaciones_pendientes').get().count;
    } catch (e) {}

    res.json({
        status: 'ok',
        latency: `${Date.now() - start}ms`,
        database: dbStatus,
        pendingSync
    });
});

app.use(rateLimiter);
app.use(apiKeyAuth);
app.use(vehiculoRuta);

app.use((req, res) => res.status(404).json({ mensaje: 'Recurso no encontrado' }));
app.use((err, req, res, _next) => {
    const status = err.statusCode || err.status || 500;
    if (status >= 500) console.error('❌ Error:', err);
    res.status(status).json({ mensaje: status === 400 ? 'JSON inválido' : 'Error interno' });
});

export default app;