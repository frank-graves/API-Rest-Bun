# API REST — Gestión de Vehículos (Compartida)

API REST en Node.js + Express + SQL Server (mssql) usando una tabla independiente (`vehiculo_api`) para no interferir con otros proyectos en la misma base de datos.

## 🚀 Puesta en marcha

1. **Instalar dependencias**
   ```bash
   npm install
```

2. **Ejecutar el script SQL**
Abre tu gestor de base de datos y ejecuta el script `crear_tabla.sql` para crear la tabla independiente.
3. **Configurar variables de entorno**
Asegúrate de que tu `.env` tenga las credenciales correctas.
4. **Levantar el servidor**

```
npm run dev
```

## 📡 Endpoints (CRUD)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/vehiculos` | Lista todos los vehículos |
| GET | `/vehiculos/:id` | Obtiene un vehículo por su ID |
| POST | `/vehiculos` | Inserta un nuevo vehículo |
| PUT | `/vehiculos/:id` | Actualiza un vehículo existente |
| DELETE | `/vehiculos/:id` | Elimina un vehículo por su ID |

### Ejemplo — Insertar vehículo

```
POST /vehiculos
{
  "placaVeh": "ABC-123",
  "marcaVeh": "Toyota",
  "anioFabVeh": 2020,
  "color": "Rojo",
  "propietario": "Juan Perez"
}
```

```sql
-- Script para crear la tabla independiente para tu API
CREATE TABLE vehiculo_api (
    id INT IDENTITY(1,1) PRIMARY KEY,
    placaVeh CHAR(12) NULL,
    marcaVeh VARCHAR(25) NULL,
    anioFabVeh INT NULL,
    color NCHAR(10) NULL,
    propietario VARCHAR(50) NULL
);

