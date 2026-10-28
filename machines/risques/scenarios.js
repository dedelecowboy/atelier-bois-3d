/* Scénarios du module « Risques généraux » : état de départ, actions de l'élève, étapes guidées, critères notés.
   Parcours évalué : 4 scénarios de 15 points (5 critères de 3 points dont « aucune faute grave »).
   Une action renvoie { msg, level } (message affiché) et, pour une faute grave, fault: 'texte' (relevée par le parcours).
   Fautes graves (choix proposés, À VALIDER) : EPI interdit choisi (gants à la toupie) ; intervention sur une machine non
   consignée ou lame en mouvement ; remise en marche sans protecteur ; se placer avec le feu entre soi et la sortie ;
   sortir par la porte enfumée ; revenir chercher ses affaires. */
import { st, ctx } from './state.js';

const D=()=>ctx.data.dangers.filter(d=>d.type==='D'), P=()=>ctx.data.dangers.filter(d=>d.type==='P');
const T=()=>ctx.data.epi.tasks, EPI=k=>ctx.data.epi.epi.find(e=>e.k===k)?.n||k;
const stamp=(o,k)=>{ if(o.t[k]===undefined) o.t[k]=++o.n; };
const has=k=>st.c?.t[k]!==undefined;
const before=(o,a,b)=>o.t[a]!==undefined && o.t[b]!==undefined && o.t[a]<o.t[b];

/* ---------- état de départ de chaque mode ---------- */
export function reset(m){
  st.faults=[];
  st.d={ found:{}, fa:[], pending:null, fb:null };
  st.e={ sel:{}, res:{}, fb:null };
  st.c={ on:true, sect:true, lock:false, key:false, tag:false, au:false, tested:false, changed:false, prot:true, warned:false, restarted:false, charge:false, early:false, t:{}, n:0, fb:null };
  st.f={ cri:false, alarme:false, au:false, ext:null, pos:null, aim:null, attacked:false, exit:null, ferme:false, rass:false, sac:false, t:{}, n:0, fb:null, phase:0 };
}

/* ---------- 1. Repérer les dangers ---------- */
export function pickDanger(code){ const S=st.d, d=ctx.data.dangers.find(x=>x.k===code); if(!d) return null;
  if(d.type==='P'){ if(!S.fa.includes(code)) S.fa.push(code); S.pending=null; S.fb={ level:'warn', html:`<b>Fausse alerte.</b> ${d.t} : ${d.e}` }; return d; }
  if(S.found[code]){ S.fb={ level:'info', html:`Déjà repéré : ${d.t}.` }; return d; }
  S.pending=code; S.fb=null; return d; }
export function chooseMeasure(i){ const S=st.d, d=D().find(x=>x.k===S.pending); if(!d) return;
  const ok=i===d.a; S.found[d.k]={ m:i, ok }; S.pending=null;
  S.fb={ level:ok?'ok':'warn', html:`<b>${ok?'Bonne mesure.':'Ce n\'est pas la bonne mesure.'}</b> ${ok?'':'Il fallait : '+d.o[d.a]+'. '}${d.e}` }; }
/* options affichées dans un ordre mélangé, toujours le même pour un danger */
export function measureOrder(d){ const h=[...d.k].reduce((a,c)=>a+c.charCodeAt(0),0), n=d.o.length; return d.o.map((_,i)=>(i+h)%n); }
function dangerRows(){ const S=st.d, all=D(), found=all.filter(d=>S.found[d.k]), good=found.filter(d=>S.found[d.k].ok).length, N=all.length;
  const need=Math.min(N,Math.max(1,Math.ceil(N*10/12)));
  const evac=all.filter(d=>['issue_bloquee','extincteur_masque'].includes(d.k));
  return [
    [`Dangers repérés (${need} au moins)`, `${found.length} / ${N}`, found.length>=need],
    ['Évacuation et secours : issue bloquée et extincteur masqué', evac.map(d=>S.found[d.k]?'✓':'✗').join(' '), evac.every(d=>S.found[d.k])],
    ['Bonne mesure choisie (8 sur 10 au moins)', `${good} / ${found.length}`, found.length>0 && good>=0.8*found.length],
    ['Fausses alertes (2 au plus)', String(S.fa.length), S.fa.length<=2],
    ...all.filter(d=>!S.found[d.k]).map(d=>['Non repéré : '+d.t.toLowerCase(), '—', false]) ]; }

/* ---------- 2. Choisir ses EPI ---------- */
export function toggleEpi(task,k){ const s=st.e.sel[task]||(st.e.sel[task]=[]); if(st.e.res[task]) return; const i=s.indexOf(k); if(i<0) s.push(k); else s.splice(i,1); }
export function validateEpi(task){ const t=T().find(x=>x.k===task), s=st.e.sel[task]||[]; if(!t||st.e.res[task]) return {};
  const miss=t.req.filter(k=>!s.includes(k)), bad=t.bad.filter(k=>s.includes(k)), ok=!miss.length&&!bad.length;
  st.e.res[task]={ ok, miss, bad };
  st.e.fb={ level:ok?'ok':bad.length?'danger':'warn', html:`<b>${ok?'Tenue correcte.':bad.length?'Faute grave : EPI interdit pour cette tâche.':'Tenue incomplète.'}</b> ${miss.length?'Il manquait : '+miss.map(EPI).join(', ')+'. ':''}${bad.length?'Interdit ici : '+bad.map(EPI).join(', ')+'. ':''}${t.e}` };
  return bad.length? { fault:`EPI interdit pour la tâche « ${t.t} » : ${bad.map(EPI).join(', ').toLowerCase()}` } : {}; }

/* ---------- 3. Consigner une machine ---------- */
export function consign(a, spin){ const C=st.c, r=(msg,level='info',fault)=>{ C.fb={ level, html:msg }; return { msg, level, fault }; };
  switch(a){
    case 'stop': if(!C.on) return r('La machine est déjà arrêtée.'); C.on=false; stamp(C,'stop'); return r('Machine arrêtée (bouton O) : la lame ralentit, freinée. Attendez son arrêt complet.');
    case 'start':
      if(C.au) return r('L\'arrêt d\'urgence est enfoncé : rien ne démarre. Mais quelqu\'un pourrait le déverrouiller : ce n\'est pas une consignation.','warn');
      if(!C.sect){ if(C.lock){ C.tested=true; stamp(C,'test'); return r('Essai de démarrage : rien ne se passe. L\'absence d\'énergie est vérifiée : vous pouvez intervenir.','ok'); }
        return r('Rien ne démarre : la machine est séparée. Condamnez d\'abord le sectionneur avec votre cadenas, puis vérifiez.','warn'); }
      if(C.on) return r('La machine tourne déjà.');
      if(C.changed && !C.prot){ C.on=true; stamp(C,'restart'); return r('Remise en marche sans protecteur.','danger','Remise en marche sans protecteur'); }
      C.on=true; if(C.changed){ C.restarted=true; stamp(C,'restart'); return r(C.warned? 'Machine remise en service. Consignation terminée.' : 'Machine remise en marche sans avoir prévenu les personnes autour.', C.warned?'ok':'warn'); }
      return r('Machine en marche.');
    case 'au': if(C.au){ C.au=false; return r('Arrêt d\'urgence déverrouillé (on tire le bouton).'); } C.au=true; C.on=false; stamp(C,'au'); return r('Arrêt d\'urgence enfoncé : la machine s\'arrête. Attention, ce n\'est pas une consignation : n\'importe qui peut le déverrouiller.','warn');
    case 'sect':
      if(C.sect){ if(C.on||spin>0.05){ C.charge=true; C.on=false; C.sect=false; stamp(C,'sect0'); return r('Sectionneur ouvert machine en marche : arrêtez toujours la machine (bouton O) avant de manœuvrer le sectionneur.','warn'); }
        C.sect=false; stamp(C,'sect0'); return r('Sectionneur sur 0 : la machine est séparée du réseau électrique.'); }
      if(C.lock) return r('Votre cadenas bloque le sectionneur sur 0 : retirez-le d\'abord.','warn');
      C.sect=true; stamp(C,'sect1'); return r(C.tag? 'Sectionneur sur 1 alors que le panneau « Ne pas manœuvrer » est encore en place.' : 'Sectionneur sur 1 : la machine est de nouveau alimentée.', C.tag?'warn':'info');
    case 'lock':
      if(C.lock){ C.lock=false; C.key=false; stamp(C,'unlock'); if(!C.prot){ C.early=true; return r('Cadenas retiré alors que le protecteur n\'est pas remis : remettez les protecteurs AVANT de déconsigner.','warn'); } return r('Cadenas retiré : vous seul retirez votre cadenas.'); }
      if(C.sect) return r('Le cadenas ne se pose que sur le sectionneur en position 0.','warn');
      C.lock=true; stamp(C,'lock'); return r('Cadenas personnel posé : le sectionneur est bloqué sur 0.');
    case 'key': if(!C.lock) return r('Posez d\'abord votre cadenas.','warn'); if(C.key) return r('La clé est déjà dans votre poche.'); C.key=true; stamp(C,'key'); return r('Clé du cadenas gardée sur vous : personne d\'autre ne peut remettre la machine sous tension.');
    case 'tag': if(C.tag){ C.tag=false; stamp(C,'untag'); return r('Panneau retiré.'); } C.tag=true; stamp(C,'tag'); return r('Panneau « Ne pas manœuvrer – travaux en cours » accroché au sectionneur.');
    case 'inter':
      if(C.changed) return r('La lame est déjà changée.');
      if(C.on||spin>0.02) return r('Intervention refusée : la lame tourne encore.','danger','Intervention sur la lame en mouvement');
      if(C.sect||!C.lock) return r(C.au? 'Intervention refusée : l\'arrêt d\'urgence ne suffit pas, la machine n\'est pas consignée.' : 'Intervention refusée : la machine n\'est pas consignée (sectionneur sur 0 et cadenas).','danger','Intervention sur une machine non consignée');
      C.changed=true; C.prot=false; stamp(C,'inter');
      return r(C.tested? 'Lame changée (protecteur déposé pour l\'intervention).' : 'Lame changée, mais sans avoir vérifié que la machine ne démarrait pas.', C.tested?'ok':'warn');
    case 'prot': if(!C.changed) return r('Rien à remonter : vous n\'êtes pas encore intervenu.'); if(C.prot) return r('Le protecteur est en place.'); C.prot=true; stamp(C,'prot'); return r('Protecteur remis, outils rangés.');
    case 'warn': C.warned=true; stamp(C,'warn'); return r('Vous prévenez les personnes autour : la machine va être remise en marche.');
  }
  return r(''); }
function consignRows(){ const C=st.c, inter=C.t.inter!==undefined;
  return [
    ['Arrêtée (bouton O) puis séparée (sectionneur sur 0) avant l\'intervention', inter? (before(C,'stop','sect0')&&!C.charge? 'oui':'non') : 'pas d\'intervention', inter && before(C,'stop','sect0') && !C.charge && before(C,'sect0','inter')],
    ['Condamnée et signalée : cadenas, clé gardée, panneau', ['lock','key','tag'].map(k=>before(C,k,'inter')?'✓':'✗').join(' '), inter && ['lock','key','tag'].every(k=>before(C,k,'inter'))],
    ['Absence d\'énergie vérifiée avant l\'intervention (essai de démarrage)', before(C,'test','inter')?'oui':'non', before(C,'test','inter')],
    ['Déconsignation : protecteur, cadenas, prévenir, remise en marche', C.restarted? (before(C,'prot','unlock')&&before(C,'warn','restart')?'dans l\'ordre':'ordre non respecté') : 'non terminée',
      C.changed && C.restarted && before(C,'prot','unlock') && before(C,'unlock','sect1') && before(C,'warn','restart') && !C.early] ]; }

/* ---------- 4. Réagir à un départ de feu ---------- */
export const FEU={ ext:{ eau:'Extincteur à eau pulvérisée avec additif (A B)', co2:'Extincteur à CO2 (B)' },
  pos:{ ok:'À 2 – 3 m du feu, côté allée, la porte B dans le dos', pres:'Le plus près possible, à 50 cm du feu', fond:'Entre le feu et le mur, derrière le tas de copeaux' },
  aim:{ base:'Viser la base des flammes en balayant', haut:'Viser le haut des flammes' },
  exit:{ A:'Porte A (à 4 m du feu, dans la fumée)', B:'Porte B (loin du feu, chemin dégagé)', C:'Porte C (mur de gauche, en passant à côté du feu)' } };
export function feu(a,v){ const F=st.f, r=(msg,level='info',fault)=>{ F.fb={ level, html:msg }; return { msg, level, fault }; };
  if(F.rass && a!=='sac') return r('Vous êtes au point de rassemblement.');
  switch(a){
    case 'cri': if(F.cri) return r('L\'alerte est déjà donnée.'); F.cri=true; stamp(F,'cri'); return r('« Au feu ! » : le professeur et les camarades sont prévenus.','ok');
    case 'alarme': if(F.alarme) return r('L\'alarme sonne déjà.'); F.alarme=true; stamp(F,'alarme'); return r('Déclencheur manuel enfoncé : l\'alarme d\'évacuation sonne dans le bâtiment.','ok');
    case 'au': if(F.au) return r('Les machines sont déjà coupées.'); F.au=true; stamp(F,'au'); return r('Arrêt d\'urgence général : toutes les machines de l\'atelier s\'arrêtent.','ok');
    case 'ext': if(F.exit) return r('Vous avez quitté l\'atelier.'); if(F.ext) return r('Vous tenez déjà un extincteur.'); F.ext=v; stamp(F,'ext'); return r(v==='eau'? 'Extincteur à eau pulvérisée avec additif : adapté aux feux de bois (classe A).' : 'Extincteur à CO2 : il couche les flammes mais n\'éteint pas bien les braises de bois (classe A).', v==='eau'?'info':'warn');
    case 'pos': if(!F.ext) return r('Prenez d\'abord un extincteur.','warn'); if(F.pos) return r('Vous êtes déjà en position.'); F.pos=v; stamp(F,'pos');
      if(v==='fond') return r('Le feu est entre vous et la sortie : s\'il grossit, vous êtes piégé.','danger','Feu entre soi et la sortie');
      return r(v==='ok'? 'Bonne position : à distance, la sortie dans le dos.' : 'Trop près : chaleur, fumée, risque de brûlure. Eau pulvérisée : à 2 – 3 m.', v==='ok'?'info':'warn');
    case 'aim': if(!F.pos) return r('Placez-vous d\'abord.','warn'); if(F.aim) return r('Vous avez déjà attaqué le feu.'); F.aim=v; F.attacked=true; stamp(F,'attack'); F.phase=1;
      return r((v==='base'? 'Jet à la base des flammes : le feu baisse… ' : 'Jet dans les flammes hautes : le feu ne baisse presque pas… ')+'L\'extincteur se vide en quelques secondes et le feu reprend dans le tas de copeaux, la fumée s\'épaissit : évacuez.', v==='base'?'warn':'warn');
    case 'exit': if(F.exit) return r('Vous êtes déjà sorti.'); F.exit=v; stamp(F,'exit'); F.phase=Math.max(F.phase,1);
      if(v==='A') return r('Vous traversez la fumée près du foyer : fumées toxiques, risque d\'être piégé.','danger','Sortie par la porte enfumée');
      return r(v==='B'? 'Sortie par la porte B, loin du feu.' : 'Porte C : vous passez à côté du foyer. Il fallait la porte B, loin du feu.', v==='B'?'ok':'warn');
    case 'ferme': if(!F.exit) return r('Sortez d\'abord.','warn'); F.ferme=true; stamp(F,'ferme'); return r('Porte refermée derrière vous (sans la verrouiller) : la fumée se propage moins.','ok');
    case 'sac': F.sac=true; stamp(F,'sac'); return r('On ne retourne jamais chercher ses affaires dans un atelier en feu.','danger','Retour dans l\'atelier pour chercher ses affaires');
    case 'rass': if(!F.exit) return r('Sortez d\'abord de l\'atelier.','warn'); F.rass=true; stamp(F,'rass'); return r('Au point de rassemblement, vous vous signalez au professeur pour l\'appel.','ok');
  }
  return r(''); }
function feuRows(){ const F=st.f, ref=F.t.attack ?? F.t.exit;
  const alert=F.cri && F.alarme && (ref===undefined || (F.t.cri<ref && F.t.alarme<ref));
  return [
    ['Alerte donnée (« Au feu ! », alarme) avant d\'attaquer le feu', [F.cri?'cri ✓':'cri ✗', F.alarme?'alarme ✓':'alarme ✗'].join(' · ')+(F.cri&&F.alarme&&!alert?' (trop tard)':''), alert],
    ['Machines coupées : arrêt d\'urgence général', F.au?'oui':'non', F.au],
    ['Extincteur à eau, à 2 – 3 m dos à la sortie, base des flammes', [F.ext?FEU.ext[F.ext].split(' (')[0]:'aucun', F.pos?{ok:'bonne distance',pres:'trop près',fond:'feu entre soi et la sortie'}[F.pos]:'—', F.aim?{base:'base',haut:'haut des flammes'}[F.aim]:'—'].join(' · '), F.ext==='eau'&&F.pos==='ok'&&F.aim==='base'],
    ['Évacuation : porte B, point de rassemblement, sans retour', `${F.exit?'porte '+F.exit:'pas sorti'}${F.rass?' · rassemblement':''}${F.sac?' · retour pour le sac':''}`, F.exit==='B'&&F.rass&&!F.sac] ]; }

/* ---------- étapes guidées ---------- */
const ctrl=(c,rows)=>({ k:'Contrôle', t:'Contrôle et bilan', c, checks:[], done:()=>true,
  results:()=>({ rows:[...rows(), ['Fautes graves', st.faults.length?st.faults.join(' ; '):'aucune', !st.faults.length]] }) });
export function buildSteps(){ const tasks=T();
  return {
    dangers:[
      { k:'Repérage', t:'Repérer les dangers de l\'atelier',
        c:`Parcourez l'atelier (tournez, zoomez, boutons de vue). ${D().length} situations sont dangereuses, ${P().length} sont correctes. Touchez une situation dangereuse, puis choisissez la bonne mesure dans le panneau « Actions ». Une situation correcte touchée compte comme une fausse alerte. Passez au contrôle quand vous avez fini.`,
        get checks(){ const n=Object.keys(st.d.found).length; return [[`Dangers repérés : ${n} / ${D().length}`, ()=>n>=D().length], [`Fausses alertes : ${st.d.fa.length}`, ()=>st.d.fa.length===0]]; }, done:()=>Object.keys(st.d.found).length>0 },
      ctrl('Le bilan compte les dangers repérés, les bonnes mesures et les fausses alertes. Les dangers non repérés sont listés.', dangerRows) ],
    epi:[ ...tasks.map((t,i)=>({ k:`Tâche ${i+1} / ${tasks.length}`, t:t.t,
        c:'Habillez-vous pour cette tâche : choisissez les équipements dans le panneau « Actions » (l\'avatar les porte), puis « Valider la tenue ». Attention : certains équipements sont interdits pour certaines tâches.',
        get checks(){ const r=st.e.res[t.k]; return [['Tenue validée', ()=>!!r], ['Tenue correcte', ()=>!!r?.ok]]; }, done:()=>!!st.e.res[t.k] })),
      ctrl('Une tenue est correcte si elle contient tous les équipements obligatoires et aucun équipement interdit.', ()=>tasks.map((t,i)=>{ const r=st.e.res[t.k];
        return [`Tâche ${i+1} : ${t.t}`, !r?'non validée' : r.ok?'tenue correcte' : [r.miss.length?'manque '+r.miss.map(EPI).join(', ').toLowerCase():'', r.bad.length?'interdit : '+r.bad.map(EPI).join(', ').toLowerCase():''].filter(Boolean).join(' ; '), !!r?.ok]; })) ],
    consignation:[
      { k:'Arrêter et séparer', t:'Arrêter la machine, puis la séparer du réseau',
        c:'La lame de la scie à format est usée : vous devez la changer. La machine tourne. Arrêtez-la (bouton O) et attendez l\'arrêt de la lame, puis mettez le sectionneur sur 0. L\'arrêt d\'urgence seul ne suffit pas.',
        checks:[['Machine arrêtée (bouton O)',()=>has('stop')],['Sectionneur mis sur 0',()=>has('sect0')]], done:s=>s.checks.every(c=>c[1]()) },
      { k:'Condamner et signaler', t:'Poser son cadenas, garder la clé, accrocher le panneau',
        c:'Posez VOTRE cadenas sur le sectionneur en position 0, gardez la clé sur vous, et accrochez le panneau « Ne pas manœuvrer – travaux en cours ».',
        checks:[['Cadenas personnel posé',()=>has('lock')],['Clé gardée sur vous',()=>has('key')],['Panneau accroché',()=>has('tag')]], done:s=>s.checks.every(c=>c[1]()) },
      { k:'Vérifier', t:'Vérifier l\'absence d\'énergie',
        c:'Essayez de démarrer la machine (bouton I) : rien ne doit se passer. C\'est la preuve que vous avez consigné la bonne machine.',
        checks:[['Essai de démarrage : rien ne démarre',()=>has('test')]], done:s=>s.checks.every(c=>c[1]()) },
      { k:'Intervenir', t:'Changer la lame',
        c:'La machine est consignée et vérifiée : changez la lame (le protecteur est déposé pendant l\'intervention).',
        checks:[['Lame changée',()=>has('inter')]], done:s=>s.checks.every(c=>c[1]()) },
      { k:'Déconsigner', t:'Remettre en service',
        c:'Dans l\'ordre : remettre le protecteur et ranger les outils, retirer votre panneau et votre cadenas, prévenir les personnes autour, remettre le sectionneur sur 1, puis démarrer.',
        checks:[['Protecteur remis, outils rangés',()=>has('prot')],['Cadenas et panneau retirés',()=>st.c.changed&&!st.c.lock&&!st.c.tag],['Personnes prévenues',()=>has('warn')],['Sectionneur sur 1, machine redémarrée',()=>st.c.restarted]],
        done:s=>s.checks.every(c=>c[1]()) },
      ctrl('Le bilan vérifie l\'ordre de vos actions : on ne touche à la lame qu\'une machine consignée et vérifiée.', consignRows) ],
    feu:[
      { k:'Alerter', t:'Donner l\'alerte et couper les machines',
        c:'Un feu démarre dans un tas de copeaux près de la scie à ruban 2. Vous êtes formé à l\'extincteur. D\'abord : criez « Au feu ! » pour prévenir le professeur, déclenchez l\'alarme et coupez les machines (arrêt d\'urgence général).',
        checks:[['« Au feu ! » : professeur prévenu',()=>st.f.cri],['Alarme déclenchée',()=>st.f.alarme],['Arrêt d\'urgence général',()=>st.f.au]], done:s=>s.checks.every(c=>c[1]()) },
      { k:'Attaquer', t:'Attaquer le feu naissant',
        c:'Choisissez l\'extincteur, votre position et la façon de viser. Un seul essai : vos choix sont définitifs.',
        get checks(){ const F=st.f; return [['Extincteur à eau pulvérisée avec additif',()=>F.ext==='eau'],['À 2 – 3 m, la sortie dans le dos',()=>F.pos==='ok'],['Base des flammes',()=>F.aim==='base']]; },
        done:()=>!!st.f.aim || !!st.f.exit },
      { k:'Évacuer', t:'Évacuer l\'atelier',
        c:'Le feu n\'est pas maîtrisé : évacuez par la bonne issue, puis rejoignez le point de rassemblement.',
        get checks(){ const F=st.f; return [['Sortie par la porte B',()=>F.exit==='B'],['Point de rassemblement, présence signalée',()=>F.rass],['Sans revenir en arrière',()=>!F.sac]]; },
        done:()=>!!st.f.exit && st.f.rass },
      ctrl('Le bilan vérifie l\'ordre : alerter, couper, attaquer un feu naissant, évacuer sans revenir.', feuRows) ],
  }; }

/* ---------- parcours évalué : 4 scénarios, 5 critères de 3 points ---------- */
export const SCENS=[
  { mode:'dangers', view:'v34', t:'Repérer les dangers', intro:'Dans l\'atelier, repérez les situations dangereuses et choisissez pour chacune la bonne mesure. Attention aux fausses alertes.' },
  { mode:'epi', view:'vposte', t:'Choisir ses EPI', intro:'Pour quatre tâches, habillez-vous avec les bons équipements de protection individuelle.' },
  { mode:'consignation', view:'vmachine', t:'Consigner une machine', intro:'Changez la lame de la scie à format : consignez la machine, vérifiez, intervenez, puis remettez-la en service.' },
  { mode:'feu', view:'vposte', t:'Réagir à un départ de feu', intro:'Un feu démarre dans des copeaux : alertez, coupez les machines, attaquez le feu naissant, puis évacuez.' },
];
export function scenCriteria(m, { dangers, ok }){ const sec=['Aucune faute grave', String(dangers), ok];
  const rows= m==='dangers'? dangerRows().slice(0,4) : m==='consignation'? consignRows() : m==='feu'? feuRows()
    : T().slice(0,4).map((t,i)=>{ const r=st.e.res[t.k]; return [`Tâche ${i+1} : ${t.t}`, !r?'non validée':r.ok?'tenue correcte':'tenue incorrecte', !!r?.ok]; });
  return [...rows, sec]; }
