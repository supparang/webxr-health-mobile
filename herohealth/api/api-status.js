// === /herohealth/api/api-status.js ===
// Remote disable latch (per-tab) for 401/403 to prevent retry spam

'use strict';

// Remote disable latch (per-tab) for 401/403 to prevent retry spam
const KEY = 'HHA_API_DISABLED';
const TTL_MS = 15 * 60 * 1000; // 15 min

export function disableRemote(code=403, reason='forbidden'){
  try{
    const payload = { code:Number(code)||403, reason:String(reason||''), ts:Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  }catch{}
}

export function clearDisable(){
  try{ sessionStorage.removeItem(KEY); }catch{}
}

export function disabledInfo(){
  try{
    const raw = sessionStorage.getItem(KEY);
    if(!raw) return { disabled:false };
    const d = JSON.parse(raw);
    return { disabled:true, code:d.code||403, reason:d.reason||'', ts:d.ts||0 };
  }catch{
    return { disabled:false };
  }
}

export function isRemoteDisabled(){
  const info = disabledInfo();
  if(!info.disabled) return false;
  const age = Date.now() - (info.ts||0);
  if(age > TTL_MS){
    clearDisable();
    return false;
  }
  return true;
}

// --- UI helpers expected by hub.boot.js ---

// setBanner(targetProps, status, title, msg)
// status: 'ok' | 'warn' | 'bad' (controls dot class)
export function setBanner(/targetProps/_, status='warn', title='', msg=''){
  const dot = document.getElementById('apiDot');
  const titleEl = document.getElementById('apiTitle');
  const msgEl = document.getElementById('apiMsg');
  if(dot){
    dot.classList.remove('ok','warn','bad');
    if(status === 'ok') dot.classList.add('ok');
    else if(status === 'bad') dot.classList.add('bad');
    else dot.classList.add('warn');
  }
  if(titleEl) titleEl.textContent = title || '';
  if(msgEl) msgEl.textContent = msg || '';
}

// simple toast: ephemeral centered bottom message
export function toast(text, ms=2200){
  try{
    const id = 'hh-toast';
    let el = document.getElementById(id);
    if(!el){
      el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, {
        position:'fixed', left:'50%', bottom:'18px', transform:'translateX(-50%)',
        background:'rgba(0,0,0,0.7)', color:'#fff', padding:'8px 12px', borderRadius:'8px', zIndex:9999
      });
      document.body.appendChild(el);
    }
    el.textContent = String(text||'');
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.opacity = '0'; }, ms);
  }catch(e){ console.warn('toast', e); }
}

// qs(name, fallback) - read query string param or fallback
export function qs(name, fallback=''){
  try{
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }catch{ return fallback; }
}

// probeAPI(endpoint, opts, timeoutMs)
// opts: arbitrary object sent in POST body if ping:true, otherwise GET
// returns { status: number } or { status: 0 } on network failure
export async function probeAPI(endpoint, opts={}, timeoutMs=3000){
  if(!endpoint) return { status: 0 };
  if(isRemoteDisabled()) return { status: 403 };
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const method = (opts && opts.ping) ? 'POST' : 'GET';
    const body = opts && opts.ping ? JSON.stringify({ ping:true }) : undefined;
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type':'application/json' },
      body,
      signal: controller.signal,
      mode: 'cors'
    });
    clearTimeout(t);
    if(res.status === 401 || res.status === 403){
      // record remote disable to avoid retry spam
      try{ disableRemote(res.status, status:${res.status}); }catch(){}
    }
    return { status: res.status };
  }catch(err){
    clearTimeout(t);
    if(err && err.name === 'AbortError') return { status: 0 };
    return { status: 0 };
  }
}

// attachRetry(buttonId, fn)
// wires a button to run the probe function and disables button when remote-disabled
export function attachRetry(btnId, fn){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  const update = ()=>{
    const disabled = isRemoteDisabled();
    btn.classList.toggle('btn--disabled', disabled);
    btn.disabled = disabled;
  };
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    if(isRemoteDisabled()) return;
    try{ fn(); }catch(err){ console.warn('probe fn', err); }
  });
  // refresh state on load and every 1s (to reflect TTL expiry)
  update();
  const iv = setInterval(update, 1000);
  // optional cleanup if needed: store interval id on element
  btn._hh_interval = iv;
}
