/* AI Quest — S2 AR Click Hotfix v3.8.3
   Fix: resilient delegated click handler for S2 AR entry card.
   Scope: S2 only. Does not change S2 score, gate, or Teacher records.
*/
(function(){
  "use strict";

  var VERSION = "v3.8.3-s2-ar-click-hotfix";
  var TARGET = "./index.html?session=s2&ar=hand&from=s2&v=20260627-s2ar383";

  function isS2(){
    try{
      var p = new URLSearchParams(location.search);
      return String(p.get("session") || "").toLowerCase() === "s2" &&
        !String(p.get("ar") || "").trim();
    }catch(_){
      return false;
    }
  }

  function go(){
    if(!isS2()) return;
    location.href = TARGET;
  }

  function isEntryButton(node){
    if(!node || !node.closest) return false;
    var btn = node.closest("button, a, [role='button']");
    if(!btn) return false;
    var text = String(btn.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
    var card = btn.closest("[data-aiquest-s2-ar-entry], .aiquest-s2-ar-entry, .s2-ar-practice-card");
    return !!card ||
      text === "เริ่ม ar practice" ||
      text === "start ar practice" ||
      btn.id === "aiquestS2ArStartBtn" ||
      btn.dataset.aiquestS2ArStart === "1";
  }

  function tagExisting(){
    if(!isS2()) return;
    Array.prototype.forEach.call(document.querySelectorAll("button, a, [role='button']"), function(btn){
      var text = String(btn.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
      if(text === "เริ่ม ar practice" || text === "start ar practice"){
        btn.id = btn.id || "aiquestS2ArStartBtn";
        btn.dataset.aiquestS2ArStart = "1";
        btn.type = btn.tagName === "BUTTON" ? "button" : btn.type;
      }
    });
  }

  document.addEventListener("click", function(ev){
    if(!isEntryButton(ev.target)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    go();
  }, true);

  document.addEventListener("DOMContentLoaded", tagExisting);
  setTimeout(tagExisting, 300);
  setTimeout(tagExisting, 900);
  setTimeout(tagExisting, 1800);

  console.log("[AIQuest] " + VERSION + " loaded");
})();
