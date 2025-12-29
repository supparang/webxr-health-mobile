// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot: start overlay + VR/Cardboard toggle + HUB + End Summary renderer

import { boot as safeBoot } from './goodjunk.safe.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function qs(name, def){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function setParam(url, k, v){
  const u = new URL(url);
  if (v === null || v === undefined) u.searchParams.delete(k);
  else u.searchParams.set(k, String(v));
  return u.toString();
}
function $(id){ return DOC ? DOC.getElementById(id) : null; }

function applyViewClass(view){
  DOC.body.classList.toggle('view-cardboard', view === 'cardboard');
}

function metaText(p){
  const a = [];
  a.push(`diff=${p.diff}`);
  a.push(`run=${p.run}`);
  a.push(`time=${p.time}s`);
  a.push(`end=${p.end}`);
  a.push(`challenge=${p.challenge}`);
  if (p.view) a.push(`view=${p.view}`);
  return a.join(' • ');
}

function buildHubUrl(p){
  const hub = String(p.hub||'').trim();
  if (!hub) return '';
  try{
    const u = new URL(hub, ROOT.location.href);
    // keep params you want (optional)
    u.searchParams.set('from', 'goodjunk');
    u.searchParams.set('run', p.run);
    u.searchParams.set('diff', p.diff);
    return u.toString();
  }catch(_){
    return hub;
  }
}

async function goHub(p, reason='back_hub'){
  // best: end game + flush then navigate
  try{
    if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.endGame === 'function'){
      await ROOT.GoodJunkVR.endGame(reason);
    }
  }catch(_){}
  const url = buildHubUrl(p);
  if (url) ROOT.location.href = url;
}

function showEndSummary(summary, p){
  const host = $('end-summary');
  if (!host) return;

  const acc = Number(summary?.accuracyGoodPct ?? 0) || 0;
  const grade = String(summary?.grade ?? '—');
  const dur = Number(summary?.durationPlayedSec ?? 0) || 0;

  host.hidden = false;
  host.innerHTML = `
    <div class="end-card" role="dialog" aria-label="สรุปผล">
      <div class="end-title">
        <div class="t">สรุปผล GoodJunkVR</div>
        <div class="pill">GRADE ${grade}</div>
      </div>

      <div class="end-grid">
        <div class="end-item"><div class="k">Score</div><div class="v">${summary?.scoreFinal ?? 0}</div></div>
        <div class="end-item"><div class="k">Combo Max</div><div class="v">${summary?.comboMax ?? 0}</div></div>
        <div class="end-item"><div class="k">Miss</div><div class="v">${summary?.misses ?? 0}</div></div>

        <div class="end-item"><div class="k">Accuracy</div><div class="v">${acc}%</div></div>
        <div class="end-item"><div class="k">Good Hit</div><div class="v">${summary?.nHitGood ?? 0}</div></div>
        <div class="end-item"><div class="k">Junk Hit</div><div class="v">${summary?.nHitJunk ?? 0}</div></div>

        <div class="end-item"><div class="k">Junk Guard</div><div class="v">${summary?.nHitJunkGuard ?? 0}</div></div>
        <div class="end-item"><div class="k">Good Expire</div><div class="v">${summary?.nExpireGood ?? 0}</div></div>
        <div class="end-item"><div class="k">Time</div><div class="v">${dur}s</div></div>

        <div class="end-item"><div class="k">Goals</div><div class="v">${summary?.goalsCleared ?? 0}/${summary?.goalsTotal ?? 0}</div></div>
        <div class="end-item"><div class="k">Minis</div><div class="v">${summary?.miniCleared ?? 0}/${summary?.miniTotal ?? 0}</div></div>
        <div class="end-item"><div class="k">Reason</div><div class="v">${String(summary?.reason ?? 'end')}</div></div>
      </div>

      <div class="end-sub">
        โหมด: <b>${summary?.runMode ?? p.run}</b> • ระดับ: <b>${summary?.diff ?? p.diff}</b>
        ${summary?.seed ? `• seed: <b>${summary.seed}</b>` : ''}
      </div>

      <div class="end-actions">
        <button id="btnEndRetry" class="end-btn primary" type="button">เล่นใหม่</button>
        <button id="btnEndHub" class="end-btn secondary" type="button">กลับ HUB</button>
      </div>

      <div class="end-actions" style="margin-top:10px;">
        <button id="btnEndClose" class="end-btn ghost" type="button">ปิดหน้านี้</button>
      </div>
    </div>
  `;

  const btnRetry = $('btnEndRetry');
  const btnHub = $('btnEndHub');
  const btnClose = $('btnEndClose');

  if (btnRetry){
    btnRetry.addEventListener('click', ()=>{
      // refresh with new ts (new seed) but keep params
      const cur = ROOT.location.href;
      ROOT.location.href = setParam(cur, 'ts', Date.now());
    });
  }
  if (btnHub){
    btnHub.addEventListener('click', ()=> goHub(p, 'end_hub'));
  }
  if (btnClose){
    btnClose.addEventListener('click', ()=>{
      host.hidden = true;
      host.innerHTML = '';
    });
  }
}

function startGame(p){
  applyViewClass(p.view);

  const hudMeta = $('hudMeta');
  if (hudMeta) hudMeta.textContent = metaText(p);

  const overlay = $('startOverlay');
  if (overlay) overlay.style.display = 'none';

  safeBoot({
    diff: p.diff,
    run: p.run,
    time: p.time,
    endPolicy: p.end,
    challenge: p.challenge,
    view: p.view,
    context: { projectTag: 'GoodJunkVR' }
  });
}

function boot(){
  const p = {
    diff: String(qs('diff','normal')).toLowerCase(),
    run:  String(qs('run','play')).toLowerCase(),
    time: Number(qs('time','80')) || 80,
    end:  String(qs('end','time')).toLowerCase(),
    challenge: String(qs('challenge','rush')).toLowerCase(),
    view: String(qs('view','mobile')).toLowerCase(), // 'cardboard' or 'mobile'
    hub: qs('hub','')
  };
  if (p.view !== 'cardboard') p.view = 'mobile';
  applyViewClass(p.view);

  const startMeta = $('startMeta');
  if (startMeta) startMeta.textContent = metaText(p);

  const btnStart = $('btnStart');
  const btnStartVr = $('btnStartVr');
  const btnVr = $('btnVr');
  const btnHub = $('btnHub');

  if (btnStart) btnStart.addEventListener('click', ()=> startGame(p));

  if (btnStartVr){
    btnStartVr.addEventListener('click', ()=>{
      const url = ROOT.location.href;
      const next = setParam(url, 'view', 'cardboard');
      if (next !== url) ROOT.location.href = next;
      else startGame({ ...p, view:'cardboard' });
    });
  }

  if (btnVr){
    btnVr.addEventListener('click', ()=>{
      const cur = ROOT.location.href;
      const isCb = (String(qs('view','mobile')).toLowerCase() === 'cardboard');
      ROOT.location.href = setParam(cur, 'view', isCb ? 'mobile' : 'cardboard');
    });
  }

  if (btnHub){
    btnHub.addEventListener('click', ()=>{
      // ถ้ายังไม่เริ่มเกม: กลับ hub ได้ทันที
      // ถ้าเริ่มแล้ว: goHub จะ end+flush ให้
      goHub(p, 'hud_hub');
    });
  }

  // ✅ End summary listener
  ROOT.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || {};
    showEndSummary(summary, p);
  });

  // Auto-start? (ถ้าอยาก) — ตอนนี้ให้ผู้ใช้กดเริ่มเหมือนเดิม
}

if (DOC){
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
}