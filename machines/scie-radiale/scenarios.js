/* Scénarios guidés de la scie radiale (chaîne de débit : tronçonnage des planches brutes avant le délignage).
   - Débit en série : plateau de sapin 2 500 × 27 → bout brut affranchi, puis 4 montants de 550 mm à la butée ;
   - Purge des défauts : plateau de chêne 2 400 × 27 → fente en bout, nœud et gerce éliminés au plus près ;
   - Coupe inclinée : avivé de mélèze 2 400 × 120 × 22 → lame à 45°, bout affranchi, 3 lames de bardage de 600 mm
     à bouts biais parallèles (longueur mesurée sur la face posée). */
import { st, head, parked } from './state.js';
import { cut, cur, onTable, pieces, newPiece, clearPieces, againstGuide, againstStop, measure, produced } from './piece.js';
import { protOk, handOk, goodOf, fmt } from './rules.js';

/* ---------- pièces de départ ---------- */
const SPECS={
  libre:()=>({L:2000,W:200,T:27,wood:'chene',flache:12,wave:3,skew0:3,skew1:5,seed:5,x1:-0.04,gap:0,
    defects:[{type:'fente',end:'d',len:110,v:105},{type:'noeud',u:900,v:80,r:15}]}),
  serie:()=>({L:2500,W:180,T:27,wood:'sapin',flache:14,wave:3,skew0:4,skew1:6,seed:3,x1:-0.04,gap:12}),
  purge:()=>({L:2400,W:200,T:27,wood:'chene',flache:10,wave:3,skew0:3,skew1:2,seed:9,x1:-0.04,gap:0,
    defects:[{type:'fente',end:'d',len:130,v:95},{type:'noeud',u:1500,v:125,r:17},{type:'gerce',u:600,len:90,v:60}]}),
  biais:()=>({L:2400,W:120,T:22,wood:'meleze',flache:0,wave:0,skew0:2,skew1:2,seed:4,x1:-0.04,gap:0}),
};
/* réglages au chargement d'un mode (protecteur resté haut, main trop près…) */
const BASE={motor:false,asp:false,lock:true,alpha:0,beta:0,handSide:'g'};
const SETUP={ libre:{prot:32,stopOn:true,stopL:500,handD:250},
  serie:{prot:90,stopOn:false,stopL:400,handD:250},
  purge:{prot:60,stopOn:true,stopL:600,handD:80},
  biais:{prot:50,stopOn:false,stopL:400,handD:250} };
export const LOADERS=Object.fromEntries(Object.keys(SPECS).map(k=>[k,()=>{ clearPieces(); cut.cuts=0; cut.lastMsg='';
  Object.assign(head,{s:0,mode:'park',target:0}); Object.assign(st,BASE,SETUP[k]); newPiece(SPECS[k]()); }]));

/* ---------- repères communs ---------- */
/* pièce qui porte encore le bout brut droit d'origine (après affranchissement : la chute) */
function rawRightPiece(){ return pieces.find(q=>q.planes.some(p=>p.raw && p.n[0]>0))||null; }
const purged=()=>{ const q=rawRightPiece(); return !!q && q.gen>0 && q.state==='stock'; };
const purgeLen=()=>{ const q=rawRightPiece(); return q&&q.gen>0? measure(q).L : null; };
/* longueur de la pièce qui contient le défaut (la plus longue s'il est coupé en deux) */
const defectLen=t=>{ let L=null; for(const q of pieces){ const m=measure(q); if(m.defects.includes(t)) L=Math.max(L??0,m.L); } return L; };
const defectOut=t=>{ const p=cur(); return onTable().length===1 && !!p && !measure(p).defects.includes(t); };
const single=()=>onTable().length===1;
const T_OF={serie:27,purge:27,biais:22};
const prep=k=>[[`Protecteur réglé au plus près (${T_OF[k]+1} à ${T_OF[k]+10} mm)`,()=>protOk(cur())],['Aspiration en marche',()=>st.asp]];
const handChk=['Main gauche sur la planche, hors de la zone rouge',()=>handOk()];
const backChk=['Lame ramenée en position arrière',()=>parked()];
const fin={k:'Fin', t:'Ranger et arrêter',
  c:'Mettez de côté la dernière pièce restée sur la table (« Mettre de côté »), lame en position arrière. Arrêtez la lame et attendez son arrêt complet avant de quitter le poste.',
  checks:[backChk,['Table dégagée',()=>!onTable().length],['Lame arrêtée',()=>!st.motor]], done:s=>s.checks.every(c=>c[1]())};
const ctrl=(c,results)=>({k:'Contrôle', t:'Contrôler les pièces', c, checks:[], results, done:()=>false});
const stopStep=L=>({k:'Butée', t:`Régler la butée à ${L} mm`, c:`Réglez la butée de longueur à ${L} mm et mettez-la en service (abaissée). « Ramener la pièce » pousse la planche contre le guide et contre la butée.`,
  checks:[['Butée en service',()=>st.stopOn],[`Butée à ${L} mm`,()=>st.stopL===L],['Planche contre le guide et contre la butée',()=>{ const p=cur(); return single() && againstGuide(p) && againstStop(p); }]], done:s=>s.checks.every(c=>c[1]())});

/* ---------- contrôle final ---------- */
const best=(L,n)=>goodOf(L).slice(0,n).map(q=>measure(q));
function resSerie(){ if(!produced().length) return {msg:'Aucune coupe faite.'}; const g=best(550,4), pl=purgeLen(), sp=g.length? Math.max(...g.map(m=>m.L))-Math.min(...g.map(m=>m.L)) : null;
  return {rows:[['Montants de 550 ± 1 mm',`${g.length} / 4`,g.length>=4],['Bouts sciés d\'équerre',g.length&&g.every(m=>m.square)?'oui':'non',g.length>=4&&g.every(m=>m.square)],
    ['Bout brut affranchi : chute ≤ 50 mm',pl===null?'—':fmt(pl,0)+' mm',pl!==null&&pl<=50],['Pièces identiques (écart ≤ 0,5 mm)',sp===null?'—':fmt(sp)+' mm',g.length>=4&&sp<=0.5]]}; }
const LIM={fente:160, noeud:100, gerce:150}, UTILE=1950;
const utile=()=>produced().map(q=>measure(q)).filter(m=>!m.defects.length&&m.L>=350).reduce((a,m)=>a+m.L,0);
const defRow=(t,lbl)=>{ const L=defectLen(t), ok=L!==null && L<=LIM[t] && !pieces.some(q=>q.state==='table'&&measure(q).defects.includes(t)&&measure(q).L>LIM[t]);
  return [`${lbl} : chute ≤ ${LIM[t]} mm`, L===null?'—':fmt(L,0)+' mm', ok]; };
function resPurge(){ if(!produced().length) return {msg:'Aucune coupe faite.'}; const u=utile();
  return {rows:[defRow('fente','Fente en bout'),defRow('noeud','Nœud'),defRow('gerce','Gerce'),[`Bois sain récupéré ≥ ${fmt(UTILE,0)} mm`,fmt(u,0)+' mm',u>=UTILE]]}; }
const bevel=m=>m.ends.length===2 && m.ends.every(e=>!e.raw && Math.abs(e.beta-45)<0.01 && Math.abs(e.alpha)<0.01);
const parallel=m=>m.ends.length===2 && new Set(m.ends.map(e=>e.longAt)).size===2 && m.ends.every(e=>e.longAt);
function resBiais(){ if(!produced().length) return {msg:'Aucune coupe faite.'}; const g=best(600,3), pl=purgeLen();
  return {rows:[['Lames de 600 ± 1 mm (face posée)',`${g.length} / 3`,g.length>=3],['Coupes à 45° aux deux bouts',g.length&&g.every(bevel)?'oui':'non',g.length>=3&&g.every(bevel)],
    ['Bouts biais parallèles',g.length&&g.every(parallel)?'oui':'non',g.length>=3&&g.every(parallel)],['Bout brut affranchi : chute ≤ 50 mm',pl===null?'—':fmt(pl,0)+' mm',pl!==null&&pl<=50]]}; }

/* ---------- étapes de chaque mode ---------- */
const purgeStep=(k,extra)=>({k:'Affranchir', t:'Affranchir le bout brut'+(extra||''),
  c:k==='biais'? 'Le bout droit de l\'avivé est brut. Butée relevée, avancez-le vers la droite pour que le trait enlève 20 à 40 mm (vue de dessus : « coupé à droite du trait »). Main gauche sur l\'avivé, hors de la zone rouge. Démarrez la lame, tirez-la doucement en la retenant, puis ramenez-la en arrière, derrière le guide, sans lâcher la poignée. Lame revenue, évacuez la chute.'
    : 'Le bout droit de la planche est brut, sale et pas d\'équerre : on ne le met jamais contre la butée. Butée relevée, avancez la planche vers la droite pour que le trait enlève 20 à 40 mm (vue de dessus : « coupé à droite du trait »). Main gauche sur la planche, hors de la zone rouge. Démarrez la lame, tirez-la doucement en la retenant (elle travaille en avalant et tend à s\'emballer), puis ramenez-la en arrière, derrière le guide, sans lâcher la poignée. Lame revenue, évacuez la chute.',
  checks:[handChk,['Lame en marche',()=>st.motor||purged()],['Bout brut coupé, chute évacuée',purged],backChk], done:s=>s.checks.slice(2).every(c=>c[1]()) && single()});
export const STEPS={
  serie:[
    {k:'Préparation', t:'Préparer la machine', c:'Fiche de débit « Étagère » : 4 montants de 550 mm (longueur de débit) dans un plateau de sapin brut de 2 500 × 27 mm, rives en flache. Lame arrêtée, mettez l\'aspiration en marche. Réglez le protecteur avant au plus près : 1 à 10 mm au-dessus de la planche. Plaquez la planche contre le guide.',
      checks:[...prep('serie'),['Planche contre le guide',()=>againstGuide(cur())]], done:s=>s.checks.every(c=>c[1]())},
    purgeStep('serie'),
    stopStep(550),
    {k:'Débit', t:'Débiter les 4 montants', c:'Pour chaque montant : planche contre le guide et la butée, main gauche à plat sur la planche, hors de la zone rouge (la planche raccourcit : rapprochez la main, entre 150 et 200 mm du trait), tirez la lame en la retenant, ramenez-la en arrière, puis « Évacuer les chutes » : le montant est rangé dans « Pièces débitées ». « Ramener la pièce » repousse la planche contre la butée pour le montant suivant.',
      checks:[['Montants de 550 mm',()=>goodOf(550).length>=4],backChk,['Table dégagée : la planche seule',single]], done:s=>s.checks.every(c=>c[1]())},
    {...fin, c:'Le reste de planche fait moins de 350 mm : trop court pour la raboteuse, c\'est une chute. ' + fin.c},
    ctrl('Fiche de débit : 4 montants de 550 mm ± 1, bouts sciés d\'équerre, identiques ; bout brut affranchi en perdant 50 mm au plus.',resSerie)],
  purge:[
    {k:'Préparation', t:'Préparer la purge', c:'Plateau de chêne brut de 2 400 × 27 mm, tracé à la craie : une fente en bout à droite, un nœud noir et une gerce. On purge « à vue », sans butée : relevez la butée. Aspiration en marche, protecteur au plus près. Placez la main gauche sur la planche, hors de la zone rouge (150 mm au moins du trait).',
      checks:[...prep('purge'),['Butée relevée',()=>!st.stopOn],handChk], done:s=>s.checks.every(c=>c[1]())},
    {k:'Fente', t:'Éliminer la fente en bout', c:'La fente part du bout droit et remonte d\'environ 13 cm. Avancez la planche vers la droite jusqu\'à ce que le trait passe juste à gauche du bout de la fente, à 10 à 30 mm (alerte « défaut le plus proche » et vue de dessus). Tirez la lame, ramenez-la en arrière, évacuez la chute.',
      checks:[['Fente dans la chute évacuée',()=>defectOut('fente')],backChk], done:s=>s.checks.every(c=>c[1]())},
    {k:'Nœud', t:'Éliminer le nœud', c:'Deux coupes au plus près du nœud. 1) Trait juste à droite du nœud : la pièce saine de droite (environ 730 mm) part au délignage ; évacuez-la. 2) Avancez la planche pour que le trait passe juste à gauche du nœud : la chute contient tout le nœud ; évacuez-la.',
      checks:[['Nœud dans une chute évacuée',()=>defectOut('noeud')],backChk], done:s=>s.checks.every(c=>c[1]())},
    {k:'Gerce', t:'Éliminer la gerce', c:'Même méthode pour la gerce (fente de surface, dans le fil) : un trait juste à droite, un trait juste à gauche. La pièce restée sur la table, à gauche, est saine.',
      checks:[['Gerce dans une chute évacuée',()=>defectOut('gerce')],backChk], done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl(`Purge : chaque défaut éliminé dans une chute courte (fente ≤ ${LIM.fente} mm, nœud ≤ ${LIM.noeud} mm, gerce ≤ ${LIM.gerce} mm), au moins ${fmt(UTILE,0)} mm de bois sain récupéré.`,resPurge)],
  biais:[
    {k:'Préparation', t:'Incliner la lame à 45°', c:'Bardage : 3 lames de 600 mm, bouts coupés en biais à 45° pour que les raccords ne laissent pas entrer l\'eau. Avivé de mélèze 2 400 × 120 × 22 mm. Lame arrêtée et immobile, débloquez la tête, inclinez la lame à 45°, puis rebloquez. Protecteur au plus près, aspiration en marche.',
      checks:[['Lame inclinée à 45°',()=>st.beta===45],['Bras et tête bloqués',()=>st.lock],...prep('biais')], done:s=>s.checks.every(c=>c[1]())},
    purgeStep('biais',' à 45°'),
    stopStep(600),
    {k:'Débit', t:'Débiter les 3 lames', c:'Comme pour un débit droit : avivé contre le guide et la butée, main gauche hors de la zone rouge, tirer la lame, la ramener, évacuer la lame débitée, « Ramener la pièce ». La butée mesure la face posée sur la table : chaque lame a un bout long dessous et l\'autre long dessus, les biais sont parallèles.',
      checks:[['Lames de 600 mm',()=>goodOf(600).length>=3],backChk,['Table dégagée : l\'avivé seul',single]], done:s=>s.checks.every(c=>c[1]())},
    fin,
    ctrl('Bardage : 3 lames de 600 mm ± 1 (face posée), bouts à 45° parallèles, bout brut affranchi en perdant 50 mm au plus.',resBiais)],
};

/* ---------- parcours évalué : 3 scénarios, 5 critères de 4 points ---------- */
export const SCENS=[
  {mode:'serie', view:'vop', t:'Débit en série à la butée', intro:'Tronçonnage d\'un plateau de sapin d\'après une fiche de débit : bout brut affranchi, puis 4 montants de 550 mm à la butée.'},
  {mode:'purge', view:'vop', t:'Purge des défauts', intro:'Purge d\'un plateau de chêne : fente en bout, nœud et gerce éliminés au plus près, en perdant le moins de bois possible.'},
  {mode:'biais', view:'vop', t:'Coupe inclinée à 45°', intro:'Lames de bardage : lame inclinée à 45°, bout affranchi, 3 lames de 600 mm à bouts biais parallèles.'},
];
export function scenCriteria(m, {dangers, ok}){ const sec=['Aucune faute grave',`${dangers}`,ok];
  const rows= m==='serie'? resSerie().rows : m==='purge'? resPurge().rows : resBiais().rows;
  if(!rows) return [['Pièces','—',false],['—','—',false],['—','—',false],['—','—',false],sec];
  return [...rows.map(r=>[r[0],r[1],!!r[2]]),sec]; }
