const puppeteer = require('puppeteer');
const mysql = require('mysql2');
const axios = require('axios');

// Configuración de la base de datos
const dbConfig = require('./config.json');

// Crear una conexión a MySQL
const connection = mysql.createConnection({
    ...dbConfig,
    database: 'profiles_db'
});

// Conectar a la base de datos
connection.connect((err) => {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        return;
    }
    console.log('Connected to database');
});

let validCount = 0;
let invalidCount = 0;
let totalProfiles = 0;
let invalidProfilesCount = 0;

// Obtener nombres de usuario desde la API
const fetchUsernamesFromApi = async () => {
    try {
        const response = await axios.get('https://random-word-api.herokuapp.com/all');
        return response.data; // La respuesta es un array de palabras
    } catch (error) {
        console.error('Error fetching usernames from API: ' + error.message);
        return [];
    }
};

// Verificar si el perfil ya existe en la base de datos
const profileExistsInDatabase = async (username) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 'validos' AS table_name, is_verified FROM validos WHERE url = ?
            UNION ALL
            SELECT 'invalidos' AS table_name, NULL AS is_verified FROM invalidos WHERE url = ?
        `;
        connection.query(query, [username, username], (err, results) => {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    resolve(results[0]);
                } else {
                    resolve(null);
                }
            }
        });
    });
};

// Insertar perfil en la base de datos
const insertProfile = (username, isValid) => {
    return new Promise((resolve, reject) => {
        const table = isValid ? 'validos' : 'invalidos';
        const query = `INSERT IGNORE INTO ${table} (url) VALUES (?)`;

        connection.query(query, [username], (err, results) => {
            if (err) {
                console.error(`Error inserting ${username} into ${table}: ${err.message}`);
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// Actualizar el estado de verificación del perfil
const updateVerificationStatus = (username, isVerified) => {
    return new Promise((resolve, reject) => {
        const query = `UPDATE validos SET is_verified = ? WHERE url = ?`;

        connection.query(query, [isVerified, username], (err, results) => {
            if (err) {
                console.error(`Error updating verification status for ${username}: ${err.message}`);
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

// Esperar un tiempo específico
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Verificar el perfil en la web
const checkProfile = async (page, username) => {
    const url = `https://onlyfans.com/${username}`;
    console.log(`Verifying URL: ${url}`);

    const profileData = await profileExistsInDatabase(username);

    if (profileData) {
        if (profileData.table_name === 'validos') {
            console.log(`The profile ${username} is already verified.`);
            return;
        } else if (profileData.table_name === 'invalidos') {
            console.log(`The profile ${username} is already marked as invalid.`);
            return;
        }
    }

    try {
        // Navegar a la URL y esperar a que la red esté inactiva
        const navigationPromise = page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await Promise.race([
            navigationPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 10000))
        ]);

        let html = '';
        try {
            await page.waitForSelector('body', { timeout: 10000 });
            html = await page.evaluate(() => document.body.innerHTML);

            // Verificar si el perfil no existe
            if (html.includes('Sorry') && html.includes('this page is not available')) {
                console.log(`The profile ${username} does not exist.`);
                await insertProfile(username, false);
                invalidCount++;
                invalidProfilesCount++;
            } else {
                // Verificar si el perfil está verificado usando el selector
                const isVerified = await page.evaluate(() => {
                    // Ejemplo de selector: Actualiza con el selector real de la verificación
                    const badge = document.querySelector('.verified-badge-selector'); // Reemplaza con el selector correcto
                    return badge !== null;
                });

                if (isVerified) {
                    console.log(`The profile ${username} is verified and exists.`);
                    await insertProfile(username, true);
                    validCount++;
                    await updateVerificationStatus(username, true); // Actualizar el estado a verificado
                } else {
                    console.log(`The profile ${username} exists but is not verified.`);
                    await insertProfile(username, false);
                    invalidCount++;
                }
            }
        } catch (error) {
            console.error(`Error waiting for selector: ${error.message}`);
            await insertProfile(username, false);
            invalidCount++;
            invalidProfilesCount++;
        }
    } catch (error) {
        if (error.message === 'Navigation timeout') {
            console.log(`Navigation timeout for ${username}. Continuing to the next profile.`);
        } else {
            console.error(`Error navigating to the URL: ${error.message}`);
        }
        await insertProfile(username, false);
        invalidCount++;
        invalidProfilesCount++;
    }
};

// Mostrar el progreso
const printProgress = (current, total) => {
    const percentage = ((current / total) * 100).toFixed(2);
    console.log(`Processing profile ${current} / ${total} (${percentage}%)`);
    console.log(`Valid profiles: ${validCount}, Invalid profiles: ${invalidCount}`);
    console.log(`Total invalid profiles found from API: ${invalidProfilesCount}`);
};

const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const usernames = await fetchUsernamesFromApi();

    if (usernames.length === 0) {
        console.log('No usernames fetched from the API.');
        return;
    }

    totalProfiles = usernames.length; // Asignar el total de perfiles

    console.log(`Total usernames fetched: ${totalProfiles}`);

    console.log('Starting profile verification...');
    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        await checkProfile(page, username);
        printProgress(i + 1, totalProfiles);
        if (i < usernames.length - 1) {
            await delay(100); // Esperar 100 ms entre peticiones a la página
        }
    }

    console.log(`Verification complete. Valid profiles: ${validCount}, Invalid profiles: ${invalidCount}`);
    await browser.close();
    connection.end(); // Cerrar la conexión a MySQL
};

run();
