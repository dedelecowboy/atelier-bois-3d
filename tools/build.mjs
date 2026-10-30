/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Fabrication des modules machines.
   Usage : npm run build            → toutes les machines et la page atelier
           npm run build scie-format → une seule machine
           npm run build atelier    → la page atelier seule (dist/atelier.html)
           npm run build attestations → l'outil des attestations seul (dist/Attestations_atelier_bois_3D.html)
   Fabrication complète : aussi le paquetage unique « Atelier bois 3D » (avec et sans verrous), voir buildPackage,
   et le dossier d'entraînement hors ligne (atelier en page d'accueil, sans progression), voir buildTraining.
   Pour chaque machine, dans dist/ :
   - <id>.html : page autonome (three.js chargé depuis cdn.jsdelivr.net), à publier comme artifact
                 ou à ouvrir dans un navigateur ;
   - <zip>     : paquetage SCORM 1.2 pour Moodle (three.js inclus dans lib/, parcours évalué actif).
   Les fichiers de données (organes, QCM, repérage) sont vérifiés d'abord : en cas d'erreur, le message
   indique le fichier et la ligne à corriger. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { zipSync, strToU8, strFromU8 } from 'fflate';

/* droits (demandé par l'enseignant le 30/10/2026) : sur chaque page produite (commentaire en tête, auteur, copyright), dans les manifestes
   SCORM et le LISEZ-MOI du dossier d'entraînement */
const DROITS = 'Julien ANDRE - Lycée André MALRAUX - REMIREMONT';
const NOTICE = `© 2026 ${DROITS}. Licence GNU GPL v3 (fichier LICENSE du projet). Bibliothèque three.js : licence MIT (lib/LICENSE-three.txt). Enregistrements sonores : licences de leurs auteurs (voir le README du projet).`;
function signe(html){ const c = `<!-- ${NOTICE} -->\n`, meta = `<meta name="author" content="${DROITS}">\n<meta name="copyright" content="© 2026 ${DROITS}">`;
  if (/^<!doctype/i.test(html)) { const i = html.indexOf('\n') + 1; html = html.slice(0, i) + c + html.slice(i); return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${meta}`); }
  return c + meta + '\n' + html; }
const signeZip = files => { for (const k of Object.keys(files)) if (k.endsWith('.html')) files[k] = strToU8(signe(strFromU8(files[k]))); return files; };
import { renderShell } from '../engine/shell.js';
import { parseOrganes, parseQcm, parseReperage, checkData, parseDangers, parseEpi, parseFiches } from '../engine/data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const THREE_V = '0.160.0';
const CDN = `"three":"https://cdn.jsdelivr.net/npm/three@${THREE_V}/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@${THREE_V}/examples/jsm/"`;
const LOCAL = '"three":"./lib/three.module.js","three/addons/":"./lib/addons/"';
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">';

const read = f => fs.readFileSync(f, 'utf8');
const readIf = f => fs.existsSync(f) ? read(f) : '';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

function checkMachineData(dir, config){
  const D = f => path.join(dir, 'data', f);
  const organes = parseOrganes(read(D('organes.txt')));
  const qcm = parseQcm(read(D('qcm.txt')));
  const reperage = parseReperage(read(D('reperage.txt')), config.views);
  checkData({ organes, reperage });
  // chaque organe du modèle 3D doit exister dans organes.txt
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    for (const m of read(path.join(dir, f)).matchAll(/tagPart\([^;]*?,\s*'([a-z0-9_]+)'\)/g))
      if (!organes[m[1]]) throw new Error(`organes.txt : l'organe [${m[1]}] est utilisé par le modèle 3D (${f}) mais n'est pas dans le fichier.`);
  }
  /* module « Risques généraux » : situations dangereuses, EPI, fiches */
  if (fs.existsSync(D('dangers.txt'))) {
    const dangers = parseDangers(read(D('dangers.txt')));
    const codes = new Set(fs.readdirSync(dir).filter(f => f.endsWith('.js')).flatMap(f => [...read(path.join(dir, f)).matchAll(/danger\('([a-z0-9_]+)'/g)].map(m => m[1])).concat(['armoire_ouverte']));
    for (const d of dangers) if (!codes.has(d.k)) throw new Error(`dangers.txt : la situation « ${d.k} » n'existe pas dans la scène 3D (codes possibles : ${[...codes].join(', ')}).`);
  }
  if (fs.existsSync(D('epi.txt'))) { const { tasks } = parseEpi(read(D('epi.txt')));
    if (tasks.length !== 4) throw new Error(`epi.txt : il faut exactement 4 tâches (une par critère noté), ici ${tasks.length}.`);
    for (const t of tasks) if (!['toupie', 'poncage', 'manutention', 'vernis'].includes(t.k)) throw new Error(`epi.txt : tâche « ${t.k} » inconnue (codes possibles : toupie, poncage, manutention, vernis).`); }
  if (fs.existsSync(D('fiches.txt'))) for (const f of parseFiches(read(D('fiches.txt')))) for (const k of f.parts)
    if (!organes[k]) throw new Error(`fiches.txt, ligne ${f.n} : l'équipement « ${k} » n'est pas dans organes.txt.`);
  return { organes: Object.keys(organes).length, qcm: qcm.length, reperage: reperage.length };
}

function manifest(c, files){
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${NOTICE} -->
<manifest identifier="${c.identifier}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${esc(c.orgTitle)}</title>
      <item identifier="ITEM1" identifierref="RES1" isvisible="true">
        <title>${esc(c.itemTitle)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index.html">
${files.map(f => `      <file href="${f}"/>`).join('\n')}
    </resource>
  </resources>
</manifest>
`;
}

async function buildMachine(id){
  const dir = path.join(ROOT, 'machines', id);
  const config = (await import(path.join(dir, 'config.js'))).default;
  const counts = checkMachineData(dir, config);

  const out = await esbuild.build({
    entryPoints: [path.join(dir, 'main.js')], bundle: true, format: 'esm', write: false,
    external: ['three', 'three/addons/*'], loader: { '.txt': 'text', '.mp3': 'dataurl' }, charset: 'utf8',
    target: 'es2020', legalComments: 'none', logLevel: 'silent',
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = read(path.join(ROOT, 'engine', 'engine.css')) + readIf(path.join(dir, 'style.css'));
  const shell = renderShell(config, {
    settings: readIf(path.join(dir, 'settings.html')), dock: readIf(path.join(dir, 'dock.html')), panel: readIf(path.join(dir, 'panel.html')),
    pupitre: readIf(path.join(dir, 'pupitre.html')) });
  const importmap = map => `<script type="importmap">\n{"imports":{${map}}}\n</script>`;
  const style = `<style>\n${css}</style>`;
  const script = `<script type="module">\n${js}</script>`;

  BUILT[id] = { config, js, css, shell };
  fs.mkdirSync(DIST, { recursive: true });
  // page autonome (fragment : l'artifact claude.ai ajoute lui-même <html>, <head>, <body>)
  const page = `<title>${esc(config.pageTitle)}</title>\n${FONTS}\n${style}\n\n${shell}\n\n${importmap(CDN)}\n${script}\n`;
  fs.writeFileSync(path.join(DIST, `${id}.html`), signe(page));

  // paquetage SCORM 1.2
  if (config.scorm) {
    const lib = { 'lib/three.module.js': 'build/three.module.js', 'lib/LICENSE-three.txt': 'LICENSE' };
    for (const a of ['controls/OrbitControls.js', 'geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js']) lib[`lib/addons/${a}`] = `examples/jsm/${a}`;
    const index = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<script>window.PARCOURS=true;</script>\n<title>${esc(config.scorm.title)}</title>\n${FONTS}\n${style}\n</head>\n<body>\n${shell}\n\n${importmap(LOCAL)}\n${script}\n</body>\n</html>\n`;
    const files = { 'index.html': strToU8(index) };
    for (const [k, src] of Object.entries(lib)) files[k] = new Uint8Array(fs.readFileSync(path.join(THREE_DIR, src)));
    files['imsmanifest.xml'] = strToU8(manifest(config.scorm, Object.keys(files)));
    fs.writeFileSync(path.join(DIST, config.scorm.zip), zipSync(signeZip(files), { level: 9, mtime: new Date('2026-01-01') }));
  }
  console.log(`${id} : ${counts.organes} organes, ${counts.qcm} questions, ${counts.reperage} organes à repérer → dist/${id}.html${config.scorm ? ', dist/' + config.scorm.zip : ''}`);
}

/* Page « atelier » (entrée visuelle) : le hall en 3D avec les modèles de toutes les machines → dist/atelier.html */
async function buildAtelier(){
  const dir = path.join(ROOT, 'atelier');
  const out = await esbuild.build({
    entryPoints: [path.join(dir, 'main.js')], bundle: true, format: 'esm', write: false,
    external: ['three', 'three/addons/*'], loader: { '.txt': 'text', '.mp3': 'dataurl' }, charset: 'utf8',
    target: 'es2020', legalComments: 'none', logLevel: 'silent',
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const engineCss = read(path.join(ROOT, 'engine', 'engine.css'));
  const logo = engineCss.match(/url\((data:image\/webp;base64,[^)]+)\)/)?.[1] || '';
  const css = engineCss + `:root{--logo:url(${logo})}\n` + read(path.join(dir, 'atelier.css'));
  BUILT.atelier = { js, css, shell: read(path.join(dir, 'shell.html')) };
  const page = `<title>Atelier bois 3D</title>\n${FONTS}\n<style>\n${css}</style>\n\n${read(path.join(dir, 'shell.html'))}\n<script type="importmap">\n{"imports":{${CDN}}}\n</script>\n<script type="module">\n${js}</script>\n`;
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'atelier.html'), signe(page));
  console.log('atelier → dist/atelier.html');
}

/* ---------- paquetage unique « Atelier bois 3D » (SCORM 1.2, un élément par machine) ----------
   Un seul zip pour Moodle : l'atelier puis un élément noté par machine (SCO). L'atelier est aussi une SCO (Moodle ne
   lance jamais un « asset » de lui-même : il ouvrait la scie radiale) qui reste toujours « incomplete » : Moodle ouvre
   le premier élément non terminé, donc l'atelier à chaque entrée, et il ne compte pas dans « Objets d'apprentissage ».
   three.js partagé dans lib/. Chaque machine a sa note, son statut, ses interactions et son objectif dans les rapports
   SCORM ; le carnet de notes n'a qu'une colonne (méthode conseillée : « Objets d'apprentissage » = machines validées).
   Deux versions : avec verrous (prérequis : la machine précédente de la chaîne de débit réussie) et sans verrous. */
const BUILT = {};
/* ordre et verrous (décidés par l'enseignant le 30/10/2026) : risques généraux, puis la chaîne de débit et de corroyage
   (scie radiale → déligneuse → dégauchisseuse → raboteuse) ; après la raboteuse, tout est ouvert : la suite dépend des pièces
   (toupie, mortaiseuse, tenonneuse ; la mortaise se fait avant le tenon, car on ajuste le tenon à la mortaise : c'est dans les
   exercices, pas dans les verrous) ; scie à format et scie à ruban ouvertes dès les risques généraux */
const PKG_ORDER = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'mortaiseuse', 'tenonneuse', 'scie-format', 'scie-ruban'];
const PKG_PREREQ = { 'scie-radiale': 'risques', 'scie-format': 'risques', 'scie-ruban': 'risques', deligneuse: 'scie-radiale', degauchisseuse: 'deligneuse', raboteuse: 'degauchisseuse', toupie: 'raboteuse', mortaiseuse: 'raboteuse', tenonneuse: 'raboteuse' };
const PKG_ATELIER = 'Atelier';
/* numérotation (depuis le 30/10/2026) : « 0. Risques généraux », 1. Scie radiale … 4. Raboteuse, 5. Toupie, 6. Mortaiseuse, 7. Tenonneuse,
   8. Scie à format, 9. Scie à ruban (les identifiants des éléments ne changent pas : les notes déjà enregistrées restent à leur machine) */
const pkgTitle = (id, i) => `${BUILT.risques ? i : i + 1}. ${BUILT[id].config.title}`;
const itemId = id => 'ITEM_' + BUILT[id].config.scorm.code;
function buildPackage(lock){
  const ids = PKG_ORDER.filter(id => BUILT[id]);
  const titles = Object.fromEntries(ids.map((id, i) => [id, pkgTitle(id, i)]));
  const prereq = lock ? Object.fromEntries(ids.filter(id => PKG_PREREQ[id] && BUILT[PKG_PREREQ[id]]).map(id => [id, PKG_PREREQ[id]])) : {};
  const PKG = `<script>window.ATELIER_PKG=${JSON.stringify({ atelier: PKG_ATELIER, titles, prereq })};</script>`;
  const LIBMAP = '"three":"../lib/three.module.js","three/addons/":"../lib/addons/"';
  const doc = (title, head, body, js) => `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n<title>${esc(title)}</title>\n${FONTS}\n</head>\n<body>\n${body}\n<script type="importmap">\n{"imports":{${LIBMAP}}}\n</script>\n<script type="module">\n${js}</script>\n</body>\n</html>\n`;
  const files = {};
  const lib = { 'lib/three.module.js': 'build/three.module.js', 'lib/LICENSE-three.txt': 'LICENSE' };
  for (const a of ['controls/OrbitControls.js', 'geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js']) lib[`lib/addons/${a}`] = `examples/jsm/${a}`;
  for (const [k, src] of Object.entries(lib)) files[k] = new Uint8Array(fs.readFileSync(path.join(THREE_DIR, src)));
  const A = BUILT.atelier;
  files['atelier/index.html'] = strToU8(doc('Atelier bois 3D', PKG, `<style>\n${A.css}</style>\n${A.shell}`, A.js));
  for (const id of ids){ const B = BUILT[id];
    files[`${id}/index.html`] = strToU8(doc(B.config.scorm.title, `<script>window.PARCOURS=true;</script>\n${PKG}`, `<style>\n${B.css}</style>\n${B.shell}`, B.js)); }
  const libFiles = Object.keys(lib);
  const items = [`      <item identifier="ITEM_ATELIER" identifierref="RES_ATELIER" isvisible="true">\n        <title>${esc(PKG_ATELIER)}</title>\n      </item>`]
    .concat(ids.map((id, i) => `      <item identifier="${itemId(id)}" identifierref="RES_${BUILT[id].config.scorm.code}" isvisible="true">\n        <title>${esc(pkgTitle(id, i))}</title>\n`
      + (lock && PKG_PREREQ[id] && BUILT[PKG_PREREQ[id]] ? `        <adlcp:prerequisites type="aicc_script">${itemId(PKG_PREREQ[id])}</adlcp:prerequisites>\n` : '')
      + `      </item>`));   // pas de masteryscore : le module pose lui-même passed / failed (70 ET aucune faute grave)
  const res = [`    <resource identifier="RES_LIB" type="webcontent" adlcp:scormtype="asset">\n${libFiles.map(f => `      <file href="${f}"/>`).join('\n')}\n    </resource>`,
    `    <resource identifier="RES_ATELIER" type="webcontent" adlcp:scormtype="sco" href="atelier/index.html">\n      <file href="atelier/index.html"/>\n      <dependency identifierref="RES_LIB"/>\n    </resource>`]
    .concat(ids.map(id => `    <resource identifier="RES_${BUILT[id].config.scorm.code}" type="webcontent" adlcp:scormtype="sco" href="${id}/index.html">\n      <file href="${id}/index.html"/>\n      <dependency identifierref="RES_LIB"/>\n    </resource>`));
  files['imsmanifest.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<!-- ${NOTICE} -->
<manifest identifier="ATELIER_BOIS_3D" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>Atelier bois 3D – risques généraux et machines à bois (bac pro)</title>
${items.join('\n')}
    </organization>
  </organizations>
  <resources>
${res.join('\n')}
  </resources>
</manifest>
`);
  const zip = lock ? 'Atelier_bois_3D_SCORM12.zip' : 'Atelier_bois_3D_SCORM12_sans_verrous.zip';
  fs.writeFileSync(path.join(DIST, zip), zipSync(signeZip(files), { level: 9, mtime: new Date('2026-01-01') }));
  console.log(`paquetage unique → dist/${zip} (atelier + ${ids.length} éléments${lock ? ', verrous : risques généraux puis chaîne de débit' : ', sans verrous'})`);
}

/* ---------- dossier d'entraînement hors ligne « Atelier bois 3D – Entraînement » (demandé par l'enseignant le 29/10/2026) ----------
   Sans Moodle et sans progression : index.html = l'atelier 3D (page d'accueil), <id>/index.html = chaque module, ouvert dans
   le même onglet (« Ouvrir le simulateur » / « ← Atelier »). three.js est intégré à chaque page (pas d'importmap ni de fichier
   à charger) : les pages s'ouvrent aussi depuis le disque (file://), sur clé USB, sans internet (polices de secours). */
async function buildTraining(){
  const bundle = async entry => (await esbuild.build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, minify: true,
    loader: { '.txt': 'text', '.mp3': 'dataurl' }, charset: 'utf8', target: 'es2020', legalComments: 'none', logLevel: 'silent' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const doc = (title, body, js) => `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<script>window.ATELIER_LOCAL=true;</script>\n<title>${esc(title)}</title>\n${FONTS}\n</head>\n<body>\n${body}\n<script type="module">\n${js}</script>\n</body>\n</html>\n`;
  const files = { 'index.html': strToU8(doc('Atelier bois 3D – Entraînement', `<style>\n${BUILT.atelier.css}</style>\n${BUILT.atelier.shell}`, await bundle(path.join(ROOT, 'atelier', 'main.js')))) };
  const ids = PKG_ORDER.filter(id => BUILT[id]);
  for (const id of ids) { const B = BUILT[id];
    files[`${id}/index.html`] = strToU8(doc(B.config.pageTitle || B.config.title, `<style>\n${B.css}</style>\n${B.shell}`, await bundle(path.join(ROOT, 'machines', id, 'main.js')))); }
  files['LISEZ-MOI.txt'] = strToU8(`Atelier bois 3D – version d'entraînement (sans note, sans Moodle)\r\n\r\nDézippez le dossier, puis ouvrez index.html dans Chrome, Edge ou Firefox : l'atelier 3D s'affiche.\r\nCliquez une machine, puis « Ouvrir le simulateur ». Le bouton « ← Atelier » ramène à l'atelier.\r\nRien n'est enregistré ni noté ; les fiches lues sont seulement gardées dans ce navigateur.\r\n\r\n© 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3. three.js : licence MIT. Enregistrements sonores : licences de leurs auteurs.\r\n`);
  fs.writeFileSync(path.join(DIST, 'Atelier_bois_3D_entrainement.zip'), zipSync(signeZip(files), { level: 9, mtime: new Date('2026-01-01') }));
  /* le même dossier, dézippé, pour le site public (GitHub Pages, .github/workflows/fabrication.yml) : dist/site/index.html = l'atelier */
  const SITE = path.join(DIST, 'site'); fs.rmSync(SITE, { recursive: true, force: true });
  for (const [k, v] of Object.entries(files)) { const f = path.join(SITE, k); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); }
  console.log(`entraînement hors ligne → dist/Atelier_bois_3D_entrainement.zip (atelier + ${ids.length} modules, three.js intégré)`);
}

const only = process.argv[2];

/* Outil des attestations (pour l'enseignant, ouvert dans son navigateur : l'impression ne marche pas dans un artifact) :
   attestations/attestations.html + images des machines (attestations/img, tools/capture_machines.py), logo du lycée et polices (attestations/fonts),
   en un seul fichier → dist/Attestations_atelier_bois_3D.html */
function buildAttestations(){
  const dir = path.join(ROOT, 'attestations');
  const logo = read(path.join(ROOT, 'engine', 'engine.css')).match(/url\((data:image\/webp;base64,[^)]+)\)/)?.[1] || '';
  const img = {}; for (const f of fs.readdirSync(path.join(dir, 'img')).filter(f => f.endsWith('.webp')))
    img[f.replace('.webp', '')] = 'data:image/webp;base64,' + fs.readFileSync(path.join(dir, 'img', f)).toString('base64');
  const page = read(path.join(dir, 'attestations.html')).replace('/*IMAGES*/{}', JSON.stringify(img)).replace('/*LOGO*/', logo)
    .replace('/*FONTS*/', fs.readdirSync(path.join(dir, 'fonts')).map(f => { const [, fam, w] = f.match(/^(.+)-latin-(\d+)-normal\.woff2$/);
      const name = fam.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join(' ');
      return `@font-face{font-family:'${name}';font-weight:${w};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, 'fonts', f)).toString('base64')}) format('woff2')}`; }).join('\n'));
  fs.writeFileSync(path.join(DIST, 'Attestations_atelier_bois_3D.html'), signe(page));
  console.log('attestations → dist/Attestations_atelier_bois_3D.html');
}
/* Banc d'écoute du bruit (pour l'enseignant) : engine/banc-son.js → dist/Ecoute_bruit.html, une page seule hors ligne */
async function buildBanc(){
  const js = (await esbuild.build({ entryPoints: [path.join(ROOT, 'engine', 'banc-son.js')], bundle: true, format: 'esm', write: false, minify: true,
    loader: { '.mp3': 'dataurl' }, charset: 'utf8', target: 'es2020', legalComments: 'none', logLevel: 'silent' })).outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  fs.writeFileSync(path.join(DIST, 'Ecoute_bruit.html'), signe(`<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Écoute du bruit – toupie</title>\n</head>\n<body>\n<script type="module">\n${js}</script>\n</body>\n</html>\n`));
  console.log('banc d\'écoute → dist/Ecoute_bruit.html');
}
const ids = only ? (only === 'atelier' || only === 'attestations' || only === 'banc' ? [] : [only]) : fs.readdirSync(path.join(ROOT, 'machines')).filter(d => fs.existsSync(path.join(ROOT, 'machines', d, 'config.js')));
if (!fs.existsSync(THREE_DIR)) { console.error('three.js manquant : lancez d\'abord « npm install ».'); process.exit(1); }
try { for (const id of ids) await buildMachine(id); if (!only || only === 'atelier') await buildAtelier();
  if (!only || only === 'attestations') buildAttestations();
  if (!only || only === 'banc') await buildBanc();
  if (!only) { buildPackage(true); buildPackage(false); await buildTraining(); } }
catch (e) { console.error('\nERREUR : ' + e.message + '\n'); process.exit(1); }
