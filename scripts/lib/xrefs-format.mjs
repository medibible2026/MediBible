// Compact cross-reference format (v2), shared by the build scripts. src/data.ts decodes the same format.
//
// Link order is canonical: by source verse, then by target verse. A link's index in that order is
// its id everywhere (links.json kinds/evidence refer to it). The app re-sorts by votes for display.
//
//   { v: 2, attribution, counts: [links per source verse],
//     dt: [target - previous target (first: target - source)], sp: [extra verses], vo: [votes] }
// Small deltas in separate columns compress far better than [target, span, votes] triples.

/** rows[source] = [[target, span, votes], ...] -> v2 object (rows are sorted in place). */
export function encodeXrefs(rows, attribution) {
  const counts = [], dt = [], sp = [], vo = [];
  rows.forEach((list, from) => {
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    counts.push(list.length);
    let prev = from;
    for (const [t, span, votes] of list) {
      dt.push(t - prev);
      prev = t;
      sp.push(span);
      vo.push(votes);
    }
  });
  return { v: 2, attribution, counts, dt, sp, vo };
}

/** v2 object -> { attribution, offsets, data } with data as [target, span, votes] triples in canonical order. */
export function decodeXrefs(x) {
  if (x.v !== 2) throw new Error('xrefs.json is not in format v2; run "npm run data"');
  const n = x.counts.length;
  const offsets = new Int32Array(n + 1);
  const data = new Int32Array(x.dt.length * 3);
  let k = 0;
  for (let from = 0; from < n; from++) {
    offsets[from] = k;
    let prev = from;
    for (let i = 0; i < x.counts[from]; i++, k++) {
      prev += x.dt[k];
      data[k * 3] = prev;
      data[k * 3 + 1] = x.sp[k];
      data[k * 3 + 2] = x.vo[k];
    }
  }
  offsets[n] = k;
  return { attribution: x.attribution, offsets, data };
}
