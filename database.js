const puppeteer = require('puppeteer');
const mysql = require('mysql2');
const config = require('./config.json');

// Crear una conexión a MySQL
const connection = mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: 'profiles_db'
});

// Conectar a MySQL
connection.connect((err) => {
    if (err) {
        console.error('Error connecting: ' + err.stack);
        return;
    }
    console.log('Connected as id ' + connection.threadId);
});

const credentials = {
    username: 'alan.mandriaza@gmail.com',
    password: 'Alecita#1313'
};

const run = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    let profiles = new Set();

    try {
        console.log('Navigating to the OnlyFans login page...');
        await page.goto('https://onlyfans.com/', { waitUntil: 'networkidle2' });

        console.log('Waiting for login form...');
        await page.waitForSelector('form.b-loginreg__form', { visible: true });
        console.log('Login form is visible.');

        console.log('Entering credentials...');
        await page.type('input[name="email"]', credentials.username, { delay: 0 });
        await page.type('input[name="password"]', credentials.password, { delay: 0 });

        console.log('Clicking the login button...');
        await page.click('button[type="submit"]');

        console.log('Starting to scroll and extract profiles...');

        // Función para hacer scroll hasta el final de la página
        const scrollToEnd = async () => {
            let previousHeight;
            let scrolling = true;

            while (scrolling) {
                try {
                    previousHeight = await page.evaluate('document.body.scrollHeight');
                    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                    await page.waitForTimeout(2000); // Espera 2 segundos para que cargue más contenido
                    const currentHeight = await page.evaluate('document.body.scrollHeight');

                    // Si la altura de la página no cambia, se ha llegado al final
                    if (previousHeight === currentHeight) {
                        scrolling = false;
                        console.log('Reached the end of the page.');
                    }
                } catch (error) {
                    console.error('Error during scrolling:', error);
                }
            }
        };

        // Función para extraer perfiles únicos que contienen "@"
        const extractProfiles = async () => {
            try {
                const profilesOnPage = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const profileSet = new Set();
                    elements.forEach(element => {
                        const textContent = element.textContent || '';
                        textContent.split(/\s+/).forEach(word => {
                            if (word.startsWith('@')) {
                                profileSet.add(word.substring(1)); // Eliminar el '@' y añadir al set
                            }
                        });
                    });
                    return Array.from(profileSet);
                });

                profilesOnPage.forEach(profile => profiles.add(profile));
                console.log(`Profiles found: ${profiles.size}`);
                profiles.forEach(profile => console.log(profile));

                // Insertar perfiles en la base de datos
                profiles.forEach(profile => {
                    connection.query('INSERT INTO validos (url) VALUES (?)', [profile], (err) => {
                        if (err) {
                            console.error('Error inserting profile:', err);
                        }
                    });
                });

                console.log(`Profiles inserted into database: ${profiles.size}`);
            } catch (error) {
                console.error('Error during profile extraction:', error);
            }
        };

        // Realizar el scroll hasta el final de la página
        await scrollToEnd();

        // Extraer los perfiles después de llegar al final de la página
        await extractProfiles();

    } catch (error) {
        console.error('Error during login or profile extraction:', error);
    } finally {
        await browser.close();
    }
};

run();
