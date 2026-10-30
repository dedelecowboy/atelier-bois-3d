/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* Exercices guidés : modes (libre ou par étapes), carte de consigne avec contrôles cochés,
   navigation entre étapes, tableau de résultats, liste d'alertes.

   Les modes (id, libellé, texte du mode libre) viennent de la configuration de la machine ;
   les étapes de chaque mode guidé sont fournies par la machine (hooks.steps[mode]).
   Une étape : { k:'Coupe 1', t:'Titre', c:'Consigne', cut:'A' (facultatif),
                 checks:[[libellé, ()=>bool], …], done:(étape)=>bool,
                 results:()=>({rows:[[libellé, valeur, ok], …]} | {msg:'…'}) (facultatif) }
   Une alerte : [niveau, texte, panneau] avec niveau 'danger' | 'warn' | 'info' ; panneau (facultatif) : data-key
   de la section de réglages (engine/families.js) qui l'affiche aussi. */

const $ = id=>document.getElementById(id);

export function createExercise(modes){
  const MODES = Object.fromEntries(modes.map(m=>[m.id,m]));
  const ex = { mode:modes[0].id, step:0, STEPS:[], panelKey:'',
    flash:{msg:'', level:'warn'},           // message ponctuel affiché en tête des alertes
    get def(){ return MODES[this.mode]; },
    get free(){ return !H?.steps?.[this.mode]; },
    invalidate(){ this.panelKey=''; } };
  let H = null; // crochets de la machine, fournis par bind()

  ex.bind = hooks=>{ H=hooks;
    document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>ex.setMode(b.dataset.mode));
    $('stepNext').onclick=()=>{ if(ex.step<ex.STEPS.length-1){ ex.step++; ex.invalidate(); H.apply(); } };
    $('stepPrev').onclick=()=>{ if(ex.step>0){ ex.step--; ex.invalidate(); H.apply(); } };
    $('stepRestart').onclick=()=>ex.setMode(ex.mode); };

  ex.setMode = m=>{ ex.mode=m; ex.step=0; ex.flash.msg=''; ex.STEPS=H.steps?.[m]||[];
    H.loadMode(m);
    document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
    ex.invalidate(); H.apply(); };

  const row=(l,v,ok)=>`<tr><td>${l}</td><td>${v}</td><td style="color:var(--${ok?'ok':'danger'})">${ok?'✓':'✗'}</td></tr>`;

  ex.render = ()=>{
    const alerts=H.alerts(); H.onAlerts?.(alerts); if(ex.flash.msg) alerts.unshift([ex.flash.level,ex.flash.msg]);
    let S=null, checks=[], done=false, res=null;
    if(!ex.free){ S=ex.STEPS[ex.step]; checks=S.checks.map(([t,f])=>[t,!!f()]); done=S.done(S); if(S.results) res=S.results(); }
    const key=JSON.stringify([ex.mode,ex.step,checks,done,alerts,res,H.panelKey?.()]);
    if(key===ex.panelKey) return; ex.panelKey=key;
    H.onPanel?.();
    if(ex.free){ const F=ex.def.free; $('stepK').textContent=F.k; $('stepN').textContent=''; $('stepT').textContent=F.t;
      $('stepC').textContent=F.c; $('stepChecks').innerHTML=''; $('stepRes').innerHTML=''; $('stepOk').hidden=true; $('stepNav').hidden=true; }
    else { $('stepNav').hidden=false; $('stepK').textContent=S.k; $('stepN').textContent=`Étape ${ex.step+1} / ${ex.STEPS.length}`; $('stepT').textContent=S.t; $('stepC').textContent=S.c;
      $('stepChecks').innerHTML=checks.map(([t,ok])=>`<li data-ok="${ok}">${t}</li>`).join('');
      $('stepOk').hidden=!done; $('stepNext').disabled=!done||ex.step===ex.STEPS.length-1; $('stepPrev').disabled=ex.step===0;
      $('stepRes').innerHTML= !res? '' : res.msg? `<p>${res.msg}</p>` : `<table class="res">${res.rows.map(r=>row(...r)).join('')}</table>`; }
    $('alerts').innerHTML=alerts.length? alerts.map(([l,t])=>`<li data-l="${l}">${t}</li>`).join('') : '<li data-l="ok">Aucune alerte : réglages cohérents.</li>'; };

  return ex;
}
