// === /HeroHealth/game/main.js (2025-11-12 HYPER-ROBUST LOADER) ===
(function(){
  'use strict';

  const $ = (s)=>document.querySelector(s);
  function qp(k, d=''){ const v=new URLSearchParams(location.search).get(k); return (v==null||v==='')?d:v; }
  function fmt(sec){ sec=sec|0; if(sec<0)sec=0; const m=(sec/60|0), s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

  // ---------- params ----------
  const OPT = {
    mode: (qp('mode','goodjunk')||'').toLowerCase(),
    diff: (qp('diff','normal')||'').toLowerCase(),
    duration: Math.max(10, +(qp('duration')||60)),
    autostart: qp('autostart','0')==='1'
  };

  // ---------- HUD ----------
  const hud = { score:0, combo:0, scoreEl:null, comboEl:null, timeEl:null };
  function bindHUD(){
    hud.scoreEl = $('#hudScore');
    hud.comboEl = $('#hudCombo');
    hud.timeEl  = $('#hudTime');

    window.addEventListener('hha:time', (e)=>{
      const sec = (e?.detail?.sec|0);
      if(hud.timeEl) hud.timeEl.textContent = fmt(sec);
    });
    window.addEventListener('hha:score', (e)=>{
      const d = +(e?.detail?.delta||0);
      const good = !!(e?.detail?.good);
      hud.score = Math.max(0, hud.score + d);
      hud.combo = good ? (hud.combo+1) : 0;
      if(hud.scoreEl) hud.scoreEl.textContent = hud.score.toLocaleString();
      if(hud.comboEl) hud.comboEl.textContent = String(hud.combo);
    });

    try{ window.dispatchEvent(new CustomEvent('hha:hud-ready')); }catch(_){}
  }

  // ---------- robust loader ----------
  function candidateUrls(mode){
    const base = location.href.replace(/[#?].*$/,'');                // full file URL
    const dir  = base.replace(/[^/]+$/,'');                           // .../HeroHealth/
    const fromMeta = (p)=>new URL(p, (typeof import.meta!=='undefined' ? import.meta.url : dir)).toString();

    const names = [
      `./modes/${mode}.safe.js`,
      `./modes/${mode}.quest.js`,
      `modes/${mode}.safe.js`,
      `modes/${mode}.quest.js`,
      `${dir}modes/${mode}.safe.js`,
      `${dir}modes/${mode}.quest.js`,
      `/webxr-health-mobile/HeroHealth/modes/${mode}.safe.js`,
      `/webxr-health-mobile/HeroHealth/modes/${mode}.quest.js`,
    ];
    const uniq = Array.from(new Set(names.map(n=>fromMeta(n))));
    return uniq;
  }

  async function importMode(mode){
    const tried = [];
    for(const url of candidateUrls(mode)){
      try{
        // บางเว็บเซิร์ฟเวอร์ cache แปลก ๆ: ลอง fetch HEAD ช่วยไกด์ error ให้ชัดขึ้น (ไม่บล็อก CORS เพราะ same-origin)
        tried.push(url);
        // eslint-disable-next-line no-await-in-loop
        const mod = await import(/* @vite-ignore */ url);
        console.log('[main] mode loaded:', url);
        return { mod, url };
      }catch(e){
        console.warn('[main] import failed →', url, e?.message||e);
      }
    }
    const msg = 'เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่พบ\n' + tried.join('\n');
    alert(msg);
    throw new Error(msg);
  }

  // ---------- Result overlay ----------
  function paintBadge(el, x,y){
    const r = y ? (x/y) : 0;
    el.style.borderColor = (r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
    el.style.background  = (r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
    el.style.color       = (r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
  }
  (function injectCSS(){
    if (document.getElementById('hha-result-style')) return;
    const css = document.createElement('style'); css.id='hha-result-style';
    css.textContent = `
      #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;}
      #resultOverlay .card{background:#1e293b;border-radius:16px;padding:24px;min-width:280px;color:#fff;text-align:center;box-shadow:0 0 20px #000a;}
      #resultOverlay .stats{display:grid;gap:6px;margin-top:8px;}
      .questBadge{margin-top:8px;padding:4px 8px;border:2px solid #444;border-radius:8px;display:inline-block;font-weight:600;}
      .btns{margin-top:16px;display:flex;justify-content:center;gap:12px;}
      .btns button{padding:6px 12px;border-radius:8px;border:none;font-weight:700;cursor:pointer}
      .btns #btnHub{background:#0f172a;color:#fff;}
      .btns #btnRetry{background:#22c55e;color:#fff;}
    `;
    document.head.appendChild(css);
  })();

  function showResult(detail){
    const old = document.getElementById('resultOverlay'); if(old) old.remove();
    const d = detail||{};
    const o = document.createElement('div'); o.id='resultOverlay';
    o.innerHTML = `
      <div class="card">
        <h2>สรุปผล</h2>
        <div class="stats">
          <div>โหมด: ${d.mode||OPT.mode}</div>
          <div>ระดับ: ${d.difficulty||OPT.diff}</div>
          <div>คะแนน: ${(d.score||0).toLocaleString()}</div>
          <div>คอมโบสูงสุด: ${d.comboMax??0}</div>
          <div>พลาด: ${d.misses??0}</div>
          <div>เวลา: ${fmt(d.duration ?? OPT.duration)}</div>
          <div class="questBadge">Mini Quests ${d.questsCleared??0}/${d.questsTotal??0}</div>
        </div>
        <div class="btns">
          <button id="btnHub">กลับ Hub</button>
          <button id="btnRetry">เล่นอีกครั้ง</button>
        </div>
      </div>`;
    document.body.appendChild(o);
    paintBadge(o.querySelector('.questBadge'), +(d.questsCleared||0), +(d.questsTotal||0));
    o.querySelector('#btnHub').onclick = ()=>{
      location.href = `./hub.html?mode=${encodeURIComponent(OPT.mode)}&diff=${encodeURIComponent(OPT.diff)}`;
    };
    o.querySelector('#btnRetry').onclick = ()=>location.reload();
  }

  // ---------- Launch ----------
  let ctrl=null, started=false;
  async function launch(){
    if(started) return; started=true;
    try{ document.getElementById('startPanel')?.setAttribute('visible','false'); }catch(_){}
    try{ const b=document.getElementById('btnStart'); if(b){ b.style.display='none'; b.disabled=true; } }catch(_){}

    const { mod } = await importMode(OPT.mode);
    ctrl = await mod.boot({ difficulty:OPT.diff, duration:OPT.duration });
    ctrl?.start?.();

    const onEnd = (e)=>{
      try{ window.removeEventListener('hha:end', onEnd); }catch(_){}
      showResult(e?.detail);
    };
    window.addEventListener('hha:end', onEnd);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    // label บนแผง VR
    try{
      const lbl = document.getElementById('startLbl');
      if(lbl) lbl.setAttribute('troika-text', `value: เริ่ม: ${OPT.mode.toUpperCase()}`);
    }catch(_){}
    bindHUD();

    const start = (ev)=>{ try{ev?.preventDefault?.();}catch(_){ } launch(); };
    document.getElementById('btnStart') ?.addEventListener('click', start);
    document.getElementById('vrStartBtn')?.addEventListener('click', start);

    if(OPT.autostart){
      requestAnimationFrame(()=>requestAnimationFrame(start));
    }
  });
})();
