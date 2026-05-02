/* =========================================================
   /vocab/vocab.utils.js
   TechPath Vocab Arena — Shared Utilities
   Version: 20260502c

   ต้องโหลดหลัง:
   - vocab.config.js
   - vocab.state.js

   ใช้โดย:
   - vocab.storage.js
   - vocab.ui.js
   - vocab.question.js
   - vocab.game.js
   - vocab.reward.js
   - vocab.logger.js
========================================================= */
(function(){
  "use strict";

  if(!window.VOCAB_APP){
    console.error("[VOCAB UTILS] VOCAB_APP is not defined. Load vocab.config.js first.");
    window.VOCAB_APP = {
      version: "unknown",
      storageKeys: {}
    };
  }

  const APP = window.VOCAB_APP;

  /* =========================================================
     DOM HELPERS
  ========================================================= */

  function byId(id){
    return document.getElementById(id);
  }

  function qs(selector, root){
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root){
    return Array.from((root || document).querySelectorAll(selector));
  }

  function closest(el, selector){
    if(!el || !el.closest) return null;
    return el.closest(selector);
  }

  function createEl(tag, className, html){
    const el = document.createElement(tag);

    if(className){
      el.className = className;
    }

    if(html !== undefined){
      el.innerHTML = html;
    }

    return el;
  }

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = value == null ? "" : String(value);
  }

  function setHtml(id, html){
    const el = byId(id);
    if(el) el.innerHTML = html == null ? "" : String(html);
  }

  function show(idOrEl, displayValue){
    const el = typeof idOrEl === "string" ? byId(idOrEl) : idOrEl;
    if(!el) return;

    el.hidden = false;
    el.style.display = displayValue || "";
    el.style.pointerEvents = "auto";
  }

  function hide(idOrEl){
    const el = typeof idOrEl === "string" ? byId(idOrEl) : idOrEl;
    if(!el) return;

    el.hidden = true;
    el.style.display = "none";
    el.style.pointerEvents = "none";
  }

  function toggleClass(el, className, on){
    if(!el) return;
    el.classList.toggle(className, !!on);
  }

  function scrollTop(){
    try{
      window.scrollTo({ top: 0, behavior: "auto" });
    }catch(e){
      window.scrollTo(0, 0);
    }
  }

  function scrollIntoViewSafe(el){
    if(!el) return;

    try{
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }catch(e){
      try{ el.scrollIntoView(); }catch(err){}
    }
  }

  /* =========================================================
     STRING HELPERS
  ========================================================= */

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function stripTags(value){
    const div = document.createElement("div");
    div.innerHTML = String(value ?? "");
    return div.textContent || div.innerText || "";
  }

  function normalizeText(value){
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function lower(value){
    return normalizeText(value).toLowerCase();
  }

  function titleCase(value){
    return normalizeText(value)
      .split(" ")
      .map(part => part ? part[0].toUpperCase() + part.slice(1) : "")
      .join(" ");
  }

  function cleanPublicText(value){
    return String(value ?? "")
      .replace(/\bv\d+\.\d+(\.\d+)?\b/gi, "")
      .replace(/\bv20\d{6,}[-_a-z0-9]*\b/gi, "")
      .replace(/\bpatch[_ -]?version\b/gi, "")
      .replace(/\bvocab[_ -]?version\b/gi, "")
      .replace(/\brelease[_ -]?pack\b/gi, "")
      .replace(/\bsource[_ -]?guard\b/gi, "")
      .replace(/\bdebug[_ -]?build\b/gi, "")
      .replace(/\bprotected classroom build\b/gi, "Protected Classroom")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function safeJsonStringify(value){
    try{
      return JSON.stringify(value);
    }catch(e){
      return "";
    }
  }

  function safeJsonParse(value, fallback){
    try{
      if(value == null || value === "") return fallback;
      return JSON.parse(value);
    }catch(e){
      return fallback;
    }
  }

  /* =========================================================
     NUMBER / FORMAT HELPERS
  ========================================================= */

  function num(value, fallback){
    const x = Number(value);
    return Number.isFinite(x) ? x : (fallback ?? 0);
  }

  function int(value, fallback){
    const x = parseInt(value, 10);
    return Number.isFinite(x) ? x : (fallback ?? 0);
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, num(value)));
  }

  function pct(value, total){
    total = num(total);
    if(!total) return 0;
    return Math.round((num(value) / total) * 100);
  }

  function formatNumber(value){
    const x = num(value);
    return String(Math.round(x));
  }

  function formatPct(value){
    return formatNumber(value) + "%";
  }

  function formatDuration(sec){
    sec = Math.max(0, int(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;

    if(m <= 0) return s + "s";
    return m + "m " + String(s).padStart(2, "0") + "s";
  }

  /* =========================================================
     DATE / TIME HELPERS
  ========================================================= */

  function nowMs(){
    return Date.now();
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function bangkokIsoNow(){
    const d = new Date();
    const bangkokMs = d.getTime() + (7 * 60 * 60 * 1000);
    return new Date(bangkokMs).toISOString().replace("Z", "+07:00");
  }

  /* =========================================================
     URL HELPERS
  ========================================================= */

  function getParam(name, fallback){
    try{
      const url = new URL(location.href);
      const v = url.searchParams.get(name);
      return v == null || v === "" ? (fallback ?? "") : v;
    }catch(e){
      return fallback ?? "";
    }
  }

  function hasFlag(names){
    if(!Array.isArray(names)) names = [names];

    try{
      const p = new URLSearchParams(location.search);

      return names.some(name => {
        const v = String(p.get(name) || "").toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "on";
      });
    }catch(e){
      return false;
    }
  }

  function updateUrlParams(params){
    try{
      const u = new URL(location.href);

      Object.entries(params || {}).forEach(([key, value]) => {
        if(value == null || value === ""){
          u.searchParams.delete(key);
        }else{
          u.searchParams.set(key, String(value));
        }
      });

      return u.toString();
    }catch(e){
      return location.href;
    }
  }

  function normalizeEndpoint(url){
    url = String(url || "").trim();
    if(!url) return "";

    try{
      const u = new URL(url, location.href);

      if(!u.searchParams.get("api")){
        u.searchParams.set("api", "vocab");
      }

      return u.toString();
    }catch(e){
      return url.includes("?") ? `${url}&api=vocab` : `${url}?api=vocab`;
    }
  }

  /* =========================================================
     RANDOM HELPERS
  ========================================================= */

  function hashString(value){
    let h = 2166136261;
    const str = String(value || "vocab");

    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return Math.abs(h) || 1;
  }

  let seed = 0;

  function setSeed(value){
    seed = hashString(value || Date.now());
    return seed;
  }

  function getSeed(){
    if(!seed){
      const urlSeed = getParam("seed", "");
      const savedSeed = localStorage.getItem("VOCAB_SEED") || "";
      setSeed(urlSeed || savedSeed || Date.now());

      try{
        localStorage.setItem("VOCAB_SEED", String(seed));
      }catch(e){}
    }

    return seed;
  }

  function rand(){
    getSeed();
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  }

  function randInt(min, max){
    min = Math.ceil(num(min));
    max = Math.floor(num(max));

    if(max < min){
      const t = min;
      min = max;
      max = t;
    }

    return Math.floor(rand() * (max - min + 1)) + min;
  }

  function pick(list, fallback){
    if(!Array.isArray(list) || !list.length) return fallback;
    return list[Math.floor(rand() * list.length)];
  }

  function shuffle(list){
    const a = Array.isArray(list) ? list.slice() : [];

    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rand() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }

    return a;
  }

  function uniqueBy(list, fn){
    const out = [];
    const seen = new Set();

    (Array.isArray(list) ? list : []).forEach(item => {
      const key = fn ? fn(item) : item;

      if(key == null || key === "") return;
      if(seen.has(key)) return;

      seen.add(key);
      out.push(item);
    });

    return out;
  }

  /* =========================================================
     TERM HELPERS
  ========================================================= */

  function normalizeTerm(term){
    return {
      term: normalizeText(term?.term || term?.word || ""),
      meaning: normalizeText(term?.meaning || term?.definition || term?.th || term?.translation || ""),
      category: normalizeText(term?.category || term?.group || term?.type || ""),
      example: normalizeText(term?.example || term?.sentence || ""),
      bank: normalizeText(term?.bank || ""),
      level: normalizeText(term?.level || "")
    };
  }

  function termKey(term){
    return lower(typeof term === "string" ? term : term?.term || term?.word || "");
  }

  function tokenize(value){
    const stop = new Set([
      "the","and","for","with","that","this","from","into","your","you","are","can","will",
      "a","an","to","of","or","in","on","as","by","is","it","its","be","used","using",
      "which","word","fits","best","choose","meaning","what","does","mean",
      "คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้"
    ]);

    return String(value || "")
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, " ")
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 2 && !stop.has(x));
  }

  function sharedKeywordCount(a, b){
    const aw = tokenize(a);
    const bw = new Set(tokenize(b));

    let count = 0;

    aw.forEach(x => {
      if(bw.has(x)) count++;
    });

    return count;
  }

  /* =========================================================
     STUDENT / MODE HELPERS
  ========================================================= */

  function getStudentContext(){
    const saved = safeJsonParse(
      localStorage.getItem(APP.storageKeys?.profile || "VOCAB_PROFILE"),
      {}
    );

    const displayName =
      normalizeText(byId("v63DisplayName")?.value) ||
      getParam("name", "") ||
      getParam("nick", "") ||
      saved.display_name ||
      "Hero";

    const studentId =
      normalizeText(byId("v63StudentId")?.value) ||
      getParam("student_id", "") ||
      getParam("sid", "") ||
      getParam("pid", "") ||
      saved.student_id ||
      "anon";

    const section =
      normalizeText(byId("v63Section")?.value) ||
      getParam("section", "") ||
      saved.section ||
      "";

    const sessionCode =
      normalizeText(byId("v63SessionCode")?.value) ||
      getParam("session_code", "") ||
      getParam("studyId", "") ||
      saved.session_code ||
      "";

    return {
      display_name: displayName,
      student_id: studentId,
      section,
      session_code: sessionCode
    };
  }

  function isTeacherView(){
    return hasFlag(["teacher", "admin", "qa", "debug"]) || getParam("role", "") === "teacher";
  }

  function isTeamView(){
    return hasFlag(["team", "event", "classEvent", "class_event", "liveboard"]) || isTeacherView();
  }

  function modeIcon(mode){
    mode = String(mode || "").toLowerCase();

    if(mode === "speed") return "⚡";
    if(mode === "mission") return "🎯";
    if(mode === "battle") return "👾";
    if(mode === "bossrush") return "💀";

    return "🤖";
  }

  function nextDifficulty(diff){
    diff = String(diff || "normal").toLowerCase();

    if(diff === "easy") return "normal";
    if(diff === "normal") return "hard";
    if(diff === "hard") return "challenge";

    return "challenge";
  }

  /* =========================================================
     SCREEN STATE HELPERS
  ========================================================= */

  function showOnlyMenu(){
    hide("v6BattlePanel");
    hide("v6RewardPanel");
    show("v6MenuPanel");

    scrollTop();
  }

  function showOnlyBattle(){
    hide("v6MenuPanel");
    hide("v6RewardPanel");
    show("v6BattlePanel");

    scrollTop();
  }

  function showOnlyReward(){
    hide("v6MenuPanel");
    hide("v6BattlePanel");
    show("v6RewardPanel", "block");

    scrollTop();
  }

  function clearFx(){
    [
      ".v6-float",
      ".v6-laser-beam",
      ".v6-fx-burst",
      ".v72-announcer",
      ".v72-flash",
      ".v72-particle",
      ".v74-toast",
      ".v78-guard-toast"
    ].forEach(selector => {
      qsa(selector).forEach(node => {
        try{ node.remove(); }catch(e){}
      });
    });

    document.body.classList.remove(
      "v72-screen-shake",
      "v72-hard-hit",
      "v72-boss-rage",
      "v72-fever-rainbow",
      "v73-final-lock"
    );
  }

  /* =========================================================
     TOAST / FX HELPERS
  ========================================================= */

  function toast(message, type){
    let box = byId("vocabToast");

    if(!box){
      box = createEl("div", "vocab-toast");
      box.id = "vocabToast";
      document.body.appendChild(box);
    }

    box.className = "vocab-toast " + (type || "");
    box.textContent = String(message || "");
    box.hidden = false;

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      if(box) box.hidden = true;
    }, 2600);
  }

  function floatingText(text, type){
    const fx = createEl("div", `v6-float ${type || "good"}`);
    fx.textContent = String(text || "");

    document.body.appendChild(fx);

    setTimeout(() => {
      try{ fx.remove(); }catch(e){}
    }, 900);
  }

  /* =========================================================
     SAFE CALL
  ========================================================= */

  function safeCall(fn, fallback){
    try{
      if(typeof fn === "function"){
        return fn();
      }
    }catch(e){
      console.warn("[VOCAB UTILS] safeCall warning", e);
    }

    return fallback;
  }

  /* =========================================================
     EXPORT
  ========================================================= */

  window.VocabUtils = {
    byId,
    qs,
    qsa,
    closest,
    createEl,
    setText,
    setHtml,
    show,
    hide,
    toggleClass,
    scrollTop,
    scrollIntoViewSafe,

    escapeHtml,
    stripTags,
    normalizeText,
    lower,
    titleCase,
    cleanPublicText,
    safeJsonStringify,
    safeJsonParse,

    num,
    int,
    clamp,
    pct,
    formatNumber,
    formatPct,
    formatDuration,

    nowMs,
    nowIso,
    todayKey,
    bangkokIsoNow,

    getParam,
    hasFlag,
    updateUrlParams,
    normalizeEndpoint,

    hashString,
    setSeed,
    getSeed,
    rand,
    randInt,
    pick,
    shuffle,
    uniqueBy,

    normalizeTerm,
    termKey,
    tokenize,
    sharedKeywordCount,

    getStudentContext,
    isTeacherView,
    isTeamView,
    modeIcon,
    nextDifficulty,

    showOnlyMenu,
    showOnlyBattle,
    showOnlyReward,
    clearFx,

    toast,
    floatingText,

    safeCall
  };

  /*
    Backward compatibility
  */
  window.byId = byId;
  window.escapeHtmlV6 = escapeHtml;
  window.shuffleV6 = shuffle;
  window.shuffleV61 = shuffle;
  window.randV61 = rand;
  window.hashStringV61 = hashString;
  window.getV63Param = getParam;
  window.getStudentContextV63 = getStudentContext;
  window.showFloatingTextV6 = floatingText;

  console.log("[VOCAB UTILS] loaded", APP.version);
})();
