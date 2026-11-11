import { describe, it, expect } from 'bun:test';

const BASE_URL = 'http://localhost:3000/vehiculos';
const API_KEY = 'super-secret-key-123456789';
const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

describe('API Vehículos CRUD', () => {
    
    it('Debe rechazar peticiones sin API Key (Zero-Trust)', async () => {
        const res = await fetch(BASE_URL);
        expect(res.status).toBe(401);
    });

    it('Debe rechazar datos inválidos (Validación)', async () => {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers, // Con API Key
            body: JSON.stringify({ placaVeh: '   ' })
        });
        expect(res.status).toBe(400);
    });

    it('Debe rechazar año fuera de rango', async () => {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({ placaVeh: 'TEST-001', anioFabVeh: 1800 })
        });
        expect(res.status).toBe(400);
    });

    it('Debe insertar un vehículo correctamente', async () => {
        const nuevoVehiculo = {
            placaVeh: `TEST-${Math.floor(Math.random() * 999)}`,
            marcaVeh: 'TestBrand',
            anioFabVeh: 2024,
            color: 'Verde',
            propietario: 'Test User'
        };

        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(nuevoVehiculo)
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.source).toBe('remote');
        expect(data.data.placaVeh).toBe(nuevoVehiculo.placaVeh);
    });
});