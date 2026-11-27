/* WYRDFLUX | real Blender NLA puppet armature playback (WebGL2 skinning).
 * Four original sculpted character meshes, 4 rigged GLB animation libraries.
 * No constant mesh reupload. 24 joint limit prevents excessive GPU cost.
 */
(()=>{'use strict';
const state={status:'idle',error:null,models:[],bytes:0,draws:0,triangles:0,clips:[],bones:0};
const MAX_BONES=24;
const ID=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const shaderVertex=[
'#version 300 es',
'precision highp float;',
'layout(location=0) in vec3 position;',
'layout(location=1) in vec3 normal;',
'layout(location=2) in vec4 joints;',
'layout(location=3) in vec4 weights;',
'layout(location=4) in vec3 horror;',
'uniform mat4 proj,view,model,bones[24];',
'uniform float morph;',
'out vec3 vNormal;out vec3 vPoint;',
'void main(){',
'  ivec4 j=ivec4(joints+.5);',
'  mat4 skin=bones[clamp(j.x,0,23)]*weights.x+bones[clamp(j.y,0,23)]*weights.y+',
'    bones[clamp(j.z,0,23)]*weights.z+bones[clamp(j.w,0,23)]*weights.w;',
'  vec4 p=model*skin*vec4(position+horror*morph,1.);',
'  vPoint=p.xyz;vNormal=normalize(mat3(model*skin)*normal);',
'  gl_Position=proj*view*p;',
'}'
].join('\n');
const shaderFragment=[
'#version 300 es','precision highp float;',
'in vec3 vNormal,vPoint;uniform vec4 colorBase;',
'uniform vec3 eye;uniform float clock,morph,rage;',
'uniform int role;out vec4 color;',
'void main(){',
'  vec3 n=normalize(vNormal),l=normalize(vec3(-.48,.84,-.38));',
'  float diffuse=.22+.73*max(0.,dot(n,l));',
'  float rim=pow(1.-abs(dot(n,normalize(eye-vPoint))),2.)*.2;',
'  vec3 c=colorBase.rgb*(diffuse+rim);',
'  if(role==1){c=mix(c,vec3(1.,.022,.018)*(1.+.19*sin(clock*9.)),rage);c+=vec3(.15,.02,.02)*morph;}',
'  else if(role==2)c+=vec3(.12,.08,.017);',
'  else if(role==3)c=mix(c,vec3(.43,.045,.085),morph*.45);',
'  c=mix(c,vec3(.052,.048,.08),clamp((length(vPoint-eye)-16.)/30.,0.,.23));',
'  color=vec4(c/(.84+c*.24),1.);',
'}'
].join('\n');
function multiply(a,b){
 const out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)
  out[c*4+r]+=a[k*4+r]*b[c*4+k];
 return out;
}
function trs(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){
 const [x,y,z,w]=q,[a,b,c]=s;
 return new Float32Array([
 (1-2*(y*y+z*z))*a,2*(x*y+z*w)*a,2*(x*z-y*w)*a,0,
 2*(x*y-z*w)*b,(1-2*(x*x+z*z))*b,2*(y*z+x*w)*b,0,
 2*(x*z+y*w)*c,2*(y*z-x*w)*c,(1-2*(x*x+y*y))*c,0,
 t[0],t[1],t[2],1]);
}
function slerp(a,b,t){
 let d=a.reduce((v,x,i)=>v+x*b[i],0);
 if(d<0){b=b.map(x=>-x);d=-d}
 if(d>.9995){const q=a.map((v,i)=>v+(b[i]-v)*t),n=Math.hypot(...q)||1;return q.map(x=>x/n)}
 const theta=Math.acos(Math.max(-1,Math.min(1,d))),den=Math.sin(theta);
 const u=Math.sin((1-t)*theta)/den,v=Math.sin(t*theta)/den;
 return a.map((x,i)=>x*u+b[i]*v);
}
function shader(gl,type,src){
 const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('CIRCUS_SHADER '+gl.getShaderInfoLog(sh));
 return sh;
}
function makeProgram(gl){
 const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,shaderVertex));
 gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,shaderFragment));
 gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('CIRCUS_LINK '+gl.getProgramInfoLog(p));
 const o={p};
 for(const k of ['proj','view','model','bones[0]','colorBase','eye','clock','morph','rage','role'])
  o[k]=gl.getUniformLocation(p,k);
 return o;
}
function read(id){
 const source=window.WYRDFLUX_REALM_ASSETS,size=Number(source?.size?.(id)||0);
 if(size<12000||size>25*1024*1024)throw Error('CIRCUS_MODEL_MISSING '+id+':'+size);
 const bytes=new Uint8Array(size);
 for(let off=0;off<size;){
  const piece=atob(source.readChunk(id,off,Math.min(192*1024,size-off)));
  if(piece.length<1)throw Error('CIRCUS_ASSET_READ '+id);
  for(let i=0;i<piece.length;i++)bytes[off+i]=piece.charCodeAt(i);
  off+=piece.length;
 }
 state.bytes+=size;return bytes;
}
function parse(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<24||dv.getUint32(0,true)!==0x46546c67||
  dv.getUint32(4,true)!==2)throw Error('CIRCUS_BAD_GLTF');
 const n=dv.getUint32(12,true),kind=dv.getUint32(16,true);
 if(kind!==0x4e4f534a)throw Error('CIRCUS_BAD_GLTF_JSON');
 const g=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+n)));
 const bin=20+n+8;
 if(dv.getUint32(20+n+4,true)!==0x004e4942)throw Error('CIRCUS_BAD_GLTF_BIN');
 const types={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
 const lengths={5121:1,5123:2,5125:4,5126:4};
 const cache=new Map();
 // Blender 5.2 stores expression morph deltas as sparse glTF 2.0 accessors.
 // Read their zero-filled base and sparse overrides rather than discarding
 // the complete, properly rigged Unreal-origin mesh at load time.
 function acc(i){
  if(i==null)return null;
  if(cache.has(i))return cache.get(i);
  const a=g.accessors?.[i];
  if(!a||!types[a.type]||!lengths[a.componentType]||!Number.isInteger(a.count)||
     a.count<0||a.count>1500000)throw Error('CIRCUS_ACCESSOR_UNSUPPORTED '+i);
  const sz=lengths[a.componentType],cols=types[a.type],
   out=new Float32Array(a.count*cols),v=a.bufferView==null?null:g.bufferViews?.[a.bufferView];
  if(a.bufferView!=null&&!v)throw Error('CIRCUS_ACCESSOR_MISSING_BASE '+i);
  function number(p){
   const t=a.componentType,x=t===5126?dv.getFloat32(p,true):t===5125?dv.getUint32(p,true):
      t===5123?dv.getUint16(p,true):dv.getUint8(p);
   if(!a.normalized)return x;return t===5123?x/65535:t===5121?x/255:x;
  }
  if(v){
   const stride=v.byteStride||cols*sz,off=bin+(v.byteOffset||0)+(a.byteOffset||0);
   for(let j=0;j<a.count;j++)for(let k=0;k<cols;k++)
    out[j*cols+k]=number(off+j*stride+k*sz);
  }
  if(a.sparse){
   const s=a.sparse,iv=g.bufferViews?.[s.indices?.bufferView],
    vv=g.bufferViews?.[s.values?.bufferView],it=s.indices?.componentType;
   const il=lengths[it];
   if(!iv||!vv||![5121,5123,5125].includes(it)||!Number.isInteger(s.count)||
     s.count<0||s.count>a.count)throw Error('CIRCUS_SPARSE_INVALID '+i);
   const io=bin+(iv.byteOffset||0)+(s.indices.byteOffset||0),
    vo=bin+(vv.byteOffset||0)+(s.values.byteOffset||0),
    vStride=vv.byteStride||cols*sz,iStride=iv.byteStride||il;
   for(let j=0;j<s.count;j++){
    const ip=io+j*iStride,ix=it===5125?dv.getUint32(ip,true):
      it===5123?dv.getUint16(ip,true):dv.getUint8(ip);
    if(ix>=a.count)throw Error('CIRCUS_SPARSE_OUT_OF_RANGE '+i);
    for(let k=0;k<cols;k++)out[ix*cols+k]=number(vo+j*vStride+k*sz);
   }
  }
  cache.set(i,out);return out;
 }
 return {g,acc};
}
function parseModel(gl,data,index){
 const {g,acc}=parse(data),nodes=g.nodes||[],skin=g.skins?.[0];
 if(!skin||skin.joints.length<12||skin.joints.length>MAX_BONES)
  throw Error('CIRCUS_REAL_SKIN_REQUIRED '+index);
 const inv=acc(skin.inverseBindMatrices);
 if(!inv||inv.length!==skin.joints.length*16)throw Error('CIRCUS_INVERSE_BIND_REQUIRED');
 const parents=nodes.map(()=>-1);
 nodes.forEach((n,i)=>(n.children||[]).forEach(j=>parents[j]=i));
 const base=nodes.map(n=>({t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1],
  s:n.scale||[1,1,1],m:n.matrix||null}));
 const clips={};
 for(const animation of g.animations||[]){
  const name=animation.name?.toLowerCase()||'',
   kind=name.includes('idle')?'idle':name.includes('dance')?'dance':
    name.includes('reveal')?'reveal':name.includes('hunt')?'hunt':null;
  if(!kind)continue;
  const tracks=[];
  for(const ch of animation.channels||[]){
   const sampler=animation.samplers?.[ch.sampler],to=ch.target;
   if(!sampler||!to||to.node==null||!['translation','rotation','scale'].includes(to.path))continue;
   tracks.push({node:to.node,path:to.path,
    times:acc(sampler.input),values:acc(sampler.output),
    cubic:sampler.interpolation==='CUBICSPLINE',size:to.path==='rotation'?4:3});
  }
  if(tracks.length)clips[kind]={tracks,duration:Math.max(.001,...tracks.map(a=>a.times[a.times.length-1]||0))};
 }
 for(const key of ['idle','dance','reveal','hunt'])
  if(!clips[key])throw Error('CIRCUS_BLENDER_NLA_CLIP_MISSING '+index+'_'+key);
 const buckets=new Map();
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i],mesh=g.meshes?.[node.mesh];
  if(!mesh||node.skin==null)continue;
  for(const prim of mesh.primitives||[]){
   const a=prim.attributes||{};
   if(a.POSITION==null||a.JOINTS_0==null||a.WEIGHTS_0==null)
    throw Error('CIRCUS_BLENDER_UNSKINNED_MESH '+(node.name||i));
   const pos=acc(a.POSITION),normal=acc(a.NORMAL),joints=acc(a.JOINTS_0),
    weights=acc(a.WEIGHTS_0),indices=acc(prim.indices),morph=acc(prim.targets?.[0]?.POSITION),
    material=prim.material??0,m=g.materials?.[material],name=(m?.name||'').toLowerCase();
   const role=/iris|red rage|eye/.test(name)?1:/brass|bell|buckles|_trim/.test(name)?2:/velvet|silk|_costume/.test(name)?3:0;
   const key=String(material);
   const batch=buckets.get(key)||{role,color:m?.pbrMetallicRoughness?.baseColorFactor||[.6,.35,.5,1],data:[]};
   buckets.set(key,batch);
   const count=indices?.length||pos.length/3;
   for(let k=0;k<count;k++){
    const n=indices?indices[k]:k,off=n*3,j=n*4,
     weightSum=(weights[j]+weights[j+1]+weights[j+2]+weights[j+3])||1;
    batch.data.push(pos[off],pos[off+1],pos[off+2],
     normal?.[off]||0,normal?.[off+1]??1,normal?.[off+2]||0,
     joints[j],joints[j+1],joints[j+2],joints[j+3],
     weights[j]/weightSum,weights[j+1]/weightSum,weights[j+2]/weightSum,weights[j+3]/weightSum,
     morph?.[off]||0,morph?.[off+1]||0,morph?.[off+2]||0);
   }
  }
 }
 const batches=[];
 for(const b of buckets.values()){
  const vao=gl.createVertexArray(),buf=gl.createBuffer(),verts=new Float32Array(b.data);
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);
  for(const [loc,count,offset] of [[0,3,0],[1,3,12],[2,4,24],[3,4,40],[4,3,56]]){
   gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,count,gl.FLOAT,false,68,offset);
  }
  batches.push({vao,buf,count:verts.length/17,color:b.color,role:b.role});
 }
 gl.bindVertexArray(null);
 if(batches.length<3)throw Error('CIRCUS_NO_SCULPTED_PARTS');
 state.triangles+=batches.reduce((n,b)=>n+b.count/3,0);
 state.bones+=skin.joints.length;
 state.clips.push({actor:index,names:Object.keys(clips)});
 return {nodes,parents,base,skin,inv,clips,batches,rootIndex:nodes.findIndex(n=>n.name==='root')};
}
function frame(track,time){
 const {times,values,size,cubic}=track;
 const frames=times.length;
 if(frames===0)return null;
 let i=0;
 while(i<frames-2&&times[i+1]<time)i++;
 const t1=times[i],t2=times[Math.min(frames-1,i+1)],
  d=Math.max(.00001,t2-t1),f=Math.max(0,Math.min(1,(time-t1)/d)),
  x=(i*(cubic?3:1)+(cubic?1:0))*size,
  y=(Math.min(frames-1,i+1)*(cubic?3:1)+(cubic?1:0))*size;
 const a=Array.from(values.slice(x,x+size)),b=Array.from(values.slice(y,y+size));
 return track.path==='rotation'?slerp(a,b,f):a.map((v,k)=>v+(b[k]-v)*f);
}
// Time-continuous skeletal sampling; blend source and destination actions
// in joint TRS space rather than matrix interpolation (which shears limbs).
function poseAt(model,mode,elapsed){
 const action=model.clips[mode],t=mode==='reveal'?Math.min(elapsed,action.duration):
   elapsed%action.duration,pose=model.base.map(p=>({...p}));
 for(const track of action.tracks){
  // World facing is authoritative. Avoid double yaw/teleport or an inverted body.
  if((mode==='reveal'||mode==='hunt')&&track.node===model.rootIndex&&track.path==='rotation')continue;
  const v=frame(track,t);
  if(v)pose[track.node][track.path==='rotation'?'r':
    track.path==='translation'?'t':'s']=v;
 }
 return pose;
}
function palette(model,mode,elapsed,previous=null,previousElapsed=0,blend=1){
 const pose=poseAt(model,mode,elapsed);
 if(previous&&model.clips[previous]&&blend<1){
  const from=poseAt(model,previous,previousElapsed),mix=Math.max(0,Math.min(1,blend));
  const lerp=(a,b)=>a.map((v,i)=>v+(b[i]-v)*mix);
  for(let i=0;i<pose.length;i++){
   if(pose[i].m||from[i].m)continue;
   pose[i].r=slerp(from[i].r,pose[i].r,mix);
   pose[i].t=lerp(from[i].t,pose[i].t);
   pose[i].s=lerp(from[i].s,pose[i].s);
  }
 }
 const matrices=[];
 function global(i){
  if(matrices[i])return matrices[i];
  const n=pose[i],local=n.m?new Float32Array(n.m):trs(n.t,n.r,n.s),p=model.parents[i];
  return matrices[i]=p<0?local:multiply(global(p),local);
 }
 const out=new Float32Array(MAX_BONES*16);
 for(let i=0;i<MAX_BONES;i++)out.set(ID,i*16);
 model.skin.joints.forEach((id,i)=>{
  out.set(multiply(global(id),model.inv.slice(i*16,i*16+16)),i*16);
 });
 return out;
}
// Weak keys follow actual enemy actors and vanish when they die/reset.
const animationTransitions=new WeakMap();
function transitionFor(actor,mode,clock,now){
 let transition=animationTransitions.get(actor);
 if(!transition){
  transition={mode,from:null,fromClock:0,lastClock:clock,started:now};
 }else if(transition.mode!==mode){
  transition={mode,from:transition.mode,fromClock:transition.lastClock,
   lastClock:clock,started:now};
 }else transition.lastClock=clock;
 animationTransitions.set(actor,transition);
 const elapsed=Math.max(0,now-transition.started);
 const blend=Math.min(1,elapsed/.23);
 return {previous:blend<1?transition.from:null,
  previousElapsed:transition.fromClock+elapsed,blend};
}

let uniforms=null;
function load(gl){
 if(state.status==='ready')return true;
 if(state.status==='failed')return false;
 try{
  state.status='loading';uniforms=makeProgram(gl);
  state.models=[0,1,2,3].map(i=>parseModel(gl,read('circus'+i),i));
  state.status='ready';return true;
 }catch(e){
  state.status='failed';state.error=String(e?.message||e);
  console.error('WYRDFLUX_CIRCUS_RIGGED_GPU_FALLBACK',state.error);
  return false;
 }
}
// Blender -Y is the authored face front; the glTF Y-up conversion maps
// that direction to +Z. Stage backs face the approaching player at yaw=PI.
// Turn only about WORLD Y, never rotate the model or root bone upside-down.
function orientationYaw(e,eye,performance){
 const target=Math.atan2(eye[0]-e.x,eye[2]-e.z),back=target+Math.PI;
 if(e.boss&&e.circusEncore)return target+(e.circusSpin||0);
 if(performance==='waiting'||performance==='dance'||performance==='silence')return back;
 if(performance==='reveal'){
  const t=Math.max(0,Math.min(1,e.circusTurn||0));
  return back+Math.PI*t; // upright world-Y half turn; feet stay grounded
 }
 return target;
}
function draw(gl,proj,view,eye,time,actors,quality,performance){
 if(state.status!=='ready')return false;
 const visible=actors.filter(e=>e?.circusActor&&e.hp>0);
 state.draws=0;if(!visible.length)return true;
 gl.useProgram(uniforms.p);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 gl.uniformMatrix4fv(uniforms.proj,false,proj);
 gl.uniformMatrix4fv(uniforms.view,false,view);
 gl.uniform3fv(uniforms.eye,eye);
 gl.uniform1f(uniforms.clock,time);
 for(const e of visible){
  const m=state.models[e.circusKind|0];if(!m)continue;
  const mode=performance==='dance'?'dance':performance==='reveal'?'reveal':
   performance==='attack'?'hunt':'idle';
  const clock=mode==='reveal'?(e.circusTurn||0)*m.clips.reveal.duration:
   (e.circusClock||0)*(e.circusEnraged?1.38:1);
  const blend=transitionFor(e,mode,clock,time);
  gl.uniformMatrix4fv(uniforms['bones[0]'],false,
   palette(m,mode,clock,blend.previous,blend.previousElapsed,blend.blend));
  const scale=e.boss?1.31:1,yaw=orientationYaw(e,eye,performance);
  const actor=trs([e.x,Math.max(0,e.circusFloat||0),e.z],
   [0,Math.sin(yaw*.5),0,Math.cos(yaw*.5)],[scale,scale,scale]);
  gl.uniformMatrix4fv(uniforms.model,false,actor);
  gl.uniform1f(uniforms.morph,Math.max(0,Math.min(1,e.circusMorph||0)));
  gl.uniform1f(uniforms.rage,e.circusEnraged?1:0);
  for(const b of m.batches){
   gl.uniform4fv(uniforms.colorBase,b.color);
   gl.uniform1i(uniforms.role,b.role);
   gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.count);state.draws++;
  }
 }
 gl.bindVertexArray(null);gl.enable(gl.CULL_FACE);
 return true;
}
window.WYRDFLUX_CIRCUS_PUPPETS=Object.freeze({state,load,draw,orientationYaw});
})();