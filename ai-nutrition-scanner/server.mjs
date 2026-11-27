import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  MAX_IMAGE_BYTES,
  VisionGatewayError,
  analyzeFoodImage,
  parseAndValidateImageInput,
  resolveProviderConfig,
} from './vision.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_JSON_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 1.45) + 65536;

const STATIC_MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
});

function constantTimeEquals(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createRateLimiter(maxPerMinute = 15) {
  const buckets = new Map();
  const windowMs = 60_000;

  return function checkLimit(ip) {
    if (!maxPerMinute || maxPerMinute <= 0) return { allowed: true, retryAfterSec: 0 };
    const now = Date.now();
    const key = String(ip || 'unknown');
    const timestamps = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);

    if (timestamps.length >= maxPerMinute) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      buckets.set(key, timestamps);
      return { allowed: false, retryAfterSec };
    }

    timestamps.push(now);
    buckets.set(key, timestamps);
    return { allowed: true, retryAfterSec: 0 };
  };
}

function setSecurityAndCorsHeaders(req, res, allowedOrigins) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  const origin = req.headers.origin;
  if (!origin) return;

  if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Study-Code');
}

function sendJson(req, res, statusCode, payload, allowedOrigins, extraHeaders = {}) {
  setSecurityAndCorsHeaders(req, res, allowedOrigins);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        aborted = true;
        reject(
          new VisionGatewayError(
            413,
            'PAYLOAD_TOO_LARGE',
            'ขนาดคำขอเกินขีดจำกัด (สูงสุด 5 MB ต่อภาพ)'
          )
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) {
        reject(new VisionGatewayError(400, 'EMPTY_BODY', 'ไม่พบข้อมูล JSON ในคำขอ'));
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new VisionGatewayError(400, 'INVALID_JSON', 'รูปแบบ JSON ในคำขอไม่ถูกต้อง'));
      }
    });

    req.on('error', () => {
      if (!aborted) {
        reject(new VisionGatewayError(400, 'REQUEST_READ_ERROR', 'เกิดข้อผิดพลาดขณะอ่านข้อมูลคำขอ'));
      }
    });
  });
}

function resolveSafeStaticPath(rootDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decoded.includes('\0')) return null;

  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const segments = relativePath.split('/').filter(Boolean);
  if (
    segments.some((seg) => seg.startsWith('.') || seg === '..') ||
    segments[0] === 'tests' ||
    segments[0] === 'worker' ||
    relativePath.endsWith('.mjs') ||
    relativePath === 'package.json'
  ) {
    return null;
  }

  const resolvedRoot = path.resolve(rootDir);
  const fullPath = path.resolve(resolvedRoot, relativePath);
  if (fullPath !== resolvedRoot && !fullPath.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return fullPath;
}

function parseAllowedOrigins(raw) {
  if (!raw || raw === '*') return '*';
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createScannerServer({
  staticDir = __dirname,
  provider = process.env.AI_PROVIDER || '',
  apiKey = '',
  geminiApiKey = process.env.GEMINI_API_KEY || '',
  openaiApiKey = process.env.OPENAI_API_KEY || '',
  model = '',
  studyAccessCode = process.env.STUDY_ACCESS_CODE || '',
  rateLimitPerMin = Number(process.env.RATE_LIMIT_MAX_PER_MIN ?? 15),
  allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS || '*'),
  analyzeFn = null,
} = {}) {
  const providerCfg = resolveProviderConfig({
    AI_PROVIDER: provider,
    GEMINI_API_KEY: geminiApiKey,
    OPENAI_API_KEY: apiKey || openaiApiKey,
    GEMINI_MODEL: model || process.env.GEMINI_MODEL || '',
    OPENAI_MODEL: model || process.env.OPENAI_MODEL || '',
  });

  const checkRateLimit = createRateLimiter(rateLimitPerMin);

  const effectiveAnalyze =
    analyzeFn ||
    ((validatedImage) =>
      analyzeFoodImage({
        base64: validatedImage.base64,
        mimeType: validatedImage.mimeType,
        provider: providerCfg.provider,
        apiKey: providerCfg.apiKey,
        model: providerCfg.model,
      }));

  return http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;

    if (method === 'OPTIONS' && pathname.startsWith('/api/')) {
      setSecurityAndCorsHeaders(req, res, allowedOrigins);
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/health') {
      if (method !== 'GET') {
        sendJson(
          req,
          res,
          405,
          { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'รองรับเฉพาะเมธอด GET' },
          allowedOrigins
        );
        return;
      }
      sendJson(
        req,
        res,
        200,
        {
          ok: true,
          service: 'ai-nutrition-scanner',
          aiConfigured: Boolean(providerCfg.configured || analyzeFn),
          provider: analyzeFn ? providerCfg.provider : providerCfg.provider,
          model: providerCfg.model,
          openVocabulary: true,
          accessCodeRequired: Boolean(studyAccessCode),
        },
        allowedOrigins
      );
      return;
    }

    if (pathname === '/api/analyze') {
      if (method !== 'POST') {
        sendJson(
          req,
          res,
          405,
          { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'รองรับเฉพาะเมธอด POST' },
          allowedOrigins
        );
        return;
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        sendJson(
          req,
          res,
          415,
          {
            ok: false,
            code: 'UNSUPPORTED_MEDIA_TYPE',
            messageTh: 'คำขอต้องใช้ Content-Type: application/json',
          },
          allowedOrigins
        );
        return;
      }

      // Per-IP Rate Limit guard
      const clientIp =
        String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'local';
      const limit = checkRateLimit(clientIp);
      if (!limit.allowed) {
        sendJson(
          req,
          res,
          429,
          {
            ok: false,
            code: 'RATE_LIMITED',
            messageTh: `สแกนถี่เกินกำหนด กรุณารอ ${limit.retryAfterSec} วินาทีแล้วลองใหม่`,
          },
          allowedOrigins,
          { 'Retry-After': String(limit.retryAfterSec) }
        );
        return;
      }

      try {
        const body = await readJsonBody(req);

        // Optional Study Access Code gate (replaces per-user login for study cohorts)
        if (studyAccessCode) {
          const providedCode = String(req.headers['x-study-code'] || body?.accessCode || '').trim();
          if (!providedCode) {
            throw new VisionGatewayError(
              401,
              'ACCESS_CODE_REQUIRED',
              'กรุณากรอกรหัสรอบทดลอง (Study Access Code) ก่อนใช้งาน AI Vision'
            );
          }
          if (!constantTimeEquals(providedCode, studyAccessCode)) {
            throw new VisionGatewayError(
              401,
              'INVALID_ACCESS_CODE',
              'รหัสรอบทดลอง (Study Access Code) ไม่ถูกต้อง กรุณาตรวจสอบกับผู้วิจัย'
            );
          }
        }

        const validatedImage = parseAndValidateImageInput(body);
        const analysis = await effectiveAnalyze(validatedImage);
        sendJson(req, res, 200, analysis, allowedOrigins);
      } catch (err) {
        if (err instanceof VisionGatewayError) {
          sendJson(
            req,
            res,
            err.statusCode,
            {
              ok: false,
              code: err.code,
              messageTh: err.messageTh,
            },
            allowedOrigins
          );
          return;
        }
        sendJson(
          req,
          res,
          500,
          {
            ok: false,
            code: 'INTERNAL_ERROR',
            messageTh: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ กรุณาลองใหม่ภายหลัง',
          },
          allowedOrigins
        );
      }
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(
        req,
        res,
        405,
        { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'ไม่อนุญาตเมธอดนี้' },
        allowedOrigins
      );
      return;
    }

    const filePath = resolveSafeStaticPath(staticDir, pathname);
    if (!filePath) {
      setSecurityAndCorsHeaders(req, res, allowedOrigins);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        setSecurityAndCorsHeaders(req, res, allowedOrigins);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
      const content = await fs.readFile(filePath);
      setSecurityAndCorsHeaders(req, res, allowedOrigins);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': content.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      res.end(method === 'HEAD' ? undefined : content);
    } catch {
      setSecurityAndCorsHeaders(req, res, allowedOrigins);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const cfg = resolveProviderConfig(process.env);
  const server = createScannerServer();
  server.listen(port, host, () => {
    console.log(
      `NutriLens TH (ai-nutrition-scanner) listening on http://${host}:${port} (AI: ${
        cfg.configured ? `${cfg.provider}/${cfg.model}` : 'demo-only until GEMINI_API_KEY or OPENAI_API_KEY is set'
      }, StudyCode: ${process.env.STUDY_ACCESS_CODE ? 'enabled' : 'open'})`
    );
  });
}
