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
        // Selector del botón de suscripción
        const buttonSelector = '#content > div.l-wrapper.m-content-one-column > div.l-wrapper__holder-content > div > div.l-profile-container > div > div.b-profile-section-btns > div.list-offers.m-offer-bottom-gap-reset.m-main-details.mb-0 > div > div.b-offer-join';

        // Esperar a que el botón de suscripción sea visible
        await page.waitForSelector(buttonSelector, { visible: true });

        // Verificar si el botón de suscripción es gratuito
        const isFreeSubscription = await page.evaluate((selector) => {
            const subscriptionElement = document.querySelector(selector);
            return subscriptionElement && !subscriptionElement.textContent.includes('$');
        }, buttonSelector);

        if (!isFreeSubscription) {
            console.log('Subscription is paid. Skipping...');
            return false; // Indica que la suscripción no se realizó
        }

        // Hacer clic en el botón de suscripción
        await page.click(buttonSelector);
        console.log('Clicked on subscribe button.');

        // Esperar un poco para que el proceso de suscripción se complete
        await wait(1000);

        // Verificar si la suscripción se completó
        const confirmationSelector = '#some-confirmation-element'; // Cambia esto según el elemento de confirmación real
        const subscriptionCompleted = await page.evaluate((selector) => {
            return document.querySelector(selector) !== null;
        }, confirmationSelector);

        return subscriptionCompleted; // Indica si la suscripción se realizó
    } catch (error) {
        console.error('Error clicking subscribe button or handling payment:', error);
        return false; // Indica que la suscripción no se realizó
    }
};

// Función para verificar si ya se intentó suscribirse a un perfil
const checkSubscriptionAttempt = (profileUrl) => {
    return new Promise((resolve, reject) => {
        connection.query('SELECT subscription_attempted FROM validos WHERE url = ?', [profileUrl], (err, results) => {
            if (err) {
                reject('Error checking subscription attempt: ' + err);
            } else if (results.length > 0 && results[0].subscription_attempted) {
                resolve(true); // La suscripción ya fue intentada
            } else {
                resolve(false); // La suscripción no ha sido intentada
            }
        });
    });
};

// Función para actualizar la base de datos después de intentar suscribirse
const updateSubscriptionStatus = (profileUrl, status) => {
    return new Promise((resolve, reject) => {
        connection.query(
            'UPDATE validos SET subscription_attempted = TRUE, is_verified = ? WHERE url = ?',
            [status, profileUrl],
            (err) => {
                if (err) {
                    reject('Error updating subscription status: ' + err);
                } else {
                    resolve();
                }
            }
        );
    });
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

       

        // Obtener los perfiles de la base de datos
        connection.query('SELECT url FROM validos', async (err, results) => {
            if (err) {
                console.error('Error retrieving profiles from database:', err);
                return;
            }

            for (const row of results) {
                const profile = row.url;

                try {
                    // Verificar si ya se intentó suscribirse a este perfil
                    const alreadyAttempted = await checkSubscriptionAttempt(profile);
                    if (alreadyAttempted) {
                        console.log(`Profile ${profile} already attempted. Skipping...`);
                        continue;
                    }

                    console.log(`Navigating to profile page: ${profile}`);
                    await page.goto(`https://onlyfans.com/${profile}`, { waitUntil: 'networkidle2' });

                    // Esperar para que la página del perfil cargue completamente
                    await wait(5000);

                    const isSubscribed = await clickSubscribeButton(page);

                    if (isSubscribed) {
                        console.log(`Successfully subscribed to profile ${profile}`);
                        await updateSubscriptionStatus(profile, true);
                    } else {
                        console.log(`Skipped profile ${profile} due to paid subscription.`);
                        await updateSubscriptionStatus(profile, false);
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
