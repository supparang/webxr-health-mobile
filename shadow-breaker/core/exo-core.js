// EXO Core System — tutorial + audio + input + overlay + storage
window.EXO = (function () {

  // ---------- Storage helpers ----------
  const store = {
    get(k, d=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k);}catch(e){} }
  };

  // ---------- Audio ----------
  const AC = { ctx:null, ensure(){ try{ this.ctx = this.ctx || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } };

  const audio = {
    music: null,
    musicGain: null,
    sfxGain: null,
    ensure(){
      AC.ensure(); if(!AC.ctx) return;
      if(!this.musicGain){ this.musicGain = AC.ctx.createGain(); this.musicGain.gain.value = 0.4; this.musicGain.connect(AC.ctx.destination); }
      if(!this.sfxGain){ this.sfxGain = AC.ctx.createGain(); this.sfxGain.gain.value = 0.12; this.sfxGain.connect(AC.ctx.destination); }
    },
    async playMusic(url, {loop=true, volume=0.4} = {}){
      this.ensure(); if(!AC.ctx) return;
      await AC.ctx.resume();
      this.stopMusic();
      const res = await fetch(url); const buf = await res.arrayBuffer();
      const abuf = await AC.ctx.decodeAudioData(buf);
      const src = AC.ctx.createBufferSource(); src.buffer = abuf; src.loop = loop;
      this.musicGain.gain.value = volume;
      src.connect(this.musicGain); src.start();
      this.music = src;
    },
    stopMusic(){ try{ this.music && this.music.stop(0); }catch(e){} this.music = null; },
    beep(freq=520, dur=0.05, vol=0.12){
      this.ensure(); if(!AC.ctx) return;
      const o = AC.ctx.createOscillator(); const g = AC.ctx.createGain();
      o.type = "square"; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(this.sfxGain||AC.ctx.destination);
      o.start(); o.stop(AC.ctx.currentTime + dur);
    }
  };

  // ---------- Time helper ----------
  const now = () => performance.now() / 1000;

  // ---------- Overlay (Start / Tutorial) ----------
  function startOverlay(onStart, opts={}){
    let overlay = document.getElementById('overlay');
    let panel   = document.getElementById('panel');
    if(!overlay){ overlay = document.createElement('div'); overlay.id='overlay'; overlay.className='overlay'; document.body.appendChild(overlay); }
    if(!panel){ panel = document.createElement('div'); panel.id='panel'; panel.className='panel'; overlay.appendChild(panel); }

    const title = opts.title || 'EXO TRAINING PROTOCOL';
    const showHowTo = !!opts.howto;

    overlay.style.display = 'flex';
    panel.innerHTML = `
      <div class="title">${title}</div>
      <div style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
        <button id="btnStart" class="btn">▶ Start</button>
        ${showHowTo ? `<button id="btnHow" class="btn">How to Play</button>` : ``}
      </div>
      ${opts.note ? `<div class="muted" style="margin-top:10px">${opts.note}</div>` : ``}
    `;

    document.getElementById('btnStart').onclick = async () => {
      try{ await AC.ctx?.resume(); }catch(e){}
      overlay.style.display = 'none';
      onStart && onStart();
    };
    if (showHowTo){
      document.getElementById('btnHow').onclick = () => tutorial(opts.howto, {onDone: ()=>{ /* stay overlay */ }});
    }
  }

  // ---------- Tutorial overlay (multi-step) ----------
  function tutorial(steps, {onDone}={}){
    let overlay = document.getElementById('overlay');
    let panel   = document.getElementById('panel');
    if(!overlay){ overlay = document.createElement('div'); overlay.id='overlay'; overlay.className='overlay'; document.body.appendChild(overlay); }
    if(!panel){ panel = document.createElement('div'); panel.id='panel'; panel.className='panel'; overlay.appendChild(panel); }

    let i = 0;
    function render(){
      const s = steps[i];
      overlay.style.display = 'flex';
      panel.innerHTML = `
        <div class="title" style="margin-bottom:6px">${s.title || 'How to Play'}</div>
        ${s.html || `<p>${s.text||''}</p>`}
        <div style="display:flex; gap:8px; justify-content:center; margin-top:10px">
          ${i>0 ? `<button id="btnPrev" class="btn">← Prev</button>` : ``}
          ${i<steps.length-1 ? `<button id="btnNext" class="btn">Next →</button>` : `<button id="btnDone" class="btn">Done</button>`}
        </div>
      `;
      const prev = document.getElementById('btnPrev');
      const next = document.getElementById('btnNext');
      const done = document.getElementById('btnDone');
      prev && (prev.onclick = ()=>{ i=Math.max(0,i-1); render(); });
      next && (next.onclick = ()=>{ i=Math.min(steps.length-1,i+1); render(); });
      done && (done.onclick = ()=>{ overlay.style.display='none'; onDone && onDone(); });
    }
    render();
  }

  // ---------- Input ----------
  function attachBasicInput({ onLeft, onRight, onPause }){
    const leftArea  = document.getElementById('touchL') || document.body;
    const rightArea = document.getElementById('touchR') || document.body;
    leftArea.addEventListener('click',  () => onLeft  && onLeft());
    rightArea.addEventListener('click', () => onRight && onRight());
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') onLeft  && onLeft();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') onRight && onRight();
      if (e.key === 'Escape') onPause && onPause();
    });
  }

  return {
    now,
    beep: audio.beep.bind(audio),
    audio,
    startOverlay,
    tutorial,
    attachBasicInput,
    store
  };
})();
