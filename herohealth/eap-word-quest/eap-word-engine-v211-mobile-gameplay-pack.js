/* =========================================================
   EAP Word Quest • Mobile Gameplay Clarity Pack
   File: /herohealth/eap-word-quest/eap-word-engine-v211-mobile-gameplay-pack.js
   Version: v2.1.1-MOBILE-GAMEPLAY-CLARITY-122

   Student-facing only:
   - Compact the live question screen for small phones.
   - Make choices easier to scan and tap without revealing answers.
   - Localize live labels and feedback.
   - Keep Thai learning support concise and visible.
   - Do not change scoring, answer order, gates, timers, AI rules, or logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.1-MOBILE-GAMEPLAY-CLARITY-122";

  if (window.__EAP_WORD_V211_MOBILE_GAMEPLAY__) return;
  window.__EAP_WORD_V211_MOBILE_GAMEPLAY__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function isGameActive() {
    const screen = $("gameScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function addStyle() {
    if ($("eapV211MobileGameplayStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV211MobileGameplayStyle";
    style.textContent = `
      #choicesEl .eap192-choice[data-eap211-letter]{padding-left:58px!important}
      #choicesEl .eap192-choice[data-eap211-letter]::before{
        content:attr(data-eap211-letter);
        position:absolute;left:14px;top:50%;transform:translateY(-50%);
        width:30px;height:30px;display:grid;place-items:center;
        border:1px solid #c7d2fe;border-radius:50%;background:#eef2ff;color:#3730a3;
        font-size:13px;font-weight:1000;
      }
      #choicesEl .eap192-choice.correct::before,#choicesEl .eap192-choice.reveal::before{
        border-color:#86efac;background:#dcfce7;color:#166534;
      }
      #choicesEl .eap192-choice.wrong::before{
        border-color:#fca5a5;background:#fee2e2;color:#b91c1c;
      }
      #gameScreen .eap211-live-note{margin:8px 0 0;color:#475569;font-size:12px;font-weight:780;line-height:1.38}
      #gameScreen .eap211-live-note b{color:#3730a3}

      @media(max-width:680px){
        #gameScreen .game-card{padding:15px 14px 18px!important;border-radius:26px!important}
        #gameScreen .game-head{gap:10px!important;align-items:flex-start!important}
        #gameScreen .game-head .eyebrow{font-size:11px!important;margin-bottom:4px!important}
        #gameScreen .game-head h2{font-size:22px!important;line-height:1.18!important;letter-spacing:-.025em!important}
        #gameScreen #quitBtn{min-height:38px!important;padding:7px 10px!important;font-size:13px!important;flex:0 0 auto!important}

        #gameScreen .progress-block{margin:12px 0 10px!important}
        #gameScreen .progress-top{font-size:13px!important}
        #gameScreen .progress-bar,#gameScreen .time-bar{height:8px!important}
        #gameScreen #questionTags{gap:6px!important;margin:8px 0!important}
        #gameScreen #questionTags span{font-size:11px!important;padding:5px 8px!important}
        /* The third tag is an internal bank lane, not learner-facing information. */
        #gameScreen #questionTags span:nth-child(3){display:none!important}

        #eapV198SupportPanel{margin:9px 0!important;padding:11px 12px!important;border-radius:16px!important;font-size:13px!important}
        #eapV198SupportPanel .eap198-title{font-size:14px!important;margin-bottom:5px!important}
        #eapV198SupportPanel .eap198-skill{font-size:12px!important}
        #eapV198SupportPanel .eap198-thai{margin-top:4px!important;font-size:13px!important;line-height:1.4!important}
        #eapV198SupportPanel .eap198-strategy{margin-top:7px!important;padding:7px 8px!important;font-size:12px!important;line-height:1.35!important}
        #eapV198SupportPanel .eap198-note{display:none!important}

        #gameScreen #promptText{padding:16px 14px!important;border-radius:18px!important;font-size:18px!important;line-height:1.36!important}
        #gameScreen #promptText .eap192-small{display:block;margin-top:9px!important;font-size:14px!important;line-height:1.48!important}
        #gameScreen #choicesEl{grid-template-columns:1fr!important;gap:10px!important;margin-top:12px!important}
        #gameScreen #choicesEl .eap192-choice{min-height:64px!important;padding:13px 14px 13px 58px!important;border-radius:17px!important;font-size:16px!important;line-height:1.35!important;white-space:normal!important}
        #gameScreen #choicesEl .eap192-choice[data-eap211-letter]::before{left:14px;width:31px;height:31px}

        #gameScreen #feedbackBox{margin-top:12px!important;padding:13px 14px!important;border-radius:17px!important}
        #gameScreen #feedbackTitle{font-size:18px!important}
        #gameScreen #feedbackText,#eapV198FeedbackThai{font-size:14px!important;line-height:1.46!important}
        #gameScreen #gameStats{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-top:12px!important}
        #gameScreen #gameStats .mini{min-height:58px!important;padding:9px 7px!important;border-radius:14px!important}
        #gameScreen #gameStats .mini b{font-size:17px!important}
        #gameScreen #gameStats .mini span{font-size:10px!important;line-height:1.15!important}

        #gameScreen .game-actions{display:grid!important;grid-template-columns:1fr 1.15fr!important;gap:9px!important;margin-top:13px!important}
        #gameScreen .game-actions .btn{min-width:0!important;min-height:52px!important;padding:10px 8px!important;border-radius:16px!important;font-size:15px!important;white-space:normal!important;line-height:1.15!important}
        #gameScreen #nextBtn:not(:disabled){box-shadow:0 15px 28px rgba(79,70,229,.26)!important}
        #gameScreen #nextBtn:disabled{opacity:.45!important}
      }
    `;
    document.head.appendChild(style);
  }

  function translateExact(node, map) {
    if (!node || node.children.length) return;
    const raw = norm(node.dataset.eapV211Raw || node.textContent);
    node.dataset.eapV211Raw = raw;
    if (Object.prototype.hasOwnProperty.call(map, raw)) node.textContent = map[raw];
  }

  function localizeLiveLabels() {
    if (!isGameActive()) return;

    const progress = $("progressText");
    if (progress) {
      const match = norm(progress.textContent).match(/^Question\s+(\d+)\s*\/\s*(\d+)$/i);
      if (match) progress.textContent = `ข้อ ${match[1]}/${match[2]}`;
    }

    const feedbackTitle = $("feedbackTitle");
    if (feedbackTitle) {
      const raw = norm(feedbackTitle.textContent);
      if (raw === "Correct") feedbackTitle.textContent = "ตอบถูก!";
      if (raw === "Not correct yet") feedbackTitle.textContent = "ยังไม่ถูก ลองดูเหตุผล";
      if (raw === "Feedback") feedbackTitle.textContent = "ผลการตอบ";
    }

    const help = $("aiHelpBtn");
    if (help) {
      const raw = norm(help.textContent);
      if (/^AI Help/i.test(raw)) {
        help.textContent = "AI Help • ใบ้";
        help.title = "ขอคำใบ้แบบช่วยคิด โดยไม่เฉลยคำตอบ";
        help.setAttribute("aria-label", "AI Help ขอคำใบ้แบบช่วยคิด");
      }
    }

    const labels = {
      "Score":"คะแนน",
      "Correct":"ตอบถูก",
      "Wrong":"ตอบผิด",
      "Combo":"คอมโบ",
      "Accuracy":"ความแม่นยำ",
      "AI Level":"ระดับ AI",
      "Boss HP":"พลัง Boss"
    };
    document.querySelectorAll("#gameStats .mini span").forEach((node) => translateExact(node, labels));
  }

  function markChoiceLetters() {
    if (!isGameActive()) return;
    const letters = ["A", "B", "C", "D"];
    document.querySelectorAll("#choicesEl .eap192-choice").forEach((button, index) => {
      button.dataset.eap211Letter = letters[index] || String(index + 1);
      button.setAttribute("aria-label", `ตัวเลือก ${letters[index] || index + 1}: ${norm(button.textContent)}`);
    });
  }

  function addLiveNote() {
    if (!isGameActive()) return;
    const prompt = $("promptText");
    if (!prompt || $("eapV211LiveNote")) return;
    const note = document.createElement("div");
    note.id = "eapV211LiveNote";
    note.className = "eap211-live-note";
    note.innerHTML = "<b>เคล็ดลับ:</b> อ่านโจทย์และบริบทก่อน แล้วค่อยตัดตัวเลือกที่ใช้คนละหน้าที่ออก";
    prompt.insertAdjacentElement("afterend", note);
  }

  function removeStaleNote() {
    const note = $("eapV211LiveNote");
    if (note && !isGameActive()) note.remove();
  }

  function scrollFeedbackIntoView() {
    if (!matchMedia("(max-width:680px)").matches) return;
    const feedback = $("feedbackBox");
    if (!feedback || feedback.hidden) return;
    feedback.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }

  function patch() {
    addStyle();
    removeStaleNote();
    localizeLiveLabels();
    markChoiceLetters();
    addLiveNote();
  }

  document.addEventListener("click", (event) => {
    const answer = event.target && event.target.closest ? event.target.closest("#choicesEl .eap192-choice") : null;
    const watched = answer || (event.target && event.target.closest ? event.target.closest("#aiHelpBtn,#nextBtn") : null);
    if (!watched) return;
    [40,150,360].forEach((delay) => setTimeout(patch, delay));
    if (answer) setTimeout(scrollFeedbackIntoView, 220);
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(patch));
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });

  addStyle();
  [0,100,320,760,1300].forEach((delay) => setTimeout(patch, delay));

  window.inspectEapV211 = () => ({
    version: VERSION,
    gameActive: isGameActive(),
    choices: document.querySelectorAll("#choicesEl .eap192-choice").length,
    choiceLetters: Array.from(document.querySelectorAll("#choicesEl .eap192-choice")).map((button) => button.dataset.eap211Letter || ""),
    mobileLayout: matchMedia("(max-width:680px)").matches,
    helpText: norm($("aiHelpBtn") && $("aiHelpBtn").textContent)
  });

  console.info("[EAP Word Quest] v211 mobile gameplay clarity ready", { version:VERSION });
})();
