// === /herohealth/api/api-status.js ===
// API Status Center — tiny global state + banner binder
// ✅ window.HHA_API_STATUS.set({level,title,msg,detail,endpoint})
// ✅ bindBanner({ dotEl, titleEl, msgEl, detailEl, retryEl, onRetry })
// ✅ Emits: window event 'hha:api-status' for listeners

'use strict';

const WIN = window;

function safe(el){ return el || null; }

function normalize(s){
  const level = (s?.level === 'ok' || s?.level === 'warn' || s?.level === 'bad') ? s.level : 'warn';
  return {
    level,
    title: String(s?.title || ''),
    msg: String(s?.msg || ''),
    detail: String(s?.detail || ''),
    endpoint: String(s?.endpoint || ''),
    ts: Number(s?.ts || Date.now())
  };
}

const State = {
  cur: normalize({ level:'warn', title:'กำลังเริ่มต้น…', msg:'', detail:'', endpoint:'' }),
  listeners: new Set()
};

function notify(){
  const s = State.cur;
  try{
    WIN.dispatchEvent(new CustomEvent('hha:api-status', { detail: s }));
  }catch(_){}
  for(const fn of State.listeners){
    try{ fn(s); }catch(_){}
  }
}

function set(state){
  State.cur = normalize(state);
  notify();
}

function get(){
  return State.cur;
}

function subscribe(fn){
  if(typeof fn !== 'function') return ()=>{};
  State.listeners.add(fn);
  try{ fn(State.cur); }catch(_){}
  return ()=> State.listeners.delete(fn);
}

// ---- Banner binder ----
function bindBanner(opts = {}){
  const dotEl = safe(opts.dotEl);
  const titleEl = safe(opts.titleEl);
  const msgEl = safe(opts.msgEl);
  const detailEl = safe(opts.detailEl);
  const retryEl = safe(opts.retryEl);
  const onRetry = (typeof opts.onRetry === 'function') ? opts.onRetry : null;

  const apply = (s)=>{
    if(dotEl){
      dotEl.className = 'dot ' + (s.level === 'ok' ? 'ok' : s.level === 'bad' ? 'bad' : 'warn');
    }
    if(titleEl) titleEl.textContent = s.title || (s.level==='ok'?'ออนไลน์ ✅':'สถานะ API');
    if(msgEl) msgEl.textContent = s.msg || '';
    if(detailEl){
      if(s.detail){
        detailEl.style.display = 'block';
        detailEl.textContent = s.detail;
      }else{
        detailEl.style.display = 'none';
        detailEl.textContent = '';
      }
    }
  };

  const unsub = subscribe(apply);

  if(retryEl && onRetry){
    retryEl.addEventListener('click', (e)=>{
      e.preventDefault();
      try{ onRetry(); }catch(_){}
    });
  }

  return unsub;
}

// expose global
WIN.HHA_API_STATUS = { set, get, subscribe, bindBanner };