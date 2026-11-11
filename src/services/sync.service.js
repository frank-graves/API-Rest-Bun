import sql from 'mssql';
import db from '../database/sqlite.js';
import { obtenerConexion } from '../database/conexion.js';

let syncEnProgreso = false;

export async function sincronizar() {
    if (syncEnProgreso) return { procesadas: 0, exitosas: 0, fallidas: 0, mensaje: 'Sync ya en progreso' };
    syncEnProgreso = true;
    
    const resultado = { procesadas: 0, exitosas: 0, fallidas: 0, errores: [] };

    try {
        const pendientes = db.query('SELECT * FROM operaciones_pendientes ORDER BY id ASC LIMIT 100').all();
        if (pendientes.length === 0) {
            return { ...resultado, mensaje: 'Nada pendiente por sincronizar' };
        }

        let pool;
        try {
            pool = await obtenerConexion();
        } catch (err) {
            return { ...resultado, mensaje: 'Servidor SQL Server inalcanzable. Se reintentará luego.', errores: [err.message] };
        }

        for (const op of pendientes) {
            resultado.procesadas++;
            const payload = JSON.parse(op.payload || '{}');
            try {
                let r;
                if (op.tipo === 'INSERT') {
                    r = await pool.request()
                        .input('placaVeh', sql.VarChar(12), payload.placaVeh)
                        .input('marcaVeh', sql.VarChar(25), payload.marcaVeh)
                        .input('anioFabVeh', sql.Int, payload.anioFabVeh)
                        .input('color', sql.NVarChar(10), payload.color)
                        .input('propietario', sql.VarChar(50), payload.propietario)
                        .query(`INSERT INTO vehiculo_api (placaVeh, marcaVeh, anioFabVeh, color, propietario) OUTPUT INSERTED.id VALUES (@placaVeh, @marcaVeh, @anioFabVeh, @color, @propietario)`);
                    
                    const remoteId = r.recordset[0].id;
                    db.run('UPDATE vehiculo_local SET remote_id = ?, synced = 1 WHERE id = ?', [remoteId, op.vehiculo_local_id]);
                } 
                else if (op.tipo === 'UPDATE') {
                    const local = db.query('SELECT remote_id FROM vehiculo_local WHERE id = ?').get(op.vehiculo_local_id);
                    r = await pool.request()
                        .input('id', sql.Int, local.remote_id)
                        .input('placaVeh', sql.VarChar(12), payload.placaVeh)
                        .input('marcaVeh', sql.VarChar(25), payload.marcaVeh)
                        .input('anioFabVeh', sql.Int, payload.anioFabVeh)
                        .input('color', sql.NVarChar(10), payload.color)
                        .input('propietario', sql.VarChar(50), payload.propietario)
                        .query(`UPDATE vehiculo_api SET placaVeh=@placaVeh, marcaVeh=@marcaVeh, anioFabVeh=@anioFabVeh, color=@color, propietario=@propietario WHERE id=@id`);
                    
                    if (r.rowsAffected[0] === 0) throw new Error('Vehículo no existe en servidor remoto');
                    db.run('UPDATE vehiculo_local SET synced = 1 WHERE id = ?', [op.vehiculo_local_id]);
                } 
                else if (op.tipo === 'DELETE') {
                    const local = db.query('SELECT remote_id FROM vehiculo_local WHERE id = ?').get(op.vehiculo_local_id);
                    r = await pool.request().input('id', sql.Int, local.remote_id).query('DELETE FROM vehiculo_api WHERE id = @id');
                    if (r.rowsAffected[0] === 0) throw new Error('Vehículo no existe en servidor remoto');
                }

                db.run('DELETE FROM operaciones_pendientes WHERE id = ?', [op.id]);
                resultado.exitosas++;
            } catch (error) {
                db.run('UPDATE operaciones_pendientes SET intentos = intentos + 1 WHERE id = ?', [op.id]);
                resultado.fallidas++;
                resultado.errores.push({ op_id: op.id, tipo: op.tipo, error: error.message });
            }
        }

        return resultado;
    } finally {
        syncEnProgreso = false;
    }
}