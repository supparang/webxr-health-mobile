// === /herohealth/api/api-status.js ===
// Minimal status banner UI helper

'use strict';

export function createStatusUI(opts = {}){
  const dotId = String(opts.dotId || 'apiDot');
  const titleId = String(opts.titleId || 'apiTitle');
  const msgId = String(opts.msgId || 'apiMsg');

  const dotEl = ()=>document.getElementById(dotId);
  const titleEl = ()=>document.getElementById(titleId);
  const msgEl = ()=>document.getElementById(msgId);

  function set(state, title, msg){
    // state: ok | warn | bad
    try{
      const d = dotEl();
      if(d) d.className = 'dot ' + (state === 'ok' ? 'ok' : state === 'bad' ? 'bad' : 'warn');
    }catch(_){}

    try{
      const t = titleEl();
      if(t) t.textContent = String(title || '');
    }catch(_){}

    try{
      const m = msgEl();
      if(m) m.textContent = String(msg || '');
    }catch(_){}
  }

  return { set, dotId, titleId, msgId };
}