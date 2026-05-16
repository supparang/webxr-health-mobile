/* =========================================================
   /vocab/vocab.guard.js
   TechPath Vocab Arena — Classroom Source Guard
   FULL CLEAN PATCH: v20260503y

   Purpose:
   - classroom-level copy/source protection
   - block common shortcuts: Ctrl+U, Ctrl+S, Ctrl+Shift+I, F12
   - block right click / copy / cut / drag
   - do NOT block gameplay buttons, choices, form inputs
   - do NOT break mobile tapping
   - bypass with ?guard=0 or ?debug=1

   Note:
   Frontend source cannot be protected 100%.
   This is classroom deterrence only.
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-guard-v20260503y";

  const CONFIG = {
    enabled: true,
    blockContextMenu: true,
    blockCopy: true,
    blockCut: true,
    blockDrag: true,
    blockSelect: true,
    blockPrint: true,
    blockSave: true,
    blockViewSource: true,
    blockDevtoolsKeys: true,
    showToast: true,
    toastMs: 1800
  };

  let toastTimer = null;
  let lastToastAt = 0;

  /* =========================================================
     HELPERS
  ========================================================= */

  function log(){
    try{
      console.log.apply(console, ["[VOCAB GUARD]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function warn(){
    try{
      console.warn.apply(console, ["[VOCAB GUARD]"].concat(Array.from(arguments)));
    }catch(e){}
  }

  function getParam(name){
    try{
      return new URLSearchParams(location.search).get(name) || "";
    }catch(e){
      return "";
    }
  }

  function isBypassed(){
    const guard = String(getParam("guard") || "").toLowerCase();
    const debug = String(getParam("debug") || "").toLowerCase();
    const dev = String(getParam("dev") || "").toLowerCase();

    return (
      guard === "0" ||
      guard === "off" ||
      debug === "1" ||
      debug === "true" ||
      dev === "1" ||
      dev === "true"
    );
  }

  function closest(el, selector){
    try{
      return el && el.closest ? el.closest(selector) : null;
    }catch(e){
      return null;
    }
  }

  function isEditableTarget(target){
    if(!target) return false;

    const tag = String(target.tagName || "").toLowerCase();

    if(["input", "textarea", "select", "option"].includes(tag)){
      return true;
    }

    if(target.isContentEditable){
      return true;
    }

    if(closest(target, "[contenteditable='true']")){
      return true;
    }

    if(closest(target, ".vocab-input")){
      return true;
    }

    return false;
  }

  function isGameplayTarget(target){
    if(!target) return false;

    /*
      อย่าบล็อกปุ่มเล่นเกม ตัวเลือก คำตอบ ปุ่มเริ่ม ปุ่ม reward
    */
    return !!closest(
      target,
      [
        "button",
        "a",
        "[role='button']",
        "[data-vocab-choice]",
        "[data-vocab-bank]",
        "[data-vocab-diff]",
        "[data-vocab-mode]",
        "[data-lb-mode]",
        "#vocabStartBtn",
        "#vocabHintBtn",
        "#vocabAiHelpBtn",
        "#vocabPlayAgainBtn",
        "#vocabBackMenuBtn",
        ".vocab-choice",
        ".vocab-pill",
        ".vocab-select-card",
        ".vocab-mode-card",
        ".vocab-start-btn",
        ".vocab-power-btn",
        ".vocab-reward-btn",
        ".vocab-lb-tab"
      ].join(",")
    );
  }

  function shouldAllowEvent(ev){
    const target = ev && ev.target;

    if(isEditableTarget(target)) return true;
    if(isGameplayTarget(target)) return true;

    return false;
  }

  function prevent(ev, message){
    if(!ev) return false;

    try{
      ev.preventDefault();
      ev.stopPropagation();

      if(typeof ev.stopImmediatePropagation === "function"){
        ev.stopImmediatePropagation();
      }
    }catch(e){}

    showToast(message || "โหมดห้องเรียน: ไม่อนุญาตให้คัดลอกเนื้อหา");

    return false;
  }

  /* =========================================================
     TOAST
  ========================================================= */

  function ensureToastCss(){
    if(DOC.getElementById("vocabGuardCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabGuardCss";
    style.textContent = `
      .vocab-guard-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        z-index:9999999;
        transform:translateX(-50%) translateY(18px);
        max-width:min(92vw,560px);
        padding:12px 16px;
        border-radius:999px;
        background:rgba(7,17,31,.94);
        border:1px solid rgba(255,255,255,.18);
        color:#eef7ff;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size:14px;
        font-weight:900;
        line-height:1.35;
        text-align:center;
        box-shadow:0 18px 54px rgba(0,0,0,.35);
        opacity:0;
        pointer-events:none;
        transition:opacity .18s ease, transform .18s ease;
        backdrop-filter:blur(14px);
      }

      .vocab-guard-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }

      body.vocab-guard-noselect,
      body.vocab-guard-noselect *:not(input):not(textarea):not(select):not(option){
        -webkit-user-select:none;
        user-select:none;
        -webkit-touch-callout:none;
      }

      body.vocab-guard-noselect input,
      body.vocab-guard-noselect textarea{
        -webkit-user-select:text;
        user-select:text;
      }

      @media(max-width:560px){
        .vocab-guard-toast{
          border-radius:22px;
          font-size:13px;
          padding:11px 14px;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function showToast(message){
    if(!CONFIG.showToast) return;

    const now = Date.now();

    /*
      กัน toast เด้งถี่เกิน
    */
    if(now - lastToastAt < 500) return;
    lastToastAt = now;

    ensureToastCss();

    let toast = DOC.getElementById("vocabGuardToast");

    if(!toast){
      toast = DOC.createElement("div");
      toast.id = "vocabGuardToast";
      toast.className = "vocab-guard-toast";
      DOC.body.appendChild(toast);
    }

    toast.textContent = message || "โหมดห้องเรียน: ไม่อนุญาตให้คัดลอกเนื้อหา";
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(function(){
      toast.classList.remove("show");
    }, CONFIG.toastMs);
  }

  /* =========================================================
     EVENT BLOCKERS
  ========================================================= */

  function onContextMenu(ev){
    if(!CONFIG.blockContextMenu) return true;
    if(shouldAllowEvent(ev)) return true;

    return prevent(ev, "โหมดห้องเรียน: ปิดเมนูคลิกขวาระหว่างทำกิจกรรม");
  }

  function onCopy(ev){
    if(!CONFIG.blockCopy) return true;
    if(shouldAllowEvent(ev)) return true;

    return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้คัดลอกโจทย์/คำตอบ");
  }

  function onCut(ev){
    if(!CONFIG.blockCut) return true;
    if(shouldAllowEvent(ev)) return true;

    return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้ตัด/คัดลอกเนื้อหา");
  }

  function onDragStart(ev){
    if(!CONFIG.blockDrag) return true;
    if(shouldAllowEvent(ev)) return true;

    return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้ลากเนื้อหาออกจากหน้าเกม");
  }

  function onSelectStart(ev){
    if(!CONFIG.blockSelect) return true;
    if(shouldAllowEvent(ev)) return true;

    /*
      มือถือ/desktop: กันลาก select ที่โจทย์ แต่ไม่กันปุ่ม
    */
    return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้เลือกคัดลอกข้อความ");
  }

  function isMac(){
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
  }

  function shortcutPressed(ev, key){
    key = String(key || "").toLowerCase();
    const k = String(ev.key || "").toLowerCase();

    return k === key;
  }

  function hasCtrlOrMeta(ev){
    return isMac() ? ev.metaKey : ev.ctrlKey;
  }

  function onKeyDown(ev){
    if(!ev) return true;

    if(isEditableTarget(ev.target)){
      /*
        ให้กรอกข้อมูลนักศึกษาได้ปกติ
        แต่ยังกัน Ctrl+U/F12 แม้อยู่ใน input
      */
      const k = String(ev.key || "").toLowerCase();

      if(k !== "f12" && !(hasCtrlOrMeta(ev) && ["u", "s", "p"].includes(k)) && !(hasCtrlOrMeta(ev) && ev.shiftKey && ["i", "j", "c"].includes(k))){
        return true;
      }
    }

    const key = String(ev.key || "").toLowerCase();

    /*
      F12
    */
    if(CONFIG.blockDevtoolsKeys && key === "f12"){
      return prevent(ev, "โหมดห้องเรียน: ปิดเครื่องมือสำหรับดู source ระหว่างทำกิจกรรม");
    }

    /*
      Ctrl/Cmd + U = view source
    */
    if(CONFIG.blockViewSource && hasCtrlOrMeta(ev) && shortcutPressed(ev, "u")){
      return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้เปิด source code");
    }

    /*
      Ctrl/Cmd + S = save page
    */
    if(CONFIG.blockSave && hasCtrlOrMeta(ev) && shortcutPressed(ev, "s")){
      return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้บันทึกหน้าเว็บ");
    }

    /*
      Ctrl/Cmd + P = print
    */
    if(CONFIG.blockPrint && hasCtrlOrMeta(ev) && shortcutPressed(ev, "p")){
      return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้พิมพ์/บันทึกเนื้อหา");
    }

    /*
      Ctrl/Cmd + Shift + I/J/C = DevTools
    */
    if(
      CONFIG.blockDevtoolsKeys &&
      hasCtrlOrMeta(ev) &&
      ev.shiftKey &&
      ["i", "j", "c"].includes(key)
    ){
      return prevent(ev, "โหมดห้องเรียน: ปิดเครื่องมือสำหรับดู source ระหว่างทำกิจกรรม");
    }

    /*
      Ctrl/Cmd + C/X/A เฉพาะนอก input/gameplay
    */
    if(
      hasCtrlOrMeta(ev) &&
      ["c", "x", "a"].includes(key) &&
      !shouldAllowEvent(ev)
    ){
      return prevent(ev, "โหมดห้องเรียน: ไม่อนุญาตให้คัดลอกหรือเลือกข้อความทั้งหมด");
    }

    return true;
  }

  /* =========================================================
     LIGHT DEVTOOLS DETECTION
     ไม่ล็อกเกม ไม่ redirect แค่เตือน
  ========================================================= */

  let devtoolsWarned = false;

  function startLightDevtoolsWatch(){
    /*
      ใช้แบบเบา ๆ เพื่อไม่ทำให้เกมค้างหรือกิน CPU
    */
    setInterval(function(){
      try{
        const threshold = 170;
        const widthDiff = Math.abs(WIN.outerWidth - WIN.innerWidth);
        const heightDiff = Math.abs(WIN.outerHeight - WIN.innerHeight);

        if((widthDiff > threshold || heightDiff > threshold) && !devtoolsWarned){
          devtoolsWarned = true;
          showToast("โหมดห้องเรียน: โปรดปิด DevTools ระหว่างทำกิจกรรม");
        }

        if(widthDiff <= threshold && heightDiff <= threshold){
          devtoolsWarned = false;
        }
      }catch(e){}
    }, 2500);
  }

  /* =========================================================
     PUBLIC CONFIG
  ========================================================= */

  function setEnabled(value){
    CONFIG.enabled = !!value;

    if(CONFIG.enabled){
      DOC.body.classList.add("vocab-guard-noselect");
    }else{
      DOC.body.classList.remove("vocab-guard-noselect");
    }

    return CONFIG.enabled;
  }

  function updateConfig(next){
    Object.assign(CONFIG, next || {});
    setEnabled(CONFIG.enabled);
    return Object.assign({}, CONFIG);
  }

  function getConfig(){
    return Object.assign({}, CONFIG);
  }

  /* =========================================================
     INSTALL
  ========================================================= */

  function install(){
    if(isBypassed()){
      WIN.VocabGuard = {
        version: VERSION,
        enabled: false,
        bypassed: true,
        setEnabled,
        updateConfig,
        getConfig
      };

      WIN.VocabModules = WIN.VocabModules || {};
      WIN.VocabModules.guard = true;

      WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
      WIN.__VOCAB_MODULES__.guard = true;

      log("bypassed by query param", VERSION);
      return;
    }

    if(WIN.__VOCAB_GUARD_INSTALLED__){
      log("already installed");
      return;
    }

    WIN.__VOCAB_GUARD_INSTALLED__ = true;

    ensureToastCss();

    DOC.body.classList.add("vocab-guard-noselect");

    /*
      ใช้ capture=true เพื่อกัน browser action ให้ทัน
      แต่ shouldAllowEvent จะปล่อย input/gameplay
    */
    DOC.addEventListener("contextmenu", onContextMenu, true);
    DOC.addEventListener("copy", onCopy, true);
    DOC.addEventListener("cut", onCut, true);
    DOC.addEventListener("dragstart", onDragStart, true);
    DOC.addEventListener("selectstart", onSelectStart, true);
    WIN.addEventListener("keydown", onKeyDown, true);

    startLightDevtoolsWatch();

    WIN.VocabGuard = {
      version: VERSION,
      enabled: true,
      bypassed: false,
      setEnabled,
      updateConfig,
      getConfig,
      showToast
    };

    WIN.vocabGuard = WIN.VocabGuard;

    WIN.VocabModules = WIN.VocabModules || {};
    WIN.VocabModules.guard = true;

    WIN.__VOCAB_MODULES__ = WIN.__VOCAB_MODULES__ || {};
    WIN.__VOCAB_MODULES__.guard = true;

    log("loaded", VERSION);
  }

  if(DOC.readyState === "loading"){
    DOC.addEventListener("DOMContentLoaded", install, { once:true });
  }else{
    install();
  }
})();
