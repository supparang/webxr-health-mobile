(()=>{
'use strict';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;
const $=id=>document.getElementById(id);
const set=(id,v)=>{const el=$(id);if(!el)return;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
const hide=el=>{if(el)el.style.display='none'};
const sid=q.get('studentId')||q.get('pid')||'';
const section=q.get('section')||'';
const group=q.get('group')||q.get('classId')||'ป.5';
const name=q.get('name')||q.get('playerName')||'Hero';
function apply(){
 set('playerName',name);set('studentId',sid);set('classId',group);set('section',section);set('difficulty','easy');set('duration','60');
 const sk=$('showSkeleton');if(sk&&!sk.checked)sk.click();
 const snd=$('soundOn');if(snd&&!snd.checked)snd.click();
 const safe=$('safeMode');if(safe&&!safe.checked)safe.click();
 const ov=$('startOverlay');
 if(ov){
   ov.classList.add('hidden');
   ov.style.display='none';
 }
 hide($('cameraTestBtn'));hide($('demoBtn'));
 const coach=$('coachSub');if(coach)coach.textContent='โหมดห้องเรียน • Easy • 60 วินาที • Safe Mode';
 const main=$('coachMain');if(main)main.textContent='ถอยให้กล้องเห็นตั้งแต่ศีรษะถึงข้อเท้า แล้วเตรียม Calibration';
 setTimeout(()=>{$('startBtn')?.click();},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
