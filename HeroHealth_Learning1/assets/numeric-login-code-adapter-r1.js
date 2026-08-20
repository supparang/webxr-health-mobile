(()=>{
'use strict';
const RELEASE='20260820-NUMERIC-LOGIN-CODE-R1';
function visibleDigits(value){
  const raw=String(value||'').trim().toUpperCase();
  if(/^H5\d{3}$/.test(raw)) return raw.slice(1);
  return raw.replace(/[^0-9]/g,'');
}
function firebaseLookupCode(value){
  const digits=visibleDigits(value);
  // Real Grade-5 entry codes are 4 digits (e.g. 5101); Firestore keeps the legacy H-prefixed key.
  // QA/test IDs such as 990013 remain unchanged.
  if(/^5\d{3}$/.test(digits)) return `H${digits}`;
  return digits;
}
function polishInput(input){
  if(!input||input.dataset.hhNumericLoginR1==='1') return;
  input.dataset.hhNumericLoginR1='1';
  input.inputMode='numeric';
  input.pattern='[0-9]*';
  input.autocomplete='off';
  input.placeholder='เช่น 5101';
  input.value=visibleDigits(input.value);
  input.addEventListener('input',()=>{
    const next=visibleDigits(input.value);
    if(input.value!==next) input.value=next;
  });
}
function scan(){
  const form=document.getElementById('hh-firebase-login-form');
  if(!form)return;
  const input=form.querySelector('input[name="studentId"]');
  polishInput(input);
  const label=input?.closest('label')?.querySelector('b');
  if(label)label.textContent='รหัสเข้าเกม (ตัวเลขเท่านั้น)';
  const note=form.querySelector('p.muted');
  if(note)note.textContent='กรอกรหัสตัวเลขที่ได้รับ เช่น 5101 ระบบจะตรวจชื่อ ห้อง กลุ่ม และกู้ความคืบหน้าจาก Firebase โดยอัตโนมัติ';
}
// Capture submit before the Firebase module reads FormData.
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='hh-firebase-login-form')return;
  const input=form.querySelector('input[name="studentId"]');
  if(!input)return;
  input.value=firebaseLookupCode(input.value);
},true);
const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true});
scan();
window.HH_NUMERIC_LOGIN_CODE_R1={release:RELEASE,active:true,toLookup:firebaseLookupCode,toDisplay:visibleDigits};
console.info('[HeroHealth Login] numeric-only code adapter ready',window.HH_NUMERIC_LOGIN_CODE_R1);
})();
