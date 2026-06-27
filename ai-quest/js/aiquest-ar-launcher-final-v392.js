/* AI Quest AR Launcher Final v3.9.2
   One stable launcher for S1 and S2 AR cards.
   Removes stale/cross-session cards and directly routes on pointer/touch/click.
*/
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const raw = String(params.get("session") || "").toLowerCase();
  const current = raw === "m1" ? "s1" : raw === "m2" ? "s2" : raw;
  const ar = String(params.get("ar") || "").toLowerCase();

  if (ar || (current !== "s1" && current !== "s2")) return;

  const config = current === "s1"
    ? {
        session: "s1",
        title: "S1 AR Practice: AI Object Scanner",
        desc: "ใช้กล้องและมือ หรือ mouse/touch ฝึกแยก AI, Automation, Sensor และ Prediction",
        url: "./index.html?session=s1&ar=hand&from=s1&replay=1&v=20260627-arfinal392",
        storage: "AIQUEST_S1_AR_RESULT_V368",
        icon: "🖐"
      }
    : {
        session: "s2",
        title: "S2 AR Practice: Agent Builder",
        desc: "ใช้กล้องและมือ หรือ mouse/touch ฝึก PEAS, percept, actuator, environment และ rational agent",
        url: "./index.html?session=s2&ar=agent&from=s2&replay=1&v=20260627-arfinal392",
        storage: "AIQUEST_S2_AR_RESULT_V381",
        icon: "🧩"
      };

  function getResult() {
    try { return JSON.parse(localStorage.getItem(config.storage) || "null"); }
    catch (_) { return null; }
  }

  function completedText() {
    const result = getResult();
    const correct = Number(result?.correct || result?.arCorrect || 0);
    const total = Number(result?.total || result?.arTotal || 0);
    const score = Math.round(Number(result?.score ?? result?.arScore ?? (total ? (correct / total) * 100 : 0)));
    return result && (result.arCompleted || result.completed)
      ? `✓ เล่น AR แล้ว: ${correct}/${total} · ${score}%`
      : "กิจกรรมเสริม • ไม่กระทบคะแนน Session หลัก";
  }

  function launch(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    console.log("[AIQuest AR Final] launch", config.session, config.url);
    location.href = config.url;
  }

  function removeStaleCards(host) {
    [...host.querySelectorAll("[data-aiquest-ar-final], [data-aiquest-ar-entry], [data-aiquest-s1-ar], [data-aiquest-s2-ar]")].forEach(x => x.remove());

    [...host.querySelectorAll("button, a")].forEach(btn => {
      const card = btn.closest("section, article, div");
      const text = String(card?.textContent || "").replace(/\s+/g, " ");
      const wrongS1 = current === "s2" && /S1 AR Practice:\s*AI Object Scanner/i.test(text);
      const wrongS2 = current === "s1" && /S2 AR Practice:\s*Agent Builder/i.test(text);
      if ((wrongS1 || wrongS2) && card && card.parentElement) card.remove();
    });
  }

  function findHost() {
    return document.querySelector("#gameArea") || document.querySelector(".gameArea") || document.body;
  }

  function inject() {
    const host = findHost();
    if (!host) return;

    removeStaleCards(host);
    if (host.querySelector(`[data-aiquest-ar-final="${config.session}"]`)) return;

    const card = document.createElement("section");
    card.dataset.aiquestArFinal = config.session;
    card.style.cssText = [
      "margin:0 0 14px",
      "padding:14px",
      "border:1px solid rgba(125,211,252,.48)",
      "border-radius:18px",
      "background:linear-gradient(135deg,rgba(30,64,175,.18),rgba(91,33,182,.18))",
      "display:flex",
      "gap:14px",
      "align-items:center",
      "justify-content:space-between",
      "position:relative",
      "z-index:20"
    ].join(";");

    const left = document.createElement("div");
    left.style.cssText = "min-width:0;flex:1";
    left.innerHTML = `
      <div style="font-weight:900;font-size:16px">${config.icon} ${config.title}</div>
      <div style="margin-top:5px;font-size:13px;color:#dbeafe;line-height:1.45">${config.desc}</div>
      <div style="margin-top:8px;font-size:13px;font-weight:800;color:#bbf7d0">${completedText()}</div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = getResult() ? "ฝึก AR อีกครั้ง" : "เริ่ม AR Practice";
    button.style.cssText = [
      "appearance:none",
      "border:0",
      "border-radius:14px",
      "padding:13px 16px",
      "font-weight:900",
      "font-size:15px",
      "background:linear-gradient(135deg,#67e8f9,#a78bfa)",
      "color:#0f172a",
      "cursor:pointer",
      "white-space:nowrap",
      "position:relative",
      "z-index:9999",
      "pointer-events:auto"
    ].join(";");

    ["pointerdown", "touchstart", "mousedown", "click"].forEach(type => {
      button.addEventListener(type, launch, {capture:true, passive:false});
    });

    card.append(left, button);
    host.prepend(card);
  }

  function arm() {
    inject();
    setTimeout(inject, 250);
    setTimeout(inject, 900);
  }

  document.addEventListener("DOMContentLoaded", arm, {once:true});
  window.addEventListener("load", arm, {once:true});
  arm();
  console.log("[AIQuest AR Final] launcher loaded", config.session);
})();