/* Original WYRDFLUX PC world-event system. 96 named cards; 24 gameplay
 * families with four power/behavior tiers. No external assets/network.
 * One card per wave, no repeats until all cards drawn, and no event on
 * a boss wave, in Test Lab, or in an active secret realm. */
const WYRDFLUX_RARE_EVENT_NAMES=Object.freeze({
 ufo:['SILENT SKY · SILVER SCOUT','THE TRIPLE LIGHTS · UFO SQUADRON','DARK ORBIT · HOSTILE FLEET','THE VISITORS · INVASION'],
 meteor:['CINDER FALL · BURNING FRAGMENTS','ORBITAL SHARDS · FALLING IRON','BROKEN COMET · THE SKY BLEEDS','HEAVENS BREAKING · METEOR SHOWER'],
 thunder:['BLUE THUNDER · STRAY LIGHTNING','NEEDLE SKY · CHAIN LIGHTNING','STORM CROWN · CHARGED WAVE','THE GODSTORM · ELECTRIC HUNT'],
 cache:['LOST SATCHEL · FIELD MEDKITS','SILVER SUPPLY · SHIELD CELLS','CARGO POD · SURVIVAL DROP','WAR CRATE · RICH SUPPLIES'],
 shrine:['QUIET LANTERN · HEALING GROUND','OLD RELIQUARY · WARMING STONE','LIVING FOUNTAIN · RECOVERY ZONE','HEART OF THE WORLD · VITAL CIRCLE'],
 gravity:['GRAVITY SEED · ENEMIES PULLED','SINGULAR NODE · HUNTERS ATTRACTED','MIDNIGHT WELL · COMPRESSED SWARM','BLACK STAR · CRUSHING ORBIT'],
 repulse:['HOLLOW BELL · FORCE PULSE','IRON TEMPEST · PUSHBACK','THUNDER DRUM · SHOCK RING','WORLD BREATH · REPELLING TIDE'],
 swarm:['LOST PATROL · FRESH HOSTILES','HIVE CALL · REINFORCEMENTS','MARCH OF SCRAP · HEAVY WAVE','A MILLION FOOTSTEPS · THE HORDE'],
 elite:['SCARRED LEGION · VETERANS','IRON HARVEST · PLATED HOSTILES','ROYAL GUARD · STRONGER HUNTERS','UNBROKEN ORDER · ELITES'],
 haste:['SECOND WIND · QUICK FEET','GHOST STRIDE · PHASE RUN','LIVING CLOCK · RAPID FOOTWORK','LIGHTNING LEGS · MAXIMUM MOBILITY'],
 salvage:['FORGOTTEN PAYDAY · BONUS CASH','RUSTED VAULT · BOUNTY WEALTH','GOLDEN BLOOD · RICH KILLS','PIRATE DIVIDEND · RICHES'],
 gambit:['RED CONTRACT · SHIELD FOR GOLD','MERCHANT OF SCARS · RISKY DEAL','FORBIDDEN TITHE · BLOOD DEBT','GOLDEN CURSE · DANGEROUS BARGAIN'],
 echo:['SECOND SHADOW · ECHOED DEATH','MIRROR ARMY · CLONED HUNTERS','GHOST HARVEST · FALSE VICTORIES','THE LONG ECHO · UNDEAD RETURN'],
 sentry:['LONE SENTINEL · DEFENSE BEAM','ORBITAL SUPPORT · AUTOFIRE','WATCHFUL EYE · GUARDIAN STRIKES','CELESTIAL BATTERY · ALLIED CANNON'],
 reactor:['COLD BARRELS · FAST COOLING','SURPLUS CORE · STABLE GUNS','HEAT SINK · THERMAL RELIEF','ZERO-HEAT ENGINE · COOLING SURGE'],
 hex:['THINNING VEIL · FRAIL ENEMIES','GLASS BONES · BRITTLE FOES','WEAKENING CURSE · LOST ARMOR','SHATTERED NAMES · DOOMED HOSTILES'],
 bounty:['HUNTERS MARK · EXTRA REWARD','WANTED POSTERS · CASH TARGETS','REAPERS CONTRACT · DOUBLE BOUNTY','GOLDEN EXECUTION · RICH HEADS'],
 overclock:['BRASS FEVER · QUICK TRIGGER','CHAMBER SURGE · RAPID FIRE','MERCURY RUSH · FAST GUNS','PERFECT CADENCE · BARRAGE'],
 chronofield:['SLOW HOUR · STUTTERED ENEMIES','FROZEN SECOND · HESITATING HUNTERS','HALF-TIME WORLD · SLOW SWARM','CLOCKBREAK · TIMESTOP FIELD'],
 mirage:['SHIFTING FOOTSTEPS · FALSE POSITION','STOLEN SHADOW · BLINKING FOES','THE CROOKED MIRROR · DISPLACEMENT','MAZE OF MOMENTS · ENEMY TELEPORTS'],
 fog:['COLD MIST · LOST SIGNAL','GHOST FOG · DIMMED SENSORS','MIDNIGHT HAZE · MOVING COVER','THE BLACK MIST · BLINDING FRONT'],
 bloodmoon:['RED MOON · HIGH RISK','CRIMSON NIGHT · HARDER BLOWS','BLOOD ECLIPSE · SAVAGE WAVE','FINAL RED STAR · FATAL CONTRACT'],
 volatile:['POWDER KEGS · EXPLODING DEATHS','CHAIN REACTION · HUNTER BURSTS','ASH CASCADE · LINKED DETONATIONS','SUPERNOVA CEMETERY · LAST BREATH'],
 bulwark:['SECOND SKIN · EXTRA SHIELD','MIRROR SHELL · DEFENSE SURGE','AEGIS BLOOM · RISING ARMOR','THE LAST BASTION · HEAVY PROTECTION']
});
const WYRDFLUX_RARE_EVENT_DECK=Object.freeze(
 Object.entries(WYRDFLUX_RARE_EVENT_NAMES).flatMap(([kind,names])=>
  names.map((title,i)=>Object.freeze({id:kind+'-'+(i+1),kind,tier:i+1,title})))
);
function wyrdfluxFreshWorldEvents(){return {active:null,seen:[],missed:0,total:0};}
let wyrdfluxWorldEvents=wyrdfluxFreshWorldEvents();
function wyrdfluxEventPower(kind){
 const a=wyrdfluxWorldEvents.active;
 return a&&a.wave===wave&&a.kind===kind&&phase==='play'&&
  !livingRealm.active&&circus.state!=='active'&&
  hellBreach.state==='none'&&heavenSanctum.state==='none'&&
  blockworld.state==='none'?a.tier:0;
}
function wyrdfluxEventEligible(){
 return !testLabMode&&phase==='play'&&localWaveOf(wave)>2&&localWaveOf(wave)%3!==0&&
  !livingRealm.active&&!livingRealm.pending&&circus.state!=='active'&&
  hellBreach.state==='none'&&heavenSanctum.state==='none'&&
  blockworld.state==='none'&&sector!==6;
}
function wyrdfluxEventSaucerChance(){
 const p=wyrdfluxEventPower('ufo')||wyrdfluxEventPower('mirage');
 return Math.min(.48,p*.065);
}
function wyrdfluxSpawnEventSaucer(){
 if(enemies.filter(e=>e.hp>0&&e.type==='saucer').length>=4)return false;
 const at=randomOpen(6);
 if(!free(at.x,at.z,.65)||Math.hypot(at.x-player.x,at.z-player.z)<4)return false;
 const e=newEnemy(at,false);
 const hp=ENEMY_STATS.saucer[0]*(1+(localWaveOf(wave)-1)*.09)*cycleDifficulty(wave).hp;
 e.type='saucer';e.boss=false;e.hp=e.maxHp=hp;
 e.speed=ENEMY_STATS.saucer[1]*cycleDifficulty(wave).speed;
 e.saucer={clock:0,volley:0,hover:4,orbit:e.id*2.39996,shieldBurst:0};
 e.appearT=.65;e.attackT=2.1;e.eventSaucer=true;
 enemies.push(e);
 return true;
}
function wyrdfluxBeginRareEvent(resuming=false){
 if(resuming)return;
 wyrdfluxWorldEvents.active=null;
 if(!wyrdfluxEventEligible())return;
 const chance=Math.min(.76,.31+wyrdfluxWorldEvents.missed*.15);
 if(rnd()>=chance){wyrdfluxWorldEvents.missed++;return;}
 wyrdfluxWorldEvents.missed=0;
 let options=WYRDFLUX_RARE_EVENT_DECK.filter(e=>!wyrdfluxWorldEvents.seen.includes(e.id));
 if(!options.length){wyrdfluxWorldEvents.seen=[];options=WYRDFLUX_RARE_EVENT_DECK.slice();}
 // Powers 3-4 are rarer than the ordinary world anomalies.
 const weight=e=>e.tier===1?14:e.tier===2?7:e.tier===3?3:1;
 const total=options.reduce((n,e)=>n+weight(e),0);
 let draw=rnd()*total,card=options[options.length-1];
 for(const c of options){draw-=weight(c);if(draw<=0){card=c;break;}}
 wyrdfluxWorldEvents.seen.push(card.id);wyrdfluxWorldEvents.total++;
 const a={id:card.id,kind:card.kind,tier:card.tier,title:card.title,
  wave,x:player.x,z:player.z-3,clock:1.5,count:0,echoes:0,spawned:0};
 wyrdfluxWorldEvents.active=a;
 const tier=card.tier;
 if(card.kind==='ufo'){
  spawnPending=Math.min(54,spawnPending+tier+1);
  for(let n=0;n<Math.min(3,1+Math.floor(tier/2));n++)wyrdfluxSpawnEventSaucer();
 }else if(card.kind==='cache'){
  for(let n=0;n<Math.min(6,1+tier);n++){
   const pos=randomOpen(3);
   pickups.push({x:pos.x,z:pos.z,life:35,type:n%2?'shield':'health'});
  }
 }else if(card.kind==='swarm'){
  spawnPending=Math.min(54,spawnPending+2+tier*2);
 }else if(card.kind==='gambit'){
  const shieldCost=Math.min(player.shield,12+tier*15);
  player.shield-=shieldCost;player.cash+=Math.round(shieldCost*(6+tier*2));
 }else if(card.kind==='bulwark'){
  player.shield=Math.min(player.maxShield,player.shield+20+tier*18);
 }else if(card.kind==='bloodmoon'){
  spawnPending=Math.min(54,spawnPending+1+tier);
 }else if(card.kind==='sentry'){
  player.shield=Math.min(player.maxShield,player.shield+8);
 }else if(card.kind==='shrine'){
  a.x=player.x;a.z=player.z;a.clock=.1;
 }else if(card.kind==='meteor'||card.kind==='thunder'){
  a.clock=2.2;
 }
 announce('ANOMALY // '+card.title,2.8);
 notice('WORLD EVENT · '+card.kind.toUpperCase()+' · WAVE-LIMITED',3.6);
}
function wyrdfluxRareEventOnSpawn(e){
 if(!e||e.boss||e.type==='saucer'||e.krakenPart)return;
 const elite=wyrdfluxEventPower('elite'),hex=wyrdfluxEventPower('hex'),
  blood=wyrdfluxEventPower('bloodmoon');
 if(elite){
  e.maxHp*=1+.18*elite;e.hp=e.maxHp;
  e.speed*=1+.035*elite;e.eventElite=true;
 }
 if(hex){e.hp*=Math.max(.48,1-.11*hex);e.maxHp=e.hp;e.eventHex=true;}
 if(blood){e.speed*=1+.025*blood;e.eventBloodmoon=true;}
}
function wyrdfluxRareEventOnKill(e){
 if(!e||e.boss||e.krakenPart||e.wardenMite||e.circusActor)return;
 const a=wyrdfluxWorldEvents.active;
 if(!a||a.wave!==wave||!wyrdfluxEventEligible())return;
 if(a.kind==='salvage')player.cash+=17+a.tier*21;
 if(a.kind==='bounty'){
  player.cash+=21+a.tier*26;
  if(rnd()<.08*a.tier)pickups.push({x:e.x,z:e.z,life:18,type:'shield'});
 }
 if(a.kind==='volatile'&&a.count<14){
  a.count++;
  burst(e.x,e.z,'orange',.75,.3);
  if(a.tier>1)blastAt(e.x,e.z,7+a.tier*3,1.0+a.tier*.10,2,'shock');
 }
 if(a.kind==='echo'&&!e.eventEcho&&a.echoes<2+a.tier&&rnd()<.20+a.tier*.095){
  const at={x:e.x,z:e.z};
  if(free(at.x,at.z,.32)){
   const ghost=newEnemy(at,false);
   ghost.type='stalker';ghost.hp=ghost.maxHp=ENEMY_STATS.stalker[0]*(1+a.tier*.12);
   ghost.speed*=1.04;ghost.appearT=.25;ghost.eventEcho=true;
   enemies.push(ghost);a.echoes++;
   spark(at.x,at.z,'purple',7);
  }
 }
}
function wyrdfluxRareEventTick(dt){
 const a=wyrdfluxWorldEvents.active;
 if(!a||!wyrdfluxEventEligible()||a.wave!==wave)return;
 a.clock-=dt;if(a.clock>0)return;
 const t=a.tier;
 a.clock=Math.max(.65,4.3-t*.48);
 if(a.kind==='meteor'){
  for(let n=0;n<Math.min(3,1+Math.floor(t/2));n++){
   const at=randomOpen(2.5);
   if(Math.hypot(at.x-player.x,at.z-player.z)<1.8)continue;
   heatMarks.push({x:at.x,z:at.z,life:3.2+t*.28,max:3.2+t*.28});
   burst(at.x,at.z,'orange',.7,.2);
  }
 }else if(a.kind==='thunder'){
  const targets=enemies.filter(e=>e.hp>0&&!isBoss(e)).slice(0,2+t);
  for(const e of targets){spark(e.x,e.z,'cyan',8);damageEnemy(e,5+t*7,'arc');}
 }else if(a.kind==='shrine'){
  if(Math.hypot(player.x-a.x,player.z-a.z)<4){
   player.hp=Math.min(player.maxHp,player.hp+3+t*2);
   player.shield=Math.min(player.maxShield,player.shield+2+t);
  }
  a.clock=1.5;
 }else if(a.kind==='gravity'||a.kind==='repulse'){
  const pull=a.kind==='gravity';
  for(const e of enemies.slice(0,30)){
   if(e.hp<=0||isBoss(e))continue;
   const dx=pull?a.x-e.x:e.x-player.x,dz=pull?a.z-e.z:e.z-player.z;
   const d=Math.hypot(dx,dz);
   if(d<.25||d>Math.min(10,4+t*1.4))continue;
   const nextX=e.x+dx/d*(.20+t*.08),nextZ=e.z+dz/d*(.20+t*.08);
   if(free(nextX,nextZ,.35)){e.x=nextX;e.z=nextZ;}
  }
  burst(pull?a.x:player.x,pull?a.z:player.z,pull?'purple':'cyan',.8,.2);
 }else if(a.kind==='sentry'){
  const target=enemies.find(e=>e.hp>0&&!isBoss(e)&&Math.hypot(e.x-player.x,e.z-player.z)<14);
  if(target){
   tracers.push({x1:player.x,y1:2.3,z1:player.z,
    x2:target.x,y2:1.5,z2:target.z,life:.36,max:.36,col:'cyan',kind:'arc',phase:0});
   damageEnemy(target,8+t*8,'arc');
  }
 }else if(a.kind==='chronofield'){
  for(const e of enemies){
   if(e.hp>0&&!isBoss(e)&&Math.hypot(e.x-player.x,e.z-player.z)<9+t)
    e.slowUntil=Math.max(e.slowUntil||0,time+1.4+t*.35);
  }
  a.clock=1.1;
 }else if(a.kind==='mirage'){
  const e=enemies.find(e=>e.hp>0&&!isBoss(e)&&!e.saucer&&
   Math.hypot(e.x-player.x,e.z-player.z)>3);
  if(e){
   const dst={x:e.x+(rnd()-.5)*(1+t*.7),z:e.z+(rnd()-.5)*(1+t*.7)};
   if(free(dst.x,dst.z,.34)&&Math.hypot(dst.x-player.x,dst.z-player.z)>2.0){
    spark(e.x,e.z,'purple',4);e.x=dst.x;e.z=dst.z;spark(e.x,e.z,'cyan',4);
   }
  }
 }else if(a.kind==='fog'){
  a.x=player.x+(rnd()-.5)*5;a.z=player.z+(rnd()-.5)*5;
 }else if(a.kind==='ufo'&&a.spawned<t){
  if(wyrdfluxSpawnEventSaucer())a.spawned++;
 }else if(a.kind==='cache'&&a.count<2){
  a.count++;const pos=randomOpen(3);
  pickups.push({x:pos.x,z:pos.z,life:28,type:a.count%2?'shield':'health'});
 }
}
function wyrdfluxDrawRareEvent(m,p,q){
 const a=wyrdfluxWorldEvents.active;
 if(!a||!wyrdfluxEventEligible()||a.wave!==wave)return;
 const tier=a.tier,dist=Math.hypot(p.x-a.x,p.z-a.z);
 if((a.kind==='shrine'||a.kind==='gravity')&&dist<18){
  const col=a.kind==='shrine'?'green':'purple';
  for(let i=0;i<(q==='battery'?8:16);i++){
   const ang=i*TAU/(q==='battery'?8:16),radius=a.kind==='shrine'?3.9:Math.min(7,4+tier);
   m.beam(a.x+Math.cos(ang)*radius,.06,a.z+Math.sin(ang)*radius,
    a.x+Math.cos(ang+.18)*radius,.07,a.z+Math.sin(ang+.18)*radius,.035,col,.25);
  }
  m.box(a.x,.12+Math.sin(time*2)*.055,a.z,.3,.2,.3,col,.23);
 }else if(a.kind==='fog'&&dist<15&&q!=='battery'){
  for(let j=0;j<Math.min(12,4+tier*2);j++){
   const xx=a.x+Math.sin(j*2.3+time*.13)*3,
    zz=a.z+Math.cos(j*1.7+time*.12)*3;
   m.box(xx,.07,zz,.42,.02,.4,'ash',.035);
  }
 }else if(a.kind==='thunder'||a.kind==='meteor'){
  const col=a.kind==='thunder'?'cyan':'orange';
  m.beam(a.x,.05,a.z,a.x,.62+Math.sin(time*3)*.15,a.z,.07,col,.18);
 }
}
