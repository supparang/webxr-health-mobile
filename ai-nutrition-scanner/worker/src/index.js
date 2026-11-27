import {
  MAX_IMAGE_BYTES,
  VisionGatewayError,
  analyzeFoodImage,
  parseAndValidateImageInput,
  resolveProviderConfig,
} from '../../vision.mjs';

const MAX_JSON_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 1.45) + 65536;
const rateBuckets = new Map();

function constantTimeEquals(a, b) {
  const strA = String(a || '');
  const strB = String(b || '');
  if (strA.length !== strB.length) return false;
  let diff = 0;
  for (let i = 0; i < strA.length; i += 1) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function buildCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedRaw = String(env.ALLOWED_ORIGINS || '*').trim();
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Study-Code',
  };

  if (allowedRaw === '*') {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin) {
    const list = allowedRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers.Vary = 'Origin';
    }
  }
  return headers;
}

function jsonResponse(request, env, status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...buildCorsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

function checkRateLimit(ip, maxPerMin) {
  if (!maxPerMin || maxPerMin <= 0) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();
  const windowMs = 60_000;
  const key = String(ip || 'unknown');
  const recent = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);

  if (recent.length >= maxPerMin) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
    rateBuckets.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  rateBuckets.set(key, recent);
  return { allowed: true, retryAfterSec: 0 };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
    }

    const providerCfg = resolveProviderConfig(env || {});
    const studyCode = String(env?.STUDY_ACCESS_CODE || '').trim();

    if (pathname === '/api/health' || pathname === '/') {
      if (method !== 'GET') {
        return jsonResponse(request, env, 405, {
          ok: false,
          code: 'METHOD_NOT_ALLOWED',
          messageTh: 'รองรับเฉพาะเมธอด GET',
        });
      }
      return jsonResponse(request, env, 200, {
        ok: true,
        service: 'ai-nutrition-scanner-worker',
        aiConfigured: providerCfg.configured,
        provider: providerCfg.provider,
        model: providerCfg.model,
        openVocabulary: true,
        accessCodeRequired: Boolean(studyCode),
      });
    }

    if (pathname === '/api/analyze') {
      if (method !== 'POST') {
        return jsonResponse(request, env, 405, {
          ok: false,
          code: 'METHOD_NOT_ALLOWED',
          messageTh: 'รองรับเฉพาะเมธอด POST',
        });
      }

      const contentType = String(request.headers.get('Content-Type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        return jsonResponse(request, env, 415, {
          ok: false,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          messageTh: 'คำขอต้องใช้ Content-Type: application/json',
        });
      }

      const maxPerMin = Number(env?.RATE_LIMIT_MAX_PER_MIN ?? 15);
      const clientIp =
        request.headers.get('CF-Connecting-IP') ||
        String(request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
        'client';
      const limit = checkRateLimit(clientIp, maxPerMin);
      if (!limit.allowed) {
        return jsonResponse(
          request,
          env,
          429,
          {
            ok: false,
            code: 'RATE_LIMITED',
            messageTh: `สแกนถี่เกินกำหนด กรุณารอ ${limit.retryAfterSec} วินาทีแล้วลองใหม่`,
          },
          { 'Retry-After': String(limit.retryAfterSec) }
        );
      }

      const contentLen = Number(request.headers.get('Content-Length') || 0);
      if (contentLen > MAX_JSON_BODY_BYTES) {
        return jsonResponse(request, env, 413, {
          ok: false,
          code: 'PAYLOAD_TOO_LARGE',
          messageTh: 'ขนาดคำขอเกินขีดจำกัด (สูงสุด 5 MB ต่อภาพ)',
        });
      }

      try {
        const rawText = await request.text();
        if (rawText.length > MAX_JSON_BODY_BYTES) {
          throw new VisionGatewayError(
            413,
            'PAYLOAD_TOO_LARGE',
            'ขนาดคำขอเกินขีดจำกัด (สูงสุด 5 MB ต่อภาพ)'
          );
        }

        let body;
        try {
          body = JSON.parse(rawText);
        } catch {
          throw new VisionGatewayError(400, 'INVALID_JSON', 'รูปแบบ JSON ในคำขอไม่ถูกต้อง');
        }

        if (studyCode) {
          const provided = String(
            request.headers.get('X-Study-Code') || body?.accessCode || ''
          ).trim();
          if (!provided) {
            throw new VisionGatewayError(
              401,
              'ACCESS_CODE_REQUIRED',
              'กรุณากรอกรหัสรอบทดลอง (Study Access Code) ก่อนใช้งาน AI Vision'
            );
          }
          if (!constantTimeEquals(provided, studyCode)) {
            throw new VisionGatewayError(
              401,
              'INVALID_ACCESS_CODE',
              'รหัสรอบทดลอง (Study Access Code) ไม่ถูกต้อง กรุณาตรวจสอบกับผู้วิจัย'
            );
          }
        }

        const validatedImage = parseAndValidateImageInput(body);
        const analysis = await analyzeFoodImage({
          base64: validatedImage.base64,
          mimeType: validatedImage.mimeType,
          provider: providerCfg.provider,
          apiKey: providerCfg.apiKey,
          model: providerCfg.model,
        });

        return jsonResponse(request, env, 200, analysis);
      } catch (err) {
        if (err instanceof VisionGatewayError) {
          return jsonResponse(request, env, err.statusCode, {
            ok: false,
            code: err.code,
            messageTh: err.messageTh,
          });
        }
        return jsonResponse(request, env, 500, {
          ok: false,
          code: 'INTERNAL_ERROR',
          messageTh: 'เกิดข้อผิดพลาดภายใน Worker กรุณาลองใหม่ภายหลัง',
        });
      }
    }

    return jsonResponse(request, env, 404, {
      ok: false,
      code: 'NOT_FOUND',
      messageTh: 'ไม่พบเส้นทาง API ที่ร้องขอ',
    });
  },
};
