/* =========================================================
   /vocab/vocab.ui.js — Emergency Choice Bridge
   PATCH: v20260503j
   Fix:
   - click choice แล้วต้องมี feedback ถูก/ผิด
   - ถ้า VocabGame.answer/choose ไม่ทำงาน จะ fallback เอง
   - ไปข้อถัดไปอัตโนมัติ
   - log answer เข้า logger
========================================================= */

(function(){
  "use strict";

  const WIN = window;
  const DOC = document;

  const VERSION = "vocab-choice-bridge-v20260503j";

  let LOCK = false;

  function $(id){
    return DOC.getElementById(id);
  }

  function qsa(sel, root){
    return Array.from((root || DOC).querySelectorAll(sel));
  }

  function text(el, value){
    if(el) el.textContent = String(value ?? "");
  }

  function esc(s){
    if(WIN.VocabUtils && typeof WIN.VocabUtils.escapeHtml === "function"){
      return WIN.VocabUtils.escapeHtml(s);
    }

    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== ""){
        return v;
      }
    }
    return "";
  }

  function getGame(){
    return WIN.VocabGame || WIN.vocabGame || WIN.VOCAB_GAME || {};
  }

  function getState(){
    try{
      if(WIN.VocabState && typeof WIN.VocabState.get === "function"){
        return WIN.VocabState.get() || {};
      }
    }catch(e){}

    try{
      if(WIN.VocabState && WIN.VocabState.state){
        return WIN.VocabState.state || {};
      }
    }catch(e){}

    return WIN.VOCAB_APP || {};
  }

  function setState(update){
    update = update || {};

    WIN.VOCAB_APP = WIN.VOCAB_APP || {};
    Object.assign(WIN.VOCAB_APP, update);

    try{
      if(WIN.VocabState && typeof WIN.VocabState.set === "function"){
        WIN.VocabState.set(update);
      }else if(WIN.VocabState && WIN.VocabState.state){
        Object.assign(WIN.VocabState.state, update);
      }
    }catch(e){}
  }

  function getCurrentQuestion(){
    const game = getGame();
    const state = getState();

    return (
      game.currentQuestion ||
      game.question ||
      state.currentQuestion ||
      state.question ||
      state.activeQuestion ||
      null
    );
  }

  function normalizeQuestion(q){
    q = q || {};

    const choices = q.choices || q.options || q.answers || [];

    return {
      id: pick(q.id, q.qid, q.question_id, ""),
      term: pick(q.term, q.word, q.vocab, ""),
      prompt: pick(q.prompt, q.question, q.question_text, q.questionText, q.text, ""),
      choices: Array.isArray(choices) ? choices : [],
      correct: pick(q.correct, q.correct_answer, q.correctAnswer, q.answer, q.key, ""),
      explain: pick(q.explain, q.explanation, q.feedback, "")
    };
  }

  function getCorrectFromDomOrQuestion(){
    const q = normalizeQuestion(getCurrentQuestion());

    if(q.correct !== ""){
      return String(q.correct);
    }

    const btn = DOC.querySelector("[data-vocab-correct='1'], [data-correct='1'], [data-is-correct='1']");
    if(btn){
      return String(btn.dataset.vocabChoice || btn.dataset.choice || btn.textContent || "").trim();
    }

    return "";
  }

  function showFloat(message, type){
    const el = DOC.createElement("div");
    el.className = "vocab-float v6-float " + (type || "");
    el.textContent = message;

    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 950);
  }

  function showExplain(html){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = html;
  }

  function markButtons(selectedValue, correctValue){
    selectedValue = String(selectedValue ?? "");
    correctValue = String(correctValue ?? "");

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = String(btn.dataset.vocabChoice || btn.textContent || "").trim();

      btn.disabled = true;
      btn.style.pointerEvents = "none";

      if(correctValue && value === correctValue){
        btn.classList.add("correct");
      }

      if(value === selectedValue && value !== correctValue){
        btn.classList.add("wrong");
      }
    });
  }

  function updateMiniHud(isCorrect){
    const state = getState();

    const score = Number(pick(state.score, 0)) || 0;
    const combo = Number(pick(state.combo, state.currentCombo, 0)) || 0;
    const hp = Number(pick(state.hp, state.lives, 5)) || 5;

    const nextScore = isCorrect ? score + 100 + combo * 10 : score;
    const nextCombo = isCorrect ? combo + 1 : 0;
    const nextHp = isCorrect ? hp : Math.max(0, hp - 1);

    setState({
      score: nextScore,
      combo: nextCombo,
      currentCombo: nextCombo,
      hp: nextHp,
      lives: nextHp
    });

    text($("vocabScore"), nextScore);
    text($("vocabCombo"), "x" + nextCombo);

    let hearts = "";
    for(let i = 0; i < 5; i++){
      hearts += i < nextHp ? "❤️" : "🖤";
    }
    text($("vocabHp"), hearts);
  }

  function tryGameAnswer(selectedValue, btn){
    const game = getGame();

    const methods = [
      "answer",
      "choose",
      "submitAnswer",
      "selectAnswer",
      "handleAnswer",
      "answerQuestion",
      "onAnswer",
      "checkAnswer"
    ];

    for(const name of methods){
      if(typeof game[name] === "function"){
        try{
          const before = JSON.stringify({
            index: game.index,
            currentIndex: game.currentIndex,
            questionNo: getState().questionNo
          });

          const result = game[name](selectedValue, btn);

          setTimeout(function(){
            const after = JSON.stringify({
              index: game.index,
              currentIndex: game.currentIndex,
              questionNo: getState().questionNo
            });

            /*
              ถ้า game method ถูกเรียกแล้วแต่ไม่มี feedback/ไม่เปลี่ยนข้อ
              ให้ fallback ช่วยต่อ
            */
            if(before === after && !btn.classList.contains("correct") && !btn.classList.contains("wrong")){
              fallbackAnswer(selectedValue, btn);
            }
          }, 120);

          return true;
        }catch(err){
          console.warn("[VOCAB CHOICE BRIDGE] game method failed:", name, err);
        }
      }
    }

    return false;
  }

  function logAnswer(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.answer === "function"){
        WIN.VocabLogger.answer(payload);
        return;
      }

      if(typeof WIN.logVocabAnswerV6 === "function"){
        WIN.logVocabAnswerV6(payload);
        return;
      }

      if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("answer", payload);
      }
    }catch(e){}
  }

  function nextQuestionFallback(){
    const game = getGame();

    const methods = [
      "nextQuestion",
      "next",
      "renderNext",
      "showNextQuestion",
      "advance",
      "continueGame"
    ];

    for(const name of methods){
      if(typeof game[name] === "function"){
        try{
          game[name]();
          return true;
        }catch(err){
          console.warn("[VOCAB CHOICE BRIDGE] next method failed:", name, err);
        }
      }
    }

    /*
      fallback ต่ำสุด: ถ้ามี questions array + renderQuestion
    */
    const state = getState();
    const questions =
      game.questions ||
      game.questionList ||
      state.questions ||
      state.questionList ||
      [];

    let index =
      Number(pick(game.index, game.currentIndex, state.index, state.questionIndex, 0)) || 0;

    if(Array.isArray(questions) && questions.length){
      index += 1;

      if(index >= questions.length){
        if(typeof game.end === "function"){
          game.end();
          return true;
        }

        if(typeof game.finish === "function"){
          game.finish();
          return true;
        }

        showExplain("🏁 จบรอบแล้ว แต่ยังไม่พบฟังก์ชันสรุปผลใน VocabGame");
        return true;
      }

      game.index = index;
      game.currentIndex = index;

      setState({
        index: index,
        questionIndex: index,
        questionNo: index + 1,
        questionCount: questions.length,
        currentQuestion: questions[index]
      });

      if(WIN.VocabUI && typeof WIN.VocabUI.renderQuestion === "function"){
        WIN.VocabUI.renderQuestion(questions[index], getState());
        return true;
      }
    }

    return false;
  }

  function fallbackAnswer(selectedValue, btn){
    const q = normalizeQuestion(getCurrentQuestion());
    const correctValue = getCorrectFromDomOrQuestion();

    const selected = String(selectedValue || "").trim();
    const correct = String(correctValue || "").trim();

    const isCorrect = correct
      ? selected === correct
      : btn && (
          btn.dataset.vocabCorrect === "1" ||
          btn.dataset.correct === "1" ||
          btn.dataset.isCorrect === "1"
        );

    markButtons(selected, correct);
    updateMiniHud(isCorrect);

    if(isCorrect){
      showFloat("✅ Correct!", "good");
      showExplain(
        q.explain
          ? "✅ ถูกต้อง!<br>" + esc(q.explain)
          : "✅ ถูกต้อง! เก่งมาก ไปข้อต่อไปกันเลย"
      );
    }else{
      showFloat("❌ Try again", "bad");
      showExplain(
        "❌ ยังไม่ถูก<br>" +
        (correct ? "คำตอบที่ถูกคือ: <b>" + esc(correct) + "</b><br>" : "") +
        (q.explain ? esc(q.explain) : "ลองดู keyword ในโจทย์ แล้วจำความหมายของคำนี้ไว้")
      );
    }

    logAnswer({
      term: q.term,
      prompt: q.prompt,
      answer: selected,
      selected_answer: selected,
      correct_answer: correct,
      correct: isCorrect ? 1 : 0,
      is_correct: isCorrect ? 1 : 0,
      score: Number(getState().score || 0),
      combo: Number(getState().combo || 0),
      hp: Number(getState().hp || getState().lives || 0),
      question_no: Number(getState().questionNo || getState().index || 0),
      question_count: Number(getState().questionCount || getState().totalQuestions || 0),
      bank: getState().bank || getState().selectedBank || "A",
      mode: getState().mode || getState().selectedMode || "learn",
      difficulty: getState().difficulty || getState().diff || "easy"
    });

    setTimeout(function(){
      nextQuestionFallback();
      LOCK = false;
    }, 850);
  }

  function onChoiceClick(ev){
    const btn = ev.target.closest("[data-vocab-choice]");
    if(!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    if(LOCK) return;
    LOCK = true;

    const selectedValue = String(btn.dataset.vocabChoice || btn.textContent || "").trim();

    const usedGame = tryGameAnswer(selectedValue, btn);

    if(!usedGame){
      fallbackAnswer(selectedValue, btn);
    }else{
      setTimeout(function(){
        LOCK = false;
      }, 900);
    }
  }

  /*
    ใช้ capture=true เพื่อให้จับ click ได้ก่อน listener เก่าที่อาจไม่ทำงาน
  */
  DOC.addEventListener("click", onChoiceClick, true);

  WIN.VocabChoiceBridge = {
    version: VERSION,
    fallbackAnswer,
    nextQuestionFallback
  };

  console.log("[VOCAB CHOICE BRIDGE] loaded", VERSION);
})();
