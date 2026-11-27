import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVENANCE } from '../nutrition.js';
import { createScannerServer } from '../server.mjs';

const VALID_JPEG_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

async function startTestServer(options = {}) {
  const server = createScannerServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('HTTP server serves static index.html, blocks path traversal and server source exposure', async () => {
  const srv = await startTestServer({ apiKey: '' });
  try {
    const htmlRes = await fetch(`${srv.baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    assert.match(htmlRes.headers.get('content-type') || '', /text\/html/);
    const html = await htmlRes.text();
    assert.match(html, /NutriLens TH/);

    // Block server source and package.json
    const serverSrcRes = await fetch(`${srv.baseUrl}/server.mjs`);
    assert.equal(serverSrcRes.status, 404);

    const pkgRes = await fetch(`${srv.baseUrl}/package.json`);
    assert.equal(pkgRes.status, 404);

    // Block URL-encoded path traversal (%2f prevents fetch from normalizing dot-segments before sending)
    const traversalRes = await fetch(`${srv.baseUrl}/%2e%2e%2fREADME.md`);
    assert.equal(traversalRes.status, 404);
  } finally {
    await srv.close();
  }
});

test('GET /api/health reports AI configuration accurately', async () => {
  const srvUnconfigured = await startTestServer({ apiKey: '' });
  try {
    const res = await fetch(`${srvUnconfigured.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.aiConfigured, false);
  } finally {
    await srvUnconfigured.close();
  }

  const srvMock = await startTestServer({
    analyzeFn: async () => ({
      ok: true,
      mode: 'ai',
      provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
      result: {
        outcome: 'matched',
        foodId: 'som_tum_thai',
        confidence: 0.91,
        suggestedPortionMultiplier: 1,
        reasonTh: 'ส้มตำไทย',
        visibleComponentsTh: ['มะละกอ', 'ถั่วลิสง'],
      },
    }),
  });
  try {
    const res = await fetch(`${srvMock.baseUrl}/api/health`);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.aiConfigured, true);
  } finally {
    await srvMock.close();
  }
});

test('POST /api/analyze validates content-type, image signature, and returns mock AI classification safely', async () => {
  const srv = await startTestServer({
    analyzeFn: async ({ mimeType }) => ({
      ok: true,
      mode: 'ai',
      provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
      result: {
        outcome: 'matched',
        foodId: 'tom_yum_kung',
        confidence: 0.88,
        suggestedPortionMultiplier: 1,
        reasonTh: `ตรวจพบต้มยำกุ้งน้ำใส (${mimeType})`,
        visibleComponentsTh: ['กุ้ง', 'เห็ด'],
      },
    }),
  });

  try {
    // 415 on non-JSON
    const badCt = await fetch(`${srv.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    assert.equal(badCt.status, 415);

    // 400 on bad image signature
    const badImg = await fetch(`${srv.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: `data:image/jpeg;base64,${Buffer.from('not-a-real-jpeg-file').toString('base64')}`,
      }),
    });
    assert.equal(badImg.status, 400);
    const badImgJson = await badImg.json();
    assert.equal(badImgJson.code, 'INVALID_IMAGE_SIGNATURE');

    // 200 on valid JPEG
    const okRes = await fetch(`${srv.baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: `data:image/jpeg;base64,${VALID_JPEG_BUF.toString('base64')}`,
      }),
    });
    assert.equal(okRes.status, 200);
    const okJson = await okRes.json();
    assert.equal(okJson.ok, true);
    assert.equal(okJson.mode, 'ai');
    assert.equal(okJson.provenance, PROVENANCE.AI_CLASSIFICATION_ONLY);
    assert.equal(okJson.result.foodId, 'tom_yum_kung');
  } finally {
    await srv.close();
  }
});
