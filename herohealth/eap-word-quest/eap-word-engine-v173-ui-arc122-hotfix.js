/* =========================================================
   EAP Word Quest • UI / Arc / Group 122 Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v173-ui-arc122-hotfix.js
   Version: v1.7.3-UI-ARC122-SIDEQUEST-WORDING

   Fix:
   - Section 101 -> Group 122
   - Academic Vocabulary Mission -> EAP Vocabulary Side Quest
   - Act wording -> Arc wording
   - Session cards explain Vocabulary Ready role
   - Boss cards explain Arc Vocabulary Boss role
   - Force profile section to 122 for EAP project
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.7.3-UI-ARC122-SIDEQUEST-WORDING";

  if(window.__EAP_WORD_QUEST_V173_UI_ARC122__){
    console.info("[EAP Word Quest] v173 UI already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V173_UI_ARC122__ = true;

  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const GROUP = "122";

  const MAIN_GAME_URL =
    "https://supparang.github.io/webxr-health-mobile/eap-hero-save-society-v1/index.html";

  const SESSION_INFO = {
    S1:{
      arc:"Arc 1",
      title:"Academic Profile",
      note:"ฝึกคำศัพท์สำหรับแนะนำตัวเชิงวิชาการ สาขา ทักษะ จุดแข็ง และเป้าหมายการเรียน",
      ready:"Vocabulary Ready for Main Mission S1"
    },
    S2:{
      arc:"Arc 1",
      title:"Project Introduction",
      note:"ฝึกคำศัพท์สำหรับอธิบายโครงการ ปัญหา วัตถุประสงค์ แนวทางแก้ และฟีเจอร์",
      ready:"Vocabulary Ready for Main Mission S2"
    },
    S3:{
      arc:"Arc 1",
      title:"Project Rationale & Target Users",
      note:"ฝึกคำศัพท์สำหรับเหตุผลโครงการ กลุ่มเป้าหมาย ขอบเขต และประโยชน์",
      ready:"Vocabulary Ready for Main Mission S3"
    },
    BG1:{
      arc:"Arc 1",
      title:"Vocabulary Boss 1",
      note:"ทบทวนคำศัพท์รวมจาก S1–S3 เพื่อปลดล็อก Arc ถัดไป",
      ready:"Arc 1 Vocabulary Ready"
    },

    S4:{
      arc:"Arc 2",
      title:"Tech Careers & Academic Roles",
      note:"ฝึกคำศัพท์อาชีพสายเทคโนโลยี บทบาทในทีม และทักษะที่เกี่ยวข้อง",
      ready:"Vocabulary Ready for Main Mission S4"
    },
    S5:{
      arc:"Arc 2",
      title:"Team Communication",
      note:"ฝึกภาษาสำหรับถาม–ตอบ อัปเดตงาน ขอคำชี้แจง และยืนยันความเข้าใจ",
      ready:"Vocabulary Ready for Main Mission S5"
    },
    S6:{
      arc:"Arc 2",
      title:"Progress Report & Responsibility",
      note:"ฝึกคำศัพท์สำหรับรายงานความก้าวหน้า หน้าที่ timeline และ contribution",
      ready:"Vocabulary Ready for Main Mission S6"
    },
    BG2:{
      arc:"Arc 2",
      title:"Vocabulary Boss 2",
      note:"ทบทวนคำศัพท์รวมจาก S4–S6",
      ready:"Arc 2 Vocabulary Ready"
    },

    S7:{
      arc:"Arc 3",
      title:"Academic Email",
      note:"ฝึกคำศัพท์และวลีสำหรับ email แบบสุภาพ request, inquiry, attachment, confirmation",
      ready:"Vocabulary Ready for Main Mission S7"
    },
    S8:{
      arc:"Arc 3",
      title:"Discussion & Meeting Language",
      note:"ฝึกภาษาในการแสดงความคิดเห็น เห็นด้วย ไม่เห็นด้วย เสนอทางเลือก และถามเพื่อความชัดเจน",
      ready:"Vocabulary Ready for Main Mission S8"
    },
    S9:{
      arc:"Arc 3",
      title:"Summary & Action Items",
      note:"ฝึกคำศัพท์สำหรับสรุป discussion / meeting และระบุ action items",
      ready:"Vocabulary Ready for Main Mission S9"
    },
    BG3:{
      arc:"Arc 3",
      title:"Vocabulary Boss 3",
      note:"ทบทวนคำศัพท์รวมจาก S7–S9",
      ready:"Arc 3 Vocabulary Ready"
    },

    S10:{
      arc:"Arc 4",
      title:"System Explanation",
      note:"ฝึกคำศัพท์สำหรับอธิบายระบบ ขั้นตอน input/output function workflow และ interface",
      ready:"Vocabulary Ready for Main Mission S10"
    },
    S11:{
      arc:"Arc 4",
      title:"Problem Report & Solution",
      note:"ฝึกคำศัพท์สำหรับรายงานปัญหา สาเหตุ วิธีแก้ การทดสอบ และผลลัพธ์",
      ready:"Vocabulary Ready for Main Mission S11"
    },
    S12:{
      arc:"Arc 4",
      title:"User Guide & Instruction",
      note:"ฝึกคำศัพท์สำหรับคู่มือ ขั้นตอน คำแนะนำ ข้อควรระวัง และข้อจำกัด",
      ready:"Vocabulary Ready for Main Mission S12"
    },
    BG4:{
      arc:"Arc 4",
      title:"Vocabulary Boss 4",
      note:"ทบทวนคำศัพท์รวมจาก S10–S12",
      ready:"Arc 4 Vocabulary Ready"
    },

    S13:{
      arc:"Arc 5",
      title:"AI Report & Academic Summary",
      note:"ฝึกคำศัพท์สำหรับ summary, finding, evidence, result, limitation และ recommendation",
      ready:"Vocabulary Ready for Main Mission S13"
    },
    S14:{
      arc:"Arc 5",
      title:"Portfolio, CV & Pitch",
      note:"ฝึกคำศัพท์สำหรับอธิบายทักษะ ผลงาน portfolio และนำเสนอ project idea",
      ready:"Vocabulary Ready for Main Mission S14"
    },
    S15:{
      arc:"Arc 5",
      title:"Final Presentation & Reflection",
      note:"ฝึกคำศัพท์สำหรับนำเสนอ final project, reflection และ future improvement",
      ready:"Vocabulary Ready for Main Mission S15"
    },
    BG5:{
      arc:"Arc 5",
      title:"Final Vocabulary Boss",
      note:"ทบทวนคำศัพท์รวม S1–S15 เพื่อวัด Final Vocabulary Mastery",
      ready:"Final Vocabulary Mastery"
    }
  };

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function readJson(key,fallback){
    try{
      return JSON.parse(localStorage.getItem(key) || "");
    }catch(err){
      return fallback;
    }
  }

  function safeSetJson(key,value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    }catch(err){
      console.warn("[EAP Word Quest] v173 profile save skipped:",err);
      return false;
    }
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
    profile.updatedBy = HOTFIX_VERSION;
    profile.updatedAt = new Date().toISOString();

    safeSetJson(PROFILE_KEY,profile);

    document.querySelectorAll("input,select,textarea").forEach(el => {
      const key = [
        el.id,
        el.name,
        el.getAttribute("aria-label"),
        el.placeholder
      ].join(" ").toLowerCase();

      if(key.includes("section") || key.includes("group") || key.includes("sec")){
        try{
          el.value = GROUP;
        }catch(err){}
      }
    });
  }

  function replaceInTextNode(node){
    if(!node || node.nodeType !== Node.TEXT_NODE) return;

    let t = node.nodeValue;
    if(!t) return;

    const original = t;

    t = t.replace(/Academic Vocabulary Mission/g,"EAP Vocabulary Side Quest");
    t = t.replace(/ACADEMIC VOCABULARY MISSION/g,"EAP VOCABULARY SIDE QUEST");

    t = t.replace(/Section\s*101/g,"Group 122");
    t = t.replace(/SECTION\s*101/g,"GROUP 122");
    t = t.replace(/section\s*101/g,"group 122");

    t = t.replace(/\bAct\b/g,"Arc");
    t = t.replace(/\bACT\b/g,"ARC");
    t = t.replace(/\bact\b/g,"arc");

    t = t.replace(/เล่นให้ผ่านเพื่อปลดล็อกการกิจถัดไป/g,"ผ่าน Session นี้เพื่อเป็น Vocabulary Ready");
    t = t.replace(/เล่นให้ผ่านเพื่อปลดล็อกภารกิจถัดไป/g,"ผ่าน Session นี้เพื่อเป็น Vocabulary Ready");
    t = t.replace(/ฝึกคำศัพท์ EAP ทีละภารกิจ สะสม XP ผ่าน Boss Gate และทบทวนคำที่ยังไม่แม่น/g,
      "Vocabulary Side Quest สำหรับ English for Academic Purposes ปี 2 กลุ่ม 122 เชื่อมกับ EAP Hero Save the Society"
    );

    if(t !== original){
      node.nodeValue = t;
    }
  }

  function walkText(root){
    if(!root) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node){
          const p = node.parentElement;
          if(!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName ? p.tagName.toLowerCase() : "";
          if(tag === "script" || tag === "style" || tag === "textarea") return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while(walker.nextNode()){
      nodes.push(walker.currentNode);
    }

    nodes.forEach(replaceInTextNode);
  }

  function injectStyle(){
    if($("eapV173UiStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV173UiStyle";
    style.textContent = `
      .eap173-sidequest-note{
        margin-top:12px;
        padding:12px 14px;
        border-radius:16px;
        border:1px dashed #c7d2fe;
        background:linear-gradient(135deg,#eef2ff,#ecfeff);
        color:#334155;
        font-size:14px;
        line-height:1.45;
        font-weight:750;
      }
      .eap173-sidequest-note b{
        color:#3730a3;
      }
      .eap173-rule{
        margin-top:10px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .eap173-chip{
        display:inline-flex;
        align-items:center;
        gap:5px;
        border:1px solid #dbeafe;
        background:#f8fafc;
        color:#475569;
        border-radius:999px;
        padding:6px 10px;
        font-size:12px;
        font-weight:900;
      }
      .eap173-chip.good{
        background:#ecfdf5;
        border-color:#bbf7d0;
        color:#047857;
      }
      .eap173-chip.ai{
        background:#fff7ed;
        border-color:#fed7aa;
        color:#c2410c;
      }
      .eap173-hero-link{
        margin-top:16px;
        width:100%;
        border:1px solid #c7d2fe;
        background:#eef2ff;
        color:#3730a3;
        border-radius:16px;
        padding:13px 16px;
        font-weight:950;
        cursor:pointer;
      }
    `;
    document.head.appendChild(style);
  }

  function setHeaderText(){
    const bodyText = norm(document.body.textContent || "");

    /*
      แก้ title หลัก/คำโปรยแบบไม่พึ่ง id
    */
    const candidates = Array.from(document.querySelectorAll("h1,h2,h3,p,div,span,strong,b"));

    candidates.forEach(el => {
      const text = norm(el.textContent);

      if(text === "EAP Word Quest"){
        return;
      }

      if(text === "EAP Vocabulary Side Quest" || text === "EAP VOCABULARY SIDE QUEST"){
        return;
      }

      if(text === "Academic Vocabulary Mission" || text === "ACADEMIC VOCABULARY MISSION"){
        el.textContent = text === text.toUpperCase()
          ? "EAP VOCABULARY SIDE QUEST"
          : "EAP Vocabulary Side Quest";
      }

      if(text === "ฝึกคำศัพท์ EAP ทีละภารกิจ สะสม XP ผ่าน Boss Gate และทบทวนคำที่ยังไม่แม่น"){
        el.textContent = "Vocabulary Side Quest สำหรับ English for Academic Purposes ปี 2 กลุ่ม 122 เชื่อมกับ EAP Hero Save the Society";
      }
    });

    /*
      ถ้าไม่มี subtitle ใหม่ ให้เติมใต้ header หลัก
    */
    if(!bodyText.includes("Vocabulary Side Quest สำหรับ English for Academic Purposes ปี 2 กลุ่ม 122")){
      const h1 = Array.from(document.querySelectorAll("h1")).find(el => norm(el.textContent).includes("EAP Word Quest"));
      if(h1 && h1.parentElement && !$("eapV173HeaderNote")){
        const note = document.createElement("div");
        note.id = "eapV173HeaderNote";
        note.className = "eap173-sidequest-note";
        note.innerHTML = `
          <b>Vocabulary Side Quest</b> สำหรับ English for Academic Purposes ปี 2 กลุ่ม 122
          <div class="eap173-rule">
            <span class="eap173-chip good">Group 122</span>
            <span class="eap173-chip">Arc-based</span>
            <span class="eap173-chip ai">AI Help / Prediction / Difficulty</span>
          </div>
        `;
        h1.insertAdjacentElement("afterend",note);
      }
    }
  }

  function findSessionIdFromText(text){
    const m = norm(text).match(/\b(BG[1-5]|S(?:1[0-5]|[1-9]))\b/);
    return m ? m[1] : "";
  }

  function likelyCard(el){
    if(!el || !el.querySelector) return false;

    const text = norm(el.textContent);
    if(!findSessionIdFromText(text)) return false;

    const hasButton = Boolean(el.querySelector("button"));
    const hasTitle = Boolean(el.querySelector("h2,h3,h4,strong,b"));

    return hasButton || hasTitle;
  }

  function cardRootFromTitle(el){
    let cur = el;

    for(let i = 0; i < 5 && cur; i++){
      if(likelyCard(cur)) return cur;
      cur = cur.parentElement;
    }

    return null;
  }

  function patchCards(){
    const elements = Array.from(document.querySelectorAll("h2,h3,h4,strong,b,div"));

    elements.forEach(el => {
      const id = findSessionIdFromText(el.textContent);
      if(!id || !SESSION_INFO[id]) return;

      const card = cardRootFromTitle(el);
      if(!card) return;

      if(card.dataset.eap173Patched === id) return;

      const info = SESSION_INFO[id];

      /*
        เปลี่ยนชื่อหัวการ์ดถ้าเจอชื่อเดิม
      */
      const titleEl = card.querySelector("h2,h3,h4,strong,b");
      if(titleEl && norm(titleEl.textContent).match(new RegExp("\\b" + id + "\\b"))){
        titleEl.textContent = `${id} • ${info.title}`;
      }

      /*
        ลบ note เก่าแล้วใส่ note ใหม่
      */
      card.querySelectorAll(".eap173-sidequest-note").forEach(n => n.remove());

      const note = document.createElement("div");
      note.className = "eap173-sidequest-note";
      note.innerHTML = `
        <b>${info.arc}</b> • ${info.note}
        <div class="eap173-rule">
          <span class="eap173-chip good">${info.ready}</span>
          <span class="eap173-chip">${id.startsWith("BG") ? "Pass: Accuracy ≥ 70% + Boss HP = 0" : "Pass: Accuracy ≥ 60%"}</span>
          <span class="eap173-chip ai">AI Difficulty A2–B1+</span>
        </div>
      `;

      const btn = card.querySelector("button");
      if(btn){
        btn.insertAdjacentElement("beforebegin",note);
      }else{
        card.appendChild(note);
      }

      card.dataset.eap173Patched = id;
    });
  }

  function patchButtons(){
    document.querySelectorAll("button,a").forEach(el => {
      const text = norm(el.textContent);

      if(text === "เริ่ม Session"){
        el.textContent = "เริ่ม Vocabulary Practice";
      }

      if(text === "เริ่ม Boss Gate" || text === "เริ่ม Boss"){
        el.textContent = "เริ่ม Vocabulary Boss";
      }

      if(text === "กลับหน้าแรก"){
        el.title = "กลับหน้า Home ของ EAP Word Quest";
      }
    });
  }

  function addHeroLink(){
    const home = $("homeScreen") || document.querySelector(".screen.active") || document.body;

    if($("eapV173HeroLink")) return;

    const h1 = Array.from(document.querySelectorAll("h1")).find(el => norm(el.textContent).includes("EAP Word Quest"));
    const target = h1 && h1.parentElement ? h1.parentElement : home;

    const btn = document.createElement("button");
    btn.id = "eapV173HeroLink";
    btn.className = "eap173-hero-link";
    btn.type = "button";
    btn.textContent = "กลับไป EAP Hero Save the Society";
    btn.onclick = function(){
      window.location.href = MAIN_GAME_URL;
    };

    /*
      ใส่หลัง note header ถ้ามี ไม่งั้นหลัง h1
    */
    const note = $("eapV173HeaderNote");
    if(note){
      note.insertAdjacentElement("afterend",btn);
    }else if(h1){
      h1.insertAdjacentElement("afterend",btn);
    }else{
      target.prepend(btn);
    }
  }

  function patchPills(){
    document.querySelectorAll("*").forEach(el => {
      if(el.children && el.children.length > 0) return;

      const text = norm(el.textContent);

      if(/^Section\s*101$/i.test(text) || /^Group\s*122$/i.test(text)){
        el.textContent = "Group 122";
        el.title = "EAP Year 2 Group 122";
      }

      if(text === "Student Mode"){
        el.title = "Student Mode • Vocabulary Side Quest";
      }
    });
  }

  function patchAll(){
    forceGroup122();
    injectStyle();
    walkText(document.body);
    setHeaderText();
    patchPills();
    patchCards();
    patchButtons();

    window.EAP_V173_UI_STATE = {
      version:HOTFIX_VERSION,
      group:GROUP,
      role:"Vocabulary Side Quest",
      patchedAt:new Date().toISOString()
    };
  }

  /*
    ไม่ใช้ MutationObserver หนัก ๆ เพื่อไม่ให้วนลูป
    ใช้ patch แบบเป็นจังหวะหลัง engine render แทน
  */
  const delays = [0,100,300,700,1200,2000,3500];
  delays.forEach(ms => setTimeout(patchAll,ms));

  document.addEventListener("click",function(){
    setTimeout(patchAll,80);
    setTimeout(patchAll,400);
  },true);

  window.patchEapV173Ui = patchAll;
  window.forceEapGroup122 = forceGroup122;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] v173 UI / Arc / Group 122 hotfix ready:",{
    version:HOTFIX_VERSION,
    group:GROUP,
    helpers:[
      "patchEapV173Ui()",
      "forceEapGroup122()"
    ]
  });
})();
