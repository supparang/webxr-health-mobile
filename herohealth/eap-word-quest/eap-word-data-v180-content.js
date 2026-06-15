/* =========================================================
   EAP Word Quest • v1.8.0 Content Layer
   File: /herohealth/eap-word-quest/eap-word-data-v180-content.js
   Version: v1.8.0-EAP-Y2-ARC122-AI-VOCAB-CONTENT

   Role:
   - Vocabulary Side Quest for EAP Hero Save the Society
   - English for Academic Purposes Year 2
   - Group / Section 122
   - Arc-based content
   - AI Help metadata ready
   - Arc 1 content replacement: S1 / S2 / S3 / BG1
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.0-EAP-Y2-ARC122-AI-VOCAB-CONTENT";

  if(window.__EAP_WORD_QUEST_V180_CONTENT__){
    console.info("[EAP Word Quest] v180 content already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V180_CONTENT__ = true;

  const DEFAULT_SECTION = "122";

  const ARCS = {
    ARC1:{
      id:"ARC1",
      label:"Arc 1",
      title:"Project Foundation",
      subtitle:"Academic profile, project introduction, rationale, and target users",
      sessions:["S1","S2","S3"],
      boss:"BG1"
    }
  };

  const SESSION_META = {
    S1:{
      id:"S1",
      arc:"ARC1",
      title:"Academic Profile",
      levelRange:"A2–B1",
      mainMission:"EAP Hero Main Mission S1",
      description:"ฝึกคำศัพท์สำหรับแนะนำตัวเชิงวิชาการ อธิบายสาขา ทักษะ จุดแข็ง และเป้าหมายการเรียน",
      passRule:"Accuracy ≥ 60%",
      role:"Vocabulary Ready for Main Mission S1"
    },
    S2:{
      id:"S2",
      arc:"ARC1",
      title:"Project Introduction",
      levelRange:"A2–B1",
      mainMission:"EAP Hero Main Mission S2",
      description:"ฝึกคำศัพท์สำหรับอธิบายหัวข้อโครงการ ปัญหา วัตถุประสงค์ แนวทางแก้ และฟีเจอร์",
      passRule:"Accuracy ≥ 60%",
      role:"Vocabulary Ready for Main Mission S2"
    },
    S3:{
      id:"S3",
      arc:"ARC1",
      title:"Project Rationale & Target Users",
      levelRange:"A2+–B1+",
      mainMission:"EAP Hero Main Mission S3",
      description:"ฝึกคำศัพท์สำหรับอธิบายเหตุผลโครงการ ความจำเป็น กลุ่มเป้าหมาย ขอบเขต และประโยชน์",
      passRule:"Accuracy ≥ 60%",
      role:"Vocabulary Ready for Main Mission S3"
    },
    BG1:{
      id:"BG1",
      arc:"ARC1",
      title:"Vocabulary Boss 1",
      levelRange:"A2–B1+",
      mainMission:"Arc 1 Vocabulary Boss",
      description:"ทบทวนคำศัพท์รวมจาก S1–S3 ก่อนเข้าสู่ Arc ถัดไป",
      passRule:"Accuracy ≥ 70% และ Boss HP = 0",
      role:"Arc 1 Vocabulary Ready"
    }
  };

  function w(session, word, level, skill, meaning, th, example, collocation, confusable){
    return {
      session,
      arc:"ARC1",
      word,
      level,
      skill,
      meaning,
      th,
      example,
      collocation,
      confusable,
      aiHint1:`Read the academic context carefully. This word is about ${meaning}.`,
      aiHint2:`Compare it with: ${confusable.join(", ")}. Choose the word that best fits the sentence.`,
      aiExplain:`"${word}" means ${meaning}. In EAP, it is useful for ${SESSION_META[session].title}.`
    };
  }

  const WORDS = [
    /* =========================
       S1 Academic Profile
    ========================= */
    w("S1","major","A2","academic-profile",
      "a student's main subject of study",
      "สาขาวิชาหลัก",
      "My major is digital technology.",
      "academic major",
      ["background","skill","interest"]
    ),
    w("S1","background","A2","academic-profile",
      "past experience, study, or information about a person",
      "พื้นฐานหรือประสบการณ์เดิม",
      "My academic background is in multimedia.",
      "academic background",
      ["major","experience","profile"]
    ),
    w("S1","skill","A2","academic-profile",
      "an ability to do something well",
      "ทักษะ",
      "Communication is an important academic skill.",
      "communication skill",
      ["strength","ability","interest"]
    ),
    w("S1","strength","A2+","academic-profile",
      "something a person can do well",
      "จุดแข็ง",
      "One of my strengths is teamwork.",
      "personal strength",
      ["skill","goal","challenge"]
    ),
    w("S1","interest","A2","academic-profile",
      "something a person wants to learn more about",
      "ความสนใจ",
      "My academic interest is educational technology.",
      "academic interest",
      ["goal","major","motivation"]
    ),
    w("S1","goal","A2","academic-profile",
      "something a person wants to achieve",
      "เป้าหมาย",
      "My learning goal is to improve academic writing.",
      "learning goal",
      ["purpose","interest","achievement"]
    ),
    w("S1","experience","A2+","academic-profile",
      "knowledge or skill gained from doing something",
      "ประสบการณ์",
      "I have experience in creating simple mobile apps.",
      "learning experience",
      ["background","achievement","ability"]
    ),
    w("S1","achievement","B1","academic-profile",
      "something successful that a person has done",
      "ความสำเร็จ",
      "Completing a class project was an important achievement.",
      "academic achievement",
      ["experience","goal","challenge"]
    ),
    w("S1","ability","A2+","academic-profile",
      "the power or skill to do something",
      "ความสามารถ",
      "Students need the ability to explain their ideas clearly.",
      "language ability",
      ["skill","strength","confidence"]
    ),
    w("S1","improve","A2","academic-profile",
      "to make something better",
      "พัฒนาให้ดีขึ้น",
      "I want to improve my English presentation skills.",
      "improve skills",
      ["develop","support","practice"]
    ),
    w("S1","academic","A2+","academic-profile",
      "related to study, school, college, or university work",
      "เกี่ยวกับวิชาการ",
      "Academic English is important for university students.",
      "academic English",
      ["professional","personal","technical"]
    ),
    w("S1","portfolio","B1","academic-profile",
      "a collection of a student's work",
      "แฟ้มสะสมผลงาน",
      "The portfolio shows my learning progress.",
      "digital portfolio",
      ["profile","achievement","report"]
    ),
    w("S1","profile","A2+","academic-profile",
      "short information about a person",
      "ประวัติย่อหรือข้อมูลแนะนำตัว",
      "An academic profile includes a student's major and skills.",
      "academic profile",
      ["portfolio","background","summary"]
    ),
    w("S1","motivation","B1","academic-profile",
      "the reason that makes someone want to do something",
      "แรงจูงใจ",
      "My motivation for studying English is to present my project better.",
      "learning motivation",
      ["goal","interest","rationale"]
    ),
    w("S1","confidence","B1","academic-profile",
      "the feeling that you can do something well",
      "ความมั่นใจ",
      "Practice can increase confidence in speaking English.",
      "speaking confidence",
      ["ability","strength","achievement"]
    ),
    w("S1","challenge","B1","academic-profile",
      "something difficult that needs effort",
      "ความท้าทาย",
      "Writing an academic summary is a challenge for many students.",
      "learning challenge",
      ["problem","goal","achievement"]
    ),
    w("S1","learning style","B1","academic-profile",
      "the way a student learns best",
      "รูปแบบการเรียนรู้",
      "My learning style is visual because I remember diagrams well.",
      "learning style",
      ["background","skill","method"]
    ),
    w("S1","responsibility","B1","academic-profile",
      "a duty or task that someone should do",
      "ความรับผิดชอบ",
      "Submitting work on time is a student responsibility.",
      "academic responsibility",
      ["role","task","deadline"]
    ),
    w("S1","communication","A2+","academic-profile",
      "the act of sharing information or ideas",
      "การสื่อสาร",
      "Clear communication helps students work together.",
      "effective communication",
      ["teamwork","discussion","presentation"]
    ),
    w("S1","teamwork","A2+","academic-profile",
      "working with others to achieve a goal",
      "การทำงานเป็นทีม",
      "Teamwork is important in a group project.",
      "teamwork skill",
      ["communication","responsibility","collaboration"]
    ),

    /* =========================
       S2 Project Introduction
    ========================= */
    w("S2","project","A2","project-introduction",
      "a planned piece of work with a clear goal",
      "โครงการหรือชิ้นงาน",
      "Our project is a vocabulary learning game.",
      "class project",
      ["task","assignment","portfolio"]
    ),
    w("S2","objective","A2+","project-introduction",
      "a goal that a project wants to achieve",
      "วัตถุประสงค์",
      "The objective of this project is to help students review EAP vocabulary.",
      "project objective",
      ["rationale","feature","outcome"]
    ),
    w("S2","problem","A2","project-introduction",
      "something difficult that needs a solution",
      "ปัญหา",
      "The problem is that students forget academic vocabulary easily.",
      "main problem",
      ["challenge","solution","limitation"]
    ),
    w("S2","solution","A2","project-introduction",
      "a way to solve a problem",
      "แนวทางแก้ปัญหา",
      "The solution is to create a replayable vocabulary game.",
      "possible solution",
      ["problem","method","feature"]
    ),
    w("S2","feature","A2+","project-introduction",
      "a function or important part of a product",
      "ฟีเจอร์หรือคุณลักษณะ",
      "The game has an AI Help feature.",
      "main feature",
      ["function","objective","tool"]
    ),
    w("S2","user","A2","project-introduction",
      "a person who uses a product or system",
      "ผู้ใช้",
      "The user can choose a vocabulary session.",
      "target user",
      ["student","developer","audience"]
    ),
    w("S2","design","A2+","project-introduction",
      "the plan or appearance of a product",
      "การออกแบบ",
      "The design should be simple and easy to use.",
      "user-friendly design",
      ["prototype","interface","method"]
    ),
    w("S2","topic","A2","project-introduction",
      "the subject of a discussion, lesson, or project",
      "หัวข้อ",
      "The topic of our project is academic vocabulary learning.",
      "project topic",
      ["title","objective","scope"]
    ),
    w("S2","purpose","A2+","project-introduction",
      "the reason why something is done",
      "จุดประสงค์",
      "The purpose of the game is to support EAP learning.",
      "main purpose",
      ["objective","rationale","result"]
    ),
    w("S2","tool","A2","project-introduction",
      "something used to do a task",
      "เครื่องมือ",
      "The application is a learning tool for vocabulary practice.",
      "learning tool",
      ["application","feature","system"]
    ),
    w("S2","application","A2+","project-introduction",
      "a software program used for a purpose",
      "แอปพลิเคชัน",
      "The application helps students practice academic words.",
      "mobile application",
      ["system","tool","prototype"]
    ),
    w("S2","prototype","B1","project-introduction",
      "an early model of a product used for testing",
      "ต้นแบบ",
      "The prototype shows how the final game may work.",
      "project prototype",
      ["product","design","interface"]
    ),
    w("S2","function","A2+","project-introduction",
      "what a system or tool can do",
      "หน้าที่การทำงาน",
      "The main function is to generate vocabulary questions.",
      "system function",
      ["feature","process","objective"]
    ),
    w("S2","simple","A2","project-introduction",
      "easy to understand or use",
      "เรียบง่าย",
      "The interface should be simple for second-year students.",
      "simple interface",
      ["useful","clear","basic"]
    ),
    w("S2","useful","A2","project-introduction",
      "helpful for doing something",
      "มีประโยชน์",
      "A useful game helps students remember vocabulary.",
      "useful tool",
      ["practical","simple","effective"]
    ),
    w("S2","support","A2+","project-introduction",
      "to help someone or something",
      "สนับสนุน",
      "The game supports students before the main mission.",
      "support learning",
      ["improve","develop","guide"]
    ),
    w("S2","develop","A2+","project-introduction",
      "to create or improve something over time",
      "พัฒนา",
      "Students develop a project as part of the course.",
      "develop a project",
      ["improve","design","create"]
    ),
    w("S2","plan","A2","project-introduction",
      "a set of steps for doing something",
      "แผน",
      "The team needs a clear plan before building the prototype.",
      "project plan",
      ["method","process","timeline"]
    ),
    w("S2","outcome","B1","project-introduction",
      "the result of an activity or project",
      "ผลลัพธ์",
      "The expected outcome is better vocabulary readiness.",
      "expected outcome",
      ["objective","result","impact"]
    ),
    w("S2","interface","B1","project-introduction",
      "the part of a system that users see and use",
      "ส่วนติดต่อผู้ใช้",
      "The interface should show the score and AI Help clearly.",
      "user interface",
      ["design","feature","system"]
    ),

    /* =========================
       S3 Project Rationale & Target Users
    ========================= */
    w("S3","rationale","B1","project-rationale",
      "the reason why a project or action is needed",
      "เหตุผลหรือความจำเป็นของโครงการ",
      "The rationale explains why the project is necessary.",
      "project rationale",
      ["objective","feature","method"]
    ),
    w("S3","target user","A2+","project-rationale",
      "the main group of people who will use a product",
      "กลุ่มผู้ใช้เป้าหมาย",
      "The target users are second-year students in group 122.",
      "target user group",
      ["audience","participant","developer"]
    ),
    w("S3","need","A2","project-rationale",
      "something necessary or important",
      "ความจำเป็น",
      "There is a need for more vocabulary practice.",
      "learning need",
      ["benefit","problem","goal"]
    ),
    w("S3","benefit","A2+","project-rationale",
      "a good result or advantage",
      "ประโยชน์",
      "One benefit of the game is that students can replay it.",
      "project benefit",
      ["outcome","impact","feature"]
    ),
    w("S3","scope","B1","project-rationale",
      "the limit or range of a project",
      "ขอบเขต",
      "The project scope is limited to EAP vocabulary for Year 2 students.",
      "project scope",
      ["limitation","objective","context"]
    ),
    w("S3","context","B1","project-rationale",
      "the situation or background that helps explain something",
      "บริบท",
      "The context of this project is English for Academic Purposes.",
      "learning context",
      ["background","scope","evidence"]
    ),
    w("S3","requirement","B1","project-rationale",
      "something that is needed or expected",
      "ข้อกำหนดหรือสิ่งที่จำเป็น",
      "A key requirement is that the game must be replayable.",
      "project requirement",
      ["need","feature","condition"]
    ),
    w("S3","evidence","B1","project-rationale",
      "information that supports an idea or claim",
      "หลักฐาน",
      "The survey provides evidence that students need more practice.",
      "supporting evidence",
      ["result","opinion","example"]
    ),
    w("S3","relevant","B1","project-rationale",
      "closely connected to the topic",
      "เกี่ยวข้อง",
      "The vocabulary should be relevant to academic tasks.",
      "relevant vocabulary",
      ["specific","useful","general"]
    ),
    w("S3","specific","A2+","project-rationale",
      "clear and exact",
      "เฉพาะเจาะจง",
      "The project should have a specific target user group.",
      "specific goal",
      ["general","relevant","clear"]
    ),
    w("S3","identify","A2+","project-rationale",
      "to find or name something clearly",
      "ระบุ",
      "Students need to identify the main problem before proposing a solution.",
      "identify a problem",
      ["describe","justify","explain"]
    ),
    w("S3","describe","A2","project-rationale",
      "to say what something is like",
      "อธิบายลักษณะ",
      "The team should describe the target users clearly.",
      "describe users",
      ["identify","summarize","justify"]
    ),
    w("S3","justify","B1+","project-rationale",
      "to give a good reason for a decision or idea",
      "ให้เหตุผลสนับสนุน",
      "Students must justify why their project is useful.",
      "justify a decision",
      ["describe","identify","support"]
    ),
    w("S3","practical","B1","project-rationale",
      "useful and suitable for real situations",
      "ใช้ได้จริง",
      "The game is practical because students can use it on mobile phones.",
      "practical solution",
      ["useful","theoretical","simple"]
    ),
    w("S3","impact","B1","project-rationale",
      "the effect or influence of something",
      "ผลกระทบ",
      "The expected impact is improved vocabulary readiness.",
      "learning impact",
      ["outcome","benefit","result"]
    ),
    w("S3","limitation","B1+","project-rationale",
      "a weakness or boundary of a project",
      "ข้อจำกัด",
      "One limitation is that the first version uses rule-based AI.",
      "project limitation",
      ["scope","problem","requirement"]
    ),
    w("S3","background","A2+","project-rationale",
      "information that helps explain the project situation",
      "ข้อมูลพื้นฐาน",
      "The background explains why vocabulary practice is important.",
      "project background",
      ["context","profile","evidence"]
    ),
    w("S3","reason","A2","project-rationale",
      "why something happens or is done",
      "เหตุผล",
      "The reason for using a game is to make practice more engaging.",
      "main reason",
      ["rationale","purpose","objective"]
    ),
    w("S3","user group","A2+","project-rationale",
      "a group of people who use or may use a product",
      "กลุ่มผู้ใช้",
      "The user group is second-year EAP students.",
      "target user group",
      ["target user","audience","participant"]
    ),
    w("S3","problem statement","B1+","project-rationale",
      "a clear description of the problem a project will address",
      "ข้อความอธิบายปัญหา",
      "The problem statement explains the vocabulary difficulty faced by students.",
      "clear problem statement",
      ["rationale","objective","solution"]
    )
  ];

  const TYPE_LABELS = {
    meaning:"Meaning",
    definition_to_word:"Definition to Word",
    context_blank:"Context Blank",
    collocation:"Collocation",
    confusable_choice:"Confusable Choice",
    academic_sentence:"Academic Sentence"
  };

  function normalize(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function hashString(str){
    let h = 2166136261;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  function seededShuffle(arr, seed){
    const out = arr.slice();
    let s = hashString(seed || "eap");

    for(let i = out.length - 1; i > 0; i--){
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }

    return out;
  }

  function unique(arr){
    const seen = new Set();
    const out = [];

    arr.forEach(item => {
      const key = normalize(item).toLowerCase();
      if(!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });

    return out;
  }

  const WORD_MAP = Object.fromEntries(WORDS.map(item => [item.word.toLowerCase(), item]));

  function relatedWords(entry){
    const direct = entry.confusable || [];
    const sameSkill = WORDS
      .filter(w => w.skill === entry.skill && w.word !== entry.word)
      .map(w => w.word);

    const sameSession = WORDS
      .filter(w => w.session === entry.session && w.word !== entry.word)
      .map(w => w.word);

    return unique([...direct, ...sameSkill, ...sameSession]).slice(0,8);
  }

  function optionWords(entry, count, seed){
    const pool = relatedWords(entry);
    const selected = seededShuffle(pool, seed).slice(0, count - 1);
    return seededShuffle(unique([entry.word, ...selected]).slice(0,count), seed + "-options");
  }

  function optionMeanings(entry, count, seed){
    const pool = relatedWords(entry)
      .map(word => WORD_MAP[word.toLowerCase()])
      .filter(Boolean)
      .map(item => item.meaning);

    const generic = [
      "a planned piece of work with a clear goal",
      "the result of an activity or project",
      "information that supports an idea or claim",
      "the limit or range of a project",
      "a function or important part of a product",
      "a way to solve a problem"
    ];

    const selected = seededShuffle(unique([...pool, ...generic]), seed).slice(0, count - 1);
    return seededShuffle(unique([entry.meaning, ...selected]).slice(0,count), seed + "-meaning-options");
  }

  function optionCollocations(entry, count, seed){
    const pool = relatedWords(entry)
      .map(word => WORD_MAP[word.toLowerCase()])
      .filter(Boolean)
      .map(item => item.collocation);

    const generic = [
      "academic summary",
      "project objective",
      "target user group",
      "supporting evidence",
      "system function",
      "learning goal"
    ];

    const selected = seededShuffle(unique([...pool, ...generic]), seed).slice(0, count - 1);
    return seededShuffle(unique([entry.collocation, ...selected]).slice(0,count), seed + "-collocation-options");
  }

  function blankExample(entry){
    const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const re = new RegExp("\\b" + escaped + "\\b","i");

    if(re.test(entry.example)){
      return entry.example.replace(re,"______");
    }

    return `The ______ is important in this academic task.`;
  }

  function makeBase(entry, type, n){
    return {
      id:`v180-${entry.session}-${entry.word.replace(/\s+/g,"-")}-${type}-${n}`,
      version:VERSION,
      arc:entry.arc,
      arcId:entry.arc,
      session:entry.session,
      sessionId:entry.session,
      sourceSession:entry.session,
      title:SESSION_META[entry.session].title,
      level:entry.level,
      cefr:entry.level,
      skill:entry.skill,
      word:entry.word,
      target:entry.word,
      type,
      itemType:type,
      typeLabel:TYPE_LABELS[type],
      th:entry.th,
      meaning:entry.meaning,
      example:entry.example,
      collocation:entry.collocation,
      confusable:entry.confusable.slice(),
      aiHint1:entry.aiHint1,
      aiHint2:entry.aiHint2,
      aiExplain:entry.aiExplain,
      tags:[
        entry.session,
        entry.arc,
        entry.level,
        entry.skill,
        "EAP",
        "Year2",
        "Group122",
        TYPE_LABELS[type]
      ]
    };
  }

  function withOptions(base, prompt, options, answer, explanation){
    return Object.assign(base,{
      prompt,
      question:prompt,
      options,
      choices:options,
      answer,
      correct:answer,
      correctAnswer:answer,
      explanation,
      feedback:explanation
    });
  }

  function makeItems(entry){
    const items = [];
    let n = 1;

    items.push(withOptions(
      makeBase(entry,"meaning",n++),
      `What is the best meaning of "${entry.word}" in an EAP context?`,
      optionMeanings(entry,4,entry.word + "-meaning"),
      entry.meaning,
      `"${entry.word}" means ${entry.meaning}.`
    ));

    items.push(withOptions(
      makeBase(entry,"definition_to_word",n++),
      `Which word means: "${entry.meaning}"?`,
      optionWords(entry,4,entry.word + "-definition"),
      entry.word,
      `The correct word is "${entry.word}".`
    ));

    items.push(withOptions(
      makeBase(entry,"context_blank",n++),
      blankExample(entry),
      optionWords(entry,4,entry.word + "-blank"),
      entry.word,
      `In this sentence, "${entry.word}" fits the academic context best.`
    ));

    items.push(withOptions(
      makeBase(entry,"collocation",n++),
      `Which phrase is the most natural academic phrase with "${entry.word}"?`,
      optionCollocations(entry,4,entry.word + "-collocation"),
      entry.collocation,
      `"${entry.collocation}" is a useful academic phrase.`
    ));

    items.push(withOptions(
      makeBase(entry,"confusable_choice",n++),
      `Choose the most precise word for this academic sentence: ${blankExample(entry)}`,
      optionWords(entry,4,entry.word + "-confusable"),
      entry.word,
      `This is a confusable item. The best answer is "${entry.word}", not ${entry.confusable.join(", ")}.`
    ));

    const sentenceOptions = relatedWords(entry)
      .map(word => WORD_MAP[word.toLowerCase()])
      .filter(Boolean)
      .map(item => item.example);

    items.push(withOptions(
      makeBase(entry,"academic_sentence",n++),
      `Which sentence uses "${entry.word}" correctly in an academic context?`,
      seededShuffle(unique([entry.example, ...sentenceOptions]).slice(0,4), entry.word + "-sentence"),
      entry.example,
      `The correct sentence uses "${entry.word}" naturally in an EAP context.`
    ));

    return items;
  }

  const ARC1_SESSION_ITEMS = WORDS.flatMap(makeItems);

  const BG1_ITEMS = ARC1_SESSION_ITEMS.map(item => {
    const copy = Object.assign({}, item);

    copy.id = "v180-BG1-" + item.id;
    copy.session = "BG1";
    copy.sessionId = "BG1";
    copy.sourceSession = item.sourceSession || item.sessionId || item.session;
    copy.title = SESSION_META.BG1.title;
    copy.arc = "ARC1";
    copy.arcId = "ARC1";
    copy.isBoss = true;
    copy.boss = "BG1";
    copy.tags = unique([
      "BG1",
      "Vocabulary Boss",
      "Arc 1",
      "EAP",
      "Year2",
      "Group122",
      copy.sourceSession,
      copy.level,
      copy.skill,
      copy.typeLabel
    ]);

    return copy;
  });

  const V180_ITEMS = [...ARC1_SESSION_ITEMS, ...BG1_ITEMS];

  function itemSessionId(item){
    return normalize(
      item.sessionId ||
      item.session ||
      item.stage ||
      item.mission ||
      item.boss ||
      ""
    );
  }

  function isArc1ReplacementItem(item){
    const sid = itemSessionId(item);
    const id = normalize(item.id);

    return ["S1","S2","S3","BG1"].includes(sid) ||
      /^v\d+-S[123]/i.test(id) ||
      /BG1/i.test(id);
  }

  function collectExistingItems(){
    const candidates = [
      window.EAP_WORD_ITEMS,
      window.EAP_WORD_BANK,
      window.EAP_ITEMS,
      window.EAP_WORD_QUEST_ITEMS,
      window.EAP_WORD_QUEST_DATA && window.EAP_WORD_QUEST_DATA.items,
      window.EAP_WORD_DATA && window.EAP_WORD_DATA.items
    ];

    for(const c of candidates){
      if(Array.isArray(c) && c.length){
        return c.slice();
      }
    }

    return [];
  }

  const existing = collectExistingItems();
  const kept = existing.filter(item => !isArc1ReplacementItem(item));
  const merged = [...kept, ...V180_ITEMS];

  const CONTENT = {
    version:VERSION,
    role:"Vocabulary Side Quest",
    mainGame:"EAP Hero Save the Society",
    defaultSection:DEFAULT_SECTION,
    course:"English for Academic Purposes",
    year:"Year 2",
    group:"122",
    terminology:{
      arc:"Arc",
      session:"Session",
      boss:"Boss Gate",
      ready:"Vocabulary Ready",
      strong:"Vocabulary Strong",
      mastery:"Vocabulary Mastery"
    },
    passRules:{
      session:{
        label:"Vocabulary Ready",
        accuracy:60
      },
      boss:{
        label:"Arc Vocabulary Ready",
        accuracy:70,
        requireBossHpZero:true
      },
      finalBoss:{
        label:"Final Vocabulary Mastery",
        accuracy:75,
        requireBossHpZero:true
      }
    },
    replayRules:{
      sessionQuestionCount:12,
      bossQuestionCount:24,
      finalBossQuestionCount:36,
      noRepeatTargetWordInRound:true,
      preferContextItems:true,
      preferConfusableItems:true,
      adaptiveLevels:["A2","A2+","B1","B1+"]
    },
    ai:{
      help:true,
      prediction:true,
      difficulty:true,
      helpMode:"scaffold-not-answer",
      predictionSignals:[
        "accuracy",
        "responseTime",
        "hintUse",
        "streak",
        "missStreak",
        "weakWords",
        "levelPattern"
      ]
    },
    arcs:ARCS,
    sessions:SESSION_META,
    words:WORDS,
    arc1Items:V180_ITEMS,
    items:merged
  };

  window.EAP_V180_CONTENT = CONTENT;
  window.EAP_V180_ARCS = ARCS;
  window.EAP_V180_SESSION_META = SESSION_META;
  window.EAP_V180_WORDS = WORDS;
  window.EAP_V180_ITEMS = V180_ITEMS;

  /*
    Alias หลายชื่อเพื่อให้เข้ากับ engine เดิม/patch เดิมให้มากที่สุด
  */
  window.EAP_DEFAULT_SECTION = DEFAULT_SECTION;
  window.EAP_WORD_QUEST_DEFAULT_SECTION = DEFAULT_SECTION;

  window.EAP_WORD_ITEMS = merged;
  window.EAP_WORD_BANK = merged;
  window.EAP_ITEMS = merged;
  window.EAP_WORD_QUEST_ITEMS = merged;

  window.EAP_WORD_DATA = Object.assign({}, window.EAP_WORD_DATA || {}, CONTENT, {
    items:merged
  });

  window.EAP_WORD_QUEST_DATA = Object.assign({}, window.EAP_WORD_QUEST_DATA || {}, CONTENT, {
    items:merged
  });

  function countBy(items, keyFn){
    return items.reduce((acc,item) => {
      const key = keyFn(item) || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },{});
  }

  window.inspectV180Content = function(){
    const report = {
      version:VERSION,
      defaultSection:DEFAULT_SECTION,
      role:CONTENT.role,
      mainGame:CONTENT.mainGame,
      totalMergedItems:merged.length,
      v180Arc1Items:V180_ITEMS.length,
      words:WORDS.length,
      wordsBySession:countBy(WORDS, w => w.session),
      itemsBySession:countBy(V180_ITEMS, item => item.sessionId || item.session),
      itemsByType:countBy(V180_ITEMS, item => item.itemType || item.type),
      itemsByLevel:countBy(V180_ITEMS, item => item.level),
      bossItems:BG1_ITEMS.length,
      sample:SAMPLE_ITEMS("S3",6)
    };

    console.table(report.wordsBySession);
    console.table(report.itemsBySession);
    console.table(report.itemsByType);
    console.table(report.itemsByLevel);
    console.info("[EAP Word Quest] v180 content inspection:",report);

    return report;
  };

  function SAMPLE_ITEMS(sessionId, count){
    return V180_ITEMS
      .filter(item => (item.sessionId || item.session) === sessionId)
      .slice(0,count)
      .map(item => ({
        id:item.id,
        session:item.sessionId || item.session,
        level:item.level,
        type:item.type,
        word:item.word,
        question:item.question,
        answer:item.answer,
        options:item.options
      }));
  }

  window.sampleV180Items = function(sessionId,count){
    const sample = SAMPLE_ITEMS(sessionId || "S1", count || 12);
    console.table(sample);
    return sample;
  };

  console.info("[EAP Word Quest] v180 EAP Year 2 content loaded:",{
    version:VERSION,
    defaultSection:DEFAULT_SECTION,
    words:WORDS.length,
    arc1SessionItems:ARC1_SESSION_ITEMS.length,
    bg1Items:BG1_ITEMS.length,
    mergedItems:merged.length,
    helpers:["inspectV180Content()","sampleV180Items('S3',12)"]
  });
})();
