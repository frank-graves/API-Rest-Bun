import sql from 'mssql';

const configuracion = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    options: { encrypt: true }
};

async function actualizarTabla() {
    let pool;
    try {
        pool = await sql.connect(configuracion);
        console.log('✅ Conexión establecida. Aplicando cambios...');

        // 1. Cambiar CHAR a VARCHAR (quita el padding de espacios) y NCHAR a NVARCHAR
        await pool.request().query(`
            ALTER TABLE vehiculo_api ALTER COLUMN placaVeh VARCHAR(12) NULL;
        `);
        await pool.request().query(`
            ALTER TABLE vehiculo_api ALTER COLUMN color NVARCHAR(10) NULL;
        `);
        console.log('✅ Tipos de datos actualizados (CHAR -> VARCHAR).');

        // 2. Intentar agregar la restricción UNIQUE a placaVeh (si no existe ya)
        const checkConstraint = await pool.request().query(`
            SELECT * FROM sys.objects 
            WHERE object_id = OBJECT_ID(N'[dbo].[UQ_vehiculo_placa]') AND type in (N'UQ')
        `);

        if (checkConstraint.recordset.length > 0) {
            console.log('ℹ️  La restricción UNIQUE ya existe en placaVeh. Omitiendo...');
        } else {
            // Revisar si hay duplicados antes de agregar el UNIQUE
            const dupCheck = await pool.request().query(`
                SELECT placaVeh, COUNT(*) as count
                FROM vehiculo_api
                WHERE placaVeh IS NOT NULL
                GROUP BY placaVeh
                HAVING COUNT(*) > 1
            `);

            if (dupCheck.recordset.length > 0) {
                console.warn('⚠️  No se puede agregar UNIQUE: tienes placas duplicadas en la tabla.');
                console.warn('Borra los duplicados primero o cambia las placas conflictivas:', dupCheck.recordset);
            } else {
                await pool.request().query(`
                    ALTER TABLE vehiculo_api ADD CONSTRAINT UQ_vehiculo_placa UNIQUE (placaVeh);
                `);
                console.log('✅ Restricción UNIQUE agregada a placaVeh.');
            }
        }

        console.log('🎉 Base de datos actualizada correctamente.');
    } catch (error) {
        console.error('❌ Error al actualizar la tabla:', error.message);
        process.exitCode = 1;
    } finally {
        if (pool) await pool.close();
    }
}

actualizarTabla();