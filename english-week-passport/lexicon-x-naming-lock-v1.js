(function(){
'use strict';
const VERSION='2026-08-19-LEXICON-X-NAMING-LOCK-V1';
const NAMES={
 word_match:['LexiMatch Navigator','Game 1 • จับคู่คำศัพท์ • Swipe + Tilt • A2–B1+','🧭'],
 category_forest:['Category Forest','Game 2 • ลากคำเข้าหมวด • Rescue Learning','🌲'],
 sentence_city:['Sentence City AR','Game 3 • AR Hand Builder • Clean Bank V2','🏙️'],
 word_detective:['Conversation Quest AR','Game 4 • เลือกบทสนทนาและพูดทุกช่วง','💬'],
 final_boss:['LEXICON Champion Arena','Game 5 • 4 Gates + Final Boss • Move → Decide → Speak','👑']
};
let pending=false;
function apply(){
 pending=false;
 document.querySelectorAll('.stage-card[data-stage]').forEach(card=>{
   const n=NAMES[card.dataset.stage]; if(!n)return;
   const title=card.querySelector('div:nth-child(2)>strong');
   const detail=card.querySelector('div:nth-child(2)>small');
   const icon=card.querySelector('.stage-icon');
   if(title&&title.textContent!==n[0]) title.textContent=n[0];
   if(detail){const best=(detail.textContent.match(/• ดีที่สุด[^•]*/)||[])[0]||'';const wanted=n[1]+(best?' '+best:'');if(detail.textContent!==wanted)detail.textContent=wanted;}
   if(icon&&icon.textContent!==n[2])icon.textContent=n[2];
 });
 document.querySelectorAll('h1,h2,.brand-lockup strong').forEach(el=>{
   if(el.textContent.trim()==='English Week Passport' && el.closest('.hero-card')) el.textContent='LEXICON X Challenge';
 });
}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(apply);}
new MutationObserver(schedule).observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',apply,{once:true});
apply();
window.EW_LEXICON_X_NAMING_LOCK=Object.freeze({version:VERSION,apply});
}());