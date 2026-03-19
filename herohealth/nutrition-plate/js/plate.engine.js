// === /herohealth/nutrition-plate/js/plate.engine.js ===
// Main engine for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

import { hydrateQuestion, BUILD_QUESTIONS, getFoodById } from './plate.content.js';
import { getBuildChoiceFeedback, evaluatePlate } from './plate.balance.js';
import { buildFixQuestions, scoreFixQuestion } from './plate.fix.js';
import { buildSwapQuestions, scoreSwapQuestion } from './plate.swap.js';
import { buildPlateMiniQuizQuestions } from './plate.quiz.js';
import { buildPlateSummary } from './plate.summary.js';

const PHASE_LABELS = {
  pre: 'Pre Quiz',
  build: 'Build',
  fix: 'Fix',
  swap: 'Swap',
  post: 'Post Quiz'
};

function createEmptyStats() {
  return {
    score: 0,
    streak: 0,
    bestStreak: 0,

    quiz: {
      pre: { total: 0, correct: 0 },
      post: { total: 0, correct: 0 }
    },

    build: {
      total: 0,
      balanceScore: 0,
      balanceLevel: '',
      vegChosen: false,
      fruitChosen: false,
      healthyDrinkChosen: false
    },

    fix: {
      total: 0,
      correct: 0
    },

    swap: {
      total: 0,
      correct: 0
    }
  };
}

function scoreQuizQuestion(stats, question, answerId) {
  const bucket = stats.quiz[question.quizPhase] || stats.quiz.pre;
  const correct = question.correctId === answerId;
  bucket.total += 1;
  if (correct) bucket.correct += 1;

  return {
    correct,
    delta: 0,
    tone: correct ? 'good' : 'bad',
    feedback: correct
      ? `ถูกเลย! ${question.correctFood.label} เป็นคำตอบที่เหมาะกว่า`
      : `ยังไม่ใช่ — คำตอบที่เหมาะกว่าคือ ${question.correctFood.label}`
  };
}

export class PlateEngine {
  constructor(ctx, logger) {
    this.ctx = ctx;
    this.logger = logger;
    this.reset();
  }

  reset() {
    this.stats = createEmptyStats();
    this.phaseOrder = ['pre', 'build', 'fix', 'swap', 'post'];
    this.phaseIndex = 0;
    this.questionIndex = 0;

    this.plate = {
      base: null,
      protein: null,
      veg: null,
      fruit: null,
      drink: null
    };

    this.plan = {
      pre: buildPlateMiniQuizQuestions('pre'),
      build: BUILD_QUESTIONS.map(hydrateQuestion),
      fix: buildFixQuestions(),
      swap: buildSwapQuestions(),
      post: buildPlateMiniQuizQuestions('post')
    };

    this.logger.log('plate_session_start', {
      diff: this.ctx.diff,
      seed: this.ctx.seed
    });
  }

  getPhaseKey() {
    return this.phaseOrder[this.phaseIndex] || 'done';
  }

  getPhaseLabel() {
    return PHASE_LABELS[this.getPhaseKey()] || 'Done';
  }

  getCurrentQuestion() {
    const phaseKey = this.getPhaseKey();
    return this.plan[phaseKey]?.[this.questionIndex] || null;
  }

  getPhaseQuestions() {
    return this.plan[this.getPhaseKey()] || [];
  }

  getViewState() {
    return {
      phaseKey: this.getPhaseKey(),
      phaseLabel: this.getPhaseLabel(),
      phaseCurrent: this.questionIndex + 1,
      phaseTotal: this.getPhaseQuestions().length,
      score: this.stats.score,
      streak: this.stats.streak,
      plate: this.plate
    };
  }

  submit(answerId) {
    const phaseKey = this.getPhaseKey();
    const question = this.getCurrentQuestion();
    if (!question) return { finished: true };

    let evaluation = {
      correct: false,
      delta: 0,
      tone: 'note',
      feedback: ''
    };

    if (phaseKey === 'pre' || phaseKey === 'post') {
      evaluation = scoreQuizQuestion(this.stats, question, answerId);
    } else if (phaseKey === 'build') {
      const food = getFoodById(answerId);
      this.plate[question.slot] = food;
      this.stats.build.total += 1;

      evaluation = getBuildChoiceFeedback(question.slot, food);

      const isCorrectLike = food.tier === 'best' || food.tier === 'good';
      if (isCorrectLike) {
        this.stats.streak += 1;
        this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
      } else {
        this.stats.streak = 0;
      }

      if (this.questionIndex === this.getPhaseQuestions().length - 1) {
        const balance = evaluatePlate(this.plate);
        this.stats.build.balanceScore = balance.score;
        this.stats.build.balanceLevel = balance.level;
        this.stats.build.vegChosen = !!this.plate.veg?.isVeg;
        this.stats.build.fruitChosen = !!this.plate.fruit?.isFruit;
        this.stats.build.healthyDrinkChosen = !!this.plate.drink?.isHealthyDrink;
        this.stats.score += balance.score;

        evaluation = {
          correct: true,
          delta: balance.score,
          tone: balance.score >= 36 ? 'good' : 'bad',
          feedback: `จานนี้ได้ ${balance.score}/60 (${balance.level}) — ${balance.notes[0] || 'ลองดูจุดที่ควรปรับในรอบต่อไป'}`
        };
      }
    } else if (phaseKey === 'fix') {
      evaluation = scoreFixQuestion(this.stats, question, answerId);
    } else if (phaseKey === 'swap') {
      evaluation = scoreSwapQuestion(this.stats, question, answerId);
    }

    this.logger.log('plate_answer', {
      phase: phaseKey,
      questionId: question.id,
      answerId,
      correctId: question.correctId || null,
      correct: evaluation.correct,
      delta: evaluation.delta,
      quizPhase: question.quizPhase || null,
      plate: {
        base: this.plate.base?.id || null,
        protein: this.plate.protein?.id || null,
        veg: this.plate.veg?.id || null,
        fruit: this.plate.fruit?.id || null,
        drink: this.plate.drink?.id || null
      }
    });

    this.questionIndex += 1;

    const phaseDone = this.questionIndex >= this.getPhaseQuestions().length;
    if (phaseDone) {
      this.phaseIndex += 1;
      this.questionIndex = 0;
    }

    const nextQuestion = this.getCurrentQuestion();
    const finished = !nextQuestion;

    if (finished) {
      const summary = buildPlateSummary(this.ctx, this.stats, this.logger.getSessionMeta(), this.plate);
      this.logger.log('plate_summary_ready', summary.payload.metrics);
      return {
        finished: true,
        evaluation,
        summary
      };
    }

    return {
      finished: false,
      evaluation,
      question: nextQuestion,
      viewState: this.getViewState()
    };
  }
}