import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

const VALID_JPEG_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

test('Cloudflare Worker serves /api/health, CORS preflight, Study Access Code 401, and magic-byte 400', async () => {
  const env = {
    AI_PROVIDER: 'gemini',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_API_KEY: 'AIza-worker-secret',
    STUDY_ACCESS_CODE: 'CLASS2026',
    ALLOWED_ORIGINS: 'https://supparang.github.io',
    RATE_LIMIT_MAX_PER_MIN: '10',
  };

  // 1) OPTIONS preflight
  const optRes = await worker.fetch(
    new Request('https://nutrilens-th-api.example.workers.dev/api/analyze', {
      method: 'OPTIONS',
      headers: { Origin: 'https://supparang.github.io' },
    }),
    env
  );
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('Access-Control-Allow-Origin'), 'https://supparang.github.io');

  // 2) GET /api/health
  const healthRes = await worker.fetch(
    new Request('https://nutrilens-th-api.example.workers.dev/api/health'),
    env
  );
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.provider, 'gemini');
  assert.equal(healthJson.aiConfigured, true);
  assert.equal(healthJson.openVocabulary, true);
  assert.equal(healthJson.accessCodeRequired, true);

  // 3) POST /api/analyze with wrong Study Access Code -> 401
  const wrongCodeRes = await worker.fetch(
    new Request('https://nutrilens-th-api.example.workers.dev/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Study-Code': 'WRONG',
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: JSON.stringify({
        imageDataUrl: `data:image/jpeg;base64,${VALID_JPEG_BUF.toString('base64')}`,
      }),
    }),
    env
  );
  assert.equal(wrongCodeRes.status, 401);

  // 4) POST /api/analyze with valid Study Access Code but corrupt image -> 400
  const badImgRes = await worker.fetch(
    new Request('https://nutrilens-th-api.example.workers.dev/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Study-Code': 'CLASS2026',
        'CF-Connecting-IP': '203.0.113.11',
      },
      body: JSON.stringify({
        imageDataUrl: `data:image/jpeg;base64,${Buffer.from('not-jpeg-data-at-all').toString('base64')}`,
      }),
    }),
    env
  );
  assert.equal(badImgRes.status, 400);
  const badJson = await badImgRes.json();
  assert.equal(badJson.code, 'INVALID_IMAGE_SIGNATURE');
});
