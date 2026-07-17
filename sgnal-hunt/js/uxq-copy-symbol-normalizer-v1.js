/* CSAI2601 UX Quest • Copy Symbol Normalizer v1.0
 * Production cleanup for literal LaTeX/control tokens that may leak into generated copy.
 * Presentation only: does not alter scoring, correctness, progress, or Sheet payload keys.
 */
(() => {
  'use strict';

  const REPLACEMENTS = [
    [/\$\\rightarrow\$/g, '→'],
    [/\$\\to\$/g, '→'],
    [/\\rightarrow/g, '→'],
    [/\\to\b/g, '→'],
    [/\$\{?right(?:arrow)?\}?\$/gi, '→'],
    [/\$\s*→\s*\$/g, '→'],
    [/\s+→\s+/g, ' → ']
  ];

  function normalize(value) {
    let output = String(value == null ? '' : value);
    for (const [pattern, replacement] of REPLACEMENTS) {
      output = output.replace(pattern, replacement);
    }
    return output;
  }

  function normalizeControl(control) {
    if (!control || !('value' in control)) return;
    const current = String(control.value || '');
    const next = normalize(current);
    if (next !== current) {
      control.value = next;
      control.dispatchEvent(new Event('input', { bubbles: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const placeholder = String(control.getAttribute('placeholder') || '');
    const nextPlaceholder = normalize(placeholder);
    if (nextPlaceholder !== placeholder) control.setAttribute('placeholder', nextPlaceholder);
  }

  function normalizeTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|CODE|PRE)$/i.test(parent.tagName)) return;
    const current = String(node.nodeValue || '');
    const next = normalize(current);
    if (next !== current) node.nodeValue = next;
  }

  function apply(root = document) {
    root.querySelectorAll?.('textarea,input[type="text"],input:not([type]),[contenteditable="true"]').forEach((element) => {
      if (element.matches('[contenteditable="true"]')) {
        const current = String(element.textContent || '');
        const next = normalize(current);
        if (next !== current) element.textContent = next;
      } else {
        normalizeControl(element);
      }
    });

    const walker = document.createTreeWalker(
      root === document ? document.body : root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return /\\rightarrow|\\to\b|\$\s*→\s*\$|\$\\/.test(String(node.nodeValue || ''))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(normalizeTextNode);
  }

  let timer = 0;
  function schedule(root) {
    clearTimeout(timer);
    timer = setTimeout(() => apply(root || document), 80);
  }

  function boot() {
    apply(document);
    new MutationObserver((mutations) => {
      const root = mutations.find((mutation) => mutation.addedNodes && mutation.addedNodes.length)?.target;
      schedule(root instanceof Element ? root.closest('main,section,article,body') || document : document);
    }).observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches?.('textarea,input,[contenteditable="true"]')) {
        setTimeout(() => normalizeControl(target), 0);
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
