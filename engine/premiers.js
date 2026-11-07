/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Premiers pas (demandé par l'enseignant le 07/11/2026) : courte présentation en quelques cartes, à l'entrée de l'atelier
   et de chaque module : comment la page marche et comment on obtient le permis machine.
     - s'ouvre seule à la PREMIÈRE visite de la page (par navigateur : localStorage `atelier.premiers` = clés déjà vues) ;
       rouverte à tout moment par le bouton « ? » de l'en-tête ;
     - « Passer », Échap, ou la dernière carte (« C'est parti ») la ferment ; ← / → changent de carte ;
     - l'en-tête reste visible et utilisable dessous (confort de lecture « Aa », 🔈 Lire, son, plein écran) ;
     - rien n'est noté ni envoyé à Moodle.
   Textes adaptés à la version : paquetage Moodle unique (`window.ATELIER_PKG`), paquetage séparé (`window.PARCOURS` seul),
   dossier d'entraînement hors ligne (`window.ATELIER_LOCAL`) ou page web d'entraînement.
   Tests automatiques (navigator.webdriver) : pas d'ouverture seule, sauf `window.PREMIERS_TEST` (les tests existants ne la voient pas). */
import { badgeSVG, module as modDe, niveauDe, NIVEAUX, PREREQ, REGLE, SEUIL } from './permis.js';

const STORE = 'atelier.premiers';
const V = 1;   // augmenter quand le contenu change beaucoup : les cartes se rouvrent une fois pour tout le monde
const esc = s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const lire = ()=>{ try{ const v=JSON.parse(localStorage.getItem(STORE)||'null'); return v && v.v===V && Array.isArray(v.vus)? v.vus : []; }catch(e){ return []; } };
export const dejaVu = cle=>lire().includes(cle);
export function marquerVu(cle){ const v=lire(); if(v.includes(cle)) return; v.push(cle); try{ localStorage.setItem(STORE, JSON.stringify({ v:V, vus:v })); }catch(e){} }

/* version de la page : 'moodle' (paquetage unique), 'scorm' (paquetage séparé), 'local' (dossier hors ligne), 'web' */
export function version(){
  if(window.ATELIER_PKG) return 'moodle';
  if(window.PARCOURS) return 'scorm';
  return window.ATELIER_LOCAL? 'local' : 'web'; }

/* ---------- petits blocs ---------- */
const etapes = L=>`<ol class="pp-steps">${L.map(([t,s])=>`<li><b>${t}</b>${s?`<span>${s}</span>`:''}</li>`).join('')}</ol>`;
const puces = L=>`<ul class="pp-ul">${L.map(t=>`<li>${t}</li>`).join('')}</ul>`;
const ICO = {
  tourner:'<path d="M5 12a7 7 0 0 1 12-5l2 2M19 12a7 7 0 0 1-12 5l-2-2"/><path d="M19 4v5h-5M5 20v-5h5"/>',
  zoom:'<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
  toucher:'<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l4.4 1a2 2 0 0 1 1.5 2.3L17 20H10l-4-5.2a1.6 1.6 0 0 1 2.4-2z"/>',
  liste:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  aa:'<path d="M3 19 8 5l5 14M4.8 14h6.4M15 19v-6.5a3 3 0 0 1 6 0V19M15 15.5h6"/>',
};
const geste = (i,t)=>`<div class="pp-g"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[i]}</svg><span>${t}</span></div>`;
const gestes = L=>`<div class="pp-gs">${L.map(g=>geste(...g)).join('')}</div>`;
const nomMod = id=>modDe(id)?.nom || id;
const seuil = ()=>SEUIL.replace(/^validez l'évaluation\s*/,'').replace(/^\((.*)\)$/,'$1');   // « 70 / 100, aucune faute grave »
const regle = ()=> REGLE? `<p class="pp-regle">${esc(REGLE)}</p>` : '';

/* ---------- cartes de la page atelier ---------- */
export function cartesAtelier(ver=version()){
  const train = ver==='local' || ver==='web';
  const C=[];
  C.push({ t:'Bienvenue dans l\'atelier',
    html:`<p class="pp-lead">C'est l'atelier menuiserie du lycée, en 3D. Chaque poste en couleur est une machine : touchez-la pour ouvrir sa fiche, puis son simulateur.</p>`
      + gestes([['tourner','Glisser : tourner autour de la salle'], ['zoom','Molette ou pincement : zoomer'], ['toucher','Toucher une machine : sa fiche'], ['liste','Liste des postes à gauche']]) });
  C.push({ t:'Une machine, trois étapes',
    html: etapes([
      ['Lire les fiches', 'À quoi sert la machine, ses organes, ses réglages, ses risques. Lecture obligatoire avant l\'évaluation.'],
      ['S\'entraîner', 'Présentation en 3D et exercices guidés pas à pas. Rien n\'est noté : on peut se tromper et recommencer.'],
      ['Passer l\'évaluation', train? 'Dans Moodle seulement : repérage des organes, QCM sécurité et scénarios notés.'
        : 'Repérage des organes, QCM sécurité et scénarios notés. Une faute grave et la machine n\'est pas validée.'] ]) });
  if(train) C.push({ t:'Le permis machine', art:'fan', etat:'entraine',
    html:`<p class="pp-lead">Le permis se passe dans <b>Moodle</b> : un badge par machine dont l'évaluation est validée (${esc(seuil())}).</p>`
      + puces([ 'Ici, c\'est l\'<b>entraînement</b> : réussissez les exercices guidés d\'une machine, sans faute grave, pour gagner son badge <b>« Entraîné »</b> (argent).',
        'Badges gardés dans ce navigateur seulement.',
        `Commencez par <b>« 0. ${esc(nomMod('risques'))} »</b>, puis suivez le chemin peint au sol : <span class="pp-ch" style="--c:${NIVEAUX[0].col}">jaune</span> pour le niveau 1, <span class="pp-ch" style="--c:${NIVEAUX[1].col};color:#fff">orange</span> pour le niveau 2.` ]) + regle() });
  else C.push({ t:'Le permis machine', art:'fan', etat:'obtenu',
    html:`<p class="pp-lead">Un <b>badge</b> par machine : il se pose sur son poste quand l'évaluation est validée, ${esc(seuil())}.</p>`
      + puces([ `Commencez par <b>« 0. ${esc(nomMod('risques'))} »</b> : il ouvre les machines.`,
        `Suivez ensuite le chemin peint au sol : <span class="pp-ch" style="--c:${NIVEAUX[0].col}">jaune</span> = ${esc(NIVEAUX[0].nom.toLowerCase())} (${esc(NIVEAUX[0].sous.toLowerCase())}), <span class="pp-ch" style="--c:${NIVEAUX[1].col};color:#fff">orange</span> = ${esc(NIVEAUX[1].nom.toLowerCase())} (${esc(NIVEAUX[1].sous.toLowerCase())}). Une machine grisée avec un cadenas attend la précédente.`,
        'Machine non validée ? « Repasser ce qui est raté » : on ne refait que les parties ratées, sans limite.',
        '« Mon permis » (en haut) : vos badges et la prochaine machine conseillée.' ]) + regle() });
  C.push({ t:'Pour bien lire',
    html: gestes([['aa','« Aa » : police lisible, texte plus grand, lecture à voix haute (🔈 Lire)']])
      + puces([ 'Le son est coupé au départ : bouton 🔇 / 🔊 dans chaque machine.', '« ? » en haut de la page rouvre ces premiers pas.' ]) });
  return C; }

/* ---------- cartes d'un module (machine ou risques généraux) ----------
   o : { config, fiches, rep (nombre de questions du repérage), qcm, scen (scénarios du parcours [{mode,t}]), vestiaire (nombre) } */
export function cartesMachine(o, ver=version()){
  const c=o.config, id=c.id, M=modDe(id), risques=id==='risques', niv=niveauDe(id);
  const train = ver==='local' || ver==='web';
  const quoi = risques ? 'Avant toute machine : les dangers de l\'atelier, les équipements de protection (EPI), la consignation d\'une machine, le départ de feu et l\'évacuation.'
    : (o.fiches?.[0]?.blocks||[]).find(b=>b.p)?.p || '';
  const mot = risques? 'équipements' : 'organes';
  const ex = (o.scen||[]).map(s=>(c.modes.find(m=>m.id===s.mode)?.title)||s.t).filter(Boolean);
  const C=[];
  C.push({ t: M? `${M.nom}${M.ref&&!risques?` · ${M.ref}`:''}` : c.title, art:'badge', id,
    html:`${quoi?`<p class="pp-lead">${esc(quoi)}</p>`:''}`
      + (risques? '' : `<p class="pp-mute">Machine fictive « KANAK », construite d'après les machines de l'atelier.</p>`)
      + (niv? `<p class="pp-niv" style="--c:${niv.col}">${esc(niv.nom)} · ${esc(niv.sous)}</p>` : '') });
  if(ver==='scorm') C.push({ t:'Comment ça marche',
    html:`<p class="pp-lead">Ici, c'est l'évaluation : suivez les cartes de la colonne de droite, dans l'ordre.</p>`
      + etapes([ ...(o.fiches?.length? [['Les fiches', `${o.fiches.length} fiches à lire avant de commencer.`]] : []),
        ...(o.vestiaire? [['Le vestiaire', `${o.vestiaire} équipements à voir sur l'élève.`]] : []),
        ['Le repérage', `Touchez dans la 3D les ${o.rep} ${mot} demandés, puis « Valider ».`],
        ['Le QCM sécurité', `${o.qcm} questions tirées au hasard : choisissez, puis « Valider ma réponse ».`],
        ['Les scénarios', `${(o.scen||[]).length} situations notées${ex.length?` : ${ex.map(t=>esc(t.toLowerCase())).join(' ; ')}`:''}.`] ])
      + gestes([['tourner','Glisser : tourner'], ['zoom','Molette ou pincement : zoomer'], ['toucher', risques? 'Toucher la 3D : choisir' : 'Toucher un organe : le choisir']]) });
  else C.push({ t:'Comment ça marche',
    html: etapes([
      ['Présentation', risques? 'La salle en 3D, les fiches des risques et le vestiaire. Touchez un équipement : il est montré et nommé.'
        : 'À gauche, les fiches et la nomenclature ; au centre, la machine en 3D (boutons de vue en haut) ; à droite, les réglages. Touchez un organe : son réglage s\'ouvre.'],
      ['Exercice', `${ex.length} exercices guidés, étape par étape${ex.length?` : ${ex.map(t=>esc(t.toLowerCase())).join(' ; ')}`:''}.`
        + (risques? '' : ' Les commandes de marche sont sur le pupitre, en bas de la vue 3D : les réglages se font machine arrêtée.')],
      ...(ver==='moodle'? [['Évaluation', 'Bouton en haut à gauche pour passer de l\'entraînement à l\'évaluation.']] : []) ])
      + gestes([['tourner','Glisser : tourner'], ['zoom','Molette ou pincement : zoomer'], ['aa','« Aa » : confort de lecture']]) });
  const pre = PREREQ[id], lock = ver==='moodle' && !!window.ATELIER_PKG?.prereq?.[id];
  const lectures = [ ...(o.fiches?.length? [`les ${o.fiches.length} fiches`] : []), ...(o.vestiaire? ['le vestiaire'] : []) ].join(' et ');
  if(train) C.push({ t:`Le badge ${M?.court||c.title}`, art:'permis', id, etat:'entraine',
    html:`<p class="pp-lead">Ici, c'est l'entraînement : rien n'est noté.</p>`
      + etapes([ ...(lectures? [['Lire', `${lectures.charAt(0).toUpperCase()+lectures.slice(1)} (onglet « ${risques?'Fiches risques':'Fiches'} »).`]] : []),
        ['Réussir les exercices', `Les ${ex.length} exercices guidés, jusqu'au contrôle final tout coché, sans faute grave.`],
        ['Badge « Entraîné »', 'Badge argent, gardé dans ce navigateur. Il se voit sur le poste dans l\'atelier.'] ])
      + `<p class="pp-mute">Le vrai badge du <b>permis machine</b> s'obtient dans Moodle : ${esc(SEUIL)}.</p>` + regle() });
  else C.push({ t:`Obtenir le badge ${M?.court||c.title}`, art:'permis', id, etat:'obtenu',
    html: etapes([ ...(lectures? [['Lire', `${lectures.charAt(0).toUpperCase()+lectures.slice(1)} : obligatoire avant l'évaluation.`]] : []),
        ...(ver==='moodle'? [['S\'entraîner', 'Autant que vous voulez : les exercices guidés ne sont pas notés.']] : []),
        ['Valider l\'évaluation', `70 / 100 au moins et <b>aucune faute grave</b> : ${o.rep} ${mot} à repérer, ${o.qcm} questions, ${(o.scen||[]).length} scénarios.`],
        ['Badge obtenu', `Il se pose sur le poste dans l'atelier${niv?` et compte pour le ${esc(niv.nom.toLowerCase())}`:''}.`] ])
      + puces([ ...(pre? [ lock? `L'évaluation s'ouvre quand <b>« ${esc(nomMod(pre))} »</b> est validée.` : `Ordre conseillé : après <b>« ${esc(nomMod(pre))} »</b>.` ] : []),
        'Pas validée ? « Repasser ce qui est raté » : seules les parties ratées sont à refaire, sans limite.' ]) + regle() });
  return C; }

/* ---------- illustration de chaque carte ---------- */
function art(s){
  if(s.id && (s.art==='badge' || s.art==='permis')) return `<div class="pp-art pp-art-b">${badgeSVG(s.id, s.etat||'obtenu')}</div>`;
  if(s.art==='fan')   // trois badges en éventail (premier module, une machine de chaque niveau)
    return `<div class="pp-art pp-art-fan">${['scie-radiale','risques','toupie'].map(i=>`<i>${badgeSVG(i, s.etat||'obtenu', { mini:true })}</i>`).join('')}</div>`;
  return ''; }

/* ---------- styles (injectés : communs à l'atelier et aux machines) ---------- */
const CSS = `
.pp-pill{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:5px 12px 5px 5px;font:inherit;font-size:13px;font-weight:600;color:inherit;cursor:pointer;box-shadow:0 2px 10px rgb(0 0 0 / .08)}
.pp-pill b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;font-size:13px}
.pp-pill:hover{border-color:var(--accent)}
.pp-pill:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.pp-btn{min-width:32px;font-weight:700!important;letter-spacing:0!important;font-size:14px!important;border-radius:50%!important;padding:6px 0!important;width:32px;height:32px;line-height:1!important}
.pp-fond{position:fixed;left:0;right:0;bottom:0;top:var(--pp-top,0px);z-index:55;display:grid;grid-template-columns:minmax(0,600px);justify-content:center;align-items:center;padding:14px;background:rgb(15 20 25 / .42)}
.pp-box{position:relative;background:var(--panel,#fff);color:var(--fg,#1b2228);border-radius:12px;border-top:5px solid var(--accent,#c76a14);box-shadow:0 18px 50px rgb(0 0 0 / .32);
  width:100%;min-width:0;max-width:600px;max-height:100%;overflow:auto;box-sizing:border-box;padding:18px 22px 14px;display:flex;flex-direction:column;gap:10px}
.pp-k{margin:0;font:600 11px/1 var(--f-body,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:var(--accent,#c76a14)}
.pp-slide{display:grid;grid-template-columns:1fr;gap:12px}
.pp-slide[hidden]{display:none}
.pp-slide.has-art{grid-template-columns:118px 1fr;align-items:start}
.pp-t{margin:0 0 6px;text-transform:none;color:inherit;font:700 26px/1.08 var(--f-display,'Barlow Condensed',sans-serif);letter-spacing:.01em}
.pp-body{min-width:0}
.pp-body p{margin:0 0 8px;line-height:1.45;font-size:15px}
.pp-lead{font-size:16px!important}
.pp-mute{color:var(--muted,#5d6872);font-size:13.5px!important}
.pp-art svg{width:100%;height:auto;display:block}
.pp-art-b{width:118px}
.pp-art-fan{position:relative;height:110px;width:118px}
.pp-art-fan i{position:absolute;width:62px;top:22px}
.pp-art-fan i:nth-child(1){left:0;transform:rotate(-12deg)}.pp-art-fan i:nth-child(2){left:28px;top:4px;width:66px;z-index:1}.pp-art-fan i:nth-child(3){left:56px;transform:rotate(12deg)}
.pp-steps{list-style:none;counter-reset:pp;margin:2px 0 8px;padding:0;display:flex;flex-direction:column;gap:8px}
.pp-steps li{counter-increment:pp;display:grid;grid-template-columns:28px 1fr;column-gap:10px;align-items:start}
.pp-steps li::before{content:counter(pp);grid-row:1/3;width:26px;height:26px;border-radius:50%;background:var(--accent,#c76a14);color:#fff;display:grid;place-items:center;font:700 14px/1 var(--f-body,sans-serif)}
.pp-steps b{font:600 16px/1.2 var(--f-display,'Barlow Condensed',sans-serif);letter-spacing:.01em;padding-top:4px}
.pp-steps span{font-size:14px;line-height:1.4;color:var(--muted,#5d6872)}
.pp-ul{margin:0 0 8px;padding-left:18px;display:flex;flex-direction:column;gap:5px;font-size:14px;line-height:1.4}
.pp-gs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;margin:4px 0 8px}
.pp-g{display:flex;align-items:center;gap:8px;border:1px solid var(--line,#cdd3d8);border-radius:8px;padding:7px 9px;font-size:13px;line-height:1.25}
.pp-g svg{width:22px;height:22px;flex:none;fill:none;stroke:var(--accent,#c76a14);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.pp-ch{display:inline-block;padding:0 6px;border-radius:3px;background:var(--c);color:#1b2228;font-weight:700}
.pp-niv{display:inline-block;border-left:4px solid var(--c);padding:3px 8px;background:var(--bg,#e8ebed);border-radius:0 4px 4px 0;font-weight:600;font-size:13.5px!important}
.pp-regle{border:1px solid var(--accent,#c76a14);background:var(--accent-soft,#f3e2d0);border-radius:6px;padding:7px 10px;font-size:13.5px!important}
.pp-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;border-top:1px solid var(--line,#cdd3d8);padding-top:10px;margin-top:2px}
.pp-dots{display:flex;gap:6px;margin-right:auto}
.pp-dots button{width:10px;height:10px;padding:0;border-radius:50%;border:0;background:var(--line,#cdd3d8);cursor:pointer}
.pp-dots button[aria-current="true"]{background:var(--accent,#c76a14);width:22px;border-radius:5px}
.pp-go{background:var(--accent,#c76a14)!important;border-color:var(--accent,#c76a14)!important;color:#fff!important}
.pp-x{position:absolute;top:8px;right:10px;border:0;background:transparent;color:var(--muted,#5d6872);font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:4px}
.pp-fond[data-motion="plein"] .pp-box{animation:pp-in .28s ease-out both}
@keyframes pp-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:600px){
  .pp-fond{padding:8px;align-items:end}
  .pp-box{padding:14px 14px 10px;border-radius:12px 12px 8px 8px}
  .pp-slide.has-art{grid-template-columns:64px 1fr;gap:10px}
  .pp-art-b{width:64px}.pp-art-fan{width:64px;height:64px}.pp-art-fan i{width:34px;top:12px}.pp-art-fan i:nth-child(2){left:15px;top:2px;width:36px}.pp-art-fan i:nth-child(3){left:30px}
  .pp-t{font-size:22px}
  .pp-gs{grid-template-columns:1fr 1fr}
  .pp-foot .toggle{padding:9px 10px}
}
@media (prefers-reduced-motion:reduce){.pp-fond *{animation:none!important}}
`;
function ensureStyle(){ if(document.getElementById('premiersCss')) return; const s=document.createElement('style'); s.id='premiersCss'; s.textContent=CSS; document.head.appendChild(s); }

/* Premiers pas d'une page.
   cle : clé de la page (« atelier », id du module) ; cartes : [{ t, html, art, id, etat }] ;
   slot : sélecteur de la barre d'outils de l'en-tête (bouton « ? ») ; entete : sélecteur de l'en-tête (laissé visible) ;
   onClose : appelé à la fermeture. */
export function createPremiers({ cle, cartes, slot, entete, onClose, titre='Premiers pas', pastille=false }){
  ensureStyle();
  const P={ cle, cartes, i:0, get ouvert(){ return !fond.hidden; } };
  const bar=document.querySelector(slot);
  const btn=document.createElement('button'); btn.type='button'; btn.id='ppBtn';
  if(pastille){ btn.className='pp-pill'; btn.innerHTML='<b>?</b> Premiers pas'; } else { btn.className='toggle pp-btn'; btn.textContent='?'; }
  btn.title='Premiers pas : comment marche cette page et comment obtenir le permis machine'; btn.setAttribute('aria-label','Premiers pas');
  btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-controls','ppFond');
  if(bar){ if(pastille) bar.append(btn); else bar.prepend(btn); }
  const fond=document.createElement('div'); fond.className='pp-fond'; fond.id='ppFond'; fond.hidden=true;
  fond.innerHTML=`<div class="pp-box" role="dialog" aria-modal="true" aria-labelledby="ppK">
    <button type="button" class="pp-x" data-pp="x" aria-label="Fermer les premiers pas" title="Fermer (Échap)">×</button>
    <p class="pp-k" id="ppK">${esc(titre)} · <span id="ppN"></span></p>
    ${cartes.map((s,i)=>{ const a=art(s); return `<section class="pp-slide${a?' has-art':''}" data-i="${i}" hidden>${a}<div class="pp-body"><h2 class="pp-t">${esc(s.t)}</h2>${s.html}</div></section>`; }).join('')}
    <div class="pp-foot"><div class="pp-dots" role="group" aria-label="Cartes">${cartes.map((s,i)=>`<button type="button" data-go="${i}" aria-label="Carte ${i+1} : ${esc(s.t)}"></button>`).join('')}</div>
      <button type="button" class="toggle" data-pp="prev">Précédent</button><button type="button" class="toggle" data-pp="skip">Passer</button><button type="button" class="toggle pp-go" data-pp="next">Suivant</button></div></div>`;
  document.body.appendChild(fond);
  const q=s=>fond.querySelector(s);
  function show(i){ P.i=Math.max(0,Math.min(cartes.length-1,i));
    fond.querySelectorAll('.pp-slide').forEach(e=>e.hidden= +e.dataset.i!==P.i);
    fond.querySelectorAll('.pp-dots button').forEach(b=>b.setAttribute('aria-current',String(+b.dataset.go===P.i)));
    q('#ppN').textContent=`${P.i+1} / ${cartes.length}`;
    const last=P.i===cartes.length-1;
    q('[data-pp=prev]').hidden=P.i===0; q('[data-pp=skip]').hidden=last;
    q('[data-pp=next]').textContent= last? 'C\'est parti' : 'Suivant'; }
  function place(){ const h=document.querySelector(entete); const r=h?.getBoundingClientRect(); fond.style.setProperty('--pp-top', (r&&r.bottom>0? Math.round(r.bottom) : 0)+'px'); }
  P.open=(i=0)=>{ place(); show(i); fond.dataset.motion= matchMedia?.('(prefers-reduced-motion: reduce)').matches? 'reduit':'plein';
    fond.hidden=false; btn.setAttribute('aria-expanded','true'); btn.setAttribute('aria-pressed','true'); q('[data-pp=next]').focus({ preventScroll:true }); };
  P.close=()=>{ if(fond.hidden) return; fond.hidden=true; marquerVu(cle); btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-pressed','false'); onClose?.(); };
  btn.onclick=()=> fond.hidden? P.open(0) : P.close();
  fond.addEventListener('click',e=>{ const t=e.target.closest('[data-pp],[data-go]');
    if(e.target===fond) return P.close();
    if(!t) return;
    if(t.dataset.go!=null) return show(+t.dataset.go);
    const a=t.dataset.pp;
    if(a==='prev') show(P.i-1); else if(a==='skip'||a==='x') P.close();
    else if(a==='next'){ if(P.i===cartes.length-1) P.close(); else show(P.i+1); } });
  addEventListener('keydown',e=>{ if(fond.hidden) return;
    if(e.key==='Escape'){ P.close(); btn.focus({ preventScroll:true }); }
    else if(e.key==='ArrowRight' && !e.target.closest?.('input,select,textarea')) show(P.i+1);
    else if(e.key==='ArrowLeft' && !e.target.closest?.('input,select,textarea')) show(P.i-1); });
  addEventListener('resize',()=>{ if(!fond.hidden) place(); });
  /* texte lu par « 🔈 Lire » (engine/lecture.js) : la carte affichée */
  P.consigne=()=> fond.hidden? null : (el=>({ el, t:(el.innerText||'') }))(fond.querySelector(`.pp-slide[data-i="${P.i}"] .pp-body`));
  /* première visite : ouverture seule (pas sous un test automatique, sauf demande) */
  P.auto=()=>{ const robot = typeof navigator!=='undefined' && navigator.webdriver && !window.PREMIERS_TEST;
    if(!robot && !dejaVu(cle)) P.open(0); };
  show(0);
  return P; }

