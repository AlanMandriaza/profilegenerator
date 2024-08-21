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
        const results = await queryAsync('SELECT * FROM validos');
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
            const { url } = profile; // Extraer solo los campos necesarios

            const results = await queryAsync('SELECT is_verified FROM validos WHERE url = ?', [url]);

            if (results.length === 0) {
                await queryAsync('INSERT INTO validos (url, is_verified) VALUES (?, TRUE)', [url]);
                console.log(`Profile ${url} restored and marked as verified.`);
            } else if (!results[0].is_verified) {
                await queryAsync('UPDATE validos SET is_verified = TRUE WHERE url = ?', [url]);
                console.log(`Profile ${url} was updated to verified.`);
            } else {
                console.log(`Profile ${url} is already verified in the database.`);
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
