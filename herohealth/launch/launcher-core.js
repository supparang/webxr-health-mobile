// === /herohealth/launch/launcher-core.js ===
// HeroHealth Launcher Core — v20260212b
// ✅ Auto pass-through hub/run/diff/time/seed/studyId/phase/conditionGroup/pid/group/note
// ✅ Auto-append ?log= (Cloud Logger Web App URL)
// ✅ Remember last log URL (optional)
// ✅ Never override if target already has that key

export function hhGo(targetUrl, opt = {}){
  const defaults = opt.defaults || {};
  const rememberLog = !!opt.rememberLog;
  const preferQueryLog = (opt.preferQueryLog !== false); // default true

  const LS_LAST_LOG = 'HHA_LAST_LOG_URL';

  const srcQS = safeQS(location.href);

  // 1) pick log URL
  let logUrl = '';
  const qLog  = (srcQS.get('log') || '').trim();
  const lsLog = (rememberLog ? (localStorage.getItem(LS_LAST_LOG) || '').trim() : '');
  const defLog = (defaults.log || '').trim();

  if (preferQueryLog && qLog) logUrl = qLog;
  else if (lsLog) logUrl = lsLog;
  else if (defLog) logUrl = defLog;

  // remember (only if present)
  if (rememberLog && logUrl){
    try{ localStorage.setItem(LS_LAST_LOG, logUrl); }catch(_){}
  }

  // 2) build outgoing URL
  const out = new URL(targetUrl, location.href);
  const outQS = out.searchParams;

  // helper: set if missing
  const setIfMissing = (k, v)=>{
    if (v==null) return;
    const vv = String(v).trim();
    if (!vv) return;
    if (!outQS.has(k)) outQS.set(k, vv);
  };

  // 3) apply defaults (only if missing)
  Object.keys(defaults).forEach(k=>{
    if (k === 'log') return; // handled separately
    setIfMissing(k, defaults[k]);
  });

  // 4) pass-through keys from current URL (if present)
  const PASS_KEYS = [
    'hub','run',
    'mode','gameMode','runMode',
    'diff','difficulty',
    'duration','time',
    'seed',
    'studyId','phase','conditionGroup',
    'pid','group','note',
    'siteCode','schoolCode','schoolName','classRoom','studentNo','nickName',
    'sessionOrder','blockLabel',
    'projectTag','runId'
  ];
  PASS_KEYS.forEach(k=>{
    const v = (srcQS.get(k) || '').trim();
    if (v) setIfMissing(k, v);
  });

  // 5) finally set log
  if (logUrl) setIfMissing('log', logUrl);

  // 6) redirect
  location.replace(out.toString());
}

function safeQS(href){
  try { return new URL(href).searchParams; }
  catch { return new URLSearchParams(); }
}