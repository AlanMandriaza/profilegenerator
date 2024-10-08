const mysql = require('mysql2');
const fs = require('fs');
const readline = require('readline');
const config = require('./config.json');

// Configuración para leer la entrada del usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Crear una conexión a MySQL
const connection = mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: 'profiles_db'
});

const queryAsync = (query, params) => {
    return new Promise((resolve, reject) => {
        connection.query(query, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
};

// Función para respaldar los datos
const backupData = async () => {
    try {
        const results = await queryAsync('SELECT url, is_verified, subscription_attempted FROM validos');
        const backupFile = 'backup.txt';
        fs.writeFileSync(backupFile, JSON.stringify(results, null, 2));
        console.log(`Data successfully backed up to ${backupFile}`);
    } catch (err) {
        console.error('Error fetching data from database:', err);
    } finally {
        connection.end();
    }
};

// Función para restaurar los datos
const restoreData = async () => {
    const backupFile = 'backup.txt';

    if (!fs.existsSync(backupFile)) {
        console.error(`Backup file ${backupFile} does not exist.`);
        connection.end();
        return;
    }

    try {
        const data = fs.readFileSync(backupFile, 'utf8');
        const profiles = JSON.parse(data);

        for (const profile of profiles) {
            const { url, is_verified, subscription_attempted } = profile; // Extraer solo los campos necesarios

            // Primero, intenta actualizar el registro existente
            const [updateResults] = await queryAsync('UPDATE validos SET is_verified = ?, subscription_attempted = ? WHERE url = ?', [is_verified, subscription_attempted, url]);

            if (updateResults.affectedRows === 0) {
                // Si no se actualizó ningún registro, inserta uno nuevo
                await queryAsync('INSERT INTO validos (url, is_verified, subscription_attempted) VALUES (?, ?, ?)', [url, is_verified, subscription_attempted]);
                console.log(`Profile ${url} restored.`);
            } else {
                console.log(`Profile ${url} was updated.`);
            }
        }
    } catch (err) {
        console.error('Error restoring profiles:', err);
    } finally {
        connection.end();
    }
};

// Función principal para seleccionar entre respaldar o restaurar
const main = () => {
    rl.question('Do you want to (b)ackup or (r)estore the database? ', (answer) => {
        if (answer.toLowerCase() === 'b') {
            backupData();
        } else if (answer.toLowerCase() === 'r') {
            restoreData();
        } else {
            console.log('Invalid option. Please enter "b" for backup or "r" for restore.');
            connection.end();
        }
        rl.close();
    });
};

// Iniciar la función principal
main();
