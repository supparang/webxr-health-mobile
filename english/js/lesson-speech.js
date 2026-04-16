// /english/js/lesson-speech.js
'use strict';

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function isSpeechSupported() {
  return !!SpeechRecognition;
}

export function createSpeechCapture({ onStart, onResult, onError, onEnd } = {}) {
  if (!SpeechRecognition) {
    return {
      start() {
        onError?.(new Error('Speech recognition is not supported on this device.'));
      },
      stop() {}
    };
  }

  const recog = new SpeechRecognition();
  recog.lang = 'en-US';
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  recog.continuous = false;

  recog.onstart = () => onStart?.();
  recog.onerror = (ev) => onError?.(new Error(ev.error || 'speech_error'));
  recog.onend = () => onEnd?.();

  recog.onresult = (ev) => {
    const result = ev.results?.[0]?.[0];
    const transcript = result?.transcript || '';
    const confidence = Number(result?.confidence || 0);
    onResult?.({
      transcript,
      confidence
    });
  };

  return {
    start() {
      recog.start();
    },
    stop() {
      recog.stop();
    }
  };
}
