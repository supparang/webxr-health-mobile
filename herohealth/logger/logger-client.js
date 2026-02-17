// === /herohealth/logger/logger-client.js ===
import { HHA_LOGGER } from './logger-config.js';

const LS_QUEUE = 'HHA_LOGGER_QUEUE_V1';

function loadQueue(){
  try{ return JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); }catch{ return []; }
}
function saveQueue(q){
  try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{}
}

export async function logToSheet(kind, payload){
  const body = {
    v: 1,
    kind,                       // 'event' | 'session' | 'profile'
    spreadsheetId: HHA_LOGGER.SPREADSHEET_ID,
    tabs: HHA_LOGGER.TABS,
    at: Date.now(),
    payload
  };

  try{
    const res = await fetch(HHA_LOGGER.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Apps Script บางแบบต้อง no-cors; แต่ no-cors จะอ่านผลไม่ได้
      // ใช้ปกติก่อน ถ้าติด CORS ค่อยสลับเป็น no-cors ในโหมด research
      body: JSON.stringify(body)
    });

    if(!res.ok){
      // queue on non-2xx
      const q = loadQueue();
      q.push(body);
      saveQueue(q);
      return { ok:false, queued:true, status: res.status };
    }

    // ถ้า Apps Script ส่ง JSON กลับได้ จะอ่านได้
    let data = null;
    try{ data = await res.json(); }catch(_){}
    return { ok:true, queued:false, status: res.status, data };

  }catch(err){
    // offline/CORS/network -> queue
    const q = loadQueue();
    q.push(body);
    saveQueue(q);
    return { ok:false, queued:true, error: String(err) };
  }
}

export async function flushQueue(max=50){
  const q = loadQueue();
  if(!q.length) return { ok:true, flushed:0, remaining:0 };

  const sending = q.slice(0, max);
  const rest = q.slice(max);

  let okCount = 0;
  for(const body of sending){
    try{
      const res = await fetch(HHA_LOGGER.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if(res.ok) okCount++;
      else rest.unshift(body); // put back if failed
    }catch(_){
      rest.unshift(body);
    }
  }

  saveQueue(rest);
  return { ok:true, flushed: okCount, remaining: rest.length };
}