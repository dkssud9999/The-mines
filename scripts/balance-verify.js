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
    finishRoom:()=>{for(const enemy of [...enemies])killEnemy(enemy);},chooseWeaponUpgrade,getUpgradeOptions:()=>player.weaponUpgrade?(weaponUpgradeBranches[player.weaponUpgrade]||[]):weaponUpgrades[player.weapon],startRun:()=>startRun(), setDifficulty:n=>{difficulty=n;saved.highestDifficulty=3;},
    setProgress:(value,room=0)=>{stage=value;roomCount=room;},clickEndAction:text=>{const button=document.getElementById('endActions').children.find(x=>x.textContent===text);if(!button)throw new Error('Missing end action '+text);for(const fn of button.listeners.get('click')||[])fn();},getState:()=>({phase,screen,stage,roomCount,runDifficulty,lootAfter,lootPool:lootPool.map(x=>x.id),player:player&&{...player},boss:boss&&{...boss},enemies:enemies.map(e=>({...e})),shots:shots.map(s=>({...s})),voidWaves:voidWaves.map(w=>({...w})),touchMove:{...touchMove},touchAim:{...touchAim},mouse:{...mouse},attackTimer,dashCooldown,invuln,collapseBurstOver:player?.collapseBurstOver}),
    setRelic:(id,n=1)=>{relicBag[id]=n;}, setEnemyList:list=>{enemies=list;}, setBoss:e=>{boss=e;enemies=e?[e]:[];phase='boss';}, setPlayer:(patch)=>Object.assign(player,patch),
    chooseRoute,openLoot,takeLoot,skipOptionalLoot,makeLoot,makeTierLoot,makeOwnedStackLoot,healPlayer,save,
    setWeapon:value=>{selectedWeapon=value;},setAim:(x,y)=>{mouse.x=x;mouse.y=y;},setAttackCount:value=>{player.attackCount=value;},setUpgrade:(one,two=null)=>{player.weaponUpgrade=one;player.weaponUpgrade2=two;},getAttackStats:()=>({momentumHits,abyssHitStreak,pendingEchoes:pendingEchoes.map(e=>({...e}))}),updateShots,updatePendingEchoes,startWave,startElite,startBoss,resetRoomCombat,update,updateEnemies,updateBoss,updateVoidCharge,updateVoidWaves,startAttack,tryDash,activateCombatPower,hurtPlayer,damageEnemy,
    setScreen,recordBalanceRoom,beginBalanceRoom,report:()=>window.mineBalanceReport,
    getRelics:()=>({...relicBag}),getSaved:()=>({...saved}),getWeapons:()=>weapons,getRelicDefs:()=>relics,getUpgradeDefs:()=>weaponUpgrades,getBranchDefs:()=>weaponUpgradeBranches,setBenchmark:(weapon,one,two,bag,count,distance,spread)=>{selectedWeapon=weapon;difficulty=1;startRun();obstacles=[];clearShots(true);enemies=Array.from({length:count},(_,i)=>({kind:'grunt',x:480+distance+(spread?i*30:i%3*8),y:300+(spread?(i-(count-1)/2)*65:Math.floor(i/3)*9),r:13,hp:1e8,maxHp:1e8,speed:0,damage:0,flash:0}));player.x=480;player.y=300;player.weaponUpgrade=one;player.weaponUpgrade2=two;mouse.x=480+distance;mouse.y=300;for(const key of Object.keys(relicBag))delete relicBag[key];Object.assign(relicBag,bag);},benchmarkTick:()=>{mouse.down=true;update(1/60);},benchmarkHP:()=>enemies.reduce((sum,e)=>sum+e.hp,0),
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
  const newRun = (difficulty = 0) => { api.setDifficulty(difficulty); api.startRun(); };
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
          while(api.getState().screen!=='end'&&steps++<100){
            const current=api.getState();
            if(current.screen==='playing')api.finishRoom();
            else if(current.screen==='choice')api.chooseRoute(route);
            else if(current.screen==='weaponUpgrade'){
              if(!current.player.weaponUpgrade){firstUpgradeSeen=true;assert(current.stage===1,'first upgrade delayed beyond first zone');if(difficulty>0)assert(current.roomCount===1,'upper first upgrade did not follow first wave');}
              api.chooseWeaponUpgrade(api.getUpgradeOptions()[0].id,current.player.weaponUpgrade?2:1);
            }else if(current.screen==='loot'){
              assert(new Set(current.lootPool).size===current.lootPool.length,'duplicate loot candidates');
              if(current.lootAfter==='riskPick'&&resolution==='skip')api.skipOptionalLoot();
              else if(current.lootPool.length)api.takeLoot(current.lootPool[0]);
              else api.skipOptionalLoot();
            }else throw new Error('unexpected progression state '+current.screen);
          }
          assert(api.getState().screen==='end'&&api.getState().stage===3,'full run did not reach third-zone completion');
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
  check('Twin Abyss risk candidates are two compatible risks plus one safe item',()=>{
    api.setWeapon('twin');newRun(2);const pool=api.makeTierLoot(2,3);assert(pool.length===3,'risk fallback did not fill three cards');
    assert(pool.filter(x=>(x.tier||0)>=2).length===2,'compatible twin risk count mismatch');
    assert(pool.some(x=>(x.tier||0)<2),'safe fallback missing');
  });
  check('empty elite stack pool offers uncapped extra loot',()=>{
    api.setWeapon('axe');newRun(2);api.setRelic('exp_edge');api.openLoot('eliteBonus');const state=api.getState();
    assert(state.lootAfter==='eliteExtra','empty stack pool did not select extra loot');
    assert(state.lootPool.length===3,'extra loot missing three candidates');
    assert(!state.lootPool.includes('exp_edge'),'extra loot offered capped relic');
    api.takeLoot(state.lootPool[0]);assert(api.getState().phase==='boss','extra loot did not lead to boss');
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
    api.setWeapon('axe');newRun(1);api.setProgress(3);const last={kind:'boss',bossKind:'warden',x:500,y:100,r:32,hp:1,maxHp:1,invulnerable:false};api.setBoss(last);api.damageEnemy(last,10,'axe');
    assert(api.getState().screen==='end','final boss did not show victory');api.clickEndAction('무한 구역으로 계속');
    assert(api.getState().lootAfter==='endless'&&api.getState().stage===4,'endless reward missing');
    api.takeLoot(api.getState().lootPool[0]);assert(api.getState().screen==='playing'&&api.getState().stage===4,'endless reward failed to start wave');
  });
  check('axe storm snapshots its initial 1.6x boost',()=>{
    api.setWeapon('axe');newRun(2);api.setEnemyList([]);api.setRelic('abyss_axe_storm');api.startAttack(1);approx(api.getState().shots[0].damage,20*2.2*1.6,'storm initial damage');
  });
  const matrix=[];
  if(options.matrix){
    const weaponList=options.matrixWeapon?[options.matrixWeapon]:['axe','wand','twin'];
    for(const weapon of weaponList){
      const bags=[{}, {split:1}, {split:3}, {thunder:1}, {exp_edge:1,exp_tempo:1}, {echo:1}, {[{axe:'axe_core',wand:'wand_arc',twin:'twin_moon'}[weapon]]:1}];
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
