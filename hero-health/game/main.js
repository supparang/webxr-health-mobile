import { Engine } from './core/engine.js';
import { HUD } from './ui/hud.js';
import { Coach } from './ui/coach.js';
import { bindLanding } from './ui/landing.js';
import { FloatingFX } from './fx/floating.js';
import { ScoreSystem } from './systems/score.js';
import { FeverSystem } from './systems/fever.js';
import { PowerUpSystem } from './systems/powerups.js';
import { MissionSystem } from './systems/missions.js';
import { Leaderboard } from './systems/leaderboard.js';
import * as M1 from './modes/goodjunk.js';
import * as M2 from './modes/groups.js';
import * as M3 from './modes/hydration.js';
import * as M4 from './modes/plate.js';

const SETTINGS={lang:'TH',sound:true,quality:'High'};
const I18N={
  TH:{brand:'HERO HEALTH ACADEMY',modes:{goodjunk:'🥗 ดี vs ขยะ',groups:'🍽️ จาน 5 หมู่',hydration:'💧 สมดุลน้ำ',plate:'🍱 จัดจานสุขภาพ'},diff:{Easy:'ง่าย',Normal:'ปกติ',Hard:'ยาก'},helpTitle:'วิธีเล่น (How to Play)',buttons:{start:'▶ เริ่มเกม',pause:'⏸ พัก',restart:'↻ เริ่มใหม่',help:'❓ วิธีเล่น'},result:{title:'สรุปผล',tips:'เคล็ดลับ'}},
  EN:{brand:'HERO HEALTH ACADEMY',modes:{goodjunk:'🥗 Healthy vs Junk',groups:'🍽️ Food Groups',hydration:'💧 Hydration',plate:'🍱 Healthy Plate'},diff:{Easy:'Easy',Normal:'Normal',Hard:'Hard'},helpTitle:'How to Play',buttons:{start:'▶ Start',pause:'⏸ Pause',restart:'↻ Restart',help:'❓ Help'},result:{title:'Results',tips:'Tips'}}
};
const MODES={goodjunk:M1,groups:M2,hydration:M3,plate:M4};
const DIFFS={Easy:{time:70,spawnBase:820,life:4200,trapRate:0.03,powerRate:0.10,hydWaterRate:0.78},Normal:{time:60,spawnBase:700,life:3000,trapRate:0.05,powerRate:0.08,hydWaterRate:0.66},Hard:{time:50,spawnBase:560,life:1900,trapRate:0.07,powerRate:0.06,hydWaterRate:0.55}};

const canvas=document.getElementById('c'); const engine=new Engine(THREE,canvas); const hud=new HUD(); const coach=new Coach(); const floating=new FloatingFX(engine);
const sfx={ding(){if(!SETTINGS.sound)return; const a=document.getElementById('sfx-ding'); try{a.currentTime=0;a.play();}catch{}}, thud(){if(!SETTINGS.sound)return; const a=document.getElementById('sfx-thud'); try{a.currentTime=0;a.play();}catch{}}, tick(){if(!SETTINGS.sound)return; const a=document.getElementById('sfx-tick'); try{a.currentTime=0;a.play();}catch{}}, fever(){if(!SETTINGS.sound)return; const a=document.getElementById('sfx-fever'); try{a.currentTime=0;a.play();}catch{}}, perfect(){if(!SETTINGS.sound)return; const a=document.getElementById('sfx-perfect'); try{a.currentTime=0;a.play();}catch{}}};
const systems={score:new ScoreSystem(),fever:new FeverSystem(),power:new PowerUpSystem(),mission:new MissionSystem(),board:new Leaderboard(),fx:sfx};

const state={modeKey:'goodjunk',difficulty:'Normal',diffCfg:DIFFS.Normal,running:false,paused:false,timeLeft:60,ACTIVE:new Set(),lane:{},ctx:{bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0},hydMin:45,hydMax:65,hyd:50,__plateLast:null};

const HELP_TH={goodjunk:`<h3>🥗 ดี vs ขยะ</h3><ul><li>เก็บอาหารดี (+5), หลีกเลี่ยงขยะ (−2)</li><li>ปล่อยขยะผ่าน (+1)</li><li>Power: ⭐ ⏳ 🛡️ ⏱ | Trap: 💣 🎭</li></ul>`,groups:`<h3>🍽️ จาน 5 หมู่</h3><ul><li>เก็บให้ตรง 🎯 บน HUD</li><li>ถูกหมวด +7 | ผิด −2 | ครบ 3 ชิ้นเปลี่ยนเป้า</li></ul>`,hydration:`<h3>💧 สมดุลน้ำ</h3><ul><li>รักษา 45–65%</li><li>💧 เพิ่ม | 🧋 ลด</li><li>มากไป+เก็บน้ำ=โทษ, น้อยไป+เก็บหวาน=โทษ</li></ul>`,plate:`<h3>🍱 จัดจานสุขภาพ</h3><ul><li>เติมโควตาแต่ละหมู่</li><li>ที่ขาด +6 | PERFECT +14</li><li>เกินโควตา −2 / −1s + คอมโบแตก</li></ul>`};
const HELP_EN={goodjunk:`<h3>🥗 Healthy vs Junk</h3><ul><li>Pick healthy (+5), avoid junk (−2)</li><li>Let junk pass (+1)</li><li>Power: ⭐ ⏳ 🛡️ ⏱ | Traps: 💣 🎭</li></ul>`,groups:`<h3>🍽️ Food Groups</h3><ul><li>Match 🎯 on HUD</li><li>Correct +7 | Wrong −2 | 3 hits → new target</li></ul>`,hydration:`<h3>💧 Hydration</h3><ul><li>Keep 45–65%</li><li>💧 up | 🧋 down</li><li>Too high+water=penalty, too low+sweet=penalty</li></ul>`,plate:`<h3>🍱 Healthy Plate</h3><ul><li>Fill each quota</li><li>Needed +6 | PERFECT +14</li><li>Overfill −2 / −1s + combo reset</li></ul>`};

function applyLanguage(){ const L=I18N[SETTINGS.lang]; const Q=s=>document.querySelector(s);
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
  document.querySelector('#help h2')?.replaceChildren(I18N[SETTINGS.lang].helpTitle);
  document.getElementById('resTitle')?.replaceChildren(I18N[SETTINGS.lang].result.title);
  document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey);
  document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty);
}
function applySound(){ document.querySelectorAll('audio').forEach(a=>a.muted=!SETTINGS.sound); const b=document.getElementById('soundToggle'); if(b) b.textContent=SETTINGS.sound?'🔊':'🔇'; }
function applyQuality(){ const q=SETTINGS.quality; const dpr=q==='High'?(window.devicePixelRatio||1):q==='Medium'?Math.max(0.75,(window.devicePixelRatio||1)*0.75):0.5; try{ engine.renderer.setPixelRatio(dpr); engine.onResize?.(); }catch{} document.body.style.filter=(q==='Low')?'saturate(0.95) brightness(0.98)':(q==='Medium')?'saturate(1.0) brightness(1.0)':''; }
function openHelpFor(modeKey){ const html=(SETTINGS.lang==='EN'?HELP_EN:HELP_TH)[modeKey||state.modeKey]||'<p>-</p>'; document.getElementById('helpBody').innerHTML=html; document.querySelector('#help h2')?.replaceChildren(I18N[SETTINGS.lang].helpTitle); document.getElementById('help').style.display='flex'; }

function setupLanes(){ const X=[-1.1,-0.55,0,0.55,1.1], Y=[-0.2,0.0,0.18,0.32], Z=-2.2; state.lane={X,Y,Z,occupied:new Set(),cooldown:new Map(),last:null}; }
function now(){ return performance.now(); }
function isAdj(r,c){ const last=state.lane.last; if(!last) return false; const [pr,pc]=last; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
function pickLane(){ const {X,Y,Z,occupied,cooldown}=state.lane; const cand=[]; for(let r=0;r<Y.length;r++){ for(let c=0;c<X.length;c++){ const k=r+','+c,cd=cooldown.get(k)||0,free=!occupied.has(k)&&now()>cd&&!isAdj(r,c); if(free) cand.push({r,c,k}); } } if(!cand.length) return null; const p=cand[Math.floor(Math.random()*cand.length)]; occupied.add(p.k); state.lane.last=[p.r,p.c]; return {x:X[p.c],y:1.6+Y[p.r],z:-2.2-0.1*Math.abs(p.c-2),key:p.k}; }
function releaseLane(k){ const {occupied,cooldown}=state.lane; occupied.delete(k); cooldown.set(k, now()+800); }
const POWER_ITEMS=[{type:'power',kind:'slow',char:'⏳'},{type:'power',kind:'boost',char:'⭐'},{type:'power',kind:'shield',char:'🛡️'},{type:'power',kind:'timeplus',char:'⏱️➕'},{type:'power',kind:'timeminus',char:'⏱️➖'}];
const TRAP_ITEMS=[{type:'trap',kind:'bomb',char:'💣'},{type:'trap',kind:'bait',char:'🎭'}];
function maybeSpecialMeta(baseMeta){ const r=Math.random(),t=state.diffCfg?.trapRate??0.05,p=state.diffCfg?.powerRate??0.08; if(r<p) return POWER_ITEMS[Math.floor(Math.random()*POWER_ITEMS.length)]; if(r<p+t) return TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)]; return baseMeta; }

function spawnOnce(){ const lane=pickLane(); if(!lane) return; let meta=MODES[state.modeKey].pickMeta(state.difficulty,state); if(state.modeKey==='hydration'){ const rate=state.diffCfg?.hydWaterRate??0.66; const water=Math.random()<rate; meta={type:'hydra',water,char:water?'💧':'🧋'}; } meta=maybeSpecialMeta(meta);
  const m=engine.makeBillboard(meta.char); m.position.set(lane.x,lane.y,lane.z); m.userData={lane:lane.key,meta}; engine.group.add(m); state.ACTIVE.add(m);
  const life=state.diffCfg?.life||3000; m.userData.timer=setTimeout(()=>{ if(!m.parent) return; if(meta.type==='gj' && meta.good===false){ systems.score.add(1);} if(meta.type==='groups'){ if(state.currentTarget && meta.group===state.currentTarget){ systems.score.bad(); } else { state.ctx.groupWrong++; } } if(meta.type==='hydra' && meta.water===false){ systems.score.add(1); state.ctx.sweetMiss++; } updateHUD(); destroy(m); }, life+Math.floor(Math.random()*500-250)); }
function destroy(obj){ if(obj.parent) obj.parent.remove(obj); state.ACTIVE.delete(obj); releaseLane(obj.userData.lane); }

function hit(obj){ const meta=obj.userData.meta; const baseAdd=systems.score.add.bind(systems.score); systems.score.add=(v)=>baseAdd(v*systems.fever.scoreMul()*(1+systems.power.scoreBoost));
  MODES[state.modeKey].onHit(meta, systems, state, hud);
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===true && state.hyd>(state.hydMax||65)){ systems.score.add(-4); state.timeLeft=Math.max(0,state.timeLeft-3); systems.fx.thud(); state.ctx.currentStreak=0; state.ctx.overHydPunish++; state.ctx.timeMinus+=3; }
  if(state.modeKey==='hydration' && meta.type==='hydra' && meta.water===false && state.hyd<(state.hydMin||45)){ systems.score.add(-2); state.timeLeft=Math.max(0,state.timeLeft-2); systems.fx.thud(); state.ctx.lowSweetPunish++; state.ctx.timeMinus+=2; }
  if(meta.type==='power'){ state.ctx.powersUsed++; if(meta.kind==='slow'){ systems.power.apply('slow'); } if(meta.kind==='boost'){ systems.power.apply('boost'); } if(meta.kind==='shield'){ systems.power.apply('shield'); } if(meta.kind==='timeplus'){ state.timeLeft=Math.min(120,state.timeLeft+5); state.ctx.timePlus+=5; } if(meta.kind==='timeminus'){ state.timeLeft=Math.max(0,state.timeLeft-5); state.ctx.timeMinus+=5; } }
  else if(meta.type==='trap'){ state.ctx.trapsHit++; if(meta.kind==='bomb'){ if(!systems.power.consumeShield()){ systems.score.add(-6);} } if(meta.kind==='bait'){ if(!systems.power.consumeShield()){ systems.score.add(-4);} } }
  systems.score.add=baseAdd; updateHUD(); destroy(obj);
}
function onClick(ev){ if(!state.running || state.paused) return; const x=ev.clientX ?? (ev.touches&&ev.touches[0].clientX); const y=ev.clientY ?? (ev.touches&&ev.touches[0].clientY); const inter=engine.raycastFromClient(x,y); if(inter.length){ hit(inter[0].object);} }

function updateHUD(){ hud.setScore(systems.score.score); hud.setCombo(systems.score.combo); hud.setTime(state.timeLeft); hud.setDiff(state.difficulty); hud.setMode(MODES[state.modeKey].name||state.modeKey); hud.fever(systems.fever.active); }
function buildBreakdownAndTips(){ const m=state.modeKey, c=state.ctx; let html='', tip=''; if(m==='goodjunk'){ html=`<ul><li>ของดีที่เก็บ: <b>${c.goodHits}</b></li><li>ของขยะที่กดโดน: <b>${c.junkCaught}</b></li><li>Power-ups: <b>${c.powersUsed}</b> | Trap: <b>${c.trapsHit}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`; tip='เล็งของดีต่อเนื่อง เลี่ยง Trap'; } else if(m==='groups'){ html=`<ul><li>ตรงหมวดเป้าหมาย: <b>${c.targetHitsTotal}</b></li><li>เก็บผิดหมวด/พลาด: <b>${c.groupWrong}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`; tip='เช็ค 🎯 ก่อนคลิก'; } else if(m==='hydration'){ const hydNow=Math.round(state.hyd||0); html=`<ul><li>เก็บน้ำ: <b>${c.waterHits}</b> | หวานพลาด: <b>${c.sweetMiss}</b></li><li>โทษ Over: <b>${c.overHydPunish}</b> | โทษ Low: <b>${c.lowSweetPunish}</b></li><li>เวลาถูกหักรวม: <b>${c.timeMinus}s</b> | เพิ่มเวลา: <b>${c.timePlus}s</b></li><li>มิเตอร์สุดท้าย: <b>${hydNow}%</b></li></ul>`; tip='รักษา 45–65% ให้เสถียร'; } else if(m==='plate'){ html=`<ul><li>เติมชิ้นในจาน: <b>${c.plateFills}</b> | PERFECT: <b>${c.perfectPlates||0}</b></li><li>เกินโควตา: <b>${c.overfillCount}</b></li><li>สตรีคดีที่สุด: <b>${c.bestStreak}</b></li></ul>`; tip='ดูโควตาใน HUD ให้ครบ'; } return {html,tip}; }
function presentResult(finalScore){ const L=I18N[SETTINGS.lang]; document.getElementById('resTitle').textContent=L.result.title; document.getElementById('resScore').textContent=finalScore; document.getElementById('resTime').textContent=Math.max(0,state.timeLeft|0); document.getElementById('resMode').textContent=(MODES[state.modeKey].name||state.modeKey); document.getElementById('resDiff').textContent=state.difficulty; document.getElementById('resCombo').textContent='x'+(systems.score.bestCombo||systems.score.combo||1); const {html,tip}=buildBreakdownAndTips(); document.getElementById('resBreakdown').innerHTML=html; document.getElementById('resTips').textContent=(I18N[SETTINGS.lang].result.tips+': '+tip); document.getElementById('result').style.display='flex'; }

let spawnTimer=null,timeTimer=null,spawnCount=0,lastTs=performance.now();
function loop(){ const ts=performance.now(); const dt=ts-lastTs; lastTs=ts; systems.fever.update(dt); systems.power.tick(dt); if(state.running && state.modeKey==='hydration'){ state.hyd=Math.max(0,Math.min(100,state.hyd-0.0003*dt*(systems.power.timeScale||1))); loop._hydTick=(loop._hydTick||0)+dt; const min=state.hydMin,max=state.hydMax; const z=state.hyd<min?'low':(state.hyd>max?'high':'ok'); loop._lowAccum=(loop._lowAccum||0)+(z==='low'?dt:0); if(loop._hydTick>1000){ loop._hydTick=0; if(z==='ok'){ systems.score.add(1);} hud.setHydration(state.hyd,z);} if(loop._lowAccum>=4000){ loop._lowAccum=0; systems.score.add(-1); state.timeLeft=Math.max(0,state.timeLeft-1); systems.fx.thud(); state.ctx.timeMinus+=1; } } updateHUD(); }
function runSpawn(){ if(!state.running || state.paused) return; spawnOnce(); spawnCount++; const base=state.diffCfg?.spawnBase||700; const accel=Math.max(0.5,1-(spawnCount/120)); const feverBoost=systems.fever.active?0.82:1.0; const next=Math.max(280, base*accel*feverBoost*systems.power.timeScale); spawnTimer=setTimeout(runSpawn,next); }
function runTimer(){ if(!state.running || state.paused) return; timeTimer=setTimeout(()=>{ state.timeLeft--; if(state.timeLeft<=0){ end(); } else runTimer(); updateHUD(); },1000); }

function start(){ document.getElementById('help').style.display='none'; state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal; state.running=true; state.paused=false; state.timeLeft=state.diffCfg.time; spawnCount=0; systems.score.reset(); setupLanes(); state.ctx={bestStreak:0,currentStreak:0,goodHits:0,junkCaught:0,targetHitsTotal:0,groupWrong:0,waterHits:0,sweetMiss:0,overHydPunish:0,lowSweetPunish:0,plateFills:0,perfectPlates:0,overfillCount:0,trapsHit:0,powersUsed:0,timeMinus:0,timePlus:0}; state.__plateLast=null; systems.mission.roll(state.modeKey); const M=MODES[state.modeKey]; if(M.init) M.init(state,hud,state.difficulty); if(state.modeKey!=='hydration'){ hud.hideHydration?.(); } if(state.modeKey!=='groups') document.getElementById('targetWrap').style.display='none'; if(state.modeKey!=='plate') document.getElementById('plateTracker').style.display='none'; updateHUD(); setTimeout(spawnOnce,200); runSpawn(); runTimer(); canvas.style.pointerEvents='auto'; }
function pause(){ if(!state.running) return; state.paused=!state.paused; if(!state.paused){ runSpawn(); runTimer(); } }
function end(){ state.running=false; state.paused=false; clearTimeout(spawnTimer); clearTimeout(timeTimer); canvas.style.pointerEvents='none'; const bonus=systems.mission.evaluate({...state.ctx,combo:systems.score.combo}); if(bonus>0){ systems.score.score+=bonus;} systems.board.submit(state.modeKey,state.difficulty,systems.score.score); presentResult(systems.score.score); }

bindLanding(()=>{ openHelpFor(state.modeKey); }, coach);
document.getElementById('menuBar').addEventListener('click',(e)=>{ const btn=e.target.closest('button'); if(!btn) return; const act=btn.getAttribute('data-action'); const val=btn.getAttribute('data-value'); e.preventDefault(); e.stopPropagation(); if(act==='diff'){ state.difficulty=val; state.diffCfg=DIFFS[state.difficulty]||DIFFS.Normal; hud.setDiff(state.difficulty); document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty); document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey); return; } if(act==='start') start(); else if(act==='pause') pause(); else if(act==='restart'){ end(); start(); } else if(act==='help'){ openHelpFor(state.modeKey); } else if(act==='mode'){ state.modeKey=val; if(val!=='plate') document.getElementById('plateTracker').style.display='none'; if(val!=='groups') document.getElementById('targetWrap').style.display='none'; if(val!=='hydration'){ hud.hideHydration?.(); } document.getElementById('difficulty')?.replaceChildren(I18N[SETTINGS.lang].diff[state.difficulty]||state.difficulty); document.getElementById('modeName')?.replaceChildren(I18N[SETTINGS.lang].modes[state.modeKey]||state.modeKey); updateHUD(); } }, false);
document.getElementById('help').addEventListener('click',(e)=>{ if(e.target.getAttribute('data-action')==='helpClose' || e.target.id==='help') e.currentTarget.style.display='none'; });
document.getElementById('result').addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b) return; const act=b.getAttribute('data-result'); if(act==='replay'){ document.getElementById('result').style.display='none'; start(); } if(act==='home'){ document.getElementById('result').style.display='none'; } });

function initSettingsBar(){ const langBtn=document.getElementById('langToggle'); const soundBtn=document.getElementById('soundToggle'); const gfxSel=document.getElementById('gfxSelect'); langBtn?.addEventListener('click', ()=>{ SETTINGS.lang=SETTINGS.lang==='TH'?'EN':'TH'; applyLanguage(); }); soundBtn?.addEventListener('click', ()=>{ SETTINGS.sound=!SETTINGS.sound; applySound(); }); gfxSel?.addEventListener('change', (e)=>{ SETTINGS.quality=e.target.value||'High'; applyQuality(); }); applyLanguage(); applySound(); applyQuality(); }
if(document.readyState==='loading'){ window.addEventListener('DOMContentLoaded', ()=>initSettingsBar()); } else { initSettingsBar(); }

canvas.addEventListener('click', onClick, {passive:true});
canvas.addEventListener('touchstart', (e)=>{ const t=e.touches&&e.touches[0]; if(!t) return; onClick({clientX:t.clientX, clientY:t.clientY}); }, {passive:true});
engine.startLoop(()=>{ /* basic update inside modules */ });
window.onerror=(m,s,l,c)=>{ const mk=()=>{ const d=document.createElement('div'); d.id='errors'; d.style.cssText='position:fixed;top:8px;right:8px;background:rgba(30,0,0,.85);color:#ffb;border:1px solid #f66;padding:6px 10px;border-radius:8px;z-index:9999;max-width:60ch'; document.body.appendChild(d); return d; }; (document.getElementById('errors')||mk()).textContent='Errors: '+m+' @'+(s||'inline')+':'+l+':'+c; (document.getElementById('errors')||mk()).style.display='block'; };
