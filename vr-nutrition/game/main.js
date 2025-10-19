import { Engine } from './core/engine.js';

/* -------- HUD / helpers (ย่อเพื่อความชัด) -------- */
class HUD{
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=v|0; }
  setCombo(v){ const e=document.getElementById('combo'); if(e) e.textContent='x'+(v||1); }
  setTime(v){ const e=document.getElementById('time'); if(e) e.textContent=v|0; }
  setDiff(v){ const e=document.getElementById('difficulty'); if(e) e.textContent=v; }
  setMode(v){ const e=document.getElementById('modeName'); if(e) e.textContent=v; }
  fever(a){ const e=document.getElementById('fever'); if(e) e.style.display=a?'inline-block':'none'; }
  setHydration(p,z){ const bar=document.getElementById('hydroBar'); const lab=document.getElementById('hydroLabel'); const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='block'; if(bar){ bar.style.width=Math.max(0,Math.min(100,p))+'%'; } if(lab){ lab.textContent=Math.round(p)+'% '+(z==='ok'?'พอดี':(z==='low'?'น้อยไป':'มากไป')); } }
  hideHydration(){ const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='none'; }
}
class Coach{ onStart(){} onCombo(x){ this.say('Combo x'+x+'!'); } onFever(){ this.say('FEVER!!'); } onEnd(){} say(t){ const box=document.getElementById('coachHUD'); const text=document.getElementById('coachText'); if(!box||!text) return; text.textContent=t; box.style.display='block'; clearTimeout(this._t); this._t=setTimeout(()=>box.style.display='none',1200);} }
function bindLanding(onReady){ const btn=document.getElementById('startBtn'); const landing=document.getElementById('landing'); if(btn){ btn.addEventListener('click', ()=>{ if(landing) landing.style.display='none'; try{ document.getElementById('sfx-hero').play(); }catch{}; onReady&&onReady(); }); } }
class FloatingFX{ spawn3D(obj,html,kind){ const d=document.createElement('div'); d.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:700;color:'+(kind==='bad'?'#ff6':'#6f6')+';text-shadow:0 0 8px rgba(0,0,0,.6)'; d.innerHTML=html; document.body.appendChild(d); setTimeout(()=>{ d.style.transition='all .4s'; d.style.opacity='0'; d.style.top='40%'; },40); setTimeout(()=>d.remove(),700);} }
class ScoreSystem{ constructor(){ this.reset(); } reset(){ this.score=0; this.combo=0; this.bestCombo=0; } add(v){ this.score+=v; if(v>0){ this.combo++; this.bestCombo=Math.max(this.bestCombo,this.combo);} if(v<0){ this.combo=0; } return this.score;} }
class FeverSystem{ constructor(){ this.timer=0; this.active=false; } scoreMul(){ return this.active?2:1; } update(dt){ if(this.active){ this.timer-=dt; if(this.timer<=0){ this.active=false; } } } onBad(){ this.active=false; } }
class PowerUpSystem{ constructor(){ this.timeScale=1; this.scoreBoost=0; this._shield=0; } apply(k){ if(k==='slow'){ this.timeScale=0.8; setTimeout(()=>this.timeScale=1,5000);} if(k==='boost'){ this.scoreBoost=0.5; setTimeout(()=>this.scoreBoost=0,5000);} if(k==='shield'){ this._shield=Math.min(2,this._shield+1);} } tick(dt){} consumeShield(){ if(this._shield>0){ this._shield--; return true;} return false; } }
class MissionSystem{ roll(mode){ this.goal={mode,target:30}; } evaluate(ctx){ return 0; } }
class Leaderboard{ submit(mode,diff,score){ try{ const k='hha_board'; const arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.push({t:Date.now(),mode,diff,score}); localStorage.setItem(k, JSON.stringify(arr).slice(0,200000)); }catch{} } }

/* -------- config -------- */
const SETTINGS={lang:'TH',sound:true,quality:'High'};
const I18N={
  TH:{brand:'HERO HEALTH ACADEMY',modes:{goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'},diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'},helpTitle:'วิธีเล่น (How to Play)',buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'},result:{title:'สรุปผล',tips:'เคล็ดลับ'}},
  EN:{brand:'HERO HEALTH ACADEMY',modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},helpTitle:'How to Play',buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'},result:{title:'Results',tips:'Tips'}}
};
const DIFFS={ Easy:{time:70,spawnBase:820,life:4200,trapRate:0.03,powerRate:0.10,hydWaterRate:0.78}, Normal:{time:60,spawnBase:700,life:3000,trapRate:0.05,powerRate:0.08,hydWaterRate:0.66}, Hard:{time:50,spawnBase:560,life:1900,trapRate:0.07,powerRate:0.06,hydWaterRate:0.55} };

/* -------- modes -------- */
const MODES={
  goodjunk:{ name:I18N.TH.modes.goodjunk,
    pickMeta(){ const goods=['🥦','🍎','🍇','🥕','🍅','🌽','🥚']; const junks=['🍔','🍟','🍕','🥤','🍩']; const good=Math.random()<0.6; return {type:'gj',good,char:good?goods[Math.floor(Math.random()*goods.length)]:junks[Math.floor(Math.random()*junks.length)]}; },
    onHit(meta,sys){ sys.score.add(meta.good?5:-2); } },
  groups:{ name:I18N.TH.modes.groups,
    init(state,hud){ state.currentTarget=['grain','veg','protein','fruit','dairy'][Math.floor(Math.random()*5)]; document.getElementById('targetWrap').style.display='block'; const L={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}; document.getElementById('targetBadge').textContent=L[state.currentTarget]; },
    pickMeta(){ const G={grain:['🍞','🍚','🥖','🥨'],veg:['🥦','🥕','🥒','🥬'],protein:['🥩','🍗','🥚','🐟'],fruit:['🍎','🍌','🍇','🍊'],dairy:['🥛','🧀']}; const k=Object.keys(G)[Math.floor(Math.random()*5)]; return {type:'groups',group:k,char:G[k][Math.floor(Math.random()*G[k].length)]}; },
    onHit(meta,sys,state){ const ok=state.currentTarget && meta.group===state.currentTarget; if(ok){ sys.score.add(7); state.ctx.targetHitsTotal=(state.ctx.targetHitsTotal||0)+1; if((state.ctx.targetHitsTotal%3)===0){ const all=['grain','veg','protein','fruit','dairy']; let next=state.currentTarget; while(next===state.currentTarget){ next=all[Math.floor(Math.random()*all.length)]; } state.currentTarget=next; const L={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}; document.getElementById('targetBadge').textContent=L[next]; } } else { sys.score.add(-2); } } },
  hydration:{ name:I18N.TH.modes.hydration,
    init(state,hud){ state.hyd=50; state.hydMin=45; state.hydMax=65; document.getElementById('hydroWrap').style.display='block'; hud.setHydration(state.hyd,'ok'); },
    pickMeta(state){ const water=Math.random()<(state.diffCfg?.hydWaterRate??0.66); return {type:'hydra',water,char:water?'💧':'🧋'}; },
    onHit(meta,sys,state,hud){ if(meta.water){ state.hyd=Math.min(100,state.hyd+5); sys.score.add(5); state.ctx.waterHits=(state.ctx.waterHits||0)+1; } else { state.hyd=Math.max(0,state.hyd-6); sys.score.add(-3); state.ctx.sweetMiss=(state.ctx.sweetMiss||0)+1; } const z=state.hyd<state.hydMin?'low':(state.hyd>state.hydMax?'high':'ok'); hud.setHydration(state.hyd,z); } },
  plate:{ name:I18N.TH.modes.plate,
    init(state){ state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; document.getElementById('plateTracker').style.display='block'; renderPills(state); },
    pickMeta(){ const G={grain:['🍞','🍚','🥖','🥨'],veg:['🥦','🥕','🥒','🥬'],protein:['🥩','🍗','🥚','🐟'],fruit:['🍎','🍌','🍇','🍊'],dairy:['🥛','🧀']}; const k=Object.keys(G)[Math.floor(Math.random()*5)]; return {type:'plate',group:k,char:G[k][Math.floor(Math.random()*G[k].length)]}; },
    onHit(meta,sys,state){ const QUOTA={grain:2,veg:2,protein:1,fruit:1,dairy:1}; const k=meta.group, need=QUOTA[k], cur=state.plate[k]||0; if(cur<need){ state.plate[k]=cur+1; sys.score.add(6); state.ctx.plateFills=(state.ctx.plateFills||0)+1; const done=Object.keys(QUOTA).every(g=>state.plate[g]>=QUOTA[g]); if(done){ sys.score.add(14); state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1; state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; } } else { sys.score.add(-2); state.timeLeft=Math.max(0,(state.timeLeft||0)-1); state.ctx.overfillCount=(state.ctx.overfillCount||0)+1; } renderPills(state);} }
};
function renderPills(state){ const pills=document.getElementById('platePills'); if(!pills) return; pills.innerHTML=''; const QUOTA={grain:2,veg:2,protein:1,fruit:1,dairy:1}; const labels={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'}; Object.keys(QUOTA).forEach(k=>{ const cur=state.plate?.[k]||0, need=QUOTA[k]; const el=document.createElement('div'); el.className='pill'+(cur>=need?' done':''); el.textContent=`${labels[k]} ${cur}/${need}`; pills.appendChild(el); }); }

/* -------- state -------- */
let engine,hud,coach,floating,systems;
const state={ modeKey:'goodjunk', difficulty:'Normal', diffCfg:DIFFS.Normal,
  running:false, paused:false, timeLeft:60, ACTIVE:new Set(), lane:{},
  ctx:{bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0},
  hydMin:45,hydMax:65,hyd:50 };

/* -------- UI helpers -------- */
function applyLanguage(){ const L=I18N[SETTINGS.lang]; const Q=s=>document.querySelector(s); document.querySelector('.brand div').textContent=L.brand; Q('button[data-action="mode"][data-value="goodjunk"]')?.replaceChildren(L.modes.goodjunk); Q('button[data-action="mode"][data-value="groups"]')?.replaceChildren(L.modes.groups); Q('button[data-action="mode"][data-value="hydration"]')?.replaceChildren(L.modes.hydration); Q('button[data-action="mode"][data-value="plate"]')?.replaceChildren(L.modes.plate); Q('button[data-action="diff"][data-value="Easy"]')?.replaceChildren(L.diff.Easy); Q('button[data-action="diff"][data-value="Normal"]')?.replaceChildren(L.diff.Normal); Q('button[data-action="diff"][data-value="Hard"]')?.replaceChildren(L.diff.Hard); Q('button[data-action="start"]')?.replaceChildren(L.buttons.start); Q('button[data-action="pause"]')?.replaceChildren(L.buttons.pause); Q('button[data-action="restart"]')?.replaceChildren(L.buttons.restart); Q('button[data-action="help"]')?.replaceChildren(L.buttons.help); document.querySelector('#help h2')?.replaceChildren(I18N[SETTINGS.lang].helpTitle); document.getElementById('resTitle')?.replaceChildren(I18N[SETTINGS.lang].result.title); document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey); document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty); }
function applySound(){ document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound); const b=document.getElementById('soundToggle'); if(b) b.textContent=SETTINGS.sound?'🔊':'🔇'; }
function applyQuality(){ const q=SETTINGS.quality; const dpr=q==='High'?(devicePixelRatio||1):q==='Medium'?Math.max(0.75,(devicePixelRatio||1)*0.75):0.5; try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{} document.body.style.filter=(q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':''; }

/* -------- lanes/spawn -------- */
function setupLanes(){ const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2; state.lane={X,Y,Z,occupied:new Set(),cooldown:new Map(),last:null}; }
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){ const {X,Y,Z,occupied,cooldown}=state.lane; const cand=[]; for(let r=0;r<Y.length;r++){ for(let c=0;c<X.length;c++){ const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c); if(free) cand.push({r,c,k}); } } if(!cand.length) return null; const p=cand[Math.floor(Math.random()*cand.length)]; occupied.add(p.k); state.lane.last=[p.r,p.c]; return {x:X[p.c],y:1.6+Y[p.r],z:Z-0.1*Math.abs(p.c-2),key:p.k}; }
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }
const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'},{type:'power',kind:'timeplus',char:'⏱️➕'},{type:'power',kind:'timeminus',char:'⏱️➖'}];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];
function maybeSpecialMeta(base){ const r=Math.random(),t=state.diffCfg?.trapRate??0.05,p=state.diffCfg?.powerRate??0.08; if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)]; if(r<p+t) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)]; return base; }

function spawnOnce(){ const lane=pickLane(); if(!lane) return; let meta=MODES[state.modeKey].pickMeta(state); if(state.modeKey==='hydration'){ const rate=state.diffCfg?.hydWaterRate??0.66; const water=Math.random()<rate; meta={type:'hydra',water,char:water?'💧':'🧋'}; } meta=maybeSpecialMeta(meta); const m=engine.makeBillboard(meta.char); m.position.set(lane.x,lane.y,lane.z); m.userData={lane:lane.key,meta}; engine.group.add(m); state.ACTIVE.add(m);
  const life=state.diffCfg?.life||3000;
  m.userData.timer=setTimeout(()=>{ if(!m.parent) return; if(meta.type==='gj' && meta.good===false){ systems.score.add(1);} if(meta.type==='groups'){ if(state.currentTarget && meta.group===state.currentTarget){ /* no score */ } else { state.ctx.groupWrong++; } } if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; } updateHUD(); destroy(m); }, life+Math.floor(Math.random()*500-250)); }
function destroy(o){ if(o.parent) o.parent.remove(o); state.ACTIVE.delete(o); releaseLane(o.userData.lane); }

/* -------- hit -------- */
function hit(obj){ const meta=obj.userData.meta; const baseAdd=systems.score.add.bind(systems.score); systems.score.add=(v)=>baseAdd(v*(systems.fever.active?2:1)*(1+systems.power.scoreBoost));
  MODES[state.modeKey].onHit(meta,systems,state,hud);
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd>(state.hydMax||65)){ systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3); systems.fx.thud(); state.ctx.overHydPunish++; state.ctx.timeMinus+=3; }
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===false && state.hyd<(state.hydMin||45)){ systems.score.add(-2); state.timeLeft=Math.max(0,state.timeLeft-2); systems.fx.thud(); state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2; }
  if(meta.type==='power'){ state.ctx.powersUsed++; if(meta.kind==='slow'){ systems.power.apply('slow'); } if(meta.kind==='boost'){ systems.power.apply('boost'); } if(meta.kind==='shield'){ systems.power.apply('shield'); } if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); state.ctx.timePlus+=5; } if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); state.ctx.timeMinus+=5; } }
  else if(meta.type==='trap'){ state.ctx.trapsHit++; if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6);} } if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4);} } }
  systems.score.add=baseAdd; updateHUD(); destroy(obj); }

/* -------- input -------- */
function onClick(ev){ if(!state.running || state.paused) return; const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX); const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY); const inter=engine.raycastFromClient(x,y); if(inter.length){ hit(inter[0].object);} }

/* -------- HUD/Result -------- */
function updateHUD(){ hud.setScore(systems.score.score); hud.setCombo(systems.score.combo); hud.setTime(state.timeLeft); hud.setDiff(state.difficulty); hud.setMode((I18N[SETTINGS.lang].modes[state.modeKey])||state.modeKey); hud.fever(systems.fever.active); }
function buildBreakdownAndTips(){ const m=state.modeKey, c=state.ctx; let html='', tip=''; if(m==='goodjunk'){ html=`<ul><li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li></ul>`; tip='เล็งของดีต่อเนื่อง เลี่ยง Trap'; } else if(m==='groups'){ html=`<ul><li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li><li>ผิดหมวด/พลาด: <b>${c.groupWrong}</b></li></ul>`; tip='เช็ค 🎯 ก่อนคลิก'; } else if(m==='hydration'){ const hydNow=Math.round(state.hyd||0); html=`<ul><li>เก็บน้ำ: <b>${c.waterHits||0}</b> | หวานพลาด: <b>${c.sweetMiss||0}</b></li><li>โทษ Over: <b>${c.overHydPunish||0}</b> | โทษ Low: <b>${c.lowSweetPunish||0}</b></li><li>เวลาถูกหักรวม: <b>${c.timeMinus||0}s</b> | เพิ่มเวลา: <b>${c.timePlus||0}s</b></li><li>มิเตอร์สุดท้าย: <b>${hydNow}%</b></li></ul>`; tip='รักษา 45–65% ให้เสถียร'; } else if(m==='plate'){ html=`<ul><li>เติมชิ้นในจาน: <b>${c.plateFills||0}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li><li>เกินโควตา: <b>${c.overfillCount||0}</b></li></ul>`; tip='ดูโควตาใน HUD ให้ครบ'; } return {html,tip}; }
function presentResult(finalScore){ const L=I18N[SETTINGS.lang]; document.getElementById('resTitle').textContent=L.result.title; document.getElementById('resScore').textContent=finalScore; document.getElementById('resTime').textContent=Math.max(0,state.timeLeft|0); document.getElementById('resMode').textContent=((I18N[SETTINGS.lang].modes[state.modeKey])||state.modeKey); document.getElementById('resDiff').textContent=state.difficulty; document.getElementById('resCombo').textContent='x'+(systems.score.bestCombo||systems.score.combo||1); const {html,tip}=buildBreakdownAndTips(); document.getElementById('resBreakdown').innerHTML=html; document.getElementById('resTips').textContent=(L.result.tips+': '+tip); document.getElementById('result').style.display='flex'; }

/* -------- loop & timer -------- */
let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){ const ts=performance.now(); const dt=ts-lastTs; lastTs=ts; systems.fever.update(dt); systems.power.tick(dt); if(state.running && state.modeKey==='hydration'){ state.hyd=Math.max(0,Math.min(100,state.hyd-0.0003*dt*(systems.power.timeScale||1))); loop._hydTick=(loop._hydTick||0)+dt; const min=state.hydMin,max=state.hydMax; const z=state.hyd<min?'low':(state.hyd>max?'high':'ok'); loop._lowAccum=(loop._lowAccum||0)+(z==='low'?dt:0); if(loop._hydTick>1000){ loop._hydTick=0; if(z==='ok'){ systems.score.add(1);} hud.setHydration(state.hyd,z);} if(loop._lowAccum>=4000){ loop._lowAccum=0; systems.score.add(-1); state.timeLeft=Math.max(0,state.timeLeft-1); state.ctx.timeMinus=(state.ctx.timeMinus||0)+1; } } updateHUD(); }
function runSpawn(){ if(!state.running || state.paused) return; spawnOnce(); spawnCount++; const base=state.diffCfg?.spawnBase||700; const accel=Math.max(0.5,1-(spawnCount/120)); const feverBoost=systems.fever.active?0.82:1.0; const next=Math.max(280, base*accel*feverBoost*systems.power.timeScale); spawnTimer=setTimeout(runSpawn,next); }
function runTimer(){ if(!state.running || state.paused) return; timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000); }

/* -------- game state -------- */
function start(){ document.getElementById('help').style.display='none'; state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal; state.running=true; state.paused=false; state.timeLeft=state.diffCfg.time; spawnCount=0; systems.score.reset(); setupLanes(); state.ctx={bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0}; if(state.modeKey==='hydration'){ document.getElementById('hydroWrap').style.display='block'; } else { document.getElementById('hydroWrap').style.display='none'; } if(state.modeKey!=='groups') document.getElementById('targetWrap').style.display='none'; if(state.modeKey!=='plate') document.getElementById('plateTracker').style.display='none'; updateHUD(); setTimeout(spawnOnce,200); runSpawn(); runTimer(); document.getElementById('c').style.pointerEvents='auto'; }
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){ state.running=false; state.paused=false; clearTimeout(spawnTimer); clearTimeout(timeTimer); document.getElementById('c').style.pointerEvents='none'; const bonus=systems.mission.evaluate({...state.ctx,combo:systems.score.combo}); if(bonus>0){ systems.score.score+=bonus;} systems.board.submit(state.modeKey,state.difficulty,systems.score.score); presentResult(systems.score.score); }

/* -------- boot -------- */
function boot(){
  window.__HHA_BOOT = true; /* สำคัญ: ให้ fallback script รู้ว่าโมดูลบู๊ตแล้ว */
  const canvas=document.getElementById('c');
  engine=new Engine(THREE,canvas); hud=new HUD(); coach=new Coach(); floating=new FloatingFX();
  const sfx={ ding(){if(!SETTINGS.sound)return; try{const a=document.getElementById('sfx-ding');a.currentTime=0;a.play();}catch{}}, thud(){if(!SETTINGS.sound)return; try{const a=document.getElementById('sfx-thud');a.currentTime=0;a.play();}catch{}}, tick(){if(!SETTINGS.sound)return; try{const a=document.getElementById('sfx-tick');a.currentTime=0;a.play();}catch{}}, fever(){if(!SETTINGS.sound)return; try{const a=document.getElementById('sfx-fever');a.currentTime=0;a.play();}catch{}}, perfect(){if(!SETTINGS.sound)return; try{const a=document.getElementById('sfx-perfect');a.currentTime=0;a.play();}catch{}}};
  systems={score:new ScoreSystem(),fever:new FeverSystem(),power:new PowerUpSystem(),mission:new MissionSystem(),board:new Leaderboard(),fx:sfx};

  document.getElementById('langToggle')?.addEventListener('click', ()=>{ SETTINGS.lang=SETTINGS.lang==='TH'?'EN':'TH'; applyLanguage(); });
  document.getElementById('soundToggle')?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); });
  document.getElementById('gfxSelect')?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); });
  applyLanguage(); applySound(); applyQuality();

  document.getElementById('menuBar').addEventListener('click',(e)=>{ const btn=e.target.closest('button'); if(!btn) return; const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value'); e.preventDefault(); e.stopPropagation(); if(act==='diff'){ state.difficulty=val; state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal; document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty); document.getElementById('modeName')?.replaceChildren((I18N[SETTINGS.lang].modes[state.modeKey])||state.modeKey); return; } if(act==='start') start(); else if(act==='pause') pause(); else if(act==='restart'){ end(); start(); } else if(act==='help'){ document.getElementById('help').style.display='flex'; } else if(act==='mode'){ state.modeKey=val; if(val!=='plate') document.getElementById('plateTracker').style.display='none'; if(val!=='groups') document.getElementById('targetWrap').style.display='none'; if(val!=='hydration'){ document.getElementById('hydroWrap').style.display='none'; } document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty); document.getElementById('modeName')?.replaceChildren((I18N[SETTINGS.lang].modes[state.modeKey])||state.modeKey); updateHUD(); } }, false);

  document.getElementById('help').addEventListener('click',(e)=>{ if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none'; });
  document.getElementById('result').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b) return; const act=b.getAttribute('data-result'); if(act==='replay'){ document.getElementById('result').style.display='none'; start(); } if(act==='home'){ document.getElementById('result').style.display='none'; } });

  canvas.addEventListener('click', onClick, {passive:true});
  canvas.addEventListener('touchstart', (e)=>{ const t=e.touches&&e.touches[0]; if(!t) return; onClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});

  bindLanding(()=>{ document.getElementById('help').style.display='flex'; });
  engine.startLoop(loop);

  window.onerror=(m,s,l,c)=>{ const mk=()=>{ const d=document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9999;max-width:60ch'; document.body.appendChild(d); return d; }; (document.getElementById('errors')||mk()).textContent='Errors: '+m+' @'+(s||'inline')+':'+l+':'+c; (document.getElementById('errors')||mk()).style.display='block'; };
}
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', boot); } else { boot(); }
