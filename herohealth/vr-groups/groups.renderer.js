// /herohealth/vr-groups/groups.renderer.js
// Groups Renderer
// PATCH v20260405-groups-renderer-r1

export const GROUPS_PATCH_RENDERER = 'v20260405-groups-renderer-r1';

export function createGroupsRenderer({
  stageEl,
  bannerEl,
  goalFillEl,
  debug = false
} = {}){
  if (!stageEl) throw new Error('createGroupsRenderer requires stageEl');

  const state = {
    rect: null,
    items: new Map(),
    bannerTimer: 0,
    goalCurrent: 0,
    goalNeed: 1
  };

  function mount(){
    refreshRect();
  }

  function destroy(){
    clearItems();
    hideBanner();
  }

  function refreshRect(){
    state.rect = stageEl.getBoundingClientRect();
    return state.rect;
  }

  function getStageRect(){
    return state.rect || refreshRect();
  }

  function getSafeSpawnBounds({
    padLeft = 12,
    padRight = 12,
    padTop = 54,
    padBottom = 72
  } = {}){
    const rect = getStageRect();
    return {
      left: padLeft,
      right: Math.max(padLeft + 1, rect.width - padRight),
      top: padTop,
      bottom: Math.max(padTop + 1, rect.height - padBottom),
      padLeft,
      padRight,
      padTop,
      padBottom
    };
  }

  function addItem(item, onHit){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'item';
    btn.dataset.itemId = item.id;
    btn.style.width = `${item.size}px`;
    btn.style.height = `${item.size}px`;
    btn.innerHTML = `
      <div class="itemEmoji">${escapeHtml(item.data.emoji)}</div>
      <div class="itemLabel">${escapeHtml(item.data.label)}</div>
    `;

    const clickHandler = () => {
      onHit?.(item.id, performance.now());
    };

    btn.addEventListener('click', clickHandler);
    item.el = btn;
    item._clickHandler = clickHandler;

    stageEl.appendChild(btn);
    state.items.set(item.id, item);
  }

  function drawItem(item){
    if (!item?.el) return;
    item.el.style.transform = `translate3d(${Math.round(item.x)}px, ${Math.round(item.y)}px, 0)`;
    item.el.style.width = `${Math.round(item.size)}px`;
    item.el.style.height = `${Math.round(item.size)}px`;
  }

  function removeItem(item){
    if (!item) return;
    const ref = state.items.get(item.id) || item;
    if (ref?.el && ref._clickHandler) {
      ref.el.removeEventListener('click', ref._clickHandler);
    }
    try{
      ref?.el?.remove();
    }catch{}
    state.items.delete(item.id);
  }

  function clearItems(){
    [...state.items.values()].forEach((item) => removeItem(item));
    stageEl.querySelectorAll('.item').forEach((el) => el.remove());
    state.items.clear();
  }

  function setItemOpacity(item, opacity = 1){
    if (!item?.el) return;
    item.el.style.opacity = String(opacity);
  }

  function setItemGlow(item, kind = 'good'){
    if (!item?.el) return;
    item.el.classList.remove('goodGlow', 'badGlow');
    item.el.classList.add(kind === 'good' ? 'goodGlow' : 'badGlow');
  }

  function popFx(x, y, text, kind = 'good'){
    const el = document.createElement('div');
    el.className = `popFx ${kind === 'good' ? 'good' : 'bad'}`;
    el.textContent = String(text || '');
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    stageEl.appendChild(el);
    setTimeout(() => {
      try{ el.remove(); }catch{}
    }, 560);
  }

  function showBanner(text, ms = 1200){
    if (!bannerEl) return;
    hideBanner();
    bannerEl.textContent = String(text || '');
    bannerEl.classList.add('show');
    state.bannerTimer = window.setTimeout(() => {
      bannerEl.classList.remove('show');
      state.bannerTimer = 0;
    }, Math.max(300, Number(ms || 1200)));
  }

  function hideBanner(){
    if (!bannerEl) return;
    if (state.bannerTimer){
      clearTimeout(state.bannerTimer);
      state.bannerTimer = 0;
    }
    bannerEl.classList.remove('show');
  }

  function setGoalProgress(current = 0, need = 1){
    state.goalCurrent = Number(current || 0);
    state.goalNeed = Math.max(1, Number(need || 1));
    if (!goalFillEl) return;
    const pct = Math.max(0, Math.min(100, (state.goalCurrent / state.goalNeed) * 100));
    goalFillEl.style.width = `${pct}%`;
  }

  function getItemIdAtClientPoint(clientX, clientY){
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return '';
    const itemEl = el.closest?.('.item');
    return itemEl?.dataset?.itemId || '';
  }

  function debugInfo(){
    const rect = getStageRect();
    const safe = getSafeSpawnBounds();
    return {
      stage: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      safe,
      activeCount: state.items.size,
      debug
    };
  }

  return {
    mount,
    destroy,
    refreshRect,
    getStageRect,
    getSafeSpawnBounds,
    addItem,
    drawItem,
    removeItem,
    clearItems,
    setItemOpacity,
    setItemGlow,
    popFx,
    showBanner,
    hideBanner,
    setGoalProgress,
    getItemIdAtClientPoint,
    debugInfo
  };
}

function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
