// === fitness-research-core.js =======================================
// ใช้ร่วมกันทุกเกม: profile, queue, hybrid save, PDF, CSV, leaderboard
// ====================================================================

export const LS_PROFILE = 'fitness_profile_v1';
export const LS_QUEUE   = 'fitness_offline_queue_v1';

export const STR = {
  th: {
    lbSchool : 'อันดับในโรงเรียน',
    lbClass  : 'อันดับในห้องเรียน'
  }
};

export let FIREBASE_API = '';
export let SHEET_API    = '';
export let PDF_API      = '';
export let LB_API       = '';

export function setEndpoints(cfg = {}){
  FIREBASE_API = cfg.firebase || '';
  SHEET_API    = cfg.sheet    || '';
  PDF_API      = cfg.pdf      || '';
  LB_API       = cfg.lb       || '';
}

// -------------------- Profile --------------------
export function getProfile(){
  try{
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
export function saveProfile(p){
  try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch{}
}
export function ensureProfile(){
  let p = getProfile();
  if (p) return p;
  const studentId = prompt('Student ID:');
  const name      = prompt('ชื่อที่ใช้ในเกม:');
  const school    = prompt('โรงเรียน / หน่วยงาน:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1:');
  p = { studentId, name, school, class: klass, lang:'th' };
  saveProfile(p);
  return p;
}

// -------------------- Queue --------------------
export function loadQueue(){
  try{
    const raw = localStorage.getItem(LS_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
export function saveQueue(q){
  try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{}
}
export async function flushQueue(hybridSaveFn){
  const q = loadQueue();
  if (!q.length) return;
  const remain = [];
  for (const item of q){
    try{
      await hybridSaveFn(item,false);
    }catch{
      remain.push(item);
    }
  }
  saveQueue(remain);
}

// -------------------- Hybrid Save --------------------
export async function hybridSaveSession(summary, allowQueue = true){
  const body = JSON.stringify(summary);
  const headers = { 'Content-Type':'application/json' };
  let ok = true;
  try{
    const tasks = [];
    if (FIREBASE_API) tasks.push(fetch(FIREBASE_API,{ method:'POST', headers, body }));
    if (SHEET_API)    tasks.push(fetch(SHEET_API   ,{ method:'POST', headers, body }));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){
    console.warn('Fitness save fail', e);
    ok = false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// -------------------- PDF --------------------
export async function exportPDF(summary){
  if (!PDF_API){
    alert('ยังไม่ได้ตั้งค่า PDF_API');
    return;
  }
  try{
    const res = await fetch(PDF_API,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(summary)
    });
    if (!res.ok) throw new Error('PDF API error');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${summary.game}_Report_${summary.profile.studentId || 'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}

// -------------------- CSV --------------------
export function downloadCSVRow(summary){
  const headers = [
    'timestamp','studentId','name','school','class',
    'game','diff','score','hits','miss','accuracy',
    'comboMax','notesPerMin','rank','device'
  ];
  const p = summary.profile || {};
  const row = [
    summary.timestamp,
    p.studentId || '',
    p.name || '',
    p.school || '',
    p.class || '',
    summary.game,
    summary.diff || '',
    summary.score ?? '',
    summary.hits ?? '',
    summary.miss ?? '',
    (summary.accuracy*100).toFixed(1),
    summary.comboMax ?? '',
    summary.notesPerMin != null ? summary.notesPerMin.toFixed(2) : '',
    summary.rank || '',
    summary.device || ''
  ];

  const csv = headers.join(',') + '\n' + row.join(',');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `${summary.game}_${p.studentId||'user'}_${summary.timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------- Leaderboard --------------------
export async function loadLeaderboard(scope, profile){
  if (!LB_API) return [];
  const url = new URL(LB_API);
  url.searchParams.set('scope', scope);
  url.searchParams.set('school', profile.school||'');
  url.searchParams.set('class',  profile.class||'');
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();
}

export function detectDevice(){
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if (/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}

export function buildLBTable(rows, labelSchool='อันดับในโรงเรียน', labelClass='อันดับในห้องเรียน'){
  const container = document.createElement('div');

  const mkTable = (title, data) => {
    const h = document.createElement('h4');
    h.textContent = title;
    container.appendChild(h);

    const table = document.createElement('table');
    table.style.width = '100%';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>แม่นยำ</th></tr>';
    table.appendChild(thead);
    const tb = document.createElement('tbody');
    (data || []).slice(0,10).forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${i+1}</td><td>${r.name||'-'}</td><td>${r.score||0}</td><td>${Math.round((r.accuracy||0)*100)}%</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    container.appendChild(table);
  };

  mkTable(labelSchool, rows.school || []);
  mkTable(labelClass, rows.class  || []);

  return container;
}