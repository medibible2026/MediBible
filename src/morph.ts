// Plain-English readings of the grammar codes in STEPBible's tagged texts.
// Hebrew/Aramaic: OpenScriptures (OSHB) codes, e.g. "HC/Vqw3ms" (morphemes joined by "/").
// Greek: Robinson codes, e.g. "V-AAI-3S", "N-GSF", "P-2DS".

const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', b: 'common', c: 'common', n: 'neuter' };
const NUMBER: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const STATE: Record<string, string> = { a: 'absolute', c: 'construct', d: 'determined' };
const PERSON: Record<string, string> = { '1': '1st person', '2': '2nd person', '3': '3rd person' };

const HEB_STEM: Record<string, string> = {
  q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil', H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal',
  r: 'Hithpolel', m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal passive', l: 'Pilpel', L: 'Polpal',
  f: 'Hithpalpel', D: 'Nithpael', j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil', v: 'Hishtaphel',
  w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel',
};
const ARAM_STEM: Record<string, string> = {
  q: 'Peal', Q: 'Peil', u: 'Hithpeel', p: 'Pael', P: 'Ithpaal', M: 'Hithpaal', a: 'Aphel', h: 'Haphel',
  s: 'Saphel', e: 'Shaphel', H: 'Hophal', i: 'Ithpeel', t: 'Hishtaphel', v: 'Ishtaphel', w: 'Hithaphel',
  o: 'Polel', z: 'Ithpoel', r: 'Hithpolel', f: 'Hithpalpel', b: 'Hophal', c: 'Tiphel', m: 'Poel', l: 'Palpel',
  L: 'Ithpalpel', O: 'Ithpolel', G: 'Ittaphal',
};
const HEB_CONJ: Record<string, string> = {
  p: 'perfect', q: 'sequential perfect', i: 'imperfect', w: 'sequential imperfect (wayyiqtol)', h: 'cohortative',
  j: 'jussive', v: 'imperative', r: 'active participle', s: 'passive participle', a: 'infinitive absolute',
  c: 'infinitive construct',
};

const pgn = (s: string) => [PERSON[s[0]], GENDER[s[1]], NUMBER[s[2]]].filter(Boolean).join(' ');
const gns = (s: string) => [GENDER[s[0]], NUMBER[s[1]], STATE[s[2]]].filter(Boolean).join(' ');

function hebMorpheme(m: string, aramaic: boolean): string {
  const pos = m[0], t = m[1] ?? '', rest = m.slice(2);
  switch (pos) {
    case 'V': {
      const stem = (aramaic ? ARAM_STEM : HEB_STEM)[t] ?? t;
      const conj = HEB_CONJ[m[2]] ?? '';
      const tail = m.slice(3);
      const form = /[rs]/.test(m[2]) ? gns(tail) : pgn(tail);
      return ['verb', stem, conj, form].filter(Boolean).join(', ');
    }
    case 'N': {
      const kind = { c: 'noun', g: 'gentilic noun', p: 'proper noun', x: 'noun' }[t] ?? 'noun';
      if (t === 'p') return [kind, { m: 'person', f: 'person', l: 'place', t: 'title' }[rest[0]]].filter(Boolean).join(', ');
      return [kind, gns(rest)].filter(Boolean).join(', ');
    }
    case 'A': return [{ a: 'adjective', c: 'cardinal number', g: 'gentilic adjective', o: 'ordinal number' }[t] ?? 'adjective', gns(rest)].filter(Boolean).join(', ');
    case 'P': {
      const kind = { d: 'demonstrative pronoun', f: 'indefinite pronoun', i: 'interrogative pronoun', p: 'personal pronoun', r: 'relative pronoun' }[t] ?? 'pronoun';
      return [kind, t === 'p' ? pgn(rest) : t === 'd' ? [GENDER[rest[0]], NUMBER[rest[1]]].filter(Boolean).join(' ') : ''].filter(Boolean).join(', ');
    }
    case 'S': return { d: 'directional ending (-ah)', h: 'paragogic he', n: 'paragogic nun', p: `pronominal suffix, ${pgn(rest)}` }[t] ?? 'suffix';
    case 'R': return t === 'd' ? 'preposition + article' : 'preposition';
    case 'C': return 'conjunction';
    case 'c': return 'conjunction (sequential vav)';
    case 'D': return 'adverb';
    case 'T': return {
      a: 'particle of affirmation', d: 'definite article', e: 'exhortation particle', i: 'interrogative particle',
      j: 'interjection', m: 'demonstrative particle', n: 'negative particle', o: 'direct object marker',
      r: 'relative particle', c: 'conditional particle',
    }[t] ?? 'particle';
    default: return m;
  }
}

function hebrew(code: string): string {
  const lang = code[0];
  const aramaic = lang === 'A';
  const body = code.slice(1);
  return body.split('/').filter(Boolean).map((m) => hebMorpheme(m, aramaic)).join(' + ') + (aramaic ? ' (Aramaic)' : '');
}

const CASE: Record<string, string> = { N: 'nominative', G: 'genitive', D: 'dative', A: 'accusative', V: 'vocative' };
const GNUM: Record<string, string> = { S: 'singular', P: 'plural' };
const GGEN: Record<string, string> = { M: 'masculine', F: 'feminine', N: 'neuter' };
const TENSE: Record<string, string> = { P: 'present', I: 'imperfect', F: 'future', A: 'aorist', R: 'perfect', L: 'pluperfect', X: 'no tense' };
const VOICE: Record<string, string> = {
  A: 'active', M: 'middle', P: 'passive', E: 'middle or passive', D: 'middle deponent', O: 'passive deponent',
  N: 'middle or passive deponent', Q: 'impersonal active', X: 'no voice',
};
const MOOD: Record<string, string> = { I: 'indicative', S: 'subjunctive', O: 'optative', M: 'imperative', N: 'infinitive', P: 'participle', R: 'imperative participle' };
const SUFFIX: Record<string, string> = { P: 'person', L: 'place', T: 'title', C: 'comparative', S: 'superlative', ATT: 'Attic form', ABB: 'abbreviated', I: 'interrogative', N: 'negative' };
const GPOS: Record<string, string> = {
  N: 'noun', A: 'adjective', T: 'article', P: 'personal pronoun', R: 'relative pronoun', C: 'reciprocal pronoun',
  D: 'demonstrative pronoun', K: 'correlative pronoun', I: 'interrogative pronoun', X: 'indefinite pronoun',
  Q: 'correlative or interrogative pronoun', F: 'reflexive pronoun', S: 'possessive pronoun',
  ADV: 'adverb', CONJ: 'conjunction', COND: 'conditional particle', PRT: 'particle', PREP: 'preposition',
  INJ: 'interjection', ARAM: 'Aramaic word', HEB: 'Hebrew word',
};

const cng = (s: string) => [CASE[s[0]], GNUM[s[1]], GGEN[s[2]]].filter(Boolean).join(' ');

function greek(code: string): string {
  const [pos, a = '', b = '', ...more] = code.split('-');
  const extra = [b && pos !== 'V' ? b : '', ...more].map((x) => SUFFIX[x]).filter(Boolean);
  if (pos === 'V') {
    const m = a.match(/^(\d?)([A-Z])([A-Z])([A-Z])$/);
    if (!m) return `verb (${code})`;
    const tense = `${m[1] ? 'second ' : ''}${TENSE[m[2]] ?? m[2]}`;
    const parts = ['verb', tense, VOICE[m[3]] ?? m[3], MOOD[m[4]] ?? m[4]];
    if (b) parts.push(/^\d/.test(b) ? [PERSON[b[0]], GNUM[b[1]]].filter(Boolean).join(' ') : cng(b));
    return [...parts, ...more.map((x) => SUFFIX[x]).filter(Boolean)].filter(Boolean).join(', ');
  }
  if (pos === 'N' && /^(PRI|LI|OI)$/.test(a)) return { PRI: 'proper name (indeclinable)', LI: 'letter (indeclinable)', OI: 'noun (indeclinable)' }[a]!;
  if (pos === 'A' && a === 'NUI') return 'number (indeclinable)';
  const name = GPOS[pos] ?? pos;
  if (!a) return name;
  if (pos === 'PRT' || pos === 'ADV' || pos === 'CONJ') return [name, SUFFIX[a]].filter(Boolean).join(', ');
  // Personal/reflexive pronouns may lead with a person: P-2DS, F-3ASM
  const person = /^\d/.test(a) ? PERSON[a[0]] : '';
  const rest = person ? a.slice(1) : a;
  const form = rest.length === 2 ? [CASE[rest[0]], GNUM[rest[1]]].filter(Boolean).join(' ') : cng(rest);
  return [name, [person, form].filter(Boolean).join(' '), ...extra].filter(Boolean).join(', ');
}

/** Human-readable grammar for a STEPBible morphology code. */
export function describeMorph(code: string): string {
  if (!code) return '';
  try {
    return /^[HA][A-Za-z]/.test(code) && !code.includes('-') ? hebrew(code) : greek(code);
  } catch {
    return code;
  }
}
