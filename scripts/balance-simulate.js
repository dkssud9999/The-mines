'use strict';

/*
 * Browserless diagnostic autoplayer for index.html. This uses the real game's
 * update/combat/progression functions with minimal DOM and canvas stubs. It is
 * not a human difficulty estimate. Load in Node or another V8 host and call
 * runBalanceSimulation(html, options).
 */
function runBalanceSimulation(gameHtml, options = {}) {
  const seed = Number(options.seed ?? 1) >>> 0;
  const difficulty = Math.max(0, Math.min(3, options.difficulty ?? 0));
  const weapon = options.weapon || 'axe';
  const upgrade1 = options.upgrade1 || null, upgrade2 = options.upgrade2 || null;
  const archetype = options.archetype || 'balanced';
  const routeStrategy = options.route || 'adaptive';
  const maxSeconds = Math.max(1, options.maxSeconds ?? 600);
  const dt = Math.max(1 / 120, Math.min(.033, options.dt ?? 1 / 60));
  let mockNow = 0;

  class MockElement {
    constructor(id = '') {
      this.id = id; this.children = []; this.style = { setProperty() {} };
      this.dataset = {}; this.className = ''; this.textContent = ''; this.title = '';
      this.disabled = false; this.listeners = Object.create(null);
      const classes = new Set();
      this.classList = {
        add: (...xs) => xs.forEach(x => classes.add(x)),
        remove: (...xs) => xs.forEach(x => classes.delete(x)),
        toggle: (x, force) => { const on = force === undefined ? !classes.has(x) : !!force; on ? classes.add(x) : classes.delete(x); return on; },
        contains: x => classes.has(x)
      };
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    appendChild(child) { this.children.push(child); return child; }
    insertAdjacentHTML(_where, html) { if (html.includes('lootSkip')) this.skip = new MockElement('lootSkip'); }
    querySelector(selector) { return this.sub ||= new MockElement(selector); }
    setAttribute() {}
    getContext() { return mockContext; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  }
  const mockContext = new Proxy({}, { get: (target, key) => target[key] ||= (() => {}) });
  const elements = new Map();
  const getElement = id => { if (!elements.has(id)) elements.set(id, new MockElement(id)); return elements.get(id); };
  const canvas = getElement('game');
  const document = {
    getElementById: getElement,
    createElement: tag => new MockElement(tag),
    addEventListener() {},
    body: new MockElement('body'),
    fullscreenElement: null
  };
  const localStorage = { getItem: () => null, setItem() {} };
  const window = {
    addEventListener() {}, removeEventListener() {},
    screen: { orientation: { lock() {} } },
    AudioContext: null, webkitAudioContext: null
  };
  const location = { search: `?balanceSeed=${seed}` };
  class SearchParams { constructor(q='') { this.values=new Map(String(q).replace(/^\?/,'').split('&').filter(Boolean).map(p=>p.split('=').map(decodeURIComponent))); } get(k) { return this.values.get(k) ?? null; } }
  const performance = { now: () => mockNow };
  const Image = class { constructor() { this.src = ''; this.complete = false; } };
  const requestAnimationFrame = () => 0;
  const sourceMatch = gameHtml.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (!sourceMatch) throw new Error('index.html has no inline game script');
  const injection = `globalThis.__balanceGame = {
    startRun, update, chooseRoute, takeLoot, chooseWeaponUpgrade, tryDash, activateCombatPower,
    setMouse(x,y){mouse.x=x;mouse.y=y;}, setKeys(next){keys=next;}, setFiring(value){mouse.down=value;},
    setDifficulty(value){difficulty=value;}, setWeapon(value){selectedWeapon=value;},
    get state(){return {screen,phase,stage,roomCount,runTime,kills,player,enemies,bullets,shots,hazards,obstacles,lootPool,lootAfter,boss,saved,relicBag,mouse,keys};},
    get report(){return window.mineBalanceReport;}, get victory(){return $('endKicker').textContent==='RUN COMPLETE';}, skipOptionalLoot,
    lineBlocked(a,b,r=2){return isObstructed(a,b,r);},
    get upgradeOptions(){return player.weaponUpgrade?weaponUpgradeBranches[player.weaponUpgrade]||[]:weaponUpgrades[player.weapon]||[];}
  };`;
  const terminalNeedle = 'syncWeaponPicker();requestAnimationFrame(loop);';
  const source = sourceMatch[1].replace(terminalNeedle, injection);
  if (source === sourceMatch[1]) throw new Error('Could not locate game bootstrap injection point');
  const gameWindow = window;
  new Function('window','document','localStorage','location','performance','Image','requestAnimationFrame','URLSearchParams','globalThis', source)(
    gameWindow, document, localStorage, location, performance, Image, requestAnimationFrame, SearchParams, globalThis
  );
  const game = globalThis.__balanceGame;
  delete globalThis.__balanceGame;
  game.setDifficulty(difficulty); game.setWeapon(weapon); game.startRun();

  const hypot = Math.hypot;
  const normalize = (x,y) => { const n=hypot(x,y)||1; return [x/n,y/n]; };
  function targetFor(state) {
    return state.enemies.filter(e => e.hp>0 && !(e.kind==='boss'&&e.invulnerable))
      .sort((a,b)=>hypot(a.x-state.player.x,a.y-state.player.y)-hypot(b.x-state.player.x,b.y-state.player.y))[0] || null;
  }
  let rewardIndex=0,riskPicked=false;
  let lastNavTarget=null,lastDistance=Infinity,lastProgressAt=0,lastPlanAt=-Infinity,navPath=null;
  function chooseReward(state) {
    const ids=state.lootPool.map(x=>x.id); if(!ids.length) return;
    if(state.lootAfter==='riskPick'){
      if(archetype==='risk'&&!riskPicked){const risk=ids.find(id=>id.startsWith('abyss_')||id.startsWith('collapse_'));if(risk){riskPicked=true;game.takeLoot(risk);return;}}
      game.skipOptionalLoot();return;
    }
    const offensive = ['exp_edge','exp_tempo','exp_spark','exp_hunter','razor','ember','wildfire','thunder','split','keen','axe_core','wand_arc','twin_moon','abyss_gambler','abyss_axe_storm','abyss_hungry','collapse_cannon','collapse_burst','collapse_frontal','collapse_momentum'];
    const survival = ['heart','guard','frost','gale','dash','exp_heart','exp_stride','exp_guard','exp_bounty','abyss_footsteps','collapse_dash'];
    const favored = archetype==='attack'
      ? ['exp_edge','exp_tempo','exp_spark','exp_hunter','razor','ember','wildfire','thunder','split','keen','axe_core','wand_arc','twin_moon','abyss_gambler','abyss_axe_storm','abyss_hungry','collapse_cannon','collapse_burst','collapse_frontal','collapse_momentum']
      : archetype==='risk'
        ? ['exp_edge','exp_tempo','exp_spark','exp_hunter','razor','ember','wildfire','thunder','split','keen','axe_core','wand_arc','twin_moon','abyss_gambler','abyss_axe_storm','abyss_hungry','collapse_cannon','collapse_burst','collapse_frontal','collapse_momentum']
        : (rewardIndex%3===2?survival:offensive);
    const chosen=favored.find(id=>ids.includes(id))||ids[0];
    if(state.lootAfter!=='eliteBonus'&&state.lootAfter!=='eliteExtra')rewardIndex++;
    game.takeLoot(chosen);
  }
  const dirs=[]; for(let i=0;i<16;i++)dirs.push([Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
  let lastControlDash=-10;
  function planPath(player,target,obstacles){
    const step=24,nx=Math.ceil(960/step),ny=Math.ceil(540/step),size=nx*ny;
    const index=(x,y)=>y*nx+x,center=i=>({x:(i%nx+.5)*step,y:(Math.floor(i/nx)+.5)*step});
    const toCell=(x,y)=>index(Math.max(0,Math.min(nx-1,Math.floor(x/step))),Math.max(0,Math.min(ny-1,Math.floor(y/step))));
    const start=toCell(player.x,player.y),blocked=new Uint8Array(size);
    for(let i=0;i<size;i++){const p=center(i);if(obstacles.some(r=>p.x>=r.x-player.r-5&&p.x<=r.x+r.w+player.r+5&&p.y>=r.y-player.r-5&&p.y<=r.y+r.h+player.r+5))blocked[i]=1;}
    blocked[start]=0;
    const prev=new Int32Array(size);prev.fill(-1);prev[start]=start;
    const queue=new Int32Array(size);let head=0,tail=0;queue[tail++]=start;let goal=-1;
    const neighbors=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    while(head<tail){const here=queue[head++],p=center(here);if(game.lineBlocked(p,target,player.r+3)===false){goal=here;break;}
      const cx=here%nx,cy=Math.floor(here/nx);
      for(const [dx,dy] of neighbors){const x=cx+dx,y=cy+dy;if(x<0||x>=nx||y<0||y>=ny)continue;const next=index(x,y);if(blocked[next]||prev[next]!==-1)continue;prev[next]=here;queue[tail++]=next;}
    }
    if(goal<0){let best=start,bestD=Infinity;for(let i=0;i<size;i++)if(!blocked[i]){const p=center(i),d=hypot(p.x-target.x,p.y-target.y);if(d<bestD){best=i;bestD=d;}}goal=best;}
    const path=[];for(let cur=goal;cur!==start&&cur>=0;cur=prev[cur]){path.push(center(cur));if(prev[cur]===cur)break;}path.reverse();return path;
  }
  function drive() {
    const s=game.state;
    if(s.screen==='choice') {
      const hpRatio=s.player.hp/s.player.maxHp;
      const route=routeStrategy==='elite'?'elite':routeStrategy==='shrine'?'shrine':hpRatio<.55?'shrine':'elite';
      game.chooseRoute(route); return;
    }
    if(s.screen==='loot') { chooseReward(s); return; }
    if(s.screen==='weaponUpgrade') {
      const options=game.upgradeOptions;
      const requestedId=s.player.weaponUpgrade?upgrade2:upgrade1;
      const first=options.find(o=>o.id===requestedId)||options[0];
      if(first)game.chooseWeaponUpgrade(first.id,s.player.weaponUpgrade?2:1);
      return;
    }
    if(s.screen!=='playing'||!s.player)return;
    const p=s.player, target=targetFor(s), bossTarget=target?.kind==='boss';
    if(target){game.setMouse(target.x,target.y);game.setFiring(true);}else game.setFiring(false);
    if(p.rage>=1&&p.rageActive<=0)game.activateCombatPower('rage');
    if(p.adrenaline>=1&&p.adrenalineActive<=0)game.activateCombatPower('adrenaline');
    let ideal= p.weapon==='twin'?125:p.weapon==='axe'?155:250;
    if(bossTarget)ideal=p.weapon==='twin'?120:p.weapon==='axe'?155:230;if(p.weaponUpgrade==='twin_orbit')ideal=p.weaponUpgrade2==='twin_orbit_reach'?54:40;
    const targetDistance=target?hypot(target.x-p.x,target.y-p.y):Infinity;
    if(target!==lastNavTarget){lastNavTarget=target;lastDistance=targetDistance;lastProgressAt=s.runTime;navPath=null;lastPlanAt=-Infinity;}
    if(target&&targetDistance+8<lastDistance){lastDistance=targetDistance;lastProgressAt=s.runTime;}
    const needsNav=!!target&&(game.lineBlocked(p,target,p.r+3)||(targetDistance>ideal+35&&s.runTime-lastProgressAt>=5));
    if(needsNav&&s.runTime-lastPlanAt>.35){navPath=planPath(p,target,s.obstacles);lastPlanAt=s.runTime;}
    if(!needsNav)navPath=null;
    let waypoint=navPath?.[0]||null;
    while(waypoint&&hypot(waypoint.x-p.x,waypoint.y-p.y)<20){navPath.shift();waypoint=navPath[0]||null;}
    const bulletList=s.bullets;
    let best=[0,0],bestScore=-Infinity;
    for(const [dx,dy] of dirs){
      let score=0;
      if(target){
        const x=p.x+dx*p.speed*.4,y=p.y+dy*p.speed*.4,d=hypot(target.x-x,target.y-y);
        score-=Math.abs(d-ideal)*.018;
        if(d<target.r+p.r+16)score-=4;
        if(bossTarget){const rx=x-target.x,ry=y-target.y,rad=hypot(rx,ry)||1;score+=Math.abs((rx*dx+ry*dy)/rad)*-.55;}
      }
      if(waypoint)score+=(dx*(waypoint.x-p.x)+dy*(waypoint.y-p.y))/Math.max(1,hypot(waypoint.x-p.x,waypoint.y-p.y))*4.5;
      for(const b of bulletList){
        const rx=b.x-p.x,ry=b.y-p.y,vx=(b.vx||0)-dx*p.speed,vy=(b.vy||0)-dy*p.speed;
        const t=Math.max(0,Math.min(.4,-(rx*vx+ry*vy)/(vx*vx+vy*vy||1)));
        const miss=hypot(rx+vx*t,ry+vy*t),danger=(b.r||5)+p.r+8;
        if(miss<danger)score-=((danger-miss)/danger)*7;
      }
      for(const h of s.hazards){
        const hx=(h.x||0)-p.x,hy=(h.y||0)-p.y,hd=hypot(hx,hy);
        if(hd<100)score-=((100-hd)/100)*(h.phase==='active'?4:1.2);
      }
      for(const r of s.obstacles){
        const x=p.x+dx*55,y=p.y+dy*55,nx=Math.max(r.x,Math.min(x,r.x+r.w)),ny=Math.max(r.y,Math.min(y,r.y+r.h));
        if(hypot(x-nx,y-ny)<p.r+4)score-=3;
      }
      const edge=Math.min(p.x+dx*100,960-(p.x+dx*100),p.y+dy*100,540-(p.y+dy*100));
      if(edge<40)score-=(40-edge)*.025;
      if(score>bestScore){bestScore=score;best=[dx,dy];}
    }
    let close=target&&hypot(target.x-p.x,target.y-p.y)<p.r+target.r+(p.weaponUpgrade==='twin_orbit'?5:40);
    let bulletThreat=bulletList.some(b=>{const rx=b.x-p.x,ry=b.y-p.y,vx=b.vx||0,vy=b.vy||0,t=Math.max(0,Math.min(.4,-(rx*vx+ry*vy)/(vx*vx+vy*vy||1)));return hypot(rx+vx*t,ry+vy*t)<p.r+(b.r||5)+15;});
    const [mx,my]=normalize(best[0],best[1]);
    const keys={w:my<-.25,s:my>.25,a:mx<-.25,d:mx>.25};
    game.setKeys(keys);
    if((close||bulletThreat)&&p.dashing<=0&&s.runTime-lastControlDash>.25){game.tryDash();lastControlDash=s.runTime;}
  }

  let steps=0;
  while(game.state.runTime<maxSeconds&&steps<Math.ceil(maxSeconds/dt)+10){
    const s=game.state;
    if(s.screen==='end')break;
    drive();
    mockNow+=dt*1000;
    game.update(dt); steps++;
  }
  const final=game.state,report=game.report;
  return {
    seed,difficulty,weapon,archetype,route:routeStrategy,
    outcome:game.victory?'victory':final.screen==='end'?'death':'timeout',
    time:+final.runTime.toFixed(2),kills:final.kills,zone:final.stage,phase:final.phase,
    hp:final.player?+final.player.hp.toFixed(1):0,maxHp:final.player?+final.player.maxHp.toFixed(1):0,
    upgrades:final.player?[final.player.weaponUpgrade,final.player.weaponUpgrade2].filter(Boolean):[],
    relics:{...final.relicBag},rooms:report.rooms,steps
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { runBalanceSimulation };
if (typeof globalThis !== 'undefined') globalThis.runBalanceSimulation = runBalanceSimulation;
if(typeof require!=='undefined'&&require.main===module){
  const fs=require('node:fs'),path=require('node:path');
  try{console.log(JSON.stringify(runBalanceSimulation(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8'),JSON.parse(process.argv[2]||'{}')),null,2));}
  catch(error){console.error(error.stack);process.exitCode=1;}
}
