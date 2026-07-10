/* =========================================================
   EAP Gold Choice Bias Fix v20260710
   - Runs after eap-gold-item-bank.js and before the question engine.
   - Removes explicit test-taking cues such as "Select the longest sentence".
   - Replaces short/obvious misconceptions with plausible, similar-length distractors.
   - Keeps source, main, evidence, inference, limitation, scoring, and Sheet sync unchanged.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260710-GOLD-CHOICE-BIAS-FIX-V1';
  const BANK_NAME = 'EAP_GOLD_AUTHORED_BANK';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function words(v){ return clean(v).split(/\s+/).filter(Boolean).length; }

  const GENERIC_FIXES = [
    'Use one detail from the source, but make a conclusion that is broader than the evidence allows.',
    'Focus on a familiar keyword, but miss the main relationship explained in the source.',
    'Choose a statement that sounds academic, but does not fully match the source evidence.',
    'Repeat part of the source, but leave out the limitation needed for a careful conclusion.'
  ];

  const SESSION_FIXES = {
    3: [
      'Use the first detail as support, but ignore how the whole text limits the conclusion.',
      'Treat one focused example as the whole main idea, even though the source is narrower.',
      'Choose a polished sentence that sounds complete, but is broader than the source evidence.',
      'List several details as equally important, but miss the main message of the text.'
    ],
    5: [
      'Accept a claim that sounds confident, but check neither evidence nor source purpose.',
      'Use a true detail from the text, but connect it to an unsupported conclusion.',
      'Choose an opinion-like statement because it sounds strong, not because evidence supports it.',
      'Focus on the topic alone, but miss the difference between claim and evidence.'
    ],
    6: [
      'Copy a useful sentence from the source, but do not show the main idea in new wording.',
      'Keep many examples from the source, but make the summary longer than needed.',
      'Remove the central message while keeping details that sound interesting.',
      'Change several words, but keep the same structure without real paraphrasing.'
    ],
    10: [
      'Report a number correctly, but claim a cause that the data do not prove.',
      'Describe a trend with careful words, but leave out the group or time period.',
      'Use the highest figure only, but ignore the overall pattern shown in the source.',
      'Make the result sound dramatic, but go beyond what the evidence supports.'
    ],
    14: [
      'Mention one support detail, but leave the main presentation message unclear.',
      'Use a confident closing, but make a broader claim than the source can support.',
      'Keep several interesting details, but do not connect them to one clear message.',
      'Sound fluent and complete, but miss the evidence needed for a careful answer.'
    ]
  };

  function isBadCue(text){
    return /(longest|first detail|one example as the main idea|every detail as equally important|without checking|because it sounds formal|only because it sounds|copy|ignore)/i.test(text);
  }

  function balancedSet(sessionNo, source){
    const base = SESSION_FIXES[sessionNo] || GENERIC_FIXES;
    const title = clean(source && source.title).toLowerCase();
    const focus = title ? title.replace(/[^a-z0-9\s-]/g,'').split(/\s+/).slice(0,3).join(' ') : '';
    return base.map((text, i) => {
      let out = text;
      if (focus && !/source|text|evidence|detail|claim|summary|data|message|presentation/i.test(out)) {
        out += ' in this ' + focus + ' task.';
      }
      return out;
    });
  }

  function patchSource(sessionNo, source){
    if (!source || !Array.isArray(source.misconceptions)) return false;
    const old = source.misconceptions.map(clean);
    const replacement = balancedSet(sessionNo, source);
    let changed = false;

    source.misconceptions = old.map((item, index) => {
      const tooShort = words(item) < 9;
      if (isBadCue(item) || tooShort) {
        changed = true;
        return replacement[index % replacement.length];
      }
      return item;
    });

    // Ensure all four distractors are similar enough and no explicit guessing cue survives.
    source.misconceptions = source.misconceptions.map((item, index) => {
      let out = clean(item);
      if (/(longest|first detail|without checking the whole text)/i.test(out)) {
        changed = true;
        out = replacement[index % replacement.length];
      }
      if (words(out) < 11) {
        changed = true;
        out += ' but the evidence link is still incomplete.';
      }
      return out;
    });

    if (changed) {
      source.choiceBiasFixed = VERSION;
      source.choiceQuality = 'balanced-plausible-distractors-no-longest-cue';
    }
    return changed;
  }

  function patch(){
    const bank = window[BANK_NAME];
    if (!bank || !bank.sessions || bank.__choiceBiasFix === VERSION) return false;
    let changed = 0;
    Object.keys(bank.sessions).forEach(key => {
      const sessionNo = Number(key);
      const sources = bank.sessions[key] && bank.sessions[key].sources;
      if (!Array.isArray(sources)) return;
      sources.forEach(source => { if (patchSource(sessionNo, source)) changed += 1; });
    });
    try {
      bank.__choiceBiasFix = VERSION;
      bank.choiceBiasFixSummary = {
        version: VERSION,
        changedSources: changed,
        rule: 'No visible answer should be guessable by longest length or explicit test-taking cue.'
      };
    } catch(_) {}
    return changed;
  }

  function start(){
    patch();
    window.EAPGoldChoiceBiasFix = { version: VERSION, patch };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
