// Split Swedish text into clickable words and the text between them. Pure.
const WORD = /[\p{L}\p{N}]+(?:[-:'’][\p{L}\p{N}]+)*/gu;

export function tokenize(text) {
  const out = [];
  let last = 0;
  for (const m of String(text || "").matchAll(WORD)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < String(text || "").length) out.push({ text: text.slice(last), word: false });
  return out;
}
