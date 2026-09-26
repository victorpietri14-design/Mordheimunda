(function(){
  const packs=[];
  window.NECROHEIM_PACKS=packs;
  window.registerNecroheimPack=function(pack){
    if(!pack||!pack.id) throw new Error('Invalid Necroheim pack');
    if(packs.some(p=>p.id===pack.id)) return;
    packs.push(pack);
    if(window.MordheimundaContent) window.MordheimundaContent.register(pack);
    if(typeof window.NECROHEIM_CATALOG!=='undefined' && typeof pack.apply==='function') pack.apply(window.NECROHEIM_CATALOG);
  };
  window.getNecroheimPacks=function(){return packs.slice();};
})();
