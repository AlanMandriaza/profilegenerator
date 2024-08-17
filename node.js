const puppeteer = require('puppeteer');
const fs = require('fs');

const selector = '#content > div.l-wrapper.m-content-one-column > div.l-wrapper__holder-content > div > div > div';
const validFile = 'perfiles.txt';
const invalidFile = 'invalidos.txt';

const generateUsername = () => {
    const length = Math.floor(Math.random() * (15 - 4 + 1)) + 4;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const specialChars = '._-';
    
    let result = '';
    result += chars.charAt(Math.floor(Math.random() * chars.length));

    for (let i = 1; i < length; i++) {
        result += (Math.random() < 0.2)
            ? specialChars.charAt(Math.floor(Math.random() * specialChars.length))
            : chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
};

const isInvalidProfile = (url) => {
    return fs.readFileSync(invalidFile, 'utf-8').split('\n').includes(url);
};

const addToInvalidProfiles = (url) => {
    fs.appendFileSync(invalidFile, url + '\n');
};

const checkProfile = async (page, url) => {
    console.log(`Verificando la URL: ${url}`);
    try {
        const navigationPromise = page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await Promise.race([
            navigationPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 10000))
        ]);

        let html = '';
        try {
            await page.waitForSelector(selector, { timeout: 10000 });
            const elementHandle = await page.$(selector);
            if (elementHandle) {
                html = await page.evaluate(el => el.innerHTML, elementHandle);
                console.log(`HTML del selector detectado:\n${html}`);

                if (html.includes('Sorry') && html.includes('this page is not available')) {
                    console.log(`El perfil ${url} no existe.`);
                    addToInvalidProfiles(url);
                    return false;
                } else {
                    console.log(`El perfil ${url} existe.`);
                    fs.appendFileSync(validFile, url + '\n');
                    return true;
                }
            } else {
                console.log('Selector no encontrado');
                addToInvalidProfiles(url);
                return false;
            }
        } catch (error) {
            console.error(`Error al esperar el selector: ${error.message}`);
            addToInvalidProfiles(url);
            return false;
        }
    } catch (error) {
        if (error.message === 'Navigation timeout') {
            console.log(`Tiempo de navegación excedido para ${url}. Continuando con el siguiente perfil.`);
        } else {
            console.error(`Error al navegar a la URL: ${error.message}`);
        }
        addToInvalidProfiles(url);
        return false;
    }
};

const run = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let validProfilesCount = 0;

    while (validProfilesCount < 5) {
        const username = generateUsername();
        const url = `https://onlyfans.com/${username}`;

        if (isInvalidProfile(url)) {
            console.log(`El perfil ${url} ya está registrado como inválido. Omitiendo.`);
            continue;
        }

        const profileExists = await checkProfile(page, url);
        if (profileExists) {
            validProfilesCount++;
        }
    }

    await browser.close();
};

run();
