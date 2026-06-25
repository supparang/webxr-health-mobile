/* EAP Hero v1z69 Integrated Boss Runtime Fix */
(function(){
  'use strict';

  const WEEKLY_GAME_CONTEXT = {"1":{"theme":"Theme 1 · Academic Identity & Purpose","learn":"Turn a vague wish into a measurable academic goal.","activity":"Read a student-support case, diagnose the gap, then explain a personal goal to the British co-teacher.","liveRole":"Incoming UK Student","wildcard":"What will you do every week, and how will you check progress?","humanProof":"30-second Academic Goal Passport","core":{"skill":"Reading","title":"Academic Goal Audit","artifactLabel":"Student Support File","artifact":"Dr. Morgan meets Narin, who says, “I will study more English this semester.” The idea is positive, but it is not a clear academic goal. Narin needs to name one skill, choose one action to do every week, and decide how to check progress. For example, he could practise summarising one short article each week and compare the next summary with teacher feedback. A clear plan helps him see whether the skill is improving.","questions":["Why is Narin’s goal unclear?","What three parts should a stronger goal include?","Which detail gives a weekly action and a progress check?"],"steps":["Find the weak goal.","Find skill + weekly action + progress check.","Answer with one detail from the file."],"frames":["The goal is unclear because ___.","A stronger goal should include ___, ___, and ___.","The passage says, “___.”"],"vocab":["academic goal","skill","weekly action","progress check","summarise"],"expected":"3 short evidence-based answers"},"support":{"skill":"Speaking","title":"Mission Passport Talk","artifactLabel":"Live Co-Teacher Prompt","artifact":"Tell an incoming UK student one academic skill you want to improve, one weekly action, and one way you will check progress.","instruction":"Speak for 30–45 seconds. Use one clear goal, one action, and one progress check. Then respond to the live follow-up question.","steps":["State one academic skill.","Give one weekly action.","Explain how you will check progress."],"frames":["My academic goal is to improve ___.","Every week, I will ___.","I will check my progress by ___."],"vocab":["goal","improve","weekly","practice","progress"],"expected":"30–45 second goal talk"}},"2":{"theme":"Theme 1 · Academic Literacy","learn":"Use academic vocabulary from a real university context, not isolated word lists.","activity":"Decode a UK course notice, infer word meaning from context, then write a short useful response.","liveRole":"UK Campus Decoder","wildcard":"How does this word change when it appears in a report instead of an email?","humanProof":"Vocabulary Rescue Card + one context sentence","core":{"skill":"Reading","title":"UK Course Notice Decoder","artifactLabel":"UK Campus Notice","artifact":"Dear students, please submit the first draft of your learning reflection by Friday. Your tutor will give feedback on the clarity of your main idea, use of evidence, and academic vocabulary. The final version should show how you revised your work after feedback. Do not copy a model answer. Use the model only to notice useful language and organisation.","questions":["What does draft mean in this notice?","What clue helps you understand feedback?","What should students do after feedback?"],"steps":["Circle a useful academic word.","Use the sentence around it as a clue.","Explain the word in a short answer."],"frames":["The word ___ means ___.","A clue is ___.","Students should ___ after feedback."],"vocab":["draft","feedback","evidence","revise","submit"],"expected":"3 vocabulary-in-context answers"},"support":{"skill":"Writing","title":"Vocabulary Rescue Reply","artifactLabel":"Student Reply Task","artifact":"Reply to the tutor’s notice. Show that you understand draft, feedback, and revise.","instruction":"Write a 50–70 word reply. Use at least two target words accurately and explain one action you will take.","steps":["Greet the tutor.","State what you will submit or revise.","Use two academic words in context."],"frames":["Dear ____,","I will submit/revise ___.","I will use your feedback to ___."],"vocab":["draft","feedback","revise","clarity","evidence"],"expected":"50–70 word academic reply"}},"3":{"theme":"Theme 1 · Global Academic Communication","learn":"Separate a main idea from interesting but less central details.","activity":"Read a project briefing with distracting details, then write a one-sentence brief for an international project manager.","liveRole":"Project Briefing Manager","wildcard":"Explain the main idea in ten words.","humanProof":"Main Idea + one supporting detail","core":{"skill":"Reading","title":"The Broken Brief","artifactLabel":"Project Briefing","artifact":"The university wants student teams to create a short guide for new international students. The guide should explain one common academic challenge and offer practical support. Teams may use a poster, a short video, or a digital page. The project manager also mentions that the launch event will have blue posters, music, and snacks. These details may be useful later, but they are not the central purpose of the briefing.","questions":["What is the main idea of the briefing?","Which detail supports the main idea?","Which detail is interesting but not central?"],"steps":["Ask what the whole briefing is mainly about.","Choose one detail that directly supports it.","Reject event details that do not control the task."],"frames":["The main idea is ___.","One supporting detail is ___.","A less central detail is ___."],"vocab":["briefing","main idea","support","central","detail"],"expected":"main idea + evidence"},"support":{"skill":"Writing","title":"One-Sentence Project Brief","artifactLabel":"Project Manager Message","artifact":"Write a one-sentence brief that helps a team remember the central purpose of the international-student guide.","instruction":"Write 35–50 words. State the project purpose and one useful support detail. Do not include the event decorations.","steps":["Start with the project purpose.","Add one support detail.","Leave out distracting details."],"frames":["The project asks teams to ___.","The guide should help students by ___.","One useful detail is ___."],"vocab":["purpose","guide","support","international students","detail"],"expected":"35–50 word project brief"}},"4":{"theme":"Theme 2 · Discourse & Academic Meaning","learn":"Use keywords and signal words to follow sequence, contrast, cause and result.","activity":"Read and hear a campus announcement, build a signal map, then identify what changes after however.","liveRole":"Announcement Host","wildcard":"What changed after the word however?","humanProof":"Signal Map + relationship explanation","core":{"skill":"Reading","title":"Signal Relay Notice","artifactLabel":"Campus Announcement","artifact":"First, all teams should collect one source for the campus guide. Because the guide is for new students, the source must be clear and useful. However, teams should not copy long sentences from the source. Instead, they should write key words and explain the message in their own words. Therefore, the final guide will be shorter, clearer, and easier to use.","questions":["Which signal word shows contrast?","What happens because the guide is for new students?","What result follows after therefore?"],"steps":["Find the signal word.","Name its relationship.","Explain the message before and after it."],"frames":["The signal word is ___.","It shows ___.","Therefore, the result is ___."],"vocab":["first","because","however","therefore","instead"],"expected":"signal-word explanation"},"support":{"skill":"Listening","title":"Campus Announcement Audio","artifactLabel":"British Co-Teacher Live Audio","artifact":"First, all teams should collect one source for the campus guide. Because the guide is for new students, the source must be clear and useful. However, teams should not copy long sentences from the source. Instead, they should write key words and explain the message in their own words. Therefore, the final guide will be shorter, clearer, and easier to use.","instruction":"Listen twice. Take notes on the main point, two signal words, and one result. Then ask one clarification question if needed.","steps":["Listen for repeated key words.","Write two signal words.","Explain one relationship."],"frames":["I heard ___ and ___.","However shows ___.","The result is ___."],"vocab":["signal","contrast","cause","result","key words"],"expected":"main point + 2 signals + result"}},"5":{"theme":"Theme 2 · Evidence, Communities & Culture","learn":"Check claims, evidence, bias and missing information before accepting a source.","activity":"Investigate a social-media claim, decide what is trustworthy, then defend the team verdict live.","liveRole":"Chief Evidence Officer","wildcard":"What would make you change your decision?","humanProof":"Evidence Verdict + oral defence","core":{"skill":"Reading","title":"Evidence Court Case","artifactLabel":"Social-Media Claim","artifact":"A popular post says that every student who uses an AI tool will receive higher grades. The post includes one screenshot of a student’s score, but it does not name the course, number of students, or method used. The writer calls the tool “a miracle for everyone.” A university tutor replies that one example is not enough to prove a general claim. Readers should check the source, date, purpose, and evidence before sharing the post.","questions":["What claim does the post make?","What evidence or bias should readers notice?","What should readers check before accepting the claim?"],"steps":["Find the claim.","Separate evidence from emotional wording.","Name one missing check."],"frames":["The claim is ___.","The evidence/bias is ___.","Readers should check ___."],"vocab":["claim","evidence","bias","source","credible"],"expected":"claim + evidence check"},"support":{"skill":"Speaking","title":"Evidence Court Defence","artifactLabel":"Chief Evidence Officer Challenge","artifact":"Your team must tell the Chief Evidence Officer whether the post is trustworthy and explain one reason with evidence.","instruction":"Speak for 45 seconds. State a verdict, use one source detail, and answer the wildcard question.","steps":["Give a verdict.","Name one detail from the case.","Explain what you would check."],"frames":["Our verdict is ___.","The post says ___, but ___.","We would check ___ before ___."],"vocab":["trustworthy","claim","evidence","bias","check"],"expected":"45-second evidence defence"}},"6":{"theme":"Theme 2 · Genre & Academic Texts","learn":"Summarise a source in own words and distinguish central ideas from details.","activity":"Act as a Summary Editor: create a concise source-based summary, then explain why some details were omitted.","liveRole":"Summary Editor","wildcard":"Remove fifteen words but keep the meaning.","humanProof":"Three-sentence own-words summary","core":{"skill":"Writing","title":"Summary Press Room","artifactLabel":"Source for Summary","artifact":"The university library noticed that many first-year students open many online sources but do not evaluate them carefully. The library has created a short workshop on checking authors, dates, evidence and purpose. Students who attend the workshop will practise comparing two sources before using them in a report. The workshop also offers free tea and a bookmark with library opening times.","instruction":"Write a 60–80 word summary in your own words. Include the main idea and one key support. Do not include the tea or bookmark detail.","steps":["Find the central idea.","Keep one useful support detail.","Rewrite without copying long phrases."],"frames":["The source mainly explains ___.","One important support is ___.","In my own words, ___."],"vocab":["summary","source","evaluate","evidence","purpose"],"expected":"60–80 word own-words summary"},"support":{"skill":"Reading","title":"Summary Filter","artifactLabel":"Editor’s Source Check","artifact":"The university library noticed that many first-year students open many online sources but do not evaluate them carefully. The library has created a short workshop on checking authors, dates, evidence and purpose. Students who attend the workshop will practise comparing two sources before using them in a report. The workshop also offers free tea and a bookmark with library opening times.","questions":["What is the most important idea for the summary?","Which detail can be omitted?","Why should that detail be omitted?"],"steps":["Find the central message.","Separate useful support from small extras.","Explain your selection."],"frames":["The main idea is ___.","I can omit ___.","It is minor because ___."],"vocab":["central idea","support","omit","minor","summary"],"expected":"summary planning evidence"}},"7":{"theme":"Theme 2 · Tone, Stance & Audience","learn":"Change casual or overly strong wording into clear academic communication for different audiences.","activity":"Rewrite a message for a lecturer, then explain the same idea to a new audience live.","liveRole":"Audience Switcher","wildcard":"Now say the same idea to a university dean.","humanProof":"Tone Makeover Card + spoken audience switch","core":{"skill":"Writing","title":"Tone Switchboard Rewrite","artifactLabel":"Casual Student Message","artifact":"Hi teacher, my group totally messed up the report because the instructions were super confusing. We need more time ASAP. Also, the feedback was kind of bad and nobody understood it.","instruction":"Rewrite the message as a polite 60–80 word academic email to a lecturer. Keep the problem, but remove casual or emotional language.","steps":["Find casual/strong words.","Choose polite academic replacements.","Make one clear request."],"frames":["Dear ____,","I am writing to explain ___.","Could you please ___?","Thank you for ___."],"vocab":["clarify","request","feedback","deadline","appreciate"],"expected":"polite academic rewrite"},"support":{"skill":"Speaking","title":"Audience Shift Live","artifactLabel":"Audience Switcher Prompt","artifact":"Explain the same report problem first to a classmate, then to a university dean. Change your tone and level of formality.","instruction":"Speak for 45 seconds. Use one polite request and one reason. The British co-teacher will change the audience once.","steps":["State the problem clearly.","Use audience-appropriate wording.","Make a polite request."],"frames":["We are having difficulty with ___.","Could you please ___?","This would help us because ___."],"vocab":["audience","formal","polite","request","clarify"],"expected":"two-audience spoken response"}},"8":{"theme":"Theme 2 · Paragraph Structure & Context","learn":"Recognise how topic sentence, support, example and conclusion work together.","activity":"Repair a broken paragraph, then write the missing or improved sentence.","liveRole":"Paragraph Surgeon","wildcard":"Which sentence should disappear, and why?","humanProof":"Paragraph Structure Map","core":{"skill":"Reading","title":"Paragraph Repair File","artifactLabel":"Broken Paragraph","artifact":"Using feedback can improve academic writing. First, students can see which ideas are unclear. For example, a tutor may ask for more evidence after a claim. Blue is a popular colour for presentation slides. As a result, students can revise the paragraph with clearer support. Therefore, feedback helps writers improve the quality of their work.","questions":["What is the topic sentence?","Which sentence does not belong?","Which detail supports the main idea?"],"steps":["Find the central sentence.","Find the unrelated sentence.","Identify useful support."],"frames":["The topic sentence is ___.","The sentence that does not belong is ___.","The support detail is ___."],"vocab":["topic sentence","support","example","conclusion","unrelated"],"expected":"paragraph structure diagnosis"},"support":{"skill":"Writing","title":"Paragraph Repair Note","artifactLabel":"Paragraph Surgeon Task","artifact":"Use the broken paragraph to write one improved support sentence or one improved conclusion. Do not include the unrelated colour sentence.","instruction":"Write 45–60 words. Keep the paragraph focused on feedback and academic writing.","steps":["Choose the paragraph focus.","Add one useful support or closing sentence.","Check that every sentence belongs."],"frames":["Feedback helps students because ___.","For example, ___.","Therefore, ___."],"vocab":["feedback","support","revise","paragraph","therefore"],"expected":"focused paragraph repair"}},"9":{"theme":"Theme 2 · Needs, Rights & Academic Voice","learn":"Write an evidence-based solution paragraph and explain it to a decision maker.","activity":"Propose a realistic campus solution, then pitch it to someone who can make a decision.","liveRole":"Campus Decision Maker","wildcard":"Your evidence is weak. Give one specific example.","humanProof":"Academic Paragraph + 45-second Pitch","core":{"skill":"Writing","title":"Campus Solution Paragraph","artifactLabel":"Campus Problem Brief","artifact":"Many students say that they do not know where to ask for feedback on academic writing. Some wait until the deadline, while others use online tools without checking the result. A student survey suggests that short weekly feedback clinics could help students ask questions earlier and revise before submission.","instruction":"Write an 80–100 word paragraph recommending one campus solution. Include a topic sentence, one reason, one example or evidence, and a conclusion.","steps":["State a solution.","Use the survey as support.","Close with the expected benefit."],"frames":["The university should ___.","One reason is ___.","For example, ___.","In conclusion, ___."],"vocab":["recommend","feedback","clinic","revise","benefit"],"expected":"80–100 word solution paragraph"},"support":{"skill":"Speaking","title":"Campus Solution Pitch","artifactLabel":"Decision Maker Pitch","artifact":"Pitch the feedback-clinic solution to the Campus Decision Maker. Explain the problem, one evidence point, and the benefit.","instruction":"Speak for 45–60 seconds. Use a clear opening, one evidence point, and a closing recommendation.","steps":["Name the problem.","Give one evidence point.","Recommend one solution."],"frames":["Our team recommends ___.","The evidence shows ___.","This would help students to ___."],"vocab":["problem","evidence","recommend","benefit","solution"],"expected":"45–60 second pitch"}},"10":{"theme":"Theme 3 · Data-Informed Design","learn":"Describe trends carefully and avoid claims that data cannot prove.","activity":"Investigate a small data set, detect an overclaim, then write a cautious trend statement.","liveRole":"Data Detective","wildcard":"Does the graph prove that, or only show a trend?","humanProof":"Trend Statement + cautious interpretation","core":{"skill":"Reading","title":"Data Detective Report","artifactLabel":"Campus Survey Snapshot","artifact":"A campus survey asked 80 students how often they used the writing centre. In September, 24 students visited the centre. In November, 42 students visited. A caption under the chart says, “The writing centre solved every student’s writing problem.” The numbers show an increase in visits, but the survey does not measure every student’s writing quality or prove the cause of the increase.","questions":["What trend do the numbers show?","Which claim in the caption is too strong?","What does the survey not prove?"],"steps":["Read the numbers.","Describe only the trend.","Reject unsupported causes or claims."],"frames":["The number increased from ___ to ___.","The data show ___.","The survey does not prove ___."],"vocab":["increase","trend","survey","caption","prove"],"expected":"cautious data interpretation"},"support":{"skill":"Writing","title":"Cautious Trend Statement","artifactLabel":"Data Detective Writing Task","artifact":"Survey visits: September 24 students; November 42 students. The survey does not measure writing quality.","instruction":"Write 50–70 words describing the trend carefully. Include the two numbers and one sentence explaining what the data do not prove.","steps":["State the numbers.","Describe the trend.","Add a cautious limitation."],"frames":["The number of visits increased from ___ to ___.","This suggests ___.","However, the data do not prove ___."],"vocab":["increased","suggests","however","data","limitation"],"expected":"50–70 word data statement"}},"11":{"theme":"Theme 3 · Professional Communication","learn":"Write a polite academic email and make a useful follow-up request.","activity":"Solve a help-desk case by writing an email, then respond to an incomplete reply in a live conversation.","liveRole":"UK Help Desk Officer","wildcard":"I am unavailable on that day. What will you ask next?","humanProof":"Email Thread + spoken follow-up","core":{"skill":"Writing","title":"International Help Desk Email","artifactLabel":"Student Situation","artifact":"You need feedback on a report draft before Friday. You have written the draft, but one source may not be cited correctly. Your lecturer’s office hours are full this week, so you need to ask for another possible time or a short online meeting.","instruction":"Write a 70–90 word email. Include a subject, greeting, context, polite request, possible time, and closing.","steps":["Give context.","Make one polite request.","Offer a practical next step."],"frames":["Subject: Request for ___.","Dear ____,","Could you please __?","I am available ___.","Kind regards, ___"],"vocab":["draft","feedback","appointment","available","kind regards"],"expected":"70–90 word professional email"},"support":{"skill":"Speaking","title":"Help Desk Follow-Up","artifactLabel":"Live Follow-Up Call","artifact":"The Help Desk Officer says, “I am unavailable on that day, but I may have ten minutes online next week.” Ask one polite follow-up question.","instruction":"Speak for 30–45 seconds. Thank the officer, ask for one specific time, and confirm your purpose.","steps":["Thank the officer.","Ask for a time.","Confirm the report-feedback purpose."],"frames":["Thank you for ___.","Would it be possible to ___?","I would like feedback on ___."],"vocab":["possible","available","meeting","feedback","confirm"],"expected":"polite spoken follow-up"}},"12":{"theme":"Theme 3 · Ethics, Feedback & Assessment","learn":"Identify source use, paraphrase, citation and transparent AI support.","activity":"Escape an integrity case by separating own ideas, source ideas and AI-assisted work.","liveRole":"Research Integrity Officer","wildcard":"You used AI for brainstorming. What must you disclose?","humanProof":"Citation Decision Card + AI Ethics Note","core":{"skill":"Reading","title":"Integrity Escape Room","artifactLabel":"Draft Review File","artifact":"Mina copied one sentence from an online article into her report without quotation marks or a citation. She also used an AI tool to list possible keywords, then chose two keywords and wrote her own paragraph. Her final paragraph includes one idea from the article, but she does not name the source. The Research Integrity Officer says that students may use support tools, but they must acknowledge borrowed ideas and follow their course rules for AI use.","questions":["Which part of Mina’s draft needs a citation or quotation?","Which AI use could be acceptable if it is transparent?","Why should Mina name the source?"],"steps":["Find borrowed wording or ideas.","Separate support from authorship.","Explain responsible acknowledgement."],"frames":["This needs a citation because ___.","The AI support was ___.","Mina should name the source because ___."],"vocab":["citation","quotation","paraphrase","disclose","integrity"],"expected":"ethics decision with evidence"},"support":{"skill":"Writing","title":"Responsible AI Ethics Note","artifactLabel":"Integrity Officer Response","artifact":"Write a short note explaining which part came from a source, which part was your own work, and how AI helped without writing the final answer for you.","instruction":"Write 60–80 words. Include one source acknowledgement and one transparent AI-use statement.","steps":["Name the source contribution.","Name your own contribution.","State AI support honestly."],"frames":["According to the source, ___.","My own contribution was ___.","AI helped me to ___, but I ___."],"vocab":["source","acknowledge","own work","AI support","transparent"],"expected":"60–80 word ethics note"}},"13":{"theme":"Theme 3 · Listening, Note-Taking & Learning Strategy","learn":"Listen selectively for a main point, keywords and one useful supporting detail.","activity":"Listen to a mini lecture, take notes without writing every word, then write a concise summary.","liveRole":"Mini Lecture Host","wildcard":"Which detail is useful, but not central?","humanProof":"Lecture Notes + mini summary","core":{"skill":"Listening","title":"Mini Lecture Heist","artifactLabel":"British Co-Teacher Mini Lecture","artifact":"Today’s mini lecture is about taking useful academic notes. Good note-takers do not write every word. First, they listen for the main point. Next, they write key words and short phrases. For example, a lecturer may repeat a term such as evidence or feedback. However, a long example is not always central. After the lecture, students should use their notes to write a short summary in their own words.","instruction":"Listen twice. Write the main point, two keywords, and one useful detail. Do not try to write every word.","steps":["Listen for the main point.","Write two keywords.","Choose one useful detail."],"frames":["The main point is ___.","Two keywords are ___ and ___.","One useful detail is ___."],"vocab":["lecture","note-taking","main point","keyword","detail"],"expected":"main point + 2 keywords + detail"},"support":{"skill":"Writing","title":"Lecture Note Summary","artifactLabel":"Note-to-Summary Task","artifact":"Use your notes from the mini lecture about academic note-taking.","instruction":"Write 50–70 words that explain the main advice from the lecture in your own words.","steps":["Use notes, not every sentence.","State the main advice.","Add one useful supporting detail."],"frames":["The lecture explains ___.","A useful strategy is ___.","For example, ___."],"vocab":["notes","summary","keyword","strategy","lecture"],"expected":"50–70 word mini summary"}},"14":{"theme":"Theme 3 · Presentation, Audience & Feedback","learn":"Present a clear point with signposting, evidence and an audience-aware answer.","activity":"Prepare a one-minute academic pitch, then adapt it for a first-year student during Q&A.","liveRole":"International Audience","wildcard":"Explain it now for a first-year student.","humanProof":"One-minute Pitch + Q&A","core":{"skill":"Speaking","title":"Presentation Under Pressure","artifactLabel":"Presentation Brief","artifact":"Your team will present one practical way to help students use online sources more responsibly. The audience is a university international panel. Include one problem, one evidence point, one solution, and a clear closing.","instruction":"Speak for 60 seconds. Use opening, signposting, one evidence point, and a conclusion. Then respond to the audience-shift wildcard.","steps":["Open with the topic.","Signpost one key point.","Use evidence and close clearly."],"frames":["Today, I will talk about ___.","First, ___.","The evidence shows ___.","To conclude, ___."],"vocab":["presentation","signpost","evidence","audience","conclusion"],"expected":"one-minute pitch + Q&A"},"support":{"skill":"Writing","title":"Presentation Outline","artifactLabel":"Speaker Planning Sheet","artifact":"Plan the one-minute pitch about responsible use of online sources.","instruction":"Write a 60–80 word outline with opening, two key points, one evidence point, and closing.","steps":["Write the opening.","List two key points.","Add evidence and closing."],"frames":["Today, I will talk about ___.","First, ___. Next, ___.","To conclude, ___."],"vocab":["opening","outline","point","evidence","closing"],"expected":"60–80 word outline"}},"15":{"theme":"Theme 3 · Global Solution & Reflection","learn":"Integrate reading, listening, evidence, writing and speaking into one practical response.","activity":"Create an evidence-based campus solution brief and defend it to a UK–Thailand panel.","liveRole":"Global Panel Member","wildcard":"What evidence is strongest, and why?","humanProof":"Solution Brief + reflection + oral pitch","core":{"skill":"Writing","title":"Global Solution Brief","artifactLabel":"Global Campus Challenge","artifact":"A university wants to reduce the spread of misleading study advice online. Some students share short videos without checking the source. Others rely on AI summaries without opening the original article. A student group suggests a simple campus campaign: a source-check checklist, short peer workshops, and a link to library support. The panel wants a solution that is practical, evidence-based, and respectful of different student needs.","instruction":"Write an 90–120 word solution brief. State the problem, use one source detail, recommend a solution, and explain the expected benefit.","steps":["State the problem.","Use one evidence detail.","Recommend a practical solution and benefit."],"frames":["The problem is ___.","The evidence shows ___.","We recommend ___.","This would help ___."],"vocab":["solution","evidence","recommend","practical","benefit"],"expected":"90–120 word solution brief"},"support":{"skill":"Speaking","title":"Global Solution Summit Pitch","artifactLabel":"UK–Thailand Panel Prompt","artifact":"Present the solution brief to the Global Panel. Explain the problem, strongest evidence, recommendation and next step.","instruction":"Speak for 60–90 seconds. Use one evidence point and respond to the live wildcard question.","steps":["State the problem.","Defend the evidence.","Give the recommendation and next step."],"frames":["Our solution addresses ___.","The strongest evidence is ___.","We recommend ___.","Our next step is ___."],"vocab":["panel","evidence","solution","recommend","next step"],"expected":"60–90 second summit pitch"}}};
  const api = window.EAPHero || {};
  const original = {
    openSkillMission: api.openSkillMission,
    openSkillMissionSafe: api.openSkillMissionSafe,
    readingMission: api.readingMission,
    writingMission: api.writingMission,
    listeningMission: api.listeningMission,
    speakingMission: api.speakingMission,
    skillPath: api.skillPath
  };

  const baseSpeakingApi = {
    submit: api.submitSpeaking,
    startTimer: api.startSpeakingTimer,
    stopTimer: api.stopSpeakingTimer,
    startSpeech: api.startSpeechToText,
    stopSpeech: api.stopSpeechToText
  };

  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const attr = (value) => esc(value).replace(/"/g,'&quot;');
  const safeSkill = (value) => String(value || '').trim();
  const contextFor = (sessionId) => WEEKLY_GAME_CONTEXT[Number(sessionId || 1)] || WEEKLY_GAME_CONTEXT[1];

  function skillPack(sessionId, skill){
    const context = contextFor(sessionId);
    const wanted = safeSkill(skill).toLowerCase();
    const core = context.core || {};
    const support = context.support || {};
    const selected = String(core.skill || '').toLowerCase() === wanted ? core :
      String(support.skill || '').toLowerCase() === wanted ? support : {
        skill: skill,
        title: context.learn + ' ' + skill + ' Task',
        artifactLabel: 'Weekly Global Campus Brief',
        artifact: context.activity,
        instruction: 'Use this week’s context to complete a short ' + skill + ' response.',
        steps: ['Identify the weekly problem.','Use one useful detail.','Give a clear academic response.'],
        frames: ['The main idea is ___.','One detail is ___.','My response is ___.'],
        vocab: ['academic','evidence','response','audience','support'],
        expected: 'short ' + skill + ' evidence'
      };
    return Object.assign({
      session:Number(sessionId || 1),
      theme:context.theme,
      learn:context.learn,
      activity:context.activity,
      liveRole:context.liveRole,
      wildcard:context.wildcard,
      humanProof:context.humanProof
    }, selected);
  }

  function alignment(skill, sessionId){
    const p = skillPack(sessionId, skill);
    return {
      level:'A2-B1+',
      topic:p.title,
      expected:p.expected || ('short '+skill+' evidence'),
      steps:p.steps || [],
      frames:p.frames || [],
      vocab:p.vocab || [],
      aiHint:'Focus on '+p.title+'. '+((p.steps||[])[0] || 'Find the main point.')+' Do not answer a different task.'
    };
  }

  function contextCard(sessionId, skill){
    const p = skillPack(sessionId,skill);
    return `<section class="weekly-mission-context">
      <div class="weekly-context-kicker">${esc(p.theme)}</div>
      <h3>${esc(p.title)}</h3>
      <p><b>What you learn:</b> ${esc(p.learn)}</p>
      <p><b>Team activity:</b> ${esc(p.activity)}</p>
      <div class="weekly-context-grid">
        <div><b>🇬🇧 Human Partner</b><span>${esc(p.liveRole)}</span></div>
        <div><b>Live Wildcard</b><span>“${esc(p.wildcard)}”</span></div>
        <div><b>Human Proof</b><span>${esc(p.humanProof)}</span></div>
      </div>
    </section>`;
  }

  function guideCard(sessionId, skill){
    const p=skillPack(sessionId,skill);
    return `<div class="weekly-skill-guide">
      <div class="badges"><span class="pill">Weekly Context</span><span class="pill">${esc(skill)}</span><span class="pill">${esc(p.expected || 'Portfolio evidence')}</span></div>
      <h3>How this activity works</h3>
      <div class="grid three">${(p.steps||[]).slice(0,3).map((step,i)=>`<div class="step-card"><b>Step ${i+1}</b><span>${esc(step)}</span></div>`).join('')}</div>
      <h4>Sentence frames for this exact task</h4>
      <div class="frame-row">${(p.frames||[]).map(frame=>`<span class="frame-chip">${esc(frame)}</span>`).join('')}</div>
      <h4>Useful vocabulary</h4>
      <div class="vocab-row">${(p.vocab||[]).map(word=>`<span class="mini-word">${esc(word)}</span>`).join('')}</div>
    </div>`;
  }

  function aiBox(skill,sid,inputId){
    const outId='weeklyAIOutput_'+String(skill).toLowerCase()+'_'+sid;
    return `<div class="panel light ai-help-box" style="margin:14px 0;border-style:dashed">
      <div class="badges"><span class="pill">🤖 AI Mentor</span><span class="pill">Context-aware help</span><span class="pill">Scaffold only</span></div>
      <p class="mini-note">AI gives a hint, a frame or draft feedback for this exact weekly mission. It does not give the final answer.</p>
      <button type="button" class="btn ai-mentor-btn" onclick="EAPHero.aiHelp('${esc(skill)}',${sid},'${inputId}','${outId}')">Ask AI Mentor</button>
      <div id="${outId}" class="feedback info ai-output-box" style="margin-top:10px;display:none"></div>
    </div>`;
  }

  function artifactCard(label, text){
    return `<article class="weekly-artifact-card"><div class="weekly-artifact-head">${esc(label)}</div><p>${esc(text)}</p></article>`;
  }
  function taskCard(title, instruction, expected){
    return `<div class="weekly-task-card"><b>${esc(title)}</b><span>${esc(instruction || '')}</span><em>Expected: ${esc(expected || '')}</em></div>`;
  }
  function backButton(sid){
    return `<button class="btn ghost" onclick="EAPHero.skillPath(${sid})">Back to Session Path</button>`;
  }

  function renderReading(sessionId){
    const sid=Number(sessionId || 1), p=skillPack(sid,'Reading');
    const qs=p.questions || ['What is the main idea?','Which detail supports the idea?','What should readers not overclaim?'];
    const app=document.getElementById('app');
    app.innerHTML=`<section class="panel real-reading-mission weekly-game-page" data-weekly-game-context="true">
      <div class="badges"><span class="pill">Reading Mission</span><span class="pill">S${sid}</span><span class="pill">🇹🇭 + 🇬🇧 Co-Taught</span></div>
      <h2>📖 Live Drop: ${esc(p.title)}</h2>
      ${contextCard(sid,'Reading')}
      ${artifactCard(p.artifactLabel,p.artifact)}
      <p class="mini-note"><b>British co-teacher step:</b> the Live Drop is read once. Teams may ask one clarification question before answering.</p>
      ${guideCard(sid,'Reading')}
      ${aiBox('Reading',sid,'readingAns0')}
      <input type="hidden" id="readingTopic" value="${attr(p.title)}"><input type="hidden" id="readingPassage" value="${attr(p.artifact)}">
      ${qs.map((q,i)=>`<label class="label">${i+1}. ${esc(q)}</label><textarea id="readingAns${i}" class="input answer-box reading-answer-box compact-reading-answer" rows="3" placeholder="Write a short answer with a word or detail from the Live Drop."></textarea>`).join('')}
      <div class="footer-actions"><button class="btn primary" onclick="EAPHero.submitReading(${sid})">Submit Reading Evidence</button>${backButton(sid)}</div>
    </section>`;
    return false;
  }

  function renderWriting(sessionId){
    const sid=Number(sessionId || 1), p=skillPack(sid,'Writing'), app=document.getElementById('app');
    app.innerHTML=`<section class="panel weekly-game-page" data-weekly-game-context="true">
      <div class="badges"><span class="pill">Writing Mission</span><span class="pill">S${sid}</span><span class="pill">Portfolio Evidence</span><span class="pill">🇹🇭 + 🇬🇧 Co-Taught</span></div>
      <h2>✍️ ${esc(p.title)}</h2>
      ${contextCard(sid,'Writing')}
      ${artifactCard(p.artifactLabel,p.artifact)}
      ${taskCard('Writing task',p.instruction,p.expected)}
      <input type="hidden" id="writingPromptText" value="${attr((p.artifact||'')+'. '+(p.instruction||''))}">
      ${guideCard(sid,'Writing')}
      ${aiBox('Writing',sid,'writingOutput')}
      <div class="answer-box-toolbar"><span>Write your portfolio response</span><button type="button" class="btn small" onclick="EAPHero.expandAnswerBox('writingOutput')">↕ Expand</button><button type="button" class="btn small ghost" onclick="EAPHero.clearAnswerBox('writingOutput')">Clear</button></div>
      <textarea id="writingOutput" class="input answer-box large-writing-box" rows="11" data-default-rows="11" placeholder="${attr((p.frames||[]).join(' '))}"></textarea>
      <div class="footer-actions"><button class="btn primary" onclick="EAPHero.submitWriting(${sid})">Submit Writing Evidence</button>${backButton(sid)}</div>
    </section>`;
    return false;
  }

  function renderListening(sessionId){
    const sid=Number(sessionId || 1), p=skillPack(sid,'Listening'), lecture=p.artifact || '', app=document.getElementById('app');
    app.innerHTML=`<section class="panel weekly-game-page" data-weekly-game-context="true">
      <div class="badges"><span class="pill">Listening Mission</span><span class="pill">S${sid}</span><span class="pill">Live Audio Drop</span><span class="pill">🇹🇭 + 🇬🇧 Co-Taught</span></div>
      <h2>🎧 ${esc(p.title)}</h2>
      ${contextCard(sid,'Listening')}
      ${taskCard(p.artifactLabel,p.instruction,'The transcript stays hidden until review.')}
      <div class="ai-voice-lab">
        <div class="badges"><span class="pill">🎧 AI Voice Rehearsal</span><span class="pill">UK English available</span><span class="pill">Listen twice</span></div>
        <div class="voice-control-grid">
          <label>Accent<select id="voiceAccent" class="input" onchange="EAPHero.renderVoiceOptions()"><option value="en-GB">UK English</option><option value="en-US">US English</option><option value="en-AU">AU English</option></select></label>
          <label>Voice<select id="voiceSelect" class="input" onchange="EAPHero.updateVoiceQualityLabel()"><option value="">Loading voices...</option></select></label>
          <label>Speed<input id="voiceRate" class="input" type="range" min="0.65" max="1.08" step="0.01" value="0.88" oninput="document.getElementById('voiceRateLabel').textContent=this.value"><span id="voiceRateLabel" class="mini-note">0.88</span></label>
          <label>Pitch<input id="voicePitch" class="input" type="range" min="0.85" max="1.2" step="0.01" value="1.02" oninput="document.getElementById('voicePitchLabel').textContent=this.value"><span id="voicePitchLabel" class="mini-note">1.02</span></label>
        </div>
        <div class="footer-actions"><button type="button" class="btn primary" onclick="EAPHero.playLecture()">▶ Play Audio</button><button type="button" class="btn" onclick="EAPHero.pauseLecture()">⏸ Pause</button><button type="button" class="btn" onclick="EAPHero.resumeLecture()">▶ Resume</button><button type="button" class="btn" onclick="EAPHero.replayCurrentChunk()">🔁 Replay chunk</button><button type="button" class="btn" onclick="EAPHero.playSlowMode()">🐢 Slow mode</button><button type="button" class="btn ghost" onclick="EAPHero.stopLecture()">⏹ Stop</button></div>
        <div id="voiceQualityLabel" class="voice-quality-label">Voice: detecting...</div><div id="listeningVoiceStatus" class="listening-voice-status info">Choose Play Audio. The transcript is locked until review.</div>
      </div>
      <div class="context hidden-lecture-text" id="lectureText" data-lecture="${attr(lecture)}"></div>
      <input type="hidden" id="listeningPromptText" value="${attr(lecture)}">
      <div class="footer-actions"><button class="btn warn" onclick="EAPHero.showTranscriptHint(${sid})">👁 Transcript Hint</button></div><div id="transcriptHintBox" class="feedback info" style="margin-top:10px"></div>
      ${guideCard(sid,'Listening')}
      ${aiBox('Listening',sid,'listeningNotes')}
      <div id="fullTranscriptBox" class="feedback info" style="margin-top:10px"></div>
      <label class="label">Listening notes</label><div class="answer-box-toolbar"><span>${esc(p.expected)}</span><button type="button" class="btn small" onclick="EAPHero.expandAnswerBox('listeningNotes')">↕ Expand</button></div>
      <textarea id="listeningNotes" class="input answer-box listening-notes-box" rows="8" data-default-rows="8" placeholder="${attr((p.frames||[]).join(' '))}"></textarea>
      <div class="footer-actions"><button class="btn primary" onclick="EAPHero.submitListening(${sid})">Submit Listening Evidence</button>${backButton(sid)}</div>
    </section>`;
    setTimeout(()=>{if(window.EAPHero && window.EAPHero.renderVoiceOptions) window.EAPHero.renderVoiceOptions();},150);
    return false;
  }


  const liveSpeakingState = {
    session:0,
    round1:{started:false,done:false,seconds:0},
    round2:{started:false,done:false,seconds:0},
    activeRound:'',
    timer:null,
    stamp:'',
    glow:'',
    grow:''
  };

  function secondsForSpeakingPack(pack){
    const text=String(pack.expected || pack.instruction || '');
    const m=text.match(/(\d+)\s*[–-]\s*(\d+)\s*second/i);
    if(m) return Math.round((Number(m[1])+Number(m[2]))/2);
    const one=text.match(/(\d+)\s*second/i);
    return one ? Number(one[1]) : 40;
  }

  function wildcardSecondsForSpeakingPack(pack){
    return Math.max(15, Math.min(30, Math.round(secondsForSpeakingPack(pack) * .55)));
  }

  function liveTimeText(seconds){
    const n=Math.max(0,Number(seconds||0));
    return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  }

  function planFieldsHTML(pack){
    const frames=(pack.frames || []).slice(0,3);
    const labels=frames.length ? frames : ['My main point is ___.','One supporting detail is ___.','My response is ___.'];
    return `<section class="live-plan-card">
      <div class="live-phase-label">Before speaking · Quick Plan</div>
      <h3>Build three short speaking notes</h3>
      <p>Write keywords only. These are not an essay and they will not be shown as a large transcript.</p>
      <div class="live-plan-grid">
        ${labels.map((frame,i)=>`<label class="live-plan-field"><span>${esc(frame)}</span><input id="speakPlan${i}" class="input" maxlength="120" placeholder="Short note only"></label>`).join('')}
      </div>
    </section>`;
  }

  function hiddenSpeakingScoringFields(){
    return `<div class="live-engine-hidden" aria-hidden="true">
      <button id="startSpeakBtn" type="button">hidden timer</button>
      <div id="speakingTimerBox"></div>
      <input type="checkbox" id="spSpoke">
      <input type="checkbox" id="spOpen">
      <input type="checkbox" id="spSign">
      <input type="checkbox" id="spEvi">
      <input type="checkbox" id="spClose">
    </div>`;
  }

  function liveRoundHTML(pack){
    const round1Secs=secondsForSpeakingPack(pack);
    const round2Secs=wildcardSecondsForSpeakingPack(pack);
    return `<section class="live-conversation-room">
      <div class="live-phase-label">Live Conversation Mission</div>
      <h3>Speak → Respond → Receive Human Feedback</h3>
      <p class="live-room-intro">Use your three notes, speak to the human partner, then respond naturally to one unexpected follow-up. Clear communication matters; accent is not graded.</p>

      <article id="liveRound1Panel" class="live-round-card active">
        <div class="live-round-number">Round 1</div>
        <div class="live-round-body">
          <h4>Speak to ${esc(pack.liveRole)}</h4>
          <p>${esc(pack.instruction || 'Give your prepared response.')}</p>
          <div class="live-round-meta"><span>Target: ${round1Secs} seconds</span><span>Use your quick plan</span></div>
          <div class="footer-actions">
            <button type="button" id="startRound1Btn" class="btn primary" onclick="EAPHero.startLiveSpeakingRound('round1',${pack.session})">🎙 Start Round 1</button>
            <button type="button" id="finishRound1Btn" class="btn" onclick="EAPHero.finishLiveSpeakingRound('round1')" disabled>✓ Finish Round 1</button>
          </div>
          <div id="round1Status" class="live-round-status">Prepare your three short notes, then start speaking.</div>
        </div>
      </article>

      <article id="liveRound2Panel" class="live-round-card locked">
        <div class="live-round-number">Round 2</div>
        <div class="live-round-body">
          <h4>Respond to the British Co-Teacher Wildcard</h4>
          <blockquote>“${esc(pack.wildcard || 'Can you explain your idea with one detail?')}”</blockquote>
          <div class="live-round-meta"><span>Target: ${round2Secs} seconds</span><span>Respond, clarify, or add evidence</span></div>
          <div class="footer-actions">
            <button type="button" id="startRound2Btn" class="btn primary" onclick="EAPHero.startLiveSpeakingRound('round2',${pack.session})" disabled>🎙 Respond to Wildcard</button>
            <button type="button" id="finishRound2Btn" class="btn" onclick="EAPHero.finishLiveSpeakingRound('round2')" disabled>✓ Finish Response</button>
          </div>
          <div id="round2Status" class="live-round-status">Finish Round 1 to unlock the live follow-up.</div>
        </div>
      </article>

      <article id="humanStampPanel" class="human-stamp-card locked">
        <div class="live-phase-label">Human Feedback · Co-Teacher / Instructor Only</div>
        <h4>Give a Human Stamp</h4>
        <p>Check the live performance, not the student’s accent or transcript.</p>
        <div class="human-rubric-row">
          <span>Clear message</span><span>Uses task details</span><span>Responds to wildcard</span><span>Interaction / clarification</span>
        </div>
        <div class="human-stamp-actions">
          <button type="button" class="btn human-stamp-clear" onclick="EAPHero.applyHumanSpeakingStamp('clear')">✅ Clear</button>
          <button type="button" class="btn human-stamp-developing" onclick="EAPHero.applyHumanSpeakingStamp('developing')">🟡 Developing</button>
          <button type="button" class="btn human-stamp-retry" onclick="EAPHero.applyHumanSpeakingStamp('retry')">↻ Retry</button>
        </div>
        <div id="humanStampStatus" class="human-stamp-status">Finish the Wildcard response before the Human Stamp is available.</div>
        <div class="human-feedback-grid">
          <label>Glow<input id="humanGlow" class="input" maxlength="160" placeholder="One thing communicated well"></label>
          <label>Grow<input id="humanGrow" class="input" maxlength="160" placeholder="One next step to try"></label>
        </div>
      </article>
    </section>`;
  }

  function optionalSpeechReviewHTML(pack){
    return `<details class="speech-review-details">
      <summary>Optional: review speech with Voice Input</summary>
      <p class="mini-note">This is optional support after the live interaction. It is not the main speaking task.</p>
      <div class="voice-input-panel compact-voice-review">
        <div class="footer-actions">
          <button type="button" id="voiceStartBtn" class="btn" onclick="return EAPHero.startSpeechToText()">🎙 Start Voice Review</button>
          <button type="button" id="voiceStopBtn" class="btn ghost" onclick="return EAPHero.stopSpeechToText()" disabled>⏹ Stop</button>
        </div>
        <div id="speechStatusBox" class="speech-status info">Speak in English; you may edit this short record before saving.</div>
        <div id="speechInterimBox" class="speech-interim"></div>
        <textarea id="speakingTranscript" class="input live-speech-review-box" rows="4" maxlength="700" placeholder="Optional short transcript or note from your live conversation"></textarea>
      </div>
    </details>`;
  }

  function renderSpeaking(sessionId){
    const sid=Number(sessionId || 1);
    const p=skillPack(sid,'Speaking');
    const prompt=(p.artifact||'')+'. '+(p.instruction||'');
    const app=document.getElementById('app');
    resetLiveSpeakingState(sid);
    app.innerHTML=`<section class="panel weekly-game-page live-speaking-page" data-weekly-game-context="true">
      <div class="badges"><span class="pill">Speaking Mission</span><span class="pill">S${sid}</span><span class="pill">Live Conversation</span><span class="pill">🇹🇭 + 🇬🇧 Co-Taught</span></div>
      <h2>🎤 ${esc(p.title)}</h2>
      ${contextCard(sid,'Speaking')}
      ${artifactCard(p.artifactLabel,p.artifact)}
      <input type="hidden" id="speakingPromptText" value="${attr(prompt)}">
      ${planFieldsHTML(p)}
      ${aiBox('Speaking',sid,'speakPlan0')}
      ${liveRoundHTML(p)}
      ${optionalSpeechReviewHTML(p)}
      <section class="live-reflection-card">
        <div class="live-phase-label">After the conversation</div>
        <h3>One-line reflection</h3>
        <label>What will you keep or improve next time?<input id="speakingReflection" class="input" maxlength="220" placeholder="Example: Next time, I will give my evidence before my conclusion."></label>
      </section>
      <div class="footer-actions live-save-actions">
        <button class="btn primary" onclick="EAPHero.saveLiveSpeakingEvidence(${sid})">Save Live Speaking Evidence</button>
        ${backButton(sid)}
      </div>
      ${hiddenSpeakingScoringFields()}
    </section>`;
    return false;
  }

  function resetLiveSpeakingState(sessionId){
    if(liveSpeakingState.timer) clearInterval(liveSpeakingState.timer);
    liveSpeakingState.session=Number(sessionId||0);
    liveSpeakingState.round1={started:false,done:false,seconds:0};
    liveSpeakingState.round2={started:false,done:false,seconds:0};
    liveSpeakingState.activeRound='';
    liveSpeakingState.timer=null;
    liveSpeakingState.stamp='';
    liveSpeakingState.glow='';
    liveSpeakingState.grow='';
  }

  function updateLiveRoundUI(round){
    const state=liveSpeakingState[round];
    const status=document.getElementById(round+'Status');
    const start=document.getElementById(round==='round1'?'startRound1Btn':'startRound2Btn');
    const finish=document.getElementById(round==='round1'?'finishRound1Btn':'finishRound2Btn');
    if(start) start.disabled=!!state.started || !!state.done;
    if(finish) finish.disabled=!state.started || !!state.done;
    if(status){
      if(state.done) status.innerHTML=`<b>Completed:</b> ${liveTimeText(state.seconds)} · ready for the next step.`;
      else if(state.started) status.innerHTML=`<b>Speaking now… ${liveTimeText(state.seconds)}</b> · focus on the human partner, not the screen.`;
    }
  }

  function startLiveSpeakingRound(round, sessionId){
    if(round!=='round1' && round!=='round2') return false;
    if(round==='round2' && !liveSpeakingState.round1.done) return false;
    if(liveSpeakingState.activeRound) return false;
    const state=liveSpeakingState[round];
    if(state.done) return false;
    state.started=true;
    state.seconds=0;
    liveSpeakingState.activeRound=round;
    updateLiveRoundUI(round);
    if(liveSpeakingState.timer) clearInterval(liveSpeakingState.timer);
    liveSpeakingState.timer=setInterval(()=>{
      if(!liveSpeakingState.activeRound) return;
      const active=liveSpeakingState[liveSpeakingState.activeRound];
      active.seconds+=1;
      updateLiveRoundUI(liveSpeakingState.activeRound);
    },1000);
    return false;
  }

  function finishLiveSpeakingRound(round){
    if(liveSpeakingState.activeRound!==round) return false;
    if(liveSpeakingState.timer) clearInterval(liveSpeakingState.timer);
    liveSpeakingState.timer=null;
    const state=liveSpeakingState[round];
    state.started=false;
    state.done=true;
    liveSpeakingState.activeRound='';
    updateLiveRoundUI(round);

    if(round==='round1'){
      const panel=document.getElementById('liveRound2Panel');
      const button=document.getElementById('startRound2Btn');
      const status=document.getElementById('round2Status');
      if(panel) panel.classList.remove('locked');
      if(button) button.disabled=false;
      if(status) status.textContent='Round 1 complete. The British co-teacher asks the Wildcard question now.';
    }else{
      const panel=document.getElementById('humanStampPanel');
      const status=document.getElementById('humanStampStatus');
      if(panel) panel.classList.remove('locked');
      if(status) status.textContent='Co-teacher or instructor: select Clear, Developing, or Retry, then add Glow + Grow.';
    }
    return false;
  }

  function applyHumanSpeakingStamp(stamp){
    if(!liveSpeakingState.round2.done) return false;
    const valid=['clear','developing','retry'];
    if(!valid.includes(stamp)) return false;
    liveSpeakingState.stamp=stamp;
    const labels={clear:'✅ Clear · Human Stamp awarded',developing:'🟡 Developing · Human feedback saved',retry:'↻ Retry · rehearse and respond again'};
    const status=document.getElementById('humanStampStatus');
    if(status) status.innerHTML='<b>'+labels[stamp]+'</b>';
    document.querySelectorAll('.human-stamp-actions button').forEach(b=>b.classList.remove('selected'));
    const btn=document.querySelector('.human-stamp-'+stamp);
    if(btn) btn.classList.add('selected');
    return false;
  }

  function speakingPlanValues(){
    return [0,1,2].map(i=>(document.getElementById('speakPlan'+i)?.value||'').trim()).filter(Boolean);
  }

  function saveHumanSpeakingLog(record){
    try{
      const key='EAP_HERO_HUMAN_SPEAKING_LOGS_V1';
      const old=JSON.parse(localStorage.getItem(key)||'[]');
      old.push(record);
      localStorage.setItem(key,JSON.stringify(old.slice(-60)));
    }catch(e){}
  }

  function saveLiveSpeakingEvidence(sessionId){
    const sid=Number(sessionId||liveSpeakingState.session||1);
    const plan=speakingPlanValues();
    const reflection=(document.getElementById('speakingReflection')?.value||'').trim();
    const transcript=(document.getElementById('speakingTranscript')?.value||'').trim();
    const glow=(document.getElementById('humanGlow')?.value||'').trim();
    const grow=(document.getElementById('humanGrow')?.value||'').trim();

    if(!liveSpeakingState.round1.done || !liveSpeakingState.round2.done){
      alert('Complete Round 1 and the Wildcard Response before saving speaking evidence.');
      return false;
    }
    if(plan.length<2){
      alert('Add at least two short Quick Plan notes before saving.');
      return false;
    }
    if(!liveSpeakingState.stamp){
      alert('The British co-teacher or instructor needs to choose a Human Stamp first.');
      return false;
    }

    const stamp=liveSpeakingState.stamp;
    const stampText={clear:'Clear',developing:'Developing',retry:'Retry'}[stamp];
    const record=[
      'Live Conversation Mission',
      'Round 1: '+liveTimeText(liveSpeakingState.round1.seconds),
      'Wildcard response: '+liveTimeText(liveSpeakingState.round2.seconds),
      'Quick plan: '+plan.join(' | '),
      'Human Stamp: '+stampText,
      glow ? 'Glow: '+glow : '',
      grow ? 'Grow: '+grow : '',
      reflection ? 'Reflection: '+reflection : '',
      transcript ? 'Optional speech review: '+transcript : ''
    ].filter(Boolean).join('\n');

    const transcriptBox=document.getElementById('speakingTranscript');
    if(transcriptBox) transcriptBox.value=record;

    const spoke=document.getElementById('spSpoke');
    const open=document.getElementById('spOpen');
    const sign=document.getElementById('spSign');
    const evi=document.getElementById('spEvi');
    const close=document.getElementById('spClose');
    if(spoke) spoke.checked=true;
    if(open) open.checked=plan.length>=1;
    if(sign) sign.checked=plan.length>=2;
    if(evi) evi.checked=(stamp==='clear' || stamp==='developing');
    if(close) close.checked=true;

    saveHumanSpeakingLog({
      at:new Date().toISOString(),
      session:sid,
      skill:'Speaking',
      round1Seconds:liveSpeakingState.round1.seconds,
      round2Seconds:liveSpeakingState.round2.seconds,
      humanStamp:stamp,
      glow,grow,reflection,
      quickPlan:plan,
      transcriptProvided:!!transcript
    });

    if(typeof baseSpeakingApi.submit==='function'){
      return baseSpeakingApi.submit(sid);
    }
    alert('Speaking evidence was prepared, but the portfolio save function is unavailable.');
    return false;
  }

  function openSkillMission(skill, sessionId){
    const sid=Number(sessionId || 1), key=safeSkill(skill).toLowerCase();
    if(key==='reading') return renderReading(sid);
    if(key==='writing') return renderWriting(sid);
    if(key==='listening') return renderListening(sid);
    if(key==='speaking') return renderSpeaking(sid);
    return original.openSkillMission ? original.openSkillMission(skill,sid) : false;
  }

  function decorateSessionPath(){
    const panel=document.querySelector('.student-session-entry-panel');
    if(!panel || panel.querySelector('.weekly-at-a-glance')) return;
    const tag=Array.from(panel.querySelectorAll('.pill')).find(x=>/^S\d+$/.test(x.textContent.trim()));
    const sid=Number((tag?.textContent||'S1').replace(/\D/g,'')) || 1;
    const p=contextFor(sid);
    const el=document.createElement('details');
    el.className='weekly-at-a-glance';
    el.innerHTML=`<summary>What you will learn and do this week</summary><div class="weekly-at-a-glance-inner"><p><b>${esc(p.theme)}</b></p><p><b>Learn:</b> ${esc(p.learn)}</p><p><b>Team activity:</b> ${esc(p.activity)}</p><p><b>Live co-teacher role:</b> ${esc(p.liveRole)} · “${esc(p.wildcard)}”</p></div>`;
    const flow=panel.querySelector('.student-flow-note');
    if(flow) flow.insertAdjacentElement('afterend',el);
  }

  const observer=new MutationObserver(()=>decorateSessionPath());
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.EAPHeroWeeklyContext={WEEKLY_GAME_CONTEXT,contextFor,skillPack,alignment,openSkillMission,renderReading,renderWriting,renderListening,renderSpeaking};
  api.openSkillMission=openSkillMission;
  api.openSkillMissionSafe=openSkillMission;
  api.readingMission=renderReading;
  api.writingMission=renderWriting;
  api.listeningMission=renderListening;
  api.speakingMission=renderSpeaking;
  api.startLiveSpeakingRound=startLiveSpeakingRound;
  api.finishLiveSpeakingRound=finishLiveSpeakingRound;
  api.applyHumanSpeakingStamp=applyHumanSpeakingStamp;
  api.saveLiveSpeakingEvidence=saveLiveSpeakingEvidence;
  api.submitSpeaking=saveLiveSpeakingEvidence;
  api.resetLiveSpeakingState=resetLiveSpeakingState;


  // v1z67: route button is rendered by the core engine. Keep weekly decorations after route changes.
  const originalContinueRoute = api.continueRoute;
  api.continueRoute = function(){
    const result = typeof originalContinueRoute === 'function' ? originalContinueRoute() : false;
    setTimeout(decorateSessionPath, 120);
    return result;
  };

  decorateSessionPath();
})();
