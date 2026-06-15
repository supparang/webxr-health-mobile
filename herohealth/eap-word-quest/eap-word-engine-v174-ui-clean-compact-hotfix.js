/* =========================================================
   EAP Word Quest • Clean Compact UI Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v174-ui-clean-compact-hotfix.js
   Version: v1.7.4-UI-CLEAN-COMPACT-NO-NESTED-NOTES

   Fix:
   - Remove messy repeated v173 notes
   - Stop putting Arc explanation inside every card
   - Use one compact banner only
   - Section 101 -> Group 122
   - Keep UI clean for mobile/desktop
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.7.4-UI-CLEAN-COMPACT-NO-NESTED-NOTES";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const MAIN_GAME_URL =
    "https://supparang.github.io/webxr-health-mobile/eap-hero-save-society-v1/index.html";

  if(window.__EAP_WORD_QUEST_V174_UI_CLEAN__){
    console.info("[EAP Word Quest] v174 clean UI already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V174_UI_CLEAN__ = true;

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

  function saveJson(key,value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
    }catch(err){
      console.warn("[EAP Word Quest] v174 profile save skipped:",err);
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

    saveJson(PROFILE_KEY,profile);

    document.querySelectorAll("input,select,textarea").forEach(el => {
      const key = [
        el.id,
        el.name,
        el.placeholder,
        el.getAttribute("aria-label")
      ].join(" ").toLowerCase();

      if(key.includes("section") || key.includes("group") || key.includes("sec")){
        try{ el.value = GROUP; }catch(err){}
      }
    });
  }

  function removeMessyV173(){
    /*
      ล้างกล่องที่ v173 ใส่ซ้ำซ้อน
    */
    document.querySelectorAll(
      ".eap173-sidequest-note,#eapV173HeroLink,#eapV173UiStyle"
    ).forEach(el => el.remove());

    /*
      กันกรณี style เก่าหลงเหลือ
    */
    document.body.classList.remove("game-lock","modal-open","is-playing");
  }

  function injectCleanStyle(){
    if($("eapV174CleanStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV174CleanStyle";
    style.textContent = `
      #eapV174TopBanner{
        margin:14px 0 18px;
        border:1px solid #dbeafe;
        background:linear-gradient(135deg,#eef2ff,#ecfeff);
        color:#334155;
        border-radius:18px;
        padding:14px 16px;
        line-height:1.45;
        font-weight:750;
      }

      #eapV174TopBanner .eap174-title{
        font-weight:950;
        color:#3730a3;
        margin-bottom:6px;
      }

      #eapV174TopBanner .eap174-row{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:10px;
      }

      .eap174-chip{
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:6px 10px;
        font-size:12px;
        font-weight:900;
        border:1px solid #dbeafe;
        background:#fff;
        color:#475569;
      }

      .eap174-chip.good{
        background:#ecfdf5;
        border-color:#bbf7d0;
        color:#047857;
      }

      .eap174-chip.ai{
        background:#fff7ed;
        border-color:#fed7aa;
        color:#c2410c;
      }

      #eapV174HeroLink{
        border:1px solid #c7d2fe;
        background:#eef2ff;
        color:#3730a3;
        border-radius:12px;
        padding:8px 12px;
        font-weight:900;
        cursor:pointer;
      }

      @media(max-width:720px){
        #eapV174TopBanner{
          margin:10px 0 14px;
          padding:12px;
          font-size:13px;
        }

        #eapV174TopBanner .eap174-row{
          gap:6px;
        }

        .eap174-chip{
          font-size:11px;
          padding:5px 8px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function replaceLeafText(){
    document.querySelectorAll("body *").forEach(el => {
      if(el.children && el.children.length > 0) return;

      const text = norm(el.textContent);
      if(!text) return;

      if(/^Section\s*101$/i.test(text) || /^Section\s*122$/i.test(text) || /^Group\s*122$/i.test(text)){
        el.textContent = "Group 122";
        el.title = "EAP Year 2 Group 122";
        return;
      }

      if(text === "ACADEMIC VOCABULARY MISSION"){
        el.textContent = "EAP VOCABULARY SIDE QUEST";
        return;
      }

      if(text === "Academic Vocabulary Mission"){
        el.textContent = "EAP Vocabulary Side Quest";
        return;
      }

      if(text === "เริ่ม Session"){
        el.textContent = "เริ่ม Vocabulary Practice";
        return;
      }

      if(text === "เริ่ม Boss Gate" || text === "เริ่ม Boss"){
        el.textContent = "เริ่ม Vocabulary Boss";
        return;
      }
    });
  }

  function patchSubtitle(){
    const candidates = Array.from(document.querySelectorAll("p,div,span"));
    candidates.forEach(el => {
      if(el.children && el.children.length > 0) return;

      const text = norm(el.textContent);

      if(text === "ฝึกคำศัพท์ EAP ทีละภารกิจ สะสม XP ผ่าน Boss Gate และทบทวนคำที่ยังไม่แม่น"){
        el.textContent =
          "ฝึกคำศัพท์ EAP เพื่อเตรียมพร้อมก่อนกลับไปทำภารกิจหลักใน EAP Hero";
      }
    });
  }

  function insertTopBanner(){
    if($("eapV174TopBanner")) return;

    const h1 = Array.from(document.querySelectorAll("h1"))
      .find(el => norm(el.textContent).includes("EAP Word Quest"));

    if(!h1) return;

    const banner = document.createElement("div");
    banner.id = "eapV174TopBanner";
    banner.innerHTML = `
      <div class="eap174-title">Vocabulary Side Quest • English for Academic Purposes Year 2</div>
      <div>
        ฝึกคำศัพท์และวลีวิชาการแบบ A2–B1+ สำหรับนักศึกษากลุ่ม 122
        เพื่อเตรียมพร้อมก่อนทำภารกิจหลักใน EAP Hero Save the Society
      </div>
      <div class="eap174-row">
        <span class="eap174-chip good">Group 122</span>
        <span class="eap174-chip">Arc-based</span>
        <span class="eap174-chip">Pass: Session ≥ 60%</span>
        <span class="eap174-chip">Boss ≥ 70% + HP 0</span>
        <span class="eap174-chip ai">AI Help / Prediction / Difficulty</span>
        <button id="eapV174HeroLink" type="button">กลับไป EAP Hero</button>
      </div>
    `;

    h1.insertAdjacentElement("afterend",banner);

    const link = $("eapV174HeroLink");
    if(link){
      link.onclick = function(){
        window.location.href = MAIN_GAME_URL;
      };
    }
  }

  function compactCards(){
    /*
      ไม่ใส่กล่อง note เพิ่มในการ์ดอีกแล้ว
      ทำแค่เปลี่ยนปุ่ม/ข้อความที่รก
    */
    document.querySelectorAll("button").forEach(btn => {
      const text = norm(btn.textContent);

      if(text === "เริ่ม Session"){
        btn.textContent = "เริ่ม Vocabulary Practice";
      }

      if(text === "เริ่ม Boss Gate" || text === "เริ่ม Boss"){
        btn.textContent = "เริ่ม Vocabulary Boss";
      }

      if(text.includes("เล่นต่อ:")){
        btn.textContent = text.replace("เล่นต่อ:","ไปต่อ:");
      }
    });
  }

  function patchProfileLabels(){
    document.querySelectorAll("label,span,div,p,strong,b").forEach(el => {
      if(el.children && el.children.length > 0) return;

      const text = norm(el.textContent);

      if(text === "Section"){
        el.textContent = "Group";
      }

      if(text === "Section 101" || text === "Section 122"){
        el.textContent = "Group 122";
      }
    });
  }

  function patchAll(){
    removeMessyV173();
    forceGroup122();
    injectCleanStyle();
    replaceLeafText();
    patchSubtitle();
    patchProfileLabels();
    compactCards();
    insertTopBanner();

    window.EAP_V174_UI_STATE = {
      version:HOTFIX_VERSION,
      group:GROUP,
      compact:true,
      patchedAt:new Date().toISOString()
    };
  }

  /*
    จังหวะ patch แบบเบา ๆ ไม่ใช้ MutationObserver
  */
  [0,100,300,700,1200,2000].forEach(ms => setTimeout(patchAll,ms));

  document.addEventListener("click",function(){
    setTimeout(patchAll,120);
    setTimeout(patchAll,500);
  },true);

  window.cleanEapVocabUi = patchAll;
  window.forceEapGroup122 = forceGroup122;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] v174 clean compact UI hotfix ready:",{
    version:HOTFIX_VERSION,
    group:GROUP,
    helpers:[
      "cleanEapVocabUi()",
      "forceEapGroup122()"
    ]
  });
})();
