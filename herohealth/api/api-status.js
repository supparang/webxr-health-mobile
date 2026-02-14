// === /herohealth/api/api-status.js ===
// API Status UI helper (Hub-safe)
// ✅ never throws
// ✅ updates banner dot/title/msg + optional toast

'use strict';

function safeGet(id){
  try{ return document.getElementById(id); }catch{ return null; }
}

function clsDot(dotEl, state){
  if(!dotEl) return;
  dotEl.className = 'dot ' + (state==='ok' ? 'ok' : state==='bad' ? 'bad' : 'warn');
}

function text(el, s){
  if(!el) return;
  try{ el.textContent = String(s ?? ''); }catch{}
}

function makeToast(){
  let el = safeGet('hha-api-toast');
  if(el) return el;

  el = document.createElement('div');
  el.id = 'hha-api-toast';
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.bottom = 'calc(14px + env(safe-area-inset-bottom, 0px))';
  el.style.transform = 'translateX(-50%)';
  el.style.zIndex = '9999';
  el.style.padding = '10px 12px';
  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.borderRadius = '14px';
  el.style.background = 'rgba(2,6,23,.78)';
  el.style.color = '#e5e7eb';
  el.style.fontWeight = '950';
  el.style.fontSize = '13px';
  el.style.boxShadow = '0 14px 44px rgba(0,0,0,.35)';
  el.style.opacity = '0';
  el.style.transition = 'opacity .18s ease';
  document.body.appendChild(el);
  return el;
}

let toastTimer = 0;
function toast(msg, ms=1200){
  try{
    const el = makeToast();
    el.textContent = String(msg ?? '');
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity='0'; }, ms);
  }catch{}
}

/**
 * Create a status controller for a banner.
 * dom: { dotId, titleId, msgId, retryId? }
 */
export function createStatus(dom){
  const dotEl   = safeGet(dom?.dotId   || 'apiDot');
  const titleEl = safeGet(dom?.titleId || 'apiTitle');
  const msgEl   = safeGet(dom?.msgId   || 'apiMsg');
  const retryEl = safeGet(dom?.retryId || 'btnRetry');

  function set(state, title, msg){
    try{
      clsDot(dotEl, state);
      text(titleEl, title);
      text(msgEl, msg);
    }catch{}
  }

  return {
    el: { dotEl, titleEl, msgEl, retryEl },
    set,
    ok(title='ออนไลน์ ✅', msg='API ตอบกลับปกติ'){
      set('ok', title, msg);
    },
    warn(title='กำลังตรวจสอบ…', msg='กำลังตรวจสอบระบบ'){
      set('warn', title, msg);
    },
    bad(title='มีปัญหา ⚠️', msg='API ใช้งานไม่ได้ แต่หน้าไม่พัง'){
      set('bad', title, msg);
    },
    toast
  };
}