import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.SQLITE_PATH || './data/cache.sqlite';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
    CREATE TABLE IF NOT EXISTS vehiculo_local (
        id INTEGER PRIMARY KEY,       
        remote_id INTEGER UNIQUE,     -- <--- Agregado UNIQUE aquí
        placaVeh TEXT,
        marcaVeh TEXT,
        anioFabVeh INTEGER,
        color TEXT,
        propietario TEXT,
        synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS operaciones_pendientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        vehiculo_local_id INTEGER,
        payload TEXT,
        intentos INTEGER DEFAULT 0,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

export default db;