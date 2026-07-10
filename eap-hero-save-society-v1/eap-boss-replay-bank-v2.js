/* =========================================================
 EAP Boss Gate Replayability Bank V3
 - 5 rotating scenarios per B1-B5 = 25 scenarios
 - Each scenario has Reading 2 + Listening 2 + Writing 1 + Speaking 1
 - Total bank size = 150 Boss skill-items
 - No-repeat scenario window per gate
 - Reading/Listening item inside scenario is randomized per run
 - Load AFTER eap-boss-four-skill-gate-v1.js
========================================================= */
(() => {
  'use strict';

  const KEY = 'EAP_BOSS_4SKILL_SCENARIO_HISTORY_V3';
  const rand = n => Math.floor(Math.random() * n);

  const BLUEPRINTS = {
    1: [
      ['Goal Builder','academic reading goal','weekly reading action','progress note','goal setting'],
      ['Source Navigator','source topic','useful detail','study task','source use'],
      ['Study Routine','short study routine','self-test','next improvement','learning habit'],
      ['Vocabulary Tracker','academic word list','example sentence','review plan','word learning'],
      ['Main Idea Scout','short article','central message','support detail','main idea']
    ],
    2: [
      ['Evidence Check','credible claim','relevant evidence','writer point','evidence'],
      ['Keyword Trail','focused search question','key terms','refined result','search strategy'],
      ['Summary Signal','source message','essential support','new wording','summary'],
      ['Claim Support','student claim','one reason','source detail','support'],
      ['Source Reliability','online source','author and date','useful context','credibility']
    ],
    3: [
      ['Paragraph Builder','topic sentence','support detail','closing idea','paragraph'],
      ['Tone Control','cautious claim','limited evidence','formal wording','academic tone'],
      ['Linking Logic','contrast idea','result idea','connector choice','cohesion'],
      ['Example Ladder','general idea','specific example','explanation','development'],
      ['Focus Keeper','paragraph purpose','irrelevant detail','main point','focus']
    ],
    4: [
      ['Data Reporter','survey result','numerical change','careful conclusion','data description'],
      ['Email Mission','academic email','specific request','polite closing','email'],
      ['Ethics Shield','AI support','fact checking','acknowledgement','ethics'],
      ['Citation Helper','borrowed idea','source name','own sentence','citation'],
      ['Note-to-Report','class notes','selected evidence','short report','reporting']
    ],
    5: [
      ['Community Solution','local social problem','credible detail','realistic action','solution'],
      ['Digital Safety','online claim','original source','safe sharing','digital literacy'],
      ['Inclusive Campus','participation barrier','user feedback','evaluated change','inclusion'],
      ['Presentation Mission','social issue','evidence slide','clear recommendation','presentation'],
      ['Q&A Defender','audience question','evidence-based answer','honest limitation','Q&A']
    ]
  };

  function history(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function saveHistory(all){ localStorage.setItem(KEY, JSON.stringify(all)); }

  function remember(gate, tag){
    const all = history();
    all[gate] = (all[gate] || []).filter(x => x !== tag).slice(-3);
    all[gate].push(tag);
    saveHistory(all);
  }

  function readingItems(gate, b){
    const [tag, a, d, c, skill] = b;
    return [
      {
        source:`A learner working on ${a} should choose one clear purpose, use ${d}, and connect it to ${c}. This makes the work easier to explain in academic English.`,
        q:'Which response best follows the source?',
        a:`Choose a clear purpose, use ${d}, and connect it to ${c}.`,
        d:[`Ignore ${d} and answer from memory.`,`Use many unrelated ideas without a purpose.`,`Copy the source without explaining the connection.`]
      },
      {
        source:`In a strong EAP task, students do not only finish quickly. They check the task, select useful information, and explain why it matters for ${skill}.`,
        q:'What should students do besides finishing quickly?',
        a:`Check the task, select useful information, and explain why it matters for ${skill}.`,
        d:['Choose the longest answer every time.','Avoid explaining their reason.','Focus only on speed and ignore meaning.']
      }
    ];
  }

  function listeningItems(gate, b){
    const [tag, a, d, c, skill] = b;
    return [
      {
        source:`The tutor says, “For ${a}, start with one simple point. Then add ${d}. Finally, explain the link to ${c}.”`,
        q:'What should the learner add after the simple point?',
        a:`${d}.`,
        d:['An unrelated story.','A private opinion with no support.','Only a greeting.']
      },
      {
        source:`A student explains, “I improved my ${skill} task by checking the instruction, choosing one useful detail, and revising my answer before submitting.”`,
        q:'Which action helped the student improve?',
        a:'Checking the instruction, choosing one useful detail, and revising before submitting.',
        d:['Submitting without reading the task.','Removing all useful details.','Changing the answer randomly.']
      }
    ];
  }

  function makeScenario(gate, b){
    const [tag, a, d, c, skill] = b;
    return {
      tag,
      gate,
      skillFocus: skill,
      readingItems: readingItems(gate, b),
      listeningItems: listeningItems(gate, b),
      writing:`Write 2-4 sentences about ${a}. Include ${d} and explain how it connects to ${c}.`,
      speaking:`Speak for 30-45 seconds about ${a}. Mention ${d}, connect it to ${c}, and finish with a clear closing.`,
      writingFrames:[
        `This task is about ${a}.`,
        `One useful detail is ${d}.`,
        `This connects to ${c} because it helps me explain my idea clearly.`
      ],
      speakingFrames:[
        `Today I will talk about ${a}.`,
        `One important point is ${d}.`,
        `This helps with ${c}, so it is useful for my study.`
      ]
    };
  }

  const BANK = Object.fromEntries(Object.entries(BLUEPRINTS).map(([gate, rows]) => [Number(gate), rows.map(row => makeScenario(Number(gate), row))]));

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function pick(arr){ return arr[rand(arr.length)]; }

  function chooseScenario(gate){
    const pool = BANK[gate] || BANK[1];
    const old = history()[gate] || [];
    const available = pool.filter(item => !old.includes(item.tag));
    const scenario = clone(pick(available.length ? available : pool));
    remember(gate, scenario.tag);

    const r = pick(scenario.readingItems);
    const l = pick(scenario.listeningItems);
    scenario.reading = r.source;
    scenario.rq = r.q;
    scenario.ra = r.a;
    scenario.rd = r.d;
    scenario.listening = l.source;
    scenario.lq = l.q;
    scenario.la = l.a;
    scenario.ld = l.d;
    scenario.itemMeta = {
      version:'v3-150-items',
      bankSkillItems:150,
      scenariosPerBoss:5,
      perScenario:{Reading:2, Listening:2, Writing:1, Speaking:1}
    };
    return scenario;
  }

  function bindOverride(){
    if (!window.EAPHero?.startGateBoss || window.EAPBossReplayV3) return;
    window.EAPBossReplayV3 = true;
    const original = window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss = function(gateId){
      const gate = Number(String(gateId || '').replace(/\D/g, '')) || 1;
      window.EAPBossReplayScenario = { gate, scenario: chooseScenario(gate) };
      return original(gateId);
    };
  }

  const wait = setInterval(() => {
    bindOverride();
    if (window.EAPBossReplayV3) clearInterval(wait);
  }, 120);

  window.EAPBossReplayBankV3 = {
    version:'v3-150-items',
    bank:BANK,
    choose:chooseScenario,
    count:{bosses:5, scenarios:25, skillItems:150, reading:50, listening:50, writing:25, speaking:25}
  };
})();
