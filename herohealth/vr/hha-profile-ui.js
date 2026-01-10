// === /herohealth/vr/hha-profile-ui.js ===
// HHA Profile UI — PRODUCTION (StartOverlay embed)
// ✅ Minimal form for research profile (studentKey, grade, etc.)
// ✅ Save to localStorage via window.HHA_PROFILE (from hha-cloud-logger.js PATCH)
// ✅ On Save: writes query params + adds profile=1 (one-time send to students-profile) + reload
// ✅ Works for any game page that has #startOverlay (optional)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_PROFILE_UI__) return;
  WIN.__HHA_PROFILE_UI__ = true;

  const qs = (k, def='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function getProfileApi(){
    return WIN.HHA_PROFILE || null; // จาก hha-cloud-logger.js ที่เรา PATCH ในข้อ 10
  }

  function readStored(){
    const api = getProfileApi();
    try{ return api?.get?.() || {}; }catch(_){ return {}; }
  }

  function setStored(p){
    const api = getProfileApi();
    try{ return api?.set?.(p) || p; }catch(_){ return p; }
  }

  function merge(a,b){
    return Object.assign({}, a||{}, b||{});
  }

  function fromUrl(){
    // ใช้ชื่อ key ให้สอดคล้องกับ schema ที่คุณใช้ในชีต
    const u = (k)=> String(qs(k,'')||'').trim();
    const p = {
      studentKey: u('studentKey') || u('sessionId'),
      schoolCode: u('schoolCode'),
      schoolName: u('schoolName'),
      classRoom:  u('classRoom'),
      studentNo:  u('studentNo'),
      nickName:   u('nickName'),
      gender:     u('gender'),
      age:        u('age'),
      gradeLevel: u('gradeLevel'),
      heightCm:   u('heightCm'),
      weightKg:   u('weightKg'),
      bmi:        u('bmi'),
      bmiGroup:   u('bmiGroup'),
      vrExperience: u('vrExperience'),
      gameFrequency: u('gameFrequency'),
      handedness: u('handedness'),
      visionIssue: u('visionIssue'),
      healthDetail: u('healthDetail'),
      consentParent: u('consentParent'),
      studyId: u('studyId'),
      siteCode: u('siteCode'),
      semester: u('semester'),
      schoolYear: u('schoolYear'),
      conditionGroup: u('conditionGroup'),
      sessionOrder: u('sessionOrder'),
    };
    for (const k of Object.keys(p)){
      if (p[k]==null || String(p[k]).trim()==='') delete p[k];
    }
    return p;
  }

  function upsertToUrl(nextProfile){
    const u = new URL(location.href);

    // เขียนเฉพาะ field ที่มีค่า
    const keys = Object.keys(nextProfile||{});
    for (const k of keys){
      const v = String(nextProfile[k] ?? '').trim();
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    }

    // ให้ส่งไป students-profile one-time
    u.searchParams.set('profile','1');
    // bust
    u.searchParams.set('ts', String(Date.now()));
    return u.toString();
  }

  function ensureStyle(){
    if (DOC.getElementById('hha-profile-ui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-profile-ui-style';
    st.textContent = `
      .hha-prof{
        margin-top:12px;
        border:1px solid rgba(148,163,184,.16);
        background:rgba(2,6,23,.45);
        border-radius:18px;
        padding:12px;
      }
      .hha-prof .row{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:10px;
        margin-top:10px;
      }
      .hha-prof label{
        display:block;
        font-size:12px;
        color:rgba(148,163,184,.95);
        margin:0 0 6px 0;
      }
      .hha-prof input, .hha-prof select{
        width:100%;
        padding:10px 10px;
        border-radius:14px;
        border:1px solid rgba(148,163,184,.16);
        background:rgba(15,23,42,.58);
        color:#e5e7eb;
        outline:none;
        font-weight:700;
        font-size:13px;
      }
      .hha-prof .row3{
        display:grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap:10px;
        margin-top:10px;
      }
      .hha-prof .miniNote{
        margin-top:10px;
        font-size:12px;
        color:rgba(229,231,235,.84);
        line-height:1.35;
        white-space:pre-line;
      }
      .hha-prof .actions{
        margin-top:10px;
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
      }
      .hha-prof .tag{
        font-size:12px;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.16);
        background:rgba(15,23,42,.52);
        color:rgba(229,231,235,.88);
      }
      .hha-prof .err{
        margin-top:8px;
        color:#fca5a5;
        font-size:12px;
        font-weight:800;
        display:none;
      }
    `;
    DOC.head.appendChild(st);
  }

  function mount(){
    // ต้องมี start overlay card
    const overlay = DOC.getElementById('startOverlay');
    if (!overlay) return;

    // ถ้ามีแล้วไม่ซ้อน
    if (DOC.getElementById('hhaProfileBox')) return;

    ensureStyle();

    // ใส่ไว้ใน .card ถ้ามี ไม่งั้นใส่ใน overlay
    const host = overlay.querySelector('.card') || overlay;

    const box = DOC.createElement('div');
    box.className = 'hha-prof';
    box.id = 'hhaProfileBox';
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <div style="font-weight:900;letter-spacing:.2px;">🧑‍🎓 Student Profile (สำหรับวิจัย)</div>
        <div class="tag" id="hhaProfStatus">unsaved</div>
      </div>

      <div class="row">
        <div>
          <label>studentKey *</label>
          <input id="p_studentKey" placeholder="เช่น STU001" />
        </div>
        <div>
          <label>nickName</label>
          <input id="p_nickName" placeholder="ชื่อเล่น" />
        </div>
      </div>

      <div class="row3">
        <div>
          <label>gradeLevel</label>
          <input id="p_gradeLevel" placeholder="5" inputmode="numeric" />
        </div>
        <div>
          <label>age</label>
          <input id="p_age" placeholder="11" inputmode="numeric" />
        </div>
        <div>
          <label>gender</label>
          <select id="p_gender">
            <option value="">—</option>
            <option value="F">F</option>
            <option value="M">M</option>
            <option value="O">O</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label>schoolCode</label>
          <input id="p_schoolCode" placeholder="S01" />
        </div>
        <div>
          <label>classRoom</label>
          <input id="p_classRoom" placeholder="ป.5/1" />
        </div>
      </div>

      <div class="row">
        <div>
          <label>studentNo</label>
          <input id="p_studentNo" placeholder="12" inputmode="numeric" />
        </div>
        <div>
          <label>consentParent</label>
          <select id="p_consentParent">
            <option value="">—</option>
            <option value="Y">Y</option>
            <option value="N">N</option>
          </select>
        </div>
      </div>

      <div class="miniNote">
• กรอกครั้งแรกครั้งเดียว → ระบบจะจำไว้และแนบไปกับ session/events ทุกเกมอัตโนมัติ
• ปุ่ม Save จะใส่ profile=1 เพื่อส่งเข้าแท็บ students-profile “ครั้งเดียว” (มี dedupe กันยิงซ้ำ)
      </div>

      <div class="actions">
        <button class="btn cyan" id="btnProfSave">💾 Save Profile</button>
        <button class="btn" id="btnProfUseStored">↩️ Load Stored</button>
        <button class="btn" id="btnProfClear">🧹 Clear</button>
      </div>

      <div class="err" id="p_err">กรอก studentKey ก่อนนะ</div>
    `;

    host.appendChild(box);

    // preload values: URL -> stored -> form
    const urlP = fromUrl();
    const stored = readStored();
    const init = merge(stored, urlP);

    const setVal = (id, v)=>{
      const el = DOC.getElementById(id);
      if (!el) return;
      el.value = (v==null ? '' : String(v));
    };
    setVal('p_studentKey', init.studentKey || '');
    setVal('p_nickName', init.nickName || '');
    setVal('p_gradeLevel', init.gradeLevel || '');
    setVal('p_age', init.age || '');
    setVal('p_gender', init.gender || '');
    setVal('p_schoolCode', init.schoolCode || '');
    setVal('p_classRoom', init.classRoom || '');
    setVal('p_studentNo', init.studentNo || '');
    setVal('p_consentParent', init.consentParent || '');

    function status(txt){
      const s = DOC.getElementById('hhaProfStatus');
      if (s) s.textContent = txt;
    }

    function collect(){
      const g = (id)=> (DOC.getElementById(id)?.value ?? '').trim();
      const p = {
        studentKey: g('p_studentKey'),
        nickName: g('p_nickName'),
        gradeLevel: g('p_gradeLevel'),
        age: g('p_age'),
        gender: g('p_gender'),
        schoolCode: g('p_schoolCode'),
        classRoom: g('p_classRoom'),
        studentNo: g('p_studentNo'),
        consentParent: g('p_consentParent'),
      };
      // clean empty
      for (const k of Object.keys(p)){
        if (p[k]==null || String(p[k]).trim()==='') delete p[k];
      }
      // normalize numbers
      if (p.age) p.age = String(clamp(parseInt(p.age,10)||0, 0, 99));
      if (p.gradeLevel) p.gradeLevel = String(clamp(parseInt(p.gradeLevel,10)||0, 0, 20));
      if (p.studentNo) p.studentNo = String(clamp(parseInt(p.studentNo,10)||0, 0, 999));
      return p;
    }

    const errEl = DOC.getElementById('p_err');

    DOC.getElementById('btnProfSave')?.addEventListener('click', ()=>{
      const p = collect();
      if (!p.studentKey){
        if (errEl) errEl.style.display='block';
        return;
      }
      if (errEl) errEl.style.display='none';

      const saved = setStored(p);
      status('saved');

      // reload พร้อม profile=1
      location.href = upsertToUrl(saved);
    });

    DOC.getElementById('btnProfUseStored')?.addEventListener('click', ()=>{
      const s = readStored();
      setVal('p_studentKey', s.studentKey || '');
      setVal('p_nickName', s.nickName || '');
      setVal('p_gradeLevel', s.gradeLevel || '');
      setVal('p_age', s.age || '');
      setVal('p_gender', s.gender || '');
      setVal('p_schoolCode', s.schoolCode || '');
      setVal('p_classRoom', s.classRoom || '');
      setVal('p_studentNo', s.studentNo || '');
      setVal('p_consentParent', s.consentParent || '');
      status('loaded');
      if (errEl) errEl.style.display='none';
    });

    DOC.getElementById('btnProfClear')?.addEventListener('click', ()=>{
      try{ WIN.HHA_PROFILE?.clear?.(); }catch(_){}
      setVal('p_studentKey','');
      setVal('p_nickName','');
      setVal('p_gradeLevel','');
      setVal('p_age','');
      setVal('p_gender','');
      setVal('p_schoolCode','');
      setVal('p_classRoom','');
      setVal('p_studentNo','');
      setVal('p_consentParent','');
      status('cleared');
      if (errEl) errEl.style.display='none';
    });
  }

  // mount after DOM ready
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();