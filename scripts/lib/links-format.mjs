// Compact evidence format for links.json (v2), shared by build-links and the fingerprint check.
// src/data.ts decodes the same format.
//
// Evidence is stored column-wise for the links that have any, in link-id order:
//   ids:   delta-encoded link ids        mask:  bit 1 = p, 2 = w, 4 = l, 8 = e
//   p:     shared KJV phrases            wc/wi: lemma counts / flat lemma indexes
//   lc/li: pair counts / flat [greek, hebrew, source] triples
//   words: distinct English words        ec/ei: word counts / flat word indexes

/** Map<linkId, {p?, w?, l?, e?}> -> columnar object. */
export function encodeEvidence(evidence) {
  const out = { ids: [], mask: [], p: [], wc: [], wi: [], lc: [], li: [], words: [], ec: [], ei: [] };
  const wordIndex = new Map();
  let prev = 0;
  for (const id of [...evidence.keys()].sort((a, b) => a - b)) {
    const e = evidence.get(id);
    out.ids.push(id - prev);
    prev = id;
    let mask = 0;
    if (e.p) { mask |= 1; out.p.push(e.p); }
    if (e.w) { mask |= 2; out.wc.push(e.w.length); out.wi.push(...e.w); }
    if (e.l) { mask |= 4; out.lc.push(e.l.length); for (const t of e.l) out.li.push(...t); }
    if (e.e) {
      mask |= 8;
      out.ec.push(e.e.length);
      for (const w of e.e) {
        if (!wordIndex.has(w)) { wordIndex.set(w, out.words.length); out.words.push(w); }
        out.ei.push(wordIndex.get(w));
      }
    }
    out.mask.push(mask);
  }
  return out;
}

/** Columnar object -> Map<linkId, {p?, w?, l?, e?}>. */
export function decodeEvidence(c) {
  const map = new Map();
  let id = 0, p = 0, w = 0, wi = 0, l = 0, li = 0, e = 0, ei = 0;
  for (let i = 0; i < c.ids.length; i++) {
    id += c.ids[i];
    const m = c.mask[i];
    const ev = {};
    if (m & 1) ev.p = c.p[p++];
    if (m & 2) { const n = c.wc[w++]; ev.w = c.wi.slice(wi, wi + n); wi += n; }
    if (m & 4) {
      const n = c.lc[l++];
      ev.l = [];
      for (let j = 0; j < n; j++, li += 3) ev.l.push([c.li[li], c.li[li + 1], c.li[li + 2]]);
    }
    if (m & 8) { const n = c.ec[e++]; ev.e = c.ei.slice(ei, ei + n).map((x) => c.words[x]); ei += n; }
    map.set(id, ev);
  }
  return map;
}
