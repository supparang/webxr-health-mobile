// === Hero Health VR — Hydration Quest (2025-11-06) ===
// DOM overlay targets + Water Gauge + Coach + Mini Quests + Fever-like flow
// ปลอดภัย: ไม่มี THREE, ใช้เฉพาะ DOM/CSS, บูต/หยุดได้, กันโหลดซ้ำ

export async function boot(config = {}) {
  // ---------- Config ----------
  const hostEl   = config.host || document.getElementById('spawnHost') || document.body;
  const duration = Math.max(20, Math.round(Number(config.duration || 60))); // วินาที
  const diff     = (String(config.difficulty || 'normal')).toLowerCase();   // easy|normal|hard

  // ระดับความยาก: อัตราสปอน/อายุเป้า/คะแนน
  const DIFF = {
    easy  : { rateMin: 650,  rateMax: 900, life: 2100, goodPt: 18, badPt: -10, avoidBonus: 6 },
    normal: { rateMin: 520,  rateMax: 760, life: 1800, goodPt: 22, badPt: -12, avoidBonus: 7 },
    hard  : { rateMin: 420,  rateMax: 640, life: 1500, goodPt: 26, badPt: -14, avoidBonus: 8 }
  }[DIFF_sanitize(diff)];

  // พูลชิ้น (ไฮเดรชัน)
  const POOLS = {
    good:    ['💧','🥛','🧊','🍉','🥒','🍍水','🥤⚪'], // water, milk, ice, watery fruit (น้ำดี)
    bad:     ['🥤','🧋','🍺','🍹','🧃','🥤🟠'],        // sugary / caffeine (ลดคุณภาพ)
    special: ['⭐','💎','🛡️']                          // star/diamond/shield
  };

  // ---------- State ----------
  let running = true;
  let score = 0, combo = 0, comboMax = 0, misses = 0, hits = 0, spawns = 0;
  let left = duration;
  let spawnTimer = null, timeTimer = null, watchdog = null;

  // Water gauge 0..100 (GREEN zone 50..75)
  let water = 55;             // เริ่มกลางโซน
  let lastGaugeTick = performance.now();
  const greenMin = 50, greenMax = 75;

  // Fever-like flow: เก็บ "flow" เมื่ออยู่ใน GREEN ต่อเนื่อง
  let flow = 0;               // 0..100
  let feverActive = false;
  const FEVER = { threshold:100, decIdle: 6, decActive: 14, gainPerSec: 12, durMs: 8000 };
  let feverTimer = null;

  // Mini quest deck (สุ่มทีละใบ เล่นจบค่อยสุ่มใบต่อไป จนครบ 3 ใบ)
  const questsAll = [
    {id:'green10', label:'รักษาโซน GREEN ต่อเนื่อง 10 วิ',  check:s=>s.greenStreak>=10, prog:s=>Math.min(10,s.greenStreak), target:10},
    {id:'drink10', label:'ดื่มน้ำดี 10 ชิ้น',               check:s=>s.good>=10,        prog:s=>Math.min(10,s.good),       target:10},
    {id:'avoid5',  label:'หลีกเลี่ยงเครื่องดื่มหวาน 5 ครั้ง', check:s=>s.avoid>=5,       prog:s=>Math.min(5,s.avoid),       target:5},
    {id:'star3',   label:'เก็บดาว ⭐ 3 ดวง',                  check:s=>s.star>=3,         prog:s=>Math.min(3,s.star),        target:3},
    {id:'dia1',    label:'เก็บเพชร 💎 1 เม็ด',                 check:s=>s.dia>=1,          prog:s=>Math.min(1,s.dia),         target:1},
    {id:'score500',label:'ทำคะแนนรวม 500+',                   check:s=>s.score>=500,      prog:s=>Math.min(500,s.score),     target:500},
    {id:'combo12', label:'ทำคอมโบ 12',                        check:s=>s.comboMax>=12,    prog:s=>Math.min(12,s.comboMax),   target:12},
    {id:'milk3',   label:'ดื่ม 🥛 3',                          check:s=>s.milk>=3,         prog:s=>Math.min(3,s.milk),        target:3},
    {id:'ice6',    label:'เก็บ 🧊 6',                           check:s=>s.ice>=6,          prog:s=>Math.min(6,s.ice),         target:6},
    {id:'fruit6',  label:'เก็บผลไม้ฉ่ำน้ำ 6',                  check:s=>s.fruit>=6,        prog:s=>Math.min(6,s.fruit),       target:6},
  ];
  const stats = { good:0, bad:0, avoid:0, star:0, dia:0, shield:0, comboMax:0, score:0, milk:0, ice:0, fruit:0, greenStreak:0 };
  let questDeck = pickThree(questsAll);
  let questIdx = 0;

  // ---------- DOM Layer ----------
  ensureStyle();

  // เคลียร์ layer เก่าๆ เผื่อ reload
  document.querySelectorAll('.hha-layer').forEach(n=>{ try{n.remove();}catch{} });
  const layer = document.createElement('div');
  layer.className = 'hha-layer';
  document.body.appendChild(layer);

  // Coach bubble
  const coach = document.createElement('div');
  coach.className = 'hha-coach';
  coach.textContent = 'ดื่มน้ำเพื่อรักษาโซน GREEN!';
  document.body.appendChild(coach);

  // Fever aura (DOM pooled)
  const aura = document.createElement('div');
  aura.className = 'hha-aura';
  aura.style.display = 'none';
  document.body.appendChild(aura);

  // ---------- HUD fire helpers ----------
  function fire(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} }
  function updateScore(delta, good){
    score = clamp(score + delta, -99999, 999999);
    combo = good ? clamp(combo+1, 0, 9999) : 0;
    comboMax = Math.max(comboMax, combo);
    stats.comboMax = comboMax;
    stats.score = Math.max(stats.score, score);
    fire('hha:score', {score, combo, delta, good});
  }
  function updateTime(){ left = Math.max(0, left-1); fire('hha:time', {sec:left}); if(left<=0) end('timeout'); }
  function setQuestText(){
    const q = questDeck[questIdx];
    if(!q){ fire('hha:quest', {text:'Mini Quest — จบครบ 3 ใบแล้ว!'}); return; }
    const prog = (q.prog? q.prog(stats) : 0);
    const t = `Quest ${questIdx+1}/3: ${q.label} (${prog}/${q.target||'?'})`;
    fire('hha:quest', {text:t});
  }
  function coachSay(txt){ try{ coach.textContent = txt; coach.classList.add('show'); setTimeout(()=>coach.classList.remove('show'), 1200); }catch{} }

  // ---------- Gauge / Fever ----------
  function gaugeTick(){
    const now = performance.now();
    const dt = Math.max(0, now - lastGaugeTick) / 1000; // sec
    lastGaugeTick = now;

    // ธรรมชาติ: ลดช้า ๆ
    water = clamp(water - (diff==='hard'? 1.7 : diff==='easy'? 0.9 : 1.2) * dt, 0, 100);

    // อยู่ใน GREEN → flow++
    const inGreen = (water >= greenMin && water <= greenMax);
    if (inGreen) {
      stats.greenStreak = Math.min(9999, stats.greenStreak + dt);
      flow = clamp(flow + FEVER.gainPerSec * dt, 0, 100);
      fire('hha:fever', {state:'change', level:flow, active:feverActive});
      if (!feverActive && flow >= FEVER.threshold) startFever();
    } else {
      stats.greenStreak = 0;
      // นอกโซน → flow ค่อย ๆ ลด
      flow = clamp(flow - FEVER.decIdle * dt, 0, 100);
      fire('hha:fever', {state:'change', level:flow, active:feverActive});
    }

    // อัปเดตก๊อชเล็ก ๆ ให้เล่นรู้สึก
    if (water < 35)  coachSay('ขาดน้ำแล้ว! รีบดื่ม 💧');
    if (water > 85)  coachSay('เยอะไปนะ ลดหวาน/คาเฟอีนหน่อย ☕');

    // วาด progress bar (index.vr.html ฝั่ง HUD ฟัง hha:fever อยู่แล้ว)
  }

  function changeWater(by){
    water = clamp(water + by, 0, 100);
  }

  function startFever(){
    feverActive = true;
    flow = 100;
    aura.style.display = 'block';
    fire('hha:fever', {state:'start', level:flow, active:true});
    coachSay('FLOW! รักษาโซน GREEN ให้สุด!');
    clearTimeout(feverTimer);
    feverTimer = setTimeout(endFever, FEVER.durMs);
  }
  function endFever(){
    feverActive = false;
    flow = 0;
    aura.style.display = 'none';
    fire('hha:fever', {state:'end', level:0, active:false});
  }

  // ---------- Spawn ----------
  const cfg = DIFF;
  function planNext(){ if(!running) return; const w = rand(cfg.rateMin, cfg.rateMax) * (feverActive? 0.8 : 1.0); spawnTimer = setTimeout(spawnOne, w); }
  function spawnOne(forceCenter){
    if(!running) return;
    spawns++;

    const el = document.createElement('div');
    el.className = 'hha-tgt';
    const pick = pickSymbol();
    el.textContent = pick.char;
    el.dataset.type = pick.type;

    // pos
    const W = Math.max(320, window.innerWidth||320);
    const H = Math.max(320, window.innerHeight||320);
    const x = forceCenter ? W/2 : Math.floor(W*0.18 + Math.random()*W*0.64);
    const y = forceCenter ? H/2 : Math.floor(H*0.26 + Math.random()*H*0.48);
    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.fontSize = (diff==='easy'? 74 : diff==='hard'? 56 : 64) + 'px';

    let clicked = false;
    el.onclick = function onClick(ev){
      if(clicked) return;
      ev.preventDefault();
      clicked = true;

      layer.removeChild(el);

      // shard effect + score bubble
      explodeAt(x, y, pick.type);
      scoreBubble(x, y, pick.type === 'good' ? '+'+cfg.goodPt : (pick.type==='bad' ? cfg.badPt : '+0'));

      if(pick.type === 'good'){
        hits++; stats.good++;
        if(pick.char === '🥛') stats.milk++;
        if(pick.char === '🧊') stats.ice++;
        if(['🍉','🥒','🍍水'].includes(pick.char)) stats.fruit++;

        changeWater(pick.water || +6);
        updateScore(cfg.goodPt, true);
        coachSay(randomOf(['เยี่ยม!','สุดยอด!','ดีมาก!','ดื่มต่อเนื่อง!']));
      }
      else if(pick.type === 'bad'){
        hits++; stats.bad++;
        changeWater(pick.water || -8);
        updateScore(cfg.badPt, false);
        coachSay(randomOf(['หวานไป!','ระวังน้ำตาล!','ดื่มน้ำนำไว้!']));
      }
      else if(pick.type === 'star'){
        hits++; stats.star++;
        changeWater(+8);
        updateScore(+30, true);
        coachSay('ได้ ⭐ เพิ่มพลัง!');
      }
      else if(pick.type === 'diamond'){
        hits++; stats.dia++;
        changeWater(+12);
        updateScore(+60, true);
        coachSay('ได้ 💎 โบนันซ่า!');
      }
      else if(pick.type === 'shield'){
        hits++; stats.shield++;
        // shield → ล้างโทษครั้งถัดไป (ทำแบบง่าย: เพิ่มคอมโบ + ไม่ตัดคอมโบครั้งหน้า)
        coachSay('ได้โล่! ลดบทลงโทษครั้งหน้า');
        softShieldOnce();
      }

      questProgress();
      planNext();
    };

    // TTL (หลีกเลี่ยง = ไม่คลิกแล้วคาย)
    const TTL = setTimeout(()=>{
      if(!running) return;
      if(!layer.contains(el)) return;
      layer.removeChild(el);
      // no click
      if(el.dataset.type === 'bad'){
        // หลีกของหวาน → ได้หลบ
        stats.avoid++;
        updateScore(+cfg.avoidBonus, true);
        questProgress();
        coachSay('เก่งมาก เลี่ยงหวานได้!');
      }else{
        // good พลาด → โทษเบา + คอมโบรีเซ็ต
        misses++;
        combo = 0;
        updateScore(-6, false);
        changeWater(-4);
        coachSay('พลาดของดี! ลองใหม่');
      }
      planNext();
    }, cfg.life * (feverActive? 1.1 : 1.0));

    layer.appendChild(el);
  }

  // ---------- Shard & Score FX ----------
  function explodeAt(x, y, type){
    const colors = (type==='good') ? ['#6ee7b7','#22c55e','#86efac'] :
                   (type==='bad')  ? ['#fca5a5','#ef4444','#f87171'] :
                   (type==='star') ? ['#fde68a','#fbbf24','#f59e0b'] :
                   (type==='diamond') ? ['#93c5fd','#60a5fa','#38bdf8'] :
                   ['#cbd5e1','#94a3b8','#64748b'];
    for(let i=0;i<14;i++){
      const p = document.createElement('i');
      p.className = 'hha-shard';
      p.style.left = x+'px';
      p.style.top  = y+'px';
      p.style.background = colors[i%colors.length];
      const ang = Math.random()*Math.PI*2, sp = 2+Math.random()*5;
      const tx = Math.cos(ang)*sp*14, ty = Math.sin(ang)*sp*12 - 8;
      p.animate([
        { transform:`translate(-50%,-50%) translate(0px,0px) scale(1)`, opacity:1 },
        { transform:`translate(-50%,-50%) translate(${tx}px,${ty}px) scale(${0.8+Math.random()*0.5})`, opacity:0 }
      ], { duration: 520 + Math.random()*220, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards' });
      document.body.appendChild(p);
      setTimeout(()=>{ try{p.remove();}catch{} }, 900);
    }
  }
  function scoreBubble(x, y, text){
    const b = document.createElement('div');
    b.className = 'hha-bubble';
    b.textContent = text;
    b.style.left = x+'px'; b.style.top = y+'px';
    b.animate([
      { transform:'translate(-50%,-50%) translateY(0)', opacity:1 },
      { transform:'translate(-50%,-50%) translateY(-28px)', opacity:0 }
    ], { duration: 620, easing:'ease-out', fill:'forwards' });
    document.body.appendChild(b);
    setTimeout(()=>{ try{b.remove();}catch{} }, 700);
  }

  // ---------- Shield (ครั้งเดียว) ----------
  let shieldOnce = false;
  function softShieldOnce(){ shieldOnce = true; }
  function maybeConsumeShield(penaltyFn){
    if(shieldOnce){ shieldOnce=false; coachSay('โล่ป้องกันสำเร็จ!'); return; }
    penaltyFn && penaltyFn();
  }

  // ---------- Quests ----------
  function questProgress(){
    const q = questDeck[questIdx];
    if(!q) return;
    const ok = q.check(stats);
    setQuestText();
    if(ok){
      // จบใบนี้ → ไปใบถัดไป
      questIdx++;
      coachSay('เควสสำเร็จ! ไปต่อใบถัดไป 🎯');
      if(questIdx >= 3){
        fire('hha:quest', {text:'Mini Quest — สำเร็จครบ 3 ใบ!'});
      }else{
        setQuestText();
      }
    }
  }

  // ---------- Loops ----------
  function tick(){
    if(!running) return;
    gaugeTick();
    // decay flow extra เมื่อ feverActive
    if(feverActive) flow = clamp(flow - (FEVER.decActive/10), 0, 100);
    requestAnimationFrame(tick);
  }

  function start(){
    // reset HUD
    fire('hha:score', {score:0, combo:0});
    fire('hha:time',  {sec:left});
    fire('hha:fever', {state:'change', level:0, active:false});
    setQuestText();

    // เริ่มนับเวลา / spawn แรก
    clearInterval(timeTimer); timeTimer = setInterval(updateTime, 1000);
    spawnOne(true);
    planNext();

    // watchdog: ถ้า 2วิ ไม่มีเป้า ให้สร้างกลางจอ
    clearInterval(watchdog);
    watchdog = setInterval(()=>{
      if(!running) return;
      if(!layer.querySelector('.hha-tgt')) spawnOne(true);
    }, 2000);

    tick();
  }

  function end(reason='done'){
    if(!running) return;
    running = false;
    try{ clearInterval(timeTimer); }catch{}
    try{ clearTimeout(spawnTimer); }catch{}
    try{ clearInterval(watchdog); }catch{}
    try{ clearTimeout(feverTimer); }catch{}

    // ล้างเป้า
    layer.querySelectorAll('.hha-tgt').forEach(n=>{ try{n.remove();}catch{} });
    try{ layer.remove(); }catch{}
    try{ coach.remove(); }catch{}
    try{ aura.remove(); }catch{}

    const questsCleared = Math.min(3, questIdx);
    fire('hha:end', {
      reason, score, combo, comboMax, misses, hits, spawns,
      mode:'Hydration', difficulty: diff,
      duration, questsCleared, questsTotal: 3
    });
  }

  // ---------- Kick ----------
  start();

  // ---------- Public API ----------
  return {
    stop: ()=>end('quit'),
    pause: ()=>{ running=false; clearInterval(timeTimer); clearTimeout(spawnTimer); clearInterval(watchdog); clearTimeout(feverTimer); },
    resume: ()=>{ if(running) return; running=true; start(); }
  };

  // ---------- Utilities ----------
  function DIFF_sanitize(s){ return (['easy','normal','hard'].includes(s)? s : 'normal'); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
  function rand(a,b){ return Math.floor(a + Math.random()*(b-a)); }
  function randomOf(arr){ return arr[(Math.random()*arr.length)|0]; }
  function pickThree(all){
    const arr = all.slice();
    const out = [];
    while(out.length<3 && arr.length){
      const i = Math.floor(Math.random()*arr.length);
      out.push(arr.splice(i,1)[0]);
    }
    return out;
  }
  function pickSymbol(){
    // 70% good, 22% bad, 8% special (star/diamond/shield)
    const r = Math.random();
    if (r < 0.70){
      const c = randomOf(POOLS.good);
      return { type:'good', char:c, water: (c==='🧊'? +5 : c==='🥛'? +6 : ['🍉','🥒','🍍水'].includes(c)? +7 : +6) };
    } else if (r < 0.92){
      const c = randomOf(POOLS.bad);
      return { type:'bad', char:c, water: (c==='🧋'||c==='🍺'||c==='🍹'? -10 : -8) };
    } else {
      const tag = randomOf(['star','diamond','shield']);
      return tag==='star' ? {type:'star', char:'⭐'} :
             tag==='diamond' ? {type:'diamond', char:'💎'} :
             {type:'shield', char:'🛡️'};
    }
  }

  function ensureStyle(){
    if(document.getElementById('hydr-style')) return;
    const st = document.createElement('style');
    st.id = 'hydr-style';
    st.textContent = `
      .hha-layer{position:fixed;inset:0;z-index:650;pointer-events:auto;background:transparent}
      .hha-tgt{position:absolute;pointer-events:auto;display:block;transform:translate(-50%,-50%);
        font-size:64px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5)); user-select:none}
      .hha-coach{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);padding:8px 12px;border-radius:12px;
        background:#0f172acc;color:#e8eefc;border:1px solid #334155;z-index:910;font-weight:800;opacity:0;transition:.2s}
      .hha-coach.show{opacity:1}
      .hha-aura{position:fixed;inset:0;z-index:640; pointer-events:none; background:
        radial-gradient(1200px 400px at 50% 80%, rgba(255,183,3,.10), transparent 60%);}
      .hha-shard{position:fixed; width:8px; height:8px; border-radius:2px; z-index:900; pointer-events:none}
      .hha-bubble{position:fixed; left:0; top:0; transform:translate(-50%,-50%); z-index:920; pointer-events:none;
        color:#e8eefc; font-weight:800; text-shadow:0 2px 6px rgba(0,0,0,.45)}
    `;
    document.head.appendChild(st);
  }
}

export default { boot };
