// === vr/game-router.js (2025-11-06, robust & event-based loader) ===

// ---------- Utility ----------
function getParam(name, def = null) {
  try {
    return (new URL(location.href)).searchParams.get(name) ?? def;
  } catch {
    return def;
  }
}

function safeLog(...a) {
  try { console.log(...a); } catch {}
}
function safeErr(...a) {
  try { console.error(...a); } catch {}
}

// ---------- Parameters ----------
const mode = (getParam('mode', 'goodjunk') || '').toLowerCase();
const goal = Number(getParam('goal', 40)) || 40;
const diff = getParam('difficulty', 'normal');
const duration = Number(getParam('duration', 60)) || 60;

// ---------- Map of available modules ----------
const MODULES = {
  goodjunk : './modes/goodjunk-vr.js',
  groups   : './modes/groups-vr.js',
  hydration: './modes/hydration-vr.js',
  plate    : './modes/plate-vr.js'
};

// Resolve path relative to current file
const targetUrl = new URL(MODULES[mode] || MODULES.goodjunk, import.meta.url).toString();

// ---------- Loader ----------
async function loadGameModule(url, retry = 1) {
  let lastErr;
  for (let i = 0; i <= retry; i++) {
    try {
      const mod = await import(url + '?v=' + Date.now()); // bust cache in dev
      if (mod && typeof mod.boot === 'function') {
        safeLog('[VR] Loaded module:', mode);
        window.dispatchEvent(new CustomEvent('hha:mode-loaded', { detail: { mode, goal, diff, duration } }));
        await mod.boot({ goal, difficulty: diff, duration });
        return true;
      } else {
        throw new Error('Module has no boot()');
      }
    } catch (err) {
      lastErr = err;
      safeErr(`[VR] load fail (${i+1}/${retry+1}):`, err.message || err);
      await new Promise(r => setTimeout(r, 150));
    }
  }
  throw lastErr;
}

// ---------- Start ----------
loadGameModule(targetUrl, 1).catch(async err => {
  safeErr('[VR] Fallback to goodjunk mode:', err);
  const fallbackUrl = new URL(MODULES.goodjunk, import.meta.url).toString();
  try {
    const mod = await import(fallbackUrl);
    if (mod?.boot) await mod.boot({ goal, difficulty: diff, duration });
    safeLog('[VR] fallback loaded');
  } catch (e) {
    safeErr('[VR] fallback failed:', e);
    window.dispatchEvent(new CustomEvent('hha:mode-error', { detail: { mode, error: e } }));
  }
});
