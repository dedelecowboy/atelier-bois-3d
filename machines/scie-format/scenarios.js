/* Scénarios guidés de la scie à format : pièce de départ, étapes (consigne, contrôles, réussite),
   contrôle final, et critères notés du parcours évalué.
   Nommage des chants : bruts numérotés (1, 2, 3, 4 ; U = chant d'usine), sciés en lettres ;
   la lettre d'une coupe est fixée par l'étape (cut:'A'). */
import { BLADE_Z, SABOT_FACE, MAIN_KERF } from './constants.js';
import { st } from './state.js';
import { pieces, A, sPts, segLen, newPiece, clearPieces, setActiveId, toFence, toStop, fenceEdge, guideEdge, stopEdge, sabotContact, scoreState } from './pieces.js';
import { rightAngle, parallelAt, measure, flacheCheck, measurePlanche, faceUp, hasChips, bladeEdge } from './rules.js';

const fmtMm=v=>v.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1});

/* ---------- Mise au format d'un panneau mélaminé ---------- */
const STEPS_FORMAT=[
  {k:'Préparation', t:'Préparer la machine',
   c:'Panneau mélaminé 19 mm brut de découpe (environ 1 030 × 620 mm, chants pas d\'équerre). Objectif : une pièce de 800 × 450 mm d\'équerre. Réglez la machine avant la première coupe.',
   checks:[['Hauteur de lame entre 25 et 35 mm (≈ 10 mm au-dessus du panneau)',()=>st.h>=25&&st.h<=35],['Inclinaison à 0°',()=>st.t===0],['Guide parallèle éloigné (700 mm ou plus)',()=>st.r>=700],['Moteur en marche',()=>st.motor]],
   done:s=>s.checks.every(c=>c[1]())},
  {k:'Coupe 1', t:'Dresser le grand chant ①', cut:'A',
   c:'Le petit chant ④ est contre la règle. Réglez la butée à 600 mm puis cliquez « En butée » : le grand chant ① dépasse le trait de scie d\'environ 15 mm. Lancez la passe. Après l\'aller, évacuez la chute, puis ramenez le chariot (« Retour du chariot »).',
   checks:[['Butée à 600 mm',()=>st.stop===600],['Panneau en butée',()=>!!stopEdge(A())],['Petit chant contre la règle',()=>!!fenceEdge(A())]],
   done:()=>{ const p=A(); return !!p && p.meta.some((m,i)=>m.sawn && Math.hypot(...[0,1].map(k=>p.pts[(i+1)%p.pts.length][k]-p.pts[i][k]))>0.9); }},
  {k:'Coupe 2', t:'Équerrer un petit chant', cut:'B',
   c:'Pivotez le panneau pour amener le chant dressé A face à la règle, puis « Contre la règle ». Réglez la butée à 1 010 mm, « En butée », et passez. Après l\'aller, évacuez la chute, puis ramenez le chariot (« Retour du chariot »).',
   checks:[['Chute évacuée',()=>pieces.length===1],['Chant A contre la règle',()=>fenceEdge(A())?.label==='A'],['Butée à 1 010 mm',()=>st.stop===1010],['Panneau en butée',()=>!!stopEdge(A())]],
   done:()=>rightAngle(A())},
  {k:'Coupe 3', t:'Déligner à 450 mm', cut:'C',
   c:'Réglez le guide parallèle à 450 mm. Pivotez le panneau pour amener le chant A face au guide, puis « Contre le guide ». Passez : la pièce utile passe entre la lame et le guide. Évacuez la chute ; au retour, la pièce est reposée sur le chariot, elle ne repasse jamais entre la lame et le guide.',
   checks:[['Chute évacuée',()=>pieces.length===1],['Guide à 450 mm',()=>st.r===450],['Chant A contre le guide',()=>guideEdge(A())?.label==='A']],
   done:()=>parallelAt(A(),0.450)},
  {k:'Coupe 4', t:'Tronçonner à 800 mm', cut:'D',
   c:'Éloignez le guide. Plaquez un grand chant scié (A ou C) contre la règle ; retournez le panneau si besoin pour que le chant B soit côté butée. Réglez la butée à 800 mm, « En butée », passez, puis évacuez la chute.',
   checks:[['Chute évacuée',()=>pieces.length===1],['Guide éloigné (700 mm ou plus)',()=>st.r>=700],['Grand chant scié contre la règle',()=>{ const e=fenceEdge(A()); return !!e&&e.sawn&&e.label!=='B'; }],['Chant B en butée',()=>stopEdge(A())?.label==='B'],['Butée à 800 mm',()=>st.stop===800]],
   done:()=>{ const p=A(); return !!p && p.meta.length===4 && p.meta.every(m=>m.sawn); }},
  {k:'Contrôle', t:'Contrôler la pièce', c:'Comparez la pièce obtenue au cahier des charges : 800 × 450 mm, tolérance ± 0,5 mm, écart de diagonales 1 mm au plus.', checks:[], results:()=>resultsFormat(), done:()=>false}
];

/* ---------- Délignage d'une planche avec flache ---------- */
function makeBoard(){ const L=1.80, N=7, pts=[], labels=[], bands=[];
  const low=u=>-0.012*Math.sin(Math.PI*u/L), up=u=>0.245+0.03*u/L+0.014*Math.sin(Math.PI*u/L);
  const wl=[0.030,0.022,0.016,0.020,0.028,0.034,0.026,0.030], wu=[0.018,0.026,0.032,0.024,0.017,0.022,0.030,0.024];
  const lo=[], hi=[]; for(let i=0;i<=N;i++){ const u=L*i/N; lo.push([u,low(u)]); hi.push([u,up(u)]); }
  lo[0][0]+=0.004; lo[N][0]-=0.003; hi[N][0]+=0.006; hi[0][0]-=0.002;
  for(let i=0;i<=N;i++){ pts.push(lo[i]); labels.push(i<N?'1':'2'); }
  for(let i=N;i>=0;i--){ pts.push(hi[i]); labels.push(i>0?'3':'4'); }
  for(let i=0;i<N;i++){ const P=lo[i],P2=lo[i+1],Q=[P[0],P[1]+wl[i]],Q2=[P2[0],P2[1]+wl[i+1]]; bands.push({label:'1',pts:[P,P2,Q2,Q],inner:[Q,Q2]});
    const H=hi[i],H2=hi[i+1],G=[H[0],H[1]-wu[i]],G2=[H2[0],H2[1]-wu[i+1]]; bands.push({label:'3',pts:[H,G,G2,H2],inner:[G,G2]}); }
  return {pts,labels,bands}; }
function loadPlanche(){ clearPieces(); st.stop=955; st.h=80; st.r=320;
  const b=makeBoard(), p=newPiece('plank',0.027,b.pts,b.labels,b.bands); setActiveId(p.id);
  const S=sPts(p); p.tx+=SABOT_FACE-Math.max(...S.map(q=>q[0])); p.tz+=0.33-Math.min(...S.map(q=>q[1])); }
const STEPS_PLANCHE=[
  {k:'Préparation', t:'Préparer la machine',
   c:'Planche de chêne brute 1 800 × 250 à 290 × 27 mm, avec flache sur les deux rives. Objectif : un avivé de 160 mm de large, sans flache, rives parallèles. Réglez la machine pour du bois massif.',
   checks:[['Hauteur de lame entre 32 et 45 mm (≈ 10 mm au-dessus de la planche)',()=>st.h>=32&&st.h<=45],['Inclinaison à 0°',()=>st.t===0],['Sabot de délignage monté en bout de chariot',()=>st.sabot],['Règle du guide en position courte (bois massif)',()=>st.guideShort],['Guide parallèle éloigné (400 mm ou plus)',()=>st.r>=400],['Moteur en marche',()=>st.motor]],
   done:s=>s.checks.every(c=>c[1]())},
  {k:'Coupe 1', t:'Délignage de rive au sabot', cut:'A',
   c:'La planche repose sur le chariot. Poussez son bout contre le sabot (« Contre le sabot »), puis décalez-la vers la lame jusqu\'à ce que le trait laser rouge passe entièrement dans le bois sain, au-delà de la flache de la rive ①. Le trait doit passer à 10 mm au plus du point où la flache est la plus profonde, pour ne pas gaspiller de bois. Lancez la passe. Après l\'aller, évacuez la chute, puis ramenez le chariot (« Retour du chariot »).',
   checks:[['Planche contre le sabot',()=>sabotContact(A())],['Le trait de scie enlève toute la flache de la rive ①',()=>flacheCheck(A()).clean],['Trait à 10 mm au plus du point le plus profond de la flache (pas de gaspillage)',()=>{ const f=flacheCheck(A()); return f.clean&&f.margin<=10; }]],
   done:()=>{ const p=A(); return !!p && p.meta.some((m,i)=>m.sawn && segLen(p,i)>1.4); }},
  {k:'Coupe 2', t:'Délignage parallèle à 160 mm', cut:'B',
   c:'Réglez le guide à 160 mm (règle en position courte). Plaquez la rive sciée A contre le guide (« Contre le guide ») : la planche passe de l\'autre côté de la lame. Lancez la passe, puis évacuez la chute.',
   checks:[['Chute évacuée',()=>pieces.length===1],['Guide à 160 mm',()=>st.r===160],['Règle du guide en position courte',()=>st.guideShort],['Rive A contre le guide',()=>guideEdge(A())?.label==='A']],
   done:()=>parallelAt(A(),0.160)},
  {k:'Contrôle', t:'Contrôler l\'avivé', c:'Cahier des charges : largeur 160 mm ± 0,5, rives parallèles, aucune trace de flache.', checks:[], results:()=>resultsPlanche(), done:()=>false}
];

/* ---------- Mélaminé et inciseur ---------- */
function loadInc(){ clearPieces(); st.stop=955; st.h=80; st.r=320; st.inc=false; st.incH=0; st.incW=3.8; st.incOff=0.4;
  const p=newPiece('mela',0.019,[[0,0],[0.6,0],[0.6,1.0],[0,1.0]],['U','U','U','U']); p.meta.forEach(m=>m.sawn=true); setActiveId(p.id); toFence(p);
  const S=sPts(p); p.tz+=0.30-Math.min(...S.map(q=>q[1])); }
const scoreChecks=()=>[['Inciseur en marche',()=>st.inc],['Hauteur d\'inciseur 1 à 2 mm',()=>st.incH>=1&&st.incH<=2],[`Largeur d\'incision au moins égale au trait de lame (${MAIN_KERF.toFixed(1)} mm), 5 mm au plus`,()=>st.incW>=MAIN_KERF-1e-6&&st.incW<=5],['Inciseur aligné : son trait recouvre celui de la lame',()=>scoreState()==='ok']];
const STEPS_INC=[
  {k:'Préparation', t:'Préparer la machine',
   c:'Panneau mélaminé blanc 19 mm, 1 000 × 600 mm, chants d\'usine (U). La pièce finie, 800 × 400 mm, sera visible sur ses deux faces : aucun éclat n\'est admis, ni au recto ni au verso. Pour commencer, l\'inciseur reste arrêté : on fait d\'abord une coupe d\'essai.',
   checks:[['Hauteur de lame entre 25 et 35 mm',()=>st.h>=25&&st.h<=35],['Inclinaison à 0°',()=>st.t===0],['Guide parallèle éloigné (700 mm ou plus)',()=>st.r>=700],['Moteur en marche',()=>st.motor],['Inciseur arrêté pour l\'essai',()=>!st.inc]],
   done:s=>s.checks.every(c=>c[1]())},
  {k:'Coupe d\'essai', t:'Couper sans inciseur et observer', cut:'A',
   c:'Réglez la butée à 900 mm, « En butée », lancez la passe. Évacuez la chute, ramenez le chariot, puis cliquez « Retourner » pour voir le verso : les éclats sont du côté où les dents de la lame sortent du panneau, c\'est-à-dire en dessous.',
   checks:[['Butée à 900 mm',()=>st.stop===900],['Panneau contre la règle et en butée',()=>!!fenceEdge(A())&&!!stopEdge(A())],['Coupe faite',()=>{ const p=A(); return !!p&&p.meta.some(m=>m.label==='A'); }],['Verso visible (pièce retournée)',()=>!!A()&&A().flip]],
   done:()=>{ const p=A(); return !!p && p.meta.some(m=>m.chips&&m.chips[faceUp(p)]); }},
  {k:'Réglage', t:'Régler l\'inciseur',
   c:'Mettez l\'inciseur en marche. Réglez sa hauteur pour qu\'il entaille le panneau de 1 à 2 mm, sa largeur pour qu\'elle soit au moins égale au trait de lame, puis corrigez le décalage pour que les deux traits se superposent.',
   checks:scoreChecks(), done:s=>s.checks.every(c=>c[1]())},
  {k:'Coupe 2', t:'Tronçonner à 800 mm avec inciseur', cut:'B',
   c:'Placez le chant A (celui qui a éclaté) côté lame : il sera recoupé. Plaquez un chant d\'usine contre la règle, réglez la butée à 800 mm, « En butée », passez. Évacuez la chute et ramenez le chariot.',
   checks:[...scoreChecks(),['Chant A côté lame (il sera recoupé)',()=>bladeEdge(A())?.label==='A'],['Butée à 800 mm',()=>st.stop===800],['Pièce en butée',()=>!!stopEdge(A())]],
   done:()=>{ const p=A(); return !!p && p.meta.some(m=>m.label==='B'&&m.chips&&!m.chips.recto&&!m.chips.verso); }},
  {k:'Coupe 3', t:'Déligner à 400 mm avec inciseur', cut:'C',
   c:'Réglez le guide parallèle à 400 mm. Pivotez la pièce pour plaquer un chant propre contre le guide (« Contre le guide »), puis passez : la pièce utile passe entre la lame et le guide.',
   checks:[...scoreChecks(),['Guide à 400 mm',()=>st.r===400],['Chant sans éclat contre le guide',()=>{ const e=guideEdge(A()); return !!e && !(e.chips&&(e.chips.recto||e.chips.verso)); }]],
   done:()=>parallelAt(A(),0.400)},
  {k:'Contrôle', t:'Contrôler la pièce', c:'Cahier des charges : 800 × 400 mm ± 0,5, aucun éclat au recto ni au verso. Retournez la pièce pour vérifier les deux faces.', checks:[], results:()=>resultsInc(), done:()=>false}
];

/* ---------- Coupe libre et panneau du mode format ---------- */
function loadFree(){ clearPieces(); st.stop=955; st.h=35; const p=newPiece('oak',0.022,[[0,0],[0.30,0],[0.30,1.05],[0,1.05]],['1','2','3','4']); setActiveId(p.id); toFence(p); toStop(p); }
function loadFormat(){ clearPieces(); st.stop=955; st.h=80; st.r=320;
  const p=newPiece('mela',0.019,[[0,0],[1.032,0.006],[1.026,0.621],[-0.004,0.614]],['1','2','3','4']); setActiveId(p.id); toFence(p);
  const S=sPts(p); p.tz+=0.30-Math.min(...S.map(q=>q[1])); }

/* --- contrôle final : tableau [libellé, valeur, conforme] --- */
const NO4={msg:'La pièce active n\'a pas 4 chants : reprenez les coupes.'};
function resultsFormat(){ const p=A(), res=p&&measure(p); if(!res) return NO4;
  return {rows:[['Longueur (800)',fmtMm(res.L)+' mm',Math.abs(res.L-800)<=0.5],['Largeur (450)',fmtMm(res.W)+' mm',Math.abs(res.W-450)<=0.5],['Écart de diagonales',fmtMm(res.diag)+' mm',res.diag<=1],['Défaut d\'angle max',res.dev.toLocaleString('fr-FR',{maximumFractionDigits:2})+'°',res.dev<0.1],['Chants sciés',res.sawn+' / 4',res.sawn===4]]}; }
function resultsPlanche(){ const p=A(), res=p&&measurePlanche(p); if(!res) return {msg:'La pièce active n\'a pas deux rives sciées : reprenez les coupes.'};
  return {rows:[['Largeur (160)',fmtMm(res.W)+' mm',Math.abs(res.W-160)<=0.5],['Défaut de parallélisme',res.dev.toLocaleString('fr-FR',{maximumFractionDigits:3})+'°',res.dev<0.05],['Flache restante',res.flache?'oui':'aucune',!res.flache],['Rives sciées',res.longSawn+' / 2',res.longSawn>=2]]}; }
function resultsInc(){ const p=A(), res=p&&measure(p); if(!res) return NO4;
  const recto=p.meta.some(m=>m.chips&&m.chips.recto), verso=p.meta.some(m=>m.chips&&m.chips.verso);
  return {rows:[['Longueur (800)',fmtMm(res.L)+' mm',Math.abs(res.L-800)<=0.5],['Largeur (400)',fmtMm(res.W)+' mm',Math.abs(res.W-400)<=0.5],['Éclats au recto',recto?'oui':'aucun',!recto],['Éclats au verso',verso?'oui':'aucun',!verso],['Équerrage (diagonales)',fmtMm(res.diag)+' mm',res.diag<=1]]}; }

/* --- modes : étapes et pièce de départ --- */
export const STEPS={ format:STEPS_FORMAT, planche:STEPS_PLANCHE, inciseur:STEPS_INC };
export const LOADERS={ libre:loadFree, format:loadFormat, planche:loadPlanche, inciseur:loadInc };

/* --- parcours évalué : 3 scénarios, 5 critères de 4 points chacun --- */
export const SCENS=[
 {mode:'format', view:'v34', t:'Mise au format 800 × 450', intro:'Mise au format d\'un panneau mélaminé brut à 800 × 450 mm, d\'équerre.'},
 {mode:'planche', view:'vop', t:'Délignage d\'une planche avec flache', intro:'Délignage d\'une planche de chêne brute : rive au sabot, puis avivé de 160 mm sans flache.'},
 {mode:'inciseur', view:'v34', t:'Mélaminé avec inciseur', intro:'Débit d\'un panneau mélaminé à 800 × 400 mm sans aucun éclat, au recto comme au verso.'}
];
/* critères notés : [libellé, valeur, ok] ; le dernier est toujours « Aucune faute grave » */
export function scenCriteria(m, {dangers, ok}){ const p=A(), okS=ok, nb=`${dangers}`;
  if(m==='planche'){ const r=p&&measurePlanche(p);
    return [['Largeur 160 ± 0,5 mm', r?fmtMm(r.W)+' mm':'—', !!r&&Math.abs(r.W-160)<=0.5],['Rives parallèles', r?r.dev.toLocaleString('fr-FR',{maximumFractionDigits:3})+'°':'—', !!r&&r.dev<0.05],
      ['Aucune flache', r?(r.flache?'flache restante':'aucune'):'—', !!r&&!r.flache],['2 rives sciées', r?r.longSawn+' / 2':'—', !!r&&r.longSawn>=2],['Aucune faute grave', nb, okS]]; }
  const r=p&&measure(p), WT=m==='inciseur'?400:450;
  const base=[['Longueur 800 ± 0,5 mm', r?fmtMm(r.L)+' mm':'—', !!r&&Math.abs(r.L-800)<=0.5],[`Largeur ${WT} ± 0,5 mm`, r?fmtMm(r.W)+' mm':'—', !!r&&Math.abs(r.W-WT)<=0.5],['Équerrage (diagonales ≤ 1 mm)', r?fmtMm(r.diag)+' mm':'—', !!r&&r.diag<=1]];
  if(m==='inciseur'){ const ch=!!p&&hasChips(p); return [...base,['Aucun éclat recto / verso', p?(ch?'éclats':'aucun'):'—', !!p&&!ch],['Aucune faute grave', nb, okS]]; }
  return [...base,['4 chants sciés', r?r.sawn+' / 4':'—', !!r&&r.sawn===4],['Aucune faute grave', nb, okS]]; }
