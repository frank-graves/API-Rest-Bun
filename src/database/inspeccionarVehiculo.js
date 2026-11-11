import sql from 'mssql';

const configuracion = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    options: { encrypt: true }
};

async function inspeccionar() {
    let pool;
    try {
        pool = await sql.connect(configuracion);
        // CAMBIO: Ahora inspecciona 'vehiculo_api' en lugar de 'vehiculo'
        const resultado = await pool.request().query(`
            SELECT COLUMN_NAME AS columna, DATA_TYPE AS tipo,
                   CHARACTER_MAXIMUM_LENGTH AS longitudMaxima,
                   IS_NULLABLE AS permiteNulos
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'vehiculo_api' 
            ORDER BY ORDINAL_POSITION;
        `);
        if (resultado.recordset.length === 0) {
            console.log("No se encontró la tabla 'vehiculo_api'.");
            return;
        }
        console.table(resultado.recordset);
    } catch (error) {
        console.error('Error:', error.message);
        process.exitCode = 1;
    } finally {
        if (pool) await pool.close();
    }
}

inspeccionar();