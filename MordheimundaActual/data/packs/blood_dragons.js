(function(){
  const clone=o=>JSON.parse(JSON.stringify(o));
  const BLOOD_DRAGON_RULES=[
    'Eternally Brave: Blood Dragon Vampires may re-roll the first failed Rout test (if the Vampire is not out of action).',
    'Honour: Blood Dragon Vampires may not attempt to break away from combat or Voluntarily Rout (if the Vampire and Vampire Thrall is not out of action).',
    'Warrior Code: Blood Dragon Vampire can wear armour and still use spells, but can only learn the Necromancy : 2 Invocation of Nehek and 6 Spell of Awakening.'
  ];
  window.registerNecroheimPack({
    id:'blood-dragons',
    name:'Blood Dragons',
    version:'1.3',
    type:'supplement',
    compatibleFactions:['undead'],
    source:'Vampire Supplement Blood Dragons.pdf',
    description:'Supplément Blood Dragons pour la faction Undead.',
    apply(catalog){
      const base=catalog.factions.find(f=>f.id==='undead');
      if(!base || catalog.factions.some(f=>f.id==='blood-dragons')) return;
      const faction=clone(base);
      faction.id='blood-dragons';
      faction.name='Blood Dragons';
      faction.displayName='Blood Dragons';
      faction.title='Blood Dragon Warband Supplement';
      faction.packId='blood-dragons';
      faction.baseFactionId='undead';
      faction.startPage=null;
      faction.equipmentPage=3;
      faction.description='Supplément Blood Dragons. Les éléments ci-dessous sont ajoutés/modifiés par ce pack.';

      // The supplement prints its own Undead Equipment List. Keep it distinct
      // from the core Undead list: notably, Light Armour is not listed here,
      // while Full Plate Armour is. Buckler remains available under Vampire Weapons.
      faction.equipment=[
        'Axe','Club','Dagger','Great Axe','Great Hammer','Great Sword','Halberd','Hammer or Mace','Spear','Sword',
        'Staff','Bow','Crossbow','Buckler','Bastard Sword','Rapier','Full plate armour','Heavy armour','Shield','Lantern','Rope and hook','Dire Wolves'
      ];
      faction.equipmentItemGroups={
        'Axe':['Close Combat Weapons','Necromancer Weapons'],
        'Club':['Close Combat Weapons','Necromancer Weapons'],
        'Dagger':['Close Combat Weapons','Necromancer Weapons'],
        'Great Axe':['Close Combat Weapons'],
        'Great Hammer':['Close Combat Weapons'],
        'Great Sword':['Close Combat Weapons'],
        'Halberd':['Close Combat Weapons'],
        'Hammer or Mace':['Close Combat Weapons','Necromancer Weapons'],
        'Spear':['Close Combat Weapons'],
        'Sword':['Close Combat Weapons','Necromancer Weapons'],
        'Staff':['Necromancer Weapons'],
        'Bow':['Missile Weapons'],
        'Crossbow':['Missile Weapons'],
        'Buckler':['Vampire Weapons'],
        'Bastard Sword':['Vampire Weapons'],
        'Rapier':['Vampire Weapons'],
        'Full plate armour':['Armour'],
        'Heavy armour':['Armour'],
        'Shield':['Armour'],
        'Lantern':['Wargear'],
        'Rope and hook':['Wargear'],
        'Dire Wolves':['Wargear']
      };

      // Blood Dragon Vampires start with +2 Weapon Skill. The supplement's
      // Vampire Thrall is explicitly described as a lesser Vampire, so it
      // receives the same Blood Dragon Vampire modifier.
      faction.packRuleModifiers=[
        {id:'bd-martial-prowess-vampire',rule:'Martial Prowess',target:'Vampire',targetType:'unit',stat:'WS',amount:2,source:'Blood Dragons'},
        {id:'bd-martial-prowess-thrall',rule:'Martial Prowess',target:'Vampire Thrall',targetType:'unit',stat:'WS',amount:2,source:'Blood Dragons'},
        {id:'bd-men-at-arms',rule:'Men-at-Arms',target:'Dregs',targetType:'unit',stat:'WS',amount:1,source:'Blood Dragons'}
      ];

      const vampire=faction.warriors.find(w=>w.id==='vampire');
      if(vampire){
        // Exact skill distribution shown in the supplement table:
        // Agility Primary, Brawn Primary, Combat Secondary, Cunning Primary,
        // Ferocity Secondary. Bloodline Powers is an additional Primary tree.
        vampire.skillAccess={
          Agility:'Primary',
          Brawn:'Primary',
          Combat:'Secondary',
          Cunning:'Primary',
          Ferocity:'Secondary',
          'Bloodline Powers':'Primary'
        };
        vampire.ruleNames=['Race','Leader','Undead','Vampiric','Martial Prowess','Eternally Brave','Honour','Warrior Code'];
        vampire.packRules=[
          'Martial Prowess: Blood Dragon Vampires start with +2 Weapon Skill.',
          ...BLOOD_DRAGON_RULES
        ];
        vampire.packModifiers=faction.packRuleModifiers.filter(m=>m.target==='Vampire');
        vampire.magicAccess={Necromancy:'Primary'};
        vampire.magicSpellWhitelist={Necromancy:['Invocation of Nehek','Spell of Awakening']};
        vampire.rules='Race (Vampire), Leader, Undead, Vampiric. Martial Prowess: Blood Dragon Vampires start with +2 Weapon Skill. Eternally Brave: Blood Dragon Vampires may re-roll the first failed Rout test (if the Vampire is not out of action). Honour: Blood Dragon Vampires may not attempt to break away from combat or Voluntarily Rout (if the Vampire and Vampire Thrall is not out of action). Warrior Code: Blood Dragon Vampire can wear armour and still use spells, but can only learn the Necromancy : 2 Invocation of Nehek and 6 Spell of Awakening.';
      }

      const dregs=faction.warriors.find(w=>w.id==='dregs');
      if(dregs){
        dregs.ruleNames=['Race','Raw Recruit','Men-at-Arms'];
        dregs.packRules=['Men-at-Arms: Dregs start with +1 Weapon Skill.'];
        dregs.packModifiers=faction.packRuleModifiers.filter(m=>m.target==='Dregs');
        dregs.rules='Race (Human), Raw Recruit. Men-at-Arms: Dregs start with +1 Weapon Skill.';
      }

      // Exact new Champion entry from the supplement.
      faction.warriors.push({
        id:'vampire-thrall',
        name:'Vampire Thrall',
        type:'Champion',
        max:1,
        cost:120,
        profile:[5,4,3,4,4,2,5,2,7,7,7,7],
        access:'Undead Equipment List',
        equipmentAccessGroups:['Close Combat Weapons','Vampire Weapons','Armour','Wargear'],
        equipmentAccessSource:'Vampire Supplement Blood Dragons',
        equipmentAccessExplicit:['Close Combat Weapons','Vampire Weapons','Armour','Wargear'],
        skillAccess:{Agility:'Primary',Brawn:'Primary',Combat:'Secondary',Cunning:'Primary',Ferocity:'Secondary','Bloodline Powers':'Primary'},
        ruleNames:['Race','Champion','Undead','Vampiric','Martial Prowess','Eternally Brave','Honour','Warrior Code'],
        rules:'Race (Vampire), Champion, Undead, Vampiric. Martial Prowess: Blood Dragon Vampires start with +2 Weapon Skill. Eternally Brave: Blood Dragon Vampires may re-roll the first failed Rout test (if the Vampire is not out of action). Honour: Blood Dragon Vampires may not attempt to break away from combat or Voluntarily Rout (if the Vampire and Vampire Thrall is not out of action). Warrior Code: Blood Dragon Vampire can wear armour and still use spells, but can only learn the Necromancy : 2 Invocation of Nehek and 6 Spell of Awakening.',
        startingSkill:true,
        packId:'blood-dragons',
        packRules:[
          'Martial Prowess: Blood Dragon Vampires start with +2 Weapon Skill.',
          ...BLOOD_DRAGON_RULES
        ],
        packModifiers:faction.packRuleModifiers.filter(m=>m.target==='Vampire Thrall'),
        magicAccess:{Necromancy:'Primary'},
        magicSpellWhitelist:{Necromancy:['Invocation of Nehek','Spell of Awakening']}
      });

      faction.bloodlinePowers=[
        {id:'red-fury',name:'Red Fury',text:'The Vampire has +1 Attack (this does not count toward his Maximum).'},
        {id:'blade-master',name:'Blade Master',text:'The Vampire can parry attacks as though they were carrying a weapon with the Parry Trait (see page 118). If they already have one or more weapons with this Trait, they can parry one additional attack. This skill is cumulative with Parry Skill.'},
        {id:'hearth-piercing',name:'Hearth Piercing',text:'The Vampire may re-roll missed attacks when charging.'},
        {id:'strength-of-steel',name:'Strength of Steel',text:'The Vampire has +1 Strength (this does not count toward his maximum) in the turn he charges.'},
        {id:'transfiring-glare',name:'Transfiring Glare',text:'The Glare may be used on any living model in base contact that is not Immune to Psychology. The victim must pass a Leadership test on 2D6 or be transfixed. A transfixed model may not attack in close combat and is treated as being pinned for purpose of being attacked. Roll for the Glare at the start of the combat sequence.'},
        {id:'fliying-horror',name:'Fliying Horror',text:'Count the movement of this model as 10” and this model can ignore all terrain, may move freely between levels without restriction. They may not however move through impassable terrain or walls.'}
      ];
      // Bloodline Powers is a real skill set in the roster UI, not just pack lore.
      catalog.skillSets=catalog.skillSets||{};
      catalog.skillSets['Bloodline Powers']=faction.bloodlinePowers.map(p=>p.name);
      faction.packRules=[
        'Martial Prowess: Blood Dragon Vampires start with +2 Weapon Skill.',
        ...BLOOD_DRAGON_RULES,
        'Men-at-Arms: Dregs start with +1 Weapon Skill.'
      ];
      catalog.factions.push(faction);
      if(catalog.skillAccess && catalog.skillAccess.undead) catalog.skillAccess['blood-dragons']=clone(catalog.skillAccess.undead);
      if(catalog.skillAccess && catalog.skillAccess['blood-dragons']){
        catalog.skillAccess['blood-dragons']['Vampire']={Agility:'Primary',Brawn:'Primary',Combat:'Secondary',Cunning:'Primary',Ferocity:'Secondary','Bloodline Powers':'Primary'};
        catalog.skillAccess['blood-dragons']['Vampire Thrall']={Agility:'Primary',Brawn:'Primary',Combat:'Secondary',Cunning:'Primary',Ferocity:'Secondary','Bloodline Powers':'Primary'};
      }
      if(catalog.packMeta==null) catalog.packMeta=[];
      catalog.packMeta.push({id:'blood-dragons',name:'Blood Dragons',version:'1.3',type:'supplement',source:'Vampire Supplement Blood Dragons.pdf'});
    }
  });
})();
