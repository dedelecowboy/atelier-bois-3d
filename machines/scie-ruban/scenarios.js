/* Scénarios guidés de la scie à ruban (notés au parcours : 5 critères de 4 points dont « aucune faute grave »).
   1. Changer la lame et régler la machine : lame à chantourner de 10 mm montée → lame de 30 mm pour la refente
      (consignation, lame sans crique, dents vers le bas, tension, dévers, guide-lames, essai à vide).
   2. Chantourner une pièce suivant un tracé : panneau de hêtre de 22 mm, tracé en S dont le plus petit rayon fait 60 mm ;
      la lame de 20 mm montée ne le suit pas : il faut la changer (10 mm ou moins).
   3. Refendre un avivé au guide parallèle : chêne 900 × 120 × 45 sur chant → lame de 20 mm ; puis un rondin
      à écarter (ou à scier dans le gabarit). */
import { st, lame, rimOk, tensionOk, voie } from './state.js';
import { BLADES, bladeById, rmin, toothH } from './lame.js';
import { cut, cur, onTable, pieces, newPiece, clearPieces, stockPiece, traceDist, measure, produced, feedMode, fmt } from './piece.js';
import { guidesOk, broken, protOk } from './rules.js';
import { PROT_GAP } from './constants.js';

/* ---------- pièces ---------- */
export const TRACE_S={ start:[0,60], head:0, segs:[{len:80},{R:150,a:50},{R:60,a:-50},{len:185}], waste:1, keep:[200,20], rmin:60 };
const TRACE_L={ start:[0,120], head:0, segs:[{len:60},{R:100,a:90},{len:110}], waste:1, keep:[300,60], rmin:100 };
const SPECS={
  libre:()=>[{ name:'Panneau tracé', wood:'hetre', L:400, W:300, T:27, trace:TRACE_L }],
  lame:()=>[],
  chant:()=>[{ name:'Console (tracé en S)', wood:'hetre', L:420, W:260, T:22, trace:TRACE_S }],
  refente:()=>[{ name:'Avivé de chêne', wood:'chene', L:900, W:120, T:45 }],
};
/* réglages de départ : lame montée bien réglée pour elle, puis pièges propres à chaque mode */
const set=(id,dev)=>{ const b=bladeById(id), h=toothH(b); return { blade:id, inv:false, ten:b.w, dev, posDev:dev, posOk:true, gL:0.2, gF:h+2, gB:b.w+1, gLi:0.2, gFi:h+2, gBi:b.w+1 }; };
const BASE={ main:true, cad:false, motor:false, au:false, asp:false, doors:false, gants:false, tilt:0, mitOn:false, mit:0, serv:false, pouss:false, mains:'cote', feed:false, speed:2, steer:0 };
const SETUP={
  libre:  { ...set('r10',0), hg:60, fence:false, fx:50 },
  lame:   { ...set('r10',0), hg:60, fence:false, fx:50 },
  chant:  { ...set('r20',6), hg:150, fence:true, fx:80, mains:'axe' },
  refente:{ ...set('r30',5), hg:150, fence:true, fx:25, tilt:5 },
};
export const LOADERS=Object.fromEntries(Object.keys(SPECS).map(k=>[k,()=>{ clearPieces(); broken.on=false; ev.demonte=ev.essai=false; Object.assign(st,BASE,SETUP[k]);
  for(const s of SPECS[k]()) newPiece(s);
  if(k==='refente') stockPiece({ name:'Rondin', wood:'hetre', L:320, W:90, T:90, round:true }); }]));

/* ---------- mesures ---------- */
const root=()=>pieces.find(q=>q.origin)?.origin||null;
/* chantournage : écart du trait au tracé (bord du trait côté pièce, mm), couverture du tracé, lame et protecteur aux coupes */
export function chantStats(){ const O=pieces.find(q=>q.origin?.trace)?.origin; if(!O) return null; const T=O.trace;
  const recs=O.paths.filter(r=>r.mode==='free'), V=r=>(bladeById(r.blade)? Math.round(bladeById(r.blade).e*1.8*10)/10 : 1.4);
  const fol=[]; for(const r of recs) for(const [u,v] of r.pts){ const d=traceDist(T,u,v); if(Math.abs(d.d)<=6) fol.push({g:d.d-V(r)/2, k:d.k, r}); }
  const inside=T.pts.map(([u,v],i)=>[u,v,i]).filter(([u,v])=>u>=1&&u<=O.L-1&&v>=1&&v<=O.W-1);
  let cov=0; if(inside.length){ const ks=new Set(fol.map(f=>Math.round(f.k/4))); cov=inside.filter(([,,i])=>ks.has(Math.round(i/4))||ks.has(Math.round(i/4)-1)||ks.has(Math.round(i/4)+1)).length/inside.length; }
  const used=[...new Set(fol.map(f=>f.r.blade))].map(bladeById).filter(Boolean);
  return { n:fol.length, mean: fol.length? fol.reduce((a,f)=>a+f.g,0)/fol.length : null, min: fol.length? Math.min(...fol.map(f=>f.g)) : null, cov,
    blades:used, hgMax: recs.length? Math.max(...recs.map(r=>r.hgOver)) : null, hgMin: recs.length? Math.min(...recs.map(r=>r.hgOver)) : null,
    split: produced().some(q=>q.origin===O) }; }
/* refente : morceau entre la lame et le guide (épaisseur le long du trait), réglages au moment de la passe */
export function refStats(){ const s=pieces.find(q=>q.slice&&!q.round); const rec=s?.cutRec||null;
  const rond=pieces.find(q=>q.round); const rondOk= !!rond && (rond.kind==='gabarit' || pieces.some(q=>q.round&&q.gen>0&&q.cutRec?.mode==='gab'));
  return { s, rec, rondOk, rondTouched: !!rond && rond.state==='table' }; }

/* ---------- étapes ---------- */
const all=s=>s.checks.every(c=>c[1]());
const fin=(extra='')=>({ k:'Fin', t:'Arrêter et ranger',
  c:extra+'Arrêtez la lame (O) et attendez l\'arrêt complet. Évacuez les chutes, mettez les pièces de côté. En fin de journée, on détend la lame et on le signale.',
  checks:[['Lame arrêtée, arrêt complet',()=>!st.motor&&(window.__rubanSpin?.()??0)<0.02],['Table dégagée',()=>!onTable().length]], done:all });
const ctrl=(c,results)=>({ k:'Contrôle', t:'Contrôler le travail', c, checks:[], results, done:()=>false });
const blade30=()=>st.blade==='r30'&&!st.inv;
const consigne=['Machine consignée (sectionneur sur 0, cadenas)',()=>st.cad];
const machineOk=()=>!st.cad&&st.main&&!st.doors;
/* changement de lame : étapes communes au scénario 1 et au scénario 2 */
function changeSteps(target, what){ return [
  { k:'Consigner', t:'Arrêter et consigner la machine', c:'Lame arrêtée (attendez l\'arrêt complet). Sectionneur sur 0, puis votre cadenas : personne ne peut redémarrer pendant que vous intervenez. Mettez les gants de manutention pour manipuler la lame.',
    checks:[consigne,['Gants mis',()=>st.gants]], done:all },
  { k:'Démonter', t:'Démonter la lame en place', c:'Ouvrez les portes des volants (machine consignée). Détendez la lame (volant de tension jusqu\'à 0), sortez-la des guide-lames et des volants : « Démonter la lame ».',
    checks:[['Portes ouvertes',()=>st.doors],['Lame détendue et démontée',()=>ev.demonte]], done:all },
  { k:'Monter', t:'Choisir et monter la lame', c:what+' Examinez la lame avant de la monter (criques à la soudure et en fond de dent). Dents vers le bas, côté opérateur : « Monter la lame ».',
    checks:[['Lame adaptée montée',()=>st.blade===target],['Lame sans crique',()=>!lame()?.crack],['Dents vers le bas',()=>!!lame()&&!st.inv]], done:all },
  { k:'Tendre', t:'Tendre la lame', c:'Portes ouvertes, tendez la lame avec le volant de tension : l\'indicateur se règle sur la largeur de la lame montée (mesurée du fond de la dent au dos).',
    checks:[['Indicateur de tension sur la largeur de la lame (± 2)',tensionOk]], done:all },
  { k:'Dévers', t:'Placer la lame sur les volants', c:'Tournez le volant à la main (« Tourner le volant à la main ») et réglez le dévers : lame large (20 mm et plus), dents en dehors du bandage ; lame à chantourner, au milieu du bandage. Regardez le schéma du réglage et la fenêtre de contrôle.',
    checks:[['Position de la lame vérifiée en tournant le volant',()=>st.posOk],['Lame bien placée sur le bandage',rimOk]], done:all },
  { k:'Guides', t:'Régler les guide-lames', c:'Guide-lame supérieur et inférieur : galets latéraux à quelques dixièmes de la lame (0,1 à 0,3 mm), en arrière du fond de denture (1 à 4 mm) ; galet arrière juste derrière le dos de la lame (0,5 à 2 mm). Les cotes sont comptées depuis la pointe des dents.',
    checks:[['Guide-lame supérieur réglé',()=>guidesOk(true)],['Guide-lame inférieur réglé',()=>guidesOk(false)]], done:all },
  { k:'Essai', t:'Fermer, déconsigner, essai à vide', c:'Fermez les portes, retirez votre cadenas, sectionneur sur I. Démarrez la lame à vide (I), écoutez : pas de bruit strident, pas de battement. Puis arrêtez (O).',
    checks:[['Portes fermées, machine déconsignée',machineOk],['Essai à vide fait',()=>ev.essai]], done:all },
]; }
export const ev={ demonte:false, essai:false };   // événements du mode en cours (remis à zéro au chargement)
export const STEPS={
  lame:[
    ...changeSteps('r30','Prochain travail : refente de pièces de chêne de 120 mm de haut. Choisissez une lame large pour les sciages droits, au pas adapté (au moins 3 dents dans l\'épaisseur), d\'épaisseur 0,8 mm au plus pour des volants de 800 mm.'),
    ctrl('Lame large de 30 mm sans crique, dents vers le bas ; tension sur 30 ; dents en dehors du bandage ; guide-lames supérieur et inférieur réglés.',resLame) ],
  chant:[
    { k:'Préparation', t:'Lire le tracé, choisir la lame', c:'Console en hêtre de 22 mm : le tracé en S a un rayon de 60 mm au plus serré. La lame de 20 mm montée ne suit pas un rayon de moins de 140 mm : changez-la (lame arrêtée, consignation, gants, portes ouvertes, lame détendue et démontée) pour une lame étroite qui suit 60 mm, au pas adapté à 22 mm (au moins 3 dents en prise). Mettez l\'aspiration en marche.',
      checks:[['Aspiration en marche',()=>st.asp],['Lame qui suit un rayon de 60 mm, pas adapté',()=>!!lame()&&rmin(lame())<=60&&22/lame().p>=3]], done:all },
    { k:'Réglages', t:'Régler la lame neuve et le protecteur', c:'Après le changement (consigner, démonter, monter, tendre, dévers au milieu du bandage, guide-lames), fermez et déconsignez. Guide parallèle retiré. Descendez le guide-lame supérieur et le protecteur 3 à 10 mm au-dessus de la pièce. Mains derrière la pointe des dents, de part et d\'autre de la lame.',
      checks:[['Lame tendue et bien placée sur le bandage',()=>tensionOk()&&rimOk()],['Guide-lames réglés',()=>guidesOk(true)&&guidesOk(false)],['Machine déconsignée, portes fermées',machineOk],[`Protecteur à ${PROT_GAP[0]} à ${PROT_GAP[1]} mm au-dessus de la pièce`,()=>protOk(cur())],['Mains de part et d\'autre de la lame',()=>st.mains==='cote']], done:all },
    { k:'Présenter', t:'Présenter la pièce au départ du tracé', c:'« Au départ du tracé » amène le trait devant la lame. La lame doit passer côté chute (hachurée), le bord du trait de scie juste contre le trait de crayon : décalez la pièce de 1 mm vers la pièce (« → 1 mm » ou « ← 1 mm ») jusqu\'à « trait côté chute » sur le schéma.',
      checks:[['Pièce au départ du tracé, lame côté chute',()=>{ const p=cur(); if(!p||!p.origin.trace||feedMode(p)!=='free') return false; return startGap(p)!==null&&startGap(p)>=-0.2&&startGap(p)<=1.2; }]], done:all },
    { k:'Chantourner', t:'Chantourner suivant le trait', c:'Démarrez la lame. « Avance » pousse la pièce ; ↺ et ↻ la font tourner pour suivre le trait (avance lente dans les courbes). Si vous sortez du trait : arrêtez l\'avance, arrêtez la lame et attendez l\'arrêt complet avant de reculer. Ne forcez jamais la lame dans une courbe.',
      checks:[['Tracé scié en entier, pièce détachée',()=>{ const s=chantStats(); return !!s&&s.split&&s.cov>=0.95; }]], done:all },
    fin(),
    ctrl('Lame qui suit le rayon de 60 mm ; protecteur au plus près à chaque coupe ; coupe côté chute, jamais dans la pièce ; écart moyen au trait de 1 mm au plus.',resChant) ],
  refente:[
    { k:'Préparation', t:'Préparer la machine', c:'Refente d\'un avivé de chêne 900 × 120 × 45 en une lame de 20 mm d\'épaisseur. Lame large de 30 mm déjà réglée. Lame arrêtée : remettez la table à 0° (elle est restée inclinée), réglez le guide parallèle à 20 mm, installez la servante en sortie de table, mettez l\'aspiration en marche.',
      checks:[['Table à 0°',()=>st.tilt===0],['Guide parallèle à 20 mm',()=>st.fence&&Math.abs(st.fx-20)<0.01],['Servante en sortie',()=>st.serv],['Aspiration en marche',()=>st.asp]], done:all },
    { k:'Présenter', t:'Avivé sur chant contre le guide', c:'Posez l\'avivé sur chant (45 mm d\'appui pour 120 mm de haut : stable), contre le guide parallèle. Descendez le guide-lame et le protecteur 3 à 10 mm au-dessus de la pièce.',
      checks:[['Avivé sur chant contre le guide',()=>{ const p=cur(); return !!p&&p.chant&&feedMode(p)==='fence'; }],[`Protecteur à ${PROT_GAP[0]} à ${PROT_GAP[1]} mm au-dessus de la pièce`,()=>protOk(cur())]], done:all },
    { k:'Refendre', t:'Refendre au guide', c:'Démarrez la lame, attendez sa vitesse. « Avance » : la pièce glisse contre le guide. Avant que la main n\'arrive à 120 mm de la lame, prenez le poussoir (« Poussoir ») pour finir la passe. Ne tirez jamais la pièce vers vous.',
      checks:[['Lame de 20 mm sciée',()=>!!refStats().s]], done:all },
    { k:'Rondin', t:'Pièce suivante : un rondin', c:'Mettez les pièces de côté. On vous apporte un rondin de hêtre Ø 90 à refendre (« Reprendre » dans « Pièces débitées »). Une pièce ronde ne se scie jamais tenue à la main : écartez-la (« Écarter : gabarit »), ou sciez-la dans le gabarit en vé.',
      checks:[['Rondin écarté ou scié dans le gabarit',()=>refStats().rondOk]], done:all },
    fin(),
    ctrl('Guide parallèle à 20 mm et table à 0° ; lame de 20 ± 0,5 mm régulière ; protecteur au plus près ; servante en place et rondin écarté (ou scié au gabarit).',resRefente) ],
};
/* écart au départ : bord du trait de scie (côté pièce) par rapport au trait de crayon, mm (> 0 : côté chute) */
export function startGap(p){ const T=p.origin.trace; if(!T) return null;
  const loc=(()=>{ const c=Math.cos(p.th), s=Math.sin(p.th), dx=0-p.tx, dz=0-p.tz; return [dx*c+dz*s, -dx*s+dz*c]; })();
  const d=traceDist(T,loc[0],loc[1]); if(Math.abs(d.d)>6||d.k>40) return null; return d.d-voie()/2; }

/* ---------- contrôle final et critères ---------- */
function resLame(){ const b=lame();
  return { rows:[['Lame montée',b? `${b.w} mm, pas ${b.p}${b.crack?', fissurée':''}${st.inv?', à l\'envers':''}` : 'aucune', blade30()],
    ['Tension (indicateur)',b? `${st.ten} pour ${b.w} mm` : '—', tensionOk()],
    ['Lame sur le bandage',b&&st.posOk? (rimOk()?'dents hors du bandage':'mal placée') : 'pas vérifiée', rimOk()],
    ['Guide-lames supérieur et inférieur',guidesOk(true)&&guidesOk(false)?'réglés':'à régler', !!b&&guidesOk(true)&&guidesOk(false)]] }; }
function resChant(){ const s=chantStats(); if(!s||!s.n) return { msg:'Aucune coupe faite le long du tracé.' };
  const okB=s.blades.length&&s.blades.every(b=>rmin(b)<=60);
  return { rows:[['Lame qui suit le rayon de 60 mm',s.blades.map(b=>`${b.w} mm (R mini ${rmin(b)})`).join(', ')||'—', !!okB],
    ['Protecteur au plus près à chaque coupe',s.hgMax==null?'—':`${fmt(s.hgMax,0)} mm au-dessus au plus`, s.hgMax!=null&&s.hgMax<=PROT_GAP[1]&&s.hgMin>=0],
    ['Coupe côté chute, jamais dans la pièce',`${fmt(s.min)} mm au plus près${s.cov<0.95?' · tracé pas scié en entier':''}`, s.min>=-0.3&&s.cov>=0.95],
    ['Écart moyen au trait ≤ 1 mm',fmt(s.mean)+' mm', s.mean!=null&&s.mean<=1&&s.mean>=-0.3&&s.split]] }; }
function resRefente(){ const {s,rec,rondOk}=refStats(); if(!s) return { msg:'Aucune lame refendue au guide.' };
  return { rows:[['Guide à 20 mm, table à 0°',`${fmt(rec.fx)} mm · ${rec.tilt}°`, Math.abs(rec.fx-20)<0.01&&rec.tilt===0],
    ['Lame de 20 ± 0,5 mm, régulière',`${fmt(s.slice.min)} à ${fmt(s.slice.max)} mm`, s.slice.min>=19.5&&s.slice.max<=20.5],
    ['Protecteur au plus près',`${fmt(rec.hgOver,0)} mm au-dessus`, rec.hgOver>=PROT_GAP[0]&&rec.hgOver<=PROT_GAP[1]],
    ['Servante en place, rondin écarté',`${rec.serv?'servante':'sans servante'} · ${rondOk?'rondin écarté':'rondin pas écarté'}`, !!rec.serv&&rondOk]] }; }

export const SCENS=[
  { mode:'lame', view:'v34', t:'Changer et régler la lame', intro:'Changement de lame avant une refente : consignation, choix et contrôle de la lame, montage, tension, position sur les volants, guide-lames, essai à vide.' },
  { mode:'chant', view:'vop', t:'Chantourner suivant un tracé', intro:'Console en hêtre : choisir une lame qui suit le plus petit rayon, régler le protecteur, puis scier côté chute, au plus près du trait, les mains hors de l\'axe de la lame.' },
  { mode:'refente', view:'vop', t:'Refendre au guide parallèle', intro:'Refente d\'un avivé de chêne sur chant en une lame de 20 mm : table à 0°, guide, servante, protecteur, poussoir en fin de passe ; puis un rondin à traiter sans danger.' },
];
export function scenCriteria(m, {dangers, ok}){ const sec=['Aucune faute grave',`${dangers}`,ok];
  const R= m==='lame'? resLame() : m==='chant'? resChant() : resRefente();
  if(!R.rows) return [[R.msg||'Travail','—',false],['—','—',false],['—','—',false],['—','—',false],sec];
  return [...R.rows.map(r=>[r[0],r[1],!!r[2]]),sec]; }
