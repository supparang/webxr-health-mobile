// === PATCH: /herohealth/gate/gate-core.js ===
// CONTINUE / HUB NAV HARDEN FIX for mobile summary buttons

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

function safeUrl(raw, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, window.location.href).toString();
  } catch {
    return fallback;
  }
}

function cleanNavUrl(raw, fallback = '') {
  try {
    const u = new URL(raw || fallback, window.location.href);
    [
      'gatePhase','gateMode','gateResult',
      'wType','wPct','wSteps','wTimeBonus','wScoreBonus','wRank',
      'next','cd','wskip','wgskip'
    ].forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return fallback;
  }
}

function resolveNextUrl(ctx = {}) {
  const url = new URL(window.location.href);

  const rawNext =
    qs(url, 'next', '') ||
    ctx.next ||
    ctx.run ||
    '';

  const safeNext = safeUrl(rawNext, '');

  if (safeNext) return cleanNavUrl(safeNext, safeNext);

  // fallback ไป hub ถ้าไม่มี next จริง
  const rawHub =
    qs(url, 'hub', '') ||
    ctx.hub ||
    './hub.html';

  const safeHub = safeUrl(rawHub, './hub.html');
  return cleanNavUrl(safeHub, './hub.html');
}

function resolveHubUrl(ctx = {}) {
  const url = new URL(window.location.href);
  const rawHub =
    qs(url, 'hub', '') ||
    ctx.hub ||
    './hub.html';

  const safeHub = safeUrl(rawHub, './hub.html');
  return cleanNavUrl(safeHub, './hub.html');
}

function navTo(target) {
  const t = safeUrl(target, '');
  if (!t) return;

  console.log('[gate-core] navTo ->', t);

  try {
    window.location.assign(t);
  } catch (e1) {
    try {
      window.location.href = t;
    } catch (e2) {
      console.error('[gate-core] navTo failed', e1, e2);
    }
  }
}

function bindSummaryButtons(root, ctx = {}) {
  if (!root) return;

  const btnContinue =
    root.querySelector('[data-action="continue"]') ||
    root.querySelector('.gate-btn-continue') ||
    root.querySelector('#gate-btn-continue');

  const btnHub =
    root.querySelector('[data-action="hub"]') ||
    root.querySelector('.gate-btn-hub') ||
    root.querySelector('#gate-btn-hub');

  const nextUrl = resolveNextUrl(ctx);
  const hubUrl = resolveHubUrl(ctx);

  if (btnContinue) {
    btnContinue.type = 'button';
    btnContinue.disabled = false;
    btnContinue.style.pointerEvents = 'auto';

    const onContinue = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      console.log('[gate-core] continue clicked ->', nextUrl);
      navTo(nextUrl);
    };

    btnContinue.onclick = onContinue;
    btnContinue.addEventListener('touchend', onContinue, { passive: false });
  }

  if (btnHub) {
    btnHub.type = 'button';
    btnHub.disabled = false;
    btnHub.style.pointerEvents = 'auto';

    const onHub = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      console.log('[gate-core] hub clicked ->', hubUrl);
      navTo(hubUrl);
    };

    btnHub.onclick = onHub;
    btnHub.addEventListener('touchend', onHub, { passive: false });
  }
}

function autoContinueIfReady(ctx = {}) {
  const url = new URL(window.location.href);
  const nextUrl = resolveNextUrl(ctx);

  const auto =
    ['1','true','yes','on'].includes(String(qs(url, 'autoNext', '0')).toLowerCase()) ||
    ['1','true','yes','on'].includes(String(qs(url, 'auto', '0')).toLowerCase());

  if (!auto) return;

  console.log('[gate-core] auto continue ->', nextUrl);
  setTimeout(() => navTo(nextUrl), 450);
}