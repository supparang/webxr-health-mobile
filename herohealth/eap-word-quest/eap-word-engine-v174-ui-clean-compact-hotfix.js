/* =========================================================
   EAP Word Quest • Clean UI + Bilingual Learning Scaffold
   File: /herohealth/eap-word-quest/eap-word-engine-v174-ui-clean-compact-hotfix.js
   Version: v1.9.8-BILINGUAL-LEARNING-SCAFFOLD-122

   Keeps the compact student UI and adds Thai Support / Balanced /
   English Challenge scaffolding without translating answer choices.
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.9.8-BILINGUAL-LEARNING-SCAFFOLD-122";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const SUPPORT_PREFIX = "EAP_WORD_QUEST_LANGUAGE_SUPPORT_V198";
  const MAIN_GAME_URL =
    "https://supparang.github.io/webxr-health-mobile/eap-hero-save-society-v1/index.html";

  if(window.__EAP_WORD_QUEST_V198_BILINGUAL__){
    console.info("[EAP Word Quest] v198 bilingual scaffold already loaded");
    return;
  }
  window.__EAP_WORD_QUEST_V198_BILINGUAL__ = true;

  const SESSION_THAI = {
    S1: { title:"Mission Passport", thai:"ตั้งเป้าหมายการเรียน อธิบาย purpose และวาง weekly action ที่ทำได้จริง", strategy:"มองหาคำที่บอกเป้าหมาย การพัฒนา การลงมือทำ หรือผลลัพธ์" },
    S2: { title:"UK Campus Decoder", thai:"อ่านประกาศ ตารางเรียน และเดาความหมายของศัพท์จากบริบท", strategy:"สังเกตคำรอบข้างว่ากำลังพูดถึงเวลา กฎ การส่งงาน หรือการเข้าเรียน" },
    S3: { title:"The Broken Brief", thai:"หา main idea แยก supporting detail และตัดข้อมูลที่ไม่เกี่ยวข้อง", strategy:"เลือกความคิดที่ครอบคลุมทั้งข้อความ ไม่ใช่แค่ตัวอย่างหรือรายละเอียดเล็ก ๆ" },
    S4: { title:"Signal Relay", thai:"อ่านความสัมพันธ์ของเหตุ ผล ความขัดแย้ง ตัวอย่าง และลำดับ", strategy:"ดูว่าประโยคถัดไปเป็น cause, contrast, result, example หรือ sequence" },
    S5: { title:"Evidence Court", thai:"แยก claim, fact, opinion, evidence และประเมินความน่าเชื่อถือของ source", strategy:"claim ต้องมี evidence รองรับ และ source ที่ดีต้องตรวจสอบได้" },
    S6: { title:"Summary Press Room", thai:"สรุป main point ด้วย own words โดยไม่ copy-paste", strategy:"เก็บใจความหลัก ตัดรายละเอียดรอง และเปลี่ยนเป็นคำของตนเอง" },
    S7: { title:"Tone Switchboard", thai:"เลือกภาษาที่ formal, polite และเหมาะกับ audience", strategy:"ถามว่าใครเป็นผู้อ่าน และถ้อยคำนี้สุภาพพอสำหรับงานวิชาการหรือไม่" },
    S8: { title:"Paragraph Repair Lab", thai:"ซ่อมโครง paragraph ให้มี topic sentence, support และ closing", strategy:"ทุกประโยคควรช่วยสนับสนุน main idea เดียวกัน" },
    S9: { title:"Campus Solution Pitch", thai:"เสนอ solution ที่เชื่อม problem, evidence, recommendation และ impact", strategy:"solution ที่ดีต้องแก้ปัญหาได้จริงและมีเหตุผลหรือ evidence รองรับ" },
    S10:{ title:"Data Detective", thai:"อธิบาย data และ trend อย่างระมัดระวังโดยไม่ overclaim", strategy:"บอกเฉพาะสิ่งที่ graph/table แสดง และใช้คำที่ไม่สรุปเกินข้อมูล" },
    S11:{ title:"International Help Desk", thai:"เขียน academic email ที่มี purpose, polite request และ closing", strategy:"อีเมลที่ดีบอกเหตุผลชัด ขออย่างสุภาพ และปิดท้ายอย่างเหมาะสม" },
    S12:{ title:"Integrity Escape Room", thai:"ใช้ quote, paraphrase, citation และ AI อย่างรับผิดชอบ", strategy:"ให้เครดิต source ใช้ own words เมื่อ paraphrase และ disclose การใช้ AI" },
    S13:{ title:"Mini Lecture Heist", thai:"จับ main point และ useful detail จากการฟัง lecture", strategy:"ฟังภาพรวมก่อน แล้วจดเฉพาะรายละเอียดที่ช่วยสนับสนุนใจความหลัก" },
    S14:{ title:"Presentation Under Pressure", thai:"เปิดเรื่อง ใช้ signpost สนับสนุนด้วย evidence และปิดการนำเสนอ", strategy:"ช่วยให้ audience ตามทันด้วยลำดับ First, Next และ In conclusion" },
    S15:{ title:"Global Solution Summit", thai:"เชื่อม issue, cause, evidence, solution, impact, reflection และ next step", strategy:"คำตอบที่ดีต้องมีลำดับคิดครบ ไม่กระโดดจากปัญหาไปสู่ข้อเสนอโดยไม่มี evidence" },
    BG1:{ title:"Global Learner Clearance", thai:"ประยุกต์ศัพท์จาก S1–S3 ในสถานการณ์ใหม่", strategy:"ทบทวน goal, campus vocabulary และ main idea ก่อนตอบ" },
    BG2:{ title:"Evidence Court Live", thai:"ใช้ signal words ตรวจ evidence และสรุปด้วย own words", strategy:"อ่านความสัมพันธ์ของข้อมูลก่อนตัดสินว่าอะไรคือ evidence หรือ summary" },
    BG3:{ title:"Academic Makeover Studio", thai:"ปรับ tone ซ่อม paragraph และเสนอ solution ด้วย evidence", strategy:"ตรวจ audience, structure และความเชื่อมโยงของ evidence กับ solution" },
    BG4:{ title:"International Help Desk Crisis", thai:"อ่าน data เขียน email และใช้ source/AI อย่างรับผิดชอบ", strategy:"ระวัง overclaim ใช้คำสุภาพ และให้เครดิต source ให้ครบ" },
    BG5:{ title:"Human Override Summit", thai:"บูรณาการ listening, presentation และ solution brief", strategy:"คิดเป็นลำดับ issue → cause → evidence → solution → impact → next step" }
  };

  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v == null ? "" : v).replace(/\s+/g," ").trim(); }
  function lower(v){ return norm(v).toLowerCase(); }

  function safeRead(key, fallback){
    try { return localStorage.getItem(key) || fallback; }
    catch(err){ return fallback; }
  }

  function safeWrite(key, value){
    try { localStorage.setItem(key,value); return true; }
    catch(err){ return false; }
  }

  function readJson(key,fallback){
    try { return JSON.parse(localStorage.getItem(key) || ""); }
    catch(err){ return fallback; }
  }

  function saveJson(key,value){
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch(err){ console.warn("[EAP Word Quest] profile save skipped",err); }
  }

  function forceGroup122(){
    window.EAP_DEFAULT_SECTION = GROUP;
    window.EAP_WORD_QUEST_DEFAULT_SECTION = GROUP;
    window.EAP_GROUP = GROUP;
    window.EAP_SECTION = GROUP;

    const profile = readJson(PROFILE_KEY,{}) || {};
    profile.section = GROUP;
    profile.group = GROUP;
    profile.course = profile.course || "English for Academic Purposes";
    profile.year = profile.year || "Year 2";
    profile.updatedBy = VERSION;
    profile.updatedAt = new Date().toISOString();
    saveJson(PROFILE_KEY,profile);

    const groupInput = $("sectionInput");
    if(groupInput) groupInput.value = GROUP;
  }

  function removeMessyV173(){
    document.querySelectorAll(".eap173-sidequest-note,#eapV173HeroLink,#eapV173UiStyle").forEach(el => el.remove());
    document.body.classList.remove("game-lock","modal-open","is-playing");
  }

  function isGameActive(){
    const screen = $("gameScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function getSessionId(){
    const candidates = [
      document.body && document.body.dataset ? document.body.dataset.sessionId : "",
      $("gameScreen") && $("gameScreen").dataset ? $("gameScreen").dataset.sessionId : "",
      $("gameModeText") ? $("gameModeText").textContent : "",
      $("gameTitle") ? $("gameTitle").textContent : "",
      $("questionTags") ? $("questionTags").textContent : ""
    ].join(" ");
    const m = candidates.match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/i);
    return m ? m[1].toUpperCase() : "";
  }

  function supportKey(){
    const id = norm($("studentIdInput") ? $("studentIdInput").value : "") || "anon";
    return `${SUPPORT_PREFIX}_${GROUP}_${id.replace(/[^a-z0-9_-]/gi,"_")}`;
  }

  function getSupportMode(){
    const select = $("eapV198LanguageMode");
    const allowed = new Set(["thai","balanced","challenge"]);
    const value = norm(select ? select.value : safeRead(supportKey(),"thai"));
    return allowed.has(value) ? value : "thai";
  }

  function setSupportMode(value){
    const next = ["thai","balanced","challenge"].includes(value) ? value : "thai";
    safeWrite(supportKey(),next);
    const select = $("eapV198LanguageMode");
    if(select && select.value !== next) select.value = next;
    document.documentElement.dataset.eapLanguageSupport = next;
    renderBilingualScaffold();
  }

  function questionType(){
    const text = lower(`${$("questionTags") ? $("questionTags").textContent : ""} ${$("promptText") ? $("promptText").textContent : ""}`);
    if(text.includes("repair")) return "repair";
    if(text.includes("application") || text.includes("situation")) return "application";
    if(text.includes("context") || text.includes("blank") || text.includes("___")) return "context";
    if(text.includes("definition") || text.includes("meaning")) return "definition";
    if(text.includes("boss")) return "boss";
    return "choice";
  }

  function taskDirective(type, mode){
    const thai = {
      definition: "เลือกคำหรือวลีภาษาอังกฤษที่ตรงกับความหมายที่โจทย์อธิบาย",
      context: "อ่านสถานการณ์หรือประโยค แล้วเลือกคำ/วลีที่ใช้ในบริบทนั้นได้เหมาะที่สุด",
      application: "เชื่อมคำศัพท์กับภารกิจจริงของ Session ไม่ใช่เลือกเพียงคำที่คุ้นตา",
      repair: "มองหาคำหรือวลีที่ช่วยทำให้ข้อความเป็นภาษาอังกฤษเชิงวิชาการที่ถูกต้องและเหมาะสม",
      boss: "ใช้คำศัพท์จากหลาย Session ในสถานการณ์ใหม่ แล้วเลือกคำตอบที่สัมพันธ์กับภารกิจทั้งหมด",
      choice: "อ่านโจทย์และตัวเลือกภาษาอังกฤษ แล้วเลือกคำหรือวลีที่ตรงกับหน้าที่ทางวิชาการมากที่สุด"
    };
    const balanced = {
      definition: "Choose the term that matches the meaning. · เลือกคำที่ตรงความหมาย",
      context: "Use the academic context. · ใช้บริบท ไม่เดาจากคำที่คุ้น",
      application: "Apply the term to the mission. · เชื่อมคำกับภารกิจจริง",
      repair: "Repair the academic message. · ทำให้ข้อความเหมาะกับงานวิชาการ",
      boss: "Apply vocabulary across Sessions. · ใช้ศัพท์ข้าม Session",
      choice: "Choose the best academic option. · เลือกคำที่เหมาะที่สุด"
    };
    const english = {
      definition: "Choose the target that matches the meaning.",
      context: "Use the academic context, not a familiar-looking word.",
      application: "Apply the vocabulary to the mission.",
      repair: "Repair the message with the most appropriate academic language.",
      boss: "Apply vocabulary from the source Sessions in a new context.",
      choice: "Choose the option that performs the needed academic function."
    };
    return mode === "thai" ? thai[type] : mode === "balanced" ? balanced[type] : english[type];
  }

  function injectStyle(){
    if($("eapV198BilingualStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV198BilingualStyle";
    style.textContent = `
      #eapV174TopBanner{margin:14px 0 18px;border:1px solid #dbeafe;background:linear-gradient(135deg,#eef2ff,#ecfeff);color:#334155;border-radius:18px;padding:14px 16px;line-height:1.45;font-weight:750}
      #eapV174TopBanner .eap174-title{font-weight:950;color:#3730a3;margin-bottom:6px}
      #eapV174TopBanner .eap174-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .eap174-chip{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;border:1px solid #dbeafe;background:#fff;color:#475569}
      .eap174-chip.good{background:#ecfdf5;border-color:#bbf7d0;color:#047857}
      .eap174-chip.ai{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
      #eapV174HeroLink{border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:12px;padding:8px 12px;font-weight:900;cursor:pointer}
      #eapV198SupportPanel{margin:12px 0;border:1px solid #bfdbfe;border-radius:18px;padding:13px 14px;background:linear-gradient(135deg,#eff6ff,#f0fdfa);color:#1e3a5f;line-height:1.5}
      #eapV198SupportPanel .eap198-title{font-size:14px;font-weight:1000;color:#1d4ed8;margin-bottom:7px}
      #eapV198SupportPanel .eap198-skill{font-weight:900;color:#0f172a}
      #eapV198SupportPanel .eap198-thai{margin-top:6px;font-weight:760}
      #eapV198SupportPanel .eap198-strategy{margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.72);border:1px dashed #93c5fd;color:#334155;font-size:13px;font-weight:760}
      #eapV198SupportPanel .eap198-note{margin-top:8px;color:#475569;font-size:12px;font-weight:720}
      #eapV198HintThai,#eapV198FeedbackThai{margin-top:8px;padding:9px 10px;border-radius:12px;background:#f8fafc;border-left:4px solid #60a5fa;color:#334155;line-height:1.45;font-weight:760;font-size:13px}
      #eapV198SummaryGuide{margin:12px 0;border:1px solid #bbf7d0;border-radius:16px;padding:12px 14px;background:#f0fdf4;color:#14532d;line-height:1.5;font-weight:850}
      #eapV198SummaryGuide b{color:#166534}
      .eap198-mode-label{display:block;margin-bottom:6px;font-weight:850;color:#475569}
      @media(max-width:720px){#eapV174TopBanner{margin:10px 0 14px;padding:12px;font-size:13px}#eapV174TopBanner .eap174-row{gap:6px}.eap174-chip{font-size:11px;padding:5px 8px}#eapV198SupportPanel{padding:12px;font-size:13px}}
    `;
    document.head.appendChild(style);
  }

  function insertTopBanner(){
    if($("eapV174TopBanner")) return;
    const h1 = Array.from(document.querySelectorAll("h1")).find(el => norm(el.textContent).includes("EAP Word Quest"));
    if(!h1) return;
    const banner = document.createElement("div");
    banner.id = "eapV174TopBanner";
    banner.innerHTML = `
      <div class="eap174-title">Vocabulary Side Quest • English for Academic Purposes Year 2</div>
      <div>ฝึกคำศัพท์และวลีวิชาการแบบ A2–B1+ สำหรับนักศึกษากลุ่ม 122 เพื่อเตรียมพร้อมก่อนทำภารกิจหลักใน EAP Hero Save the Society</div>
      <div class="eap174-row">
        <span class="eap174-chip good">Group 122</span>
        <span class="eap174-chip">Arc-based</span>
        <span class="eap174-chip">Pass: Session ≥ 60%</span>
        <span class="eap174-chip">Boss ≥ 70% + HP 0</span>
        <span class="eap174-chip ai">Thai Support / Balanced / English Challenge</span>
        <button id="eapV174HeroLink" type="button">กลับไป EAP Hero</button>
      </div>`;
    h1.insertAdjacentElement("afterend",banner);
    const link = $("eapV174HeroLink");
    if(link) link.onclick = () => { window.location.href = MAIN_GAME_URL; };
  }

  function ensureLanguageControl(){
    if($("eapV198LanguageControl")) return;
    const row = document.querySelector("#homeScreen .settings-row");
    if(!row) return;
    const label = document.createElement("label");
    label.id = "eapV198LanguageControl";
    label.innerHTML = `
      <span class="eap198-mode-label">Language Support</span>
      <select id="eapV198LanguageMode" aria-label="Language Support">
        <option value="thai">Thai Support · คำอธิบายไทย</option>
        <option value="balanced">Balanced · ไทยสั้น + English task</option>
        <option value="challenge">English Challenge · English only</option>
      </select>`;
    row.appendChild(label);
    const select = $("eapV198LanguageMode");
    if(select){
      select.value = safeRead(supportKey(),"thai") || "thai";
      select.addEventListener("change",() => setSupportMode(select.value));
    }
    document.documentElement.dataset.eapLanguageSupport = getSupportMode();
  }

  function ensureSupportPanel(){
    if($("eapV198SupportPanel")) return $("eapV198SupportPanel");
    const prompt = $("promptText");
    if(!prompt) return null;
    const panel = document.createElement("aside");
    panel.id = "eapV198SupportPanel";
    panel.setAttribute("aria-live","polite");
    prompt.insertAdjacentElement("beforebegin",panel);
    return panel;
  }

  function renderAiThaiSupport(sessionId, mode){
    const note = $("eapV195Note");
    const session = SESSION_THAI[sessionId];
    if(note && session){
      note.textContent = mode === "challenge"
        ? `${sessionId} · ${session.title}: use the Session focus and answer from context. AI Help scaffolds thinking without giving the answer.`
        : `${sessionId} · ${session.title}: ${session.thai} · AI Help จะช่วยคิดเป็นขั้น แต่ไม่เฉลยคำตอบ.`;
    }

    const hintBox = $("eapV195HintBox");
    if(!hintBox || !hintBox.classList.contains("active") || mode === "challenge") return;
    let thai = $("eapV198HintThai");
    if(!thai){
      thai = document.createElement("div");
      thai.id = "eapV198HintThai";
      hintBox.appendChild(thai);
    }
    const text = lower(hintBox.textContent);
    let line = "คำใบ้ไทย: ใช้บริบทและเป้าหมายของ Session ก่อนเลือกคำตอบ อย่าเลือกเพียงคำที่คุ้นตา.";
    if(text.includes("hint 1")) line = "คำใบ้ไทย ระดับ 1: ดูว่าข้อนี้ต้องการความหมาย หน้าที่ของคำ หรือความสัมพันธ์ของข้อมูลแบบใด.";
    if(text.includes("hint 2")) line = "คำใบ้ไทย ระดับ 2: เปรียบเทียบตัวเลือกกับเป้าหมายของ Session ไม่ใช่แปลคำทีละคำ.";
    if(text.includes("hint 3")) line = "คำใบ้ไทย ระดับ 3: ตัดตัวเลือกที่ใช้คนละหน้าที่หรือคนละบริบทออกก่อน แล้วจึงเลือกจากตัวที่เหลือ.";
    thai.textContent = line;
  }

  function renderFeedbackThai(sessionId, mode){
    const feedback = $("feedbackBox");
    const text = $("feedbackText");
    if(!feedback || feedback.hidden || !text || mode === "challenge") return;
    let box = $("eapV198FeedbackThai");
    if(!box){
      box = document.createElement("div");
      box.id = "eapV198FeedbackThai";
      text.insertAdjacentElement("afterend",box);
    }
    const title = lower($("feedbackTitle") ? $("feedbackTitle").textContent : "");
    const correct = title.includes("correct") || title.includes("ถูก");
    const session = SESSION_THAI[sessionId];
    const focus = session ? session.strategy : "กลับไปดูหน้าที่ของคำในบริบท";
    box.textContent = correct
      ? `คิดแบบนี้: คำตอบนี้เหมาะกับภารกิจของ ${sessionId}. จำไว้ว่า ${focus}`
      : `คิดใหม่อีกครั้ง: ${focus} อย่าเลือกคำที่ดูคุ้นที่สุด หากยังไม่ตรงกับหน้าที่ของประโยค.`;
  }

  function numberFromText(text, pattern){
    const m = String(text || "").match(pattern);
    return m ? Number(m[1]) : 0;
  }

  function getSummaryRoot(){
    const overlay = $("eapV172SummaryOverlay");
    if(overlay && !overlay.hidden && overlay.offsetParent !== null) return overlay.querySelector(".eap172-card") || overlay;
    const summary = $("summaryScreen");
    if(summary && summary.classList.contains("active")) return summary.querySelector(".summary-card") || summary;
    return null;
  }

  function renderSummaryThai(){
    const root = getSummaryRoot();
    if(!root || getSupportMode() === "challenge") return;
    const text = norm(root.textContent);
    const accuracy = numberFromText(text,/Accuracy\s*(\d+)%/i);
    const pair = text.match(/(\d+)\s*\/\s*(\d+)/);
    const correct = pair ? Number(pair[1]) : 0;
    const total = pair ? Number(pair[2]) : 0;
    const sessionId = getSessionId() || "S1";
    const threshold = sessionId === "BG5" ? 75 : /^BG/.test(sessionId) ? 70 : 60;
    const needed = total ? Math.ceil(total * threshold / 100) : 0;
    const prediction = /At Risk/i.test(text) ? "ยังควรฝึกเพิ่ม: ใช้ AI Help แล้วเล่นซ้ำ" : /Ready for Main Mission/i.test(text) ? "พร้อมไปทำ Main Mission ได้" : /Ready, but review/i.test(text) ? "ใกล้พร้อมแล้ว: ทบทวน feedback ก่อนเล่นซ้ำ" : "อ่าน feedback และทบทวน Weak Words ก่อนเล่นรอบถัดไป";
    let box = $("eapV198SummaryGuide");
    if(!box){
      box = document.createElement("div");
      box.id = "eapV198SummaryGuide";
      const actions = root.querySelector(".summary-actions,.eap172-actions");
      if(actions) actions.insertAdjacentElement("beforebegin",box);
      else root.appendChild(box);
    }
    const scoreLine = total ? `รอบนี้ถูก ${correct}/${total} ข้อ (${accuracy}%). เกณฑ์ผ่านคือ ${threshold}%${needed ? ` หรืออย่างน้อย ${needed}/${total} ข้อ` : ""}.` : `เกณฑ์ผ่านของ ${sessionId} คือ ${threshold}%.`;
    box.innerHTML = `<b>คำอธิบายผลรอบนี้</b><br>${scoreLine}<br>AI แนะนำ: ${prediction}`;
  }

  function renderBilingualScaffold(){
    injectStyle();
    ensureLanguageControl();
    document.documentElement.dataset.eapLanguageSupport = getSupportMode();

    if(!isGameActive()){
      renderSummaryThai();
      return;
    }

    const sessionId = getSessionId();
    const session = SESSION_THAI[sessionId] || { title:"Current Session", thai:"ฝึกใช้คำศัพท์วิชาการในบริบท", strategy:"ดูหน้าที่ของคำและความสัมพันธ์ของข้อมูล" };
    const mode = getSupportMode();
    const type = questionType();
    const panel = ensureSupportPanel();
    if(panel){
      if(mode === "challenge"){
        panel.innerHTML = `<div class="eap198-title">English Challenge</div><div class="eap198-skill"><b>${sessionId} · ${session.title}</b></div><div class="eap198-thai">${taskDirective(type,mode)}</div>`;
      }else{
        const title = mode === "thai" ? "🧭 คำอธิบายการทำโจทย์" : "🧭 Learning Guide · วิธีคิดก่อนตอบ";
        panel.innerHTML = `
          <div class="eap198-title">${title}</div>
          <div class="eap198-skill">Session focus: <b>${sessionId} · ${session.title}</b></div>
          <div class="eap198-thai"><b>โจทย์นี้ฝึก:</b> ${session.thai}</div>
          <div class="eap198-thai"><b>วิธีทำ:</b> ${taskDirective(type,mode)}</div>
          <div class="eap198-strategy"><b>สังเกต:</b> ${session.strategy}</div>
          <div class="eap198-note">คำศัพท์เป้าหมายและตัวเลือกคงเป็นภาษาอังกฤษ เพื่อให้ฝึกใช้ภาษาในบริบทจริง</div>`;
      }
    }
    renderAiThaiSupport(sessionId,mode);
    renderFeedbackThai(sessionId,mode);
  }

  function compactCards(){
    document.querySelectorAll("button").forEach(btn => {
      const text = norm(btn.textContent);
      if(text === "เริ่ม Session") btn.textContent = "เริ่ม Vocabulary Practice";
      if(text === "เริ่ม Boss Gate" || text === "เริ่ม Boss") btn.textContent = "เริ่ม Vocabulary Boss";
      if(text.includes("เล่นต่อ:")) btn.textContent = text.replace("เล่นต่อ:","ไปต่อ:");
    });
  }

  function patchText(){
    document.querySelectorAll("body *").forEach(el => {
      if(el.children && el.children.length > 0) return;
      const text = norm(el.textContent);
      if(/^Section\s*(101|122)$/i.test(text) || /^Group\s*122$/i.test(text)){
        el.textContent = "Group 122";
        el.title = "EAP Year 2 Group 122";
      }else if(text === "ACADEMIC VOCABULARY MISSION"){
        el.textContent = "EAP VOCABULARY SIDE QUEST";
      }else if(text === "Academic Vocabulary Mission"){
        el.textContent = "EAP Vocabulary Side Quest";
      }
    });
  }

  function patchAll(){
    removeMessyV173();
    forceGroup122();
    injectStyle();
    insertTopBanner();
    compactCards();
    patchText();
    renderBilingualScaffold();
    window.EAP_V198_BILINGUAL_STATE = { version:VERSION, group:GROUP, supportMode:getSupportMode(), updatedAt:new Date().toISOString() };
  }

  document.addEventListener("click", event => {
    const watched = event.target && event.target.closest ? event.target.closest("#choicesEl button,#choicesEl .choice,#aiHelpBtn") : null;
    if(watched) [80,260,520].forEach(delay => setTimeout(renderBilingualScaffold,delay));
  },true);

  [0,100,300,700,1200].forEach(delay => setTimeout(patchAll,delay));
  setInterval(renderBilingualScaffold,700);

  window.setEapLanguageSupport = setSupportMode;
  window.getEapLanguageSupport = getSupportMode;
  window.inspectEapV198 = () => ({
    version:VERSION,
    mode:getSupportMode(),
    sessionId:getSessionId(),
    panelReady:Boolean($("eapV198SupportPanel")),
    summaryGuideReady:Boolean($("eapV198SummaryGuide"))
  });

  console.info("[EAP Word Quest] v198 bilingual learning scaffold ready",{
    version:VERSION,
    group:GROUP,
    modes:["Thai Support","Balanced","English Challenge"]
  });
})();
