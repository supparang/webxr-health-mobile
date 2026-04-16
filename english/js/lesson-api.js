// /english/js/lesson-api.js
'use strict';

const API_BASE = 'https://YOUR_API_BASE_URL';

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
  return postJson('/english/session/start', payload);
}

export async function getNextQuestion(payload) {
  return postJson('/english/question/next', payload);
}

export async function submitAnswer(payload) {
  return postJson('/english/answer/submit', payload);
}

export async function finishSession(payload) {
  return postJson('/english/session/finish', payload);
}

export async function saveLeaderboard(payload) {
  return postJson('/english/leaderboard/save', payload);
}
