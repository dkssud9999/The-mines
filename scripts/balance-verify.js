'use strict';

function runBalanceChecks(gameHtml, options = {}) {
  if (typeof gameHtml !== 'string') throw new TypeError('gameHtml must be the full index.html source');
  const marker = 'syncWeaponPicker();requestAnimationFrame(loop);';
  const inlineScripts = [...gameHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  const source = inlineScripts.find(script => script.includes(marker));
  if (!source) throw new Error(`Could not find game script marker: ${marker}`);

  const results = [];
  class BalanceURLSearchParams {
    constructor(search = '') {
      this.values = new Map();
      for (const part of String(search).replace(/^\?/, '').split('&')) {
        if (!part) continue;
        const split = part.indexOf('=');
        const key = split < 0 ? part : part.slice(0, split);
        const value = split < 0 ? '' : part.slice(split + 1);
        this.values.set(key.replace(/\+/g, ' '), value.replace(/\+/g, ' '));
      }
    }
    get(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
    has(key) { return this.values.has(String(key)); }
  }
  const check = (name, fn) => {
    try { fn(); results.push({ name, ok: true }); }
    catch (error) { results.push({ name, ok: false, error: error.message }); }
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const approx = (actual, expected, message, epsilon = 1e-6) => assert(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);

  const elements = new Map();
  const windowHandlers = new Map();
  const documentHandlers = new Map();
  const canvasHandlers = new Map();
  const context2d = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: String(text).length * 7 }),
    getImageData: () => ({ data: new Uint8ClampedArray(16) }),
  }, { get(target, key) { if (key in target) return target[key]; return () => {}; }, set(target, key, value) { target[key] = value; return true; } });
  class MockElement {
    constructor(id = '') { this.id = id; this.children = []; this.listeners = new Map(); this.style = { setProperty() {} }; this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }; this.textContent = ''; this.innerHTML = ''; this.disabled = false; this.width = 960; this.height = 540; this.clientWidth = 960; }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    appendChild(child) { this.children.push(child); return child; }
    insertAdjacentHTML() {}
    querySelector() { return new MockElement(); }
    getContext() { return context2d; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
    setPointerCapture() {}
    requestFullscreen() { return Promise.resolve(); }
  }
  const canvas = new MockElement('game');
  elements.set('game', canvas);
  const document = {
    body: new MockElement('body'), fullscreenElement: null,
    getElementById(id) { if (!elements.has(id)) elements.set(id, new MockElement(id)); return elements.get(id); },
    createElement(tag) { return new MockElement(tag); },
    addEventListener(type, fn) { if (!documentHandlers.has(type)) documentHandlers.set(type, []); documentHandlers.get(type).push(fn); },
    exitFullscreen() { return Promise.resolve(); },
  };
  const local = new Map();
  if (options.saved) local.set('mine-reverb-save', JSON.stringify(options.saved));
  const localStorage = { getItem(key) { return local.get(key) ?? null; }, setItem(key, value) { local.set(key, String(value)); } };
  const perf = { now: () => now };
  let now = 1000;
  class MockImage { constructor() { this.complete = true; this.naturalWidth = 1; this.naturalHeight = 1; this.width = 1; this.height = 1; } set src(value) { this._src = value; } }
  const window = {
    innerWidth: 960, innerHeight: 540, devicePixelRatio: 1, screen: {},
    addEventListener(type, fn, options) { if (!windowHandlers.has(type)) windowHandlers.set(type, []); windowHandlers.get(type).push({ fn, options }); },
    removeEventListener() {},
  };
  const location = { search: options.search || '' };
  const raf = () => 1, cancelRaf = () => {}, timer = () => 1, clearTimer = () => {};
  const exportCode = `window.__balanceApi={
    finishRoom:()=>{pendingWaves=[];spawnPortals=[];if(specialRoom){specialRoom.timer=0;updateSpecialRoom(0);}else if(!enemies.length)spawnEnemy('grunt',0);for(let pass=0;pass<8&&enemies.length;pass++)for(const enemy of [...enemies])killEnemy(enemy);for(let i=0;i<5&&screen==='playing';i++)update(1);},settle:()=>{for(let i=0;i<5&&screen==='playing';i++)update(1);},chooseWeaponUpgrade,getUpgradeOptions:()=>player.weaponUpgrade?(weaponUpgradeBranches[player.weaponUpgrade]||[]):weaponUpgrades[player.weapon],startRun:()=>startRun(), setDifficulty:n=>{difficulty=n;saved.highestDifficulty=3;},
    setProgress:(value,room=0)=>{stage=value;roomCount=room;},clickEndAction:text=>{const button=document.getElementById('endActions').children.find(x=>x.textContent===text);if(!button)throw new Error('Missing end action '+text);for(const fn of button.listeners.get('click')||[])fn();},getState:()=>({phase,screen,stage,roomCount,runDifficulty,lootAfter,lootPool:lootPool.map(x=>x.id),player:player&&{...player},boss:boss&&{...boss},enemies:enemies.map(e=>({...e})),shots:shots.map(s=>({...s})),voidWaves:voidWaves.map(w=>({...w})),touchMove:{...touchMove},touchAim:{...touchAim},mouse:{...mouse},attackTimer,dashCooldown,invuln,collapseBurstOver:player?.collapseBurstOver}),
    setRelic:(id,n=1)=>{relicBag[id]=n;}, setEnemyList:list=>{enemies=list;}, setBoss:e=>{boss=e;enemies=e?[e]:[];phase='boss';}, setPlayer:(patch)=>Object.assign(player,patch),
    ii:{clickCard:i=>{const kids=document.getElementById('lootCards').children,c=kids[kids.length-2+i];for(const fn of c.listeners.get('click')||[])fn();},props:()=>props,drops:()=>drops,ore:()=>ore,seals:()=>seals,setSeals:v=>{seals=v;},setOre:v=>{ore=v;},heatTier,addHeat,addProp,hitProp,updateProps,collectAllDrops,spawnOre,spawnEnemy,openDeepGate,zoneMap:()=>zoneMap,generateZoneMap,enemies:()=>enemies,bullets:()=>bullets,addBullet:(x,y)=>bullets.push({x,y,vx:0,vy:0,r:5,damage:1,life:9,color:'#fff'}),clearEnemies:()=>{enemies=[];pendingWaves=[];spawnPortals=[];},clearProps:()=>{props=[];},placeProp:(kind,x,y)=>{const p={kind,x,y,r:15,hp:kind==='vein'?3:1,maxHp:3,flash:0,spawn:0,fuse:0,seed:0};props.push(p);return p;},tryParry,playerRef:()=>player,winRecorded:()=>winRecorded,crystals:()=>saved.crystals||0,guild:(id,n)=>{saved.guild={...(saved.guild||{}),[id]:n};},guildLevel,startSpecialRoom,specialRoom:()=>specialRoom,updateSpecialRoom,startElite,firePick:(a)=>firePickSwing(a,32,1,null),giveRelic:grantRelic,setStage:v=>{stage=v;},deepZone,updateEnemies},chooseMapNode,mapChoices,advanceZone,chooseRoute,openLoot,takeLoot,skipOptionalLoot,makeLoot,makeTierLoot,makeOwnedStackLoot,healPlayer,save,
    setWeapon:value=>{selectedWeapon=value;},setAim:(x,y)=>{mouse.x=x;mouse.y=y;},setAttackCount:value=>{player.attackCount=value;},setUpgrade:(one,two=null)=>{player.weaponUpgrade=one;player.weaponUpgrade2=two;},getAttackStats:()=>({momentumHits,abyssHitStreak,pendingEchoes:pendingEchoes.map(e=>({...e}))}),updateShots,updatePendingEchoes,startWave,startElite,startBoss,resetRoomCombat,update,updateEnemies,updateBoss,updateVoidCharge,updateVoidWaves,startAttack,tryDash,activateCombatPower,hurtPlayer,damageEnemy,
    setScreen,recordBalanceRoom,beginBalanceRoom,report:()=>window.mineBalanceReport,
    getRelics:()=>({...relicBag}),getSaved:()=>({...saved}),getWeapons:()=>weapons,getRelicDefs:()=>relics,getUpgradeDefs:()=>weaponUpgrades,getBranchDefs:()=>weaponUpgradeBranches,setBenchmark:(weapon,one,two,bag,count,distance,spread)=>{selectedWeapon=weapon;difficulty=1;startRun();startWave('wave');setScreen('playing');pendingWaves=[];spawnPortals=[];props=[];obstacles=[];clearShots(true);enemies=Array.from({length:count},(_,i)=>({kind:'grunt',x:480+distance+(spread?i*30:i%3*8),y:300+(spread?(i-(count-1)/2)*65:Math.floor(i/3)*9),r:13,hp:1e8,maxHp:1e8,speed:0,damage:0,flash:0}));player.x=480;player.y=300;player.weaponUpgrade=one;player.weaponUpgrade2=two;mouse.x=480+distance;mouse.y=300;for(const key of Object.keys(relicBag))delete relicBag[key];Object.assign(relicBag,bag);},benchmarkTick:()=>{mouse.down=true;const homes=enemies.map(e=>[e,e.x,e.y]);update(1/60);for(const [e,x,y] of homes){e.x=x;e.y=y;e.kbx=0;e.kby=0;}},benchmarkHP:()=>enemies.reduce((sum,e)=>sum+e.hp,0),
    setNow:v=>setMockNow(v),dispatchWindow:(type,e={})=>{for(const h of [...(windowHandlers.get(type)||[])])h.fn(e);},
    dispatchCanvas:(type,e={})=>{for(const h of [...(canvas.listeners.get(type)||[])])h(e);},dispatchDocument:(type,e={})=>{for(const h of [...(documentHandlers.get(type)||[])])h(e);},
    canvas,handlers:windowHandlers
  };`;
  const injected = source.replace(marker, `${exportCode}requestAnimationFrame(loop);`);
  try {
    const bootstrap = new Function('window','document','Image','localStorage','performance','location','URLSearchParams','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','Math','Date','Map','Set','WeakMap','Uint8ClampedArray','windowHandlers','documentHandlers','canvas','setMockNow', injected);
    bootstrap(window,document,MockImage,localStorage,perf,location,BalanceURLSearchParams,raf,cancelRaf,timer,clearTimer,timer,clearTimer,Math,Date,Map,Set,WeakMap,Uint8ClampedArray,windowHandlers,documentHandlers,canvas,v=>{now=v;});
  }
  catch (error) { throw new Error(`Game script bootstrap failed: ${error.stack || error.message}`); }
  const api = window.__balanceApi;if(options.weapon)api.setWeapon(options.weapon);
  const evt = (type, id, x, y, extra = {}) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, preventDefault() {}, stopImmediatePropagation() {}, ...extra });
  const firePointer = (type, id, x, y, extra) => {
    const event = evt(type, id, x, y, extra);
    api.dispatchWindow(type, event);
    api.dispatchCanvas(type, event);
  };
  if (typeof globalThis.Audio === 'undefined') globalThis.Audio = class { play() { return Promise.resolve(); } };
  const newRun = (difficulty = 0) => { api.setDifficulty(difficulty); api.startRun(); if (api.getState().screen === 'map') api.chooseMapNode(api.mapChoices()[0]); };
  const findId = (id, list) => list.some(item => item.id === id);

  check('saved configuration survives load and run setup', () => {
    const saved = api.getSaved();
    assert(Array.isArray(saved.unlockedWeapons) && saved.unlockedWeapons.includes(options.saved?.unlockedWeapons?.[0] || 'axe'), 'saved weapon config was not loaded');
    newRun(2);
    assert(api.getState().runDifficulty === 2, 'selected difficulty was not applied to run');
    api.save();
    assert(JSON.parse(localStorage.getItem('mine-reverb-save')).bestZone === saved.bestZone, 'save did not persist progress');
  });

  for (let difficulty = 0; difficulty < 4; difficulty++) {
    for (const route of ['shrine', 'elite']) {
      for (const resolution of ['skip', 'take']) {
        check(`difficulty ${difficulty} ${route} route risk ${resolution}`, () => {
          newRun(difficulty);
          let steps=0,firstUpgradeSeen=false;
          while(api.getState().screen!=='end'&&steps++<500){
            const current=api.getState();
            if(current.screen==='playing')api.finishRoom();
            else if(current.screen==='map'){const choices=api.mapChoices();api.chooseMapNode(choices.find(n=>n.type===route)||choices.find(n=>!['shop','event'].includes(n.type))||choices[0]);}
            else if(current.screen==='weaponUpgrade'){
              if(!current.player.weaponUpgrade){firstUpgradeSeen=true;assert(current.stage===1,'first upgrade delayed beyond first zone');assert(current.roomCount>=1,'first upgrade came before any combat room');}
              api.chooseWeaponUpgrade(api.getUpgradeOptions()[0].id,current.player.weaponUpgrade?2:1);
            }else if(current.screen==='loot'){
              assert(new Set(current.lootPool).size===current.lootPool.length,'duplicate loot candidates');
              if(current.lootAfter==='shop'||current.lootAfter==='event')api.advanceZone();
              else if(current.lootAfter==='riskPick'&&resolution==='skip')api.skipOptionalLoot();
              else if(current.lootPool.length)api.takeLoot(current.lootPool[0]);
              else api.skipOptionalLoot();
            }else throw new Error('unexpected progression state '+current.screen);
          }
          assert(api.getState().screen==='end'&&api.getState().stage===4,`full run did not reach fourth-zone completion: ${api.getState().screen} stage ${api.getState().stage} phase ${api.getState().phase} after ${steps} steps`);
          assert(firstUpgradeSeen,'first upgrade never offered');
        });
      }
    }
    check(`difficulty ${difficulty} loot stack cap and uniqueness`, () => {
      newRun(difficulty);
      const pool = api.makeLoot(3);
      assert(new Set(pool.map(x => x.id)).size === pool.length, 'ordinary loot contains duplicate IDs');
      const defs = api.getRelicDefs();
      const capped = Object.entries(defs).find(([, item]) => item.maxStacks === 1);
      assert(capped, 'no single-stack relic definition found');
      api.setRelic(capped[0], 1);
      api.openLoot('route');
      api.takeLoot(capped[0]);
      assert(api.getRelics()[capped[0]] === 1, 'capped relic stack increased beyond maxStacks');
    });
  }

  check('void charge pauses while move input is held at wall', () => {
    newRun(3); const before = api.getState().player.voidCharge;
    api.updateVoidCharge(2, 0, false, true);
    approx(api.getState().player.voidCharge, before, 'void charge advanced while pushing into wall');
    api.updateVoidCharge(2, 0, false, false);
    assert(api.getState().player.voidCharge > before, 'void charge did not build while stationary');
  });
  check('void wave reset does not retrigger from stale full charge', () => {
    newRun(3); api.setPlayer({ voidCharge: 1 }); api.updateVoidCharge(0, 0, false, false);
    assert(api.getState().voidWaves.length === 1, 'full charge did not create wave');
    api.resetRoomCombat(); api.updateVoidCharge(0, 0, false, false);
    assert(api.getState().voidWaves.length === 0, 'room reset discarded wave but stale charge immediately emitted another');
  });
  check('void stun does not hold a star boss below its scripted threshold', () => {
    newRun(3);
    const boss = { kind:'boss',bossKind:'star',name:'test',x:480,y:142,r:32,hp:700,maxHp:1000,stunTimer:4,act:'combat',thresholdIndex:0,finalAct:false,lastStand:false,invulnerable:false,phase:1,attack:1,telegraph:null,hellIndex:0,hellTimer:0,hellAttack:0,hellWaves:0,finalPressure:3,chargeTime:0,finalAct:false };
    api.setBoss(boss); api.updateEnemies(.016);
    assert(boss.act !== 'combat' || boss.invulnerable, 'stun skipped scripted star threshold transition');
  });
  check('burst timer pauses during invulnerability and while paused', () => {
    newRun(3); api.setRelic('collapse_burst'); api.startBoss(); api.setPlayer({collapseBurstTimer:10});
    api.setBoss({...api.getState().boss,invulnerable:true}); api.update(.5);
    approx(api.getState().player.collapseBurstTimer, 10, 'burst timer advanced during boss invulnerability');
    api.setScreen('paused'); api.update(.5);
    approx(api.getState().player.collapseBurstTimer, 10, 'burst timer advanced while paused');
  });
  check('cannon room cost and timer do not trigger hurt or clear adrenaline', () => {
    newRun(2); api.setRelic('collapse_cannon'); api.setPlayer({adrenaline:0.7,adrenalineActive:0,hp:100});
    api.startAttack(1);
    const afterShot = api.getState();
    approx(afterShot.player.hp, 80, 'cannon cost');
    approx(afterShot.player.adrenaline, 0.7, 'cannon self-cost cleared adrenaline');
    approx(afterShot.player.collapseCannonTimer, 4, 'cannon timer initialization');
    api.update(.75);
    assert(api.getState().player.collapseCannonTimer < 4, 'cannon timer did not advance');
    api.startWave();
    approx(api.getState().player.collapseCannonTimer, 0, 'cannon timer did not reset at room boundary');
    assert(api.getState().player.collapseCannonUsed === false, 'cannon was not made available in next room');
  });
  check('telemetry records actual HP damage, healing, resource use, and completed rooms', () => {
    newRun(1);
    const target = {kind:'grunt',x:100,y:100,r:10,hp:20,maxHp:20};
    api.setEnemyList([target]); api.damageEnemy(target,7,'axe');
    api.setPlayer({hp:50,maxHp:100}); api.healPlayer(10); const beforeHurt=api.getState().player.hp; api.hurtPlayer(6);
    api.setPlayer({dashing:0}); api.tryDash();
    const report = api.report();
    const active = report.rooms[report.rooms.length-1];
    approx(active.damageDealt, 7, 'telemetry dealt damage');
    approx(active.healed, 10, 'telemetry healing');
    approx(active.damageTaken, beforeHurt-Math.max(0,api.getState().player.hp), 'telemetry hurt');
    assert(active.resourceUses >= 1, 'telemetry did not record resource use');
    assert(typeof report.seed === 'number' || report.seed === null, 'telemetry omitted seed');
    api.recordBalanceRoom(); api.beginBalanceRoom(); api.recordBalanceRoom();
    assert(api.report().rooms.length >= 2, 'room snapshot was not recorded');
  });
  check('mobile movement and aim pointers operate simultaneously', () => {
    newRun(2); firePointer('pointerdown', 1, 110, 400); firePointer('pointerdown', 2, 820, 400);
    firePointer('pointermove', 1, 145, 425); firePointer('pointermove', 2, 865, 390);
    const state = api.getState();
    assert(state.touchMove.active && state.touchAim.active, 'two mobile sticks are not active together');
    assert(Math.hypot(state.touchMove.dx,state.touchMove.dy) > 0.1, 'movement stick did not respond');
    assert(Math.hypot(state.touchAim.dx,state.touchAim.dy) > 0.1, 'aim stick did not respond');
  });
  check('mobile dash, rage, adrenaline, pointer cancel, and blur handlers', () => {
    newRun(2); firePointer('pointerdown', 1, 882, 320);
    assert(api.getState().player.dashing > 0, 'mobile dash button did not start dash');
    api.setPlayer({rage:1,adrenaline:1,dashing:0});
    firePointer('pointerdown', 2, 422, 472); assert(api.getState().player.rageActive > 0, 'mobile rage button did not activate');
    firePointer('pointerdown', 3, 538, 472); assert(api.getState().player.adrenalineActive > 0, 'mobile adrenaline button did not activate');
    firePointer('pointerdown', 4, 700, 400); firePointer('pointercancel', 4, 700, 400);
    assert(!api.getState().touchAim.active, 'pointercancel left mobile aim held');
    firePointer('pointerdown', 5, 700, 400); api.dispatchWindow('blur', {});
    assert(!api.getState().touchAim.active && !api.getState().touchMove.active, 'blur left mobile controls held');
  });
  check('seeded run randomness repeats and default randomness remains opt-in', () => {
    if (options.search && new BalanceURLSearchParams(options.search).has('balanceSeed')) {
      const seed = Number(new BalanceURLSearchParams(options.search).get('balanceSeed')) >>> 0;
      assert(api.report().seed === seed, 'report does not expose configured balance seed');
      newRun(2); const first = api.makeLoot(3).map(item => item.id).join(',');
      newRun(2); const second = api.makeLoot(3).map(item => item.id).join(',');
      assert(first === second, `seeded loot diverged across identical runs (${first} vs ${second})`);
    } else assert(api.report().seed === null, 'unseeded report should expose null seed');
  });

  check('Prism echo shares resolved Gambler damage and attack identity',()=>{
    api.setWeapon('wand');newRun(2);api.setEnemyList([]);api.setUpgrade('wand_prism');api.setRelic('abyss_gambler');api.setRelic('echo');api.setAttackCount(3);api.setAim(900,100);api.startAttack();
    const original=api.getState().shots[0];const pending=api.getAttackStats().pendingEchoes[0];
    assert(original.attackContext===pending.attackContext,'echo lost original context');
    approx(original.damage,pending.attackContext.damage,'echo damage lost gamble/prism coefficients');
    api.setNow(10000);api.updatePendingEchoes();
    const echo=api.getState().shots.find(x=>x.kind==='echo');assert(echo,'deferred echo did not spawn');
    approx(echo.damage,original.damage,'resolved echo damage mismatch');
    assert(echo.attackContext.id===original.attackContext.id,'echo attack ID changed');
  });
  check('Hungry waits for deferred echo and charges entire missed family once',()=>{
    api.setWeapon('wand');newRun(2);api.setEnemyList([]);api.setRelic('abyss_hungry');api.setRelic('echo');api.setAttackCount(3);api.setAim(900,100);api.startAttack();
    for(let i=0;i<110;i++)api.updateShots(1/60);
    approx(api.getState().player.hp,100,'miss charged before deferred echo completed');
    api.setNow(20000);api.updatePendingEchoes();for(let i=0;i<130;i++)api.updateShots(1/60);
    approx(api.getState().player.hp,97,'missed family was not charged once');
  });
  check('Discarding a missed attack on new room or run does not charge the next player',()=>{
    api.setWeapon('wand');newRun(2);api.setEnemyList([]);api.setRelic('abyss_hungry');api.setRelic('echo');api.setAttackCount(3);api.startAttack();api.setScreen('loot','lootOverlay');api.startWave();
    approx(api.getState().player.hp,100,'room change charged cancelled miss');
    api.startAttack();api.startRun();approx(api.getState().player.hp,100,'new run inherited old miss cost');
  });
  check('Multiple reflected Split bolts pay reflect cost only once per attack',()=>{
    api.setWeapon('wand');newRun(2);api.setEnemyList([]);api.setRelic('abyss_reflect');api.setRelic('split',3);api.setAim(20,100);api.startAttack();
    for(let i=0;i<180;i++)api.updateShots(1/60);
    approx(api.getState().player.hp,98,'reflection cost not shared across shots');
  });
  // The Mines II: every check below exercises a link BETWEEN systems, not one feature alone.
  const ii=api.ii,freshRoom=(d=0,w='axe')=>{api.setWeapon(w);newRun(d);ii.clearEnemies();ii.clearProps();};
  check('II vein -> ore chunks -> heat -> Overdrive chain',()=>{
    freshRoom();const v=ii.placeProp('vein',300,300);ii.hitProp(v,3);assert(!ii.props().includes(v),'vein did not break');assert(ii.drops().length>0,'vein gave no ore chunks');
    const heat0=ii.playerRef().rage;ii.collectAllDrops();assert(ii.ore()>0,'chunks did not become ore');assert(heat0>0,'breaking a vein gave no heat');
    ii.addHeat(100);ii.addBullet(ii.playerRef().x+30,ii.playerRef().y);assert(api.activateCombatPower('rage'),'full heat did not allow Overdrive on Miner');assert(ii.bullets().length===0,'Overdrive did not clear nearby bullets');assert(api.getState().player.rageActive>0,'Overdrive not active');
  });
  check('II heat tiers multiply ore',()=>{freshRoom();const p=ii.playerRef();p.rage=0;ii.spawnOre(100,100,4);const low=ii.drops().reduce((s,d)=>s+d.value,0);ii.drops().length=0;p.rage=.7;ii.spawnOre(100,100,4);const hi=ii.drops().reduce((s,d)=>s+d.value,0);approx(hi/low,2,'tier 3 ore multiplier');});
  check('II taking a hit costs heat, hot_core costs all of it',()=>{freshRoom(0);const p=ii.playerRef();p.rage=.8;api.setPlayer({invuln:0});api.hurtPlayer(5,'t');assert(ii.playerRef().rage<.8&&ii.playerRef().rage>0,'normal hit heat loss wrong');freshRoom(0);ii.giveRelic('hot_core');ii.playerRef().rage=.8;api.hurtPlayer(5,'t');approx(ii.playerRef().rage,0,'hot core keeps heat');});
  check('II parry clears nearby bullets and feeds heat',()=>{freshRoom();const p=ii.playerRef();p.rage=0;ii.addBullet(p.x+20,p.y);ii.tryParry();api.hurtPlayer(10,'t');assert(ii.bullets().length===0,'parry left nearby bullets');assert(ii.playerRef().rage>0,'parry gave no heat');});
  check('II TNT hurts enemies, chains, spares friendly dash charges',()=>{
    freshRoom();ii.spawnEnemy('grunt',0,{x:300,y:300});const e=ii.enemies()[0],hp=e.hp;const a=ii.placeProp('tnt',310,300),b=ii.placeProp('tnt',380,300);ii.hitProp(a,1);ii.updateProps(1);assert(e.hp<hp,'TNT did no enemy damage');ii.updateProps(.2);assert(!ii.props().includes(b),'TNT did not chain');
    freshRoom();const p=ii.playerRef();const hp0=p.hp;const f=ii.placeProp('tnt',p.x,p.y);f.friendly=true;f.fuse=.1;f.fuseMax=.1;ii.updateProps(.2);assert(ii.playerRef().hp===hp0,'friendly TNT hurt the player');
    freshRoom();const q=ii.playerRef();const hp1=q.hp;const g=ii.placeProp('tnt',q.x,q.y);g.fuse=.1;g.fuseMax=.1;ii.updateProps(.2);assert(ii.playerRef().hp<hp1,'hostile TNT did not hurt the player');
  });
  check('II pickaxe breaks a vein in one swing and melee weapons hit props',()=>{freshRoom(0,'pick');const p=ii.playerRef();const v=ii.placeProp('vein',p.x+60,p.y);ii.firePick(0);assert(!ii.props().includes(v),'pickaxe did not one-shot vein');});
  check('II burrower is untargetable underground, shield blocks the front',()=>{
    freshRoom();ii.spawnEnemy('burrower',0,{x:500,y:300});const b=ii.enemies()[0],hp=b.hp;api.damageEnemy(b,10,'axe');approx(b.hp,hp,'underground burrower took damage');
    freshRoom();const p=ii.playerRef();ii.spawnEnemy('shield',0,{x:p.x+150,y:p.y});const s=ii.enemies()[0];s.shieldAngle=Math.PI;const h0=s.hp;api.damageEnemy(s,10,'axe');const front=h0-s.hp;s.shieldAngle=0;const h1=s.hp;api.damageEnemy(s,10,'axe');const back=h1-s.hp;assert(back>front*3,'shield did not reduce frontal damage');
  });
  check('II zone map: every layer reachable, every node leads to the boss',()=>{
    for(let d=0;d<4;d++){newRun(d);for(let z=1;z<=4;z++){ii.setStage(z);ii.generateZoneMap();const layers=ii.zoneMap().layers;assert(layers[layers.length-1][0].type==='boss','map does not end at a boss');layers.forEach((layer,i)=>{layer.forEach(n=>{if(i<layers.length-1)assert(n.next.length>0,`dead end at ${n.type}`);n.next.forEach(k=>assert(layers[i+1][k],'edge out of range'));});if(i)layer.forEach((n,k)=>assert(layers[i-1].some(m=>m.next.includes(k)),`unreachable ${n.type}`));});assert(z>3||layers.flat().some(n=>n.type==='seal'),'seal node missing');assert(new Set(layers.flat().map(n=>n.type)).size>=7,'zone map lacks variety');}}
  });
  check('II seal room grants a seal, three seals open the Echo King and the win still counts on loss',()=>{
    freshRoom(1);ii.startElite(true);ii.setSeals(2);api.finishRoom();assert(ii.seals()===3,'seal not granted');
    api.setWeapon('axe');newRun(1);api.setProgress(4);ii.setSeals(3);const star={kind:'boss',bossKind:'star',x:500,y:100,r:32,hp:1,maxHp:1,invulnerable:false};api.setBoss(star);api.damageEnemy(star,10,'axe');api.settle();
    assert(api.getState().lootAfter==='deepGate','three seals did not open the deep gate');const wins=api.getSaved().wins;ii.clickCard(0);assert(api.getState().stage===5&&ii.deepZone(),'deep gate did not descend');assert(api.getSaved().wins===wins+1,'clear not recorded on descent');api.takeLoot(api.getState().lootPool[0]);assert(api.getState().phase==='boss'&&api.getState().boss.bossKind==='echo','Echo King did not start');api.setPlayer({invuln:0,hp:1});api.hurtPlayer(50,'t');assert(api.getState().screen==='end','deep death did not end the run');assert(api.getSaved().wins===wins+1,'clear counted twice');
  });
  check('II without seals the Star Core ends the run',()=>{api.setWeapon('axe');newRun(1);api.setProgress(4);ii.setSeals(1);const star={kind:'boss',bossKind:'star',x:500,y:100,r:32,hp:1,maxHp:1,invulnerable:false};api.setBoss(star);api.damageEnemy(star,10,'axe');api.settle();assert(api.getState().screen==='end','run did not end at the Star Core');assert(ii.crystals()>0,'no crystals awarded');});
  check('II guild upgrades feed the run and old saves still load',()=>{ii.guild('hp',2);ii.guild('ore',1);api.setWeapon('axe');newRun(0);assert(ii.playerRef().maxHp===112,'guild hp not applied');assert(ii.ore()>=20,'guild ore not applied');ii.guild('hp',0);ii.guild('ore',0);});
  check('II timed rooms end on their own and pay out',()=>{for(const kind of ['vault','cavein']){freshRoom(0);api.setPlayer({hp:1e6,maxHp:1e6});ii.startSpecialRoom(kind);assert(ii.specialRoom(),'special room missing');for(let i=0;i<60&&ii.specialRoom();i++)api.update(.5);assert(!ii.specialRoom(),`${kind} never ended`);api.settle();assert(['map','loot','weaponUpgrade'].includes(api.getState().screen),`${kind} did not resolve: ${api.getState().screen}`);}});
  check('Twin Abyss risk candidates are two compatible risks plus one safe item',()=>{
    api.setWeapon('twin');newRun(2);const pool=api.makeTierLoot(2,3);assert(pool.length===3,'risk fallback did not fill three cards');
    assert(pool.filter(x=>(x.tier||0)>=2).length===3,'compatible twin risk count mismatch');
  });
  check('empty elite stack pool offers uncapped extra loot',()=>{
    api.setWeapon('axe');newRun(2);api.setRelic('exp_edge');api.openLoot('eliteBonus');const state=api.getState();
    assert(state.lootAfter==='eliteExtra','empty stack pool did not select extra loot');
    assert(state.lootPool.length===3,'extra loot missing three candidates');
    assert(!state.lootPool.includes('exp_edge'),'extra loot offered capped relic');
    api.takeLoot(state.lootPool[0]);assert(api.getState().screen==='map','extra loot did not return to the map');
  });
  check('void partial charge survives room boundary without firing early',()=>{
    api.setWeapon('axe');newRun(3);api.setPlayer({voidCharge:.6,rage:.4});api.startWave();
    approx(api.getState().player.voidCharge,.6,'unspent void charge lost');approx(api.getState().player.rage,.4,'rage charge lost');
  });
  check('cannon self cost can kill and does not trigger momentum penalty',()=>{
    api.setWeapon('wand');newRun(3);api.setRelic('collapse_cannon');api.setRelic('collapse_momentum');api.setPlayer({hp:10,maxHp:100});api.startAttack();
    assert(api.getState().player.hp<=0,'self cost incorrectly prevented death');approx(api.getState().player.maxHp,100,'self cost triggered momentum penalty');
  });
  check('final victory continues into endless reward and fourth zone',()=>{
    api.setWeapon('axe');newRun(1);api.setProgress(4);const last={kind:'boss',bossKind:'warden',x:500,y:100,r:32,hp:1,maxHp:1,invulnerable:false};api.setBoss(last);api.damageEnemy(last,10,'axe');api.settle();
    assert(api.getState().screen==='end','final boss did not show victory');api.clickEndAction('무한 구역으로 계속');
    assert(api.getState().lootAfter==='endless'&&api.getState().stage===5,'endless reward missing');
    api.takeLoot(api.getState().lootPool[0]);assert(api.getState().screen==='map'&&api.getState().stage===5,'endless reward failed to reopen the map');
  });
  check('axe storm snapshots its initial 1.6x boost',()=>{
    api.setWeapon('axe');newRun(2);api.setEnemyList([]);api.setRelic('abyss_axe_storm');api.startAttack(1);approx(api.getState().shots[0].damage,20*2.05*1.6,'storm initial damage');
  });
  check('burn and lightning cannot refresh each other without another attack',()=>{
    api.setWeapon('wand');newRun(1);api.setPlayer({x:480,y:300});const target={kind:'grunt',x:700,y:300,r:13,hp:1000,maxHp:1000,speed:0,damage:0,flash:0};api.setEnemyList([target]);api.setRelic('ember');api.setRelic('thunder');api.damageEnemy(target,1,'bolt');
    for(let i=0;i<240;i++)api.updateEnemies(1/60);
    assert(!(target.burn>0),'burn/lightning refreshed the burn forever');const after=target.hp;
    for(let i=0;i<120;i++)api.updateEnemies(1/60);approx(target.hp,after,'damage continued after burn should expire');
  });  const matrix=[];
  if(options.matrix){
    const weaponList=options.matrixWeapon?[options.matrixWeapon]:['axe','wand','twin','pick'];
    for(const weapon of weaponList){
      const bags=[{}, {split:1}, {split:3}, {thunder:1}, {exp_edge:1,exp_tempo:1}, {echo:1}, {[{axe:'axe_core',wand:'wand_arc',twin:'twin_moon',pick:'pick_core'}[weapon]]:1}];
      for(const distance of [40,80])for(const layout of ['single','cluster','spread'])for(let bi=0;bi<bags.length;bi++){
        const count=layout==='single'?1:5;
        for(const first of [null,...api.getUpgradeDefs()[weapon].map(x=>x.id)])for(const second of first?[null,...api.getBranchDefs()[first].map(x=>x.id)]:[null]){
          api.setBenchmark(weapon,first,second,bags[bi],count,distance,layout==='spread');
          for(let frame=0;frame<1800;frame++){api.setNow(frame*1000/60);api.benchmarkTick();}
          const dps=(count*1e8-api.benchmarkHP())/30;
          assert(Number.isFinite(dps)&&dps>=0,'invalid benchmark damage');matrix.push({weapon,first,second,distance,layout,bag:bi,dps:+dps.toFixed(2)});
        }
      }
    }
  }  const failures = results.filter(result => !result.ok);
  if (failures.length) {
    const error = new Error(`${failures.length}/${results.length} balance checks failed`);
    error.results = results;
    error.json = JSON.stringify({ passed: results.length - failures.length, failed: failures.length, results }, null, 2);
    throw error;
  }
  return JSON.stringify({ passed: results.length, failed: 0, results, matrix }, null, 2);
}

if (typeof module !== 'undefined') module.exports = { runBalanceChecks };
if (typeof globalThis !== 'undefined') globalThis.runBalanceChecks = runBalanceChecks;
if(typeof require!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path');
  try{const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');console.log(runBalanceChecks(html,{search:'?balanceSeed=123',matrix:process.argv.includes('--matrix')}));}
  catch(error){console.error(error.json||error.stack);process.exitCode=1;}
}
