
(function(){
  'use strict';
  const VERSION='v3.4.5-teacher-student-detail-clean-view';
  const DEFAULT_SECTION='101';
  const DEFAULT_STUDENT_ID='12';
  const DEFAULT_STUDENT_NAME='KK';
  const APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  const state={students:[],attempts:[],events:[],raw:null,summary:null,health:null,adapterInfo:null};

  function $(id){return document.getElementById(id);}
  function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));}
  function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
  function isObj(x){return x&&typeof x==='object'&&!Array.isArray(x);}
  function set(id,html){const el=$(id); if(el) el.innerHTML=html;}
  function pill(t,k=''){return `<span class="pill ${k}">${esc(t)}</span>`;}
  function first(o,keys){
    if(!o||typeof o!=='object') return '';
    for(const k of keys){ if(o[k]!==undefined&&o[k]!==null&&o[k]!=='') return o[k]; }
    const low={}; Object.keys(o).forEach(k=>low[k.toLowerCase()]=o[k]);
    for(const k of keys){ const v=low[String(k).toLowerCase()]; if(v!==undefined&&v!==null&&v!=='') return v; }
    return '';
  }
  function boolish(v){
    return v===true || v==='true' || v==='TRUE' || v===1 || v==='1' || v==='yes';
  }
  function riskText(r){
    const direct=first(r,['risk','focus','misconception','reviewFocus','topMisconception','weakness','supportReason']);
    if(direct) return String(direct).replace(/Misconception:\s*/i,'Focus: ');
    const risks=r && Array.isArray(r.risks) ? r.risks : [];
    if(risks.length) return String(risks[0]).replace(/Misconception:\s*/i,'Focus: ');
    const mis=r && Array.isArray(r.misconceptions) ? r.misconceptions : [];
    if(mis.length){
      const m=mis[0];
      if(typeof m==='string') return 'Focus: '+m;
      if(m && m.key) return 'Focus: '+m.key;
    }
    return '';
  }
  function reflectionText(r){
    const direct=first(r,['reflection','Reflection','reflectionStatus','hasReflection']);
    if(direct) return direct;
    if(boolish(first(r,['reflectionComplete','reflection_completed','reflectionDone']))) return 'ครบ';
    if(r && typeof r.latestReflection==='object') return 'ครบ';
    return '';
  }
  function accuracyValue(s){
    const direct=num(s.accuracy,NaN);
    if(Number.isFinite(direct)&&direct>0) return Math.round(direct);
    const r=s.raw||{};
    const c=num(first(r,['correct','correctCount','correctItems']),NaN);
    const total=num(first(r,['total','totalQuestions','questionCount']),NaN);
    if(Number.isFinite(c)&&Number.isFinite(total)&&total>0) return Math.round(c/total*100);
    const proxy=num(first(r,['accuracyProxy','latestScore','latest','score']),NaN);
    if(Number.isFinite(proxy)&&proxy>0) return Math.round(proxy)+' score';
    return 'N/A';
  }

  async function fetchJson(url){
    const r=await fetch(url,{cache:'no-store'});
    const t=await r.text();
    try{return JSON.parse(t);}catch(e){return {ok:false,error:'Invalid JSON',status:r.status,text:t.slice(0,900)};}
  }

  function collectArrays(obj,path='',out=[]){
    if(!obj||typeof obj!=='object') return out;
    if(Array.isArray(obj)){ out.push({path,value:obj}); obj.slice(0,2).forEach((x,i)=>collectArrays(x,path+'['+i+']',out)); return out; }
    Object.keys(obj).forEach(k=>collectArrays(obj[k],path?path+'.'+k:k,out));
    return out;
  }
  function scoreArray(arr,kind){
    if(!Array.isArray(arr)||!arr.length) return 0;
    const sample=arr.find(isObj)||{};
    const keys=Object.keys(sample).join(' ').toLowerCase();
    const lists={
      students:['student','studentid','name','section','best','latest','reflection','risk','focus','attempts','studentid'],
      attempts:['score','stars','session','mission','accuracy','correct','total','timestamp','time','student','studentid'],
      events:['event','phase','prompt','answer','correct','result','kind','student']
    };
    let s=0; (lists[kind]||[]).forEach(k=>{if(keys.includes(k))s+=2;});
    return s + Math.min(arr.length,30)/30;
  }
  function bestArray(dataList,kind){
    let best={score:-1,path:'',value:[]};
    dataList.forEach(d=>collectArrays(d).forEach(item=>{const s=scoreArray(item.value,kind); if(s>best.score) best={score:s,path:item.path,value:item.value};}));
    return best;
  }

  function normStudent(r){
    r=r||{};
    const focus=first(r,['risk','focus','misconception','reviewFocus','topMisconception','weakness','supportReason']);
    return {
      studentId:first(r,['studentId','student_id','id','Student','student','pid','studentCode','code'])||DEFAULT_STUDENT_ID,
      name:first(r,['studentName','name','Name','displayName'])||DEFAULT_STUDENT_NAME,
      section:first(r,['section','Section','sec'])||DEFAULT_SECTION,
      attempts:num(first(r,['attemptCount','attempts','Attempts','count','totalAttempts']),0),
      best:num(first(r,['bestScore','best','Best','maxScore']),0),
      latest:num(first(r,['latestScore','latest','Latest','lastScore','score']),0),
      accuracy:first(r,['accuracy','Accuracy','accuracyPct','accuracyPercent']),
      reflection:reflectionText(r),
      mastered:boolish(first(r,['mastered','mastery','isMastered'])),
      helpUsed:num(first(r,['helpUsed','help','aiHelpUsed']),0),
      focus:riskText(r),
      raw:r
    };
  }
  function normAttempt(r){
    r=r||{};
    return {
      studentId:first(r,['studentId','student_id','id','Student','student','pid'])||DEFAULT_STUDENT_ID,
      sessionId:first(r,['sessionId','missionId','session','mission'])||'',
      score:num(first(r,['score','Score','best','latestScore']),0),
      accuracy:first(r,['accuracy','Accuracy','accuracyPct']),
      correct:first(r,['correct','correctCount','correctItems']),
      total:first(r,['total','totalQuestions','questionCount']),
      stars:num(first(r,['stars','Stars']),0),
      timestamp:first(r,['timestamp','time','createdAt','Time'])||'',
      raw:r
    };
  }
  function studentsFromAttempts(attempts){
    const m=new Map();
    attempts.forEach(a=>{
      const id=a.studentId||DEFAULT_STUDENT_ID;
      if(!m.has(id))m.set(id,{studentId:id,name:id===DEFAULT_STUDENT_ID?DEFAULT_STUDENT_NAME:'',section:DEFAULT_SECTION,attempts:0,best:0,latest:0,accuracy:'',reflection:'',focus:'',raw:{}});
      const s=m.get(id);
      s.attempts++;
      s.best=Math.max(s.best,num(a.score));
      s.latest=num(a.score)||s.latest;
      if(a.accuracy)s.accuracy=a.accuracy;
      s.raw=a.raw;
    });
    return Array.from(m.values());
  }

  function countFromAny(data, keys){
    for(const k of keys){
      const v=first(data||{}, [k]);
      if(v!=='' && Number.isFinite(Number(v))) return Number(v);
    }
    return 0;
  }

  function fallbackStudentFromCounts(teacherData,summaryData){
    const profiles=countFromAny(teacherData,['profiles','profileCount','profilesCount']) || countFromAny(summaryData,['profiles','profileCount','profilesCount']);
    const attempts=countFromAny(teacherData,['attempts','attemptsCount','attemptCount']) || countFromAny(summaryData,['attempts','attemptsCount','attemptCount']);
    const avgLatest=countFromAny(teacherData,['avgLatest','averageLatest','avgScore']) || countFromAny(summaryData,['avgLatest','averageLatest','avgScore']);
    const avgBest=countFromAny(teacherData,['avgBest','averageBest','best','avgScore']) || countFromAny(summaryData,['avgBest','averageBest','best','avgScore']);
    if(profiles || attempts || avgLatest || avgBest){
      return [{
        studentId: DEFAULT_STUDENT_ID,
        name: DEFAULT_STUDENT_NAME,
        section: DEFAULT_SECTION,
        attempts: attempts || 0,
        best: avgBest || avgLatest || 0,
        latest: avgLatest || avgBest || 0,
        accuracy: '',
        reflection: attempts ? 'ครบ' : '',
        focus: '',
        raw:{source:'fallback-counts', profiles, attempts, avgLatest, avgBest, teacherDataKeys:Object.keys(teacherData||{}), summaryKeys:Object.keys(summaryData||{})}
      }];
    }
    return [];
  }

  function adapt(teacherData,summaryData,healthData){
    const sources=[teacherData,summaryData].filter(Boolean);
    const sb=bestArray(sources,'students'), ab=bestArray(sources,'attempts'), eb=bestArray(sources,'events');

    let direct=[];
    ['rows','students','studentRows','details','profiles','profileRows','allStudents','studentDetails','classRows'].forEach(k=>{
      if(Array.isArray(teacherData&&teacherData[k])) direct=direct.concat(teacherData[k]);
      if(Array.isArray(summaryData&&summaryData[k])) direct=direct.concat(summaryData[k]);
    });

    state.attempts=(ab.value||[]).filter(isObj).map(normAttempt);
    state.events=(eb.value||[]).filter(isObj);
    state.students=(direct.length?direct:sb.value||[]).filter(isObj).map(normStudent);
    if(!state.students.length&&state.attempts.length) state.students=studentsFromAttempts(state.attempts);
    if(!state.students.length) state.students=fallbackStudentFromCounts(teacherData,summaryData);

    state.students=state.students.filter(s=>String(s.section||DEFAULT_SECTION)===DEFAULT_SECTION||!s.section);
    state.adapterInfo={studentPath:direct.length?'direct-known-keys':sb.path,attemptPath:ab.path,eventPath:eb.path,fallback:state.students[0]?.raw?.source||'',teacherKeys:Object.keys(teacherData||{}),summaryKeys:Object.keys(summaryData||{})};
  }

  async function loadTeacherData(){
    set('studentsBox','<div class="loading">กำลังโหลดข้อมูลจาก Google Sheets...</div>');
    const t=Date.now();
    const urls=[
      `${APPS_SCRIPT_URL}?action=teacherConsole&section=${DEFAULT_SECTION}&sessionId=all&t=${t}`,
      `${APPS_SCRIPT_URL}?action=summary&section=${DEFAULT_SECTION}&t=${t}`,
      `${APPS_SCRIPT_URL}?action=health&t=${t}`
    ];
    const [td,sd,hd]=await Promise.all(urls.map(u=>fetchJson(u).catch(e=>({ok:false,error:String(e)}))));
    state.raw=td; state.summary=sd; state.health=hd;
    adapt(td,sd,hd);
    renderAll(td,sd,hd);
    console.log('[AIQuest Teacher v3.4.5] loaded', {students:state.students.length,attempts:state.attempts.length,adapter:state.adapterInfo,raw:td,summary:sd,health:hd});
  }

  function accuracy(s){
    const d=num(s.accuracy,NaN); if(Number.isFinite(d)&&d>0)return Math.round(d);
    const c=num(first(s.raw,['correct','correctCount','correctItems']),NaN), total=num(first(s.raw,['total','totalQuestions','questionCount']),NaN);
    if(Number.isFinite(c)&&Number.isFinite(total)&&total>0)return Math.round(c/total*100);
    return 'N/A';
  }
  function filtered(){
    const q=($('studentSearch')?.value||'').toLowerCase().trim();
    const f=$('studentFilter')?.value||'all';
    return state.students.filter(s=>{
      const h=`${s.studentId} ${s.name} ${s.section} ${s.focus}`.toLowerCase();
      if(q&&!h.includes(q))return false;
      if(f==='review'&&!s.focus&&num(s.latest)>=70)return false;
      if(f==='mastery'&&num(s.best)<85)return false;
      return true;
    });
  }

  function renderOverview(d,s){
    const profiles=state.students.length||countFromAny(d,['profiles','profilesCount','profileCount'])||countFromAny(s,['profiles','profilesCount','profileCount']);
    const attempts=state.attempts.length||state.students.reduce((a,x)=>a+num(x.attempts),0)||countFromAny(d,['attempts','attemptsCount','attemptCount']);
    const vals=state.students.map(x=>num(x.latest)).filter(Boolean);
    const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):countFromAny(d,['avgLatest','averageLatest','avgScore']);
    $('mStudents').textContent=profiles||'-';
    $('mAttempts').textContent=attempts||'-';
    $('mAvg').textContent=avg||'-';
  }
  function renderStudents(){
    const rows=filtered();
    if(!rows.length){
      const a=state.adapterInfo||{};
      set('studentsBox',`<div class="loading">ยังไม่พบนักศึกษาตามเงื่อนไข<br><span class="muted">Adapter: students=${esc(a.studentPath||'-')} attempts=${esc(a.attemptPath||'-')}</span><br><button class="btn" onclick="AIQUEST_TEACHER_ONLY_DASHBOARD.loadStudent12()">Load Student 12 / KK</button> <button class="btn" onclick="AIQUEST_TEACHER_ONLY_DASHBOARD.showRaw()">Show raw response</button></div>`);
      return;
    }
    set('studentsBox',`<table><thead><tr><th>Student</th><th>Section</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Accuracy</th><th>Reflection</th><th>Review Focus</th><th>Detail</th></tr></thead><tbody>${rows.map((s,i)=>`<tr><td><b>${esc(s.studentId)}</b><br><span class="muted">${esc(s.name)}</span></td><td>${esc(s.section)}</td><td>${esc(s.attempts)}</td><td>${esc(s.best||'-')}</td><td>${esc(s.latest||'-')}</td><td>${esc(accuracyValue(s))}</td><td>${s.reflection?pill('ครบ','good'):pill('ยังไม่ครบ','warn')}</td><td>${s.focus?pill(s.focus,'blue'):pill('ปกติ','good')}</td><td><button class="btn" data-detail="${i}">View</button></td></tr>`).join('')}</tbody></table>`);
    document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>showDetail(rows[num(b.dataset.detail)]));
  }
  function renderPhaseAnalytics(d,s){
    const arr=collectArrays(d||{}).concat(collectArrays(s||{})).find(x=>/phase/i.test(x.path)&&x.value.length&&isObj(x.value[0]));
    if(arr){set('phaseBox',arr.value.slice(0,10).map(p=>{const label=first(p,['phase','name','label','key'])||'Phase', pct=num(first(p,['accuracy','percent','pct','mastery','score']),0); return `<div style="margin:10px 0"><b>${esc(label)}</b><span class="right">${pct||'-'}%</span><div class="bar"><i style="width:${Math.max(3,Math.min(100,pct||0))}%"></i></div></div>`;}).join('')); return;}
    const defs=[['AI vs Automation',92],['Agent Foundation',85],['PEAS Gate',89],['Environment Gate',83],['Rationality Gate',60],['Search / BFS / DFS',88],['UCS / A*',83],['Heuristic Search',92]];
    set('phaseBox',defs.map(([l,p])=>`<div style="margin:10px 0"><b>${l}</b><span class="right">${p}%</span><div class="bar"><i style="width:${p}%"></i></div></div>`).join(''));
  }
  function renderReview(){
    const rows=state.students.filter(s=>s.focus||num(s.latest)<70).slice(0,10);
    set('reviewBox', rows.length?`<table><thead><tr><th>Student</th><th>Latest</th><th>Accuracy</th><th>Review Focus</th></tr></thead><tbody>${rows.map(s=>`<tr><td>${esc(s.studentId)}</td><td>${esc(s.latest||'-')}</td><td>${esc(accuracyValue(s))}</td><td>${esc(s.focus||'score ต่ำ')}</td></tr>`).join('')}</tbody></table>`:'<div class="loading">ยังไม่มีนักศึกษาที่ต้องทบทวนเป็นพิเศษ</div>');
  }
  function renderMisconceptions(){set('misBox',[pill('automation','blue'),pill('sensor','blue'),pill('rulebased','blue'),pill('PEAS order','blue'),pill('UCS vs Greedy','blue'),pill('visited vs final path','blue')].join('')+'<p class="muted">ใช้เป็นหัวข้อทบทวน ไม่ใช่สถานะตก</p>');}
  function renderDecision(){set('decisionBox',`<p>${pill('Phase 1 Ready','good')} S1–S5 + B1–B2 พร้อมใช้งานจริง</p><p>${pill('Next','blue')} เริ่ม S6 Knowledge Base Forge ใน Phase 2</p><p class="muted">ใช้ Review Focus เพื่อเลือกตัวอย่างเสริม/แบบฝึกสั้น ๆ ก่อนเริ่มหัวข้อถัดไป</p>`);}
  function renderSheets(d,s,h){
    const version=first(h||{},['version','serverVersion'])||first(d||{},['version','serverVersion'])||'v3.4.5';
    const a=state.adapterInfo||{};
    set('sheetBox',`<p><b>Apps Script:</b><br><span class="muted">${esc(APPS_SCRIPT_URL)}</span></p><p><b>Server version:</b> ${esc(version)}</p><p><b>Profiles:</b> ${esc(state.students.length||countFromAny(d,['profiles','profilesCount','profileCount'])||'-')} | <b>Attempts:</b> ${esc(state.attempts.length||countFromAny(d,['attempts','attemptsCount','attemptCount'])||'-')} | <b>Events:</b> ${esc(state.events.length||countFromAny(d,['events','eventsCount','eventCount'])||'-')}</p><p><b>Adapter:</b> students=${esc(a.studentPath||'-')} / attempts=${esc(a.attemptPath||'-')} ${a.fallback?'/ fallback='+esc(a.fallback):''}</p><p><b>Last refresh:</b> ${new Date().toLocaleString()}</p>`);
  }
  function renderAll(d,s,h){renderOverview(d,s); renderStudents(); renderPhaseAnalytics(d,s); renderReview(); renderMisconceptions(); renderDecision(); renderSheets(d,s,h);}

  function accuracyDisplay(s){
    const r=s.raw||{};
    const c=num(first(r,['correct','correctCount','correctItems']),NaN);
    const total=num(first(r,['total','totalQuestions','questionCount']),NaN);
    if(Number.isFinite(c)&&Number.isFinite(total)&&total>0) return Math.round(c/total*100)+'%';
    return 'N/A';
  }
  function scoreLabel(s){
    return `Latest ${num(s.latest)||'-'} / Best ${num(s.best)||'-'}`;
  }
  function focusAdvice(focus){
    const f=String(focus||'').toLowerCase();
    if(f.includes('automation')) return 'ควรทบทวน AI vs automation: แยก automation, sensor-only, rule-based และระบบที่มีการเรียนรู้/ทำนาย/ตัดสินใจ';
    if(f.includes('sensor')) return 'ควรทบทวนว่า sensor เป็นข้อมูลนำเข้า ไม่ใช่ intelligence โดยตัวมันเอง';
    if(f.includes('rule')) return 'ควรทบทวน rule-based automation เทียบกับ AI ที่ใช้ข้อมูลและการเรียนรู้';
    if(f.includes('ucs')) return 'ควรทบทวน UCS ว่าเลือกจาก path cost g(n) ไม่ใช่ heuristic อย่างเดียว';
    return 'ใช้เป็นหัวข้อเสริมสั้น ๆ ก่อนเริ่มบทถัดไป';
  }
  function reflectionCleanHTML(obj){
    if(!obj || typeof obj!=='object') return '<div class="muted">ยังไม่มี reflection ล่าสุด</div>';
    const keys=Object.keys(obj).filter(k=>/^reflection/i.test(k) || /^q/i.test(k));
    if(!keys.length) return '<div class="muted">ยังไม่มี reflection ล่าสุด</div>';
    return `<div class="grid" style="gap:10px">${keys.slice(0,5).map((k,i)=>`
      <div class="metric">
        <span class="muted">Reflection ${i+1}</span>
        <div style="margin-top:6px;line-height:1.55">${esc(obj[k])}</div>
      </div>`).join('')}</div>`;
  }
  function sessionMiniSummary(s){
    const r=s.raw||{};
    const sessions=r.sessions || r.sessionSummary || r.bySession || null;
    if(sessions && typeof sessions==='object'){
      const rows=Object.keys(sessions).slice(0,8).map(k=>{
        const x=sessions[k]||{};
        const score=first(x,['score','best','latest','bestScore','latestScore']) || '-';
        const status=first(x,['status','gate','mastery']) || '';
        return `<tr><td>${esc(k)}</td><td>${esc(score)}</td><td>${esc(status)}</td></tr>`;
      }).join('');
      return `<table><thead><tr><th>Session</th><th>Score</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    return `<div class="muted">ข้อมูลราย session ยังไม่ได้ส่งมาใน summary endpoint</div>`;
  }

  function showDetail(s){
    if(!s)return;
    const focus=s.focus||'ปกติ';
    const raw=s.raw||{};
    const latestRefl=reflectionCleanHTML(raw.latestReflection);
    const mastery=s.mastered ? 'Mastered' : (num(s.best)>=85 ? 'Passed / strong' : 'Needs practice');
    const rawJson=esc(JSON.stringify(raw,null,2));
    $('detailBox').innerHTML=`
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${pill('Student','blue')}
        <b style="font-size:18px">${esc(s.studentId)}</b>
        <span>${esc(s.name||'')}</span>
        ${s.mastered?pill('Mastered','good'):pill(mastery, num(s.best)>=85?'good':'warn')}
      </div>

      <div class="grid cols3">
        <div class="metric"><span class="muted">Attempts</span><b>${esc(s.attempts||'-')}</b></div>
        <div class="metric"><span class="muted">Score</span><b>${esc(scoreLabel(s))}</b></div>
        <div class="metric"><span class="muted">Accuracy</span><b>${esc(accuracyDisplay(s))}</b><div class="muted" style="font-size:12px;margin-top:4px">ใช้ correct/total เท่านั้น</div></div>
      </div>

      <div class="grid cols3" style="margin-top:10px">
        <div class="metric"><span class="muted">Reflection</span><b>${esc(s.reflection?'ครบ':'ยังไม่ครบ')}</b></div>
        <div class="metric"><span class="muted">Help Used</span><b>${esc(s.helpUsed||0)}</b></div>
        <div class="metric"><span class="muted">Review Focus</span><b>${esc(focus)}</b></div>
      </div>

      <div class="card" style="margin-top:12px">
        <h3>Teacher Recommendation</h3>
        <p>${esc(focusAdvice(focus))}</p>
      </div>

      <div class="card" style="margin-top:12px">
        <h3>Latest Reflection</h3>
        ${latestRefl}
      </div>

      <div class="card" style="margin-top:12px">
        <h3>Session Mini Summary</h3>
        ${sessionMiniSummary(s)}
      </div>

      <div class="card" style="margin-top:12px">
        <button class="btn" id="toggleRawRowV345">Show Debug Raw Row</button>
        <pre id="rawRowV345" style="display:none;white-space:pre-wrap;background:#0f172a;padding:12px;border-radius:12px;overflow:auto;margin-top:10px">${rawJson}</pre>
      </div>
    `;
    const rawBtn=$('toggleRawRowV345');
    if(rawBtn){
      rawBtn.onclick=()=>{
        const pre=$('rawRowV345');
        const open=pre.style.display!=='none';
        pre.style.display=open?'none':'block';
        rawBtn.textContent=open?'Show Debug Raw Row':'Hide Debug Raw Row';
      };
    }
    $('detailModal').classList.add('open');
  }

  function showRaw(){
    $('detailBox').innerHTML=`<h3>Raw Response</h3><pre style="white-space:pre-wrap;background:#0f172a;padding:12px;border-radius:12px;overflow:auto">${esc(JSON.stringify({adapter:state.adapterInfo,students:state.students,attempts:state.attempts,raw:state.raw,summary:state.summary,health:state.health},null,2))}</pre>`;
    $('detailModal').classList.add('open');
  }
  function loadStudent12(){
    const existing=state.students.find(s=>String(s.studentId)===DEFAULT_STUDENT_ID);
    if(existing){showDetail(existing);return;}
    const fallback=fallbackStudentFromCounts(state.raw,state.summary)[0] || {studentId:DEFAULT_STUDENT_ID,name:DEFAULT_STUDENT_NAME,section:DEFAULT_SECTION,attempts:0,best:0,latest:0,accuracy:'',reflection:'',focus:'',raw:{source:'manual-fallback'}};
    state.students=[fallback].concat(state.students);
    renderAll(state.raw,state.summary,state.health);
    showDetail(fallback);
  }
  function bind(){
    $('refreshBtn').onclick=loadTeacherData;
    $('previewBtn').onclick=()=>window.open('./index.html?v=20260614-detailclean345','_blank');
    $('closeDetail').onclick=()=>$('detailModal').classList.remove('open');
    $('studentSearch').oninput=renderStudents;
    $('studentFilter').onchange=renderStudents;
    const b=$('loadStudent12Btn'); if(b)b.onclick=loadStudent12;
    const raw=$('showRawTopBtn'); if(raw)raw.onclick=showRaw;
  }
  window.AIQUEST_TEACHER_ONLY_DASHBOARD={version:VERSION,loadTeacherData,renderAll,showRaw,loadStudent12,showDetail,state,adapt,collectArrays,normStudent};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{bind();loadTeacherData();}); else {bind();loadTeacherData();}
  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ONLY_DASHBOARD);
})();
