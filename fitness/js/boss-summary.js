// === /fitness/js/boss-summary.js ===
// Universal End Summary Card (Boss-aware) — local-only

'use strict';

function safeParseJSON(s){
  try{ return JSON.parse(s); }catch(_){ return null; }
}

function mean(xs){ return xs.reduce((a,b)=>a+b,0)/xs.length; }

function loadEvents(sessionId){
  try{
    return safeParseJSON(localStorage.getItem('HHA_FIT_EVENTS_' + sessionId) || '[]') || [];
  }catch(_){ return []; }
}

function calcFromEvents(evs){
  const acts = evs.filter(e=>e.type==='hit' || e.type==='miss');
  const hits = acts.filter(e=>e.type==='hit');
  const miss = acts.filter(e=>e.type==='miss');

  const rts = [];
  for(const e of hits){
    const m = safeParseJSON(e.meta||'null') || {};
    const rt = Number(m.rt);
    if(Number.isFinite(rt)) rts.push(rt);
  }

  let t0=Infinity, t1=0;
  for(const e of evs){
    const at = Number(e.at||0);
    if(Number.isFinite(at)){ t0=Math.min(t0,at); t1=Math.max(t1,at); }
  }
  const durMs = (isFinite(t0)&&isFinite(t1)&&t1>t0) ? (t1-t0) : 0;

  const missRate = (acts.length? miss.length/acts.length : 0);
  const rtMean = (rts.length? mean(rts) : null);

  return {
    actions: acts.length,
    hits: hits.length,
    misses: miss.length,
    missRate,
    rtMean,
    durationMs: durMs
  };
}

function calcBossFromEvents(evs){
  // boss clear/fail + last phase + counts
  let bossOn = 0;
  let clear = 0;
  let fail = 0;
  let lastPhase = '';

  let storm=0, feint=0, shield=0, shieldOk=0;
  let coachText = '';
  let coachTipId = '';

  for(const e of evs){
    if(e.type !== 'warn') continue;
    const m = safeParseJSON(e.meta||'null') || {};
    if(m.ai === 'boss'){
      bossOn = 1;
      if(m.kind === 'phase' && m.phase) lastPhase = String(m.phase);
      if(m.kind === 'clear') clear = 1;
      if(m.kind === 'fail') fail = 1;

      if(m.kind === 'attack_start'){
        if(m.attack === 'storm') storm++;
        if(m.attack === 'feint') feint++;
        if(m.attack === 'shieldbreak') shield++;
      }
      if(m.kind === 'shield_break' && m.result === 'success'){
        shieldOk++;
      }
    }
    if(m.ai === 'coach' && m.text && !coachText){
      coachText = String(m.text);
      coachTipId = String(m.tipId || '');
    }
  }

  // outcome
  let outcome = '';
  if(bossOn){
    if(clear) outcome = 'CLEAR';
    else if(fail) outcome = 'FAIL';
    else outcome = 'END';
  }

  return {
    bossOn, outcome, lastPhase,
    storm, feint, shield, shieldOk,
    coachText, coachTipId
  };
}

function el(tag, cssText, html){
  const x = document.createElement(tag);
  if(cssText) x.style.cssText = cssText;
  if(html != null) x.innerHTML = html;
  return x;
}

export function showBossSummary(opts){
  const o = Object.assign({
    sessionId: '',
    gameName: 'Game',
    hubUrl: '',           // e.g. ?hub=...
    onRetest: null,       // () => {}
    onExit: null          // () => {}
  }, opts||{});

  const sid = String(o.sessionId||'');
  const evs = loadEvents(sid);
  const m = calcFromEvents(evs);
  const b = calcBossFromEvents(evs);

  // overlay
  const overlay = el('div', `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,.72);
    display:flex; align-items:center; justify-content:center;
    padding:16px;`, '');

  const card = el('div', `
    width:min(720px, 96vw);
    background:rgba(15,23,42,.92);
    border:1px solid rgba(255,255,255,.16);
    border-radius:18px;
    box-shadow: 0 18px 60px rgba(0,0,0,.55);
    color:rgba(255,255,255,.94);
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
    overflow:hidden;
  `, '');

  const head = el('div', `
    padding:14px 14px 10px 14px;
    background:linear-gradient(180deg, rgba(2,6,23,.70), rgba(2,6,23,.10));
    border-bottom:1px solid rgba(255,255,255,.10);
  `, `
    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:900; font-size:18px;">🏁 สรุปผล — ${o.gameName}</div>
      <div style="margin-left:auto; opacity:.85; font-size:12px;">session: <span style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${sid||'-'}</span></div>
    </div>
    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      ${b.bossOn ? `<span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.22); font-weight:900;">👾 BOSS: ${b.outcome || '-'}</span>` : ''}
      <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.22);">
        ⏱️ ${(m.durationMs/1000).toFixed(1)}s
      </span>
      <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.22);">
        ✅ hit ${m.hits} / ❌ miss ${m.misses}
      </span>
      <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.22);">
        🎯 miss ${(m.missRate*100).toFixed(1)}%
      </span>
      <span style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.22);">
        ⚡ RT ${m.rtMean==null?'NA':Math.round(m.rtMean)+'ms'}
      </span>
    </div>
  `);

  const body = el('div', `padding:14px; display:grid; gap:12px;`, '');

  const grid = el('div', `display:grid; grid-template-columns: 1fr 1fr; gap:12px;`, '');

  // left: boss stats
  const bossBox = el('div', `
    border:1px solid rgba(255,255,255,.12);
    background:rgba(0,0,0,.18);
    border-radius:16px;
    padding:12px;
  `, `
    <div style="font-weight:900;">👾 Boss Stats</div>
    <div style="margin-top:8px; opacity:.92; line-height:1.35; font-size:13px;">
      ${b.bossOn ? `
      • Outcome: <b>${b.outcome||'-'}</b><br/>
      • Last phase: <b>${b.lastPhase||'-'}</b><br/>
      • Storm: <b>${b.storm}</b> | Feint: <b>${b.feint}</b> | Shield: <b>${b.shield}</b><br/>
      • Shield success: <b>${b.shieldOk}</b>
      ` : `ไม่ได้เปิดโหมดบอสในรอบนี้`}
    </div>
  `);

  // right: coach tip
  const coachBox = el('div', `
    border:1px solid rgba(255,255,255,.12);
    background:rgba(0,0,0,.18);
    border-radius:16px;
    padding:12px;
  `, `
    <div style="font-weight:900;">💡 Coach Tip</div>
    <div style="margin-top:8px; opacity:.92; line-height:1.35; font-size:13px; white-space:pre-line;">
      ${b.coachText ? `${b.coachText}${b.coachTipId?`\n\n(id: ${b.coachTipId})`:''}` : 'ยังไม่มีคำแนะนำในรอบนี้'}
    </div>
  `);

  grid.appendChild(bossBox);
  grid.appendChild(coachBox);

  // bottom: actions
  const actions = el('div', `
    display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
    border-top:1px solid rgba(255,255,255,.10);
    padding:12px 14px;
    background:rgba(2,6,23,.25);
  `, '');

  function btn(label, onClick, primary){
    const b = el('button', `
      padding:10px 12px; border-radius:14px;
      border:1px solid rgba(255,255,255,.18);
      background:${primary?'rgba(59,130,246,.35)':'rgba(0,0,0,.20)'};
      color:rgba(255,255,255,.94);
      font-weight:900;
    `, label);
    b.onclick = onClick;
    return b;
  }

  actions.appendChild(btn('🔁 Retest', ()=>{
    overlay.remove();
    if(typeof o.onRetest === 'function') o.onRetest();
  }, true));

  actions.appendChild(btn('🏠 Exit', ()=>{
    overlay.remove();
    if(typeof o.onExit === 'function') o.onExit();
    else if(o.hubUrl) location.href = o.hubUrl;
    else history.back();
  }, false));

  body.appendChild(grid);
  card.appendChild(head);
  card.appendChild(body);
  card.appendChild(actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}