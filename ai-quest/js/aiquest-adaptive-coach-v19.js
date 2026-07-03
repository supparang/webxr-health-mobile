/*
  CSAI2102 AI Quest
  v1.9.1 — Adaptive Coach Learning Support
  ------------------------------------------------------------
  Stores learner misconceptions locally by profile. The coach offers hints
  and targeted review only; it does not change scores, stars, gate status,
  or any graded result.
*/
(function(){
  'use strict';

  const VERSION = 'v1.9.1-adaptive-coach-runtime';
  const KEY = 'CSAI2102_AIQUEST_ADAPTIVE_COACH_V19';
  const MAX_EVENTS = 80;

  const SUPPORT = {
    automation:'แยก “ระบบอัตโนมัติ” ออกจาก AI/agent โดยตรวจว่าเกิดการรับรู้สถานการณ์และเลือก action ตามเป้าหมายหรือไม่',
    agent:'ทบทวน percept → decision → action → goal และตรวจว่าองค์ประกอบใดหายไป',
    peas:'เขียน PEAS ให้ครบ: Performance measure, Environment, Actuators, Sensors',
    environment:'พิจารณา observable, deterministic, episodic/sequential, static/dynamic และ discrete/continuous ทีละมิติ',
    bfs:'ดูว่าคำถามต้องการจำนวน edge น้อยที่สุดใน graph แบบ equal cost หรือไม่',
    dfs:'จำว่า DFS ลงลึกก่อน จึงไม่รับประกันเส้นทางสั้นที่สุด',
    state_space:'แยก state, action, transition และ goal test ให้ชัดก่อนเลือก algorithm',
    ucs:'เปรียบเทียบ cumulative cost g(n) ของทั้งเส้นทาง ไม่ใช่จำนวน edge',
    astar:'ใช้ f(n)=g(n)+h(n) และอย่าสับสนกับ Greedy ที่ใช้ h(n) อย่างเดียว',
    heuristic:'heuristic ที่ดีไม่ควร overestimate หากต้องการรักษา optimality',
    knowledge:'แยก fact, rule และ inference; ตรวจความขัดแย้งของฐานความรู้ก่อนอนุมาน',
    inference:'จับคู่ antecedent ของ rule กับ fact ที่มี แล้วอนุมาน consequent อย่างมีเหตุผล',
    general:'อ่าน criterion ของโจทย์ก่อน: กำลังถามเรื่อง goal, cost, heuristic หรือ knowledge rule กันแน่'
  };

  function profileKey(){
    try{
      const profile = window.AIQuestStorage && window.AIQuestStorage.getProfile
        ? window.AIQuestStorage.getProfile()
        : {};
      return String((profile.studentId || 'anon') + '_' + (profile.section || '101')).replace(/[^\w-]/g, '_');
    }catch(error){
      return 'anon_101';
    }
  }

  function readAll(){
    try{
      const value = JSON.parse(localStorage.getItem(KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    }catch(error){
      return {};
    }
  }

  function writeAll(value){
    try{
      localStorage.setItem(KEY, JSON.stringify(value || {}));
      return true;
    }catch(error){
      return false;
    }
  }

  function state(){
    const all = readAll();
    const key = profileKey();
    const value = all[key] && typeof all[key] === 'object' ? all[key] : {mis:{}, events:[], updatedAt:''};
    return {all, key, value};
  }

  function normalizeKey(event){
    const joined = [
      event && event.misconception,
      event && event.misconceptionKey,
      event && event.phase,
      event && event.itemId,
      event && event.prompt,
      event && event.extraJson && event.extraJson.misconception,
      event && event.extraJson && event.extraJson.familyId
    ].filter(Boolean).join(' ').toLowerCase();

    if(/automation|sensor|not ai|timer|rule-based/.test(joined)) return 'automation';
    if(/peas/.test(joined)) return 'peas';
    if(/agent|percept|actuator|rational/.test(joined)) return 'agent';
    if(/environment|observable|deterministic|episodic|static|dynamic/.test(joined)) return 'environment';
    if(/bfs/.test(joined)) return 'bfs';
    if(/dfs/.test(joined)) return 'dfs';
    if(/state space|goal test|frontier|visited|search maze/.test(joined)) return 'state_space';
    if(/ucs|uniform cost|route cost|cumulative cost|priority queue/.test(joined)) return 'ucs';
    if(/a\*|astar|heuristic|g\(n\)|h\(n\)|f\(n\)/.test(joined)) return /heuristic/.test(joined) ? 'heuristic' : 'astar';
    if(/knowledge|fact|rule|representation|consistency/.test(joined)) return 'knowledge';
    if(/inference|infer|antecedent|consequent/.test(joined)) return 'inference';
    return 'general';
  }

  function recordAnswer(event){
    const source = event || {};
    const correct = source.isCorrect === true || String(source.isCorrect).toLowerCase() === 'true';
    const store = state();
    const coach = store.value;
    coach.mis = coach.mis && typeof coach.mis === 'object' ? coach.mis : {};
    coach.events = Array.isArray(coach.events) ? coach.events : [];
    const key = normalizeKey(source);

    if(!correct){
      coach.mis[key] = Number(coach.mis[key] || 0) + 1;
    }else if(coach.mis[key]){
      coach.mis[key] = Math.max(0, Number(coach.mis[key]) - 0.25);
    }

    coach.events.unshift({
      ts:new Date().toISOString(),
      correct,
      key,
      phase:String(source.phase || ''),
      itemId:String(source.itemId || ''),
      eventType:String(source.eventType || '')
    });
    coach.events = coach.events.slice(0, MAX_EVENTS);
    coach.updatedAt = new Date().toISOString();
    store.all[store.key] = coach;
    writeAll(store.all);

    if(correct) return {action:'continue', title:'AI Coach', message:'ดีมาก รักษาเหตุผลของคุณไว้ แล้วดู criterion ของข้อต่อไปให้ชัด', addTime:0};
    return {action:'review', title:'AI Coach', message:SUPPORT[key] || SUPPORT.general, addTime:0, misconception:key};
  }

  function topMisconceptions(limit){
    const coach = state().value;
    const entries = Object.entries(coach.mis || {})
      .filter(([, count]) => Number(count) > 0)
      .sort((a,b) => Number(b[1]) - Number(a[1]));
    return entries.slice(0, Math.max(1, Number(limit || 3))).map(([key, count]) => ({
      key,
      count:Number(count),
      advice:SUPPORT[key] || SUPPORT.general
    }));
  }

  function getCoachSummary(){
    const top = topMisconceptions(3);
    if(!top.length) return ['ยังไม่มีความผิดซ้ำชัดเจน ให้รักษาวิธีคิดแบบอธิบาย criterion ก่อนเลือกคำตอบ'];
    return top.map(item => `${item.key}: ${item.advice}`);
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
    }[character]));
  }

  function renderCoachPanel(host){
    if(!host) return;
    const top = topMisconceptions(3);
    host.innerHTML = top.length
      ? `<div class="coachBox"><b>AI Coach: จุดที่ควรทบทวน</b><div class="phaseInsightGrid">${top.map(item => `<div class="phaseInsightCard warn"><b>${escapeHtml(item.key)}</b>ผิดซ้ำ ${item.count} ครั้ง<br>${escapeHtml(item.advice)}</div>`).join('')}</div><p class="small">คำแนะนำนี้ใช้เพื่อการฝึกและไม่เปลี่ยนคะแนนหรือเงื่อนไข Gate</p></div>`
      : '<div class="coachBox"><b>AI Coach</b><br>เริ่มเล่นแล้วระบบจะสรุปแนวคิดที่ยังสับสนให้ตามคำตอบของคุณ</div>';
  }

  function reset(){
    const store = state();
    delete store.all[store.key];
    writeAll(store.all);
  }

  window.AIQuestAdaptiveCoach = {
    VERSION,
    recordAnswer,
    topMisconceptions,
    getCoachSummary,
    renderCoachPanel,
    reset
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
