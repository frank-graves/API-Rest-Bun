import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import sql from 'mssql';
import db from './database/sqlite.js';
import { obtenerConexion } from './database/conexion.js';
import { sincronizar } from './services/sync.service.js';

const rl = readline.createInterface({ input, output });

const mostrarMenu = () => {
    console.log(`
=========================================
   🚗 VEHÍCULOS CLI (Modo Offline-First)
=========================================
  1. Listar vehículos
  2. Insertar vehículo
  3. Eliminar vehículo
  4. Sincronizar pendientes
  5. Salir
=========================================
    `);
};

const listar = async () => {
    try {
        const pool = await obtenerConexion();
        const res = await pool.request().query('SELECT * FROM vehiculo_api ORDER BY id DESC');
        console.log('\n--- REMOTO (SQL Server) ---');
        console.table(res.recordset);
    } catch (e) {
        console.log('\n⚠️  SQL Server offline. Mostrando caché local:');
        const local = db.query('SELECT * FROM vehiculo_local ORDER BY id DESC').all();
        console.table(local);
    }
};

const insertar = async () => {
    const placa = await rl.question('Placa (ej. ABC-123): ');
    const marca = await rl.question('Marca: ');
    const anio = await rl.question('Año: ');
    const color = await rl.question('Color: ');
    const propietario = await rl.question('Propietario: ');

    const data = { 
        placaVeh: placa.trim(), 
        marcaVeh: marca.trim() || null, 
        anioFabVeh: parseInt(anio) || null, 
        color: color.trim() || null, 
        propietario: propietario.trim() || null 
    };

    try {
        const pool = await obtenerConexion();
        await pool.request()
            .input('placaVeh', sql.VarChar(12), data.placaVeh)
            .input('marcaVeh', sql.VarChar(25), data.marcaVeh)
            .input('anioFabVeh', sql.Int, data.anioFabVeh)
            .input('color', sql.NVarChar(10), data.color)
            .input('propietario', sql.VarChar(50), data.propietario)
            .query(`INSERT INTO vehiculo_api (placaVeh, marcaVeh, anioFabVeh, color, propietario) VALUES (@placaVeh, @marcaVeh, @anioFabVeh, @color, @propietario)`);
        console.log('✅ Guardado en SQL Server remoto.');
    } catch (e) {
        console.log('⚠️  Offline. Guardando en SQLite...');
        const minId = db.query('SELECT MIN(id) as m FROM vehiculo_local').get().m || 0;
        const localId = minId > 0 ? -1 : minId - 1;

        db.run(
            `INSERT INTO vehiculo_local (id, remote_id, placaVeh, marcaVeh, anioFabVeh, color, propietario, synced) VALUES (?, NULL, ?, ?, ?, ?, ?, 0)`,
            [localId, data.placaVeh, data.marcaVeh, data.anioFabVeh, data.color, data.propietario]
        );
        db.run(`INSERT INTO operaciones_pendientes (tipo, vehiculo_local_id, payload) VALUES ('INSERT', ?, ?)`, [localId, JSON.stringify(data)]);
        console.log(`✅ Guardado localmente con ID ${localId}. Se sincronizará luego.`);
    }
};

const eliminar = async () => {
    const idStr = await rl.question('ID del vehículo a eliminar (revisa la lista): ');
    const id = Number(idStr);
    
    if (!Number.isInteger(id) || id === 0) {
        console.log('❌ ID inválido.');
        return;
    }

    try {
        if (id > 0) {
            // Es un ID remoto (positivo)
            const pool = await obtenerConexion();
            const r = await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM vehiculo_api WHERE id = @id');
            
            if (r.rowsAffected[0] === 0) {
                console.log('❌ No se encontró el vehículo en SQL Server.');
            } else {
                console.log('✅ Vehículo eliminado de SQL Server.');
                db.run('DELETE FROM vehiculo_local WHERE remote_id = ?', [id]);
            }
        } else {
            // Es un ID local (negativo / pendiente de sincronizar)
            const local = db.query('SELECT * FROM vehiculo_local WHERE id = ?').get(id);
            if (!local) {
                console.log('❌ No se encontró el vehículo en la caché local.');
                return;
            }
            
            // Lo borramos de la caché y eliminamos su operación pendiente de INSERT
            db.run('DELETE FROM vehiculo_local WHERE id = ?', [id]);
            db.run("DELETE FROM operaciones_pendientes WHERE tipo='INSERT' AND vehiculo_local_id=?", [id]);
            console.log('✅ Vehículo local eliminado (nunca llegó al servidor).');
        }
    } catch (error) {
        if (id > 0) {
            console.log('⚠️  SQL Server offline. Preparando eliminación local...');
            // Verificamos si ya está en caché
            let local = db.query('SELECT id FROM vehiculo_local WHERE remote_id = ?').get(id);
            
            if (!local) {
                // Si no está en caché, creamos una entrada fantasma para que el Sync sepa qué borrar
                const minId = db.query('SELECT MIN(id) as m FROM vehiculo_local').get().m || 0;
                const localId = minId > 0 ? -1 : minId - 1;
                db.run('INSERT INTO vehiculo_local (id, remote_id, synced) VALUES (?, ?, 0)', [localId, id]);
                local = { id: localId };
            } else {
                db.run('UPDATE vehiculo_local SET synced = 0 WHERE id = ?', [local.id]);
            }

            db.run(`INSERT INTO operaciones_pendientes (tipo, vehiculo_local_id, payload) VALUES ('DELETE', ?, '{}')`, [local.id]);
            console.log('✅ Eliminación encolada. Se completará cuando vuelva la conexión.');
        } else {
            console.error('❌ Error inesperado:', error.message);
        }
    }
};

const main = async () => {
    let salir = false;
    while (!salir) {
        mostrarMenu();
        const opcion = await rl.question('Selecciona una opción: ');

        switch (opcion.trim()) {
            case '1':
                await listar();
                break;
            case '2':
                await insertar();
                break;
            case '3':
                await eliminar();
                break;
            case '4':
                console.log('\nSincronizando...');
                const res = await sincronizar();
                console.log(`Resultado: ${res.exitosas || 0} exitosas, ${res.fallidas || 0} fallidas.`);
                if (res.mensaje) console.log(res.mensaje);
                break;
            case '5':
                salir = true;
                break;
            default:
                console.log('Opción no válida.');
        }
    }
    rl.close();
    db.close();
    process.exit(0);
};

main();