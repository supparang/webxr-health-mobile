// === /herohealth/vr-groups/launcher-groups.js ===
// Groups Launcher — PC/Mobile/Cardboard selector + param passthrough
'use strict';

const LS_KEY = 'HHA_GROUPS_LAST_VIEW';

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(n,a,b){ n=Number(n)||0; return n<a?a:(n>b?b:n); }

function resolveRunHref(){
  // launcher: /herohealth/groups-vr.html
  // run:      /herohealth/vr-groups/groups-vr.html
  const u = new URL(location.href);
  u.pathname = u.pathname.replace(/\/groups-vr\.html$/, '/vr-groups/groups-vr.html');
  return u;
}

function setActive(view){
  document.querySelectorAll('[data-view]').forEach(b=>{
    b.classList.toggle('primary', b.getAttribute('data-view') === view);
  });
  const selTag = document.getElementById('selTag');
  if(selTag) selTag.textContent = `selected: ${view}`;
}

function setLast(view){
  try{ localStorage.setItem(LS_KEY, view); }catch{}
  const lastTag = document.getElementById('lastTag');
  if(lastTag) lastTag.textContent = `last: ${view}`;
}

function getLast(){
  try{ return localStorage.getItem(LS_KEY) || null; }catch{ return null; }
}

function ensureSeed(inputEl){
  const v = Number(inputEl.value || 0) || 0;
  if(v) return v;
  const seed = Date.now();
  inputEl.value = String(seed);
  return seed;
}

let selectedView = qs('view', null) || getLast() || 'cvr';

function boot(){
  const runSel = document.getElementById('runSel');
  const diffSel = document.getElementById('diffSel');
  const timeInp = document.getElementById('timeInp');
  const seedInp = document.getElementById('seedInp');
  const practiceSel = document.getElementById('practiceSel');
  const debugSel = document.getElementById('debugSel');
  const btnStart = document.getElementById('btnStart');

  setActive(selectedView);
  setLast(selectedView);

  document.querySelectorAll('[data-view]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      selectedView = btn.getAttribute('data-view') || 'cvr';
      setActive(selectedView);
      setLast(selectedView);
    });
  });

  btnStart?.addEventListener('click', ()=>{
    const run = runSel?.value || 'play';
    const diff = diffSel?.value || 'normal';
    const time = clamp(timeInp?.value || 90, 20, 240);
    const seed = ensureSeed(seedInp);
    const practice = practiceSel?.value || '1';
    const debug = debugSel?.value || '0';

    const hub = qs('hub', null);
    const style = qs('style', null);

    const u = resolveRunHref();
    u.searchParams.set('view', selectedView);
    u.searchParams.set('run', run);
    u.searchParams.set('diff', diff);
    u.searchParams.set('time', String(time));
    u.searchParams.set('seed', String(seed));
    u.searchParams.set('practice', practice);
    u.searchParams.set('debug', debug);

    if(hub) u.searchParams.set('hub', hub);
    if(style) u.searchParams.set('style', style);

    location.href = u.toString();
  });
}

boot();