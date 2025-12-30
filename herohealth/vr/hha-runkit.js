// === /herohealth/vr/hha-runkit.js ===
// HHA RunKit — Shared helpers for ALL games
// ✅ parse URL params (mode/diff/run/time/hub/seed/log)
// ✅ hold-to-confirm buttons
// ✅ copy JSON + download CSV
// ✅ tier + summary tips (generic)
// ✅ safe DOM setters

'use strict';

export function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function qs(name, def=null){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }
  catch{ return def; }
}

export function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{}
}

export function setText(el, t){
  try{ if(el) el.textContent = String(t); }catch{}
}

export function makeRng(seedStr){
  seedStr = String(seedStr||'');
  let h = 2166136261;
  for (let i=0;i<seedStr.length;i++){
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let x = (h>>>0) || 123456789;
  return function(){
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x>>>0)/4294967296;
  };
}

export function bindHold(btn, fn, holdMs=650){
  if(!btn) return;
  let timer=null;
  const clear=()=>{
    if(timer){ clearTimeout(timer); timer=null; }
    btn.classList.remove('holding');
  };
  btn.addEventListener('pointerdown',(ev)=>{
    try{ ev.preventDefault(); }catch{}
    btn.classList.add('holding');
    timer=setTimeout(()=>{ clear(); fn(); }, holdMs);
  },{passive:false});
  btn.addEventListener('pointerup', clear, {passive:true});
  btn.addEventListener('pointercancel', clear, {passive:true});
  btn.addEventListener('mouseleave', clear, {passive:true});
}

export function toCSVRow(obj){
  const keys = Object.keys(obj);
  const esc = (v)=>{
    const s = String(v ?? '');
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };
  const header = keys.join(',');
  const row = keys.map(k=>esc(obj[k])).join(',');
  return header + '\n' + row + '\n';
}

export function downloadText(filename, text, type='text/plain'){
  try{
    const blob = new Blob([text], {type});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      try{ URL.revokeObjectURL(a.href); }catch{}
      try{ a.remove(); }catch{}
    }, 50);
  }catch{}
}

export async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; }
  catch{
    try{
      const ta=document.createElement('textarea');
      ta.value=text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    }catch{}
  }
  return false;
}

// ---- Tier (generic) ----
export function computeTier(sum){
  const g = String(sum.grade||'C');
  const acc = Number(sum.accuracyGoodPct||0);
  const miss = Number(sum.misses||0);
  const mini = Number(sum.miniCleared||0);

  if ((g==='SSS'||g==='SS') && acc>=90 && miss<=6 && mini>=1) return 'Legend';
  if (g==='S' && acc>=82 && miss<=12) return 'Master';
  if (g==='A' && acc>=70) return 'Expert';
  if (g==='B' || (acc>=55 && miss<=30)) return 'Skilled';
  return 'Beginner';
}

// ---- Tips (generic) ----
export function buildTipsGeneric(sum, opts={}){
  const tips=[];
  const acc = Number(sum.accuracyGoodPct||0);
  const miss = Number(sum.misses||0);
  const goalsOk = (sum.goalsCleared|0) >= (sum.goalsTotal|0 || 1);
  const minis = (sum.miniCleared|0);

  if (goalsOk) tips.push('✅ Goal ผ่านแล้ว (ดีมาก)');
  else tips.push('🎯 โฟกัส: ทำ Goal ให้ผ่านก่อน (เล่นช้าลงแต่แม่นขึ้น)');

  if (minis<=0) tips.push('🌀 Mini ยังไม่ผ่าน: เก็บ “จังหวะ” ให้ถูก (อย่ารัว)');
  else tips.push('🔥 Mini ผ่านแล้ว! ลองผ่านให้ได้ต่อเนื่องทุกครั้ง');

  if (acc<60) tips.push('🎯 Accuracy ต่ำ: เล็งให้ค้าง 0.3–0.5 วิ แล้วค่อยยิง');
  else if (acc>=80) tips.push('⚡ Accuracy ดีแล้ว! ลากคอมโบยาว ๆ จะดันเกรดพุ่ง');

  if (miss>=25) tips.push('💥 MISS เยอะ: ลดความเร็วการยิง + เลือกยิงเป้าที่ชัวร์');

  // per-game hint from opts
  if (opts.gameHint) tips.push(opts.gameHint);

  // Next focus (single)
  let next='เพิ่ม Accuracy + ลด MISS';
  if (!goalsOk) next='ทำ Goal ให้ผ่านก่อน';
  else if (minis<=0) next='ผ่าน Mini ให้ได้';
  else if (acc<70) next='ดัน Accuracy > 70%';
  else if (miss>15) next='ลด MISS < 10';
  else next='คอมโบยาว + ทำ Mini ทุกครั้ง';

  return { tips, next };
}

// ---- Summary binder (DOM ids มาตรฐานเดียวกันทุกเกม) ----
export function bindSummaryUI(opts){
  const {
    hubUrl,
    getSummaryJson,   // () => string
    onRetry,          // () => void
    onBackHub         // () => void
  } = opts || {};

  const bd = document.getElementById('resultBackdrop');
  const btnRetry = document.getElementById('btnRetry');
  const btnBackHub = document.getElementById('btnBackHub');
  const btnClose = document.getElementById('btnCloseSummary');
  const btnCopy = document.getElementById('btnCopyJSON');
  const btnCSV  = document.getElementById('btnDownloadCSV');

  btnClose?.addEventListener('click', ()=>{ try{ bd.hidden=true; }catch{} }, {passive:true});

  bindHold(btnRetry, ()=>{ onRetry?.(); }, 650);
  bindHold(btnBackHub, ()=>{ onBackHub?.(hubUrl); }, 650);

  btnCopy?.addEventListener('click', async ()=>{
    const raw = getSummaryJson?.() || '';
    if(!raw) return;
    await copyToClipboard(raw);
  }, {passive:true});

  btnCSV?.addEventListener('click', ()=>{
    const raw = getSummaryJson?.() || '';
    if(!raw) return;
    let obj=null;
    try{ obj=JSON.parse(raw); }catch{ return; }
    const csv = toCSVRow(obj);
    downloadText(`hha_${(obj.gameMode||'game')}_${(obj.sessionId||'session')}_${Date.now()}.csv`, csv, 'text/csv');
  }, {passive:true});

  return { bd };
}

export function fillSummaryDOM(sum){
  const $ = (id)=>document.getElementById(id);

  setText($('rScore'), sum.scoreFinal|0);
  setText($('rGrade'), String(sum.grade||'C'));
  setText($('rAcc'), `${Number(sum.accuracyGoodPct||0).toFixed(1)}%`);

  setText($('rComboMax'), sum.comboMax|0);
  setText($('rMiss'), sum.misses|0);
  setText($('rGoals'), `${sum.goalsCleared|0}/${sum.goalsTotal|0}`);

  setText($('rMinis'), `${sum.miniCleared|0}/${sum.miniTotal|0}`);
  setText($('rGreen'), `${Number(sum.greenHoldSec||0).toFixed(1)}s`);
  setText($('rStreak'), sum.streakMax|0);

  setText($('rStormCycles'), sum.stormCycles|0);
  setText($('rStormOk'), sum.stormSuccess|0);
  setText($('rStormRate'), `${Number(sum.stormRatePct||0).toFixed(0)}%`);
}