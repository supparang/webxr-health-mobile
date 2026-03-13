// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// PATCH v20260313m-ALL-ZONES-GATE-CORE-PARAM-COMPAT-FULL
// ✅ FIX: support phase + gatePhase + Phase
// ✅ FIX: support game + theme + Game + Theme
// ✅ FIX: support zone + cat + Zone + Cat
// ✅ KEEP: built-in summary / API start / hardened cleanup

import {
  getGameMeta,
  getPhaseFile,
  getGameStyleFile,
  normalizeGameId
} from './gate-games.js';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function qs(url, key, fallback = '') {
  try {
    return url.searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function qbool(url, key, fallback = false) {
  const v = String(qs(url, key, fallback ? '1' : '0')).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

function safeUrl(raw, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, window.location.href).toString();
  } catch {
    return fallback;
  }
}

function ensureStyleFile(href, id) {
  if (!href) return;

  const old = document.getElementById(id);
  if (old && old.getAttribute('href') === href) return;
  if (old) old.remove();

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function setDocTitle(meta, phase) {
  const phaseText = phase === 'cooldown' ? 'Cooldown' : 'Warmup';
  const label = meta?.label || 'Gate';
  document.title = `HeroHealth — ${label} ${phaseText}`;
}

function getPhase(url) {
  const raw = String(
    qs(
      url,
      'phase',
      qs(url, 'gatePhase', qs(url, 'Phase', 'warmup'))
    )
  ).trim().toLowerCase();

  return raw === 'cooldown' ? 'cooldown' : 'warmup';
}

function getGame(url) {
  return normalizeGameId(
    qs(
      url,
      'game',
      qs(url, 'theme', qs(url, 'Game', qs(url, 'Theme', '')))
    )
  );
}

function getNextRunUrl(url) {
  const next = qs(url, 'next', '');
  if (next) return safeUrl(next, '');

  const runUrl = qs(url, 'runUrl', '');
  if (runUrl) return safeUrl(runUrl, '');

  return '';
}

function getHubUrl(url) {
  return safeUrl(qs(url, 'hub', ''));
}

function renderError(root, title, detail = '') {
  root.innerHTML = `
    <section style="padding:20px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.78);border-radius:24px;padding:20px">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px">HEROHEALTH GATE</div>
        <h1 style="margin:0 0 10px;font-size:1.45rem">${esc(title)}</h1>
        <p style="margin:0;color:#cbd5e1;line-height:1.6">${esc(detail)}</p>
      </div>
    </section>
  `;
}

function renderLoading(root, meta, phase) {
  root.innerHTML = `
    <section style="padding:20px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.78);border-radius:24px;padding:20px">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px">
          ${esc(String(meta?.cat || '').toUpperCase())} • ${esc(String(phase).toUpperCase())}
        </div>
        <h1 style="margin:0 0 10px;font-size:1.45rem">${esc(meta?.label || 'Gate')}</h1>
        <p style="margin:0;color:#cbd5e1">กำลังโหลด mini game...</p>
      </div>
    </section>
  `;
}

function metricMeta(key) {
  const map = {
    total:         { label: 'ทั้งหมด',         icon: '🎯', tone: 'blue' },
    correct:       { label: 'ทำถูก',           icon: '✅', tone: 'green' },
    wrong:         { label: 'ทำผิด',           icon: '❌', tone: 'red' },
    misses:        { label: 'พลาด',            icon: '⚠️', tone: 'amber' },
    avgReactionMs: { label: 'ตอบเร็วเฉลี่ย',    icon: '⚡', tone: 'violet' },

    success:       { label: 'สำเร็จ',          icon: '✅', tone: 'green' },
    fail:          { label: 'พลาด',            icon: '⚠️', tone: 'amber' },

    starsDone:     { label: 'เก็บดาว',         icon: '⭐', tone: 'yellow' },
    holdSeconds:   { label: 'ค้างท่า',         icon: '⏱️', tone: 'cyan' },

    breathCycles:  { label: 'รอบหายใจ',        icon: '💨', tone: 'cyan' },
    calmTicks:     { label: 'ช่วงผ่อนคลาย',    icon: '🌿', tone: 'green' },
    relaxTicks:    { label: 'ช่วงผ่อนคลาย',    icon: '🌿', tone: 'green' },

    swayRounds:    { label: 'รอบแกว่ง',        icon: '↔️', tone: 'blue' },
    stillnessSec:  { label: 'ยืนนิ่ง',         icon: '🧍', tone: 'cyan' },

    leftHoldSec:   { label: 'ค้างซ้าย',        icon: '⬅️', tone: 'blue' },
    rightHoldSec:  { label: 'ค้างขวา',         icon: '➡️', tone: 'blue' },
    centerHoldSec: { label: 'ค้างตรงกลาง',     icon: '🟦', tone: 'violet' },

    done:          { label: 'ทำครบ',           icon: '✅', tone: 'green' },
    skipped:       { label: 'ข้าม',            icon: '⏭️', tone: 'amber' },

    answers:       { label: 'ตอบแล้ว',         icon: '💬', tone: 'violet' },
    mood:          { label: 'ความรู้สึก',      icon: '😊', tone: 'pink' },
    energy:        { label: 'พลังงาน',         icon: '⚡', tone: 'yellow' },

    score:             { label: 'คะแนน',             icon: '🏅', tone: 'yellow' },
    accuracy:          { label: 'ความแม่นยำ',        icon: '🎯', tone: 'green' },
    speed:             { label: 'ความเร็ว',          icon: '⚡', tone: 'violet' },
    calm:              { label: 'ความนิ่ง',          icon: '🌿', tone: 'cyan' },
    rank:              { label: 'Rank',              icon: '✨', tone: 'pink' },
    wPct:              { label: 'โบนัสรวม',          icon: '🪄', tone: 'blue' },
    wCrit:             { label: 'คริติคอล',          icon: '💥', tone: 'red' },
    wDmg:              { label: 'พลังโจมตี',         icon: '⚔️', tone: 'amber' },
    wHeal:             { label: 'พลังฟื้นฟู',        icon: '💚', tone: 'green' },
    groupMasteryPct:   { label: 'เข้าใจหมวดอาหาร',   icon: '🍽️', tone: 'blue' }
  };
  return map[key] || { label: key, icon: '•', tone: 'blue' };
}

function metricValue(key, value) {
  if (key === 'avgReactionMs') return `${value} ms`;
  if (key === 'holdSeconds') return `${value} วินาที`;
  if (key === 'stillnessSec') return `${value} วินาที`;
  if (key === 'leftHoldSec') return `${value} วินาที`;
  if (key === 'rightHoldSec') return `${value} วินาที`;
  if (key === 'centerHoldSec') return `${value} วินาที`;

  if (key === 'accuracy') return `${value}%`;
  if (key === 'speed') return `${value}%`;
  if (key === 'calm') return `${value}%`;
  if (key === 'wPct') return `+${value}%`;
  if (key === 'wCrit') return `+${value}`;
  if (key === 'wDmg') return `+${value}`;
  if (key === 'wHeal') return `+${value}`;
  if (key === 'groupMasteryPct') return `${value}%`;

  if (key === 'mood') {
    const moodMap = { happy: 'สนุก', calm: 'สงบ', tired: 'เหนื่อย' };
    return moodMap[value] || value;
  }

  if (key === 'energy') {
    const energyMap = { low: 'น้อย', medium: 'ปานกลาง', high: 'มาก' };
    return energyMap[value] || value;
  }

  return value;
}

function sanitizeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return [];
  return Object.entries(metrics)
    .filter(([k, v]) => k !== 'finished' && v !== '' && v != null)
    .map(([k, v]) => {
      const meta = metricMeta(k);
      return {
        key: k,
        label: meta.label,
        icon: meta.icon,
        tone: meta.tone,
        value: metricValue(k, v)
      };
    });
}

function childStatusText(result) {
  return result?.passed ? 'เยี่ยมมาก' : 'ทำเสร็จแล้ว';
}

function toneStyle(tone) {
  const styles = {
    green:  'border:1px solid rgba(34,197,94,.22);background:linear-gradient(180deg,rgba(34,197,94,.16),rgba(15,23,42,.78));',
    blue:   'border:1px solid rgba(59,130,246,.22);background:linear-gradient(180deg,rgba(59,130,246,.16),rgba(15,23,42,.78));',
    cyan:   'border:1px solid rgba(34,211,238,.22);background:linear-gradient(180deg,rgba(34,211,238,.16),rgba(15,23,42,.78));',
    amber:  'border:1px solid rgba(245,158,11,.22);background:linear-gradient(180deg,rgba(245,158,11,.16),rgba(15,23,42,.78));',
    violet: 'border:1px solid rgba(167,139,250,.22);background:linear-gradient(180deg,rgba(167,139,250,.16),rgba(15,23,42,.78));',
    pink:   'border:1px solid rgba(244,114,182,.22);background:linear-gradient(180deg,rgba(244,114,182,.16),rgba(15,23,42,.78));',
    red:    'border:1px solid rgba(239,68,68,.22);background:linear-gradient(180deg,rgba(239,68,68,.16),rgba(15,23,42,.78));',
    yellow: 'border:1px solid rgba(250,204,21,.22);background:linear-gradient(180deg,rgba(250,204,21,.16),rgba(15,23,42,.78));'
  };
  return styles[tone] || styles.blue;
}

function scoreToStars(score = 0) {
  const s = Number(score) || 0;
  if (s >= 90) return 3;
  if (s >= 70) return 2;
  if (s > 0) return 1;
  return 0;
}

function renderBuiltInSummary(root, result, ctx) {
  const isCooldown = ctx.phase === 'cooldown';
  const primaryLabel = isCooldown ? 'กลับ HUB' : 'ไปเกมหลัก';
  const primaryUrl = isCooldown ? ctx.hubUrl : (ctx.nextRunUrl || ctx.hubUrl);

  const metrics = sanitizeMetrics(result?.metrics);
  const showSecondaryHub = !isCooldown && !!ctx.hubUrl;

  root.innerHTML = `
    <section style="padding:14px;max-width:960px;margin:0 auto;color:#e5e7eb">
      <div style="
        border:1px solid rgba(148,163,184,.18);
        background:
          radial-gradient(900px 420px at 50% -10%, rgba(59,130,246,.12), transparent 60%),
          rgba(2,6,23,.82);
        border-radius:28px;
        padding:18px;
        box-shadow:0 18px 48px rgba(0,0,0,.28);
      ">
        <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px;font-weight:800">
          ${esc(String(ctx.meta?.cat || '').toUpperCase())} • ${esc(String(ctx.phase).toUpperCase())}
        </div>

        <h1 style="margin:0 0 10px;font-size:clamp(1.55rem,5vw,2.1rem);line-height:1.08;font-weight:1000">
          ${esc(result?.title || ctx.defaultTitle || 'สรุปผล')}
        </h1>

        <p style="margin:0 0 14px;color:#dbeafe;line-height:1.55;font-size:1rem">
          ${esc(result?.coach?.line || '')}
        </p>

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px">
          <span style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(245,158,11,.22);font-weight:900">
            🏅 คะแนน ${esc(result?.score ?? 0)}
          </span>
          <span style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(250,204,21,.22);font-weight:900">
            ⭐ ดาว ${esc(result?.stars ?? 1)}
          </span>
          <span style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(34,197,94,.22);font-weight:900">
            🎉 ${esc(childStatusText(result))}
          </span>
        </div>

        ${metrics.length ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin:0 0 18px">
            ${metrics.map(m => `
              <div style="
                ${toneStyle(m.tone)}
                border-radius:18px;
                padding:14px;
                min-height:92px;
              ">
                <div style="font-size:.84rem;color:#cbd5e1;margin-bottom:6px;font-weight:800">
                  ${esc(m.icon)} ${esc(m.label)}
                </div>
                <div style="font-weight:1000;font-size:1.15rem;line-height:1.2">
                  ${esc(m.value)}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${primaryUrl ? `
            <button id="hh-gate-primary" style="
              appearance:none;
              border:0;
              border-radius:16px;
              padding:14px 18px;
              min-height:50px;
              font-weight:1000;
              font-size:1rem;
              background:linear-gradient(180deg,#86efac,#22c55e);
              color:#052e16;
              cursor:pointer
            ">
              ${esc(primaryLabel)}
            </button>
          ` : ''}

          ${showSecondaryHub ? `
            <button id="hh-gate-hub" style="
              appearance:none;
              border:1px solid rgba(148,163,184,.18);
              border-radius:16px;
              padding:14px 18px;
              min-height:50px;
              font-weight:1000;
              font-size:1rem;
              background:rgba(15,23,42,.9);
              color:#e5e7eb;
              cursor:pointer
            ">
              กลับ HUB
            </button>
          ` : ''}
        </div>
      </div>
    </section>
  `;

  const primaryBtn = root.querySelector('#hh-gate-primary');
  const hubBtn = root.querySelector('#hh-gate-hub');

  if (primaryBtn && primaryUrl) {
    primaryBtn.addEventListener('click', () => {
      window.location.href = primaryUrl;
    });
  }

  if (hubBtn && ctx.hubUrl) {
    hubBtn.addEventListener('click', () => {
      window.location.href = ctx.hubUrl;
    });
  }
}

function getDefaultTitle(meta, phase) {
  return phase === 'cooldown'
    ? (meta?.cooldownTitle || `${meta?.label || 'Game'} Cooldown`)
    : (meta?.warmupTitle || `${meta?.label || 'Game'} Warmup`);
}

export async function bootGate(root) {
  if (!root) {
    console.error('[gate-core] root not found');
    return;
  }

  const url = new URL(window.location.href);
  const game = getGame(url);
  const phase = getPhase(url);
  const meta = getGameMeta(game);

  if (!meta) {
    renderError(root, 'ไม่พบเกมใน Gate Registry', `game=${game || '(empty)'}`);
    return;
  }

  const zone = qs(
    url,
    'zone',
    qs(url, 'cat', qs(url, 'Zone', qs(url, 'Cat', meta.cat || '')))
  );

  const seed = Number(qs(url, 'seed', Date.now()));
  const pid = qs(url, 'pid', 'anon');
  const studyId = qs(url, 'studyId', '');
  const run = qs(url, 'run', 'play');
  const view = qs(url, 'view', 'mobile');
  const hubUrl = getHubUrl(url);
  const nextRunUrl = getNextRunUrl(url);
  const debug = qbool(url, 'debug', false);
  const defaultTitle = getDefaultTitle(meta, phase);

  setDocTitle(meta, phase);

  const styleFile = getGameStyleFile(game);
  if (styleFile) {
    ensureStyleFile(styleFile, `hh-gate-style-${game}`);
  }

  renderLoading(root, meta, phase);

  let controller = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try { controller?.destroy?.(); } catch {}
  };

  window.addEventListener('pagehide', cleanup, { once: true });
  window.addEventListener('beforeunload', cleanup, { once: true });

  try {
    const modPath = getPhaseFile(game, phase);
    if (!modPath) {
      throw new Error(`ไม่พบ path ของ ${game}/${phase}`);
    }

    const mod = await import(modPath);
    if (!mod || typeof mod.mount !== 'function') {
      throw new Error(`Module ${modPath} ต้อง export mount(root, ctx, api)`);
    }

    const ctx = {
      url,
      root,
      game,
      phase,
      zone,
      meta,
      seed,
      pid,
      studyId,
      run,
      view,
      hubUrl,
      nextRunUrl,
      defaultTitle,
      debug,

      onComplete(result) {
        try {
          console.log('[gate complete]', {
            game,
            phase,
            zone,
            pid,
            studyId,
            result
          });

          cleanup();

          renderBuiltInSummary(root, result, {
            game,
            phase,
            zone,
            meta,
            hubUrl,
            nextRunUrl,
            defaultTitle
          });
        } catch (err) {
          console.error('[gate-core onComplete]', err);
          renderError(root, 'สรุปผลไม่สำเร็จ', String(err?.message || err));
        }
      }
    };

    const api = {
      logger: {
        push(event, payload = {}) {
          try {
            console.log('[gate log]', event, payload);
          } catch {}
        }
      },

      setStats(stats = {}) {
        try {
          console.log('[gate stats]', stats);
        } catch {}
      },

      finish(result = {}) {
        const scoreNum = Number(result?.buffs?.score ?? result.score ?? 0);

        const passed = Boolean(
          result.passed ??
          result.ok ??
          (scoreNum >= 60)
        );

        const linesText = Array.isArray(result.lines)
          ? result.lines.join(' • ')
          : '';

        ctx.onComplete({
          passed,
          title: result.title || defaultTitle,
          score: scoreNum,
          stars: Number(result.stars ?? scoreToStars(scoreNum)),
          coach: {
            line:
              result.subtitle ||
              linesText ||
              (passed ? 'ทำได้ดีมาก' : 'ลองใหม่อีกครั้ง')
          },
          metrics: {
            ...(result.metrics || {}),
            ...(result.buffs || {})
          }
        });
      }
    };

    controller = await mod.mount(root, ctx, api);

    if (controller && typeof controller.start === 'function') {
      controller.start();
    }
  } catch (err) {
    console.error('[gate-core] load fail', err);
    cleanup();
    renderError(
      root,
      'โหลด mini game ไม่สำเร็จ',
      `${game}/${phase}: ${String(err?.message || err)}`
    );
  }
}