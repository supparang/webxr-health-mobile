/* =========================================================
   EAP Word Quest • Mobile Summary Compact Pack
   File: /herohealth/eap-word-quest/eap-word-engine-v210-mobile-summary-pack.js
   Version: v2.1.0-MOBILE-SUMMARY-COMPACT-122

   Student-facing summary polish:
   - Turns vertical mobile stats into a readable 2-column grid.
   - Uses Thai labels for summary metrics.
   - Removes one duplicate explanatory box already covered by XP + Arc cards.
   - Makes AI guidance concise on a small screen.
   - Keeps Weak Words visible as learning targets.
   - Keeps all scoring, pass status, path/gate logic and logs untouched.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.0-MOBILE-SUMMARY-COMPACT-122";

  if (window.__EAP_WORD_V210_MOBILE_SUMMARY__) return;
  window.__EAP_WORD_V210_MOBILE_SUMMARY__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function summaryRoot() {
    const screen = $("summaryScreen");
    return screen && screen.classList.contains("active")
      ? screen.querySelector(".summary-card") || screen
      : null;
  }

  function addStyle() {
    if ($("eapV210MobileSummaryStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV210MobileSummaryStyle";
    style.textContent = `
      /* This legacy box repeats the green XP/result card directly above it. */
      #eapV198SummaryGuide{display:none!important}

      #summaryScreen .summary-card{max-width:980px}
      #summaryScreen .summary-actions{display:flex;flex-wrap:wrap;gap:10px}
      #summaryScreen .summary-actions .btn{min-height:48px}

      @media (max-width:680px){
        #summaryScreen .summary-card{
          padding:18px 14px 22px!important;
          border-radius:26px!important;
        }
        #summaryScreen .summary-hero{margin-bottom:12px!important}
        #summaryScreen .summary-hero .summary-stars{font-size:34px!important;margin:0 0 3px!important}
        #summaryScreen .summary-hero h2{font-size:30px!important;line-height:1.15!important;margin:0!important}
        #summaryScreen .summary-hero p{font-size:15px!important;line-height:1.35!important;margin:8px auto 0!important}

        #summaryScreen #summaryStats{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:10px!important;
          margin:12px 0!important;
        }
        #summaryScreen #summaryStats .stat{
          min-width:0!important;
          min-height:88px!important;
          padding:14px 14px!important;
          border-radius:18px!important;
        }
        #summaryScreen #summaryStats .stat b{font-size:25px!important;line-height:1.1!important}
        #summaryScreen #summaryStats .stat span{font-size:13px!important;line-height:1.2!important;margin-top:4px!important}

        #summaryScreen .weak-summary{padding:16px!important;margin:12px 0!important;border-radius:20px!important}
        #summaryScreen .weak-summary h3{font-size:20px!important;margin:0 0 10px!important}
        #summaryWeakWords.eap205-words{gap:7px!important}
        #summaryWeakWords .eap205-word{font-size:14px!important;padding:7px 10px!important}
        #summaryWeakWords .eap205-word-note{font-size:13px!important;line-height:1.35!important}

        #eapV195Summary{
          margin:12px 0!important;
          padding:15px 16px!important;
          border-radius:20px!important;
          font-size:15px!important;
          line-height:1.45!important;
        }
        #eapV195Summary .eap205-title{font-size:0!important;margin:0 0 6px!important}
        #eapV195Summary .eap205-title::after{
          content:"AI แนะนำรอบถัดไป";
          font-size:19px;
          font-weight:1000;
          color:#9a3412;
        }
        #eapV195Summary .eap205-line{font-size:15px!important;margin-top:6px!important}
        /* Header and green result card already show pass/fail. Keep only level + action. */
        #eapV195Summary .eap205-line:nth-child(3),
        #eapV195Summary .eap205-weak{display:none!important}

        #eapV203RewardBox,#eapV203PathBox{
          margin:12px 0!important;
          padding:14px 15px!important;
          border-radius:20px!important;
          font-size:15px!important;
          line-height:1.45!important;
        }
        #eapV203RewardBox .eap203-row,#eapV203PathBox .eap203-row{gap:6px!important;margin-top:8px!important}
        #eapV203RewardBox .eap203-chip,#eapV203PathBox .eap203-chip{font-size:12px!important;padding:5px 8px!important}

        #summaryScreen .summary-actions{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:10px!important;
          margin-top:14px!important;
        }
        #summaryScreen .summary-actions .btn{
          width:100%!important;
          min-width:0!important;
          min-height:54px!important;
          padding:11px 8px!important;
          font-size:17px!important;
          line-height:1.15!important;
          white-space:normal!important;
        }
        #summaryScreen #nextMissionBtn{grid-column:1/-1!important;font-size:19px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function replaceExact(node, replacements) {
    const raw = norm(node.dataset.eapV210Raw || node.textContent);
    node.dataset.eapV210Raw = raw;
    if (Object.prototype.hasOwnProperty.call(replacements, raw)) {
      node.textContent = replacements[raw];
    }
  }

  function localizeSummary(root) {
    const labels = {
      "Accuracy":"ความแม่นยำ",
      "Correct":"ตอบถูก",
      "Max Combo":"คอมโบสูงสุด",
      "Status":"สถานะ"
    };
    root.querySelectorAll("#summaryStats span").forEach((node) => replaceExact(node, labels));

    const subtitle = $("summarySubtitle");
    const run = window.EAP_V203_LAST_RESULT || window.EAP_V196_LAST_RESULT || window.EAP_V195_LAST_RESULT || null;
    if (subtitle && run && run.sessionTitle) {
      const accuracy = Math.max(0, Math.min(100, Math.round(Number(run.accuracy) || 0)));
      const required = run.passThreshold || (/^BG5$/i.test(run.sessionId) ? 75 : /^BG/i.test(run.sessionId) ? 70 : 60);
      const compact = `${run.sessionTitle} • ${accuracy}% • ผ่าน ${required}%`;
      if (subtitle.dataset.eapV210Compact !== compact) {
        subtitle.dataset.eapV210Compact = compact;
        subtitle.textContent = compact;
      }
    }
  }

  function patch() {
    addStyle();
    const root = summaryRoot();
    if (!root) return;
    localizeSummary(root);
  }

  const observer = new MutationObserver(() => requestAnimationFrame(patch));
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });

  [0,120,360,760,1300].forEach((delay) => setTimeout(patch, delay));

  window.inspectEapV210 = () => ({
    version:VERSION,
    summaryVisible:Boolean(summaryRoot()),
    summaryLabels:Array.from(document.querySelectorAll("#summaryStats span")).map((node) => norm(node.textContent)),
    duplicateGuideVisible:Boolean($("eapV198SummaryGuide") && getComputedStyle($("eapV198SummaryGuide")).display !== "none"),
    mobileLayout:matchMedia("(max-width:680px)").matches
  });

  console.info("[EAP Word Quest] v210 mobile summary compact ready", { version:VERSION });
})();
