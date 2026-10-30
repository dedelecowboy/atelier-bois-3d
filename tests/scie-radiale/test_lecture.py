"""Confort de lecture (engine/lecture.js, 30/10/2026) : bouton « Aa » de l'en-tête, police lisible et texte aéré, taille du texte
(colonnes élargies), lecture à voix haute (🔈 lit la consigne en cours, clic sur un texte, Échap), choix gardés d'une page à l'autre ;
sur la scie radiale (présentation, exercice, parcours SCORM), sur la page atelier, et sur téléphone. La voix n'est pas entendue en
headless : on contrôle le texte envoyé à la synthèse vocale (`lecture.dernier`) et sa mise en forme pour la prononciation."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run

REGLER = r"""
 const L=window.__atelier.app? window.__atelier.app.lecture : window.__atelier.lecture;
 const parle=[]; if(window.speechSynthesis){ window.speechSynthesis.speak=u=>{ parle.push(u.text); setTimeout(()=>u.onend&&u.onend(),30); }; }
"""

async def main():
    async with Page('scie-radiale') as pg:
        r = await pg.eval(js(REGLER + r"""
          const out={ btn:$('lectBtn').textContent, lireCache:$('lectLire').hidden, voix:L.voixDispo };
          const col0=getComputedStyle($('app')).gridTemplateColumns;
          $('lectBtn').click(); out.open=!$('lectPanel').hidden && $('lectBtn').getAttribute('aria-expanded')==='true';
          $('lectPolice').click(); document.querySelector('#lectPanel [data-taille="1"]').click(); $('lectVoix').click();
          out.font=getComputedStyle(document.body).fontFamily; out.h2=getComputedStyle(document.querySelector('.right h2')).textTransform;
          out.lh=parseFloat(getComputedStyle(document.querySelector('.fiche, .parts li, p')).lineHeight)||0;
          out.col0=col0; out.col1=getComputedStyle($('app')).gridTemplateColumns; out.zoom=getComputedStyle(document.querySelector('.right')).zoom;
          out.lire=!$('lectLire').hidden; out.annonce=parle.slice(-1)[0];
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); out.ferme=$('lectPanel').hidden;
          // présentation : 🔈 lit la fiche ouverte (sinon l'étiquette de la machine)
          await sleep(100); $('lectLire').click(); out.pres=L.dernier;
          // exercice : 🔈 lit la consigne de l'étape
          $('ui-ex').click(); await sleep(200); $('lectLire').click(); await sleep(80); out.ex=L.dernier; out.stepT=$('stepT').innerText;
          // clic sur un texte d'un panneau : il est lu, surligné pendant la lecture
          const p=$('stepC'); p.click(); out.clic=L.dernier; out.clicTxt=p.innerText; out.actif=p.classList.contains('lect-actif')||parle.length>0;
          // clic sur un bouton : rien n'est lu
          const n=parle.length; $('stepNext').click(); out.bouton=parle.length===n;
          out.store=JSON.parse(localStorage.getItem('atelier.lecture'));
          return out;"""))
        check(r['btn'] == 'Aa' and r['lireCache'], 'bouton « Aa » dans l\'en-tête, « 🔈 Lire » caché tant que la voix n\'est pas activée')
        check(r['open'] and r['ferme'], 'panneau « Confort de lecture » ouvert au clic, fermé par Échap')
        check('Verdana' in r['font'] and r['h2'] == 'none' and r['lh'] >= 20, f'police lisible : {r["font"][:30]}…, titres sans majuscules forcées, interligne {r["lh"]} px')
        c0, c1 = [float(x[:-2]) for x in r['col0'].split()[::2]], [float(x[:-2]) for x in r['col1'].split()[::2]]
        check(r['zoom'] == '1.15' and c1[0] > c0[0] * 1.1 and c1[-1] > c0[-1] * 1.1, f'texte grand : panneaux ×1,15, colonnes élargies {r["col0"]} → {r["col1"]}')
        check(r['lire'] and r['annonce'] and 'activée' in r['annonce'], f'voix activée : bouton « 🔈 Lire » affiché, annonce « {r["annonce"]} »')
        check(len(r['pres']) > 10, f'présentation : 🔈 lit « {r["pres"][:60]}… »')
        check(r['stepT'].split()[0] in r['ex'], f'exercice : 🔈 lit la consigne de l\'étape « {r["ex"][:70]}… »')
        check(r['clic'] and r['clic'][:15] == r['clicTxt'].replace('\n', ' ')[:15] and r['actif'], 'clic sur un texte : il est lu')
        check(r['bouton'], 'clic sur un bouton : rien n\'est lu')
        check(r['store'] == {'police': True, 'taille': 1, 'voix': True, 'lent': False}, f'choix gardés dans le navigateur : {r["store"]}')
        check(not pg.errors, 'aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('lecture_ex_1400.png'))
        # rechargement : les choix suivent l'élève (même navigateur)
        await pg.page.reload(); await pg.page.wait_for_function('window.__atelier && window.__atelier.app'); await pg.page.wait_for_timeout(300)
        r2 = await pg.eval("()=>({ p:document.documentElement.dataset.lectPolice, t:document.documentElement.dataset.lectTaille, lire:!document.getElementById('lectLire').hidden })")
        check(r2 == {'p': '1', 't': '1', 'lire': True}, f'après rechargement : police, taille et voix retrouvées {r2}')

    # prononciation : unités et symboles écrits pour être lus
    async with Page('scie-radiale') as pg:
        r = await pg.eval(js(r"""const L=window.__atelier.app.lecture; const out=[];
          for(const t of ['Lame Ø 400, 3 000 tr/min, inclinée à 45°', 'Tenon 9 × 40 à 9 mm de SR1', 'Niveau ≥ 85 dB(A) ± 2', 'Avance 12 m/min']){ L.dire(t); out.push(L.dernier); }
          return out;"""))
        check(r[0] == 'Lame diamètre 400, 3 000 tours par minute, inclinée à 45 degrés' and r[1] == 'Tenon 9 par 40 à 9 millimètres de S R 1'
              and 'supérieur ou égal à 85 décibels A plus ou moins 2' in r[2] and r[3] == 'Avance 12 mètres par minute', f'prononciation : {r}')

    # parcours évalué (SCORM) : 🔈 lit la question en cours
    async with Page('scie-radiale', scorm=True, init="try{localStorage.setItem('atelier.lecture', JSON.stringify({police:false,taille:0,voix:true,lent:true}))}catch(e){}") as pg:
        r = await pg.eval(js(r"""const L=window.__atelier.app.lecture; $('lectLire').click(); await sleep(50);
          return { t:L.dernier, card:(document.getElementById('repBar').hidden? $('parcCard').innerText : $('repQ').innerText), lent:L.prefs.lent };"""))
        check(r['t'] and 'Trouvez' in r['t'] and r['lent'], f'parcours : 🔈 lit la question du repérage « {r["t"][:60]}… » (voix lente ; carte : « {r["card"][:40]}… »)')
        check(not pg.errors, 'parcours : aucune erreur ' + '; '.join(pg.errors))

    # téléphone
    async with Page('scie-radiale', viewport=(412, 915), touch=True) as pg:
        r = await pg.eval(js(r"""$('lectBtn').click(); document.querySelector('#lectPanel [data-taille="2"]').click(); $('lectPolice').click(); await sleep(200);
          const b=$('lectPanel').getBoundingClientRect(); return { l:b.left, r:b.right, w:innerWidth, sw:document.documentElement.scrollWidth };"""))
        check(r['l'] >= 0 and r['r'] <= r['w'] + 1 and r['sw'] <= r['w'] + 1, f'téléphone : panneau dans l\'écran ({r["l"]:.0f} → {r["r"]:.0f} / {r["w"]}), pas de défilement horizontal ({r["sw"]})')
        print('   capture', await pg.shot('lecture_412.png'))
        check(not pg.errors, 'téléphone : aucune erreur ' + '; '.join(pg.errors))

    # page atelier : même panneau, 🔈 lit la fiche du poste ouvert
    async with Page('atelier') as pg:
        r = await pg.eval(js(REGLER + r"""
          $('lectBtn').click(); $('lectVoix').click(); document.querySelector('#lectPanel [data-taille="1"]').click(); $('lectFin').click();
          document.querySelector('#postes button').click(); await sleep(1200);
          $('lectLire').click(); await sleep(50);
          return { t:L.dernier, card:$('card').innerText, col:getComputedStyle($('at')).gridTemplateColumns };"""))
        check(r['t'] and 'risques généraux' in r['t'].lower() and 'fois' not in r['t'], f'atelier : 🔈 lit la fiche du poste « {r["t"][:60]}… » (fiche « {r["card"][:30]!r} »)')
        check(r['col'].startswith('308'), f'atelier : colonne des postes élargie ({r["col"]})')
        check(not pg.errors, 'atelier : aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('lecture_atelier_1400.png'))

if __name__ == '__main__': run(main)
