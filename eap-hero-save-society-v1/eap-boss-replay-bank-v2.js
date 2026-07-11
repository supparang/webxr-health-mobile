/* =========================================================
   EAP Boss Gate Replayability Bank V4.0 — Adaptive Remix
   - 8 rotating scenario families per B1-B5 = 40 scenario families.
   - Each family generates Reading 6 + Listening 6 + Writing 4 + Speaking 4.
   - Total generated bank = 800 skill-items.
   - First run: 3R + 3L + 1W + 1S = 8 Boss tasks.
   - Replay run: 4R + 4L + 2W + 2S = 12 Boss tasks.
   - Elite replay: 5R + 5L + 2W + 2S = 14 Boss tasks.
   - Per-gate/per-skill no-repeat item history prevents memorising the same run.
   - Scenario family no-repeat window = 5; item no-repeat window = 18.
   - Choices remain four-option, plausible, balanced-length, and shuffled.
   - Load AFTER eap-boss-four-skill-gate-v1.js.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v4.0-adaptive-remix-800-items';
  const HISTORY_KEY = 'EAP_BOSS_REPLAY_HISTORY_V40';
  const RUN_KEY = 'EAP_BOSS_REPLAY_RUN_COUNT_V40';
  const rand = n => Math.floor(Math.random() * Math.max(1, n));
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const sentence = s => /[.!?]$/.test(String(s || '').trim()) ? String(s).trim() : String(s || '').trim() + '.';

  const BLUEPRINTS = {
    1: [
      ['Goal Builder','academic reading goal','weekly reading action','progress note','goal setting'],
      ['Source Navigator','source topic','useful detail','study task','source use'],
      ['Study Routine','short study routine','self-test','next improvement','learning habit'],
      ['Vocabulary Tracker','academic word list','example sentence','review plan','word learning'],
      ['Main Idea Scout','short article','central message','support detail','main idea'],
      ['Lecture Starter','mini lecture','key message','note-taking check','lecture readiness'],
      ['Study Partner','peer feedback','one useful suggestion','revision action','collaboration'],
      ['Time Planner','weekly timetable','priority task','realistic deadline','study management']
    ],
    2: [
      ['Evidence Check','credible claim','relevant evidence','writer point','evidence'],
      ['Keyword Trail','focused search question','key terms','refined result','search strategy'],
      ['Summary Signal','source message','essential support','new wording','summary'],
      ['Claim Support','student claim','one reason','source detail','support'],
      ['Source Reliability','online source','author and date','useful context','credibility'],
      ['Bias Detector','news post','loaded wording','missing viewpoint','critical reading'],
      ['Paraphrase Shield','source sentence','meaning unit','new structure','paraphrasing'],
      ['Fact Trail','online statistic','original source','publication context','verification']
    ],
    3: [
      ['Paragraph Builder','topic sentence','support detail','closing idea','paragraph'],
      ['Tone Control','cautious claim','limited evidence','formal wording','academic tone'],
      ['Linking Logic','contrast idea','result idea','connector choice','cohesion'],
      ['Example Ladder','general idea','specific example','explanation','development'],
      ['Focus Keeper','paragraph purpose','irrelevant detail','main point','focus'],
      ['Evidence Sandwich','claim sentence','quoted detail','explanation link','evidence integration'],
      ['Revision Lens','first draft','weak sentence','clearer version','revision'],
      ['Coherence Map','paragraph sequence','logical order','reader pathway','coherence']
    ],
    4: [
      ['Data Reporter','survey result','numerical change','careful conclusion','data description'],
      ['Email Mission','academic email','specific request','polite closing','email'],
      ['Ethics Shield','AI support','fact checking','acknowledgement','ethics'],
      ['Citation Helper','borrowed idea','source name','own sentence','citation'],
      ['Note-to-Report','class notes','selected evidence','short report','reporting'],
      ['Chart Interpreter','bar chart','largest difference','limited inference','visual data'],
      ['Request Designer','course problem','clear request','professional reason','academic email'],
      ['Integrity Check','AI-generated draft','verified facts','transparent disclosure','responsible AI use']
    ],
    5: [
      ['Community Solution','local social problem','credible detail','realistic action','solution'],
      ['Digital Safety','online claim','original source','safe sharing','digital literacy'],
      ['Inclusive Campus','participation barrier','user feedback','evaluated change','inclusion'],
      ['Presentation Mission','social issue','evidence slide','clear recommendation','presentation'],
      ['Q&A Defender','audience question','evidence-based answer','honest limitation','Q&A'],
      ['Policy Pitch','campus challenge','stakeholder evidence','feasible proposal','policy communication'],
      ['Impact Story','community project','measured outcome','careful reflection','impact reporting'],
      ['Final Synthesis','multiple sources','shared pattern','qualified conclusion','integration']
    ]
  };

  function readJson(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (_) { return fallback; }
  }
  function writeJson(key, value){
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function similarLength(correct, list){
    const target = words(correct);
    const pads = ['with task focus','using source evidence','before submitting','for academic clarity','within the stated limit'];
    return list.map((item, idx) => {
      let out = String(item || '').replace(/\.$/, '').trim();
      while (words(out) < Math.max(8, target - 4) && words(out) < target + 2) out += ' ' + pads[(idx + words(out)) % pads.length];
      return sentence(out);
    });
  }

  function makeMcq(id, source, question, correct, distractors, focus){
    return { id, source:sentence(source), q:question, a:sentence(correct), d:similarLength(correct, distractors).slice(0,3), focus };
  }

  function readingItems(gate, b){
    const [tag, topic, detail, outcome, skill] = b;
    return [
      makeMcq(`${gate}-${tag}-R1`, `A learner working on ${topic} should choose one clear purpose, use ${detail}, and connect it to ${outcome}. This makes the work easier to explain in academic English.`, 'Which response best follows the source?', `Use one purpose, ${detail}, and explain the link to ${outcome}`, [`Use several purposes and ${detail}, but do not explain the link`, `Choose one purpose but replace ${detail} with an unrelated example`, `Copy the source wording and leave the link to ${outcome} unclear`], skill),
      makeMcq(`${gate}-${tag}-R2`, `In a strong EAP task, students do not only finish quickly. They check the instruction, select useful information, and explain why it matters for ${skill}.`, 'What should students do besides finishing quickly?', `Check the task, select useful information, and explain its value for ${skill}`, [`Check only the answer length and submit when it looks complete`, `Select information but omit why it matters for ${skill}`, `Submit quickly before checking the instruction carefully`], skill),
      makeMcq(`${gate}-${tag}-R3`, `A short source about ${topic} gives one example involving ${detail}. The example supports a limited point about ${outcome}, but it does not prove every case.`, 'Which conclusion is appropriately cautious?', `The example supports a limited point about ${outcome}, not a universal rule`, [`The example proves that every learner will reach ${outcome}`, `The example is irrelevant because it includes only one detail`, `The source proves nothing and should be ignored completely`], skill),
      makeMcq(`${gate}-${tag}-R4`, `Two notes discuss ${topic}. Note A lists many facts. Note B selects ${detail} and explains how it connects to ${outcome}.`, 'Which note is more academically useful?', `Note B, because it selects evidence and explains the connection`, [`Note A, because more facts always create a stronger argument`, `Both notes, because explanation is unnecessary in academic work`, `Neither note, because ${detail} should never be used as evidence`], skill),
      makeMcq(`${gate}-${tag}-R5`, `A student revises a response about ${topic}. The revision keeps the main claim, adds ${detail}, and removes one unrelated sentence.`, 'What improved the response most?', `It added relevant support and removed an unrelated detail`, [`It made the response longer regardless of relevance`, `It removed the main claim and kept only background information`, `It repeated the same sentence to sound more confident`], skill),
      makeMcq(`${gate}-${tag}-R6`, `A reviewer says the response about ${topic} is clear but needs a stronger link between ${detail} and ${outcome}.`, 'Which revision directly answers the feedback?', `Add one sentence explaining how ${detail} leads to ${outcome}`, [`Add a new topic that is unrelated to ${outcome}`, `Replace ${detail} with a personal opinion without support`, `Delete the explanation and make the claim more absolute`], skill)
    ];
  }

  function listeningItems(gate, b){
    const [tag, topic, detail, outcome, skill] = b;
    return [
      makeMcq(`${gate}-${tag}-L1`, `The tutor says, “For ${topic}, start with one simple point. Then add ${detail}. Finally, explain the link to ${outcome}.”`, 'What should the learner add after the simple point?', `Add ${detail}`, [`Add an unrelated story`, `Add a private opinion with no support`, `Add only a greeting and stop`], skill),
      makeMcq(`${gate}-${tag}-L2`, `A student explains, “I improved my ${skill} task by checking the instruction, choosing one useful detail, and revising before submitting.”`, 'Which action helped the student improve?', 'Checking the instruction, choosing a useful detail, and revising', [`Submitting quickly and avoiding revision`, `Removing useful details after reading once`, `Changing the answer randomly without checking the task`], skill),
      makeMcq(`${gate}-${tag}-L3`, `The lecturer says, “This example about ${topic} is useful, but remember that one example cannot support a broad conclusion.”`, 'What limitation does the lecturer mention?', 'One example cannot support a broad conclusion', [`Every example proves a broad conclusion`, `Examples should never be used in academic work`, `The topic is too simple to require evidence`], skill),
      makeMcq(`${gate}-${tag}-L4`, `The tutor compares two responses. The first lists facts. The second uses ${detail} and explains its connection to ${outcome}.`, 'Why is the second response stronger?', `It explains how ${detail} connects to ${outcome}`, [`It contains fewer words and no explanation`, `It uses a stronger opinion instead of evidence`, `It avoids the task and changes to another topic`], skill),
      makeMcq(`${gate}-${tag}-L5`, `The teacher advises, “Keep the central message, remove repeated details, and use your own wording when you revise ${topic}.”`, 'Which revision strategy was recommended?', 'Keep the central message, remove repetition, and use new wording', [`Copy every sentence in the original order`, `Add repeated details to increase length`, `Remove the central message and keep examples only`], skill),
      makeMcq(`${gate}-${tag}-L6`, `A peer says, “Your point about ${topic} is clear. Now add one sentence showing why ${detail} matters for ${outcome}.”`, 'What should the learner add?', `A sentence explaining why ${detail} matters for ${outcome}`, [`A new claim with no relationship to ${topic}`, `A more confident tone without additional support`, `A repeated title instead of an explanation`], skill)
    ];
  }

  function writingItems(gate, b){
    const [tag, topic, detail, outcome] = b;
    return [
      {id:`${gate}-${tag}-W1`, prompt:`Write 2–4 sentences about ${topic}. Include ${detail} and explain how it connects to ${outcome}.`},
      {id:`${gate}-${tag}-W2`, prompt:`Write a cautious claim about ${topic}, support it with ${detail}, and add one limitation.`},
      {id:`${gate}-${tag}-W3`, prompt:`Write a mini-summary of ${topic}: one main point, one essential detail, and one concluding sentence.`},
      {id:`${gate}-${tag}-W4`, prompt:`Revise this weak idea into 2–4 academic sentences: “${topic} is always successful.” Use ${detail} and avoid overclaiming.`}
    ];
  }

  function speakingItems(gate, b){
    const [tag, topic, detail, outcome] = b;
    return [
      {id:`${gate}-${tag}-S1`, prompt:`Speak for 30–45 seconds about ${topic}. Mention ${detail}, connect it to ${outcome}, and close clearly.`},
      {id:`${gate}-${tag}-S2`, prompt:`Give a short evidence-based explanation of ${topic}. Include ${detail} and one honest limitation.`},
      {id:`${gate}-${tag}-S3`, prompt:`Present one recommendation related to ${topic}. Give one reason, use ${detail}, and finish with a call to action.`},
      {id:`${gate}-${tag}-S4`, prompt:`Answer a short Q&A question: “Why does ${topic} matter?” Use ${detail}, connect it to ${outcome}, and avoid a broad claim.`}
    ];
  }

  function makeScenario(gate, b){
    const [tag, topic, detail, outcome, skill] = b;
    return {
      tag, gate, skillFocus:skill,
      readingItems:readingItems(gate,b),
      listeningItems:listeningItems(gate,b),
      writingItems:writingItems(gate,b),
      speakingItems:speakingItems(gate,b),
      writingFrames:[`This task focuses on ${topic}.`,`One relevant detail is ${detail}.`,`This supports ${outcome}, although the evidence has limits.`],
      speakingFrames:[`Today I will explain ${topic}.`,`One important detail is ${detail}.`,`This connects to ${outcome}, but the conclusion should remain careful.`]
    };
  }

  const BANK = Object.fromEntries(Object.entries(BLUEPRINTS).map(([gate, rows]) => [Number(gate), rows.map(row => makeScenario(Number(gate), row))]));

  function history(){ return readJson(HISTORY_KEY, {scenario:{},items:{}}); }
  function saveHistory(h){ writeJson(HISTORY_KEY,h); }
  function rememberScenario(gate, tag){
    const h=history(); h.scenario[gate]=(h.scenario[gate]||[]).filter(x=>x!==tag).slice(-4); h.scenario[gate].push(tag); saveHistory(h);
  }
  function rememberItems(gate, skill, ids){
    const h=history(); const key=`${gate}:${skill}`; h.items[key]=(h.items[key]||[]).filter(x=>!ids.includes(x)).slice(-18); h.items[key].push(...ids); saveHistory(h);
  }
  function oldItems(gate, skill){ return history().items[`${gate}:${skill}`] || []; }

  function shuffled(arr){
    const out=arr.slice();
    for(let i=out.length-1;i>0;i--){ const j=rand(i+1); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }
  function selectNoRepeat(items, count, old){
    const fresh=shuffled(items.filter(x=>!old.includes(x.id)));
    const rest=shuffled(items.filter(x=>old.includes(x.id)));
    return fresh.concat(rest).slice(0,Math.min(count,items.length));
  }
  function runCount(gate){ const all=readJson(RUN_KEY,{}); return Number(all[gate]||0); }
  function incrementRun(gate){ const all=readJson(RUN_KEY,{}); all[gate]=Number(all[gate]||0)+1; writeJson(RUN_KEY,all); return all[gate]; }
  function planFor(gate){
    const prior=runCount(gate);
    if(prior<=0) return {mode:'First Clash',reading:3,listening:3,writing:1,speaking:1,total:8,replayLevel:0};
    if(prior===1) return {mode:'Rematch Remix',reading:4,listening:4,writing:2,speaking:2,total:12,replayLevel:1};
    return {mode:'Elite Remix',reading:5,listening:5,writing:2,speaking:2,total:14,replayLevel:Math.min(5,prior)};
  }

  function chooseScenario(gate){
    const pool=BANK[gate]||BANK[1];
    const used=history().scenario[gate]||[];
    const available=pool.filter(x=>!used.includes(x.tag));
    const scenario=clone(shuffled(available.length?available:pool)[0]);
    const plan=planFor(gate);

    const reading=selectNoRepeat(scenario.readingItems,plan.reading,oldItems(gate,'Reading'));
    const listening=selectNoRepeat(scenario.listeningItems,plan.listening,oldItems(gate,'Listening'));
    const writing=selectNoRepeat(scenario.writingItems,plan.writing,oldItems(gate,'Writing'));
    const speaking=selectNoRepeat(scenario.speakingItems,plan.speaking,oldItems(gate,'Speaking'));

    rememberScenario(gate,scenario.tag);
    rememberItems(gate,'Reading',reading.map(x=>x.id));
    rememberItems(gate,'Listening',listening.map(x=>x.id));
    rememberItems(gate,'Writing',writing.map(x=>x.id));
    rememberItems(gate,'Speaking',speaking.map(x=>x.id));
    const runNo=incrementRun(gate);

    scenario.runPlan={...plan,runNo};
    scenario.runItems={reading,listening,writing,speaking};

    // Backward-compatible first item fields.
    const r=reading[0]||scenario.readingItems[0];
    const l=listening[0]||scenario.listeningItems[0];
    scenario.reading=r.source; scenario.rq=r.q; scenario.ra=r.a; scenario.rd=r.d;
    scenario.listening=l.source; scenario.lq=l.q; scenario.la=l.a; scenario.ld=l.d;
    scenario.writing=(writing[0]||scenario.writingItems[0]).prompt;
    scenario.speaking=(speaking[0]||scenario.speakingItems[0]).prompt;

    scenario.itemMeta={
      version:VERSION,
      bankSkillItems:800,
      scenarioFamiliesPerBoss:8,
      generatedPerFamily:{Reading:6,Listening:6,Writing:4,Speaking:4},
      runPlan:scenario.runPlan,
      noRepeat:{scenarioWindow:5,itemWindow:18},
      choiceQuality:'four-native-options-balanced-length-plausible-distractors'
    };
    return scenario;
  }

  function bindOverride(){
    if(!window.EAPHero?.startGateBoss||window.EAPBossReplayV40) return;
    window.EAPBossReplayV40=true;
    const original=window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss=function(gateId){
      const gate=Number(String(gateId||'').replace(/\D/g,''))||1;
      window.EAPBossReplayScenario={gate,scenario:chooseScenario(gate)};
      return original(gateId);
    };
  }

  const wait=setInterval(()=>{ bindOverride(); if(window.EAPBossReplayV40) clearInterval(wait); },120);

  window.EAPBossReplayBankV3={
    version:VERSION,
    bank:BANK,
    choose:chooseScenario,
    count:{bosses:5,scenarioFamilies:40,skillItems:800,reading:240,listening:240,writing:160,speaking:160},
    runPlans:{first:{R:3,L:3,W:1,S:1,total:8},replay:{R:4,L:4,W:2,S:2,total:12},elite:{R:5,L:5,W:2,S:2,total:14}},
    quality:{noRepeat:true,scenarioWindow:5,itemWindow:18,correctNotLongest:true,plausibleDistractors:true,balancedLength:true,fourNativeChoices:true}
  };
})();