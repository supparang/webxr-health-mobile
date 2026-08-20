(()=>{
'use strict';
const RELEASE='20260820-NUMERIC-LOGIN-CODE-R2-GENERIC-FORM';
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
  if(!input) return;
  input.inputMode='numeric';
  input.pattern='[0-9]*';
  input.autocomplete='off';
  input.placeholder='เช่น 5101';
  if(input.dataset.hhNumericLoginR2!=='1'){
    input.dataset.hhNumericLoginR2='1';
    input.value=visibleDigits(input.value);
    input.addEventListener('input',()=>{
      const next=visibleDigits(input.value);
      if(input.value!==next) input.value=next;
    });
  }
  const label=input.closest('label');
  const labelText=label?.querySelector('b,strong,.label');
  if(labelText) labelText.textContent='รหัสเข้าเกม (ตัวเลขเท่านั้น)';
  const form=input.form||input.closest('form');
  if(form){
    const notes=[...form.querySelectorAll('p.muted,p')];
    const note=notes.find(p=>/Firebase|ตรวจรหัส|กู้ความคืบหน้า/.test(String(p.textContent||'')));
    if(note) note.textContent='กรอกรหัสตัวเลขที่ได้รับ เช่น 5101 ระบบจะตรวจชื่อ ห้อง กลุ่ม และกู้ความคืบหน้าจาก Firebase โดยอัตโนมัติ';
  }
}
function scan(){
  document.querySelectorAll('input[name="studentId"],input#studentId,input[data-student-id]').forEach(polishInput);
}
// Capture submit before any app/Firebase submit handler reads FormData.
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement))return;
  const input=form.querySelector('input[name="studentId"],input#studentId,input[data-student-id]');
  if(!input)return;
  const lookup=firebaseLookupCode(input.value);
  input.value=lookup;
  input.dataset.hhLookupCode=lookup;
  console.info('[HeroHealth Login] numeric code normalized for Firebase lookup',{display:visibleDigits(lookup),lookup});
},true);
// Also normalize before direct button/click handlers that bypass normal submit.
document.addEventListener('pointerdown',event=>{
  const button=event.target?.closest?.('button[type="submit"],input[type="submit"],button.btn-primary');
  const form=button?.form||button?.closest?.('form');
  if(!form)return;
  const input=form.querySelector('input[name="studentId"],input#studentId,input[data-student-id]');
  if(!input)return;
  const lookup=firebaseLookupCode(input.value);
  input.value=lookup;
  input.dataset.hhLookupCode=lookup;
},true);
const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{childList:true,subtree:true});
scan();
window.HH_NUMERIC_LOGIN_CODE_R2={release:RELEASE,active:true,toLookup:firebaseLookupCode,toDisplay:visibleDigits};
window.HH_NUMERIC_LOGIN_CODE_R1=window.HH_NUMERIC_LOGIN_CODE_R2;
console.info('[HeroHealth Login] numeric-only code adapter ready',window.HH_NUMERIC_LOGIN_CODE_R2);
})();
