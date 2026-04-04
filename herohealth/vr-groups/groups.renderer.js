// /herohealth/vr-groups/groups.renderer.js
// Groups Solo Renderer
// PATCH v20260404-groups-renderer-r1

export const GROUPS_PATCH_RENDERER = 'v20260404-groups-renderer-r1';

export function createGroupsRenderer(options = {}){
  const stageEl = options.stageEl;
  const bannerEl = options.bannerEl || null;
  const goalFillEl = options.goalFillEl || null;
  const debug = !!options.debug;

  if (!stageEl) {
    throw new Error('createGroupsRenderer requires stageEl');
  }

  const state = {
    mounted: false,
    stageRect: null,
    activeIds: new Set(),
    bannerTimer: 0
  };

  function mount(){
    if (state.mounted) return api;
    refreshRect();
    state.mounted = true;
    return api;
  }

  function refreshRect(){
    state.stageRect = stageEl.getBoundingClientRect();
    return state.stageRect;
  }

  function getStageRect(){
    return state.stageRect || refreshRect();
  }

  function getSafeSpawnBounds(extra = {}){
    const rect = getStageRect();
    const padLeft = Number.isFinite(extra.padLeft) ? extra.padLeft : 12;
    const padRight = Number.isFinite(extra.padRight) ? extra.padRight : 12;
    const padTop = Number.isFinite(extra.padTop) ? extra.padTop : 54;
    const padBottom = Number.isFinite(extra.padBottom) ? extra.padBottom : 72;

    const width = Math.max(280, rect.width);
    const height = Math.max(340, rect.height);

    return {
      width,
      height,
      left: padLeft,
      right: Math.max(padLeft + 1, width - padRight),
      top: padTop,
      bottom: Math.max(padTop + 1, height - padBottom),
      padLeft,
      padRight,
      padTop,
      padBottom
    };
  }

  function createItemElement(item){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'item itemPulse';
    el.dataset.id = item.id;
    el.dataset.group = item.data?.group || '';
    el.style.width = `${Math.round(item.size)}px`;
    el.style.height = `${Math.round(item.size)}px`;
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
    state.mounted = false;
  }

  const api = {
    mount,
    refreshRect,
    getStageRect,
    getSafeSpawnBounds,
    addItem,
    drawItem,
    setItemOpacity,
    setItemGlow,
    removeItem,
    clearItems,
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