"""Scie à format : coupes d'onglet (règle de tronçonnage orientée) et coupes biaises (lame inclinée), en mode libre."""
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from harness import Page, js, check, run
from jeux import PASS

GEOM = r"""
 const geom=()=>{ const P=window.__scie.pieces(); return P.map(p=>({id:p.id, n:p.pts.length,
   edges:p.pts.map((a,i)=>{ const b=p.pts[(i+1)%p.pts.length], m=p.meta?.[i]||{};
     return {len:Math.hypot(b[0]-a[0],b[1]-a[1])*1000, dir:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI, sawn:!!m.sawn, bev:(m.bev||0)*1000, ang:m.ang||0}; })})); };
"""

async def main():
    async with Page('scie-format') as pg:
        await pg.eval("()=>document.querySelector('[data-mode=libre]').click()")
        await pg.page.wait_for_timeout(150)
        # 1. Onglet à 30° : la règle tourne, la pièce en butée contre elle, une coupe d'aller.
        r = await pg.eval(js(PASS + GEOM + r"""
          setR('height',30); setR('rip',1000); setR('mit',30); op('fence'); setR('stop',500); op('stop');
          const before=geom(); const a0=alerts(); pass(); await sleep(200);
          return {before, after:geom(), a0, a1:alerts(), mit:window.__scie.st.mit};"""))
        check(r['mit'] == 30, 'règle de tronçonnage à 30°')
        check(not [a for a in r['a0'] if a.startswith('danger')], f"aucun danger avant la coupe d'onglet : {r['a0']}")
        sawn = [e for p in r['after'] for e in p['edges'] if e['sawn']]
        check(len(r['after']) >= 1 and sawn, f"coupe d'onglet réalisée ({len(r['after'])} pièce(s))")
        # angle entre le chant scié et le chant appuyé contre la règle : 60° ou 120° (90 − 30)
        ok = False
        for p in r['after']:
            es = p['edges']
            for i, e in enumerate(es):
                if not e['sawn'] or e['len'] < 50: continue
                for f in es:
                    if f is e or f['len'] < 50: continue
                    d = abs((e['dir'] - f['dir']) % 180)
                    if abs(d - 60) < 0.6 or abs(d - 120) < 0.6: ok = True
        check(ok, 'le chant scié fait 60° avec un chant voisin (onglet à 30°)')
        await pg.eval("()=>{ const SH=0.12, S=window.__scie.sAll(window.__scie.pieces()[0]); const cx=S.reduce((a,q)=>a+q[0],0)/S.length+SH+window.__scie.st.s/1000, cz=S.reduce((a,q)=>a+q[1],0)/S.length; window.__scie.cam([cx+0.15,1.75,cz+0.35],[cx,0.90,cz]); }")
        await pg.page.wait_for_timeout(500)
        await pg.shot('scie-format_onglet30.png')

        # 2. Biais à 45° : règle remise à 0, lame inclinée, coupe : chant scié avec bev ≈ épaisseur.
        r = await pg.eval(js(PASS + GEOM + r"""
          op('evac'); op('aside');
          document.querySelector('[data-mode=libre]').click(); await sleep(150);
          setR('rip',1000); setR('mit',0); setR('tilt',45); setR('height',60); op('fence'); setR('stop',400); op('stop');
          const a0=alerts(); pass(); await sleep(200);
          return {after:geom(), a0, t:window.__scie.st.t, T:window.__scie.pieces()[0]?.T};"""))
        check(r['t'] == 45, 'lame inclinée à 45°')
        check(not [a for a in r['a0'] if a.startswith('danger')], f"aucun danger avant la coupe biaise : {r['a0']}")
        bev = [e for p in r['after'] for e in p['edges'] if e['sawn'] and abs(e['ang']) == 45]
        check(bev, 'chant scié marqué incliné à 45°')
        if bev:
            b = abs(bev[0]['bev'])
            check(abs(b - 22) < 0.5, f"décalage du biais = épaisseur (22 mm à 45°) : {b:.1f} mm")
        await pg.page.wait_for_timeout(300)
        await pg.shot('scie-format_biais45.png')
        await pg.eval("()=>{ const SH=0.12, S=window.__scie.sAll(window.__scie.pieces()[0]); const cx=S.reduce((a,q)=>a+q[0],0)/S.length+SH+window.__scie.st.s/1000, cz=S.reduce((a,q)=>a+q[1],0)/S.length; window.__scie.cam([cx+0.25,1.12,cz-0.45],[cx,0.91,cz]); }")
        await pg.page.wait_for_timeout(500)
        await pg.shot('scie-format_biais45_pres.png')
        await pg.eval("()=>{ document.querySelector('[data-op=flip]').click(); const SH=0.12, S=window.__scie.sAll(window.__scie.pieces()[0]); const cx=S.reduce((a,q)=>a+q[0],0)/S.length+SH+window.__scie.st.s/1000, cz=S.reduce((a,q)=>a+q[1],0)/S.length; window.__scie.cam([cx+0.30,1.08,cz+0.55],[cx,0.91,cz]); }")
        await pg.page.wait_for_timeout(500)
        await pg.shot('scie-format_biais45_retourne.png')

if __name__=="__main__": run(main)
