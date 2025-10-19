// ---------- Imports ----------
import { Engine } from './core/engine.js';

// UI helpers (ภายในไฟล์ย่อยถูกอินไลน์ไว้ตรงนี้เพื่อความง่ายบน Pages)
class HUD{
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=v|0; }
  setCombo(v){ const e=document.getElementById('combo'); if(e) e.textContent='x'+(v||1); }
  setTime(v){ const e=document.getElementById('time'); if(e) e.textContent=v|0; }
  setDiff(v){ const e=document.getElementById('difficulty'); if(e) e.textContent=v; }
  setMode(v){ const e=document.getElementById('modeName'); if(e) e.textContent=v; }
  fever(a){ const e=document.getElementById('fever'); if(e) e.style.display=a?'inline-block':'none'; }
  setHydration(p,z){
    const bar=document.getElementById('hydroBar'), lab=document.getElementById('hydroLabel'), wrap=document.getElementById('hydroWrap');
    if(wrap) wrap.style.display='block';
    if(bar) bar.style.width=Math.max(0,Math.min(100,p))+'%';
    if(lab) lab.textContent=Math.round(p)+'% '+(z==='ok'?'พอดี':(z==='low'?'น้อยไป':'มากไป'));
  }
  hideHydration(){ const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='none'; }
}

class Coach{
  say(t){ const box=document.getElementById('coachHUD'), text=document.getElementById('coachText'); if(!box||!text) return;
    text.textContent=t; box.style.display='block'; clearTimeout(this._t); this._t=setTimeout(()=>box.style.display='none',1200); }
  onCombo(x){ this.say('Combo x'+x+'!'); }
  onFever(){ this.say('FEVER!!'); }
}

class ScoreSystem{
  constructor(){ this.reset(); }
  reset(){ this.score=0; this.combo=0; this.bestCombo=0; }
  add(v){ this.score+=v; if(v>0){ this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo); } if(v<0) this.bad(); return this.score; }
  bad(){ this.combo=0; }
}
class FeverSystem{
  constructor(){ this.timer=0; this.active=false; }
  scoreMul(){ return this.active?2:1; }
  update(dt){ if(this.active){ this.timer-=dt; if(this.timer<=0) this.active=false; } }
  onBad(){ this.active=false; }
}
class PowerUpSystem{
  constructor(){ this.timeScale=1; this.scoreBoost=0; this._shield=0; }
  apply(k){ if(k==='slow'){ this.timeScale=0.8; setTimeout(()=>this.timeScale=1,5000);} if(k==='boost'){ this.scoreBoost=0.5; setTimeout(()=>this.scoreBoost=0,5000);} if(k==='shield'){ this._shield=Math.min(2,this._shield+1);} }
  tick(){}
  consumeShield(){ if(this._shield>0){ this._shield--; return true; } return false; }
}
class MissionSystem{ roll(mode){ this.goal={mode,target:30}; } evaluate(){ return 0; } }
class Leaderboard{ submit(mode,diff,score){ try{ const k='hha_board'; const arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.push({t:Date.now(),mode,diff,score}); localStorage.setItem(k, JSON.stringify(arr).slice(0,200000)); }catch{} } }

// ---------- Game Data ----------
const SETTINGS={lang:'TH', sound:true, quality:'High'};
const I18N={
  TH:{brand:'HERO HEALTH ACADEMY',
      modes:{goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'},
      diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'},
      helpTitle:'วิธีเล่น (How to Play)',
      buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'},
      result:{title:'สรุปผล',tips:'เคล็ดลับ'}},
  EN:{brand:'HERO HEALTH ACADEMY',
      modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},
      diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},
      helpTitle:'How to Play',
      buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'},
      result:{title:'Results',tips:'Tips'}}
};
const HELP_TH={
  goodjunk:`<h3>🥗 ดี vs ขยะ</h3><ul><li>เก็บอาหารดี (+5), หลีกเลี่ยงขยะ (−2)</li><li>ปล่อยขยะผ่าน (+1)</li><li>Power: ⭐ ⏳ 🛡️ ⏱ | Trap: 💣 🎭</li></ul>`,
  groups:`<h3>🍽️ จาน 5 หมู่</h3><ul><li>เก็บให้ตรง 🎯 บน HUD</li><li>ถูกหมวด +7 | ผิด −2 | ครบ 3 ชิ้นเปลี่ยนเป้า</li></ul>`,
  hydration:`<h3>💧 สมดุลน้ำ</h3><ul><li>รักษา 45–65%</li><li>💧 เพิ่ม | 🧋 ลด</li><li>มากไป+เก็บน้ำ=โทษ, น้อยไป+เก็บหวาน=โทษ</li></ul>`,
  plate:`<h3>🍱 จัดจานสุขภาพ</h3><ul><li>เติมโควตาแต่ละหมู่</li><li>ที่ขาด +6 | PERFECT +14</li><li>เกินโควตา −2 / −1s + คอมโบแตก</li></ul>`
};
const HELP_EN={
  goodjunk:`<h3>🥗 Healthy vs Junk</h3><ul><li>Pick healthy (+5), avoid junk (−2)</li><li>Let junk pass (+1)</li><li>Power: ⭐ ⏳ 🛡️ ⏱ | Traps: 💣 🎭</li></ul>`,
  groups:`<h3>🍽️ Food Groups</h3><ul><li>Match 🎯 on HUD</li><li>Correct +7 | Wrong −2 | 3 hits → new target</li></ul>`,
  hydration:`<h3>💧 Hydration</h3><ul><li>Keep 45–65%</li><li>💧 up | 🧋 down</li><li>Too high+water=penalty, too low+sweet=penalty</li></ul>`,
  plate:`<h3>🍱 Healthy Plate</h3><ul><li>Fill each quota</li><li>Needed +6 | PERFECT +14</li><li>Overfill −2 / −1s + combo reset</li></ul>`
};

const DIFFS={
  Easy:{time:70, spawnBase:820, life:4200, trapRate:0.03, powerRate:0.10, hydWaterRate:0.78},
  Normal:{time:60, spawnBase:700, life:3000, trapRate:0.05, powerRate:0.08, hydWaterRate:0.66},
  Hard:{time:50, spawnBase:560, life:1900, trapRate:0.07, powerRate:0.06, hydWaterRate:0.55}
};

// Modes (minimal meta)
const GJ_GOOD=['🥦','🍎','🍇','🥕','🍅','🌽','🥚'];
const GJ_JUNK=['🍔','🍟','🍕','🥤','🍩'];
function pickGJ(){ const good=Math.random()<0.6; const char=(good?GJ_GOOD:GJ_JUNK)[Math.floor(Math.random()*(good?GJ_GOOD.length:GJ_JUNK.length))]; return {type:'gj', good, char}; }

const GROUPS=[{key:'grain',label:'ธัญพืช',icons:['🍞','🍚','🥖','🥨']},{key:'veg',label:'ผัก',icons:['🥦','🥕','🥒','🥬']},{key:'protein',label:'โปรตีน',icons:['🥩','🍗','🥚','🐟']},{key:'fruit',label:'ผลไม้',icons:['🍎','🍌','🍇','🍊']},{key:'dairy',label:'นม',icons:['🥛','🧀']}];
function groupsInit(state,hud){ state.currentTarget=GROUPS[Math.floor(Math.random()*GROUPS.length)].key; document.getElementById('targetWrap').style.display='block'; const badge=document.getElementById('targetBadge'); const g=GROUPS.find(x=>x.key===state.currentTarget); if(badge) badge.textContent=g?g.label:state.currentTarget; }
function pickGroups(){ const g=GROUPS[Math.floor(Math.random()*GROUPS.length)]; return {type:'groups',group:g.key,char:g.icons[Math.floor(Math.random()*g.icons.length)]}; }

function hydInit(state,hud){ state.hyd=50; state.hydMin=45; state.hydMax=65; document.getElementById('hydroWrap').style.display='block'; hud.setHydration(state.hyd,'ok'); }
function pickHyd(diff,state){ const water=Math.random()<(DIFFS[state.difficulty]?.hydWaterRate||0.66); return {type:'hydra',water,char:water?'💧':'🧋'}; }

const PLATE_QUOTA={grain:2,veg:2,protein:1,fruit:1,dairy:1};
const PLATE_GROUPS={grain:['🍞','🍚','🥖','🥨'],veg:['🥦','🥕','🥒','🥬'],protein:['🥩','🍗','🥚','🐟'],fruit:['🍎','🍌','🍇','🍊'],dairy:['🥛','🧀']};
function plateInit(state){ state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; document.getElementById('plateTracker').style.display='block'; renderPills(state); }
function renderPills(state){ const pills=document.getElementById('platePills'); if(!pills) return; pills.innerHTML=''; const labels={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}; Object.keys(PLATE_QUOTA).forEach(k=>{ const cur=state.plate[k], need=PLATE_QUOTA[k]; const el=document.createElement('div'); el.className='pill'+(cur>=need?' done':''); el.textContent=`${labels[k]} ${cur}/${need}`; pills.appendChild(el); }); }
function pickPlate(){ const keys=Object.keys(PLATE_GROUPS); const k=keys[Math.floor(Math.random()*keys.length)]; return {type:'plate',group:k,char:PLATE_GROUPS[k][Math.floor(Math.random()*PLATE_GROUPS[k].length)]}; }

// ---------- Globals ----------
const canvas=document.getElementById('c');
const engine=new Engine(THREE, canvas);
const hud=new HUD();
const coach=new Coach();

const sfx={
  ding(){ if(!SETTINGS.sound) return; const a=document.getElementById('sfx-ding'); try{a.currentTime=0;a.play();}catch{} },
  thud(){ if(!SETTINGS.sound) return; const a=document.getElementById('sfx-thud'); try{a.currentTime=0;a.play();}catch{} },
  tick(){ if(!SETTINGS.sound) return; const a=document.getElementById('sfx-tick'); try{a.currentTime=0;a.play();}catch{} },
  fever(){ if(!SETTINGS.sound) return; const a=document.getElementById('sfx-fever'); try{a.currentTime=0;a.play();}catch{} },
  perfect(){ if(!SETTINGS.sound) return; const a=document.getElementById('sfx-perfect'); try{a.currentTime=0;a.play();}catch{} }
};

const systems={ score:new ScoreSystem(), fever:new FeverSystem(), power:new PowerUpSystem(), mission:new MissionSystem(), board:new Leaderboard(), fx:sfx };

const MODES={
  goodjunk:{name:'ดี vs ขยะ', init(){}, pickMeta:pickGJ, onHit(meta){ systems.score.add(meta.good?5:-2); }},
  groups:{name:'จาน 5 หมู่', init:groupsInit, pickMeta:pickGroups, onHit(meta,state){ const ok=state.currentTarget && meta.group===state.currentTarget; if(ok){ systems.score.add(7); state.ctx.targetHitsTotal=(state.ctx.targetHitsTotal||0)+1; if((state.ctx.targetHitsTotal%3)===0){ const all=['grain','veg','protein','fruit','dairy']; let next=state.currentTarget; while(next===state.currentTarget){ next=all[Math.floor(Math.random()*all.length)]; } state.currentTarget=next; const lab={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}; const badge=document.getElementById('targetBadge'); if(badge) badge.textContent=lab[next]||next; } } else { systems.score.add(-2); }}},
  hydration:{name:'สมดุลน้ำ', init:hydInit, pickMeta:pickHyd, onHit(meta,state){ if(meta.water){ state.hyd=Math.min(100,(state.hyd||50)+5); systems.score.add(5); } else { state.hyd=Math.max(0,(state.hyd||50)-6); systems.score.add(-3); state.ctx.sweetMiss=(state.ctx.sweetMiss||0)+1; } const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok'); hud.setHydration(state.hyd,z); }},
  plate:{name:'จัดจานสุขภาพ', init:plateInit, pickMeta:pickPlate, onHit(meta,state){ const k=meta.group, need=PLATE_QUOTA[k], cur=state.plate[k]||0; if(cur<need){ state.plate[k]=cur+1; systems.score.add(6); state.ctx.plateFills=(state.ctx.plateFills||0)+1; const done=Object.keys(PLATE_QUOTA).every(g=>state.plate[g]>=PLATE_QUOTA[g]); if(done){ systems.score.add(14); state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1; state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; } } else { systems.score.add(-2); state.timeLeft=Math.max(0,(state.timeLeft||0)-1); state.ctx.overfillCount=(state.ctx.overfillCount||0)+1; systems.score.bad(); state.__plateLast={overfill:true,delta:-2}; } renderPills(state); }}
};

const state={
  modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60,
  ACTIVE:new Set(), lane:{},
  ctx:{bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0},
  hydMin:45, hydMax:65, hyd:50, __plateLast:null
};

// ---------- UI Apply ----------
function applyLanguage(){
  const L=I18N[SETTINGS.lang]; const Q=s=>document.querySelector(s);
  document.querySelector('.brand div').textContent=L.brand;
  Q('button[data-action="mode"][data-value="goodjunk"]')?.replaceChildren(L.modes.goodjunk);
  Q('button[data-action="mode"][data-value="groups"]')?.replaceChildren(L.modes.groups);
  Q('button[data-action="mode"][data-value="hydration"]')?.replaceChildren(L.modes.hydration);
  Q('button[data-action="mode"][data-value="plate"]')?.replaceChildren(L.modes.plate);
  Q('button[data-action="diff"][data-value="Easy"]')?.replaceChildren(L.diff.Easy);
  Q('button[data-action="diff"][data-value="Normal"]')?.replaceChildren(L.diff.Normal);
  Q('button[data-action="diff"][data-value="Hard"]')?.replaceChildren(L.diff.Hard);
  Q('button[data-action="start"]')?.replaceChildren(L.buttons.start);
  Q('button[data-action="pause"]')?.replaceChildren(L.buttons.pause);
  Q('button[data-action="restart"]')?.replaceChildren(L.buttons.restart);
  Q('button[data-action="help"]')?.replaceChildren(L.buttons.help);
  document.querySelector('#help h2')?.replaceChildren(L.helpTitle);
  document.getElementById('resTitle')?.replaceChildren(L.result.title);
  document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey);
  document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty);
}
function applySound(){ document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound); const b=document.getElementById('soundToggle'); if(b) b.textContent=SETTINGS.sound?'🔊':'🔇'; }
function applyQuality(){
  const q=SETTINGS.quality;
  const dpr = q==='High'?(window.devicePixelRatio||1):q==='Medium'?Math.max(0.75,(window.devicePixelRatio||1)*0.75):0.5;
  try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{}
  document.body.style.filter = (q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':'';
}
function openHelpFor(modeKey){
  const html=(SETTINGS.lang==='EN'?HELP_EN:HELP_TH)[modeKey||state.modeKey]||'<p>-</p>';
  document.getElementById('helpBody').innerHTML=html;
  document.getElementById('help').style.display='flex';
}

// ---------- Spawn System ----------
function setupLanes(){ const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2; state.lane={X,Y,Z,occupied:new Set(),cooldown:new Map(),last:null}; }
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){
  const {X,Y,Z,occupied,cooldown}=state.lane; const cand=[];
  for(let r=0;r<Y.length;r++){ for(let c=0;c<X.length;c++){
    const k=r+','+c, cd=cooldown.get(k)||0, free=!occupied.has(k)&&now()>cd&&!isAdj(r,c);
    if(free) cand.push({r,c,k});
  } }
  if(!cand.length) return null;
  const p=cand[Math.floor(Math.random()*cand.length)];
  occupied.add(p.k); state.lane.last=[p.r,p.c];
  return {x:X[p.c],y:1.6+Y[p.r],z:Z-0.1*Math.abs(p.c-2),key:p.k};
}
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }

const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'},{type:'power',kind:'timeplus',char:'⏱️➕'},{type:'power',kind:'timeminus',char:'⏱️➖'}];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];
function maybeSpecial(meta){
  const t=state.diffCfg?.trapRate??0.05, p=state.diffCfg?.powerRate??0.08, r=Math.random();
  if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)];
  if(r<p+t) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)];
  return meta;
}

function spawnOnce(){
  const lane=pickLane(); if(!lane) return;
  let meta;
  if(state.modeKey==='goodjunk') meta=pickGJ();
  else if(state.modeKey==='groups') meta=pickGroups();
  else if(state.modeKey==='hydration') meta=pickHyd(state.difficulty,state);
  else meta=pickPlate();
  meta = maybeSpecial(meta);

  const m=engine.makeBillboard(meta.char);
  m.position.set(lane.x,lane.y,lane.z);
  m.userData={lane:lane.key,meta};
  engine.group.add(m); state.ACTIVE.add(m);

  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{
    if(!m.parent) return;
    if(meta.type==='gj' && meta.good===false){ systems.score.add(1); }
    if(meta.type==='groups'){ if(state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); } else { state.ctx.groupWrong++; } }
    if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; }
    updateHUD(); destroy(m);
  }, life + Math.floor(Math.random()*500-250));
}

function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

// ---------- Hit ----------
function hit(obj){
  const meta=obj.userData.meta;
  const baseAdd=systems.score.add.bind(systems.score);
  systems.score.add=(v)=>baseAdd(v*systems.fever.scoreMul()*(1+systems.power.scoreBoost));

  // per mode scoring
  if(state.modeKey==='goodjunk'){ systems.score.add(meta.good?5:-2); }
  else if(state.modeKey==='groups'){ const ok=state.currentTarget && meta.group===state.currentTarget; systems.score.add(ok?7:-2); state.ctx.targetHitsTotal = (state.ctx.targetHitsTotal||0) + (ok?1:0); }
  else if(state.modeKey==='hydration'){
    if(meta.water){ state.hyd=Math.min(100,(state.hyd||50)+5); systems.score.add(5); }
    else { state.hyd=Math.max(0,(state.hyd||50)-6); systems.score.add(-3); state.ctx.sweetMiss=(state.ctx.sweetMiss||0)+1; }
    const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok');
    hud.setHydration(state.hyd,z);
    // penalties
    if(meta.water && state.hyd>(state.hydMax||65)){ systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3); sfx.thud(); state.ctx.overHydPunish++; state.ctx.timeMinus+=3; }
    if(!meta.water && state.hyd<(state.hydMin||45)){ systems.score.add(-2); state.timeLeft=Math.max(0,state.timeLeft-2); sfx.thud(); state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2; }
  }
  else if(state.modeKey==='plate'){
    const k=meta.group, need=PLATE_QUOTA[k], cur=state.plate[k]||0;
    if(cur<need){
      state.plate[k]=cur+1; systems.score.add(6); state.ctx.plateFills=(state.ctx.plateFills||0)+1;
      const done=Object.keys(PLATE_QUOTA).every(g=>state.plate[g]>=PLATE_QUOTA[g]);
      if(done){ systems.score.add(14); state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1; state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; }
      renderPills(state);
    } else {
      systems.score.add(-2); state.timeLeft=Math.max(0,(state.timeLeft||0)-1); state.ctx.overfillCount=(state.ctx.overfillCount||0)+1; systems.score.bad(); state.__plateLast={overfill:true,delta:-2};
    }
  }

  // power & trap
  if(meta.type==='power'){
    state.ctx.powersUsed++;
    if(meta.kind==='slow'){ systems.power.apply('slow'); sfx.tick(); }
    if(meta.kind==='boost'){ systems.power.apply('boost'); sfx.ding(); }
    if(meta.kind==='shield'){ systems.power.apply('shield'); sfx.ding(); }
    if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); state.ctx.timePlus+=5; sfx.ding(); }
    if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); state.ctx.timeMinus+=5; sfx.thud(); }
  } else if(meta.type==='trap'){
    state.ctx.trapsHit++;
    if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6); sfx.thud(); } }
    if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4); sfx.thud(); } }
  }

  systems.score.add=baseAdd;
  updateHUD(); destroy(obj);
}

// ---------- HUD / Result ----------
function updateHUD(){
  hud.setScore(systems.score.score);
  hud.setCombo(systems.score.combo);
  hud.setTime(state.timeLeft);
  hud.setDiff(state.difficulty);
  hud.setMode(MODES[state.modeKey].name || state.modeKey);
  hud.fever(systems.fever.active);
}
function buildBreakdown(){
  const m=state.modeKey, c=state.ctx;
  if(m==='goodjunk') return `<ul><li>ของดีที่เก็บ: <b>${c.goodHits}</b></li><li>ของขยะที่กดโดน: <b>${c.junkCaught}</b></li><li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`;
  if(m==='groups')   return `<ul><li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li><li>เก็บผิดหมวด/พลาด: <b>${c.groupWrong}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`;
  if(m==='hydration'){ const hydNow=Math.round(state.hyd||0); return `<ul><li>เก็บน้ำ: <b>${c.waterHits||0}</b> | หวานพลาด: <b>${c.sweetMiss||0}</b></li><li>โทษ Over: <b>${c.overHydPunish||0}</b> | โทษ Low: <b>${c.lowSweetPunish||0}</b></li><li>เวลาถูกหักรวม: <b>${c.timeMinus||0}s</b> | เพิ่มเวลา: <b>${c.timePlus||0}s</b></li><li>มิเตอร์สุดท้าย: <b>${hydNow}%</b></li></ul>`; }
  if(m==='plate')    return `<ul><li>เติมชิ้นในจาน: <b>${c.plateFills}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li><li>เกินโควตา: <b>${c.overfillCount}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`;
  return '';
}
function presentResult(finalScore){
  const L=I18N[SETTINGS.lang];
  document.getElementById('resTitle').textContent=L.result.title;
  document.getElementById('resScore').textContent=finalScore;
  document.getElementById('resTime').textContent=Math.max(0, state.timeLeft|0);
  document.getElementById('resMode').textContent=(MODES[state.modeKey].name || state.modeKey);
  document.getElementById('resDiff').textContent=state.difficulty;
  document.getElementById('resCombo').textContent='x'+(systems.score.bestCombo||systems.score.combo||1);
  document.getElementById('resBreakdown').innerHTML=buildBreakdown();
  document.getElementById('resTips').textContent=(I18N[SETTINGS.lang].result.tips+': ')+(state.modeKey==='hydration'?'รักษา 45–65% ให้เสถียร':'โฟกัสเป้าหมาย/เลี่ยงกับดัก');
  document.getElementById('result').style.display='flex';
}

// ---------- Loop & Timers ----------
let spawnTimer=null, timeTimer=null, spawnCount=0, lastTs=performance.now();
function loop(){
  const ts=performance.now(), dt=ts-lastTs; lastTs=ts;
  systems.fever.update(dt); systems.power.tick(dt);

  if(state.running && state.modeKey==='hydration'){
    state.hyd=Math.max(0,Math.min(100, (state.hyd||50)-0.0003*dt*(systems.power.timeScale||1)));
    loop._hydTick=(loop._hydTick||0)+dt;
    const min=state.hydMin, max=state.hydMax;
    const z=state.hyd<min?'low':(state.hyd>max?'high':'ok');
    loop._lowAccum=(loop._lowAccum||0)+(z==='low'?dt:0);
    if(loop._hydTick>1000){ loop._hydTick=0; if(z==='ok') systems.score.add(1); hud.setHydration(state.hyd, z); }
    if(loop._lowAccum>=4000){ loop._lowAccum=0; systems.score.add(-1); state.timeLeft=Math.max(0,state.timeLeft-1); sfx.thud(); state.ctx.timeMinus+=1; }
  }

  updateHUD();
}
function runSpawn(){
  if(!state.running || state.paused) return;
  spawnOnce(); spawnCount++;
  const base=state.diffCfg?.spawnBase||700;
  const accel=Math.max(0.5,1-(spawnCount/120));
  const next=Math.max(280, base*accel*(systems.power.timeScale||1));
  spawnTimer=setTimeout(runSpawn, next);
}
function runTimer(){
  if(!state.running || state.paused) return;
  timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); }, 1000);
}

// ---------- State control ----------
function start(){
  document.getElementById('help').style.display='none';
  state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal;
  state.running=true; state.paused=false;
  state.timeLeft=state.diffCfg.time;
  spawnCount=0; systems.score.reset(); setupLanes();

  state.ctx={bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0};
  state.__plateLast=null;

  // init by mode
  if(state.modeKey==='groups') groupsInit(state,hud);
  if(state.modeKey==='hydration') hydInit(state,hud);
  if(state.modeKey==='plate') plateInit(state);

  if(state.modeKey!=='hydration') hud.hideHydration();
  if(state.modeKey!=='groups') document.getElementById('targetWrap').style.display='none';
  if(state.modeKey!=='plate') document.getElementById('plateTracker').style.display='none';

  updateHUD();
  setTimeout(spawnOnce, 200);
  runSpawn(); runTimer();
  canvas.style.pointerEvents='auto';
}
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){
  state.running=false; state.paused=false;
  clearTimeout(spawnTimer); clearTimeout(timeTimer);
  canvas.style.pointerEvents='none';
  presentResult(systems.score.score);
}

// ---------- Boot (ผูกปุ่มหลัง DOM พร้อมจริง) ----------
function boot(){
  // Buttons in bottom menu
  document.getElementById('menuBar').addEventListener('click',(e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value');
    e.preventDefault(); e.stopPropagation();

    if(act==='diff'){
      state.difficulty = val;
      state.diffCfg = DIFFS[state.difficulty]||DIFFS.Normal;
      document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty);
      document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey);
      return;
    }
    if(act==='start') start();
    else if(act==='pause') pause();
    else if(act==='restart'){ end(); start(); }
    else if(act==='help'){ openHelpFor(state.modeKey); }
    else if(act==='mode'){
      state.modeKey = val;
      if(val!=='plate')  document.getElementById('plateTracker').style.display='none';
      if(val!=='groups') document.getElementById('targetWrap').style.display='none';
      if(val!=='hydration') hud.hideHydration();
      document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty);
      document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey);
      updateHUD();
    }
  }, false);

  // Help/Result modals
  document.getElementById('help').addEventListener('click',(e)=>{
    if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none';
  });
  document.getElementById('result').addEventListener('click',(e)=>{
    const b=e.target.closest('button'); if(!b) return;
    const act=b.getAttribute('data-result');
    if(act==='replay'){ document.getElementById('result').style.display='none'; start(); }
    if(act==='home'){ document.getElementById('result').style.display='none'; }
  });

  // Settings bar
  document.getElementById('langToggle')?.addEventListener('click', ()=>{ SETTINGS.lang=SETTINGS.lang==='TH'?'EN':'TH'; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });

  // First apply
  applyLanguage(); applySound(); applyQuality();

  // Canvas inputs
  canvas.addEventListener('click', onClick, {passive:true});
  canvas.addEventListener('touchstart', (e)=>{ const t=e.touches&&e.touches[0]; if(!t) return; onClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  // Landing start
  const landing=document.getElementById('landing'), startBtn=document.getElementById('startBtn');
  startBtn?.addEventListener('click', ()=>{ landing.style.display='none'; try{ document.getElementById('sfx-hero').play(); }catch{} openHelpFor(state.modeKey); });

  // Start render loop
  engine.startLoop(loop);
}

// Click handler
function onClick(ev){
  if(!state.running || state.paused) return;
  const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX);
  const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY);
  const hitList=engine.raycastFromClient(x,y); if(hitList.length) hit(hitList[0].object);
}

// Safe boot
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }

// Error overlay
window.onerror=(msg, src, line, col)=>{
  const mk=()=>{ const d=document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9999;max-width:60ch'; document.body.appendChild(d); return d; };
  (document.getElementById('errors')||mk()).textContent='Errors: '+msg+' @'+(src||'inline')+':'+line+':'+col;
  (document.getElementById('errors')||mk()).style.display='block';
};
