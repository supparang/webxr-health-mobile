<script>
/* =========================================================================
   EXO Core System — storage + audio + input + tutorial + overlay + safeStart
   Lightweight, mobile-friendly, VR-safe
   ======================================================================= */
(function (w){
  "use strict";

  /* ---------------------- Storage helpers ---------------------- */
  const store = {
    get(k, d=null){ try{ const v = localStorage.getItem(k); return v!=null ? JSON.parse(v) : d; }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  };

  /* ---------------------- Audio subsystem ---------------------- */
  const AC = {
    ctx: null,
    ensure(){ try{ this.ctx = this.ctx || new (w.AudioContext || w.webkitAudioContext)(); }catch(e){} }
  };

  const audio = {
    music: null,
    musicGain: null,
    sfxGain: null,
    ensure(){
      AC.ensure(); if(!AC.ctx) return;
      if(!this.musicGain){ this.musicGain = AC.ctx.createGain(); this.musicGain.gain.value = 0.40; this.musicGain.connect(AC.ctx.destination); }
      if(!this.sfxGain){ this.sfxGain = AC.ctx.createGain(); this.sfxGain.gain.value = 0.12; this.sfxGain.connect(AC.ctx.destination); }
    },
    async playMusic(url, {loop=true, volume=0.40} = {}){
      this.ensure(); if(!AC.ctx) return;
      await AC.ctx.resume().catch(()=>{});
      this.stopMusic();
      try{
        const res = await fetch(url, {cache:'force-cache'});
        const buf = await res.arrayBuffer();
        // Safari compatibility: decodeAudioData may be callback-based
        const abuf = await (AC.ctx.decodeAudioData.length === 1
          ? AC.ctx.decodeAudioData(buf)
          : new Promise((ok,err)=>AC.ctx.decodeAudioData(buf, ok, err)));
        const src = AC.ctx.createBufferSource();
        src.buffer = abuf; src.loop = loop;
        this.musicGain.gain.value = volume;
        src.connect(this.musicGain); src.start();
        this.music = src;
      }catch(e){ console.warn('[EXO.audio] playMusic failed:', e); }
    },
    stopMusic(){ try{ this.music && this.music.stop(0); }catch(e){} this.music = null; },
    beep(freq=520, dur=0.05, vol=0.12){
      this.ensure(); if(!AC.ctx) return;
      const o = AC.ctx.createOscillator(); const g = AC.ctx.createGain();
      o.type = "square"; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(this.sfxGain || AC.ctx.destination);
      const t0 = AC.ctx.currentTime;
      o.start(t0); o.stop(t0 + Math.max(0.01, dur));
    }
  };

  /* ------------------------ Time helper ------------------------ */
  const now = () => performance.now() / 1000;

  /* --------------- DOM helpers: ensure overlay DOM ------------- */
  function ensureOverlayDom(){
    let overlay = document.getElementById('overlay');
    let panel   = document.getElementById('panel');
    if(!overlay){ overlay = document.createElement('div'); overlay.id='overlay'; overlay.className='overlay'; document.body.appendChild(overlay); }
    if(!panel){ panel = document.createElement('div'); panel.id='panel'; panel.className='panel'; overlay.appendChild(panel); }
    return {overlay, panel};
  }

  /* ---------------------- Start Overlay UI --------------------- */
  function startOverlay(onStart, opts={}){
    const {overlay, panel} = ensureOverlayDom();
    const title = opts.title || 'EXO TRAINING PROTOCOL';
    const howto = Array.isArray(opts.howto) ? opts.howto : null;
    const note  = opts.note || '';

    overlay.style.display = 'flex';
    panel.innerHTML = `
      <div class="title">${title}</div>
      ${howto && howto.length ? `
      <div class="kpi" style="grid-template-columns:repeat(${Math.min(3,howto.length)},1fr)">
        ${howto.map(h => `<div><b>${h.title||''}</b><br>${h.html || h.text || ''}</div>`).join('')}
      </div>` : ``}
      ${note ? `<div style="opacity:.8;margin:.4rem 0">${note}</div>` : ``}
      <div style="display:flex;gap:.6rem;justify-content:center;margin-top:.6rem">
        <a class="btn" id="__exoStartBtn">▶ Start</a>
        ${howto && howto.length ? `<a class="btn" id="__exoHowBtn">❓ How To</a>` : ``}
      </div>
      <div style="text-align:center;opacity:.7;margin-top:.4rem">Tip: Space/Enter to start</div>
    `;

    const go = async ()=>{
      try{ await AC.ctx?.resume(); }catch(e){}
      overlay.style.display = 'none';
      try{ onStart && onStart(); }catch(e){ console.error(e); }
      document.removeEventListener('keydown', keyGo);
    };
    const keyGo = (e)=>{ if(e.code==='Space' || e.key==='Enter'){ go(); } };

    document.getElementById('__exoStartBtn').onclick = go;
    document.addEventListener('keydown', keyGo);

    // tap anywhere (except buttons) to start
    overlay.addEventListener('pointerdown', (ev)=>{
      if (ev.target && (ev.target.id==='__exoStartBtn' || ev.target.id==='__exoHowBtn' || ev.target.classList.contains('btn'))) return;
      go();
    }, {passive:true});

    if (howto && howto.length){
      const hb = document.getElementById('__exoHowBtn');
      hb && (hb.onclick = ()=> tutorial(howto, { onDone: ()=>{ overlay.style.display='flex'; } }));
    }
  }

  /* ----------------------- Tutorial overlay -------------------- */
  function tutorial(steps, {onDone}={}){
    const {overlay, panel} = ensureOverlayDom();
    let i = 0;
    const render = ()=>{
      const s = steps[i] || {};
      overlay.style.display = 'flex';
      panel.innerHTML = `
        <div class="title" style="margin-bottom:6px">${s.title || 'How to Play'}</div>
        ${s.html || `<p>${s.text||''}</p>`}
        <div style="display:flex; gap:8px; justify-content:center; margin-top:10px">
          ${i>0 ? `<a class="btn" id="__exoPrev">← Prev</a>` : ``}
          ${i<steps.length-1 ? `<a class="btn" id="__exoNext">Next →</a>` : `<a class="btn" id="__exoDone">Done</a>`}
        </div>
      `;
      const prev = document.getElementById('__exoPrev');
      const next = document.getElementById('__exoNext');
      const done = document.getElementById('__exoDone');
      prev && (prev.onclick = ()=>{ i=Math.max(0,i-1); render(); });
      next && (next.onclick = ()=>{ i=Math.min(steps.length-1,i+1); render(); });
      done && (done.onclick = ()=>{ overlay.style.display='none'; onDone && onDone(); });
    };
    render();
  }

  /* -------------------------- Input ---------------------------- */
  function attachBasicInput({ onLeft, onRight, onPause }){
    const leftArea  = document.getElementById('touchL') || document.body;
    const rightArea = document.getElementById('touchR') || document.body;

    const fireL = ()=> onLeft  && onLeft();
    const fireR = ()=> onRight && onRight();

    // Pointer-first (รวม mouse/touch/pen)
    leftArea.addEventListener('pointerdown', fireL, {passive:true});
    rightArea.addEventListener('pointerdown', fireR, {passive:true});

    // เผื่อบาง environment ไม่มี pointer
    leftArea.addEventListener('touchstart', fireL, {passive:true});
    rightArea.addEventListener('touchstart', fireR, {passive:true});
    leftArea.addEventListener('click', fireL);
    rightArea.addEventListener('click', fireR);

    w.addEventListener('keydown', e=>{
      if (e.key==='ArrowLeft' || e.key==='a' || e.key==='A') fireL();
      if (e.key==='ArrowRight'|| e.key==='d' || e.key==='D' || e.code==='Space') fireR();
      if (e.key==='Escape') onPause && onPause();
    });
  }

  /* ------------------------ Safe Start ------------------------- */
  // ใช้แทน EXO_safeStart แบบที่คุณเคยวางในหน้าเกม
  function safeStart(startFn, overlayEl, cfg){
    // ถ้ามี overlay ระบบ — ใช้เลย
    try{
      if (w.EXO && typeof w.EXO.startOverlay === 'function'){
        w.EXO.startOverlay(()=> startFn && startFn(), cfg || undefined);
        return;
      }
    }catch(e){}

    // ไม่มี overlay DOM → เริ่มด้วย gesture guard เพื่อปลดล็อกเสียง
    try{ if (overlayEl) overlayEl.style.display='none'; }catch(e){}
    const startNow = ()=>{ try{ startFn && startFn(); }catch(e){} };
    // รอการแตะครั้งแรก
    const once = ()=>{ w.removeEventListener('pointerdown', once, {once:true}); startNow(); };
    w.addEventListener('pointerdown', once, {once:true});
    // เผื่อ desktop ไม่แตะ—kickoff หลัง 300ms
    setTimeout(startNow, 300);
  }

  /* ------------------------ Export ----------------------------- */
  w.EXO = Object.assign(w.EXO || {}, {
    now,
    audio,
    beep: audio.beep.bind(audio),
    startOverlay,
    tutorial,
    attachBasicInput,
    store,
    safeStart // เผื่ออยากเรียกจากเกมโดยตรง EXO.safeStart(...)
  });

  // ความเข้ากันได้ย้อนหลัง (บางหน้าเรียกชื่อฟังก์ชันนี้โดยตรง)
  w.EXO_safeStart = w.EXO_safeStart || function(startFn, overlayEl, cfg){ safeStart(startFn, overlayEl, cfg); };

})(window);
</script>
