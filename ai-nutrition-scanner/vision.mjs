import {
  ALLOWED_VISION_FOOD_IDS,
  PROVENANCE,
  THAI_FOOD_CATALOG,
  UNKNOWN_DISH_ID,
} from './nutrition.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_OUTCOMES = Object.freeze(['matched', 'uncertain', 'not_food']);

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export const ALLOWED_PORTION_UNCERTAINTIES = Object.freeze(['low', 'medium', 'high']);
export const ALLOWED_HIDDEN_FACTORS = Object.freeze([
  'oil_level',
  'sweetness_level',
  'broth_consumed',
  'egg_style',
  'skin_fat',
  'sauce_amount',
]);

export const VISION_RESPONSE_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'outcome',
    'food_id',
    'confidence',
    'suggested_portion_multiplier',
    'portion_uncertainty',
    'top_candidates',
    'hidden_factors',
    'reason_th',
    'visible_components_th',
  ],
  properties: {
    outcome: {
      type: 'string',
      enum: [...ALLOWED_OUTCOMES],
    },
    food_id: {
      type: 'string',
      enum: [...ALLOWED_VISION_FOOD_IDS],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    suggested_portion_multiplier: {
      type: 'number',
      minimum: 0.25,
      maximum: 4,
    },
    portion_uncertainty: {
      type: 'string',
      enum: [...ALLOWED_PORTION_UNCERTAINTIES],
    },
    top_candidates: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'string',
        enum: [...ALLOWED_VISION_FOOD_IDS],
      },
    },
    hidden_factors: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'string',
        enum: [...ALLOWED_HIDDEN_FACTORS],
      },
    },
    reason_th: {
      type: 'string',
      minLength: 1,
      maxLength: 320,
    },
    visible_components_th: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 60,
      },
    },
  },
});

export class VisionGatewayError extends Error {
  constructor(statusCode, code, messageTh) {
    super(messageTh);
    this.name = 'VisionGatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.messageTh = messageTh;
  }
}

export function detectImageSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function parseAndValidateImageInput(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new VisionGatewayError(400, 'INVALID_PAYLOAD', 'ข้อมูลคำขอไม่ถูกต้อง');
  }

  let declaredMime = '';
  let rawBase64 = '';

  if (typeof payload.imageDataUrl === 'string' && payload.imageDataUrl.trim()) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(
      payload.imageDataUrl.trim()
    );
    if (!match) {
      throw new VisionGatewayError(
        400,
        'INVALID_DATA_URL',
        'รูปแบบภาพ Data URL ไม่ถูกต้อง รองรับเฉพาะ JPEG, PNG หรือ WebP'
      );
    }
    declaredMime = match[1].toLowerCase();
    rawBase64 = match[2].replace(/\s+/g, '');
  } else if (typeof payload.imageBase64 === 'string' && typeof payload.mimeType === 'string') {
    declaredMime = payload.mimeType.trim().toLowerCase();
    rawBase64 = payload.imageBase64.replace(/\s+/g, '');
  } else {
    throw new VisionGatewayError(400, 'MISSING_IMAGE', 'กรุณาแนบรูปภาพอาหารก่อนวิเคราะห์');
  }

  if (declaredMime === 'image/jpg') {
    declaredMime = 'image/jpeg';
  }

  if (!ALLOWED_MIME_TYPES.includes(declaredMime)) {
    throw new VisionGatewayError(
      400,
      'UNSUPPORTED_MIME',
      'รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WebP เท่านั้น'
    );
  }

  if (!rawBase64 || rawBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
    throw new VisionGatewayError(400, 'INVALID_BASE64', 'ข้อมูล Base64 ของรูปภาพไม่ถูกต้อง');
  }

  // Quick size estimate before allocating full buffer
  const estimatedBytes = Math.floor((rawBase64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new VisionGatewayError(
      413,
      'IMAGE_TOO_LARGE',
      'ไฟล์ภาพมีขนาดใหญ่เกิน 5 MB กรุณาย่อขนาดหรือเลือกภาพใหม่'
    );
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (buffer.length === 0) {
    throw new VisionGatewayError(400, 'EMPTY_IMAGE', 'ไฟล์ภาพว่างเปล่า');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new VisionGatewayError(
      413,
      'IMAGE_TOO_LARGE',
      'ไฟล์ภาพมีขนาดใหญ่เกิน 5 MB กรุณาย่อขนาดหรือเลือกภาพใหม่'
    );
  }

  const detectedMime = detectImageSignature(buffer);
  if (!detectedMime) {
    throw new VisionGatewayError(
      400,
      'INVALID_IMAGE_SIGNATURE',
      'ไม่สามารถยืนยันลายเซ็นไฟล์ภาพได้ กรุณาอัปโหลดไฟล์ JPEG, PNG หรือ WebP ที่สมบูรณ์'
    );
  }

  if (detectedMime !== declaredMime) {
    throw new VisionGatewayError(
      400,
      'MIME_SIGNATURE_MISMATCH',
      'ชนิดไฟล์ภาพไม่ตรงกับข้อมูลจริง กรุณาอัปโหลดไฟล์ภาพใหม่'
    );
  }

  return {
    buffer,
    mimeType: detectedMime,
    base64: buffer.toString('base64'),
  };
}

const CORE_REQUIRED_KEYS = Object.freeze([
  'outcome',
  'food_id',
  'confidence',
  'suggested_portion_multiplier',
  'reason_th',
  'visible_components_th',
]);

export function validateVisionPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new VisionGatewayError(
      502,
      'INVALID_MODEL_OUTPUT',
      'ผลลัพธ์จากโมเดล AI ไม่ตรงตามโครงสร้างที่กำหนด'
    );
  }

  const allowedKeys = new Set(VISION_RESPONSE_JSON_SCHEMA.required);
  const rawKeys = Object.keys(raw);
  if (
    CORE_REQUIRED_KEYS.some((k) => !(k in raw)) ||
    rawKeys.some((k) => !allowedKeys.has(k))
  ) {
    throw new VisionGatewayError(
      502,
      'INVALID_MODEL_SCHEMA',
      'ผลลัพธ์จากโมเดล AI มีฟิลด์ไม่ตรงตาม Schema ที่กำหนด'
    );
  }

  if (!ALLOWED_OUTCOMES.includes(raw.outcome)) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_OUTCOME', 'สถานะผลการจำแนกจาก AI ไม่ถูกต้อง');
  }

  if (!ALLOWED_VISION_FOOD_IDS.includes(raw.food_id)) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_FOOD_ID', 'รหัสเมนูอาหารจาก AI ไม่อยู่ในรายการที่รองรับ');
  }

  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_CONFIDENCE', 'ค่าความมั่นใจจาก AI ไม่ถูกต้อง');
  }

  if (
    typeof raw.suggested_portion_multiplier !== 'number' ||
    !Number.isFinite(raw.suggested_portion_multiplier) ||
    raw.suggested_portion_multiplier < 0.25 ||
    raw.suggested_portion_multiplier > 4
  ) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_PORTION', 'ค่าปริมาณแนะนำจาก AI ไม่ถูกต้อง');
  }

  if (typeof raw.reason_th !== 'string' || !raw.reason_th.trim() || raw.reason_th.length > 320) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_REASON', 'คำอธิบายผลวิเคราะห์จาก AI ไม่ถูกต้อง');
  }

  if (
    !Array.isArray(raw.visible_components_th) ||
    raw.visible_components_th.length > 6 ||
    raw.visible_components_th.some((item) => typeof item !== 'string' || !item.trim() || item.length > 60)
  ) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_COMPONENTS', 'รายการส่วนประกอบที่มองเห็นไม่ถูกต้อง');
  }

  const portionUncertainty =
    raw.portion_uncertainty === undefined ? 'medium' : raw.portion_uncertainty;
  if (!ALLOWED_PORTION_UNCERTAINTIES.includes(portionUncertainty)) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_UNCERTAINTY', 'ค่าความไม่แน่นอนของปริมาณไม่ถูกต้อง');
  }

  const topCandidates = raw.top_candidates === undefined ? [] : raw.top_candidates;
  if (
    !Array.isArray(topCandidates) ||
    topCandidates.length > 3 ||
    topCandidates.some((id) => !ALLOWED_VISION_FOOD_IDS.includes(id))
  ) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_CANDIDATES', 'รายการเมนูผู้ท้าชิงจาก AI ไม่ถูกต้อง');
  }

  const hiddenFactors = raw.hidden_factors === undefined ? [] : raw.hidden_factors;
  if (
    !Array.isArray(hiddenFactors) ||
    hiddenFactors.length > 4 ||
    hiddenFactors.some((f) => !ALLOWED_HIDDEN_FACTORS.includes(f))
  ) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_HIDDEN_FACTORS', 'รายการปัจจัยซ่อนเร้นจาก AI ไม่ถูกต้อง');
  }

  let normalizedOutcome = raw.outcome;
  let normalizedFoodId = raw.food_id;

  // Enforce semantic consistency safely
  if (normalizedOutcome === 'not_food') {
    normalizedFoodId = UNKNOWN_DISH_ID;
  } else if (normalizedOutcome === 'matched' && normalizedFoodId === UNKNOWN_DISH_ID) {
    normalizedOutcome = 'uncertain';
  } else if (normalizedOutcome === 'matched' && raw.confidence < 0.45) {
    normalizedOutcome = 'uncertain';
  }

  return {
    outcome: normalizedOutcome,
    foodId: normalizedFoodId,
    confidence: Math.round(raw.confidence * 100) / 100,
    suggestedPortionMultiplier: Math.round(raw.suggested_portion_multiplier * 100) / 100,
    portionUncertainty,
    topCandidates,
    hiddenFactors,
    reasonTh: raw.reason_th.trim(),
    visibleComponentsTh: raw.visible_components_th.map((s) => s.trim()),
  };
}

function buildCatalogPromptList() {
  return THAI_FOOD_CATALOG.map((item) => `- ${item.id}: ${item.nameTh} (${item.nameEn})`).join('\n');
}

function extractResponseContent(providerJson) {
  if (!providerJson || typeof providerJson !== 'object') {
    throw new VisionGatewayError(502, 'PROVIDER_EMPTY_RESPONSE', 'ไม่ได้รับข้อมูลตอบกลับจากผู้ให้บริการ AI');
  }

  if (providerJson.error) {
    throw new VisionGatewayError(502, 'PROVIDER_ERROR', 'ผู้ให้บริการ AI ส่งข้อผิดพลาดกลับมา กรุณาลองใหม่ภายหลัง');
  }

  // Check OpenAI Responses API output array for refusals or text output
  if (Array.isArray(providerJson.output)) {
    for (const item of providerJson.output) {
      if (item && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === 'refusal') {
            throw new VisionGatewayError(
              422,
              'MODEL_REFUSAL',
              'โมเดล AI ปฏิเสธการวิเคราะห์ภาพนี้ กรุณาเลือกภาพอาหารที่ชัดเจน'
            );
          }
          if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
            return part.text;
          }
        }
      }
    }
  }

  if (typeof providerJson.output_text === 'string' && providerJson.output_text.trim()) {
    return providerJson.output_text;
  }

  throw new VisionGatewayError(
    502,
    'INVALID_MODEL_OUTPUT',
    'ไม่พบข้อมูล JSON ที่อ่านได้จากคำตอบของโมเดล AI'
  );
}

export async function analyzeFoodImage({
  base64,
  mimeType,
  apiKey = process.env.OPENAI_API_KEY || '',
  model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  endpoint = process.env.OPENAI_RESPONSES_URL || DEFAULT_OPENAI_ENDPOINT,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20000,
} = {}) {
  if (!apiKey) {
    throw new VisionGatewayError(
      503,
      'AI_NOT_CONFIGURED',
      'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OPENAI_API_KEY กรุณาใช้โหมดทดลอง (Demo) หรือกำหนดคีย์ฝั่งเซิร์ฟเวอร์'
    );
  }

  if (typeof fetchImpl !== 'function') {
    throw new VisionGatewayError(500, 'FETCH_UNAVAILABLE', 'ไม่พบฟังก์ชัน fetch ในสภาพแวดล้อมเซิร์ฟเวอร์');
  }

  const instructions = [
    'You are a careful Thai food image classifier for a nutrition literacy prototype.',
    'Classify ONLY into one of the allowed food_id values below, or "unknown" if the dish is not in the list, ambiguous, or not food.',
    'Rules:',
    '1. If the image is NOT food/drink, set outcome="not_food", food_id="unknown".',
    '2. If the image is food but not clearly one of the listed dishes or low visibility, set outcome="uncertain" and food_id="unknown" (or closest candidate if partially visible with low confidence).',
    '3. If clearly one of the listed dishes, set outcome="matched" and the matching food_id.',
    '4. Do NOT output calorie or nutrient numbers in reason_th. Keep reason_th concise in polite Thai.',
    'Allowed food_id catalog:',
    buildCatalogPromptList(),
    '- unknown: เมนูอื่นที่ไม่อยู่ในรายการ / ไม่แน่ใจ / ไม่ใช่อาหาร',
  ].join('\n');

  const requestBody = {
    model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: instructions },
          {
            type: 'input_image',
            image_url: `data:${mimeType};base64,${base64}`,
            detail: 'auto',
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'thai_food_scan',
        strict: true,
        schema: VISION_RESPONSE_JSON_SCHEMA,
      },
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new VisionGatewayError(
        504,
        'PROVIDER_TIMEOUT',
        'การเชื่อมต่อโมเดล AI ใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง'
      );
    }
    throw new VisionGatewayError(
      502,
      'PROVIDER_NETWORK_ERROR',
      'ไม่สามารถเชื่อมต่อผู้ให้บริการ AI ได้ในขณะนี้'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new VisionGatewayError(
      502,
      'PROVIDER_HTTP_ERROR',
      `ผู้ให้บริการ AI ตอบกลับผิดพลาด (HTTP ${response.status})`
    );
  }

  let providerJson;
  try {
    providerJson = await response.json();
  } catch {
    throw new VisionGatewayError(
      502,
      'PROVIDER_INVALID_JSON',
      'ผู้ให้บริการ AI ตอบกลับไม่ใช่รูปแบบ JSON ที่ถูกต้อง'
    );
  }

  const rawText = extractResponseContent(providerJson);

  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawText);
  } catch {
    throw new VisionGatewayError(
      502,
      'INVALID_MODEL_JSON',
      'ข้อความ JSON ที่โมเดล AI ส่งกลับมาไม่สามารถแปลงได้'
    );
  }

  const validated = validateVisionPayload(parsedOutput);

  return {
    ok: true,
    mode: 'ai',
    provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
    result: validated,
    disclaimerTh:
      'โหมด AI Vision แสดงเฉพาะผลจำแนกเมนูเพื่อให้ผู้ใช้ตรวจสอบและยืนยัน โดยไม่แสดงค่าพลังงานหรือสารอาหารจำลองจนกว่าจะเชื่อมต่อฐานข้อมูลโภชนาการไทยที่ผ่านการตรวจสอบ',
  };
}
