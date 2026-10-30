/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Lecture des fichiers de données que l'enseignant corrige lui-même (organes, QCM, repérage).
   Formats texte simples, commentés en tête de chaque fichier. En cas d'erreur, le message dit
   quel fichier et quelle ligne corriger (affiché par `npm run build`). */

const lines = txt => txt.replace(/\r\n?/g, '\n').split('\n').map((s, i) => ({ s: s.trim(), n: i + 1 }));
const fail = (file, n, msg) => { throw new Error(`${file}, ligne ${n} : ${msg}`); };

/* organes.txt
   [code] repère Nom de l'organe
   Description sur une ou plusieurs lignes. */
export function parseOrganes(txt, file = 'organes.txt') {
  const out = {}; let cur = null;
  for (const { s, n } of lines(txt)) {
    if (!s || s.startsWith('#')) continue;
    if (s.startsWith('[')) {
      const m = s.match(/^\[([a-z0-9_]+)\]\s+(\S+)\s+(.+)$/i);
      if (!m) fail(file, n, 'une ligne d\'organe s\'écrit « [code] repère Nom », par exemple « [lame] 04 Lame de scie ».');
      if (out[m[1]]) fail(file, n, `le code [${m[1]}] existe déjà plus haut.`);
      cur = out[m[1]] = { n: m[3].trim(), ref: m[2], d: '' };
    } else {
      if (!cur) fail(file, n, 'texte avant le premier organe : commencez par une ligne « [code] repère Nom ».');
      cur.d += (cur.d ? ' ' : '') + s;
    }
  }
  if (!Object.keys(out).length) fail(file, 1, 'aucun organe trouvé.');
  return out;
}

/* qcm.txt : une question par bloc, blocs séparés par une ligne vide.
   Q: question / - mauvaise réponse / + bonne réponse / = explication */
export function parseQcm(txt, file = 'qcm.txt') {
  const out = []; let cur = null;
  const close = n => {
    if (!cur) return;
    const good = cur.o.filter(o => o.ok).length;
    if (cur.o.length < 2) fail(file, cur.n, 'il faut au moins 2 réponses (lignes « + » et « - »).');
    if (cur.o.length > 6) fail(file, cur.n, '6 réponses au plus par question.');
    if (good !== 1) fail(file, cur.n, `il faut exactement une bonne réponse (ligne « + »), ici ${good}.`);
    if (!cur.e) fail(file, cur.n, 'il manque l\'explication (ligne « = »).');
    out.push({ q: cur.q, o: cur.o.map(o => o.t), a: cur.o.findIndex(o => o.ok), e: cur.e });
    cur = null;
  };
  for (const { s, n } of lines(txt)) {
    if (s.startsWith('#')) continue;
    if (!s) { close(n); continue; }
    const k = s[0], t = s.slice(s.startsWith('Q:') || s.startsWith('q:') ? 2 : 1).trim();
    if (s.startsWith('Q:') || s.startsWith('q:')) { close(n); cur = { q: t, o: [], e: '', n }; continue; }
    if (!cur) fail(file, n, 'chaque question commence par une ligne « Q: ».');
    if (!t) fail(file, n, 'ligne vide après le symbole.');
    if (k === '+' || k === '-') cur.o.push({ t, ok: k === '+' });
    else if (k === '=') cur.e += (cur.e ? ' ' : '') + t;
    else fail(file, n, 'une ligne doit commencer par « Q: », « + », « - » ou « = ».');
  }
  close();
  if (!out.length) fail(file, 1, 'aucune question trouvée.');
  return out;
}

/* reperage.txt : une ligne par organe à trouver, dans l'ordre.
   code | vue | nom demandé   (vue et nom facultatifs) */
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function parseReperage(txt, views = [], file = 'reperage.txt') {
  const out = [];
  for (const { s, n } of lines(txt)) {
    if (!s || s.startsWith('#')) continue;
    const [code, vue = '', nom = ''] = s.split('|').map(x => x.trim());
    if (!/^[a-z0-9_]+$/i.test(code)) fail(file, n, `« ${code} » n'est pas un code d'organe (voir les codes entre crochets dans organes.txt).`);
    const cfg = {};
    for (const w of vue.split(',').map(norm).filter(Boolean)) {
      if (w === 'transparence') { cfg.x = 1; continue; }
      const v = views.find(v => norm(v.id) === w || norm(v.label || '') === w);
      if (!v) fail(file, n, `vue « ${w} » inconnue. Vues possibles : transparence, ${views.map(v => (v.label || v.id).toLowerCase()).join(', ')}.`);
      cfg.view = v.id;
    }
    out.push({ k: code, cfg, name: nom });
  }
  if (!out.length) fail(file, 1, 'aucun organe à repérer.');
  return out;
}

/* Contrôle croisé : codes du repérage présents dans la nomenclature. */
export function checkData({ organes, reperage }) {
  for (const r of reperage) if (!organes[r.k]) throw new Error(`reperage.txt : l'organe « ${r.k} » n'existe pas dans organes.txt.`);
}

/* ---------- module « Risques généraux de l'atelier » ---------- */

/* dangers.txt : situations à repérer dans l'atelier (scénario « Repérer les dangers »).
   D: code | ce que l'élève a trouvé      puis   + bonne mesure / - mauvaise mesure / = explication
   P: code | situation correcte (piège)   puis   = explication (pourquoi ce n'est pas un danger) */
export function parseDangers(txt, file = 'dangers.txt') {
  const out = []; let cur = null;
  const close = () => {
    if (!cur) return;
    if (cur.type === 'D') {
      const good = cur.o.filter(o => o.ok).length;
      if (cur.o.length < 2 || cur.o.length > 4) fail(file, cur.n, 'il faut de 2 à 4 mesures (lignes « + » et « - »).');
      if (good !== 1) fail(file, cur.n, `il faut exactement une bonne mesure (ligne « + »), ici ${good}.`);
    } else if (cur.o.length) fail(file, cur.n, 'une situation correcte (« P: ») n\'a pas de mesures « + » ou « - », seulement une explication « = ».');
    if (!cur.e) fail(file, cur.n, 'il manque l\'explication (ligne « = »).');
    out.push({ type: cur.type, k: cur.k, t: cur.t, o: cur.o.map(o => o.t), a: cur.o.findIndex(o => o.ok), e: cur.e });
    cur = null;
  };
  for (const { s, n } of lines(txt)) {
    if (s.startsWith('#')) continue;
    if (!s) { close(); continue; }
    const m = s.match(/^([DP]):\s*([a-z0-9_]+)\s*\|\s*(.+)$/i);
    if (m) { close(); if (out.some(d => d.k === m[2])) fail(file, n, `le code « ${m[2]} » existe déjà plus haut.`);
      cur = { type: m[1].toUpperCase(), k: m[2], t: m[3].trim(), o: [], e: '', n }; continue; }
    if (/^[DP]:/i.test(s)) fail(file, n, 'une situation s\'écrit « D: code | texte » (danger) ou « P: code | texte » (situation correcte).');
    if (!cur) fail(file, n, 'chaque situation commence par une ligne « D: » ou « P: ».');
    const k = s[0], t = s.slice(1).trim();
    if (!t) fail(file, n, 'ligne vide après le symbole.');
    if (k === '+' || k === '-') cur.o.push({ t, ok: k === '+' });
    else if (k === '=') cur.e += (cur.e ? ' ' : '') + t;
    else fail(file, n, 'une ligne doit commencer par « D: », « P: », « + », « - » ou « = ».');
  }
  close();
  if (!out.some(d => d.type === 'D')) fail(file, 1, 'aucun danger trouvé (lignes « D: »).');
  return out;
}

/* epi.txt : équipements proposés et tâches du scénario « Choisir ses EPI ».
   EPI: code | nom affiché
   T: code | tâche     puis   + codes obligatoires (séparés par des virgules) / x codes interdits (faute grave) / = explication */
export function parseEpi(txt, file = 'epi.txt') {
  const epi = [], tasks = []; let cur = null;
  const codes = (s, n) => s.split(',').map(x => x.trim()).filter(Boolean).map(c => { if (!epi.some(e => e.k === c)) fail(file, n, `EPI « ${c} » inconnu : déclarez-le d'abord par une ligne « EPI: ${c} | nom ».`); return c; });
  const close = () => { if (!cur) return; if (!cur.req.length) fail(file, cur.n, 'il faut au moins un EPI obligatoire (ligne « + »).'); if (!cur.e) fail(file, cur.n, 'il manque l\'explication (ligne « = »).'); tasks.push(cur); cur = null; };
  for (const { s, n } of lines(txt)) {
    if (s.startsWith('#')) continue;
    if (!s) { close(); continue; }
    let m = s.match(/^EPI:\s*([a-z0-9_]+)\s*\|\s*(.+)$/i);
    if (m) { close(); if (epi.some(e => e.k === m[1])) fail(file, n, `l'EPI « ${m[1]} » existe déjà.`); epi.push({ k: m[1], n: m[2].trim() }); continue; }
    m = s.match(/^T:\s*([a-z0-9_]+)\s*\|\s*(.+)$/i);
    if (m) { close(); cur = { k: m[1], t: m[2].trim(), req: [], bad: [], e: '', n }; continue; }
    if (!cur) fail(file, n, 'une ligne doit commencer par « EPI: » ou « T: » (ou être dans une tâche).');
    const k = s[0], t = s.slice(1).trim();
    if (k === '+') cur.req.push(...codes(t, n));
    else if (k === 'x' || k === 'X') cur.bad.push(...codes(t, n));
    else if (k === '=') cur.e += (cur.e ? ' ' : '') + t;
    else fail(file, n, 'dans une tâche, une ligne commence par « + » (obligatoires), « x » (interdits) ou « = » (explication).');
  }
  close();
  if (!epi.length) fail(file, 1, 'aucun EPI déclaré (lignes « EPI: »).');
  if (!tasks.length) fail(file, 1, 'aucune tâche (lignes « T: »).');
  for (const t of tasks) for (const c of t.req) if (t.bad.includes(c)) fail(file, t.n, `« ${c} » est à la fois obligatoire et interdit.`);
  return { epi, tasks };
}

/* fiches.txt : fiches de la présentation.
   ## Titre | codes d'équipements montrés dans l'atelier (facultatif, séparés par des virgules)
   paragraphe ; « - » puce ; « > » source */
export function parseFiches(txt, file = 'fiches.txt') {
  const out = []; let cur = null;
  for (const { s, n } of lines(txt)) {
    if (s.startsWith('#') && !s.startsWith('##')) continue;
    if (!s) continue;
    if (s.startsWith('##')) { const [t, c = ''] = s.slice(2).split('|').map(x => x.trim()); if (!t) fail(file, n, 'titre de fiche vide.');
      cur = { t, parts: c.split(',').map(x => x.trim()).filter(Boolean), blocks: [], n }; out.push(cur); continue; }
    if (!cur) fail(file, n, 'chaque fiche commence par une ligne « ## Titre ».');
    if (s.startsWith('- ')) { const last = cur.blocks[cur.blocks.length - 1]; if (last?.ul) last.ul.push(s.slice(2).trim()); else cur.blocks.push({ ul: [s.slice(2).trim()] }); }
    else if (s.startsWith('>')) cur.blocks.push({ src: s.slice(1).trim() });
    else cur.blocks.push({ p: s });
  }
  if (!out.length) fail(file, 1, 'aucune fiche (lignes « ## Titre »).');
  return out;
}
