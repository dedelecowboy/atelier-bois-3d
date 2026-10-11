/* Scénarios guidés de la déligneuse multilames.
   - Délignage d'avivés : avivé de 180 mm → 2 pièces de 85 mm au guide, en deux passes (manchon à 1 lame) ;
   - Délignage d'un plateau de plot : rives en flache, conique → guide escamoté, petit découvert dessus,
     gros bout en premier, positionnement au laser → avivé de 140 mm sans flache (manchon à 2 lames) ;
   - Multidélignage : avivé de 200 mm → 4 tasseaux de 45 mm en une passe (manchon à 4 lames), vitesse réduite. */
import { GREEN } from './constants.js';
import { st } from './state.js';
import { cut, cur, exitPieces, newPiece, clearPieces, againstGuide, faceStats, predict, measure, load } from './piece.js';
import { presOk, produced, goodOf, loadOk, fmt } from './rules.js';

/* ---------- pièces de départ ---------- */
const N=21;
/* plateau en flache : grande face A (largeur wBig au bout A → wSmall au bout B), petite face B en retrait de la flache */
function plateau({L,T,wood,wA0,wA1,wane,sweep,seed}){ const A=[],B=[];
  for(let i=0;i<N;i++){ const t=i/(N-1), x=t*Math.PI, c=sweep*Math.sin(x*1.3+seed), hb=(wA0+(wA1-wA0)*t)/2;
    const wl=wane+9*Math.sin(2.1*x+0.5+seed)+4*Math.sin(5.3*x), wr=wane-2+10*Math.sin(1.7*x+2+seed)+4*Math.sin(6.1*x+1);
    A.push([c-hb,c+hb]); B.push([c-hb+wl,c+hb-wr]); }
  return {kind:'plateau',L,T,wood,A,B}; }
const SPECS={
  libre:()=>({...plateau({L:2000,T:30,wood:'sapin',wA0:250,wA1:215,wane:20,sweep:5,seed:1.2}), zPos:-0.12}),
  avive:()=>({kind:'avive',L:2000,W:180,T:27,wood:'sapin',zPos:-0.02}),
  plot:()=>({...plateau({L:2200,T:41,wood:'chene',wA0:275,wA1:230,wane:22,sweep:6,seed:0}), flip:true, rev:true, zPos:-0.20}),
  multi:()=>({kind:'avive',L:2000,W:200,T:27,wood:'hetre',zPos:-0.03}),
};
/* réglages de la machine au chargement d'un mode (manchon resté de l'ouvrage précédent, presseurs trop hauts…) */
const SETUP={ libre:{man:'m2',gw:120,H:27,v:20,guideUp:false,laser:true},
  avive:{man:'m4',gw:120,H:60,v:24,guideUp:true,laser:false},
  plot:{man:'m1',gw:120,H:60,v:24,guideUp:true,laser:false},
  multi:{man:'m1',gw:80,H:60,v:24,guideUp:true,laser:false} };
export const LOADERS=Object.fromEntries(Object.keys(SPECS).map(k=>[k,()=>{ clearPieces(); cut.passes=0; cut.maxLoad=0; cut.lastMsg='';
  Object.assign(st,{motor:false,tapis:false,asp:false},SETUP[k]); newPiece(SPECS[k]()); }]));

/* ---------- étapes communes ---------- */
const loadIn=()=>{ const L=load(); return L>=GREEN[0]&&L<=GREEN[1]; };
const ampChk=['Ampèremètre (charge prévue) dans la zone verte, 40 à 90 %',loadIn];
const presChk=T=>[`Presseurs réglés pour ${T} mm (${T-4} à ${T-1} mm)`,()=>presOk(cur())];
const fin={k:'Fin', t:'Arrêter la machine',
  c:'Le débit est fini. Rangez les pièces sorties (« Mettre de côté ») : elles sont reprises côté sortie, jamais en passant les mains dans la machine. Arrêtez le tapis puis les lames, et attendez l\'arrêt complet avant de quitter le poste.',
  checks:[['Aucune pièce en cours de sciage',()=>!cut.inProgress],['Pièces de la sortie rangées (« Mettre de côté »)',()=>!exitPieces().length],['Tapis arrêté',()=>!st.tapis],['Lames arrêtées',()=>!st.motor]],
  done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler les pièces', c, checks:[], results, done:()=>false});
const man=(m,lbl)=>[`Manchon « ${lbl} » monté`,()=>st.man===m];

/* ---------- contrôle final ---------- */
const parLine=list=>{ const ok=list.length>0 && list.every(({m})=>m.sawn===2); return ['Rives sciées, parallèles', ok?'oui':'non', ok]; };
const ampLine=()=>['Ampèremètre : jamais en surcharge', `${cut.maxLoad} % max.`, cut.passes>0&&loadOk()];
function resAvive(){ const g=goodOf(85).slice(0,2); if(!produced().length) return {msg:'Aucune passe faite.'};
  return {rows:[...[0,1].map(i=>[`Pièce ${i+1} : 85 ± 0,5 mm`, g[i]?fmt(g[i].m.W)+' mm':'—', !!g[i]]), parLine(g),
    ['Sans flache', g.length&&g.every(({m})=>!m.flache)?'aucune':'—', g.length>0&&g.every(({m})=>!m.flache)], ampLine()]}; }
function bestPlot(){ return produced().filter(({m})=>m.W>100).sort((a,b)=>Math.abs(a.m.W-140)-Math.abs(b.m.W-140))[0]||null; }
function resPlot(){ const b=bestPlot(); if(!b) return {msg:'Aucun avivé de plus de 100 mm : reprenez le délignage.'};
  return {rows:[['Largeur 140 ± 0,5 mm',fmt(b.m.W)+' mm',Math.abs(b.m.W-140)<=0.5],['Flache',b.m.flache?'reste de la flache':'aucune',!b.m.flache],
    ['Deux rives sciées, parallèles',b.m.sawn+' / 2',b.m.sawn===2],ampLine()]}; }
function resMulti(){ const g=goodOf(45); if(!produced().length) return {msg:'Aucune passe faite.'};
  return {rows:[['Tasseaux de 45 ± 0,5 mm',`${Math.min(4,g.length)} / 4`,g.length>=4],parLine(g),['Une seule passe',String(cut.passes),cut.passes===1],ampLine()]}; }

/* ---------- étapes de chaque mode ---------- */
export const STEPS={
  avive:[
    {k:'Préparation', t:'Monter le manchon', c:'Avivé de sapin 2 000 × 180 × 27 mm (4 faces sciées). Fiche de débit : 2 pièces de 85 mm de large. Le manchon resté sur la machine porte 4 lames. Lames à l\'arrêt (la porte d\'accès aux lames est verrouillée tant que l\'arbre tourne), montez le manchon à 1 lame. Mettez l\'aspiration en marche.',
      checks:[man('m1','1 lame'),['Aspiration en marche',()=>st.asp]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Réglages', t:'Régler guide, presseurs et vitesse', c:'Guide en place à 85 mm : la première pièce sort entre le guide et la lame. Plaquez l\'avivé contre le guide (« Contre le guide »). Presseurs 1 à 4 mm sous l\'épaisseur (27 mm). Démarrez les lames, puis le tapis, et réglez la vitesse d\'avance pour que l\'aiguille de l\'ampèremètre (charge prévue) reste dans la zone verte : avec une seule lame dans du sapin, on peut avancer vite.',
      checks:[['Guide en place à 85 mm',()=>st.guideUp&&st.gw===85],['Avivé contre le guide',()=>!!cur()&&againstGuide(cur())],presChk(27),['Lames en marche',()=>st.motor],['Tapis en marche',()=>st.tapis],ampChk], done:s=>s.checks.every(c=>c[1]())},
    {k:'Passe 1', t:'Déligner la première pièce', c:'Tapis en marche, engagez la pièce, puis placez-vous sur le côté, hors de l\'axe : le tapis l\'entraîne, les presseurs la plaquent, les linguets empêchent tout rejet. Une pièce de 85 mm sort entre le guide et la lame, une autre de 91,8 mm à côté.',
      checks:[['Avivé contre le guide',()=>!!cur()&&againstGuide(cur())||goodOf(85).length>0]], done:()=>goodOf(85).length>=1},
    {k:'Passe 2', t:'Déligner la deuxième pièce', c:'À la sortie, gardez la pièce de 91,8 mm (contour orange ; cliquez-la si besoin). « Évacuer les chutes » range la pièce de 85 mm dans « Pièces débitées ». « Ramener la pièce » remet la pièce de 91,8 mm à l\'entrée : plaquez-la contre le guide, toujours à 85 mm, et engagez-la. Il reste une délignure de 3,6 mm : c\'est un déchet.',
      checks:[['Pièce de 91,8 mm ramenée à l\'entrée',()=>{ const e=cur(); return !!e&&Math.abs(measure(e).W-91.8)<1 || goodOf(85).length>=2; }],['Contre le guide',()=>!!cur()&&againstGuide(cur())||goodOf(85).length>=2]],
      done:()=>goodOf(85).length>=2},
    fin,
    ctrl('Cahier des charges : 2 pièces de 85 mm ± 0,5, rives sciées parallèles, sans flache, moteur jamais en surcharge.',resAvive)],
  plot:[
    {k:'Préparation', t:'Préparer la machine', c:'Plateau de chêne de 2 200 × 41 mm, scié dans un plot : ses deux rives sont en flache et il est plus large à un bout. Objectif : un avivé de 140 mm sans flache. Lames à l\'arrêt, montez le manchon à 2 lames écartées pour 140 mm. Escamotez le guide : une rive en flache ne s\'appuie jamais contre le guide. Allumez le laser et l\'aspiration.',
      checks:[man('m2','2 lames · 140'),['Guide escamoté',()=>!st.guideUp],['Laser allumé',()=>st.laser],['Aspiration en marche',()=>st.asp]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Position', t:'Positionner le plateau au laser', c:'Le plateau est posé sur sa petite face et son petit bout est vers la machine. Retournez-le : grande face sur le tapis, petit découvert dessus. Pivotez-le bout pour bout : on l\'engage par le gros bout. Réglez les presseurs pour 41 mm. Puis décalez-le en travers jusqu\'à ce que les deux traits laser passent dans le bois sain, de la flache jusqu\'au bout, sur toute la longueur.',
      checks:[['Grande face sur le tapis (petit découvert dessus)',()=>{ const e=cur(); if(!e) return false; const f=faceStats(e); return f.down>=f.up; }],
        ['Gros bout engagé en premier',()=>{ const e=cur(); if(!e) return false; const f=faceStats(e); return f.lead>=f.trail; }],presChk(41),
        ['Les deux traits laser dans le bois sain sur toute la longueur',()=>{ const e=cur(); return !!e && predict(e).some(q=>q.c1>-1e8&&q.c2<1e8&&!measure(q).flache&&Math.abs(measure(q).W-140)<=0.5); }]],
      done:s=>s.checks.every(c=>c[1]())},
    {k:'Passe', t:'Déligner le plateau', c:'Démarrez les lames, puis le tapis. Le chêne de 41 mm est dur et épais : réglez la vitesse d\'avance pour que l\'ampèremètre reste dans la zone verte. Engagez le plateau sans le toucher pendant le sciage, et restez hors de son axe. Les deux délignures en flache sortent avec l\'avivé.',
      checks:[['Lames en marche',()=>st.motor||produced().length>0],['Tapis en marche',()=>st.tapis||produced().length>0],['Ampèremètre (charge prévue) dans la zone verte, 40 à 90 %',()=>loadIn()||produced().length>0]], done:()=>goodOf(140).length>=1},
    fin,
    ctrl('Cahier des charges : avivé de 140 mm ± 0,5, sans flache, deux rives sciées parallèles, moteur jamais en surcharge.',resPlot)],
  multi:[
    {k:'Préparation', t:'Monter le manchon à 4 lames', c:'Avivé de hêtre 2 000 × 200 × 27 mm. Fiche de débit : 4 tasseaux de 45 mm en une seule passe. Lames à l\'arrêt, montez le manchon à 4 lames : les entretoises écartent les lames de 48,2 mm (45 mm de pièce + 3,2 mm de trait). Aspiration en marche.',
      checks:[man('m4','4 lames · 45'),['Aspiration en marche',()=>st.asp]], done:s=>s.checks.every(c=>c[1]())},
    {k:'Réglages', t:'Régler guide, presseurs et vitesse', c:'Guide en place à 45 mm : le premier tasseau sort entre le guide et la première lame, les trois autres entre les lames. Plaquez l\'avivé contre le guide. Presseurs pour 27 mm. Quatre lames dans du hêtre demandent beaucoup plus de puissance qu\'une seule : démarrez les lames et le tapis, et réduisez la vitesse d\'avance pour que l\'ampèremètre reste dans la zone verte, sans surcharge.',
      checks:[['Guide en place à 45 mm',()=>st.guideUp&&st.gw===45],['Avivé contre le guide',()=>!!cur()&&againstGuide(cur())],presChk(27),['Lames en marche',()=>st.motor],['Tapis en marche',()=>st.tapis],ampChk], done:s=>s.checks.every(c=>c[1]())},
    {k:'Passe', t:'Déligner les 4 tasseaux', c:'Engagez l\'avivé, puis restez hors de son axe. Les 4 tasseaux et une délignure de 7,2 mm sortent ensemble.',
      checks:[['Avivé contre le guide',()=>!!cur()&&againstGuide(cur())||goodOf(45).length>0]], done:()=>goodOf(45).length>=4},
    fin,
    ctrl('Cahier des charges : 4 tasseaux de 45 mm ± 0,5 en une seule passe, rives sciées parallèles, moteur jamais en surcharge.',resMulti)],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'avive', view:'vop', t:'Délignage d\'avivés', intro:'Délignage d\'un avivé de sapin au guide : 2 pièces de 85 mm en deux passes.'},
  {mode:'plot', view:'vop', t:'Délignage d\'un plateau', intro:'Délignage d\'un plateau de chêne en flache au laser : un avivé de 140 mm sans flache.'},
  {mode:'multi', view:'vop', t:'Multidélignage', intro:'Multidélignage d\'un avivé de hêtre : 4 tasseaux de 45 mm en une passe, sans surcharger le moteur.'},
];
export function scenCriteria(m, {dangers, ok}){ const sec=['Aucune faute grave',`${dangers}`,ok], amp=['Ampèremètre sans surcharge',`${cut.maxLoad} %`,cut.passes>0&&loadOk()];
  if(m==='avive'){ const g=goodOf(85);
    return [['Pièce 1 : 85 ± 0,5 mm',g[0]?fmt(g[0].m.W)+' mm':'—',!!g[0]],['Pièce 2 : 85 ± 0,5 mm',g[1]?fmt(g[1].m.W)+' mm':'—',!!g[1]],
      ['Rives sciées parallèles, sans flache',g.length?'oui':'—',g.length>=2&&g.every(({m})=>m.sawn===2&&!m.flache)],amp,sec]; }
  if(m==='plot'){ const b=bestPlot();
    return [['Largeur 140 ± 0,5 mm',b?fmt(b.m.W)+' mm':'—',!!b&&Math.abs(b.m.W-140)<=0.5],['Aucune flache',b?(b.m.flache?'flache':'aucune'):'—',!!b&&!b.m.flache],
      ['Deux rives sciées parallèles',b?b.m.sawn+' / 2':'—',!!b&&b.m.sawn===2],amp,sec]; }
  const g=goodOf(45);
  return [['4 tasseaux de 45 ± 0,5 mm',`${Math.min(4,g.length)} / 4`,g.length>=4],['Rives sciées parallèles',g.length?'oui':'—',g.length>=4&&g.every(({m})=>m.sawn===2)],
    ['Une seule passe',String(cut.passes),cut.passes===1&&g.length>=4],amp,sec]; }
