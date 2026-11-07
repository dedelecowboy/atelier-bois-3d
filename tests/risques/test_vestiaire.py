# © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE.
"""Vestiaire des risques généraux (demandé par l'enseignant le 06/11/2026) :
1. page web : onglet « Vestiaire », 12 fiches, l'élève apparaît et la caméra vient sur lui, les démonstrations sans / avec
   protection des 12 fiches (et « gants près d'un outil qui tourne ») finissent sur la bonne carte,
   lecture gardée dans le navigateur, sortie du vestiaire (avatar caché, modèles simplifiés remis) ;
2. paquetage séparé : après les fiches risques, la carte du parcours demande le vestiaire, trace RISQUES_vestiaire,
   reprise (suspend_data) ; 3. téléphone : pas de défilement horizontal."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, check, run

LIRE = """async (sel)=>{ const s=ms=>new Promise(r=>setTimeout(r,ms)); for(let k=0;k<30;k++){ const b=document.querySelector(sel+' [data-flu]:not([disabled])'); if(!b) break;
  b.closest('details').open=true; await s(30); document.querySelector(`${sel} [data-flu="${b.dataset.flu}"]`).click(); await s(30); } }"""
DEMO = """async ([k,m,t])=>{ const V=window.__risques.V; V.freeze(null); V.play(k,m); for(const x of t){ V.freeze(x); await new Promise(r=>setTimeout(r,700)); }
  const c=document.getElementById('vcard'); return { hidden:c.hidden, l:c.dataset.l, t:c.querySelector('b')?.textContent||'', sono:!document.getElementById('sono').hidden }; }"""

async def main():
    print('Page web')
    async with Page('risques', lues=False) as pg:
        n = await pg.eval("()=>document.querySelectorAll('#vestiaire details.fiche').length")
        check(n == 12, f'onglet Vestiaire : 12 fiches ({n})')
        await pg.page.click('#rtabs [data-rt="vest"]'); await pg.page.wait_for_timeout(1500)
        e = await pg.eval("()=>({ av:window.__risques.model.avatar.visible, act:window.__risques.V.active, fiches:document.getElementById('fiches').hidden, n:document.getElementById('vestN').textContent })")
        check(e['av'] and e['act'] and e['fiches'] and e['n'] == '0/12', f'vestiaire ouvert : l\'élève apparaît, fiches risques cachées, 0/12 sur l\'onglet {e}')
        print('   capture', await pg.shot('risques_vestiaire.png'))
        for k, m, t, l, mot in [('auditif','sans',[2,8],'ko','Sans casque'),('auditif','avec',[8],'ok','Avec le casque'),
                                ('lunettes','sans',[2,3.4],'ko','Sans lunettes'),('lunettes','avec',[4.2],'ok','Avec les lunettes'),
                                ('echarpe','sans',[4,4.7],'ko','écharpe'),('echarpe','avec',[4.2],'ok','Sans écharpe'),
                                ('chaussures','sans',[3.0],'ko','Sans chaussures'),('chaussures','avec',[3.8],'ok','embout'),
                                ('masque','sans',[4.4],'ko','Sans masque'),('masque_a','sans',[4.4],'ko','FFP2'),('masque_a','avec',[4.4],'ok','demi-masque'),
                                ('gants_manut','sans',[3.2],'ko','écharde'),('gants_manut','toupie',[4,4.8],'ko','gant'),('gants_chim','sans',[2.6],'ko','vernis'),
                                ('cheveux','sans',[4,4.8],'ko','cheveux'),('sweat','sans',[4,4.8],'ko','sweat'),('tenue','avec',[4.2],'ok','vêtement de travail'),('bijoux','sans',[4,4.8],'ko','bracelet')]:
            r = await pg.eval(DEMO, [k, m, t])
            check(not r['hidden'] and r['l'] == l and mot in r['t'], f'{k} {m} : carte « {r["t"]} » ({l})')
            if k == 'auditif': check(r['sono'], f'{k} {m} : sonomètre affiché pendant la démonstration')
            if m in ('sans','toupie'): print('   capture', await pg.shot(f'risques_vestiaire_{k}_{m}.png'))
        print('Mains sur les tables (07/11/2026 : « les bras passent dans la table »)')
        for k, m, t in [('lunettes','sans',0.5),('echarpe','sans',4.6),('cheveux','sans',4.6),('sweat','sans',4.6),('bijoux','sans',4.6),('masque','sans',3.0),('gants_chim','avec',3.3),('auditif','sans',4.0)]:
            await pg.eval("([k,m,t])=>{ const V=window.__risques.V; V.freeze(null); V.play(k,m); V.freeze(t); }", [k, m, t]); await pg.page.wait_for_timeout(400)
            e = await pg.eval("()=>window.__risques.enfoncement(window.__risques.model.avatar)")
            check(e is None or e > -0.07, f'{k} {m} : mains et avant-bras pas dans la table ({e} m)')
        await pg.eval("()=>{ window.__risques.V.freeze(null); window.__risques.V.stopDemo(); }")
        await pg.eval(LIRE, '#vestiaire')
        n = await pg.eval("()=>document.getElementById('vestN').textContent")
        check(n == '12/12', f'les 12 équipements vus ({n})')
        await pg.page.reload(); await pg.page.wait_for_function('window.__ready', timeout=30000); await pg.page.wait_for_timeout(800)
        n = await pg.eval("()=>document.getElementById('vestN').textContent")
        check(n == '12/12', 'lecture du vestiaire gardée dans le navigateur')
        await pg.page.click('#rtabs [data-rt="vest"]'); await pg.page.wait_for_timeout(500)
        await pg.page.click('#rtabs [data-rt="fiches"]'); await pg.page.wait_for_timeout(500)
        e = await pg.eval("()=>({ av:window.__risques.model.avatar.visible, act:window.__risques.V.active, dec:window.__risques.model.DEC.toupie.g.visible })")
        check(not e['av'] and not e['act'] and e['dec'], f'retour aux fiches risques : élève caché, modèle simplifié de la toupie remis {e}')
    print('Personnages des dangers et postes de l\'exercice EPI : mains sur les tables')
    async with Page('risques') as pg:
        await pg.eval("()=>window.__risques.model.showDangers(true)")
        figs = await pg.eval("()=>window.__risques.model.figs.map(f=>[f.userData.pose, window.__risques.enfoncement(f)])")
        check(all(e is None or e > -0.03 for _, e in figs), f'personnages des dangers : rien dans les tables {figs}')
        ep = await pg.eval("""()=>{ const M=window.__risques.model, P={ toupie:[0.7,5.25,Math.PI], poncage:[6.0,9.05,0], vernis:[8.6,9.05,0] }, r={};
          for(const [k,q] of Object.entries(P)){ M.placeAvatar(q[0],q[1],q[2],{ epi:['tenue','chaussures'], hair:'attache', pose:'machine' }); r[k]=window.__risques.enfoncement(M.avatar); } M.hideAvatar(); return r; }""")
        check(all(e is None or e > -0.03 for e in ep.values()), f'postes de l\'exercice EPI : mains posées sur les établis {ep}')
    print('Paquetage séparé (évaluation seule)')
    async with Page('risques', scorm=True, lues=False) as pg:
        await pg.eval(LIRE, '#parcFiches')
        card = await pg.eval("()=>document.getElementById('parcCard').innerText")
        check('vestiaire' in card.lower(), 'fiches risques lues : la carte du parcours demande le vestiaire')
        await pg.eval(LIRE, '#parcFiches')
        st = await pg.eval("()=>({ bar:document.getElementById('repBar').hidden, ve:window.__atelier.parc.ve, ids:Object.entries(window.__store).filter(([k,v])=>/interactions\\.\\d+\\.id$/.test(k)).map(([k,v])=>v), sd:window.__store['cmi.suspend_data'] })")
        check(not st['bar'] and len(st['ve']) == 12, 'vestiaire vu : le repérage commence')
        check('RISQUES_vestiaire' in st['ids'] and 'RISQUES_lecture' in st['ids'], f'traces RISQUES_lecture et RISQUES_vestiaire envoyées')
        check('"ve":[' in st['sd'], 'vestiaire gardé dans suspend_data')
    print('Téléphone')
    async with Page('risques', viewport=(412, 915), touch=True, lues=False) as pg:
        await pg.page.click('#rtabs [data-rt="vest"]'); await pg.page.wait_for_timeout(1200)
        r = await pg.eval(DEMO, ['echarpe', 'sans', [4, 4.7]])
        w = await pg.eval("()=>document.documentElement.scrollWidth")
        check(w <= 412 and not r['hidden'], f'412 px : carte de la démonstration, pas de défilement horizontal ({w} px)')
        await pg.eval("()=>window.scrollTo(0,0)"); print('   capture', await pg.shot('risques_vestiaire_412.png'))

if __name__ == '__main__': run(main)
