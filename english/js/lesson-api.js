// /english/js/lesson-api.js
'use strict';

const API_BASE = 'http://127.0.0.1:5001/YOUR_PROJECT_ID/us-central1';

async function postJson(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error || err?.message || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  return res.json();
}

export async function startSession(payload) {
  return postJson('/englishSessionStart', payload);
}

export async function getNextQuestion(payload) {
  return postJson('/englishQuestionNext', payload);
}

export async function submitAnswer(payload) {
  return postJson('/englishAnswerSubmit', payload);
}

export async function finishSession(payload) {
  return postJson('/englishSessionFinish', payload);
}
