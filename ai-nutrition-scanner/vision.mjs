import {
  ALLOWED_VISION_FOOD_IDS,
  PROVENANCE,
  THAI_FOOD_CATALOG,
  UNKNOWN_DISH_ID,
} from './nutrition.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_OUTCOMES = Object.freeze(['matched', 'uncertain', 'not_food']);
export const ALLOWED_PORTION_UNCERTAINTIES = Object.freeze(['low', 'medium', 'high']);
export const ALLOWED_HIDDEN_FACTORS = Object.freeze([
  'oil_level',
  'sweetness_level',
  'broth_consumed',
  'egg_style',
  'skin_fat',
  'sauce_amount',
]);

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export const VISION_RESPONSE_JSON_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'outcome',
    'food_id',
    'detected_name_th',
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
    detected_name_th: {
      type: 'string',
      maxLength: 100,
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

// Gemini responseSchema uses standard OpenAPI 3.0 subset (no additionalProperties)
export const GEMINI_RESPONSE_SCHEMA = Object.freeze({
  type: 'OBJECT',
  required: [
    'outcome',
    'food_id',
    'detected_name_th',
    'confidence',
    'suggested_portion_multiplier',
    'portion_uncertainty',
    'top_candidates',
    'hidden_factors',
    'reason_th',
    'visible_components_th',
  ],
  properties: {
    outcome: { type: 'STRING', enum: [...ALLOWED_OUTCOMES] },
    food_id: { type: 'STRING', enum: [...ALLOWED_VISION_FOOD_IDS] },
    detected_name_th: { type: 'STRING' },
    confidence: { type: 'NUMBER' },
    suggested_portion_multiplier: { type: 'NUMBER' },
    portion_uncertainty: { type: 'STRING', enum: [...ALLOWED_PORTION_UNCERTAINTIES] },
    top_candidates: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: [...ALLOWED_VISION_FOOD_IDS] },
    },
    hidden_factors: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: [...ALLOWED_HIDDEN_FACTORS] },
    },
    reason_th: { type: 'STRING' },
    visible_components_th: {
      type: 'ARRAY',
      items: { type: 'STRING' },
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

function decodeBase64ToBytes(rawBase64) {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(rawBase64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Verifies real image magic bytes (JPEG, PNG, WebP).
 * Accepts Uint8Array or Node Buffer (portable across Node.js & Cloudflare Workers).
 */
export function detectImageSignature(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
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

  const estimatedBytes = Math.floor((rawBase64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new VisionGatewayError(
      413,
      'IMAGE_TOO_LARGE',
      'ไฟล์ภาพมีขนาดใหญ่เกิน 5 MB กรุณาย่อขนาดหรือเลือกภาพใหม่'
    );
  }

  const bytes = decodeBase64ToBytes(rawBase64);
  if (bytes.length === 0) {
    throw new VisionGatewayError(400, 'EMPTY_IMAGE', 'ไฟล์ภาพว่างเปล่า');
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new VisionGatewayError(
      413,
      'IMAGE_TOO_LARGE',
      'ไฟล์ภาพมีขนาดใหญ่เกิน 5 MB กรุณาย่อขนาดหรือเลือกภาพใหม่'
    );
  }

  const detectedMime = detectImageSignature(bytes);
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
    buffer: bytes,
    mimeType: detectedMime,
    base64: encodeBytesToBase64(bytes),
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

  const detectedNameTh =
    raw.detected_name_th === undefined ? '' : String(raw.detected_name_th).trim().slice(0, 100);
  if (raw.detected_name_th !== undefined && typeof raw.detected_name_th !== 'string') {
    throw new VisionGatewayError(502, 'INVALID_MODEL_NAME', 'ชื่อเมนูภาษาไทยจาก AI ไม่ถูกต้อง');
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
  let normalizedDetectedName = detectedNameTh;

  // Enforce semantic consistency while supporting Open-Vocabulary dish recognition!
  if (normalizedOutcome === 'not_food') {
    normalizedFoodId = UNKNOWN_DISH_ID;
    normalizedDetectedName = '';
  } else if (normalizedOutcome === 'matched' && normalizedFoodId === UNKNOWN_DISH_ID && !normalizedDetectedName) {
    // Unknown catalog ID with no open-vocabulary dish name -> downgrade to uncertain
    normalizedOutcome = 'uncertain';
  } else if (normalizedOutcome === 'matched' && raw.confidence < 0.45) {
    normalizedOutcome = 'uncertain';
  }

  return {
    outcome: normalizedOutcome,
    foodId: normalizedFoodId,
    detectedNameTh: normalizedDetectedName,
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

function buildVisionInstructions() {
  return [
    'You are an accurate food and beverage image classifier for a Thai nutrition literacy app (NutriLens TH).',
    'You support ANY food or drink (Thai, Asian, Western, desserts, snacks, beverages).',
    'Rules:',
    '1. If the image is NOT food/drink, set outcome="not_food", food_id="unknown", detected_name_th="".',
    '2. If the dish clearly matches one of the catalog food_id values below, set outcome="matched", food_id="<matching_id>", and detected_name_th="<Thai dish name>".',
    '3. If the image IS food/drink that is NOT in the catalog list (e.g. ข้าวหมูแดง, ซูชิ, พิซซ่า, สลัดอกไก่, ราเมง, กาแฟเย็น), set outcome="matched" (or "uncertain" if blurry/ambiguous), food_id="unknown", and write its accurate concise Thai name in detected_name_th!',
    '4. Identify up to 4 visually hidden nutrition factors in hidden_factors from: oil_level, sweetness_level, broth_consumed, egg_style, skin_fat, sauce_amount.',
    '5. Estimate portion_uncertainty ("low", "medium", or "high") and list up to 6 visible_components_th in Thai.',
    '6. Do NOT invent or state calorie or nutrient numbers in reason_th. Keep reason_th concise in polite Thai.',
    'Catalog food_id list:',
    buildCatalogPromptList(),
    '- unknown: เมนูอื่นนอกคลัง 20 เมนู (ให้ระบุชื่ออาหารภาษาไทยใน detected_name_th)',
  ].join('\n');
}

export function resolveProviderConfig(env = {}) {
  const explicit = String(env.AI_PROVIDER || '').trim().toLowerCase();
  const geminiKey = String(env.GEMINI_API_KEY || '').trim();
  const openaiKey = String(env.OPENAI_API_KEY || '').trim();

  if (explicit === 'gemini' || (!explicit && geminiKey)) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model: String(env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
      configured: Boolean(geminiKey),
    };
  }

  if (explicit === 'openai' || (!explicit && openaiKey)) {
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: String(env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim(),
      configured: Boolean(openaiKey),
    };
  }

  return {
    provider: 'gemini',
    apiKey: '',
    model: String(env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
    configured: false,
  };
}

function extractOpenAiContent(providerJson) {
  if (!providerJson || typeof providerJson !== 'object') {
    throw new VisionGatewayError(502, 'PROVIDER_EMPTY_RESPONSE', 'ไม่ได้รับข้อมูลตอบกลับจากผู้ให้บริการ AI');
  }
  if (providerJson.error) {
    throw new VisionGatewayError(502, 'PROVIDER_ERROR', 'ผู้ให้บริการ AI ส่งข้อผิดพลาดกลับมา กรุณาลองใหม่ภายหลัง');
  }

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

function extractGeminiContent(providerJson) {
  if (!providerJson || typeof providerJson !== 'object') {
    throw new VisionGatewayError(502, 'PROVIDER_EMPTY_RESPONSE', 'ไม่ได้รับข้อมูลตอบกลับจาก Gemini AI');
  }
  if (providerJson.error) {
    throw new VisionGatewayError(502, 'PROVIDER_ERROR', 'Gemini AI ส่งข้อผิดพลาดกลับมา กรุณาลองใหม่ภายหลัง');
  }

  const blockReason = providerJson.promptFeedback?.blockReason;
  if (blockReason) {
    throw new VisionGatewayError(
      422,
      'MODEL_REFUSAL',
      'Gemini AI ปฏิเสธการวิเคราะห์ภาพนี้ กรุณาเลือกภาพอาหารที่ชัดเจน'
    );
  }

  const candidate = Array.isArray(providerJson.candidates) ? providerJson.candidates[0] : null;
  if (!candidate) {
    throw new VisionGatewayError(502, 'INVALID_MODEL_OUTPUT', 'ไม่พบผลลัพธ์จาก Gemini AI');
  }

  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
    throw new VisionGatewayError(
      422,
      'MODEL_REFUSAL',
      'Gemini AI ปฏิเสธการวิเคราะห์ภาพนี้ตามนโยบายความปลอดภัย'
    );
  }

  const parts = candidate.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  throw new VisionGatewayError(502, 'INVALID_MODEL_OUTPUT', 'ไม่พบข้อความ JSON จากคำตอบของ Gemini AI');
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
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
}

export async function analyzeFoodWithGemini({
  base64,
  mimeType,
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 25000,
} = {}) {
  if (!apiKey) {
    throw new VisionGatewayError(
      503,
      'AI_NOT_CONFIGURED',
      'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตั้งค่าฝั่งเซิร์ฟเวอร์หรือใช้โหมดทดลอง (Demo)'
    );
  }

  if (typeof fetchImpl !== 'function') {
    throw new VisionGatewayError(500, 'FETCH_UNAVAILABLE', 'ไม่พบฟังก์ชัน fetch ในสภาพแวดล้อมเซิร์ฟเวอร์');
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(model)}:generateContent`;
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: buildVisionInstructions() },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  };

  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new VisionGatewayError(
      502,
      'PROVIDER_HTTP_ERROR',
      `Gemini AI ตอบกลับผิดพลาด (HTTP ${response.status})`
    );
  }

  let providerJson;
  try {
    providerJson = await response.json();
  } catch {
    throw new VisionGatewayError(
      502,
      'PROVIDER_INVALID_JSON',
      'Gemini AI ตอบกลับไม่ใช่รูปแบบ JSON ที่ถูกต้อง'
    );
  }

  const rawText = extractGeminiContent(providerJson);

  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawText);
  } catch {
    throw new VisionGatewayError(
      502,
      'INVALID_MODEL_JSON',
      'ข้อความ JSON ที่ Gemini AI ส่งกลับมาไม่สามารถแปลงได้'
    );
  }

  const validated = validateVisionPayload(parsedOutput);

  return {
    ok: true,
    mode: 'ai',
    provider: 'gemini',
    model,
    provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
    result: validated,
    disclaimerTh:
      'Gemini Vision AI รองรับการจำแนกชื่ออาหารทุกชนิดเพื่อให้ผู้ใช้ตรวจสอบและยืนยัน โดยไม่แสดงค่าพลังงานหรือสารอาหารจำลองจนกว่าจะเชื่อมต่อฐานข้อมูลโภชนาการที่ผ่านการตรวจสอบ',
  };
}

export async function analyzeFoodImage({
  base64,
  mimeType,
  provider = '',
  apiKey = '',
  geminiApiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || '' : '',
  openaiApiKey = typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY || '' : '',
  model = '',
  endpoint = typeof process !== 'undefined' ? process.env?.OPENAI_RESPONSES_URL || DEFAULT_OPENAI_ENDPOINT : DEFAULT_OPENAI_ENDPOINT,
  geminiBaseUrl = typeof process !== 'undefined' ? process.env?.GEMINI_API_BASE_URL || DEFAULT_GEMINI_BASE_URL : DEFAULT_GEMINI_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 25000,
} = {}) {
  const chosenProvider = String(
    provider ||
      (apiKey ? 'openai' : '') ||
      (typeof process !== 'undefined' ? process.env?.AI_PROVIDER || '' : '') ||
      (geminiApiKey ? 'gemini' : openaiApiKey ? 'openai' : 'openai')
  )
    .trim()
    .toLowerCase();

  if (chosenProvider === 'gemini') {
    const effectiveKey = apiKey || geminiApiKey;
    const effectiveModel =
      model || (typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : '') || DEFAULT_GEMINI_MODEL;
    return analyzeFoodWithGemini({
      base64,
      mimeType,
      apiKey: effectiveKey,
      model: effectiveModel,
      baseUrl: geminiBaseUrl,
      fetchImpl,
      timeoutMs,
    });
  }

  // OpenAI Responses API path
  const effectiveOpenAiKey = apiKey || openaiApiKey;
  const effectiveOpenAiModel =
    model || (typeof process !== 'undefined' ? process.env?.OPENAI_MODEL : '') || DEFAULT_OPENAI_MODEL;

  if (!effectiveOpenAiKey) {
    throw new VisionGatewayError(
      503,
      'AI_NOT_CONFIGURED',
      'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือ OPENAI_API_KEY กรุณาใช้โหมดทดลอง (Demo) หรือกำหนดคีย์ฝั่งเซิร์ฟเวอร์'
    );
  }

  if (typeof fetchImpl !== 'function') {
    throw new VisionGatewayError(500, 'FETCH_UNAVAILABLE', 'ไม่พบฟังก์ชัน fetch ในสภาพแวดล้อมเซิร์ฟเวอร์');
  }

  const requestBody = {
    model: effectiveOpenAiModel,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: buildVisionInstructions() },
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

  const response = await fetchWithTimeout(
    fetchImpl,
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveOpenAiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
    timeoutMs
  );

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

  const rawText = extractOpenAiContent(providerJson);

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
    provider: 'openai',
    model: effectiveOpenAiModel,
    provenance: PROVENANCE.AI_CLASSIFICATION_ONLY,
    result: validated,
    disclaimerTh:
      'โหมด AI Vision แสดงเฉพาะผลจำแนกเมนูเพื่อให้ผู้ใช้ตรวจสอบและยืนยัน โดยไม่แสดงค่าพลังงานหรือสารอาหารจำลองจนกว่าจะเชื่อมต่อฐานข้อมูลโภชนาการไทยที่ผ่านการตรวจสอบ',
  };
}
