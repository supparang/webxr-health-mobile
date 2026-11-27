import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_OPENAI_MODEL,
  MAX_IMAGE_BYTES,
  VisionGatewayError,
  analyzeFoodImage,
  parseAndValidateImageInput,
} from './vision.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_JSON_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 1.45) + 65536; // Base64 overhead + JSON envelope

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

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function sendJson(res, statusCode, payload) {
  setSecurityHeaders(res);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
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
  // Disallow hidden dotfiles, server source files, tests, and package manifests from static serving
  const segments = relativePath.split('/').filter(Boolean);
  if (
    segments.some((seg) => seg.startsWith('.') || seg === '..') ||
    segments[0] === 'tests' ||
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

export function createScannerServer({
  staticDir = __dirname,
  apiKey = process.env.OPENAI_API_KEY || '',
  model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  analyzeFn = null,
} = {}) {
  const effectiveAnalyze =
    analyzeFn ||
    ((validatedImage) =>
      analyzeFoodImage({
        base64: validatedImage.base64,
        mimeType: validatedImage.mimeType,
        apiKey,
        model,
      }));

  return http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;

    if (pathname === '/api/health') {
      if (method !== 'GET') {
        sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'รองรับเฉพาะเมธอด GET' });
        return;
      }
      sendJson(res, 200, {
        ok: true,
        service: 'ai-nutrition-scanner',
        aiConfigured: Boolean(apiKey || analyzeFn),
        model,
      });
      return;
    }

    if (pathname === '/api/analyze') {
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'รองรับเฉพาะเมธอด POST' });
        return;
      }

      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        sendJson(res, 415, {
          ok: false,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          messageTh: 'คำขอต้องใช้ Content-Type: application/json',
        });
        return;
      }

      try {
        const body = await readJsonBody(req);
        const validatedImage = parseAndValidateImageInput(body);
        const analysis = await effectiveAnalyze(validatedImage);
        sendJson(res, 200, analysis);
      } catch (err) {
        if (err instanceof VisionGatewayError) {
          sendJson(res, err.statusCode, {
            ok: false,
            code: err.code,
            messageTh: err.messageTh,
          });
          return;
        }
        sendJson(res, 500, {
          ok: false,
          code: 'INTERNAL_ERROR',
          messageTh: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ กรุณาลองใหม่ภายหลัง',
        });
      }
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED', messageTh: 'ไม่อนุญาตเมธอดนี้' });
      return;
    }

    const filePath = resolveSafeStaticPath(staticDir, pathname);
    if (!filePath) {
      setSecurityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        setSecurityHeaders(res);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
      const content = await fs.readFile(filePath);
      setSecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': content.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      });
      res.end(method === 'HEAD' ? undefined : content);
    } catch {
      setSecurityHeaders(res);
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
  const server = createScannerServer();
  server.listen(port, host, () => {
    const aiReady = Boolean(process.env.OPENAI_API_KEY);
    console.log(
      `NutriLens TH (ai-nutrition-scanner) listening on http://${host}:${port} (AI Vision: ${
        aiReady ? 'configured' : 'demo-only until OPENAI_API_KEY is set'
      })`
    );
  });
}
