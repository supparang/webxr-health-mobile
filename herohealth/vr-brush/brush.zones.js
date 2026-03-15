// /herohealth/vr-brush/brush.zones.js

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

  function pointInZone(idx, x, y){
    const zs = S.zoneState[idx];
    if(!zs?.el || !arenaCore) return false;

    const zr = zs.el.getBoundingClientRect();
    const ar = arenaCore.getBoundingClientRect();
    const px = ar.left + x;
    const py = ar.top + y;

    return px >= zr.left && px <= zr.right && py >= zr.top && py <= zr.bottom;
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
      height: r.height
    };
  }

  function renderDirtForZone(idx){
    const zs = S.zoneState[idx];
    const meta = ZONES[idx];
    if(!zs?.dirtEl || !meta) return;

    zs.dirtEl.innerHTML = '';
    const count = clamp(Math.ceil((zs.dirt || 0) / 12), 0, 8);

    for(let i=0;i<count;i++){
      const blob = document.createElement('div');
      let klass = meta.dirtType;

      if(S.bossStarted && idx === S.activeZoneIdx && !S.bossCompleted){
        klass = 'boss';
      }

      blob.className = `dirtBlob ${klass}`;

      const horizontal = meta.dir === 'horizontal';
      if(klass === 'boss'){
        const size = 16 + Math.random()*28;
        blob.style.width = size + 'px';
        blob.style.height = size + 'px';
      } else if(horizontal){
        blob.style.width = (18 + Math.random()*34) + 'px';
        blob.style.height = (6 + Math.random()*6) + 'px';
      } else {
        blob.style.width = (6 + Math.random()*6) + 'px';
        blob.style.height = (18 + Math.random()*34) + 'px';
      }

      blob.style.left = (10 + Math.random()*72) + '%';
      blob.style.top = (16 + Math.random()*56) + '%';
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

  function buildZones(onZonePointerDown){
    if(!zoneLayer || !zoneList) return;

    zoneLayer.innerHTML = '';
    zoneList.innerHTML = '';

    S.zoneState.forEach((zs, idx)=>{
      const meta = ZONES[idx];

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'zone';

      if (CFG.view === 'mobile' || CFG.view === 'cvr' || window.innerWidth <= 760) {
        el.classList.add('tapBoost');
      }

      el.style.left = meta.x + '%';
      el.style.top = meta.y + '%';
      el.style.width = meta.w + '%';
      el.style.height = meta.h + '%';
      el.dataset.zoneId = zs.id;

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
        onZonePointerDown?.(idx, ev);
      });

      zoneLayer.appendChild(el);

      const item = document.createElement('div');
      item.className = 'zoneItem';
      item.id = 'zoneItem_' + zs.id;
      item.innerHTML = `
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
    renderDirtForZone,
    refreshAllDirt,
    markZoneCompleted,
    maybeAdvanceZone,
    buildZones
  };
}