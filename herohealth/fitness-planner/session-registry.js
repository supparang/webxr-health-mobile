// === /herohealth/fitness-planner/session-registry.js ===
// Session Registry (local-only) for fast dashboard/export

'use strict';

const KEY = 'HHA_FIT_SESSIONS'; // array of session index records
const MAX_KEEP = 600;           // กันโตเกิน (ปรับได้)

function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
function nowMs(){ return Date.now(); }
function todayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function loadAll(){
  try{ return safeParseJSON(localStorage.getItem(KEY) || '[]') || []; }
  catch(_){ return []; }
}
function saveAll(arr){
  try{ localStorage.setItem(KEY, JSON.stringify(arr)); }catch(_){}
}

function findIdx(arr, sid){
  return arr.findIndex(x => String(x.sessionId) === String(sid));
}

export function regStartSession(meta){
  // meta: {sessionId,pid,run,gameId,gameName,diff,seed,time,conditionGroup,studyId,phase,view,ai,boss}
  const sid = String(meta?.sessionId||'');
  if(!sid) return;

  const arr = loadAll();
  const i = findIdx(arr, sid);

  const rec = Object.assign({
    sessionId: sid,
    ts_start: nowMs(),
    date: todayKey(),
    ended: 0
  }, meta||{});

  if(i>=0){
    arr[i] = Object.assign(arr[i], rec);
  } else {
    arr.unshift(rec); // newest first
  }

  // cap
  while(arr.length > MAX_KEEP) arr.pop();

  saveAll(arr);
}

export function regEndSession(sid, patch){
  sid = String(sid||'');
  if(!sid) return;

  const arr = loadAll();
  const i = findIdx(arr, sid);
  if(i<0){
    // ถ้าไม่มี record (edge case) ก็สร้างให้
    arr.unshift({ sessionId:sid, ts_start: nowMs(), date: todayKey(), ended:1 });
  }
  const j = (i>=0? i : 0);

  arr[j] = Object.assign(arr[j], {
    ts_end: nowMs(),
    ended: 1
  }, patch||{});

  saveAll(arr);
}

export function regUpdateSession(sid, patch){
  sid = String(sid||'');
  if(!sid) return;

  const arr = loadAll();
  const i = findIdx(arr, sid);
  if(i<0) return;

  arr[i] = Object.assign(arr[i], patch||{});
  saveAll(arr);
}

export function regListSessions(filter){
  const arr = loadAll();
  if(!filter) return arr;

  const f = Object.assign({
    date: '',      // 'YYYY-MM-DD'
    pid: '',
    run: '',
    gameId: ''
  }, filter||{});

  return arr.filter(r=>{
    if(f.date && String(r.date) !== String(f.date)) return false;
    if(f.pid && String(r.pid) !== String(f.pid)) return false;
    if(f.run && String(r.run) !== String(f.run)) return false;
    if(f.gameId && String(r.gameId) !== String(f.gameId)) return false;
    return true;
  });
}

export function regClearAll(){
  try{ localStorage.removeItem(KEY); }catch(_){}
}