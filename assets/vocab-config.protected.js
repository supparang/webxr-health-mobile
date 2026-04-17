const __PACK__ = [
  "MER/Z0dYuYeenbqpjsteWm1/QxkWwq+Vk/jlj9k6Pw4ICkMj3MnakZfq1tg0cxFUU15MoNPy+ZiB1uAODBBGMlNRfKmCuNmDv4NxWwUcSVsaAaOgyN+799UReU1fIShMBtTxwLn97togCEE4aUwJO+3kvsmK+MkM",
  "dAUGamUDEvfP9OqHo/ckUggWbTQVEbqshZr076tGTH5BIkZEUqCwnqfq6N4pKiA8VxI+TaDL2YmzstQ="
];
const __KEY__ = 'VH3_CONFIG_KEY!2026';

function __decode() {
  const raw = atob(__PACK__.join(''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const k = __KEY__.charCodeAt(i % __KEY__.length) ^ ((i * 17 + 29) & 255);
    bytes[i] = raw.charCodeAt(i) ^ k;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

let __cache;
export function getVocabConfig() {
  if (!__cache) __cache = Object.freeze(__decode());
  return __cache;
}
