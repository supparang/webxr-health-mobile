// === Hero Health Academy — game/modes/goodjunk.js
// Pop-up clickers (no falling): appear → click to score → auto-despawn if missed
// Combo → Fever overlay; includes ⭐ Star / 🛡️ Shield power-ups
export const name = 'goodjunk';

// ---------- Pools ----------
const GOOD  = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK  = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍨'];
const STAR  = '⭐';
const SHIELD= '🛡️';

// ---------- Factory ----------
export function create({ engine, hud, coach }) {
  const host = ensureHost();
  injectCSS();

  // runtime state
  const S = {
    alive:false,
    diff:'Normal',
    rate:0.70,     // spawn every X sec
    life:1.60,     // item lifetime (sec)
    size:38,       // font px
    pad:40,        // margin from edges
    combo:0,
    bestCombo:0,
    fever:false,
    feverLevel:0,  // 0-3
    shield:false,
    shieldTime:0,
    t:0, acc:0,
    bus:null
  };

  const DIFF = {
    Easy:   { rate:0.82, life:1.90, size:48 },
    Normal: { rate:0.70, life:1.60, size:40 },
    Hard:   { rate:0.56, life:1.40, size:34 },
  };

  // ---------- API ----------
  function start({ time=45, diff='Normal' } = {}) {
    Object.assign(S, { alive:true, t:0, acc:0, combo:0, bestCombo:0, fever:false, feverLevel:0, shield:false, shieldTime:0 });
    applyDiff(diff);
    ensureFeverLayer();
    coach?.onStart?.();
  }

  function update(dt, bus){
    if(!S.alive) return;
    S.bus = bus;
    S.t += dt; S.acc += dt;

    // shield countdown
    if (S.shield) {
      S.shieldTime -= dt;
      if (S.shieldTime <= 0) { S.shield=false; S.shieldTime=0; document.body.removeAttribute('data-shield'); }
    }

    // spawn by rate
    if (S.acc >= S.rate){
      S.acc -= S.rate;
      spawnOne();
    }
  }

  function cleanup(){
    S.alive=false;
    // remove all remnants
    document.querySelectorAll('.spawn-emoji,.fever-fire').forEach(el=>{ try{el.remove();}catch{} });
    document.body.removeAttribute('data-fever');
    document.body.removeAttribute('data-fever-lv');
    document.body.removeAttribute('data-shield');
  }

  // ---------- Core ----------
  function applyDiff(d='Normal'){
    S.diff = d;
    const cfg = DIFF[d] || DIFF.Normal;
    S.rate = cfg.rate;
    S.life = cfg.life;
    S.size = cfg.size;
  }

  function spawnOne(){
    const W = innerWidth, H = innerHeight;
    const pad = S.pad;
    // distribution: 70% good, 20% junk, 7% star, 3% shield
    const r = Math.random();
    let kind='good', glyph=pick(GOOD);
    if (r > 0.7 && r <= 0.9) { kind='junk'; glyph=pick(JUNK); }
    else if (r > 0.9 && r <= 0.97){ kind='star'; glyph=STAR; }
    else if (r > 0.97){ kind='shield'; glyph=SHIELD; }

    const x = Math.floor(pad + Math.random()*(W - pad*2));
    const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));

    const btn = document.createElement('button');
    btn.className = 'spawn-emoji';
    btn.type='button';
    btn.dataset.kind = kind;
    btn.textContent = glyph;
    Object.assign(btn.style,{
      left:x+'px', top:y+'px',
      fontSize: ((S.size) + (kind==='star'?2:0)) + 'px'
    });

    const lifeMs = Math.floor(S.life*1000);
    const killto = setTimeout(()=>{ // miss if not clicked
      try{ btn.remove(); }catch{}
      if (kind==='good'){
        miss(); // reset combo
      } else if (kind==='junk') {
        // avoided junk → no penalty
      }
    }, lifeMs);

    // click handler
    btn.addEventListener('click', (ev)=>{
      clearTimeout(killto);
      try{ btn.remove(); }catch{}
      handleHit(kind, ev.clientX||x, ev.clientY||y);
    }, { passive:true });

    host.appendChild(btn);
  }

  function handleHit(kind, cx, cy){
    // scoring
    let pts = 0;
    if (kind==='good'){
      const perfect = Math.random() < 0.22; // small chance
      pts = perfect ? 200 : 100;
      S.combo++;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      coach?.[perfect?'onPerfect':'onGood']?.();
      FX.pop(`+${pts}`, {x:cx,y:cy});
      feverUpdate();
      S.bus?.hit?.({ kind: perfect?'perfect':'good', points: pts, ui:{x:cx,y:cy} });
    }
    else if (kind==='junk'){
      if (S.shield){ // block once
        S.shield=false; S.shieldTime=0; document.body.removeAttribute('data-shield');
        FX.ring({x:cx,y:cy});
        S.bus?.hit?.({ kind:'good', points: 0, ui:{x:cx,y:cy}, meta:{blocked:true} });
      } else {
        miss();
        FX.burst({x:cx,y:cy,color:'#ff6b6b'});
      }
    }
    else if (kind==='star'){
      pts = 150;
      S.combo++;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      feverUpdate(+1);
      FX.spark({x:cx,y:cy});
      S.bus?.hit?.({ kind:'perfect', points: pts, ui:{x:cx,y:cy}, meta:{star:true} });
    }
    else if (kind==='shield'){
      S.shield = true; S.shieldTime = 7.0;
      document.body.setAttribute('data-shield','1');
      FX.shield({x:cx,y:cy});
      S.bus?.hit?.({ kind:'good', points: 0, ui:{x:cx,y:cy}, meta:{shield:true} });
    }
  }

  function miss(){
    S.combo = 0;
    feverUpdate(0,true);
    coach?.onBad?.();
    S.bus?.miss?.();
  }

  // ---------- Fever ----------
  function feverUpdate(delta=0, broke=false){
    // simple fever tiers by combo
    const c = S.combo;
    let lv = 0;
    if (c >= 25) lv = 3; else if (c >= 15) lv = 2; else if (c >= 7) lv = 1; else lv = 0;

    if (lv !== S.feverLevel){
      S.feverLevel = lv;
      if (lv>0){ ensureFeverLayer(); document.body.setAttribute('data-fever','1'); document.body.setAttribute('data-fever-lv', String(lv)); }
      else { document.body.removeAttribute('data-fever'); document.body.removeAttribute('data-fever-lv'); }
    }
  }

  function ensureFeverLayer(){
    if (document.getElementById('feverLayer')) return;
    const wrap = document.createElement('div');
    wrap.id='feverLayer';
    wrap.innerHTML = `
      <div class="fever-fire"></div>
      <div class="fever-fire"></div>
      <div class="fever-fire"></div>`;
    document.body.appendChild(wrap);
  }

  // ---------- Return instance ----------
  return { start, update, cleanup };
}

// ---------- FX helpers ----------
const FX = {
  pop(txt,{x,y}){
    const el=document.createElement('div');
    el.className='pop-txt';
    el.textContent=txt;
    el.style.left=(x|0)+'px';
    el.style.top =(y|0)+'px';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-70px) scale(1.1)'; el.style.opacity='0'; });
    setTimeout(()=>{ try{el.remove();}catch{} }, 720);
  },
  burst({x,y,color='#ffd166'}){
    for(let i=0;i<18;i++){
      const p=document.createElement('i');
      p.className='burst';
      p.style.background=color;
      p.style.left=(x|0)+'px'; p.style.top=(y|0)+'px';
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2;
      const sp = 180+Math.random()*160;
      const dx = Math.cos(ang)*sp, dy = Math.sin(ang)*sp;
      const t0=performance.now();
      (function anim(t){ const dt=(t-t0)/1000; const nx=x+dx*dt, ny=y+dy*dt+360*dt*dt;
        p.style.transform=`translate(${nx|0}px,${ny|0}px)`; p.style.opacity=String(Math.max(0,1-dt*1.4));
        if(dt<0.8) requestAnimationFrame(anim); else try{p.remove();}catch{}; })(t0);
    }
  },
  spark({x,y}){ this.burst({x,y,color:'#ffe27a'}); },
  ring({x,y}){ const r=document.createElement('i'); r.className='ring'; r.style.left=x+'px'; r.style.top=y+'px'; document.body.appendChild(r); setTimeout(()=>r.remove(),600); },
  shield({x,y}){ this.ring({x,y}); }
};

// ---------- DOM helpers ----------
function ensureHost(){
  return document.getElementById('spawnHost') ||
    document.body.appendChild(Object.assign(document.createElement('div'),{
      id:'spawnHost', style:'position:fixed;inset:0;pointer-events:none;z-index:12'
    }));
}
function pick(a){ return a[(Math.random()*a.length)|0]; }

// ---------- CSS ----------
function injectCSS(){
  if (document.getElementById('gj-popup-style')) return;
  const css = `
  #spawnHost{ pointer-events:none; }
  .spawn-emoji{
    position:fixed; transform:translate(-50%,-50%); border:0; background:transparent;
    text-shadow:0 3px 12px rgba(0,0,0,.45);
    filter: drop-shadow(0 6px 14px rgba(0,0,0,.45));
    transition: transform .08s ease; pointer-events:auto; cursor:pointer; user-select:none;
  }
  .spawn-emoji:active{ transform:translate(-50%,-50%) scale(1.08); }

  .pop-txt{
    position:fixed; left:0; top:0; transform:translate(-50%,-40px);
    font:900 16px ui-rounded,system-ui; color:#fff; text-shadow:0 2px 10px #000;
    pointer-events:none; transition:transform .72s ease, opacity .72s ease; opacity:1; z-index:99;
  }

  .burst{
    position:fixed; width:10px;height:10px;border-radius:3px; background:#ffd166; opacity:1;
    transform:translate(0,0); pointer-events:none; z-index:98;
  }
  .ring{
    position:fixed; width:12px;height:12px;border:2px solid #88e0ff;border-radius:99px;
    transform:translate(-50%,-50%) scale(1); opacity:1; pointer-events:none; z-index:98;
    transition:transform .45s ease, opacity .45s ease;
  }
  .ring{ transform-origin:center; }
  .ring{ animation: ringGrow .45s ease forwards; }
  @keyframes ringGrow{ to{ transform:translate(-50%,-50%) scale(3.2); opacity:0; } }

  /* Fever overlay */
  #feverLayer{ position:fixed; left:0; right:0; top:0; bottom:0; pointer-events:none; z-index:5; mix-blend-mode:screen; display:none; }
  [data-fever="1"] #feverLayer{ display:block; }
  .fever-fire{
    position:absolute; left:-10%; right:-10%; bottom:-15%; height:55%;
    background:
      radial-gradient(30px 24px at 20% 110%, rgba(255,200,0,.9), rgba(255,130,0,.55) 55%, rgba(255,80,0,0) 70%),
      radial-gradient(26px 20px at 45% 110%, rgba(255,210,80,.85), rgba(255,120,0,.45) 55%, rgba(255,80,0,0) 70%),
      radial-gradient(34px 26px at 70% 110%, rgba(255,190,40,.9), rgba(255,110,0,.45) 55%, rgba(255,80,0,0) 70%),
      linear-gradient(0deg, rgba(255,140,0,.35), rgba(255,100,0,.15));
    animation: fireRise .9s ease-in-out infinite;
    opacity:.0;
  }
  [data-fever-lv="1"] .fever-fire{ opacity:.35; }
  [data-fever-lv="2"] .fever-fire{ opacity:.55; }
  [data-fever-lv="3"] .fever-fire{ opacity:.75; }
  @keyframes fireRise{ 0%{ transform:translateY(8px) scaleY(.9) } 50%{ transform:translateY(0) scaleY(1) } 100%{ transform:translateY(8px) scaleY(.9) } }

  /* Shield glow at page edge */
  [data-shield="1"]::after{
    content:''; position:fixed; inset:0; pointer-events:none; z-index:6;
    box-shadow:inset 0 0 0 3px rgba(120,220,255,.45), inset 0 0 60px rgba(120,220,255,.18);
  }
  `;
  const s=document.createElement('style'); s.id='gj-popup-style'; s.textContent=css; document.head.appendChild(s);
}
