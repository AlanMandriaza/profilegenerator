const puppeteer = require('puppeteer');
const mysql = require('mysql2');

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

// Genera un nombre de usuario aleatorio
const generateUsername = () => {
    const length = Math.floor(Math.random() * (15 - 4 + 1)) + 4;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '._-';
    
    let result = '';
    let hasDot = false;
    let hasDash = false;

    for (let i = 0; i < length; i++) {
        if (Math.random() < 0.2 && !hasDot && !hasDash) {
            const char = specialChars.charAt(Math.floor(Math.random() * specialChars.length));
            if (char === '.') {
                hasDot = true;
            } else if (char === '-') {
                hasDash = true;
            }
            result += char;
        } else {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    }

    if (hasDot && hasDash) {
        result = result.replace('-', chars.charAt(Math.floor(Math.random() * chars.length)));
    }

    return result;
};

// Verifica si el perfil está en la base de datos de perfiles inválidos
const isInvalid = (username) => {
    return new Promise((resolve, reject) => {
        connection.query('SELECT * FROM invalid_profiles WHERE username = ?', [username], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results.length > 0);
        });
    });
};

// Agrega un perfil no válido a la base de datos
const addInvalid = (username) => {
    connection.query('INSERT INTO invalid_profiles (username) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Error inserting invalid profile: ' + err.stack);
        } else {
            console.log(`Added invalid profile: ${username}`);
        }
    });
};

// Agrega un perfil válido a la base de datos
const addValid = (username) => {
    connection.query('INSERT INTO valid_profiles (username) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Error inserting valid profile: ' + err.stack);
        } else {
            console.log(`Added valid profile: ${username}`);
        }
    });
};

const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const numUsernames = 10; // Número de nombres de usuario a generar
    let validProfilesCount = 0;

    while (validProfilesCount < numUsernames) {
        const username = generateUsername();
        const profileExists = await checkProfile(page, username);
        if (profileExists) {
            addValid(username);
            validProfilesCount++;
        } else {
            addInvalid(username);
        }
    }

    await browser.close();
    connection.end();
};

// Verifica si el perfil es válido o no
const checkProfile = async (page, username) => {
    const url = `https://onlyfans.com/${username}`;
    console.log(`Verifying URL: ${url}`);

    if (await isInvalid(username)) {
        console.log(`The profile ${username} is in the invalid profiles.`);
        return false;
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
                return false;
            } else {
                console.log(`The profile ${username} exists.`);
                return true;
            }
        } catch (error) {
            console.error(`Error waiting for selector: ${error.message}`);
            return false;
        }
    } catch (error) {
        if (error.message === 'Navigation timeout') {
            console.log(`Navigation timeout for ${username}. Continuing to the next profile.`);
        } else {
            console.error(`Error navigating to the URL: ${error.message}`);
        }
        return false;
    }
};

run();
