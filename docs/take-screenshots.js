// Guacamole Print Agent - Manual Screenshot Capture
// Usage: node docs/take-screenshots.js
// Press Enter to capture each screenshot. Type 'q' to quit.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const SERVER_URL = 'https://rguac.tdv.org:9443/guacamole/#/';


async function main() {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    console.log('Tarayici aciliyor...');
    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized', '--ignore-certificate-errors']
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    console.log('Guacamole sayfasina gidiliyor...');
    await page.goto(SERVER_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    let count = 0;
    console.log('\n========================================');
    console.log('  EKRAN GORUNTUSU YAKALAMA');
    console.log('  Enter  = ekran goruntusu al');
    console.log('  q      = cikis');
    console.log('========================================\n');

    const askNext = () => {
        const num = String(count + 1).padStart(2, '0');

        rl.question(`[${num}] Enter = ekran goruntusu al, q = cikis: `, async (answer) => {
            if (answer.trim().toLowerCase() === 'q') {
                console.log('\nTarayici kapatiliyor...');
                await browser.close();
                rl.close();
                console.log('Tamamlandi! ' + count + ' goruntu kaydedildi: ' + SCREENSHOTS_DIR);
                return;
            }

            const filePath = path.join(SCREENSHOTS_DIR, num + '.png');
            await page.screenshot({ path: filePath, fullPage: false });
            console.log(`  >>> Kaydedildi: ${num}.png`);
            count++;
            askNext();
        });
    };

    askNext();
}

main().catch(err => {
    console.error('Hata:', err.message);
    process.exit(1);
});
