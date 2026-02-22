// === /herohealth/fitness-planner/attention-check.js ===
// 10s Attention Check (deterministic, kid-friendly)

'use strict';

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr){
  let x = fnv1a32(seedStr) || 2463534242;
  return function(){
    x ^= x<<13; x >>>= 0;
    x ^= x>>17; x >>>= 0;
    x ^= x<<5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function runAttentionCheck10s(opts){
  const o = Object.assign({
    seed:'0',
    pid:'anon',
    durationMs: 10000,
    // passing rule
    needHits: 4,
    maxFalse: 1,
    onDone: null // (result)=>{}
  }, opts||{});

  const rng = makeRng(`${o.seed}|${o.pid}|attn10`);
  const schedule = [];
  // 12 cues in 10s: interval ~800ms with jitter
  let t = 500;
  for(let i=0;i<12;i++){
    const isStar = (i%2===0); // balanced
    const jitter = (rng()*180 - 90); // -90..90ms
    schedule.push({ at: Math.max(250, Math.round(t + jitter)), kind: isStar ? 'STAR' : 'BLUE' });
    t += 800;
  }

  // overlay
  const ov = document.createElement('div');
  ov.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,.78);
    display:flex; align-items:center; justify-content:center;
    padding:16px;
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
    color:rgba(255,255,255,.94);
  `;
  ov.innerHTML = `
    <div style="width:min(560px,96vw); background:rgba(15,23,42,.94);
                border:1px solid rgba(255,255,255,.16); border-radius:18px; overflow:hidden;">
      <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.10); font-weight:900;">
        🧠 แบบทดสอบสั้น (10 วินาที)
      </div>
      <div style="padding:14px; line-height:1.45; opacity:.92;">
        กติกา: <b>แตะเฉพาะ ⭐ เท่านั้น</b> <br/>
        ถ้าเป็น 🟦 <b>ห้ามแตะ</b>
      </div>

      <div style="padding:0 14px 14px 14px;">
        <div id="attnCue" style="
          height:140px; border-radius:16px;
          display:flex; align-items:center; justify-content:center;
          border:1px solid rgba(255,255,255,.14);
          background:rgba(0,0,0,.20);
          font-size:72px; font-weight:900;
          user-select:none;
        ">…</div>

        <div style="display:flex; gap:10px; margin-top:12px; align-items:center;">
          <div style="opacity:.85;">เวลา: <span id="attnT">10</span>s</div>
          <div style="margin-left:auto; opacity:.85;">
            ถูก: <span id="attnHit">0</span> | ผิด: <span id="attnFalse">0</span>
          </div>
        </div>

        <div style="margin-top:10px; display:flex; gap:10px; justify-content:flex-end;">
          <button id="attnStart" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);
            background:rgba(59,130,246,.35); color:#fff; font-weight:900;">เริ่ม</button>
          <button id="attnSkip" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);
            background:rgba(0,0,0,.20); color:#fff; font-weight:900;">ข้าม</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  const cueEl = ov.querySelector('#attnCue');
  const tEl = ov.querySelector('#attnT');
  const hitEl = ov.querySelector('#attnHit');
  const falseEl = ov.querySelector('#attnFalse');
  const btnStart = ov.querySelector('#attnStart');
  const btnSkip = ov.querySelector('#attnSkip');

  let started = false;
  let t0 = 0;
  let idx = -1;
  let cur = null;
  let hits=0, falses=0;
  const rts = [];
  const events = []; // for logging

  function setCue(kind){
    cur = { kind, shownAt: performance.now() };
    cueEl.textContent = (kind==='STAR') ? '⭐' : '🟦';
  }

  function finish(skipped){
    // compute pass/fail
    const pass = (!skipped) && (hits >= o.needHits) && (falses <= o.maxFalse);
    const rtMean = rts.length ? (rts.reduce((a,b)=>a+b,0)/rts.length) : null;

    const result = {
      skipped: !!skipped,
      pass: pass ? 1 : 0,
      hits, falses,
      rtMean,
      needHits: o.needHits,
      maxFalse: o.maxFalse,
      schedule,
      events
    };

    ov.remove();
    try{ o.onDone && o.onDone(result); }catch(_){}
  }

  function tick(){
    if(!started) return;

    const now = performance.now();
    const dt = now - t0;
    const leftMs = Math.max(0, o.durationMs - dt);
    tEl.textContent = String(Math.ceil(leftMs/1000));

    // advance cue
    while(idx+1 < schedule.length && dt >= schedule[idx+1].at){
      idx++;
      setCue(schedule[idx].kind);
      events.push({ type:'cue', kind:schedule[idx].kind, t: Math.round(dt) });
    }

    if(leftMs <= 0){
      finish(false);
      return;
    }
    requestAnimationFrame(tick);
  }

  cueEl.addEventListener('pointerdown', ()=>{
    if(!started || !cur) return;
    const rt = performance.now() - cur.shownAt;

    if(cur.kind === 'STAR'){
      hits++;
      rts.push(rt);
      events.push({ type:'tap', ok:1, kind:'STAR', rt: Math.round(rt) });
    } else {
      falses++;
      events.push({ type:'tap', ok:0, kind:'BLUE', rt: Math.round(rt) });
    }
    hitEl.textContent = String(hits);
    falseEl.textContent = String(falses);
  });

  btnStart.addEventListener('click', ()=>{
    if(started) return;
    started = true;
    btnStart.disabled = true;
    btnSkip.disabled = true;
    t0 = performance.now();
    idx = -1;
    cueEl.textContent = '…';
    requestAnimationFrame(tick);
  });

  btnSkip.addEventListener('click', ()=> finish(true));
}