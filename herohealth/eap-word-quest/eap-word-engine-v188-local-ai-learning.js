/* =========================================================
   EAP Word Quest • Local AI Learning
   File: /herohealth/eap-word-quest/eap-word-engine-v188-local-ai-learning.js
   Version: v1.8.8-LOCAL-AI-HELP-PREDICTION-DIFFICULTY

   Role:
   - AI Help 3 levels per question
   - AI Prediction
   - AI Difficulty A2 → A2+ → B1 → B1+
   - Enrich summary + learning logs
   - Local only, no API / no Google Sheets
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.8-LOCAL-AI-HELP-PREDICTION-DIFFICULTY";

  if(window.__EAP_WORD_QUEST_V188_LOCAL_AI__){
    console.info("[EAP Word Quest] v188 local AI already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V188_LOCAL_AI__ = true;

  const MAX_HINT_PER_QUESTION = 3;

  const SESSION_TITLES = {
    S1:"Academic Profile",
    S2:"Project Introduction",
    S3:"Project Rationale & Target Users",
    BG1:"Vocabulary Boss 1",

    S4:"Tech Jobs / Careers",
    S5:"Workplace Communication",
    S6:"Team Progress & Responsibility",
    BG2:"Vocabulary Boss 2",

    S7:"Professional Email",
    S8:"Meeting / Discussion",
    S9:"Discussion Summary & Action Items",
    BG3:"Vocabulary Boss 3",

    S10:"System Explanation",
    S11:"Bug Report / Problem Solving",
    S12:"User Guide / Technical Instruction",
    BG4:"Vocabulary Boss 4",

    S13:"AI Report / Academic Summary",
    S14:"CV / Interview / Pitch",
    S15:"Final Project Presentation & Reflection",
    BG5:"Final Boss Gate"
  };

  const GLOSSARY = [
    { term:"major", th:["สาขา","วิชาเอก"], clue:"field of study", domain:"academic profile", pos:"noun" },
    { term:"background", th:["พื้นฐาน","ภูมิหลัง"], clue:"previous experience or study history", domain:"academic profile", pos:"noun" },
    { term:"skill", th:["ทักษะ"], clue:"ability to do something", domain:"academic profile", pos:"noun" },
    { term:"strength", th:["จุดแข็ง"], clue:"something a student can do well", domain:"academic profile", pos:"noun" },
    { term:"interest", th:["ความสนใจ"], clue:"topic or area a student likes to learn", domain:"academic profile", pos:"noun" },
    { term:"goal", th:["เป้าหมาย"], clue:"something a student wants to achieve", domain:"academic profile", pos:"noun" },

    { term:"project", th:["โครงการ","โปรเจกต์"], clue:"planned work with a goal", domain:"project introduction", pos:"noun" },
    { term:"objective", th:["วัตถุประสงค์","เป้าหมายของงาน"], clue:"specific goal of a project", domain:"project introduction", pos:"noun" },
    { term:"feature", th:["ฟีเจอร์","คุณลักษณะ"], clue:"function or important part of a product/system", domain:"project introduction", pos:"noun" },
    { term:"user", th:["ผู้ใช้"], clue:"person who uses a product or system", domain:"project introduction", pos:"noun" },
    { term:"problem", th:["ปัญหา"], clue:"issue that needs a solution", domain:"project introduction", pos:"noun" },
    { term:"solution", th:["วิธีแก้","แนวทางแก้ไข"], clue:"way to solve a problem", domain:"project introduction", pos:"noun" },
    { term:"benefit", th:["ประโยชน์"], clue:"good result or advantage", domain:"project rationale", pos:"noun" },

    { term:"rationale", th:["เหตุผล","หลักการและเหตุผล"], clue:"reason why a project is needed", domain:"project rationale", pos:"noun" },
    { term:"target user", th:["กลุ่มเป้าหมาย","ผู้ใช้เป้าหมาย"], clue:"main group of people the project is designed for", domain:"project rationale", pos:"noun phrase" },
    { term:"need", th:["ความต้องการ","ความจำเป็น"], clue:"something users require", domain:"project rationale", pos:"noun" },
    { term:"scope", th:["ขอบเขต"], clue:"what is included and not included", domain:"project rationale", pos:"noun" },

    { term:"career", th:["อาชีพ"], clue:"job path or profession", domain:"career", pos:"noun" },
    { term:"role", th:["บทบาท"], clue:"responsibility or function in a team", domain:"teamwork", pos:"noun" },
    { term:"developer", th:["นักพัฒนา"], clue:"person who builds software or systems", domain:"career", pos:"noun" },
    { term:"designer", th:["นักออกแบบ"], clue:"person who plans interface or visual design", domain:"career", pos:"noun" },
    { term:"analyst", th:["นักวิเคราะห์"], clue:"person who studies requirements or data", domain:"career", pos:"noun" },

    { term:"request", th:["คำขอ","ขอ"], clue:"ask for something politely", domain:"workplace communication", pos:"noun/verb" },
    { term:"clarify", th:["ชี้แจง","ทำให้ชัดเจน"], clue:"make something easier to understand", domain:"workplace communication", pos:"verb" },
    { term:"update", th:["อัปเดต","แจ้งความคืบหน้า"], clue:"new information about progress", domain:"workplace communication", pos:"noun/verb" },
    { term:"confirm", th:["ยืนยัน"], clue:"say that something is correct or agreed", domain:"workplace communication", pos:"verb" },
    { term:"explain", th:["อธิบาย"], clue:"make an idea clear", domain:"workplace communication", pos:"verb" },

    { term:"progress", th:["ความก้าวหน้า","ความคืบหน้า"], clue:"development or movement toward completion", domain:"progress report", pos:"noun" },
    { term:"responsibility", th:["ความรับผิดชอบ","หน้าที่"], clue:"task or duty someone must do", domain:"progress report", pos:"noun" },
    { term:"timeline", th:["กำหนดเวลา","ลำดับเวลา"], clue:"schedule of work over time", domain:"progress report", pos:"noun" },
    { term:"contribution", th:["การมีส่วนร่วม","ผลงานที่มีส่วนร่วม"], clue:"work added by a person to a project", domain:"progress report", pos:"noun" },
    { term:"teamwork", th:["การทำงานเป็นทีม"], clue:"working together as a group", domain:"teamwork", pos:"noun" },

    { term:"subject", th:["หัวข้ออีเมล","หัวเรื่อง"], clue:"email title line", domain:"academic email", pos:"noun" },
    { term:"attachment", th:["ไฟล์แนบ"], clue:"file sent with an email", domain:"academic email", pos:"noun" },
    { term:"deadline", th:["กำหนดส่ง"], clue:"final time or date to finish work", domain:"academic email", pos:"noun" },
    { term:"inquiry", th:["การสอบถาม","คำถามสอบถาม"], clue:"formal question or request for information", domain:"academic email", pos:"noun" },
    { term:"response", th:["การตอบกลับ","คำตอบ"], clue:"reply to a message or request", domain:"academic email", pos:"noun" },

    { term:"agenda", th:["วาระการประชุม"], clue:"list of topics for a meeting", domain:"meeting", pos:"noun" },
    { term:"opinion", th:["ความคิดเห็น"], clue:"what someone thinks about a topic", domain:"discussion", pos:"noun" },
    { term:"suggest", th:["เสนอแนะ"], clue:"give an idea for others to consider", domain:"discussion", pos:"verb" },
    { term:"decision", th:["การตัดสินใจ"], clue:"choice made after discussion", domain:"meeting", pos:"noun" },
    { term:"concern", th:["ข้อกังวล","ความกังวล"], clue:"worry or issue that needs attention", domain:"discussion", pos:"noun" },
    { term:"agreement", th:["ข้อตกลง","ความเห็นตรงกัน"], clue:"shared decision or accepted idea", domain:"discussion", pos:"noun" },

    { term:"summary", th:["สรุป","บทสรุป"], clue:"short version of main points", domain:"summary", pos:"noun" },
    { term:"summarize", th:["สรุป"], clue:"write or say the main points briefly", domain:"summary", pos:"verb" },
    { term:"action item", th:["งานที่ต้องทำหลังประชุม","สิ่งที่ต้องทำหลังประชุม"], clue:"task assigned after a meeting", domain:"meeting summary", pos:"noun phrase" },
    { term:"follow-up", th:["การติดตามผล","ติดตามผล"], clue:"action after the first meeting/message", domain:"meeting summary", pos:"noun/adjective" },
    { term:"conclusion", th:["ข้อสรุป"], clue:"final idea after discussion", domain:"summary", pos:"noun" },

    { term:"function", th:["ฟังก์ชัน","หน้าที่ของระบบ"], clue:"what a system or feature does", domain:"system explanation", pos:"noun" },
    { term:"process", th:["กระบวนการ","ขั้นตอน"], clue:"series of steps", domain:"system explanation", pos:"noun" },
    { term:"input", th:["ข้อมูลนำเข้า"], clue:"data entered into a system", domain:"system explanation", pos:"noun" },
    { term:"output", th:["ผลลัพธ์","ข้อมูลส่งออก"], clue:"result produced by a system", domain:"system explanation", pos:"noun" },
    { term:"interface", th:["ส่วนติดต่อผู้ใช้","หน้าจอใช้งาน"], clue:"part where users interact with a system", domain:"system explanation", pos:"noun" },
    { term:"workflow", th:["ขั้นตอนการทำงาน"], clue:"ordered process of work", domain:"system explanation", pos:"noun" },

    { term:"issue", th:["ประเด็นปัญหา","ปัญหาที่พบ"], clue:"problem or matter that needs attention", domain:"bug report", pos:"noun" },
    { term:"bug", th:["บั๊ก","ข้อผิดพลาดของโปรแกรม"], clue:"error in software", domain:"bug report", pos:"noun" },
    { term:"reproduce", th:["ทำซ้ำเพื่อให้เกิดปัญหา","จำลองปัญหา"], clue:"make the same problem happen again", domain:"bug report", pos:"verb" },
    { term:"error", th:["ข้อผิดพลาด"], clue:"mistake or failure in a system", domain:"bug report", pos:"noun" },
    { term:"fix", th:["แก้ไข"], clue:"repair or correct a problem", domain:"bug report", pos:"verb/noun" },

    { term:"instruction", th:["คำแนะนำ","คำสั่ง"], clue:"direction that tells users what to do", domain:"user guide", pos:"noun" },
    { term:"requirement", th:["ข้อกำหนด","ความต้องการของระบบ"], clue:"needed condition or feature", domain:"user guide", pos:"noun" },
    { term:"step", th:["ขั้นตอน"], clue:"one action in a process", domain:"user guide", pos:"noun" },
    { term:"configure", th:["ตั้งค่า"], clue:"set up options or settings", domain:"user guide", pos:"verb" },
    { term:"verify", th:["ตรวจสอบ","ยืนยันความถูกต้อง"], clue:"check that something is correct", domain:"user guide", pos:"verb" },

    { term:"dataset", th:["ชุดข้อมูล"], clue:"collection of data", domain:"AI report", pos:"noun" },
    { term:"model", th:["โมเดล"], clue:"system trained to make predictions or outputs", domain:"AI report", pos:"noun" },
    { term:"accuracy", th:["ความถูกต้อง"], clue:"how correct the result is", domain:"AI report", pos:"noun" },
    { term:"finding", th:["ผลการค้นพบ","ข้อค้นพบ"], clue:"important result from analysis", domain:"academic report", pos:"noun" },
    { term:"limitation", th:["ข้อจำกัด"], clue:"weakness or boundary of a study/project", domain:"academic report", pos:"noun" },
    { term:"evidence", th:["หลักฐาน"], clue:"information that supports a claim", domain:"academic report", pos:"noun" },
    { term:"recommendation", th:["ข้อเสนอแนะ"], clue:"suggestion for what to do next", domain:"academic report", pos:"noun" },

    { term:"qualification", th:["คุณสมบัติ"], clue:"skill or experience that makes someone suitable", domain:"CV/pitch", pos:"noun" },
    { term:"achievement", th:["ความสำเร็จ","ผลงานสำเร็จ"], clue:"something successful that someone has done", domain:"CV/pitch", pos:"noun" },
    { term:"propose", th:["เสนอ"], clue:"present an idea or plan", domain:"pitch", pos:"verb" },
    { term:"pitch", th:["การนำเสนอไอเดีย","นำเสนอ"], clue:"short persuasive presentation", domain:"pitch", pos:"noun/verb" },
    { term:"portfolio", th:["แฟ้มสะสมผลงาน","พอร์ตโฟลิโอ"], clue:"collection of work samples", domain:"portfolio", pos:"noun" },

    { term:"presentation", th:["การนำเสนอ"], clue:"talk or show information to an audience", domain:"final presentation", pos:"noun" },
    { term:"reflection", th:["การสะท้อนคิด"], clue:"thinking about what was learned", domain:"final reflection", pos:"noun" },
    { term:"future work", th:["งานในอนาคต","การพัฒนาต่อ"], clue:"what can be improved or done next", domain:"final presentation", pos:"noun phrase" }
  ];

  const state = {
    totalHints:0,
    answers:0,
    correct:0,
    wrong:0,
    streak:0,
    maxStreak:0,
    currentDifficulty:"A2+",
    prediction:"Start practicing",
    questionMap:{},
    lastQuestionKey:"",
    startedAt:new Date().toISOString()
  };

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function lower(v){
    return norm(v).toLowerCase();
  }

  function isGameActive(){
    const game = $("gameScreen");
    return Boolean(game && game.classList.contains("active"));
  }

  function textOf(id){
    const el = $(id);
    return el ? norm(el.textContent) : "";
  }

  function sessionId(){
    const all = [
      textOf("gameModeText"),
      textOf("questionTags"),
      textOf("gameTitle")
    ].join(" ");

    const m = all.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return m ? m[1] : "";
  }

  function itemType(){
    const tags = lower(textOf("questionTags"));
    const prompt = lower(textOf("promptText"));

    if(tags.includes("context gap") || prompt.includes("blank")) return "Context Gap";
    if(tags.includes("applied") || prompt.includes("situation")) return "Applied Context";
    if(tags.includes("sentence") || prompt.includes("sentence")) return "Academic Sentence";
    if(tags.includes("definition") || prompt.includes("definition")) return "Definition";
    if(tags.includes("meaning") || prompt.includes("means")) return "Meaning";
    if(tags.includes("boss")) return "Boss Review";

    return "Vocabulary Choice";
  }

  function choices(){
    const root = $("choicesEl");
    if(!root) return [];

    return Array.from(root.querySelectorAll("button,.choice"))
      .map(el => norm(el.textContent))
      .filter(Boolean);
  }

  function questionKey(){
    return [
      textOf("progressText"),
      textOf("promptText"),
      choices().join("|")
    ].join("::");
  }

  function getQuestionState(){
    const key = questionKey();
    if(!state.questionMap[key]){
      state.questionMap[key] = {
        key,
        hints:0,
        answered:false,
        correct:false,
        createdAt:new Date().toISOString()
      };
    }

    state.lastQuestionKey = key;
    return state.questionMap[key];
  }

  function extractCorrectFromFeedback(){
    const txt = [
      textOf("feedbackText"),
      textOf("feedbackTitle")
    ].join(" ");

    const patterns = [
      /correct term is\s*[“"]([^”"]+)[”"]/i,
      /answer is\s*[“"]([^”"]+)[”"]/i,
      /คำตอบคือ\s*[“"]?([^”".]+)[”"]?/i
    ];

    for(const p of patterns){
      const m = txt.match(p);
      if(m && m[1]) return lower(m[1]);
    }

    return "";
  }

  function findGlossaryByTerm(term){
    const t = lower(term);
    return GLOSSARY.find(g => lower(g.term) === t) || null;
  }

  function inferGlossary(){
    const prompt = lower(textOf("promptText"));
    const choiceList = choices().map(lower);
    const fromFeedback = extractCorrectFromFeedback();

    if(fromFeedback){
      const byFeedback = findGlossaryByTerm(fromFeedback);
      if(byFeedback) return byFeedback;
    }

    for(const g of GLOSSARY){
      if(choiceList.includes(lower(g.term))){
        for(const th of g.th || []){
          if(prompt.includes(lower(th))){
            return g;
          }
        }

        const clueWords = lower(g.clue).split(/\s+/).filter(w => w.length >= 5);
        const hit = clueWords.filter(w => prompt.includes(w)).length;

        if(hit >= 2){
          return g;
        }
      }
    }

    for(const g of GLOSSARY){
      if(prompt.includes(lower(g.term)) && choiceList.includes(lower(g.term))){
        return g;
      }
    }

    return null;
  }

  function contrastChoice(correct){
    const list = choices();
    const correctLower = lower(correct);

    return list.find(c => lower(c) !== correctLower) || "";
  }

  function currentAccuracy(){
    if(state.answers > 0){
      return Math.round((state.correct / state.answers) * 100);
    }

    const correct = miniStat("Correct");
    const wrong = miniStat("Wrong");
    const total = correct + wrong;

    if(total > 0) return Math.round((correct / total) * 100);

    return 0;
  }

  function miniStat(labelName){
    const root = $("gameStats");
    if(!root) return 0;

    const cards = Array.from(root.querySelectorAll(".mini,.stat,div"));
    for(const card of cards){
      const label = norm(card.querySelector("span") ? card.querySelector("span").textContent : "");
      const value = norm(card.querySelector("b") ? card.querySelector("b").textContent : "");

      if(label.toLowerCase() === labelName.toLowerCase()){
        const m = value.match(/-?\d+/);
        return m ? Number(m[0]) : 0;
      }
    }

    return 0;
  }

  function difficultyFromPerformance(){
    const acc = currentAccuracy();

    if(state.answers < 2){
      return "A2+";
    }

    if(acc >= 90 && state.streak >= 4) return "B1+";
    if(acc >= 75) return "B1";
    if(acc >= 60) return "A2+";
    return "A2";
  }

  function predictionFromPerformance(){
    const acc = currentAccuracy();
    const hintRate = state.answers > 0 ? state.totalHints / Math.max(1,state.answers) : 0;

    if(state.answers < 2){
      return "Collecting evidence";
    }

    if(acc >= 90 && hintRate <= 0.35){
      return "Ready for Main Mission + Challenge";
    }

    if(acc >= 75){
      return "Ready for Main Mission";
    }

    if(acc >= 60){
      return "Ready, but review recommended";
    }

    return "At Risk — replay with AI Help";
  }

  function recommendationFromPerformance(){
    const acc = currentAccuracy();

    if(acc >= 90 && state.totalHints === 0){
      return "Try No-Hint Challenge to reach Mastery.";
    }

    if(acc >= 90){
      return "Try B1+ academic context questions.";
    }

    if(acc >= 75){
      return "Proceed to Main Mission, then replay weak words.";
    }

    if(acc >= 60){
      return "Review explanations, then replay this Session.";
    }

    return "Use AI Help and practice Weak Words before Boss Gate.";
  }

  function updateAiState(){
    state.currentDifficulty = difficultyFromPerformance();
    state.prediction = predictionFromPerformance();

    window.EAP_AI_LEARNING_STATE = {
      version:VERSION,
      hintsUsed:state.totalHints,
      answers:state.answers,
      correct:state.correct,
      wrong:state.wrong,
      streak:state.streak,
      maxStreak:state.maxStreak,
      accuracy:currentAccuracy(),
      aiDifficulty:state.currentDifficulty,
      aiPrediction:state.prediction,
      recommendation:recommendationFromPerformance(),
      updatedAt:new Date().toISOString()
    };

    renderAiPanel();
    updateAiButton();
  }

  function injectStyle(){
    if($("eapV188AiStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV188AiStyle";
    style.textContent = `
      #eapV188AiPanel{
        border:1px solid #c7d2fe;
        background:linear-gradient(135deg,#eef2ff,#ecfeff);
        border-radius:18px;
        padding:13px 14px;
        margin:12px 0;
        color:#334155;
        font-weight:750;
        line-height:1.45;
      }

      #eapV188AiPanel .eap188-row{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
        margin-bottom:8px;
      }

      #eapV188AiPanel .eap188-chip{
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:6px 10px;
        font-size:12px;
        font-weight:950;
        border:1px solid #dbeafe;
        background:#fff;
        color:#475569;
      }

      #eapV188AiPanel .eap188-chip.ai{
        background:#fff7ed;
        border-color:#fed7aa;
        color:#c2410c;
      }

      #eapV188AiPanel .eap188-chip.good{
        background:#ecfdf5;
        border-color:#bbf7d0;
        color:#047857;
      }

      #eapV188AiPanel .eap188-hint{
        display:none;
        margin-top:8px;
        padding:11px 12px;
        border-radius:14px;
        border:1px dashed #c7d2fe;
        background:rgba(255,255,255,.72);
        color:#1e3a8a;
        font-weight:800;
      }

      #eapV188AiPanel .eap188-hint.active{
        display:block;
      }

      #eapV188AiPanel .eap188-small{
        color:#64748b;
        font-size:13px;
        font-weight:800;
      }

      #eapV188SummaryBox{
        border:1px solid #fed7aa;
        background:#fff7ed;
        color:#9a3412;
        border-radius:16px;
        padding:12px 14px;
        margin-top:12px;
        font-weight:850;
        line-height:1.45;
      }

      @media(max-width:720px){
        #eapV188AiPanel{
          padding:12px;
          font-size:13px;
        }

        #eapV188AiPanel .eap188-chip{
          font-size:11px;
          padding:5px 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureAiPanel(){
    if($("eapV188AiPanel")) return $("eapV188AiPanel");

    const actions = document.querySelector(".game-actions");
    const stats = $("gameStats");

    const panel = document.createElement("div");
    panel.id = "eapV188AiPanel";
    panel.innerHTML = `
      <div class="eap188-row">
        <span class="eap188-chip ai" id="eap188Difficulty">AI Difficulty: A2+</span>
        <span class="eap188-chip good" id="eap188Prediction">AI Prediction: Start practicing</span>
        <span class="eap188-chip" id="eap188HintCount">Hints: 0</span>
      </div>
      <div class="eap188-small" id="eap188Recommendation">
        AI จะช่วยใบ้เป็นขั้น ๆ โดยไม่เฉลยทันที
      </div>
      <div class="eap188-hint" id="eap188HintBox"></div>
    `;

    if(actions){
      actions.insertAdjacentElement("beforebegin",panel);
    }else if(stats){
      stats.insertAdjacentElement("afterend",panel);
    }

    return panel;
  }

  function renderAiPanel(){
    if(!isGameActive()) return;

    injectStyle();
    ensureAiPanel();

    const d = $("eap188Difficulty");
    const p = $("eap188Prediction");
    const h = $("eap188HintCount");
    const r = $("eap188Recommendation");

    if(d) d.textContent = `AI Difficulty: ${state.currentDifficulty}`;
    if(p) p.textContent = `AI Prediction: ${state.prediction}`;
    if(h) h.textContent = `Hints: ${state.totalHints}`;
    if(r) r.textContent = recommendationFromPerformance();
  }

  function updateAiButton(){
    const btn = $("aiHelpBtn");
    if(!btn) return;

    const q = getQuestionState();
    const left = Math.max(0,MAX_HINT_PER_QUESTION - q.hints);

    btn.disabled = left <= 0;
    btn.textContent = left > 0 ? `AI Help ${left}` : "AI Help used";
    btn.title = "AI Help จะใบ้ทีละระดับโดยไม่เฉลยตรง ๆ";
  }

  function makeHint(level){
    const sid = sessionId();
    const title = SESSION_TITLES[sid] || "Current Session";
    const type = itemType();
    const g = inferGlossary();
    const list = choices();

    if(level === 1){
      if(g){
        return `Hint 1: คำถามนี้เป็น ${type} ใน ${title}. มองหาคำชนิด ${g.pos} ที่เกี่ยวกับ “${g.domain}”.`;
      }

      return `Hint 1: คำถามนี้เป็น ${type} ใน ${title}. อ่านสถานการณ์ก่อน แล้วค่อยตัดตัวเลือกที่ไม่เข้าบริบท.`;
    }

    if(level === 2){
      if(g){
        return `Hint 2: คำที่ควรมองหาเกี่ยวกับแนวคิด “${g.clue}”. ระวังตัวเลือกที่เป็นคำใกล้เคียงแต่ใช้คนละสถานการณ์.`;
      }

      return `Hint 2: ให้เทียบคำสำคัญในโจทย์กับตัวเลือก เช่น purpose, task, user, result หรือ problem.`;
    }

    if(level === 3){
      if(g && list.length){
        const out = contrastChoice(g.term);

        if(out){
          return `Hint 3: ลองตัดตัวเลือกที่ห่างจากบริบทออกก่อน เช่น “${out}”. จากนั้นเทียบความหมายที่เหลือกับประโยคอีกครั้ง.`;
        }
      }

      return `Hint 3: เลือกคำที่ทำให้ประโยคอ่านเป็นภาษา EAP ได้สมบูรณ์ที่สุด ไม่ใช่คำที่แปลใกล้เคียงอย่างเดียว.`;
    }

    return "AI Help หมดแล้ว ลองตอบจากบริบทและ feedback หลังเลือกคำตอบ";
  }

  function showHint(){
    if(!isGameActive()) return;

    const q = getQuestionState();
    if(q.hints >= MAX_HINT_PER_QUESTION){
      updateAiButton();
      return;
    }

    q.hints += 1;
    state.totalHints += 1;

    const hint = makeHint(q.hints);
    const box = $("eap188HintBox");

    renderAiPanel();

    if(box){
      box.classList.add("active");
      box.textContent = hint;
    }

    updateAiState();

    window.EAP_AI_LAST_HINT = {
      version:VERSION,
      questionKey:q.key,
      hintLevel:q.hints,
      hint,
      sessionId:sessionId(),
      itemType:itemType(),
      at:new Date().toISOString()
    };

    console.info("[EAP Word Quest] AI hint:",window.EAP_AI_LAST_HINT);
  }

  function captureAnswerResult(){
    if(!isGameActive()) return;

    const q = getQuestionState();
    if(q.answered) return;

    const feedback = $("feedbackBox");
    const title = lower(textOf("feedbackTitle"));
    const feedbackText = lower(textOf("feedbackText"));

    const visible = feedback && !feedback.hidden;
    if(!visible) return;

    const isCorrect =
      title.includes("ถูก") ||
      title.includes("correct") ||
      feedbackText.includes("correct term is") ||
      feedbackText.includes("ถูกต้อง");

    const isWrong =
      title.includes("ผิด") ||
      title.includes("wrong") ||
      feedbackText.includes("not correct") ||
      feedbackText.includes("ไม่ถูก");

    if(!isCorrect && !isWrong) return;

    q.answered = true;
    q.correct = isCorrect;

    state.answers += 1;

    if(isCorrect){
      state.correct += 1;
      state.streak += 1;
      state.maxStreak = Math.max(state.maxStreak,state.streak);
    }else{
      state.wrong += 1;
      state.streak = 0;
    }

    updateAiState();

    console.info("[EAP Word Quest] AI answer captured:",{
      correct:isCorrect,
      answers:state.answers,
      accuracy:currentAccuracy(),
      difficulty:state.currentDifficulty,
      prediction:state.prediction
    });
  }

  function buildAiExtras(base){
    const acc = Number(base && base.accuracy != null ? base.accuracy : currentAccuracy()) || currentAccuracy();
    const difficulty =
      acc >= 90 ? "B1+" :
      acc >= 75 ? "B1" :
      acc >= 60 ? "A2+" :
      "A2";

    const prediction =
      acc >= 90 ? "Ready for Main Mission + Challenge" :
      acc >= 75 ? "Ready for Main Mission" :
      acc >= 60 ? "Ready, but review recommended" :
      "At Risk — replay with AI Help";

    const levelWeak = acc < 60 ? ["A2"] : acc < 75 ? ["A2+","B1 context"] : [];
    const itemTypeWeak = state.wrong > 0 ? [itemType()] : [];

    return {
      hintUsed:state.totalHints,
      hintsUsed:state.totalHints,
      aiDifficulty:difficulty,
      aiPrediction:prediction,
      cefrLevel:difficulty,
      level:difficulty,
      itemTypeWeak,
      levelWeak,
      localAiVersion:VERSION
    };
  }

  function wrapLogger(){
    if(typeof window.logEapWordQuestResult !== "function") return;
    if(window.logEapWordQuestResult.__eap188Wrapped) return;

    const original = window.logEapWordQuestResult;

    const wrapped = function(input){
      const merged = Object.assign({},input || {},buildAiExtras(input || {}));
      return original.call(this,merged);
    };

    wrapped.__eap188Wrapped = true;
    wrapped.__eap188Original = original;

    window.logEapWordQuestResult = wrapped;

    console.info("[EAP Word Quest] v188 logger wrapped");
  }

  function augmentSummaryOverlay(){
    const overlay = $("eapV172SummaryOverlay");
    const state172 = window.EAP_V172_SUMMARY_STATE;

    if(!overlay || !state172 || !state172.result) return;

    const result = state172.result;
    const extras = buildAiExtras(result);

    Object.assign(result,extras);

    const report = overlay.querySelector(".eap172-report");
    if(report){
      report.textContent = `AI Prediction: ${extras.aiPrediction}`;
    }

    let box = $("eapV188SummaryBox");
    if(!box){
      box = document.createElement("div");
      box.id = "eapV188SummaryBox";

      const progress = $("eapV183ProgressBox") || report;
      if(progress){
        progress.insertAdjacentElement("afterend",box);
      }
    }

    if(box){
      box.innerHTML = `
        <b>Local AI Learning</b><br>
        Difficulty: ${extras.aiDifficulty}
        • Hints used: ${state.totalHints}
        • Recommendation: ${recommendationFromPerformance()}
      `;
    }

    window.EAP_V188_AI_SUMMARY = {
      version:VERSION,
      result,
      extras,
      updatedAt:new Date().toISOString()
    };
  }

  function resetForNewRoundIfNeeded(){
    if(!isGameActive()) return;

    const key = questionKey();

    if(key && key !== state.lastQuestionKey){
      state.lastQuestionKey = key;
      getQuestionState();
      updateAiButton();

      const box = $("eap188HintBox");
      if(box){
        box.classList.remove("active");
        box.textContent = "";
      }
    }
  }

  window.addEventListener("click",function(e){
    const aiBtn = e.target && e.target.closest ? e.target.closest("#aiHelpBtn") : null;
    if(aiBtn){
      e.preventDefault();
      e.stopImmediatePropagation();
      showHint();
      return;
    }

    const choice = e.target && e.target.closest ? e.target.closest("#choicesEl button,#choicesEl .choice") : null;
    if(choice){
      setTimeout(captureAnswerResult,80);
      setTimeout(captureAnswerResult,220);
      setTimeout(captureAnswerResult,500);
    }
  },true);

  setInterval(() => {
    if(isGameActive()){
      injectStyle();
      renderAiPanel();
      resetForNewRoundIfNeeded();
      wrapLogger();
    }
  },700);

  let lastSummaryAt = "";
  setInterval(() => {
    const s = window.EAP_V172_SUMMARY_STATE;
    if(!s || !s.renderedAt) return;

    if(s.renderedAt !== lastSummaryAt){
      lastSummaryAt = s.renderedAt;
      setTimeout(augmentSummaryOverlay,80);
      setTimeout(augmentSummaryOverlay,300);
      setTimeout(augmentSummaryOverlay,800);
    }
  },600);

  [0,200,600,1200].forEach(ms => setTimeout(() => {
    injectStyle();
    updateAiState();
    wrapLogger();
  },ms));

  window.EAP_WORD_LOCAL_AI_VERSION = VERSION;
  window.getEapLocalAiState = function(){
    updateAiState();
    return window.EAP_AI_LEARNING_STATE;
  };
  window.showEapAiHintNow = showHint;
  window.augmentEapAiSummary = augmentSummaryOverlay;

  console.info("[EAP Word Quest] v188 local AI learning ready:",{
    version:VERSION,
    helpers:[
      "getEapLocalAiState()",
      "showEapAiHintNow()",
      "augmentEapAiSummary()"
    ]
  });
})();