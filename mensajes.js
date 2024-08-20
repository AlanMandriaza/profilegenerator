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

const run = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    const scrollLimit = 10; // Número de scrolls hacia arriba antes de detenerse

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

        // Esperar 20 segundos después de hacer clic en el botón de inicio de sesión
        console.log('Waiting for 20 seconds after login...');
        await wait(20000);

        // Navegar a la página de chats
        console.log('Navigating to the chats page...');
        await page.goto('https://onlyfans.com/my/chats/', { waitUntil: 'networkidle2' });

        // Esperar a que los chats se carguen
        console.log('Waiting for chats to load...');
        await wait(5000); // Ajusta el tiempo si es necesario

        // Función para extraer perfiles
        const extractAndSaveProfiles = async (chatSelector) => {
            try {
                console.log(`Selecting chat with selector: ${chatSelector}`);
                await page.click(chatSelector);

                // Esperar a que el contenido del chat se cargue
                console.log('Waiting for chat content...');
                await wait(5000);

                let profiles = new Set();
                let profileCount = 0;
                let scrollAttempts = 0;

                while (scrollAttempts < scrollLimit) {
                    try {
                        // Extraer perfiles
                        const profilesOnPage = await page.evaluate(() => {
                            const profileElements = Array.from(document.querySelectorAll('.b-chats__item__user .g-user-name')); // Ajusta el selector
                            const profileSet = new Set();
                            
                            profileElements.forEach(element => {
                                const textContent = element.textContent || '';
                                const cleanProfile = textContent.replace(/[^\w\s]/g, ''); // Eliminar caracteres especiales
                                if (cleanProfile.trim()) {
                                    profileSet.add(cleanProfile.trim());
                                }
                            });
                            
                            return Array.from(profileSet);
                        });

                        for (const profile of profilesOnPage) {
                            if (!profiles.has(profile)) {
                                profiles.add(profile);
                                profileCount++;
                                console.log(`New profile added: ${profile}. Total count: ${profileCount}`);
                                
                                // Insertar el perfil en la base de datos
                                const query = 'INSERT INTO validos (url) VALUES (?)';
                                connection.query(query, [profile], (err) => {
                                    if (err) {
                                        console.error('Error inserting profile into database:', err);
                                    } else {
                                        console.log(`Profile inserted into database.`);
                                    }
                                });
                            }
                        }

                        // Obtener la altura actual de la página
                        const previousHeight = await page.evaluate('document.body.scrollHeight');
                        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                        await wait(2000); // Esperar a que el contenido nuevo se cargue
                        const currentHeight = await page.evaluate('document.body.scrollHeight');

                        // Si no hay nuevo contenido, detener el scroll
                        if (currentHeight === previousHeight) {
                            console.log('No new content detected.');
                            break;
                        }

                        scrollAttempts++;
                    } catch (error) {
                        console.error('Error during scrolling:', error);
                        await wait(2000); // Esperar 2 segundos antes de intentar nuevamente
                    }
                }

                // Volver a la lista de chats
                console.log('Returning to the list of chats...');
                await page.goto('https://onlyfans.com/my/chats/', { waitUntil: 'networkidle2' });

            } catch (error) {
                console.error(`Error extracting profiles from chat ${chatSelector}:`, error);
            }
        };

        // Función para extraer y guardar mensajes
        const extractAndSaveMessages = async (chatSelector) => {
            try {
                console.log(`Selecting chat with selector: ${chatSelector}`);
                await page.click(chatSelector);

                // Esperar a que el contenido del chat se cargue
                console.log('Waiting for chat content...');
                await wait(5000);

                let messages = new Set();
                let messageCount = 0;
                let scrollAttempts = 0;

                while (scrollAttempts < scrollLimit) {
                    try {
                        // Extraer mensajes
                        const messagesOnPage = await page.evaluate(() => {
                            const messageElements = Array.from(document.querySelectorAll('.b-chats__item__last-message__text')); // Ajusta el selector
                            const messageSet = new Set();
                            
                            messageElements.forEach(element => {
                                const textContent = element.textContent || '';
                                const cleanMessage = textContent.replace(/[^\w\s]/g, ''); // Eliminar caracteres especiales
                                if (cleanMessage.trim()) {
                                    messageSet.add(cleanMessage.trim());
                                }
                            });
                            
                            return Array.from(messageSet);
                        });

                        for (const message of messagesOnPage) {
                            if (!messages.has(message)) {
                                messages.add(message);
                                messageCount++;
                                console.log(`New message added: ${message}. Total count: ${messageCount}`);
                                
                                // Insertar el mensaje en la base de datos
                                const query = 'INSERT INTO messages (content) VALUES (?)';
                                connection.query(query, [message], (err) => {
                                    if (err) {
                                        console.error('Error inserting message into database:', err);
                                    } else {
                                        console.log(`Message inserted into database.`);
                                    }
                                });
                            }
                        }

                        // Obtener la altura actual de la página
                        const previousHeight = await page.evaluate('document.body.scrollHeight');
                        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
                        await wait(2000); // Esperar a que el contenido nuevo se cargue
                        const currentHeight = await page.evaluate('document.body.scrollHeight');

                        // Si no hay nuevo contenido, detener el scroll
                        if (currentHeight === previousHeight) {
                            console.log('No new content detected.');
                            break;
                        }

                        scrollAttempts++;
                    } catch (error) {
                        console.error('Error during scrolling:', error);
                        await wait(2000); // Esperar 2 segundos antes de intentar nuevamente
                    }
                }

                // Volver a la lista de chats
                console.log('Returning to the list of chats...');
                await page.goto('https://onlyfans.com/my/chats/', { waitUntil: 'networkidle2' });

            } catch (error) {
                console.error(`Error extracting messages from chat ${chatSelector}:`, error);
            }
        };

        // Función para seleccionar y procesar chats
        const processChats = async () => {
            const chatSelectors = [
                '#content > div.b-chats > div > div.b-chats__conversations-list > div.b-page-content.g-sides-gaps > div > div > div.b-chats__list-dialogues > div.swipeout-list.b-chats__list-wrapper.m-loading-items > div:nth-child(3)',
                '#content > div.b-chats > div > div.b-chats__conversations-list > div.b-page-content.g-sides-gaps > div > div > div.b-chats__list-dialogues > div.swipeout-list.b-chats__list-wrapper.m-loading-items > div:nth-child(5)'
            ];

            for (const chatSelector of chatSelectors) {
                await extractAndSaveProfiles(chatSelector); // Extraer perfiles
                await extractAndSaveMessages(chatSelector); // Extraer mensajes
            }
        };

        // Ejecutar el procesamiento de chats
        await processChats();

    } catch (error) {
        console.error('Error during login or chat extraction:', error);
    } finally {
        await browser.close();
        connection.end();
    }
};

run();
