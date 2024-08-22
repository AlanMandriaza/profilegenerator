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

// Verifica si el perfil está verificado en la web
const checkProfileOnWeb = async (page, username) => {
    const url = `https://onlyfans.com/${username}`;
    console.log(`Verifying URL: ${url}`);

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Verifica si el perfil está verificado buscando el texto específico en el atributo href
        const isVerified = await page.evaluate(() => {
            // Busca si hay algún 'use' con el atributo href que contiene 'icon-verified'
            const element = document.querySelector('svg use[href*="icon-verified"]');
            return element !== null;
        });

        return isVerified;
    } catch (error) {
        console.error(`Error navigating to the URL: ${error.message}`);
        return false;
    }
};

// Mueve un perfil de válidos a inválidos
const moveToInvalid = (username) => {
    return new Promise((resolve, reject) => {
        connection.query('DELETE FROM validos WHERE url = ?', [username], (err) => {
            if (err) {
                return reject('Error deleting profile from validos: ' + err.stack);
            }
            console.log(`Removed profile ${username} from validos.`);
            connection.query('INSERT INTO invalidos (url) VALUES (?)', [username], (err) => {
                if (err) {
                    return reject('Error adding profile to invalidos: ' + err.stack);
                }
                console.log(`Added profile ${username} to invalidos.`);
                resolve();
            });
        });
    });
};

// Actualiza el estado de verificación en la base de datos
const updateVerificationStatus = (username, isVerified) => {
    return new Promise((resolve, reject) => {
        connection.query('UPDATE validos SET is_verified = ? WHERE url = ?', [isVerified, username], (err) => {
            if (err) {
                return reject('Error updating verification status: ' + err.stack);
            }
            console.log(`Updated verification status for profile ${username} to ${isVerified ? 'verified' : 'not verified'}.`);
            resolve();
        });
    });
};

// Obtiene la lista de perfiles de la base de datos
const getProfiles = () => {
    return new Promise((resolve, reject) => {
        connection.query('SELECT url, is_verified FROM validos', (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

// Ejecuta la verificación de perfiles
const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        const profiles = await getProfiles();
        const totalProfiles = profiles.length;
        console.log(`Found ${totalProfiles} profiles to check.`);

        const checkedProfiles = new Set();

        while (checkedProfiles.size < totalProfiles) {
            // Selecciona un perfil al azar que no se haya verificado antes
            let randomProfile;
            do {
                const randomIndex = Math.floor(Math.random() * totalProfiles);
                randomProfile = profiles[randomIndex];
            } while (checkedProfiles.has(randomProfile.url));

            checkedProfiles.add(randomProfile.url);
            const { url: username, is_verified } = randomProfile;

            if (is_verified) {
                // Mostrar que el perfil ya está verificado y se omite
                console.log(`Skipping already verified profile: ${username}.`);
            } else {
                const isVerified = await checkProfileOnWeb(page, username);

                if (isVerified) {
                    await updateVerificationStatus(username, true);
                } else {
                    await moveToInvalid(username);
                }
            }

            // Mostrar el progreso restante
            console.log(`Progress: ${checkedProfiles.size}/${totalProfiles} profiles checked.`);

            // Espera 100 ms entre peticiones
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } catch (error) {
        console.error('Error during profile verification: ' + error.message);
    } finally {
        await browser.close();
        connection.end();
    }
};

run();
