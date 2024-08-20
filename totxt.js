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

// Función para respaldar los datos
const backupData = () => {
    const query = 'SELECT * FROM validos';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            connection.end();
            return;
        }

        const backupFile = 'backup.txt';
        fs.writeFile(backupFile, JSON.stringify(results, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log(`Data successfully backed up to ${backupFile}`);
            }
            connection.end();
        });
    });
};

// Función para restaurar los datos
const restoreData = () => {
    const backupFile = 'backup.txt';

    // Verificar si el archivo de respaldo existe
    if (!fs.existsSync(backupFile)) {
        console.error(`Backup file ${backupFile} does not exist.`);
        connection.end();
        return;
    }

    // Leer el archivo de respaldo
    fs.readFile(backupFile, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading backup file:', err);
            connection.end();
            return;
        }

        // Convertir el contenido a un objeto JSON
        const profiles = JSON.parse(data);

        // Verificar y restaurar cada perfil
        profiles.forEach((profile) => {
            const query = 'SELECT COUNT(*) AS count FROM validos WHERE url = ?';
            connection.query(query, [profile.url], (err, results) => {
                if (err) {
                    console.error('Error checking profile in database:', err);
                } else {
                    if (results[0].count === 0) {
                        // Si no existe, insertarlo
                        const insertQuery = 'INSERT INTO validos (url) VALUES (?)';
                        connection.query(insertQuery, [profile.url], (err) => {
                            if (err) {
                                console.error('Error inserting profile into database:', err);
                            } else {
                                console.log(`Profile ${profile.url} restored to database.`);
                            }
                        });
                    } else {
                        console.log(`Profile ${profile.url} already exists in database.`);
                    }
                }
            });
        });

        connection.end();
    });
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
