import sys, os, asyncio, json, re
from playwright.async_api import async_playwright
S=os.path.dirname(os.path.abspath(__file__)); html=open(sys.argv[1]).read()
html=html.replace("if(PARC_ON){ scorm.init();","window.__parc={get p(){return parc},repAnswer,QCM,REP_TARGETS,finishScen,camera,partMeshes,THREE}; if(PARC_ON){ scorm.init();",1)
RESUME=sys.argv[2] if len(sys.argv)>2 else ''
mock="""<script>window.PARCOURS=true; window.__log=[]; window.__store={'cmi.core.lesson_status':'not attempted','cmi.suspend_data':%s,'cmi.interactions._count':'0'};
window.API={LMSInitialize(){__log.push('init');return 'true'},LMSFinish(){__log.push('finish');return 'true'},LMSCommit(){__log.push('commit');return 'true'},
LMSGetValue(k){return __store[k]??''},LMSSetValue(k,v){__store[k]=v; const m=k.match(/^cmi\\.interactions\\.(\\d+)\\.id$/); if(m) __store['cmi.interactions._count']=String(+m[1]+1); if(!k.startsWith('cmi.interactions')&&k!=='cmi.suspend_data') __log.push(k+'='+v); return 'true'},
LMSGetLastError(){return '0'},LMSGetErrorString(){return ''},LMSGetDiagnostic(){return ''}};</script>""" % json.dumps(RESUME)
page_html='<!doctype html><html><head><meta charset="utf-8">'+mock+'</head><body>'+html+'</body></html>'
S1=r'''
async () => {
 const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const setR=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('input')); };
 const op=o=>document.querySelector(`[data-op=${o}]`).click();
 const checks=()=>[...document.querySelectorAll('#stepChecks li')].map(l=>(l.dataset.ok==='true'?'✓ ':'✗ ')+l.textContent);
 const alerts=()=>[...document.querySelectorAll('#alerts li')].map(l=>l.dataset.l+': '+l.textContent);
 const state=(tag)=>({tag, step:$('stepN').textContent+' '+$('stepT').textContent, checks:checks(), ok:!$('stepOk').hidden, alerts:alerts()});
 const pass=async()=>{ for(let s=1450;s>=-1500;s-=8){ setR('slide',s); } window.__blk=[...document.querySelectorAll('#alerts li')].map(l=>l.textContent).filter(t=>/Évacuez|évacuer/.test(t)); setR('slide',-1400); window.__blk2=document.getElementById('slide').value; op('evac'); for(let s=-1500;s<=1450;s+=50) setR('slide',s); };
 const log=[];
 
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
}'''
S2=r'''
async () => {
 const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const setR=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('input')); };
 const op=o=>document.querySelector(`[data-op=${o}]`).click();
 const checks=()=>[...document.querySelectorAll('#stepChecks li')].map(l=>(l.dataset.ok==='true'?'✓ ':'✗ ')+l.textContent);
 const alerts=()=>[...document.querySelectorAll('#alerts li')].map(l=>l.dataset.l+': '+l.textContent);
 const state=(tag)=>({tag, step:$('stepN').textContent+' '+$('stepT').textContent, checks:checks(), ok:!$('stepOk').hidden, alerts:alerts()});
 const pass=async()=>{ for(let s=1450;s>=-1500;s-=8){ setR('slide',s); } window.__blk=[...document.querySelectorAll('#alerts li')].map(l=>l.textContent).filter(t=>/Évacuez|évacuer/.test(t)); setR('slide',-1400); window.__blk2=document.getElementById('slide').value; op('evac'); for(let s=-1500;s<=1450;s+=50) setR('slide',s); };
 const log=[];
 
 log.push(state('start'));
 setR('height',37); setR('rip',400); $('bsabot').click(); $('gshort').click(); log.push(state('prep')); $('stepNext').click();
 op('sabot'); let n=0; for(;n<200 && !checks()[1].startsWith('✓');n++) op('zm1'); log.push(state('c1 placed after '+n+' mm')); await pass(); log.push(state('c1 done')); $('stepNext').click();
 op('evac'); setR('rip',160); op('guide'); log.push(state('c2 placed')); await pass(); log.push(state('c2 done')); $('stepNext').click();
 log.push({res:[...document.querySelectorAll('#stepRes tr')].map(r=>r.textContent), info:$('stepRes').textContent});
 log.push({evacAlert:window.__blk, sliderAfterBlockedReturn:window.__blk2}); return JSON.stringify(log,null,1);
}'''
S3=r'''
async () => {
 const $=id=>document.getElementById(id), sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const setR=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('input')); };
 const setN=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new Event('change')); };
 const op=o=>document.querySelector(`[data-op=${o}]`).click();
 const checks=()=>[...document.querySelectorAll('#stepChecks li')].map(l=>(l.dataset.ok==='true'?'✓ ':'✗ ')+l.textContent);
 const alerts=()=>[...document.querySelectorAll('#alerts li')].map(l=>l.dataset.l+': '+l.textContent.slice(0,80));
 const state=(tag)=>({tag, step:$('stepN').textContent+' '+$('stepT').textContent, checks:checks(), ok:!$('stepOk').hidden, alerts:alerts()});
 const pass=()=>{ for(let s=1450;s>=-1500;s-=8) setR('slide',s); op('evac'); for(let s=-1500;s<=1450;s+=50) setR('slide',s); };
 const ok=i=>checks()[i]?.startsWith('✓');
 const log=[];
 
 setR('height',30); setR('rip',700); log.push(state('prep')); $('stepNext').click();
 setR('stop',900); op('stop'); log.push(state('c1 placed')); pass(); op('flip'); log.push(state('c1 done')); $('stepNext').click();
 $('binc').click(); setN('incH',1.5); setN('incW',4.6); setN('incOff',0); log.push(state('reglage')); $('stepNext').click();
 setR('stop',800);
 let found=false; for(let f=0;f<2&&!found;f++){ if(f) op('flip'); for(let i=0;i<4;i++){ op('rotR'); op('fence'); op('stop'); if(ok(4)&&ok(6)){found=true;break;} } }
 log.push(state('c2 placed')); pass(); log.push(state('c2 done')); $('stepNext').click();
 setR('rip',400); for(let i=0;i<4;i++){ op('rotR'); op('guide'); if(ok(5)) break; }
 log.push(state('c3 placed')); pass(); log.push(state('c3 done')); $('stepNext').click();
 log.push({res:[...document.querySelectorAll('#stepRes tr')].map(r=>r.textContent), info:$('stepRes').textContent});
 return JSON.stringify(log,null,1);
}'''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':1400,'height':820}); logs=[]
    pg.on('pageerror',lambda e: logs.append('ERR '+str(e)))
    async def route(r):
      u=r.request.url
      if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u: await r.fulfill(path=os.path.join(S,'node_modules/three',u.split('three@0.160.0/')[1]), content_type='application/javascript')
      elif u.startswith('http://local/'): await r.fulfill(body=page_html, content_type='text/html')
      else: await r.abort()
    await pg.route('**/*',route); await pg.goto('http://local/')
    await pg.wait_for_function('window.__ready',timeout=20000); await pg.wait_for_timeout(1200)
    st=lambda: pg.evaluate("()=>({ph:__parc.p.ph,ri:__parc.p.ri,rk:__parc.p.rk,qi:__parc.p.qi,phase:document.getElementById('app').dataset.phase,ui:document.getElementById('app').dataset.ui,card:document.getElementById('parcCard').innerText.slice(0,160)})")

    print('START',await st())
    if RESUME:
      await pg.wait_for_timeout(500); print('\n'.join(logs)); await b.close(); return
    tg=await pg.evaluate("__parc.REP_TARGETS")
    for i,t in enumerate(tg):
      await pg.evaluate(f"__parc.repAnswer('{'bati' if i in (3,9) else t}')"); await pg.wait_for_function(f"__parc.p.ri>{i}",timeout=20000)
    print('after rep',await st())
    ans=await pg.evaluate("__parc.QCM.map(q=>q.a)")
    for i,a in enumerate(ans):
      if i in (2,7,15): a=(a+1)%3
      await pg.click(f'#parcCard [data-q="{a}"]'); await pg.click('#qNext')
    print('after qcm',await st())
    for k,J in enumerate([S1,S2,S3]):
      await pg.click('#scenGo'); await pg.wait_for_timeout(300)
      out=await pg.evaluate(J); print('SCEN',k+1, [l for l in out.split('\n') if 'mm' in l and ('✓' in l or '✗' in l)][-6:])
      await pg.click('#scenEnd'); await pg.wait_for_timeout(300); print('after scen',k+1,await st())
    await pg.screenshot(path=os.path.join(S,'parc3_fin.png'))
    print(await pg.evaluate("()=>JSON.stringify({log:__log.filter(x=>x!=='commit'),n:__store['cmi.interactions._count'],sdlen:__store['cmi.suspend_data'].length,last:[__store['cmi.interactions.'+(+__store['cmi.interactions._count']-1)+'.id'],__store['cmi.interactions.'+(+__store['cmi.interactions._count']-1)+'.student_response']]})"))
    print('\n'.join(logs)); await b.close()
asyncio.run(main())
