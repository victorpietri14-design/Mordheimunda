/* Content registry. New rules/content should be added as packs instead of editing app.js. */
(function(){
  const registry=[];
  window.MordheimundaContent={
    register(pack){if(!pack||!pack.id)throw new Error('Content pack requires an id');if(registry.some(p=>p.id===pack.id))throw new Error('Duplicate content pack: '+pack.id);registry.push(pack);return pack},
    all:()=>registry.slice(),
    get:id=>registry.find(p=>p.id===id)||null
  };
})();
