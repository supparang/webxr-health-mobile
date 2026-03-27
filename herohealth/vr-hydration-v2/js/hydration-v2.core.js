import { HYDRATION_V2_CONFIG } from './hydration-v2.config.js';
import {
  HYDRATION_V2_CONFIDENCE,
  pickHydrationScenarioBatch
} from './hydration-v2.scenarios.js';
import { buildHydrationV2Summary, saveHydrationV2Summary } from './hydration-v2.summary.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createHydrationV2Game({ scenarios, ui, logger, ctx, onFinished }) {
  const state = {
    startedAt: 0,
    index: 0,
    score: 0,
    answerCorrect: 0,
    reasonCorrect: 0,
    highConfidenceCount: 0,
    locked: false,
    pool: [],
    pending: null,
    records: []
  };

  function buildPool() {
    const desiredRounds = Number(HYDRATION_V2_CONFIG.ROUNDS || 6);

    const picked = pickHydrationScenarioBatch({
      stateLike: {
        researchForm: ctx.researchForm,
        researchPhase: ctx.researchPhase,
        postForm: ctx.researchForm,
        phaseTag: ctx.researchPhase
      },
      count: desiredRounds,
      randomFn: Math.random
    });

    if (Array.isArray(picked) && picked.length) {
      return picked.map((item) => ({
        ...item,
        choices: shuffle(item.choices),
        reasons: shuffle(item.reasons)
      }));
    }

    return shuffle(scenarios).slice(0, desiredRounds).map((item) => ({
      ...item,
      choices: shuffle(item.choices),
      reasons: shuffle(item.reasons)
    }));
  }

  function start() {
    state.startedAt = Date.now();
    state.index = 0;
    state.score = 0;
    state.answerCorrect = 0;
    state.reasonCorrect = 0;
    state.highConfidenceCount = 0;
    state.locked = false;
    state.pending = null;
    state.records = [];
    state.pool = buildPool();

    logger.start({
      totalRounds: state.pool.length,
      researchForm: ctx.researchForm || '',
      researchPhase: ctx.researchPhase || ''
    });

    renderAnswerStep();
  }

  function renderAnswerStep() {
    const item = state.pool[state.index];
    if (!item) return finish();

    ui.renderStep({
      stepType: 'answer',
      phaseLabel: 'สถานการณ์',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      score: state.score,
      coachText: HYDRATION_V2_CONFIG.COPY.coachIntro,
      title: item.title,
      text: item.text,
      hint: item.hint,
      prompt: item.question,
      choices: item.choices
    }, onAnswerChoice);

    state.pending = {
      scenarioId: item.id,
      answerId: '',
      answerCorrect: false,
      reasonId: '',
      reasonCorrect: false,
      confidenceId: '',
      form: item.form || '',
      family: item.family || ''
    };
  }

  function onAnswerChoice(choiceId) {
    if (state.locked) return;
    state.locked = true;

    const item = state.pool[state.index];
    const picked = item.choices.find(c => c.id === choiceId);
    const correct = item.choices.find(c => c.isCorrect);
    const isCorrect = !!picked?.isCorrect;

    state.pending.answerId = choiceId;
    state.pending.answerCorrect = isCorrect;

    if (isCorrect) {
      state.answerCorrect += 1;
      state.score += HYDRATION_V2_CONFIG.POINTS_ANSWER;
    }

    ui.markCurrentChoices(item.choices, choiceId);
    ui.setFeedback(
      isCorrect
        ? `✅ เลือกได้เหมาะมาก<br>${HYDRATION_V2_CONFIG.COPY.coachCorrect}`
        : `❌ ข้อนี้ยังไม่ใช่ที่สุด<br>คำตอบที่เหมาะที่สุดคือ <strong>${correct?.emoji || '💧'} ${correct?.label || ''}</strong>`
    );

    logger.step({
      stepKind: 'answer',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      scenarioId: item.id,
      selectedAnswer: choiceId,
      correctAnswer: correct?.id || '',
      isCorrect,
      totalScore: state.score,
      researchForm: ctx.researchForm || '',
      researchPhase: ctx.researchPhase || ''
    });

    window.setTimeout(() => {
      state.locked = false;
      renderReasonStep();
    }, HYDRATION_V2_CONFIG.FEEDBACK_MS);
  }

  function renderReasonStep() {
    const item = state.pool[state.index];
    ui.renderStep({
      stepType: 'reason',
      phaseLabel: 'เหตุผล',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      score: state.score,
      coachText: HYDRATION_V2_CONFIG.COPY.coachReason,
      title: item.title,
      text: item.text,
      hint: 'เลือกเหตุผลที่ตรงกับคำตอบที่เหมาะที่สุด',
      prompt: 'ทำไมคำตอบนั้นจึงเหมาะที่สุด',
      choices: item.reasons
    }, onReasonChoice);
  }

  function onReasonChoice(reasonId) {
    if (state.locked) return;
    state.locked = true;

    const item = state.pool[state.index];
    const picked = item.reasons.find(r => r.id === reasonId);
    const correct = item.reasons.find(r => r.isCorrect);
    const isCorrect = !!picked?.isCorrect;

    state.pending.reasonId = reasonId;
    state.pending.reasonCorrect = isCorrect;

    if (isCorrect) {
      state.reasonCorrect += 1;
      state.score += HYDRATION_V2_CONFIG.POINTS_REASON;
    }

    ui.markCurrentChoices(item.reasons, reasonId);
    ui.setFeedback(
      isCorrect
        ? '✅ เหตุผลนี้ตรงมาก<br>เก่งมากที่คิดเชื่อมกับสถานการณ์ได้'
        : `❌ ยังไม่ตรงที่สุด<br>เหตุผลที่เหมาะที่สุดคือ <strong>${correct?.emoji || '💡'} ${correct?.label || ''}</strong>`
    );

    logger.step({
      stepKind: 'reason',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      scenarioId: item.id,
      selectedReason: reasonId,
      correctReason: correct?.id || '',
      isCorrect,
      totalScore: state.score,
      researchForm: ctx.researchForm || '',
      researchPhase: ctx.researchPhase || ''
    });

    window.setTimeout(() => {
      state.locked = false;
      renderConfidenceStep();
    }, HYDRATION_V2_CONFIG.FEEDBACK_MS);
  }

  function renderConfidenceStep() {
    const item = state.pool[state.index];
    ui.renderStep({
      stepType: 'confidence',
      phaseLabel: 'ความมั่นใจ',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      score: state.score,
      coachText: HYDRATION_V2_CONFIG.COPY.coachConfidence,
      title: item.title,
      text: item.text,
      hint: 'ไม่มีถูกหรือผิด แค่บอกตามที่เรารู้สึก',
      prompt: 'ตอนนี้เรามั่นใจแค่ไหนกับคำตอบของเรา',
      choices: HYDRATION_V2_CONFIDENCE
    }, onConfidenceChoice);
  }

  function onConfidenceChoice(confidenceId) {
    if (state.locked) return;
    state.locked = true;

    const item = state.pool[state.index];
    state.pending.confidenceId = confidenceId;

    if (confidenceId === 'high') {
      state.highConfidenceCount += 1;
      if (state.pending.answerCorrect) {
        state.score += HYDRATION_V2_CONFIG.POINTS_CONFIDENCE_BONUS;
      }
    }

    ui.markCurrentChoices(HYDRATION_V2_CONFIDENCE, confidenceId);
    ui.setFeedback('🌟 บันทึกความมั่นใจแล้ว ไปต่อข้อต่อไปกัน');

    logger.step({
      stepKind: 'confidence',
      roundNo: state.index + 1,
      totalRounds: state.pool.length,
      scenarioId: item.id,
      confidence: confidenceId,
      answerCorrect: state.pending.answerCorrect,
      reasonCorrect: state.pending.reasonCorrect,
      totalScore: state.score,
      researchForm: ctx.researchForm || '',
      researchPhase: ctx.researchPhase || ''
    });

    state.records.push({
      scenarioId: state.pending.scenarioId,
      form: state.pending.form,
      family: state.pending.family,
      answerId: state.pending.answerId,
      answerCorrect: state.pending.answerCorrect,
      reasonId: state.pending.reasonId,
      reasonCorrect: state.pending.reasonCorrect,
      confidenceId: state.pending.confidenceId
    });

    window.setTimeout(() => {
      state.index += 1;
      state.locked = false;
      if (state.index >= state.pool.length) finish();
      else renderAnswerStep();
    }, HYDRATION_V2_CONFIG.FEEDBACK_MS);
  }

  function finish() {
    const durationMs = Date.now() - state.startedAt;

    const summary = buildHydrationV2Summary({
      score: state.score,
      totalRounds: state.pool.length,
      answerCorrect: state.answerCorrect,
      reasonCorrect: state.reasonCorrect,
      highConfidenceCount: state.highConfidenceCount,
      durationMs,
      meta: {
        records: state.records,
        scenarioIds: state.pool.map(x => x.id)
      }
    }, ctx);

    saveHydrationV2Summary(summary);

    logger.finish({
      scoreFinal: summary.score,
      totalRounds: summary.totalRounds,
      answerCorrect: summary.answerCorrect,
      reasonCorrect: summary.reasonCorrect,
      answerAccuracy: summary.answerAccuracy,
      reasonAccuracy: summary.reasonAccuracy,
      highConfidenceCount: summary.highConfidenceCount,
      durationMs,
      researchForm: ctx.researchForm || '',
      researchPhase: ctx.researchPhase || ''
    });

    onFinished?.(summary, {
      restart: start
    });
  }

  return { start };
}