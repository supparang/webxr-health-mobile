// === /herohealth/fitness-planner/consent-screen.js ===
// Instruction + Consent Screen (20s max, kid-friendly) — local-only

'use strict';

function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
function todayKey(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function keyFor(pid){
  return `HHA_CONSENT_${String(pid||'anon')}_${todayKey()}`;
}

export function shouldShowConsent(pid){
  const QS = new URLSearchParams(location.search);
  const force = QS.get('consent');
  if(force === '1') return true;
  if(force === '0') return false;

  try{
    const k = keyFor(pid);
    return !localStorage.getItem(k);
  }catch(_){
    return true;
  }
}

export function runConsentScreen(opts){
  const o = Object.assign({
    pid:'anon',
    studyId:'',
    onDone:null // (result)=>{}
  }, opts||{});

  const k = keyFor(o.pid);

  const ov = document.createElement('div');
  ov.style.cssText = `
    position:fixed; inset:0; z-index:99999;
    background:rgba(0,0,0,.78);
    display:flex; align-items:center; justify-content:center;
    padding:16px;
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
    color:rgba(255,255,255,.94);
  `;

  ov.innerHTML = `
    <div style="width:min(760px,96vw); max-height:86vh; overflow:auto;
      background:rgba(15,23,42,.94); border:1px solid rgba(255,255,255,.16);
      border-radius:18px; box-shadow:0 18px 60px rgba(0,0,0,.55); overflow:hidden;">
      
      <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.10); display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <div style="font-weight:900; font-size:18px;">📌 คำชี้แจงก่อนเริ่ม (วันนี้)</div>
        <div style="margin-left:auto; opacity:.85; font-size:12px;">
          pid: <span style="font-family:ui-monospace,Menlo,monospace;">${String(o.pid||'anon')}</span>
          ${o.studyId?` | study: ${String(o.studyId)}`:''}
        </div>
      </div>

      <div style="padding:14px; display:grid; gap:12px;">
        <div style="border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); border-radius:16px; padding:12px;">
          <div style="font-weight:900;">👩‍🏫 สำหรับครู/ผู้ปกครอง</div>
          <div style="margin-top:8px; opacity:.92; line-height:1.5; font-size:13px;">
            • กิจกรรมนี้เป็นเกมออกกำลังกายสั้น ๆ เพื่อการเรียนรู้และการวิจัย<br/>
            • บันทึกข้อมูลเฉพาะการเล่นเกม (เช่น เวลา คะแนน การกดถูก/พลาด) <b>ไม่มีการบันทึกเสียง/ภาพ</b><br/>
            • เด็กสามารถหยุดเล่นได้ทุกเมื่อ หากเหนื่อยหรือไม่สบาย<br/>
            • หากมีอาการเวียนหัว/คลื่นไส้ ให้หยุดทันทีและพัก
          </div>
        </div>

        <div style="border:1px solid rgba(255,255,255,.12); background:rgba(0,0,0,.18); border-radius:16px; padding:12px;">
          <div style="font-weight:900;">🧒 สำหรับนักเรียน</div>
          <div style="margin-top:8px; opacity:.92; line-height:1.5; font-size:13px;">
            วันนี้เราจะเล่นเกมสั้น ๆ ให้สนุกและปลอดภัย<br/>
            ✅ ทำตามกติกาในเกม<br/>
            ✅ ถ้าเหนื่อยให้บอกครูและพัก<br/>
            ✅ ตั้งใจเล่นให้ดีที่สุดของเรา
          </div>
        </div>

        <div style="display:grid; gap:10px;">
          <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
            <input id="ccAdult" type="checkbox" style="margin-top:3px;">
            <span style="opacity:.92; font-size:13px;">
              (ครู/ผู้ปกครอง) ยืนยันว่าเข้าใจและยินยอมให้เข้าร่วมกิจกรรมวันนี้
            </span>
          </label>

          <label style="display:flex; gap:10px; align-items:flex-start; cursor:pointer;">
            <input id="ccKid" type="checkbox" style="margin-top:3px;">
            <span style="opacity:.92; font-size:13px;">
              (นักเรียน) ฉันเข้าใจและพร้อมเริ่มเล่นวันนี้
            </span>
          </label>
        </div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
          <div style="margin-right:auto; opacity:.85; font-size:12px;">
            ปุ่มเริ่มจะเปิดใน <span id="ccCountdown" style="font-weight:900;">8</span>s
          </div>
          <button id="ccCancel" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);
            background:rgba(0,0,0,.20); color:#fff; font-weight:900;">ยกเลิก</button>
          <button id="ccStart" disabled style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);
            background:rgba(59,130,246,.20); color:#fff; font-weight:900; opacity:.6;">เริ่มวันนี้</button>
        </div>
      </div>

      <div style="padding:12px 14px; border-top:1px solid rgba(255,255,255,.10); opacity:.85; font-size:12px;">
        หมายเหตุ: ข้อมูลจะถูกเก็บไว้ในเครื่องนี้ (local) เพื่อใช้สรุปผลและการวิเคราะห์
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  const ccAdult = ov.querySelector('#ccAdult');
  const ccKid = ov.querySelector('#ccKid');
  const btnStart = ov.querySelector('#ccStart');
  const btnCancel = ov.querySelector('#ccCancel');
  const cdEl = ov.querySelector('#ccCountdown');

  let cd = 8;
  const t = setInterval(()=>{
    cd = Math.max(0, cd-1);
    cdEl.textContent = String(cd);
    if(cd <= 0){
      clearInterval(t);
      // enable start only if both checked
      const ok = (ccAdult.checked && ccKid.checked);
      btnStart.disabled = !ok;
      btnStart.style.opacity = ok ? '1' : '.6';
      btnStart.style.background = ok ? 'rgba(59,130,246,.35)' : 'rgba(59,130,246,.20)';
    }
  }, 1000);

  function refresh(){
    if(cd > 0) return;
    const ok = (ccAdult.checked && ccKid.checked);
    btnStart.disabled = !ok;
    btnStart.style.opacity = ok ? '1' : '.6';
    btnStart.style.background = ok ? 'rgba(59,130,246,.35)' : 'rgba(59,130,246,.20)';
  }

  ccAdult.addEventListener('change', refresh);
  ccKid.addEventListener('change', refresh);

  btnCancel.addEventListener('click', ()=>{
    clearInterval(t);
    ov.remove();
    try{ o.onDone && o.onDone({ cancelled:true }); }catch(_){}
  });

  btnStart.addEventListener('click', ()=>{
    if(btnStart.disabled) return;
    clearInterval(t);

    const result = {
      cancelled:false,
      ts: Date.now(),
      date: todayKey(),
      pid: String(o.pid||'anon'),
      studyId: String(o.studyId||''),
      adult_ok: ccAdult.checked ? 1 : 0,
      kid_ok: ccKid.checked ? 1 : 0
    };

    try{ localStorage.setItem(k, JSON.stringify(result)); }catch(_){}
    try{ localStorage.setItem('HHA_CONSENT_LAST', JSON.stringify(result)); }catch(_){}

    ov.remove();
    try{ o.onDone && o.onDone(result); }catch(_){}
  });
}