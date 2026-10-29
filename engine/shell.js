/* Squelette HTML commun, produit au moment de la fabrication (tools/build.mjs) à partir de la
   configuration de la machine et de ses fragments HTML (réglages, dock, panneau d'exercice, pupitre).
   pupitre.html (facultatif) : commandes de marche (agir), barre posée en bas de la vue 3D, fixée en bas de l'écran sur téléphone. */
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

export function renderShell(c, frag){
  const modes = c.modes.map(m=>`<button class="toggle" type="button" data-mode="${m.id}" id="m-${m.btnId||m.id}" title="${esc(m.title)}">${m.label}</button>`).join('');
  const views = c.views.filter(v=>!v.hidden).map(v=>`<button id="${v.id}" type="button"${v.title?` title="${esc(v.title)}"`:''}>${v.label}</button>`).join('');
  return `<div class="app${frag.pupitre?' has-pup':''}" id="app" data-ui="pres">
  <header class="top">
    <div class="brand"><button class="toggle back-atelier" type="button" id="toAtelier" hidden title="Revenir à l'atelier (votre progression est enregistrée)">← Atelier</button><button class="toggle mode-switch" type="button" id="modeSwitch" hidden></button><h1>${c.title}</h1></div>
    <div class="seg2" role="group" aria-label="Mode d'affichage"><button class="toggle" type="button" data-ui="pres" id="ui-pres">Présentation</button><button class="toggle" type="button" data-ui="ex" id="ui-ex">Exercice</button></div>
    <div class="exsel" role="group" aria-label="Exercice">${modes}</div>
    <div class="views">${views}<button id="fs" type="button" class="fs-btn" aria-pressed="false" title="Afficher en plein écran (Échap pour quitter)" aria-label="Plein écran">⛶</button></div>
  </header>
  <aside class="left" id="left">
    <div class="ltabs" id="ltabs" role="tablist" hidden><button type="button" role="tab" class="ltab" data-lt="fiches" id="lt-fiches">Fiches <span id="fichesN"></span></button><button type="button" role="tab" class="ltab" data-lt="parts" id="lt-parts">Nomenclature</button></div>
    <section class="fiches-box" id="fichesBox" hidden aria-label="Fiches de la machine"></section>
    <h2 class="lt-parts">Nomenclature</h2>
    <ul class="parts lt-parts" id="parts"></ul>
    ${c.note?`<p class="note">${c.note}</p>`:''}
  </aside>
  <div class="stage">
    <canvas id="c" aria-label="${esc(c.canvasLabel)}"></canvas>
    <div class="toast" id="toast" role="status" hidden></div>
    <div class="choice" id="choice" hidden><div class="choice-card">
      <h2 id="chTitle"></h2>
      <div class="choice-opts">
        <button type="button" class="choice-opt" id="chTrain"><b>S'entraîner</b><span>Présentation de la machine et exercices guidés. Rien n'est noté ni enregistré.</span></button>
        <button type="button" class="choice-opt main" id="chEval"><b id="chEvalT">Passer l'évaluation</b><span id="chEvalS">Repérage des organes, QCM sécurité et 3 scénarios notés. Une seule faute grave et la machine n'est pas validée.</span></button>
      </div></div></div>
    <div class="repbar" id="repBar" hidden><p id="repQ"></p><p id="repFb"></p><div class="repbtn"><button type="button" class="toggle" id="repOk" aria-pressed="true">Valider</button><button type="button" class="toggle" id="repNo">Annuler</button></div></div>
    <div class="lost" id="lost" hidden><p>L'affichage 3D a été interrompu par la carte graphique.</p><button class="toggle" id="relaunch" type="button">Relancer l'affichage</button></div>
    <div class="tag"><div class="chip" id="info"><b>${c.info.title}</b><span>${c.info.text}</span></div></div>
  </div>
  ${frag.pupitre?`<div class="pupitre" id="pupitre" role="group" aria-label="Pupitre de commande">${frag.pupitre}</div>`:''}
  <aside class="right" id="right">
    <div id="parcoursPanel" class="parc"><h2>${c.parcoursTitle}</h2><ol class="parc-steps" id="parcSteps"></ol><div class="parc-card" id="parcCard"></div></div>
    <div id="exPanel">
      <div class="step" id="stepCard">
        <div class="step-head"><span id="stepK"></span><span id="stepN"></span></div>
        <h3 id="stepT"></h3>
        <p id="stepC"></p>
        <ul class="checks" id="stepChecks"></ul>
        <div id="stepRes"></div>
        <p class="step-ok" id="stepOk" hidden>Étape réussie.</p>
        <div class="row" id="stepNav"><button class="toggle" type="button" id="stepPrev">Précédent</button><button class="toggle" type="button" id="stepNext">Étape suivante</button><button class="toggle" type="button" id="stepRestart">Recommencer</button></div>
      </div>
      <ul class="alerts" id="alerts" role="status"></ul>
      ${frag.panel||''}
    </div>
    <div id="presSlot"><h2>Réglages</h2></div>
  </aside>
  <div class="dock" id="dock">
    ${frag.dock||'<div></div>'}
    <div id="dockSlot"><h2>Machine</h2></div>
  </div>
</div>
<div class="settings" id="settings">
${frag.settings||''}
</div>`;
}
