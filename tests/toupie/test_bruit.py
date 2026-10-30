"""Toupie : bruit (engine/audio.js). Les tests headless n'entendent rien : on vérifie les valeurs calculées.
- son coupé par défaut (🔇), choix gardé dans le navigateur (localStorage « atelier.son ») ;
- sonomètre : fond de la salle à l'arrêt, niveau à vide au régime, plus fort en coupe (passe forte, bois dur plus fort encore) ;
- casque antibruit : niveau « à l'oreille » diminué de 25 dB (SNR 30 − décote INRS 5) ;
- alerte « attention » (pas une faute) au-dessus de 85 dB(A) en marche sans casque, plus avec le casque ;
- son activé : AudioContext créé au clic, aucune erreur ; sans AudioContext : message, sonomètre toujours là, aucune erreur ;
- aspiration (commune à toutes les machines) : niveau propre, ventilateur qui monte et ralentit ; sur une autre machine (raboteuse) :
  bouton du son et aspiration, pas de sonomètre (mortaiseuse) ;
- banc d'écoute dist/Ecoute_bruit.html : se lance, son, moteur, passe, éditeur des sons (curseurs entendus tout de suite, texte à copier, retour aux réglages actuels), aucune erreur ;
- captures ordinateur et téléphone avec le sonomètre visible."""
import os, sys, asyncio
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import BASE

NOISE = r"""
 const Bz=()=>window.__atelier.bruit, calc=()=>Bz().calc();
 const settle=async()=>{ let n=0; while(Math.abs(Bz().shown-calc().total)>0.3&&n<60){ await sleep(100); n++; } };
 const shown=()=>+$('sonoV').textContent, ear=()=>+$('sonoO').textContent;
 const noiseAlert=()=>alerts().find(a=>a.includes('BRUIT'));
"""

async def main():
    async with Page('toupie') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + NOISE + r"""
          const out={};
          out.def={ on:Bz().on, btn:$('sndBtn').textContent, hidden:$('snd').hidden, vol:$('sndVol').hidden, ctx:!!Bz().ctx, sono:!!$('sono') };
          await settle(); out.arret={ total:calc().total, shown:shown(), alert:!!noiseAlert() };
          on('asp'); on2('push'); orientTo('F1','C2');
          await start(); await settle(); out.vide={ total:calc().total, moteur:calc().moteur, shown:shown(), alert:noiseAlert()||'' };
          // en coupe : niveau calculé pendant la passe (quart de rond R 10 dans le sapin)
          $('pass').click(); let n=0, mx={total:0}; while(T.cut.inProgress&&n<400){ await sleep(100); n++; const c=calc(); if(c.total>mx.total) mx={total:c.total, charge:c.e.charge, cut:c.e.cut, alert:noiseAlert()||'', shown:shown()}; }
          out.coupe=mx;
          // casque : à l'oreille −25 dB, plus d'alerte
          $('casque').click(); await sleep(150); out.casque={ ambiant:calc().total, oreille:calc().oreille, ear:ear(), shown:shown(), alert:!!noiseAlert(), pressed:$('casque').getAttribute('aria-pressed') };
          $('casque').click(); await sleep(100); out.sansCasque=!!noiseAlert()===false;   // à vide (84) : pas d'alerte
          // arrêt : l'outil tourne encore (frein), le niveau redescend
          off('motor'); out.frein={ spin:T.model.spin, total:calc().total, mi:Bz().niveau({on:false,rpm:9000,spin:0.5,cut:0,dents:2}).total };   // juste après l'arrêt (le frein en headless dépend du rythme des images)
          await stop(); off('asp'); { let n=0; while(Bz().asp>0&&n<150){ await sleep(100); n++; } } await settle(); out.fin={ total:calc().total, shown:shown() };   // aspiration arrêtée aussi (le ventilateur ralentit)
          return out;"""))
        d = r['def']
        check(not d['on'] and d['btn'] == '🔇' and not d['hidden'] and d['vol'] and not d['ctx'], f'son coupé par défaut (bouton {d["btn"]}, pas d\'AudioContext créé)')
        check(d['sono'], 'sonomètre présent sur la vue 3D')
        check(abs(r['arret']['total'] - 45) < 0.5 and r['arret']['shown'] == 45 and not r['arret']['alert'], f'arrêt : fond de la salle {r["arret"]["total"]:.1f} dB(A), affiché {r["arret"]["shown"]}')
        v = r['vide']
        check(83.5 <= v['total'] <= 85 and abs(v['shown'] - v['total']) <= 1 and not v['alert'], f'à vide (9 000 tr/min) avec l\'aspiration : {v["total"]:.1f} dB(A), affiché {v["shown"]}, pas d\'alerte')
        c = r['coupe']
        check(c['total'] >= 92 and c['total'] <= 100, f'en coupe : {c["total"]:.1f} dB(A) (charge {c.get("charge",0):.2f})')
        check('BRUIT' in c['alert'] and c['alert'].startswith('warn'), 'en coupe sans casque : alerte « attention » ' + c['alert'][:70])
        k = r['casque']
        check(k['pressed'] == 'true' and abs((k['ambiant'] - k['oreille']) - 25) < 0.01 and k['ear'] == round(k['oreille']) and not k['alert'],
              f'casque : à l\'oreille {k["oreille"]:.1f} = ambiant {k["ambiant"]:.1f} − 25 dB, plus d\'alerte')
        check(r['sansCasque'], 'à vide sans casque (84 dB(A)) : pas d\'alerte')
        f = r['frein']
        check(f['spin'] > 0.5 and f['total'] > 80 and 60 < f['mi'] < 84, f'arrêt du moteur : le bruit suit le régime réel (outil qui tourne encore : {f["total"]:.1f} dB(A), à mi-régime {f["mi"]:.1f} dB(A))')
        check(abs(r['fin']['total'] - 45) < 0.5, f'arbre et aspiration arrêtés : retour au fond {r["fin"]["total"]:.1f} dB(A)')

        # calcul : passe forte, avance rapide et bois dur plus forts
        r = await pg.eval(js(NOISE + r"""
          const L=e=>Bz().niveau({on:true,rpm:9000,spin:1,cut:1,dents:2,...e}).total;
          return { ref:L({charge:1}), forte:L({charge:10/3}), chene:L({charge:2}), dur:L({charge:(10/3)*(16/6)*2}) };"""))
        check(r['ref'] < r['chene'] < r['forte'] < r['dur'] <= 108, f'coupe : référence {r["ref"]:.1f} < chêne {r["chene"]:.1f} < passe de 10 mm {r["forte"]:.1f} < chêne, 10 mm, 16 m/min {r["dur"]:.1f} dB(A)')
        # son activé : AudioContext créé au clic, gardé dans le navigateur
        r = await pg.eval(js(BASE + NOISE + r"""
          $('sndBtn').click(); await sleep(400);
          const out={ on:Bz().on, btn:$('sndBtn').textContent, vol:!$('sndVol').hidden, ctx:Bz().ctx&&Bz().ctx.state, err:Bz().err };
          await start(); await sleep(500);
          window.__atelier.bruit.bang('choc'); window.__atelier.bruit.bang('au'); window.__atelier.bruit.bang('coup');
          await stop(); out.store=localStorage.getItem('atelier.son');
          $('sndBtn').click(); await sleep(100); out.off=!Bz().on; out.store2=localStorage.getItem('atelier.son'); $('sndBtn').click(); await sleep(200);
          return out;"""))
        check(r['on'] and r['btn'] == '🔊' and r['vol'] and r['ctx'] in ('running', 'suspended') and not r['err'], f'son activé au clic : AudioContext {r["ctx"]}, volume visible')
        check('"on":true' in (r['store'] or '') and r['off'] and '"on":false' in (r['store2'] or ''), 'choix du son gardé dans le navigateur (localStorage)')
        check(not pg.errors, 'aucune erreur avec le son : ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('toupie_bruit_1400.png'))

    # niveaux calculés (fonction pure, mêmes valeurs qu'à l'écran)
    async with Page('toupie') as pg:
        r = await pg.eval(js(BASE + NOISE + r"""
          await start(); const base=calc().total;
          await stop(); rpm(4000); await start(); const lent=calc().total; await stop(); rpm(9000);
          return { base, lent };"""))
        check(r['lent'] < r['base'] - 5, f'régime plus bas, moins de bruit : 4 000 tr/min {r["lent"]:.1f} < 9 000 tr/min {r["base"]:.1f} dB(A)')

    # rechargement : choix « son activé » retrouvé ; le son ne démarre qu'au premier clic dans la page
    async with Page('toupie', init="try{ localStorage.setItem('atelier.son', JSON.stringify({on:true,vol:40})); }catch(e){}") as pg:
        r = await pg.eval(js(NOISE + r"""
          const before={ on:Bz().on, ctx:!!Bz().ctx, vol:$('sndVol').value };
          document.querySelector('.top h1').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
          await sleep(400); return { before, after:Bz().on };"""))
        check(not r['before']['on'] and not r['before']['ctx'] and r['before']['vol'] == '40', 'son gardé « activé » : rien avant un clic (règle du navigateur), volume 40 retrouvé')
        check(r['after'], 'premier clic dans la page : le son démarre')

    # navigateur sans AudioContext : pas d'erreur, le sonomètre reste
    async with Page('toupie', init="window.AudioContext=undefined; window.webkitAudioContext=undefined;") as pg:
        r = await pg.eval(js(BASE + NOISE + r"""
          $('sndBtn').click(); await sleep(300);
          await start(); await settle();
          return { on:Bz().on, err:Bz().err, toast:$('toast').textContent, total:calc().total, shown:shown() };"""))
        check(not r['on'] and 'AudioContext' in r['err'] and 'indisponible' in r['toast'], 'sans AudioContext : son refusé avec un message')
        check(abs(r['shown'] - r['total']) <= 1 and r['total'] > 80, f'sans AudioContext : sonomètre toujours à jour ({r["shown"]} dB(A))')
        check(not pg.errors, 'sans AudioContext : aucune erreur ' + '; '.join(pg.errors))

    # ordinateur : capture pendant la coupe
    async with Page('toupie') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        await pg.eval(js(BASE + NOISE + "on('asp'); on2('push'); await start(); $('pass').click(); await sleep(1800);"))
        print('   capture', await pg.shot('toupie_bruit_coupe_1400.png'))

    # aspiration seule, puis avec le moteur ; coupe avec le son (« rugissement »)
    async with Page('toupie') as pg:
        r = await pg.eval(js(BASE + NOISE + r"""
          const N=Bz().niveau({on:false,rpm:9000,spin:0,cut:0,asp:1}).total, mix=Bz().niveau({on:true,rpm:9000,spin:1,cut:0,asp:1}).total;
          on('asp'); { let n=0; while(Bz().asp<0.97&&n<150){ await sleep(100); n++; } } await settle(); const a={ sp:Bz().asp, total:calc().total };
          off('asp'); await sleep(200); const coast=Bz().asp;
          $('sndBtn').click(); await sleep(300); const noVar=!$('sndVar');
          on('asp'); await start(); $('pass').click(); await sleep(1500); await stop(); off('asp');
          return { N, mix, a, coast, noVar };"""))
        check(abs(r['N'] - 78) < 0.3 and r['mix'] > 84.5 and r['mix'] < 85, f'aspiration seule {r["N"]:.1f} dB(A) ; avec le moteur à vide {r["mix"]:.1f} dB(A)')
        check(r['a']['sp'] > 0.9 and abs(r['a']['total'] - 78) < 1.5, f'aspiration en marche : ventilateur à {r["a"]["sp"]:.2f}, sonomètre {r["a"]["total"]:.1f} dB(A)')
        check(r['noVar'], 'son de coupe choisi (« rugissement ») : plus de liste de choix dans l\'en-tête')
        check(not pg.errors, 'coupe avec le son et l\'aspiration : aucune erreur ' + '; '.join(pg.errors))

    # autre machine sans son propre (mortaiseuse) : le son de l'aspiration seulement (pas de sonomètre)
    async with Page('mortaiseuse') as pg:
        r = await pg.eval(js(r"""
          const Bz=window.__atelier.bruit; const out={ has:!!Bz, sono:!!$('sono'), btn:!$('snd').hidden };
          $('sndBtn').click(); await sleep(300); $('asp').click(); { let n=0; while((Bz.asp<0.6||!Bz.aspEnregistree)&&n<100){ await sleep(100); n++; } }
          out.on=Bz.on; out.asp=Bz.asp; out.alert=Bz.alerte(); out.rec=Bz.aspEnregistree;
          return out;"""))
        check(r['has'] and r['btn'] and not r['sono'], 'mortaiseuse : bouton du son, pas de sonomètre')
        check(r['on'] and r['asp'] > 0.5 and r['rec'] and r['alert'] is None, f'mortaiseuse : aspiration enregistrée décodée et jouée (ventilateur {r["asp"]:.2f}), pas d\'alerte bruit')
        check(not pg.errors, 'mortaiseuse : aucune erreur ' + '; '.join(pg.errors))

    # banc d'écoute
    from playwright.async_api import async_playwright
    from harness import ROOT, CHROMIUM
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROMIUM); pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + os.path.join(ROOT, 'dist', 'Ecoute_bruit.html')); await pg.wait_for_timeout(500)
        r = await pg.evaluate("""async()=>{ const $=id=>document.getElementById(id), sl=ms=>new Promise(r=>setTimeout(r,ms));
          $('son').click(); $('asp').click(); $('motor').click(); await sl(2000);
          document.querySelector('[data-passe="quart"]').click(); await sl(1200);
          const lv=+$('lv').textContent; return { on:window.__banc.S.son, ctx:window.__banc.SY.ctx&&window.__banc.SY.ctx.state, lv }; }""")
        e = await pg.evaluate("""async()=>{ const $=id=>document.getElementById(id), sl=ms=>new Promise(r=>setTimeout(r,ms));
          const cur=(g,k)=>document.querySelector(`.cur[data-g="${g}"][data-k="${k}"] input`);
          const set=(g,k,v)=>{ const i=cur(g,k); i.value=v; i.dispatchEvent(new Event('input')); };
          const n=document.querySelectorAll('.cur').length;
          set('sons.aspiration','ronron',0.9); set('niveaux','aspiration',70); set('sons.coupe','copeaux',0.8);
          const syn=window.__banc.SY.reglages, txt=window.__banc.texte(), store=localStorage.getItem('atelier.son.reglages');
          $('sansfin').checked=true; $('sansfin').dispatchEvent(new Event('change')); document.querySelector('[data-passe="quart"]').click(); await sl(6000);
          const still=!!window.__banc.S.passe;
          $('copy').click(); await sl(200); const shown=!$('regTxt').hidden && $('regTxt').value.includes('"ronron":0.9');
          $('reset').click(); await sl(100); const back=window.__banc.SY.reglages.aspiration.ronron;
          return { n, syn:syn.aspiration.ronron, cop:syn.coupe.copeaux, txt, store:!!store, still, shown, back }; }""")
        await pg.set_viewport_size({'width': 900, 'height': 1600}); await pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', 'banc_editeur.png'), full_page=True)
        await b.close()
        check(e['n'] == 13 and e['syn'] == 0.9 and e['cop'] == 0.8 and '"aspiration":70' in e['txt'] and e['store'],
              f'éditeur : {e["n"]} curseurs, réglage entendu tout de suite (ronron 0,9, copeaux 0,8), texte à copier, gardé dans le navigateur')
        check(e['still'] and e['shown'] and e['back'] == 0.3, 'éditeur : pièce sans fin, texte affiché, « Revenir aux réglages actuels »')
        check(r['on'] and r['ctx'] in ('running', 'suspended') and r['lv'] > 90 and not errs, f'banc d\'écoute : son, moteur, aspiration, passe ({r["lv"]} dB(A)), aucune erreur ' + '; '.join(errs))

    # téléphone : sonomètre visible dans la vue 3D, pas de défilement horizontal
    async with Page('toupie', viewport=(412, 915), touch=True) as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + NOISE + r"""
          await start(); $('pass').click(); await sleep(1800);
          const s=$('sono').getBoundingClientRect(), c=$('c').getBoundingClientRect();
          return { inside:s.left>=c.left&&s.top>=c.top&&s.right<=c.right&&s.bottom<=c.bottom, w:Math.round(s.width), h:Math.round(s.height), sw:document.documentElement.scrollWidth, iw:innerWidth, shown:shown() };"""))
        check(r['inside'] and r['sw'] <= r['iw'] + 1, f'téléphone : sonomètre {r["w"]}×{r["h"]} px dans la vue 3D, pas de défilement horizontal')
        print('   capture', await pg.shot('toupie_bruit_412.png'))
        await pg.eval(js(NOISE + "$('casque').click(); await sleep(400);"))
        print('   capture', await pg.shot('toupie_bruit_casque_412.png'))

if __name__ == '__main__': run(main)
