/* EAP Word Quest v211 stable gameplay patch */
(() => {
  "use strict";
  if (window.__EAP_WORD_V211_MOBILE_GAMEPLAY__) return;
  window.__EAP_WORD_V211_MOBILE_GAMEPLAY__ = true;
  const $ = id => document.getElementById(id);
  const norm = value => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const active = () => Boolean($("gameScreen")?.classList.contains("active"));

  const style = document.createElement("style");
  style.id = "eapV211MobileGameplayStyle";
  style.textContent = `
    #choicesEl .eap192-choice[data-eap211-letter]{padding-left:58px!important}
    #choicesEl .eap192-choice[data-eap211-letter]::before{content:attr(data-eap211-letter);position:absolute;left:14px;top:50%;transform:translateY(-50%);width:30px;height:30px;display:grid;place-items:center;border:1px solid #c7d2fe;border-radius:50%;background:#eef2ff;color:#3730a3;font-size:13px;font-weight:1000}
    #gameScreen .eap211-live-note{margin:8px 0 0;color:#475569;font-size:12px;font-weight:780;line-height:1.38}
    @media(max-width:680px){
      #gameScreen .game-card{padding:15px 14px 18px!important;border-radius:26px!important}
      #gameScreen .game-head h2{font-size:22px!important;line-height:1.18!important}
      #gameScreen #promptText{padding:16px 14px!important;border-radius:18px!important;font-size:18px!important;line-height:1.36!important}
      #gameScreen #choicesEl{grid-template-columns:1fr!important;gap:10px!important;margin-top:12px!important}
      #gameScreen #choicesEl .eap192-choice{min-height:64px!important;padding:13px 14px 13px 58px!important;border-radius:17px!important;font-size:16px!important;line-height:1.35!important;white-space:normal!important}
      #gameScreen #gameStats{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}
      #gameScreen .game-actions{display:grid!important;grid-template-columns:1fr 1.15fr!important;gap:9px!important;margin-top:13px!important}
      #gameScreen .game-actions .btn{min-width:0!important;min-height:52px!important;font-size:15px!important;white-space:normal!important}
    }`;
  if (!$("eapV211MobileGameplayStyle")) document.head.appendChild(style);

  function setText(node,value){ if(node && node.textContent !== value) node.textContent=value; }
  function patch(){
    if(!active()) return;
    const progress=$("progressText");
    const match=progress && norm(progress.textContent).match(/^Question\s+(\d+)\s*\/\s*(\d+)$/i);
    if(match) setText(progress,`ข้อ ${match[1]}/${match[2]}`);
    const title=$("feedbackTitle");
    if(title){ const map={Correct:"ตอบถูก!","Not correct yet":"ยังไม่ถูก ลองดูเหตุผล",Feedback:"ผลการตอบ"}; if(map[norm(title.textContent)]) setText(title,map[norm(title.textContent)]); }
    const help=$("aiHelpBtn");
    if(help && /^AI Help/i.test(norm(help.textContent))) setText(help,"AI Help • ใบ้");
    const labels={Score:"คะแนน",Correct:"ตอบถูก",Wrong:"ตอบผิด",Combo:"คอมโบ",Accuracy:"ความแม่นยำ","AI Level":"ระดับ AI","Boss HP":"พลัง Boss"};
    document.querySelectorAll("#gameStats .mini span").forEach(node=>{const raw=node.dataset.eapV211Raw||norm(node.textContent);if(!node.dataset.eapV211Raw)node.dataset.eapV211Raw=raw;if(labels[raw])setText(node,labels[raw]);});
    ["A","B","C","D"].forEach((letter,index)=>{const button=document.querySelectorAll("#choicesEl .eap192-choice")[index];if(button){if(button.dataset.eap211Letter!==letter)button.dataset.eap211Letter=letter;const aria=`ตัวเลือก ${letter}: ${norm(button.textContent)}`;if(button.getAttribute("aria-label")!==aria)button.setAttribute("aria-label",aria);}});
    const prompt=$("promptText");
    if(prompt && !$("eapV211LiveNote")){const note=document.createElement("div");note.id="eapV211LiveNote";note.className="eap211-live-note";note.innerHTML="<b>เคล็ดลับ:</b> อ่านโจทย์และบริบทก่อน แล้วค่อยตัดตัวเลือกที่ใช้คนละหน้าที่ออก";prompt.insertAdjacentElement("afterend",note);}
  }
  document.addEventListener("click",event=>{[80,220,500].forEach(delay=>setTimeout(patch,delay));const answer=event.target?.closest?.("#choicesEl .eap192-choice");if(answer)setTimeout(()=>{const feedback=$("feedbackBox");if(feedback&&!feedback.hidden&&matchMedia("(max-width:680px)").matches)feedback.scrollIntoView({behavior:"smooth",block:"nearest"});},260);},true);
  [150,500,1100].forEach(delay=>setTimeout(patch,delay));
  window.inspectEapV211=()=>({version:"v211-stable",gameActive:active(),choices:document.querySelectorAll("#choicesEl .eap192-choice").length});
})();
