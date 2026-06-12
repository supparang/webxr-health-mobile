/*
  CSAI2102 AI Quest — v2.7.6 Foundation QC Lock
  ------------------------------------------------------------
  Final pre-S4 audit for S1, S2, B1, S3 banks.
  - Counts loaded banks
  - Checks thresholds
  - Samples no-repeat rounds
  - Flags obvious answer-choice patterns
  - Provides Teacher/Production checklist status
*/
(function(){
  'use strict';

  const VERSION = 'v2.7.6-foundation-qc-lock';
  const THRESHOLDS = {
    m1:{total:300, label:'S1 Foundation Max'},
    s2:{total:220, label:'S2 Agent Builder'},
    b1:{total:200, label:'B1 Rookie Boss'},
    s3:{total:300, label:'S3 Search Maze'}
  };

  const CONCEPT = {
    automation:'Automation ต้องดู goal/action ไม่ใช่ทำงานเองอย่างเดียว',
    sensor:'Sensor เป็น percept channel ไม่ใช่ intelligence ทั้งระบบ',
    robot_only:'Agent อาจเป็น software ไม่จำเป็นต้องเป็นหุ่นยนต์',
    database:'Data/lookup ไม่เท่ากับ AI ถ้าไม่มี model หรือ decision',
    random:'Randomness ไม่ใช่ reasoning หรือ learning',
    prediction:'Prediction ต้องเชื่อมกับ action จึงเป็น agent loop',
    rulebased:'Rule-based อาจเป็น symbolic AI แต่ไม่ใช่ learning เสมอ',
    calculator:'คำนวณตามสูตรไม่เท่ากับ AI',
    peas_swap:'PEAS ต้องแยก P/E/A/S ไม่ใช่ component list',
    rationality:'Rationality คือเลือก action ดีสุดจากข้อมูลที่มี',
    observable_confusion:'Fully observable หมายถึงข้อมูลพอเห็น state ไม่ใช่มี sensor เยอะ',
    bfs_shortest:'BFS shortest เฉพาะ unweighted/equal cost',
    dfs_shortest:'DFS ไม่รับประกัน shortest path',
    frontier:'Frontier คือรอ expand ไม่ใช่ visited ทั้งหมด',
    visited:'Visited ใช้กัน loop และงานซ้ำ',
    queue_stack:'BFS ใช้ queue ส่วน DFS ใช้ stack/recursion'
  };

  function shuffle(a){
    const x = (a || []).slice();
    for(let i=x.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [x[i],x[j]]=[x[j],x[i]];
    }
    return x;
  }

  function countBank(name){
    const b = window[name];
    return b && b.counts ? b.counts : null;
  }

  function counts(){
    return {
      m1:countBank('AIQUEST_MISSION1_BANK'),
      s2:countBank('AIQUEST_SESSION2_BANK'),
      b1:countBank('AIQUEST_BOSS1_BANK'),
      s3:countBank('AIQUEST_SEARCH3_BANK')
    };
  }

  function totalOf(c){
    if(!c) return 0;
    if(Number(c.total)) return Number(c.total);
    return Object.keys(c).reduce((sum,k)=>sum + (k === 'total' ? 0 : Number(c[k] || 0)), 0);
  }

  function countStatus(){
    const c = counts();
    return Object.keys(THRESHOLDS).map(key => {
      const actual = totalOf(c[key]);
      const pass = actual >= THRESHOLDS[key].total;
      return {
        key,
        label:THRESHOLDS[key].label,
        actual,
        target:THRESHOLDS[key].total,
        pass,
        counts:c[key] || null
      };
    });
  }

  function bankReady(){
    const rows = countStatus();
    return rows.length === 4 && rows.every(r => r.pass);
  }

  function normalize(item){
    if(!item) return item;
    const key = item.key || item.familyId || '';
    const base = Object.keys(CONCEPT).find(k => String(key).includes(k)) ||
      Object.keys(CONCEPT).find(k => String(item.phase || '').toLowerCase().includes(k));
    const correct = CONCEPT[base] || item.answer || item.counter;
    if(!correct) return item;
    const wrongs = shuffle(Object.keys(CONCEPT).filter(k => k !== base).map(k => CONCEPT[k])).slice(0,3);
    item.originalAnswer = item.originalAnswer || item.answer || item.counter;
    if(item.answer) item.answer = correct;
    if(item.counter) item.counter = correct;
    item.distractors = wrongs;
    item.why = item.why || item.originalAnswer || correct;
    return item;
  }

  function wrap(name){
    const old = window[name];
    if(typeof old !== 'function' || old.__foundationQcWrapped) return;
    const wrapped = function(diff){
      const round = old(diff);
      try{
        ['claims','boss'].forEach(k => {
          if(round && Array.isArray(round[k])) round[k] = round[k].map(x => normalize(x));
        });
      }catch(e){}
      return round;
    };
    wrapped.__foundationQcWrapped = true;
    window[name] = wrapped;
  }

  function itemChoicePattern(item){
    const ans = String(item.answer || item.counter || '').trim();
    const ds = (item.distractors || []).map(x => String(x || '').trim()).filter(Boolean);
    if(!ans || ds.length < 2) return null;
    const ansLen = ans.length;
    const avgWrong = ds.reduce((s,x)=>s+x.length,0) / ds.length;
    const startsWithCue = /^(ถูก|ไม่ถูก|ไม่เสมอ|จำเป็น|ไม่จำเป็น)/.test(ans);
    const wrongCueCount = ds.filter(x => /^(ถูก|ไม่ถูก|ไม่เสมอ|จำเป็น|ไม่จำเป็น)/.test(x)).length;
    if(ansLen > avgWrong * 1.8 && ansLen - avgWrong > 25){
      return {type:'answer_too_long', id:item.id, familyId:item.familyId, answerLength:ansLen, avgWrong:Math.round(avgWrong)};
    }
    if(startsWithCue && wrongCueCount < ds.length){
      return {type:'cue_prefix_mismatch', id:item.id, familyId:item.familyId, answer:ans.slice(0,25)};
    }
    return null;
  }

  function scanArray(items, limit){
    const out = [];
    (items || []).some(item => {
      const r = itemChoicePattern(item);
      if(r) out.push(r);
      return out.length >= (limit || 20);
    });
    return out;
  }

  function scanPatterns(limit){
    const issues = [];
    try{
      const m1 = window.AIQUEST_MISSION1_BANK;
      if(m1){
        issues.push(...scanArray(m1.RUSH, limit).map(x => Object.assign({bank:'S1 Rush'}, x)));
        issues.push(...scanArray(m1.TRICKS, limit).map(x => Object.assign({bank:'S1 Tricks'}, x)));
        issues.push(...scanArray(m1.EXPLAINS, limit).map(x => Object.assign({bank:'S1 Explain'}, x)));
        issues.push(...scanArray(m1.BOSS, limit).map(x => Object.assign({bank:'S1 Boss'}, x)));
      }
      const s2 = window.AIQUEST_SESSION2_BANK;
      if(s2){
        issues.push(...scanArray(s2.AGENT_CARDS, limit).map(x => Object.assign({bank:'S2 Agent'}, x)));
        issues.push(...scanArray(s2.PEAS_ITEMS, limit).map(x => Object.assign({bank:'S2 PEAS'}, x)));
        issues.push(...scanArray(s2.ENV_ITEMS, limit).map(x => Object.assign({bank:'S2 Env'}, x)));
        issues.push(...scanArray(s2.BOSS_CLAIMS, limit).map(x => Object.assign({bank:'S2 Boss'}, x)));
      }
      const b1 = window.AIQUEST_BOSS1_BANK;
      if(b1) issues.push(...scanArray(b1.BOSS1_CLAIMS, limit).map(x => Object.assign({bank:'B1'}, x)));
      const s3 = window.AIQUEST_SEARCH3_BANK;
      if(s3){
        issues.push(...scanArray(s3.STATE_ITEMS, limit).map(x => Object.assign({bank:'S3 State'}, x)));
        issues.push(...scanArray(s3.GRAPH_ITEMS, limit).map(x => Object.assign({bank:'S3 Graph'}, x)));
        issues.push(...scanArray(s3.BOSS_CLAIMS, limit).map(x => Object.assign({bank:'S3 Boss'}, x)));
      }
    }catch(e){
      issues.push({bank:'scan', type:'exception', message:String(e && e.message || e)});
    }
    return issues.slice(0, limit || 40);
  }

  function roundFamilies(round){
    const arrays = ['rush','tricks','explains','boss','agent','peas','env','state','graph','maze','claims'];
    let list = [];
    arrays.forEach(k => { if(round && Array.isArray(round[k])) list = list.concat(round[k]); });
    return list.map(x => x && (x.familyId || x.key || x.id)).filter(Boolean);
  }

  function sampleNoRepeat(builderName, rounds, diff){
    const fn = window[builderName];
    if(typeof fn !== 'function') return {builder:builderName, available:false, pass:false, note:'not loaded'};
    const seenRounds = [];
    let withinRunDuplicates = 0;
    for(let i=0;i<(rounds || 4);i++){
      const r = fn(diff || 'normal');
      const fam = roundFamilies(r);
      const set = new Set(fam);
      withinRunDuplicates += Math.max(0, fam.length - set.size);
      seenRounds.push({round:i+1, count:fam.length, unique:set.size});
    }
    return {
      builder:builderName,
      available:true,
      pass:withinRunDuplicates === 0,
      withinRunDuplicates,
      rounds:seenRounds
    };
  }

  function noRepeatReport(){
    return [
      sampleNoRepeat('buildMission1Round', 3, 'normal'),
      sampleNoRepeat('buildSession2Round', 3, 'normal'),
      sampleNoRepeat('buildBoss1Round', 3, 'normal'),
      sampleNoRepeat('buildSession3Round', 3, 'normal')
    ];
  }

  function report(){
    const status = countStatus();
    const issues = scanPatterns(40);
    const repeats = noRepeatReport();
    return {
      version:VERSION,
      ready:status.every(x=>x.pass) && repeats.every(x=>x.pass || !x.available),
      countStatus:status,
      patternIssues:issues,
      noRepeat:repeats,
      generatedAt:new Date().toISOString()
    };
  }

  function resetAll(){
    try{
      if(window.AIQUEST_MISSION1_BANK && AIQUEST_MISSION1_BANK.resetMission1History) AIQUEST_MISSION1_BANK.resetMission1History();
      if(window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.resetSession2History) AIQUEST_SESSION2_BANK.resetSession2History();
      if(window.AIQUEST_BOSS1_BANK && AIQUEST_BOSS1_BANK.resetBoss1History) AIQUEST_BOSS1_BANK.resetBoss1History();
      if(window.AIQUEST_SEARCH3_BANK && AIQUEST_SEARCH3_BANK.resetSession3History) AIQUEST_SEARCH3_BANK.resetSession3History();
    }catch(e){}
  }

  wrap('buildBoss1Round');
  wrap('buildSession2Round');
  wrap('buildSession3Round');

  window.AIQUEST_FOUNDATION_AUDIT_V276 = {
    VERSION,
    THRESHOLDS,
    normalize,
    counts,
    countStatus,
    bankReady,
    scanPatterns,
    noRepeatReport,
    report,
    resetAll
  };

  // Backward alias for older console snippets
  window.AIQUEST_FOUNDATION_AUDIT_V275 = window.AIQUEST_FOUNDATION_AUDIT_V276;

  console.log('[AIQuest] '+VERSION+' loaded', report());
})();
