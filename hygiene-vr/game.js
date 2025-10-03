/* Hygiene VR — Index + GAME.js (single scene flow)
 * โหมด: Menu, Handwash(7), Brush(5 zones / 2 min + metronome), Quiz(3), Summary
 * ไม่มีไฟล์เสียงภายนอก ใช้ WebAudio tone สร้างเมโทรนอม
 */

const GAME_ID = "HygieneVR";
const $ = id => document.getElementById(id);
const hud = $('hudText');
const btn = { menu: $('btnMenu'), start: $('btnStart'), reset: $('btnReset') };
const gameRoot = document.getElementById('gameRoot');

// --------- State ---------
const STATE = { MENU:'menu', TUTORIAL:'tutorial', HAND:'hand', BRUSH:'brush', QUIZ:'quiz', SUMMARY:'summary' };
let state = STATE.MENU;

let score = 0, lives = 3;
let timerId = null;
let handStep = 0;      // 1..7
let brushZone = 0;     // 1..5
let brushTime = 120;   // seconds
let quizIndex = 0;
let quizScore = 0;

// --------- Audio: Metronome (WebAudio) ---------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function ping(freq=820, dur=0.05, vol=0.15){
  try{
    if(!actx) actx = new AudioCtx();
    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type='sine'; osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    osc.connect(gain).connect(actx.destination);
    osc.start(t); osc.stop(t+dur);
  }catch(e){}
}

// --------- Helpers ---------
function setHUD(text){ hud.style.whiteSpace='pre-line'; hud.textContent = text; }
function clearNode(el){ while(el.firstChild) el.removeChild(el.firstChild); }
function makePanel(w,h,color='#fff',z=0){ const p=document.createElement('a-plane'); p.setAttribute('width',w); p.setAttribute('height',h); p.setAttribute('color',color); p.setAttribute('position',`0 0 ${z}`); return p; }
function makeText(txt, w=5, color='#0b1220', align='center', pos='0 0 0.02'){
  const t=document.createElement('a-entity');
  t.setAttribute('text',`value:${txt}; width:${w}; align:${align}; color:${color}`);
  t.setAttribute('position',pos); return t;
}
function makeButton(label, x, y, color='#111827', tcolor='#eaf2ff', onClick){
  const g=document.createElement('a-entity');
  g.setAttribute('position',`${x} ${y} 0`);
  const bg=document.createElement('a-plane');
  bg.classList.add('selectable');
  bg.setAttribute('width','0.9'); bg.setAttribute('height','0.32');
  bg.setAttribute('material',`color:${color}; shader:flat; opacity:0.96`);
  const tx=makeText(label, 3.2, tcolor, 'center', '0 0 0.02');
  g.appendChild(bg); g.appendChild(tx);
  bg.addEventListener('click', onClick);
  return g;
}
function progressBar(width=1.8, val=0, max=1, color='#60a5fa'){
  const wrap=document.createElement('a-entity');
  const base=makePanel(width,0.10,'#c7d2fe',0.0);
  base.setAttribute('material','shader:flat; opacity:0.5');
  const fill=document.createElement('a-plane');
  const fwidth=Math.max(0.001, width * (val/max));
  fill.setAttribute('width',fwidth);
  fill.setAttribute('height','0.10');
  fill.setAttribute('color', color);
  fill.setAttribute('position',`${-width/2 + fwidth/2} 0 0.01`);
  wrap.appendChild(base); wrap.appendChild(fill);
  wrap._fill = fill; wrap._width = width;
  wrap._set = (v)=>{ const fw=Math.max(0.001, width*(v/max)); fill.setAttribute('width', fw); fill.setAttribute('position',`${-width/2 + fw/2} 0 0.01`); };
  return wrap;
}
function billboard(el){ el.setAttribute('billboard',''); }
AFRAME.registerComponent('billboard',{tick(){ const cam=document.querySelector('[camera]'); if(!cam) return; const v=new THREE.Vector3(); cam.object3D.getWorldPosition(v); this.el.object3D.lookAt(v);} });

// --------- Main Screens ---------
function showMenu(){
  state = STATE.MENU;
  clearNode(gameRoot);
  const root=document.createElement('a-entity'); root.setAttribute('position','0 0 0'); gameRoot.appendChild(root);

  const title=makeText('Hygiene VR',6,'#0b1220','center','0 0.7 0.02'); root.appendChild(title);
  const card=makePanel(2.4,1.6,'#ffffff',0); root.appendChild(card);

  const b1 = makeButton('🧼  ล้างมือ (7 ขั้น)', -0.8, 0.3, '#16a34a', '#fff', ()=>startHand());
  const b2 = makeButton('🪥  แปรงฟัน (5 โซน/2 นาที)', 0.8, 0.3, '#0ea5e9', '#fff', ()=>startBrush());
  const b3 = makeButton('❓  Mini-Quiz (3 ข้อ)', 0, -0.2, '#f59e0b', '#111', ()=>startQuiz());
  root.appendChild(b1); root.appendChild(b2); root.appendChild(b3);

  const how = makeText('วิธีเล่น: เล็งวงแหวนไปที่ปุ่มแล้วจ้อง 1 วิ หรือกด OK', 4.5, '#334155','center','0 -0.7 0.02');
  root.appendChild(how);
  setHUD('เมนูหลัก\nเลือกโหมดเพื่อเริ่มฝึกสุขนิสัย');
}

function startHand(){
  state = STATE.HAND;
  clearNode(gameRoot);
  score = 0; handStep = 1;

  const board=document.createElement('a-entity'); board.setAttribute('position','0 0 0'); gameRoot.appendChild(board);
  const bg=makePanel(2.2,1.3,'#ffffff',0); board.appendChild(bg);
  const title = makeText('ล้างมือ 7 ขั้น (ทำท่าตามทีละขั้น)', 5.8, '#0b1220','center','0 0.6 0.02'); board.appendChild(title);

  const stepText = makeText('', 5.4, '#111','center','0 0.25 0.02'); board.appendChild(stepText);
  const bar = progressBar(1.8, 0, 7, '#16a34a'); bar.setAttribute('position','0 -0.05 0'); board.appendChild(bar);

  // ปุ่มท่าทาง (จำลองการตรวจจับ gesture)
  const btnOK = makeButton('ทำท่าสำเร็จ ✓', 0, -0.50, '#16a34a', '#fff', ()=>{
    score += 2; handStep++;
    if(handStep>7){ // finish
      finishHand();
    }else{
      updateStep();
    }
  });
  board.appendChild(btnOK);

  function updateStep(){
    const map = {
      1:'ขั้น 1: ถูฝ่ามือเข้าหากัน',
      2:'ขั้น 2: ถูหลังมือ สลับซ้าย-ขวา',
      3:'ขั้น 3: ถูซอกนิ้ว',
      4:'ขั้น 4: ถูหลังนิ้ว',
      5:'ขั้น 5: ถูรอบนิ้วโป้ง',
      6:'ขั้น 6: ถูปลายนิ้วบนฝ่ามือ',
      7:'ขั้น 7: ถูรอบข้อมือ'
    };
    stepText.setAttribute('text',`value:${map[handStep]}; width:5.2; align:center; color:#111`);
    bar._set(handStep-1);
    setHUD(`ล้างมือ: ขั้นที่ ${handStep}/7\nคะแนน: ${score}`);
  }
  updateStep();

  function finishHand(){
    clearNode(gameRoot);
    const root=document.createElement('a-entity'); root.setAttribute('position','0 0 0'); gameRoot.appendChild(root);
    root.appendChild(makePanel(2.0,1.0,'#ffffff',0));
    root.appendChild(makeText('เสร็จสิ้นล้างมือ! ✨',5,'#0b1220','center','0 0.35 0.02'));
    root.appendChild(makeText(`คะแนนล้างมือ: ${score}`,4,'#111','center','0 -0.05 0.02'));
    const next = makeButton('ไปแปรงฟัน ➜', 0.7, -0.35, '#0ea5e9', '#fff', startBrush);
    const menu = makeButton('เมนูหลัก', -0.7, -0.35, '#111827', '#eaf2ff', showMenu);
    root.appendChild(next); root.appendChild(menu);
    setHUD(`ล้างมือสำเร็จ\nคะแนนรวม: ${score}`);
  }
}

function startBrush(){
  state = STATE.BRUSH;
  clearNode(gameRoot);
  brushZone = 1; brushTime = 120;

  const root=document.createElement('a-entity'); root.setAttribute('position','0 0 0'); gameRoot.appendChild(root);
  root.appendChild(makePanel(2.2,1.3,'#ffffff',0));
  const title = makeText('แปรงฟัน 5 โซน (เวลา 2 นาที + เมโทรนอม)', 5.6, '#0b1220','center','0 0.6 0.02'); root.appendChild(title);

  const zoneText = makeText('', 5.2, '#111','center','0 0.25 0.02'); root.appendChild(zoneText);
  const barZone = progressBar(1.8, 0, 5, '#0ea5e9'); barZone.setAttribute('position','0 -0.05 0'); root.appendChild(barZone);
  const barTime = progressBar(1.8, 0, 120, '#f59e0b'); barTime.setAttribute('position','0 -0.25 0'); root.appendChild(barTime);
  const btnOK   = makeButton('โซนนี้เสร็จ ✓', 0, -0.55, '#0ea5e9', '#fff', ()=>{
    score += 3; brushZone++;
    if(brushZone>5) finishBrush(); else updateZone();
  });
  root.appendChild(btnOK);

  // เมโทรนอม (ค่าเริ่ม BPM=60 → ping ทุก 1 วินาที)
  let metroId = null, bpm = 60;
  function startMetronome(){
    stopMetronome();
    metroId = setInterval(()=>ping(1000,0.03,0.12), Math.max(200, 60000/bpm));
  }
  function stopMetronome(){ if(metroId){ clearInterval(metroId); metroId=null; } }

  // ตัวจับเวลา 120 วินาที
  if(timerId) clearInterval(timerId);
  timerId = setInterval(()=>{
    brushTime--; if(brushTime<0) brushTime=0;
    barTime._set(120 - brushTime);
    setHUD(`แปรงฟัน: โซน ${brushZone}/5\nเหลือเวลา: ${brushTime} วิ\nคะแนน: ${score}`);
    if(brushTime<=0){ finishBrush(); }
  },1000);

  function updateZone(){
    const names = {
      1:'โซน 1: ฟันหน้า บน–ล่าง',
      2:'โซน 2: ฟันกรามซ้าย',
      3:'โซน 3: ฟันกรามขวา',
      4:'โซน 4: ฟันกรามบนด้านใน',
      5:'โซน 5: ฟันกรามล่างด้านใน'
    };
    zoneText.setAttribute('text',`value:${names[brushZone]}; width:5.2; align:center; color:#111`);
    barZone._set(brushZone-1);
    setHUD(`แปรงฟัน: ${names[brushZone]}\nเหลือเวลา: ${brushTime} วิ\nคะแนน: ${score}`);
  }
  updateZone();
  startMetronome();

  function finishBrush(){
    if(timerId){ clearInterval(timerId); timerId=null; }
    stopMetronome();
    clearNode(gameRoot);
    const g=document.createElement('a-entity'); g.setAttribute('position','0 0 0'); gameRoot.appendChild(g);
    g.appendChild(makePanel(2.0,1.0,'#ffffff',0));
    g.appendChild(makeText('แปรงฟันเสร็จเรียบร้อย! ✨',5,'#0b1220','center','0 0.35 0.02'));
    g.appendChild(makeText(`คะแนนรวม (รวมจากล้างมือถ้ามี): ${score}`,4,'#111','center','0 -0.05 0.02'));
    const next = makeButton('ทำควิซ ➜', 0.7, -0.35, '#f59e0b', '#111', startQuiz);
    const menu = makeButton('เมนูหลัก', -0.7, -0.35, '#111827', '#eaf2ff', showMenu);
    g.appendChild(next); g.appendChild(menu);
    setHUD(`แปรงฟันเสร็จ\nคะแนนรวม: ${score}`);
  }
}

const QUIZ = [
  { q:'ล้างมือที่ถูกต้องมีกี่ขั้น?', choices:['5','7','10'], a:1 },
  { q:'เวลาแปรงฟันอย่างน้อยกี่นาที?', choices:['1','2','3'], a:1 },
  { q:'ข้อใด “ควรกินน้อย” เพื่อสุขภาพฟัน?', choices:['ผัก','ผลไม้','น้ำอัดลม'], a:2 },
];

function startQuiz(){
  state = STATE.QUIZ;
  clearNode(gameRoot);
  quizIndex = 0; quizScore = 0;

  const root=document.createElement('a-entity'); root.setAttribute('position','0 0 0'); gameRoot.appendChild(root);
  root.appendChild(makePanel(2.2,1.3,'#ffffff',0));
  const title=makeText('Mini-Quiz (3 ข้อ)',5.2,'#0b1220','center','0 0.6 0.02'); root.appendChild(title);

  const qText = makeText('',5.0,'#111','center','0 0.2 0.02'); root.appendChild(qText);
  const slots = [
    makeButton('',  -0.8, -0.20, '#111827', '#eaf2ff', ()=>pick(0)),
    makeButton('',   0.0, -0.20, '#111827', '#eaf2ff', ()=>pick(1)),
    makeButton('',   0.8, -0.20, '#111827', '#eaf2ff', ()=>pick(2)),
  ];
  slots.forEach(s=>root.appendChild(s));

  const next = makeButton('ข้อต่อไป ➜', 0.7, -0.55, '#0ea5e9', '#fff', ()=>{
    quizIndex++; if(quizIndex>=QUIZ.length){ finishQuiz(); } else render(); 
  });
  const skip = makeButton('เมนูหลัก', -0.7, -0.55, '#e5e7eb', '#111', showMenu);
  root.appendChild(next); root.appendChild(skip);

  function render(){
    const item = QUIZ[quizIndex];
    qText.setAttribute('text',`value:ข้อ ${quizIndex+1}/3: ${item.q}; width:5.0; align:center; color:#111`);
    for(let i=0;i<3;i++){
      const label = item.choices[i];
      slots[i].children[1].setAttribute('text',`value:${label}; width:2.4; align:center; color:#eaf2ff`);
      slots[i].children[0].setAttribute('material','color:#111827; shader:flat; opacity:0.96');
    }
    setHUD(`Quiz ข้อ ${quizIndex+1}/3\nคะแนนควิซ: ${quizScore} (รวม: ${score+quizScore})`);
  }
  function pick(i){
    const item = QUIZ[quizIndex];
    const correct = (i === item.a);
    if(correct){ quizScore += 5; ping(1200,0.05,0.15); }
    else { ping(280,0.08,0.2); }
    for(let k=0;k<3;k++){
      const mat = (k===item.a)?'#16a34a':'#ef4444';
      slots[k].children[0].setAttribute('material',`color:${mat}; shader:flat; opacity:0.96`);
    }
    setHUD(`ตอบ${correct?'ถูก ✅':'ผิด ❌'} | คะแนนควิซ: ${quizScore} (รวม: ${score+quizScore})`);
  }
  function finishQuiz(){ score += quizScore; showSummary(); }

  render();
}

function showSummary(){
  state = STATE.SUMMARY;
  clearNode(gameRoot);
  const root=document.createElement('a-entity'); root.setAttribute('position','0 0 0'); gameRoot.appendChild(root);
  root.appendChild(makePanel(2.0,1.0,'#ffffff',0));
  root.appendChild(makeText('สรุปผลการฝึก Hygiene VR',5,'#0b1220','center','0 0.35 0.02'));
  root.appendChild(makeText(`คะแนนรวม: ${score}`,4,'#111','center','0 -0.05 0.02'));

  let stars = 1; if(score>=35) stars=3; else if(score>=25) stars=2;
  root.appendChild(makeText(`รางวัล: ${'⭐'.repeat(stars)}${'☆'.repeat(3-stars)}`,4,'#111','center','0 -0.25 0.02'));

  const again = makeButton('เล่นอีกครั้ง', -0.7, -0.45, '#79a8ff', '#001', ()=>showMenu());
  const exit  = makeButton('จบการฝึก', 0.7, -0.45, '#e5e7eb', '#111', ()=>showMenu());
  root.appendChild(again); root.appendChild(exit);
  setHUD(`สรุปผล\nคะแนนรวม: ${score}\nดาว: ${stars}/3`);
}

// --------- Global Buttons ---------
btn.menu.onclick = showMenu;
btn.start.onclick = ()=>{ // เริ่มที่เมนูถ้ายังอยู่หน้าอื่น
  if(state===STATE.MENU) startHand(); else showMenu();
};
btn.reset.onclick = ()=>{ if(timerId){ clearInterval(timerId); timerId=null; } score=0; lives=3; showMenu(); };

// Boot
showMenu();
