/* =========================================================
   AI Quest — S1 AR Visible Entry
   File: /ai-quest/js/aiquest-s1-ar-entry-v375.js
   Version: v3.7.5
   Purpose:
   - แสดงปุ่มเริ่ม S1 AR Practice ในหน้า S1 ปกติอย่างเสถียร
   - ทนต่อการ render ใหม่ของ gameArea ทุกข้อ
   - ไม่แสดงซ้อนเมื่ออยู่ใน AR mode แล้ว
   ========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.5-s1-ar-visible-entry";
  const AR_RESULT_KEY = "AIQUEST_S1_AR_RESULT_V368";
  const CARD_ID = "aiquestS1ArEntryCardV375";
  const STYLE_ID = "aiquestS1ArEntryStyleV375";

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function isS1Screen() {
    const gameScreen = qs("#gameScreen");
    const heading = qs("#gameHeading");

    if (!gameScreen || !gameScreen.classList.contains("active")) return false;
    if (!heading) return false;

    const text = String(heading.textContent || "").toLowerCase();
    return text.includes("ai awakening") || text.startsWith("1:");
  }

  function isArMode() {
    const params = new URLSearchParams(location.search);
    return String(params.get("ar") || "").toLowerCase() === "hand";
  }

  function readArResult() {
    try {
      const result = JSON.parse(localStorage.getItem(AR_RESULT_KEY) || "null");
      return result && typeof result === "object" ? result : null;
    } catch (error) {
      return null;
    }
  }

  function getArUrl() {
    const url = new URL(location.href);

    url.searchParams.set("session", "s1");
    url.searchParams.set("ar", "hand");
    url.searchParams.set("v", "20260627-s1ar-entry375");

    return url.pathname + "?" + url.searchParams.toString();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[char]));
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${CARD_ID}{
        margin:0 0 14px;
        padding:14px;
        border-radius:20px;
        border:1px solid rgba(56,189,248,.55);
        background:
          linear-gradient(135deg,rgba(56,189,248,.16),rgba(167,139,250,.14)),
          rgba(15,23,42,.88);
        box-shadow:0 14px 28px rgba(0,0,0,.20);
      }

      #${CARD_ID} .s1ar-top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
      }

      #${CARD_ID} .s1ar-title{
        color:#e0f2fe;
        font-size:17px;
        font-weight:1000;
        margin:0 0 4px;
      }

      #${CARD_ID} .s1ar-text{
        color:#cbd5e1;
        font-size:13px;
        line-height:1.55;
      }

      #${CARD_ID} .s1ar-button{
        flex:0 0 auto;
        border:0;
        border-radius:15px;
        padding:12px 15px;
        font:inherit;
        font-weight:1000;
        color:#062b32;
        background:linear-gradient(135deg,#5eead4,#67e8f9);
        box-shadow:0 10px 22px rgba(34,211,238,.20);
        cursor:pointer;
      }

      #${CARD_ID} .s1ar-complete{
        margin-top:10px;
        border-radius:13px;
        padding:9px 10px;
        color:#bbf7d0;
        background:rgba(52,211,153,.11);
        border:1px solid rgba(52,211,153,.28);
        font-size:13px;
        font-weight:900;
      }

      @media(max-width:680px){
        #${CARD_ID} .s1ar-top{
          flex-direction:column;
        }

        #${CARD_ID} .s1ar-button{
          width:100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function buildCard() {
    const result = readArResult();
    const completed = !!(result && (result.completed || result.arCompleted));
    const total = Number(result?.total || result?.arTotal || 0);
    const correct = Number(result?.correct || result?.arCorrect || 0);
    const score = Math.round(Number(
      result?.score ??
      result?.arScore ??
      result?.accuracy ??
      result?.arAccuracy ??
      (total ? (correct / total) * 100 : 0)
    ));

    const card = document.createElement("section");
    card.id = CARD_ID;

    card.innerHTML = `
      <div class="s1ar-top">
        <div>
          <div class="s1ar-title">🖐️ S1 AR Practice: AI Object Scanner</div>
          <div class="s1ar-text">
            สแกนสิ่งรอบตัวผ่านกล้อง แล้วใช้มือหรือเมาส์/ทัชเลือก
            ว่าสิ่งนั้นเป็น AI, Automation, Sensor-only, Rule-based หรือ Prediction
          </div>
        </div>

        <button type="button" class="s1ar-button" id="startS1ArPracticeV375">
          เริ่ม AR Practice
        </button>
      </div>

      ${completed ? `
        <div class="s1ar-complete">
          ✓ เล่น AR แล้ว: ${correct}/${total || 6} ข้อ · ${score}%<br>
          Teacher Dashboard จะแสดงข้อมูลกิจกรรมเสริมหลัง Refresh
        </div>
      ` : ""}
    `;

    const button = card.querySelector("#startS1ArPracticeV375");

    button.addEventListener("click", () => {
      location.href = getArUrl();
    });

    return card;
  }

  function ensureEntry() {
    if (isArMode()) return;

    const area = qs("#gameArea");

    if (!area || !isS1Screen()) {
      const old = qs("#" + CARD_ID);
      if (old) old.remove();
      return;
    }

    const current = qs("#" + CARD_ID);

    if (current) {
      const fresh = buildCard();
      current.replaceWith(fresh);
      return;
    }

    area.insertBefore(buildCard(), area.firstChild);
  }

  function boot() {
    injectStyle();
    ensureEntry();

    const observer = new MutationObserver(() => {
      requestAnimationFrame(ensureEntry);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(ensureEntry, 1200);

    console.log("[AIQuest] " + VERSION + " loaded");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
