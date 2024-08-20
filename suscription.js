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

// Función para hacer clic en el botón de suscripción
const clickSubscribeButton = async (page) => {
    try {
        // Esperar a que el botón de suscripción sea visible
        await page.waitForSelector('#content > div.l-wrapper.m-content-one-column > div.l-wrapper__holder-content > div > div.l-profile-container > div > div.b-profile-section-btns > div.list-offers.m-offer-bottom-gap-reset.m-main-details.mb-0 > div > div.b-offer-join', { visible: true });

        // Verificar si el botón de suscripción es gratuito
        const isFreeSubscription = await page.evaluate(() => {
            const subscriptionElement = document.querySelector('#content > div.l-wrapper.m-content-one-column > div.l-wrapper__holder-content > div > div.l-profile-container > div > div.b-profile-section-btns > div.list-offers.m-offer-bottom-gap-reset.m-main-details.mb-0 > div > div.b-offer-join');
            return subscriptionElement && !subscriptionElement.textContent.includes('$');
        });

        if (!isFreeSubscription) {
            console.log('Subscription is paid. Skipping...');
            return false; // Indica que la suscripción no se realizó
        }

        // Hacer clic en el botón de suscripción
        await page.click('#content > div.l-wrapper.m-content-one-column > div.l-wrapper__holder-content > div > div.l-profile-container > div > div.b-profile-section-btns > div.list-offers.m-offer-bottom-gap-reset.m-main-details.mb-0 > div > div.b-offer-join');
        console.log('Clicked on subscribe button.');

        // Esperar un poco para que el proceso de suscripción se complete
        await wait(1000);

        return true; // Indica que la suscripción se realizó
    } catch (error) {
        console.error('Error clicking subscribe button or handling payment:', error);
        return false; // Indica que la suscripción no se realizó
    }
};

// Función principal para ejecutar el script
const run = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

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

        // Esperar 30 segundos después de hacer clic en el botón de inicio de sesión
        console.log('Waiting for 30 seconds after login...');
        await wait(30000);

        // Navegar a la página de perfiles válidos
        console.log('Navigating to the valid profiles page...');
        await page.goto('https://www.onlyfans.com/perfilesvalidos', { waitUntil: 'networkidle2' });

        // Obtener los perfiles de la base de datos
        connection.query('SELECT url FROM validos', async (err, results) => {
            if (err) {
                console.error('Error retrieving profiles from database:', err);
                return;
            }

            for (const row of results) {
                const profile = row.url;

                try {
                    console.log(`Navigating to profile page: ${profile}`);
                    await page.goto(`https://onlyfans.com/${profile}`, { waitUntil: 'networkidle2' });

                    // Esperar para que la página del perfil cargue completamente
                    await wait(5000);

                    const isSubscribed = await clickSubscribeButton(page);

                    if (isSubscribed) {
                        console.log(`Successfully subscribed to profile ${profile}`);
                    } else {
                        console.log(`Skipped profile ${profile} due to paid subscription.`);
                    }
                } catch (error) {
                    console.error(`Error subscribing to profile ${profile}:`, error);
                }
            }

            console.log('All profiles processed. The browser will remain open.');
        });

    } catch (error) {
        console.error('Error during login or profile subscription:', error);
    }
};

// Ejecutar la función principal
run();
