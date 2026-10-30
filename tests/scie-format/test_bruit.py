"""Scies circulaires et tenonneuse : bruit avec les ENREGISTREMENTS de scie circulaire (30/10/2026, engine/sons/scie-*.mp3).
Scie à format (aspiration ajoutée), scie radiale, déligneuse : mise en marche, régime à vide, coupe, arrêt enregistrés.
Tenonneuse : trois sources (scie = enregistrements de scie, dérouleurs = enregistrements de la raboteuse, unité de toupillage = son
synthétisé de la toupie), sonomètre = somme des trois. Les tests headless n'entendent rien : enregistrements décodés, coupe vue pendant
les vraies passes des exercices guidés, niveaux, alerte « casque », aucune erreur."""
import os, sys, importlib.util
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')

def jeux(m):
    spec = importlib.util.spec_from_file_location('jeux_' + m.replace('-', '_'), os.path.join(os.path.dirname(__file__), '..', m, 'jeux.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod

SON = r"""async()=>{ const Bz=window.__atelier.bruit; document.getElementById('sndBtn').click();
  let n=0; while(!Bz.enregistrements&&n<80){ await new Promise(r=>setTimeout(r,100)); n++; }
  window.__smp={ top:0, cuts:{}, vide:0, n:0, alerte:0, err:'' };
  window.__smpI=setInterval(()=>{ try{ const c=Bz.calc(), S=window.__smp; S.n++;
    c.es.forEach((e,i)=>{ if(e.cut) S.cuts[i]=(S.cuts[i]||0)+1; }); if(c.total>S.top) S.top=c.total;
    if(c.es.some(e=>e.cut)&&Bz.alerte()) S.alerte++;
    if(c.marche&&!c.es.some(e=>e.cut)&&c.enMarche!=null) S.vide=Math.max(S.vide,c.enMarche); }catch(e){ window.__smp.err=String(e); } },50);
  return { ech:Bz.enregistrements, err:Bz.err, sono:!!document.getElementById('sono'), sources:Bz.sources }; }"""
FIN = "()=>{ clearInterval(window.__smpI); return window.__smp; }"

async def main():
    for m in ['scie-format', 'scie-radiale', 'deligneuse', 'tenonneuse']:
        html = open(os.path.join(ROOT, 'dist', m + '.html'), encoding='utf-8').read()
        n = 8 if m == 'tenonneuse' else 6
        check(html.count('data:audio/mpeg;base64,') == n, f'{m} : {n} enregistrements intégrés, page de {len(html)//1024} Ko')

    # scie à format : aspiration ajoutée, coupe pendant l'aller du chariot (le curseur avance pas à pas)
    async with Page('scie-format') as pg:
        await pg.eval("()=>document.querySelector('[data-mode=format]').click()")
        s = await pg.eval(SON)
        r = await pg.eval(js(r"""
          const Bz=window.__atelier.bruit, S=window.__scie, out={};
          out.aspAvant=Bz.calc().asp; $('asp').click(); out.aspBtn=$('asp').getAttribute('aria-pressed'); await sleep(300); out.resume=document.querySelector('[data-key=machine] .fam-s').textContent;
          if(!S.st.motor) $('motor').click();
          { let n=0; while(Bz.calc().e.spin<0.95&&n<100){ await sleep(100); n++; } }
          out.vide=Bz.calc().enMarche; out.alerteVide=!!Bz.alerte();
          setR('height',30); setR('rip',700); $('stepNext').click(); setR('stop',600); op('stop');
          let top=0, cuts=0, al=0; for(let s=1450;s>=-1500;s-=8){ setR('slide',s); const c=Bz.calc(); if(c.e.cut){ cuts++; if(c.total>top) top=c.total; if(Bz.alerte()) al++; } }
          out.top=top; out.cuts=cuts; out.alerte=al; await sleep(500); out.apres=Bz.calc().e.cut;
          $('motor').click(); { let n=0; while(Bz.calc().e.spin>0.98&&n<50){ await sleep(100); n++; } } out.frein=Bz.calc().e.spin; out.on=Bz.calc().e.on;
          return out;"""))
        check(s['ech'] and s['sono'] and not s['err'], f'scie à format : sonomètre et enregistrements décodés {s["err"]}')
        check(not r['aspAvant'] and r['aspBtn'] == 'true' and 'aspiration en marche' in r['resume'], f'scie à format : bouton « Aspiration » ajouté au panneau Machine (résumé « {r["resume"]} »)')
        check(abs(r['vide'] - 85.0) < 0.6 and not r['alerteVide'], f'scie à format à vide avec l\'aspiration : {r["vide"]:.1f} dB(A), sans alerte')
        check(r['cuts'] > 5 and r['top'] > 92 and r['alerte'] > 0, f'scie à format : coupe pendant l\'aller ({r["cuts"]} relevés, {r["top"]:.1f} dB(A)), alerte « casque »')
        check(r['apres'] == 0 and r['on'] is False and r['frein'] < 0.99, f'scie à format : plus de coupe chariot arrêté ({r["apres"]}) ; moteur arrêté, la lame freine (régime {r["frein"]:.2f})')
        check(not pg.errors, 'scie à format : aucune erreur ' + '; '.join(pg.errors))
        print('   capture', await pg.shot('scie-format_bruit_1400.png'))

    # scie radiale, déligneuse, tenonneuse : le premier exercice guidé joué comme un élève, sonomètre relevé toutes les 50 ms
    for m, modes, vide in [('scie-radiale', ['serie'], 85.0), ('deligneuse', ['avive'], 85.0), ('tenonneuse', ['tenon', 'enfourchement'], 86.5)]:
        J = jeux(m)
        async with Page(m) as pg:
            await pg.eval(f"()=>document.querySelector('[data-mode={modes[0]}]').click()")
            s = await pg.eval(SON)
            for mode in modes:
                if mode != modes[0]:
                    await pg.eval(f"()=>document.querySelector('[data-mode={mode}]').click()"); await pg.page.wait_for_timeout(100)
                await pg.eval(js(J.JEUX[mode]))
            r = await pg.eval(FIN)
            check(s['ech'] and s['sono'] and not s['err'] and not r['err'], f'{m} : sonomètre et enregistrements décodés {s["err"]} {r["err"]}')
            nsrc = 3 if m == 'tenonneuse' else 1
            check(len(s['sources']) == nsrc and all(r['cuts'].get(str(i), 0) > 0 for i in range(nsrc)),
                  f'{m} : coupe relevée pendant les passes pour chaque source {s["sources"]} : {r["cuts"]} ({r["n"]} relevés)')
            check(abs(r['vide'] - vide) < 0.8, f'{m} : à vide (le plus fort, outils lancés, aspiration) {r["vide"]:.1f} dB(A), attendu ≈ {vide}')
            check(r['top'] > r['vide'] + 2 and r['alerte'] > 0, f'{m} : en coupe jusqu\'à {r["top"]:.1f} dB(A) (régime réel du test, lent en headless), alerte « casque »')
            check(not pg.errors, f'{m} : aucune erreur ' + '; '.join(pg.errors))
            print('   capture', await pg.shot(f'{m}_bruit_1400.png'))

if __name__ == '__main__': run(main)
