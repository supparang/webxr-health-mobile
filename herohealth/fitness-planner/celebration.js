// === /herohealth/fitness-planner/celebration.js ===
// Lightweight celebration + badge (local-only)

'use strict';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

const KEY_BADGES = 'HHA_BADGES';
const KEY_FIT_DONE = 'HHA_FITNESS_DAY_DONE'; // map date->1
const KEY_FIT_STREAK = 'HHA_FITNESS_STREAK'; // {streak:int,lastDate:'YYYY-MM-DD'}

function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
function save(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }
function load(k,d){ try{ return safeParseJSON(localStorage.getItem(k)||'null') ?? d; }catch(_){ return d; } }

export function isFitnessDayDone(date=todayKey()){
  const m = load(KEY_FIT_DONE, {});
  return !!m[date];
}

export function awardFitnessDayBadge(opts){
  const o = Object.assign({
    pid:'anon',
    run:'play',
    date: todayKey(),
    title: 'Fitness Day Complete',
    id: 'fitness_day_complete'
  }, opts||{});

  // mark done by date
  const doneMap = load(KEY_FIT_DONE, {});
  doneMap[o.date] = 1;
  save(KEY_FIT_DONE, doneMap);

  // badges list
  const badges = load(KEY_BADGES, []);
  const exists = badges.some(b => b.id===o.id && b.date===o.date && String(b.pid)===String(o.pid));
  if(!exists){
    badges.unshift({
      id: o.id,
      title: o.title,
      date: o.date,
      pid: String(o.pid||'anon'),
      run: String(o.run||'play'),
      ts: Date.now()
    });
    save(KEY_BADGES, badges.slice(0, 300));
  }

  // streak update
  const streak = load(KEY_FIT_STREAK, { streak:0, lastDate:'' });
  const yesterday = (()=>{
    const d = new Date(o.date + 'T00:00:00');
    d.setDate(d.getDate()-1);
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const da=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  })();

  if(streak.lastDate === o.date){
    // already counted
  } else if(streak.lastDate === yesterday){
    streak.streak = (Number(streak.streak)||0) + 1;
    streak.lastDate = o.date;
  } else {
    streak.streak = 1;
    streak.lastDate = o.date;
  }
  save(KEY_FIT_STREAK, streak);

  return { badgeAdded: !exists, streak: streak.streak, date:o.date };
}

export function playCelebration(opts){
  const o = Object.assign({
    durationMs: 2800,
    title: 'สำเร็จแล้ว!',
    subtitle: '🏅 Fitness Day Complete',
    silent: false
  }, opts||{});

  const ov = document.createElement('div');
  ov.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,.45);
    display:flex; align-items:center; justify-content:center;
    pointer-events:none;
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
    color:rgba(255,255,255,.96);
  `;

  ov.innerHTML = `
    <div style="width:min(680px,94vw); text-align:center;">
      <div style="font-size:64px; font-weight:900; text-shadow:0 12px 40px rgba(0,0,0,.55);">🎉</div>
      <div style="margin-top:10px; font-size:22px; font-weight:900;">${o.title}</div>
      <div style="margin-top:6px; opacity:.92; font-size:14px;">${o.subtitle}</div>
      <div id="confetti" style="position:relative; margin-top:18px; height:160px;"></div>
    </div>
  `;

  document.body.appendChild(ov);

  // confetti DOM (light)
  const layer = ov.querySelector('#confetti');
  const N = 70;
  const w = 600;
  for(let i=0;i<N;i++){
    const p = document.createElement('div');
    const size = 6 + Math.random()*10;
    const x = Math.random()*w;
    const d = 600 + Math.random()*1200;
    const rot = Math.random()*360;
    p.style.cssText = `
      position:absolute; left:${x}px; top:${-20 - Math.random()*120}px;
      width:${size}px; height:${size*0.7}px;
      background:rgba(255,255,255,${0.22 + Math.random()*0.55});
      border-radius:3px;
      transform:rotate(${rot}deg);
      animation: fall ${d}ms ease-in forwards;
    `;
    layer.appendChild(p);
  }

  // keyframes
  const st = document.createElement('style');
  st.textContent = `
    @keyframes fall {
      0% { transform: translateY(0px) rotate(0deg); opacity:1; }
      100% { transform: translateY(220px) rotate(220deg); opacity:0; }
    }
  `;
  document.head.appendChild(st);

  // tiny beep (optional)
  if(!o.silent){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o1 = ctx.createOscillator();
      const g = ctx.createGain();
      o1.type = 'sine';
      o1.frequency.value = 660;
      g.gain.value = 0.03;
      o1.connect(g); g.connect(ctx.destination);
      o1.start();
      setTimeout(()=>{ o1.frequency.value = 880; }, 120);
      setTimeout(()=>{ o1.stop(); ctx.close(); }, 260);
    }catch(_){}
  }

  setTimeout(()=>{
    ov.remove();
    st.remove();
  }, o.durationMs);
}