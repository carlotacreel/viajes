/* Puente: la app usa claude.use(...) como en Claude; aquí lo resuelve Firebase. */
(function(){
  const waits={};
  window.__rt={resolve:(n,v)=>{(waits[n]=waits[n]||mk()).res(v)}};
  function mk(){let res;const p=new Promise(r=>res=r);return {p,res}}
  window.claude={use:n=>(waits[n]=waits[n]||mk()).p};
})();
