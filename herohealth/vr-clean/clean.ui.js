// === /herohealth/vr-clean/clean.ui.js ===
// Clean Objects UI — Grid renderer + HUD + Summary — MVP v20260223
'use strict';

import { ZONES, MAP } from './clean.data.js';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html!==undefined) n.innerHTML = html;
  return n;
}

function escapeHtml(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function clamp(v,min,max){ v=Number(v); if(!Number.isFinite(v)) v=min; return Math.max(min, Math.min(max, v)); }

function fmt(n){
  n = Number(n||0);
  if(!Number.isFinite(n)) n = 0;
  return String(Math.round(n));
}

function zoneName(id){
  const z = ZONES.find(z=>z.id===id);
  return z ? z.name : id;
}

function surfaceLabel(s){
  const m = {
    metal:'Metal', plastic:'Plastic', glass:'Glass', wood:'Wood', tile:'Tile', fabric:'Fabric'
  };
  return m[String(s||'').toLowerCase()] || String(s||'');
}

function touchLabel(t){
  t = Number(t||0);
  if(t>=0.9) return 'High';
  if(t>=0.55) return 'Med';
  return 'Low';
}

function trafficLabel(t){
  t = Number(t||0);
  if(t>=0.9) return 'High';
  if(t>=0.55) return 'Med';
  return 'Low';
}

function makeReasonChips(){
  const wrap = el('div','reasonChips');
  const items = [
    { tag:'risk_high',   txt:'เสี่ยงสูง' },
    { tag:'touch_high',  txt:'จุดสัมผัสบ่อย' },
    { tag:'traffic_high',txt:'คนใช้/ผ่านบ่อย' },
    { tag:'old_clean',   txt:'ไม่ได้ทำความสะอาดนาน' },
    { tag:'shared_use',  txt:'ใช้ร่วมกัน' },
    { tag:'wet_area',    txt:'พื้นที่เปียก' },
  ];
  wrap.innerHTML = items.map(i=>`<button class="chip" type="button" data-tag="${i.tag}">${escapeHtml(i.txt)}</button>`).join('');
  return wrap;
}

export function mountCleanUI(root, core){
  // --- layout
  root.innerHTML = '';
  root.classList.add('cleanApp');

  const top = el('header','hud');
  top.innerHTML = `
    <div class="hudRow">
      <div class="pill" id="pillMode">MODE: —</div>
      <div class="pill" id="pillTime">TIME: —</div>
      <div class="pill" id="pillRes">—</div>
    </div>
    <div class="hudRow">
      <div class="pill" id="pillScore">SCORE: —</div>
      <div class="pill" id="pillHint">—</div>
    </div>
  `;

  const board = el('main','board');
  const grid = el('div','grid');
  const overlay = el('div','overlay');

  const info = el('aside','info');
  info.innerHTML = `
    <div class="infoH">
      <div class="infoT" id="infoTitle">Select a spot</div>
      <div class="infoSub" id="infoSub">ดูข้อมูลจุดเสี่ยง แล้วตัดสินใจ</div>
    </div>
    <div class="infoBody" id="infoBody">
      <div class="kv"><span>Risk</span><b id="iRisk">—</b></div>
      <div class="kv"><span>Traffic</span><b id="iTraffic">—</b></div>
      <div class="kv"><span>Surface</span><b id="iSurf">—</b></div>
      <div class="kv"><span>Touch</span><b id="iTouch">—</b></div>
      <div class="kv"><span>Last cleaned</span><b id="iOld">—</b></div>
      <div class="tags" id="iTags"></div>

      <div class="actions" id="actionsA" style="display:none;">
        <button class="btn primary" id="btnClean" type="button">Clean (ใช้ 1 น้ำยา)</button>
        <div class="mut" id="reasonHint">เลือกเหตุผล (optional) แล้วกด Clean</div>
        <div id="reasonWrap"></div>
      </div>

      <div class="actions" id="actionsB" style="display:none;">
        <button class="btn primary" id="btnRouteToggle" type="button">Add to Route</button>
        <button class="btn ghost" id="btnUndo" type="button">Undo</button>
        <button class="btn ghost" id="btnClear" type="button">Clear</button>
        <button class="btn" id="btnSubmit" type="button">Submit plan</button>
        <div class="mut" id="routeHint">เลือกจุดให้ครบตามจำนวน แล้ว Submit</div>
      </div>
    </div>
  `;

  const routePanel = el('section','routePanel');
  routePanel.innerHTML = `
    <div class="rpH">
      <div class="rpT">Route</div>
      <div class="rpSub" id="rpSub">—</div>
    </div>
    <div class="rpList" id="rpList"></div>
  `;

  const summary = el('section','summary', '');
  summary.style.display = 'none';

  board.appendChild(grid);
  board.appendChild(overlay);

  root.appendChild(top);
  root.appendChild(board);
  root.appendChild(info);
  root.appendChild(routePanel);
  root.appendChild(summary);

  // --- build grid background
  buildGrid(grid);

  // --- state
  let selectedHotspotId = null;
  let selectedUserReasonTag = null; // A mode optional
  const reasonWrap = info.querySelector('#reasonWrap');
  const chips = makeReasonChips();
  reasonWrap.appendChild(chips);

  chips.addEventListener('click', (e)=>{
    const b = e.target.closest('.chip');
    if(!b) return;
    selectedUserReasonTag = b.getAttribute('data-tag') || null;
    chips.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on', x===b));
  });

  // --- create hotspot markers layer
  const markerLayer = el('div','markerLayer');
  grid.appendChild(markerLayer);

  function renderHotspots(S){
    markerLayer.innerHTML = '';
    const hs = S.hotspots || [];
    for(const h of hs){
      const m = el('button','spot');
      m.type = 'button';
      m.dataset.id = h.id;
      m.style.left = `calc(${(h.x + 0.5)/MAP.w*100}% - 14px)`;
      m.style.top  = `calc(${(h.y + 0.5)/MAP.h*100}% - 14px)`;

      // visual weight: risk level
      const r = clamp(h.risk,0,100);
      m.classList.toggle('rHigh', r>=75);
      m.classList.toggle('rMed', r>=55 && r<75);
      m.classList.toggle('rLow', r<55);

      // selected indicator
      m.classList.toggle('isFocus', h.id === selectedHotspotId);

      // A: cleaned marker if selected list contains it
      const selA = (S.A?.selected || []).some(s=>s.id===h.id);
      m.classList.toggle('isCleaned', !!selA);

      // B: in route marker
      const inRoute = (S.B?.routeIds || []).includes(h.id);
      m.classList.toggle('isRoute', !!inRoute);

      // label (short)
      m.innerHTML = `<span class="dot"></span><span class="lab">${escapeHtml(h.name)}</span>`;
      markerLayer.appendChild(m);
    }
  }

  // --- UI helpers
  function setInfoForHotspot(h, S){
    if(!h){
      info.querySelector('#infoTitle').textContent = 'Select a spot';
      info.querySelector('#infoSub').textContent = 'ดูข้อมูลจุดเสี่ยง แล้วตัดสินใจ';
      info.querySelector('#iRisk').textContent = '—';
      info.querySelector('#iTraffic').textContent = '—';
      info.querySelector('#iSurf').textContent = '—';
      info.querySelector('#iTouch').textContent = '—';
      info.querySelector('#iOld').textContent = '—';
      info.querySelector('#iTags').innerHTML = '';
      return;
    }

    info.querySelector('#infoTitle').textContent = h.name;
    info.querySelector('#infoSub').textContent = `${zoneName(h.zone)} • ${surfaceLabel(h.surfaceType)}`;

    info.querySelector('#iRisk').textContent = fmt(h.risk);
    info.querySelector('#iTraffic').textContent = trafficLabel(h.traffic);
    info.querySelector('#iSurf').textContent = surfaceLabel(h.surfaceType);
    info.querySelector('#iTouch').textContent = touchLabel(h.touchLevel);

    const mins = Number(h.timeLastCleanedMin||0);
    const hours = Math.round(mins/60);
    info.querySelector('#iOld').textContent = hours>=24 ? `${Math.round(hours/24)}d` : `${hours}h`;

    const tags = (h.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('');
    info.querySelector('#iTags').innerHTML = tags || '<span class="mut">—</span>';

    // mode actions
    const isA = (S.mode === 'A');
    const aA = info.querySelector('#actionsA');
    const aB = info.querySelector('#actionsB');

    aA.style.display = isA ? '' : 'none';
    aB.style.display = (!isA) ? '' : 'none';

    if(isA){
      // clean button enabled?
      const can = (S.A?.spraysLeft||0) > 0 && !(S.A?.selected||[]).some(s=>s.id===h.id);
      const btn = info.querySelector('#btnClean');
      btn.disabled = !can;
    }else{
      const inRoute = (S.B?.routeIds || []).includes(h.id);
      const btn = info.querySelector('#btnRouteToggle');
      btn.textContent = inRoute ? 'Remove from Route' : 'Add to Route';
      btn.disabled = (!inRoute) && ((S.B?.routeIds||[]).length >= (S.B?.maxPoints||5));
    }
  }

  function setHUD(S){
    const pillMode = top.querySelector('#pillMode');
    const pillTime = top.querySelector('#pillTime');
    const pillRes = top.querySelector('#pillRes');
    const pillScore = top.querySelector('#pillScore');
    const pillHint = top.querySelector('#pillHint');

    pillMode.textContent = `MODE: ${S.mode === 'A' ? 'A (Evaluate)' : 'B (Create)'}`;
    pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;

    if(S.mode === 'A'){
      pillRes.textContent = `SPRAY: ${fmt(S.A?.spraysLeft||0)} / ${fmt((S.A?.selected||[]).length)} chosen`;
      pillHint.textContent = 'เลือก 3 จุดที่คุ้มที่สุดภายในทรัพยากรจำกัด';
    } else {
      pillRes.textContent = `ROUTE: ${fmt((S.B?.routeIds||[]).length)} / ${fmt(S.B?.maxPoints||5)} points`;
      pillHint.textContent = 'วางแผนเส้นทางให้ครอบคลุมและสมดุล';
    }

    // score preview (simple): show selected count / route count; real score on summary
    if(S.mode === 'A'){
      const rr = (S.A?.selected||[]).reduce((a,b)=> a+Number(b.rr||0), 0);
      pillScore.textContent = `SCORE: RR ${fmt(rr)} (preview)`;
    } else {
      pillScore.textContent = `SCORE: plan building…`;
    }
  }

  function renderRoutePanel(S){
    const rpSub = routePanel.querySelector('#rpSub');
    const rpList = routePanel.querySelector('#rpList');

    if(S.mode === 'A'){
      rpSub.textContent = `Selected ${fmt((S.A?.selected||[]).length)} / 3`;
      const list = (S.A?.selected||[]).map((s, i)=>{
        const h = (S.hotspots||[]).find(x=>x.id===s.id);
        const name = h ? h.name : s.id;
        return `
          <div class="rpItem">
            <div class="rpIdx">${i+1}</div>
            <div class="rpMain">
              <div class="rpName">${escapeHtml(name)}</div>
              <div class="rpMeta">RR ${fmt(s.rr)} • ${escapeHtml(s.reasonText||'—')}</div>
            </div>
          </div>
        `;
      }).join('');
      rpList.innerHTML = list || `<div class="mut">—</div>`;
      return;
    }

    rpSub.textContent = `Route ${fmt((S.B?.routeIds||[]).length)} / ${fmt(S.B?.maxPoints||5)}`;
    const list = (S.B?.routeIds||[]).map((id, i)=>{
      const h = (S.hotspots||[]).find(x=>x.id===id);
      const name = h ? h.name : id;
      const z = h ? zoneName(h.zone) : '';
      return `
        <div class="rpItem">
          <div class="rpIdx">${i+1}</div>
          <div class="rpMain">
            <div class="rpName">${escapeHtml(name)}</div>
            <div class="rpMeta">${escapeHtml(z)} • ${escapeHtml(h ? surfaceLabel(h.surfaceType) : '')}</div>
          </div>
        </div>
      `;
    }).join('');
    rpList.innerHTML = list || `<div class="mut">—</div>`;
  }

  function showSummary(payload){
    summary.style.display = '';
    const m = payload.metrics || {};
    const b = m.breakdown || {};
    const isA = (m.mode === 'A');

    const items = isA
      ? (m.reasons || []).map(r=>{
          const h = getHotspot(r.id);
          const name = h ? h.name : r.id;
          return `<li><b>${escapeHtml(name)}</b> — RR ${fmt(r.rr)} • ${escapeHtml(r.reasonText||'—')}</li>`;
        }).join('')
      : (m.routeIds || []).map(id=>{
          const h = getHotspot(id);
          const name = h ? h.name : id;
          const z = h ? zoneName(h.zone) : '';
          return `<li><b>${escapeHtml(name)}</b> — ${escapeHtml(z)} • ${escapeHtml(h ? surfaceLabel(h.surfaceType) : '')}</li>`;
        }).join('');

    const breakdownHtml = isA
      ? `
        <div class="sumGrid">
          <div class="sumBox"><div class="k">RR</div><div class="v">${fmt(b.rrTotal)}</div></div>
          <div class="sumBox"><div class="k">Coverage</div><div class="v">${fmt(b.coverage)}%</div></div>
          <div class="sumBox"><div class="k">DQ</div><div class="v">${fmt(b.dq)}%</div></div>
          <div class="sumBox"><div class="k">Score</div><div class="v">${fmt(payload.score)}</div></div>
        </div>
      `
      : `
        <div class="sumGrid">
          <div class="sumBox"><div class="k">Coverage</div><div class="v">${fmt(b.coverageB)}%</div></div>
          <div class="sumBox"><div class="k">Balance</div><div class="v">${fmt(b.balanceScore)}%</div></div>
          <div class="sumBox"><div class="k">Remain</div><div class="v">${fmt(b.remainScore)}%</div></div>
          <div class="sumBox"><div class="k">Score</div><div class="v">${fmt(payload.score)}</div></div>
        </div>
      `;

    const badges = (payload.badges||[]).slice(0,10).map(x=>`<span class="badge">🏅 ${escapeHtml(x)}</span>`).join(' ') || '—';

    summary.innerHTML = `
      <div class="sumCard">
        <div class="sumTop">
          <div>
            <div class="sumTitle">${escapeHtml(payload.title || 'Clean Objects')}</div>
            <div class="sumSub">${escapeHtml(payload.zone)} • ${escapeHtml(payload.game)} • ${escapeHtml(payload.view||'')}</div>
          </div>
          <button class="btn ghost" id="btnCloseSum" type="button">Close</button>
        </div>

        ${breakdownHtml}

        <div class="sumBadges">${badges}</div>

        <div class="sumList">
          <div class="sumListH">${isA ? 'Choices (with reasons)' : 'Planned route'}</div>
          <ul>${items || '<li>—</li>'}</ul>
        </div>

        <div class="sumActions">
          <button class="btn primary" id="btnBackHub" type="button">Back to HUB</button>
          <button class="btn" id="btnReplay" type="button">Replay</button>
        </div>
      </div>
    `;

    summary.querySelector('#btnCloseSum').onclick = ()=> { summary.style.display='none'; };
  }

  function goHub(){
    const hub = core.cfg?.hub;
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  function replay(){
    // keep base URL but renew seed (optional)
    const u = new URL(location.href);
    if(u.searchParams.get('run') !== 'research'){
      u.searchParams.set('seed', String(Date.now()));
    }
    location.href = u.toString();
  }

  // --- interactions
  markerLayer.addEventListener('click', (e)=>{
    const b = e.target.closest('.spot');
    if(!b) return;
    const id = b.dataset.id;
    selectHotspot(id);
  });

  // Support “shoot” event from vr-ui.js (crosshair tap-to-shoot)
  window.addEventListener('hha:shoot', (e)=>{
    // Prefer coords if provided; else shoot from center
    let x = window.innerWidth/2;
    let y = window.innerHeight/2;
    try{
      if(e && e.detail){
        if(Number.isFinite(e.detail.clientX)) x = e.detail.clientX;
        if(Number.isFinite(e.detail.clientY)) y = e.detail.clientY;
      }
    }catch(_){}

    const hit = document.elementFromPoint(x, y);
    const b = hit ? hit.closest('.spot') : null;
    if(b){
      selectHotspot(b.dataset.id);
      // for mode B: quick add/remove
      const S = core.snapshot();
      if(S.mode === 'B'){
        core.toggleRouteB(b.dataset.id);
      }
      // for mode A: just focus; user presses Clean
    }
  });

  function selectHotspot(id){
    selectedHotspotId = id;
    selectedUserReasonTag = null;
    chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
    const S = core.snapshot();
    const h = (S.hotspots||[]).find(x=>x.id===id) || null;
    setInfoForHotspot(h, S);
    renderHotspots(S);
  }

  // Buttons
  info.querySelector('#btnClean').onclick = ()=>{
    const id = selectedHotspotId;
    if(!id) return;
    const res = core.selectA(id, selectedUserReasonTag);
    if(!res?.ok) return;
    selectedUserReasonTag = null;
    chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
    const S = core.snapshot();
    const h = (S.hotspots||[]).find(x=>x.id===id) || null;
    setInfoForHotspot(h, S);
    renderHotspots(S);
    renderRoutePanel(S);
    setHUD(S);
  };

  info.querySelector('#btnRouteToggle').onclick = ()=>{
    const id = selectedHotspotId;
    if(!id) return;
    core.toggleRouteB(id);
    const S = core.snapshot();
    const h = (S.hotspots||[]).find(x=>x.id===id) || null;
    setInfoForHotspot(h, S);
    renderHotspots(S);
    renderRoutePanel(S);
    setHUD(S);
  };

  info.querySelector('#btnUndo').onclick = ()=>{ core.undoB(); const S=core.snapshot(); renderHotspots(S); renderRoutePanel(S); setHUD(S); };
  info.querySelector('#btnClear').onclick = ()=>{ core.clearB(); const S=core.snapshot(); renderHotspots(S); renderRoutePanel(S); setHUD(S); };
  info.querySelector('#btnSubmit').onclick = ()=>{ core.submitB(); };

  // --- render loop hooks
  function onState(S){
    setHUD(S);
    renderHotspots(S);
    renderRoutePanel(S);

    // keep info panel synced with focused
    const h = selectedHotspotId ? (S.hotspots||[]).find(x=>x.id===selectedHotspotId) : null;
    setInfoForHotspot(h, S);

    // route panel only really relevant in B, but useful in A too (show selected)
    routePanel.style.display = '';

    // overlay hint for cVR
    if(S.mode === 'B' && String(S.cfg?.view||'').toLowerCase()==='cvr'){
      overlay.innerHTML = `
        <div class="ovHint">
          <div class="ovT">Cardboard Mode</div>
          <div class="ovS">เล็งที่จุดแล้ว “ยิง/แตะ” เพื่อเพิ่มเข้า Route</div>
        </div>
      `;
      overlay.style.pointerEvents = 'none';
    }else{
      overlay.innerHTML = '';
    }
  }

  function onTick(S){
    setHUD(S);
  }

  function onSummary(payload){
    showSummary(payload);

    // wire summary buttons (after DOM injected)
    const btnBack = summary.querySelector('#btnBackHub');
    const btnReplay = summary.querySelector('#btnReplay');
    if(btnBack) btnBack.onclick = goHub;
    if(btnReplay) btnReplay.onclick = replay;
  }

  return { onState, onTick, onSummary };
}

function buildGrid(grid){
  // background zones
  const bg = el('div','gridBg');
  bg.innerHTML = ZONES.map(z=>{
    const left = (z.x / MAP.w) * 100;
    const top  = (z.y / MAP.h) * 100;
    const w    = (z.w / MAP.w) * 100;
    const h    = (z.h / MAP.h) * 100;
    return `
      <div class="zoneRect" style="left:${left}%;top:${top}%;width:${w}%;height:${h}%;">
        <span class="zoneLab">${escapeHtml(z.name)}</span>
      </div>
    `;
  }).join('');
  grid.appendChild(bg);

  // grid lines
  const lines = el('div','gridLines');
  const v = [];
  for(let x=0;x<=MAP.w;x++){
    v.push(`<div class="vLine" style="left:${(x/MAP.w)*100}%;"></div>`);
  }
  const h = [];
  for(let y=0;y<=MAP.h;y++){
    h.push(`<div class="hLine" style="top:${(y/MAP.h)*100}%;"></div>`);
  }
  lines.innerHTML = v.join('') + h.join('');
  grid.appendChild(lines);
}