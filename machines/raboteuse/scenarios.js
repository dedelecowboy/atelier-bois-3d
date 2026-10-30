/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Scénarios guidés de la raboteuse : la suite du corroyage. Les pièces arrivent de la dégauchisseuse (SR1 et SR2 dressés,
   repérés au crayon, posées SR1 dessus comme on les a repérées) : mise à largeur d'abord (sur chant, SR2 sur la table : la pièce
   encore épaisse est plus stable), puis mise à épaisseur (à plat, SR1 sur la table), puis contrôle au pied à coulisse, au dixième.
   Trois scénarios : une pièce (largeur → épaisseur → contrôle) ; une série de 3 pièces (largeur en série → épaisseur en série →
   contrôle : la cote se règle sur la pièce la plus forte, jamais de pièces de dimensions différentes de front) ; contrôle d'un lot
   (pièce cintrée non dégauchie à renvoyer, fil incliné à lire). */
import { st } from './state.js';
import { pieces, newPiece, clearPieces, measure, onMachine, entryPieces, sr1, sr2, fmt } from './piece.js';
import * as C from '../../engine/corroyage.js';

const lot={};                                   // pièces du mode, par rôle
const near=(v,t,e)=>Math.abs(v-t)<=e+1e-9;
/* mesure au pied à coulisse : au dixième de millimètre */
const cal=v=>Math.round(v*10)/10;
const T=k=>lot[k]?measure(lot[k]):null;
const all=()=>Object.values(lot).filter(q=>q.kind!=='retour');
/* la face du dessus a été rabotée sur toute sa longueur, parallèle à la face posée */
const planedF=q=>!!q&&(q.face.F1.full||q.face.F2.full)&&measure(q).parT<=0.05;
const planedC=q=>!!q&&(q.face.C1.full||q.face.C2.full)&&measure(q).parW<=0.05;
const atW=(q,w)=>planedC(q)&&near(cal(measure(q).W),w,0.1);
const atT=(q,t)=>planedF(q)&&near(cal(measure(q).T),t,0.1);
const onTableDown=(q,f)=>!!q&&q.state==='entry'&&C.faces(q).down===f;
const entryOn=(ref)=>{ const E=entryPieces().filter(q=>Object.values(lot).includes(q)); return E.length>0&&E.every(q=>C.faces(q).down===ref(q)); };
const running=['Moteur puis avance en marche',()=>st.motor&&st.feed];
const passOk=(h)=>{ const d=h-st.H; return d>=1-1e-6&&d<=5+1e-6; };
const maxOf=(f)=>Math.max(...all().map(q=>measure(q)[f]));
const minOf=(f)=>Math.min(...all().map(q=>measure(q)[f]));

/* ---------- étapes communes ---------- */
const prep=(c)=>({k:'Préparation', t:'Préparer la machine', c,
  checks:[['Aspiration en marche',()=>st.asp],['Capot fermé',()=>!st.capot],['Vitesse d\'avance de 8 à 12 m/min (bois dur)',()=>st.v>=8&&st.v<=12]],
  done:s=>s.checks.every(c=>c[1]())});
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Le travail est fini : mettez les pièces de côté (« Mettre de côté »), arrêtez l\'avance, puis le moteur. Ne vous éloignez qu\'à l\'arrêt complet de l\'arbre ; nettoyez à l\'aspirateur, jamais à la soufflette.',
  checks:[['Aucune pièce sur la machine',()=>!onMachine().length],['Avance arrêtée',()=>!st.feed],['Moteur arrêté',()=>!st.motor]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler au pied à coulisse', c, checks:[], results, done:()=>false});
/* réglages de la largeur et de l'épaisseur, pour une pièce ou une série */
const regLar=(c,serie)=>({k:'Réglage largeur', t:'Poser sur chant, SR2 sur la table', c,
  checks:[['Pièce sur chant, SR2 (repère en V) sur la table',()=>entryOn(sr2)],
    [serie?'Cote : passe de 1 à 5 mm sur la pièce la plus large':'Cote : passe de 1 à 5 mm',()=>passOk(maxOf('Wmax'))],
    ...(serie?[['Cote plus petite que la largeur mini de chaque pièce (chants rabotés partout)',()=>st.H<=minOf('W')-0.05]]:[]),running],
  done:s=>s.checks.every(c=>c[1]())});
const regEp=(c,serie)=>({k:'Réglage épaisseur', t:'Poser à plat, SR1 sur la table', c,
  checks:[['Pièce à plat, SR1 (boucle) sur la table',()=>entryOn(sr1)],
    [serie?'Cote : passe de 1 à 5 mm sur la pièce la plus épaisse':'Cote : passe de 1 à 5 mm',()=>passOk(maxOf('Tmax'))],
    ...(serie?[['Cote plus petite que l\'épaisseur mini de chaque pièce (faces rabotées partout)',()=>st.H<=minOf('T')-0.05]]:[]),running],
  done:s=>s.checks.every(c=>c[1]())});

/* ---------- contrôle final : au pied à coulisse, au dixième de millimètre ---------- */
const yes=(ok,a='oui',b='non')=>ok?a:b;
const pc=(v,t)=>[fmt(cal(v))+' mm', near(cal(v),t,0.1)];
const nOk=(list,f)=>list.filter(f).length;
function rows(mode){ const r=[];
  if(mode==='piece'){ const a=T('a'); if(!a) return {msg:'Pièce introuvable.'}; const ang=lot.a.face.C2.angle?.deg, par=Math.max(a.parT,a.parW);
    r.push(['Largeur 70 ± 0,1 mm',...pc(a.W,70)],['Épaisseur 27 ± 0,1 mm',...pc(a.T,27)],
      ['Faces rabotées parallèles à SR1 et SR2 (0,1 mm max.)',fmt(cal(par))+' mm',cal(par)<=0.1&&planedC(lot.a)&&planedF(lot.a)],
      ['Équerre SR1 / chant raboté (90 ± 0,2°)',ang==null?'—':fmt(ang)+'°',ang!=null&&near(ang,90,0.2)],
      ['Repères SR1 et SR2 conservés',yes(a.s1&&a.s2,'oui','effacés'),!!(a.s1&&a.s2)],['Arrachements',yes(a.tear,'oui','aucun'),!a.tear]); }
  if(mode==='serie'){ const L=['a','b','c'].map(k=>lot[k]); if(L.some(q=>!q)) return {msg:'Pièces introuvables.'}; const M=L.map(measure);
    const nW=nOk(M,m=>near(cal(m.W),70,0.1)), nT=nOk(M,m=>near(cal(m.T),27,0.1)), par=Math.max(...M.map(m=>Math.max(m.parT,m.parW)));
    const marks=M.every(m=>m.s1&&m.s2), tear=M.some(m=>m.tear);
    r.push(['Largeur 70 ± 0,1 mm',`${nW} / 3`,nW===3],['Épaisseur 27 ± 0,1 mm',`${nT} / 3`,nT===3],
      ['Faces rabotées parallèles (0,1 mm max.)',fmt(cal(par))+' mm',cal(par)<=0.1&&L.every(q=>planedC(q)&&planedF(q))],
      ['Repères SR1 et SR2 conservés',yes(marks,'oui','effacés'),marks],['Arrachements',yes(tear,'oui','aucun'),!tear]); }
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
  piece:[['a',{name:'Traverse',L:700,W:78,T:31,wood:'chene',seed:21,dress:DR,k:2}]],
  serie:[['a',{name:'Montant 1',L:900,W:76,T:33,wood:'hetre',seed:5,dress:DR,k:2}],['b',{name:'Montant 2',L:900,W:76.6,T:33.7,wood:'hetre',seed:6,dress:DR,k:2,state:'stock'}],
    ['c',{name:'Montant 3',L:900,W:75.8,T:33.4,wood:'hetre',seed:7,dress:DR,k:2,state:'stock'}]],
  controle:[['a',{name:'Frêne',L:800,W:96,T:27.2,lar:90,wood:'frene',seed:13,sT:0.12,dress:DR,k:2,flip:true}],['b',{name:'Chêne',L:800,W:110,T:30,wood:'chene',bow:3,seed:9,state:'stock'}]],
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([m,list])=>[m,()=>{ clearPieces(); for(const k in lot) delete lot[k];
  Object.assign(st,{motor:false,feed:false,asp:false,capot:false,H:45,v:16});
  for(const [k,spec] of list) lot[k]=newPiece(spec); }]));

/* ---------- étapes de chaque mode ---------- */
export const STEPS={
  piece:[
    prep('Traverse de chêne sortie de la dégauchisseuse (SR1 et SR2 dressés, repérés au crayon), 700 mm de long, environ 77 × 30 mm. Objectif : 70,0 × 27,0 mm. On fait la largeur d\'abord (la pièce encore épaisse est plus stable sur chant), puis l\'épaisseur, puis le contrôle au pied à coulisse. Avant tout : EPI (protection auditive, lunettes, pas de vêtements flottants ni de bijoux), aspiration en marche, capot fermé, vitesse d\'avance réglée pour du bois dur.'),
    regLar('Posez la pièce sur chant : le chant de référence SR2 (repère en V) sur la table, le chant à raboter dessus. Mesurez la largeur maxi au pied à coulisse et réglez la cote pour une passe de 1 à 5 mm. Démarrez le moteur, attendez qu\'il ait pris sa vitesse, puis l\'avance.'),
    {k:'Largeur', t:'Mettre la traverse à 70,0 mm de largeur',
      c:'Engagez la pièce et lâchez-la dès que le rouleau d\'entrée l\'entraîne ; l\'aide en sortie la repose sur le capot. « Ramener la pièce » (toujours SR2 sur la table), montez la table de 1 à 5 mm à chaque passe. Dernière passe de 1 mm au plus, à la cote 70,0.',
      checks:[['Chant raboté sur toute la longueur, parallèle à SR2',()=>planedC(lot.a)],['Largeur 70,0 mm au pied à coulisse',()=>atW(lot.a,70)],['Aucun arrachement',()=>!T('a').tear]],
      done:s=>s.checks.every(c=>c[1]())},
    regEp('« Ramener la pièce », puis posez-la à plat : SR1 (la boucle) sur la table, la face à raboter dessus. Mesurez l\'épaisseur maxi et réglez la cote pour une passe de 1 à 5 mm.'),
    {k:'Épaisseur', t:'Mettre la traverse à 27,0 mm d\'épaisseur',
      c:'Passez la pièce, ramenez-la, montez la table à chaque passe. Dernière passe de 1 mm au plus, à la cote 27,0.',
      checks:[['Face rabotée sur toute la longueur, parallèle à SR1',()=>planedF(lot.a)],['Épaisseur 27,0 mm au pied à coulisse',()=>atT(lot.a,27)],['Aucun arrachement',()=>!T('a').tear]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez au pied à coulisse (au dixième) : 70 × 27 ± 0,1 mm, faces rabotées parallèles à SR1 et SR2, d\'équerre, repères conservés, sans arrachement.',()=>rows('piece'))],
  serie:[
    prep('Série de 3 montants de hêtre sortis de la dégauchisseuse (SR1 et SR2 dressés, repérés), 900 mm de long, environ 75 × 32 mm, de dimensions un peu différentes. Objectif : les trois à 70,0 × 27,0 mm. Largeur en série, puis épaisseur en série, puis contrôle. Avant tout : EPI, aspiration en marche, capot fermé, vitesse d\'avance réglée pour du bois dur.'),
    regLar('Posez le premier montant sur chant, SR2 sur la table. Mesurez les trois montants (« Pièces débitées », pied à coulisse) : la cote se règle sur la pièce la plus large, pour une passe de 1 à 5 mm, et assez bas pour que les trois soient rabotées partout. Moteur puis avance.',true),
    {k:'Largeur série', t:'Mettre les trois montants à 70,0 mm de largeur',
      c:'Première passe : les montants n\'ont pas la même largeur, passez-les l\'un après l\'autre (« Reprendre », SR2 sur la table), jamais de front. Ensuite ils ont la même largeur : ramenez-les du capot et passez-les côte à côte. Montez la table de 1 à 5 mm à chaque passe ; dernière passe de 1 mm au plus, à la cote 70,0.',
      checks:[['Montant 1 à 70,0 mm',()=>atW(lot.a,70)],['Montant 2 à 70,0 mm',()=>atW(lot.b,70)],['Montant 3 à 70,0 mm',()=>atW(lot.c,70)]],
      done:s=>s.checks.every(c=>c[1]())},
    regEp('Ramenez les montants un par un et posez-les à plat, SR1 sur la table. Leurs épaisseurs sont différentes : la cote se règle sur le plus épais, pour une passe de 1 à 5 mm, et assez bas pour que les trois soient rabotés partout.',true),
    {k:'Épaisseur série', t:'Mettre les trois montants à 27,0 mm d\'épaisseur',
      c:'Première passe l\'une après l\'autre (épaisseurs différentes), puis côte à côte quand ils ont la même épaisseur. Montez la table de 1 à 5 mm à chaque passe ; dernière passe de 1 mm au plus, à la cote 27,0.',
      checks:[['Montant 1 à 27,0 mm',()=>atT(lot.a,27)],['Montant 2 à 27,0 mm',()=>atT(lot.b,27)],['Montant 3 à 27,0 mm',()=>atT(lot.c,27)],['Aucun arrachement',()=>all().every(q=>!measure(q).tear)]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez les trois montants au pied à coulisse (au dixième) : 70 × 27 ± 0,1 mm, faces rabotées parallèles, repères conservés, sans arrachement.',()=>rows('serie'))],
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
  {mode:'piece', view:'vop', t:'Rabotage d\'une pièce', intro:'Rabotage d\'une traverse de chêne dégauchie : mise à largeur sur chant (SR2 sur la table), puis mise à épaisseur à plat (SR1 sur la table), puis contrôle au pied à coulisse.'},
  {mode:'serie', view:'vop', t:'Rabotage d\'une série', intro:'Rabotage d\'une série de 3 montants : largeur en série, puis épaisseur en série, jamais de pièces de dimensions différentes de front, puis contrôle.'},
  {mode:'controle', view:'vop', t:'Contrôle du lot et fil', intro:'Contrôle d\'un lot avant rabotage (une pièce n\'a pas été dégauchie) et mise à épaisseur d\'un frêne au fil incliné, sans arrachement.'},
];
export function scenCriteria(m, {dangers, ok}){ const nb=`${dangers}`, sec=['Aucune faute grave',nb,ok];
  const R=rows(m); if(!R.rows) return [['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],sec];
  const r=R.rows;
  if(m==='piece') return [r[0],r[1],r[2],['Équerre, repères conservés, sans arrachement',`${r[3][1]} / ${r[4][1]} / ${r[5][1]}`,r[3][2]&&r[4][2]&&r[5][2]],sec];
  if(m==='serie') return [r[0],r[1],r[2],['Repères conservés, sans arrachement',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec];
  return [r[0],r[1],r[2],r[3],sec]; }
