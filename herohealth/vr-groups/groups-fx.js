/* === /herohealth/vr-groups/groups-fx.js ===
FX Layer for GroupsVR
✅ Screen flash: good/bad/cyan
✅ Shake (sets --shakeX/--shakeY)
✅ Pop text at hit location
Listens: hha:judge, hha:hit, hha:celebrate
*/

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  let layer = null;
  let flash = null;
  let shakeTimer = 0;

  function ensureLayer(){
    if (layer) return layer;
    layer = doc.querySelector('.fx-layer');
    if (layer) return layer;
    layer = doc.createElement('div');
    layer.className = 'fx-layer';
    doc.body.appendChild(layer);
    return layer;
  }

  function ensureFlash(){
    if (flash) return flash;
    flash = doc.querySelector('.fx-flash');
    if (flash) return flash;
    flash = doc.createElement('div');
    flash.className = 'fx-flash';
    doc.body.appendChild(flash);
    return flash;
  }

  function flashScreen(kind='cyan', ms=120){
    const el = ensureFlash();
    el.classList.remove('good','bad','cyan','show');
    el.classList.add(kind);
    el.classList.add('show');
    root.setTimeout(()=> el.classList.remove('show'), ms);
  }

  function setShake(x, y){
    doc.documentElement.style.setProperty('--shakeX', (x||0).toFixed(2)+'px');
    doc.documentElement.style.setProperty('--shakeY', (y||0).toFixed(2)+'px');
  }

  function shake(ms=220, intensity=8){
    try{ root.clearInterval(shakeTimer); }catch{}
    const t0 = Date.now();
    shakeTimer = root.setInterval(()=>{
      const dt = Date.now() - t0;
      if (dt >= ms){
        try{ root.clearInterval(shakeTimer); }catch{}
        shakeTimer = 0;
        setShake(0,0);
        return;
      }
      const k = 1 - dt/ms;
      const a = intensity * k;
      const rx = (Math.random()*2-1) * a;
      const ry = (Math.random()*2-1) * a;
      setShake(rx, ry);
    }, 16);
  }

  function pop(x,y,text){
    const lay = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'fx-pop';
    el.textContent = text;
    el.style.left = (x||0)+'px';
    el.style.top  = (y||0)+'px';
    lay.appendChild(el);
    root.setTimeout(()=> el.remove(), 650);
  }

  // Events
  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if (kind === 'bad' || kind === 'miss'){
      flashScreen('bad', 140);
      shake(220, 10);
      NS.Audio?.bad?.();
    } else if (kind === 'good'){
      flashScreen('good', 110);
      NS.Audio?.good?.();
    } else if (kind === 'boss'){
      flashScreen('cyan', 160);
      shake(260, 12);
      NS.Audio?.boss?.();
    }
  });

  root.addEventListener('hha:celebrate', (e)=>{
    const d = e.detail || {};
    const k = String(d.kind||'').toLowerCase();
    flashScreen(k==='goal' ? 'good' : 'cyan', 180);
    NS.Audio?.overdrive?.();
  });

  root.addEventListener('hha:hit', (e)=>{
    const d = e.detail || {};
    const x = Number(d.x||0);
    const y = Number(d.y||0);
    const kind = String(d.kind||'').toLowerCase();
    const emoji = String(d.emoji||'');
    if (x>0 && y>0){
      if (kind === 'good') pop(x,y, `+${d.points||0} ${emoji}`);
      else if (kind === 'boss') pop(x,y, `👑 -1`);
      else pop(x,y, `-${d.penalty||0} ${emoji||'💥'}`);
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);