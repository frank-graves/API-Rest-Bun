// app.js - Vanilla JS, Cero dependencias, XSS-Safe

const API_BASE = '/vehiculos';
let currentApiKey = '';

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const apiKeyInput = document.getElementById('api-key-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const syncBtn = document.getElementById('sync-btn');
const statusBadge = document.getElementById('connection-status');
const vehicleForm = document.getElementById('vehicle-form');
const tableBody = document.getElementById('table-body');
const cancelBtn = document.getElementById('cancel-btn');

// --- AUTENTICACIÓN ---
loginBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) return;
    
    // Validar credenciales haciendo un GET de prueba
    try {
        const res = await fetch(API_BASE, { headers: { 'x-api-key': key } });
        if (res.ok) {
            currentApiKey = key;
            loginScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            loginError.classList.add('hidden');
            loadVehiculos();
        } else {
            loginError.classList.remove('hidden');
        }
    } catch {
        loginError.textContent = 'Error de red al conectar.';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    currentApiKey = '';
    apiKeyInput.value = '';
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

// --- RENDERIZADO DE TABLA (XSS-Safe) ---
function renderTable(vehiculos, isOffline) {
    tableBody.replaceChildren(); // Limpia la tabla de forma segura
    
    if (vehiculos.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = 'No hay vehículos registrados.';
        td.style.textAlign = 'center';
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
    }

    vehiculos.forEach(v => {
        const tr = document.createElement('tr');
        
        // Usamos textContent para evitar XSS
        const idText = v.remote_id ? v.remote_id : `${v.id} (Local)`;
        const cells = [idText, v.placaVeh, v.marcaVeh, v.anioFabVeh, v.color, v.propietario];
        
        cells.forEach(val => {
            const td = document.createElement('td');
            td.textContent = val || '-';
            tr.appendChild(td);
        });

        // Botones de acción
        const tdActions = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Editar';
        editBtn.className = 'action-btn edit-btn';
        editBtn.onclick = () => editVehiculo(v);

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Eliminar';
        delBtn.className = 'action-btn delete-btn';
        delBtn.onclick = () => deleteVehiculo(v.id);

        tdActions.appendChild(editBtn);
        tdActions.appendChild(delBtn);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
    });
}

// --- CARGAR DATOS ---
async function loadVehiculos() {
    try {
        statusBadge.textContent = 'Conectando...';
        statusBadge.className = 'status-badge';
        
        const res = await fetch(API_BASE, { headers: { 'x-api-key': currentApiKey } });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.mensaje);

        // Actualizar estado de conexión basado en el origen de los datos
        if (json.source === 'remote') {
            statusBadge.textContent = 'Online (SQL Server)';
            statusBadge.className = 'status-badge online';
        } else {
            statusBadge.textContent = 'Offline (SQLite Cache)';
            statusBadge.className = 'status-badge offline';
        }

        renderTable(json.data, json.source === 'local');
    } catch (err) {
        statusBadge.textContent = 'Error de conexión';
        statusBadge.className = 'status-badge offline';
        console.error(err);
    }
}

// --- CREAR / ACTUALIZAR ---
vehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vehicle-id').value;
    const payload = {
        placaVeh: document.getElementById('placaVeh').value,
        marcaVeh: document.getElementById('marcaVeh').value,
        anioFabVeh: document.getElementById('anioFabVeh').value ? parseInt(document.getElementById('anioFabVeh').value) : null,
        color: document.getElementById('color').value,
        propietario: document.getElementById('propietario').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'x-api-key': currentApiKey },
            body: JSON.stringify(payload)
        });

        if (res.status === 201 || res.status === 202 || res.ok) {
            resetForm();
            loadVehiculos();
        } else {
            const err = await res.json();
            alert(`Error: ${err.mensaje}`);
        }
    } catch (err) {
        alert('Error de red.');
    }
});

function editVehiculo(v) {
    document.getElementById('vehicle-id').value = v.id;
    document.getElementById('placaVeh').value = v.placaVeh ? v.placaVeh.trim() : '';
    document.getElementById('marcaVeh').value = v.marcaVeh || '';
    document.getElementById('anioFabVeh').value = v.anioFabVeh || '';
    document.getElementById('color').value = v.color ? v.color.trim() : '';
    document.getElementById('propietario').value = v.propietario || '';
    
    document.getElementById('submit-btn').textContent = 'Actualizar Vehículo';
    cancelBtn.classList.remove('hidden');
}

cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    vehicleForm.reset();
    document.getElementById('vehicle-id').value = '';
    document.getElementById('submit-btn').textContent = 'Guardar Vehículo';
    cancelBtn.classList.add('hidden');
}

// --- ELIMINAR ---
async function deleteVehiculo(id) {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
        const res = await fetch(`${API_BASE}/${id}`, { 
            method: 'DELETE', 
            headers: { 'x-api-key': currentApiKey } 
        });
        if (res.ok || res.status === 202) loadVehiculos();
    } catch (err) {
        alert('Error al eliminar.');
    }
}

// --- SYNC MANUAL (Corregido) ---
syncBtn.addEventListener('click', async () => {
    try {
        statusBadge.textContent = 'Sincronizando...';
        statusBadge.className = 'status-badge syncing';
        
        const res = await fetch('/sync', { method: 'POST', headers: { 'x-api-key': currentApiKey } });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.mensaje || 'Error del servidor');
        
        // Usamos fallback por si el servidor devuelve algo distinto
        const exitosas = json.exitosas ?? 0;
        const procesadas = json.procesadas ?? 0;
        const msg = json.mensaje ? `\n${json.mensaje}` : '';

        alert(`Sync: ${exitosas} de ${procesadas} operaciones sincronizadas.${msg}`);
        loadVehiculos();
    } catch (err) {
        alert(`Error al sincronizar: ${err.message}`);
    } finally {
        // Esto asegura que el botón se resetee incluso si hay un error
        statusBadge.textContent = 'Online (SQL Server)';
        statusBadge.className = 'status-badge online';
        updateHealth(); // Forzar actualización del monitor
    }
});

// --- MINI MONITOR (Corregido) ---
async function updateHealth() {
    const apiEl = document.getElementById('mon-api');
    const dbEl = document.getElementById('mon-db');
    const latEl = document.getElementById('mon-latency');
    const syncEl = document.getElementById('mon-sync');

    if (!apiEl) return;

    try {
        const start = performance.now();
        const res = await fetch('/health');
        if (!res.ok) throw new Error('HTTP Error'); // Si el rate limiter tira 429, cae aquí
        
        const end = performance.now();
        const data = await res.json();

        apiEl.textContent = 'Online';
        apiEl.className = 'value status-green';

        if (data.database.includes('online')) {
            dbEl.textContent = 'Remote (SQL Server)';
            dbEl.className = 'value status-green';
        } else {
            dbEl.textContent = 'Local (SQLite)';
            dbEl.className = 'value status-yellow';
        }

        const ping = Math.round(end - start);
        latEl.textContent = `${ping} ms`;
        latEl.className = ping < 200 ? 'value status-green' : 'value status-yellow';

        syncEl.textContent = data.pendingSync;
        syncEl.className = data.pendingSync > 0 ? 'value status-yellow' : 'value status-green';

    } catch (err) {
        apiEl.textContent = 'Offline';
        apiEl.className = 'value status-red';
        dbEl.textContent = 'Desconocido';
        dbEl.className = 'value status-red';
        latEl.textContent = '--ms';
        syncEl.textContent = '--';
    }
}

setInterval(updateHealth, 5000);
loginBtn.addEventListener('click', () => setTimeout(updateHealth, 500));