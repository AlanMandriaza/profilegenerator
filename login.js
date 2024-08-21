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

// Función de espera alternativa
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función principal para ejecutar el script
const run = async () => {
    const browser = await puppeteer.launch({ headless: false }); // No headless, para ver la ventana del navegador
    const page = await browser.newPage();
    let profiles = new Set();
    let profileCount = 0;

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

        // Esperar 5 segundos después de hacer clic en el botón de inicio de sesión
        console.log('Waiting for 5 seconds before starting profile extraction...');
        await wait(5000);

        // Función para extraer y guardar perfiles
        const extractAndSaveProfiles = async () => {
            try {
                const profilesOnPage = await page.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('*'));
                    const profileSet = new Set();

                    elements.forEach(element => {
                        const textContent = element.textContent || '';
                        textContent.split(/\s+/).forEach(word => {
                            if (word.startsWith('@')) {
                                // Eliminar el símbolo '@' y caracteres especiales/emoticones
                                const cleanProfile = word.replace('@', '').replace(/[^\w]/g, '');
                                profileSet.add(cleanProfile);
                            }
                        });
                    });

                    return Array.from(profileSet);
                });

                for (const profile of profilesOnPage) {
                    if (!profiles.has(profile)) {
                        profiles.add(profile);
                        profileCount++;
                        console.log(`New profile added: ${profile}. Total count: ${profileCount}`);

                        // Verificar si el perfil ya existe en la base de datos
                        connection.query('SELECT COUNT(*) AS count FROM validos WHERE url = ?', [profile], (err, results) => {
                            if (err) {
                                console.error('Error checking profile in database:', err);
                            } else {
                                if (results[0].count === 0) {
                                    // Insertar el perfil en la base de datos
                                    const query = 'INSERT INTO validos (url) VALUES (?)';
                                    connection.query(query, [profile], (err) => {
                                        if (err) {
                                            console.error('Error inserting profile into database:', err);
                                        } else {
                                            console.log(`Profile ${profile} inserted into database.`);
                                        }
                                    });
                                } else {
                                    console.log(`Profile ${profile} already exists in database.`);
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error during profile extraction:', error);
            }
        };

        // Función para hacer scroll fluido y constante
        const scrollContinuously = async () => {
            let previousHeight = 0;
            let currentHeight = 0;

            while (true) {
                try {
                    // Obtener la altura actual de la página
                    previousHeight = await page.evaluate('document.body.scrollHeight');
                    // Hacer scroll hacia abajo en incrementos pequeños
                    await page.evaluate('window.scrollBy(0, window.innerHeight)');
                    // Esperar a que el contenido nuevo se cargue
                    await wait(2000); // Ajusta el tiempo de espera según sea necesario
                    
                    // Extraer perfiles después de cada desplazamiento
                    await extractAndSaveProfiles();

                    // Obtener la altura después del scroll
                    currentHeight = await page.evaluate('document.body.scrollHeight');

                    // Si no hay nuevo contenido, continuar haciendo scroll
                    if (currentHeight === previousHeight) {
                        console.log('No new content detected. Continuing to scroll...');
                    }
                } catch (error) {
                    console.error('Error during scrolling:', error);
                    await wait(2000); // Esperar 2 segundos antes de intentar nuevamente
                }
            }
        };

        // Comenzar el desplazamiento continuo y la extracción de perfiles
        await scrollContinuously();

    } catch (error) {
        console.error('Error during login or profile extraction:', error);
    } finally {
        // Mantener el navegador abierto
        console.log('Script completed. Browser will remain open.');
        
        // Puedes eliminar la línea `connection.end();` si no deseas cerrar la conexión a la base de datos
        // connection.end();
    }
};

// Función para reiniciar el proceso cada 15 minutos
const restartEvery15Minutes = async () => {
    while (true) {
        console.log('Starting the run...');
        await run();
        console.log('Waiting for the next cycle...');
        await wait(15 * 60 * 1000); // Esperar 15 minutos en milisegundos
    }
};

// Iniciar el proceso
restartEvery15Minutes();
