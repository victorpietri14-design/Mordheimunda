/* Versioned local data migrations. Never delete old migrations: users may skip versions. */
(function(){
  const CURRENT_SCHEMA=4;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const migrations={
    1:s=>{s.customEquipment=Array.isArray(s.customEquipment)?s.customEquipment:[];return s},
    2:s=>{s.customWarbands=Array.isArray(s.customWarbands)?s.customWarbands:[];return s},
    3:s=>{s.customFighters=Array.isArray(s.customFighters)?s.customFighters:[];s.customSkills=Array.isArray(s.customSkills)?s.customSkills:[];s.customSpells=Array.isArray(s.customSpells)?s.customSpells:[];return s},
    4:s=>{s.schemaVersion=4;s.meta=s.meta&&typeof s.meta==='object'?s.meta:{};s.meta.updatedAt=s.meta.updatedAt||new Date().toISOString();return s}
  };
  window.MordheimundaMigrations={CURRENT_SCHEMA, migrate(input){
    let s=input&&typeof input==='object'?clone(input):{rosters:[],active:null};
    let v=Number(s.schemaVersion||0);
    while(v<CURRENT_SCHEMA){v++;if(migrations[v])s=migrations[v](s);}
    s.schemaVersion=CURRENT_SCHEMA;
    if(!Array.isArray(s.rosters))s.rosters=[];
    return s;
  }};
})();
