/*! © 2026 Julien ANDRE - Lycée André MALRAUX - REMIREMONT. Licence GNU GPL v3 : voir le fichier LICENSE. */
/* API SCORM 1.2 (Moodle). Sans LMS (version web), toutes les fonctions sont sans effet.
   state() rend l'objet à sauvegarder dans suspend_data ; restore(o) le recharge à la reprise. */
export function createScorm({ enabled, state, restore, t0 }){
  const scorm={api:null, ok:false,
    find(w){ let n=0; while(w && !w.API && w.parent && w.parent!==w && n<12){ w=w.parent; n++; } return w&&w.API||null; },
    init(){ if(!enabled) return; this.api=this.find(window)||(window.opener&&this.find(window.opener)); if(!this.api) return;
      this.ok=String(this.api.LMSInitialize(''))==='true';
      if(!this.ok) return; const st=this.get('cmi.core.lesson_status'); if(st==='not attempted'||st==='') this.set('cmi.core.lesson_status','incomplete');
      const sd=this.get('cmi.suspend_data'); if(sd){ try{ const o=JSON.parse(sd); if(o&&o.v===2) restore(o); }catch(e){} } },
    get(k){ try{ return this.ok? String(this.api.LMSGetValue(k)) : ''; }catch(e){ return ''; } },
    set(k,v){ try{ if(this.ok) this.api.LMSSetValue(k,String(v)); }catch(e){} },
    commit(){ try{ if(this.ok) this.api.LMSCommit(''); }catch(e){} },
    /* interaction : id sans espace ; type choice / numeric / performance */
    inter(id,type,resp,res){ if(!this.ok) return; const n=+this.get('cmi.interactions._count')||0, p=`cmi.interactions.${n}.`;
      this.set(p+'id',id); this.set(p+'type',type); this.set(p+'student_response',resp); this.set(p+'result',res); this.set(p+'time',new Date().toTimeString().slice(0,8)); },
    /* suspend_data : JSON v:2, 4096 caractères au plus (SCORM 1.2) */
    save(){ if(!this.ok) return; let o={v:2,...state()}, j=JSON.stringify(o);
      if(j.length>4000){ o={...o, dangers:o.dangers.map(d=>d.slice(0,40)), scens:o.scens.map(s=>s&&({...s,dangers:(s.dangers||[]).map(d=>d.slice(0,40))}))}; j=JSON.stringify(o); }
      this.set('cmi.suspend_data',j.slice(0,4096)); this.commit(); },
    finish(){ if(!this.ok) return; const s=Math.round((Date.now()-t0())/1000), hh=String(Math.floor(s/3600)).padStart(4,'0'), mm=String(Math.floor(s/60)%60).padStart(2,'0'), ss=String(s%60).padStart(2,'0');
      this.set('cmi.core.session_time',`${hh}:${mm}:${ss}`); this.set('cmi.core.exit','suspend'); this.save(); try{ this.api.LMSFinish(''); }catch(e){} this.ok=false; } };
  window.addEventListener('pagehide',()=>scorm.finish()); window.addEventListener('beforeunload',()=>scorm.finish());
  return scorm;
}
