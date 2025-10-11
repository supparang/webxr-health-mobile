
(function(){function boot(){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",onDomReady);}else onDomReady();}
function onDomReady(){const scene=document.querySelector("a-scene"); if(scene && !scene.hasLoaded) scene.addEventListener("loaded",init,{once:true}); else init();}
function init(){const $=sel=>document.querySelector(sel); const scene=$("#scene"), root=$("#root"), hudEl=$("#hud"); const btnStart=$("#btnStart"), btnReset=$("#btnReset"); let cursor=$("#cursor");
function setCursorMode(m){ if(!cursor){ cursor=document.createElement("a-entity"); cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); document.querySelector("a-scene").appendChild(cursor); }
  if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); } else { cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); }}
setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));
const q=new URLSearchParams(location.search); const diff=(q.get("diff")||"easy").toLowerCase(); const bpm=parseInt(q.get("bpm")||"96",10); const autoChallenge=(q.get("autoChallenge")??"1")!=="0"; const wtype=q.get("wtype"); const wtarget=q.get("wtarget");
const DIFF={easy:{hit:0.18,secs:50},normal:{hit:0.14,secs:60},hard:{hit:0.10,secs:70}}, base=DIFF[diff]||DIFF.easy;
const SAVE_KEY="fitnessDuo_rhythm_stats_v1"; function loadSave(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){return{}}} function saveSave(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}}
function daySeed(){const d=new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;} function hashCode(str){let h=0; for(let i=0;i<str.length;i++)h=((h<<5)-h + str.charCodeAt(i))|0; return h;} function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
function autoTune(baseCfg){const s=loadSave(); const acc=Math.min(1,Math.max(0,s.lastAcc||0.75)); const combo=Math.min(1,(s.lastCombo||8)/32); const power=(acc*0.6+combo*0.4)-0.5; return {hit:Math.max(0.08,baseCfg.hit-power*0.05),secs:baseCfg.secs+Math.round(power*10)};}
function genDailyChallenge(seed){const tuned=autoTune(base); const r=mulberry32(hashCode(seed)); const types=["score","combo","accuracy","fever"]; const type=types[(r()*types.length)|0]; const ch={type,title:"",hint:"",bonus:500,cfg:tuned};
 if(type==="score"){ch.target=Math.round(2200+r()*1800); ch.title="ทำคะแนนรวมให้ถึง"; ch.hint=`คะแนน ≥ ${ch.target}`;}
 if(type==="combo"){ch.target=12+((r()*18)|0); ch.title="ทำคอมโบต่อเนื่อง"; ch.hint=`คอมโบ ≥ ${ch.target}`;}
 if(type==="accuracy"){ch.target=0.82+r()*0.1; ch.title="ความแม่นยำ"; ch.hint=`ACC ≥ ${(ch.target*100).toFixed(0)}%`;}
 if(type==="fever"){ch.target=3+((r()*3)|0); ch.title="เปิด Fever หลายครั้ง"; ch.hint=`Fever ≥ ${ch.target} ครั้ง`;}
 return ch;}
let CH=autoChallenge?genDailyChallenge(`${daySeed()}|${diff}|${bpm}`):{type:"none",title:"โหมดธรรมดา",hint:"",bonus:0,cfg:base};
if(wtype){CH.type=wtype; CH.title=`Weekly: ${wtype}`; CH.cfg=autoTune(base); CH.bonus=600; if(wtype==="accuracy") CH.target=parseFloat(wtarget||"0.85"); else CH.target=parseInt(wtarget||"2500",10);
 CH.hint=`เป้า: ${wtype==="accuracy" ? `${(CH.target*100).toFixed(0)}%` : CH.target}`;}
const chain=(q.get("chain")||"").toString()==="3"; const chainCfg=[{hit:-0.00,secs:-5},{hit:-0.02,secs:+0},{hit:-0.04,secs:+5}];
let stageIndex=0,totalScore=0,totalBonus=0;
const state={running:false,raf:0,t0:0,elapsed:0,score:0,combo:0,best:0,hitWindow:CH.cfg.hit,duration:CH.cfg.secs,accHit:0,accTotal:0,fever:false,feverTime:0,feverCount:0};
let actx=null,gain=null,notes=[],nextBeat=0;
function setHUD(msg){const acc=state.accTotal>0?(state.accHit/state.accTotal*100).toFixed(0):"0"; const chainTxt=chain?` | Chain 3: ด่าน ${stageIndex+1}/3`:""; const fever=state.fever?"ON":"OFF";
  try{ hudEl.setAttribute('text',`value: Rhythm • diff=${diff} bpm=${bpm}${chainTxt}\n${CH.title} — ${CH.hint}\nscore=${totalScore+state.score} combo=${state.combo} best=${state.best} acc=${acc}% fever=${fever}\n${msg||""}; width:5; align:center; color:#e2e8f0`); }
  catch(e){ hudEl.textContent=`Rhythm • diff=${diff} bpm=${bpm}${chainTxt}\n${CH.title} — ${CH.hint}\nscore=${totalScore+state.score} combo=${state.combo} best=${state.best} acc=${acc}% fever=${fever}\n${msg||""}`; } }
function makeText(value,opts={}){const e=document.createElement('a-entity'); const {color="#fff",fontSize=0.18,maxWidth=5,y=0,z=0.06}=opts;
  e.setAttribute('troika-text',`value:${value}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:center`); e.setAttribute('position',`0 ${y} ${z}`);
  e.setAttribute('material','shader: standard; roughness:1; metalness:0'); return e;}
function toast(txt,color){const t=makeText(txt,{color,fontSize:0.2,y:0.9}); root.appendChild(t); setTimeout(()=>t.remove(),520);}
function ensureAudio(){if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination);}
function click(){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
  const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.2,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.04); o.start(t); o.stop(t+0.05);}
["pointerdown","touchend","click","keydown"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));
function spawnNote(){const n=document.createElement('a-entity'); n.classList.add('note'); n.setAttribute('geometry','primitive: circle; radius: 0.14; segments:32');
  const hues=[210,190,160,140]; const h=hues[(Math.random()*hues.length)|0]; n.setAttribute('material',`color:hsl(${h},70%,70%); shader:flat; opacity:0.98`);
  n.object3D.position.set(0,0,2.8); root.appendChild(n); return {el:n, t:state.elapsed+1.6, z:2.8, judged:false};}
function addScore(base){ state.score += state.fever ? Math.round(base*1.5) : base; }
function enterFever(){ state.fever=true; state.feverTime=state.elapsed+6; state.feverCount++; toast("FEVER! ✨","#7dfcc6"); }
function updateFever(){ if(state.fever && state.elapsed>=state.feverTime){ state.fever=false; toast("Fever End","#cbd5e1"); } }
function judgeHit(){ const target=state.elapsed; let best=null,bestErr=999;
  for(const it of notes){ if(it.judged) continue; const err=Math.abs(it.t-target); if(err<bestErr){ best=it; bestErr=err; } }
  state.accTotal++; if(!best || bestErr>state.hitWindow){ state.combo=0; toast("Miss","#fecaca"); return; }
  best.judged=true; best.el.setAttribute("visible","false"); state.accHit++; if(bestErr<=state.hitWindow*0.35){ addScore(300); state.combo++; toast("Perfect +300","#7dfcc6"); }
  else { addScore(150); state.combo++; toast("Good +150","#a7f3d0"); } state.best=Math.max(state.best,state.combo); if(!state.fever && state.combo>0 && state.combo%8===0) enterFever(); }
function applyChainTuning(){ if(!chain) return; const t=chainCfg[stageIndex]||chainCfg[0]; state.hitWindow=Math.max(0.06,state.hitWindow+t.hit); state.duration+=t.secs; }
function start(){ if(!document.querySelector('#root')){ requestAnimationFrame(start); return; }
  if(!document.getElementById('hitPad')){ const pad=document.createElement('a-entity'); pad.setAttribute('id','hitPad'); pad.classList.add('clickable');
    pad.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.5'); pad.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat'); pad.setAttribute('position','0 -0.5 0.06');
    const padText=makeText("TAP / GAZE HERE",{color:"#93c5fd",fontSize:0.18,y:0}); padText.setAttribute('position','0 0 0.01'); pad.appendChild(padText); root.appendChild(pad);
    const h=e=>{ e.preventDefault(); e.stopPropagation(); ensureAudio(); judgeHit(); }; pad.addEventListener('click',h); pad.addEventListener('pointerup',h); pad.addEventListener('touchend',h,{passive:false}); }
  notes.length=0; state.running=true; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0; state.fever=false; state.feverCount=0;
  state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0; applyChainTuning(); setHUD("เริ่ม!"); loop(); }
function resetAll(){ stageIndex=0; totalScore=0; totalBonus=0; state.hitWindow=CH.cfg.hit; state.duration=CH.cfg.secs; }
function cleared(){ if(CH.type==="score")return state.score>=CH.target; if(CH.type==="combo")return state.best>=CH.target; if(CH.type==="accuracy")return (state.accTotal>0 && (state.accHit/state.accTotal)>=CH.target); if(CH.type==="fever")return state.feverCount>=CH.target; return true; }
function endStage(){ state.running=false; cancelAnimationFrame(state.raf); const ok=cleared(); const bonus=ok?CH.bonus:0; totalScore+=state.score; totalBonus+=bonus;
  try{ DuoProfile?.recordSession?.({ game:'rhythm', score: state.score, combo: state.best, acc: state.accTotal? (state.accHit/state.accTotal) : 0, orbs:0, dodges:0, fever: state.feverCount, quest:'rhythm' }); }catch(e){}
  const doneText=chain?`ด่าน ${stageIndex+1}/3 จบ • ได้ ${state.score}+${bonus}`:`จบเกม • score=${state.score+bonus}`; setHUD(`${doneText} (${ok?"✅ ผ่าน":"❌ ไม่ผ่าน"})`);
  if(chain && stageIndex<2){ stageIndex++; setTimeout(()=>start(),900); } else { const s=loadSave(); s.lastScore=totalScore+totalBonus; s.lastCombo=state.best; s.lastAcc= state.accTotal? (state.accHit/state.accTotal):0.0; s.lastChallenge=CH; s.ts=Date.now(); localStorage.setItem("fitnessDuo_rhythm_stats_v1",JSON.stringify(s));
    const summary=chain?`รวมทั้ง 3 ด่าน: ${totalScore}+${totalBonus} = ${totalScore+totalBonus}`:''; setHUD(`${doneText}\n${summary}`); } }
function loop(){ if(!state.running) return; const now=performance.now()/1000; state.elapsed=now-state.t0;
  while(nextBeat<=state.elapsed+1.0){ notes.push(spawnNote()); click(); nextBeat+=(60/bpm); }
  const speedZ=1.6; for(const it of notes){ if(it.judged) continue; const dt=it.t-state.elapsed; it.z=Math.max(0,dt*speedZ); it.el.object3D.position.z=it.z;
    if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.combo=0; toast("Miss","#fecaca"); } }
  updateFever(); setHUD(); if(state.elapsed>=state.duration) return endStage(); state.raf=requestAnimationFrame(loop); }
window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter'){ ensureAudio(); judgeHit(); }});
btnStart?.addEventListener('click',()=>{ if(stageIndex===0 && !state.running) resetAll(); if(!state.running) start(); });
btnReset?.addEventListener('click',()=>{ state.running=false; cancelAnimationFrame(state.raf); notes.forEach(n=>n.el?.remove()); notes=[]; resetAll(); setHUD("รีเซ็ตแล้ว"); });
window.start=start; window.startGame=start; window.reset=()=>{ state.running=false; cancelAnimationFrame(state.raf); notes.forEach(n=>n.el?.remove()); notes=[]; resetAll(); setHUD("รีเซ็ตแล้ว"); };
setHUD( (q.get("chain")==="3") ? "พร้อมเริ่ม • โหมดภารกิจต่อเนื่อง 3 ด่าน" : "พร้อมเริ่ม • ชาเลนจ์รายวัน/วีค");}
boot();})();
