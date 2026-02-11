// -------------------------
// URL params (PATCH O: support ?run= as alias of ?mode= + autostart)
// -------------------------
function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();
const hasQ = (k)=> {
  try { return QS.has(k); } catch { return false; }
};
const q = (k, def='') => (QS.get(k) ?? def);
const qNum = (k, def=0) => {
  const v = Number(q(k, def));
  return Number.isFinite(v) ? v : def;
};
const qBool = (k, def=false) => {
  const v = (q(k, '') || '').toLowerCase();
  if(v === '') return def;
  return (v === '1' || v === 'true' || v === 'yes' || v === 'y');
};

// ✅ accept both: ?mode=research and ?run=research
const RAW_MODE = (q('mode', q('run','normal')) || 'normal').toLowerCase();
const MODE = (RAW_MODE === 'research') ? 'research' : 'normal';

const PID  = q('pid','');
const DIFF = (q('diff','normal') || 'normal').toLowerCase();
const TIME = Math.max(20, Math.min(240, qNum('time', 70)));
const HUB  = q('hub','./hub.html');

// ✅ auto-start rules:
// - if ?autostart=1 (explicit)
// - OR if ?run=research/normal exists (hub sends it often)
// - OR if ?mode=research/normal exists
const AUTO_START = qBool('autostart', false) || hasQ('run') || hasQ('mode');