// === /herohealth/vr-clean/clean.ui.js ===
// Clean Objects UI — SAFE/PRODUCTION — v20260301-FULL-EXCITE1234
//
// ✅ Heat overlay
// ✅ A reason chips + Evaluate
// ✅ B route panel + realtime bars (from coach plan_live breakdown)
// ✅ Coach toast
// ✅ Summary: Go Cooldown / Back HUB / Replay
// ✅ hha:shoot support (Cardboard)
// 🔥 EXCITE: Danger pulse UI + contamination notice + summary shows bossPenalty + combo

'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}
function clamp(v,a,b){ v = Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
function fmt(v){ v = Number(v)||0; return String(Math.round(v)); }
function escapeHtml(s){
  s = String(s ?? '');
  return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cvr' || v==='cardboard' || v==='vr') return 'cvr';
  if(v==='mobile' || v==='m') return 'mobile';
  if(v==='pc' || v==='desktop') return 'pc';
  return v || '';
}
function reasonChipHTML(){
  const chips = [
    ['risk_high','เสี่ยงสูง'],
    ['touch_high','สัมผัสบ่อย'],
    ['traffic_high','คนผ่านบ่อย'],
    ['old_clean','ไม่ได้ทำความสะอาดนาน'],
    ['shared_use','ใช้ร่วมกัน'],
  ];
  return chips.map(([tag,lab])=>`<button class="chip" data-tag="${tag}" type="button">${lab}</button>`).join('');
}
function barsHTML(bd){
  if(!bd) return '';
  const bar = (label, v)=>`
    <div class="barRow">
      <div class="barLab">${label}</div>
      <div class="barTrack"><div class="barFill" style="width:${clamp(v,0,100)}%"></div></div>
      <div class="barVal">${fmt(v)}%</div>
    </div>`;
  return `
    <div class="bars">
      ${bar('Coverage', bd.coverageB)}
      ${bar('Balance',  bd.balanceScore)}
      ${bar('Remain',   bd.remainScore)}
    </div>
  `;
}

export function mountCleanUI(root, opts){
  opts = opts || {};
  root.innerHTML = '';

  const app = el('div','cleanApp');
  root.appendChild(app);

  const hud = el('div','hud');
  hud.innerHTML = `
    <div class="hudRow">
      <div class="pill" id="pillMode">MODE: —</div>
      <div class="pill" id="pillTime">TIME: 0</div>
      <div class="pill" id="pillBudget">BUDGET: —</div>
      <div class="pill" id="pillGoal">GOAL: —</div>
    </div>
  `;
  app.appendChild(hud);

  const board = el('div','board');
  const grid = el('div','grid');
  board.appendChild(grid);

  const heatLayer = el('div','heatLayer');
  const markerLayer = el('div','markerLayer');
  grid.appendChild(heatLayer);
  grid.appendChild(markerLayer);

  const overlay = el('div','overlay');
  overlay.innerHTML = `
    <div class="ovHint" id="ovHint">
      <div class="ovT" style="font-weight:1000">Clean Objects</div>
      <div class="ovS" style="font-size:12px;opacity:.85;margin-top:4px">
        แตะจุดบนแผนที่เพื่อทำความสะอาด/วางแผน • โหมด Cardboard ยิงด้วย crosshair ได้
      </div>
    </div>
  `;
  board.appendChild(overlay);
  app.appendChild(board);

  const info = el('div','info');
  info.innerHTML = `
    <div style="font-weight:1000;margin-bottom:6px">ภารกิจ</div>
    <div id="missionText" style="opacity:.9;line-height:1.45;font-size:13px"></div>
    <div style="margin-top:12px;font-weight:1000">เหตุผล (Evaluate)</div>
    <div id="reasonBox" style="margin-top:8px"></div>
    <div id="reasonNote" style="margin-top:8px;opacity:.85;font-size:12px;line-height:1.4"></div>
    <div id="helpBox" style="margin-top:12px;opacity:.85;font-size:12px;line-height:1.45"></div>
  `;
  app.appendChild(info);

  const routePanel = el('div','routePanel');
  routePanel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div>
        <div style="font-weight:1000">Route / รายการ</div>
        <div id="rpSub" style="opacity:.85;font-size:12px;margin-top:2px">—</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btnUndo" type="button">Undo</button>
        <button class="btn" id="btnClear" type="button">Clear</button>
        <button class="btn primary" id="btnSubmit" type="button">Submit</button>
      </div>
    </div>
    <div id="rpList" style="margin-top:10px"></div>
  `;
  app.appendChild(routePanel);

  // Coach toast
  const coachToast = el('div','coachToast');
  coachToast.style.display = 'none';
  coachToast.innerHTML = `<div class="ctInner">🤖 …</div>`;
  root.appendChild(coachToast);

  let toastTimer = null;
  function showCoach(text){
    coachToast.querySelector('.ctInner').innerHTML = `🤖 ${escapeHtml(text)}`;
    coachToast.style.display = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ coachToast.style.display='none'; }, 2600);
  }

  // Summary modal
  const summary = el('div','summary');
  summary.style.cssText = `
    position:fixed; inset:0; z-index:200; display:none;
    padding: calc(14px + var(--sat)) calc(14px + var(--sar)) calc(14px + var(--sab)) calc(14px + var(--sal));
    background: rgba(0,0,0,.55);
  `;
  summary.innerHTML = `
    <div style="max-width:860px;margin:0 auto;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.86);border-radius:22px;padding:14px;box-shadow:0 30px 90px rgba(0,0,0,.45)">
      <div style="font-weight:1100;font-size:18px">สรุปผล — Clean Objects</div>
      <div id="sumMeta" style="margin-top:6px;opacity:.9;font-size:12px;line-height:1.4"></div>
      <div id="sumBody" style="margin-top:10px;opacity:.95;font-size:13px;line-height:1.5"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end">
        <button class="btn primary" id="btnCooldown" type="button">Go Cooldown</button>
        <button class="btn" id="btnBackHub" type="button">Back to HUB</button>
        <button class="btn" id="btnReplay" type="button">Replay</button>
      </div>
    </div>
  `;
  root.appendChild(summary);

  // UI styles (safe)
  const style = el('style');
  style.textContent = `
    .btn{ border:1px solid rgba(148,163,184,.20); background: rgba(2,6,23,.45); color: rgba(229,231,235,.95);
      padding:10px 12px; border-radius:14px; font-weight:1000; cursor:pointer; }
    .btn.primary{ background: rgba(59,130,246,.28); border-color: rgba(59,130,246,.38); }
    .btn:active{ transform: translateY(1px); }
    .chip{ border:1px solid rgba(148,163,184,.18); background: rgba(2,6,23,.38); color: rgba(229,231,235,.92);
      padding: 8px 10px; border-radius: 999px; font-weight: 900; cursor:pointer; font-size:12px; }
    .chip.sel{ border-color: rgba(59,130,246,.55); background: rgba(59,130,246,.18); }

    .markerLayer{ position:absolute; inset:0; }
    .mk{
      position:absolute; width:28px; height:28px; border-radius:999px;
      border:1px solid rgba(148,163,184,.25); background: rgba(2,6,23,.55);
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:1000; cursor:pointer; user-select:none;
      box-shadow: 0 10px 30px rgba(0,0,0,.18);
    }
    .mk.on{ border-color: rgba(34,197,94,.55); background: rgba(34,197,94,.16); }
    .mk.warn{ border-color: rgba(251,191,36,.55); background: rgba(251,191,36,.12); }
    .mk.hot{ border-color: rgba(239,68,68,.55); background: rgba(239,68,68,.12); }
    .mk.boss{ outline: 2px solid rgba(239,68,68,.55); outline-offset: 2px; }

    /* danger pulse */
    .danger .hud{ box-shadow: 0 0 0 1px rgba(239,68,68,.25), 0 20px 60px rgba(239,68,68,.10); }
    .danger .ovHint{ border-color: rgba(239,68,68,.35); }
  `;
  root.appendChild(style);

  // --- state ---
  let lastState = null;
  let lastPlanBreakdown = null;
  let selectedReasonTag = 'risk_high';
  let dangerOn = false;
  let bossId = String(qs('boss','toilet_flush')||'toilet_flush');

  // elements
  const $ = (id)=> root.querySelector('#'+id);
  const pillMode = $('pillMode');
  const pillTime = $('pillTime');
  const pillBudget = $('pillBudget');
  const pillGoal = $('pillGoal');
  const missionText = $('missionText');
  const reasonBox = $('reasonBox');
  const reasonNote = $('reasonNote');
  const helpBox = $('helpBox');
  const rpSub = $('rpSub');
  const rpList = $('rpList');

  // reason chips
  reasonBox.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap">${reasonChipHTML()}</div>`;
  reasonNote.textContent = 'เลือกเหตุผล 1 ข้อ แล้วแตะ “จุด” เพื่อทำความสะอาด (ระบบจะใช้เหตุผลนี้ประกอบสรุป)';
  reasonBox.addEventListener('click', (e)=>{
    const b = e.target && e.target.closest('.chip');
    if(!b) return;
    selectedReasonTag = String(b.dataset.tag||'risk_high');
    for(const c of reasonBox.querySelectorAll('.chip')) c.classList.remove('sel');
    b.classList.add('sel');
  });
  const firstChip = reasonBox.querySelector('.chip');
  if(firstChip) firstChip.classList.add('sel');

  // heat render
  function renderHeat(S){
    heatLayer.innerHTML = '';
    const hs = S.hotspots || [];
    const w = (S.map && S.map.w) ? S.map.w : 10;
    const hN = (S.map && S.map.h) ? S.map.h : 10;

    for(const h of hs){
      const r = clamp(h.risk,0,100);
      const size = 22 + (r/100)*58;
      const alpha = 0.10 + (r/100)*0.30;
      const hueClass = (r>=75) ? 'hot' : (r>=55 ? 'warm' : 'cool');

      const n = el('div', `heat ${hueClass}`);
      n.style.left = `calc(${(Number(h.x)+0.5)/w*100}% - ${size/2}px)`;
      n.style.top  = `calc(${(Number(h.y)+0.5)/hN*100}% - ${size/2}px)`;
      n.style.width = `${size}px`;
      n.style.height = `${size}px`;
      n.style.opacity = String(alpha);
      heatLayer.appendChild(n);
    }
  }

  function markerClassForRisk(r){
    r = Number(r)||0;
    if(r >= 75) return 'hot';
    if(r >= 55) return 'warn';
    return '';
  }

  function renderMarkers(S){
    markerLayer.innerHTML = '';
    const hs = S.hotspots || [];
    const w = (S.map && S.map.w) ? S.map.w : 10;
    const hN = (S.map && S.map.h) ? S.map.h : 10;

    const chosenA = new Set((S.A?.selected||[]).map(x=>x.id));
    const chosenB = new Set((S.B?.routeIds||[]));

    for(const h of hs){
      const mk = el('div', `mk ${markerClassForRisk(h.risk)}`);
      const id = String(h.id);
      mk.dataset.id = id;

      const x = (Number(h.x)+0.5)/w*100;
      const y = (Number(h.y)+0.5)/hN*100;

      mk.style.left = `calc(${x}% - 14px)`;
      mk.style.top  = `calc(${y}% - 14px)`;

      const picked = (S.mode==='A') ? chosenA.has(id) : chosenB.has(id);
      if(picked) mk.classList.add('on');

      if(id === bossId) mk.classList.add('boss');

      mk.textContent = String(h.label || id).slice(0,2);

      mk.addEventListener('click', ()=>{
        if(!lastState || lastState.ended) return;
        if(lastState.mode === 'A'){
          opts.selectA && opts.selectA(id, selectedReasonTag);
        }else{
          opts.toggleRouteB && opts.toggleRouteB(id);
        }
      });

      markerLayer.appendChild(mk);
    }
  }

  function renderRoutePanel(S){
    if(S.mode === 'A'){
      routePanel.style.display = 'none';
      return;
    }
    routePanel.style.display = '';
    const ids = (S.B && S.B.routeIds) ? S.B.routeIds : [];
    rpSub.textContent = `Route ${fmt(ids.length)} / ${fmt(S.B?.maxPoints||5)}`;

    const hs = S.hotspots || [];
    const list = ids.length
      ? ids.map((id, i)=>{
          const h = hs.find(x=>String(x.id)===String(id));
          const t = h ? `${escapeHtml(h.name||id)} <span style="opacity:.75">(${escapeHtml(h.surfaceType||'')}, risk ${fmt(h.risk)}%)</span>` : escapeHtml(id);
          return `<div style="padding:8px 0;border-top:1px solid rgba(148,163,184,.10)"><b>${i+1}.</b> ${t}</div>`;
        }).join('')
      : `<div style="opacity:.8">ยังไม่มี route — แตะจุดเพื่อเพิ่ม</div>`;

    rpList.innerHTML = (barsHTML(lastPlanBreakdown) || '') + list;
  }

  function renderMission(S){
    if(S.mode === 'A'){
      missionText.innerHTML = `
        <b>Evaluate:</b> เลือกทำความสะอาด “คุ้มที่สุด” ภายใต้น้ำยา <b>${fmt(S.A?.maxSelect||3)}</b> ครั้ง และเวลา <b>${fmt(S.timeTotal||45)}s</b><br/>
        <span style="opacity:.92">🔥 มี “บอส” ที่ต้องจัดการ: <b>${escapeHtml(bossId)}</b> (ถ้าไม่ทำโดนหักหนัก)</span>
      `;
      helpBox.innerHTML = `Tip: เลือกเหตุผลก่อน แล้วแตะจุด • ช่วงท้ายจะ “เร่ง” • มีเหตุการณ์ปนเปื้อนกลางเกม`;
    }else{
      missionText.innerHTML = `
        <b>Create:</b> วางแผน route/checklist ภายในเวลา <b>${fmt(S.timeTotal||60)}s</b> เลือกได้ <b>${fmt(S.B?.maxPoints||5)}</b> จุด<br/>
        <span style="opacity:.92">🔥 อย่าลืม “บอส”: <b>${escapeHtml(bossId)}</b> (ถ้าไม่รวมใน route โดนหัก)</span>
      `;
      helpBox.innerHTML = `Tip: แตะจุดเพื่อเพิ่มใน route • Cardboard ยิงได้ (hha:shoot) • ดู bars แล้วปรับแผน`;
    }
  }

  function renderHud(S){
    pillMode.textContent = `MODE: ${S.mode==='A' ? 'A (Evaluate)' : 'B (Create)'}`;
    pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;
    if(S.mode === 'A'){
      pillBudget.textContent = `SPRAYS: ${fmt(S.A?.spraysLeft||0)}/${fmt(S.A?.maxSelect||3)}`;
      pillGoal.textContent = `GOAL: Best picks + Boss`;
    }else{
      pillBudget.textContent = `POINTS: ${fmt((S.B?.routeIds||[]).length)}/${fmt(S.B?.maxPoints||5)}`;
      pillGoal.textContent = `GOAL: Best plan + Boss`;
    }
  }

  function goHubDirect(){
    const hub = qs('hub','');
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }

  function goCooldown(){
    const hub = qs('hub','') || '../hub.html';
    const base = new URL(location.href);

    const g = new URL('../warmup-gate.html', base);
    g.searchParams.set('cat','hygiene');
    g.searchParams.set('theme','cleanobjects');
    g.searchParams.set('cd','1');
    g.searchParams.set('next', hub);

    const keep = ['run','diff','time','seed','pid','view','ai','debug','api','log','studyId','phase','conditionGroup','grade','boss'];
    keep.forEach(k=>{
      const v = base.searchParams.get(k);
      if(v !== null && v !== '') g.searchParams.set(k, v);
    });
    g.searchParams.set('hub', hub);

    location.href = g.toString();
  }

  function replay(){ location.reload(); }

  function showSummary(payload){
    summary.style.display = '';
    const meta = summary.querySelector('#sumMeta');
    const body = summary.querySelector('#sumBody');

    const m = payload || {};
    const mode = (m.metrics && m.metrics.mode) ? m.metrics.mode : (lastState ? lastState.mode : '?');

    meta.innerHTML = `
      PID: <b>${escapeHtml(m.pid||qs('pid','anon'))}</b> •
      Run: <b>${escapeHtml(m.run||qs('run','play'))}</b> •
      Day: <b>${escapeHtml(m.day||'')}</b> •
      Mode: <b>${escapeHtml(mode)}</b> •
      Score: <b>${escapeHtml(String(m.score||0))}</b>
    `;

    if(mode === 'A'){
      const bd = (m.metrics && m.metrics.breakdown) ? m.metrics.breakdown : {};
      const reasons = (m.metrics && m.metrics.reasons) ? m.metrics.reasons : [];
      const comboBest = (m.metrics && m.metrics.combo) ? (m.metrics.combo.best||0) : 0;
      const bossPenalty = (bd && bd.bossPenalty) ? bd.bossPenalty : 0;

      body.innerHTML = `
        <div><b>Breakdown:</b> RR ${fmt(bd.rrTotal)} • Coverage ${fmt(bd.coverage)}% • Decision ${fmt(bd.dq)}% • ComboBest ${fmt(comboBest)} • BossPenalty -${fmt(bossPenalty)}</div>
        <div style="margin-top:10px"><b>เหตุผลที่เลือก:</b></div>
        <div style="margin-top:6px;opacity:.95">${reasons.length ? reasons.map(r=>`• ${escapeHtml(r.id)} — ${escapeHtml(r.reasonText||'')}`).join('<br/>') : '—'}</div>
      `;
    }else{
      const bd = (m.metrics && m.metrics.breakdown) ? m.metrics.breakdown : {};
      const routeIds = (m.metrics && m.metrics.routeIds) ? m.metrics.routeIds : [];
      const bossPenalty = (bd && bd.bossPenalty) ? bd.bossPenalty : 0;

      body.innerHTML = `
        <div><b>Breakdown:</b> Coverage ${fmt(bd.coverageB)}% • Balance ${fmt(bd.balanceScore)}% • Remain ${fmt(bd.remainScore)}% • BossPenalty -${fmt(bossPenalty)}</div>
        <div style="margin-top:10px"><b>Route:</b> ${routeIds.length ? routeIds.map(x=>escapeHtml(String(x))).join(' → ') : '—'}</div>
      `;
    }

    summary.querySelector('#btnCooldown').onclick = goCooldown;
    summary.querySelector('#btnBackHub').onclick = goHubDirect;
    summary.querySelector('#btnReplay').onclick = replay;
  }

  // hha:shoot -> pick closest marker to center (cheap aim assist)
  function handleShoot(){
    if(!lastState || lastState.ended) return;
    if(lastState.mode !== 'B') return;

    const rect = markerLayer.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    let best = null;
    let bestD = 1e18;
    markerLayer.querySelectorAll('.mk').forEach(mk=>{
      const r = mk.getBoundingClientRect();
      const mx = r.left + r.width/2;
      const my = r.top + r.height/2;
      const dx = mx - cx;
      const dy = my - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){ bestD = d2; best = mk; }
    });

    if(best && bestD <= (90*90)){
      const id = best.dataset.id;
      if(id) opts.toggleRouteB && opts.toggleRouteB(id);
    }
  }
  window.addEventListener('hha:shoot', handleShoot);

  // route panel buttons
  routePanel.querySelector('#btnUndo').onclick = ()=> opts.undoB && opts.undoB();
  routePanel.querySelector('#btnClear').onclick = ()=> opts.clearB && opts.clearB();
  routePanel.querySelector('#btnSubmit').onclick = ()=> opts.submitB && opts.submitB();

  // Danger pulse event from core
  function setDanger(on){
    dangerOn = !!on;
    root.classList.toggle('danger', dangerOn);
    if(dangerOn){
      try{ if(navigator.vibrate) navigator.vibrate([40,40,40]); }catch(e){}
    }
  }
  window.addEventListener('clean:danger', (ev)=>{
    const d = ev && ev.detail ? ev.detail : {};
    if(d && d.danger) setDanger(true);
  });

  // public hooks
  function onState(S){
    lastState = S;

    // update bossId (in case overridden)
    try{ bossId = String((S.cfg && S.cfg.bossId) ? S.cfg.bossId : bossId); }catch(e){}

    renderHud(S);
    renderMission(S);
    renderHeat(S);
    renderMarkers(S);
    renderRoutePanel(S);

    const v = normalizeView(qs('view',''));
    const ov = root.querySelector('#ovHint');
    if(ov){
      ov.style.display = S.ended ? 'none' : '';
      const s = ov.querySelector('.ovS');
      if(v === 'cvr') s.textContent = 'Cardboard: ยิง (hha:shoot) เพื่อเลือกจุด • หรือแตะจุดบนแผนที่ • อย่าลืมบอส!';
      else s.textContent = 'แตะจุดเพื่อทำความสะอาด • เลือกเหตุผลก่อน • อย่าลืมบอส! • ช่วงท้ายจะเร่ง';
    }

    // hide reason UI in mode B
    const showReason = (S.mode === 'A');
    reasonBox.style.display = showReason ? '' : 'none';
    reasonNote.style.display = showReason ? '' : 'none';
  }

  function onTick(S, dt){
    if(S) pillTime.textContent = `TIME: ${fmt(S.timeLeft)}s`;
  }

  function onCoach(msg){
    if(!msg) return;

    if(msg.kind === 'plan_live' && msg.data && msg.data.breakdown){
      lastPlanBreakdown = msg.data.breakdown;
      if(lastState) renderRoutePanel(lastState);
    }

    // ensure contamination message is seen
    if(msg.kind === 'contamination'){
      showCoach(msg.text || '⚠️ เหตุการณ์ปนเปื้อน!');
      return;
    }
    if(msg.text) showCoach(msg.text);
  }

  function onSummary(payload){
    showSummary(payload);
  }

  // initial help
  helpBox.innerHTML = `
    <div>• 🔥 Boss = <b>${escapeHtml(bossId)}</b> (ถ้าไม่ทำโดนหัก)</div>
    <div>• ⚠️ กลางเกมมีเหตุการณ์ปนเปื้อน 1 ครั้ง/รอบ</div>
    <div>• ⏱️ 10 วิท้ายจะ “เร่ง” (pulse + vibration)</div>
  `;

  return { onState, onTick, onCoach, onSummary };
}