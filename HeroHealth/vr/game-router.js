// vr/game-router.js
function getParam(name, def=null){ try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch{ return def; } }
const mode = (getParam('mode','goodjunk')||'').toLowerCase();

const MODULES = {
  goodjunk: './modes/goodjunk-vr.js',
  groups:   './modes/groups-vr.js',
  hydration:'./modes/hydration-vr.js',
  plate:    './modes/plate-vr.js'
};

const url = MODULES[mode] || MODULES.goodjunk;
import(url).then(()=>console.log('[VR] loaded mode:', mode)).catch(err=>{
  console.error('[VR] load mode failed:', err);
  if(url !== MODULES.goodjunk) import(MODULES.goodjunk);
});
