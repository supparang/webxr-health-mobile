(function(){
"use strict";
const VERSION="2026-08-04-LEXICON-X-GAME-FEEL-V6";
let combo=0,lastMatched=0,lastErrors=0,observer=null,startedAt=Date.now();

function vibrate(pattern){try{navigator.vibrate?.(pattern);}catch(_){}}
function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}

function injectStyle(){
  if(document.getElementById("lxV6Style"))return;
  const style=document.createElement("style");
  style.id="lxV6Style";
  style.textContent=`
    .cursor{animation:lxCursorPulse 1.15s ease-in-out infinite;will-change:transform}
    .card.target{animation:lxTargetGlow 1.05s ease-in-out infinite}
    .card.lx-match-pop{animation:lxMatchPop .34s cubic-bezier(.2,.9,.25,1.25)}
    .card.lx-wrong-shake{animation:lxWrongShake .28s ease both;border-color:#ff7180!important;box-shadow:0 0 0 3px rgba(255,79,98,.2),0 0 24px rgba(255,79,98,.24)!important}
    .card.matched{filter:saturate(1.12);transform:scale(.985)}
    .instruction{font-weight:850;letter-spacing:.01em;transition:background .2s,color .2s,transform .2s}
    .instruction.lx-success{background:#103f38;color:#8ff6cf;transform:scale(1.015)}
    .instruction.lx-warning{background:#47252c;color:#ffc1c8}
    .lx-combo{display:flex;align-items:center;justify-content:center;gap:7px;margin:-3px 0 10px;min-height:28px;color:#7fe8ff;font-weight:950;letter-spacing:.08em;opacity:0;transform:translateY(-5px);transition:.2s ease}
    .lx-combo.show{opacity:1;transform:translateY(0)}
    .lx-combo strong{font-size:1.1rem;color:#ffe37a;text-shadow:0 0 16px rgba(255,227,122,.35)}
    .summary .lx-performance{margin:12px auto 0;padding:11px 14px;border:1px solid #31546d;border-radius:14px;background:#0b2437;color:#bfeeff;font-weight:800}
    @keyframes lxCursorPulse{0%,100%{box-shadow:0 0 13px rgba(255,234,128,.35);opacity:.88}50%{box-shadow:0 0 28px rgba(255,234,128,.78);opacity:1}}
    @keyframes lxTargetGlow{0%,100%{box-shadow:0 0 0 3px rgba(255,227,110,.18),0 0 17px rgba(255,227,110,.17)}50%{box-shadow:0 0 0 4px rgba(255,227,110,.28),0 0 29px rgba(255,227,110,.3)}}
    @keyframes lxMatchPop{0%{transform:scale(1)}45%{transform:scale(1.075)}100%{transform:scale(.985)}}
    @keyframes lxWrongShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
    @media(prefers-reduced-motion:reduce){.cursor,.card.target,.card.lx-match-pop,.card.lx-wrong-shake{animation:none!important}}
  `;
  document.head.appendChild(style);
}

function ensureCombo(){
  const instruction=document.getElementById("instruction");
  if(!instruction||document.getElementById("lxCombo"))return;
  const comboEl=document.createElement("div");
  comboEl.id="lxCombo";
  comboEl.className="lx-combo";
  comboEl.innerHTML='<span>COMBO</span><strong id="lxComboValue">×1</strong>';
  instruction.insertAdjacentElement("afterend",comboEl);
}

function updateInstruction(){
  const el=document.getElementById("instruction");
  if(!el)return;
  const raw=el.textContent||"";
  el.classList.remove("lx-success","lx-warning");
  if(/MATCH|จับคู่สำเร็จ/i.test(raw)){text(el,"✓ จับคู่สำเร็จ!");el.classList.add("lx-success");return;}
  if(/NOT A MATCH|ไม่ตรงกัน/i.test(raw)){text(el,"ยังไม่ตรงกัน • ลองใหม่");el.classList.add("lx-warning");return;}
  if(/กำลังเปิด|OPEN/i.test(raw)){const pct=raw.match(/(\d+)%/)?.[1];text(el,pct?`กำลังเปิด ${pct}%`:`กำลังเปิด…`);return;}
  if(/กำลังเลื่อน/i.test(raw)){text(el,"กำลังเลื่อนไปยังการ์ดถัดไป…");return;}
  if(/ถึงการ์ด/i.test(raw)){text(el,"ล็อกเป้าแล้ว • กำลังเปิด…");return;}
  if(/เลือกการ์ดอีกใบ|เปิดใบแรก/i.test(raw)){text(el,"เลือกอีกใบเพื่อจับคู่");return;}
  if(/พร้อม|เอียงหรือปัด|SENSOR READY|SWIPE READY/i.test(raw)){text(el,"เอียงหรือปัดเพื่อเลื่อน 1 ใบ");}
}

function countMatched(){return document.querySelectorAll(".card.matched").length;}
function currentErrors(){return Number(document.getElementById("errors")?.textContent||0);}

function animateNewMatches(){
  const matched=countMatched();
  if(matched>lastMatched){
    combo+=1;
    document.querySelectorAll(".card.matched:not([data-lx-polished])").forEach(card=>{
      card.dataset.lxPolished="1";
      card.classList.add("lx-match-pop");
      setTimeout(()=>card.classList.remove("lx-match-pop"),380);
    });
    vibrate(combo>=3?[18,35,28]:[18,24,18]);
    const box=document.getElementById("lxCombo"),value=document.getElementById("lxComboValue");
    if(box&&value){value.textContent=`×${combo}`;box.classList.add("show");}
    const instruction=document.getElementById("instruction");
    if(instruction){instruction.textContent=combo>=3?`🔥 COMBO ×${combo}`:"✓ จับคู่สำเร็จ!";instruction.classList.add("lx-success");}
  }
  lastMatched=matched;
}

function animateWrong(){
  const errors=currentErrors();
  if(errors>lastErrors){
    combo=0;
    document.getElementById("lxCombo")?.classList.remove("show");
    const flipped=[...document.querySelectorAll(".card.flipped:not(.matched)")];
    flipped.forEach(card=>{card.classList.add("lx-wrong-shake");setTimeout(()=>card.classList.remove("lx-wrong-shake"),320);});
    vibrate([20,35,20]);
  }
  lastErrors=errors;
}

function polishSummary(){
  const summary=document.querySelector(".summary");
  if(!summary||summary.dataset.lxV6==="1")return;
  summary.dataset.lxV6="1";
  const lead=summary.querySelector(".lead")?.textContent||"";
  const accuracy=Number(lead.match(/Accuracy\s+(\d+)%/i)?.[1]||0);
  const label=accuracy>=95?"PERFECT RUN":accuracy>=85?"EXCELLENT":accuracy>=70?"GREAT JOB":"KEEP PRACTISING";
  const perf=document.createElement("div");
  perf.className="lx-performance";
  perf.textContent=label;
  const rank=summary.querySelector(".rank");
  (rank||summary.querySelector("h1"))?.insertAdjacentElement("afterend",perf);
  vibrate(accuracy>=95?[30,35,45]:[24,30,24]);
}

function tick(){
  injectStyle();ensureCombo();updateInstruction();animateNewMatches();animateWrong();polishSummary();
}

observer=new MutationObserver(tick);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class","data-pct"]});
setInterval(tick,180);
tick();
window.EW_LEXICON_X_POLISH=Object.freeze({version:VERSION,startedAt});
}());
