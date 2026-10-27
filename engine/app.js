/* Assemblage d'un module machine.

   const app = createApp(config, {organes, qcm, reperage});   // textes bruts des fichiers de données
   …la machine construit son modèle avec app.parts.tagPart, app.stage.root…
   app.start(hooks);

   hooks (fournis par la machine) :
     update()            met à jour la simulation et la 3D d'après l'état (appelé par app.apply)
     alerts()            alertes actives [[niveau, texte], …]
     steps               {mode: [étapes]} pour les modes guidés
     loadMode(mode)      prépare la pièce et la machine pour un mode
     tick(dt, now)       animation à chaque image
     panelKey()          (facultatif) valeur qui force le rafraîchissement du panneau quand elle change
     onPanel()           (facultatif) appelé quand le panneau est redessiné
     renderExtra()       (facultatif) panneaux propres à la machine (pièces débitées…)
     onPick(hit)         (facultatif) clic dans la 3D ; rendre true si la machine l'a traité
     onContextRestored() (facultatif) après une perte de contexte WebGL
     (app.families : panneaux de réglage par famille, posés par initFamilies, engine/families.js)
     parcours            {scenarios:[{mode,t,intro,view}], criteria(mode,{dangers,ok}), onStart(), ignore:[codes]} */
import { createStage } from './stage.js';
import { createParts } from './parts.js';
import { createExercise } from './exercise.js';
import { createParcours } from './parcours.js';
import { parseOrganes, parseQcm, parseReperage, checkData } from './data.js';
import { moodleNav, pkg } from './moodlenav.js';

const $ = id=>document.getElementById(id);

export function createApp(config, raw){
  const organes=parseOrganes(raw.organes), qcm=parseQcm(raw.qcm), reperage=parseReperage(raw.reperage, config.views);
  checkData({organes, reperage});
  const stage=createStage(config.views);
  const parts=createParts(stage, organes, config);
  const ex=createExercise(config.modes);
  let H=null, parc=null;

  const app={ config, stage, parts, ex, data:{organes, qcm, reperage},
    toast:stage.toast,
    get parcours(){ return parc; },
    alerts:()=>H.alerts(),
    recordDangers:list=>parc?.recordDangers(list),
    /* recalcul complet : simulation, 3D, panneaux */
    apply(){ stage.dirty(); H.update(); H.renderExtra?.(); parc?.refresh(); ex.render(); },
    /* disposition : pres (nomenclature | 3D | réglages), ex (3D | consigne + dock), parcours (SCORM) */
    setUI(u){ $('app').dataset.ui=u; ($(u==='pres'?'presSlot':'dockSlot')).appendChild($('settings'));
      document.querySelectorAll('[data-ui]').forEach(b=>{ if(b.tagName==='BUTTON') b.setAttribute('aria-pressed',String(b.dataset.ui===u)); }); ex.invalidate(); app.apply(); },
    start(hooks){ H=hooks;
      ex.bind({ ...hooks, apply:app.apply, onAlerts:a=>app.families?.update(a) });
      parc=createParcours(app, {reperage, qcm}, hooks.parcours||{scenarios:[]});
      parts.onPick(hits=>{ if(parc.pick(hits)) return true; const hit=hits.find(h=>h.object.userData.part); if(hooks.onPick?.(hit)) return true;
        if(hit) app.families?.reveal(hit.object.userData.part); return false; });   // organe touché : son panneau de réglage s'ouvre
      /* boutons des vues ; une vue peut imposer la vue intérieure (avec un message) */
      /* pendant le repérage du parcours, la vue ne fait que déplacer la caméra : la transparence reste celle de la question */
      for(const v of config.views) if(!v.hidden) $(v.id).onclick=()=>{ stage.setView(v.id); if(v.xray&&!parts.xray&&!parc.inRep()){ parts.setXray(true,false); if(v.toast) stage.toast(v.toast); } };
      document.querySelectorAll('button[data-ui]').forEach(b=>b.onclick=()=>app.setUI(b.dataset.ui));
      ex.setMode(config.modes[0].id); app.setUI('pres');
      if(parc.PARC_ON) parc.start();
      /* paquetage « Atelier bois 3D » : retour à l'atelier par le sommaire de Moodle (la progression est enregistrée à la sortie) */
      /* paquetage unique : à l'entrée, l'élève choisit S'entraîner (présentation + exercices, rien d'enregistré)
         ou l'évaluation (parcours noté) ; un bouton de l'en-tête passe de l'un à l'autre */
      if(pkg() && parc.PARC_ON){ const sw=$('modeSwitch'), P=parc.parc;
        const train=on=>{ $('choice').hidden=true; sw.hidden=false; sw.dataset.train=String(on);
          sw.textContent= on? 'Passer l\'évaluation' : 'S\'entraîner';
          if(on){ parc.setActive(false); ex.setMode(config.modes[0].id); app.setUI('pres'); } else parc.setActive(true); };
        $('chTitle').textContent=config.title;
        if(P.done){ $('chEvalT').textContent='Voir mon résultat'; $('chEvalS').textContent=`Évaluation terminée : ${P.total} / 100, ${P.passed?'machine validée':'machine non validée'}.`; }
        else if(P.ph!=='rep' || P.rk.length){ $('chEvalT').textContent='Reprendre l\'évaluation'; }
        $('chTrain').onclick=()=>train(true); $('chEval').onclick=()=>train(false); sw.onclick=()=>train(sw.dataset.train!=='true');
        parc.setActive(false); $('choice').hidden=false; }
      if(pkg()){ const b=$('toAtelier'); b.hidden=false;
        b.onclick=()=>{ parc.scorm?.save?.(); if(!moodleNav(pkg().atelier,{ before:()=>parc.scorm?.finish?.() })) stage.toast(`Choisissez « ${pkg().atelier} » dans le sommaire du cours.`); }; }
      stage.run(hooks.tick||(()=>{}));
      stage.onContext(()=>{ hooks.onContextRestored?.(); app.apply(); });
      /* poignée pour les tests automatiques */
      window.__atelier={ app, get parc(){ return parc.parc; }, repAnswer:parc.repAnswer, finishScen:parc.finishScen, QCM:parc.QCM, REP_TARGETS:parc.REP.map(r=>r.k) };
      window.__ready=true; } };
  return app;
}
