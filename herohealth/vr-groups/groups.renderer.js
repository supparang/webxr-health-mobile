// /herohealth/vr-groups/groups.renderer.js
// Groups Solo Renderer
// PATCH v20260406-groups-renderer-safe-spawn-r2

export const GROUPS_PATCH_RENDERER = 'v20260406-groups-renderer-safe-spawn-r2';

export function createGroupsRenderer(options = {}){
  const stageEl = options.stageEl;
  const bannerEl = options.bannerEl || null;
  const goalFillEl = options.goalFillEl || null;
  const debug = !!options.debug;

  if (!stageEl) {
    throw new Error('createGroupsRenderer requires stageEl');
  }

  const wrapEl =
    stageEl.closest('.stageWrap') ||
    stageEl.parentElement ||
    null;

  const state = {
    mounted: false,
    stageRect: null,
    activeIds: new Set(),
    bannerTimer: 0,
    resizeHandler: null,
    orientationHandler: null,
    debugBox: null
  };

  function mount(){
    if (state.mounted) return api;

    refreshRect();
    ensureDebugBox();
    updateDebugBox();

    state.resizeHandler = () => {
      refreshRect();
      reconcileSafeTargets();
      updateDebugBox();
    };

    state.orientationHandler = () => {
      refreshRect();
      reconcileSafeTargets();
      updateDebugBox();
    };

    window.addEventListener('resize', state.resizeHandler);
    window.addEventListener('orientationchange', state.orientationHandler);

    state.mounted = true;
    return api;
  }

  function refreshRect(){
    state.stageRect = stageEl.getBoundingClientRect();
    updateDebugBox();
    return state.stageRect;
  }

  function getStageRect(){
    return state.stageRect || refreshRect();
  }

  function getWrapRect(){
    return wrapEl?.getBoundingClientRect() || getStageRect();
  }

  function rectOf(el){
    return el ? el.getBoundingClientRect() : null;
  }

  function ensureDebugBox(){
    if (!debug || !wrapEl || state.debugBox) return;

    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.position = 'absolute';
    el.style.border = '2px dashed rgba(255,90,90,.78)';
    el.style.background = 'rgba(255,90,90,.08)';
    el.style.borderRadius = '18px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '15';
    el.style.display = 'block';
    state.debugBox = el;
    wrapEl.appendChild(el);
  }

  function updateDebugBox(){
    if (!debug || !state.debugBox) return;

    const safe = getSafeSpawnBounds();
    state.debugBox.style.left = px(safe.left);
    state.debugBox.style.top = px(safe.top);
    state.debugBox.style.width = px(Math.max(0, safe.right - safe.left));
    state.debugBox.style.height = px(Math.max(0, safe.bottom - safe.top));
  }

  function getSafeSpawnBounds(extra = {}){
    const rect = getStageRect();
    const wrapRect = getWrapRect();

    const goalCardEl = document.querySelector('.goalCard.in-stage-goal');
    const bottomBarEl = document.querySelector('.bottomBar.in-stage-bottom');
    const progressEl = document.querySelector('.goalProgress');

    const goalRect = rectOf(goalCardEl);
    const bottomRect = rectOf(bottomBarEl);
    const progressRect = rectOf(progressEl);

    const defaultPadLeft = 12;
    const defaultPadRight = 12;
    const defaultPadTop = 54;
    const defaultPadBottom = 72;

    const padLeft = Number.isFinite(extra.padLeft) ? extra.padLeft : defaultPadLeft;
    const padRight = Number.isFinite(extra.padRight) ? extra.padRight : defaultPadRight;
    const padTop = Number.isFinite(extra.padTop) ? extra.padTop : defaultPadTop;
    const padBottom = Number.isFinite(extra.padBottom) ? extra.padBottom : defaultPadBottom;

    const width = Math.max(280, rect.width);
    const height = Math.max(340, rect.height);

    let top = padTop;
    let bottom = height - padBottom;

    // Compact mobile: กัน goal card ที่ย้ายมาไว้ใน stageWrap
    if (goalRect) {
      top = Math.max(top, Math.round(goalRect.bottom - wrapRect.top + 10));
    } else if (progressRect) {
      // Desktop/tablet: อย่างน้อยไม่ให้ติดแถบ progress ด้านบน
      top = Math.max(top, Math.round(progressRect.bottom - wrapRect.top + 10));
    }

    // Compact mobile: กัน bottom HUD ที่ย้ายมาไว้ใน stageWrap
    if (bottomRect) {
      bottom = Math.min(bottom, Math.round(bottomRect.top - wrapRect.top - 10));
    }

    const left = padLeft;
    const right = Math.max(left + 1, width - padRight);

    return {
      width,
      height,
      left,
      right,
      top: clamp(top, padTop, height - 120),
      bottom: clamp(bottom, 120, height - padBottom),
      padLeft,
      padRight,
      padTop,
      padBottom
    };
  }

  function getItemSize(item){
    const size = Math.round(num(item?.size, 72));
    return {
      w: Math.max(44, size),
      h: Math.max(44, size)
    };
  }

  function clampItemPoint(x, y, item){
    const safe = getSafeSpawnBounds();
    const size = getItemSize(item);

    const minX = safe.left;
    const maxX = Math.max(minX, safe.right - size.w);

    const minY = safe.top;
    const maxY = Math.max(minY, safe.bottom - size.h);

    return {
      x: clamp(num(x, 0), minX, maxX),
      y: clamp(num(y, 0), minY, maxY)
    };
  }

  function createItemElement(item){
    const size = Math.round(num(item?.size, 72));
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'item itemPulse';
    el.dataset.id = item.id;
    el.dataset.group = item.data?.group || '';
    el.dataset.size = String(size);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.innerHTML = `
      <div class="itemEmoji">${escapeHtml(item.data?.emoji || '🍽️')}</div>
      <div class="itemLabel">${escapeHtml(item.data?.label || 'item')}</div>
    `;
    return el;
  }

  function addItem(item, onHit){
    if (!item) return null;

    const el = createItemElement(item);
    item.el = el;

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (typeof onHit === 'function') onHit(item.id, performance.now(), ev);
    }, { passive:false });

    stageEl.appendChild(el);
    state.activeIds.add(item.id);
    drawItem(item);
    return el;
  }

  function drawItem(item){
    if (!item?.el) return;

    const safePoint = clampItemPoint(item.x, item.y, item);
    item.x = safePoint.x;
    item.y = safePoint.y;

    item.el.style.transform = `translate3d(${Math.round(item.x)}px, ${Math.round(item.y)}px, 0)`;
  }

  function setItemOpacity(item, opacity = 1){
    if (!item?.el) return;
    item.el.style.opacity = String(opacity);
  }

  function setItemGlow(item, kind = ''){
    if (!item?.el) return;
    item.el.classList.remove('goodGlow', 'badGlow');
    if (kind === 'good') item.el.classList.add('goodGlow');
    if (kind === 'bad') item.el.classList.add('badGlow');
  }

  function removeItem(item){
    if (!item) return;
    state.activeIds.delete(item.id);
    try{ item.el?.remove(); }catch{}
  }

  function clearItems(){
    state.activeIds.forEach((id) => {
      const el = stageEl.querySelector(`.item[data-id="${cssEscape(id)}"]`);
      try{ el?.remove(); }catch{}
    });
    state.activeIds.clear();
  }

  function reconcileSafeTargets(){
    const items = Array.from(stageEl.querySelectorAll('.item'));
    items.forEach((el) => {
      const id = el.dataset.id || '';
      const size = Math.max(44, Math.round(num(el.dataset.size, el.offsetWidth || 72)));

      const matrix = readTranslate(el);
      const safe = getSafeSpawnBounds();

      const minX = safe.left;
      const maxX = Math.max(minX, safe.right - size);
      const minY = safe.top;
      const maxY = Math.max(minY, safe.bottom - size);

      const x = clamp(matrix.x, minX, maxX);
      const y = clamp(matrix.y, minY, maxY);

      if (Math.abs(x - matrix.x) > 0.5 || Math.abs(y - matrix.y) > 0.5) {
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      }
    });
  }

  function showBanner(text, ms = 1200){
    if (!bannerEl) return;
    bannerEl.textContent = text;
    bannerEl.classList.add('show');
    clearTimeout(state.bannerTimer);
    state.bannerTimer = setTimeout(hideBanner, ms);
  }

  function hideBanner(){
    if (!bannerEl) return;
    bannerEl.classList.remove('show');
  }

  function setGoalProgress(done = 0, need = 0){
    if (!goalFillEl) return;
    const pct = need > 0 ? (Number(done) / Number(need)) * 100 : 0;
    goalFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function popFx(x, y, text, kind = 'good'){
    const fx = document.createElement('div');
    fx.className = `popFx ${kind === 'good' ? 'good' : 'bad'}`;
    fx.textContent = String(text || '');
    fx.style.left = `${Math.round(x)}px`;
    fx.style.top = `${Math.round(y)}px`;
    stageEl.appendChild(fx);
    setTimeout(() => {
      try{ fx.remove(); }catch{}
    }, 580);
  }

  function getItemElementAtClientPoint(clientX, clientY){
    const node = document.elementFromPoint(clientX, clientY);
    return node && node.closest ? node.closest('.item') : null;
  }

  function getItemIdAtClientPoint(clientX, clientY){
    const el = getItemElementAtClientPoint(clientX, clientY);
    return el?.dataset?.id || '';
  }

  function getSpawnPoint(itemSize = 72, extra = {}){
    const safe = getSafeSpawnBounds(extra);
    const size = Math.max(44, Math.round(num(itemSize, 72)));

    const minX = safe.left;
    const maxX = Math.max(minX, safe.right - size);

    const minY = safe.top;
    const maxY = Math.max(minY, safe.bottom - size);

    return {
      x: Math.round(minX + Math.random() * Math.max(0, maxX - minX)),
      y: Math.round(minY + Math.random() * Math.max(0, maxY - minY))
    };
  }

  function debugInfo(){
    const rect = getStageRect();
    const safe = getSafeSpawnBounds();
    return {
      patch: GROUPS_PATCH_RENDERER,
      stage: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      safe: {
        left: safe.left,
        right: safe.right,
        top: safe.top,
        bottom: safe.bottom
      },
      activeCount: state.activeIds.size
    };
  }

  function destroy(){
    clearTimeout(state.bannerTimer);
    clearItems();
    hideBanner();

    if (state.resizeHandler) {
      window.removeEventListener('resize', state.resizeHandler);
      state.resizeHandler = null;
    }
    if (state.orientationHandler) {
      window.removeEventListener('orientationchange', state.orientationHandler);
      state.orientationHandler = null;
    }

    try{ state.debugBox?.remove(); }catch{}
    state.debugBox = null;
    state.mounted = false;
  }

  const api = {
    mount,
    refreshRect,
    getStageRect,
    getSafeSpawnBounds,
    getSpawnPoint,
    addItem,
    drawItem,
    setItemOpacity,
    setItemGlow,
    removeItem,
    clearItems,
    reconcileSafeTargets,
    showBanner,
    hideBanner,
    setGoalProgress,
    popFx,
    getItemElementAtClientPoint,
    getItemIdAtClientPoint,
    debugInfo,
    destroy
  };

  if (debug) {
    window.__GROUPS_RENDERER__ = api;
  }

  return api;
}

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscape(value){
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function num(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function px(v){
  return `${Math.round(v)}px`;
}

function readTranslate(el){
  const tr = getComputedStyle(el).transform;
  if (!tr || tr === 'none') return { x: 0, y: 0 };

  try {
    const m = new DOMMatrixReadOnly(tr);
    return { x: m.m41, y: m.m42 };
  } catch {
    const match = tr.match(/matrix(?:3d)?\((.+)\)/);
    if (!match) return { x: 0, y: 0 };
    const parts = match[1].split(',').map(Number);
    if (tr.startsWith('matrix3d(')) {
      return { x: parts[12] || 0, y: parts[13] || 0 };
    }
    return { x: parts[4] || 0, y: parts[5] || 0 };
  }
}