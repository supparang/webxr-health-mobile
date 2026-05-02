/* =========================================================
   /vocab/vocab.guard.js
   TechPath Vocab Arena — Source Copy Guard
   Version: 20260502a

   Purpose:
   - Reduce casual copying of source/content
   - Block right click / select / copy / print / save / view-source shortcuts
   - Soft-detect DevTools open
   - Allow typing in input/textarea/select
   - Teacher/Admin can disable by URL:
       ?guard=off
       ?source_guard=off
       ?teacher=1
       ?admin=1
       ?qa=1
       ?debug=1

   Important:
   - Static web apps cannot hide HTML/CSS/JS source 100%.
   - This file is deterrence + classroom protection, not real DRM.
   ========================================================= */

(function(){
  "use strict";

  const GUARD = {
    version: "20260502a",
    logKey: "VOCAB_SOURCE_GUARD_LOG",
    maxLog: 160,
    watermarkText: "TechPath Vocab Arena • Protected Classroom",
    toastMs: 2600,
    devtoolsThreshold: 180
  };

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function id(x){
    return document.getElementById(x);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function readJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
    }catch(e){}
  }

  function getParam(name){
    try{
      return new URL(location.href).searchParams.get(name) || "";
    }catch(e){
      return "";
    }
  }

  function isTruthyParam(name){
    const v = String(getParam(name) || "").toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  }

  function isTeacherOrDebugMode(){
    return (
      isTruthyParam("teacher") ||
      isTruthyParam("admin") ||
      isTruthyParam("qa") ||
      isTruthyParam("debug")
    );
  }

  function guardDisabled(){
    return (
      window.VOCAB_SOURCE_GUARD_DISABLE === true ||
      String(getParam("guard")).toLowerCase() === "off" ||
      String(getParam("source_guard")).toLowerCase() === "off" ||
      isTeacherOrDebugMode()
    );
  }

  function isEditableTarget(el){
    if(!el) return false;

    const tag = String(el.tagName || "").toLowerCase();

    return (
      el.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      Boolean(el.closest && el.closest("[data-allow-copy='1']")) ||
      Boolean(el.closest && el.closest("[data-vocab-allow-copy='1']"))
    );
  }

  function localLog(action, extra){
    const payload = Object.assign({
      timestamp: nowIso(),
      action,
      guardVersion: GUARD.version,
      pageUrl: location.href,
      userAgent: navigator.userAgent || "",
      enabled: guardDisabled() ? 0 : 1
    }, extra || {});

    try{
      const list = readJson(GUARD.logKey, []);
      list.push(payload);
      writeJson(GUARD.logKey, list.slice(-GUARD.maxLog));
    }catch(e){}

    try{
      if(typeof window.logVocabEventV6 === "function"){
        window.logVocabEventV6("source_guard", {
          source_guard_action: action,
          source_guard_version: GUARD.version,
          source_guard_enabled: guardDisabled() ? 0 : 1,
          source_guard_extra: JSON.stringify(extra || {})
        });
      }
    }catch(e){}

    return payload;
  }

  function injectCss(){
    if(id("vocabGuardCss")) return;

    const css = document.createElement("style");
    css.id = "vocabGuardCss";
    css.textContent = `
      body.vocab-guard-no-select,
      body.vocab-guard-no-select *{
        -webkit-user-select:none !important;
        user-select:none !important;
        -webkit-touch-callout:none !important;
      }

      body.vocab-guard-no-select input,
      body.vocab-guard-no-select textarea,
      body.vocab-guard-no-select select,
      body.vocab-guard-no-select [contenteditable="true"],
      body.vocab-guard-no-select [data-allow-copy="1"],
      body.vocab-guard-no-select [data-vocab-allow-copy="1"],
      body.vocab-guard-no-select [data-allow-copy="1"] *,
      body.vocab-guard-no-select [data-vocab-allow-copy="1"] *{
        -webkit-user-select:text !important;
        user-select:text !important;
        -webkit-touch-callout:default !important;
      }

      .vocab-guard-watermark{
        position:fixed;
        right:12px;
        top:12px;
        z-index:2147483000;
        pointer-events:none;
        opacity:.34;
        padding:7px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(4,10,20,.36);
        color:#eef7ff;
        font:900 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        letter-spacing:.03em;
        text-transform:uppercase;
        backdrop-filter:blur(8px);
      }

      body.vocab-guard-devtools-warning .vocab-guard-watermark{
        opacity:.9;
        color:#fff3bf;
        border-color:rgba(255,209,102,.42);
        background:rgba(255,209,102,.15);
      }

      .vocab-guard-toast{
        position:fixed;
        right:14px;
        bottom:14px;
        z-index:2147483647;
        width:min(430px, calc(100vw - 28px));
        padding:14px 16px;
        border-radius:22px;
        border:1px solid rgba(255,255,255,.20);
        background:
          radial-gradient(circle at top left, rgba(89,208,255,.22), transparent 36%),
          rgba(4,10,20,.94);
        color:#eef7ff;
        font:900 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 54px rgba(0,0,0,.38);
        backdrop-filter:blur(16px);
        animation:vocabGuardToastIn .22s ease both;
      }

      .vocab-guard-toast b{
        color:#ffd166;
      }

      @keyframes vocabGuardToastIn{
        from{ opacity:0; transform:translateY(14px) scale(.97); }
        to{ opacity:1; transform:translateY(0) scale(1); }
      }

      @media(max-width:560px){
        .vocab-guard-watermark{
          top:auto;
          right:8px;
          bottom:62px;
          font-size:10px;
          opacity:.28;
        }

        .vocab-guard-toast{
          right:8px;
          bottom:8px;
          width:calc(100vw - 16px);
          border-radius:18px;
        }
      }

      @media print{
        body.vocab-guard-print-block *{
          visibility:hidden !important;
        }

        body.vocab-guard-print-block::before{
          content:"Protected classroom build — printing is disabled.";
          visibility:visible !important;
          display:block;
          padding:32px;
          color:#111827;
          background:#ffffff;
          font:800 22px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }
      }
    `;

    document.head.appendChild(css);
  }

  function addWatermark(){
    if(id("vocabGuardWatermark")) return;

    const mark = document.createElement("div");
    mark.id = "vocabGuardWatermark";
    mark.className = "vocab-guard-watermark";
    mark.textContent = GUARD.watermarkText;
    document.body.appendChild(mark);
  }

  function showToast(message, kind){
    let box = id("vocabGuardToast");

    if(!box){
      box = document.createElement("div");
      box.id = "vocabGuardToast";
      box.className = "vocab-guard-toast";
      document.body.appendChild(box);
    }

    const icon = kind === "warn" ? "⚠️" : "🔒";
    box.innerHTML = `${icon} <b>Protected Mode</b><br>${esc(message)}`;
    box.hidden = false;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      if(box) box.hidden = true;
    }, GUARD.toastMs);
  }

  function blockEvent(e, action, message){
    if(isEditableTarget(e.target)) return true;

    try{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }catch(err){}

    localLog(action, {
      key: e.key || "",
      code: e.code || "",
      ctrl: e.ctrlKey ? 1 : 0,
      meta: e.metaKey ? 1 : 0,
      shift: e.shiftKey ? 1 : 0,
      alt: e.altKey ? 1 : 0
    });

    showToast(message || "ระบบป้องกันการคัดลอกเนื้อหาและ source code ของเกม", "lock");
    return false;
  }

  function installPointerGuards(){
    window.addEventListener("contextmenu", function(e){
      return blockEvent(e, "contextmenu_blocked", "ปิดคลิกขวาเพื่อป้องกันการคัดลอก source code");
    }, true);

    window.addEventListener("dragstart", function(e){
      return blockEvent(e, "drag_blocked", "ปิดการลากคัดลอกเนื้อหาเกม");
    }, true);

    window.addEventListener("selectstart", function(e){
      if(isEditableTarget(e.target)) return true;
      return blockEvent(e, "select_blocked", "ปิดการลากเลือกข้อความในหน้าเกม");
    }, true);

    window.addEventListener("copy", function(e){
      if(isEditableTarget(e.target)) return true;

      try{
        e.clipboardData.setData("text/plain", "Protected classroom build: copying is disabled.");
      }catch(err){}

      return blockEvent(e, "copy_blocked", "ปิดการคัดลอกเนื้อหาในหน้าเกม");
    }, true);

    window.addEventListener("cut", function(e){
      if(isEditableTarget(e.target)) return true;
      return blockEvent(e, "cut_blocked", "ปิดการตัด/คัดลอกเนื้อหาในหน้าเกม");
    }, true);
  }

  function installKeyboardGuards(){
    window.addEventListener("keydown", function(e){
      if(isEditableTarget(e.target)) return true;

      const key = String(e.key || "").toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const devtoolsKeys =
        key === "f12" ||
        (ctrl && shift && ["i", "j", "c", "k"].includes(key));

      const sourceKeys =
        ctrl && ["u", "s", "p"].includes(key);

      const copyKeys =
        ctrl && ["a", "c", "x"].includes(key);

      if(devtoolsKeys){
        return blockEvent(e, "devtools_shortcut_blocked", "ปิด DevTools shortcut ในโหมดใช้งานจริง");
      }

      if(sourceKeys){
        return blockEvent(e, "source_shortcut_blocked", "ปิด View Source / Save / Print เพื่อป้องกันการคัดลอกไฟล์");
      }

      if(copyKeys){
        return blockEvent(e, "page_copy_shortcut_blocked", "ปิด shortcut คัดลอกเนื้อหาในหน้าเกม");
      }

      return true;
    }, true);
  }

  function installPrintGuard(){
    window.addEventListener("beforeprint", function(){
      document.body.classList.add("vocab-guard-print-block");

      localLog("print_blocked", {});
      showToast("ปิดการพิมพ์หน้าเกมใน Protected Mode", "lock");

      setTimeout(() => {
        document.body.classList.remove("vocab-guard-print-block");
      }, 1400);
    });
  }

  function installDevtoolsSoftDetect(){
    let lastOpen = false;

    setInterval(function(){
      if(guardDisabled()) return;

      const maybeOpen =
        Math.abs((window.outerWidth || 0) - (window.innerWidth || 0)) > GUARD.devtoolsThreshold ||
        Math.abs((window.outerHeight || 0) - (window.innerHeight || 0)) > GUARD.devtoolsThreshold;

      if(maybeOpen && !lastOpen){
        lastOpen = true;
        document.body.classList.add("vocab-guard-devtools-warning");

        localLog("devtools_soft_warning", {});
        showToast("ตรวจพบลักษณะการเปิดเครื่องมือนักพัฒนา ระบบบันทึกเหตุการณ์ไว้แล้ว", "warn");
      }else if(!maybeOpen && lastOpen){
        lastOpen = false;
        document.body.classList.remove("vocab-guard-devtools-warning");
      }
    }, 1500);
  }

  function exposeApi(){
    window.vocabSourceGuard = {
      version: GUARD.version,

      enabled(){
        return !guardDisabled();
      },

      logs(){
        return readJson(GUARD.logKey, []);
      },

      clearLogs(){
        localStorage.removeItem(GUARD.logKey);
        return true;
      },

      test(){
        localLog("manual_test", {});
        showToast("Source Guard ทำงานแล้ว: ปิด copy / right click / view-source shortcut", "lock");
        return true;
      }
    };
  }

  function boot(){
    injectCss();

    if(guardDisabled()){
      document.body.classList.remove("vocab-guard-no-select");
      localLog("guard_disabled", {
        teacherOrDebugMode: isTeacherOrDebugMode() ? 1 : 0
      });
      exposeApi();
      console.log("[VOCAB] source guard disabled");
      return;
    }

    document.body.classList.add("vocab-guard-no-select");

    addWatermark();
    installPointerGuards();
    installKeyboardGuards();
    installPrintGuard();
    installDevtoolsSoftDetect();
    exposeApi();

    localLog("guard_enabled", {});

    console.log("[VOCAB] source guard enabled", GUARD.version);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  }else{
    boot();
  }

})();
