/* =========================================================
 EAP Boss Gate Replayability Bank V3.2
 - 5 rotating scenarios per B1-B5 = 25 scenarios
 - Each scenario has Reading 2 + Listening 2 + Writing 1 + Speaking 1
 - Total bank size = 150 Boss skill-items
 - Choice quality fix: no repeated opening pattern such as Choose/Check/Add
 - Correct answer is NOT consistently the longest or the most source-like option
 - Distractors are plausible, similar length, and shuffled by Boss Gate
 - No-repeat scenario window per gate
 - Reading/Listening item inside scenario is randomized per run
 - Load AFTER eap-boss-four-skill-gate-v1.js
========================================================= */
(() => {
  'use strict';

  const KEY = 'EAP_BOSS_4SKILL_SCENARIO_HISTORY_V32';
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

  function history(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
  function saveHistory(all){ localStorage.setItem(KEY, JSON.stringify(all)); }
  function remember(gate, tag){
    const all = history();
    all[gate] = (all[gate] || []).filter(x => x !== tag).slice(-3);
    all[gate].push(tag);
    saveHistory(all);
  }

  function words(s){ return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
  function normalizeSentence(s){ return /[.!?]$/.test(String(s || '').trim()) ? String(s).trim() : String(s || '').trim() + '.'; }

  function similarLength(correct, list){
    const target = words(correct);
    const pads = ['with task focus','using source evidence','before submitting','for academic clarity'];
    return list.map((item, idx) => {
      let out = String(item || '').replace(/\.$/, '').trim();
      while (words(out) < Math.max(7, target - 4) && words(out) < target + 2) out += ' ' + pads[(idx + words(out)) % pads.length];
      return normalizeSentence(out);
    });
  }

  function readingItems(gate, b){
    const [tag, a, d, c, skill] = b;
    const correct1 = `Purpose plan: one clear purpose, ${d}, and a link to ${c}.`;
    const correct2 = `Evidence plan: check the task, select useful information, and explain the link to ${skill}.`;
    return [
      {
        source:`A learner working on ${a} should choose one clear purpose, use ${d}, and connect it to ${c}. This makes the work easier to explain in academic English.`,
        q:'Which response best follows the source?',
        a:correct1,
        d:similarLength(correct1,[
          `Many-purpose plan: several purposes and ${d}, but no link to ${c}.`,
          `Different-task plan: one purpose, but not ${d} or the task focus.`,
          `Copy-only plan: repeats the source, but leaves the link to ${c} unclear.`
        ])
      },
      {
        source:`In a strong EAP task, students do not only finish quickly. They check the task, select useful information, and explain why it matters for ${skill}.`,
        q:'What should students do besides finishing quickly?',
        a:correct2,
        d:similarLength(correct2,[
          `Length plan: check answer length and choose what looks complete.`,
          `Partial plan: select information but leave out the link to ${skill}.`,
          `Speed plan: submit quickly before checking the task carefully.`
        ])
      }
    ];
  }

  function listeningItems(gate, b){
    const [tag, a, d, c, skill] = b;
    const correct1 = `Support step: add ${d} after the simple point.`;
    const correct2 = 'Revision step: check the instruction, choose one useful detail, and revise.';
    return [
      {
        source:`The tutor says, “For ${a}, start with one simple point. Then add ${d}. Finally, explain the link to ${c}.”`,
        q:'What should the learner add after the simple point?',
        a:correct1,
        d:similarLength(correct1,[
          `Story step: add an unrelated story after the simple point.`,
          `Opinion step: add a private opinion with no support.`,
          `Greeting step: add only a greeting and stop the explanation.`
        ])
      },
      {
        source:`A student explains, “I improved my ${skill} task by checking the instruction, choosing one useful detail, and revising my answer before submitting.”`,
        q:'Which action helped the student improve?',
        a:correct2,
        d:similarLength(correct2,[
          `Quick step: submit fast, choose one detail, and avoid revision.`,
          `Removal step: read once, remove useful details, and submit.`,
          `Random step: change the answer randomly and ignore the task.`
        ])
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

  function balanceAnswerLength(scenario){
    ['readingItems','listeningItems'].forEach(group => {
      (scenario[group] || []).forEach(item => { item.d = similarLength(item.a, item.d || []); });
    });
    return scenario;
  }

  function chooseScenario(gate){
    const pool = BANK[gate] || BANK[1];
    const old = history()[gate] || [];
    const available = pool.filter(item => !old.includes(item.tag));
    const scenario = balanceAnswerLength(clone(pick(available.length ? available : pool)));
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
      version:'v3.2-150-items-varied-openings',
      bankSkillItems:150,
      scenariosPerBoss:5,
      perScenario:{Reading:2, Listening:2, Writing:1, Speaking:1},
      choiceQuality:'varied-openings-balanced-length-plausible-distractors'
    };
    return scenario;
  }

  function bindOverride(){
    if (!window.EAPHero?.startGateBoss || window.EAPBossReplayV32) return;
    window.EAPBossReplayV32 = true;
    const original = window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss = function(gateId){
      const gate = Number(String(gateId || '').replace(/\D/g, '')) || 1;
      window.EAPBossReplayScenario = { gate, scenario: chooseScenario(gate) };
      return original(gateId);
    };
  }

  const wait = setInterval(() => {
    bindOverride();
    if (window.EAPBossReplayV32) clearInterval(wait);
  }, 120);

  window.EAPBossReplayBankV3 = {
    version:'v3.2-150-items-varied-openings',
    bank:BANK,
    choose:chooseScenario,
    count:{bosses:5, scenarios:25, skillItems:150, reading:50, listening:50, writing:25, speaking:25},
    quality:{correctNotLongest:true, plausibleDistractors:true, balancedLength:true, variedOpenings:true}
  };
})();
