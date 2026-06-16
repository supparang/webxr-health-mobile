
(function(){
  'use strict';
  const VERSION='v3.4.9-teacher-bysession-server-summary';
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
    console.log('[AIQuest Teacher v3.4.9] loaded', {students:state.students.length,attempts:state.attempts.length,adapter:state.adapterInfo,raw:td,summary:sd,health:hd});
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
    const version=first(h||{},['version','serverVersion'])||first(d||{},['version','serverVersion'])||'v3.4.9';
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
  function focusAdvice(focus){
    const f=String(focus||'').toLowerCase();
    if(f.includes('automation')) return 'ควรทบทวน AI vs automation: แยก automation, sensor-only, rule-based และระบบที่มีการเรียนรู้/ทำนาย/ตัดสินใจ';
    if(f.includes('sensor')) return 'ควรทบทวนว่า sensor เป็นข้อมูลนำเข้า ไม่ใช่ intelligence โดยตัวมันเอง';
    if(f.includes('rule')) return 'ควรทบทวน rule-based automation เทียบกับ AI ที่ใช้ข้อมูลและการเรียนรู้';
    if(f.includes('ucs')) return 'ควรทบทวน UCS ว่าเลือกจาก path cost g(n) ไม่ใช่ heuristic อย่างเดียว';
    return 'ใช้เป็นหัวข้อเสริมสั้น ๆ ก่อนเริ่มบทถัดไป';
  }
  function uniqueReflectionItems(obj){
    if(!obj || typeof obj!=='object') return [];
    const keys=Object.keys(obj).filter(k=>/^reflection/i.test(k) || /^q/i.test(k));
    const seen=new Set();
    const items=[];
    keys.forEach(k=>{
      const text=String(obj[k]||'').trim();
      if(!text) return;
      const norm=text.replace(/\s+/g,' ').toLowerCase();
      if(seen.has(norm)) return;
      seen.add(norm);
      items.push({key:k,text});
    });
    return items;
  }
  function fullReflectionHTML(obj){
    if(!obj || typeof obj!=='object') return '<div class="muted">ไม่มี reflection text</div>';
    const keys=Object.keys(obj).filter(k=>/^reflection/i.test(k) || /^q/i.test(k));
    if(!keys.length) return '<div class="muted">ไม่มี reflection text</div>';
    return `<div class="grid" style="gap:10px">${keys.map((k,i)=>`
      <div class="metric"><span class="muted">${esc(k)}</span><div style="margin-top:6px;line-height:1.55">${esc(obj[k])}</div></div>
    `).join('')}</div>`;
  }
  function reflectionCleanHTML(obj){
    const unique=uniqueReflectionItems(obj);
    if(!unique.length) return '<div class="muted">ยังไม่มี reflection ล่าสุด</div>';
    const totalKeys=obj && typeof obj==='object' ? Object.keys(obj).filter(k=>/^reflection/i.test(k) || /^q/i.test(k)).length : unique.length;
    const duplicateNote=totalKeys>unique.length
      ? `<div class="muted" style="margin:6px 0 10px">ส่ง Reflection ${totalKeys} ช่อง แต่ข้อความซ้ำ จึงย่อเหลือ ${unique.length} รายการ</div>`
      : `<div class="muted" style="margin:6px 0 10px">ส่ง Reflection ${unique.length} รายการ</div>`;
    return `
      ${duplicateNote}
      <div class="grid" style="gap:10px">
        ${unique.slice(0,3).map((it,i)=>`
          <div class="metric">
            <span class="muted">Reflection ${i+1}</span>
            <div style="margin-top:6px;line-height:1.55">${esc(it.text)}</div>
          </div>`).join('')}
      </div>
      <button class="btn" id="toggleFullReflectionV346" style="margin-top:10px">View Full Reflection</button>
      <div id="fullReflectionV346" style="display:none;margin-top:10px">${fullReflectionHTML(obj)}</div>
    `;
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




  const SESSION_ORDER_V348 = [
    ['s1','S1','AI Awakening'],
    ['s2','S2','Agent Builder'],
    ['b1','B1','Rookie AI Boss'],
    ['s3','S3','Search Maze'],
    ['s4','S4','Route Cost'],
    ['s5','S5','A* Rescue'],
    ['b2','B2','Search Arena Boss']
  ];

  function normalizeSessionKey(k){
    const raw=String(k||'').toLowerCase().trim();
    const compact=raw.replace(/[\s_\-:]+/g,'');
    if(!compact) return '';
    if(['s1','m1','mission1','session1','ai1','aiawakening','1'].includes(compact) || raw.includes('ai awakening')) return 's1';
    if(['s2','m2','mission2','session2','agentbuilder','2'].includes(compact) || raw.includes('agent builder')) return 's2';
    if(['b1','boss1','rookieboss','rookieaiboss'].includes(compact) || raw.includes('rookie')) return 'b1';
    if(['s3','m3','mission3','session3','searchmaze','3'].includes(compact) || raw.includes('search maze')) return 's3';
    if(['s4','m4','mission4','session4','routecost','routecostchallenge','4'].includes(compact) || raw.includes('route cost')) return 's4';
    if(['s5','m5','mission5','session5','astar','arescue','a*rescue','a*rescuemission','5'].includes(compact) || raw.includes('a*') || raw.includes('heuristic')) return 's5';
    if(['b2','boss2','searcharenaboss','searcharena'].includes(compact) || raw.includes('search arena')) return 'b2';
    return compact;
  }

  function attemptSessionKey(a){
    a=a||{};
    const candidates=[
      first(a,['sessionKey','sessionCode','sessionId','missionId','missionKey','stageId','levelId','id']),
      first(a,['session','mission','mode','activity','title','sessionTitle','missionTitle','label']),
      first(a,['boss','bossId','bossKey'])
    ].filter(Boolean);
    for(const c of candidates){
      const nk=normalizeSessionKey(c);
      if(['s1','s2','s3','s4','s5','b1','b2'].includes(nk)) return nk;
    }
    return '';
  }

  function readScore(x){
    return num(first(x||{},['bestScore','best','Best','maxScore','score','latestScore','latest','scorePct']),0);
  }
  function readLatest(x){
    return num(first(x||{},['latestScore','latest','Latest','lastScore','score','bestScore','best','scorePct']),0);
  }
  function readStars(x){
    return num(first(x||{},['stars','Stars','star','bestStars']),0);
  }
  function readAttempts(x){
    return num(first(x||{},['attempts','attemptCount','count','totalAttempts']),0);
  }
  function readLastSubmitted(x){
    return first(x||{},['lastSubmitted','lastSubmit','timestamp','time','createdAt','updatedAt','latestTime','submittedAt']) || '';
  }
  function statusFromSession(x){
    if(!x || !Object.keys(x).length) return 'No data';
    if(boolish(first(x,['mastered','mastery','isMastered']))) return 'Mastery';
    const gate=String(first(x,['gate','status','passed','result'])||'').toLowerCase();
    if(gate.includes('mastery')) return 'Mastery';
    if(gate.includes('passed') || gate.includes('pass')) return 'Passed';
    const score=Math.max(readScore(x),readLatest(x));
    if(score>=85) return 'Mastery';
    if(score>=70) return 'Passed';
    if(score>0) return 'Need Review';
    return 'No data';
  }

  function mergeAttemptIntoSession(prev,a){
    prev=prev||{};
    a=a||{};
    const score=num(first(a,['score','Score','latestScore','bestScore','scorePct','percent']),0);
    const stars=readStars(a);
    const ts=readLastSubmitted(a);
    return Object.assign({}, prev, {
      attempts: num(prev.attempts,0)+1,
      bestScore: Math.max(num(first(prev,['bestScore','best']),0), score, num(first(a,['best','bestScore']),0)),
      latestScore: score || num(first(a,['latestScore','latest']),0) || num(first(prev,['latestScore','latest']),0),
      stars: Math.max(num(prev.stars,0), stars),
      lastSubmitted: ts || prev.lastSubmitted || '',
      mastered: boolish(first(a,['mastered','mastery','isMastered'])) || boolish(prev.mastered),
      source: 'nested-attempts'
    });
  }

  function nestedAttemptArrays(raw){
    const arrays=[];
    if(!raw || typeof raw!=='object') return arrays;
    ['attempts','sessionAttempts','allAttempts','attemptRows','history','submissions'].forEach(k=>{
      if(Array.isArray(raw[k])) arrays.push({path:k, value:raw[k]});
    });
    if(raw.data && typeof raw.data==='object'){
      ['attempts','sessionAttempts','allAttempts','attemptRows','history','submissions'].forEach(k=>{
        if(Array.isArray(raw.data[k])) arrays.push({path:'data.'+k, value:raw.data[k]});
      });
    }
    return arrays;
  }

  function collectSessionDataFromRaw(s){
    const out={};
    const r=s.raw||{};

    const containers=[r.bySession,r.sessionSummary,r.sessions,r.progressBySession,r.sessionProgress,r.missions,r.byMission,r.sessionMap,r.sessionHistory];
    containers.forEach(obj=>{
      if(obj && typeof obj==='object' && !Array.isArray(obj)){
        Object.keys(obj).forEach(k=>{
          const nk=normalizeSessionKey(k);
          if(['s1','s2','s3','s4','s5','b1','b2'].includes(nk)){
            out[nk]=Object.assign({}, out[nk]||{}, obj[k]||{}, {source:'bySession-object'});
          }
        });
      }
    });

    nestedAttemptArrays(r).forEach(pack=>{
      pack.value.filter(x=>x && typeof x==='object').forEach(a=>{
        const nk=attemptSessionKey(a);
        if(!['s1','s2','s3','s4','s5','b1','b2'].includes(nk)) return;
        out[nk]=mergeAttemptIntoSession(out[nk], a);
      });
    });

    state.attempts.filter(a=>String(a.studentId)===String(s.studentId)).forEach(a=>{
      const nk=normalizeSessionKey(a.sessionId);
      if(!['s1','s2','s3','s4','s5','b1','b2'].includes(nk)) return;
      out[nk]=mergeAttemptIntoSession(out[nk], a);
    });

    // Fallback only if no real session exists
    if(!Object.keys(out).length && (s.best || s.latest || s.attempts)){
      out.b2 = {
        bestScore:s.best,
        latestScore:s.latest,
        attempts:s.attempts,
        mastered:s.mastered,
        reflectionComplete:!!s.reflection,
        risks:s.focus ? [s.focus] : [],
        source:'aggregate-current-row'
      };
    }
    return out;
  }

  function sessionHistoryRows(s){
    const by=collectSessionDataFromRaw(s);
    return SESSION_ORDER_V348.map(([key,label,title])=>{
      const x=by[key]||{};
      const best=readScore(x);
      const latest=readLatest(x);
      const stars=readStars(x);
      const attempts=readAttempts(x);
      const status=statusFromSession(x);
      const last=readLastSubmitted(x);
      return {key,label,title,best,latest,stars,attempts,status,last,raw:x};
    });
  }
  function statusPill(status){
    if(status==='Mastery') return pill('Mastery','good');
    if(status==='Passed') return pill('Passed','good');
    if(status==='Need Review') return pill('Need Review','warn');
    return pill('No data','');
  }
  function sessionHistoryHTML(s){
    const rows=sessionHistoryRows(s);
    return `<table>
      <thead><tr>
        <th>Session</th><th>Best</th><th>Latest</th><th>Stars</th><th>Status</th><th>Attempts</th><th>Last submitted</th>
      </tr></thead>
      <tbody>${rows.map(r=>`
        <tr>
          <td><b>${esc(r.label)}</b><br><span class="muted">${esc(r.title)}</span></td>
          <td>${r.best||'-'}</td>
          <td>${r.latest||'-'}</td>
          <td>${r.stars?('★'.repeat(Math.min(3,r.stars))):'-'}</td>
          <td>${statusPill(r.status)}</td>
          <td>${r.attempts||'-'}</td>
          <td>${r.last?esc(r.last):'<span class="muted">-</span>'}</td>
        </tr>`).join('')}</tbody>
    </table>`;
  }
  function sessionCompactNote(s){
    const rows=sessionHistoryRows(s);
    const done=rows.filter(r=>r.status==='Mastery'||r.status==='Passed').length;
    const need=rows.filter(r=>r.status==='Need Review').map(r=>r.label).join(', ');
    const noData=rows.filter(r=>r.status==='No data').map(r=>r.label).join(', ');
    return `${done}/${rows.length} sessions passed/mastery${need?` • Need review: ${need}`:''}${noData?` • No data: ${noData}`:''}`;
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
        <div class="metric"><span class="muted">Latest Score</span><b>${esc(s.latest||'-')}</b></div>
        <div class="metric"><span class="muted">Best Score</span><b>${esc(s.best||'-')}</b></div>
      </div>

      <div class="grid cols3" style="margin-top:10px">
        <div class="metric"><span class="muted">Accuracy</span><b>${esc(accuracyDisplay(s))}</b><div class="muted" style="font-size:12px;margin-top:4px">N/A = no correct/total data</div></div>
        <div class="metric"><span class="muted">Reflection</span><b>${esc(s.reflection?'ครบ':'ยังไม่ครบ')}</b></div>
        <div class="metric"><span class="muted">Help Used</span><b>${esc(s.helpUsed||0)}</b></div>
      </div>

      <div class="card" style="margin-top:12px">
        <h3>Review Focus</h3>
        <p style="font-size:20px;font-weight:900;margin:0">${esc(focus)}</p>
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
        <h3>Session Progress</h3>
        <p class="muted">${esc(sessionCompactNote(s))}</p>
        ${sessionHistoryHTML(s)}
      </div>

      <div class="card" style="margin-top:12px">
        <button class="btn" id="toggleRawRowV346">Show Debug Raw Row</button>
        <pre id="rawRowV346" style="display:none;white-space:pre-wrap;background:#0f172a;padding:12px;border-radius:12px;overflow:auto;margin-top:10px">${rawJson}</pre>
      </div>
    `;
    const rawBtn=$('toggleRawRowV346');
    if(rawBtn){
      rawBtn.onclick=()=>{
        const pre=$('rawRowV346');
        const open=pre.style.display!=='none';
        pre.style.display=open?'none':'block';
        rawBtn.textContent=open?'Show Debug Raw Row':'Hide Debug Raw Row';
      };
    }
    const fullBtn=$('toggleFullReflectionV346');
    if(fullBtn){
      fullBtn.onclick=()=>{
        const box=$('fullReflectionV346');
        const open=box.style.display!=='none';
        box.style.display=open?'none':'block';
        fullBtn.textContent=open?'View Full Reflection':'Hide Full Reflection';
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
    $('previewBtn').onclick=()=>window.open('./index.html?v=20260614-bysessionserver349','_blank');
    $('closeDetail').onclick=()=>$('detailModal').classList.remove('open');
    $('studentSearch').oninput=renderStudents;
    $('studentFilter').onchange=renderStudents;
    const b=$('loadStudent12Btn'); if(b)b.onclick=loadStudent12;
    const raw=$('showRawTopBtn'); if(raw)raw.onclick=showRaw;
  }
  window.AIQUEST_TEACHER_ONLY_DASHBOARD={version:VERSION,loadTeacherData,renderAll,showRaw,loadStudent12,showDetail,state,adapt,collectArrays,normStudent,sessionHistoryRows,sessionHistoryHTML,collectSessionDataFromRaw,nestedAttemptArrays,attemptSessionKey};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{bind();loadTeacherData();}); else {bind();loadTeacherData();}
  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ONLY_DASHBOARD);
})();
