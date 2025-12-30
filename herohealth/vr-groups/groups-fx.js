/* === /herohealth/vr-groups/groups-fx.js ===
GroupsVR FX — flash + pop text + shake (sets --shakeX/--shakeY)
Listens:
- hha:judge (good/bad/MISS/boss text)
- groups:stun (ms,strength)
- hha:celebrate (goal/mini)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function ensureFlash(){
    let el = DOC.querySelector('.fx-flash');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-flash';
    DOC.body.appendChild(el);
    return el;
  }
  function ensureLayer(){
    let el = DOC.querySelector('.fx-layer');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'fx-layer';
    DOC.body.appendChild(el);
    return el;
  }

  function flash(kind){
    const el = ensureFlash();
    el.classList.remove('good','bad','cyan','show');
    if (kind === 'good') el.classList.add('good');
    else if (kind === 'bad') el.classList.add('bad');
    else el.classList.add('cyan');
    el.classList.add('show');
    setTimeout(()=> el.classList.remove('show'), 120);
  }

  function pop(text, x, y){
    const layer = ensureLayer();
    const p = DOC.createElement('div');
    p.className = 'fx-pop';
    p.textContent = String(text||'');
    p.style.left = (x|| (innerWidth*0.5)) + 'px';
    p.style.top  = (y|| (innerHeight*0.45)) + 'px';
    layer.appendChild(p);
    setTimeout(()=> p.remove(), 620);
  }

  // shake: apply to fg-layer via CSS vars
  let shakeUntil = 0;
  let strengthNow = 0;
  function setShake(str){
    const layer = DOC.getElementById('fg-layer') || DOC.querySelector('.fg-layer');
    if (!layer) return;
    const t = performance.now();
    if (t > shakeUntil){
      layer.style.setProperty('--shakeX','0px');
      layer.style.setProperty('--shakeY','0px');
      return;
    }
    const s = Math.max(0.4, str||1);
    const dx = (Math.random()-0.5) * 10 * s;
    const dy = (Math.random()-0.5) * 8  * s;
    layer.style.setProperty('--shakeX', dx.toFixed(1)+'px');
    layer.style.setProperty('--shakeY', dy.toFixed(1)+'px');
  }

  function loopShake(){
    if (performance.now() <= shakeUntil){
      setShake(strengthNow);
      requestAnimationFrame(loopShake);
    } else {
      setShake(0);
    }
  }

  root.addEventListener('groups:stun', (ev)=>{
    const d = ev.detail || {};
    const ms = Math.max(200, Number(d.ms||800));
    const str = Math.max(0.6, Number(d.strength||1));
    shakeUntil = performance.now() + ms;
    strengthNow = str;
    flash('bad');
    pop('STUN!', innerWidth*0.5, innerHeight*0.40);
    loopShake();
  });

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind||'').toLowerCase();
    const text = d.text ? String(d.text) : '';
    if (k === 'miss' || k === 'bad'){
      flash('bad');
      if (text) pop(text, innerWidth*0.5, innerHeight*0.42);
      return;
    }
    if (k === 'boss'){
      flash('cyan');
      if (text) pop(text, innerWidth*0.5, innerHeight*0.35);
      return;
    }
    // good
    flash('good');
    if (text) pop(text, innerWidth*0.5, innerHeight*0.42);
  });

  root.addEventListener('hha:celebrate', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    const title = d.title ? String(d.title) : '';
    if (!title) return;
    flash(kind === 'goal' ? 'cyan' : 'good');
    pop(title, innerWidth*0.5, innerHeight*0.34);
  });

})(typeof window !== 'undefined' ? window : globalThis);