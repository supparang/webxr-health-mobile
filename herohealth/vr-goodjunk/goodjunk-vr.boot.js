'use strict';

import { boot } from './goodjunk.safe.js';

const DOC = document;

const qs = (k, d=null) => {
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
};

function setViewClasses(view){
  const v = String(view || 'mobile').toLowerCase();
  DOC.body.classList.remove('view-mobile','view-pc','view-vr','view-cvr');

  if(v === 'pc') DOC.body.classList.add('view-pc');
  else if(v === 'vr') DOC.body.classList.add('view-vr');
  else if(v === 'cvr') DOC.body.classList.add('view-cvr');
  else DOC.body.classList.add('view-mobile');

  // cVR: show right layer
  const r = DOC.getElementById('gj-layer-r');
  if(r){
    r.style.display = DOC.body.classList.contains('view-cvr') ? 'block' : 'none';
  }
}

function initStartPanel(){
  const startPanel = DOC.getElementById('startPanel');
  const btnStart = DOC.getElementById('btnStart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const modeHint = DOC.getElementById('modeHint');

  const hub = String(qs('hub','../hub.html') || '../hub.html');
  const view = String(qs('view','mobile') || 'mobile');
  const run  = String(qs('run','play') || 'play');
  const diff = String(qs('diff','normal') || 'normal');
  const time = Number(qs('time','80') || 80) || 80;
  const seed = String(qs('seed', Date.now()));

  setViewClasses(view);

  if(modeHint){
    modeHint.textContent = `view=${view} • run=${run} • diff=${diff} • time=${time}s`;
  }

  if(btnBackHub){
    btnBackHub.addEventListener('click', () => { location.href = hub; });
  }

  if(btnStart){
    btnStart.addEventListener('click', async () => {
      try { if(startPanel) startPanel.style.display = 'none'; } catch(_){}

      // boot uses existing IDs in the HTML
      boot({
        view, run, diff, time, seed,
        hub,
        layerL: DOC.getElementById('gj-layer'),
        layerR: DOC.getElementById('gj-layer-r')
      });
    }, { passive:true });
  }
}

// start
initStartPanel();