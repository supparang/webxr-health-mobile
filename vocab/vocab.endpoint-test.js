/* =========================================================
   /vocab/vocab.endpoint-test.js
   TechPath Vocab Arena — Endpoint Test UI
   PATCH: 2026-05-01
   ใช้สำหรับทดสอบ endpoint ล่าสุด
   แสดงเฉพาะเมื่อ URL มี ?qa=1 หรือ ?debug=1 หรือ ?teacher=1
   ========================================================= */

(function(){
  "use strict";

  function id(x){
    return document.getElementById(x);
  }

  function isQaMode(){
    try{
      const p = new URLSearchParams(location.search);
      return (
        p.get("qa") === "1" ||
        p.get("debug") === "1" ||
        p.get("teacher") === "1" ||
        p.get("admin") === "1"
      );
    }catch(e){
      return false;
    }
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function injectCss(){
    if(id("vocabEndpointTestCss")) return;

    const css = document.createElement("style");
    css.id = "vocabEndpointTestCss";
    css.textContent = `
      .vocab-endpoint-test{
        border:1px solid rgba(89,208,255,.35);
        background:
          radial-gradient(circle at top left, rgba(89,208,255,.15), transparent 34%),
          rgba(255,255,255,.075);
      }

      .vocab-endpoint-test pre{
        white-space:pre-wrap;
        word-break:break-word;
        padding:12px;
        border-radius:16px;
        background:rgba(0,0,0,.22);
        border:1px solid rgba(255,255,255,.12);
        color:#dff7ff;
        font-size:12px;
        line-height:1.45;
      }

      .vocab-endpoint-row{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        align-items:center;
      }

      .vocab-endpoint-btn{
        appearance:none;
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.09);
        color:#eef7ff;
        border-radius:999px;
        padding:10px 14px;
        font:inherit;
        font-weight:1000;
        cursor:pointer;
      }

      .vocab-endpoint-btn.primary{
        background:linear-gradient(135deg,#59d0ff,#8b5cf6);
        border:0;
      }

      .vocab-endpoint-status{
        margin-top:10px;
        color:#a8bdd6;
        font-weight:850;
        line-height:1.45;
      }
    `;

    document.head.appendChild(css);
  }

  function injectPanel(){
    if(!isQaMode()) return;
    if(id("vocabEndpointTestPanel")) return;

    const menuGrid = document.querySelector("#v6MenuPanel .v6-menu-grid");
    if(!menuGrid) return;

    injectCss();

    const endpoint = window.VocabLogger
      ? window.VocabLogger.getEndpoint()
      : window.VOCAB_SHEET_ENDPOINT || "";

    const panel = document.createElement("section");
    panel.id = "vocabEndpointTestPanel";
    panel.className = "v6-card v6-wide vocab-endpoint-test";
    panel.innerHTML = `
      <h2>🧪 Vocab Endpoint Test</h2>
      <p class="v63-note">
        ใช้ตรวจว่า frontend ส่งข้อมูลไป Google Apps Script endpoint ล่าสุดได้หรือไม่
      </p>

      <pre id="vocabEndpointText">${esc(endpoint)}</pre>

      <div class="vocab-endpoint-row">
        <button id="vocabEndpointTestBtn" class="vocab-endpoint-btn primary" type="button">
          🚀 Send Test Log
        </button>

        <button id="vocabEndpointCopyBtn" class="vocab-endpoint-btn" type="button">
          🔗 Copy Endpoint
        </button>
      </div>

      <div id="vocabEndpointStatus" class="vocab-endpoint-status">
        พร้อมทดสอบ endpoint
      </div>
    `;

    menuGrid.appendChild(panel);

    const testBtn = id("vocabEndpointTestBtn");
    const copyBtn = id("vocabEndpointCopyBtn");
    const status = id("vocabEndpointStatus");

    if(testBtn){
      testBtn.addEventListener("click", function(){
        if(!window.VocabLogger){
          status.textContent = "❌ ไม่พบ VocabLogger";
          return;
        }

        const payload = window.VocabLogger.testEndpoint();

        status.innerHTML =
          "✅ ส่ง test log แล้ว<br>" +
          "action: <b>manual_endpoint_test</b><br>" +
          "session_id: <b>" + esc(payload.session_id || "") + "</b><br>" +
          "หมายเหตุ: no-cors จะอ่าน response ไม่ได้ แต่ถ้า Apps Script ถูกต้อง ข้อมูลจะเข้า Sheet";
      });
    }

    if(copyBtn){
      copyBtn.addEventListener("click", function(){
        const text = endpoint;

        navigator.clipboard.writeText(text).then(function(){
          status.textContent = "✅ คัดลอก endpoint แล้ว";
        }).catch(function(){
          prompt("Copy endpoint", text);
        });
      });
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){
      setTimeout(injectPanel, 500);
    }, { once:true });
  }else{
    setTimeout(injectPanel, 500);
  }

  console.log("[VOCAB ENDPOINT TEST] loaded");
})();
