/* =========================================================
   EAP Word Quest • Core-Aligned Procedural Question Bank
   File: /herohealth/eap-word-quest/eap-word-data-v191-core-aligned-bank.js
   Version: v1.9.1-CORE-ALIGNED-QUESTION-BANK-122

   Requires:
   - eap-core-vocabulary-map-v189.js

   Provides:
   - All S1–S15 targets from the agreed EAP Core Vocabulary Map
   - Four CEFR-facing item types: Definition / Context / Application / Repair
   - Boss pools that draw only from their three source Sessions
   - Stable target metadata for AI Help, Weak Words, Teacher Insight
   - No fixed answer position and no repeated prompt dependency
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.1-CORE-ALIGNED-QUESTION-BANK-122";

  if (window.__EAP_CORE_BANK_V191__) {
    console.info("[EAP Word Quest] Core bank v191 already loaded.");
    return;
  }
  window.__EAP_CORE_BANK_V191__ = true;

  if (!window.EAP_CORE_VOCAB_MAP || typeof window.getEapCoreSessionTargets !== "function") {
    console.error("[EAP Word Quest] v191 needs eap-core-vocabulary-map-v189.js before it.");
    return;
  }

  const MAP = window.EAP_CORE_VOCAB_MAP;
  const SESSION_ORDER = MAP.sessionOrder.slice();
  const BOSS_IDS = ["BG1", "BG2", "BG3", "BG4", "BG5"];

  function norm(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function key(value) {
    return norm(value)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/…/g, "")
      .replace(/[^a-z0-9+\s/.-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function seededNumber(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Math.abs(h >>> 0);
  }

  function levelFor(target, type) {
    if (target.band === "stretch") return "B1+";
    if (type === "repair" || type === "application") return target.band === "core" ? "B1" : "B1+";
    if (target.band === "chunk" || target.band === "spiral") return "A2+";
    return "A2";
  }

  /*
    Definition metadata intentionally uses short, readable English.
    The Thai scaffolding appears in feedback, not in the prompt, so the game
    remains an English-learning task rather than a direct translation test.
  */
  const DEFINITIONS = {
    "academic goal": "a clear learning aim that a student wants to reach",
    "purpose": "the reason why a person does something",
    "skill": "an ability that improves through practice",
    "improve": "to become better at something",
    "achieve": "to successfully reach a goal",
    "progress": "improvement or movement toward a goal",
    "weekly action": "a small task completed every week",
    "target": "a specific result that a learner works toward",
    "plan": "a set of steps prepared before doing a task",
    "practice": "repeated work to build a skill",
    "result": "what happens after an action or study",
    "realistic": "possible to do in the available time and situation",
    "measurable": "able to be checked with evidence or numbers",

    "notice": "a short official message that gives information or instructions",
    "course": "a subject of study taught over a period of time",
    "timetable": "a schedule that shows times for classes or activities",
    "deadline": "the latest time or date when work must be completed",
    "requirement": "something that must be done or provided",
    "submit": "to officially send work for checking",
    "attendance": "being present at a class or event",
    "context clue": "a nearby word or phrase that helps explain an unfamiliar word",
    "collocation": "words that are commonly used together",
    "word family": "related forms of a word such as noun, verb, adjective, and adverb",
    "compulsory": "required; not optional",
    "optional": "available to choose but not required",

    "topic": "the general subject of a text or discussion",
    "main idea": "the most important message of a text",
    "key point": "an important idea that should be remembered",
    "supporting detail": "a fact or example that explains a main idea",
    "relevant": "directly connected to the topic or task",
    "irrelevant": "not connected to the topic or task",
    "brief": "short and focused information about a task or topic",
    "central idea": "the main message that holds a text together",
    "implied meaning": "an idea suggested by the text but not stated directly",

    "keyword": "an important word that helps identify a topic or idea",
    "cause": "the reason why something happens",
    "contrast": "a clear difference between two ideas",
    "example": "a specific case used to explain an idea",
    "sequence": "the order in which actions or ideas happen",
    "signal word": "a word or phrase that shows the relationship between ideas",
    "relationship": "the connection between two ideas or events",
    "consequently": "therefore; as a result of what happened before",
    "in contrast": "used to show a difference from the previous idea",

    "claim": "a statement that needs support or proof",
    "fact": "information that can be checked as true or false",
    "opinion": "a personal belief or judgment",
    "evidence": "information that supports or checks a claim",
    "source": "where information comes from",
    "reliable": "able to be trusted because it is accurate or well supported",
    "credible": "believable because it comes from a trustworthy source",
    "bias": "an unfair preference that can affect a view or report",
    "verdict": "a final decision after checking the information",
    "assumption": "something accepted as true without enough proof",
    "counterclaim": "an opposing claim that responds to another claim",

    "summary": "a short version that gives the main message",
    "main point": "the most important idea in a text or talk",
    "key detail": "a small but important piece of supporting information",
    "own words": "language created by the writer instead of copied language",
    "paraphrase": "to express the same meaning using different words and structure",
    "copy-paste": "to reproduce wording directly without changing it",
    "concise": "short but still clear and complete",
    "synthesize": "to combine important ideas from more than one source",
    "objective": "based on evidence rather than personal feeling",

    "formal": "appropriate for academic or professional communication",
    "informal": "relaxed language used with friends or casual audiences",
    "polite": "respectful and considerate in language",
    "rude": "not respectful or appropriate",
    "academic tone": "clear, careful, and appropriate language for study",
    "audience": "the people who will read, listen to, or watch a message",
    "stance": "the writer's position or attitude toward an issue",
    "request": "a polite ask for information, help, or action",
    "appropriate / inappropriate": "suitable or unsuitable for the audience and purpose",
    "hedging": "careful language that avoids claims that are too strong",
    "register": "the level of formality chosen for a situation",

    "paragraph": "a group of sentences about one main point",
    "topic sentence": "a sentence that introduces the main point of a paragraph",
    "support": "evidence or explanation that develops an idea",
    "closing sentence": "a sentence that ends a paragraph by bringing the idea together",
    "link": "a word or sentence that connects ideas clearly",
    "irrelevant sentence": "a sentence that does not support the paragraph's topic",
    "cohesion": "the way sentences connect smoothly as one text",
    "transition": "a word or phrase that guides the reader between ideas",

    "problem": "a difficulty that needs attention or a solution",
    "reason": "an explanation for why something happens",
    "solution": "an action or plan that can solve a problem",
    "recommendation": "a suggested action based on information or evidence",
    "benefit": "a useful or positive result",
    "impact": "an effect or change caused by an action",
    "pitch": "a short presentation designed to persuade an audience",
    "feasible": "possible and practical to do",
    "priority": "the most important task or issue to deal with first",

    "data": "facts or numbers collected for analysis",
    "graph": "a visual display of data",
    "table": "data arranged in rows and columns",
    "increase": "to become greater in number or amount",
    "decrease": "to become smaller in number or amount",
    "trend": "a general pattern of change over time",
    "remain stable": "to stay at nearly the same level",
    "percentage": "a number out of one hundred",
    "compare": "to examine two or more things for similarities or differences",
    "significantly": "by a large or important amount",
    "gradually / slightly": "slowly over time or by a small amount",

    "subject line": "the short title of an email",
    "greeting": "the opening words used to address an email reader",
    "clarify": "to make something easier to understand",
    "follow-up": "a later message or action after an earlier one",
    "attachment": "a file sent with an email",
    "available / unavailable": "free to take part or not free to take part",
    "closing": "the final polite words in an email",
    "inconvenience": "a problem or difficulty caused to someone",
    "appreciate": "to be thankful for something someone does",

    "quote": "the exact words taken from a source",
    "cite": "to name a source in a text",
    "citation": "a reference that identifies the source of information",
    "reference": "full source information that helps readers find the original",
    "plagiarism": "using another person's words or ideas without proper credit",
    "disclosure": "a clear statement that reveals relevant use or information",
    "responsible use": "using a tool or information honestly and appropriately",
    "authorship": "who created a piece of writing or work",
    "attribution": "giving credit to the original creator or source",

    "lecture": "a formal talk that teaches a topic",
    "speaker": "the person giving a talk",
    "useful detail": "a supporting piece of information worth recording",
    "note-taking": "writing short useful information while listening or reading",
    "predict": "to make a careful guess about what may come next",
    "inference": "a conclusion based on clues rather than direct statement",
    "distractor": "an option designed to look possible but is not correct",

    "opening": "the first part of a presentation",
    "signpost": "a word or phrase that shows where a presentation is going",
    "outline": "a short plan showing the main parts of a talk",
    "conclusion": "the final part that brings the main ideas together",

    "issue": "an important problem or matter for discussion",
    "problem statement": "a clear description of the problem to be solved",
    "feedback": "comments that help improve work",
    "reflection": "thinking carefully about what was learned or done",
    "next step": "the action planned after the current task",
    "stakeholder": "a person or group affected by a decision or project",
    "sustainable": "able to continue without causing long-term harm"
  };

  const CHUNK_FUNCTIONS = {
    "my academic goal is": "to introduce a clear study aim",
    "my purpose is to": "to state why you are doing a task",
    "i want to improve": "to state a skill you want to develop",
    "every week, i will": "to state a regular action",
    "by the end of this course, i will": "to state a course-end target",

    "according to the notice,": "to report information from an official message",
    "submit by": "to state a deadline for sending work",
    "attendance is required.": "to state that being present is compulsory",
    "course requirement": "to name something a course demands",
    "check the timetable.": "to tell someone to look at a class schedule",
    "use context clues.": "to advise using nearby words to infer meaning",
    "the word family of": "to introduce related word forms",

    "the topic is": "to name the general subject",
    "the main idea is": "to state the central message",
    "the key point is": "to state an important idea",
    "this detail supports": "to show that a detail explains an idea",
    "this detail is irrelevant.": "to show that a detail does not fit the task",

    "because / since": "to show a cause",
    "however / although": "to show contrast",
    "therefore / as a result": "to show a result",
    "for example / such as": "to introduce an example",
    "first / then / finally": "to show a sequence",

    "the claim is": "to identify a statement that needs support",
    "the evidence shows": "to introduce information that supports a claim",
    "according to the source,": "to report information from a source",
    "this source is reliable because": "to explain why a source can be trusted",
    "there is not enough evidence.": "to state that support is missing",
    "the verdict is": "to give a decision after checking evidence",

    "in summary,": "to begin a concise restatement of main ideas",
    "the source explains": "to report the main message of a source",
    "the main point is": "to introduce the most important idea",
    "in my own words,": "to show that you are paraphrasing",
    "this detail is included because": "to explain why a detail matters",

    "i would like to": "to begin a polite formal statement",
    "could you please": "to make a polite request",
    "i would appreciate": "to politely show thanks or request consideration",
    "it may be": "to make a careful, not too strong claim",
    "would it be possible to": "to make a very polite request",
    "thank you for": "to express polite thanks",

    "this paragraph is about": "to state a paragraph's central topic",
    "for example,": "to introduce a supporting example",
    "this supports the idea that": "to connect evidence to an idea",
    "in conclusion,": "to close a paragraph or short argument",
    "this sentence does not belong because": "to explain irrelevance",

    "the problem is": "to introduce a difficulty that needs a response",
    "one reason is": "to give a cause or explanation",
    "the evidence suggests": "to introduce careful evidence-based reasoning",
    "one possible solution is": "to introduce a proposed action",
    "this may benefit": "to describe a possible positive result",
    "we recommend": "to present a suggested action",

    "the data show": "to introduce a careful description of data",
    "the figure increased": "to report a rise in a value",
    "it decreased from": "to report a fall between two values",
    "it remained stable at": "to report little or no change",
    "compared with": "to introduce a comparison",
    "this may suggest": "to make a cautious interpretation",

    "i am writing to": "to state an email purpose",
    "could you please clarify": "to politely ask for clearer information",
    "i would like to request": "to politely ask for something",
    "please find the attachment": "to tell the reader that a file is attached",
    "i am available on": "to state a time when you can meet or respond",
    "thank you for your consideration.": "to close an academic email politely",

    "according to": "to introduce information from a source",
    "this source should be cited.": "to state that a source needs credit",
    "in my own words,": "to signal paraphrasing rather than copying",
    "i used ai for": "to disclose how an AI tool was used",
    "i disclosed": "to state that relevant tool use was made clear",
    "the author should be acknowledged.": "to give credit to a creator",

    "the speaker’s main point is": "to state the central message of a talk",
    "one useful detail is": "to record a supporting detail from a talk",
    "according to the lecture,": "to report information from a lecture",
    "i predict the next point will be": "to make a listening prediction",
    "the speaker signals": "to identify language that guides a talk",

    "today, i would like to present": "to begin a presentation clearly",
    "first,": "to introduce the first main point",
    "next,": "to move to the next point",
    "thank you. any questions?": "to close a presentation and invite questions",

    "the main issue is": "to introduce the central problem",
    "the cause is": "to state why the issue happens",
    "our evidence suggests": "to connect evidence to a cautious conclusion",
    "the expected impact is": "to state a likely effect",
    "based on the feedback,": "to show that feedback shapes a decision",
    "our next step is": "to state what will happen next"
  };

  function describeTarget(target) {
    const cleaned = norm(target.term).replace(/…/g, "");
    const k = key(cleaned);
    if (DEFINITIONS[k]) return DEFINITIONS[k];
    if (CHUNK_FUNCTIONS[k]) return `a useful phrase ${CHUNK_FUNCTIONS[k]}`;
    if (target.band === "chunk") return `a useful academic sentence frame for ${target.mission}`;
    if (target.band === "stretch") return `a B1+ term connected to ${target.mission}`;
    if (target.band === "spiral") return `a revisited EAP term used again in ${target.mission}`;
    return `a key term for the ${target.mission} task`;
  }

  function chooseDistractors(target, allTargets, count = 3, seed = "") {
    const current = key(target.term);
    const preferred = allTargets.filter(item =>
      key(item.term) !== current &&
      item.band === target.band &&
      key(item.term) !== "purpose" // avoids over-using the most repeated anchor as a distractor
    );
    const fallback = allTargets.filter(item => key(item.term) !== current);
    const pool = preferred.length >= count ? preferred : fallback;
    const ranked = pool
      .map(item => ({
        item,
        rank: seededNumber(`${seed}|${item.id}|${item.term}`)
      }))
      .sort((a, b) => a.rank - b.rank)
      .map(row => row.item);

    const selected = [];
    const seen = new Set([current]);
    for (const item of ranked) {
      const k = key(item.term);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      selected.push(item);
      if (selected.length >= count) break;
    }
    return selected;
  }

  function createItem({
    id, sessionId, target, type, question, context, allTargets,
    skillTag, feedback, extraTargets = [], difficulty
  }) {
    const choices = [
      {
        text: target.term,
        correct: true,
        targetId: target.id
      },
      ...chooseDistractors(target, allTargets, 3, id).map(item => ({
        text: item.term,
        correct: false,
        targetId: item.id
      }))
    ];

    return {
      id,
      sessionId,
      sourceSessionId: sessionId,
      type,
      itemType: type,
      level: difficulty || levelFor(target, type),
      target: target.term,
      targetId: target.id,
      targetBand: target.band,
      targets: [target.term, ...extraTargets],
      question,
      context,
      choices,
      answerTerm: target.term,
      feedback: feedback || `“${target.term}” means ${describeTarget(target)}.`,
      quality: `core_${type}_${target.band}`,
      skillTag: skillTag || target.mission,
      stemGroup: question,
      coreAligned: true
    };
  }

  function definitionItem(sessionId, target, allTargets, index) {
    return createItem({
      id: `${sessionId}_DEF_${target.id}_${index}`,
      sessionId,
      target,
      type: "definition",
      question: "Which target best matches this meaning?",
      context: describeTarget(target),
      allTargets,
      feedback: `Correct. “${target.term}” means ${describeTarget(target)}.`
    });
  }

  function contextItem(sessionId, target, allTargets, index) {
    const session = MAP.sessions[sessionId];
    const type = target.band === "chunk" ? "context" : "application";
    const mission = session ? session.mission : "EAP";
    const context =
      target.band === "chunk"
        ? `Choose the phrase that is most suitable ${CHUNK_FUNCTIONS[key(target.term)] || `for the ${mission} task`}.`
        : `In a ${mission} task, choose the term that means ${describeTarget(target)}.`;

    return createItem({
      id: `${sessionId}_CTX_${target.id}_${index}`,
      sessionId,
      target,
      type,
      question: target.band === "chunk"
        ? "Choose the most appropriate academic phrase."
        : "Choose the best term for this academic situation.",
      context,
      allTargets,
      feedback: `Correct. “${target.term}” fits this ${mission} task because it means ${describeTarget(target)}.`
    });
  }

  function repairItem(sessionId, target, allTargets, index) {
    const session = MAP.sessions[sessionId];
    return createItem({
      id: `${sessionId}_REP_${target.id}_${index}`,
      sessionId,
      target,
      type: "repair",
      question: "Which target would repair this academic message?",
      context: `The message needs language for ${session ? session.skillFocus : "the task"}. Choose the term that means ${describeTarget(target)}.`,
      allTargets,
      difficulty: target.band === "stretch" ? "B1+" : "B1",
      feedback: `Correct. “${target.term}” repairs the message because it provides ${describeTarget(target)}.`
    });
  }

  /*
    Rich application tasks are deliberately short, contextual, and not literal
    translations. They give every Session a recognisable mission identity.
  */
  const RICH_APPLICATIONS = {
    S1: [
      ["A student writes: “I will study more.” Which revision is clearer and measurable?", "Every week, I will practise academic reading for 20 minutes.", "My academic goal is…", "weekly action"],
      ["Which term describes a study aim that can be checked at the end of a course?", "measurable", "target", "measurable"],
      ["A plan says: “Improve every skill perfectly tomorrow.” Which word shows why this plan is weak?", "realistic", "weekly action", "realistic"],
      ["Which phrase is best for stating an aim at the start of a Goal Passport?", "My academic goal is…", "academic goal", "My academic goal is…"] 
    ],
    S2: [
      ["A notice says: “Submit the reflection by Friday, 17:00.” Which word gives the latest submission time?", "deadline", "deadline", "deadline"],
      ["A student does not know the word “compulsory.” The notice also says “All students must attend.” Which strategy helps most?", "context clue", "context clue", "context clue"],
      ["Which pair is a common collocation in a campus notice?", "course requirement", "collocation", "Course requirement"],
      ["Which option shows a word family?", "submit, submission, submitted", "word family", "word family"]
    ],
    S3: [
      ["A paragraph gives one overall message and three examples. Which term names the overall message?", "main idea", "main idea", "main idea"],
      ["A sentence explains one example but does not cover the full paragraph. What is it?", "supporting detail", "supporting detail", "supporting detail"],
      ["Which detail should be removed from a brief about library opening hours?", "A student’s favourite colour", "irrelevant", "irrelevant"],
      ["What is the first question a reader should ask to find a text's purpose?", "Why was this text written?", "purpose", "purpose"]
    ],
    S4: [
      ["The notice says: “Attendance was low; therefore, the workshop was repeated.” Which relationship is shown?", "result", "therefore / as a result", "result"],
      ["“Although the task was difficult, the team completed it.” Which relationship is shown?", "contrast", "however / although", "contrast"],
      ["Which phrase introduces a specific illustration?", "for example / such as", "for example / such as", "for example / such as"],
      ["Which sequence is best for explaining a process?", "first / then / finally", "first / then / finally", "first / then / finally"]
    ],
    S5: [
      ["“Online learning always improves achievement.” What is this before evidence is provided?", "claim", "claim", "claim"],
      ["A report gives survey numbers from an official study. What can the numbers provide?", "evidence", "evidence", "evidence"],
      ["Which feature makes a source more credible for an assignment?", "It names an author and provides evidence.", "credible", "credible"],
      ["A post only presents one side of an issue and ignores opposing evidence. What may be present?", "bias", "bias", "bias"]
    ],
    S6: [
      ["Which option is a good summary of a long paragraph?", "A short statement of the main point in new language.", "summary", "summary"],
      ["Which action avoids copying a source word-for-word?", "paraphrase", "paraphrase", "paraphrase"],
      ["A writer adds “I think this is amazing” to a summary. What should be removed?", "opinion", "objective", "objective"],
      ["Which quality is important in a short academic summary?", "concise", "concise", "concise"]
    ],
    S7: [
      ["Which request is most suitable for a lecturer?", "Could you please clarify the deadline?", "polite", "Could you please…"],
      ["“Send it now.” is too direct for an academic email. What should improve?", "academic tone", "academic tone", "academic tone"],
      ["Which word describes the people receiving a message?", "audience", "audience", "audience"],
      ["Which language makes a claim more careful?", "It may be…", "hedging", "It may be…"]
    ],
    S8: [
      ["Which sentence should normally introduce the main point of a paragraph?", "topic sentence", "topic sentence", "topic sentence"],
      ["Which sentence type gives evidence or an example after the topic sentence?", "supporting detail", "supporting detail", "supporting detail"],
      ["What helps readers move smoothly from one idea to the next?", "transition", "transition", "transition"],
      ["A sentence discusses a different topic from every other sentence. What is it?", "irrelevant sentence", "irrelevant sentence", "irrelevant sentence"]
    ],
    S9: [
      ["A team identifies noisy study spaces and proposes quiet zones. What is the quiet-zone plan?", "solution", "solution", "solution"],
      ["Which phrase presents an evidence-based action?", "We recommend…", "We recommend…", "We recommend…"],
      ["Which term describes a likely effect of a proposal?", "impact", "impact", "impact"],
      ["A good solution must be possible with available time and resources. Which term fits?", "feasible", "feasible", "feasible"]
    ],
    S10: [
      ["A graph rises from 20% to 45%. Which verb fits?", "increase", "increase", "increase"],
      ["A value stays close to 60% for three months. Which phrase fits?", "remain stable", "remain stable", "remain stable"],
      ["Which phrase gives a careful interpretation rather than an overclaim?", "This may suggest…", "This may suggest…", "This may suggest…"],
      ["A change from 50% to 52% is likely described as what?", "slightly", "gradually / slightly", "gradually / slightly"]
    ],
    S11: [
      ["Which element tells the reader the email topic before opening it?", "subject line", "subject line", "subject line"],
      ["Which phrase politely asks for clearer information?", "Could you please clarify…", "Could you please clarify…", "Could you please clarify…"],
      ["Which sentence tells a lecturer that a file is included?", "Please find the attachment…", "Please find the attachment…", "Please find the attachment…"],
      ["Which closing is most suitable for an academic request?", "Thank you for your consideration.", "closing", "Thank you for your consideration."]
    ],
    S12: [
      ["Using the exact words from a journal article requires what?", "quote", "quote", "quote"],
      ["Restating an author’s idea in different language is called what?", "paraphrase", "paraphrase", "paraphrase"],
      ["What is the problem when a writer uses a source without credit?", "plagiarism", "plagiarism", "plagiarism"],
      ["What should a student do after using AI to outline a draft?", "disclosure", "disclosure", "disclosure"]
    ],
    S13: [
      ["What should a listener record first in a short academic lecture?", "main point", "main point", "main point"],
      ["Which term describes a useful piece of supporting information?", "useful detail", "useful detail", "useful detail"],
      ["A speaker says “First, I will explain…” What has the speaker used?", "signal word", "signal word", "signal word"],
      ["What is an informed guess about the next lecture point called?", "predict", "predict", "predict"]
    ],
    S14: [
      ["Which phrase clearly begins a presentation?", "Today, I would like to present…", "Today, I would like to present…", "Today, I would like to present…"],
      ["Which feature tells the audience where the talk is going?", "signpost", "signpost", "signpost"],
      ["Which part briefly shows the main sections before a talk develops?", "outline", "outline", "outline"],
      ["Which phrase invites questions after the final point?", "Thank you. Any questions?", "Thank you. Any questions?", "Thank you. Any questions?"]
    ],
    S15: [
      ["Which item names the central problem in a solution brief?", "problem statement", "problem statement", "problem statement"],
      ["Which phrase connects data to a cautious recommendation?", "Our evidence suggests…", "Our evidence suggests…", "Our evidence suggests…"],
      ["Which item tells what the team will do after feedback?", "next step", "next step", "next step"],
      ["Which word describes a solution that can continue without long-term harm?", "sustainable", "sustainable", "sustainable"]
    ]
  };

  function findTarget(sessionId, term) {
    const targets = window.getEapCoreSessionTargets(sessionId, { unique: true }) || [];
    const needle = key(term);
    return targets.find(target => key(target.term) === needle) ||
      targets.find(target => key(target.term).includes(needle) || needle.includes(key(target.term))) ||
      null;
  }

  function richApplicationItems(sessionId, allTargets) {
    const rows = RICH_APPLICATIONS[sessionId] || [];
    const session = MAP.sessions[sessionId];
    return rows.map((row, index) => {
      const [question, correctText, targetTerm, feedbackTerm] = row;
      const target = findTarget(sessionId, targetTerm) || findTarget(sessionId, correctText);
      if (!target) return null;

      const item = createItem({
        id: `${sessionId}_RICH_${String(index + 1).padStart(2, "0")}`,
        sessionId,
        target,
        type: "application",
        question,
        context: session ? `Mission context: ${session.mission}` : "",
        allTargets,
        difficulty: index % 2 === 0 ? "B1" : "B1+",
        feedback: `Correct. The key target is “${feedbackTerm || target.term}”. This fits the ${session ? session.mission : "EAP"} mission.`
      });

      // The rich task can have a custom correct text different from the metadata target.
      item.choices[0].text = correctText;
      item.answerTerm = correctText;
      item.target = target.term;
      item.targets = [target.term];
      return item;
    }).filter(Boolean);
  }

  function bossTitle(bossId) {
    const boss = window.getEapCoreBoss(bossId);
    return boss ? boss.title : bossId;
  }

  function bossItems(bossId) {
    const boss = window.getEapCoreBoss(bossId);
    if (!boss) return [];

    const sourceSessions = boss.sourceSessions || [];
    const allBossTargets = window.getEapCoreBossTargets(bossId, { unique: true }) || [];
    const rows = [];

    sourceSessions.forEach((sourceSessionId, sourceIndex) => {
      const sourceTargets = window.getEapCoreSessionTargets(sourceSessionId, { unique: true }) || [];
      const selected = sourceTargets
        .filter(target => target.band === "core" || target.band === "chunk" || target.band === "stretch")
        .sort((a, b) => seededNumber(`${bossId}|${a.id}`) - seededNumber(`${bossId}|${b.id}`))
        .slice(0, bossId === "BG5" ? 8 : 6);

      selected.forEach((target, index) => {
        const item = createItem({
          id: `${bossId}_BOSS_${sourceSessionId}_${String(index + 1).padStart(2, "0")}`,
          sessionId: bossId,
          target,
          type: "boss",
          question: `Boss case · ${bossTitle(bossId)}: choose the target that best solves this step.`,
          context: `The case combines ${sourceSessions.join(", ")}. You need a term that means ${describeTarget(target)}.`,
          allTargets: allBossTargets,
          difficulty: index % 3 === 0 ? "B1+" : "B1",
          feedback: `Correct. “${target.term}” comes from ${sourceSessionId} and belongs in this integrated boss case.`,
          extraTargets: [sourceSessionId]
        });
        item.sourceSessionId = sourceSessionId;
        item.skillTag = `${bossTitle(bossId)} • Integrated Application`;
        rows.push(item);
      });
    });

    return rows;
  }

  function buildSessionItems(sessionId) {
    const targets = window.getEapCoreSessionTargets(sessionId, { unique: true }) || [];
    const items = [];

    targets.forEach((target, index) => {
      items.push(definitionItem(sessionId, target, targets, index + 1));
      items.push(contextItem(sessionId, target, targets, index + 1));

      if (target.band === "core" || target.band === "stretch") {
        items.push(repairItem(sessionId, target, targets, index + 1));
      }
    });

    items.push(...richApplicationItems(sessionId, targets));
    return items;
  }

  const bySession = {};
  Object.keys(MAP.sessions).forEach(sessionId => {
    bySession[sessionId] = buildSessionItems(sessionId);
  });

  BOSS_IDS.forEach(bossId => {
    bySession[bossId] = bossItems(bossId);
  });

  const allItems = Object.values(bySession).flat();
  const summary = Object.fromEntries(
    Object.entries(bySession).map(([sessionId, rows]) => [sessionId, rows.length])
  );

  const BANK = {
    version: VERSION,
    group: "122",
    coreAligned: true,
    targetTotal: MAP.targetTotal,
    itemTotal: allItems.length,
    sessionOrder: SESSION_ORDER,
    bossIds: BOSS_IDS,
    bySession,
    items: allItems,
    summary
  };

  function getItems(sessionId, options = {}) {
    const sid = norm(sessionId).toUpperCase();
    const rows = Array.isArray(BANK.bySession[sid]) ? BANK.bySession[sid] : [];
    const levels = Array.isArray(options.levels) && options.levels.length
      ? new Set(options.levels)
      : null;
    const types = Array.isArray(options.types) && options.types.length
      ? new Set(options.types)
      : null;

    return clone(rows.filter(item =>
      (!levels || levels.has(item.level)) &&
      (!types || types.has(item.type))
    ));
  }

  function inspect() {
    const targetCounts = typeof window.getEapCoreTargetCounts === "function"
      ? window.getEapCoreTargetCounts()
      : {};
    return {
      version: VERSION,
      targetCounts,
      items: summary,
      totalItems: allItems.length,
      coreAligned: true
    };
  }

  window.EAP_CORE_QUESTION_BANK = BANK;
  window.getEapCoreBankItems = getItems;
  window.inspectEapCoreQuestionBank = inspect;

  /*
    v190 uses this guard before it removes a distractor on Hint 3.
    The v192 controller renders data-correct on every choice, so this is safe.
  */
  window.EAP_CORE_BANK_ALIGNED = true;

  console.info("[EAP Word Quest] Core-aligned question bank ready", inspect());
})();
