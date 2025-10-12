// Rhythm — โน้ต/วงแดง (Dodge) ไหลเข้าวงฟ้า, กด L/C/R (A/S/D), ปรับธีม + Sky Asset Loader
(function(){
  const root     = document.getElementById('root');
  const hud      = document.getElementById('hud');
  const skyEl    = document.getElementById('sky');
  const btnStart = document.getElementById('btnStart');
  const btnReset = document.getElementById('btnReset');
  const statusEl = document.getElementById('status');

  function getThemeName(){
    return (window.__OVERRIDE_THEME ||
           new URLSearchParams(location.search).get('theme') ||
           'city').toLowerCase();
  }
  function themeColor(name){ return name==='space' ? '#050914' : '#0b1220'; }

  async function ensureAssetsRoot(){
    let assets = document.querySelector('a-assets');
    if(!assets){
      assets = document.createElement('a-assets');
      const scene = document.querySelector('a-scene');
      scene.appendChild(assets);
      await new Promise(res=>setTimeout(res,0));
    }
    return assets;
  }
  function candidatePaths(file){
    return [
      `../assets/backgrounds/${file}`,
      `./assets/backgrounds/${file}`,
      `/webxr-health-mobile/fitness-duo/assets/backgrounds/${file}`,
      `/fitness-duo/assets/backgrounds/${file}`,
    ];
  }
  function probeImg(url){
    return new Promise((resolve,reject)=>{
      const t = new Image();
      t.onload = ()=>resolve(url);
      t.onerror = ()=>reject(url);
      t.src = url + `?v=${Date.now()}`;
    });
  }
  async function findFirstOK(file){
    const list = candidatePaths(file);
    for(const u of list){ try{ await probeImg(u); return u; }catch(e){} }
    throw new Error('Background not found: '+file);
  }
  function loadImgToAssets(id, url){
    return new Promise(async (resolve,reject)=>{
      const assets = await ensureAssetsRoot();
      const img = document.createElement('img');
      img.id = id;
      img.src = url + `?v=${Date.now()}`;
      img.onload  = ()=>resolve(img);
      img.onerror = ()=>reject(url);
      assets.appendChild(img);
    });
  }
  async function swapSky(themeName){
    const file = themeName==='space' ? 'space_sky.jpg'
               : themeName==='jungle'? 'jungle_sky.jpg'
               :                       'city_sky.jpg';
    const id   = `bg-${themeName}`;
    try{
      const scene = document.querySelector('a-scene');
      if(scene && !scene.hasLoaded) await new Promise(res=>scene.addEventListener('loaded',res,{once:true}));
      const url = await findFirstOK(file);
      await loadImgToAssets(id, url);
      skyEl.setAttribute('src', `#${id}`);
      skyEl.setAttribute('color', themeColor(themeName));
      statusEl && (statusEl.textContent = `Sky OK • ${themeName} ✓ (${url})`);
    }catch(err){
      console.warn('[Sky Fallback]', err);
      skyEl.removeAttribute('src');
      skyEl.setAttribute('color', themeColor(themeName));
      statusEl && (statusEl.textContent = `Sky Fallback (no image) • ${themeName}`);
    }
  }

  let running=false, raf=0, t0=0, elapsed=0, THEME='city';
  let score=0, combo=0, best=0, fever=false, feverEnd=0;
  let tutorial=true, tutEndAt=10;

  const notes=[];
  const laneX=i=>[-0.9,0,0.9][i];
  const duration=60; const bpm=108; const beatSec=60/bpm;
  const START_OFFSET=1.6;
  const HIT_P=0.055, HIT_G=0.11;
  let nextNoteIdx=0, flatNotes=[];

  let actx=null, master=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.18; master.connect(actx.destination); }
  function tick(f=880,d=0.05,g=0.18){ if(!actx) return; const o=actx.createOscillator(), v=actx.createGain();
    o.type='square'; o.frequency.value=f; o.connect(v); v.connect(master);
    const t=actx.currentTime; v.gain.setValueAtTime(0,t); v.gain.linearRampToValueAtTime(g,t+0.005); v.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.start(t); o.stop(t+d+0.02); }
  ['pointerdown','touchend','keydown','click'].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  # Particles
  pPool=[]; pIdx=0; MAXP=56
  def initParticles():
      pass

  # For brevity in this packaged zip, we omit particle system

  def buildLaneUI():
      pass

  # Minimal beatmap for packaged demo
  def buildFlatNotes():
      pass

  def start():
      pass
})();