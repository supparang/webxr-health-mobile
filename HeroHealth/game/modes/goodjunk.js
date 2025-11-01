// === Hero Health Academy — game/modes/goodjunk.js (Sequential Quests + Burst FX) ===
export const name = 'goodjunk';

// ---------- Glyph pools ----------
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
    feverLv:0,     // 0-3
    shield:false,
    shieldTime:0,
    t:0, acc:0,
    bus:null,

    // score/perfect track
    score:0,
    perfects:0,

    // quests
    questPool: [],
    qIndex:-1,
    q:null,       // {key, icon, label, need, progress, done, fail, remain}
  };

  const DIFF = {
    Easy:   { rate:0.82, life:1.90, size:52 },
    Normal: { rate:0.70, life:1.60, size:42 },
    Hard:   { rate:0.56, life:1.40, size:34 },
  };

  // ---------- API ----------
  function start({ time=45, diff='Normal' } = {}) {
    Object.assign(S, {
      alive:true, t:0, acc:0, combo:0, bestCombo:0, score:0, perfects:0,
      feverLv:0, shield:false, shieldTime:0
    });
    applyDiff(diff);
    ensureFeverLayer();
    buildQuestPool(); // สร้างพูลเควสต์ 10 แบบแบบสุ่มลำดับ
    nextQuest(true);
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

    // live-update quest remain (เช่น เควสต์ combo / fever)
    refreshQuestHUD();
  }

  function cleanup(){
    S.alive=false;
    document.querySelectorAll('.spawn-emoji,.burst,.ring,.pop-txt,.fever-fire').forEach(el=>{ try{el.remove();}catch{} });
    document.body.removeAttribute('data-fever');
    document.body.removeAttribute('data-fever-lv');
    document.body.removeAttribute('data-shield');
    setMissionLine('');
    hud?.setQuestChips?.([]);
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
      if (kind==='good') onMiss(); // ดีแล้วพลาด → คอมโบแตก
      // junk/others: ปล่อยผ่าน
    }, lifeMs);

    btn.addEventListener('click', (ev)=>{
      clearTimeout(killto);
      try{ btn.remove(); }catch{}
      handleHit(kind, ev.clientX||x, ev.clientY||y);
    }, { passive:true });

    host.appendChild(btn);
  }

  function handleHit(kind, cx, cy){
    if (kind==='good'){
      const perfect = Math.random() < 0.22;
      const pts = perfect ? 200 : 100;

      S.score += pts;
      S.combo++;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;
      if (perfect) S.perfects++;

      coach?.[perfect?'onPerfect':'onGood']?.();
      FX.pop(`+${pts}`, {x:cx,y:cy});
      FX.shatter({x:cx,y:cy});            // แตกกระจายแบบชิ้นส่วน
      feverUpdate();

      S.bus?.hit?.({ kind: perfect?'perfect':'good', points: pts, ui:{x:cx,y:cy} });
      onQuestProgress('good', { perfect });
    }
    else if (kind==='junk'){
      if (S.shield){
        S.shield=false; S.shieldTime=0; document.body.removeAttribute('data-shield');
        FX.ring({x:cx,y:cy});
        // ไม่หัก combo เพราะกันได้
        S.bus?.hit?.({ kind:'good', points: 0, ui:{x:cx,y:cy}, meta:{blocked:true} });
        onQuestProgress('block', {});
      } else {
        onMiss();
        FX.burst({x:cx,y:cy,color:'#ff6b6b'});
      }
    }
    else if (kind==='star'){
      const pts = 150;
      S.score += pts;
      S.combo++;
      if (S.combo > S.bestCombo) S.bestCombo = S.combo;

      FX.spark({x:cx,y:cy});
      feverUpdate(+1);
      S.bus?.hit?.({ kind:'perfect', points: pts, ui:{x:cx,y:cy}, meta:{star:true} });
      onQuestProgress('star', {});
    }
    else if (kind==='shield'){
      S.shield = true; S.shieldTime = 7.0;
      document.body.setAttribute('data-shield','1');
      FX.shield({x:cx,y:cy});
      S.bus?.hit?.({ kind:'good', points: 0, ui:{x:cx,y:cy}, meta:{shield:true} });
      onQuestProgress('shield', {});
    }
  }

  function onMiss(){
    S.combo = 0;
    feverUpdate(0,true);
    coach?.onBad?.();
    S.bus?.miss?.();
    onQuestProgress('miss', {});
  }

  // ---------- Fever ----------
  function feverUpdate(){
    const c = S.combo;
    let lv = 0;
    if (c >= 25) lv = 3; else if (c >= 15) lv = 2; else if (c >= 7) lv = 1; else lv = 0;

    if (lv !== S.feverLv){
      S.feverLv = lv;
      if (lv>0){
        ensureFeverLayer();
        document.body.setAttribute('data-fever','1');
        document.body.setAttribute('data-fever-lv', String(lv));
      } else {
        document.body.removeAttribute('data-fever');
        document.body.removeAttribute('data-fever-lv');
      }
      onQuestProgress('fever', {});
    }
  }

  // ---------- Quests ----------
  function buildQuestPool(){
    // สุ่มลำดับภารกิจ 10 แบบ
    const pool = [
      makeQuest('good5',   '✅', 'เก็บของดีให้ครบ',    { need:5,  watch:'good' }),
      makeQuest('good12',  '✅', 'เก็บของดีให้ครบ',    { need:12, watch:'good' }),
      makeQuest('perfect3','💠','ทำ PERFECT ให้ครบ',   { need:3,  watch:'perfect' }),
      makeQuest('star2',   '⭐', 'เก็บดาวให้ครบ',       { need:2,  watch:'star' }),
      makeQuest('shield1', '🛡️','เปิดโล่ให้สำเร็จ',    { need:1,  watch:'shield' }),
      makeQuest('combo8',  '🔥', 'ทำคอมโบให้ถึง',       { need:8,  watch:'combo-atleast' }),
      makeQuest('combo15', '🔥','ทำคอมโบให้ถึง',       { need:15, watch:'combo-atleast' }),
      makeQuest('fever1',  '⚡','เปิดโหมด Fever',       { need:1,  watch:'fever' }),
      makeQuest('score800','🏆','ทำคะแนนให้ถึง',        { need:800,watch:'score-atleast' }),
      makeQuest('no-miss3','🟦','อย่าพลาดของดี 3 ชิ้น', { need:3,  watch:'good-streak' }),
    ];
    S.questPool = shuffle(pool);
    S.qIndex = -1;
  }

  function makeQuest(key, icon, label, cfg){
    return { key, icon, label, ...cfg };
  }

  function nextQuest(initial=false){
    S.qIndex++;
    if (S.qIndex >= S.questPool.length){
      // หมดภารกิจ → วนซ้ำสุ่มใหม่
      buildQuestPool();
      S.qIndex = 0;
    }
    const qdef = S.questPool[S.qIndex];
    S.q = {
      key:qdef.key, icon:qdef.icon, label:qdef.label,
      watch:qdef.watch,
      need:qdef.need,
      progress:0, done:false, fail:false, remain:qdef.need
    };
    if (!initial) coach?.say?.('ภารกิจต่อไป!');
    refreshQuestHUD();
  }

  function onQuestProgress(event, info){
    if (!S.q || S.q.done) return;

    // อัปเดตตามชนิด watch
    switch (S.q.watch){
      case 'good':
        if (event==='good'){ S.q.progress++; }
        break;
      case 'perfect':
        if (event==='good' && info.perfect){ S.q.progress++; }
        break;
      case 'star':
        if (event==='star'){ S.q.progress++; }
        break;
      case 'shield':
        if (event==='shield'){ S.q.progress++; }
        break;
      case 'combo-atleast':
        if (S.combo >= S.q.need){ S.q.progress = S.q.need; }
        break;
      case 'fever':
        if (event==='fever' && S.feverLv>0){ S.q.progress = 1; }
        break;
      case 'score-atleast':
        if (S.score >= S.q.need){ S.q.progress = S.q.need; }
        break;
      case 'good-streak':
        if (event==='good'){ S.q.progress = Math.min(S.q.need, S.q.progress+1); }
        if (event==='miss'){ S.q.progress = 0; } // พลาดเริ่มนับใหม่
        break;
    }

    S.q.remain = Math.max(0, (S.q.need|0) - (S.q.progress|0));
    refreshQuestHUD();

    // เสร็จแล้ว → โบนัสเล็ก ๆ + ไปเควสต์ถัดไป
    if (S.q.progress >= S.q.need){
      S.q.done = true;
      coach?.say?.('ภารกิจสำเร็จ!');
      try { S.bus?.hit?.({ kind:'good', points: 150, ui:null, meta:{quest:S.q.key} }); } catch {}
      setTimeout(()=> nextQuest(false), 650);
    }
  }

  function refreshQuestHUD(){
    if (!S.q) { hud?.setQuestChips?.([]); setMissionLine(''); return; }
    const label = missionText(S.q);
    const chip = {
      key:S.q.key, icon:S.q.icon,
      label, progress:S.q.progress|0, need:S.q.need|0,
      done:!!S.q.done, fail:!!S.q.fail, remain:S.q.remain|0
    };
    hud?.setQuestChips?.([chip]);
    setMissionLine(label);
  }

  function missionText(q){
    switch(q.watch){
      case 'good':          return `${q.icon} ${q.label} ${q.need} ชิ้น (${q.progress}/${q.need})`;
      case 'perfect':       return `${q.icon} ${q.label} ${q.need} ครั้ง (${q.progress}/${q.need})`;
      case 'star':          return `${q.icon} ${q.label} ${q.need} ดวง (${q.progress}/${q.need})`;
      case 'shield':        return `${q.icon} ${q.label} (${q.progress}/${q.need})`;
      case 'combo-atleast': return `${q.icon} ${q.label} ${q.need}+`;
      case 'fever':         return `${q.icon} ${q.label} 1 ครั้ง`;
      case 'score-atleast': return `${q.icon} ${q.label} ${q.need}+ คะแนน`;
      case 'good-streak':   return `${q.icon} ${q.label} (${q.progress}/${q.need})`;
      default: return `${q.icon} ภารกิจ`;
    }
  }

  function setMissionLine(text=''){
    const el = document.getElementById('missionLine');
    if (!el) return;
    el.style.display = text ? 'inline-flex' : 'none';
    el.textContent = text || '';
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
    for(let i=0;i<20;i++){
      const p=document.createElement('i');
      p.className='burst';
      p.style.background=color;
      p.style.left=(x|0)+'px'; p.style.top=(y|0)+'px';
      document.body.appendChild(p);
      const ang=Math.random()*Math.PI*2;
      const sp = 220+Math.random()*220;
      const dx = Math.cos(ang)*sp, dy = Math.sin(ang)*sp;
      const t0=performance.now();
      (function anim(t){ const dt=(t-t0)/1000; const nx=x+dx*dt, ny=y+dy*dt+420*dt*dt;
        p.style.transform=`translate(${nx|0}px,${ny|0}px) rotate(${dt*720|0}deg)`; p.style.opacity=String(Math.max(0,1-dt*1.3));
        if(dt<0.8) requestAnimationFrame(anim); else try{p.remove();}catch{}; })(t0);
    }
  },
  spark({x,y}){ this.burst({x,y,color:'#ffe27a'}); },
  ring({x,y}){ const r=document.createElement('i'); r.className='ring'; r.style.left=x+'px'; r.style.top=y+'px'; document.body.appendChild(r); setTimeout(()=>r.remove(),600); },
  shield({x,y}){ this.ring({x,y}); },
  shatter({x,y}){ this.burst({x,y,color:'#a2ff9c'}); this.spark({x,y}); }
};

// ---------- DOM helpers ----------
function ensureHost(){
  return document.getElementById('spawnHost') ||
    document.body.appendChild(Object.assign(document.createElement('div'),{
      id:'spawnHost', style:'position:fixed;inset:0;pointer-events:none;z-index:12'
    }));
}
function pick(a){ return a[(Math.random()*a.length)|0]; }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

// ---------- CSS ----------
function injectCSS(){
  if (document.getElementById('gj-popup-style')) return;
  const css = `
  #spawnHost{ pointer-events:none; }
  .spawn-emoji{
    position:fixed; transform:translate(-50%,-50%) scale(1); border:0; background:transparent;
    text-shadow:0 3px 12px rgba(0,0,0,.45);
    filter: drop-shadow(0 6px 14px rgba(0,0,0,.45));
    transition: transform .08s ease; pointer-events:auto; cursor:pointer; user-select:none;
  }
  .spawn-emoji:active{ transform:translate(-50%,-50%) scale(1.1); }

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
    transform-origin:center; animation: ringGrow .45s ease forwards;
  }
  @keyframes ringGrow{ to{ transform:translate(-50%,-50%) scale(3.2); opacity:0; } }

  /* Fever overlay */
  #feverLayer{ position:fixed; left:0; right:0; top:0; bottom:0; pointer-events:none; z-index:5; mix-blend-mode:screen; display:none; }
  [data-fever="1"] #feverLayer{ display:block; }
  .fever-fire{
    position:absolute; left:-10%; right:-10%; bottom:-15%; height:55%;
    background:
      radial-gradient(30px 24px at 20% 110%, rgba(255,200,0,.9), rgba(255,130,0,.45) 55%, rgba(255,80,0,0) 70%),
      radial-gradient(26px 20px at 45% 110%, rgba(255,210,80,.85), rgba(255,120,0,.40) 55%, rgba(255,80,0,0) 70%),
      radial-gradient(34px 26px at 70% 110%, rgba(255,190,40,.9), rgba(255,110,0,.40) 55%, rgba(255,80,0,0) 70%),
      linear-gradient(0deg, rgba(255,140,0,.30), rgba(255,100,0,.12));
    animation: fireRise .9s ease-in-out infinite;
    opacity:.0;
  }
  [data-fever-lv="1"] .fever-fire{ opacity:.32; }
  [data-fever-lv="2"] .fever-fire{ opacity:.52; }
  [data-fever-lv="3"] .fever-fire{ opacity:.72; }
  @keyframes fireRise{ 0%{ transform:translateY(8px) scaleY(.9) } 50%{ transform:translateY(0) scaleY(1) } 100%{ transform:translateY(8px) scaleY(.9) } }

  /* Shield glow at page edge */
  [data-shield="1"]::after{
    content:''; position:fixed; inset:0; pointer-events:none; z-index:6;
    box-shadow:inset 0 0 0 3px rgba(120,220,255,.45), inset 0 0 60px rgba(120,220,255,.18);
  }
  `;
  const s=document.createElement('style'); s.id='gj-popup-style'; s.textContent=css; document.head.appendChild(s);
}

// ---------- Fever layer ----------
function ensureFeverLayer(){
  if (document.getElementById('feverLayer')) return;
  const wrap = document.createElement('div');
  wrap.id='feverLayer';
  wrap.innerHTML = `<div class="fever-fire"></div><div class="fever-fire"></div><div class="fever-fire"></div>`;
  document.body.appendChild(wrap);
}
