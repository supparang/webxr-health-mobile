// === /herohealth/vr/practice-gate.js ===
// HHA Practice Gate (15s default) — PRODUCTION
// ✅ works with: hha:pause / hha:resume
// ✅ optional hook: window.__HHA_SET_PAUSED__ (if a game exposes it)
// Usage in run page:
//   import { attachPracticeGate } from '../vr/practice-gate.js';
//   attachPracticeGate({ seconds:15, enabled:true });
'use strict';

export function attachPracticeGate(opts){
  opts = opts || {};
  const seconds = Math.max(5, Math.min(30, Number(opts.seconds ?? 15) || 15));
  const enabled = opts.enabled !== false;

  const qs = (k, d=null)=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch{ return d; } };
  const run = String(qs('run','play')).toLowerCase();
  const practiceQ = String(qs('practice', run==='practice' ? '1' : '0'));
  const doPractice = enabled && (practiceQ === '1' || run === 'practice');

  const $ = (id)=>document.getElementById(id);

  // create overlay (if not exist)
  let wrap = $('hhaPractice');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'hhaPractice';
    wrap.innerHTML = `
      <div class="card">
        <div class="t">Practice</div>
        <div class="m">ลองยิง/แตะให้คุ้นมือก่อนเริ่มจริง</div>
        <div class="timer"><span id="hhaPracticeSec">${seconds}</span>s</div>
        <div class="row">
          <button id="hhaPracticeSkip" class="btn">ข้าม</button>
          <button id="hhaPracticeGo" class="btn primary">เริ่มนับ</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  // basic styles (scoped)
  const styleId = 'hhaPracticeStyle';
  if(!document.getElementById(styleId)){
    const st = document.createElement('style');
    st.id = styleId;
    st.textContent = `
      #hhaPractice{
        position:fixed; inset:0; z-index:9999;
        display:none; align-items:center; justify-content:center;
        padding:16px;
        background: rgba(0,0,0,.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      #hhaPractice.show{ display:flex; }
      #hhaPractice .card{
        width:min(560px, 92vw);
        border-radius:18px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.86);
        color: rgba(229,231,235,.96);
        box-shadow: 0 18px 60px rgba(0,0,0,.45);
        padding: 14px;
      }
      #hhaPractice .t{ font-weight:1000; font-size:18px; }
      #hhaPractice .m{ margin-top:6px; opacity:.9; font-weight:800; }
      #hhaPractice .timer{ margin-top:10px; font-size:34px; font-weight:1100; font-variant-numeric: tabular-nums; }
      #hhaPractice .row{ margin-top:12px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; }
      #hhaPractice .btn{
        appearance:none; border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.78);
        color: rgba(229,231,235,.96);
        padding:10px 14px; min-height:44px;
        font-weight:950; cursor:pointer;
      }
      #hhaPractice .btn.primary{
        border-color: rgba(59,130,246,.35);
        background: linear-gradient(180deg, rgba(30,64,175,.92), rgba(30,58,138,.92));
      }
    `;
    document.head.appendChild(st);
  }

  const secEl = $('hhaPracticeSec');
  const btnSkip = $('hhaPracticeSkip');
  const btnGo = $('hhaPracticeGo');

  let ticking = false;
  let left = seconds;

  function setPaused(on){
    try{ window.__HHA_SET_PAUSED__?.(!!on); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent(on ? 'hha:pause' : 'hha:resume')); }catch(e){}
  }

  function hide(){
    wrap.classList.remove('show');
  }

  function show(){
    wrap.classList.add('show');
  }

  function startCountdown(){
    if(ticking) return;
    ticking = true;
    left = seconds;
    secEl && (secEl.textContent = String(left));

    const t0 = Date.now();
    const timer = setInterval(()=>{
      const elapsed = Math.floor((Date.now() - t0)/1000);
      const remain = Math.max(0, seconds - elapsed);
      left = remain;
      if(secEl) secEl.textContent = String(remain);
      if(remain <= 0){
        clearInterval(timer);
        ticking = false;
        hide();
        setPaused(false);
      }
    }, 200);
  }

  // main
  if(doPractice){
    // start paused, show overlay
    setPaused(true);
    show();
    btnGo?.addEventListener('click', ()=> startCountdown(), { once:true });
    btnSkip?.addEventListener('click', ()=>{
      hide();
      setPaused(false);
    }, { once:true });
  }else{
    // no practice: auto unpause
    setPaused(false);
    hide();
  }

  return { doPractice };
}