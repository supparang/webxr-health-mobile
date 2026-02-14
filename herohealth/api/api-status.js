// === /herohealth/api/api-status.js ===
// Lightweight API status banner + probe utilities
'use strict';

const DOC = document;

export function qs(k, d=''){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}

export function setBanner({ dotId='apiDot', titleId='apiTitle', msgId='apiMsg' } = {}, state='warn', title='', msg=''){
  const dot = DOC.getElementById(dotId);
  const h4  = DOC.getElementById(titleId);
  const p   = DOC.getElementById(msgId);
  if(dot) dot.className = 'dot ' + (state==='ok' ? 'ok' : state==='bad' ? 'bad' : 'warn');
  if(h4) h4.textContent = title || '';
  if(p)  p.textContent  = msg || '';
}

export async function probeAPI(endpoint, payload={ ping:true }, timeoutMs=3500){
  // Best-effort POST probe. Returns {ok,status,error?}
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), Math.max(800, timeoutMs|0));
  try{
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    return { ok: res.ok, status: res.status };
  }catch(e){
    return { ok:false, status:0, error: String(e?.message || e || 'fetch failed') };
  }finally{
    clearTimeout(t);
  }
}

export function attachRetry(btnId='btnRetry', fn){
  const btn = DOC.getElementById(btnId);
  if(!btn) return;
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    try{ fn && fn(); }catch(_){}
  });
}

export function toast(msg){
  let el = DOC.getElementById('toast');
  if(!el){
    el = DOC.createElement('div');
    el.id = 'toast';
    el.style.position='fixed';
    el.style.left='50%';
    el.style.bottom='calc(14px + env(safe-area-inset-bottom,0px))';
    el.style.transform='translateX(-50%)';
    el.style.zIndex='9999';
    el.style.padding='10px 12px';
    el.style.border='1px solid rgba(148,163,184,.18)';
    el.style.borderRadius='14px';
    el.style.background='rgba(2,6,23,.78)';
    el.style.color='#e5e7eb';
    el.style.fontWeight='950';
    el.style.fontSize='13px';
    el.style.boxShadow='0 14px 44px rgba(0,0,0,.35)';
    el.style.opacity='0';
    el.style.transition='opacity .18s ease';
    DOC.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t = setTimeout(()=>{ el.style.opacity='0'; }, 1200);
}