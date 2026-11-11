import sql from 'mssql';

const configuracion = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    options: { encrypt: true }
};

async function crearTabla() {
    let pool;
    try {
        if (!configuracion.server) {
            console.error('❌ DB_SERVER no está definido en .env');
            process.exit(1);
        }
        pool = await sql.connect(configuracion);
        console.log('✅ Conexión establecida.');
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='vehiculo_api' AND xtype='U')
            BEGIN
                CREATE TABLE vehiculo_api (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    placaVeh CHAR(12) NULL,
                    marcaVeh VARCHAR(25) NULL,
                    anioFabVeh INT NULL,
                    color NCHAR(10) NULL,
                    propietario VARCHAR(50) NULL
                );
            END
        `);
        const check = await pool.request().query(`
            SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'vehiculo_api'
            ORDER BY ORDINAL_POSITION;
        `);
        console.table(check.recordset);
        console.log('🎉 Tabla lista.');
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exitCode = 1;
    } finally {
        if (pool) await pool.close();
    }
}

crearTabla();