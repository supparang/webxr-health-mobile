/* =========================================================
   EAP Hero Student Session Content Pack
   Complete S1-S15 + B1-B5 / Section 122 / CEFR A2-B1+
========================================================= */
(function(){
  'use strict';

  const NORMAL_SESSIONS = [
    ['S1','Academic Hero Awakening','Orientation Gate','A2+','Set an academic goal and choose a realistic practice action.',{reading:'Core',speaking:'Support',listening:'Exposure',writing:'Exposure'},['academic goal','realistic','practice action','evidence','progress','strategy'],'Set a clear academic English goal and connect it with one small weekly action.'],
    ['S2','Vocabulary Lab','Academic Word Builder','A2+','Use context clues to understand academic vocabulary.',{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},['context','meaning','definition','example','keyword','academic vocabulary'],'Guess word meaning from context and reuse useful academic words in short responses.'],
    ['S3','Main Idea Hunter','Reading Mission','A2+','Identify main idea and supporting details in short academic texts.',{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},['main idea','supporting detail','topic','source','evidence','summary'],'Separate the central idea from examples and details.'],
    ['S4','Keyword Scanner','Source Search Mission','B1','Find keywords and relevant information in short sources.',{reading:'Core',listening:'Support',writing:'Exposure',speaking:'Exposure'},['keyword','relevant','source','search','scan','match'],'Scan texts and audio for important keywords that answer a task.'],
    ['S5','Critical Reading','Evidence Check Mission','B1','Evaluate whether a source claim is supported by evidence.',{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},['claim','evidence','reliable','limitation','support','check'],'Check whether information is supported and notice limitations.'],
    ['S6','Summary Builder','Short Summary Mission','B1','Write a short summary using main idea and key support.',{writing:'Core',reading:'Support',listening:'Exposure',speaking:'Exposure'},['summary','paraphrase','main point','key detail','avoid copying','concise'],'Write concise summaries in your own words.'],
    ['S7','Academic Tone Battle','Tone Control Mission','B1','Use polite and academic tone in short explanations.',{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},['academic tone','polite','formal','direct','soften','appropriate'],'Use academic tone instead of casual or overly emotional language.'],
    ['S8','Paragraph Structure Lab','Organization Mission','B1','Organize a short paragraph with topic, support, and closing sentence.',{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},['topic sentence','supporting sentence','connector','closing','paragraph','organization'],'Connect sentences to form a clear academic paragraph.'],
    ['S9','Paragraph Writing','Evidence Paragraph Mission','B1','Write a short academic paragraph with one source detail.',{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},['paragraph','source detail','reason','example','closing sentence','coherence'],'Build a short paragraph using a clear point and one useful source detail.'],
    ['S10','Data Description','Chart and Number Mission','B1','Describe simple data accurately and cautiously.',{writing:'Core',reading:'Support',listening:'Exposure',speaking:'Exposure'},['data','increase','decrease','percentage','trend','cautious language'],'Describe trends and numbers without overclaiming.'],
    ['S11','Academic Email','Email Mission','B1','Write a polite academic email with purpose, context, and request.',{writing:'Core',reading:'Support',listening:'Exposure',speaking:'Exposure'},['subject line','request','purpose','polite','deadline','closing'],'Write short academic emails to teachers or classmates.'],
    ['S12','Citation and Ethics','Academic Integrity Mission','B1','Recognize source use, paraphrasing, and basic academic integrity.',{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},['citation','paraphrase','plagiarism','source','credit','academic integrity'],'Give credit to sources and paraphrase responsibly.'],
    ['S13','Academic Listening','Lecture Note Mission','B1','Listen for signposts, key points, and examples.',{listening:'Core',speaking:'Support',reading:'Exposure',writing:'Exposure'},['signpost','lecture','key point','example','note-taking','signal word'],'Follow short academic talks and record key information.'],
    ['S14','Academic Presentation','Short Talk Mission','B1+','Give a short academic presentation using structure and evidence.',{speaking:'Core',listening:'Support',reading:'Exposure',writing:'Exposure'},['presentation','opening','evidence','transition','conclusion','audience'],'Give a clear short talk with an opening, evidence, and closing.'],
    ['S15','Final Integration','Academic Mission Finale','B1+','Combine reading, listening, writing, and speaking for a final academic task.',{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},['integration','academic task','reflection','evidence','revision','final response'],'Review the full learning cycle and prepare for the final Boss Gate.']
  ];

  const BOSSES = [
    ['B1','Boss Gate 1: Academic Foundations','A2+','S1–S3','Set goals, use vocabulary, find main idea, and give a short goal talk.'],
    ['B2','Boss Gate 2: Reading, Listening and Summary','B1','S4–S6','Scan sources, check evidence, and write a short summary.'],
    ['B3','Boss Gate 3: Academic Writing Control','B1','S7–S9','Use tone, paragraph structure, and evidence in a short academic paragraph.'],
    ['B4','Boss Gate 4: Academic Communication and Ethics','B1','S10–S12','Describe data, write email, and use sources ethically.'],
    ['B5','Boss Gate 5: Final Academic Mission','B1+','S13–S15','Integrate listening, presentation, writing, and reflection.']
  ];

  const SKILLS = ['reading','listening','writing','speaking'];

  function scopeOf(role){
    return role === 'Exposure' ? 'exposure' : 'mastery';
  }

  function mission(routeId, focus, skill, role, band, vocab){
    const prompts = {
      reading: 'Read the source about ' + focus + '. Choose the best main idea and one supporting detail.',
      listening: 'Listen for the speaker\'s main point about ' + focus + '. Choose the key point and one example.',
      writing: 'Write 70–90 words about ' + focus + '. Include one clear point, one supporting detail, and one limitation.',
      speaking: 'Say a short response about ' + focus + '. Use a clear opening, one detail, and one closing sentence.'
    };

    const samples = {
      reading: 'The main idea is about ' + focus.toLowerCase() + '. One detail explains why this skill supports university study.',
      listening: 'The speaker says that ' + focus.toLowerCase() + ' helps students improve gradually. The example is a weekly practice action.',
      writing: focus + ' is useful for academic English because it helps students work with sources more clearly. One practical action is to practise a small task every week. This can improve confidence and accuracy. However, it may be difficult at first, so students should begin with short and manageable practice.',
      speaking: 'Today I will talk about ' + focus.toLowerCase() + '. One useful action is to practise with a short source every week. This can help my academic English because I can build better habits.'
    };

    const checklists = {
      reading: ['main idea identified','one supporting detail selected','answer matches the source','no unsupported claim'],
      listening: ['key point identified','example identified','no invented detail','listening focus completed'],
      writing: ['clear topic','one supporting detail','one limitation','student\'s own wording','70–90 words target'],
      speaking: ['opening','one detail','closing','duration target','typed speaking note']
    };

    return {
      taskId: (routeId + '_' + skill.toUpperCase() + '_' + role.toUpperCase() + '_V1').replace(/\s+/g, '_'),
      skill: skill,
      role: role,
      scope: scopeOf(role),
      cefr: band,
      prompt: prompts[skill],
      sampleOutput: samples[skill],
      checklist: checklists[skill],
      usefulLanguage: ['The main idea is ____.','One useful detail is ____.','This is important because ____.','However, ____ may be difficult at first.'],
      targetVocabulary: vocab.slice(0, 5),
      teacherEvidence: 'prompt + output + score + checklist + contract scope',
      feedback: {
        strong: 'Strong work: your ' + skill + ' response connects the task with clear academic evidence.',
        developing: 'Good start: your ' + skill + ' response is understandable. Add one clearer source detail next time.',
        needsPractice: 'Needs practice: use the frame and include one clear point plus one supporting detail.'
      },
      antiMemorization: {
        rotatePrompts: true,
        rotateDistractors: skill === 'reading' || skill === 'listening',
        noRepeatWindow: 6,
        difficultyVariants: ['A2','A2+','B1','B1+']
      }
    };
  }

  function vocabulary(words, label){
    return words.map(function(word){
      return {
        term: word,
        meaningTH: label || 'คำศัพท์สำคัญสำหรับภารกิจนี้',
        example: word + ' is useful in academic English.'
      };
    });
  }

  function normalRoute(row){
    const id = row[0], title = row[1], subtitle = row[2], band = row[3], focus = row[4], contract = row[5], vocab = row[6], lesson = row[7];

    return {
      routeId: id,
      routeType: 'normal_session',
      title: title,
      subtitle: subtitle,
      cefrBand: band,
      focus: focus,
      microLesson: {
        studentIntro: lesson,
        teacherNote: 'Core + Support count toward mastery; Exposure is evidence of participation only.',
        learningObjectives: [
          'Understand the purpose of ' + focus.toLowerCase(),
          'Complete one Core skill and one Support skill',
          'Try the other two skills as exposure touchpoints',
          'Record evidence that the teacher can review later'
        ],
        usefulFrames: ['My academic goal is to improve ____.','The source says that ____.','One reason is ____.','However, ____ is a possible limitation.'],
        vocabulary: vocabulary(vocab)
      },
      skillContract: contract,
      missions: SKILLS.map(function(skill){
        return mission(id, focus, skill, contract[skill] || 'Exposure', band, vocab);
      }),
      unlockRule: {
        masteryPassScore: 60,
        requiresCoreAndSupport: true,
        exposureDoesNotBlockProgress: true
      },
      teacherEvidencePolicy: {
        normalSpeakingReviewRequired: false,
        writingMayNeedTeacherRubric: true,
        transcriptNotForAutomaticPassFail: true
      }
    };
  }

  function bossRoute(row){
    const id = row[0], title = row[1], band = row[2], coverage = row[3], focus = row[4];
    const vocab = ['integrated','evidence','source','response','reflection','academic mission'];
    const contract = {reading:'Integrated', listening:'Integrated', writing:'Integrated', speaking:'Integrated'};

    const missions = SKILLS.map(function(skill){
      const item = mission(id, focus, skill, 'Integrated', band, vocab);
      item.scope = 'mastery';
      item.taskId = id + '_' + skill.toUpperCase() + '_INTEGRATED_BOSS_V1';

      if (skill === 'speaking') {
        item.teacherReviewRequired = true;
        item.targetRange = id === 'B1' ? '20–40 sec' : '25–45 sec';
        item.prompt = 'Use the Boss cues to give a short integrated speaking response for ' + title + '. Include one frame, one cue, and one clear academic action.';
        item.checklist = ['opening used','selected frame used','selected cue used','one evidence point','duration target attempted','typed speaking note'];
      }

      return item;
    });

    return {
      routeId: id,
      routeType: 'boss_gate',
      title: title,
      subtitle: 'Integrated Boss Mission covering ' + coverage,
      cefrBand: band,
      focus: focus,
      microLesson: {
        studentIntro: 'This Boss Gate checks how well students can combine skills from ' + coverage + '.',
        teacherNote: 'Boss Speaking creates a teacher review item. Teacher feedback codes: CL, PR, FL, ST, EV, QA.',
        learningObjectives: ['Review key skills from ' + coverage,'Use evidence from reading/listening sources','Write or speak a clear academic response','Reflect on the next learning action'],
        usefulFrames: ['The source suggests that ____.','My response is ____ because ____.','One useful action is ____.','A possible limitation is ____.'],
        vocabulary: vocabulary(vocab, 'คำศัพท์รวมสำหรับ Boss Gate')
      },
      skillContract: contract,
      missions: missions,
      unlockRule: {
        requiresPriorSessions: coverage,
        masteryPassScore: 60,
        bossSpeakingTeacherReviewRequired: true,
        transcriptNotForAutomaticPassFail: true
      },
      teacherEvidencePolicy: {
        bossSpeakingReviewRequired: true,
        feedbackCodes: ['CL','PR','FL','ST','EV','QA'],
        audioOptionalWithConsent: true,
        transcriptNotForAutomaticPassFail: true
      }
    };
  }

  const ROUTES = NORMAL_SESSIONS.map(normalRoute).concat(BOSSES.map(bossRoute));

  window.EAP_HERO_SESSION_CONTENT_PACK = Object.freeze({
    version: 'v20260708-EAP-HERO-STUDENT-CONTENT-PACK-COMPLETE-S1-S15-B1-B5',
    course: 'EAP Hero: Save the Society',
    section: '122',
    learnerLevel: 'Year 2 university learners, CEFR A2–B1+',
    designPrinciples: [
      'Every normal session exposes all four skills.',
      'Only Core + Support count toward normal session mastery.',
      'Exposure is recorded as learning evidence but does not block progress.',
      'Boss Gates integrate all four skills.',
      'Boss Speaking requires teacher review; normal speaking does not.',
      'Transcript or AI feedback must not determine speaking pass/fail automatically.',
      'Items, prompts, examples, answer positions, and difficulty rotate to reduce memorization.'
    ],
    routeOrder: ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'],
    routes: ROUTES,
    globalFeedbackRules: {
      strong: 'Score 80+: praise clarity, evidence, and independence; recommend a harder variant.',
      goodStart: 'Score 60–79: confirm progress; recommend one specific improvement.',
      needsPractice: 'Score below 60: give one useful frame and require replay with a fresh scenario.',
      teacherReviewReminder: 'Writing and speaking auto-checks are formative. Teachers may use rubrics for final judgement.'
    },
    integrationNotes: {
      suggestedFileName: 'eap-session-content-pack-v20260708.js',
      attachToWindow: 'window.EAP_HERO_SESSION_CONTENT_PACK',
      studentGameUse: 'Use routeId + skill to select microLesson, mission prompt, usefulLanguage, checklist, and feedback.',
      teacherConsoleUse: 'Use prompt, output, taskId, durationSec, checklist, selectedFrame, selectedCue, and contract scope for evidence viewer.'
    }
  });
})();
