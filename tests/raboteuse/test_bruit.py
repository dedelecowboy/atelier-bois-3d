"""Raboteuse et dégauchisseuse : bruit avec l'ENREGISTREMENT d'une raboteuse-dégauchisseuse (essai du 30/10/2026, engine/sons/rabotage-*.mp3).
Les tests headless n'entendent rien : enregistrements intégrés et décodés, niveaux calculés (à vide 86 avec l'alerte « attention »,
en coupe pendant une vraie passe, casque −25), aucune erreur ; captures avec le sonomètre."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import BASE
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'degauchisseuse'))
import importlib.util
spec = importlib.util.spec_from_file_location('jeux_dg', os.path.join(os.path.dirname(__file__), '..', 'degauchisseuse', 'jeux.py'))
DG = importlib.util.module_from_spec(spec); spec.loader.exec_module(DG)
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

COMMUN = r"""
 const Bz=window.__atelier.bruit, calc=()=>Bz.calc();
 const sonOn=async()=>{ $('sndBtn').click(); let n=0; while(!Bz.enregistrements&&n<60){ await sleep(100); n++; } };
"""

async def main():
    for m in ['raboteuse', 'degauchisseuse']:
        html = open(os.path.join(ROOT, 'dist', m + '.html'), encoding='utf-8').read()
        check(html.count('data:audio/mpeg;base64,') == 4, f'{m} : 4 enregistrements intégrés (vide, usinage, aspiration ×2), page de {len(html)//1024} Ko')

    async with Page('raboteuse') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + COMMUN + r"""
          const out={ sono:!!$('sono') }; await sonOn(); out.ech=Bz.enregistrements; out.err=Bz.err;
          prep(); on('motor'); { let n=0; while(R.model.spin<0.95&&n<80){ await sleep(100); n++; } }
          out.vide=calc().enMarche; out.alerteVide=!!Bz.alerte();   // niveau établi (en headless, le moteur monte lentement en régime)
          cote(30); on('feed'); $('pass').click(); let top=0, cutSeen=0, n=0;
          while((R.cut.inProgress||n<5)&&n<900){ await sleep(100); n++; const c=calc(); if(c.e.cut) cutSeen++; if(c.total>top) top=c.total; }
          out.coupe=top; out.cutSeen=cutSeen; out.vreel=calc().total;
          $('casque').click(); await sleep(100); out.amb=calc().total; out.oreille=calc().oreille; $('casque').click();
          return out;"""))
        check(r['sono'] and r['ech'] and not r['err'], f'raboteuse : sonomètre, enregistrements décodés {r["err"]}')
        check(abs(r['vide'] - 86.4) < 0.8 and r['alerteVide'], f'raboteuse à vide (avec l\'aspiration) : {r["vide"]:.1f} dB(A), alerte « attention » sans casque')
        check(r['cutSeen'] > 0 and r['coupe'] > r['vreel'] + 5, f'raboteuse : coupe détectée pendant la passe ({r["cutSeen"]} relevés), {r["coupe"]:.1f} dB(A) contre {r["vreel"]:.1f} à vide')
        check(abs((r['amb'] - r['oreille']) - 25) < 0.01, 'raboteuse : casque −25 dB à l\'oreille')
        check(not pg.errors, 'raboteuse : aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('raboteuse_bruit_1400.png'))

    async with Page('degauchisseuse') as pg:
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(DG.BASE + COMMUN + r"""
          const D=window.__degau, out={ sono:!!$('sono') }; await sonOn(); out.ech=Bz.enregistrements; out.err=Bz.err;
          on('asp'); on('motor'); { let n=0; while(D.model.spin<0.95&&n<80){ await sleep(100); n++; } }
          out.vide=calc().enMarche;
          op('guide'); bec('plat'); const mxT=+$('travel').max; let top=0, cutSeen=0;
          for(let t=0;t<=mxT;t+=20){ setR('travel',t); const c=calc(); if(c.e.cut){ cutSeen++; if(c.total>top) top=c.total; } }
          out.coupe=top; out.cutSeen=cutSeen; await sleep(600); out.apres=calc().e.cut;
          return out;"""))
        check(r['sono'] and r['ech'] and not r['err'], f'dégauchisseuse : sonomètre, enregistrements décodés {r["err"]}')
        check(abs(r['vide'] - 86.4) < 0.8, f'dégauchisseuse à vide (avec l\'aspiration) : {r["vide"]:.1f} dB(A)')
        check(r['cutSeen'] > 0 and r['coupe'] > r['vide'] + 3 and r['apres'] == 0, f'dégauchisseuse : coupe pendant la passe ({r["cutSeen"]} relevés, {r["coupe"]:.1f} dB(A)), plus de coupe quand la pièce ne bouge plus')
        check(not pg.errors, 'dégauchisseuse : aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('degauchisseuse_bruit_1400.png'))

if __name__ == '__main__': run(main)
