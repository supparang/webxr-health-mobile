(()=>{
'use strict';
const VERSION='20260814-NEXT-MISSION-RESEARCH-SYNC-R1';
const KEY='herohealth_learning_platform_rc2';
const R=window.HHRotation;
if(!R)return;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function labelFor(step){if(!step)return'ดูผลสำเร็จ';const map={pretest:'แบบทดสอบก่อนเริ่มภารกิจ',posttest:'แบบทดสอบหลังจบภารกิจ',postExperience:'แบบประเมินประสบการณ์หลังเล่น',reflection:'สะท้อนการเรียนรู้'};return map[step.id]||step.label||'ภารกิจถัดไป'}
function buttonFor(step){if(!step)return{label:'ดูผลสำเร็จ',run:()=>window.HH?.openRoute?.('certificate')};if(step.type==='game')return{label:'เริ่มภารกิจถัดไป',run:()=>window.HH?.openNextGame?.(step.zoneId)};const map={pretest:['เริ่มแบบทดสอบก่อนภารกิจ','pretest'],posttest:['เริ่มแบบทดสอบหลังภารกิจ','posttest'],postExperience:['เริ่มแบบประเมินหลังเล่น','postexperience'],reflection:['เริ่มสะท้อนการเรียนรู้','reflection']};const row=map[step.id]||['เริ่มขั้นตอนถัดไป',step.id];return{label:row[0],run:()=>window.HH?.openRoute?.(row[1])}}
function patch(){const s=read();if(!s?.profile)return;const st=R.status(s),step=st.route.find(x=>!R.done(s,x))||null;const hero=document.querySelector('main.container > section.hero');if(!hero)return;const cards=hero.querySelectorAll(':scope > .card');const nextCard=Array.from(cards).find(c=>/ภารกิจถัดไป/.test(c.querySelector('h2')?.textContent||''));if(!nextCard)return;const desc=nextCard.querySelector('p.muted');if(desc)desc.textContent=labelFor(step);const btn=Array.from(nextCard.querySelectorAll('button')).find(b=>!/ออกจากผู้เล่น/.test(b.textContent||''));if(btn){const cfg=buttonFor(step);btn.textContent=cfg.label;btn.removeAttribute('onclick');btn.disabled=false;if(btn.__hhNextSyncHandler)btn.removeEventListener('click',btn.__hhNextSyncHandler,true);btn.__hhNextSyncHandler=e=>{e.preventDefault();e.stopImmediatePropagation();cfg.run()};btn.addEventListener('click',btn.__hhNextSyncHandler,true);btn.dataset.hhNextStep=step?.id||'certificate'}
 const progress=hero.querySelector('.progress > span');const progressText=Array.from(hero.querySelectorAll('p')).find(p=>/% ของภารกิจ/.test(p.textContent||''));if(progress)progress.style.width=st.progressPct+'%';if(progressText)progressText.textContent=st.progressPct+'% ของภารกิจ';
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}
addEventListener('DOMContentLoaded',()=>{patch();new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true,characterData:true})});addEventListener('storage',e=>{if(e.key===KEY)schedule()});setInterval(patch,1200);console.info('[HeroHealth Next Mission Sync]',VERSION);
})();