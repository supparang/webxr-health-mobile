(()=>{
'use strict';
const VERSION='20260729-HANDWASH-STEP-COACH-R32';
const ORDER=['wet','soap','palm','dorsum','interlaced','backsFingers','thumbs','fingertips','wrists','rinse','dry','towelFaucet'];
const GUIDE={
 ready:{icon:'🧼',label:'เตรียมเริ่ม',motion:'กดเริ่มเกม',steps:['แตะปุ่มเริ่ม WHO Technique','อนุญาตให้ใช้กล้อง','ยืนให้เห็นมือและลำตัวช่วงบน']},
 calibrate:{icon:'📷',label:'Calibration',motion:'ยกมือ 2 ข้างให้อยู่กลางกรอบ',steps:['หันฝ่ามือเข้าหากล้อง','แยกมือไม่ให้บังกัน','ค้างให้นิ่งจนระบบเห็นครบ 2 มือ']},
 wet:{icon:'💧',label:'เปียกมือ',motion:'เปิดน้ำ → นำมือเข้ากรอบก๊อก',steps:['แตะปุ่ม เปิดน้ำ','นำมือทั้งสองข้างใต้สายน้ำ','ค้างไว้จนแถบความคืบหน้าเต็ม']},
 soap:{icon:'🧴',label:'ใช้สบู่',motion:'นำมือเข้ากรอบสบู่',steps:['ปิดน้ำก่อนใช้สบู่','เลื่อนมือไปยังกรอบ SOAP','ถูให้เกิดฟองและครอบคลุมมือ']},
 palm:{icon:'🖐️',label:'ฝ่ามือ',motion:'ถูฝ่ามือไป–กลับ',steps:['ประกบฝ่ามือเข้าหากัน','ถูไป–กลับระยะสั้น','ทำต่อเนื่องจนระบบขึ้นสีเขียว']},
 dorsum:{icon:'🤚',label:'หลังมือและซอกนิ้ว',motion:'ฝ่ามือถูหลังมือ แล้วสลับข้าง',steps:['วางฝ่ามือขวาบนหลังมือซ้าย','สอดนิ้วเข้าซอกและถูไป–กลับ','สลับทำอีกข้างให้ครบ']},
 interlaced:{icon:'👐',label:'ฝ่ามือประสานนิ้ว',motion:'ประกบฝ่ามือและสอดนิ้ว',steps:['ประกบฝ่ามือทั้งสอง','ประสานนิ้วเข้าหากัน','ถูไป–กลับให้ถึงซอกนิ้ว']},
 backsFingers:{icon:'✊',label:'หลังนิ้ว',motion:'หลังนิ้วถูฝ่ามืออีกข้าง',steps:['งอนิ้วและเกี่ยวเข้าหากัน','วางหลังนิ้วบนฝ่ามืออีกข้าง','ถูไป–กลับช้า ๆ ต่อเนื่อง']},
 thumbs:{icon:'👍',label:'หัวแม่มือ',motion:'กำรอบหัวแม่มือและหมุน',steps:['ใช้มือหนึ่งกำรอบหัวแม่มืออีกข้าง','หมุนถูเป็นวงเล็ก ๆ','สลับหัวแม่มืออีกข้าง']},
 fingertips:{icon:'💅',label:'ปลายนิ้วและเล็บ',motion:'ปลายนิ้วหมุนบนฝ่ามือ',steps:['จีบปลายนิ้วเข้าหากัน','แตะปลายนิ้วกลางฝ่ามืออีกข้าง','หมุนถูแล้วสลับมือ']},
 wrists:{icon:'⌚',label:'รอบข้อมือ',motion:'กำรอบข้อมือและหมุน',steps:['ใช้มือหนึ่งกำรอบข้อมืออีกข้าง','หมุนถูรอบข้อมือให้ทั่ว','สลับทำข้อมืออีกข้าง']},
 rinse:{icon:'🚿',label:'ล้างน้ำ',motion:'เปิดน้ำและล้างฟองออก',steps:['แตะเปิดน้ำ','นำมือสองข้างใต้สายน้ำ','ล้างจนฟองลดและแถบเต็ม']},
 dry:{icon:'🧻',label:'เช็ดมือให้แห้ง',motion:'นำมือเข้ากรอบกระดาษ',steps:['เลื่อนมือไปที่ SINGLE-USE TOWEL','หยิบกระดาษและเช็ดมือให้ทั่ว','เก็บกระดาษไว้สำหรับปิดก๊อก']},
 towelFaucet:{icon:'🚰',label:'ปิดก๊อกด้วยกระดาษ',motion:'ถือกระดาษแตะกรอบก๊อก',steps:['ถือกระดาษที่ใช้เช็ดมือ','เลื่อนไปยังกรอบ FAUCET / WATER','ใช้กระดาษปิดก๊อก ห้ามใช้มือเปล่า']}
};
const $=id=>document.getElementById(id);
const numberFrom=value=>{const match=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return match?Number(match[1]):0};
let installed=false,lastPhase='',lastCorrect=false,lastCompletedPhase='';

function installStyle(){
 if($('hhStepCoachStyleR32'))return;
 const style=document.createElement('style');style.id='hhStepCoachStyleR32';style.textContent=`
 #hhStepCoachR32{display:grid;gap:6px;text-align:left;color:#effbff}
 #hhStepCoachR32 *{box-sizing:border-box}
 .hh32-head{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:8px;align-items:center}
 .hh32-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#e8fbff,#fff1a8);font-size:25px;color:#071827}
 .hh32-kicker{color:#57dfff;font-size:9px;font-weight:1000;letter-spacing:.06em}
 .hh32-title{font-size:15px;font-weight:1000;line-height:1.2}
 .hh32-progress{min-width:45px;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.10);font-size:10px;font-weight:1000;text-align:center}
 .hh32-motion{padding:6px 8px;border-radius:10px;background:rgba(87,223,255,.10);color:#dff9ff;font-size:11px;font-weight:1000;text-align:center}
 .hh32-method{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
 .hh32-method span{min-width:0;padding:5px 6px;border-radius:9px;background:rgba(255,255,255,.055);font-size:9px;font-weight:850;line-height:1.25;text-align:center}
 .hh32-method b{color:#ffe27b}
 .hh32-status{min-height:39px;display:grid;place-items:center;padding:7px 9px;border:2px solid rgba(255,226,123,.52);border-radius:12px;background:rgba(83,57,4,.78);color:#fff4c4;font-size:12px;font-weight:1000;text-align:center;line-height:1.3;transition:.18s}
 .hh32-status.correct{border-color:#67eda9;background:rgba(5,91,59,.88);color:#edfff6;box-shadow:0 0 0 3px rgba(103,237,169,.14)}
 .hh32-status.wait{border-color:rgba(132,226,255,.45);background:rgba(3,44,65,.84);color:#e7fbff}
 .hh32-status.problem{border-color:#ff9bad;background:rgba(105,23,39,.84);color:#fff0f3}
 .hh32-bar{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12)}
 .hh32-bar i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#57dfff,#67eda9);transition:width .2s}
 #coachText.hh32-native,.coach .chips.hh32-native{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;opacity:0!important;pointer-events:none!important}
 #hhStepPassToastR32{position:fixed;z-index:2147483000;left:50%;top:48%;transform:translate(-50%,-50%) scale(.92);width:min(88vw,420px);padding:17px 19px;border:2px solid #9ff4c9;border-radius:20px;background:rgba(4,105,68,.96);color:#fff;text-align:center;font:1000 20px/1.3 system-ui,sans-serif;box-shadow:0 20px 70px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:.18s}
 #hhStepPassToastR32.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
 @media(max-width:760px){
  .coach{max-height:none!important;overflow:visible!important;padding:8px!important}
  .hh32-head{grid-template-columns:38px minmax(0,1fr) auto;gap:6px}.hh32-icon{width:38px;height:38px;font-size:22px}.hh32-title{font-size:14px}.hh32-motion{font-size:10px;padding:5px 7px}
  .hh32-method{gap:3px}.hh32-method span{font-size:8px;padding:4px}.hh32-status{min-height:35px;font-size:11px;padding:6px}
 }
 @media(max-width:390px){.hh32-method span{font-size:7.5px}.hh32-title{font-size:13px}}
 `;document.head.appendChild(style);
}

function install(){
 if(installed)return true;
 const coach=document.querySelector('.coach'),coachText=$('coachText'),chips=coach?.querySelector('.chips');
 if(!coach||!coachText)return false;
 installStyle();
 const panel=document.createElement('section');panel.id='hhStepCoachR32';panel.setAttribute('aria-live','polite');panel.innerHTML=`
  <div class="hh32-head"><div id="hh32Icon" class="hh32-icon">📷</div><div><div id="hh32Kicker" class="hh32-kicker">ขั้นตอนปัจจุบัน</div><div id="hh32Title" class="hh32-title">กำลังเตรียมคำแนะนำ</div></div><div id="hh32Progress" class="hh32-progress">0%</div></div>
  <div id="hh32Motion" class="hh32-motion">รอระบบเกม</div>
  <div id="hh32Method" class="hh32-method"></div>
  <div id="hh32Status" class="hh32-status wait">กำลังตรวจมือและการเคลื่อนไหว</div>
  <div class="hh32-bar"><i id="hh32Bar"></i></div>`;
 coach.insertBefore(panel,coach.firstChild);
 coachText.classList.add('hh32-native');chips?.classList.add('hh32-native');
 const toast=document.createElement('div');toast.id='hhStepPassToastR32';toast.textContent='✓ ทำถูกแล้ว';document.body.appendChild(toast);
 installed=true;return true;
}

function currentPhase(){return document.documentElement.dataset.handwashPhase||($('startOverlay')?.classList.contains('show')?'ready':'calibrate')}
function handCount(){return numberFrom($('chipHands')?.textContent||'0')}
function progress(){return Math.max(0,Math.min(100,numberFrom($('evidenceText')?.textContent||'0')))}
function isGood(id){return $(id)?.classList.contains('good')===true}
function waterOn(){return /ปิดน้ำ/.test($('faucetBtn')?.textContent||'')}
function activeChip(){return document.querySelector('.phase-chip.active')}
function doneFor(phase){return document.querySelector(`.phase-chip[data-phase="${phase}"]`)?.classList.contains('done')===true}

function evaluate(phase,pct){
 const hands=handCount();
 if(phase==='ready')return{state:'wait',correct:false,text:'แตะปุ่มเริ่มเกมเพื่อเปิดกล้องและเริ่ม Calibration'};
 if(phase==='calibrate'){
  if(hands>=2)return{state:'correct',correct:true,text:'✓ ทำถูกแล้ว • เห็นมือครบ 2 ข้าง ค้างให้นิ่งอีกนิด'};
  if(hands===1)return{state:'problem',correct:false,text:'เห็น 1 มือ • แยกมือและยกอีกข้างเข้ากลางกรอบ'};
  return{state:'wait',correct:false,text:'ยกมือสองข้างให้เห็นเต็มเฟรมและอยู่กลางกรอบ'};
 }
 if(['wet','rinse'].includes(phase)&&!waterOn())return{state:'problem',correct:false,text:'ขั้นแรกให้แตะ “เปิดน้ำ” แล้วนำมือเข้ากรอบก๊อก'};
 if(['wet','soap','rinse','dry','towelFaucet'].includes(phase)){
  if(pct>=88)return{state:'correct',correct:true,text:`✓ ทำถูกแล้ว • ความคืบหน้า ${pct}% ค้างต่ออีกนิด`};
  if(pct>0)return{state:'wait',correct:false,text:`กำลังถูกทาง • ความคืบหน้า ${pct}% ทำต่อจนเต็ม`};
  const map={wet:'นำมือสองข้างใต้กรอบน้ำ',soap:'นำมือไปกรอบ SOAP และถูให้เกิดฟอง',rinse:'นำมือสองข้างล้างฟองใต้กรอบน้ำ',dry:'นำมือไปกรอบกระดาษและเช็ดให้แห้ง',towelFaucet:'ถือกระดาษแล้วเลื่อนไปแตะกรอบก๊อก'};
  return{state:'wait',correct:false,text:map[phase]||'ทำตามขั้นตอนบนจอ'};
 }
 const checks={hands:hands>=2,contact:isGood('chipContact'),pose:isGood('chipPose'),motion:isGood('chipMotion')};
 if(checks.hands&&checks.contact&&checks.pose&&checks.motion){return{state:'correct',correct:true,text:`✓ ทำถูกแล้ว • ท่ามือและการเคลื่อนไหวถูกต้อง ${pct}%`};}
 const missing=[];if(!checks.hands)missing.push('ให้เห็นมือ 2 ข้าง');if(!checks.contact)missing.push('ให้มือสัมผัสกัน');if(!checks.pose)missing.push('จัดรูปมือให้ตรง');if(!checks.motion)missing.push('ขยับต่อเนื่อง');
 const prefix=pct>0?`กำลังได้ ${pct}% • `:'';
 return{state:missing.length>=3?'problem':'wait',correct:false,text:prefix+missing.slice(0,2).join(' • ')};
}

function showToast(text){
 const toast=$('hhStepPassToastR32');if(!toast)return;toast.textContent=text;toast.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1100);try{navigator.vibrate?.([55,35,75])}catch(_){}}

function update(){
 if(!install())return;
 const phase=currentPhase(),guide=GUIDE[phase]||GUIDE.ready,pct=progress(),idx=ORDER.indexOf(phase),result=evaluate(phase,pct);
 $('hh32Icon').textContent=guide.icon;
 $('hh32Kicker').textContent=idx>=0?`ขั้น ${idx+1}/12 • ระบบกำลังตรวจแบบทันที`:'เตรียมเริ่มภารกิจ';
 $('hh32Title').textContent=guide.label;
 $('hh32Motion').textContent='วิธีทำ: '+guide.motion;
 $('hh32Method').innerHTML=guide.steps.map((step,index)=>`<span><b>${index+1}</b> ${step}</span>`).join('');
 $('hh32Progress').textContent=phase==='calibrate'?`${handCount()}/2 มือ`:`${pct}%`;
 $('hh32Bar').style.width=`${phase==='calibrate'?Math.min(100,handCount()*50):pct}%`;
 const status=$('hh32Status');status.className='hh32-status '+result.state;status.textContent=result.text;
 if(result.correct&&!lastCorrect)showToast('✓ ทำถูกแล้ว • ทำต่ออีกนิด');
 if(lastPhase&&phase!==lastPhase){
  if(doneFor(lastPhase)&&lastCompletedPhase!==lastPhase){lastCompletedPhase=lastPhase;const old=GUIDE[lastPhase];showToast(`✓ ผ่านขั้น ${old?.label||lastPhase} แล้ว`);}
  setTimeout(()=>activeChip()?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}),80);
 }
 lastCorrect=result.correct;lastPhase=phase;
 document.documentElement.dataset.handwashLiveCorrect=result.correct?'true':'false';
}

const boot=()=>{install();update();setInterval(update,260);new MutationObserver(update).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-handwash-phase']});document.documentElement.dataset.handwashStepCoach=VERSION;};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();