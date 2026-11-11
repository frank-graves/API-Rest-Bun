import app from './app.js';
import { iniciarSyncJob, detenerSyncJob } from './jobs/sync.job.js';
import db from './database/sqlite.js';
import sql from 'mssql';
import { exec } from 'node:child_process';

const puerto = process.env.puerto || 3000;
const server = app.listen(puerto, () => {
    console.log(`✅ Servidor UI corriendo en http://localhost:${puerto}`);
    console.log(`🔒 API Key requerida en cabecera 'x-api-key'`);
    
    const url = `http://localhost:${puerto}`;
    
    const startCmd = process.platform === 'win32' 
        ? 'start ""' 
        : process.platform === 'darwin' 
            ? 'open' 
            : 'xdg-open';

    exec(`${startCmd} "${url}"`);
    
    iniciarSyncJob();
});

const shutdown = async (signal) => {
    console.log(`\n🛑 Cerrando servidor...`);
    detenerSyncJob();
    server.close(async () => {
        db.close();
        if (sql.globalConnection) await sql.close();
        process.exit(0);
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));