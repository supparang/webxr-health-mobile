// Hygiene Rhythm — Action+Collect+Learn (V5)
// เน้นแอคชัน + เก็บเหรียญ/พาวเวอร์ + ควิซความรู้สุขอนามัย
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");
  const selTask=$("#task"), selDiff=$("#difficulty"), selBpm=$("#bpm"), selTrain=$("#training");
  const calib=$("#calib"), calibVal=$("#calibVal");
  const THAI_FONT = $("#thaiFont")?.getAttribute("src");

  // ---------- helpers ----------
  function label3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.18, maxWidth=5, x=0, y=0, z=0.06, align="center"} = opts;
    e.setAttribute('troika-text',`value:${value}; font:${THAI_FONT}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:${align}`.replace(/\s+/g,' '));
    e.setAttribute('position',`${x} ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(text,color){ const t=label3D(text,{color,fontSize:0.2,y:0.98}); uiRoot.appendChild(t); setTimeout(()=>t.remove(),700); }

  // ---------- audio ----------
  let actx=null,gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05);
    o.start(t); o.stop(t+0.06);
  }
  ["pointerdown","touchend","click","keydown"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- scene roots ----------
  const uiRoot = (()=>{
    let el=document.getElementById("root");
    if(!el){ el=document.createElement('a-entity'); el.setAttribute('id','root'); el.setAttribute('position','0 1.25 -3'); scene.appendChild(el); }
    return el;
  })();

  // ---------- timing / difficulty ----------
  const DIFF = { easy:{hit:0.18, secs:70}, normal:{hit:0.14, secs:85}, hard:{hit:0.10, secs:100} };
  let beatSec = 60 / parseInt(selBpm?.value||"96",10);

  // ---------- tasks (เหมือนเดิม) ----------
  const TASKS = {
    bathe: { name:"อาบน้ำ", emojis:["#em-shower","#em-soap","#em-scrub","#em-towel"], goalText:"ชำระร่างกายครบส่วนใน 1 รอบ",
      init:(s)=>{ s.goalHits=36; }, onHit:(s)=>{ s.goalHits--; }, pass:(s)=> s.goalHits<=0 },
    oral:  { name:"ช่องปากและฟัน", emojis:["#em-brush","#em-tooth","#em-brush","#em-tooth","#em-dent"], goalText:"แปรงฟัน 2 นาที + ตี 'ตรวจฟัน' ≥1",
      init:(s)=>{ s.duration=120; s.dentOK=false; }, onNoteSpawn:(s,n)=>{ if(Math.random()<0.10){ n.setAttribute('material','src:#em-dent; shader:flat; opacity:0.98; transparent:true'); n.__isDent=true; } }, onHit:(s,n)=>{ if(n?.__isDent) s.dentOK=true; }, pass:(s)=> s.elapsed>=120 && s.dentOK },
    hands: { name:"ล้างมือ", seq:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], emojis:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], goalText:"ทำครบ 7 ขั้น ≥1 รอบ",
      init:(s)=>{ s.stepIndex=0; s.stepDone=0; }, onHit:(s)=>{ s.stepIndex=(s.stepIndex+1)%7; if(s.stepIndex===0) s.stepDone++; }, pass:(s)=> s.stepDone>=1 },
    nails: { name:"ดูแลเล็บ", emojis:["#em-clip","#em-clean","#em-nail"], goalText:"ตัด/ทำความสะอาดเล็บ ≥12 ครั้ง",
      init:(s)=>{ s.trimLeft=12; }, onHit:(s)=>{ s.trimLeft--; }, pass:(s)=> s.trimLeft<=0 },
  };

  // ---------- lanes ----------
  const laneX = [-0.8, 0, 0.8], lanePads=[];
  function buildLanePads(){
    lanePads.splice(0).forEach(p=>p?.remove?.());
    for(let i=0;i<3;i++){
      const pad=document.createElement('a-entity');
      pad.classList.add('clickable'); pad.dataset.lane=i;
      pad.setAttribute('geometry','primitive: plane; width: 0.68; height: 0.42');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${laneX[i]} -0.62 0.06`);
      pad.appendChild(label3D(i===0?"A\nLEFT":i===1?"S\nCENTER":"D\nRIGHT",{fontSize:0.14,color:"#93c5fd"}));

      // touch swipe
      let sx=null; pad.addEventListener('touchstart',e=>{ sx=e.changedTouches[0].clientX; },{passive:true});
      pad.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX - sx; if(Math.abs(dx)>40) judgeHit(i, dx<0?-1:1); else judgeHit(i,null);
      },{passive:true});
      // click/pointer
      pad.addEventListener('click',()=>judgeHit(i,null));
      pad.addEventListener('pointerup',()=>judgeHit(i,null));
      uiRoot.appendChild(pad); lanePads.push(pad);
    }
  }

  // ---------- HUD (เหรียญ / พาวเวอร์ / Fever) ----------
  let feverGauge=null, feverLabel=null, coinHud=null, powerHud=null;
  function buildTopHUD(){
    // Fever bar
    if(feverGauge) feverGauge.remove();
    feverGauge=document.createElement('a-entity');
    feverGauge.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.06');
    feverGauge.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
    feverGauge.setAttribute('position','0 0.92 0.05');
    const fill=document.createElement('a-entity');
    fill.setAttribute('geometry','primitive: plane; width: 0.01; height: 0.06');
    fill.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    fill.setAttribute('position','-1.1 0 0.01');
    feverGauge.__fill=fill; feverGauge.appendChild(fill);
    feverLabel=label3D("FEVER",{fontSize:0.14,y:0.1,color:"#cbd5e1"}); feverGauge.appendChild(feverLabel);
    uiRoot.appendChild(feverGauge);

    // Coin / Power HUD
    if(coinHud) coinHud.remove();
    coinHud=label3D("🪙0",{fontSize:0.18,x:-1.1,y:0.72}); uiRoot.appendChild(coinHud);
    if(powerHud) powerHud.remove();
    powerHud=label3D("Power: —",{fontSize:0.16,x:1.0,y:0.72}); uiRoot.appendChild(powerHud);
  }
  function setFeverFill(ratio, ready=false, on=false){
    if(!feverGauge) return;
    const w = Math.max(0.01, Math.min(2.2*ratio, 2.2));
    feverGauge.__fill.setAttribute('geometry',`primitive: plane; width:${w}; height:0.06`);
    feverGauge.__fill.setAttribute('position',`${-1.1 + w/2} 0 0.01`);
    feverGauge.__fill.setAttribute('material',`color:${on?'#fca5a5': ready?'#fde68a':'#7dfcc6'}; opacity:0.96; shader:flat`);
    if(feverLabel){ feverLabel.setAttribute('troika-text',`value: ${on?'FEVER ON!':'FEVER'} ${ready&&!on?'(READY: กด S/CENTER)':''}; font:${THAI_FONT}; color:#e2e8f0; fontSize:0.14; maxWidth:4; align:center`); }
  }
  function setCoins(n){ coinHud?.setAttribute('troika-text',`value: 🪙${n}; font:${THAI_FONT}; color:#e2e8f0; fontSize:0.18; maxWidth:4; align:left`); }
  function setPower(name){ powerHud?.setAttribute('troika-text',`value: Power: ${name||"—"}; font:${THAI_FONT}; color:#e2e8f0; fontSize:0.16; maxWidth:4; align:right`); }

  // ---------- โปรไฟล์ / มิชชั่น ----------
  const LS_KEY="hygieneRhythmV5_profile";
  function loadProfile(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||"{}"); }catch(e){ return {}; } }
  function saveProfile(p){ try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch(e){} }

  // ---------- เนื้อหาความรู้ / ควิซ ----------
  const QUIZ = [
    {q:"ล้างมือควรอย่างน้อยกี่วินาที?", choices:["≥10 วิ","≥20 วิ","≥5 วิ"], ans:1, tip:"อย่างน้อย 20 วินาที (เทียบฮัมเพลงสั้น ๆ 2 รอบ)"},
    {q:"แปรงฟันวันละกี่ครั้ง?", choices:["1","2","4"], ans:1, tip:"เช้า-ก่อนนอน และใช้ไหมขัดฟันร่วมด้วย"},
    {q:"เล็บยาวมีผลอย่างไร?", choices:["สะสมเชื้อโรค","ช่วยป้องกันเชื้อ","ไม่ต่าง"], ans:0, tip:"เล็บยาวสะสมสิ่งสกปรกและเชื้อโรคได้ง่าย"},
    {q:"อาบน้ำควรทำอย่างไรหลังออกกำลังกาย?", choices:["ปล่อยให้เหงื่อแห้งเอง","อาบน้ำทันที","เช็ดผ้าเฉย ๆ"], ans:1, tip:"อาบน้ำชำระเหงื่อ ช่วยลดการสะสมเชื้อโรค/กลิ่น"}
  ];
  function showQuiz(onClose){
    state.paused=true; // หยุดเกมชั่วคราว
    const panel=document.createElement('a-entity');
    panel.setAttribute('geometry','primitive: plane; width: 2.2; height: 1.3');
    panel.setAttribute('material','color:#0b1220; opacity:0.98; shader:flat');
    panel.setAttribute('position','0 0.2 0.08');

    const item = QUIZ[(Math.random()*QUIZ.length)|0];
    panel.appendChild(label3D("ความรู้สุขอนามัย 🧠",{fontSize:0.22,y:0.5,color:"#7dfcc6"}));
    panel.appendChild(label3D(item.q,{fontSize:0.18,y:0.28,color:"#e2e8f0",maxWidth:4}));

    const mkChoice = (text,idx,x)=> {
      const b=document.createElement('a-entity'); b.classList.add('clickable');
      b.setAttribute('geometry','primitive: plane; width: 1.9; height: 0.24');
      b.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
      b.setAttribute('position',`${x} ${0.05 - idx*0.3} 0.01`);
      b.appendChild(label3D(`${idx+1}. ${text}`,{fontSize:0.16,color:"#e5e7eb"}));
      b.addEventListener('click',()=>{
        const correct = idx===item.ans;
        if(correct){
          state.score+=1000; state.coins+=2; setCoins(state.coins);
          toast("ถูกต้อง! +1000 คะแนน +🪙2","#7dfcc6");
        }else{
          toast(`เฉลย: ${item.tip}`,"#fde68a");
        }
        panel.remove(); state.paused=false; onClose&&onClose();
      });
      return b;
    };
    item.choices.forEach((c,i)=>panel.appendChild(mkChoice(c,i,0)));
    panel.appendChild(label3D(`TIP: ${item.tip}`,{fontSize:0.14,y:-0.58,color:"#cbd5e1",maxWidth:4}));
    uiRoot.appendChild(panel);
  }

  // ---------- สถานะเกม ----------
  const state={
    running:false, paused:false, raf:0, t0:0, elapsed:0, pauseHold:0,
    score:0, combo:0, best:0, accHit:0, accTotal:0, perfectCount:0,
    fever:0, feverOn:false, feverReady:false, feverEnd:0, feverCount:0, feverSeenMax:0, multiplier:1,
    hitWindow:DIFF.easy.hit, duration:DIFF.easy.secs, calibrationMs:0, taskKey: selTask?.value || "bathe",
    trainOn: (selTrain?.value||"on")==="on",
    coins:0, coinsSinceQuiz:0,
    power:null, shield:false // power: "Soap Bomb" | "Shield" | null
  };

  // ---------- สร้างไทม์ไลน์ ----------
  let timeline=[], tlIdx=0, notes=[];
  const laneXPos=[-0.8,0,0.8];
  const rndLane=()=> (Math.random()*3)|0;
  function makeSections(){
    const mainBeats=Math.max(8, Math.floor((state.duration/beatSec)-24));
    return [
      {name:"Intro", beats:12, density:0.35},
      {name:"Main",  beats:mainBeats, density: state.trainOn?0.50:0.70},
      {name:"Boss",  beats:12, density:0.92}
    ];
  }
  function fillTimeline(){
    timeline.length=0; tlIdx=0;
    let tBeat=0; const sections=makeSections();
    for(const sec of sections){
      for(let i=0;i<sec.beats;i++){
        timeline.push({time:tBeat, kind:'_click'});
        if(Math.random()<sec.density){
          const r=Math.random(); const lane=rndLane();
          if(r<Math.min(0.16, sec.density*0.25)){
            timeline.push({time:tBeat, kind:'hold', lane, beatsLen: (Math.random()<0.5?2:3)});
          }else if(r<Math.min(0.36, sec.density*0.45)){
            timeline.push({time:tBeat, kind:'swipe', lane, dir: (Math.random()<0.5?-1:1)});
          }else{
            const p=Math.random();
            if(p<0.6) timeline.push({time:tBeat, kind:'tap', lane});
            else if(p<0.9){ const l2=(lane+1+((Math.random()*2)|0))%3; timeline.push({time:tBeat, kind:'tap', lane}); timeline.push({time:tBeat, kind:'tap', lane:l2}); }
            else { timeline.push({time:tBeat, kind:'tap', lane:0}); timeline.push({time:tBeat, kind:'tap', lane:1}); timeline.push({time:tBeat, kind:'tap', lane:2}); }
          }
        }
        tBeat += 1;
      }
    }
    for(const it of timeline){ it.time = it.time*beatSec; }
  }

  // ---------- สปอว์นจากไทม์ไลน์ ----------
  function spawnFromTimeline(){
    const lead = state.trainOn ? 2.0 : 1.6;
    while(tlIdx < timeline.length){
      const ev = timeline[tlIdx];
      if(ev.time - state.elapsed <= lead){
        if(ev.kind==='_click'){ click(); tlIdx++; continue; }
        if(ev.kind==='tap'){ spawnTap(ev.lane, ev.time); }
        else if(ev.kind==='hold'){ spawnHold(ev.lane, ev.time, ev.beatsLen); }
        else if(ev.kind==='swipe'){ spawnSwipe(ev.lane, ev.time, ev.dir); }
        tlIdx++;
      }else break;
    }
  }

  // ---------- โน้ต/ศัตรู + เหรียญ ----------
  function noteMat(src){ return `src:${src}; shader:flat; opacity:0.98; transparent:true`; }
  function pickEmoji(){
    const T=TASKS[state.taskKey];
    if(state.taskKey==='hands'){ const idx=(state.stepIndex||0)%7; return T.seq[idx]; }
    return T.emojis[(Math.random()*T.emojis.length)|0];
  }
  function baseNote(src, lane){
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: plane; width:0.62; height:0.62');
    n.setAttribute('material',noteMat(src)); n.object3D.position.set(laneXPos[lane],0,2.8); uiRoot.appendChild(n);
    const T=TASKS[state.taskKey]; if(T.onNoteSpawn) T.onNoteSpawn(state, n);
    return n;
  }
  function spawnTap(lane, whenSec){
    const el=baseNote(pickEmoji(), lane);
    const obj={el, lane, t:whenSec, z:2.8, judged:false, type:'tap', __isDent:el.__isDent};
    notes.push(obj); return obj;
  }
  function spawnHold(lane, whenSec, beatsLen){
    const head=baseNote(pickEmoji(), lane);
    const bar=document.createElement('a-entity');
    bar.setAttribute('geometry','primitive: plane; width:0.18; height:1.2');
    bar.setAttribute('material','color:#93c5fd; opacity:0.65; shader:flat');
    bar.object3D.position.set(laneXPos[lane],0,2.2); uiRoot.appendChild(bar);
    const holdDur=beatsLen*beatSec;
    const obj={el:head, lane, t:whenSec, z:2.8, judged:false, type:'hold', holdEnd:whenSec+holdDur, bar};
    notes.push(obj); return obj;
  }
  function spawnSwipe(lane, whenSec, dir){
    const n=baseNote(pickEmoji(), lane);
    n.appendChild(label3D(dir<0?"⬅️":"➡️",{fontSize:0.28,y:-0.45,color:"#fde68a"}));
    const obj={el:n, lane, t:whenSec, z:2.8, judged:false, type:'swipe', dir};
    notes.push(obj); return obj;
  }

  function spawnCoin(fromNote, amount){
    // เหรียญเล็ก ๆ กระเด้งขึ้นไป HUD
    for(let i=0;i<amount;i++){
      const c=document.createElement('a-entity');
      c.setAttribute('geometry','primitive: plane; width:0.24; height:0.24');
      c.setAttribute('material','color:#fde68a; opacity:0.98; shader:flat');
      c.object3D.position.copy(fromNote.el.object3D.position);
      uiRoot.appendChild(c);
      // แอนิเมชันลอยขึ้นแล้ววิ่งไปมุมซ้ายบน
      const p=fromNote.el.object3D.position.clone();
      c.setAttribute('animation__rise',`property: position; to: ${p.x} ${p.y+0.5} ${p.z}; dur:180; easing:easeOutQuad`);
      setTimeout(()=>{
        c.setAttribute('animation__fly','property: position; to: -1.2 0.72 0.05; dur:360; easing:easeInCubic');
        setTimeout(()=>c.remove(),400);
      },190);
    }
  }

  function tryDropPower(){
    // โอกาสเล็กน้อยดรอปพาวเวอร์เมื่อ Perfect สะสม
    if(Math.random()<0.18){
      state.power = Math.random()<0.5 ? "Soap Bomb" : "Shield";
      setPower(state.power);
      toast(`ได้พาวเวอร์: ${state.power}`, "#7dfcc6");
    }
  }

  // ---------- FEVER / multiplier ----------
  function addFever(v){
    state.fever=Math.max(0,Math.min(100,state.fever+v));
    setFeverFill(state.fever/100, state.fever>=100 && !state.feverOn, state.feverOn);
    if(state.fever>state.feverSeenMax) state.feverSeenMax=state.fever;
    state.feverReady = (state.fever>=100 && !state.feverOn);
  }
  function tryTriggerFever(){ if(!state.feverReady || state.feverOn) return false; state.feverOn=true; state.feverReady=false; state.feverEnd=state.elapsed+7; state.fever=0; setFeverFill(0,false,true); state.feverCount++; toast("FEVER ON! ✨","#7dfcc6"); return true; }
  function updateFever(){ if(state.feverOn && state.elapsed>=state.feverEnd){ state.feverOn=false; setFeverFill(state.fever/100,false,false); toast("Fever End","#cbd5e1"); } }
  function updateMultiplier(){ state.multiplier = state.combo>=40?4: state.combo>=20?3: state.combo>=10?2:1; }

  // ---------- judge ----------
  const keyToLane=(k)=>k==='a'||k==='arrowleft'?0:k==='s'||k==='arrowup'?1:k==='d'||k==='arrowright'?2:null;
  let lastDirKey=0; window.addEventListener('keydown',e=>{ const k=(e.key||'').toLowerCase(); if(k==='arrowleft'||k==='a') lastDirKey=-1; if(k==='arrowright'||k==='d') lastDirKey=+1; });
  window.addEventListener('keyup',()=>{ setTimeout(()=>lastDirKey=0,150); });

  let holdState={lane:null,active:false,targetEnd:0};
  function beginHold(lane){ holdState={lane,active:true,targetEnd:0}; }
  function endHold(){ holdState.active=false; holdState.lane=null; }

  function judgeHit(lane, swipeDirTouch=null){
    // เปิด FEVER ด้วยเลนกลางเมื่อ READY
    if(lane===1 && state.feverReady){ if(tryTriggerFever()) return; }

    if(state.paused) return; // ถ้ามีควิซกำลังเปิดอยู่

    const target = state.elapsed + (state.calibrationMs/1000);
    let best=null, bestErr=999;
    for(const it of notes){ if(it.judged || it.lane!==lane) continue; const err=Math.abs(it.t - target); if(err<bestErr){ best=it; bestErr=err; } }
    state.accTotal++;
    if(!best || bestErr>state.hitWindow){
      if(state.shield){ state.shield=false; setPower(state.power?`${state.power} (Shield used)`: "—"); toast("Shield! ป้องกัน Miss","#93c5fd"); return; }
      state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8); state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.01); return;
    }

    if(best.type==='tap'){
      scoreHit(best, bestErr, 1.0); if(best.__isDent) TASKS[state.taskKey]?.onHit?.(state,best);
      best.judged=true; best.el.setAttribute('visible','false');
    }else if(best.type==='swipe'){
      const need=best.dir, got = swipeDirTouch ?? (lastDirKey||0);
      if(got===need){ scoreHit(best, bestErr, 1.1); best.judged=true; best.el.setAttribute('visible','false'); }
      else { state.combo=0; updateMultiplier(); toast("Wrong Direction","#fecaca"); addFever(-6); }
    }else if(best.type==='hold'){
      beginHold(lane); holdState.targetEnd=best.holdEnd; best.__holding=true; best.el.setAttribute('visible','false');
    }
  }

  function scoreHit(note, err, mul=1){
    const perfect = err<=state.hitWindow*0.35;
    const base = perfect?300:150;
    const gain = Math.round(base * (state.feverOn?1.5:1) * state.multiplier * mul);
    state.score += gain;
    state.combo++; updateMultiplier();
    if(perfect){ state.perfectCount++; if(state.hitWindow>0.08) state.hitWindow -= 0.002; addFever(6); spawnCoin(note, 2); state.coins+=2; tryDropPower(); }
    else { addFever(3); spawnCoin(note, 1); state.coins+=1; }
    setCoins(state.coins);
    state.accHit++; state.best=Math.max(state.best,state.combo);
    TASKS[state.taskKey]?.onHit?.(state, note);

    state.coinsSinceQuiz += perfect?2:1;
    if(state.coinsSinceQuiz>=6){ state.coinsSinceQuiz=0; showQuiz(()=>{ /* resume */ }); }

    // ใช้พาวเวอร์อัตโนมัติถ้ามี Soap Bomb
    if(state.power==="Soap Bomb"){
      state.power=null; setPower("—");
      // เคลียร์โน้ตที่กำลังจะถึง 2 บีตถัดไป
      const windowSec = 2*beatSec;
      let cleared=0;
      for(const it of notes){
        if(!it.judged && it.t - state.elapsed <= windowSec){
          it.judged=true; it.el.setAttribute('visible','false'); it.bar?.setAttribute('visible','false');
          cleared++;
        }
      }
      toast(`Soap Bomb! เคลียร์ ${cleared} โน้ต`, "#7dfcc6");
      state.score += 200 * cleared;
    }else if(state.power==="Shield"){
      state.shield = true; state.power=null; setPower("Shield (Armed)");
    }
  }

  // ---------- Flow ----------
  function setHUD(msg=""){
    const T=TASKS[state.taskKey], name=T?.name||state.taskKey;
    let extra="";
    if(state.taskKey==="bathe") extra=`เหลือ ${Math.max(0,state.goalHits)} จังหวะ`;
    if(state.taskKey==="oral")  extra=`ตรวจฟัน: ${state.dentOK?"✅":"—"}`;
    if(state.taskKey==="hands") extra=`รอบ 7 ขั้น: ${state.stepDone||0}`;
    if(state.taskKey==="nails") extra=`เหลือ ${Math.max(0,state.trimLeft)} ครั้ง`;
    hud.textContent = `Hygiene Rhythm • ${name}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${state.accTotal?Math.round(state.accHit/state.accTotal*100):0}% x${state.multiplier} ${state.feverOn?'• FEVER':''}${state.feverReady?' • READY':''}\nเวลา ${Math.max(0,Math.ceil(state.duration - state.elapsed))}s\n${T?.goalText||""}\n${extra}\n${msg}`;
  }
  function applyDiff(){ const d=DIFF[selDiff.value]||DIFF.easy; state.hitWindow=d.hit; state.duration=d.secs; }
  function applyTask(){ state.taskKey=selTask.value; (TASKS[state.taskKey]?.init||(()=>{}))(state); }
  function applyCalib(){ state.calibrationMs=parseInt(calib.value||"0",10); calibVal.textContent=state.calibrationMs; }

  function start(){
    ensureAudio();
    notes.forEach(n=>{ n.el?.remove(); n.bar?.remove(); }); notes.length=0; timeline.length=0; tlIdx=0;
    state.running=true; state.paused=false; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0; state.perfectCount=0;
    state.fever=0; state.feverOn=false; state.feverReady=false; state.feverEnd=0; state.feverCount=0; state.feverSeenMax=0; state.multiplier=1;
    state.trainOn = (selTrain?.value||"on")==="on";
    state.coins=0; state.coinsSinceQuiz=0; setCoins(0); state.power=null; state.shield=false; setPower("—");
    (TASKS[state.taskKey]?.init||(()=>{}))(state);
    buildLanePads(); buildTopHUD(); setFeverFill(0,false,false);
    fillTimeline();
    state.t0=performance.now()/1000; state.elapsed=0; state.pauseHold=0;
    setHUD("เริ่ม!");
    loop();
  }
  function reset(){
    state.running=false; state.paused=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>{ n.el?.remove(); n.bar?.remove(); }); notes.length=0; timeline.length=0; tlIdx=0;
    setHUD("รีเซ็ตแล้ว");
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    const pass=(TASKS[state.taskKey]?.pass||(()=>false))(state);
    const panel=document.createElement('a-entity');
    panel.setAttribute('geometry','primitive: plane; width: 2.2; height: 1.2');
    panel.setAttribute('material','color:#0b1220; opacity:0.96; shader:flat');
    panel.setAttribute('position','0 0.2 0.08');
    panel.appendChild(label3D(pass?"ภารกิจสำเร็จ! ✅":"ยังไม่ผ่าน ❌",{fontSize:0.24,y:0.48,color:pass?"#7dfcc6":"#fecaca"}));
    panel.appendChild(label3D(`คะแนน: ${state.score}\nคอมโบสูงสุด: ${state.best}\nเหรียญ: ${state.coins}`,{fontSize:0.16,y:0.10,color:"#e2e8f0"}));
    const btnClose=document.createElement('a-entity'); btnClose.classList.add('clickable');
    btnClose.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.28'); btnClose.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat'); btnClose.setAttribute('position','0 -0.4 0.01');
    btnClose.appendChild(label3D("Finish",{fontSize:0.16,color:"#053b2a"}));
    btnClose.addEventListener('click',()=>panel.remove());
    panel.appendChild(btnClose); uiRoot.appendChild(panel);
    setHUD(`จบเกม • ${pass?"ผ่าน":"ไม่ผ่าน"}`);
  }

  // ---------- loop ----------
  function loop(){
    if(!state.running) return;
    if(state.paused){ // freeze time
      state.t0 += (performance.now()/1000 - (state.lastNow || performance.now()/1000));
      state.lastNow = performance.now()/1000;
      state.raf=requestAnimationFrame(loop); return;
    }
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    spawnFromTimeline();

    const speedZ=1.6;
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - (state.elapsed + (state.calibrationMs/1000));
      it.z = Math.max(0, dt*speedZ);
      it.el.object3D.position.set(laneXPos[it.lane],0,it.z);
      if(it.type==='hold' && it.bar){
        const len = Math.max(0, (it.holdEnd - (state.elapsed + (state.calibrationMs/1000))) * speedZ);
        it.bar.object3D.position.set(laneXPos[it.lane],0, Math.max(0.3, len/2));
        it.bar.setAttribute('geometry',`primitive: plane; width:0.18; height:${Math.max(0.001,len)}`);
      }
      if(dt<-state.hitWindow && !it.judged && it.type!=='hold'){
        it.judged=true; it.el.setAttribute('visible','false');
        if(state.shield){ state.shield=false; setPower("—"); toast("Shield! ป้องกัน Miss","#93c5fd"); }
        else { state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8); state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.008); }
      }
    }

    // HOLD complete
    if(holdState.active && state.elapsed >= holdState.targetEnd - (state.calibrationMs/1000)){
      for(const it of notes){
        if(!it.judged && it.type==='hold' && it.lane===holdState.lane && state.elapsed>=it.holdEnd - (state.calibrationMs/1000)){
          it.judged=true; it.el.setAttribute('visible','false'); it.bar?.setAttribute('visible','false');
          scoreHit(it,0.0,1.25);
        }
      }
      endHold();
    }

    updateFever();
    setHUD();
    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // ---------- input ----------
  window.addEventListener('keydown',(e)=>{
    const k=(e.key||'').toLowerCase();
    const ln = k? (k==='a'||k==='arrowleft'?0:k==='s'||k==='arrowup'?1:k==='d'||k==='arrowright'?2:null) : null;
    if(ln!==null) judgeHit(ln,null);
    if(k==='s' && !state.running) start();
    if(k==='r') reset();
  });

  // ---------- bindings ----------
  btnStart?.addEventListener('click', ()=>!state.running&&start());
  btnReset?.addEventListener('click', reset);
  selDiff?.addEventListener('change', ()=>{ state.hitWindow=(DIFF[selDiff.value]||DIFF.easy).hit; state.duration=(DIFF[selDiff.value]||DIFF.easy).secs; setHUD("ตั้งค่าโหมดแล้ว"); });
  selBpm?.addEventListener('change',  ()=>{ beatSec = 60/parseInt(selBpm.value||"96",10); setHUD("ตั้งค่า BPM แล้ว"); });
  selTask?.addEventListener('change', ()=>{ applyTask(); setHUD("สลับเกมแล้ว"); });
  selTrain?.addEventListener('change',()=>{ state.trainOn=(selTrain.value==="on"); setHUD("สลับ Training แล้ว"); });
  calib?.addEventListener('input', ()=>applyCalib());

  // ---------- boot ----------
  (function addChainButton(){
    const btn=document.createElement('a-entity');
    btn.classList.add('clickable');
    btn.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.28');
    btn.setAttribute('material','color:#fde68a; opacity:0.95; shader:flat');
    btn.setAttribute('position','-0.9 1.05 0.06');
    btn.appendChild(label3D("Start Chain-3",{fontSize:0.14,color:"#422006"}));
    btn.addEventListener('click', ()=>{
      selTask.value = "bathe"; applyTask(); start(); // โหมด Chain: เริ่มด้วย bathe → ให้ผู้เล่นกด Continue เอง
    });
    uiRoot.appendChild(btn);
  })();

  applyTask(); applyCalib(); buildLanePads(); buildTopHUD(); setFeverFill(0,false,false); setCoins(0); setPower("—");
  hud.textContent = "พร้อมเริ่ม • แอคชัน+เก็บของ+ควิซ • กด Start แล้วลุย!";
}
