// === /herohealth/api/api-probe.js ===
// HeroHealth — lightweight API probe (no Apollo)
// ✅ POST ping to endpoint (best-effort)
// ✅ Reports status -> window.HHA_API_STATUS
// ✅ Optional retry/backoff

'use strict';

const WIN = window;

function setStatus(s){
  try{
    if(WIN.HHA_API_STATUS && typeof WIN.HHA_API_STATUS.set === 'function'){
      WIN.HHA_API_STATUS.set(s);
    }else{
      WIN.dispatchEvent(new CustomEvent('hha:api-status', { detail: s }));
    }
  }catch(_){}
}

function normUrl(u){
  try{ return String(u||'').trim(); }catch{ return ''; }
}

function asText(v){
  try{ return String(v ?? ''); }catch{ return ''; }
}

function now(){
  return Date.now();
}

/**
 * probeAPI(endpoint, opts?)
 * opts:
 * - timeoutMs (default 6000)
 * - payload (default { ping:true })
 * - method (default POST)
 * - headers (default {'content-type':'application/json'})
 * - mode (default 'cors')
 * - okStatuses (default [200,204])
 */
export async function probeAPI(endpoint, opts={}){
  const ep = normUrl(endpoint);
  const timeoutMs = Math.max(1500, Math.min(20000, Number(opts.timeoutMs ?? 6000) || 6000));
  const payload = (opts.payload && typeof opts.payload === 'object') ? opts.payload : { ping:true };
  const method = asText(opts.method || 'POST').toUpperCase();
  const headers = (opts.headers && typeof opts.headers === 'object')
    ? opts.headers
    : { 'content-type':'application/json' };
  const mode = asText(opts.mode || 'cors');
  const okStatuses = Array.isArray(opts.okStatuses) && opts.okStatuses.length ? opts.okStatuses : [200,204];

  if(!ep){
    setStatus({
      level:'warn',
      title:'ยังไม่ได้ตั้งค่า API',
      msg:'Hub ใช้งานได้ปกติ • ตั้ง endpoint เมื่อพร้อม',
      detail:'endpoint ว่าง',
      endpoint: '',
      ts: now()
    });
    return { ok:false, status:0 };
  }

  setStatus({
    level:'warn',
    title:'กำลังตรวจสอบระบบ…',
    msg:'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)',
    detail:`endpoint: ${ep}`,
    endpoint: ep,
    ts: now()
  });

  const ctrl = new AbortController();
  const t = setTimeout(()=>{ try{ ctrl.abort(); }catch(_){ } }, timeoutMs);

  try{
    const res = await fetch(ep, {
      method,
      mode,
      headers,
      signal: ctrl.signal,
      body: method === 'GET' ? undefined : JSON.stringify(payload)
    });

    const st = res.status;

    if(okStatuses.includes(st)){
      setStatus({
        level:'ok',
        title:'ออนไลน์ ✅',
        msg:'API ตอบกลับปกติ (Hub ใช้งานเต็มรูปแบบ)',
        detail:`endpoint: ${ep}\nstatus: ${st}`,
        endpoint: ep,
        ts: now()
      });
      return { ok:true, status: st, res };
    }

    if(st === 403){
      setStatus({
        level:'bad',
        title:'403 Forbidden ⚠️',
        msg:'API ปฏิเสธสิทธิ์/Origin แต่ Hub ยังเข้าเกมได้ปกติ',
        detail:[
          `endpoint: ${ep}`,
          `status: 403`,
          `hint: ตรวจ CORS (allow origin: https://supparang.github.io)`,
          `hint: ตรวจ Authorizer/IAM/Token`,
          `hint: ตรวจ path ที่ถูกต้อง (/graphql หรือ /prod/graphql)`
        ].join('\n'),
        endpoint: ep,
        ts: now()
      });
      return { ok:false, status: st, res };
    }

    setStatus({
      level:'warn',
      title:`API ตอบ ${st}`,
      msg:'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers',
      detail:`endpoint: ${ep}\nstatus: ${st}`,
      endpoint: ep,
      ts: now()
    });
    return { ok:false, status: st, res };

  }catch(err){
    const msg = (err && err.name === 'AbortError')
      ? `timeout ${timeoutMs}ms`
      : asText(err?.message || err);

    setStatus({
      level:'bad',
      title:'ออฟไลน์/เชื่อมต่อไม่ได้',
      msg:'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS',
      detail:`endpoint: ${ep}\nerror: ${msg}`,
      endpoint: ep,
      ts: now()
    });
    return { ok:false, status: 0, error: err };
  }finally{
    clearTimeout(t);
  }
}

/**
 * probeWithBackoff(endpoint, attempts=3)
 * - waits 0.4s, 0.9s, 1.6s ...
 */
export async function probeWithBackoff(endpoint, attempts=3, opts={}){
  let n = Math.max(1, Math.min(6, Number(attempts)||3));
  let last = null;
  for(let i=0;i<n;i++){
    last = await probeAPI(endpoint, opts);
    if(last && last.ok) return last;
    const wait = Math.round(400 + i*i*500);
    await new Promise(r=>setTimeout(r, wait));
  }
  return last;
}