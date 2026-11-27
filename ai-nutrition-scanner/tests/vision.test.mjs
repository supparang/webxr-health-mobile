import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVENANCE, UNKNOWN_DISH_ID } from '../nutrition.js';
import {
  MAX_IMAGE_BYTES,
  VisionGatewayError,
  analyzeFoodImage,
  detectImageSignature,
  parseAndValidateImageInput,
  validateVisionPayload,
} from '../vision.mjs';

const VALID_JPEG_BUF = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]);

const VALID_PNG_BUF = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const VALID_WEBP_BUF = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x56, 0x50, 0x38, 0x20]),
]);

test('detectImageSignature recognizes JPEG, PNG, and WebP and rejects invalid bytes', () => {
  assert.equal(detectImageSignature(VALID_JPEG_BUF), 'image/jpeg');
  assert.equal(detectImageSignature(VALID_PNG_BUF), 'image/png');
  assert.equal(detectImageSignature(VALID_WEBP_BUF), 'image/webp');
  assert.equal(detectImageSignature(Buffer.from('not an image at all')), null);
});

test('parseAndValidateImageInput accepts valid JPEG data URL and rejects spoofed MIME or oversized image', () => {
  const validDataUrl = `data:image/jpeg;base64,${VALID_JPEG_BUF.toString('base64')}`;
  const parsed = parseAndValidateImageInput({ imageDataUrl: validDataUrl });
  assert.equal(parsed.mimeType, 'image/jpeg');
  assert.equal(parsed.buffer.length, VALID_JPEG_BUF.length);

  // Spoofed MIME (PNG bytes labeled as JPEG)
  const spoofed = `data:image/jpeg;base64,${VALID_PNG_BUF.toString('base64')}`;
  assert.throws(
    () => parseAndValidateImageInput({ imageDataUrl: spoofed }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 400 && err.code === 'MIME_SIGNATURE_MISMATCH'
  );

  // Bad signature (plain text as PNG)
  const badSig = `data:image/png;base64,${Buffer.from('hello world 123456').toString('base64')}`;
  assert.throws(
    () => parseAndValidateImageInput({ imageDataUrl: badSig }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 400 && err.code === 'INVALID_IMAGE_SIGNATURE'
  );

  // Oversized image (> 5 MB)
  const bigBuf = Buffer.alloc(MAX_IMAGE_BYTES + 64, 0xaa);
  VALID_JPEG_BUF.copy(bigBuf, 0, 0, 4);
  assert.throws(
    () =>
      parseAndValidateImageInput({
        imageBase64: bigBuf.toString('base64'),
        mimeType: 'image/jpeg',
      }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 413 && err.code === 'IMAGE_TOO_LARGE'
  );
});

test('validateVisionPayload enforces strict schema and semantic consistency', () => {
  const valid = validateVisionPayload({
    outcome: 'matched',
    food_id: 'tom_yum_kung',
    confidence: 0.89,
    suggested_portion_multiplier: 1,
    reason_th: 'มองเห็นกุ้ง เห็ดฟาง ตะไคร้ และน้ำซุปใสแบบต้มยำกุ้งน้ำใส',
    visible_components_th: ['กุ้ง', 'เห็ดฟาง', 'ตะไคร้'],
  });
  assert.equal(valid.outcome, 'matched');
  assert.equal(valid.foodId, 'tom_yum_kung');

  // not_food forces foodId to unknown
  const notFood = validateVisionPayload({
    outcome: 'not_food',
    food_id: 'pad_krapow_gai',
    confidence: 0.95,
    suggested_portion_multiplier: 1,
    reason_th: 'ภาพนี้เป็นคีย์บอร์ดคอมพิวเตอร์ ไม่ใช่อาหาร',
    visible_components_th: [],
  });
  assert.equal(notFood.outcome, 'not_food');
  assert.equal(notFood.foodId, UNKNOWN_DISH_ID);

  // Extra unexpected field rejected
  assert.throws(
    () =>
      validateVisionPayload({
        outcome: 'matched',
        food_id: 'som_tum_thai',
        confidence: 0.9,
        suggested_portion_multiplier: 1,
        reason_th: 'ส้มตำ',
        visible_components_th: ['มะละกอ'],
        kcal: 500,
      }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 502
  );

  // Unknown food_id outside enum rejected
  assert.throws(
    () =>
      validateVisionPayload({
        outcome: 'matched',
        food_id: 'pizza_margherita',
        confidence: 0.9,
        suggested_portion_multiplier: 1,
        reason_th: 'พิซซ่า',
        visible_components_th: [],
      }),
    (err) => err instanceof VisionGatewayError && err.code === 'INVALID_MODEL_FOOD_ID'
  );
});

test('analyzeFoodImage handles matched response, refusal, provider error, and missing key', async () => {
  // Missing API key
  await assert.rejects(
    () =>
      analyzeFoodImage({
        base64: VALID_JPEG_BUF.toString('base64'),
        mimeType: 'image/jpeg',
        apiKey: '',
      }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 503 && err.code === 'AI_NOT_CONFIGURED'
  );

  // Mock matched OpenAI Responses API output
  const matchedFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                outcome: 'matched',
                food_id: 'pad_krapow_gai',
                confidence: 0.93,
                suggested_portion_multiplier: 1,
                reason_th: 'เห็นไก่สับผัดใบกะเพรา พริก ข้าวสวย และไข่ดาว',
                visible_components_th: ['ข้าวสวย', 'กะเพราไก่', 'ไข่ดาว'],
              }),
            },
          ],
        },
      ],
    }),
  });

  const matched = await analyzeFoodImage({
    base64: VALID_JPEG_BUF.toString('base64'),
    mimeType: 'image/jpeg',
    apiKey: 'sk-test-key',
    fetchImpl: matchedFetch,
  });

  assert.equal(matched.ok, true);
  assert.equal(matched.mode, 'ai');
  assert.equal(matched.provenance, PROVENANCE.AI_CLASSIFICATION_ONLY);
  assert.equal(matched.result.foodId, 'pad_krapow_gai');
  assert.equal(matched.nutrients, undefined);

  // Mock refusal response
  const refusalFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      output: [{ content: [{ type: 'refusal', refusal: 'Cannot process image' }] }],
    }),
  });

  await assert.rejects(
    () =>
      analyzeFoodImage({
        base64: VALID_JPEG_BUF.toString('base64'),
        mimeType: 'image/jpeg',
        apiKey: 'sk-test-key',
        fetchImpl: refusalFetch,
      }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 422 && err.code === 'MODEL_REFUSAL'
  );

  // Mock upstream 500 error
  const errorFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(
    () =>
      analyzeFoodImage({
        base64: VALID_JPEG_BUF.toString('base64'),
        mimeType: 'image/jpeg',
        apiKey: 'sk-test-key',
        fetchImpl: errorFetch,
      }),
    (err) => err instanceof VisionGatewayError && err.statusCode === 502 && err.code === 'PROVIDER_HTTP_ERROR'
  );
});
