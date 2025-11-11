// === /HeroHealth/modes/goodjunk.safe.js (release with Progress HUD & Refill) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

/* ---------------- Progress HUD (Goal + Mini Quests) ---------------- */
function makeProgressHUD(title){
  // remove old
  document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
  const wrap = document.createElement('div');
  wrap.setAttribute('data-hha-ui','progress');
  Object.assign(wrap.style,{
    position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',
    width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',
    background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',
    padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
      <div id="ph-title">${title}</div>
      <div id="ph-note" style="opacity:.85"></div>
    </div>
    <div id="ph-goal" style="margin-bottom:6px">
      <div style="margin-bottom:4px" id="ph-goal-label">เป้า: -</div>
      <div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
        <div id="ph-goal-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div>
      </div>
    </div>
    <div id="ph-qwrap"></div>
  `;
  const qwrap = wrap.querySelector('#ph-qwrap');
  for (let i=0;i<3;i++){
    const row = document.createElement('div');
    row.style.marginBottom = '6px';
    row.innerHTML = `
      <div id="ph-q${i}-label" style="margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Quest ${i+1} —</div>
      <div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
        <div id="ph-q${i}-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div>
      </div>`;
    qwrap.appendChild(row);
  }
  document.body.appendChild(wrap);
  const api = {
    setTitle(t){ wrap.querySelector('#ph-title').textContent=t; },
    setNote(t){ wrap.querySelector('#ph-note').textContent=t||''; },
    setGoal(label,pct){ wrap.querySelector('#ph-goal-label').textContent=label; wrap.querySelector('#ph-goal-bar').style.width=Math.max(0,Math.min(100,Math.round(pct)))+'%'; },
    setQ(i,label,pct,active,done){
      const lab = wrap.querySelector('#ph-q'+i+'-label');
      const bar = wrap.querySelector('#ph-q'+i+'-bar');
      if(!lab||!bar) return;
      lab.textContent = (done?'✅ ':'') + (active?'▶️ ':'') + label;
      bar.style.width = Math.max(0,Math.min(100,Math.round(pct)))+'%';
    },
    dispose(){ try{ wrap.remove(); }catch{} }
  };
  window.addEventListener('hha:dispose-ui', ()=>api.dispose(), {once:true});
  return api;
}

/* ---------------- Game ---------------- */
export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD='🛡️';

  // Goal: เก็บ Good ให้ถึงเป้าตามระดับ (แต่อย่าพลาด)
  const GOAL_TARGET = {easy:15, normal:25, hard:35}[diff] || 25;

  // Tuning
  const tune = {
    easy:   { nextGap:[360,560], life:[1400,1700], minDist:0.34, junkRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, junkRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, junkRate:0.42, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  // HUD
  const HUD = makeProgressHUD('Good vs Junk');

  // State
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let starCount=0, diamondCount=0, noMissSec=0;
  let remain = dur, timerId=0, loopId=0, refillCount=0;

  // Fever (ง่ายๆ)
  let feverLv=0, feverOn=false;
  function addFever(dx){
    feverLv = Math.max(0, Math.min(100, feverLv+dx));
    window.dispatchEvent(new CustomEvent('hha:fever',{detail:{level:feverLv}}));
    if(!feverOn && feverLv>=100){ feverOn=true; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'start'}})); }
    if(feverOn && feverLv<=0){ feverOn=false; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end'}})); }
  }

  // Mini-quests (สุ่ม 3 ใบ; refill เมื่อครบ)
  function pickQuests(){ return drawThree('goodjunk', diff); }
  let QUESTS = pickQuests();
  let qIdx = 0;

  function questProg(i, stats){
    const q = QUESTS[i]; if(!q) return {pct:0,label:'-'};
    const have = (q.prog? q.prog(stats) : 0) || 0;
    const need = q.target || 1;
    const pct  = Math.max(0, Math.min(100, Math.round((have/need)*100)));
    const lab  = `${q.label} (${Math.min(need,have)}/${need})`;
    return {pct, label:lab, done: !!(q.check && q.check(stats))};
  }

  function updateHUD(){
    HUD.setNote(refillCount?`Mini Quest Refill +${refillCount}`:'');
    // Goal
    const gPct = Math.round((hits/GOAL_TARGET)*100);
    HUD.setGoal(`เป้า: เก็บของดีให้ได้ ${GOAL_TARGET} ชิ้น  —  คืบหน้า ${Math.min(hits,GOAL_TARGET)}/${GOAL_TARGET}`, gPct);
    // Quests
    const s = { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:feverOn?1:0, star:starCount, diamond:diamondCount, noMissTime:noMissSec };
    for (let i=0;i<3;i++){
      const {pct,label,done} = questProg(i, s);
      HUD.setQ(i, label, pct, i===qIdx, done);
    }
    // Badge
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${Math.min(3,qIdx+1)}/3 — ${QUESTS[qIdx]?.label||'-'}`}}));
  }

  function statsSnapshot(){
    return { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:feverOn?1:0, star:starCount, diamond:diamondCount, noMissTime:noMissSec };
  }

  function tryAdvanceQuest(){
    const q = QUESTS[qIdx]; if(!q) return;
    if (q.check && q.check(statsSnapshot())){
      qIdx = Math.min(2, qIdx+1);
      // ถ้าผ่านครบ 3 แล้ว และเวลาเหลือ ให้สุ่มชุดใหม่ (refill)
      if (qIdx===2 && QUESTS[2].check(statsSnapshot())) {
        if (remain>5){ // ยังเหลือเวลาพอ
          QUESTS = pickQuests(); qIdx = 0; refillCount++;
        }
      }
      updateHUD();
    }
  }

  // Helpers
  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0], C.life[1]);

  function end(reason='timeout'){
    if(!running) return;
    running=false;
    clearInterval(timerId); clearTimeout(loopId);
    document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Good vs Junk', difficulty:diff, score, combo:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared:3, questsTotal:3, reason
    }}));
    if (feverOn) window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end'}}));
  }

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }

  function worldPosOf(el){
    try{
      const v = new (window.AFRAME?AFRAME.THREE.Vector3:window.THREE?.Vector3||function(){})();
      if (el.object3D && el.object3D.getWorldPosition) return el.object3D.getWorldPosition(v);
    }catch{}
    const p = el.getAttribute('position')||{x:0,y:0,z:-1.6}; return {x:+p.x||0,y:+p.y||0,z:+p.z||-1.6};
  }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch, type;
    const r = Math.random();
    if      (r < 0.04) { ch=STAR;   type='star'; }
    else if (r < 0.06) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const goodPick = Math.random() > C.junkRate;
      ch   = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      type = goodPick ? 'good' : 'junk';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.7, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0, score-10); noMissSec=0; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); emitScore(); updateHUD(); }
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp = worldPosOf(el);

      if (type==='good'){
        const val = (feverOn?28:20) + combo*2;
        score += val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        addFever(+12);
        burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.05 });
        floatScore(scene, wp, '+'+val);
      } else if (type==='junk'){
        if (shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14, speed:0.9}); }
        else { combo=0; score=Math.max(0, score-15); misses++; noMissSec=0; addFever(-16); burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 }); floatScore(scene, wp, '-15'); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
      } else if (type==='star'){
        starCount++; score += 40; addFever(+22); burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond'){
        diamondCount++; score += 80; addFever(+30); burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎');
      } else if (type==='shield'){
        shield = Math.min(3, shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
      tryAdvanceQuest();
      updateHUD();
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // time
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{
    if(!running) return;
    remain=Math.max(0,remain-1);
    noMissSec = Math.min(9999, noMissSec+1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout'); else updateHUD();
  },1000);

  updateHUD();
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}
export default { boot };