/* =========================================================
   /vocab/vocab.guard.js
   TechPath Vocab Arena
   Source Guard / Copy Protection / Classroom Protection
   ========================================================= */
(function(){
  "use strict";

  const VOCAB_GUARD = {
    version: "vocab-guard-20260501",
    logKey: "VOCAB_GUARD_LOG",
    maxLog: 160,
    toastId: "vocabGuardToast",
    watermarkId: "vocabGuardWatermark",
    cssId: "vocabGuardCss"
  };

  function qs(sel, root){
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function byId(id){
    return document.getElementById(id);
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
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

  function getParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function isTeacherOrQaMode(){
    const keys = ["teacher", "admin", "qa", "debug", "guard"];
    for(const k of keys){
      const v = String(getParam(k, "")).toLowerCase();
      if(v === "1" || v === "true" || v === "yes" || v === "on"){
        return true;
      }
    }

    return false;
  }

  function guardDisabled(){
    const v1 = String(getParam("guard", "")).toLowerCase();
    const v2 = String(getParam("source_guard", "")).toLowerCase();

    return (
      window.VOCAB_SOURCE_GUARD_DISABLE === true ||
      v1 === "off" ||
      v1 === "0" ||
      v2 === "off" ||
      v2 === "0"
    );
  }

  function isEditableTarget(el){
    if(!el) return false;

    const tag = String(el.tagName || "").toLowerCase();

    return Boolean(
      el.isContentEditable ||
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      el.closest("[data-vocab-allow-copy='1']") ||
      el.closest("[data-v78-allow-copy='1']")
    );
  }

  function logGuard(action, extra){
    const payload = Object.assign({
      timestamp: nowIso(),
      action,
      page_url: location.href,
      user_agent: navigator.userAgent || "",
      guard_version: VOCAB_GUARD.version,
      guard_enabled: guardDisabled() ? 0 : 1
    }, extra || {});

    try{
      const list = readJson(VOCAB_GUARD.logKey, []);
      list.push(payload);
      writeJson(VOCAB_GUARD.logKey, list.slice(-VOCAB_GUARD.maxLog));
    }catch(e){}

    try{
      if(typeof window.logVocabEventV6 === "function"){
        window.logVocabEventV6("source_guard", payload);
      }
    }catch(e){}

    return payload;
  }

  function injectCss(){
    if(byId(VOCAB_GUARD.cssId)) return;

    const css = document.createElement("style");
    css.id = VOCAB_GUARD.cssId;
    css.textContent = `
      body.vocab-guard-on,
      body.vocab-guard-on .v6-app,
      body.vocab-guard-on .v6-card,
      body.vocab-guard-on .v6-question-card,
      body.vocab-guard-on .vocab-reward-shell,
      body.vocab-guard-on button,
      body.vocab-guard-on .v6-choice{
        -webkit-user-select:none !important;
        user-select:none !important;
        -webkit-touch-callout:none !important;
      }

      body.vocab-guard-on input,
      body.vocab-guard-on textarea,
      body.vocab-guard-on select,
      body.vocab-guard-on [contenteditable="true"],
      body.vocab-guard-on [data-vocab-allow-copy="1"],
      body.vocab-guard-on [data-v78-allow-copy="1"]{
        -webkit-user-select:text !important;
        user-select:text !important;
        -webkit-touch-callout:default !important;
      }

      .vocab-guard-toast{
        position:fixed;
        right:14px;
        bottom:14px;
        z-index:2147483647;
        width:min(420px, calc(100vw - 28px));
        padding:14px 16px;
        border-radius:22px;
        border:1px solid rgba(255,255,255,.20);
        background:
          radial-gradient(circle at top left, rgba(89,208,255,.22), transparent 36%),
          rgba(4,10,20,.94);
        color:#eef7ff;
        font-weight:950;
        line-height:1.45;
        box-shadow:0 18px 54px rgba(0,0,0,.38);
        backdrop-filter:blur(16px);
        animation:vocabGuardToastIn .22s ease both;
        pointer-events:none;
      }

      .vocab-guard-toast b{
        color:#ffd166;
      }

      .vocab-guard-watermark{
        position:fixed;
        right:14px;
        top:14px;
        z-index:99997;
        pointer-events:none;
        opacity:.34;
        padding:7px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background:rgba(4,10,20,.34);
        color:#eef7ff;
        font-size:11px;
        font-weight:1000;
        letter-spacing:.04em;
        text-transform:uppercase;
        backdrop-filter:blur(8px);
      }

      body.vocab-devtools-warning .vocab-guard-watermark{
        opacity:.9;
        color:#fff3bf;
        border-color:rgba(255,209,102,.36);
        background:rgba(255,209,102,.13);
      }

      @keyframes vocabGuardToastIn{
        from{ opacity:0; transform:translateY(14px) scale(.97); }
        to{ opacity:1; transform:translateY(0) scale(1); }
      }

      @media print{
        body.vocab-print-guard *{
          visibility:hidden !important;
        }

        body.vocab-print-guard::before{
          content:"Protected classroom build — printing is disabled.";
          visibility:visible !important;
          display:block;
          padding:32px;
          color:#111827;
          font:700 22px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }
      }

      @media(max-width:560px){
        .vocab-guard-watermark{
          top:auto;
          bottom:62px;
          right:8px;
          font-size:10px;
        }

        .vocab-guard-toast{
          right:8px;
          bottom:8px;
          width:calc(100vw - 16px);
          font-size:13px;
        }
      }
    `;

    document.head.appendChild(css);
  }

  function showToast(message, kind){
    let box = byId(VOCAB_GUARD.toastId);

    if(!box){
      box = document.createElement("div");
      box.id = VOCAB_GUARD.toastId;
      box.className = "vocab-guard-toast";
      document.body.appendChild(box);
    }

    const icon = kind === "warn" ? "⚠️" : kind === "ok" ? "✅" : "🔒";

    box.innerHTML = `${icon} <b>Protected Mode</b><br>${esc(message)}`;
    box.hidden = false;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      if(box) box.hidden = true;
    }, 2600);
  }

  function addWatermark(){
    if(byId(VOCAB_GUARD.watermarkId)) return;

    const mark = document.createElement("div");
    mark.id = VOCAB_GUARD.watermarkId;
    mark.className = "vocab-guard-watermark";
    mark.textContent = "Protected Classroom";
    document.body.appendChild(mark);
  }

  function blockEvent(e, action, message){
    if(isEditableTarget(e.target)) return true;

    try{
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }catch(err){}

    logGuard(action, {
      key: e.key || "",
      ctrl: e.ctrlKey ? 1 : 0,
      meta: e.metaKey ? 1 : 0,
      shift: e.shiftKey ? 1 : 0,
      alt: e.altKey ? 1 : 0
    });

    showToast(message || "ปิดการคัดลอกเนื้อหาและ source code ในโหมดใช้งานจริง", "lock");

    return false;
  }

  function installCopyProtection(){
    document.body.classList.add("vocab-guard-on");

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

    window.addEventListener("paste", function(e){
      /*
        อนุญาต paste เฉพาะ input ที่นักศึกษาต้องกรอก เช่น ชื่อ / รหัส / session code
      */
      if(isEditableTarget(e.target)) return true;

      return blockEvent(e, "paste_blocked", "ปิดการวางข้อความลงหน้าเกม");
    }, true);
  }

  function installShortcutProtection(){
    window.addEventListener("keydown", function(e){
      const key = String(e.key || "").toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const devToolsKeys =
        key === "f12" ||
        (ctrl && shift && ["i", "j", "c", "k"].includes(key));

      const sourceKeys =
        ctrl && ["u", "s", "p"].includes(key);

      const pageCopyKeys =
        ctrl && ["a", "c", "x"].includes(key) && !isEditableTarget(e.target);

      if(devToolsKeys){
        return blockEvent(e, "devtools_shortcut_blocked", "ปิด DevTools shortcut ในโหมดใช้งานจริง");
      }

      if(sourceKeys){
        return blockEvent(e, "source_shortcut_blocked", "ปิด View Source / Save / Print เพื่อป้องกันการคัดลอกไฟล์");
      }

      if(pageCopyKeys){
        return blockEvent(e, "page_copy_shortcut_blocked", "ปิด shortcut คัดลอกเนื้อหาในหน้าเกม");
      }

      return true;
    }, true);
  }

  function installPrintGuard(){
    window.addEventListener("beforeprint", function(){
      document.body.classList.add("vocab-print-guard");

      logGuard("print_blocked", {});
      showToast("ปิดการพิมพ์หน้าเกมใน Protected Mode", "lock");

      setTimeout(() => {
        document.body.classList.remove("vocab-print-guard");
      }, 1400);
    });
  }

  function installDevtoolsSoftWarning(){
    let lastState = false;

    setInterval(function(){
      if(guardDisabled()) return;

      const threshold = 180;

      const maybeOpen =
        Math.abs((window.outerWidth || 0) - (window.innerWidth || 0)) > threshold ||
        Math.abs((window.outerHeight || 0) - (window.innerHeight || 0)) > threshold;

      if(maybeOpen && !lastState){
        lastState = true;
        document.body.classList.add("vocab-devtools-warning");
        logGuard("devtools_soft_warning", {});
        showToast("ตรวจพบลักษณะการเปิดเครื่องมือนักพัฒนา ระบบบันทึกเหตุการณ์ไว้แล้ว", "warn");
      }else if(!maybeOpen && lastState){
        lastState = false;
        document.body.classList.remove("vocab-devtools-warning");
      }
    }, 1500);
  }

  function exposeGuardTools(){
    window.vocabGuardLog = function(){
      return readJson(VOCAB_GUARD.logKey, []);
    };

    window.resetVocabGuardLog = function(){
      localStorage.removeItem(VOCAB_GUARD.logKey);
      alert("Reset vocab guard log แล้ว");
    };

    window.vocabGuardTest = function(){
      logGuard("manual_test", {});
      showToast("Protected Mode ทำงานแล้ว", "ok");
      return true;
    };
  }

  function boot(){
    injectCss();

    if(guardDisabled()){
      logGuard("guard_disabled", {
        reason: "URL guard=off/source_guard=off or global flag"
      });
      console.log("[VOCAB GUARD] disabled by URL/global flag");
      return;
    }

    addWatermark();
    installCopyProtection();
    installShortcutProtection();
    installPrintGuard();
    installDevtoolsSoftWarning();
    exposeGuardTools();

    logGuard("guard_enabled", {
      teacher_or_qa_mode: isTeacherOrQaMode() ? 1 : 0
    });

    console.log("[VOCAB GUARD] enabled", VOCAB_GUARD.version);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, { once:true });
  }else{
    boot();
  }

})();
