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
