/* Scénarios guidés de la raboteuse : la suite du corroyage. Les pièces arrivent de la dégauchisseuse (SR1 et SR2 dressés,
   repérés au crayon, posées SR1 dessus comme on les a repérées) : on les met à largeur d'abord (sur chant, SR2 sur la table :
   la pièce encore épaisse est plus stable), puis à épaisseur (à plat, SR1 sur la table). Contrôle au pied à coulisse, au dixième.
   Trois scénarios : largeur d'une traverse sur chant, épaisseur de deux montants (pièces d'épaisseurs différentes : jamais de
   front), contrôle d'un lot (pièce cintrée non dégauchie à renvoyer, fil incliné à lire). */
import { st } from './state.js';
import { pieces, newPiece, clearPieces, measure, onMachine, sr1, sr2, fmt } from './piece.js';
import * as C from '../../engine/corroyage.js';

const lot={};                                   // pièces du mode, par rôle
const near=(v,t,e)=>Math.abs(v-t)<=e+1e-9;
/* mesure au pied à coulisse : au dixième de millimètre */
const cal=v=>Math.round(v*10)/10;
const T=k=>lot[k]?measure(lot[k]):null;
const thickTop=()=>Math.max(...Object.values(lot).filter(q=>q.kind!=='retour'&&q.face.F1.passes+q.face.F2.passes>0).map(q=>measure(q).Tmax));
/* la face du dessus a été rabotée sur toute sa longueur, parallèle à la face posée */
const planedF=q=>!!q&&(q.face.F1.full||q.face.F2.full)&&measure(q).parT<=0.05;
const planedC=q=>!!q&&(q.face.C1.full||q.face.C2.full)&&measure(q).parW<=0.05;
const onTableDown=(q,f)=>!!q&&q.state==='entry'&&C.faces(q).down===f;
const running=['Moteur puis avance en marche',()=>st.motor&&st.feed];
const passOk=(h)=>{ const d=h-st.H; return d>=1-1e-6&&d<=5+1e-6; };

/* ---------- étapes communes ---------- */
const prep=(c)=>({k:'Préparation', t:'Préparer la machine', c,
  checks:[['Aspiration en marche',()=>st.asp],['Capot fermé',()=>!st.capot],['Linguets anti-recul contrôlés (moteur arrêté)',()=>st.ling],['Vitesse d\'avance de 8 à 12 m/min (bois dur)',()=>st.v>=8&&st.v<=12]],
  done:s=>s.checks.every(c=>c[1]())});
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Le travail est fini : mettez les pièces de côté (« Mettre de côté »), arrêtez l\'avance, puis le moteur. Ne vous éloignez qu\'à l\'arrêt complet de l\'arbre ; nettoyez à l\'aspirateur, jamais à la soufflette.',
  checks:[['Aucune pièce sur la machine',()=>!onMachine().length],['Avance arrêtée',()=>!st.feed],['Moteur arrêté',()=>!st.motor]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler les pièces', c, checks:[], results, done:()=>false});

/* ---------- contrôle final : au pied à coulisse, au dixième de millimètre ---------- */
const yes=(ok,a='oui',b='non')=>ok?a:b;
const pc=(v,t)=>[fmt(cal(v))+' mm', near(cal(v),t,0.1)];
function rows(mode){ const r=[];
  if(mode==='ep'){ const a=T('a'), b=T('b'); if(!a||!b) return {msg:'Pièces introuvables.'};
    const par=Math.max(a.parT,b.parT), marks=a.s1&&a.s2&&b.s1&&b.s2, tear=a.tear||b.tear;
    r.push(['Montant 1 : 27 ± 0,1 mm',...pc(a.T,27)],['Montant 2 : 27 ± 0,1 mm',...pc(b.T,27)],
      ['Faces rabotées parallèles à SR1 (0,1 mm max.)',fmt(cal(par))+' mm',cal(par)<=0.1&&planedF(lot.a)&&planedF(lot.b)],
      ['Repères SR1 et SR2 conservés',yes(marks,'oui','effacés'),!!marks],['Arrachements',yes(tear,'oui','aucun'),!tear]); }
  if(mode==='lar'){ const a=T('a'); if(!a) return {msg:'Pièce introuvable.'}; const ang=lot.a.face.C2.angle?.deg;
    r.push(['Largeur 70 ± 0,1 mm',...pc(a.W,70)],['Chant raboté parallèle à SR2 (0,1 mm max.)',fmt(cal(a.parW))+' mm',cal(a.parW)<=0.1&&planedC(lot.a)],
      ['Équerre SR1 / chant raboté (90 ± 0,2°)',ang==null?'—':fmt(ang)+'°',ang!=null&&near(ang,90,0.2)],
      ['Repères SR1 et SR2 conservés',yes(a.s1&&a.s2,'oui','effacés'),!!(a.s1&&a.s2)],['Arrachements',yes(a.tear,'oui','aucun'),!a.tear]); }
  if(mode==='controle'){ const a=T('a'), b=lot.b; if(!a||!b) return {msg:'Pièces introuvables.'};
    const sent=renvoi();
    r.push(['Frêne : 22 ± 0,1 mm',...pc(a.T,22)],['Arrachements',yes(a.tear,'oui','aucun'),!a.tear],
      ['Face rabotée parallèle à SR1 (0,1 mm max.)',fmt(cal(a.parT))+' mm',cal(a.parT)<=0.1&&planedF(lot.a)],
      ['Pièce cintrée renvoyée à la dégauchisseuse',sent.v,sent.ok],['Repères SR1 et SR2 conservés',yes(a.s1&&a.s2,'oui','effacés'),!!(a.s1&&a.s2)]); }
  return {rows:r}; }
/* la pièce de chêne non dégauchie : jamais rabotée, rangée « À dégauchir » */
function renvoi(){ const b=lot.b; if(!b) return {ok:false,v:'—'}; const rab=['F1','F2','C1','C2'].some(f=>b.face[f].passes>0);
  return rab? {ok:false,v:'rabotée'} : b.state==='stock'&&b.kind==='retour'? {ok:true,v:'oui'} : {ok:false,v:'non classée'}; }

/* ---------- pièces de départ (telles qu'elles sortent de la dégauchisseuse : SR1 dessus) ---------- */
const DR={s1:'F1',s2:'C1'};
const PIECES={
  libre:[['a',{name:'Avivé',L:1000,W:120,T:33,wood:'sapin',seed:31,dress:DR,k:2}],['b',{name:'Cale',L:230,W:60,T:33,wood:'sapin',seed:33,dress:DR,k:2,state:'stock'}]],
  lar:[['a',{name:'Traverse',L:700,W:80,T:29.5,wood:'chene',seed:21,dress:DR,k:2}]],
  ep:[['a',{name:'Montant 1',L:900,W:76,T:33,wood:'hetre',seed:5,dress:DR,lar:70,k:2}],['b',{name:'Montant 2',L:900,W:76,T:33.7,wood:'hetre',seed:6,dress:DR,lar:70,k:2,state:'stock'}]],
  controle:[['a',{name:'Frêne',L:800,W:96,T:27.2,lar:90,wood:'frene',seed:13,sT:0.12,dress:DR,k:2,flip:true}],['b',{name:'Chêne',L:800,W:110,T:30,wood:'chene',bow:3,seed:9,state:'stock'}]],
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([m,list])=>[m,()=>{ clearPieces(); for(const k in lot) delete lot[k];
  Object.assign(st,{motor:false,feed:false,asp:false,capot:false,ling:false,H:45,v:16});
  for(const [k,spec] of list) lot[k]=newPiece(spec); }]));

/* ---------- étapes de chaque mode ---------- */
export const STEPS={
  lar:[
    prep('Traverse de chêne sortie de la dégauchisseuse (SR1 et SR2 dressés et repérés), 700 mm de long, environ 78 mm de large et 28 mm d\'épaisseur. À la raboteuse, on fait la largeur d\'abord, la pièce encore épaisse est plus stable sur chant ; l\'épaisseur vient ensuite. Objectif : 70,0 mm de largeur, chant raboté parallèle à SR2 et d\'équerre à SR1.'),
    {k:'Réglage', t:'Poser la pièce sur chant, SR2 sur la table',
      c:'Pour la largeur, la pièce se pose sur chant : le chant de référence SR2 (repère en V) sur la table, le chant à raboter dessus. Elle est stable : environ 78 mm de haut pour 28 mm d\'appui (moins de 4 fois). Réglez la cote sur la largeur maxi, pour une passe de 1 à 5 mm, puis moteur et avance.',
      checks:[['Pièce sur chant, SR2 sur la table',()=>onTableDown(lot.a,sr2(lot.a))],['Cote : passe de 1 à 5 mm',()=>passOk(T('a').Wmax)],running],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Passes', t:'Mettre la traverse à 70,0 mm',
      c:'Passez la pièce : l\'aide en sortie la repose sur le capot. « Ramener la pièce » (toujours SR2 sur la table) et montez la table de 1 à 5 mm à chaque passe. Dernière passe de 1 mm au plus, à la cote 70,0. Contrôlez au pied à coulisse, au dixième.',
      checks:[['Chant raboté sur toute sa longueur, parallèle à SR2',()=>planedC(lot.a)],['Largeur 70,0 mm au pied à coulisse',()=>near(cal(T('a').W),70,0.1)],['Aucun arrachement',()=>!T('a').tear]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez au pied à coulisse (au dixième) : largeur 70 ± 0,1 mm, chant parallèle à SR2 et d\'équerre à SR1, repères conservés, sans arrachement.',()=>rows('lar'))],
  ep:[
    prep('Deux montants de hêtre dégauchis (SR1 et SR2 dressés, repérés) et déjà mis à 70 mm de largeur, 900 mm de long, d\'environ 32 mm d\'épaisseur, l\'un plus épais que l\'autre. Objectif : les mettre tous les deux à 27,0 mm. Avant tout : EPI (protection auditive, lunettes, pas de gants flottants ni de bijoux), aspiration en marche, capot fermé, linguets anti-recul contrôlés moteur arrêté, vitesse d\'avance réglée pour du bois dur.'),
    {k:'Réglage', t:'Poser SR1 sur la table et régler la cote',
      c:'Retournez la pièce : SR1 (la face repérée par la boucle) sur la table, la face à raboter dessus. Mesurez le lot (cliquez les pièces, « Pièces débitées ») : la cote se règle sur la pièce la plus épaisse, pour une passe de 1 à 5 mm, et assez bas pour que les deux pièces soient rabotées partout. Démarrez le moteur, attendez qu\'il ait pris sa vitesse, puis l\'avance.',
      checks:[['SR1 (repère de parement) posée sur la table',()=>onTableDown(lot.a,sr1(lot.a))||onTableDown(lot.b,sr1(lot.b))],
        ['Cote : passe de 1 à 5 mm sur la pièce la plus épaisse',()=>passOk(Math.max(T('a').Tmax,T('b').Tmax))],
        ['Cote plus petite que l\'épaisseur mini de chaque pièce (faces rabotées partout)',()=>st.H<=Math.min(T('a').T,T('b').T)-0.05],running],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Passe 1', t:'Raboter les deux montants à la même cote',
      c:'Engagez un montant et lâchez-le dès que le rouleau d\'entrée l\'entraîne ; l\'aide en sortie le repose sur le capot. Les deux pièces n\'ont pas la même épaisseur : passez-les l\'une après l\'autre, jamais de front. « Reprendre » l\'autre montant (SR1 sur la table) et passez-le sans toucher à la cote.',
      checks:[['Montant 1 raboté sur toute la face, parallèle à SR1',()=>planedF(lot.a)],['Montant 2 raboté sur toute la face, parallèle à SR1',()=>planedF(lot.b)],
        ['Même épaisseur au pied à coulisse',()=>cal(T('a').T)===cal(T('b').T)]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Finition', t:'Mettre les deux montants à 27,0 mm',
      c:'Les deux montants ont maintenant la même épaisseur : vous pouvez les passer de front, côte à côte. « Ramener la pièce » du capot à l\'entrée, montez la table de 1 à 5 mm à chaque passe (cote plus petite) ; la dernière passe, de 1 mm au plus, se fait à la cote 27,0. Contrôlez au pied à coulisse, au dixième.',
      checks:[['Montant 1 à 27,0 mm au pied à coulisse',()=>near(cal(T('a').T),27,0.1)&&planedF(lot.a)],['Montant 2 à 27,0 mm au pied à coulisse',()=>near(cal(T('b').T),27,0.1)&&planedF(lot.b)],['Aucun arrachement',()=>!T('a').tear&&!T('b').tear]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez au pied à coulisse (au dixième) : 27 ± 0,1 mm, faces rabotées parallèles à SR1, repères conservés, sans arrachement.',()=>rows('ep'))],
  controle:[
    prep('Un lot de deux pièces à mettre à épaisseur. Objectif : un frêne (déjà à largeur) à 22,0 mm sans arrachement. Avant de raboter, contrôlez le lot : seule une pièce dégauchie (SR1 et SR2 dressés, repérés au crayon) passe à la raboteuse.'),
    {k:'Contrôle du lot', t:'Contrôler les pièces avant de raboter',
      c:'Regardez chaque pièce : cliquez-la, ou « Reprendre » pour la poser sur la table et la tourner. Une pièce brute de sciage, cintrée, sans repères n\'a pas été dégauchie : la raboteuse recopierait sa forme (elle ne redresse pas) et, posée sur son bombé, elle bascule et peut être rejetée. Rangez-la (« Mettre de côté ») et passez-la en « À dégauchir » dans « Pièces débitées ».',
      checks:[['Pièce non dégauchie mise à part, « À dégauchir »',()=>renvoi().ok]],
      done:()=>renvoi().ok},
    {k:'Réglage', t:'Poser SR1 sur la table, lire le fil',
      c:'SR1 sur la table, la face à raboter dessus. Lisez le fil sur le chant : à la raboteuse, l\'arbre est au-dessus ; les fibres doivent descendre, depuis la face rabotée, vers le bout qui entre en premier. Une pièce dégauchie dans le bon sens se rabote en la présentant par l\'autre bout. Cote : passe de 1 à 5 mm, puis moteur et avance.',
      checks:[['SR1 (repère de parement) posée sur la table',()=>onTableDown(lot.a,sr1(lot.a))],['Cote : passe de 1 à 5 mm',()=>passOk(T('a').Tmax)],running],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Passes', t:'Mettre le frêne à 22,0 mm sans arrachement',
      c:'Passez la pièce et regardez la face rabotée. Des arrachements ? La pièce est passée contre le fil : présentez-la bout pour bout et repassez à 1 mm au moins. « Ramener la pièce » du capot et montez la table à chaque passe jusqu\'à la cote 22,0. Contrôlez au pied à coulisse.',
      checks:[['Face rabotée sur toute la longueur, parallèle à SR1',()=>planedF(lot.a)],['Épaisseur 22,0 mm au pied à coulisse',()=>near(cal(T('a').T),22,0.1)],['Aucun arrachement',()=>!T('a').tear]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez au pied à coulisse (au dixième) : frêne à 22 ± 0,1 mm, sans arrachement, face rabotée parallèle à SR1, repères conservés ; la pièce de chêne non dégauchie renvoyée à la dégauchisseuse sans être rabotée.',()=>rows('controle'))],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'lar', view:'vop', t:'Mise à largeur', intro:'Mise à largeur d\'une traverse de chêne sur chant, en premier : SR2 sur la table, chant raboté parallèle et d\'équerre.'},
  {mode:'ep', view:'vop', t:'Mise à épaisseur', intro:'Mise à épaisseur de deux montants de hêtre déjà à largeur : SR1 sur la table, passes de 1 à 5 mm, jamais deux pièces d\'épaisseurs différentes de front.'},
  {mode:'controle', view:'vop', t:'Contrôle du lot et fil', intro:'Contrôle d\'un lot avant rabotage (une pièce n\'a pas été dégauchie) et mise à épaisseur d\'un frêne au fil incliné, sans arrachement.'},
];
export function scenCriteria(m, {dangers, ok}){ const nb=`${dangers}`, sec=['Aucune faute grave',nb,ok];
  const R=rows(m); if(!R.rows) return [['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],sec];
  const r=R.rows, both=(i,j,l)=>[l,`${r[i][1]} / ${r[j][1]}`,r[i][2]&&r[j][2]];
  if(m==='ep') return [r[0],r[1],r[2],both(3,4,'Repères conservés, sans arrachement'),sec];
  if(m==='lar') return [r[0],r[1],r[2],both(3,4,'Repères conservés, sans arrachement'),sec];
  return [r[0],r[1],r[2],r[3],sec]; }
