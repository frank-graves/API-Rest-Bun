import { sincronizar } from '../services/sync.service.js';

let intervalId = null;

export function iniciarSyncJob() {
    const intervalo = Number(process.env.SYNC_INTERVAL_MS) || 120000;
    intervalId = setInterval(async () => {
        try {
            const r = await sincronizar();
            if (r.procesadas > 0) {
                console.log(`🔄 Sync: ${r.exitosas}/${r.procesadas} ok`);
            }
        } catch {
            // silencioso: no romper el server
        }
    }, intervalo);
    console.log(`⏱️  Sync automático cada ${intervalo / 1000}s`);
}

export function detenerSyncJob() {
    if (intervalId) clearInterval(intervalId);
}