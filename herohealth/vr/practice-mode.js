// === /herohealth/vr/practice-mode.js ===
// HHA Practice Mode (pre-game warmup)
// - Shows countdown overlay (default 15s)
// - Emits: hha:practice_start, hha:practice_tick, hha:practice_end
// - After practice ends, emits hha:start (game begins)
// Works with any game that starts on hha:start (your Hydration already does)

'use strict';

(function(root){
  const DOC = root.document;
  if (!DOC) return;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // practice=0 disables
  const practiceSec = clamp(parseInt(qs('practice','15'),10) || 15, 0, 60);
  const wantPractice = (practiceSec > 0);

  // If already started by user (rare), don't block
  let started=false;
  root.addEventListener('hha:start', ()=>{ started=true; }, { once:false });

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function injectStyle(){
    if (DOC.getElementById('hha-practice-style')) return;
    const st = DOC.createElement('style');
    st.id='hha-practice-style';
    st.textContent = `
      .hha-practice{
        position:fixed; inset:0;
        z-index:140;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: calc(18px + env(safe-area-inset-top,0px)) calc(18px + env(safe-area-inset-right,0px))
                 calc(18px + env(safe-area-inset-bottom,0px)) calc(18px + env(safe-area-inset-left,0px));
        background: rgba(2,6,23,.72);
        backdrop-filter: blur(10px);
      }
      .hha-practice[hidden]{ display:none; }
      .hha-practice-card{
        width:min(720px, 100%);
        border-radius:22px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.70);
        box-shadow: 0 24px 90px rgba(0,0,0,.55);
        padding:16px;
      }
      .hha-practice-top{
        display:flex; justify-content:space-between; gap:12px; align-items:center;
      }
      .hha-practice-title{
        font: 900 14px/1.2 system-ui;
        letter-spacing:.2px;
        color: rgba(229,231,235,.95);
      }
      .hha-practice-sub{
        margin-top:8px;
        color: rgba(148,163,184,.95);
        font: 600 12px/1.35 system-ui;
        white-space: pre-line;
      }
      .hha-practice-timer{
        margin-top:14px;
        font: 1000 56px/1 system-ui;
        letter-spacing:.5px;
        text-align:center;
      }
      .hha-practice-bar{
        margin-top:12px;
        height:10px;
        border-radius:999px;
        background: rgba(148,163,184,.18);
        overflow:hidden;
        border:1px solid rgba(148,163,184,.12);
      }
      .hha-practice-bar > div{
        height:100%;
        width:100%;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
        transform-origin:left center;
        transform: scaleX(1);
      }
      .hha-practice-btnrow{
        display:flex; gap:10px; justify-content:flex-end; margin-top:14px; flex-wrap:wrap;
      }
      .hha-btn{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.62);
        color: rgba(229,231,235,.95);
        padding:10px 12px;
        border-radius:14px;
        font: 900 13px/1 system-ui;
        cursor:pointer;
        user-select:none;
      }
      .hha-btn.primary{
        border-color: rgba(34,197,94,.26);
        background: rgba(34,197,94,.16);
      }
    `;
    DOC.head.appendChild(st);
  }

  function mountUI(){
    if (DOC.getElementById('hhaPractice')) return;
    injectStyle();
    const wrap = DOC.createElement('div');
    wrap.id = 'hhaPractice';
    wrap.className = 'hha-practice';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="hha-practice-card">
        <div class="hha-practice-top">
          <div class="hha-practice-title">🧪 Practice Mode (Warm-up)</div>
          <div style="font:900 12px system-ui;color:rgba(148,163,184,.95)">ก่อนเริ่มเกมจริง</div>
        </div>
        <div class="hha-practice-sub">
• เล็ง/ยิงให้คุ้นมือ
• อย่ารัวมั่ว ๆ — เน้นความชัวร์
• ครบเวลาแล้วจะ “เริ่มจริง” ทันที 😈
        </div>
        <div class="hha-practice-timer"><span id="hhaPracticeLeft">15</span>s</div>
        <div class="hha-practice-bar"><div id="hhaPracticeBar"></div></div>
        <div class="hha-practice-btnrow">
          <button class="hha-btn" id="hhaPracticeSkip">⏭ Skip</button>
          <button class="hha-btn primary" id="hhaPracticeStartNow">🔥 Start Now</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);
  }

  function show(){ const el=DOC.getElementById('hhaPractice'); if(el){ el.hidden=false; } }
  function hide(){ const el=DOC.getElementById('hhaPractice'); if(el){ el.hidden=true; } }
  function setLeft(sec){
    const t=DOC.getElementById('hhaPracticeLeft'); if(t) t.textContent = String(sec|0);
  }
  function setBar(k){
    const b=DOC.getElementById('hhaPracticeBar'); if(b) b.style.transform = `scaleX(${k})`;
  }

  function beginPractice(){
    if (!wantPractice) return false;
    if (started) return false;

    mountUI();
    show();

    let left = practiceSec;
    const total = practiceSec;

    emit('hha:practice_start', { practiceSec: total });

    let last = performance.now();
    let acc = 0;
    let rafId = 0;

    function tick(now){
      const dt = Math.min(0.05, Math.max(0.001, (now - last)/1000));
      last = now;
      acc += dt;

      // update every ~0.1s to keep it smooth
      if (acc >= 0.1){
        acc = 0;
        left = Math.max(0, left - 0.1);
        const s = Math.ceil(left);
        setLeft(s);
        setBar(clamp(left/Math.max(0.001,total), 0, 1));
        emit('hha:practice_tick', { leftSec:left, totalSec:total });
      }

      if (left <= 0.001){
        endPractice('timeout');
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function endPractice(reason){
      try{ cancelAnimationFrame(rafId); }catch(_){}
      hide();
      emit('hha:practice_end', { reason, practiceSec: total });
      // start game for real
      try{ root.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }

    DOC.getElementById('hhaPracticeSkip')?.addEventListener('click', ()=>endPractice('skip'));
    DOC.getElementById('hhaPracticeStartNow')?.addEventListener('click', ()=>endPractice('startnow'));

    // Important: practice should start only after user gesture (mobile audio/fs policies)
    // We'll start countdown immediately once invoked.
    setLeft(total);
    setBar(1);
    requestAnimationFrame(tick);

    return true;
  }

  // expose API
  root.HHA_Practice = root.HHA_Practice || {};
  root.HHA_Practice.begin = beginPractice;

})(window);