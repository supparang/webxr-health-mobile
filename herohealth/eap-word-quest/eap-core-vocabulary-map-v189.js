/* =========================================================
   EAP Word Quest • Core Vocabulary Map
   File: /herohealth/eap-word-quest/eap-core-vocabulary-map-v189.js
   Version: v1.9.0-CORE-VOCABULARY-MAP-122

   Single source of truth for:
   - Main EAP Core Sessions S1–S15
   - EAP Word Quest vocabulary targets
   - AI Help / AI Difficulty / AI Prediction
   - Boss Gate source pools

   Target total: 290
========================================================= */

(() => {
  "use strict";

  const VERSION = "v1.9.0-CORE-VOCABULARY-MAP-122";
  const GROUP = "122";

  const SESSIONS = {
  "S1": {
    "title": "Mission Passport",
    "arcId": "ARC1",
    "arcTitle": "Foundation Arc",
    "mission": "Academic Mindset",
    "skillFocus": "set an academic goal, state a purpose, and plan a weekly action",
    "core": [
      "academic goal",
      "purpose",
      "skill",
      "improve",
      "achieve",
      "progress",
      "weekly action",
      "target"
    ],
    "chunks": [
      "My academic goal is…",
      "My purpose is to…",
      "I want to improve…",
      "Every week, I will…",
      "By the end of this course, I will…"
    ],
    "spiral": [
      "plan",
      "practice",
      "result"
    ],
    "stretch": [
      "realistic",
      "measurable"
    ]
  },
  "S2": {
    "title": "UK Campus Decoder",
    "arcId": "ARC1",
    "arcTitle": "Foundation Arc",
    "mission": "Academic Vocabulary in Context",
    "skillFocus": "decode campus notices and infer meaning from context",
    "core": [
      "notice",
      "course",
      "timetable",
      "deadline",
      "requirement",
      "submit",
      "attendance",
      "context clue",
      "collocation",
      "word family"
    ],
    "chunks": [
      "According to the notice,…",
      "Submit by…",
      "Attendance is required.",
      "Course requirement",
      "Check the timetable.",
      "Use context clues.",
      "The word family of…"
    ],
    "spiral": [
      "goal",
      "purpose",
      "plan"
    ],
    "stretch": [
      "compulsory",
      "optional"
    ]
  },
  "S3": {
    "title": "The Broken Brief",
    "arcId": "ARC1",
    "arcTitle": "Foundation Arc",
    "mission": "Main Idea",
    "skillFocus": "separate the main idea from supporting and irrelevant details",
    "core": [
      "topic",
      "main idea",
      "key point",
      "supporting detail",
      "relevant",
      "irrelevant",
      "purpose",
      "brief"
    ],
    "chunks": [
      "The topic is…",
      "The main idea is…",
      "The key point is…",
      "This detail supports…",
      "This detail is irrelevant."
    ],
    "spiral": [
      "notice",
      "context clue",
      "purpose"
    ],
    "stretch": [
      "central idea",
      "implied meaning"
    ]
  },
  "S4": {
    "title": "Signal Relay",
    "arcId": "ARC2",
    "arcTitle": "Evidence Arc",
    "mission": "Keywords & Signal Words",
    "skillFocus": "read cause, contrast, result, example and sequence relationships",
    "core": [
      "keyword",
      "cause",
      "contrast",
      "result",
      "example",
      "sequence",
      "signal word",
      "relationship"
    ],
    "chunks": [
      "because / since",
      "however / although",
      "therefore / as a result",
      "for example / such as",
      "first / then / finally"
    ],
    "spiral": [
      "main idea",
      "supporting detail",
      "purpose"
    ],
    "stretch": [
      "consequently",
      "in contrast"
    ]
  },
  "S5": {
    "title": "Evidence Court",
    "arcId": "ARC2",
    "arcTitle": "Evidence Arc",
    "mission": "Critical Reading",
    "skillFocus": "judge claims, evidence, reliability and bias",
    "core": [
      "claim",
      "fact",
      "opinion",
      "evidence",
      "source",
      "reliable",
      "credible",
      "bias",
      "verdict"
    ],
    "chunks": [
      "The claim is…",
      "The evidence shows…",
      "According to the source,…",
      "This source is reliable because…",
      "There is not enough evidence.",
      "The verdict is…"
    ],
    "spiral": [
      "main idea",
      "supporting detail",
      "however"
    ],
    "stretch": [
      "assumption",
      "counterclaim"
    ]
  },
  "S6": {
    "title": "Summary Press Room",
    "arcId": "ARC2",
    "arcTitle": "Evidence Arc",
    "mission": "Summarising",
    "skillFocus": "summarise a source concisely in own words",
    "core": [
      "summary",
      "main point",
      "key detail",
      "own words",
      "paraphrase",
      "source",
      "copy-paste",
      "concise"
    ],
    "chunks": [
      "In summary,…",
      "The source explains…",
      "The main point is…",
      "In my own words,…",
      "This detail is included because…"
    ],
    "spiral": [
      "claim",
      "evidence",
      "purpose"
    ],
    "stretch": [
      "synthesize",
      "objective"
    ]
  },
  "S7": {
    "title": "Tone Switchboard",
    "arcId": "ARC3",
    "arcTitle": "Writing Arc",
    "mission": "Academic Tone",
    "skillFocus": "select formal, polite and audience-appropriate language",
    "core": [
      "formal",
      "informal",
      "polite",
      "rude",
      "academic tone",
      "audience",
      "stance",
      "request",
      "appropriate / inappropriate"
    ],
    "chunks": [
      "I would like to…",
      "Could you please…",
      "I would appreciate…",
      "It may be…",
      "Would it be possible to…",
      "Thank you for…"
    ],
    "spiral": [
      "purpose",
      "source",
      "concise"
    ],
    "stretch": [
      "hedging",
      "register"
    ]
  },
  "S8": {
    "title": "Paragraph Repair Lab",
    "arcId": "ARC3",
    "arcTitle": "Writing Arc",
    "mission": "Paragraph Structure",
    "skillFocus": "repair paragraph structure and identify support",
    "core": [
      "paragraph",
      "topic sentence",
      "supporting detail",
      "support",
      "example",
      "closing sentence",
      "link",
      "irrelevant sentence"
    ],
    "chunks": [
      "This paragraph is about…",
      "For example,…",
      "This supports the idea that…",
      "In conclusion,…",
      "This sentence does not belong because…"
    ],
    "spiral": [
      "main idea",
      "evidence",
      "academic tone"
    ],
    "stretch": [
      "cohesion",
      "transition"
    ]
  },
  "S9": {
    "title": "Campus Solution Pitch",
    "arcId": "ARC3",
    "arcTitle": "Writing Arc",
    "mission": "Paragraph Writing",
    "skillFocus": "propose a solution with reason, evidence and impact",
    "core": [
      "problem",
      "reason",
      "evidence",
      "example",
      "solution",
      "recommendation",
      "benefit",
      "impact",
      "pitch"
    ],
    "chunks": [
      "The problem is…",
      "One reason is…",
      "The evidence suggests…",
      "One possible solution is…",
      "This may benefit…",
      "We recommend…"
    ],
    "spiral": [
      "topic sentence",
      "support",
      "audience"
    ],
    "stretch": [
      "feasible",
      "priority"
    ]
  },
  "S10": {
    "title": "Data Detective",
    "arcId": "ARC4",
    "arcTitle": "Professional Arc",
    "mission": "Data Description",
    "skillFocus": "describe trends cautiously and compare data",
    "core": [
      "data",
      "graph",
      "table",
      "increase",
      "decrease",
      "trend",
      "remain stable",
      "percentage",
      "compare"
    ],
    "chunks": [
      "The data show…",
      "The figure increased…",
      "It decreased from… to…",
      "It remained stable at…",
      "Compared with…",
      "This may suggest…"
    ],
    "spiral": [
      "evidence",
      "result",
      "source"
    ],
    "stretch": [
      "significantly",
      "gradually / slightly"
    ]
  },
  "S11": {
    "title": "International Help Desk",
    "arcId": "ARC4",
    "arcTitle": "Professional Arc",
    "mission": "Academic Email",
    "skillFocus": "write a clear, polite academic email",
    "core": [
      "subject line",
      "greeting",
      "purpose",
      "request",
      "clarify",
      "follow-up",
      "attachment",
      "available / unavailable",
      "closing"
    ],
    "chunks": [
      "I am writing to…",
      "Could you please clarify…",
      "I would like to request…",
      "Please find the attachment…",
      "I am available on…",
      "Thank you for your consideration."
    ],
    "spiral": [
      "formal",
      "audience",
      "deadline"
    ],
    "stretch": [
      "inconvenience",
      "appreciate"
    ]
  },
  "S12": {
    "title": "Integrity Escape Room",
    "arcId": "ARC4",
    "arcTitle": "Professional Arc",
    "mission": "Citation & Ethics",
    "skillFocus": "cite, paraphrase and disclose responsible use of AI",
    "core": [
      "quote",
      "paraphrase",
      "cite",
      "citation",
      "source",
      "reference",
      "plagiarism",
      "disclosure",
      "responsible use"
    ],
    "chunks": [
      "According to…",
      "This source should be cited.",
      "In my own words,…",
      "I used AI for…",
      "I disclosed…",
      "The author should be acknowledged."
    ],
    "spiral": [
      "evidence",
      "formal",
      "claim"
    ],
    "stretch": [
      "authorship",
      "attribution"
    ]
  },
  "S13": {
    "title": "Mini Lecture Heist",
    "arcId": "ARC5",
    "arcTitle": "Global Arc",
    "mission": "Academic Listening",
    "skillFocus": "capture a speaker's main point and useful detail",
    "core": [
      "lecture",
      "speaker",
      "main point",
      "keyword",
      "useful detail",
      "note-taking",
      "example",
      "predict"
    ],
    "chunks": [
      "The speaker’s main point is…",
      "One useful detail is…",
      "According to the lecture,…",
      "I predict the next point will be…",
      "The speaker signals…"
    ],
    "spiral": [
      "main idea",
      "signal word",
      "summary"
    ],
    "stretch": [
      "inference",
      "distractor"
    ]
  },
  "S14": {
    "title": "Presentation Under Pressure",
    "arcId": "ARC5",
    "arcTitle": "Global Arc",
    "mission": "Academic Presentation",
    "skillFocus": "structure a short presentation and respond to an audience",
    "core": [
      "opening",
      "signpost",
      "outline",
      "evidence",
      "example",
      "closing",
      "conclusion",
      "audience"
    ],
    "chunks": [
      "Today, I would like to present…",
      "First,…",
      "Next,…",
      "In conclusion,…",
      "Thank you. Any questions?"
    ],
    "spiral": [
      "purpose",
      "recommendation",
      "impact"
    ],
    "stretch": [
      "clarify",
      "transition"
    ]
  },
  "S15": {
    "title": "Global Solution Summit",
    "arcId": "ARC5",
    "arcTitle": "Global Arc",
    "mission": "Final Integration",
    "skillFocus": "form a solution brief from issue through next step",
    "core": [
      "issue",
      "problem statement",
      "cause",
      "evidence",
      "solution",
      "recommendation",
      "impact",
      "feedback",
      "reflection",
      "next step"
    ],
    "chunks": [
      "The main issue is…",
      "The cause is…",
      "Our evidence suggests…",
      "We recommend…",
      "The expected impact is…",
      "Based on the feedback,…",
      "Our next step is…"
    ],
    "spiral": [
      "audience",
      "conclusion",
      "source"
    ],
    "stretch": [
      "stakeholder",
      "sustainable"
    ]
  }
};

  const BOSS_GATES = {
    BG1: {
      title: "Global Learner Clearance",
      arcId: "ARC1",
      sourceSessions: ["S1","S2","S3"],
      questionCount: 18,
      passThreshold: 70,
      mission: "use academic goals, campus vocabulary, and main-idea vocabulary in new situations"
    },
    BG2: {
      title: "Evidence Court Live",
      arcId: "ARC2",
      sourceSessions: ["S4","S5","S6"],
      questionCount: 18,
      passThreshold: 70,
      mission: "read relationships, evaluate evidence, and summarise in own words"
    },
    BG3: {
      title: "Academic Makeover Studio",
      arcId: "ARC3",
      sourceSessions: ["S7","S8","S9"],
      questionCount: 18,
      passThreshold: 70,
      mission: "repair tone and paragraph structure, then pitch an evidence-based solution"
    },
    BG4: {
      title: "International Help Desk Crisis",
      arcId: "ARC4",
      sourceSessions: ["S10","S11","S12"],
      questionCount: 18,
      passThreshold: 70,
      mission: "describe data carefully, write a polite email, and use sources responsibly"
    },
    BG5: {
      title: "Human Override Summit",
      arcId: "ARC5",
      sourceSessions: ["S13","S14","S15"],
      questionCount: 24,
      passThreshold: 75,
      mission: "integrate listening, presentation, evidence, recommendation, reflection, and next steps"
    }
  };

  const SESSION_ORDER = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  function norm(value){
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function key(value){
    return norm(value)
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/…/g, "")
      .replace(/[^a-z0-9+\s/.-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function toTargets(sessionId){
    const session = SESSIONS[sessionId];
    if(!session) return [];

    const targetGroups = [
      ["core", session.core || []],
      ["chunk", session.chunks || []],
      ["spiral", session.spiral || []],
      ["stretch", session.stretch || []]
    ];

    return targetGroups.flatMap(([band, terms]) => terms.map((term, index) => ({
      id: `${sessionId}-${band}-${String(index + 1).padStart(2, "0")}`,
      sessionId,
      term,
      normalized: key(term),
      band,
      level:
        band === "stretch" ? "B1+" :
        band === "chunk" ? "A2+–B1" :
        band === "spiral" ? "A2+–B1" :
        "A2+–B1",
      title: session.title,
      mission: session.mission,
      skillFocus: session.skillFocus
    })));
  }

  function uniqueByTerm(targets){
    const seen = new Set();
    return targets.filter(target => {
      const k = key(target.term);
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function getSession(sessionId){
    return SESSIONS[norm(sessionId)] ? clone(SESSIONS[norm(sessionId)]) : null;
  }

  function getSessionTargets(sessionId, options = {}){
    const targets = toTargets(norm(sessionId));
    const allowedBands = Array.isArray(options.bands) && options.bands.length
      ? new Set(options.bands)
      : null;

    const result = allowedBands
      ? targets.filter(target => allowedBands.has(target.band))
      : targets;

    return options.unique ? uniqueByTerm(result) : result;
  }

  function getBoss(bossId){
    return BOSS_GATES[norm(bossId)] ? clone(BOSS_GATES[norm(bossId)]) : null;
  }

  function getBossTargets(bossId, options = {}){
    const boss = BOSS_GATES[norm(bossId)];
    if(!boss) return [];

    const targets = boss.sourceSessions.flatMap(sessionId => toTargets(sessionId));
    return options.unique ? uniqueByTerm(targets) : targets;
  }

  function getTargetCounts(){
    const counts = {};

    Object.keys(SESSIONS).forEach(sessionId => {
      counts[sessionId] = getSessionTargets(sessionId).length;
    });

    counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    return counts;
  }

  function findTarget(term, scope = "ALL"){
    const needle = key(term);
    if(!needle) return null;

    const sessions =
      /^BG[1-5]$/i.test(scope)
        ? getBossTargets(scope, { unique:true })
        : scope !== "ALL"
          ? getSessionTargets(scope, { unique:true })
          : Object.keys(SESSIONS).flatMap(sessionId => getSessionTargets(sessionId, { unique:true }));

    const exact = sessions.find(target => target.normalized === needle);
    if(exact) return clone(exact);

    const partial = sessions.find(target => {
      const targetKey = target.normalized;
      return targetKey.includes(needle) || needle.includes(targetKey);
    });

    return partial ? clone(partial) : null;
  }

  const MAP = {
    version: VERSION,
    group: GROUP,
    course: "English for Academic Purposes",
    cohort: "Year 2",
    targetTotal: 290,
    sessionOrder: SESSION_ORDER,
    sessions: SESSIONS,
    bossGates: BOSS_GATES
  };

  window.EAP_CORE_VOCAB_MAP = MAP;
  window.getEapCoreSession = getSession;
  window.getEapCoreSessionTargets = getSessionTargets;
  window.getEapCoreBoss = getBoss;
  window.getEapCoreBossTargets = getBossTargets;
  window.getEapCoreTargetCounts = getTargetCounts;
  window.findEapCoreTarget = findTarget;

  console.info("[EAP Word Quest] Core Vocabulary Map ready", {
    version: VERSION,
    targetTotal: getTargetCounts().total,
    counts: getTargetCounts()
  });
})();
