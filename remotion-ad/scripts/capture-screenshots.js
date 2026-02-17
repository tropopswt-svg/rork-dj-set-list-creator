const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:8081';
const OUTPUT_DIR = path.join(__dirname, '../public/screenshots');

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const screens = [
  { name: 'discover.png', path: '/', waitFor: 3000 },
  { name: 'feed.png', path: '/(tabs)/(feed)', waitFor: 3000 },
  { name: 'crate.png', path: '/(tabs)/(social)', waitFor: 3000 },
  { name: 'profile.png', path: '/(tabs)/(profile)', waitFor: 3000 },
];

async function captureScreenshots() {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Set iPhone viewport
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  // Set dark mode
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
  ]);

  for (const screen of screens) {
    try {
      console.log(`Capturing ${screen.name}...`);

      const url = `${BASE_URL}${screen.path}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await wait(screen.waitFor);

      await page.screenshot({
        path: path.join(OUTPUT_DIR, screen.name),
        type: 'png',
      });

      console.log(`  ✓ Saved ${screen.name}`);
    } catch (error) {
      console.error(`  ✗ Failed to capture ${screen.name}:`, error.message);
    }
  }

  // For identify, we need to trigger the modal
  try {
    console.log('Capturing identify.png...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);

    // Try to click the FAB button to open identify modal
    const fabButton = await page.$('[data-testid="fab-button"]') ||
                      await page.$('button:has-text("TRACK")') ||
                      await page.$('.fab');

    if (fabButton) {
      await fabButton.click();
      await wait(1500);
    }

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'identify.png'),
      type: 'png',
    });
    console.log('  ✓ Saved identify.png');
  } catch (error) {
    console.error('  ✗ Failed to capture identify.png:', error.message);
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to public/screenshots/');
}

captureScreenshots().catch(console.error);
