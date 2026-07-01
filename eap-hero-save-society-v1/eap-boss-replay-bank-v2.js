/* =========================================================
 EAP Boss Gate Replayability Bank v2
 - 3 rotating scenarios per B1–B5 (15 total)
 - no-repeat window per gate
 - answer positions shuffled
 - Reading + Listening + Writing + Speaking evidence
 Load AFTER eap-boss-four-skill-gate-v1.js
========================================================= */
(() => {
  'use strict';

  const KEY = 'EAP_BOSS_4SKILL_SCENARIO_HISTORY_V2';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const rand = (n) => Math.floor(Math.random() * n);

  const BANK = {
    1: [
      {
        tag:'Goal Builder',
        reading:'Academic study becomes manageable when learners set one specific goal, choose a practical action, and review their progress each week.',
        rq:'Which plan follows the source most closely?',
        ra:'Set one specific goal, take one practical action, and review progress weekly.',
        rd:['Set many unrelated goals and ignore progress.','Wait until the final week before planning.','Use only difficult words without an action.'],
        listening:'A student says, “My goal is to improve reading. I will read one short academic text every Tuesday and record one useful word.”',
        lq:'What makes the student’s plan practical?',
        la:'It includes a clear goal, a regular action, and a small record of progress.',
        ld:['It avoids reading difficult material forever.','It focuses only on earning coins.','It uses many goals at the same time.'],
        writing:'Write 2–4 sentences: give one academic goal, one weekly action, and one way to check progress.',
        speaking:'Speak for 30–45 seconds: introduce your goal, explain one action, and finish with a closing.'
      },
      {
        tag:'Source Navigator',
        reading:'Before using a source, a learner should identify the topic, highlight one useful detail, and explain how that detail supports the task.',
        rq:'Which response uses the source in an academic way?',
        ra:'Identify the topic, select one useful detail, and explain its connection to the task.',
        rd:['Copy every sentence without selecting a detail.','Choose a detail because it is the longest sentence.','Ignore the task and focus only on design.'],
        listening:'The tutor says, “A useful note is short. It includes the topic, one key detail, and your reason for saving that detail.”',
        lq:'What should a useful note include?',
        la:'The topic, one key detail, and a reason for keeping it.',
        ld:['Only the title of the source.','Every word from the text.','A personal greeting and no detail.'],
        writing:'Write 2–4 sentences: state a source topic, one useful detail, and why it helps your study.',
        speaking:'Speak for 30–45 seconds: explain a topic, one detail, and why the detail is useful.'
      },
      {
        tag:'Study Routine',
        reading:'A realistic study routine uses a short time block, one clear task, and a reflection on what to improve next time.',
        rq:'Which routine is realistic and reflective?',
        ra:'Use a short time block for one task and reflect on one improvement.',
        rd:['Study without a task until feeling tired.','Plan for ten hours every day with no reflection.','Change the task every minute.'],
        listening:'The speaker explains, “I study vocabulary for fifteen minutes, test myself, then write one word I still need to practise.”',
        lq:'What does the speaker do after self-testing?',
        la:'Records one word that still needs practice.',
        ld:['Stops learning for the whole week.','Deletes all previous notes.','Chooses words at random without review.'],
        writing:'Write 2–4 sentences: describe a short study routine and one improvement you would make next time.',
        speaking:'Speak for 30–45 seconds: describe your routine, one challenge, and one improvement.'
      }
    ],
    2: [
      {
        tag:'Evidence Check',
        reading:'A credible claim should be supported by evidence that is relevant, recent enough for the topic, and connected clearly to the writer’s point.',
        rq:'Which use of evidence is strongest?',
        ra:'Use relevant evidence and explain clearly how it supports the claim.',
        rd:['Use a famous quote that does not address the claim.','Use one number without saying where it came from.','Use an old example only because it is easy to remember.'],
        listening:'The lecturer says, “Do not treat a source as proof just because it agrees with you. Check who produced it and what evidence it provides.”',
        lq:'What should a learner check before accepting a source?',
        la:'Who produced it and what evidence it provides.',
        ld:['Whether it has a colorful logo.','Whether it confirms a first impression.','Whether it is the shortest available text.'],
        writing:'Write 2–4 sentences: make one claim, add one supporting detail, and explain why the detail is relevant.',
        speaking:'Speak for 30–45 seconds: state a claim, mention one evidence check, and give a conclusion.'
      },
      {
        tag:'Keyword Trail',
        reading:'Effective search begins with a focused question. Learners choose key terms, compare results, and refine the search when the results are too broad.',
        rq:'What should a learner do when results are too broad?',
        ra:'Refine the search terms to make the question more focused.',
        rd:['Accept the first result without reading it.','Remove all key terms from the search.','Use unrelated words to get more pages.'],
        listening:'A student says, “I started with ‘student wellbeing’. Then I added ‘university survey’ because the first results were too general.”',
        lq:'Why did the student add more terms?',
        la:'To make the search results more specific.',
        ld:['To avoid looking at evidence.','To find fewer sources without a topic.','To replace the original question.'],
        writing:'Write 2–4 sentences: give a research question, two search terms, and how you would refine them.',
        speaking:'Speak for 30–45 seconds: explain your research question and one way to improve a search.'
      },
      {
        tag:'Summary Signal',
        reading:'An academic summary keeps the main idea, selects essential support, and uses new wording rather than copying the source sentence by sentence.',
        rq:'Which summary practice is appropriate?',
        ra:'Keep the main idea and essential support while using new wording.',
        rd:['Copy the whole source and remove only one word.','List every example with no main idea.','Replace academic words with unrelated slang.'],
        listening:'The tutor says, “A summary is shorter than the source, but it should not remove the central message.”',
        lq:'What should not be removed from a summary?',
        la:'The central message.',
        ld:['All support details in every case.','The writer’s own wording.','The purpose of reading.'],
        writing:'Write 2–4 sentences: summarize a short source idea using your own wording and one key support detail.',
        speaking:'Speak for 30–45 seconds: state a main idea, one support detail, and explain how you avoided copying.'
      }
    ],
    3: [
      {
        tag:'Paragraph Builder',
        reading:'A clear academic paragraph begins with a focused topic sentence, develops the idea with one relevant support detail, and ends by returning to the main point.',
        rq:'Which paragraph structure is strongest?',
        ra:'Focused topic sentence, relevant support detail, and a closing linked to the main point.',
        rd:['Greeting, unrelated example, and a new topic.','Several claims with no support or closing.','A closing sentence followed by a topic sentence.'],
        listening:'The teacher says, “Your support detail must explain the topic sentence. Do not add an interesting fact that has no connection.”',
        lq:'What must a support detail do?',
        la:'Explain or develop the topic sentence.',
        ld:['Introduce a completely new topic.','Make the paragraph longer only.','Replace the closing sentence.'],
        writing:'Write a 3–4 sentence paragraph about one study strategy. Include a topic sentence, support detail, and closing.',
        speaking:'Speak for 30–45 seconds: explain your topic sentence, one support detail, and your closing idea.'
      },
      {
        tag:'Tone Control',
        reading:'Academic tone is usually clear, formal, and appropriately cautious. Strong claims need evidence, and slang can make an argument less suitable for formal study.',
        rq:'Which sentence has the most appropriate academic tone?',
        ra:'The findings suggest that regular review may support vocabulary retention.',
        rd:['This totally proves that review is always awesome.','Everyone knows this is the best method ever.','The results are crazy and impossible to question.'],
        listening:'The speaker says, “Use cautious language when your evidence is limited. Words such as may, suggests, and appears can be more accurate.”',
        lq:'Why use cautious language?',
        la:'It matches the strength of limited evidence more accurately.',
        ld:['It makes every claim weaker than necessary.','It avoids mentioning evidence.','It guarantees a high score automatically.'],
        writing:'Write 2–4 sentences: make a cautious academic claim about one study method and give one reason.',
        speaking:'Speak for 30–45 seconds: give one cautious claim, one reason, and a final summary.'
      },
      {
        tag:'Linking Logic',
        reading:'Linking words help readers follow relationships between ideas, but each connector must match the relationship it introduces, such as contrast, cause, or addition.',
        rq:'Which connector best signals contrast?',
        ra:'However',
        rd:['Therefore','For example','In addition'],
        listening:'The tutor says, “Use therefore after a reason when you want to show a result. Use however when the next idea contrasts with the first.”',
        lq:'Which word signals a result after a reason?',
        la:'Therefore',
        ld:['However','Although','Meanwhile'],
        writing:'Write 2–4 sentences that use one contrast connector and one result connector correctly.',
        speaking:'Speak for 30–45 seconds: compare two study ideas and use a contrast or result connector.'
      }
    ],
    4: [
      {
        tag:'Data Reporter',
        reading:'When describing data, writers should report the figures accurately, identify the period or group, and avoid claiming a cause unless the evidence supports causation.',
        rq:'Which statement describes data responsibly?',
        ra:'Online quiz use rose from 40% to 58%; this shows an increase but does not prove the cause.',
        rd:['Online quizzes caused every improvement because use increased.','The percentage is unimportant, so no figure is needed.','A higher number always proves a successful course.'],
        listening:'The presenter says, “The survey result increased by eighteen percentage points. We can report the change, but we should not claim why it happened without further evidence.”',
        lq:'What should the presenter avoid claiming?',
        la:'Why the change happened without further evidence.',
        ld:['The numerical change.','The survey period.','The group that responded.'],
        writing:'Write 2–4 sentences: describe a data change and explain one limit on the conclusion.',
        speaking:'Speak for 30–45 seconds: report a trend, mention one limitation, and close clearly.'
      },
      {
        tag:'Email Mission',
        reading:'A polite academic email clearly states its purpose, gives the necessary context, makes a respectful request, and ends with an appropriate closing.',
        rq:'Which email action is most appropriate?',
        ra:'State the purpose, provide context, make a respectful request, and use a closing.',
        rd:['Send only “Reply now” with no context.','Use slang and omit the reason for writing.','Write a long story without a clear request.'],
        listening:'The instructor says, “A useful request includes the course context and a specific question. This helps the reader respond efficiently.”',
        lq:'What helps a reader respond efficiently?',
        la:'Course context and a specific question.',
        ld:['A message with no subject.','A dramatic personal story.','Several unrelated requests.'],
        writing:'Write a short academic email requesting clarification about one assignment requirement.',
        speaking:'Speak for 30–45 seconds: explain the purpose of your email and one polite request phrase.'
      },
      {
        tag:'Ethics Shield',
        reading:'Responsible use of AI and sources includes checking accuracy, acknowledging meaningful support, and revising the final work so it represents the learner’s own understanding.',
        rq:'Which action is most responsible?',
        ra:'Check AI or source information, acknowledge meaningful support, and revise the final work yourself.',
        rd:['Submit AI output without reading it.','Hide the source so the work looks original.','Copy a classmate’s work because the deadline is close.'],
        listening:'The speaker says, “AI can help you brainstorm, but you remain responsible for checking facts and deciding what belongs in your final answer.”',
        lq:'Who remains responsible for the final answer?',
        la:'The learner.',
        ld:['The AI tool alone.','A random website.','The first source found online.'],
        writing:'Write 2–4 sentences: describe one responsible way to use AI or a source in coursework.',
        speaking:'Speak for 30–45 seconds: explain one benefit of AI and one responsibility of the learner.'
      }
    ],
    5: [
      {
        tag:'Community Solution',
        reading:'A practical response to a social problem identifies a specific issue, uses a credible detail, and proposes an action that can realistically be carried out by a community or institution.',
        rq:'Which proposal is most practical?',
        ra:'Identify a local issue, support it with a credible detail, and propose a realistic community action.',
        rd:['Promise to solve every social problem in one day.','Choose an action without explaining the issue.','Use a dramatic claim with no evidence.'],
        listening:'The speaker says, “Our campus can reduce plastic waste by placing clear refill information near water stations and asking students to bring reusable bottles.”',
        lq:'What action does the speaker propose?',
        la:'Provide refill information and encourage reusable bottles.',
        ld:['Close all water stations.','Ignore plastic waste data.','Ask students to buy more disposable bottles.'],
        writing:'Write 3–4 sentences: name one local problem, give one evidence-based detail, and propose one realistic action.',
        speaking:'Speak for 30–45 seconds: present the problem, one detail, one solution, and a conclusion.'
      },
      {
        tag:'Digital Safety',
        reading:'Digital literacy includes checking information before sharing it, protecting personal data, and choosing a response that reduces harm rather than spreading misinformation.',
        rq:'Which response shows digital literacy?',
        ra:'Check the information, protect personal data, and avoid spreading unverified claims.',
        rd:['Share first and check later.','Post private data to make a message convincing.','Assume every popular post is accurate.'],
        listening:'The tutor says, “Before reposting, look for the original source and compare the claim with reliable information.”',
        lq:'What should a learner do before reposting?',
        la:'Look for the original source and compare the claim with reliable information.',
        ld:['Add a stronger opinion immediately.','Delete the topic without checking it.','Trust the most shared version only.'],
        writing:'Write 3–4 sentences: explain how you would check one online claim before sharing it.',
        speaking:'Speak for 30–45 seconds: describe one digital safety action, one reason, and a closing.'
      },
      {
        tag:'Inclusive Campus',
        reading:'An inclusive campus solution listens to different users, identifies a barrier to participation, and proposes a change that can be evaluated after implementation.',
        rq:'Which plan is most inclusive?',
        ra:'Listen to different users, identify a participation barrier, and evaluate a practical change.',
        rd:['Choose a solution without asking affected users.','Assume one group represents all users.','Ignore whether the change improves participation.'],
        listening:'The student leader says, “We collected feedback from students with different schedules, then proposed a flexible consultation hour and planned to review attendance after one month.”',
        lq:'What will the group review after one month?',
        la:'Attendance after the flexible consultation hour begins.',
        ld:['The color of the consultation room.','Only one student’s opinion.','A new unrelated campus rule.'],
        writing:'Write 3–4 sentences: identify a participation barrier and propose one change that could be evaluated.',
        speaking:'Speak for 30–45 seconds: explain the barrier, one inclusive action, and how you would evaluate it.'
      }
    ]
  };

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function history() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (error) { return {}; }
  }

  function remember(gate, tag) {
    const all = history();
    all[gate] = (all[gate] || []).filter(x => x !== tag);
    all[gate].push(tag);
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  function choose(gate) {
    const pool = BANK[gate] || BANK[1];
    const old = history()[gate] || [];
    const available = pool.filter(item => !old.includes(item.tag));
    const item = (available.length ? available : pool)[rand((available.length ? available : pool).length)];
    remember(gate, item.tag);
    return item;
  }

  function bindOverride() {
    if (!window.EAPHero?.startGateBoss || window.EAPBossReplayV2) return;
    window.EAPBossReplayV2 = true;
    const original = window.EAPHero.startGateBoss;

    window.EAPHero.startGateBoss = function(gateId) {
      const gate = Number(String(gateId || '').replace(/\D/g, '')) || 1;
      const scenario = choose(gate);

      // The v1 four-skill patch reads this object when it begins.
      window.EAPBossReplayScenario = { gate, scenario };
      return original(gateId);
    };
  }

  const wait = setInterval(() => {
    bindOverride();
    if (window.EAPBossReplayV2) clearInterval(wait);
  }, 120);
})();
