/* Fabrication des modules machines.
   Usage : npm run build            → toutes les machines et la page atelier
           npm run build scie-format → une seule machine
           npm run build atelier    → la page atelier seule (dist/atelier.html)
   Fabrication complète : aussi le paquetage unique « Atelier bois 3D » (avec et sans verrous), voir buildPackage.
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
import { zipSync, strToU8 } from 'fflate';
import { renderShell } from '../engine/shell.js';
import { parseOrganes, parseQcm, parseReperage, checkData } from '../engine/data.js';

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
  return { organes: Object.keys(organes).length, qcm: qcm.length, reperage: reperage.length };
}

function manifest(c, files){
  return `<?xml version="1.0" encoding="UTF-8"?>
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
    external: ['three', 'three/addons/*'], loader: { '.txt': 'text' }, charset: 'utf8',
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
  fs.writeFileSync(path.join(DIST, `${id}.html`), page);

  // paquetage SCORM 1.2
  if (config.scorm) {
    const lib = { 'lib/three.module.js': 'build/three.module.js', 'lib/LICENSE-three.txt': 'LICENSE' };
    for (const a of ['controls/OrbitControls.js', 'geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js']) lib[`lib/addons/${a}`] = `examples/jsm/${a}`;
    const index = `<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<script>window.PARCOURS=true;</script>\n<title>${esc(config.scorm.title)}</title>\n${FONTS}\n${style}\n</head>\n<body>\n${shell}\n\n${importmap(LOCAL)}\n${script}\n</body>\n</html>\n`;
    const files = { 'index.html': strToU8(index) };
    for (const [k, src] of Object.entries(lib)) files[k] = new Uint8Array(fs.readFileSync(path.join(THREE_DIR, src)));
    files['imsmanifest.xml'] = strToU8(manifest(config.scorm, Object.keys(files)));
    fs.writeFileSync(path.join(DIST, config.scorm.zip), zipSync(files, { level: 9, mtime: new Date('2026-01-01') }));
  }
  console.log(`${id} : ${counts.organes} organes, ${counts.qcm} questions, ${counts.reperage} organes à repérer → dist/${id}.html${config.scorm ? ', dist/' + config.scorm.zip : ''}`);
}

/* Page « atelier » (entrée visuelle) : le hall en 3D avec les modèles de toutes les machines → dist/atelier.html */
async function buildAtelier(){
  const dir = path.join(ROOT, 'atelier');
  const out = await esbuild.build({
    entryPoints: [path.join(dir, 'main.js')], bundle: true, format: 'esm', write: false,
    external: ['three', 'three/addons/*'], loader: { '.txt': 'text' }, charset: 'utf8',
    target: 'es2020', legalComments: 'none', logLevel: 'silent',
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const engineCss = read(path.join(ROOT, 'engine', 'engine.css'));
  const logo = engineCss.match(/url\((data:image\/webp;base64,[^)]+)\)/)?.[1] || '';
  const css = engineCss + `:root{--logo:url(${logo})}\n` + read(path.join(dir, 'atelier.css'));
  BUILT.atelier = { js, css, shell: read(path.join(dir, 'shell.html')) };
  const page = `<title>Atelier bois 3D</title>\n${FONTS}\n<style>\n${css}</style>\n\n${read(path.join(dir, 'shell.html'))}\n<script type="importmap">\n{"imports":{${CDN}}}\n</script>\n<script type="module">\n${js}</script>\n`;
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, 'atelier.html'), page);
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
const PKG_ORDER = ['scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse', 'toupie', 'tenonneuse', 'scie-format'];
const PKG_PREREQ = { deligneuse: 'scie-radiale', degauchisseuse: 'deligneuse', raboteuse: 'degauchisseuse', toupie: 'raboteuse', tenonneuse: 'toupie' };
const PKG_ATELIER = 'Atelier';
const pkgTitle = (id, i) => `${i + 1}. ${BUILT[id].config.title}`;
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
      <title>Atelier bois 3D – machines à bois (bac pro)</title>
${items.join('\n')}
    </organization>
  </organizations>
  <resources>
${res.join('\n')}
  </resources>
</manifest>
`);
  const zip = lock ? 'Atelier_bois_3D_SCORM12.zip' : 'Atelier_bois_3D_SCORM12_sans_verrous.zip';
  fs.writeFileSync(path.join(DIST, zip), zipSync(files, { level: 9, mtime: new Date('2026-01-01') }));
  console.log(`paquetage unique → dist/${zip} (atelier + ${ids.length} machines${lock ? ', verrous de la chaîne de débit' : ', sans verrous'})`);
}

const only = process.argv[2];
const ids = only ? (only === 'atelier' ? [] : [only]) : fs.readdirSync(path.join(ROOT, 'machines')).filter(d => fs.existsSync(path.join(ROOT, 'machines', d, 'config.js')));
if (!fs.existsSync(THREE_DIR)) { console.error('three.js manquant : lancez d\'abord « npm install ».'); process.exit(1); }
try { for (const id of ids) await buildMachine(id); if (!only || only === 'atelier') await buildAtelier();
  if (!only) { buildPackage(true); buildPackage(false); } }
catch (e) { console.error('\nERREUR : ' + e.message + '\n'); process.exit(1); }
