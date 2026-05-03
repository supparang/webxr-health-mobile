/* =========================================================
   /vocab/vocab.ui.js — Feedback FX Override
   PATCH: v20260503m
   Fix:
   - restore correct/wrong feedback
   - restore popup score burst
   - restore button colors
   - restore SFX
   - force next question
   - capture click before old emergency bridge
========================================================= */
(function(){
  "use strict";

  const WIN = window;
  const DOC = document;
  const VERSION = "vocab-feedback-override-v20260503m";

  let LOCK = false;
  let audioCtx = null;

  function $(id){ return DOC.getElementById(id); }
  function qsa(sel, root){ return Array.from((root || DOC).querySelectorAll(sel)); }

  function pick(){
    for(let i = 0; i < arguments.length; i++){
      const v = arguments[i];
      if(v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
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

  function normalizeQuestion(q){
    q = q || {};

    const choices = q.choices || q.options || q.answers || [];

    let correct = pick(
      q.correct,
      q.correct_answer,
      q.correctAnswer,
      q.answer,
      q.key,
      ""
    );

    const correctIndex = pick(q.correctIndex, q.correct_index, q.answerIndex, q.answer_index, "");

    if(correct === "" && correctIndex !== "" && Array.isArray(choices)){
      const c = choices[Number(correctIndex)];
      correct = typeof c === "object"
        ? pick(c.value, c.text, c.label, "")
        : c;
    }

    if(correct === "" && Array.isArray(choices)){
      const found = choices.find(function(c){
        return c && typeof c === "object" && (
          c.correct === true ||
          c.isCorrect === true ||
          c.is_correct === true ||
          c.answer === true
        );
      });

      if(found){
        correct = pick(found.value, found.text, found.label, "");
      }
    }

    return {
      id: pick(q.id, q.qid, q.question_id, ""),
      term: pick(q.term, q.word, q.vocab, ""),
      prompt: pick(q.prompt, q.question, q.question_text, q.questionText, q.text, "Question text"),
      choices: Array.isArray(choices) ? choices : [],
      correct: String(correct ?? "").trim(),
      explain: pick(q.explain, q.explanation, q.feedback, q.reason, "")
    };
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

  function ensureCss(){
    if($("vocabFeedbackOverrideCss")) return;

    const style = DOC.createElement("style");
    style.id = "vocabFeedbackOverrideCss";
    style.textContent = `
      .vocab-choice.correct,.v6-choice.correct{
        background:rgba(68,223,147,.30)!important;
        border-color:rgba(68,223,147,.95)!important;
        box-shadow:0 0 0 4px rgba(68,223,147,.16),0 18px 44px rgba(68,223,147,.20)!important;
        transform:translateY(-2px) scale(1.01)!important;
      }

      .vocab-choice.wrong,.v6-choice.wrong{
        background:rgba(255,110,135,.30)!important;
        border-color:rgba(255,110,135,.95)!important;
        box-shadow:0 0 0 4px rgba(255,110,135,.14),0 18px 44px rgba(255,110,135,.18)!important;
        animation:vocabWrongShakeM .22s linear 2;
      }

      .vocab-choice.locked,.v6-choice.locked{
        pointer-events:none!important;
      }

      .vocab-pop-m{
        position:fixed;
        z-index:999999;
        left:50%;
        top:42%;
        transform:translate(-50%,-50%);
        min-width:220px;
        max-width:90vw;
        padding:18px 28px;
        border-radius:999px;
        color:#fff;
        text-align:center;
        font-size:clamp(28px,6vw,56px);
        font-weight:1000;
        pointer-events:none;
        text-shadow:0 8px 24px rgba(0,0,0,.35);
        animation:vocabPopM .95s ease forwards;
      }

      .vocab-pop-m.good{
        background:linear-gradient(135deg,#22c55e,#38bdf8);
        box-shadow:0 24px 70px rgba(34,197,94,.38);
      }

      .vocab-pop-m.bad{
        background:linear-gradient(135deg,#ef4444,#fb7185);
        box-shadow:0 24px 70px rgba(239,68,68,.35);
      }

      .vocab-score-m{
        position:fixed;
        z-index:999999;
        right:7vw;
        top:25vh;
        padding:12px 18px;
        border-radius:999px;
        background:rgba(255,209,102,.98);
        color:#3b2500;
        font-size:clamp(24px,5vw,44px);
        font-weight:1000;
        pointer-events:none;
        box-shadow:0 22px 54px rgba(255,209,102,.35);
        animation:vocabScoreM .95s ease forwards;
      }

      .vocab-combo-m{
        position:fixed;
        z-index:999999;
        left:7vw;
        top:25vh;
        padding:10px 16px;
        border-radius:999px;
        background:rgba(139,92,246,.98);
        color:#fff;
        font-size:clamp(20px,4vw,36px);
        font-weight:1000;
        pointer-events:none;
        box-shadow:0 22px 54px rgba(139,92,246,.35);
        animation:vocabScoreM .95s ease forwards;
      }

      .vocab-screen-shake-m{
        animation:vocabScreenShakeM .28s linear 1;
      }

      @keyframes vocabPopM{
        0%{opacity:0;transform:translate(-50%,-28%) scale(.78);}
        20%{opacity:1;transform:translate(-50%,-50%) scale(1.08);}
        100%{opacity:0;transform:translate(-50%,-92%) scale(.96);}
      }

      @keyframes vocabScoreM{
        0%{opacity:0;transform:translateY(18px) scale(.75);}
        20%{opacity:1;transform:translateY(0) scale(1.08);}
        100%{opacity:0;transform:translateY(-62px) scale(.94);}
      }

      @keyframes vocabWrongShakeM{
        0%,100%{transform:translateX(0);}
        25%{transform:translateX(-8px);}
        75%{transform:translateX(8px);}
      }

      @keyframes vocabScreenShakeM{
        0%,100%{transform:translateX(0);}
        25%{transform:translateX(-6px);}
        50%{transform:translateX(6px);}
        75%{transform:translateX(-4px);}
      }
    `;
    DOC.head.appendChild(style);
  }

  function beep(type){
    try{
      audioCtx = audioCtx || new (WIN.AudioContext || WIN.webkitAudioContext)();
      const ctx = audioCtx;

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = "sine";
      o.frequency.value = type === "good" ? 740 : 180;

      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);

      if(type === "good"){
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = "sine";
        o2.frequency.value = 980;
        g2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.08);
        g2.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.11);
        g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.start(ctx.currentTime + 0.08);
        o2.stop(ctx.currentTime + 0.3);
      }
    }catch(e){}
  }

  function pop(message, type){
    ensureCss();

    const el = DOC.createElement("div");
    el.className = "vocab-pop-m " + (type || "");
    el.textContent = message;
    DOC.body.appendChild(el);

    setTimeout(function(){
      try{ el.remove(); }catch(e){}
    }, 1000);
  }

  function scoreBurst(points, combo){
    ensureCss();

    if(points){
      const s = DOC.createElement("div");
      s.className = "vocab-score-m";
      s.textContent = "+" + points;
      DOC.body.appendChild(s);

      setTimeout(function(){
        try{ s.remove(); }catch(e){}
      }, 1000);
    }

    if(combo && combo >= 2){
      const c = DOC.createElement("div");
      c.className = "vocab-combo-m";
      c.textContent = "Combo x" + combo;
      DOC.body.appendChild(c);

      setTimeout(function(){
        try{ c.remove(); }catch(e){}
      }, 1000);
    }
  }

  function explain(html){
    const box = $("vocabExplainBox");
    if(!box) return;

    box.hidden = false;
    box.innerHTML = html;
  }

  function markChoices(selected, correct){
    selected = String(selected ?? "").trim();
    correct = String(correct ?? "").trim();

    qsa("[data-vocab-choice]").forEach(function(btn){
      const value = String(btn.dataset.vocabChoice || btn.textContent || "").trim();

      btn.disabled = true;
      btn.classList.add("locked");

      if(correct && value === correct){
        btn.classList.add("correct");
      }

      if(value === selected && value !== correct){
        btn.classList.add("wrong");
      }
    });
  }

  function updateHud(isCorrect){
    const s = getState();

    const score = Number(pick(s.score, 0)) || 0;
    const combo = Number(pick(s.combo, s.currentCombo, 0)) || 0;
    const hp = Number(pick(s.hp, s.lives, 5)) || 5;

    const points = isCorrect ? 100 + combo * 10 : 0;
    const nextScore = score + points;
    const nextCombo = isCorrect ? combo + 1 : 0;
    const nextHp = isCorrect ? hp : Math.max(0, hp - 1);

    setState({
      score: nextScore,
      combo: nextCombo,
      currentCombo: nextCombo,
      hp: nextHp,
      lives: nextHp
    });

    if($("vocabScore")) $("vocabScore").textContent = nextScore;
    if($("vocabCombo")) $("vocabCombo").textContent = "x" + nextCombo;

    if($("vocabHp")){
      let hearts = "";
      for(let i = 0; i < 5; i++){
        hearts += i < nextHp ? "❤️" : "🖤";
      }
      $("vocabHp").textContent = hearts;
    }

    return {
      points,
      combo: nextCombo,
      score: nextScore,
      hp: nextHp
    };
  }

  function logAnswer(payload){
    try{
      if(WIN.VocabLogger && typeof WIN.VocabLogger.answer === "function"){
        WIN.VocabLogger.answer(payload);
      }else if(typeof WIN.logVocabAnswerV6 === "function"){
        WIN.logVocabAnswerV6(payload);
      }else if(typeof WIN.logVocabEventV6 === "function"){
        WIN.logVocabEventV6("answer", payload);
      }
    }catch(e){}
  }

  function nextQuestion(){
    const game = getGame();

    const state = getState();

    const questions =
      game.questions ||
      game.questionList ||
      state.questions ||
      state.questionList ||
      [];

    let index = Number(pick(game.index, game.currentIndex, state.index, state.questionIndex, 0)) || 0;

    if(Array.isArray(questions) && questions.length){
      index += 1;

      if(index >= questions.length){
        if(typeof game.end === "function") return game.end();
        if(typeof game.finish === "function") return game.finish();

        if(WIN.VocabReward && typeof WIN.VocabReward.show === "function"){
          WIN.VocabReward.show({
            score: Number(getState().score || 0),
            accuracy: 0,
            mode: getState().mode || "learn",
            bank: getState().bank || "A",
            difficulty: getState().difficulty || getState().diff || "easy"
          });
          return true;
        }

        explain("🏁 จบรอบแล้ว แต่ยังไม่พบฟังก์ชันสรุปผล");
        return true;
      }

      game.index = index;
      game.currentIndex = index;
      game.currentQuestion = questions[index];

      setState({
        index: index,
        questionIndex: index,
        questionNo: index + 1,
        question_count: questions.length,
        questionCount: questions.length,
        currentQuestion: questions[index]
      });

      if(WIN.VocabUI && typeof WIN.VocabUI.renderQuestion === "function"){
        WIN.VocabUI.renderQuestion(questions[index], getState());
        return true;
      }
    }

    const methods = [
      "nextQuestion",
      "next",
      "advance",
      "renderNext",
      "showNextQuestion",
      "continueGame"
    ];

    for(const name of methods){
      if(typeof game[name] === "function"){
        try{
          game[name]();
          return true;
        }catch(e){}
      }
    }

    return false;
  }

  function handleChoice(btn){
    if(LOCK) return;

    LOCK = true;

    const q = normalizeQuestion(getCurrentQuestion());
    const selected = String(btn.dataset.vocabChoice || btn.textContent || "").trim();

    let correct = q.correct;

    if(!correct){
      const correctBtn = DOC.querySelector("[data-vocab-correct='1'],[data-correct='1'],[data-is-correct='1']");
      if(correctBtn){
        correct = String(correctBtn.dataset.vocabChoice || correctBtn.textContent || "").trim();
      }
    }

    const isCorrect = correct
      ? selected === correct
      : (
          btn.dataset.vocabCorrect === "1" ||
          btn.dataset.correct === "1" ||
          btn.dataset.isCorrect === "1"
        );

    markChoices(selected, correct);

    const hud = updateHud(isCorrect);

    if(isCorrect){
      beep("good");
      pop("✅ Correct!", "good");
      scoreBurst(hud.points, hud.combo);
      explain(
        q.explain
          ? "✅ <b>ถูกต้อง!</b><br>" + esc(q.explain)
          : "✅ <b>ถูกต้อง!</b><br>เยี่ยมมาก ไปข้อต่อไปกันเลย"
      );
    }else{
      beep("bad");
      pop("❌ Try again", "bad");

      DOC.body.classList.add("vocab-screen-shake-m");
      setTimeout(function(){
        DOC.body.classList.remove("vocab-screen-shake-m");
      }, 320);

      explain(
        "❌ <b>ยังไม่ถูก</b><br>" +
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
      score: hud.score,
      combo: hud.combo,
      hp: hud.hp,
      question_no: Number(getState().questionNo || getState().index || 0),
      question_count: Number(getState().questionCount || getState().totalQuestions || 0),
      bank: getState().bank || getState().selectedBank || "A",
      mode: getState().mode || getState().selectedMode || "learn",
      difficulty: getState().difficulty || getState().diff || "easy"
    });

    setTimeout(function(){
      nextQuestion();
      LOCK = false;
    }, 950);
  }

  function onClick(ev){
    const btn = ev.target.closest && ev.target.closest("[data-vocab-choice]");
    if(!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    if(typeof ev.stopImmediatePropagation === "function"){
      ev.stopImmediatePropagation();
    }

    handleChoice(btn);
  }

  /*
    สำคัญ: window capture จะทำงานก่อน document capture เดิม
    จึงกัน Emergency Choice Bridge เก่าไม่ให้แย่ง event
  */
  WIN.addEventListener("click", onClick, true);

  WIN.VocabFeedback = {
    version: VERSION,
    pop,
    scoreBurst,
    beep,
    handleChoice,
    nextQuestion
  };

  if(WIN.VocabUI){
    WIN.VocabUI.floatText = pop;
    WIN.VocabUI.scoreBurst = scoreBurst;
    WIN.VocabUI.markChoiceResult = function(selected, correct, explainText){
      markChoices(selected, correct);
      explain(explainText || "");
    };
  }

  console.log("[VOCAB FEEDBACK OVERRIDE] loaded", VERSION);
})();
