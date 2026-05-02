/* =========================================================
   /vocab/vocab.utils.js
   TechPath Vocab Arena — Shared Utilities
   Version: 20260502a

   ต้องโหลดหลัง:
   - /vocab/vocab.config.js

   ใช้รวม:
   - DOM helper
   - safe JSON / localStorage
   - URL query helper
   - random seed / shuffle
   - term normalize
   - Bangkok time helper
   - small formatting helper
   ========================================================= */

(function(){
  "use strict";

  const U = {};

  /* =========================================================
     DOM HELPERS
  ========================================================= */

  U.byId = function byId(id){
    return document.getElementById(id);
  };

  U.qs = function qs(selector, root){
    return (root || document).querySelector(selector);
  };

  U.qsa = function qsa(selector, root){
    return Array.from((root || document).querySelectorAll(selector));
  };

  U.setText = function setText(id, value){
    const el = U.byId(id);
    if(el) el.textContent = value == null ? "" : String(value);
  };

  U.setHtml = function setHtml(id, html){
    const el = U.byId(id);
    if(el) el.innerHTML = html == null ? "" : String(html);
  };

  U.hide = function hide(idOrEl, hidden = true){
    const el = typeof idOrEl === "string" ? U.byId(idOrEl) : idOrEl;
    if(el) el.hidden = !!hidden;
  };

  U.show = function show(idOrEl){
    U.hide(idOrEl, false);
  };

  U.toggleClass = function toggleClass(idOrEl, className, enabled){
    const el = typeof idOrEl === "string" ? U.byId(idOrEl) : idOrEl;
    if(el) el.classList.toggle(className, !!enabled);
  };

  U.clearNode = function clearNode(idOrEl){
    const el = typeof idOrEl === "string" ? U.byId(idOrEl) : idOrEl;
    if(el) el.innerHTML = "";
  };

  U.createEl = function createEl(tag, className, html){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(html !== undefined) el.innerHTML = html;
    return el;
  };

  U.on = function on(target, eventName, handler, options){
    if(!target || typeof handler !== "function") return;
    target.addEventListener(eventName, handler, options || false);
  };

  U.onReady = function onReady(fn){
    if(typeof fn !== "function") return;

    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", fn, { once:true });
    }else{
      fn();
    }
  };

  U.scrollTop = function scrollTop(){
    try{
      window.scrollTo({ top:0, behavior:"auto" });
    }catch(e){
      window.scrollTo(0, 0);
    }
  };

  U.focusAndScroll = function focusAndScroll(el){
    if(!el) return;

    try{
      el.focus();
    }catch(e){}

    try{
      el.scrollIntoView({ behavior:"smooth", block:"center" });
    }catch(e){}
  };

  /* =========================================================
     STRING / NUMBER HELPERS
  ========================================================= */

  U.escapeHtml = function escapeHtml(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  U.stripInternalVersionText = function stripInternalVersionText(text){
    return String(text ?? "")
      .replace(/\bv\d+\.\d+(\.\d+)?\b/gi, "")
      .replace(/\bv20\d{6,}[-_a-z0-9]*\b/gi, "")
      .replace(/\bpatch[_ -]?version\b/gi, "")
      .replace(/\bvocab[_ -]?version\b/gi, "")
      .replace(/\brelease[_ -]?pack\b/gi, "")
      .replace(/\bsource[_ -]?guard\b/gi, "")
      .replace(/\bdebug[_ -]?build\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  U.num = function num(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  U.int = function int(v, fallback = 0){
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  U.round = function round(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };

  U.clamp = function clamp(v, min, max){
    return Math.max(min, Math.min(max, Number(v) || 0));
  };

  U.percent = function percent(part, total){
    part = Number(part) || 0;
    total = Number(total) || 0;
    if(total <= 0) return 0;
    return Math.round((part / total) * 100);
  };

  U.fmt = function fmt(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return "0";
    return String(Math.round(n));
  };

  U.pad2 = function pad2(v){
    return String(v).padStart(2, "0");
  };

  /* =========================================================
     SAFE JSON / LOCAL STORAGE
  ========================================================= */

  U.readJson = function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  };

  U.writeJson = function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.warn("[VOCAB] writeJson failed", key, e);
      return false;
    }
  };

  U.removeStorage = function removeStorage(key){
    try{
      localStorage.removeItem(key);
      return true;
    }catch(e){
      return false;
    }
  };

  U.getStorage = function getStorage(key, fallback = ""){
    try{
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    }catch(e){
      return fallback;
    }
  };

  U.setStorage = function setStorage(key, value){
    try{
      localStorage.setItem(key, String(value));
      return true;
    }catch(e){
      return false;
    }
  };

  U.pushLocalLog = function pushLocalLog(key, payload, maxRows = 500){
    try{
      const list = U.readJson(key, []);
      list.push(payload);
      U.writeJson(key, list.slice(-maxRows));
      return true;
    }catch(e){
      console.warn("[VOCAB] pushLocalLog failed", key, e);
      return false;
    }
  };

  /* =========================================================
     URL / PARAM HELPERS
  ========================================================= */

  U.getParam = function getParam(name, fallback = ""){
    try{
      const url = new URL(location.href);
      return url.searchParams.get(name) || fallback;
    }catch(e){
      return fallback;
    }
  };

  U.hasParamOn = function hasParamOn(names){
    try{
      const p = new URLSearchParams(location.search);

      for(const name of names){
        const v = String(p.get(name) || "").toLowerCase();
        if(v === "1" || v === "true" || v === "yes" || v === "on"){
          return true;
        }
      }

      return false;
    }catch(e){
      return false;
    }
  };

  U.buildEndpoint = function buildEndpoint(url, apiName = "vocab"){
    url = String(url || "").trim();
    if(!url) return "";

    try{
      const u = new URL(url, location.href);
      if(apiName && !u.searchParams.get("api")){
        u.searchParams.set("api", apiName);
      }
      return u.toString();
    }catch(e){
      if(!apiName) return url;
      return url.includes("?") ? `${url}&api=${encodeURIComponent(apiName)}` : `${url}?api=${encodeURIComponent(apiName)}`;
    }
  };

  U.copyText = function copyText(text){
    text = String(text || "");

    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        ok ? resolve() : reject(new Error("copy failed"));
      }catch(e){
        reject(e);
      }
    });
  };

  /* =========================================================
     TIME HELPERS
  ========================================================= */

  U.nowIso = function nowIso(){
    return new Date().toISOString();
  };

  U.bangkokIsoNow = function bangkokIsoNow(){
    const d = new Date();
    const bangkokMs = d.getTime() + (7 * 60 * 60 * 1000);
    const b = new Date(bangkokMs);

    return (
      b.getUTCFullYear() + "-" +
      U.pad2(b.getUTCMonth() + 1) + "-" +
      U.pad2(b.getUTCDate()) + "T" +
      U.pad2(b.getUTCHours()) + ":" +
      U.pad2(b.getUTCMinutes()) + ":" +
      U.pad2(b.getUTCSeconds()) +
      "+07:00"
    );
  };

  U.todayKey = function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}-${U.pad2(d.getDate())}`;
  };

  U.yesterdayKey = function yesterdayKey(){
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}-${U.pad2(d.getDate())}`;
  };

  U.weekKey = function weekKey(){
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const day = Math.floor((d - start) / 86400000);
    const week = Math.ceil((day + start.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${U.pad2(week)}`;
  };

  /* =========================================================
     HASH / RANDOM / SHUFFLE
  ========================================================= */

  U.hashString = function hashString(str){
    let h = 2166136261;
    str = String(str || "vocab");

    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return Math.abs(h) || 1;
  };

  U.initSeed = function initSeed(seedValue){
    const quality = window.VOCAB_QUALITY || {};

    try{
      const seed =
        seedValue ||
        U.getParam("seed") ||
        localStorage.getItem("VOCAB_SEED") ||
        String(Date.now());

      quality.rngSeed = U.hashString(seed);
      localStorage.setItem("VOCAB_SEED", seed);
    }catch(e){
      quality.rngSeed = Date.now() % 2147483647;
    }

    if(window.VOCAB_QUALITY){
      window.VOCAB_QUALITY.rngSeed = quality.rngSeed;
    }

    return quality.rngSeed;
  };

  U.rand = function rand(){
    const quality = window.VOCAB_QUALITY || {};

    if(!quality.rngSeed){
      U.initSeed();
    }

    quality.rngSeed = (quality.rngSeed * 48271) % 2147483647;

    if(window.VOCAB_QUALITY){
      window.VOCAB_QUALITY.rngSeed = quality.rngSeed;
    }

    return quality.rngSeed / 2147483647;
  };

  U.randInt = function randInt(min, max){
    min = Number(min) || 0;
    max = Number(max) || 0;
    if(max < min){
      const t = min;
      min = max;
      max = t;
    }
    return min + Math.floor(U.rand() * (max - min + 1));
  };

  U.pick = function pick(list, fallback = null){
    if(!Array.isArray(list) || !list.length) return fallback;
    return list[Math.floor(U.rand() * list.length)];
  };

  U.shuffle = function shuffle(arr){
    const a = Array.isArray(arr) ? [...arr] : [];

    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(U.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
  };

  /* =========================================================
     TERM / VOCAB HELPERS
  ========================================================= */

  U.normalizeTerm = function normalizeTerm(t){
    return {
      term: String(t?.term || t?.word || "").trim(),
      meaning: String(t?.meaning || t?.definition || t?.th || t?.translation || "").trim(),
      category: String(t?.category || t?.group || t?.type || "").trim(),
      example: String(t?.example || t?.sentence || "").trim(),
      level: String(t?.level || "").trim(),
      bank: String(t?.bank || "").trim()
    };
  };

  U.termKey = function termKey(s){
    return String(s || "").trim().toLowerCase();
  };

  U.getTermsForBank = function getTermsForBank(bank){
    const banks = window.VOCAB_BANKS || {};
    const list = banks[bank] || banks.A || [];

    return list
      .map(t => U.normalizeTerm({ ...t, bank }))
      .filter(t => t.term && t.meaning);
  };

  U.getAllTerms = function getAllTerms(){
    const banks = window.VOCAB_BANKS || {};
    const out = [];

    Object.keys(banks).forEach(bank => {
      (banks[bank] || []).forEach(t => {
        const nt = U.normalizeTerm({ ...t, bank });
        if(nt.term && nt.meaning) out.push(nt);
      });
    });

    return out;
  };

  U.uniqueTerms = function uniqueTerms(list){
    const seen = new Set();

    return (Array.isArray(list) ? list : [])
      .map(U.normalizeTerm)
      .filter(t => {
        const k = U.termKey(t.term);
        if(!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  };

  U.tokenizeMeaning = function tokenizeMeaning(s){
    const stop = new Set([
      "the","and","for","with","that","this","from","into","your","you","are","can","will",
      "a","an","to","of","or","in","on","as","by","is","be","it","its","using","used",
      "คือ","การ","ของ","และ","ใน","ที่","เป็น","ใช้","หรือ","ให้","ได้","เพื่อ"
    ]);

    return String(s || "")
      .toLowerCase()
      .replace(/[^\w\sก-๙]/g, " ")
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length > 2 && !stop.has(x));
  };

  U.sharedKeywordCount = function sharedKeywordCount(a, b){
    const aw = U.tokenizeMeaning(a);
    const bw = new Set(U.tokenizeMeaning(b));

    let count = 0;
    aw.forEach(x => {
      if(bw.has(x)) count++;
    });

    return count;
  };

  /* =========================================================
     APP / MODE / DIFFICULTY HELPERS
  ========================================================= */

  U.getDifficulty = function getDifficulty(id){
    const d = window.VOCAB_DIFFICULTY || {};
    return d[id || "easy"] || d.easy || {};
  };

  U.getMode = function getMode(id){
    const m = window.VOCAB_PLAY_MODES || {};
    return m[id || "learn"] || m.learn || {};
  };

  U.getEnemy = function getEnemy(bank){
    const e = window.VOCAB_ENEMIES || {};
    return e[bank || "A"] || e.A || {};
  };

  U.getStage = function getStage(stageId){
    const stages = window.VOCAB_STAGES || [];
    return stages.find(s => s.id === stageId) || stages[0] || {};
  };

  U.modeIcon = function modeIcon(mode){
    const m = String(mode || "").toLowerCase();

    if(m === "speed") return "⚡";
    if(m === "mission") return "🎯";
    if(m === "battle") return "👾";
    if(m === "bossrush") return "💀";

    return "🤖";
  };

  U.nextDifficulty = function nextDifficulty(diff, accuracy){
    diff = String(diff || "normal").toLowerCase();
    accuracy = Number(accuracy || 0);

    if(accuracy >= 95){
      if(diff === "easy") return "normal";
      if(diff === "normal") return "hard";
      if(diff === "hard") return "challenge";
      return "challenge";
    }

    if(accuracy >= 85){
      if(diff === "easy") return "normal";
      if(diff === "normal") return "hard";
      return diff || "normal";
    }

    if(accuracy < 60){
      return "easy";
    }

    return diff || "normal";
  };

  U.nextMode = function nextMode(mode, accuracy){
    mode = String(mode || "learn").toLowerCase();
    accuracy = Number(accuracy || 0);

    if(mode === "learn" && accuracy >= 80) return "mission";
    if(mode === "speed" && accuracy >= 80) return "mission";
    if(mode === "mission" && accuracy >= 80) return "battle";
    if(mode === "battle" && accuracy >= 90) return "bossrush";

    if(accuracy >= 90) return "mission";
    if(accuracy >= 75) return "speed";

    return "learn";
  };

  /* =========================================================
     UI CLEANUP HELPERS
  ========================================================= */

  U.removeNodes = function removeNodes(selectors){
    (selectors || []).forEach(sel => {
      U.qsa(sel).forEach(node => {
        try{ node.remove(); }catch(e){}
      });
    });
  };

  U.cleanFx = function cleanFx(){
    U.removeNodes([
      ".v6-float",
      ".v6-laser-beam",
      ".v6-fx-burst",
      ".v72-announcer",
      ".v72-flash",
      ".v72-particle",
      ".v74-toast",
      ".v78-guard-toast"
    ]);

    document.body.classList.remove(
      "v72-screen-shake",
      "v72-hard-hit",
      "v72-boss-rage",
      "v72-fever-rainbow",
      "v73-final-lock"
    );
  };

  U.setScreenVisible = function setScreenVisible(node, visible, displayValue){
    if(!node) return;

    node.hidden = !visible;
    node.style.display = visible ? (displayValue || "") : "none";
    node.style.pointerEvents = visible ? "auto" : "none";
  };

  U.showOnlyMenu = function showOnlyMenu(){
    U.setScreenVisible(U.byId("v6BattlePanel"), false);
    U.setScreenVisible(U.byId("v6RewardPanel"), false);
    U.setScreenVisible(U.byId("v6MenuPanel"), true, "");
    U.scrollTop();
  };

  U.showOnlyBattle = function showOnlyBattle(){
    U.setScreenVisible(U.byId("v6MenuPanel"), false);
    U.setScreenVisible(U.byId("v6RewardPanel"), false);
    U.setScreenVisible(U.byId("v6BattlePanel"), true, "");
    U.scrollTop();
  };

  U.showOnlyReward = function showOnlyReward(){
    U.setScreenVisible(U.byId("v6MenuPanel"), false);
    U.setScreenVisible(U.byId("v6BattlePanel"), false);
    U.setScreenVisible(U.byId("v6RewardPanel"), true, "block");
    U.scrollTop();
  };

  /* =========================================================
     EXPORT GLOBALS — compatibility aliases
  ========================================================= */

  window.VocabUtils = U;

  window.byId = window.byId || U.byId;
  window.escapeHtmlV6 = window.escapeHtmlV6 || U.escapeHtml;
  window.readJsonV63 = window.readJsonV63 || U.readJson;
  window.getV63Param = window.getV63Param || U.getParam;
  window.hashStringV61 = window.hashStringV61 || U.hashString;
  window.initVocabV61Seed = window.initVocabV61Seed || U.initSeed;
  window.randV61 = window.randV61 || U.rand;
  window.shuffleV61 = window.shuffleV61 || U.shuffle;
  window.shuffleV6 = window.shuffleV6 || U.shuffle;
  window.normalizeTermV61 = window.normalizeTermV61 || U.normalizeTerm;
  window.tokenizeMeaningV61 = window.tokenizeMeaningV61 || U.tokenizeMeaning;
  window.sharedKeywordCountV61 = window.sharedKeywordCountV61 || U.sharedKeywordCount;

  console.log("[VOCAB] utils loaded", window.VOCAB_APP?.version || "");

})();
