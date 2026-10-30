/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
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
     onPick(hit,hits)    (facultatif) clic dans la 3D (hit : premier organe touché ; hits : tout ce que le rayon traverse) ; rendre true si la machine l'a traité
     onContextRestored() (facultatif) après une perte de contexte WebGL
     bruit               (facultatif) {niveaux:{vide,coupe,rpm}, etat()} : son synthétisé, sonomètre dB(A), casque antibruit (engine/audio.js) ;
                         la machine signale les bruits courts par app.bruit.bang('au'|'choc'|'coup'|'rejet')
     (app.families : panneaux de réglage par famille, posés par initFamilies, engine/families.js)
     parcours            {scenarios:[{mode,t,intro,view}], criteria(mode,{dangers,ok}), onStart(), ignore:[codes]} */
import { createStage } from './stage.js';
import { createParts } from './parts.js';
import { createExercise } from './exercise.js';
import { createParcours } from './parcours.js';
import { parseOrganes, parseQcm, parseReperage, parseFiches, checkData } from './data.js';
import { createFiches } from './fiches.js';
import { moodleNav, pkg, pkgLock } from './moodlenav.js';
import { createBruit } from './audio.js';
import { createLecture } from './lecture.js';

const $ = id=>document.getElementById(id);

export function createApp(config, raw){
  const organes=parseOrganes(raw.organes), qcm=parseQcm(raw.qcm), reperage=parseReperage(raw.reperage, config.views);
  const fiches=raw.fiches? parseFiches(raw.fiches) : [];   // fiches de la présentation (lecture obligatoire avant l'évaluation)
  checkData({organes, reperage});
  const stage=createStage(config.views, config.stage);
  const parts=createParts(stage, organes, config);
  const ex=createExercise(config.modes);
  const lecture=createLecture({ onChange:()=>stage.dirty() });   // confort de lecture (police, taille, voix) : bouton « Aa » de l'en-tête
  let H=null, parc=null;

  const app={ config, stage, parts, ex, lecture, data:{organes, qcm, reperage, fiches},
    toast:stage.toast,
    get parcours(){ return parc; },
    alerts:()=>H.alerts(),
    recordDangers:list=>parc?.recordDangers(list),
    /* recalcul complet : simulation, 3D, panneaux */
    apply(){ stage.dirty(); H.update(); H.renderExtra?.(); parc?.refresh(); ex.render(); },
    /* disposition : pres (nomenclature | 3D | réglages), ex (3D | consigne + dock), parcours (SCORM) */
    setUI(u){ $('app').dataset.ui=u; ($(u==='pres'?'presSlot':'dockSlot')).appendChild($('settings'));
      document.querySelectorAll('[data-ui]').forEach(b=>{ if(b.tagName==='BUTTON') b.setAttribute('aria-pressed',String(b.dataset.ui===u)); }); ex.invalidate(); app.apply(); },
    start(hooks){
      /* bruit (engine/audio.js) : sonomètre et son ; alerte « attention » au-dessus de 85 dB(A) sans casque, ajoutée aux alertes de la machine */
      if(hooks.bruit){ app.bruit=createBruit(app, hooks.bruit); const al=hooks.alerts; hooks={ ...hooks, alerts:()=>{ const a=al(), b=app.bruit.alerte(); return b? a.concat([b]) : a; } }; }
      H=hooks;
      ex.bind({ ...hooks, apply:app.apply, onAlerts:a=>app.families?.update(a) });
      parc=createParcours(app, {reperage, qcm}, hooks.parcours||{scenarios:[]});
      parts.onPick(hits=>{ if(parc.pick(hits)) return true; const hit=hits.find(h=>h.object.userData.part); if(hooks.onPick?.(hit,hits)) return true;
        if(hit) app.families?.reveal(hit.object.userData.part); return false; });   // organe touché : son panneau de réglage s'ouvre
      /* boutons des vues ; une vue peut imposer la vue intérieure (avec un message) */
      /* pendant le repérage du parcours, la vue ne fait que déplacer la caméra : la transparence reste celle de la question */
      for(const v of config.views) if(!v.hidden) $(v.id).onclick=()=>{ stage.setView(v.id); if(v.xray&&!parts.xray&&!parc.inRep()){ parts.setXray(true,false); if(v.toast) stage.toast(v.toast); } };
      document.querySelectorAll('button[data-ui]').forEach(b=>b.onclick=()=>app.setUI(b.dataset.ui));
      ex.setMode(config.modes[0].id); app.setUI('pres');
      if(parc.PARC_ON) parc.start();
      /* fiches de la machine : onglet « Fiches » de la colonne de gauche (ou le conteneur donné par hooks.fiches.el) ;
         lues après la reprise de suspend_data (parc.start). L'onglet s'ouvre sur les fiches tant qu'elles ne sont pas toutes lues. */
      app.fiches=createFiches(app, parc);
      if(app.fiches.list.length){
        if(hooks.fiches?.el) app.fiches.mount($(hooks.fiches.el), hooks.fiches);
        else { const tabs=$('ltabs'), setLt=t=>{ $('app').dataset.lt=t; $('fichesBox').hidden=t!=='fiches';
              tabs.querySelectorAll('.ltab').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.lt===t))); stage.resize?.(); stage.dirty(); };
          tabs.hidden=false; tabs.querySelectorAll('.ltab').forEach(b=>b.onclick=()=>setLt(b.dataset.lt));
          app.fiches.mount($('fichesBox'), hooks.fiches||{}); setLt(app.fiches.need()?'fiches':'parts'); app.showFiches=()=>setLt('fiches'); }
        if(parc.PARC_ON){ app.fiches.onChange(()=>parc.render()); parc.render(); } }
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
        /* évaluation fermée (l'entraînement reste ouvert) : version avec verrous, tant que l'élément précédent n'est pas réussi ;
           et tant que les fiches de la machine ne sont pas toutes lues (lecture obligatoire, demandé par l'enseignant le 29/10/2026).
           Une évaluation déjà commencée ou terminée n'est jamais bloquée. */
        const def={ t:$('chEvalT').textContent, s:$('chEvalS').textContent };
        const evalLock=()=>{ if(P.done || P.ph!=='rep' || P.rk.length) return null;
          const lockBy=pkgLock(config.id);
          if(lockBy){ const n=(pkg().titles[lockBy]||lockBy).replace(/^\d+\.\s*/,'');
            return { t:'🔒 Évaluation verrouillée', s:`Réussissez d'abord l'évaluation « ${n} ». Vous pouvez vous entraîner sur cette machine en attendant.` }; }
          if(app.fiches.need()) return { t:'🔒 Lisez d\'abord les fiches', s:`Fiches lues : ${app.fiches.count()} / ${app.fiches.list.length}. Choisissez « S'entraîner » : les fiches de la machine sont dans la présentation, onglet « Fiches ».` };
          return null; };
        const refreshChoice=()=>{ const L=evalLock(); $('chEval').disabled=!!L; $('chEvalT').textContent=L?L.t:def.t; $('chEvalS').textContent=L?L.s:def.s; };
        refreshChoice(); app.fiches.onChange(refreshChoice);
        $('chTrain').onclick=()=>{ train(true); if(app.fiches.need()) app.showFiches?.(); }; $('chEval').onclick=()=>train(false);
        sw.onclick=()=>{ refreshChoice(); if(sw.dataset.train==='true' && $('chEval').disabled){ stage.toast($('chEvalS').textContent); if(app.fiches.need()) app.showFiches?.(); return; } train(sw.dataset.train!=='true'); };
        parc.setActive(false); $('choice').hidden=false; }
      if(window.ATELIER_LOCAL){ const b=$('toAtelier'); b.hidden=false; b.title='Revenir à l\'atelier'; b.onclick=()=>{ location.href='../index.html'; }; }   // dossier d'entraînement hors ligne
      if(pkg()){ const b=$('toAtelier'); b.hidden=false;
        b.onclick=()=>{ parc.scorm?.save?.(); if(!moodleNav(pkg().atelier,{ before:()=>parc.scorm?.finish?.() })) stage.toast(`Choisissez « ${pkg().atelier} » dans le sommaire du cours.`); }; }
      stage.run((dt,now)=>{ hooks.tick?.(dt,now); app.bruit?.tick(); });
      stage.onContext(()=>{ hooks.onContextRestored?.(); app.apply(); });
      /* poignée pour les tests automatiques */
      window.__atelier={ app, get bruit(){ return app.bruit; }, get parc(){ return parc.parc; }, repAnswer:parc.repAnswer, finishScen:parc.finishScen, QCM:parc.QCM, REP_TARGETS:parc.REP.map(r=>r.k) };
      window.__ready=true; } };
  return app;
}
