/* Squelette HTML commun, produit au moment de la fabrication (tools/build.mjs) à partir de la
   configuration de la machine et de ses fragments HTML (réglages, dock, panneau d'exercice). */
const esc = s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

export function renderShell(c, frag){
  const modes = c.modes.map(m=>`<button class="toggle" type="button" data-mode="${m.id}" id="m-${m.btnId||m.id}" title="${esc(m.title)}">${m.label}</button>`).join('');
  const views = c.views.filter(v=>!v.hidden).map(v=>`<button id="${v.id}" type="button"${v.title?` title="${esc(v.title)}"`:''}>${v.label}</button>`).join('');
  return `<div class="app" id="app" data-ui="pres">
  <header class="top">
    <div class="brand"><h1>${c.title}</h1></div>
    <div class="seg2" role="group" aria-label="Mode d'affichage"><button class="toggle" type="button" data-ui="pres" id="ui-pres">Présentation</button><button class="toggle" type="button" data-ui="ex" id="ui-ex">Exercice</button></div>
    <div class="exsel" role="group" aria-label="Exercice">${modes}</div>
    <div class="views">${views}<button id="fs" type="button" class="fs-btn" aria-pressed="false" title="Afficher en plein écran (Échap pour quitter)" aria-label="Plein écran">⛶</button></div>
  </header>
  <aside class="left" id="left">
    <h2>Nomenclature</h2>
    <ul class="parts" id="parts"></ul>
    ${c.note?`<p class="note">${c.note}</p>`:''}
  </aside>
  <div class="stage">
    <canvas id="c" aria-label="${esc(c.canvasLabel)}"></canvas>
    <div class="toast" id="toast" role="status" hidden></div>
    <div class="repbar" id="repBar" hidden><p id="repQ"></p><p id="repFb"></p><div class="repbtn"><button type="button" class="toggle" id="repOk" aria-pressed="true">Valider</button><button type="button" class="toggle" id="repNo">Annuler</button></div></div>
    <div class="lost" id="lost" hidden><p>L'affichage 3D a été interrompu par la carte graphique.</p><button class="toggle" id="relaunch" type="button">Relancer l'affichage</button></div>
    <div class="tag"><div class="chip" id="info"><b>${c.info.title}</b><span>${c.info.text}</span></div></div>
  </div>
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
