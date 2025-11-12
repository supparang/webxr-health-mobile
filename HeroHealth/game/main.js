// === /HeroHealth/game/main.js (2025-11-12 STABLE HUD + RESULT + HUB BACK) ===
console.log('[main] boot');

(function(){
  // ---------- DOM helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $on= (el,ev,fn,opts)=>{ if(el) el.addEventListener(ev,fn,opts||false); };

  // ---------- URL params ----------
  const qs    = new URLSearchParams(location.search);
  const MODE  = (qs.get('mode')||'goodjunk').toLowerCase();
  const DIFF  = (qs.get('diff')||'normal').toLowerCase();
  const DURA  = Math.max(10, parseInt(qs.get('time')||'60',10));
  const AUTOSTART = qs.get('autostart') === '1';

  // ---------- HUD refs ----------
  const hudScore = $('#hudScore');
  const hudCombo = $('#hudCombo');
  const hudTop   = $('#hudTop');
  const startFab = $('#btnStart');
  const startPanel = $('#startPanel');
  const startLbl   = $('#startLbl');

  // ---------- Fever dock (ย้าย fever bar ไปใต้กล่องคะแนน) ----------
  function dockFeverBar(){
    try{
      const dock = $('#feverBarDock');
      const feverWrap = document.getElementById('feverBarWrap')    // เวอร์ชันเก่า
                      || document.getElementById('hhaFeverBarWrap'); // เผื่อเวอร์ชันใหม่
      if (dock && feverWrap && feverWrap.parentNode !== dock){
        dock.appendChild(feverWrap);
        console.log('[main] fever bar docked under score/combo');
      }
      // โล่สะสม (shield counter) ถ้า UI มี element ชื่อ hhaShieldWrap ก็ย้ายเช่นกัน
      const shieldWrap = document.getElementById('hhaShieldWrap');
      if (dock && shieldWrap && shieldWrap.parentNode !== dock){
        dock.appendChild(shieldWrap);
      }
    }catch(_){}
  }
  // dock ตอน layer พร้อม และเผื่อซ้ำๆ ระหว่าง runtime
  $on(window,'hha:layer-ready', dockFeverBar);
  const feverDockInterval = setInterval(dockFeverBar, 800);
  window.addEventListener('unload', ()=>clearInterval(feverDockInterval));

  // ---------- Local running stats (สำหรับ HUD) ----------
  let score=0, combo=0, timeLeft=DURA;

  function setScore(n){ if(hudScore) hudScore.textContent = (n|0).toString(); }
  function setCombo(n){ if(hudCombo) hudCombo.textContent = (n|0).toString(); }
  function setTime(sec){
    // ถ้าต้องการโชว์เวลาใน HUD เพิ่มอีกแถว ให้เพิ่ม element แล้วอัปเดตที่นี่
    // ตัวอย่าง: <div class="score-row"><span class="k">เวลา</span><span id="hudTime" class="v">60</span></div>
    const el = document.getElementById('hudTime');
    if (el) el.textContent = (sec|0).toString();
  }

  // ---------- Result overlay ----------
  function showResult(detail){
    const old=document.getElementById('resultOverlay'); if(old) old.remove();

    const o=document.createElement('div'); o.id='resultOverlay';
    o.innerHTML=`
      <div class="card">
        <h2>สรุปผล: ${detail.mode||MODE} (${detail.difficulty||DIFF})</h2>
        <div class="grid">
          <div class="stat"><div class="k">คะแนนรวม</div><div class="v">${(detail.score||0).toLocaleString()}</div></div>
          <div class="stat"><div class="k">คอมโบสูงสุด</div><div class="v">${detail.comboMax|0}</div></div>
          <div class="stat"><div class="k">พลาด</div><div class="v">${detail.misses|0}</div></div>
          <div class="stat"><div class="k">เป้าหมาย</div><div class="v">${detail.goalCleared?('ถึงเป้า ('+(detail.goalTarget||'-')+')'):'ไม่ถึง (-)'}</div></div>
          <div class="stat"><div class="k">เวลา</div><div class="v">${detail.duration|0}s</div></div>
        </div>
        <div class="badge" id="mqBadge">Mini Quests ${(detail.questsCleared|0)}/${(detail.questsTotal|0)}</div>
        <div class="btns">
          <button id="btnRetry">เล่นอีกครั้ง</button>
          <button id="btnHub" class="outline">กลับ Hub</button>
        </div>
      </div>`;
    document.body.appendChild(o);

    try{
      const x=detail.questsCleared|0, y=detail.questsTotal|0;
      const r = y? x/y : 0;
      const b = o.querySelector('#mqBadge');
      b.style.borderColor=(r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
      b.style.background =(r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
      b.style.color      =(r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
    }catch(_){}

    function gotoHub(){
      const hubURL = new URL('../hub.html', location.href); // เสถียรบน GitHub Pages
      const m = (detail.mode||MODE||'goodjunk').toLowerCase();
      const d = (detail.difficulty||DIFF||'normal').toLowerCase();
      hubURL.searchParams.set('mode', m);
      hubURL.searchParams.set('diff', d);
      location.href = hubURL.href;
    }
    o.querySelector('#btnRetry').onclick = ()=>location.reload();
    o.querySelector('#btnHub').onclick   = gotoHub;
  }

  (function ensureResultCSS(){
    if (document.getElementById('hha-result-css')) return;
    const css=document.createElement('style'); css.id='hha-result-css';
    css.textContent=`
      #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center}
      #resultOverlay .card{background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:16px;padding:20px;width:min(920px,92vw);box-shadow:0 20px 50px rgba(0,0,0,.45)}
      #resultOverlay h2{margin:0 0 12px;font:800 20px/1.3 system-ui}
      #resultOverlay .grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:10px 0 14px}
      #resultOverlay .stat{background:#0f172a;border:1px solid #1f2937;border-radius:12px;padding:10px}
      #resultOverlay .k{font:700 12px/1.2 system-ui;color:#93c5fd;opacity:.9}
      #resultOverlay .v{font:800 20px/1.2 system-ui;color:#f8fafc;margin-top:4px}
      #resultOverlay .badge{display:inline-block;border:2px solid #475569;border-radius:10px;padding:6px 10px;font-weight:800}
      #resultOverlay .btns{margin-top:16px;display:flex;gap:10px;justify-content:flex-end}
      #resultOverlay .btns button{border:0;border-radius:12px;padding:10px 14px;font-weight:900;cursor:pointer;background:#22c55e;color:#fff}
      #resultOverlay .btns button.outline{background:#0b1220;color:#e2e8f0;border:1px solid #334155}
    `;
    document.head.appendChild(css);
  })();

  // ---------- Event wiring from factory/mode ----------
  // delta-based score/combination update
  $on(window,'hha:score', (e)=>{
    const d = (e.detail && typeof e.detail.delta==='number') ? e.detail.delta : 0;
    const good = !!(e.detail && e.detail.good);
    score = Math.max(0, score + d);
    combo = good ? (combo+1) : 0;
    setScore(score); setCombo(combo);
  });

  $on(window,'hha:time', (e)=>{
    const sec = e.detail && typeof e.detail.sec!=='undefined' ? (e.detail.sec|0) : timeLeft;
    timeLeft = sec; setTime(timeLeft);
    // เมื่อโหมดส่ง onEnd เอง เราจะรับผ่าน 'hha:end' อีกที
  });

  // (ถ้าต้องการเห็น label ของ quest ขณะเล่น ผ่าน 'hha:quest')
  $on(window,'hha:quest', (e)=>{
    // สามารถเพิ่ม tooltip/ข้อความย่อยบน HUD ได้ถ้าต้องการ
    // ตัวอย่าง: console.log('[quest]', e.detail);
  });

  // รับสรุปจากโหมด
  $on(window,'hha:end', (e)=>{
    // บางกรณี factory อาจยิง hha:end(reason) ตอนหมดเวลา
    // แต่โหมด (goodjunk.safe.js) จะยิงซ้ำพร้อม detail เต็ม เรารอ detail เต็ม
    const d = e.detail || {};
    // ถ้าไม่มีค่าโหมด/ระดับ/คะแนน ให้ fallback จาก local เพื่อไม่ให้ว่าง
    if (d && (d.score!=null || d.questsTotal!=null)){
      showResult(Object.assign({ mode:MODE, difficulty:DIFF, duration:DURA }, d));
    }
  });

  // ---------- Start game ----------
  async function startGame(){
    try{
      // อัปเดต label ปุ่มเริ่ม (VR panel)
      try{ startLbl && startLbl.setAttribute('troika-text', `value: เริ่ม: ${MODE.toUpperCase()}`); }catch(_){}

      // ซ่อนปุ่มเริ่ม/แผงเริ่ม
      if (startFab)   startFab.style.display='none';
      if (startPanel) startPanel.setAttribute('visible', false);

      // path ของโหมด (ใช้ relative ใหม่แบบเสถียร)
      // โครง: /HeroHealth/index.vr.html  → ./modes/<mode>.safe.js
      const modURL  = new URL(`../modes/${MODE}.safe.js`, location.href); // game/ → ../modes/
      // cache-bust เล็กน้อย กัน GitHub Pages แคช
      modURL.searchParams.set('v', Date.now().toString());

      console.log('[main] loading mode', modURL.href);
      const modeMod = await import(modURL.href);

      // เริ่มโหมด
      const boot = (modeMod && (modeMod.boot||modeMod.default?.boot));
      if (typeof boot!=='function'){
        throw new Error('Mode module has no boot()');
      }
      const ctrl = await boot({ difficulty:DIFF, duration:DURA });
      // เริ่ม factory
      if (ctrl && typeof ctrl.start==='function'){
        ctrl.start();
      }

      console.log('[main] game started', MODE, DIFF, DURA);
      // ย้าย fever bar อีกครั้งหลังเริ่ม (แน่ใจว่ามาใต้กล่องคะแนนแล้ว)
      requestAnimationFrame(dockFeverBar);
      setScore(0); setCombo(0); setTime(DURA);
    }catch(err){
      console.error('[main] start error', err);
      alert('เริ่มเกมไม่สำเร็จ: '+err.message);
      // แสดงปุ่มเริ่มใหม่ให้กดซ้ำ
      if (startFab)   startFab.style.display='';
      if (startPanel) startPanel.setAttribute('visible', true);
    }
  }

  // ปุ่มเริ่ม (DOM/VR)
  const go = ()=>startGame();
  $on(startFab,'click', (e)=>{ e.preventDefault(); go(); });

  // Auto-start (เช่นมาจาก Hub)
  if (AUTOSTART){
    // รอ scene พร้อมเล็กน้อยค่อยเริ่ม
    setTimeout(go, 300);
  }

  // แจ้งว่าพร้อมสำหรับ Hub
  window.dispatchEvent(new CustomEvent('hha:hub-ready'));
})();
