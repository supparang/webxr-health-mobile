<script type="module">
/* ---------- UI Controller for HeroHealth ---------- */
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const body = document.body;
const btnStart   = $('#btn_start');
const btnPause   = $('#btn_pause');
const btnRestart = $('#btn_restart');
const btnHelp    = $('#btn_help');
const helpModal  = $('#help');
const helpBody   = $('#helpBody');
const resultModal= $('#result');
const coachHUD   = $('#coachHUD');
const coachText  = $('#coachText');
const menuBar    = $('#menuBar');

let langTH = true;
let soundOn = true;
let state = 'menu';    // 'menu' | 'demo' | 'playing' | 'paused' | 'result'

/* --------- integrate with main.js if present --------- */
const HHA = window.HHA ?? {
  startGame:  (opt={})=>console.log('HHA.startGame()', opt),
  pause:      ()=>console.log('HHA.pause()'),
  resume:     ()=>console.log('HHA.resume()'),
  restart:    ()=>console.log('HHA.restart()'),
  onEnd:      (cb)=>{ /* call cb() manually in this demo */ }
};

function setState(next){
  state = next;
  body.classList.remove('state-menu','state-demo','state-playing','state-paused','state-result');
  body.classList.add(`state-${next}`);
}

function fadeShow(el){ el.classList.remove('fade-leave','fade-hide'); el.classList.add('fade-enter'); el.style.display='flex'; requestAnimationFrame(()=>{ el.classList.add('fade-show'); }); }
function fadeHide(el){ el.classList.remove('fade-enter','fade-show'); el.classList.add('fade-leave'); el.classList.add('fade-hide'); el.addEventListener('transitionend', ()=>{ el.style.display='none'; el.classList.remove('fade-leave','fade-hide'); }, {once:true}); }

/* ---------- HOW TO PLAY (TH/EN) ---------- */
function getHelpText(){
  if(langTH) return `
การเล่นหลัก
• เป้าหมาย: เก็บ/หลบให้ถูกต้องตามโหมด
• คีย์บอร์ด: ↑ Jump, ↓ Duck, ←/→ Dash, Space = Jump, Ctrl = Duck
• เมาส์: คลิกปุ่มเมนูทั้งหมดได้
• คะแนน: ทำคอมโบต่อเนื่องจะคูณคะแนนเพิ่ม
• Fever/SUPER FEVER: เก็บจังหวะดีๆ ให้ Fever เต็ม 100 จากนั้นรักษาสตรีค (≥5) จะเข้าสู่ SUPER FEVER ชั่วคราว
Power-Ups
• Shield กันพลาด 1 ครั้ง • Slow-Time ชะลอสิ่งกีดขวาง • Heal +Fever
วิธีเริ่ม
• เลือกโหมด/ความยาก → “เริ่มเกม” → จะมีเดโมสาธิตก่อนเริ่มจริง
`;
  return `
How to Play
• Goal: pick/avoid correctly per mode
• Keyboard: ↑ Jump, ↓ Duck, ←/→ Dash, Space = Jump, Ctrl = Duck
• Mouse: click all UI buttons
• Scoring: keep combo to raise multiplier
• Fever/SUPER FEVER: fill Fever to 100, keep streak (≥5) to enter SUPER FEVER
Power-Ups
• Shield prevents one miss • Slow-Time slows obstacles • Heal adds Fever
Start
• Choose Mode/Difficulty → Start → a short demo runs before real play.
`;
}

/* ---------- Demo / Tutorial ---------- */
async function runDemo(){
  setState('demo');
  showCoach(langTH? 'เดโมเริ่มใน 3…' : 'Demo starts in 3…');
  await wait(800);
  showCoach('2…'); await wait(700);
  showCoach('1…'); await wait(600);

  // ท่าตัวอย่าง 3 ขั้น (ข้อความ+เสียงโค้ช)
  await step(langTH? 'ลองกด ↑ เพื่อ Jump' : 'Press ↑ to Jump');
  await step(langTH? 'ลองกด ↓ เพื่อ Duck' : 'Press ↓ to Duck');
  await step(langTH? 'ลองกด ← หรือ → เพื่อ Dash' : 'Press ← or → to Dash');

  showCoach(langTH? 'เยี่ยม! เริ่มเกมจริง!' : 'Great! Starting real game!');
  await wait(600);

  // เริ่มเกมจริง
  setState('playing');
  hideHelp();   // กันซ้อน
  hideResult();
  HHA.startGame?.({ demoPassed: true });
}

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
async function step(text){
  showCoach(text);
  // รอให้ผู้เล่นกดปุ่มถูกต้องสักครั้ง หรือหมดเวลา 5 วินาที
  const ok = await waitForKey(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','s','a','d',' '], 5000);
  showCoach(ok ? (langTH?'ดีมาก!':'Nice!') : (langTH?'ไปต่อกัน':'Let\'s continue'));
  await wait(500);
}

function waitForKey(keys, timeout=5000){
  return new Promise((resolve)=>{
    let done = false;
    function onKey(e){
      if(done) return;
      if(keys.includes(e.key)){ done=true; window.removeEventListener('keydown',onKey); resolve(true); }
    }
    window.addEventListener('keydown', onKey);
    setTimeout(()=>{ if(!done){ window.removeEventListener('keydown',onKey); resolve(false);} }, timeout);
  });
}

function showCoach(msg){
  coachText.textContent = msg;
  coachHUD.classList.add('show');
}
function hideCoach(){ coachHUD.classList.remove('show'); }

/* ---------- Help modal ---------- */
function showHelp(){
  helpBody.textContent = getHelpText().trim();
  helpModal.style.display='flex';
}
function hideHelp(){ helpModal.style.display='none'; }

/* ---------- Result modal (call whenเกมจบ) ---------- */
function showResult(htmlCore=''){
  $('#resCore').innerHTML = htmlCore || '';
  resultModal.style.display='flex';
  setState('result');
}
function hideResult(){ resultModal.style.display='none'; }

/* ---------- Buttons ---------- */
btnHelp?.addEventListener('click', ()=> showHelp());
$('#btn_ok')?.addEventListener('click', ()=> hideHelp());

btnStart?.addEventListener('click', async ()=>{
  // โหมด: แสดง How to Play → เดโม → เริ่มเกมจริง
  showHelp();
  await wait(400);
  hideHelp();
  await runDemo();
});

btnPause?.addEventListener('click', ()=>{
  if(state==='playing'){ HHA.pause?.(); setState('paused'); showCoach(langTH? 'พักเกม' : 'Paused'); }
  else if(state==='paused'){ HHA.resume?.(); setState('playing'); hideCoach(); }
});

btnRestart?.addEventListener('click', ()=>{
  hideResult(); hideHelp(); hideCoach(); setState('menu'); HHA.restart?.();
});

/* ปุ่มสรุปผล */
$('#btn_replay')?.addEventListener('click', ()=>{
  hideResult(); setState('menu');
});
$('#btn_home')?.addEventListener('click', ()=>{
  hideResult(); setState('menu');
});

/* ---------- Mouse mapping (ยังใช้คีย์บอร์ดได้เหมือนเดิม) ---------- */
window.addEventListener('mousedown', (e)=>{
  if(state!=='playing') return;
  if(e.button===0){ dispatchKey('ArrowUp'); }      // left click = Jump
  if(e.button===2){ dispatchKey('ArrowDown'); }    // right click = Duck
});
window.addEventListener('contextmenu', (e)=>{ if(state==='playing') e.preventDefault(); });
window.addEventListener('wheel', (e)=>{
  if(state!=='playing') return;
  if(e.deltaY<0) dispatchKey('ArrowLeft'); else dispatchKey('ArrowRight'); // scroll = Dash
});
function dispatchKey(key){
  const ev = new KeyboardEvent('keydown', {key});
  window.dispatchEvent(ev);
}

/* ---------- Hook: จบเกมจาก main.js ---------- */
HHA.onEnd?.((summaryHTML)=>{
  // ให้ main.js เรียก HHA.onEnd(cb) แล้วยิง cb(html)
  showResult(summaryHTML || '');
  hideCoach();
});

/* ---------- Initial ---------- */
setState('menu');
</script>
