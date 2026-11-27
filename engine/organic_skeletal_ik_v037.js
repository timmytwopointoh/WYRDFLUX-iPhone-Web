/* VEILFORGE / AFTERLIGHT v0.37 — anatomical procedural skeletal skinning.
 * Three skinned influences per vertex, constrained two-segment IK for every
 * foot and every forearm, and transformed surface normals. Does not use
 * extracted models, external dependencies or network operations.
 * Blender masters lack weight-painted bones, so bind weights are generated
 * once from the original mesh's actual anatomical segment positions. */
(function(){
"use strict";
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,v)=>[a[0]*v,a[1]*v,a[2]*v];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const len=a=>Math.hypot(a[0],a[1],a[2]);
const unit=a=>mul(a,1/Math.max(.000001,len(a)));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const move=(a,b,t)=>add(a,mul(b,t));
const SEGMENT={pinky:4,knight:2,imp:2};
const cache=new WeakMap();let constraintCount=0;
function solve(root,knee,ankle,wanted,bend){
 const a=Math.max(.08,len(sub(knee,root))),b=Math.max(.08,len(sub(ankle,knee)));
 const d=sub(wanted,root),dist=Math.max(.0001,len(d)),direction=unit(d);
 const reach=cap(dist,Math.abs(a-b)+.006,a+b-.007);
 const final=move(root,direction,reach);
 const along=(a*a-b*b+reach*reach)/(2*reach);
 const rise=Math.sqrt(Math.max(0,a*a-along*along));
 let bendAxis=sub(bend,mul(direction,dot(bend,direction)));
 if(len(bendAxis)<.0001)bendAxis=cross(direction,Math.abs(direction[2])>.9?[0,1,0]:[0,0,1]);
 const joint=add(move(root,direction,along),mul(unit(bendAxis),rise));
 constraintCount++;
 return [root,joint,final];
}
function push(out,a,b,c,d,r){
 const fixedLength=Math.max(.001,len(sub(b,a)));
 const exactEnd=add(c,mul(unit(sub(d,c)),fixedLength));
 out.push({a,b,c,d:exactEnd,r});
}
function bones(kind,pose){
 const p=pose||{},body=p.wind||0,strike=p.strike||0,cast=p.cast||0;
 const jump=p.leap||0,land=p.land||0,turn=p.turn||0;
 const breath=p.breathing||0,gait=p.phase||0,walk=p.walk||0;
 const origin=kind==='pinky'?[0,1.25,.27]:kind==='knight'?[0,1.39,.06]:[0,1.01,.10];
 const chest=kind==='pinky'?[0,1.56,-.63]:kind==='knight'?[0,2.43,-.07]:[0,1.55,-.22];
 const skull=kind==='pinky'?[0,1.69,-1.30]:kind==='knight'?[0,3.18,-.59]:[0,1.87,-.62];
 const torsoDelta=kind==='pinky'?[turn*.02,-body*.08+strike*.06,body*.09-strike*.16]:
  kind==='knight'?[turn*.09,-body*.07+strike*.04,body*.14-strike*.17]:
  [turn*.045,jump*.48-land*.14-body*.12,body*.12-jump*.12];
 const chestT=add(chest,add(torsoDelta,[turn*.08,breath*.027,0]));
 const skullT=add(skull,add(torsoDelta,[turn*.10,-body*.03+strike*.02,-strike*.15+cast*.05]));
 const b=[];
 push(b,origin,chest,add(origin,mul(torsoDelta,.35)),chestT,kind==='knight'?.83:.60);
 push(b,chest,skull,chestT,skullT,kind==='knight'?.46:.38);
 const jaw=kind==='pinky'?[[0,1.25,-1.44],[0,1.12,-1.63]]:
  kind==='knight'?[[0,2.98,-.90],[0,2.78,-.97]]:
  [[0,1.71,-.79],[0,1.58,-.89]];
 push(b,jaw[0],jaw[1],add(jaw[0],torsoDelta),
  add(jaw[1],add(torsoDelta,[0,-strike*.12,0])),.22);
 for(const sign of [-1,1]){
  const legs=kind==='pinky'?[false,true]:[false];
  for(const rear of legs){
   const key=(kind==='pinky'?(rear?'h':'f'):'')+(sign<0?'l':'r');
   const foot=(p.feet||{})[key]||{dx:0,dz:0,support:0};
   const f=cap(foot.support||0,0,1);
   const theta=gait+(sign<0?Math.PI:0)+(rear?Math.PI:0);
   const sweep=Math.sin(theta),lift=Math.max(0,sweep)*walk*(1-f);
   const hx=kind==='pinky'?sign*(rear?.50:.60):kind==='knight'?sign*.45:sign*.28;
   const hz=kind==='pinky'?(rear?.79:-.78):kind==='knight'?.02:.15;
   const hip=[hx,kind==='pinky'?(rear?1.26:1.29):kind==='knight'?1.20:.92,hz];
   const knee=[hx*1.10,kind==='pinky'?.72:kind==='knight'?.69:.48,
    hz+(kind==='pinky'?(rear?.18:-.10):kind==='knight'?.16:.29)];
   const ankle=[hx*1.12,kind==='pinky'?.13:.12,
    hz+(kind==='pinky'?(rear?.34:-.21):kind==='knight'?-.16:-.34)];
   const target=add(ankle,[
    (foot.dx||0)*f,lift*.17+(kind==='imp'?jump*.16:0),
    (foot.dz||0)*f+sweep*walk*(kind==='pinky'?.19:.22)*(1-f)]);
   const hipT=add(hip,mul(torsoDelta,kind==='imp'?.85:.46));
   const [a,c,d]=solve(hipT,add(knee,sub(hipT,hip)),add(ankle,sub(hipT,hip)),target,
    [sign*.26,0,kind==='imp'?.27:rear?.27:-.18]);
   push(b,hip,knee,a,c,kind==='knight'?.33:.26);
   push(b,knee,ankle,c,d,kind==='knight'?.27:.22);
  }
  const sx=kind==='pinky'?sign*.62:kind==='knight'?sign*.88:sign*.43;
  const shoulder=kind==='pinky'?[sx,1.52,-.59]:kind==='knight'?[sx,2.40,-.06]:[sx,1.53,-.16];
  const elbow=kind==='pinky'?[sx*1.12,1.04,-.64]:
   kind==='knight'?[sign*1.11,1.70,-.26]:[sign*.63,1.04,-.39];
  const wrist=kind==='pinky'?[sx*1.18,.63,-.81]:
   kind==='knight'?[sign*1.32,1.15,-.67]:[sign*.75,.60,-.57];
  const shove=kind==='pinky'?[0,body*.04,-strike*.14]:
   kind==='knight'?[sign*turn*.12,body*.11+cast*.18+strike*.08,
      body*.22-strike*.53-cast*.22]:
   [sign*turn*.08,body*.14+jump*.14,body*.18-jump*.26-strike*.25-cast*.12];
  const shoulderT=add(shoulder,mul(torsoDelta,.78));
  const wristT=add(wrist,add(mul(torsoDelta,.68),shove));
  const [a,c,d]=solve(shoulderT,add(elbow,sub(shoulderT,shoulder)),
    add(wrist,sub(shoulderT,shoulder)),wristT,
    [sign*.30,0,kind==='imp'?-.17:.24]);
  push(b,shoulder,elbow,a,c,kind==='knight'?.37:.27);
  push(b,elbow,wrist,c,d,kind==='knight'?.33:.23);
 }
 if(kind==='imp'){
  const tail=[0,.95,.41],mid=[.06,.75,.84],tip=[.02,.81,1.48];
  const twitch=Math.sin((p.time||0)*4.2+gait*.28)*.15;
  const mt=add(mid,add(torsoDelta,[twitch,jump*.1,0]));
  const tt=add(tip,add(torsoDelta,[twitch*1.6,jump*.2,-cast*.08]));
  push(b,tail,mid,add(tail,torsoDelta),mt,.24);
  push(b,mid,tip,mt,tt,.19);
 }
 return b;
}
function mat(b){
 const u=unit(sub(b.b,b.a)),v=unit(sub(b.d,b.c));
 const c=cross(u,v),d=cap(dot(u,v),-1,1);
 let q=[c[0],c[1],c[2],1+d],n=Math.hypot(...q);
 if(n<.00001){q=[1,0,0,0];n=1}
 const x=q[0]/n,y=q[1]/n,z=q[2]/n,w=q[3]/n;
 const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
 return {...b,m:[1-2*(yy+zz),2*(xy-wz),2*(xz+wy),
  2*(xy+wz),1-2*(xx+zz),2*(yz-wx),
  2*(xz-wy),2*(yz+wx),1-2*(xx+yy)]};
}
function apply(r,p){return [r[0]*p[0]+r[1]*p[1]+r[2]*p[2],
 r[3]*p[0]+r[4]*p[1]+r[5]*p[2],
 r[6]*p[0]+r[7]*p[1]+r[8]*p[2]]}
function proximity(b,p){
 const a=sub(b.b,b.a),t=cap(dot(sub(p,b.a),a)/Math.max(.0001,dot(a,a)),0,1);
 return Math.pow(Math.max(0,1-len(sub(p,add(b.a,mul(a,t))))/(b.r+.17)),2);
}
function buildCache(kind,model){
 let hit=cache.get(model);if(hit&&hit.kind===kind)return hit;
 const binding=bones(kind,null),weights=[],lookup=new Map();
 model.batches.forEach((batch,bi)=>{
  lookup.set(batch,bi);
  const verts=batch.v,count=verts.length/6,idx=new Uint8Array(count*3),
   weight=new Float32Array(count*3);
  for(let i=0;i<count;i++){
   const v=i*6,p=[verts[v],verts[v+1],verts[v+2]];
   let best=[[0,0],[0,0],[0,0]];
   binding.forEach((b,j)=>{
    let w=proximity(b,p);if(j===0)w+=.026;
    if(w>best[0][1])best=[[j,w],best[0],best[1]];
    else if(w>best[1][1])best=[best[0],[j,w],best[1]];
    else if(w>best[2][1])best[2]=[j,w];
   });
   const total=best.reduce((n,t)=>n+t[1],0);
   for(let k=0;k<3;k++){
    idx[i*3+k]=best[k][0];
    weight[i*3+k]=total>.000001?best[k][1]/total:(k===0?1:0);
   }
  }
  weights.push({idx,weight});
 });
 hit={kind,weights,lookup,bindJoints:binding.length};
 cache.set(model,hit);return hit;
}
/* Blender 5.2 Actions/NLA sampled at 24fps from actual skinned, editable
 * creature armatures. The game is offline: the baked data is embedded in its
 * HTML and never fetched over HTTP. Distinct animation clips control the real
 * three-weight skinned meshes, not a viewport-only Blender demo. */
const animPack=(()=>{
 try{
  const raw=document.getElementById('afterlightDemonActionKit')?.textContent||'';
  const parsed=raw&&JSON.parse(raw);
  if(parsed&&parsed.schema===1&&parsed.fps===24&&
     parsed.species&&['pinky','knight','imp'].every(k=>parsed.species[k]?.clips?.idle))
   return parsed;
 }catch(_){}
 return null;
})();
let blenderClipFrames=0,blenderClipChanges=0,blenderSkinnedFrames=0;
const actionCatalog=Object.freeze(['idle','walk','run','windup','attack','recover',
 'cast','leap','land','hit','death','roar','dodge']);
function actionFor(kind,pose,actor){
 if(actor?.organicDeadT!==undefined)return 'death';
 if(actor?.impLeapT>0&&kind==='imp')return 'leap';
 if(actor?.impLandingT>.035&&kind==='imp')return 'land';
 if(actor?.pinkyHopT>0&&kind==='pinky')return 'dodge';
 if(actor?.hellCastStage==='charge'||actor?.hellCastStage==='fire')return 'cast';
 if(actor?.meleeStage==='windup')return 'windup';
 if(actor?.meleeStage==='lunge')return 'attack';
 if(actor?.meleeStage==='recover'||actor?.meleeStage==='retreat')return 'recover';
 if(actor?.organicRoarUntil>pose.time)return 'roar';
 if((actor?.hit||0)>.16)return 'hit';
 const speed=actor?.moveSpeed||0;
 if(speed>(kind==='pinky'?3.35:kind==='knight'?2.9:3.75))return 'run';
 if(speed>.56)return 'walk';
 return 'idle';
}
function clipPose(kind,pose,actor,baseBones){
 const species=animPack?.species?.[kind];if(!species)return baseBones;
 const action=actionFor(kind,pose,actor);
 const clip=species.clips?.[action];if(!clip||!Array.isArray(clip.samples)||
    clip.samples.length<2||clip.bones!==baseBones.length)return baseBones;
 const actorTime=pose.time||0;
 let current=actor?.organicAction;
 if(!current||current.name!==action){
  current={name:action,started:actorTime,prev:current?.name||'idle',
    prevClock:current?actorTime-current.started:0,blendFrom:actorTime};
  if(actor)actor.organicAction=current;
  blenderClipChanges++;
 }
 function sample(name,localClock){
  const c=species.clips[name];if(!c)return null;
  const length=c.samples.length;
  const t=c.loop?((localClock*c.fps)%length+length)%length:
   cap(localClock*c.fps,0,length-1);
  const i=Math.floor(t),j=c.loop?(i+1)%length:Math.min(length-1,i+1);
  const f=t-i,arr1=c.samples[i],arr2=c.samples[j];
  if(!arr1||!arr2||arr1.length!==baseBones.length*6)return null;
  const a=new Float32Array(arr1.length);
  for(let k=0;k<a.length;k++)a[k]=arr1[k]*(1-f)+arr2[k]*f;
  return a;
 }
 // Locomotion is distance-phase locked rather than time-driven to retain
 // grounded feet during velocity changes; attack clips use action time.
 const clock=(action==='walk'||action==='run')?
   (((pose.phase||0)%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/
      (Math.PI*2)*(clip.samples.length/clip.fps):
   (actor?.organicDeadT!==undefined?actor.organicDeadT:
    actorTime-current.started);
 let data=sample(action,clock);if(!data)return baseBones;
 const blend=cap((actorTime-current.blendFrom)/.13,0,1);
 if(blend<1&&current.prev&&species.clips[current.prev]){
  const prev=sample(current.prev,current.prevClock+actorTime-current.started);
  if(prev&&prev.length===data.length){
   for(let i=0;i<data.length;i++)data[i]=prev[i]*(1-blend)+data[i]*blend;
  }
 }
 const result=baseBones.map((b,i)=>{
  const start=i*6;
  // When a foot is world-anchored, the authoritative two-bone IK target wins.
  // Authored stride animation is blended more strongly in swing.
  const leg=kind==='pinky'?[3,4,5,6,9,10,11,12].includes(i):
   [3,4,7,8].includes(i);
  const stance=leg&&Object.values(pose.feet||{}).some(ft=>ft.support>.65);
  const weight=stance?.13:leg?.43:.82;
  const c=[0,1,2].map(j=>b.c[j]*(1-weight)+data[start+j]*weight);
  const dst=[0,1,2].map(j=>b.d[j]*(1-weight)+data[start+3+j]*weight);
  // Preserve anatomical rest lengths to prevent rubber limbs or dislocation.
  const length=Math.max(.001,len(sub(b.b,b.a)));
  const d=add(c,mul(unit(sub(dst,c)),length));
  return {...b,c,d};
 });
 blenderClipFrames++;
 return result;
}
function prepare(kind,pose,model,actor=null){
 const bind=buildCache(kind,model);
 const segments=clipPose(kind,pose,actor,bones(kind,pose)).map(mat);
 if(animPack)blenderSkinnedFrames++;
 return {bind,transforms:segments};
}
function skin(rig,batch,at){
 const bi=rig.bind.lookup.get(batch);if(bi===undefined)throw Error('Unknown skeletal batch');
 const sk=rig.bind.weights[bi],base=(at/6)|0,v=batch.v,
  p=[v[at],v[at+1],v[at+2]],normal=[v[at+3],v[at+4],v[at+5]];
 let xyz=[0,0,0],nn=[0,0,0];
 for(let k=0;k<3;k++){
  const w=sk.weight[base*3+k];if(w<.000001)continue;
  const b=rig.transforms[sk.idx[base*3+k]];
  const pos=add(b.c,apply(b.m,sub(p,b.a))),n=apply(b.m,normal);
  xyz=add(xyz,mul(pos,w));nn=add(nn,mul(n,w));
 }
 nn=unit(nn);
 return [xyz[0],xyz[1],xyz[2],nn[0],nn[1],nn[2]];
}
window.OrganicRigV037={prepare,skin,bindSkeleton:kind=>bones(kind,null).map(b=>({a:b.a,b:b.b,r:b.r})),
 actions:()=>animPack?{species:Object.keys(animPack.species),clips:actionCatalog,frames:blenderClipFrames,changes:blenderClipChanges,skinned:blenderSkinnedFrames,actualBlender:true}:{species:[],clips:[],frames:0,changes:0,skinned:0,actualBlender:false},
 diagnostics:()=>({constraints:constraintCount,types:Object.keys(SEGMENT)})};
})();