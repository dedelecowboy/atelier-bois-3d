/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Permis machine (demandé par l'enseignant le 31/10/2026) : un badge par module (« 0. Risques généraux » et les 9 machines),
   montré dans l'atelier 3D (posé sur le poste, panneau « Mon permis machine », fiche de la machine) et fêté dans la machine.
   Aucun effet sur la note ni sur les traces Moodle : ce fichier n'écrit que dans le navigateur (localStorage).

   - Badge du permis (paquetage Moodle) : machine VALIDÉE (statut du sommaire de Moodle d'abord, sinon le bilan du navigateur :
     même règle que les verrous et les attestations, lue par atelier/main.js) ; date et note sur le badge.
   - Badge « Entraîné » (gris argent ; dossier d'entraînement hors ligne et pages web, sans évaluation) : les exercices guidés
     de la machine tous réussis (contrôle final entièrement coché, sans faute grave), gardé dans ce navigateur.
   - Repère « fiches lues » (petit livre coché) sur un badge pas encore obtenu.
   - Permis complet « Permis atelier bois » : affichage seul quand les modules de PERMIS_COMPLET sont tous obtenus.
   Pour lier plus tard le permis au droit d'utiliser les vraies machines : écrire le texte de la règle dans REGLE
   (affiché sur la carte du permis), sans autre changement. */

export const NOM = 'Permis machine';
export const COMPLET = 'Permis atelier bois';
/* modules du permis complet : risques généraux et la chaîne de débit (À VALIDER par l'enseignant) */
export const PERMIS_COMPLET = ['risques', 'scie-radiale', 'deligneuse', 'degauchisseuse', 'raboteuse'];
/* règle d'atelier liée au permis (vide pour l'instant : le permis ne donne aucun droit sur les vraies machines) */
export const REGLE = '';
export const SEUIL = 'validez l\'évaluation (70 / 100, aucune faute grave)';

export const FAMILLES = {
  risques:{ nom:'Sécurité', col:'#c4261c' },
  debit:{ nom:'Débit', col:'#c76a14' },
  corroyage:{ nom:'Corroyage', col:'#2f7d6f' },
  usinage:{ nom:'Usinage', col:'#5a5fb0' },
  panneaux:{ nom:'Panneaux', col:'#8a6a3a' },
};
/* ordre du paquetage (PKG_ORDER) ; noms et KANAK les mêmes que atelier/stations.js (contrôlé par tests/paquet/test_permis.py) */
export const MODULES = [
  { id:'risques', n:0, nom:'Risques généraux', court:'Risques généraux', ref:'Tout l\'atelier', famille:'risques' },
  { id:'scie-radiale', n:1, nom:'Scie radiale', court:'Scie radiale', ref:'KANAK 900 R', famille:'debit' },
  { id:'deligneuse', n:2, nom:'Déligneuse multilames', court:'Déligneuse', ref:'KANAK 300 M', famille:'debit' },
  { id:'degauchisseuse', n:3, nom:'Dégauchisseuse', court:'Dégauchisseuse', ref:'KANAK 520 D', famille:'corroyage' },
  { id:'raboteuse', n:4, nom:'Raboteuse', court:'Raboteuse', ref:'KANAK 630 E', famille:'corroyage' },
  { id:'toupie', n:5, nom:'Toupie', court:'Toupie', ref:'KANAK 130 T', famille:'usinage' },
  { id:'mortaiseuse', n:6, nom:'Mortaiseuse', court:'Mortaiseuse', ref:'KANAK 130 MB', famille:'usinage' },
  { id:'tenonneuse', n:7, nom:'Tenonneuse', court:'Tenonneuse', ref:'KANAK 160 TN', famille:'usinage' },
  { id:'scie-format', n:8, nom:'Scie à format', court:'Scie à format', ref:'KANAK 550', famille:'panneaux' },
  { id:'scie-ruban', n:9, nom:'Scie à ruban', court:'Scie à ruban', ref:'KANAK 800 RB', famille:'debit' },
];
export const module = id=>MODULES.find(m=>m.id===id);
export const couleur = id=>FAMILLES[module(id)?.famille]?.col || '#5a6570';

/* ---------- pictogrammes (repère 40 × 40, traits) ---------- */
const PICTOS = {
  risques:'<path d="M20 4 37 34H3Z"/><path d="M20 14v11"/><circle cx="20" cy="29.5" r="1.3" class="pl"/>',
  'scie-radiale':'<path d="M3 34h34M8 34V6M8 8h22"/><circle cx="27" cy="19" r="9"/><circle cx="27" cy="19" r="1.6" class="pl"/><path d="M14 30h20"/>',
  deligneuse:'<path d="M6 10h28"/><ellipse cx="13" cy="16" rx="2" ry="8"/><ellipse cx="20" cy="16" rx="2" ry="8"/><ellipse cx="27" cy="16" rx="2" ry="8"/><rect x="4" y="25" width="32" height="5" rx="1"/><path d="M3 34h34"/>',
  degauchisseuse:'<rect x="6" y="14" width="27" height="5" rx="1"/><path d="M3 26h14M23 23h14"/><circle cx="20" cy="25" r="3.6"/><path d="M5 30v5M35 27v8"/>',
  raboteuse:'<path d="M5 7h30M5 7v24M35 7v24"/><circle cx="20" cy="14" r="4"/><circle cx="10" cy="16" r="2.4"/><circle cx="30" cy="16" r="2.4"/><rect x="7" y="20" width="26" height="5" rx="1"/><path d="M5 28h30M10 31v5M30 31v5"/>',
  toupie:'<path d="M3 29h34M20 29V6"/><path d="M14 12h12l2 4-2 4H14l-2-4z"/><path d="M4 21h7v8M36 21h-7v8"/>',
  mortaiseuse:'<rect x="4" y="21" width="32" height="11" rx="1"/><rect x="15" y="21" width="10" height="5" class="pl"/><path d="M20 4v13M17 15l3 4 3-4"/>',
  tenonneuse:'<path d="M3 12h20v6h13v8H23v6H3"/><path d="M23 12v20" stroke-dasharray="2 2"/><circle cx="33" cy="6" r="3.5"/>',
  'scie-format':'<path d="M3 25h34"/><path d="M11 25a9 9 0 0 1 18 0"/><circle cx="20" cy="25" r="1.6" class="pl"/><rect x="3" y="29" width="34" height="4" rx="1"/><path d="M5 21h8"/>',
  'scie-ruban':'<circle cx="18" cy="9" r="6"/><circle cx="18" cy="31" r="6"/><path d="M12 9v22M24 9v22M7 20h28M33 3v34"/>',
};
const LIVRE = '<path d="M-5 -3.5v7c2-1 3.5-1 5 0 1.5-1 3-1 5 0v-7c-2-1-3.5-1-5 0-1.5-1-3-1-5 0zM0 -2.5v6"/>';

let uid = 0;
const esc = s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
/* Badge d'un module, en SVG autonome (couleurs écrites dedans : il se lit sur fond clair ou sombre).
   etat : 'obtenu' (couleur de la famille), 'entraine' (gris argent), autre = à obtenir (gris, contour seul).
   o.fiches : petit livre coché (fiches lues) sur un badge pas encore obtenu ; o.mini : médaille seule (sans bandeau). */
export function badgeSVG(id, etat, o={}){
  const M = module(id) || { court:id, ref:'' }, col = couleur(id), k = 'pb'+(++uid);
  const ob = etat==='obtenu', en = etat==='entraine';
  const ring = ob? col : en? `url(#${k}g)` : '#9aa2a9';
  const inner = ob? '#ffffff' : en? '#f2f4f6' : 'none';
  const ink = ob? col : en? '#56606a' : '#9aa2a9';
  const H = o.mini? 92 : 120;
  const name = M.court, long = name.length>12;
  const titre = o.title ?? `${M.nom} : ${ob?'badge obtenu':en?'badge Entraîné':'badge à obtenir'}`;
  return `<svg class="pbadge" data-etat="${ob?'obtenu':en?'entraine':'aobtenir'}" viewBox="0 0 100 ${H}" role="img" aria-label="${esc(titre)}" xmlns="http://www.w3.org/2000/svg">`
    + (en? `<defs><linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f4"/><stop offset=".45" stop-color="#a9b1b9"/><stop offset=".7" stop-color="#dde2e6"/><stop offset="1" stop-color="#8c959e"/></linearGradient></defs>` : '')
    + `<circle cx="50" cy="46" r="40" fill="${inner}" stroke="${ring}" stroke-width="${ob||en?7:3}"${ob||en?'':' stroke-dasharray="6 4"'}/>`
    + (ob? `<circle cx="50" cy="46" r="32" fill="none" stroke="${col}" stroke-opacity=".35" stroke-width="1.5"/>` : en? `<circle cx="50" cy="46" r="32" fill="none" stroke="#8c959e" stroke-width="1.2" stroke-dasharray="2 3"/>` : '')
    + `<g transform="translate(29 25) scale(1.05)" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="--pl:${ink}">${(PICTOS[id]||'').replace(/class="pl"/g,`fill="${ink}" stroke="none"`)}</g>`
    + (ob? `<g transform="translate(79 74)"><circle r="11" fill="${col}" stroke="#fff" stroke-width="2.5"/><path d="M-5 0l3.5 3.5L5.5-4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>` : '')
    + (!ob && o.fiches? `<g transform="translate(21 74)"><circle r="11" fill="#fff" stroke="${en?'#8c959e':'#6c757d'}" stroke-width="2"/><g fill="none" stroke="${en?'#56606a':'#5b636b'}" stroke-width="1.6" stroke-linejoin="round">${LIVRE}</g><g transform="translate(6 -6)"><circle r="4.5" fill="#2f8a4a"/><path d="M-2 0l1.4 1.4L2.2-1.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g><title>Fiches lues</title></g>` : '')
    + (o.mini? '' :
      `<rect x="6" y="84" width="88" height="20" rx="3" fill="${ob? col : en? '#7d868f' : 'none'}" stroke="${ob||en?'none':'#9aa2a9'}" stroke-width="1.5"/>`
      + `<text x="50" y="98.5" text-anchor="middle" font-size="12.5" font-weight="700" fill="${ob||en?'#fff':'#7b848c'}" style="font-family:var(--f-display,'Barlow Condensed','Arial Narrow',sans-serif);letter-spacing:.02em"${long?' textLength="80" lengthAdjust="spacingAndGlyphs"':''}>${esc(name)}</text>`
      + `<text x="50" y="116" text-anchor="middle" font-size="9.5" font-weight="600" fill="${ob? col : en? '#5f6870' : '#8b939a'}" style="font-family:var(--f-body,'Barlow',Arial,sans-serif);letter-spacing:.06em">${esc(en? 'ENTRAÎNÉ' : M.ref.toUpperCase())}</text>`)
    + `</svg>`;
}

/* ---------- mémoire du navigateur (rien n'est envoyé à Moodle) ---------- */
const lire = (k,d)=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); return v ?? d; }catch(e){ return d; } };
const ecrire = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const dateFr = ()=>{ const n=new Date(); return n.toLocaleDateString('fr-FR'); };
/* exercices guidés réussis (badge « Entraîné ») : { modes:[…], total, date } */
export const entraine = id=>{ const e=lire('atelier.entraine.'+id, null); return e && Array.isArray(e.modes)? e : { modes:[], total:0, date:'' }; };
export const estEntraine = id=>{ const e=entraine(id); return e.total>0 && e.modes.length>=e.total; };
/* un exercice guidé réussi : rend { nouveau, n, total, complet (badge obtenu à l'instant) } */
export function noteExercice(id, mode, total){ const e=entraine(id); e.total=total;
  if(e.modes.includes(mode)){ ecrire('atelier.entraine.'+id, e); return { nouveau:false, n:e.modes.length, total, complet:false }; }
  const avant=e.modes.length>=total; e.modes.push(mode); if(!avant && e.modes.length>=total) e.date=dateFr();
  ecrire('atelier.entraine.'+id, e); return { nouveau:true, n:Math.min(e.modes.length,total), total, complet:!avant && e.modes.length>=total }; }
/* fiches lues (écrit par engine/fiches.js) : { n, total } */
export const fiches = id=>lire('atelier.fiches.'+id, { n:0, total:0 });
export const fichesLues = id=>{ const f=fiches(id); return f.total>0 && f.n>=f.total; };
export const noteFiches = (id,n,total)=>ecrire('atelier.fiches.'+id, { n, total });
/* badges déjà posés sur leur poste dans l'atelier (animation une seule fois par badge et par type) */
export const poses = ()=>lire('atelier.permis.poses', []);
export function poser(cle){ const p=poses(); if(p.includes(cle)) return false; p.push(cle); ecrire('atelier.permis.poses', p); return true; }

/* prochaine machine conseillée : la première, dans l'ordre du paquetage (chaîne de débit d'abord), pas encore obtenue
   et pas verrouillée */
export function conseil(obtenu, verrou=()=>false){ return MODULES.find(m=>!obtenu(m.id) && !verrou(m.id)) || null; }
export const complet = obtenu=>PERMIS_COMPLET.every(id=>obtenu(id));

/* ---------- styles communs (atelier et machines) ---------- */
const CSS = `
.pf-fete{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgb(15 20 25 / .38);padding:16px}
.pf-box{background:var(--panel,#fff);color:var(--fg,#1d2329);border-radius:10px;border-top:5px solid var(--pfc,#2f7d6f);box-shadow:0 18px 50px rgb(0 0 0 / .32);
  padding:22px 26px 18px;max-width:340px;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.pf-b{width:150px;position:relative}.pf-b svg{width:100%;height:auto;display:block}
.pf-t{margin:4px 0 0;font:700 24px/1.1 var(--f-display,'Barlow Condensed',sans-serif);letter-spacing:.01em}
.pf-s{margin:0;color:var(--muted,#5d6670);font-size:14px;line-height:1.4}
.pf-box .toggle{margin-top:6px;min-width:140px}
.pf-fete[data-motion="plein"] .pf-box{animation:pf-in .35s ease-out both}
.pf-fete[data-motion="plein"] .pf-b{animation:pf-pop .9s cubic-bezier(.2,.9,.3,1.3) .1s both}
.pf-fete[data-motion="plein"] .pf-b::after{content:"";position:absolute;left:50%;top:38%;width:100%;aspect-ratio:1;border-radius:50%;border:3px solid var(--pfc);
  transform:translate(-50%,-50%) scale(.6);opacity:0;animation:pf-ring 1.1s ease-out .55s both;pointer-events:none}
@keyframes pf-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes pf-pop{0%{opacity:0;transform:scale(.35) rotate(-12deg)}60%{opacity:1;transform:scale(1.07) rotate(2deg)}100%{transform:scale(1) rotate(0)}}
@keyframes pf-ring{0%{opacity:.7;transform:translate(-50%,-50%) scale(.7)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.35)}}
@media (prefers-reduced-motion:reduce){.pf-fete *{animation:none!important}}
`;
export function ensureStyle(){ if(document.getElementById('permisCss')) return; const s=document.createElement('style'); s.id='permisCss'; s.textContent=CSS; document.head.appendChild(s); }
export const reduit = ()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };

/* Moment de réussite dans la machine : badge qui apparaît au centre (« Badge Scie radiale obtenu ! »), sobre ;
   se ferme par « Continuer », Échap ou au bout de 7 s. etat : 'obtenu' | 'entraine'. */
export function celebrer(id, { etat='obtenu', titre, sous, duree=7000 }={}){
  ensureStyle(); document.querySelector('.pf-fete')?.remove();
  const M=module(id); if(!M) return null;
  const el=document.createElement('div'); el.className='pf-fete'; el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
  el.dataset.motion= reduit()? 'reduit' : 'plein'; el.dataset.id=id; el.dataset.etat=etat;
  el.style.setProperty('--pfc', etat==='obtenu'? couleur(id) : '#8c959e');
  el.innerHTML=`<div class="pf-box"><div class="pf-b">${badgeSVG(id, etat)}</div>`
    + `<p class="pf-t">${esc(titre || (etat==='obtenu'? `Badge ${M.nom} obtenu !` : 'Badge « Entraîné » obtenu !'))}</p>`
    + `<p class="pf-s">${esc(sous || '')}</p><button type="button" class="toggle" data-pf="ok">Continuer</button></div>`;
  const close=()=>{ el.remove(); removeEventListener('keydown',key); clearTimeout(t); };
  const key=e=>{ if(e.key==='Escape') close(); };
  el.addEventListener('click',e=>{ if(e.target===el || e.target.dataset.pf==='ok') close(); });
  addEventListener('keydown',key); const t=setTimeout(close, duree);
  document.body.appendChild(el); el.querySelector('[data-pf]')?.focus({ preventScroll:true });
  return el; }
