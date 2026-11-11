import sql from 'mssql';
import db from '../database/sqlite.js';
import { obtenerConexion } from '../database/conexion.js';

const esErrorDeConexion = (error) => {
    const code = error.code || '';
    const msg = (error.message || '').toLowerCase();
    return (
        ['ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNRESET'].includes(code) ||
        msg.includes('timeout') || msg.includes('failed to connect') || msg.includes('connection')
    );
};

const sanitizarVehiculo = (body) => {
    if (!body.placaVeh) return { error: 'placaVeh es obligatorio' };
    const data = {
        placaVeh:    String(body.placaVeh).trim(),
        marcaVeh:    body.marcaVeh ? String(body.marcaVeh).trim() : null,
        anioFabVeh:  body.anioFabVeh ? Number(body.anioFabVeh) : null, // Auditoría: Number() en vez de parseInt
        color:       body.color ? String(body.color).trim() : null,
        propietario: body.propietario ? String(body.propietario).trim() : null
    };
    if (!data.placaVeh) return { error: 'placaVeh no puede estar vacía' }; // Auditoría: validar trim
    if (data.placaVeh.length > 12) return { error: 'placaVeh excede los 12 caracteres' };
    if (data.anioFabVeh !== null && (!Number.isInteger(data.anioFabVeh) || data.anioFabVeh < 1900 || data.anioFabVeh > 2100)) {
        return { error: 'anioFabVeh debe ser un año válido (1900-2100)' };
    }
    return { data };
};

const manejarErrorSQL = (error, res) => {
    if (error.number === 2627) return res.status(409).json({ mensaje: 'La placa ya existe' });
    if (error.number === 2628) return res.status(400).json({ mensaje: 'Un campo excede la longitud permitida' });
    if (error.number === 8114) return res.status(400).json({ mensaje: 'Formato de dato inválido' });
    console.error('❌ Error SQL:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
};

const validarId = (idStr) => {
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) return null; // Auditoría: Rechaza decimales
    return id;
};

// Función auxiliar para refrescar la caché local desde el servidor remoto
const actualizarCacheLocal = (vehiculo) => {
    db.run(
        `INSERT INTO vehiculo_local (remote_id, placaVeh, marcaVeh, anioFabVeh, color, propietario, synced)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(remote_id) DO UPDATE SET
         placaVeh=excluded.placaVeh, marcaVeh=excluded.marcaVeh, anioFabVeh=excluded.anioFabVeh,
         color=excluded.color, propietario=excluded.propietario`,
        [vehiculo.id, vehiculo.placaVeh.trim(), vehiculo.marcaVeh, vehiculo.anioFabVeh, vehiculo.color, vehiculo.propietario]
    );
};

export const listadoVehicular = async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const r = await pool.request().query('SELECT * FROM vehiculo_api ORDER BY id DESC');
        
        // Refrescamos toda la caché local
        db.run('DELETE FROM vehiculo_local WHERE remote_id IS NOT NULL');
        for (const v of r.recordset) actualizarCacheLocal(v);

        res.json({ source: 'remote', data: r.recordset });
    } catch (error) {
        if (!esErrorDeConexion(error)) return manejarErrorSQL(error, res);
        console.warn('⚠️  SQL Server offline — sirviendo caché');
        const data = db.query('SELECT * FROM vehiculo_local ORDER BY id DESC').all();
        res.json({ source: 'local', stale: true, data });
    }
};

export const obtenerVehiculo = async (req, res) => {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ mensaje: 'ID inválido' });

    try {
        const pool = await obtenerConexion();
        const r = await pool.request().input('id', sql.Int, id).query('SELECT * FROM vehiculo_api WHERE id = @id');
        if (r.recordset.length === 0) return res.status(404).json({ mensaje: 'No encontrado' });
        
        actualizarCacheLocal(r.recordset[0]); // Refrescar caché
        res.json({ source: 'remote', data: r.recordset[0] });
    } catch (error) {
        if (!esErrorDeConexion(error)) return manejarErrorSQL(error, res);
        const row = db.query('SELECT * FROM vehiculo_local WHERE remote_id = ? OR id = ?').get(id, id);
        if (!row) return res.status(404).json({ mensaje: 'No encontrado (local)' });
        res.json({ source: 'local', stale: true, data: row });
    }
};

export const insertarVehiculo = async (req, res) => {
    const { error, data } = sanitizarVehiculo(req.body ?? {});
    if (error) return res.status(400).json({ mensaje: error });

    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('placaVeh', sql.VarChar(12), data.placaVeh) // Cambiado a VARCHAR
            .input('marcaVeh', sql.VarChar(25), data.marcaVeh)
            .input('anioFabVeh', sql.Int, data.anioFabVeh)
            .input('color', sql.NVarChar(10), data.color)     // Cambiado a NVARCHAR
            .input('propietario', sql.VarChar(50), data.propietario)
            .query(`INSERT INTO vehiculo_api (placaVeh, marcaVeh, anioFabVeh, color, propietario) OUTPUT INSERTED.* VALUES (@placaVeh, @marcaVeh, @anioFabVeh, @color, @propietario)`);
        
        actualizarCacheLocal(r.recordset[0]); // Refrescar caché
        res.status(201).json({ source: 'remote', data: r.recordset[0] });
    } catch (error) {
        if (!esErrorDeConexion(error)) return manejarErrorSQL(error, res);
        
        // OFFLINE: Generamos un ID negativo para evitar colisiones
        const minId = db.query('SELECT MIN(id) as m FROM vehiculo_local').get().m || 0;
        const localId = minId > 0 ? -1 : minId - 1;

        db.run(
            `INSERT INTO vehiculo_local (id, remote_id, placaVeh, marcaVeh, anioFabVeh, color, propietario, synced)
             VALUES (?, NULL, ?, ?, ?, ?, ?, 0)`,
            [localId, data.placaVeh, data.marcaVeh, data.anioFabVeh, data.color, data.propietario]
        );
        db.run(
            `INSERT INTO operaciones_pendientes (tipo, vehiculo_local_id, payload) VALUES ('INSERT', ?, ?)`,
            [localId, JSON.stringify(data)]
        );

        res.status(202).json({ source: 'local', synced: false, data: { id: localId, ...data } });
    }
};

// El resto de controladores (actualizarVehiculo, eliminarVehiculo) 
// usarían la misma lógica: actualizarCacheLocal() en éxito, y remote_id para buscar.

export const actualizarVehiculo = async (req, res) => {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ mensaje: 'ID inválido' });

    const { error, data } = sanitizarVehiculo(req.body ?? {});
    if (error) return res.status(400).json({ mensaje: error });

    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('id',          sql.Int,        id)
            .input('placaVeh',    sql.Char(12),   data.placaVeh)
            .input('marcaVeh',    sql.VarChar(25), data.marcaVeh)
            .input('anioFabVeh',  sql.Int,        data.anioFabVeh)
            .input('color',       sql.NChar(10),  data.color)
            .input('propietario', sql.VarChar(50), data.propietario)
            .query(`
                UPDATE vehiculo_api
                SET placaVeh=@placaVeh, marcaVeh=@marcaVeh, anioFabVeh=@anioFabVeh,
                    color=@color, propietario=@propietario
                OUTPUT INSERTED.*
                WHERE id=@id
            `);
        if (r.recordset.length === 0) return res.status(404).json({ mensaje: 'No encontrado' });
        res.json({ source: 'remote', data: r.recordset[0] });
    } catch (error) {
        if (!esErrorDeConexion(error)) return manejarErrorSQL(error, res);
        console.warn('⚠️  Offline — actualizando SQLite');

        if (tieneInsertPendiente(id)) {
            db.run(
                `UPDATE vehiculo_local SET placaVeh=?, marcaVeh=?, anioFabVeh=?, color=?, propietario=? WHERE id=?`,
                [data.placaVeh, data.marcaVeh, data.anioFabVeh, data.color, data.propietario, id]
            );
            db.run(
                `UPDATE operaciones_pendientes SET payload = ? WHERE tipo = 'INSERT' AND vehiculo_id = ?`,
                [JSON.stringify(data), id]
            );
            const row = db.query('SELECT * FROM vehiculo_local WHERE id = ?').get(id);
            return res.json({ source: 'local', synced: false, mensaje: 'Actualizado localmente (pendiente)', data: row });
        }

        const info = db.run(
            `UPDATE vehiculo_local SET placaVeh=?, marcaVeh=?, anioFabVeh=?, color=?, propietario=?, synced=0 WHERE id=?`,
            [data.placaVeh, data.marcaVeh, data.anioFabVeh, data.color, data.propietario, id]
        );
        if (info.changes === 0) return res.status(404).json({ mensaje: 'No encontrado (local)' });

        db.run(
            `INSERT INTO operaciones_pendientes (tipo, vehiculo_id, payload) VALUES ('UPDATE', ?, ?)`,
            [id, JSON.stringify(data)]
        );

        const row = db.query('SELECT * FROM vehiculo_local WHERE id = ?').get(id);
        res.json({ source: 'local', synced: false, mensaje: 'Actualizado localmente', data: row });
    }
};

export const eliminarVehiculo = async (req, res) => {
    const id = validarId(req.params.id);
    if (!id) return res.status(400).json({ mensaje: 'ID inválido' });

    try {
        const pool = await obtenerConexion();
        const r = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM vehiculo_api OUTPUT DELETED.* WHERE id = @id');
        if (r.recordset.length === 0) return res.status(404).json({ mensaje: 'No encontrado' });
        res.json({ source: 'remote', mensaje: 'Eliminado' });
    } catch (error) {
        if (!esErrorDeConexion(error)) return manejarErrorSQL(error, res);
        console.warn('⚠️  Offline — eliminando SQLite');

        if (tieneInsertPendiente(id)) {
            db.run("DELETE FROM operaciones_pendientes WHERE tipo='INSERT' AND vehiculo_id=?", [id]);
            db.run('DELETE FROM vehiculo_local WHERE id = ?', [id]);
            return res.json({ source: 'local', synced: true, mensaje: 'Eliminado (nunca se envió)' });
        }

        const info = db.run('DELETE FROM vehiculo_local WHERE id = ?', [id]);
        if (info.changes === 0) return res.status(404).json({ mensaje: 'No encontrado (local)' });

        db.run(`INSERT INTO operaciones_pendientes (tipo, vehiculo_id, payload) VALUES ('DELETE', ?, '{}')`, [id]);
        res.json({ source: 'local', synced: false, mensaje: 'Eliminado localmente, pendiente de sync' });
    }
};