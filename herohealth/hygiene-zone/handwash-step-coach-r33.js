(()=>{
'use strict';
const VERSION='20260729-HANDWASH-STEP-COACH-R33';
const ORDER=['wet','soap','palm','dorsum','interlaced','backsFingers','thumbs','fingertips','wrists','rinse','dry','towelFaucet'];
const GUIDE={
 ready:['🧼','เตรียมเริ่ม','กดเริ่มเกม',['แตะปุ่มเริ่ม WHO Technique','อนุญาตให้ใช้กล้อง','ยืนให้เห็นมือและลำตัวช่วงบน']],
 calibrate:['📷','Calibration','ยกมือ 2 ข้างให้อยู่กลางกรอบ',['หันฝ่ามือเข้าหากล้อง','แยกมือไม่ให้บังกัน','ค้างให้นิ่งจนเห็นครบ 2 มือ']],
 wet:['💧','เปียกมือ','เปิดน้ำ → นำมือเข้ากรอบก๊อก',['แตะปุ่ม เปิดน้ำ','นำมือทั้งสองข้างใต้สายน้ำ','ค้างจนแถบความคืบหน้าเต็ม']],
 soap:['🧴','ใช้สบู่','นำมือเข้ากรอบสบู่',['ปิดน้ำก่อนใช้สบู่','เลื่อนมือไปกรอบ SOAP','ถูให้เกิดฟองทั่วมือ']],
 palm:['🖐️','ฝ่ามือ','ถูฝ่ามือไป–กลับ',['ประกบฝ่ามือเข้าหากัน','ถูไป–กลับระยะสั้น','ทำต่อเนื่องจนขึ้นสีเขียว']],
 dorsum:['🤚','หลังมือและซอกนิ้ว','ฝ่ามือถูหลังมือ แล้วสลับข้าง',['วางฝ่ามือขวาบนหลังมือซ้าย','สอดนิ้วเข้าซอกและถู','สลับทำอีกข้างให้ครบ']],
 interlaced:['👐','ฝ่ามือประสานนิ้ว','ประกบฝ่ามือและสอดนิ้ว',['ประกบฝ่ามือทั้งสอง','ประสานนิ้วเข้าหากัน','ถูไป–กลับให้ถึงซอกนิ้ว']],
 backsFingers:['✊','หลังนิ้ว','หลังนิ้วถูฝ่ามืออีกข้าง',['งอนิ้วและเกี่ยวเข้าหากัน','วางหลังนิ้วบนฝ่ามือ','ถูไป–กลับช้า ๆ']],
 thumbs:['👍','หัวแม่มือ','กำรอบหัวแม่มือและหมุน',['กำรอบหัวแม่มืออีกข้าง','หมุนถูเป็นวงเล็ก ๆ','สลับหัวแม่มืออีกข้าง']],
 fingertips:['💅','ปลายนิ้วและเล็บ','ปลายนิ้วหมุนบนฝ่ามือ',['จีบปลายนิ้วเข้าหากัน','แตะกลางฝ่ามืออีกข้าง','หมุนถูแล้วสลับมือ']],
 wrists:['⌚','รอบข้อมือ','กำรอบข้อมือและหมุน',['กำรอบข้อมืออีกข้าง','หมุนถูรอบข้อมือ','สลับทำอีกข้าง']],
 rinse:['🚿','ล้างน้ำ','เปิดน้ำและล้างฟองออก',['แตะเปิดน้ำ','นำมือสองข้างใต้สายน้ำ','ล้างจนฟองลดและแถบเต็ม']],
 dry:['🧻','เช็ดมือให้แห้ง','นำมือเข้ากรอบกระดาษ',['ไปที่ SINGLE-USE TOWEL','หยิบกระดาษเช็ดมือให้ทั่ว','เก็บกระดาษไว้ปิดก๊อก']],
 towelFaucet:['🚰','ปิดก๊อกด้วยกระดาษ','ถือกระดาษแตะกรอบก๊อก',['ถือกระดาษที่ใช้เช็ดมือ','เลื่อนไปกรอบ FAUCET','ใช้กระดาษปิดก๊อก']]
};
const $=id=>document.getElementById(id);
const num=value=>{const m=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0};
let installed=false,lastSignature='',lastPhase='',lastCorrect=false,lastPassed='';

function addStyle(){
 if($('hhStepCoachStyleR33'))return;
 const s=document.createElement('style');s.id='hhStepCoachStyleR33';s.textContent=`
 #hhStepCoachR33{display:grid;gap:5px;text-align:left;color:#effbff}#hhStepCoachR33 *{box-sizing:border-box}
 .h33-head{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:6px;align-items:center}.h33-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(145deg,#e8fbff,#fff1a8);font-size:22px;color:#071827}.h33-kicker{color:#57dfff;font-size:8px;font-weight:1000}.h33-title{font-size:14px;font-weight:1000;line-height:1.15}.h33-progress{min-width:43px;padding:5px 6px;border-radius:999px;background:rgba(255,255,255,.11);font-size:10px;font-weight:1000;text-align:center}
 .h33-motion{padding:5px 7px;border-radius:9px;background:rgba(87,223,255,.11);font-size:10px;font-weight:1000;text-align:center}.h33-method{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}.h33-method span{padding:4px;border-radius:8px;background:rgba(255,255,255,.06);font-size:8px;font-weight:850;line-height:1.25;text-align:center}.h33-method b{color:#ffe27b}
 .h33-status{min-height:35px;display:grid;place-items:center;padding:6px 8px;border:2px solid rgba(132,226,255,.45);border-radius:11px;background:rgba(3,44,65,.86);color:#e7fbff;font-size:11px;font-weight:1000;text-align:center;line-height:1.3}.h33-status.correct{border-color:#67eda9;background:rgba(5,91,59,.92);color:#edfff6;box-shadow:0 0 0 3px rgba(103,237,169,.14)}.h33-status.problem{border-color:#ff9bad;background:rgba(105,23,39,.88);color:#fff0f3}
 .h33-bar{height:6px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12)}.h33-bar i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#57dfff,#67eda9);transition:width .2s}
 #coachText.h33-native,.coach .chips.h33-native{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;opacity:0!important;pointer-events:none!important}
 #hhStepToastR33{position:fixed;z-index:2147483000;left:50%;top:48%;transform:translate(-50%,-50%) scale(.92);width:min(88vw,420px);padding:17px;border:2px solid #9ff4c9;border-radius:20px;background:rgba(4,105,68,.97);color:#fff;text-align:center;font:1000 20px/1.3 system-ui,sans-serif;box-shadow:0 20px 70px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:.18s}#hhStepToastR33.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
 @media(max-width:760px){.coach{max-height:none!important;overflow:visible!important;padding:7px!important}}@media(max-width:390px){.h33-method span{font-size:7.4px}.h33-title{font-size:13px}}
 `;document.head.appendChild(s);
}
function install(){
 if(installed)return true;
 const coach=document.querySelector('.coach'),native=$('coachText'),chips=coach?.querySelector('.chips');if(!coach||!native)return false;
 addStyle();const panel=document.createElement('section');panel.id='hhStepCoachR33';panel.setAttribute('aria-live','polite');panel.innerHTML=`<div class="h33-head"><div id="h33Icon" class="h33-icon">📷</div><div><div id="h33Kicker" class="h33-kicker">ขั้นตอนปัจจุบัน</div><div id="h33Title" class="h33-title">กำลังเตรียมคำแนะนำ</div></div><div id="h33Progress" class="h33-progress">0%</div></div><div id="h33Motion" class="h33-motion">รอระบบเกม</div><div id="h33Method" class="h33-method"></div><div id="h33Status" class="h33-status">กำลังตรวจมือและการเคลื่อนไหว</div><div class="h33-bar"><i id="h33Bar"></i></div>`;coach.insertBefore(panel,coach.firstChild);native.classList.add('h33-native');chips?.classList.add('h33-native');const toast=document.createElement('div');toast.id='hhStepToastR33';toast.textContent='✓ ทำถูกแล้ว';document.body.appendChild(toast);installed=true;return true;
}
function phase(){return document.documentElement.dataset.handwashPhase||($('startOverlay')?.classList.contains('show')?'ready':'calibrate')}
function hands(){return num($('chipHands')?.textContent)}function pct(){return Math.max(0,Math.min(100,num($('evidenceText')?.textContent)))}function good(id){return $(id)?.classList.contains('good')===true}function water(){return /ปิดน้ำ/.test($('faucetBtn')?.textContent||'')}
function done(id){return document.querySelector(`.phase-chip[data-phase="${id}"]`)?.classList.contains('done')===true}
function result(p,progress,count){
 if(p==='ready')return['','แตะปุ่มเริ่มเกมเพื่อเปิดกล้องและเริ่ม Calibration',false];
 if(p==='calibrate')return count>=2?['correct','✓ ทำถูกแล้ว • เห็นมือครบ 2 ข้าง ค้างให้นิ่งอีกนิด',true]:count===1?['problem','เห็น 1 มือ • แยกมือและยกอีกข้างเข้ากลางกรอบ',false]:['','ยกมือสองข้างให้เห็นเต็มเฟรมและอยู่กลางกรอบ',false];
 if(['wet','rinse'].includes(p)&&!water())return['problem','แตะ “เปิดน้ำ” แล้วนำมือเข้ากรอบก๊อก',false];
 if(['wet','soap','rinse','dry','towelFaucet'].includes(p)){
  if(progress>=88)return['correct',`✓ ทำถูกแล้ว • ${progress}% ค้างต่ออีกนิด`,true];
  if(progress>0)return['',`กำลังถูกทาง • ${progress}% ทำต่อจนเต็ม`,false];
  return['',{wet:'นำมือสองข้างใต้กรอบน้ำ',soap:'นำมือไปกรอบ SOAP และถูให้เกิดฟอง',rinse:'ล้างฟองใต้กรอบน้ำ',dry:'นำมือไปกรอบกระดาษ',towelFaucet:'ถือกระดาษแตะกรอบก๊อก'}[p],false];
 }
 const c=[count>=2,good('chipContact'),good('chipPose'),good('chipMotion')];if(c.every(Boolean))return['correct',`✓ ทำถูกแล้ว • ท่ามือและการเคลื่อนไหวถูกต้อง ${progress}%`,true];const missing=[];if(!c[0])missing.push('ให้เห็นมือ 2 ข้าง');if(!c[1])missing.push('ให้มือสัมผัสกัน');if(!c[2])missing.push('จัดรูปมือให้ตรง');if(!c[3])missing.push('ขยับต่อเนื่อง');return[missing.length>=3?'problem':'',(progress?`กำลังได้ ${progress}% • `:'')+missing.slice(0,2).join(' • '),false];
}
function toast(text){const t=$('hhStepToastR33');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1050);try{navigator.vibrate?.([55,35,75])}catch(_){}}
function update(){
 if(!install())return;const p=phase(),progress=pct(),count=hands(),flags=[good('chipContact'),good('chipPose'),good('chipMotion'),water()].join(''),signature=[p,progress,count,flags].join('|');if(signature===lastSignature)return;lastSignature=signature;
 const g=GUIDE[p]||GUIDE.ready,idx=ORDER.indexOf(p),r=result(p,progress,count);$('h33Icon').textContent=g[0];$('h33Kicker').textContent=idx>=0?`ขั้น ${idx+1}/12 • ตรวจแบบทันที`:'เตรียมเริ่มภารกิจ';$('h33Title').textContent=g[1];$('h33Motion').textContent='วิธีทำ: '+g[2];$('h33Method').innerHTML=g[3].map((x,i)=>`<span><b>${i+1}</b> ${x}</span>`).join('');$('h33Progress').textContent=p==='calibrate'?`${count}/2 มือ`:`${progress}%`;$('h33Bar').style.width=`${p==='calibrate'?Math.min(100,count*50):progress}%`;const status=$('h33Status');status.className='h33-status '+r[0];status.textContent=r[1];
 if(r[2]&&!lastCorrect)toast('✓ ทำถูกแล้ว • ทำต่ออีกนิด');if(lastPhase&&p!==lastPhase){if(done(lastPhase)&&lastPassed!==lastPhase){lastPassed=lastPhase;toast(`✓ ผ่านขั้น ${(GUIDE[lastPhase]||[])[1]||lastPhase} แล้ว`)}setTimeout(()=>document.querySelector('.phase-chip.active')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}),60)}lastCorrect=r[2];lastPhase=p;document.documentElement.dataset.handwashLiveCorrect=r[2]?'true':'false';
}
function boot(){install();update();setInterval(update,220);document.documentElement.dataset.handwashStepCoach=VERSION}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();