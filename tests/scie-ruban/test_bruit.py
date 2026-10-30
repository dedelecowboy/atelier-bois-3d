"""Scie à ruban : bruit avec ENREGISTREMENTS (essai du 29/10/2026, engine/synth.js chargerEchantillons, machines/scie-ruban/sons/*.mp3).
Les tests headless n'entendent rien : on vérifie que les enregistrements sont intégrés à la page et décodés, et les niveaux calculés
(à vide 82, en coupe 91 avec l'alerte « attention », casque −25), sans erreur ; capture avec le sonomètre."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import BASE

async def main():
    async with Page('scie-ruban') as pg:
        html = open(os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'scie-ruban.html'), encoding='utf-8').read()
        check(html.count('data:audio/mpeg;base64,') == 6, f'6 enregistrements intégrés (4 de la scie, 2 de l\'aspiration) à la page ({len(html)//1024} Ko au total)')
        await pg.eval("()=>document.getElementById('ui-ex').click()")
        r = await pg.eval(js(BASE + r"""
          const Bz=window.__atelier.bruit, calc=()=>Bz.calc(); const out={ sono:!!$('sono') };
          $('sndBtn').click(); let n=0; while(!Bz.enregistrements&&n<50){ await sleep(100); n++; }
          out.ech=Bz.enregistrements; out.err=Bz.err; out.ctx=Bz.ctx&&Bz.ctx.state;
          await start(); await sleep(300); out.vide=calc().total; out.alerteVide=alerts().some(a=>a.includes('BRUIT'));
          /* lame dans le bois pendant l'avance (état posé directement : l'avance réelle est testée dans test_exercices.py) */
          R.st.feed=true; R.cut.inWood=true; const c=calc(); const mx=c.total, al=!!Bz.alerte(), ch=c.e.charge;
          R.st.feed=false; R.cut.inWood=false; out.ch=ch;
          out.coupe=mx; out.alerte=al;
          $('casque').click(); await sleep(100); out.oreille=calc().oreille; out.amb=calc().total; $('casque').click();
          $('au').click(); await sleep(300); await stop(); $('au').click();
          return out;"""))
        check(r['sono'], 'sonomètre présent sur la scie à ruban')
        check(r['ech'] and r['ctx'] in ('running', 'suspended') and not r['err'], f'son activé : enregistrements décodés ({r["ctx"]}) {r["err"]}')
        check(abs(r['vide'] - 82) < 0.6 and not r['alerteVide'], f'à vide : {r["vide"]:.1f} dB(A), pas d\'alerte')
        check(r['coupe'] > 88 and r['alerte'], f'en coupe (avance normale, charge {r["ch"]:.1f}) : {r["coupe"]:.1f} dB(A), alerte « attention » sans casque')
        check(abs((r['amb'] - r['oreille']) - 25) < 0.01, 'casque : −25 dB à l\'oreille')
        check(not pg.errors, 'aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('scie-ruban_bruit_1400.png'))

if __name__ == '__main__': run(main)
