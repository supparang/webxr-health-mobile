// === /herohealth/vr-goodjunk/goodjunk-multi-run-loader.js ===
// GoodJunk Multiplayer Run Loader
// FULL PATCH v20260326-GJ-MULTI-RUN-LOADER-AUTOALIGN

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;
  const QS = new URLSearchParams(location.search);

  const cfg = WIN.__GJ_MULTI_BOOT__ || {};
  const mode = String(cfg.mode || QS.get('mode') || 'race').toLowerCase();
  const label = String(cfg.label || mode || 'run');

  const DEFAULTS = {
    race: [
      './goodjunk-race.safe.js',
      './goodjunk-race.js',
      './goodjunk-race-run.safe.js',
      './goodjunk-race-run.js',
      './race.safe.js',
      './race.js',
      './js/goodjunk-race.safe.js',
      './js/goodjunk-race.js',
      './js/goodjunk-race-run.safe.js',
      './js/goodjunk-race-run.js',
      './js/race.safe.js',
      './js/race.js'
    ],
    battle: [
      './goodjunk-battle.safe.js',
      './goodjunk-battle.js',
      './goodjunk-battle-run.safe.js',
      './goodjunk-battle-run.js',
      './battle.safe.js',
      './battle.js',
      './js/goodjunk-battle.safe.js',
      './js/goodjunk-battle.js',
      './js/goodjunk-battle-run.safe.js',
      './js/goodjunk-battle-run.js',
      './js/battle.safe.js',
      './js/battle.js'
    ],
    coop: [
      './goodjunk-coop.safe.js',
      './goodjunk-coop.js',
      './goodjunk-coop-run.safe.js',
      './goodjunk-coop-run.js',
      './coop.safe.js',
      './coop.js',
      './js/goodjunk-coop.safe.js',
      './js/goodjunk-coop.js',
      './js/goodjunk-coop-run.safe.js',
      './js/goodjunk-coop-run.js',
      './js/coop.safe.js',
      './js/coop.js'
    ]
  };

  function qs(key, fb = '') {
    return QS.get(key) ?? fb;
  }

  function clean(v) {
    return String(v || '').trim();
  }

  function dedupe(arr) {
    const out = [];
    const seen = new Set();
    for (const item of arr || []) {
      const s = clean(item);
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }

  function parseList(text) {
    return String(text || '')
      .split(',')
      .map(s => clean(s))
      .filter(Boolean);
  }

  function resolveHub() {
    try {
      return qs('hub') || new URL('../hub.html', location.href).toString();
    } catch {
      return '../hub.html';
    }
  }

  function getApiUrl() {
    return clean(
      qs('api') ||
      WIN.HHA_CLOUD_ENDPOINT ||
      ''
    );
  }

  function buildRunCtx() {
    return {
      pid: qs('pid', 'anon'),
      name: qs('name', ''),
      studyId: qs('studyId', ''),
      roomId: qs('roomId') || qs('room') || '',
      role: qs('role', 'player'),
      mode,
      diff: qs('diff', cfg.defaultDiff || 'normal'),
      time: qs('time', cfg.defaultTime || '120'),
      seed: qs('seed', String(Date.now())),
      startAt: 0,
      hub: resolveHub(),
      view: qs('view', 'mobile'),
      run: qs('run', 'play'),
      gameId: qs('gameId', 'goodjunk')
    };
  }

  const runCtx = buildRunCtx();
  WIN.__GJ_RUN_CTX__ = runCtx;
  WIN.__GJ_MULTI_RUN_CTX__ = runCtx;

  const endpoint = getApiUrl();
  if (endpoint) WIN.HHA_CLOUD_ENDPOINT = endpoint;

  function $(id) {
    return DOC.getElementById(id);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setStatus(title, text, isError) {
    setText('engineStatusTitle', title);
    const body = $('engineStatusText');
    if (body) {
      body.textContent = text;
      body.className = isError ? 'error' : '';
    }
  }

  function fillTopPills() {
    setText('pillRoom', `ROOM • ${runCtx.roomId || '-'}`);
    setText('pillPlayer', `PLAYER • ${runCtx.name || runCtx.pid || '-'}`);
    setText('pillDiff', `DIFF • ${runCtx.diff}`);
    setText('pillTime', `TIME • ${runCtx.time}`);
  }

  function fillDebugInfo(candidates) {
    const info = $('engineDebugInfo');
    if (!info) return;
    info.textContent = candidates.join('\n');
  }

  function hideStatusSoon() {
    const card = $('engineStatusCard');
    if (!card) return;
    setTimeout(() => {
      card.style.display = 'none';
    }, 1200);
  }

  function getCandidates() {
    const exact = clean(qs('engine'));
    const fromQuery = parseList(qs('engineCandidates'));
    const fromCfg = Array.isArray(cfg.candidates) ? cfg.candidates : [];
    const defaults = DEFAULTS[mode] || [];
    return dedupe([
      exact,
      ...fromQuery,
      ...fromCfg,
      ...defaults
    ]);
  }

  function loadScriptWithType(src, type) {
    return new Promise((resolve, reject) => {
      const el = DOC.createElement('script');
      if (type === 'module') el.type = 'module';
      el.src = new URL(src, location.href).toString();
      el.async = true;
      el.onload = () => resolve({ src, type });
      el.onerror = () => reject(new Error(`load failed: ${src} [${type}]`));
      DOC.body.appendChild(el);
    });
  }

  async function tryLoad(src) {
    try {
      setStatus('กำลังโหลดเกม…', `ลองโหลด ${src} (classic)`, false);
      return await loadScriptWithType(src, 'classic');
    } catch (e1) {
      try {
        setStatus('กำลังโหลดเกม…', `ลองโหลด ${src} (module)`, false);
        return await loadScriptWithType(src, 'module');
      } catch (e2) {
        throw new Error(`${src}\n- classic: ${String(e1.message || e1)}\n- module: ${String(e2.message || e2)}`);
      }
    }
  }

  async function loadEngine() {
    const candidates = getCandidates();
    fillTopPills();
    fillDebugInfo(candidates);

    if (!candidates.length) {
      setStatus(
        'ไม่พบ candidate',
        'ไม่มี candidate engine ให้ลองโหลด',
        true
      );
      return;
    }

    const errors = [];

    for (const src of candidates) {
      try {
        const result = await tryLoad(src);
        WIN.__GJ_MULTI_ENGINE_INFO__ = {
          mode,
          label,
          src: result.src,
          type: result.type,
          loadedAt: Date.now()
        };

        console.log(`[GJ-${label.toUpperCase()}-RUN] loaded engine`, {
          src: result.src,
          type: result.type,
          runCtx
        });

        setStatus(
          'เข้าเกมแล้ว',
          `${label} engine loaded: ${result.src} (${result.type})`,
          false
        );
        hideStatusSoon();
        return;
      } catch (err) {
        errors.push(String(err && err.message ? err.message : err));
        console.warn(`[GJ-${label.toUpperCase()}-RUN] candidate failed`, src, err);
      }
    }

    setStatus(
      'ไม่พบไฟล์ engine',
      `หา ${mode} engine ไม่เจอ\n\nลองแก้ query หรือ candidate path\nตัวอย่าง:\n?engine=./js/goodjunk-${mode}.safe.js\n\nCandidates:\n${candidates.join('\n')}\n\nErrors:\n${errors.join('\n\n')}`,
      true
    );
  }

  loadEngine();
})();