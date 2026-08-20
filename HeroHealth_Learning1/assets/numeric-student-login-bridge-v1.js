(()=>{
'use strict';
const RELEASE='20260820-NUMERIC-STUDENT-LOGIN-BRIDGE-V1';
function canonicalStudentId(raw){
  const value=String(raw||'').trim().toUpperCase();
  if(/^\d{4}$/.test(value)) return `H${value}`;
  if(/^H\d{4}$/.test(value)) return value;
  return value;
}
function numericDisplay(raw){
  const value=String(raw||'').trim().toUpperCase();
  return /^H\d{4}$/.test(value)?value.slice(1):value;
}
function patchInput(input){
  if(!input||input.dataset.hhNumericLoginV1==='1')return;
  input.dataset.hhNumericLoginV1='1';
  input.setAttribute('inputmode','numeric');
  input.setAttribute('pattern','[0-9]*');
  input.setAttribute('autocomplete','off');
  input.placeholder='กรอกรหัส 4 หลัก เช่น 5101';
  const shown=numericDisplay(input.value);
  if(shown!==input.value) input.value=shown;
  input.addEventListener('input',()=>{
    const cleaned=String(input.value||'').replace(/[^0-9]/g,'');
    if(input.value!==cleaned) input.value=cleaned;
  });
}
function patchLogin(root=document){
  root.querySelectorAll('form#hh-firebase-login-form input[name="studentId"], input[name="studentId"]').forEach(patchInput);
}
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement))return;
  const input=form.querySelector('input[name="studentId"]');
  if(!input)return;
  const raw=String(input.value||'').trim();
  const canonical=canonicalStudentId(raw);
  if(/^\d{4}$/.test(raw)){
    input.removeAttribute('pattern');
    input.value=canonical;
    queueMicrotask(()=>{ if(document.contains(input)) input.value=numericDisplay(canonical); });
    console.info('[HeroHealth Numeric Login]',{entered:raw,lookup:canonical,release:RELEASE});
  }
},true);
const observer=new MutationObserver(()=>patchLogin());
observer.observe(document.documentElement,{childList:true,subtree:true});
patchLogin();
window.HH_NUMERIC_STUDENT_LOGIN_BRIDGE_V1={release:RELEASE,active:true,canonicalStudentId,numericDisplay};
console.info('[HeroHealth Numeric Login] ready',window.HH_NUMERIC_STUDENT_LOGIN_BRIDGE_V1);
})();
