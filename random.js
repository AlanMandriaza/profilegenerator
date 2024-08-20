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

// Genera un nombre de usuario aleatorio que no comience con . o -
const generateUsername = () => {
    const length = Math.floor(Math.random() * (15 - 4 + 1)) + 4;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '._-';

    let result = '';
    let hasDot = false;
    let hasDash = false;

    // Asegurarse de que el primer carácter no sea . o -
    result += chars.charAt(Math.floor(Math.random() * chars.length));

    for (let i = 1; i < length; i++) {
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
        connection.query('SELECT * FROM invalidos WHERE url = ?', [username], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results.length > 0);
        });
    });
};

// Verifica si el perfil está en la base de datos de perfiles válidos
const isValid = (username) => {
    return new Promise((resolve, reject) => {
        connection.query('SELECT * FROM validos WHERE url = ?', [username], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results.length > 0);
        });
    });
};

// Agrega un perfil no válido a la base de datos
const addInvalid = (username) => {
    connection.query('INSERT INTO invalidos (url) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Error inserting invalid profile: ' + err.stack);
        } else {
            console.log(`Added invalid profile: ${username}`);
        }
    });
};

// Agrega un perfil válido a la base de datos
const addValid = (username) => {
    connection.query('INSERT INTO validos (url) VALUES (?)', [username], (err) => {
        if (err) {
            console.error('Error inserting valid profile: ' + err.stack);
        } else {
            console.log(`Added valid profile: ${username}`);
        }
    });
};

// Actualiza el perfil en la base de datos para marcarlo como verificado
const markProfileAsVerified = (username) => {
    connection.query('UPDATE validos SET is_verified = 1 WHERE url = ?', [username], (err) => {
        if (err) {
            console.error('Error updating verification status: ' + err.stack);
        } else {
            console.log(`Marked profile ${username} as verified.`);
        }
    });
};

// Verifica si el perfil es válido o no
const checkProfile = async (page, username) => {
    const url = `https://onlyfans.com/${username}`;
    console.log(`Verifying URL: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const profileIsVerified = await page.evaluate(() => {
            // Busca el elemento que indica que el perfil está verificado
            const verifiedElement = document.querySelector('.g-user-name.m-verified');
            return verifiedElement !== null;
        });

        if (profileIsVerified) {
            console.log(`The profile ${username} is verified.`);
            return true;
        } else {
            console.log(`The profile ${username} is not verified.`);
            return false;
        }
    } catch (error) {
        console.error(`Error navigating to the URL: ${error.message}`);
        return false;
    }
};

// Ejecuta la verificación de perfiles
const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const numUsernames = 10; // Número de nombres de usuario a generar
    let validProfilesCount = 0;
    let invalidProfilesCount = 0;

    while (validProfilesCount < numUsernames) {
        const username = generateUsername();

        // Verifica si el perfil ya está en la base de datos de perfiles válidos o inválidos
        if (await isValid(username)) {
            console.log(`The profile ${username} is already in valid profiles.`);
            continue;
        }

        if (await isInvalid(username)) {
            console.log(`The profile ${username} is in invalid profiles.`);
            invalidProfilesCount++;
            continue;
        }

        const profileExists = await checkProfile(page, username);

        if (profileExists) {
            addValid(username);
            markProfileAsVerified(username); // Marcar el perfil como verificado
            validProfilesCount++;
        } else {
            addInvalid(username);
            invalidProfilesCount++;
        }

        // Espera 100 ms entre peticiones
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    await browser.close();
    connection.end();
    console.log(`Total valid profiles: ${validProfilesCount}`);
    console.log(`Total invalid profiles: ${invalidProfilesCount}`);
};

run();
