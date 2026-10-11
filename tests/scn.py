import sys, os, asyncio, json
from playwright.async_api import async_playwright
S=os.path.dirname(os.path.abspath(__file__)); html=open(sys.argv[1]).read()
page_html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>'+html+'</body></html>'
JS = r"""
async () => {
 const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const setR=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('input')); };
 const op=o=>document.querySelector(`[data-op=${o}]`).click();
 const checks=()=>[...document.querySelectorAll('#stepChecks li')].map(l=>(l.dataset.ok==='true'?'✓ ':'✗ ')+l.textContent);
 const alerts=()=>[...document.querySelectorAll('#alerts li')].map(l=>l.dataset.l+': '+l.textContent);
 const state=(tag)=>({tag, step:$('stepN').textContent+' '+$('stepT').textContent, checks:checks(), ok:!$('stepOk').hidden, alerts:alerts()});
 const pass=async()=>{ for(let s=1450;s>=-1500;s-=8){ setR('slide',s); } window.__blk=[...document.querySelectorAll('#alerts li')].map(l=>l.textContent).filter(t=>/Évacuez|évacuer/.test(t)); setR('slide',-1400); window.__blk2=document.getElementById('slide').value; op('evac'); for(let s=-1500;s<=1450;s+=50) setR('slide',s); };
 const log=[];
 document.querySelector('[data-mode=format]').click(); await sleep(50);
 log.push(state('start'));
 setR('height',30); setR('rip',700); log.push(state('prep')); $('stepNext').click();
 setR('stop',600); op('stop'); log.push(state('c1 placed')); await pass(); log.push(state('c1 done')); $('stepNext').click();
 op('evac'); setR('stop',1010);
 for(let i=0;i<4;i++){ op('rotR'); op('fence'); if(checks()[1].startsWith('✓')) break; }
 op('stop'); log.push(state('c2 placed')); await pass(); log.push(state('c2 done')); $('stepNext').click();
 op('evac'); setR('rip',450);
 for(let i=0;i<4;i++){ op('rotR'); op('guide'); if(checks()[2].startsWith('✓')) break; }
 log.push(state('c3 placed')); await pass(); log.push(state('c3 done')); $('stepNext').click();
 op('evac'); setR('rip',700); setR('stop',800);
 let okp=false; for(let f=0;f<2&&!okp;f++){ if(f) op('flip'); for(let i=0;i<4;i++){ op('rotR'); op('fence'); op('stop'); const c=checks(); if(c[2].startsWith('✓')&&c[3].startsWith('✓')){okp=true;break;} } }
 log.push(state('c4 placed')); await pass(); log.push(state('c4 done')); $('stepNext').click();
 log.push({res:[...document.querySelectorAll('#stepRes tr')].map(r=>r.textContent)});
 log.push({evacAlert:window.__blk, sliderAfterBlockedReturn:window.__blk2}); return JSON.stringify(log,null,1);
}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1400,'height':820}); logs=[]
    pg.on('console',lambda m: logs.append(m.text)); pg.on('pageerror',lambda e: logs.append('ERR '+str(e)))
    async def route(r):
      u=r.request.url
      if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u: await r.fulfill(path=os.path.join(S,'node_modules/three',u.split('three@0.160.0/')[1]), content_type='application/javascript')
      elif u.startswith('http://local/'): await r.fulfill(body=page_html, content_type='text/html')
      else: await r.abort()
    await pg.route('**/*',route); await pg.goto('http://local/')
    try: await pg.wait_for_function('window.__ready',timeout=20000)
    except Exception: print('\n'.join(logs)); raise SystemExit(1)
    await pg.wait_for_timeout(1500)
    print(await pg.evaluate(JS))
    if len(sys.argv)>2: await pg.screenshot(path=sys.argv[2])
    print('\n'.join(l for l in logs if 'ERR_FAILED' not in l)[:3000]); await b.close()
asyncio.run(main())
