(()=>{'use strict';
if(window.__JUMPDUCK_RESULT_FINAL_V63__)return;
window.__JUMPDUCK_RESULT_FINAL_V63__=true;

const result=document.getElementById('result');
if(!result)return;
const reducedMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let decorated=false,saveConfirmed=false,normalizingSync=false;

function addStyles(){
 if(document.getElementById('jdResultFinalV63Style'))return;
 const style=document.createElement('style');
 style.id='jdResultFinalV63Style';
 style.textContent=`
 #result .card.jd-result-ready{position:relative;border-color:#fbbf24;box-shadow:0 24px 60px #0004,0 0 0 8px #fef3c766,0 0 42px #fbbf2444}
 #result .jd-rank-wrap{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-top:2px}
 #result .jd-rank-label{font-size:16px;font-weight:1000;color:#64748b}
 #result h1.jd-result-title{max-width:100%;text-wrap:balance}
 #result h1.jd-result-title.long{font-size:clamp(25px,4.4vw,38px);line-height:1.08}
 #result .jd-achievements{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:12px 0 6px}
 #result .jd-achievement{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border-radius:999px;background:#fffbeb;border:2px solid #fcd34d;color:#92400e;font-size:12px;font-weight:1000;box-shadow:0 4px 12px #92400e14}
 #result .jd-save-state{margin:10px 0 4px;padding:10px 12px;border-radius:16px;background:#ecfdf5;border:2px solid #6ee7b7;color:#047857;font-weight:1000;line-height:1.45;white-space:pre-line}
 #result .jd-save-state.pending{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
 #result .logo.jd-trophy-pop{animation:jdTrophyPop .75s cubic-bezier(.2,.9,.2,1.2)}
 @keyframes jdTrophyPop{0%{transform:scale(.45) rotate(-12deg);opacity:.2}55%{transform:scale(1.18) rotate(6deg);opacity:1}100%{transform:scale(1) rotate(0)}}
 #jdResultConfettiV63{position:fixed;inset:0;z-index:120;pointer-events:none}
 @media(max-width:640px){#result .jd-achievements{gap:6px;margin:9px 0 4px}#result .jd-achievement{font-size:11px;padding:6px 8px}#result .jd-save-state{font-size:13px;padding:9px 10px}#result h1.jd-result-title.long{font-size:25px}}
 `;
 document.head.appendChild(style);
}

function payload(){
 return window.__JUMPDUCK_LAST_RESULT__||(()=>{
  try{return JSON.parse(localStorage.getItem('HHA_JUMPDUCK_LAST_RESULT')||'{}')}catch(_){return{}}
 })();
}

function rankValue(){
 return String(document.getElementById('rank')?.textContent||'').replace(/^ระดับ\s*/,'').trim().toUpperCase();
}

function setStatLabels(){
 const labels=['คะแนน','ความแม่นยำ','คอมโบสูงสุด','เหรียญสุขภาพ','จังหวะยอดเยี่ยม','การเคลื่อนไหว'];
 [...result.querySelectorAll('.stat')].forEach((el,index)=>{
  const value=el.querySelector('b');
  if(!value||!labels[index])return;
  [...el.childNodes].filter(node=>node!==value).forEach(node=>node.remove());
  el.insertBefore(document.createTextNode(labels[index]),value);
 });
}

function setRankLabel(){
 const rank=document.getElementById('rank');
 if(!rank)return;
 rank.textContent=String(rank.textContent||'').replace(/^ระดับ\s*/,'').trim();
 if(rank.parentElement?.classList.contains('jd-rank-wrap'))return;
 const wrap=document.createElement('div');
 wrap.className='jd-rank-wrap';
 const label=document.createElement('span');
 label.className='jd-rank-label';
 label.textContent='ระดับ';
 rank.parentNode.insertBefore(wrap,rank);
 wrap.append(label,rank);
}

function setResultHeading(p){
 const heading=result.querySelector('h1');
 if(!heading)return;
 const mission=Number(p.missionReached||0),rank=rankValue();
 let text='เล่นจบรอบแล้ว ฝึกต่ออีกนิดนะ';
 if(mission>=3){
  if(['SS','S','A'].includes(rank))text='Healthy Hero!';
  else if(rank==='B')text='เยี่ยมมาก!';
  else text='ทำได้ดี ลองพัฒนาต่ออีกนิด';
 }else if(mission===2){
  text='เก่งมาก! เหลืออีกนิดเดียว';
 }
 heading.textContent=text;
 heading.className='jd-result-title'+(text.length>18?' long':'');
}

function setResultSummary(p){
 const el=document.getElementById('resultText');
 if(!el)return;
 const parts=[
  `สำเร็จ ${Number(p.successfulEvents||0)}/${Number(p.resolvedEvents||0)}`,
  `พลาด ${Number(p.missCount||0)}`,
  `ภารกิจ ${Number(p.missionReached||0)}/3`
 ];
 if(Number(p.avgReactionMs||0)>0)parts.push(`ตอบสนองเฉลี่ย ${Math.round(Number(p.avgReactionMs))} ms`);
 el.textContent=parts.join(' • ');
}

function addAchievements(p){
 result.querySelector('.jd-achievements')?.remove();
 const badges=[];
 if(Number(p.accuracy||0)>=100)badges.push('🎯 ความแม่นยำ 100%');
 if(Number(p.missCount||0)===0)badges.push('🏅 ไม่พลาดเลย');
 if(Number(p.maxCombo||0)>=15)badges.push('🔥 คอมโบมาสเตอร์');
 if(Number(p.missionReached||0)>=3)badges.push('⭐ ภารกิจครบ 3/3');
 if(!badges.length)badges.push('💪 เล่นจบรอบสำเร็จ');
 const box=document.createElement('div');
 box.className='jd-achievements';
 box.setAttribute('aria-label','เหรียญความสำเร็จ');
 badges.slice(0,4).forEach(text=>{
  const chip=document.createElement('span');
  chip.className='jd-achievement';chip.textContent=text;box.appendChild(chip);
 });
 document.getElementById('resultText')?.insertAdjacentElement('afterend',box);
}

function saveStateText(confirmed){
 return confirmed
  ?'✅ บันทึกผลการเล่นสำเร็จ\nกด “กลับ Passport” เพื่อดูสถานะและภารกิจถัดไป'
  :'✅ เล่นครบ 1 รอบแล้ว\nกำลังส่งผลกลับ Passport…';
}

function updateSaveState(confirmed=false){
 const sync=document.getElementById('syncText');
 if(!sync)return;
 normalizingSync=true;
 sync.className='jd-save-state'+(confirmed?'':' pending');
 sync.textContent=saveStateText(confirmed);
 normalizingSync=false;
 if(!confirmed){
  setTimeout(()=>{
   if(saveConfirmed||result.classList.contains('hidden'))return;
   normalizingSync=true;
   sync.className='jd-save-state';
   sync.textContent='✅ เล่นครบ 1 รอบแล้ว\nกด “กลับ Passport” เพื่อตรวจสถานะอย่างเป็นทางการ';
   normalizingSync=false;
  },2200);
 }
}

function animateScore(p){
 if(reducedMotion)return;
 const el=document.getElementById('finalScore'),target=Math.max(0,Number(p.score||0));
 if(!el||!target)return;
 const started=performance.now(),duration=720;
 const tick=now=>{
  const t=Math.min(1,(now-started)/duration),eased=1-Math.pow(1-t,3);
  el.textContent=String(Math.round(target*eased));
  if(t<1)requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
}

function launchConfetti(p){
 const rank=rankValue();
 if(reducedMotion||Number(p.missionReached||0)<3||!['SS','S','A'].includes(rank)||document.getElementById('jdResultConfettiV63'))return;
 const canvas=document.createElement('canvas');
 canvas.id='jdResultConfettiV63';document.body.appendChild(canvas);
 const c=canvas.getContext('2d');if(!c){canvas.remove();return}
 const d=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;
 canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);canvas.style.width=w+'px';canvas.style.height=h+'px';c.setTransform(d,0,0,d,0,0);
 const symbols=['⭐','✨','🎉','💛'];
 const pieces=Array.from({length:38},()=>({x:Math.random()*w,y:-20-Math.random()*h*.25,vx:(Math.random()-.5)*90,vy:110+Math.random()*150,r:Math.random()*6.28,vr:(Math.random()-.5)*5,s:14+Math.random()*13,a:1,symbol:symbols[Math.floor(Math.random()*symbols.length)]}));
 const started=performance.now();
 const frame=now=>{
  const dt=.016;c.clearRect(0,0,w,h);
  for(const piece of pieces){
   piece.x+=piece.vx*dt;piece.y+=piece.vy*dt;piece.vy+=45*dt;piece.r+=piece.vr*dt;piece.a=Math.max(0,1-(now-started-650)/650);
   c.save();c.globalAlpha=piece.a;c.translate(piece.x,piece.y);c.rotate(piece.r);c.font=piece.s+'px serif';c.textAlign='center';c.fillText(piece.symbol,0,0);c.restore();
  }
  if(now-started<1350)requestAnimationFrame(frame);else canvas.remove();
 };
 requestAnimationFrame(frame);
}

function decorate(){
 if(decorated||result.classList.contains('hidden'))return;
 decorated=true;addStyles();
 const p=payload();
 setStatLabels();setRankLabel();setResultHeading(p);setResultSummary(p);addAchievements(p);updateSaveState(false);animateScore(p);launchConfetti(p);
 result.querySelector('.card')?.classList.add('jd-result-ready');
 result.querySelector('.logo')?.classList.add('jd-trophy-pop');
 const note=result.querySelector('.result-note');
 if(note)note.textContent='ผลอย่างเป็นทางการและการปลดล็อกภารกิจถัดไปยึดตาม Google Sheet';
}

new MutationObserver(()=>requestAnimationFrame(decorate)).observe(result,{attributes:true,attributeFilter:['class']});
const sync=document.getElementById('syncText');
if(sync){
 new MutationObserver(()=>{
  if(normalizingSync||result.classList.contains('hidden'))return;
  requestAnimationFrame(()=>updateSaveState(saveConfirmed));
 }).observe(sync,{childList:true,characterData:true,subtree:true});
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin)return;
 const data=event.data||{},type=String(data.type||data.action||'').toLowerCase();
 const relevant=type.includes('jumpduck')||type.includes('game_result')||type.includes('herohealth');
 const confirmed=data.success===true||data.saved===true||data.synced===true||/(saved|synced|submit_success|result_ack)/.test(type);
 if(relevant&&confirmed){saveConfirmed=true;updateSaveState(true)}
});
if(!result.classList.contains('hidden'))decorate();
})();
