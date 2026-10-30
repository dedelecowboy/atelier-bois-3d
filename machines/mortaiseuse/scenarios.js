/* Scénarios guidés de la mortaiseuse. Les pièces arrivent corroyées (SR1 et SR2 dressés et repérés, largeur et épaisseur faites),
   en attente dans « Pièces débitées ». Procédure de réglage de l'atelier : épaisseur (bédane), longueur (oscillation ou
   taquets de la table), profondeur (taquets de côté, + 71), arasement (hauteur du bédane, clé de 27), distance (taquets de
   la table), vérins, mode automatique, pièce d'essai.
   1. Changer le bédane : consignation complète, bédane de 10 mm en bon état (le n° 1 est ébréché), serrage, essai à vide.
   2. Mortaise simple à la cote : 10 × 40 × 30 à 9 mm de SR1 et 60 mm du bout, oscillation réduite à 40 mm ; pièges de départ :
      taquet de départ après 71, vérin devant le bédane.
   3. Série en butée : 2 montants de hêtre, mortaises 8 × 60 × 37 à 150 mm de chaque bout (butée gauche puis droite), assorties
      aux traverses tenonnées à la tenonneuse (tenons 8 × 35 à 8 mm de SR1, sur toute la largeur de 60) ; pièges : bédane de
      10 monté, taquet 1 pas sur 0, montant trop court.
   Barème du parcours : 5 critères de 4 points dont « aucune faute grave ». */
import { st, ctx } from './state.js';
import { BED_T } from './constants.js';
import { pieces, newPiece, clearPieces, onTable, mortises, fromFace, nearEnd, tenonOf, fit, cyc, fmt, sr1, atLoad } from './piece.js';
import { moving } from './rules.js';
import * as C from '../../engine/corroyage.js';

export const lot={};
const near=(v,t,e)=>Math.abs(v-t)<=e+1e-9;
const yes=(ok,a='oui',b='non')=>ok?a:b;
const stopped=()=>!st.bed && !moving() && !cyc.on;
const all=s=>s.checks.every(c=>c[1]());
const morts=q=>q? mortises(q) : [];
const mAt=(q,e)=>morts(q).find(m=>nearEnd(m).e===e)||null;
const okM=(m,th,pos,len)=>!!m && near(m.th,th,0.1) && near(fromFace(m,'F1'),pos,0.2) && near(m.len,len,0.5);
const ecM=q=>morts(q).some(m=>m.ec);

/* traverse tenonnée à la tenonneuse (scénario « Série » de la tenonneuse : hêtre 600 × 60 × 24, tenons 8 × 35 à 8 mm de SR1,
   sur toute la largeur) : plus contrôlée ici depuis le 30/10/2026 (la mortaise se fait avant le tenon : l'assemblage se contrôle à la
   tenonneuse) ; gardée pour window.__mortaise.assemble et les tests */
export function traverse(){ const q=C.makePiece({L:600,W:62,T:26,wood:'hetre',seed:5}); C.dresseSR(q,{s1:'F1',s2:'C1'}); C.rabote(q,'C1',60); C.rabote(q,'F1',24);
  const lo=q.w1[0], B=C.BIG; q.ends={ A:{cuts:[{d0:0,d1:35,ax:'w',a:-B,b:lo+8,k:'joue'},{d0:0,d1:35,ax:'w',a:lo+16,b:B,k:'joue'}],ec:false} }; return q; }
const TENON=()=>tenonOf(traverse(),'A');

/* ---------- étapes communes ---------- */
const prep=c=>({k:'Préparation', t:'Préparer le poste', c, checks:[['Aspiration en marche',()=>st.asp]], done:all});
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Le travail est fini : table au taquet 1, vérins desserrés, pièces mises de côté, bédane arrêté (sélecteur sur 0). Attendez l\'arrêt complet ; nettoyez à l\'aspirateur, jamais à la soufflette.',
  checks:[['Aucune pièce sur la table',()=>!onTable()],['Table au taquet 1 (position de chargement)',atLoad],['Bédane arrêté',stopped]], done:all};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler les pièces', c, checks:[], results, done:()=>false});

/* ---------- contrôle ---------- */
function rows(mode){ const r=[];
  if(mode==='bedane'){ const t=st.tool;
    r.push(['Consignation complète avant d\'intervenir (0, cadenas, essai de démarrage)',yes(lot.cons===true,'oui',lot.cons===false?'incomplète':'non'),lot.cons===true],
      ['Bédane de 10 mm en bon état monté',t==='b10'?'10 mm n° 2':t==='b10a'?'10 mm n° 1 (ébréché)':t? (t.slice(1)+' mm') : 'aucun',t==='b10'],
      ['Bédane serré, capot refermé',`${st.tight?'serré':'desserré'} · ${st.capot?'capot ouvert':'capot fermé'}`,st.tight&&!st.capot&&!!t],
      ['Remise en service et essai à vide',yes(!st.cad&&st.main&&!!lot.essai,'oui',!lot.essai?'pas d\'essai à vide':'non'),!st.cad&&st.main&&!!lot.essai]); }
  if(mode==='simple'){ const q=lot.a; if(!q) return {msg:'Pièce introuvable.'}; const m=mAt(q,'A')||morts(q)[0];
    const e=lot.e, me=e&&morts(e)[0], essai=!!me && okM(me,10,9,40) && e.state==='stock' && lot.order.indexOf(e.id)>-1 && (lot.order.indexOf(q.id)<0 || lot.order.indexOf(e.id)<lot.order.indexOf(q.id));
    if(!m) return {rows:[['Mortaise de 10,0 mm à 9,0 ± 0,2 mm de SR1','—',false],['Longueur 40,0 ± 0,5, à 60,0 ± 0,5 mm du bout','—',false],['Profondeur 30,0 ± 0,5 mm','—',false],['Pièce d\'essai mortaisée et contrôlée avant le montant',yes(essai),essai],['Bords nets (taquet de départ avant 71)','—',false]]};
    const d=nearEnd(m).d;
    r.push(['Mortaise de 10,0 mm à 9,0 ± 0,2 mm de SR1',`${fmt(m.th)} mm à ${fmt(fromFace(m,'F1'))} mm`,near(m.th,10,0.1)&&near(fromFace(m,'F1'),9,0.2)],
      ['Longueur 40,0 ± 0,5, à 60,0 ± 0,5 mm du bout',`${fmt(m.len)} mm à ${fmt(d)} mm`,near(m.len,40,0.5)&&near(d,60,0.5)],
      ['Profondeur 30,0 ± 0,5 mm',`${fmt(m.dep)} mm`,near(m.dep,30,0.5)&&!m.through],
      ['Pièce d\'essai mortaisée et contrôlée avant le montant',yes(essai),essai],
      ['Bords nets (taquet de départ avant 71)',m.ec||ecM(q)?'éclats':'nets',!m.ec&&!ecM(q)]); }
  if(mode==='serie'){ const B=['a','b'].map(k=>lot[k]); if(B.some(q=>!q)) return {msg:'Pièces introuvables.'};
    const M=B.flatMap(q=>['A','B'].map(e=>mAt(q,e)));
    const nS=M.filter(m=>okM(m,8,8,60)).length, nD=M.filter(m=>m&&near(nearEnd(m).d,150,0.5)).length, nP=M.filter(m=>m&&near(m.dep,37,0.5)&&!m.through).length;
    const c=lot.c, courte=c.state==='stock'&&c.kind==='interdite'&&!C.hasMorts(c);
    const me=lot.e&&morts(lot.e)[0], essai=!!me&&okM(me,8,8,60)&&near(me.dep,37,0.5)&&!me.through&&lot.e.state==='stock';
    r.push(['4 mortaises de 8,0 mm à 8,0 ± 0,2 mm de SR1, longueur 60,0 ± 0,5',`${nS} / 4`,nS===4],
      ['À 150,0 ± 0,5 mm de chaque bout',`${nD} / 4${M.some(Boolean)?' ('+M.map(m=>m?fmt(nearEnd(m).d):'—').join(' ; ')+')':''}`,nD===4],
      ['Profondeur 37,0 ± 0,5 mm (tenon de 35 + 2 mm)',`${nP} / 4`,nP===4],
      ['Montant de 220 mm écarté, non mortaisé',yes(courte,'oui',C.hasMorts(c)?'mortaisé':'non classé'),courte],
      ['Pièce d\'essai mortaisée aux cotes et contrôlée',me? (essai?'oui':'hors cotes') : 'pas d\'essai',essai]); }
  return {rows:r}; }

/* ---------- pièces de départ (corroyées : SR1 = F1 dessous, SR2 = C1 contre le guide) ---------- */
const DR={s1:'F1',s2:'C1'};
const PIECES={
  libre:[['a',{name:'Montant',L:700,W:72,T:30,lar:70,ep:28,wood:'chene',seed:41,dress:DR}],['e',{name:'Chute d\'essai',L:400,W:72,T:30,lar:70,ep:28,wood:'chene',seed:42,dress:DR,state:'stock'}],
    ['c',{name:'Cale',L:200,W:72,T:30,lar:70,ep:28,wood:'chene',seed:43,dress:DR,state:'stock'}]],
  bedane:[],
  simple:[['e',{name:'Pièce d\'essai',L:400,W:72,T:30,lar:70,ep:28,wood:'chene',seed:44,dress:DR,state:'stock'}],['a',{name:'Montant',L:700,W:72,T:30,lar:70,ep:28,wood:'chene',seed:41,dress:DR,state:'stock'}]],
  serie:[['e',{name:'Pièce d\'essai',L:400,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:9,dress:DR,state:'stock'}],
    ['a',{name:'Montant 1',L:900,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:51,dress:DR,state:'stock'}],['b',{name:'Montant 2',L:900,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:52,dress:DR,state:'stock'}],
    ['c',{name:'Montant court',L:220,W:62,T:26,lar:60,ep:24,wood:'hetre',seed:53,dress:DR,state:'stock'}]],
};
/* réglages de départ de la machine (ce qu'un groupe précédent a laissé) */
const BASE={ main:true, cad:false, essai:false, au:false, on:false, bed:false, auto:true, deb:false, press:false, capot:false, asp:false, tight:true, X:0, butG:true, butD:false };
const MACH={
  libre: { on:true, asp:true, tool:'b10', osc:50, ar:9, dep:50, arr:101, tq:[0,60,null,null], ver:{v1:250,v2:600,h1:250,h2:600} },
  bedane:{ on:true, tool:'b16', osc:50, ar:6, dep:50, arr:101, tq:[0,60,null,null], ver:{v1:250,v2:600,h1:250,h2:600} },
  simple:{ tool:'b10', osc:50, ar:12, dep:80, arr:91, tq:[0,30,null,null], ver:{v1:70,v2:330,h1:200,h2:330} },
  serie: { tool:'b10', osc:50, ar:9, dep:50, arr:101, tq:[20,150,null,null], ver:{v1:60,v2:330,h1:60,h2:330} },
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([m,list])=>[m,()=>{ clearPieces(); for(const k in lot) delete lot[k];
  const M=MACH[m]; Object.assign(st,BASE,M); st.tq=[...M.tq]; st.ver={...M.ver}; st.R=st.dep;
  lot.order=[]; lot.cons=null; lot.essai=false;
  for(const [k,spec] of list) lot[k]=newPiece(spec); }]));
/* fin de chaque cycle : ordre des pièces mortaisées, essai à vide (scénario 1) */
export function onCycleEnd(){ const L=cyc.log[cyc.log.length-1]; if(!L||!L.done) return;
  if(L.piece!==null && !lot.order.includes(L.piece) && cyc.cuts) lot.order.push(L.piece);
  if(L.piece===null && st.tool==='b10' && st.tight) lot.essai=true; }
/* première intervention sur le bédane : la consignation était-elle complète ? (scénario 1) */
export function onIntervention(){ if(lot.cons===null||lot.cons===undefined) lot.cons= st.cad && st.essai && !st.main; }

/* ---------- boutons utiles à chaque exercice (tous en mode libre) ---------- */
export const USEFUL={
  bedane:{ ops:[], quick:false, manual:false },
  simple:{ ops:['left','peek','aside'], quick:false, manual:false },
  serie: { ops:['left','right','peek','aside'], quick:true, manual:false },
};

/* ---------- étapes de chaque mode ---------- */
const capotOpenStep=(t,c,extra=[])=>({k:'Capot', t, c, checks:[['Capot ouvert',()=>st.capot],...extra], done:all});
export const STEPS={
  bedane:[
    prep('Le prochain travail demande des mortaises de 10 mm ; le bédane monté fait 16 mm. Avant tout : EPI (protection auditive, lunettes, chaussures de sécurité, cheveux attachés, pas de bijoux ni de vêtements amples), poste dégagé, aspiration en marche.'),
    {k:'Consigner', t:'Arrêter et consigner la machine',
      c:'Bédane arrêté : interrupteur général (armoire électrique) sur 0, cadenas posé (la clé reste dans votre poche), puis essai de démarrage : bouton vert, rien ne doit démarrer.',
      checks:[['Interrupteur général sur 0',()=>!st.main],['Cadenas posé',()=>st.cad],['Essai de démarrage : rien ne démarre',()=>st.essai]], done:all},
    capotOpenStep('Ouvrir le capot, démonter le bédane','Ouvrez le capot de protection. Avec la clé du porte-bédane, desserrez la vis, puis démontez le bédane de 16 mm et rangez-le au râtelier.',
      [['Vis du porte-bédane desserrée',()=>!st.tight||!st.tool],['Bédane de 16 mm démonté',()=>st.tool!=='b16']]),
    {k:'Bédane', t:'Choisir et monter le bon bédane',
      c:'Au râtelier, lisez l\'épaisseur gravée et regardez les dents : prenez le bédane de 10 mm en bon état (dents entières, bien affûtées). Montez-le à fond dans le porte-bédane, puis serrez la vis.',
      checks:[['Bédane de 10 mm monté',()=>st.tool==='b10'||st.tool==='b10a'],['Dents en bon état',()=>st.tool==='b10'],['Vis serrée',()=>!!st.tool&&st.tight]], done:all},
    {k:'Remise en service', t:'Refermer, déconsigner, remettre en route',
      c:'Refermez le capot. Retirez le cadenas, interrupteur général sur I, puis bouton vert (mise en route de la machine).',
      checks:[['Capot fermé',()=>!st.capot],['Machine déconsignée, interrupteur sur I',()=>!st.cad&&st.main],['Machine en route',()=>st.on]], done:all},
    {k:'Essai', t:'Essai à vide',
      c:'Sans pièce sur la table, mode automatique : tournez le sélecteur du bédane sur 1. Le cycle se fait à vide : regardez et écoutez, aucun bruit anormal. Le bédane s\'arrête à la fin du cycle.',
      checks:[['Cycle à vide fait avec le nouveau bédane',()=>!!lot.essai]], done:all},
    fin,
    ctrl('Contrôlez votre intervention : consignation, bédane choisi, serrage, remise en service et essai.',()=>rows('bedane'))],
  simple:[
    prep('Montant de chêne corroyé (700 × 70 × 28, SR1 et SR2 repérés) : une mortaise de 10 mm d\'épaisseur, 40 mm de long, 30 mm de profondeur, à 9 mm de SR1 (arasement) et à 60 mm du bout (distance). Une pièce d\'essai de même section valide les réglages. EPI, poste dégagé, aspiration en marche.'),
    {k:'Épaisseur', t:'Bédane adapté ?', c:'Épaisseur de la mortaise = épaisseur du bédane. Vérifiez le bédane monté : 10 mm, dents en bon état, vis serrée. Sinon : changer le bédane, appeler le professeur.',
      checks:[['Bédane de 10 mm en bon état, serré',()=>st.tool==='b10'&&st.tight]], done:all},
    {k:'Longueur', t:'Longueur de la mortaise : l\'oscillation',
      c:'40 mm, c\'est moins que 50 : une seule plongée, en réduisant l\'oscillation du bédane (vernier) à 40 mm. Bédane arrêté.',
      checks:[['Oscillation réglée à 40 mm',()=>near(st.osc,40,0.05)]], done:all},
    {k:'Profondeur', t:'Profondeur : les taquets de côté (+ 71)',
      c:'Règle de profondeur, derrière le bâti à gauche (clé Allen de 3). Référence 0 = 71 mm. Taquet de départ (rail 1) AVANT 71, pour que le bédane prenne sa vitesse ; taquet d\'arrêt (rail 2) à 30 + 71 = 101 mm.',
      checks:[['Taquet de départ avant 71',()=>st.dep<71-1e-6],['Taquet d\'arrêt à 101 mm (30 + 71)',()=>near(st.arr,101,0.05)]], done:all},
    capotOpenStep('Arasement : la hauteur du bédane','Ouvrez le capot. Avec la clé de 27, tournez l\'écrou du réglage de hauteur jusqu\'à 9 mm au compteur : le bas du bédane à 9 mm de la table, donc de SR1. Refermez le capot.',
      [['Arasement à 9 mm',()=>near(st.ar,9,0.05)]]),
    {k:'Distance', t:'Distance de la mortaise : les taquets de la table',
      c:'Capot refermé. Règle de la table (clé Allen de 3) : 1er taquet sur 0, 2e taquet à 60 mm (distance du bout à la mortaise). Retirez les autres taquets.',
      checks:[['Capot fermé',()=>!st.capot],['Taquet 1 sur 0',()=>near(st.tq[0],0,0.05)],['Taquet 2 à 60 mm',()=>near(st.tq[1],60,0.05)],['Taquets 3 et 4 retirés',()=>st.tq[2]===null&&st.tq[3]===null]], done:all},
    {k:'Essai', t:'Pièce d\'essai',
      c:'Reprenez la pièce d\'essai : « Contre la butée gauche », SR1 sur la table, SR2 contre le guide. Vérins : les 4 sur la pièce, aucun devant le bédane (regardez le schéma). Bouton vert, vérins en pression (les deux boutons blancs, à deux mains), mode automatique, sélecteur du bédane sur 1 : le cycle se fait. Bouton noir pour desserrer, « Voir les mortaises » pour contrôler la mortaise (elle est dans le chant contre le guide), puis mettez la pièce de côté.',
      checks:[['Pièce d\'essai mortaisée',()=>!!lot.e&&C.hasMorts(lot.e)],['Mortaise d\'essai conforme (10 × 40 à 9 de SR1)',()=>okM(morts(lot.e)[0],10,9,40)],['Pièce d\'essai mise de côté',()=>lot.e.state==='stock']], done:all},
    {k:'Montant', t:'Mortaiser le montant',
      c:'Même chose avec le montant : contre la butée gauche, SR1 sur la table, SR2 contre le guide, vérins placés et en pression, cycle automatique ; desserrez, mettez-le de côté.',
      checks:[['Montant mortaisé',()=>!!lot.a&&C.hasMorts(lot.a)],['Montant mis de côté',()=>lot.a.state==='stock']], done:all},
    fin,
    ctrl('Contrôlez la mortaise : épaisseur et arasement au pied à coulisse, longueur, distance et profondeur au réglet, état des bords.',()=>rows('simple'))],
  serie:[
    prep('Deux montants de hêtre corroyés (900 × 60 × 24) : à chaque bout, une mortaise de 8 × 60 mm, 37 mm de profondeur, à 8 mm de SR1 et à 150 mm du bout. Elles reçoivent les traverses tenonnées à la tenonneuse (tenons de 8 × 35 mm à 8 mm de SR1, sur toute la largeur de 60 mm). Le lot contient une pièce à ne pas mortaiser. EPI, aspiration en marche.'),
    {k:'Épaisseur', t:'Changer le bédane',
      c:'Mortaises de 8 mm : le bédane monté fait 10 mm. Choisissez le bédane de 8 mm au râtelier, puis « Changer le bédane : procédure complète » (consignation, capot, démontage, montage, serrage, remise en service).',
      checks:[['Bédane de 8 mm monté et serré',()=>st.tool==='b8'&&st.tight],['Capot fermé, machine déconsignée',()=>!st.capot&&!st.cad&&st.main]], done:all},
    {k:'Profondeur', t:'Profondeur et arasement',
      c:'60 mm, c\'est plus que 50 : oscillation à fond (50 mm) et deux plongées. Taquet de départ avant 71, taquet d\'arrêt à 37 + 71 = 108 mm. Capot ouvert, arasement à 8 mm (clé de 27), capot refermé.',
      checks:[['Oscillation à 50 mm',()=>near(st.osc,50,0.05)],['Taquet de départ avant 71',()=>st.dep<71-1e-6],['Taquet d\'arrêt à 108 mm (37 + 71)',()=>near(st.arr,108,0.05)],['Arasement à 8 mm',()=>near(st.ar,8,0.05)],['Capot fermé',()=>!st.capot]], done:all},
    {k:'Distance', t:'Taquets de la table : deux plongées',
      c:'Vérifiez le 1er taquet : il doit être sur 0. 2e taquet à 150 mm (première plongée), 3e taquet à 160 mm : 150 + 60 − 50 (la deuxième plongée finit la mortaise à 210 mm). 4e taquet retiré.',
      checks:[['Taquet 1 sur 0',()=>near(st.tq[0],0,0.05)],['Taquet 2 à 150 mm',()=>near(st.tq[1],150,0.05)],['Taquet 3 à 160 mm',()=>near(st.tq[2],160,0.05)],['Taquet 4 retiré',()=>st.tq[3]===null]], done:all},
    {k:'Lot', t:'Contrôler le lot',
      c:'Regardez chaque pièce du lot (« Pièces débitées »). Une pièce de moins de 300 mm n\'est pas tenue par les quatre vérins loin du bédane : marquez-la « Pas à la mortaiseuse ».',
      checks:[['Montant de 220 mm écarté',()=>lot.c.state==='stock'&&lot.c.kind==='interdite']], done:all},
    {k:'Essai', t:'Pièce d\'essai',
      c:'Pièce d\'essai contre la butée gauche, SR1 sur la table, SR2 contre le guide, vérins sur la pièce et hors de la course du bédane, en pression ; cycle automatique. Desserrez, « Voir les mortaises » : contrôlez l\'épaisseur (8), la position depuis SR1 (8), la longueur (60) et la profondeur (37). Mettez-la de côté. La mortaise se fait avant le tenon : les traverses seront tenonnées ensuite, à la tenonneuse, et leur tenon ajusté à ces mortaises.',
      checks:[['Pièce d\'essai mortaisée',()=>!!lot.e&&C.hasMorts(lot.e)],['Mortaise d\'essai aux cotes (8 × 60 × 37 à 8 de SR1)',()=>{ const m=morts(lot.e)[0]; return !!m&&okM(m,8,8,60)&&near(m.dep,37,0.5)&&!m.through; }],['Pièce d\'essai mise de côté',()=>lot.e.state==='stock']], done:all},
    {k:'Premier bout', t:'Premier bout : butée gauche',
      c:'Pour chaque montant : « Contre la butée gauche », vérins en pression, cycle, desserrez, mettez de côté.',
      checks:[['Montant 1 : mortaise côté butée gauche',()=>!!mAt(lot.a,'A')],['Montant 2 : mortaise côté butée gauche',()=>!!mAt(lot.b,'A')]], done:all},
    {k:'Deuxième bout', t:'Deuxième bout : butée droite',
      c:'Relevez la butée gauche, abaissez la butée droite. Posez chaque montant « Contre la butée droite », sans le retourner : SR1 reste sur la table, SR2 contre le guide. La distance se mesure alors depuis le bout droit, avec les mêmes taquets.',
      checks:[['Montant 1 : mortaise à l\'autre bout',()=>!!mAt(lot.a,'B')],['Montant 2 : mortaise à l\'autre bout',()=>!!mAt(lot.b,'B')]], done:all},
    fin,
    ctrl('Contrôlez la série : épaisseur, arasement et longueur au pied à coulisse, distances et profondeurs au réglet. Les tenons des traverses seront ajustés à ces mortaises, à la tenonneuse.',()=>rows('serie'))],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'bedane', view:'vbed', t:'Changer le bédane', intro:'Le bédane monté ne convient pas : consignez la machine, choisissez un bédane de 10 mm en bon état, montez-le, serrez-le, remettez en service et faites un essai à vide.'},
  {mode:'simple', view:'vop', t:'Mortaise à la cote', intro:'Une mortaise de 10 × 40 × 30 mm à 9 mm de SR1 et 60 mm du bout, en suivant la procédure de réglage, avec une pièce d\'essai. La machine a été laissée par un autre groupe : vérifiez tout.'},
  {mode:'serie', view:'vop', t:'Série en butée', intro:'Mortaises aux deux bouts de deux montants (les traverses seront tenonnées ensuite, ajustées à ces mortaises) : bédane à changer, deux plongées, butée gauche puis butée droite, pièce d\'essai, lot à contrôler.'},
];
export function scenCriteria(m,{dangers,ok}){ const sec=['Aucune faute grave',`${dangers}`,ok];
  const R=rows(m); if(!R.rows) return [['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],sec];
  const r=R.rows;
  if(m==='bedane') return [r[0],r[1],r[2],r[3],sec];
  if(m==='simple') return [r[0],r[1],r[2],['Pièce d\'essai, bords nets',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec];
  return [r[0],r[1],r[2],['Lot contrôlé, pièce d\'essai aux cotes',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec]; }
