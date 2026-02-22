// === /herohealth/fitness-planner/planner-dashboard.js ===
// End-of-Day Dashboard (local-only) — Summarize sessions + Export buttons

'use strict';

function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
function fmtPct(x){ return (Number.isFinite(x)? (x*100).toFixed(1)+'%' : 'NA'); }
function fmtMs(x){ return (Number.isFinite(x)? Math.round(x)+'ms' : 'NA'); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }

function loadLastSummary(){
  try{ return safeParseJSON(localStorage.getItem('HHA_LAST_SUMMARY')||'null'); }catch(_){ return null; }
}

function listEventSessionIds(){
  const ids = [];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(!k) continue;
    if(k.startsWith('HHA_FIT_EVENTS_')){
      ids.push(k.replace('HHA_FIT_EVENTS_',''));
    }
  }
  // newest first
  ids.sort((a,b)=> (a>b?-1: a<b?1:0));
  return ids;
}

function loadEvents(sid){
  try{ return safeParseJSON(localStorage.getItem('HHA_FIT_EVENTS_' + sid) || '[]') || []; }
  catch(_){ return []; }
}

function mean(xs){ return xs.reduce((a,b)=>a+b,0)/xs.length; }

function summarizeMicro(evs){
  const acts = evs.filter(e=>e.type==='hit' || e.type==='miss');
  const hits = acts.filter(e=>e.type==='hit');
  const miss = acts.filter(e=>e.type==='miss');

  const rts=[];
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
  const durMs = (isFinite(t0)&&isFinite(t1)&&t1>t0)? (t1-t0):0;

  return {
    actions: acts.length,
    hits: hits.length,
    misses: miss.length,
    missRate: acts.length? miss.length/acts.length : NaN,
    rtMean: rts.length? mean(rts) : NaN,
    durationMs: durMs
  };
}

function parseGameIdFromEvents(evs){
  // assume events contain e.game or meta.game, fallback unknown
  for(const e of evs){
    if(e.game) return String(e.game);
    const m = safeParseJSON(e.meta||'null');
    if(m?.game) return String(m.game);
  }
  return 'unknown';
}

function bossStats(evs){
  let boss_on=0, clear=0, fail=0, lastPhase='';
  let storm=0, feint=0, shield=0, shieldOk=0;
  for(const e of evs){
    if(e.type!=='warn') continue;
    const m = safeParseJSON(e.meta||'null') || {};
    if(m.ai==='boss'){
      boss_on=1;
      if(m.kind==='phase' && m.phase) lastPhase=String(m.phase);
      if(m.kind==='clear') clear=1;
      if(m.kind==='fail') fail=1;
      if(m.kind==='attack_start'){
        if(m.attack==='storm') storm++;
        if(m.attack==='feint') feint++;
        if(m.attack==='shieldbreak') shield++;
      }
      if(m.kind==='shield_break' && m.result==='success') shieldOk++;
    }
  }
  return { boss_on, clear, fail, lastPhase, storm, feint, shield, shieldOk };
}

function coachTip(evs){
  for(const e of evs){
    if(e.type!=='warn') continue;
    const m = safeParseJSON(e.meta||'null') || {};
    if(m.ai==='coach' && m.text){
      return { tipId: String(m.tipId||''), text: String(m.text) };
    }
  }
  return null;
}

// quick bucket (same spirit as earlier)
function bucketFromMicro(s){
  const acts = Number(s.actions||0);
  const miss = Number(s.missRate);
  const rt = Number(s.rtMean);
  const dur = Number(s.durationMs);

  if(acts < 8) return 'RED';
  if(Number.isFinite(dur) && dur < 6000) return 'RED';
  if(Number.isFinite(rt) && rt < 120) return 'RED';
  if(Number.isFinite(rt) && rt > 1800) return 'RED';
  if(Number.isFinite(miss) && miss > 0.85) return 'RED';

  if(acts < 15) return 'YELLOW';
  if(Number.isFinite(dur) && dur < 12000) return 'YELLOW';
  if(Number.isFinite(rt) && rt < 180) return 'YELLOW';
  if(Number.isFinite(miss) && miss > 0.60) return 'YELLOW';

  return 'OK';
}

function buildRows(limit=30){
  const ids = listEventSessionIds().slice(0, limit);
  const rows = [];

  for(const sid of ids){
    const evs = loadEvents(sid);
    if(!evs.length) continue;

    const micro = summarizeMicro(evs);
    const g = parseGameIdFromEvents(evs);
    const b = bossStats(evs);
    const tip = coachTip(evs);

    rows.push({
      sessionId: sid,
      game: g,
      bucket: bucketFromMicro(micro),
      duration_s: Number.isFinite(micro.durationMs)? (micro.durationMs/1000).toFixed(1) : 'NA',
      hits: micro.hits,
      misses: micro.misses,
      missRate: fmtPct(micro.missRate),
      rtMean: fmtMs(micro.rtMean),
      boss: b.boss_on ? (b.clear?'CLEAR': b.fail?'FAIL':'END') : '',
      phase: b.lastPhase||'',
      storm: b.storm,
      feint: b.feint,
      shield: b.shield,
      shieldOK: b.shieldOk,
      coach: tip ? tip.text : ''
    });
  }

  return rows;
}

function mkOverlay(){
  const ov = document.createElement('div');
  ov.id = 'fpDash';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML = `
    <div style="width:min(980px,96vw);max-height:86vh;overflow:auto;background:rgba(15,23,42,.94);
                border:1px solid rgba(255,255,255,.16);border-radius:18px;color:#fff;
                font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;">
      <div style="padding:14px;border-bottom:1px solid rgba(255,255,255,.10);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="font-weight:900;font-size:18px;">📊 Fitness Planner — End Dashboard</div>
        <div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap;">
          <button id="fpExpA" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(59,130,246,.35);color:#fff;font-weight:900;">Export ANALYSIS Pack</button>
          <button id="fpExpR" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);color:#fff;font-weight:900;">Export RAW Pack</button>
          <button id="fpClose" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);color:#fff;font-weight:900;">✕ Close</button>
        </div>
      </div>

      <div style="padding:14px;display:grid;gap:12px;">
        <div id="fpSummary" style="display:flex;gap:10px;flex-wrap:wrap;"></div>
        <div style="border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden;">
          <div style="padding:10px 12px;font-weight:900;background:rgba(0,0,0,.18);border-bottom:1px solid rgba(255,255,255,.10);">
            ล่าสุด (แสดง 30 session ล่าสุด)
          </div>
          <div style="overflow:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead style="background:rgba(0,0,0,.18);">
                <tr>
                  ${['session','game','bucket','dur','hit','miss','miss%','rt','boss','phase','storm','feint','shield','ok','coach']
                    .map(x=>`<th style="text-align:left;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.10);white-space:nowrap;">${x}</th>`).join('')}
                </tr>
              </thead>
              <tbody id="fpTbody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,.10);opacity:.85;font-size:12px;">
        Tip: ถ้ามี RED ให้กด Retest ในเกมนั้น 1 รอบ แล้วค่อย Export ANALYSIS
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  return ov;
}

function pill(txt){
  const s = document.createElement('div');
  s.style.cssText = 'padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.22);';
  s.textContent = txt;
  return s;
}

function render(ov, rows){
  const sum = ov.querySelector('#fpSummary');
  const tb = ov.querySelector('#fpTbody');
  sum.innerHTML = '';
  tb.innerHTML = '';

  const nOK = rows.filter(r=>r.bucket==='OK').length;
  const nY  = rows.filter(r=>r.bucket==='YELLOW').length;
  const nR  = rows.filter(r=>r.bucket==='RED').length;

  sum.appendChild(pill(`OK: ${nOK}`));
  sum.appendChild(pill(`YELLOW: ${nY}`));
  sum.appendChild(pill(`RED: ${nR}`));

  for(const r of rows){
    const tr = document.createElement('tr');
    const bg = (r.bucket==='RED') ? 'rgba(239,68,68,.10)' : (r.bucket==='YELLOW') ? 'rgba(251,191,36,.10)' : 'transparent';
    tr.style.background = bg;
    tr.innerHTML = `
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;font-family:ui-monospace,Menlo,monospace;">${r.sessionId}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.game}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;font-weight:900;">${r.bucket}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.duration_s}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.hits}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.misses}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.missRate}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.rtMean}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.boss}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.phase}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.storm}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.feint}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.shield}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap;">${r.shieldOK}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);min-width:260px;">${(r.coach||'').slice(0,120)}</td>
    `;
    tb.appendChild(tr);
  }
}

export function openPlannerEndDashboard(opts){
  const o = Object.assign({
    maxRows: 30,
    // export hooks (you already have in hh-export.js or global)
    exportAnalysis: null,  // () => void
    exportRaw: null        // () => void
  }, opts||{});

  const ov = document.getElementById('fpDash') || mkOverlay();
  const rows = buildRows(o.maxRows);
  render(ov, rows);
  ov.style.display = 'flex';

  ov.querySelector('#fpClose')?.addEventListener('click', ()=> ov.style.display='none', { once:true });

  ov.querySelector('#fpExpA')?.addEventListener('click', ()=>{
    if(typeof o.exportAnalysis === 'function') o.exportAnalysis();
    else if(window.HHExport?.downloadReportPack) window.HHExport.downloadReportPack({ analysisOnly:true });
    else alert('Export ANALYSIS not wired');
  }, { once:true });

  ov.querySelector('#fpExpR')?.addEventListener('click', ()=>{
    if(typeof o.exportRaw === 'function') o.exportRaw();
    else if(window.HHExport?.downloadReportPack) window.HHExport.downloadReportPack({ analysisOnly:false });
    else alert('Export RAW not wired');
  }, { once:true });
}