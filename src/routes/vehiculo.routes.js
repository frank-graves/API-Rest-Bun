import { Router } from 'express';
import {
    listadoVehicular, obtenerVehiculo, insertarVehiculo,
    actualizarVehiculo, eliminarVehiculo
} from '../controllers/vehiculo.controller.js';
import { sincronizar } from '../services/sync.service.js';
import db from '../database/sqlite.js';

const rutas = Router();

// CRUD
rutas.get('/vehiculos',         listadoVehicular);
rutas.get('/vehiculos/:id',     obtenerVehiculo);
rutas.post('/vehiculos',        insertarVehiculo);
rutas.put('/vehiculos/:id',     actualizarVehiculo);
rutas.delete('/vehiculos/:id',  eliminarVehiculo);

// Sync manual
rutas.post('/sync', async (req, res) => {
    try {
        res.json(await sincronizar());
    } catch (error) {
        console.error('❌ Sync manual falló:', error);
        res.status(500).json({ mensaje: 'Error al sincronizar' });
    }
});

// Inspeccionar cola de pendientes
rutas.get('/sync/pendientes', (req, res) => {
    const pendientes = db.query('SELECT * FROM operaciones_pendientes ORDER BY id').all();
    res.json({ total: pendientes.length, pendientes });
});

export default rutas;