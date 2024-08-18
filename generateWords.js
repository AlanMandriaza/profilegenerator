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
let invalidProfilesCount = 0; // Contador para perfiles no válidos obtenidos desde la API

const fetchUsernamesFromApi = async () => {
    try {
        const response = await axios.get('https://random-word-api.herokuapp.com/all');
        return response.data; // La respuesta es un array de palabras
    } catch (error) {
        console.error('Error fetching usernames from API: ' + error.message);
        return [];
    }
};

const profileExistsInDatabase = (username) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 'validos' AS table_name FROM validos WHERE url = ?
            UNION
            SELECT 'invalidos' AS table_name FROM invalidos WHERE url = ?
        `;
        connection.query(query, [username, username], (err, results) => {
            if (err) {
                reject(err);
            } else {
                if (results.length > 0) {
                    resolve(results[0].table_name);
                } else {
                    resolve(null);
                }
            }
        });
    });
};

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const checkProfile = async (page, username) => {
    const url = `https://onlyfans.com/${username}`;
    console.log(`Verifying URL: ${url}`);

    if (await profileExistsInDatabase(username)) {
        console.log(`The profile ${username} already exists in the database.`);
        return;
    }

    try {
        const navigationPromise = page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await Promise.race([
            navigationPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 10000))
        ]);

        let html = '';
        try {
            await page.waitForSelector('body', { timeout: 10000 });
            html = await page.evaluate(() => document.body.innerHTML);

            if (html.includes('Sorry') && html.includes('this page is not available')) {
                console.log(`The profile ${username} does not exist.`);
                await insertProfile(username, false);
                invalidCount++;
                invalidProfilesCount++;
            } else {
                console.log(`The profile ${username} exists.`);
                await insertProfile(username, true);
                validCount++;
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
        await delay(100); // Esperar 100 ms entre peticiones
    }

    console.log(`Verification complete. Valid profiles: ${validCount}, Invalid profiles: ${invalidCount}`);
    await browser.close();
    connection.end(); // Cerrar la conexión a MySQL
};

run();
