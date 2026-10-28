/* Parcours évalué (paquetage SCORM, actif seulement si window.PARCOURS) :
   repérage d'organes, QCM, scénarios notés. Barème : repérage 20, QCM 20, 20 par scénario
   (5 critères de 4 points dont « aucune faute grave »). Réussite : 70 / 100 ET aucune faute grave.
   Faute grave = alerte « danger » active au moment où une coupe commence (recordDangers), ou liste d'alertes
   passée par la machine (recordDangers(liste) : geste dangereux hors coupe, ex. pièce touchée lame en avant).
   Traces Moodle (lisibles après export Excel) : identifiants préfixés par le code de la machine (config.scorm.code) :
   CODE_rep_<organe>, CODE_qcm_NN, CODE_sN_c1…c4 / CODE_sN_securite, CODE_faute_sN_K (texte de la faute grave),
   CODE_bilan (une ligne de synthèse datée) ; objectif SCORM CODE (note, passed / failed).
   Bilan local (localStorage atelier.bilan.<id>) relu par la page atelier du paquetage. */
import { createScorm } from './scorm.js';

const $ = id=>document.getElementById(id);
const sum=a=>a.reduce((x,y)=>x+y,0);
const W_REP=20, W_QCM=20, W_SCEN=20, PASS=70;

export function createParcours(app, { reperage, qcm }, P){
  const { stage, parts, ex } = app;
  const PARC_ON = !!window.PARCOURS;
  let on = true;                                   // false : entraînement (paquetage unique), le parcours ne relève rien
  const act = ()=> PARC_ON && on;
  const REP = reperage, QCM = qcm, SCENS = P.scenarios;
  const parc={ph:'rep', ri:0, rk:[], qi:0, qk:[], qAns:null, si:0, scens:[], dangers:[], done:false, total:0, passed:false, cand:null, t0:Date.now()};
  let repFeedback='', repLock=false, repCfgKey=null, repQKey=null, parcKey='';
  const CODE=(app.config.scorm?.code||app.config.id||'M').toUpperCase();
  const txt=v=>String(v).replace(/±/g,'+/-').replace(/≤/g,'max').replace(/≥/g,'min').replace(/·/g,'|').replace(/[\u00a0\u202f]/g,' ').replace(/[^\p{L}\p{N}.,:;\/()×+%°'| -]/gu,' ').replace(/\s+/g,' ').trim();
  const scorm=createScorm({ enabled:PARC_ON, t0:()=>parc.t0, restore:o=>Object.assign(parc,o),
    state:()=>{ const {ph,ri,rk,qi,qk,si,scens,dangers,done,total,passed}=parc; return {ph,ri,rk,qi,qk,si,scens,dangers,done,total,passed}; } });
  const repName=r=>r.name||parts.PARTS[r.k].n.toLowerCase();
  const curRep=()=>REP[Math.min(parc.ri,REP.length-1)];

  /* --- repérage --- */
  function repPick(k){ if(parc.ph!=='rep'||repLock) return; parc.cand=k; parts.select(k,true); render(); }
  function repValidate(){ const k=parc.cand; if(!k) return; parc.cand=null; repAnswer(k); }
  function repCancel(){ parc.cand=null; parts.select(null); render(); }
  function repAnswer(k){ if(parc.ph!=='rep'||repLock) return; const target=REP[parc.ri].k, ok=k===target, N=k=>parts.PARTS[k]?.n||k;
    parc.rk.push(ok?1:0); scorm.inter(`${CODE}_rep_${target}`,'choice',k||'rien',ok?'correct':'wrong');
    repFeedback= ok? `Exact : ${N(target)}.` : `Non : c'était « ${N(k)} ». Voici « ${N(target)} ».`;
    parts.select(target); repLock=true;
    setTimeout(()=>{ repLock=false; repFeedback=''; parts.select(null); parc.ri++; if(parc.ri>=REP.length){ parc.ph='qcm'; } scorm.save(); render(); }, ok?900:2200);
    render(); }
  /* au clic dans la 3D pendant le repérage : pièces et organes masqués par la transparence ignorés */
  function pick(hits){ if(!act()||parc.ph!=='rep') return false;
    const h=hits.find(h=>h.object.userData.part && !(P.ignore||[]).includes(h.object.userData.part) && !parts.hiddenByXray(h.object.userData.part));
    if(h) repPick(h.object.userData.part); return true; }

  /* --- QCM --- */
  function qcmAnswer(i){ if(parc.ph!=='qcm'||parc.qAns!==null) return; const Q=QCM[parc.qi], ok=i===Q.a; parc.qAns=i; parc.qk.push(ok?1:0);
    scorm.inter(`${CODE}_qcm_${String(parc.qi+1).padStart(2,'0')}`,'choice','abcdef'[i],ok?'correct':'wrong'); scorm.save(); render(); }
  function qcmNext(){ parc.qAns=null; parc.qi++; if(parc.qi>=QCM.length){ parc.ph='scen-intro'; parc.si=0; } scorm.save(); render(); }

  /* --- scénarios --- */
  function startScen(){ parc.ph='scen'; /* les fautes d'une tentative interrompue sont conservées */ const S=SCENS[parc.si]; ex.setMode(S.mode); stage.setView(S.view||Object.keys(stage.VIEWS)[0]); scorm.save(); render(); }
  function recordDangers(list){ if(!act()||parc.ph!=='scen') return; for(const [l,t] of (list||app.alerts())) if(l==='danger'){ const k=t.split('. ')[0].slice(0,170); if(!parc.dangers.includes(k)) parc.dangers.push(k); } }
  const criteria=m=>P.criteria(m, { dangers:parc.dangers.length, ok:parc.dangers.length===0 });
  function finishScen(){ const S=SCENS[parc.si], C=criteria(S.mode), pts=C.reduce((a,c)=>a+(c[2]?4:0),0);
    parc.scens[parc.si]={pts, crit:C.map(c=>[c[0],c[1],c[2]?1:0]), dangers:parc.dangers.slice()};
    C.forEach((c,i)=>scorm.inter(`${CODE}_s${parc.si+1}_${['c1','c2','c3','c4','securite'][i]}`, 'performance', txt(`${c[0]} : ${c[1]}`).slice(0,250)||'-', c[2]?'correct':'wrong'));
    parc.dangers.forEach((d,k)=>scorm.inter(`${CODE}_faute_s${parc.si+1}_${k+1}`,'performance',txt(d).slice(0,250)||'-','wrong'));
    parc.dangers=[]; parc.si++;
    if(parc.si<SCENS.length){ parc.ph='scen-intro'; scorm.save(); render(); return; }
    const repPts=Math.round(W_REP*sum(parc.rk)/REP.length), qcmPts=Math.round(W_QCM*sum(parc.qk)/QCM.length), scPts=parc.scens.reduce((a,s)=>a+(s?s.pts:0),0);
    const fautes=parc.scens.reduce((a,s)=>a+(s?s.dangers.length:0),0);
    parc.total=repPts+qcmPts+scPts; parc.passed=parc.total>=PASS && fautes===0; parc.done=true; parc.ph='fin';
    scorm.set('cmi.core.score.min',0); scorm.set('cmi.core.score.max',100); scorm.set('cmi.core.score.raw',parc.total);
    scorm.set('cmi.core.lesson_status',parc.passed?'passed':'failed');
    /* synthèse lisible dans les rapports : une ligne datée, et un objectif SCORM au nom de la machine */
    const now=new Date(), date=now.toLocaleDateString('fr-FR')+' '+now.toTimeString().slice(0,5);
    const bilan=`${parc.passed?'VALIDÉE':'NON VALIDÉE'} ${parc.total}/100 le ${date} · Repérage ${sum(parc.rk)}/${REP.length} · QCM ${sum(parc.qk)}/${QCM.length} · `
      +parc.scens.map((s,i)=>`S${i+1} ${s?s.pts:0}/${W_SCEN}`).join(' · ')+` · Fautes graves ${fautes}`;
    scorm.inter(`${CODE}_bilan`,'performance',txt(bilan).slice(0,250),parc.passed?'correct':'wrong');
    scorm.set('cmi.objectives.0.id',CODE); scorm.set('cmi.objectives.0.score.min',0); scorm.set('cmi.objectives.0.score.max',100);
    scorm.set('cmi.objectives.0.score.raw',parc.total); scorm.set('cmi.objectives.0.status',parc.passed?'passed':'failed');
    try{ localStorage.setItem('atelier.bilan.'+app.config.id, JSON.stringify({ total:parc.total, passed:parc.passed, date })); }catch(e){}
    scorm.save(); render(); }

  /* --- affichage --- */
  function render(){ if(!act()) return; const el=$('parcCard'); if(!el) return;
    $('app').dataset.phase=parc.ph;
    const R=curRep(), cfg=parc.ph==='rep'?R.cfg:{}, wantX=!!cfg.x, ck=parc.ph==='rep'?JSON.stringify(cfg):'none';
    /* la vue intérieure est imposée par la question (ni plus, ni moins) : remise à chaque question et à la sortie du repérage */
    const qk=parc.ph==='rep'? parc.ri+'|'+ck : ck;
    if(qk!==repQKey){ repQKey=qk; if(parts.xray!==wantX) parts.setXray(wantX,false); }
    if(ck!==repCfgKey){ const prev=repCfgKey; repCfgKey=ck; parts.setXray(wantX,false);
      if(cfg.view) stage.setView(cfg.view); else if(cfg.x) parts.setXray(true,true); else if(prev!==null) stage.setView(Object.keys(stage.VIEWS)[0]); }
    { const bar=$('repBar'); bar.hidden=parc.ph!=='rep'; if(parc.ph==='rep'){
        $('repQ').textContent=`${Math.min(parc.ri+1,REP.length)}/${REP.length} · Trouvez : ${repName(R)}`;
        const fb=$('repFb'); fb.textContent= repFeedback || (parc.cand? 'Organe en surbrillance : validez, ou touchez-en un autre.' : wantX? 'Vue en transparence : l\'organe est à l\'intérieur de la machine.' : 'Touchez l\'organe sur la machine (zoomez si besoin).');
        fb.dataset.ok= repFeedback? String(repFeedback.startsWith('Exact')) : '';
        $('repOk').disabled=!parc.cand||repLock; $('repNo').disabled=!parc.cand||repLock; $('repOk').onclick=repValidate; $('repNo').onclick=repCancel; } }
    const steps=[['rep','Repérage des organes'],['qcm',P.qcmTitle||'QCM sécurité'],...SCENS.map((s,i)=>['s'+i,'Scénario '+(i+1)+' : '+s.t.toLowerCase()])];
    const cur= parc.ph==='rep'?0 : parc.ph==='qcm'?1 : parc.ph==='fin'?99 : 2+parc.si;
    $('parcSteps').innerHTML=steps.map(([k,t],i)=>{ const state= i<cur?'done': i===cur?'cur':'lock';
      return `<li data-s="${state}"><span>${state==='done'?'✓':state==='lock'?'🔒':i+1}</span>${t}</li>`; }).join('');
    const rs=sum(parc.rk), qs=sum(parc.qk);
    if(parc.ph==='rep'){
      el.innerHTML=`<p class="pk">Repérage ${Math.min(parc.ri+1,REP.length)} / ${REP.length}</p><h3>Trouvez : ${repName(R)}</h3><p>Touchez (ou cliquez) l'organe : il passe en surbrillance. Vérifiez, puis <b>Valider</b>. Faites tourner et zoomez si besoin. Une seule réponse validée par organe.${wantX?' Cet organe est à l\'intérieur : la machine est affichée en transparence.':''}</p>${repFeedback?`<p class="fb" data-ok="${repFeedback.startsWith('Exact')}">${repFeedback}</p>`:''}<p class="pk">Bonnes réponses : ${rs} / ${parc.rk.length}</p>`; }
    else if(parc.ph==='qcm'){ const Q=QCM[parc.qi], ans=parc.qAns;
      el.innerHTML=`<p class="pk">Question ${parc.qi+1} / ${QCM.length}</p><h3>${Q.q}</h3><div class="qopts">${Q.o.map((o,i)=>`<button type="button" class="qopt" data-q="${i}" ${ans!==null?'disabled':''} data-r="${ans===null?'':i===Q.a?'ok':i===ans?'ko':''}">${'ABCDEF'[i]}. ${o}</button>`).join('')}</div>${ans!==null?`<p class="fb" data-ok="${ans===Q.a}">${ans===Q.a?'Exact. ':'Non. '}${Q.e}</p><button type="button" class="toggle" id="qNext">${parc.qi<QCM.length-1?'Question suivante':'Terminer le QCM'}</button>`:''}`;
      el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>qcmAnswer(+b.dataset.q)); const n=$('qNext'); if(n) n.onclick=qcmNext; }
    else if(parc.ph==='scen-intro'){ const S=SCENS[parc.si];
      el.innerHTML=`<p class="pk">Repérage ${rs}/${REP.length} · QCM ${qs}/${QCM.length}${parc.si?` · scénarios faits : ${parc.si}/${SCENS.length}`:''}</p><h3>Scénario ${parc.si+1} / ${SCENS.length} : ${S.t}</h3><p>${S.intro} Suivez les étapes. À l'étape « Contrôle », la pièce est mesurée, et toute faute grave de sécurité commise au moment d'une coupe est relevée : <b>une seule faute grave fait échouer le module</b>.</p><button type="button" class="toggle" id="scenGo" aria-pressed="true">Commencer le scénario ${parc.si+1}</button>`; $('scenGo').onclick=startScen; }
    else if(parc.ph==='scen'){ const last=ex.step===ex.STEPS.length-1;
      el.innerHTML=`<p class="pk">Scénario ${parc.si+1} / ${SCENS.length} · ${SCENS[parc.si].t}</p><p class="pk">Fautes graves relevées : <b>${parc.dangers.length}</b></p>${parc.dangers.map(d=>`<p class="fb" data-ok="false">${d}</p>`).join('')}<button type="button" class="toggle" id="scenEnd" ${last?'':'disabled'} aria-pressed="${last}">${parc.si<SCENS.length-1?'Valider et passer au scénario suivant':'Terminer et envoyer le résultat'}</button>${last?'':'<p class="pk">Disponible à l\'étape « Contrôle ».</p>'}`; $('scenEnd').onclick=finishScen; }
    else if(parc.ph==='fin'){ const row=(l,v)=>`<tr><td>${l}</td><td>${v}</td></tr>`;
      const repPts=Math.round(W_REP*rs/REP.length), qcmPts=Math.round(W_QCM*qs/QCM.length), all=parc.scens.flatMap(s=>s?s.dangers:[]);
      el.innerHTML=`<h3 class="verdict" data-ok="${parc.passed}">${parc.passed?'Module réussi':'Module non validé'} · ${parc.total} / 100</h3><table class="res">${row('Repérage ('+rs+'/'+REP.length+')',repPts+' / '+W_REP)}${row((P.qcmTitle||'QCM sécurité')+' ('+qs+'/'+QCM.length+')',qcmPts+' / '+W_QCM)}${SCENS.map((S,i)=>row('Scénario '+(i+1)+' : '+S.t,((parc.scens[i]||{}).pts??0)+' / '+W_SCEN)).join('')}${row('Fautes graves',String(all.length))}</table>
        ${SCENS.map((S,i)=>{ const s=parc.scens[i]; return s?`<details class="scdet"><summary>Détail scénario ${i+1}</summary><table class="res">${s.crit.map(c=>row((c[2]?'✓ ':'✗ ')+c[0],c[1])).join('')}</table></details>`:''; }).join('')}
        ${all.map(d=>`<p class="fb" data-ok="false">${d}</p>`).join('')}<p class="pk">${scorm.ok||scorm.api?'Résultat enregistré dans Moodle.':'Mode autonome : aucun Moodle détecté, le résultat n\'est pas enregistré.'} Seuil de réussite : ${PASS} / 100 sans faute grave.</p>`; }
  }
  /* rafraîchit la carte pendant un scénario (étape ou fautes changées) */
  function refresh(){ if(act() && parc.ph==='scen'){ const k=ex.step+'|'+parc.dangers.length; if(k!==parcKey){ parcKey=k; render(); } } }

  /* démarrage dans Moodle : reprise éventuelle, scénario interrompu recommencé depuis son intro */
  function start(){ scorm.init(); if(parc.ph==='scen') parc.ph='scen-intro'; P.onStart?.(); app.setUI('parcours'); if(parc.ph==='rep') parts.select(null); render(); }

  /* pendant le repérage, la vue intérieure n'est pas libre (le bouton « Vue intérieure » est caché) */
  const inRep=()=>act() && parc.ph==='rep';
  /* paquetage unique : passage entraînement ↔ évaluation. Un scénario quitté est repris depuis son introduction
     (ses fautes graves sont conservées), comme à la reprise d'une session. */
  function setActive(v){ if(!PARC_ON || v===on) return; on=v;
    if(!v){ $('repBar').hidden=true; parc.cand=null; parts.select(null); if(parts.xray) parts.setXray(false,false); return; }
    if(parc.ph==='scen') parc.ph='scen-intro'; repCfgKey=null; repQKey=null; parcKey=''; app.setUI('parcours'); if(parc.ph==='rep') parts.select(null); render(); }
  return { PARC_ON, parc, inRep, scorm, start, render, refresh, pick, recordDangers, repAnswer, finishScen, setActive, get active(){ return act(); }, QCM, REP };
}
