/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Scénarios guidés de la toupie (lot 1 : travail au guide). Les pièces arrivent corroyées (dégauchisseuse puis raboteuse :
   SR1 et SR2 dressés et repérés, largeur et épaisseur faites), posées comme elles sortent de la raboteuse (SR1 sur la table).
   1. Quart de rond R 10 sur l'arête SR1 / chant opposé à SR2 (rive en partie usinée : demi-guides alignés).
   2. Feuillure 12 × 15 en deux passes, côté contre-parement (outil en partie sous la table, bague de table, hauteur, saillie).
   3. Série de baguettes moulurées sur toute la rive (demi-guide de sortie avancé), machine préparée par un autre groupe
      (vitesse trop haute pour l'outil) et lot contenant une pièce trop courte pour le travail au guide.
   Barème du parcours : 5 critères de 4 points dont « aucune faute grave ». */
import { st, saillie, ctx } from './state.js';
import { RPMS, RING_WIDE, JEU_MIN, JEU_OK, PRESS_DOWN } from './constants.js';
import { toolById, speedCheck } from './tools.js';
import { pieces, newPiece, clearPieces, onMachine, profileStats, measure, appui, haut, fmt, predict } from './piece.js';
import { jeu, ringContact, ringJeu } from './rules.js';
import { closeLamelles, lamStatus } from './guide.js';
import * as C from '../../engine/corroyage.js';

const lot={};
const near=(v,t,e)=>Math.abs(v-t)<=e+1e-9;
const yes=(ok,a='oui',b='non')=>ok?a:b;
const toolIs=id=>st.tool===id&&!st.flip;
const speedOk=()=>!!st.tool && speedCheck(toolById(st.tool),st.rpm).ok;
const ringOk=()=>!!st.tool && !ringContact() && ringJeu()<=RING_WIDE;
const jeuOk=()=>{ const j=jeu(), L=lamStatus(); return L.set && !L.contact && !L.loose && j>=JEU_MIN && j<=JEU_OK; };
const orientOk=(q,dn,back)=>!!q && q.state==='entry' && C.faces(q).down===dn && C.faces(q).back===back;
const pressOk=q=>{ if(!q||q.state!=='entry'||!st.prot) return false; const H=haut(q), A=appui(q); return st.hv<=H-0.5+1e-6 && st.hv>=H-PRESS_DOWN && st.dh<=A-0.5+1e-6 && st.dh>=A-PRESS_DOWN; };
/* profil présent sur toute la longueur de la face f */
const fullLen=(q,f)=>{ const c=C.cutOf(q,f); return !!c && c.d.every(r=>Math.max(...r)>0.05); };
/* avance du demi-guide de sortie nécessaire pour la pièce q posée face dn sur la table, face back contre le guide */
function needE(q,dn,back){ const r={...C.makePiece(C.pieceJSON(q)), log:[]}; for(let k=0;k<4;k++) for(const fl of [false,true]){ r.k=k; r.flip=fl; const f=C.faces(r); if(f.down===dn&&f.back===back) return predict(r).eNeed; } return 0; }

/* ---------- étapes communes ---------- */
const prep=c=>({k:'Préparation', t:'Préparer le poste', c, checks:[['Aspiration en marche',()=>st.asp]], done:s=>s.checks.every(c=>c[1]())});
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Le travail est fini : mettez les pièces de côté (« Mettre de côté »), arrêtez le moteur (O). Ne quittez le poste qu\'à l\'arrêt complet de l\'arbre ; démontez et rangez l\'outil machine consignée, nettoyez à l\'aspirateur, jamais à la soufflette.',
  checks:[['Aucune pièce sur la machine',()=>!onMachine().length],['Moteur arrêté',()=>!st.motor],['Arbre arrêté (frein)',()=>!!ctx.model&&ctx.model.spin<0.03]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler le profil', c, checks:[], results, done:()=>false});
const mount=(id,name)=>({k:'Outil', t:`Monter ${name}`,
  c:`Arbre arrêté : consignez la machine (interrupteur général sur 0, puis cadenas), verrouillez l'arbre, démontez l'outil en place et montez ${name}, flèche ↺ dessus (sens de rotation de la machine). Déverrouillez l'arbre, faites tourner l'outil à la main (rien ne doit toucher), puis déconsignez.`,
  checks:[[`${name[0].toUpperCase()+name.slice(1)} montée, flèche ↺ dessus`,()=>toolIs(id)],['Arbre déverrouillé',()=>!st.lock],['Machine déconsignée, interrupteur général sur I',()=>!st.cad&&st.main]],
  done:s=>s.checks.every(c=>c[1]())});
const pieceStep=(c,dn,back,what)=>({k:'Pièce', t:'Poser la pièce, régler les presseurs', c,
  checks:[[what,()=>orientOk(lot.a,dn,back)],['Presseurs réglés sur la pièce (0,5 à 6 mm sous ses dimensions)',()=>pressOk(lot.a)],['Poussoir en main pour la fin de passe',()=>st.push]],
  done:s=>s.checks.every(c=>c[1]())});

/* ---------- contrôle ---------- */
function rows(mode){ const r=[];
  if(mode==='quart'){ const q=lot.a; if(!q) return {msg:'Pièce introuvable.'}; const s=profileStats(q,'C2','lo'), m=measure(q);
    if(!s) return {rows:[['Hauteur du quart de rond 10 ± 0,5 mm','—',false],['Profondeur 10 ± 0,5 mm','—',false],['Régulier sur toute la longueur (0,2 mm max.)','—',false],['Arête SR1 / chant opposé à SR2 seulement','non usinée',false],['Arrachements','—',false],['Repères SR1 et SR2 conservés',yes(m.s1&&m.s2,'oui','effacés'),!!(m.s1&&m.s2)]]};
    const only=q.cuts.length===1 && s.from<0.5;
    r.push(['Hauteur du quart de rond 10 ± 0,5 mm',fmt(s.height)+' mm',near(s.height,10,0.5)],['Profondeur 10 ± 0,5 mm',fmt(s.edge)+' mm',near(s.edge,10,0.5)],
      ['Régulier sur toute la longueur (0,2 mm max.)',fmt(s.reg)+' mm',s.reg<=0.2+1e-9&&fullLen(q,'C2')],['Arête SR1 / chant opposé à SR2 seulement',yes(only),only],
      ['Arrachements',yes(s.tear,'oui','aucun'),!s.tear],['Repères SR1 et SR2 conservés',yes(m.s1&&m.s2,'oui','effacés'),!!(m.s1&&m.s2)]); }
  if(mode==='feuillure'){ const q=lot.a; if(!q) return {msg:'Pièce introuvable.'}; const s=profileStats(q,'C2','hi');
    const passes=q.log.filter(l=>l.cut&&l.f==='C2'), maxPass=passes.length? Math.max(...passes.map(l=>l.depth)) : 0;
    if(!s) return {rows:[['Hauteur de la feuillure 12 ± 0,5 mm','—',false],['Profondeur 15 ± 0,5 mm','—',false],['Régulière sur toute la longueur (0,2 mm max.)','—',false],['Côté contre-parement, chant opposé à SR2','non usinée',false],['Deux passes au moins, 10 mm au plus par passe','—',false],['Arrachements','—',false]]};
    const only=q.cuts.length===1 && s.to>=s.ext-0.5;
    r.push(['Hauteur de la feuillure 12 ± 0,5 mm',fmt(s.height)+' mm',near(s.height,12,0.5)],['Profondeur 15 ± 0,5 mm',fmt(s.edge)+' mm',near(s.edge,15,0.5)],
      ['Régulière sur toute la longueur (0,2 mm max.)',fmt(s.reg)+' mm',s.reg<=0.2+1e-9&&fullLen(q,'C2')],['Côté contre-parement, chant opposé à SR2',yes(only),only],
      ['Deux passes au moins, 10 mm au plus par passe',`${passes.length} passe${passes.length>1?'s':''}, ${fmt(maxPass)} mm`,passes.length>=2&&maxPass<=10+1e-6],['Arrachements',yes(s.tear,'oui','aucun'),!s.tear]); }
  if(mode==='serie'){ const B=['a','b','c'].map(k=>lot[k]); if(B.some(q=>!q)) return {msg:'Pièces introuvables.'};
    const S=B.map(q=>profileStats(q,'C2','lo'));
    const nP=S.filter(s=>s&&near(s.edge,10,0.5)&&s.full).length, nR=B.filter((q,i)=>S[i]&&S[i].reg<=0.2+1e-9&&fullLen(q,'C2')).length;
    const c=lot.d, courte= c.state==='stock' && c.kind==='interdite' && !(c.cuts||[]).length;
    const logs=pieces.flatMap(q=>q.log||[]).filter(l=>l.cut), nmax=toolById('moulure').nmax, vOk=logs.length>0&&logs.every(l=>l.rpm<=toolById(l.tool).nmax);
    const tear=S.some(s=>s&&s.tear);
    r.push(['Profil conforme (10 ± 0,5 mm, toute la rive)',`${nP} / 3`,nP===3],['Régulier sur toute la longueur, sans entaille en bout',`${nR} / 3`,nR===3],
      ['Pièce de 220 mm mise à part, non usinée',yes(courte,'oui',(c.cuts||[]).length?'usinée':'non classée'),courte],
      [`Vitesse ≤ n max à chaque passe (Ø 160 : ${nmax.toLocaleString('fr-FR')} tr/min au plus)`,yes(vOk,'oui',logs.length?'non':'aucune passe'),vOk],['Arrachements',yes(tear,'oui','aucun'),!tear]); }
  return {rows:r}; }

/* ---------- pièces de départ (corroyées, telles qu'elles sortent de la raboteuse : SR1 sur la table) ---------- */
const DR={s1:'F1',s2:'C1'};
const PIECES={
  libre:[['a',{name:'Avivé',L:1000,W:72,T:29,lar:70,ep:27,wood:'sapin',seed:31,dress:DR}],['b',{name:'Cale',L:220,W:72,T:29,lar:70,ep:27,wood:'sapin',seed:33,dress:DR,state:'stock'}],
    ['c',{name:'Frêne',L:800,W:62,T:24,lar:60,ep:22,wood:'frene',seed:13,sW:0.12,dress:DR,state:'stock'}]],
  quart:[['a',{name:'Traverse',L:700,W:72,T:29.5,lar:70,ep:27,wood:'chene',seed:21,dress:DR}]],
  feuillure:[['a',{name:'Montant',L:900,W:47,T:29,lar:45,ep:27,wood:'sapin',seed:5,dress:DR}]],
  serie:[['a',{name:'Baguette 1',L:800,W:42,T:22,lar:40,ep:20,wood:'hetre',seed:5,dress:DR}],['b',{name:'Baguette 2',L:800,W:42,T:22,lar:40,ep:20,wood:'hetre',seed:6,dress:DR,state:'stock'}],
    ['c',{name:'Baguette 3',L:800,W:42,T:22,lar:40,ep:20,wood:'hetre',seed:7,dress:DR,state:'stock'}],['d',{name:'Baguette courte',L:220,W:42,T:22,lar:40,ep:20,wood:'hetre',seed:8,dress:DR,state:'stock'}]],
};
/* réglages de départ de la machine (ce qu'un groupe précédent a laissé) */
const BASE={ main:true, cad:false, au:false, motor:false, asp:false, dir:1, lock:false, hlock:true, flip:false, prot:true, push:false, lam:null };
const MACH={
  libre:    { tool:'quart', rpm:9000, h:0, ring:160, zIn:52.5, e:0, open:74, hv:24, dh:66 },
  quart:    { tool:'droit', rpm:6000, h:10, ring:320, zIn:60, e:0, open:180, hv:60, dh:120 },
  feuillure:{ tool:'chanfrein', rpm:9000, h:5, ring:200, zIn:58, e:0, open:160, hv:50, dh:100 },
  serie:    { tool:'moulure', rpm:9000, h:0, ring:320, zIn:74, e:0, open:120, hv:40, dh:80 },
};
export const LOADERS=Object.fromEntries(Object.entries(PIECES).map(([m,list])=>[m,()=>{ clearPieces(); for(const k in lot) delete lot[k];
  Object.assign(st,BASE,MACH[m]); st.entr={ placed:false, on:false, y:0, z:0, angle:5, v:8, H:0 };
  if(m==='libre') closeLamelles();
  for(const [k,spec] of list) lot[k]=newPiece(spec); }]));

/* ---------- étapes de chaque mode ---------- */
export const STEPS={
  quart:[
    prep('Traverse de chêne corroyée (700 × 70 × 27, SR1 et SR2 repérés) : quart de rond de 10 mm sur l\'arête entre SR1 (parement) et le chant opposé à SR2. Avant tout : EPI (protection auditive, lunettes, pas de vêtements flottants ni de bijoux, pas de gants près de l\'outil), poste dégagé, aspiration en marche.'),
    mount('quart','la fraise à quart de rond R 10'),
    {k:'Réglages', t:'Vitesse, bague de table, hauteur',
      c:'Lisez le marquage de l\'outil (Ø 125, n max 10 000) : vitesse de coupe Vc = π × D × n / 60 000 entre 40 et 70 m/s, jamais plus que n max. Réduisez la lumière de table (bague la plus petite qui laisse passer l\'outil). Hauteur : bas du tranchant au ras de la table (0 mm, réglage toujours en montant), puis bloquez la hauteur. Inverseur sur ↺.',
      checks:[['Vitesse adaptée à l\'outil (n max, Vc de 40 à 70 m/s)',speedOk],['Lumière de table réduite (bague adaptée)',ringOk],['Hauteur 0 mm : outil au ras de la table',()=>near(st.h,0,0.2)],['Hauteur bloquée',()=>st.hlock],['Inverseur sur ↺ (anti-horaire)',()=>st.dir===1]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Guide', t:'Saillie, demi-guides, lamelles',
      c:'Saillie de 10 mm : la lèvre droite de la fraise au ras de la face du guide (pied de profondeur). Le quart de rond n\'usine pas toute la rive : demi-guides alignés (0 mm). Puis « Fermer les lamelles » : la lumière du guide se ferme au-dessus et au-dessous de l\'outil, sans le toucher.',
      checks:[['Saillie 10 mm (± 0,2)',()=>near(saillie(),10,0.2)],['Demi-guides alignés (rive en partie usinée)',()=>near(st.e,0,0.1)],['Lamelles fermées autour de l\'outil (au-dessus et au-dessous, sans contact)',jeuOk]],
      done:s=>s.checks.every(c=>c[1]())},
    pieceStep('Outil sous la pièce : SR1 (parement, la boucle) sur la table, le chant opposé à SR2 contre le guide (« Bout pour bout »). Réglez le presseur vertical et le presseur horizontal sur la pièce (0,5 à 6 mm sous sa hauteur et sa largeur). Prenez le poussoir.','F1','C2','SR1 sur la table, chant opposé à SR2 contre le guide'),
    {k:'Usinage', t:'Usiner le quart de rond',
      c:'Démarrez (I), attendez que l\'arbre ait pris sa vitesse, « Passer la pièce » : poussée régulière de droite à gauche, mains à droite de l\'outil, fin de passe au poussoir, jamais de retour en arrière.',
      checks:[['Quart de rond usiné sur toute la longueur',()=>fullLen(lot.a,'C2')]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez le quart de rond (gabarit de rayon) : 10 mm de haut et de profondeur, régulier sur toute la longueur, sur la bonne arête, sans arrachement, repères conservés.',()=>rows('quart'))],
  feuillure:[
    prep('Montant de sapin corroyé (900 × 45 × 27, SR1 et SR2 repérés) : feuillure de 12 mm de haut (sur le chant) et 15 mm de profondeur, côté contre-parement, sur le chant opposé à SR2. 15 mm en une passe, c\'est trop : deux passes. Avant tout : EPI, poste dégagé, aspiration en marche.'),
    mount('droit','le porte-outil droit'),
    {k:'Réglages', t:'Vitesse, bague de table, hauteur',
      c:'Ø 125, n max 9 000 : choisissez la vitesse. L\'outil (50 mm de haut) descend en partie sous la table : la bague doit laisser passer l\'outil, avec le moins de lumière possible. Hauteur : le haut du tranchant à 12 mm au-dessus de la table, donc le bas à 12 − 50 = −38 mm. Bloquez la hauteur, inverseur sur ↺.',
      checks:[['Vitesse adaptée à l\'outil (n max, Vc de 40 à 70 m/s)',speedOk],['Bague de table : l\'outil passe, lumière réduite',ringOk],['Haut du tranchant à 12 mm (bas à −38 mm)',()=>near(st.h,-38,0.2)],['Hauteur bloquée',()=>st.hlock],['Inverseur sur ↺ (anti-horaire)',()=>st.dir===1]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Guide', t:'Première passe : saillie de 5 à 10 mm',
      c:'Première passe : saillie de 5 à 10 mm (10 mm au plus par passe). La feuillure n\'usine pas toute la rive : demi-guides alignés. Puis « Fermer les lamelles ».',
      checks:[['Saillie de 5 à 10 mm',()=>saillie()>=5-1e-6&&saillie()<=10+1e-6],['Demi-guides alignés (rive en partie usinée)',()=>near(st.e,0,0.1)],['Lamelles fermées autour de l\'outil (au-dessus et au-dessous, sans contact)',jeuOk]],
      done:s=>s.checks.every(c=>c[1]())},
    pieceStep('Feuillure côté contre-parement, outil sous la pièce : SR1 (la boucle) dessus, le contre-parement sur la table, le chant opposé à SR2 contre le guide (« Retourner »). Presseurs réglés sur la pièce, poussoir en main.','F2','C2','SR1 dessus, chant opposé à SR2 contre le guide'),
    {k:'Passes', t:'Usiner la feuillure en deux passes',
      c:'Démarrez, passez la pièce (première passe). Arrêtez le moteur, attendez l\'arrêt de l\'arbre, reculez le guide jusqu\'à la saillie de 15 mm et refermez les lamelles, « Ramener la pièce », redémarrez et repassez.',
      checks:[['Première passe faite',()=>lot.a.log.filter(l=>l.cut).length>=1],['Feuillure à 15 mm de profondeur sur toute la longueur',()=>{ const s=profileStats(lot.a,'C2','hi'); return !!s&&near(s.edge,15,0.5)&&fullLen(lot.a,'C2'); }]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez la feuillure (réglet, pied à coulisse) : 12 mm de haut, 15 mm de profondeur, régulière, côté contre-parement, en deux passes, sans arrachement.',()=>rows('feuillure'))],
  serie:[
    prep('Série de trois baguettes de hêtre corroyées (800 × 40 × 20) à moulurer sur toute la rive (doucine), sur le chant opposé à SR2, côté SR1. La machine a été préparée par un autre groupe : vous vérifiez tout avant de démarrer. Avant tout : EPI, poste dégagé, aspiration en marche.'),
    {k:'Machine', t:'Contrôler la machine préparée',
      c:'Arbre arrêté, vérifiez tout ce qu\'un autre a réglé : l\'outil (flèche ↺ dessus, marquage : Ø et n max), l\'inverseur, la vitesse (Vc de 40 à 70 m/s, jamais plus que n max), la bague de table, la hauteur (outil au ras de la table, bloquée).',
      checks:[['Porte-outil à moulurer monté, flèche ↺ dessus',()=>toolIs('moulure')],['Inverseur sur ↺ (anti-horaire)',()=>st.dir===1],['Vitesse adaptée à l\'outil (n max, Vc de 40 à 70 m/s)',speedOk],['Lumière de table réduite (bague adaptée)',ringOk],['Hauteur 0 mm, bloquée',()=>near(st.h,0,0.2)&&st.hlock]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Lot', t:'Contrôler le lot',
      c:'Regardez chaque pièce du lot (« Pièces débitées », ou cliquez-la). Une pièce trop courte pour le travail au guide (moins de 300 mm) ne doit pas passer : mettez-la à part, « Interdite au guide » (elle irait au serre-pièces ou serait recoupée dans une pièce plus longue).',
      checks:[['Pièce trop courte mise à part, « Interdite au guide »',()=>lot.d.state==='stock'&&lot.d.kind==='interdite']],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Guide', t:'Saillie, demi-guide de sortie, lamelles',
      c:'Saillie de 10 mm. Ici toute la rive est usinée : la face usinée recule, le demi-guide de sortie doit être avancé de la profondeur usinée sur la partie qui touche le guide (lisez-la sur le profil). Puis « Fermer les lamelles » (toujours après le réglage de la saillie).',
      checks:[['Saillie 10 mm (± 0,2)',()=>near(saillie(),10,0.2)],['Toute la rive usinée : demi-guide de sortie avancé (± 0,2 mm)',()=>{ const n=needE(lot.a,'F1','C2'); return n>0.3&&near(st.e,n,0.2); }],['Lamelles fermées autour de l\'outil (au-dessus et au-dessous, sans contact)',jeuOk]],
      done:s=>s.checks.every(c=>c[1]())},
    pieceStep('SR1 sur la table, le chant opposé à SR2 contre le guide (« Bout pour bout »). Presseurs réglés sur la pièce, poussoir en main.','F1','C2','SR1 sur la table, chant opposé à SR2 contre le guide'),
    {k:'Série', t:'Moulurer les trois baguettes',
      c:'Démarrez, passez la baguette 1, mettez-la de côté ; « Reprendre » la baguette 2, posez-la de la même façon, passez-la ; puis la baguette 3. Mêmes réglages pour toute la série.',
      checks:[['Baguette 1 moulurée',()=>fullLen(lot.a,'C2')],['Baguette 2 moulurée',()=>fullLen(lot.b,'C2')],['Baguette 3 moulurée',()=>fullLen(lot.c,'C2')]],
      done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Contrôlez la série : profil conforme et régulier sur les trois baguettes (pas d\'entaille en bout), pièce courte mise à part, vitesse adaptée à l\'outil, sans arrachement.',()=>rows('serie'))],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'quart', view:'vop', t:'Quart de rond', intro:'Quart de rond de 10 mm sur une traverse corroyée : montage de l\'outil machine consignée, vitesse, hauteur, saillie, demi-guides alignés, presseurs, puis contrôle du profil.'},
  {mode:'feuillure', view:'vop', t:'Feuillure en deux passes', intro:'Feuillure de 12 × 15 mm sur un montant corroyé, outil en partie sous la table, en deux passes, puis contrôle.'},
  {mode:'serie', view:'vop', t:'Série et machine à contrôler', intro:'Série de trois baguettes moulurées sur toute la rive. La machine a été préparée par un autre groupe et le lot contient une pièce à ne pas usiner au guide : vérifiez tout.'},
];
export function scenCriteria(m,{dangers,ok}){ const sec=['Aucune faute grave',`${dangers}`,ok];
  const R=rows(m); if(!R.rows) return [['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],['Pièce','—',false],sec];
  const r=R.rows;
  if(m==='quart') return [r[0],r[1],['Régulier, sans arrachement',`${r[2][1]} / ${r[4][1]}`,r[2][2]&&r[4][2]],['Bonne arête, repères conservés',`${r[3][1]} / ${r[5][1]}`,r[3][2]&&r[5][2]],sec];
  if(m==='feuillure') return [r[0],r[1],['Régulière, sans arrachement',`${r[2][1]} / ${r[5][1]}`,r[2][2]&&r[5][2]],['Bon côté, en deux passes',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec];
  return [r[0],r[1],r[2],['Vitesse adaptée, sans arrachement',`${r[3][1]} / ${r[4][1]}`,r[3][2]&&r[4][2]],sec]; }
export { RPMS };
