// Rhythm — รับ bpm/diff + Auto-Challenge (รายวัน) + ปรับตามฝีมือ + Fever
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), cursor=$("#cursor"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");

  function setCursorMode(m){ if(!cursor) return;
    if(m==="vr"){ cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900"); cursor.setAttribute("visible","true"); }
    else{ cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false"); cursor.setAttribute("visible","false"); } }
  setCursorMode("desktop"); scene?.addEventListener("enter-vr",()=>setCursorMode("vr")); scene?.addEventListener("exit-vr",()=>setCursorMode("desktop"));

  // Query + fallback
  const q=new URLSearchParams(location.search);
  const diff=(q.get("diff")||"easy").toLowerCase();
  const bpm = parseInt(q.get("bpm")||"96",10);
  const autoChallenge = (q.get("autoChallenge") ?? "1") !== "0";

  const DIFF = { easy:{hit:0.18, secs:50}, normal:{hit:0.14, secs:60}, hard:{hit:0.10, secs:70} };
  const base = DIFF[diff]||DIFF.easy;

  // ==== Auto-Challenge Engine ====
  const SAVE_KEY="fitnessDuo_rhythm_stats_v1";
  function loadSave(){ try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");}catch(e){return{}} }
  function saveSave(s){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){} }
  function daySeed(){ const d=new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`; }
  function hashCode(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h + str.charCodeAt(i))|0; } return h; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; }; }

  function autoTune(base){
    const s=loadSave();
    const acc = Math.min(1, Math.max(0, s.lastAcc||0.75));     // ค่าความแม่นครั้งก่อน (0..1)
    const combo = Math.min(1, (s.lastCombo||8)/32);             // combo ยาวสุดแปลงเป็น 0..1
    const power = (acc*0.6 + combo*0.4) - 0.5;                  // -0.5..+0.5
    return {
      hit: Math.max(0.08, base.hit - power*0.05),
      secs: base.secs + Math.round(power*10)
    };
  }

  function genDailyChallenge(seed){
    const tuned = autoTune(base);
    const r=mulberry32(hashCode(seed));

    const types=["score","combo","accuracy","fever"];
    const type=types[(r()*types.length)|0];

    const ch = { type, title:"", hint:"", bonus:500, cfg:tuned };
    if(type==="score"){
      ch.target = Math.round(2200 + r()*1800); // 2200–4000
      ch.title="ทำคะแนนรวมให้ถึง"; ch.hint=`คะแนน ≥ ${ch.target}`;
    }else if(type==="combo"){
      ch.target = 12 + ((r()*18)|0); // 12–30
      ch.title="ทำคอมโบต่อเนื่อง"; ch.hint=`คอมโบ ≥ ${ch.target}`;
    }else if(type==="accuracy"){
      ch.target = 0.82 + r()*0.1; // 82–92%
      ch.title="ความแม่นยำ"; ch.hint=`ACC ≥ ${(ch.target*100).toFixed(0)}%`;
    }else if(type==="fever"){
      ch.target = 3 + ((r()*3)|0); // 3–5 ครั้ง
      ch.title="เปิด Fever หลายครั้ง"; ch.hint=`Fever ≥ ${ch.target} ครั้ง`;
    }
    return ch;
  }

  const CH = autoChallenge ? genDailyChallenge(`${daySeed()}|${diff}|${bpm}`) : {type:"none", title:"โหมดธรรมดา", hint:"", bonus:0, cfg:base};

  // ==== State ====
  const state={
    running:false, raf:0, t0:0, elapsed:0,
    score:0, combo:0, best:0,
    hitWindow:CH.cfg.hit, duration:CH.cfg.secs,
    accHit:0, accTotal:0,
    fever:false, feverTime:0, feverCount:0
  };
  const beatSec = 60/bpm;
  let actx=null, gain=null;
  let notes=[]; // {el, t, z, judged}

  function setHUD(msg){
    const acc = state.accTotal>0 ? (state.accHit/state.accTotal*100).toFixed(0) : "0";
    const fever = state.fever ? "ON" : "OFF";
    hud.textContent = `Rhythm • diff=${diff} bpm=${bpm} • AutoChallenge=${autoChallenge?"ON":"OFF"}\n${CH.title} — ${CH.hint}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${acc}% fever=${fever}\n${msg||""}`;
  }

  function makeText(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#fff",fontSize=0.18,maxWidth=5,y=0,z=0.06}=opts;
    e.setAttribute('troika-text',`value:${value}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:center`);
    e.setAttribute('position',`0 ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(txt,color){ const t=makeText(txt,{color,fontSize:0.2,y:0.7}); root.appendChild(t); setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),420); }

  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){
    if(!actx) return;
    const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.2,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
    o.start(t); o.stop(t+0.05);
  }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true}));

  function spawnNote(){
    const n=document.createElement('a-entity');
    n.classList.add('note');
    n.setAttribute('geometry','primitive: circle; radius: 0.14; segments:32');
    // สีตามเฟสดนตรี (สุ่มเบา ๆ)
    const hues=[210,190,160,140]; const h=hues[(Math.random()*hues.length)|0];
    n.setAttribute('material',`color:hsl(${h},70%,70%); shader:flat; opacity:0.98`);
    n.object3D.position.set(0,0,2.8);
    root.appendChild(n);
    return {el:n, t:state.elapsed+1.6, z:2.8, judged:false};
  }

  function addScore(base){
    let s=base;
    if(state.fever) s = Math.round(s*1.5);
    state.score+=s;
  }

  function enterFever(){ state.fever=true; state.feverTime=state.elapsed+6; state.feverCount++; toast("FEVER! ✨","#7dfcc6"); }
  function updateFever(){ if(state.fever && state.elapsed>=state.feverTime){ state.fever=false; toast("Fever End","#cbd5e1"); } }

  function judgeHit(){
    const target = state.elapsed;
    let best=null, bestErr=999;
    for(const it of notes){
      if(it.judged) continue;
      const err=Math.abs(it.t - target);
      if(err<bestErr){ best=it; bestErr=err; }
    }
    state.accTotal++;
    if(!best || bestErr>state.hitWindow){ state.combo=0; toast("Miss","#fecaca"); return; }
    best.judged=true; best.el.setAttribute("visible","false");
    state.accHit++;
    if(bestErr<=state.hitWindow*0.35){ addScore(300); state.combo++; toast("Perfect +300","#7dfcc6"); }
    else { addScore(150); state.combo++; toast("Good +150","#a7f3d0"); }
    state.best=Math.max(state.best,state.combo);

    // เงื่อนไขเข้า Fever: ทำ Perfect/Good ติดกัน 8 ครั้ง
    if(!state.fever && state.combo>0 && state.combo%8===0) enterFever();
  }

  let nextBeat=0;
  function start(){
    notes.length=0; state.running=true; state.score=0; state.combo=0; state.best=0;
    state.accHit=0; state.accTotal=0; state.fever=false; state.feverCount=0;
    state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0;
    setHUD("เริ่ม!");
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>n.el?.parentNode?.removeChild(n.el)); notes.length=0;
    setHUD("รีเซ็ตแล้ว");
  }
  function cleared(){
    if(CH.type==="score")    return state.score>=CH.target;
    if(CH.type==="combo")    return state.best>=CH.target;
    if(CH.type==="accuracy") return (state.accTotal>0 && (state.accHit/state.accTotal)>=CH.target);
    if(CH.type==="fever")    return state.feverCount>=CH.target;
    return true;
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    const ok=cleared(); const final= state.score + (ok?CH.bonus:0);
    setHUD(`จบเกม • score=${final} (${ok?"✅ ผ่าน":"❌ ไม่ผ่าน"}) • bestCombo=${state.best} • ACC=${state.accTotal?Math.round(state.accHit/state.accTotal*100):0}% • Fever=${state.feverCount}`);
    const s=loadSave();
    s.lastScore=final; s.lastCombo=state.best;
    s.lastAcc= state.accTotal? (state.accHit/state.accTotal):0.0;
    s.lastChallenge=CH; s.ts=Date.now();
    saveSave(s);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // schedule beats (เมโทรนอม + โน้ต)
    while(nextBeat <= state.elapsed + 1.0){
      notes.push(spawnNote());
      click();
      nextBeat += beatSec;
    }

    // move & auto-judge overtime
    const speedZ = 1.6; // ระยะทาง/วินาที
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - state.elapsed;
      it.z = Math.max(0, dt*speedZ);
      it.el.object3D.position.z = it.z;
      if(dt<-state.hitWindow && !it.judged){ it.judged=true; it.el.setAttribute("visible","false"); state.combo=0; toast("Miss","#fecaca"); }
    }
    updateFever();

    setHUD();
    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // input
  function bindHit(el){
    const h=e=>{ e.preventDefault(); e.stopPropagation(); ensureAudio(); judgeHit(); };
    el.addEventListener('click',h);
    el.addEventListener('pointerup',h);
    el.addEventListener('touchend',h,{passive:false});
  }
  const pad=document.createElement('a-entity');
  pad.classList.add('clickable');
  pad.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.5');
  pad.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
  pad.setAttribute('position','0 -0.5 0.06');
  const padText=makeText("TAP / GAZE HERE",{color:"#93c5fd",fontSize:0.18,y:0});
  padText.setAttribute('position','0 0 0.01');
  pad.appendChild(padText);
  root.appendChild(pad);
  bindHit(pad);
  window.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') judgeHit(); });

  btnStart.addEventListener('click', ()=>!state.running&&start());
  btnReset.addEventListener('click', reset);

  setHUD("พร้อมเริ่ม • ชาเลนจ์รายวันถูกตั้งให้อัตโนมัติ");
}
