import sql from 'mssql';

const paramSqlConex = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    requestTimeout: 15000,
    connectTimeout: 15000,
    options: {
        encrypt: true
    }
};

export async function obtenerConexion() {
    try {
        const pool = await sql.connect(paramSqlConex);
        return pool;
    } catch (error) {
        console.error("❌ Error al conectar a SQL Server:", error.message);
        throw error;
    }
}