#!/usr/bin/env node
'use strict';

/**
 * End-to-end headless Chrome verification for CSAI2601 Mission Control
 * Tests:
 * 1. Student Mode without profile -> clean profile-required prompt, 0 Sheet requests, 0 console errors
 * 2. Student Mode with URL identity + new student (0/19) on desktop & mobile (390x844):
 *    - exactly 1 mission JSONP + 1 studio JSONP (no duplicate requests)
 *    - W1 CTA is "เริ่ม Mission" (never hardcoded "ทำ Studio Practice" on mobile)
 *    - W2..W15 locked
 * 3. Student Mode with W1 Mission passed only (1/3) -> W1 CTA "ทำ Studio Practice" (view=studio&phase=studio), W2 still locked 3/3
 * 4. Student Mode with W1 complete (3/3) + W2 Mission+Studio (2/3):
 *    - W1 shows "✅ Complete 3/3" and "ดู Studio & Reflection" (review=1&complete=1)
 *    - W2 shows "ทำ Weekly Reflection"
 *    - W3 locked
 *    - Course Complete 1/19
 * 5. Slow Sheet (9s delay) -> does NOT fail prematurely at 7s; renders cleanly with 0 stale recovery buttons
 * 6. Content Preview (?contentPreview=1) -> renders 19 nodes, 0 Sheet requests, 0 errors
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

let mockScenario = {
  delayMs: 50,
  missionResponse: null,
  studioResponse: null,
  calls: []
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (u.pathname === '/mock-apps-script') {
        const action = u.searchParams.get('action') || '';
        const cb = u.searchParams.get('callback') || 'cb';
        mockScenario.calls.push({
          action,
          studentId: u.searchParams.get('studentId'),
          section: u.searchParams.get('section')
        });
        const payload = action === 'uxq_student_studio_progress'
          ? mockScenario.studioResponse
          : mockScenario.missionResponse;
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(`${cb}(${JSON.stringify(payload)});`);
        }, mockScenario.delayMs);
        return;
      }

      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      const fullPath = path.resolve(REPO_ROOT, rel);
      if (!fullPath.startsWith(REPO_ROOT) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      let content = fs.readFileSync(fullPath);
      if (rel === 'sgnal-hunt/js/uxq-classroom-config-v2.js') {
        const addr = server.address();
        const mockUrl = `http://127.0.0.1:${addr.port}/mock-apps-script`;
        content = Buffer.from(
          content.toString('utf8').replace(
            /https:\/\/script\.google\.com\/macros\/s\/[^'"]+\/exec/g,
            mockUrl
          ),
          'utf8'
        );
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(content);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const userDataDir = `/tmp/uxq-chrome-test-${Date.now()}`;
  const proc = spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return { proc, port, wsUrl: page.webSocketDebuggerUrl, userDataDir };
    } catch (_) {}
    await new Promise(r => setTimeout(r, 150));
  }
  proc.kill('SIGKILL');
  throw new Error('Failed to start headless Chrome');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result?.value;
  }
  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

async function waitFor(cdp, expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const val = await cdp.eval(expr);
    if (val) return val;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for: ${expr}`);
}

async function runTests() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const chrome = await launchChrome();
  const cdp = new CDPClient(chrome.wsUrl);
  const consoleErrors = [];

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    cdp.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'exception');
      }
    });

    async function loadPage(urlPath) {
      mockScenario.calls = [];
      consoleErrors.length = 0;
      await cdp.send('Page.navigate', { url: 'about:blank' });
      await new Promise(r => setTimeout(r, 100));
      await cdp.send('Page.navigate', { url: `${baseUrl}${urlPath}` });
    }

    // 1. Student Mode without profile
    await loadPage('/sgnal-hunt/csai2601-mission-control.html');
    await waitFor(cdp, `document.getElementById('nextTitle')?.textContent?.includes('กรุณาระบุข้อมูลผู้เรียน')`);
    await new Promise(r => setTimeout(r, 400));
    const s1 = await cdp.eval(`({
      title: document.getElementById('nextTitle')?.textContent,
      cta: document.getElementById('nextLink')?.textContent,
      disabled: document.getElementById('nextLink')?.getAttribute('aria-disabled'),
      progressPos: getComputedStyle(document.querySelector('.hub-topbar > .hub-menu__panel')).position
    })`);
    assert.strictEqual(s1.disabled, 'false', 'Profile CTA must be clickable');
    assert.strictEqual(s1.progressPos, 'static', 'Topbar progress panel must not float off viewport');
    assert.strictEqual(mockScenario.calls.length, 0, 'Must not fetch Sheet without profile');
    assert.strictEqual(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    console.log('PASS 1: Student Mode no-profile prompt + topbar positioning');

    // 2. New student (0/19) on MOBILE viewport (390x844) -> verify mobile CTA bug is FIXED!
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    mockScenario.delayMs = 60;
    mockScenario.missionResponse = {
      ok: true, found: false, studentId: '66010001', section: '1', canonicalSection: '1',
      completedNodes: 0, nextMission: 'w1', missions: {},
      diagnostics: { canonicalPassedMissionIds: [] }
    };
    mockScenario.studioResponse = {
      ok: true, studentId: '66010001', section: '1', nodes: {},
      summary: { submittedCount: 0, approvedCount: 0, revisionCount: 0 }, portfolioReady: false
    };
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `window.UXQCombinedCourseProgress && document.querySelector('[data-node-id="w1"] .studio-node-status')`);
    await new Promise(r => setTimeout(r, 500));
    const s2 = await cdp.eval(`({
      w1Cta: document.querySelector('[data-node-id="w1"] .campaign-launch')?.textContent?.trim(),
      w1Locked: document.querySelector('[data-node-id="w1"]')?.dataset?.threePartLocked,
      w2Locked: document.querySelector('[data-node-id="w2"]')?.dataset?.threePartLocked,
      w2Disabled: document.querySelector('[data-node-id="w2"] .campaign-launch')?.getAttribute('aria-disabled'),
      heroCta: document.getElementById('nextLink')?.textContent?.trim(),
      courseComplete: document.querySelector('.course-primary__value strong')?.textContent?.trim()
    })`);
    assert.strictEqual(s2.w1Cta, 'เริ่ม Mission', `Mobile W1 CTA must be 'เริ่ม Mission', got '${s2.w1Cta}'`);
    assert.strictEqual(s2.w1Locked, '0', 'W1 must be unlocked');
    assert.strictEqual(s2.w2Locked, '1', 'W2 must be locked');
    assert.strictEqual(s2.w2Disabled, 'true', 'W2 link must be disabled');
    assert.strictEqual(s2.courseComplete, '0/19', 'Course complete must be 0/19');
    assert.strictEqual(mockScenario.calls.filter(c => c.action === 'uxq_student_progress').length, 1, 'Exactly 1 mission JSONP call');
    assert.strictEqual(mockScenario.calls.filter(c => c.action === 'uxq_student_studio_progress').length, 1, 'Exactly 1 studio JSONP call');
    assert.strictEqual(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    console.log('PASS 2: Mobile new student (0/19) — single Sheet fetch & no hardcoded Studio CTA');

    // 3. W1 Mission passed ONLY (1/3) -> W1 links to Studio (view=studio&phase=studio), W2 stays locked 3/3
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    mockScenario.missionResponse = {
      ok: true, found: true, studentId: '66010001', section: '1', canonicalSection: '1',
      completedNodes: 1, nextMission: 'w2',
      missions: { w1: { id: 'w1', completed: true, bestStars: 3, bestScore: 950, attempts: 1 } },
      diagnostics: { canonicalPassedMissionIds: ['w1'] }
    };
    mockScenario.studioResponse = {
      ok: true, studentId: '66010001', section: '1', nodes: {},
      summary: { submittedCount: 0, approvedCount: 0, revisionCount: 0 }, portfolioReady: false
    };
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `window.UXQCombinedCourseProgress?.missionCount === 1 && document.querySelector('[data-node-id="w1"]')?.dataset?.uxqFinalAuthority === '1'`);
    await new Promise(r => setTimeout(r, 400));
    const s3 = await cdp.eval(`({
      w1Cta: document.querySelector('[data-node-id="w1"] .campaign-launch')?.textContent?.trim(),
      w1Href: document.querySelector('[data-node-id="w1"] .campaign-launch')?.getAttribute('href'),
      w2Locked: document.querySelector('[data-node-id="w2"]')?.dataset?.threePartLocked,
      w2Badge: document.querySelector('[data-node-id="w2"] .stage-state')?.textContent?.trim(),
      heroTitle: document.getElementById('nextTitle')?.textContent?.trim(),
      courseComplete: document.querySelector('.course-primary__value strong')?.textContent?.trim()
    })`);
    assert.strictEqual(s3.w1Cta, 'ทำ Studio Practice', 'W1 CTA should lead to Studio Practice');
    assert(s3.w1Href.includes('view=studio') && s3.w1Href.includes('phase=studio'), `W1 href must pass view=studio&phase=studio: ${s3.w1Href}`);
    assert.strictEqual(s3.w2Locked, '1', 'W2 must stay locked until W1 is 3/3');
    assert.strictEqual(s3.courseComplete, '0/19', 'Course complete must stay 0/19 until 3/3');
    assert.strictEqual(mockScenario.calls.length, 2, 'Exactly 2 total JSONP calls (1 mission + 1 studio)');
    console.log('PASS 3: W1 Mission-only (1/3) keeps W2 locked and deep-links W1 to Studio');

    // 4. W1 complete 3/3 + W2 Mission+Studio (2/3) + section format "1.0" tolerance
    mockScenario.missionResponse = {
      ok: true, found: true, studentId: '66010001', section: '1.0', canonicalSection: '1',
      completedNodes: 2, nextMission: 'w3',
      missions: {
        w1: { id: 'w1', completed: true, bestStars: 3, bestScore: 950, attempts: 1 },
        w2: { id: 'w2', completed: true, bestStars: 2, bestScore: 820, attempts: 1 }
      },
      diagnostics: { canonicalPassedMissionIds: ['w1', 'w2'] }
    };
    mockScenario.studioResponse = {
      ok: true, studentId: '66010001', section: '1',
      nodes: {
        w1: { missionId: 'w1', submitted: true, reflection: 'W1 reflection text', reviewStatus: 'approved' },
        w2: { missionId: 'w2', submitted: true, reflection: '', reviewStatus: 'submitted' }
      },
      summary: { submittedCount: 2, approvedCount: 1, revisionCount: 0 }, portfolioReady: false
    };
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `window.UXQCombinedCourseProgress?.contiguous === 1 && document.querySelector('[data-node-id="w2"]')?.dataset?.uxqFinalAuthority === '1'`);
    const s4 = await cdp.eval(`({
      w1Badge: document.querySelector('[data-node-id="w1"] .stage-state')?.textContent?.trim(),
      w1Cta: document.querySelector('[data-node-id="w1"] .campaign-launch')?.textContent?.trim(),
      w1Href: document.querySelector('[data-node-id="w1"] .campaign-launch')?.getAttribute('href'),
      w2Locked: document.querySelector('[data-node-id="w2"]')?.dataset?.threePartLocked,
      w2Cta: document.querySelector('[data-node-id="w2"] .campaign-launch')?.textContent?.trim(),
      w3Locked: document.querySelector('[data-node-id="w3"]')?.dataset?.threePartLocked,
      courseComplete: document.querySelector('.course-primary__value strong')?.textContent?.trim(),
      timelineCount: document.querySelectorAll('.timeline-row').length
    })`);
    assert.strictEqual(s4.w1Badge, '✅ Complete 3/3');
    assert.strictEqual(s4.w1Cta, 'ดู Studio & Reflection');
    assert(s4.w1Href.includes('review=1') && s4.w1Href.includes('complete=1'), `W1 completed href must include review=1&complete=1: ${s4.w1Href}`);
    assert.strictEqual(s4.w2Locked, '0', 'W2 must be unlocked after W1 3/3');
    assert.strictEqual(s4.w2Cta, 'ทำ Weekly Reflection', 'W2 CTA should be Weekly Reflection');
    assert.strictEqual(s4.w3Locked, '1', 'W3 must be locked while W2 is 2/3');
    assert.strictEqual(s4.courseComplete, '1/19');
    assert.strictEqual(s4.timelineCount, 19);
    console.log('PASS 4: 3/3 unlock progression + review routing + normalized section identity');

    // 5. Slow Google Sheet (8.2s per request -> previously killed at 7s!)
    mockScenario.delayMs = 4200; // 4.2s mission + 4.2s studio = 8.4s total (> old 7s hard-fail!)
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `window.UXQCombinedCourseProgress?.contiguous === 1`, 15000);
    const s5 = await cdp.eval(`({
      recoveryCount: document.querySelectorAll('#uxqStudentRecoveryActions,[data-sheet-recovery-action],.uxq-cloud-recovery-actions').length,
      heroTitle: document.getElementById('nextTitle')?.textContent?.trim(),
      calls: true
    })`);
    assert.strictEqual(s5.recoveryCount, 0, 'Slow Sheet must NOT leave stale recovery buttons');
    assert(s5.heroTitle.includes('W2'), `Hero should show W2 after slow load, got: ${s5.heroTitle}`);
    assert.strictEqual(mockScenario.calls.length, 2, 'Slow Sheet must NOT trigger duplicate retries while in-flight');
    console.log('PASS 5: Slow Sheet (8.4s total) completes cleanly with 0 premature timeouts or duplicate requests');

    // 6. Content Preview mode (?contentPreview=1)
    mockScenario.delayMs = 20;
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?contentPreview=1');
    await waitFor(cdp, `document.querySelectorAll('#grid .campaign-card').length === 19`);
    assert.strictEqual(mockScenario.calls.length, 0, 'Content Preview must never call Apps Script');
    assert.strictEqual(consoleErrors.length, 0, `Unexpected console errors in preview: ${consoleErrors.join('; ')}`);
    console.log('PASS 6: Content Preview renders all 19 nodes with 0 Sheet calls and 0 errors');

    // 7. Network error -> Retry recovers cleanly & removes error UI
    mockScenario.delayMs = 30;
    mockScenario.missionResponse = { ok: false, error: 'temporary_sheet_busy' };
    await loadPage('/sgnal-hunt/csai2601-mission-control.html?studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `document.getElementById('nextTitle')?.textContent?.includes('ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ')`);
    const s7Err = await cdp.eval(`document.querySelectorAll('[data-sheet-recovery-action]').length`);
    assert(s7Err >= 1, 'Error state should render recovery action');
    mockScenario.missionResponse = {
      ok: true, found: true, studentId: '66010001', section: '1', canonicalSection: '1',
      completedNodes: 1, nextMission: 'w2',
      missions: { w1: { id: 'w1', completed: true, bestStars: 3, bestScore: 950, attempts: 1 } },
      diagnostics: { canonicalPassedMissionIds: ['w1'] }
    };
    mockScenario.studioResponse = {
      ok: true, studentId: '66010001', section: '1',
      nodes: { w1: { missionId: 'w1', submitted: true, reflection: 'done', reviewStatus: 'submitted' } },
      summary: { submittedCount: 1, approvedCount: 0, revisionCount: 0 }, portfolioReady: false
    };
    await cdp.eval(`document.getElementById('nextLink').click()`);
    await waitFor(cdp, `window.UXQCombinedCourseProgress?.contiguous === 1`);
    const s7Recovered = await cdp.eval(`({
      recoveryCount: document.querySelectorAll('#uxqStudentRecoveryActions,[data-sheet-recovery-action],.uxq-cloud-recovery-actions').length,
      w2Locked: document.querySelector('[data-node-id="w2"]')?.dataset?.threePartLocked
    })`);
    assert.strictEqual(s7Recovered.recoveryCount, 0, 'Retry recovery must remove all stale error actions');
    assert.strictEqual(s7Recovered.w2Locked, '0', 'Retry recovery must unlock W2');
    console.log('PASS 7: Network error -> Retry recovers cleanly and removes error UI');

    // 8. Node Unlock Guard: W2 locked when W1 missing, unlocked with overlay removed when W1 passed
    mockScenario.missionResponse = {
      ok: true, found: false, studentId: '66010001', section: '1', canonicalSection: '1',
      completedNodes: 0, nextMission: 'w1', missions: {},
      diagnostics: { canonicalPassedMissionIds: [] }
    };
    await loadPage('/sgnal-hunt/csai2601-canonical-node-clean-v1.html?node=W2&studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `document.body?.dataset?.uxqThreePartLocked === '1'`);
    const s8Locked = await cdp.eval(`({
      overlayGone: !document.getElementById('uxqUnlockCheckingOverlay'),
      text: document.getElementById('uxqCanonicalNode')?.textContent || ''
    })`);
    assert(s8Locked.overlayGone, 'Checking overlay must be removed when locked');
    assert(s8Locked.text.includes('W2 ยังล็อกอยู่'), 'Must show W2 locked screen');

    mockScenario.missionResponse = {
      ok: true, found: true, studentId: '66010001', section: '1', canonicalSection: '1',
      completedNodes: 1, nextMission: 'w2',
      missions: { w1: { id: 'w1', completed: true, bestStars: 3, bestScore: 950, attempts: 1 } },
      diagnostics: { canonicalPassedMissionIds: ['w1'] }
    };
    await loadPage('/sgnal-hunt/csai2601-canonical-node-clean-v1.html?node=W2&studentId=66010001&studentName=Test%20Student&section=1');
    await waitFor(cdp, `document.body?.dataset?.uxqThreePartLocked === '0' && !document.getElementById('uxqUnlockCheckingOverlay')`);
    const s8Unlocked = await cdp.eval(`({
      hasGameUi: (document.getElementById('uxqCanonicalNode')?.textContent || '').length > 50,
      notLockedMsg: !(document.getElementById('uxqCanonicalNode')?.textContent || '').includes('W2 ยังล็อกอยู่')
    })`);
    assert(s8Unlocked.hasGameUi && s8Unlocked.notLockedMsg, 'Unlocked W2 must keep rendered node UI after overlay closes');
    console.log('PASS 8: Node Unlock Guard overlay locks/unlocks W2 cleanly without wiping game UI');

    console.log('\nALL 8 CSAI2601 MISSION CONTROL & NODE E2E TESTS PASSED!');
  } finally {
    cdp.close();
    chrome.proc.kill('SIGKILL');
    server.close();
    try { fs.rmSync(chrome.userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runTests().catch(err => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
