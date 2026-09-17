/* Storage boundary: the UI talks to this object, not directly to localStorage. */
(function(){
  const KEY='necroheim_roster_v4';
  const META_KEY='mordheimunda_local_meta';
  const migrate=window.MordheimundaMigrations.migrate;
  const read=()=>{try{return migrate(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{return migrate(null)}};
  const write=value=>{const next=migrate(value);next.meta=next.meta||{};next.meta.updatedAt=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(next));return next};
  const deviceId=()=>{let id=localStorage.getItem('mordheimunda_device_id');if(!id){id=crypto.randomUUID();localStorage.setItem('mordheimunda_device_id',id)}return id};
  window.MordheimundaStorage={
    key:KEY,
    load:read,
    save:write,
    clear:()=>localStorage.removeItem(KEY),
    exportData:()=>JSON.stringify(read(),null,2),
    importData:raw=>write(typeof raw==='string'?JSON.parse(raw):raw),
    deviceId:deviceId(),
    mode:()=>window.MORDHEIMUNDA_CONFIG?.storageMode||'local'
  };
})();
