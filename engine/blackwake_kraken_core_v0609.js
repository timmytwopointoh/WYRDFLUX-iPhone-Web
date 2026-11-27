/* WYRDFLUX Blackwake Kraken: four INDEPENDENT, severable tentacles share one
 * truthful boss HP pool. Blood projectile/pool physics ported from
 * WYRDFLUX IV Blood & Ink godot/scripts/blood.gd (original user-owned code).
 * Each limb stays as a non-targetable stump after its jet stops.
 * Attacks deliberately alternate rest -> tentacle slams -> rest ->
 * VERTICAL water lance -> rest, never a horizontal beam. */
const BLACKWAKE_KRAKEN_WARNING=1.00,BLACKWAKE_KRAKEN_CYCLE=4.20;
const BLACKWAKE_KRAKEN_CHEST_RADIUS=3.70;
const BLACKWAKE_BLOOD_MAX_DROPS=200,BLACKWAKE_BLOOD_MAX_POOLS=180;
const BLACKWAKE_WATER_LANCE_WARN=1.12,BLACKWAKE_WATER_LANCE_FIRE=1.55;
function freshBlackwakeKraken(){
 return {state:'dormant',hp:0,maxHp:0,age:0,frontClock:0,frontHit:false,
  slamClock:0,slamCount:0,slamHit:false,parts:[],severedCount:0,
  bloodDrops:[],bloodPools:[],bloodEmitted:0,bloodSettled:0,
  mode:'rest',restClock:1.40,nextAttack:'slams',attackCount:0,
  geyserClock:0,geyserHitClock:0,geyserTargetX:C,geyserTargetZ:C,
  geyserCount:0,geyserHits:0,
  body:{x:C+4.30,y:-.72,z:C-5.40,halfSubmerged:true,scale:1.90},
  eye:{dx:0,dy:0,vx:0,vy:0,blink:0},lastWarning:-9};
}
let blackwakeKraken=freshBlackwakeKraken();
function blackwakeKrakenSites(x,z,n=0){
 return [0,1,2].map(i=>{
  const angle=i*TAU/3+n*.37,r=1.16+(i===1?.18:0);
  return {rootX:clamp(x+Math.cos(angle)*r,1.5,N-1.5),
   rootZ:clamp(z+Math.sin(angle)*r,1.5,N-1.5),
   aimX:clamp(x+Math.cos(angle)*.55,1.5,N-1.5),
   aimZ:clamp(z+Math.sin(angle)*.55,1.5,N-1.5),
   warning:BLACKWAKE_KRAKEN_WARNING};
 });
}
function blackwakeKrakenWave(){
 const k=blackwakeKraken;if(k.state!=='active')return;
 k.mode='slams';k.attackCount++;
 const sites=blackwakeKrakenSites(player.x,player.z,k.slamCount++);
 for(let i=1;i<=3;i++){
  const t=k.parts[i],site=sites[i-1];
  if(t.severed)continue;
  // Keep each sea/shore root fixed across waves. Only the attack target moves.
  Object.assign(t,{aimX:site.aimX,aimZ:site.aimZ,warning:site.warning,
   tipX:t.rootX,tipZ:t.rootZ,tipY:t.rootY+.2});
  t.enemy.x=t.tipX;t.enemy.z=t.tipZ;
 }
 k.slamClock=0;k.slamHit=false;k.frontClock=0;k.frontHit=false;
}
function blackwakeKrakenGeyser(){
 const k=blackwakeKraken;if(k.state!=='active')return;
 k.mode='geyser';k.attackCount++;k.geyserCount++;
 k.geyserClock=0;k.geyserHitClock=0;
 // Fixed snapshot makes the vertical column dodgeable in its 1.12s tell.
 k.geyserTargetX=clamp(player.x+(player.vx||0)*.16,1.5,N-1.5);
 k.geyserTargetZ=clamp(player.z+(player.vz||0)*.16,1.5,N-1.5);
 notice('KRAKEN · VERTICAL TIDAL LANCE · LEAVE THE BLUE CIRCLE',2.4);
}
function beginBlackwakeKraken(){
 if(!livingRealm.active||livingRealm.id!=='blackwake')return false;
 const k=freshBlackwakeKraken();k.state='active';
 k.maxHp=Math.round(820*Math.max(.9,cycleDifficulty(wave).hp));k.hp=k.maxHp;
 const bx=BLACKWAKE_CHEST_WORLD.x+1.04,bz=BLACKWAKE_CHEST_WORLD.z+2.82;
 // Roots are independent shoreline coordinates, NEVER at the player's feet.
 const anchors=[[bx,bz],[C+3.8,C-1.9],[C-2.1,C-2.3],[C+2.1,C-3.3]];
 let allocated=0;
 for(let i=0;i<4;i++){
  const [x,z]=anchors[i];
  const floor=livingRenderer('blackwake')?.heightAt?.(x,z);
  const rootY=Number.isFinite(floor)?floor:0;
  const cap=i===3?k.maxHp-allocated:Math.round(k.maxHp*(i===0?.28:.24));
  allocated+=cap;
  const e={id:enemyId++,x,z,y:0,type:'blackwake_kraken',boss:i===0,
   krakenPart:true,krakenIndex:i,hp:cap,maxHp:cap,
   hit:0,flinchVel:0,intentClock:0,attackT:1,bob:0};
  k.parts.push({i,rootX:x,rootZ:z,rootY,tipX:x,tipZ:z,tipY:rootY+(i===0?3.65:.2),
   aimX:player.x,aimZ:player.z,enemy:e,hp:cap,maxHp:cap,
   severed:false,stumpY:Math.max(rootY+.68,.46),severT:0,deathFrom:null,bleedTime:0,bleedAccumulator:0});
  enemies.push(e);
 }
 blackwakeKraken=k;
 announce('BLACKWAKE KRAKEN · FOUR ARMS · FOUR DEATHS',4);
 notice('SEVER TENTACLES · DODGE SLAMS AND VERTICAL WATER LANCES',5);
 sound('warden');return true;
}
function blackwakeKrakenKnock(dx,dz,power){
 const d=Math.max(.01,Math.hypot(dx,dz)),x=dx/d,z=dz/d;
 collisionMove(player,x*Math.min(1.4,power),z*Math.min(1.4,power),.27);
 player.vx=x*5;player.vz=z*5;
 shake=Math.max(shake,.12);
 if(desktopPC)vibrateWyrdfluxPad(.47,140,'hurt');
}
// Noir's upward directional droplets: 20 m/s² gravity, per-drop variation,
// ground collision and persistent overlapping irregular 2D pools.
function blackwakeBloodDrop(k,limb){
 const angle=rnd()*TAU,speed=.5+rnd()*2.9;
 k.bloodDrops.push({x:limb.rootX+(rnd()-.5)*.28,
  y:limb.stumpY+(rnd()-.5)*.14,z:limb.rootZ+(rnd()-.5)*.28,
  vx:Math.cos(angle)*speed,vy:3.2+rnd()*6.3,
  vz:Math.sin(angle)*speed,life:2.7,r:.025+rnd()*.051});
 if(k.bloodDrops.length>BLACKWAKE_BLOOD_MAX_DROPS)
  k.bloodDrops.splice(0,k.bloodDrops.length-BLACKWAKE_BLOOD_MAX_DROPS);
 k.bloodEmitted++;
}
function blackwakeBloodPool(k,d){
 const renderer=livingRenderer('blackwake');
 const height=renderer?.heightAt?.(d.x,d.z);
 // Sea blood floats on the water surface; on shore it stains the terrain.
 const floor=Number.isFinite(height)?Math.max(-.38,height+.024):.025;
 const r=d.r*(2.2+rnd()*3.3);
 k.bloodPools.push({x:d.x,y:floor,z:d.z,r,stretchX:1.5+rnd()*.5,
  stretchZ:.9+rnd()*.9,rot:rnd()*TAU,
  satellite:rnd()>.40});
 if(k.bloodPools.length>BLACKWAKE_BLOOD_MAX_POOLS)
  k.bloodPools.splice(0,k.bloodPools.length-BLACKWAKE_BLOOD_MAX_POOLS);
 k.bloodSettled++;
}
function tickBlackwakeBlood(k,dt){
 for(const limb of k.parts){
  if(!limb.severed||limb.bleedTime<=0)continue;
  limb.bleedTime=Math.max(0,limb.bleedTime-dt);
  limb.bleedAccumulator+=dt*(16+Math.sin(k.age*15+limb.i)*3);
  let spawned=0;
  while(limb.bleedAccumulator>=1&&spawned<5){
   limb.bleedAccumulator--;blackwakeBloodDrop(k,limb);spawned++;
  }
 }
 for(let i=k.bloodDrops.length-1;i>=0;i--){
  const d=k.bloodDrops[i];
  d.vy-=20*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;d.life-=dt;
  const h=livingRenderer('blackwake')?.heightAt?.(d.x,d.z);
  const floor=Number.isFinite(h)?Math.max(-.38,h+.04):.045;
  if(d.y<=floor||d.life<=0){
   if(d.y<=floor)blackwakeBloodPool(k,d);
   k.bloodDrops.splice(i,1);
  }
 }
}
function blackwakeKrakenDamage(e,amount){
 const k=blackwakeKraken;
 if(!e?.krakenPart||k.state!=='active'||k.hp<=0)return false;
 const p=k.parts[e.krakenIndex];
 if(!p||p.severed||p.hp<=0)return false;
 const dmg=Math.min(p.hp,Math.max(.1,Number(amount)||.1)*(p.i===0?1.10:1));
 p.hp=Math.max(0,p.hp-dmg);k.hp=Math.max(0,k.hp-dmg);e.hp=p.hp;e.hit=.22;
 spark(e.x,e.z,'purple',4);
 if(p.hp<=0){
  p.hp=0;e.hp=0;p.severed=true;
  p.deathFrom={x:p.tipX,y:p.tipY,z:p.tipZ};p.severT=.55;
  p.tipX=p.rootX;p.tipZ=p.rootZ;p.tipY=p.stumpY;
  e.x=p.rootX;e.z=p.rootZ;
  p.bleedTime=1.85;p.bleedAccumulator=0;k.severedCount++;
  for(let n=0;n<22;n++)blackwakeBloodDrop(k,p);
  sound('hit');burst(p.rootX,p.rootZ,'red',1.4,.25);
  announce('KRAKEN LIMB '+(p.i+1)+' SEVERED · '+k.severedCount+'/4',2.0);
 }
 if(k.hp>.001&&k.severedCount<k.parts.length)return true;
 k.hp=0;k.state='defeated';k.mode='defeated';
 enemies=enemies.filter(other=>!other.krakenPart);
 burst(BLACKWAKE_CHEST_WORLD.x,BLACKWAKE_CHEST_WORLD.z,'cyan',3.2,.85);
 sound('upgrade');announce('KRAKEN DEFEATED · FOUR LIMBS SEVERED · TREASURE UNSEALED',4);
 notice('HOLD E / X AT THE GOLD CHEST',4.5);
 updateLivingRealmInstructions();return true;
}
function tickBlackwakeKraken(dt){
 const k=blackwakeKraken;
 for(const t of tracers)t.life-=dt;tracers=tracers.filter(t=>t.life>0);
 for(const t of lingeringBeams)t.life-=dt;
 lingeringBeams=lingeringBeams.filter(t=>t.life>0);
 for(const t of wyrdfluxContactFX){t.delay-=dt;if(t.delay<=0)t.life-=dt;}
 wyrdfluxContactFX=wyrdfluxContactFX.filter(t=>t.life>0);
 for(const t of particles){t.life-=dt;t.x+=t.vx*dt;t.y+=t.vy*dt;t.z+=t.vz*dt;t.vy-=dt*7;}
 particles=particles.filter(t=>t.life>0);
 if(k.state!=='active'&&k.state!=='defeated')return;
 k.age+=dt;tickBlackwakeBlood(k,dt);
 for(const p of k.parts){p.enemy.hit=Math.max(0,p.enemy.hit-dt);p.severT=Math.max(0,(p.severT||0)-dt);}
 if(k.state==='defeated')return;
 if(k.mode==='rest'){
  k.restClock-=dt;
  if(k.restClock<=0){
   if(k.nextAttack==='geyser')blackwakeKrakenGeyser();
   else blackwakeKrakenWave();
  }
 }
 const guard=k.parts[0];
 if(!guard.severed){
  if(k.mode==='slams'){
   const prior=k.frontClock;k.frontClock=(k.frontClock+dt)%3.05;
   if(k.frontClock<prior)k.frontHit=false;
   const swing=clamp((k.frontClock-.48)/.83,0,1);
   const lunge=Math.sin(Math.PI*swing)*2.15;
   const dx=player.x-guard.rootX,dz=player.z-guard.rootZ,
    length=Math.max(.01,Math.hypot(dx,dz));
   guard.tipX=guard.rootX+lunge*dx/length;
   guard.tipZ=guard.rootZ+lunge*dz/length;
   guard.tipY=guard.rootY+3.5+Math.sin(k.age*2.8)*.2-Math.sin(Math.PI*swing)*1.4;
   guard.enemy.x=guard.tipX;guard.enemy.z=guard.tipZ;
   if(!k.frontHit&&k.frontClock>=1.02&&k.frontClock<1.18&&
      Math.hypot(player.x-guard.tipX,player.z-guard.tipZ)<1.6){
    k.frontHit=true;hitPlayer(11);
    blackwakeKrakenKnock(player.x-BLACKWAKE_CHEST_WORLD.x,
     player.z-BLACKWAKE_CHEST_WORLD.z,.68);
    burst(player.x,player.z,'cyan',1,.3);
   }
  }else{
   guard.tipX=guard.rootX;guard.tipZ=guard.rootZ;
   guard.tipY=guard.rootY+3.35+Math.sin(k.age*1.4)*.16;
   guard.enemy.x=guard.tipX;guard.enemy.z=guard.tipZ;
  }
 }
 if(k.mode==='slams'){
  k.slamClock+=dt;
  if(!k.slamHit&&k.slamClock>=BLACKWAKE_KRAKEN_WARNING){
   k.slamHit=true;
   for(let i=1;i<=3;i++){
    const t=k.parts[i];if(t.severed)continue;
    if(Math.hypot(player.x-t.aimX,player.z-t.aimZ)<1.03){
     hitPlayer(5.5);
     blackwakeKrakenKnock(player.x-t.rootX,player.z-t.rootZ,.35);
    }
    burst(t.aimX,t.aimZ,'cyan',.75,.24);
   }
   sound('hit');shake=Math.max(shake,.1);
  }
  for(let i=1;i<=3;i++){
   const t=k.parts[i];if(t.severed)continue;
   const rise=clamp(k.slamClock/BLACKWAKE_KRAKEN_WARNING,0,1),
    strike=clamp((k.slamClock-BLACKWAKE_KRAKEN_WARNING)/.28,0,1),
    sink=clamp((k.slamClock-1.65)/1.1,0,1);
   t.tipX=mix(t.rootX,t.aimX,strike);
   t.tipZ=mix(t.rootZ,t.aimZ,strike);
   t.tipY=t.rootY+mix(.18+4*rise*(1-sink),.19+2.3*sink,strike);
   t.enemy.x=t.tipX;t.enemy.z=t.tipZ;
  }
  if(k.slamClock>=BLACKWAKE_KRAKEN_CYCLE){
   k.mode='rest';k.restClock=1.6;k.nextAttack='geyser';
  }
 }
 if(k.mode==='geyser'){
  k.geyserClock+=dt;k.geyserHitClock-=dt;
  const clock=k.geyserClock;
  if(clock>=BLACKWAKE_WATER_LANCE_WARN&&
     clock<BLACKWAKE_WATER_LANCE_WARN+BLACKWAKE_WATER_LANCE_FIRE){
   if(k.geyserHitClock<=0){
    k.geyserHitClock=.36;
    if(Math.hypot(player.x-k.geyserTargetX,player.z-k.geyserTargetZ)<.97){
     hitPlayer(8);k.geyserHits++;
     blackwakeKrakenKnock(player.x-k.geyserTargetX,
      player.z-k.geyserTargetZ,.38);
    }
   }
  }else if(clock>=BLACKWAKE_WATER_LANCE_WARN+BLACKWAKE_WATER_LANCE_FIRE){
   k.mode='rest';k.restClock=1.9;k.nextAttack='slams';
  }
 }
 // The true offshore body never teleports. Its single eye continues to
 // blink and aim even when all three slam arms have been severed.
 const eye=k.eye,body=k.body,bodyDx=player.x-body.x,bodyDz=player.z-body.z,
  bodyDist=Math.max(.1,Math.hypot(bodyDx,bodyDz)),
  attacking=k.mode==='slams'&&k.slamClock>.72&&k.slamClock<1.60,
  lash=attacking?.17:.035,
  lookX=clamp((bodyDx/bodyDist)*.13,-.14,.14),
  lookY=clamp((player.height-.20)*.14,-.12,.12);
 const rx=lookX+Math.sin(k.age*(attacking?12.5:2.1))*lash,
  ry=lookY+Math.cos(k.age*(attacking?10.7:1.9))*lash*.65;
 eye.vx+=(rx-eye.dx)*dt*32-eye.vx*dt*8.2;
 eye.vy+=(ry-eye.dy)*dt*32-eye.vy*dt*8.2;
 eye.dx=clamp(eye.dx+eye.vx*dt,-.25,.25);
 eye.dy=clamp(eye.dy+eye.vy*dt,-.23,.23);
 const blinkPhase=k.age%5.6;
 eye.blink=clamp(1-Math.abs(blinkPhase-4.65)/.16,0,1);
 const awayX=player.x-BLACKWAKE_CHEST_WORLD.x,
  awayZ=player.z-BLACKWAKE_CHEST_WORLD.z,
  dist=Math.max(.01,Math.hypot(awayX,awayZ));
 if(dist<BLACKWAKE_KRAKEN_CHEST_RADIUS){
  blackwakeKrakenKnock(awayX,awayZ,
   Math.min(.24,dt*5.7*(BLACKWAKE_KRAKEN_CHEST_RADIUS-dist+.2)));
  if(time-k.lastWarning>3){
   notice('THE KRAKEN DRIVES YOU FROM THE TREASURE',2.8);
   k.lastWarning=time;
  }
 }
}
