/* WYRDFLUX Blackwake Kraken — actual procedural 3D geometry generated into
 * the game's existing WebGL2 Mesh batch, LOD-capped for GTX 1060 and Android. */
function blackwakeKrakenOrb(m,x,y,z,rx,ry,rz,col,em=0,quality='balanced'){
 const slices=quality==='high'?12:quality==='battery'?6:8;
 function pt(a,b){return [x+rx*Math.sin(a)*Math.cos(b),y+ry*Math.cos(a),z+rz*Math.sin(a)*Math.sin(b)]}
 for(let j=0;j<slices/2;j++)for(let i=0;i<slices;i++){
  const a=Math.PI*j/(slices/2),b=Math.PI*(j+1)/(slices/2),
   c=TAU*i/slices,d=TAU*(i+1)/slices,
   v1=pt(a,c),v2=pt(b,c),v3=pt(b,d),v4=pt(a,d);
  m.tri(v1,v2,v3,col,em);m.tri(v1,v3,v4,col,em);
 }
}
function blackwakeKrakenTube(m,part,q){
 if(part.severed){
  // The dead arm is permanently reduced to a thick, torn stump.
  // The severed limb collapses into its rooted stump, never floats.
  const x=part.rootX,z=part.rootZ,cut=part.stumpY;
  const collapse=clamp((part.severT||0)/.55,0,1);
  if(collapse>0&&part.deathFrom){
   const end=part.deathFrom;
   m.beam(x,part.rootY??0,z,mix(x,end.x,collapse),mix(cut,end.y,collapse),
    mix(z,end.z,collapse),.37*collapse,'charcoal',.04);
  }
  m.beam(x,(part.rootY??0)-.10,z,x+.06,cut-.10,z-.08,.48,'charcoal',.025);
  blackwakeKrakenOrb(m,x+.06,cut-.09,z-.08,.47,.19,.45,
   [.19,.11,.24],.02,q);
  blackwakeKrakenOrb(m,x+.06,cut,z-.08,.40,.075,.38,
   [.79,.009,.021],.08,q);
  for(let i=0;i<7;i++){
   const a=i*TAU/7,rad=.28+.05*Math.sin(i*3.7);
   m.beam(x+Math.cos(a)*rad,cut+.03,z+Math.sin(a)*rad,
     x+Math.cos(a)*(.37+.07*(i%3)),cut+.18*(i%2),z+Math.sin(a)*(.37+.07*(i%3)),
     .035,i%2?'wound':'sinew',.035);
  }
  return;
 }
 // Shore ambush arms submerge during recovery; killed stumps NEVER respawn.
 if(part.i>0&&blackwakeKraken.mode!=='slams')return;
 const steps=q==='high'?9:q==='battery'?5:7,sectors=q==='high'?10:q==='battery'?6:8;
 const nodes=[];
 for(let i=0;i<=steps;i++){
  const u=i/steps,osc=Math.sin(time*3.2+u*7+part.i*1.8)*(.12+.16*u),
   depth=Math.sin(u*Math.PI)*(.64+.12*part.i);
  nodes.push({
   x:mix(part.rootX,part.tipX,u)+osc*(1-u),
   y:mix((part.rootY??0)-.10,part.tipY,u)+depth+Math.cos(u*5+time*2)*.04,
   z:mix(part.rootZ,part.tipZ,u)+Math.cos(time*2.7+u*5+part.i)*.14*(1-u)
  });
 }
 const body=part.enemy.hit>0?[.90,.47,.51]:[.17,.13,.22],
  ridge=[.29,.39,.46],suck=[.68,.51,.46];
 for(let i=0;i<steps;i++){
  const a=nodes[i],b=nodes[i+1],
   r1=.37*(1-i/steps)+.085,r2=.37*(1-(i+1)/steps)+.085;
  for(let j=0;j<sectors;j++){
   const q1=j*TAU/sectors,q2=(j+1)*TAU/sectors,
    p1=[a.x+Math.cos(q1)*r1,a.y,a.z+Math.sin(q1)*r1],
    p2=[a.x+Math.cos(q2)*r1,a.y,a.z+Math.sin(q2)*r1],
    p3=[b.x+Math.cos(q2)*r2,b.y,b.z+Math.sin(q2)*r2],
    p4=[b.x+Math.cos(q1)*r2,b.y,b.z+Math.sin(q1)*r2],
    tint=j%4===0?ridge:body;
   m.tri(p1,p2,p3,tint,.07);m.tri(p1,p3,p4,tint,.07);
  }
  if(i%2===1&&q!=='battery'){
   blackwakeKrakenOrb(m,a.x+.11,a.y-.14,a.z+.20,.095,.056,.065,suck,.08,q);
   if(q==='high')blackwakeKrakenOrb(m,a.x-.08,a.y-.16,a.z+.21,.078,.047,.057,suck,.07,q);
  }
 }
 const tip=nodes[steps];
 blackwakeKrakenOrb(m,tip.x,tip.y,tip.z,.24,.25,.23,body,.14,q);
 if(part.i>0&&blackwakeKraken.mode==='slams'&&
    blackwakeKraken.slamClock<BLACKWAKE_KRAKEN_WARNING){
  const warning=clamp(blackwakeKraken.slamClock/BLACKWAKE_KRAKEN_WARNING,0,1);
  // Floor ring uses double-sided geometry, so it is visible from a FPS view.
  const segments=q==='battery'?10:20,radius=.88;
  for(let j=0;j<segments;j++){
   const a=j*TAU/segments,b=(j+1)*TAU/segments;
   const x1=part.aimX+Math.cos(a)*radius,z1=part.aimZ+Math.sin(a)*radius,
    x2=part.aimX+Math.cos(b)*radius,z2=part.aimZ+Math.sin(b)*radius,
    x3=part.aimX+Math.cos(a)*(radius-.09),z3=part.aimZ+Math.sin(a)*(radius-.09),
    x4=part.aimX+Math.cos(b)*(radius-.09),z4=part.aimZ+Math.sin(b)*(radius-.09);
   const color=warning>.73?'red':'cyan';
   m.tri([x1,(part.rootY??0)+.06,z1],[x2,(part.rootY??0)+.06,z2],[x4,(part.rootY??0)+.06,z4],color,.35+warning*.7);
   m.tri([x1,(part.rootY??0)+.06,z1],[x4,(part.rootY??0)+.06,z4],[x3,(part.rootY??0)+.06,z3],color,.35+warning*.7);
  }
 }
}
// The distant Kraken has a real stationary half-submerged body in the ocean.
// Eye is socketed into its purple head, NOT the front attacking tentacle.
function drawBlackwakeKrakenBody(m,k,q){
 const body=k.body,x=body.x,y=body.y,z=body.z,age=k.age,S=body.scale||1.33;
 const hide=0.0,bob=Math.sin(age*.73)*.025;
 // A low organic humped silhouette: the water plane hides the bottom half.
 blackwakeKrakenOrb(m,x,y+bob,z,1.73*S,1.13*S,1.82*S,[.225,.085,.307],.015,q);
 blackwakeKrakenOrb(m,x,y+.26*S+bob,z-.12*S,1.33*S,.72*S,1.33*S,[.291,.128,.365],.008,q);
 // Sculpted overlapping skin rolls, small warty knots and shallow scars.
 const knots=q==='battery'?4:8;
 for(let i=0;i<knots;i++){
  const a=(i+.34)*TAU/knots,rad=S*(1.34+.08*Math.sin(i*3.3));
  const px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad;
  blackwakeKrakenOrb(m,px,y-.19+bob+Math.sin(i*.9)*.12,pz,
   S*(.39+(i%3)*.045),S*(.29+(i%2)*.07),S*(.44+(i%4)*.03),
   i%3===0?[.335,.164,.410]:[.216,.091,.310],.01,q);
 }
 if(q!=='battery')for(let i=0;i<5;i++){
  const a=i*TAU/5+.38;
  const px=x+Math.cos(a)*.96*S,pz=z+Math.sin(a)*1.03*S;
  blackwakeKrakenOrb(m,px,y+.43+bob,pz,.16,.095,.23,
   i%2?[.34,.15,.38]:[.16,.073,.23],.028,q);
 }
 // Moving tide ripple rings, centered under a body whose X/Z never change.
 for(let band=0;band<2;band++){
  const r=S*(1.82+band*.34+Math.sin(age*.9+band*1.2)*.065),
   count=q==='battery'?10:20;
  for(let i=0;i<count;i++){
   const a=TAU*i/count,c=TAU*(i+1)/count,inner=r-.042,
    p=[x+Math.cos(a)*r,-.43,z+Math.sin(a)*r],
    v=[x+Math.cos(c)*r,-.43,z+Math.sin(c)*r],
    u=[x+Math.cos(c)*inner,-.43,z+Math.sin(c)*inner],
    w=[x+Math.cos(a)*inner,-.43,z+Math.sin(a)*inner];
   m.tri(p,v,u,band?'cyan':'mist',.10+band*.09);
   m.tri(p,u,w,band?'cyan':'mist',.10+band*.09);
  }
 }
 // The one eye sits on the submerged head and follows the PLAYER, rather
 // than being glued to any of the four independently animated tendrils.
 const toX=player.x-x,toZ=player.z-z,d=Math.max(.1,Math.hypot(toX,toZ)),
  nx=toX/d,nz=toZ/d,tx=-nz,tz=nx;
 const ex=x+nx*.92*S,ey=.70+bob,ez=z+nz*.92*S;
 const blink=clamp(k.eye.blink,0,1),opening=1-.94*blink;
 // Socket, wet eyelid rim and exposed white eye.
 blackwakeKrakenOrb(m,ex-nx*.09,ey-.02,ez-nz*.09,
  S*.61,S*.49,S*.57,[.098,.041,.146],.02,q);
 blackwakeKrakenOrb(m,ex,ey,ez,
  S*.49,S*.44*opening,S*.47,[.86,.80,.88],.14,q);
 const wiggle=clamp(k.eye.dx,-.21,.21),up=clamp(k.eye.dy,-.19,.19);
 const ix=ex+nx*.435*S+tx*wiggle*S,iy=ey+up*.58*S,iz=ez+nz*.435*S+tz*wiggle*S;
 blackwakeKrakenOrb(m,ix,iy,iz,
  S*.21,S*.22*opening,S*.125,[.82,.055,.12],.24,q);
 blackwakeKrakenOrb(m,ix+nx*.091,iy,iz+nz*.091,
  S*.120,S*.149*opening,S*.082,[.035,.022,.059],.025,q);
 if(opening>.18)blackwakeKrakenOrb(m,
  ix+nx*.15-tx*.054,iy+.08*opening,iz+nz*.15-tz*.054,
  .057,.057*opening,.033,'white',.62,q);
 // Brief blink: purple lids slide together across the only eyeball.
 if(blink>.10){
  blackwakeKrakenOrb(m,ex+nx*.045,ey+.24*(1-blink),ez+nz*.045,
   .50,.10+.28*blink,.47,[.289,.13,.37],.02,q);
 }
}
// Water-based laser is a single VERTICAL pillar rising from its mark. The
// warning ring, beam, collision and damage all use exactly one X/Z target.
function blackwakeKrakenVerticalWaterSheet(m,x,z,height,radius,q,energy){
 // A full 3D vertical water cylinder: unlike Mesh.beam(), a pure Y axis
 // does not collapse to zero width. All vertices share the same X/Z centre.
 const sectors=q==='battery'?8:16;
 for(let i=0;i<sectors;i++){
  const a=i*TAU/sectors,b=(i+1)*TAU/sectors;
  const p1=[x+Math.cos(a)*radius,-.38,z+Math.sin(a)*radius];
  const p2=[x+Math.cos(b)*radius,-.38,z+Math.sin(b)*radius];
  const p3=[x+Math.cos(b)*radius,height,z+Math.sin(b)*radius];
  const p4=[x+Math.cos(a)*radius,height,z+Math.sin(a)*radius];
  m.tri(p1,p2,p3,'blue',energy);
  m.tri(p1,p3,p4,'cyan',energy*.72);
 }
}
function drawBlackwakeKrakenWaterLance(m,k,q){
 if(k.mode!=='geyser')return;
 const x=k.geyserTargetX,z=k.geyserTargetZ,t=k.geyserClock;
 const warning=t<BLACKWAKE_WATER_LANCE_WARN,
  intensity=warning?clamp(t/BLACKWAKE_WATER_LANCE_WARN,0,1):
   clamp((BLACKWAKE_WATER_LANCE_WARN+BLACKWAKE_WATER_LANCE_FIRE-t)/.30,0,1);
 const segments=q==='battery'?12:24,rad=.97;
 for(let i=0;i<segments;i++){
  const a=i*TAU/segments,b=(i+1)*TAU/segments;
  const one=[x+Math.cos(a)*rad,.075,z+Math.sin(a)*rad];
  const two=[x+Math.cos(b)*rad,.075,z+Math.sin(b)*rad];
  const inner=[x+Math.cos(a)*(rad-.12),.075,z+Math.sin(a)*(rad-.12)];
  const innerNext=[x+Math.cos(b)*(rad-.12),.075,z+Math.sin(b)*(rad-.12)];
  const color=warning?'cyan':'blue';
  m.tri(one,two,innerNext,color,.38+intensity*.55);
  m.tri(one,innerNext,inner,color,.38+intensity*.55);
 }
 if(warning){
  blackwakeKrakenVerticalWaterSheet(m,x,z,.4+intensity*1.9,.075,q,.21+intensity*.5);
  return;
 }
 // Centre column ends in the sky, never sweeps horizontally through walls.
 const pulse=.83+.17*Math.sin(time*22);
 blackwakeKrakenVerticalWaterSheet(m,x,z,10.5,.72,q,1.3*pulse);
 blackwakeKrakenVerticalWaterSheet(m,x,z,10.7,.28,q,2.3*pulse);
 blackwakeKrakenVerticalWaterSheet(m,x,z,10.9,.095,q,1.4*pulse);
 if(q==='battery')return;
 for(let i=0;i<10;i++){
  const a=i*TAU/10+time*1.2,spread=.53+.10*Math.sin(time*4+i);
  const px=x+Math.cos(a)*spread,pz=z+Math.sin(a)*spread;
  m.ribbon(px,.08,pz,x+Math.cos(a+.75)*spread,10.2,z+Math.sin(a+.75)*spread,
    .035,'cyan',.42+pulse*.36,{x:player.x,y:1.64+player.height,z:player.z});
 }
 for(let i=0;i<16;i++){
  const a=i*2.39996+time*1.7,yy=((i*1.39+time*5.5)%9.5)+.3;
  m.box(x+Math.sin(a)*(.45+yy*.024),yy,z+Math.cos(a)*(.45+yy*.024),
    .07,.14,.08,i%3?'cyan':'white',.35+pulse*.3);
 }
}
function drawBlackwakeKrakenBlood(m,k,q){
 const red=[.79,.009,.021];
 for(const d of k.bloodDrops){
  m.box(d.x,d.y,d.z,d.r,d.r*1.45,d.r,red,.05);
 }
 // Noir pools remain through the remainder of the encounter, are bounded,
 // and form overlapping asymmetrical puddles instead of disappearing sprites.
 const pools=q==='battery'?k.bloodPools.slice(-65):k.bloodPools;
 const segments=q==='battery'?7:12;
 for(const p of pools){
  const c=Math.cos(p.rot),sn=Math.sin(p.rot);
  const disk=(cx,cz,rr,rx,rz)=>{
   for(let j=0;j<segments;j++){
    const a=j*TAU/segments,b=(j+1)*TAU/segments;
    const v=(theta)=>[cx+rr*rx*Math.cos(theta)*c-rr*rz*Math.sin(theta)*sn,
      p.y,cz+rr*rx*Math.cos(theta)*sn+rr*rz*Math.sin(theta)*c];
    m.tri([cx,p.y,cz],v(a),v(b),red,.015);
   }
  };
  disk(p.x,p.z,p.r,p.stretchX,p.stretchZ);
  if(p.satellite)disk(p.x+p.r*.42,p.z-p.r*.2,p.r*.61,.9,1.1);
 }
}
function drawBlackwakeKraken(m,q){
 const k=blackwakeKraken;
 if(!livingRealm.active||livingRealm.id!=='blackwake'||
    (k.state!=='active'&&k.state!=='defeated'))return;
 drawBlackwakeKrakenBody(m,k,q);
 for(const part of k.parts)blackwakeKrakenTube(m,part,q);
 drawBlackwakeKrakenWaterLance(m,k,q);
 drawBlackwakeKrakenBlood(m,k,q);
}
function drawBlackwakeKrakenGunFX(m,p,q){
 for(const b of tracers.slice(-(q==='battery'?7:16))){
  if(b.life<=0)continue;
  const fade=clamp(b.life/Math.max(.01,b.max),0,1);
  m.ribbon(b.x1,b.y1,b.z1,b.x2,b.y2,b.z2,.025+.035*fade,b.col,
   .25+.85*fade,{x:p.x,y:1.64+p.height,z:p.z});
 }
 for(const dot of particles.slice(-20))if(dot.life>0)
  m.box(dot.x,dot.y,dot.z,dot.size,dot.size,dot.size,dot.col,.65);
}
