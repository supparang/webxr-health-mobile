import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVENANCE } from '../nutrition.js';
import { createScannerServer } from '../server.mjs';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'Playwright is not installed. Run `npm install --no-save playwright@1.56.1` before running browser smoke tests.'
    );
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(
    dims.scrollWidth <= dims.clientWidth + 1,
    `${label}: horizontal overflow detected (scrollWidth=${dims.scrollWidth} > clientWidth=${dims.clientWidth})`
  );
}

async function run() {
  const { chromium } = await loadPlaywright();
  const screenshotDir = process.env.QA_SCREENSHOT_DIR || '';
  if (screenshotDir) {
    await fs.mkdir(screenshotDir, { recursive: true });
  }

  const server = createScannerServer({
    analyzeFn: async () => ({
      ok: true,
      mode: 'ai',
      provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
      result: {
        outcome: 'matched',
        foodId: 'tom_yum_kung',
        confidence: 0.91,
        suggestedPortionMultiplier: 1,
        reasonTh: 'โมเดลจำลองตรวจพบกุ้ง เห็ดฟาง และสมุนไพรในน้ำซุปใส',
        visibleComponentsTh: ['กุ้ง', 'เห็ดฟาง', 'ตะไคร้'],
      },
    }),
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/`;

  const launchOpts = { headless: true };
  if (process.env.CHROME_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.CHROME_EXECUTABLE_PATH;
  }

  const browser = await chromium.launch(launchOpts);

  try {
    // 1. Desktop 1280x800 full end-to-end flow covering all 5 Product & UX features
    const desktopCtx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
    const page = await desktopCtx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await assertNoHorizontalOverflow(page, 'desktop-initial');

    // Verify PWA manifest loads cleanly
    const manifestRes = await page.request.get(`${baseUrl}manifest.webmanifest`);
    assert.equal(manifestRes.status(), 200);

    // Feature 4: Personal age-band goal profile & allergen warning
    await page.click('#toggleProfileBtn');
    await page.click('#ageProfileChips button[data-profile-id="child_p4_p6"]');
    await page.check('input[data-allergen="peanut"]');
    assert.match(await page.textContent('#profileSummaryMeta'), /1,700 kcal/);

    // Feature 2: Multi-dish combo meal (Som Tum + Sticky Rice + Grilled Chicken) + Allergen banner
    await page.click('.sample-card[data-preset-id="som_tum_thai"]');
    await page.click('#scanBtn');
    await page.waitForSelector('#resultContent:not([hidden])');
    await page.waitForSelector('#allergenAlert:not([hidden])');
    assert.match(await page.textContent('#allergenAlert'), /ถั่วลิสง/);
    assert.equal((await page.textContent('#kcalValue')).trim(), '165');

    await page.click('.quick-side-btn[data-side-id="sticky_rice"]');
    await page.click('.quick-side-btn[data-side-id="gai_yang"]');
    assert.equal((await page.textContent('#trayCount')).trim(), '3');
    assert.equal((await page.textContent('#kcalValue')).trim(), '630');

    // Feature 5a: Searchable dish picker
    await page.fill('#dishSearchInput', 'ปลานึ่ง');
    const optionCount = await page.locator('#dishSelect option').count();
    assert.ok(optionCount <= 4, `Search should narrow options (got ${optionCount})`);
    await page.fill('#dishSearchInput', '');

    // Save combo meal -> verify daily summary + 7-day trend SVG
    await page.fill('#mealNoteInput', 'ชุดส้มตำไก่ย่าง');
    await page.click('#saveMealBtn');
    await page.waitForSelector('#historyList li');
    assert.match(await page.textContent('#dailyKcal'), /630/);
    assert.equal(await page.locator('#trendSvgWrap svg rect').count(), 7);

    // Feature 5b: Inline edit saved record
    await page.locator('.edit-record-btn').first().click();
    await page.fill('.edit-note-input', 'แก้ไขโน้ตแล้ว');
    await page.click('.save-edit-btn');
    assert.match(await page.textContent('#historyList'), /แก้ไขโน้ตแล้ว/);

    // Feature 3: Barcode & Thai GDA Label tab
    await page.click('#tabGdaBtn');
    await page.fill('#barcodeInput', '8850123456012');
    await page.click('#lookupBarcodeBtn');
    await page.fill('#gdaKcalInput', '150'); // User edits label -> USER_ENTERED_GDA_LABEL
    await page.click('#saveGdaBtn');
    await page.waitForSelector('#gdaSaveFeedback:not([hidden])');
    assert.match(await page.textContent('#dailyKcal'), /780/);

    // Switch back to Photo tab -> AI Vision mode safety check
    await page.click('#tabPhotoBtn');
    await page.click('#modeAiBtn');
    await page.click('.sample-card[data-preset-id="tom_yum_kung"]');
    await page.click('#scanBtn');
    await page.waitForSelector('#aiSafetyBox:not([hidden])');
    assert.equal(await page.isHidden('#nutritionBlock'), true, 'AI mode MUST hide mock nutrition block');
    await page.click('#saveMealBtn');
    assert.equal(await page.locator('#historyList li').count(), 3);
    assert.match(await page.textContent('#dailyKcal'), /780/);

    // CSV export check (contains Demo, User GDA, and AI Classification-Only provenances)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportCsvBtn'),
    ]);
    const dlPath = await download.path();
    const csvText = await fs.readFile(dlPath, 'utf8');
    assert.ok(csvText.startsWith('\uFEFF'), 'Exported CSV must include UTF-8 BOM');
    assert.match(csvText, /AI_CLASSIFICATION_ONLY_NO_UNVERIFIED_NUTRIENTS/);
    assert.match(csvText, /USER_ENTERED_GDA_LABEL/);
    assert.match(csvText, /ILLUSTRATIVE_FIXTURE_NOT_VALIDATED/);

    // Invalid file upload check
    await page.setInputFiles('#fileInput', {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await page.waitForSelector('#uploadError:not([hidden])');

    // Clear history
    await page.click('#clearHistoryBtn');
    await page.waitForSelector('#emptyHistory:not([hidden])');

    assert.deepEqual(errors, [], `Unexpected desktop console/page errors: ${errors.join('; ')}`);
    await desktopCtx.close();

    // 2. Mobile 390x844
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
    await mobilePage.click('.sample-card[data-preset-id="som_tum_thai"]');
    await mobilePage.click('#scanBtn');
    await mobilePage.waitForSelector('#resultContent:not([hidden])');
    await assertNoHorizontalOverflow(mobilePage, 'mobile-390');
    await mobileCtx.close();

    // 3. Compact Mobile 320x568
    const compactCtx = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const compactPage = await compactCtx.newPage();
    await compactPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await compactPage.click('.sample-card[data-preset-id="pad_krapow_gai"]');
    await compactPage.click('#scanBtn');
    await compactPage.waitForSelector('#resultContent:not([hidden])');
    await assertNoHorizontalOverflow(compactPage, 'mobile-320');
    await compactCtx.close();

    console.log('PASS: All 5 Product & UX features verified on desktop (1280x800), mobile (390x844), and compact (320x568).');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
