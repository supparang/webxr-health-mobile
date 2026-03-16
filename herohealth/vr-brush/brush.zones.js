// /herohealth/vr-brush/brush.zones.js
// HOTFIX v20260316c-BRUSH-ZONES-MOBILE

export function createBrushZones({
  zoneLayer,
  zoneList,
  arenaCore,
  CFG,
  ZONES,
  S,
  ui
}){
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));

  function zoneCleanPct(zs){
    return clamp(Math.round(zs?.clean || 0), 0, 100);
  }

  function totalCleanPct(){
    const sum = S.zoneState.reduce((a,z)=> a + zoneCleanPct(z), 0);
    return Math.round(sum / Math.max(1, S.zoneState.length));
  }

  function pulseZone(idx, good){
    const zs = S.zoneState[idx];
    if(!zs?.el) return;
    zs.el.classList.remove('goodHit','badHit');
    void zs.el.offsetWidth;
    zs.el.classList.add(good ? 'goodHit' : 'badHit');
    setTimeout(()=> zs.el?.classList.remove('goodHit','badHit'), 180);
  }

  function zoneRectRelative(el){
    if(!el || !arenaCore) return null;
    const r = el.getBoundingClientRect();
    const base = arenaCore.getBoundingClientRect();
    return {
      left: r.left - base.left,
      top: r.top - base.top,
      width: r.width,
      height: r.height,
      right: r.right - base.left,
      bottom: r.bottom - base.top
    };
  }

  function pointInZone(idx, x, y){
    const zs = S.zoneState[idx];
    if(!zs?.el || !arenaCore) return false;

    const rr = zoneRectRelative(zs.el);
    if(!rr) return false;

    return x >= rr.left && x <= rr.right && y >= rr.top && y <= rr.bottom;
  }

  function clearZoneDirt(idx){
    const zs = S.zoneState[idx];
    if(zs?.dirtEl) zs.dirtEl.innerHTML = '';
  }

  function renderDirtForZone(idx){
    const zs = S.zoneState[idx];
    const meta = ZONES[idx];
    if(!zs?.dirtEl || !meta) return;

    zs.dirtEl.innerHTML = '';

    const count = clamp(Math.ceil((zs.dirt || 0) / 12), 0, 10);
    const horizontal = meta.dir === 'horizontal';

    for(let i=0;i<count;i++){
      const blob = document.createElement('div');
      let klass = meta.dirtType;

      if(S.bossStarted && idx === S.activeZoneIdx && !S.bossCompleted){
        klass = 'boss';
      }

      blob.className = `dirtBlob ${klass}`;

      if(klass === 'boss'){
        const size = 16 + Math.random()*26;
        blob.style.width = size + 'px';
        blob.style.height = size + 'px';
      } else if(horizontal){
        blob.style.width = (18 + Math.random()*34) + 'px';
        blob.style.height = (6 + Math.random()*7) + 'px';
      } else {
        blob.style.width = (6 + Math.random()*7) + 'px';
        blob.style.height = (18 + Math.random()*34) + 'px';
      }

      blob.style.left = (8 + Math.random()*76) + '%';
      blob.style.top = (14 + Math.random()*60) + '%';
      blob.style.animationDelay = (Math.random()*0.6).toFixed(2) + 's';

      zs.dirtEl.appendChild(blob);
    }
  }

  function refreshAllDirt(){
    S.zoneState.forEach((_, idx)=> renderDirtForZone(idx));
  }

  function markZoneCompleted(idx, targetClean){
    const zs = S.zoneState[idx];
    if(!zs) return false;

    if(zoneCleanPct(zs) >= targetClean && !zs.completed){
      zs.completed = true;
      return true;
    }
    return false;
  }

  function maybeAdvanceZone(){
    const active = S.zoneState[S.activeZoneIdx];
    if(!active || !active.completed) return;

    const nextIdx = S.zoneState.findIndex(z => !z.completed);
    if(nextIdx >= 0) S.activeZoneIdx = nextIdx;
  }

  function buildZoneItemHtml(zs){
    return `
      <div class="zoneRow">
        <div class="zoneName">${zs.label}</div>
        <div class="zonePct" id="zonePct_${zs.id}">0%</div>
      </div>
      <div class="miniBar"><div class="miniFill" id="zoneFill_${zs.id}"></div></div>
      <div class="zoneRow" style="margin-top:4px;">
        <div class="zonePct" id="zoneStars_${zs.id}">☆☆☆</div>
        <div class="zonePct" id="zoneNote_${zs.id}">ยังไม่จบ</div>
      </div>
    `;
  }

  function buildZones(onZonePointerDown){
    if(!zoneLayer || !zoneList) return;

    zoneLayer.innerHTML = '';
    zoneList.innerHTML = '';

    S.zoneState.forEach((zs, idx)=>{
      const meta = ZONES[idx];

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'zone';
      el.dataset.zoneId = zs.id;
      el.setAttribute('aria-label', zs.label);

      if (CFG.view === 'mobile' || CFG.view === 'cvr' || window.innerWidth <= 760) {
        el.classList.add('tapBoost');
      }

      el.style.left = meta.x + '%';
      el.style.top = meta.y + '%';
      el.style.width = meta.w + '%';
      el.style.height = meta.h + '%';

      const label = document.createElement('div');
      label.className = 'zoneLabel';
      label.textContent = zs.label;
      el.appendChild(label);

      const dir = document.createElement('div');
      dir.className = 'zoneDir';
      dir.textContent = meta.dir === 'horizontal' ? '↔' : '↕';
      el.appendChild(dir);

      const dirt = document.createElement('div');
      dirt.className = 'dirt';
      el.appendChild(dirt);

      zs.el = el;
      zs.dirtEl = dirt;

      renderDirtForZone(idx);

      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        onZonePointerDown?.(idx, ev);
      }, { passive:false });

      zoneLayer.appendChild(el);

      const item = document.createElement('div');
      item.className = 'zoneItem';
      item.id = 'zoneItem_' + zs.id;
      item.innerHTML = buildZoneItemHtml(zs);
      zoneList.appendChild(item);
    });

    ui?.refreshZoneUI?.();
  }

  return {
    zoneCleanPct,
    totalCleanPct,
    pointInZone,
    pulseZone,
    zoneRectRelative,
    clearZoneDirt,
    renderDirtForZone,
    refreshAllDirt,
    markZoneCompleted,
    maybeAdvanceZone,
    buildZones
  };
}