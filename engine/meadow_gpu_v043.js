/* AFTERLIGHT V0.43 — Native-quality optional textured meadow GPU scene in WebGL2.
 * Loaded only in the TEST MEADOW ARENA; current career meshes and saves untouched.
 * GLB stays local in APK, accessed by fixed-name read-only Java bridge so the
 * existing file:///android_asset/index.html origin (and localStorage) is kept.
 */
(()=>{'use strict';
const state={status:'idle',error:null,materials:[],batches:[],triangles:0,vertices:0,
  textures:0,draws:0,loadMs:0,source:'offline GLB',renderer:'independent textured WebGL2'};
function glShader(gl,type,src){
 const out=gl.createShader(type);gl.shaderSource(out,src);gl.compileShader(out);
 if(!gl.getShaderParameter(out,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(out));
 return out;
}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 pos; layout(location=1) in vec3 norm;
layout(location=2) in vec2 uv;
uniform mat4 proj,view;
uniform float clock,sway;
out vec3 pWorld,nWorld;out vec2 st;
void main(){
 vec3 p=pos;
 float tip=clamp(uv.y,0.,1.);
 p.x+=sway*tip*(sin(clock*1.2+pos.x*.77+pos.z*.46)+.28*sin(clock*2.3+pos.z));
 p.z+=sway*tip*.45*cos(clock*.8+pos.x*.34);
 pWorld=p; nWorld=norm;st=uv;
 gl_Position=proj*view*vec4(p,1.);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 pWorld,nWorld;in vec2 st;
uniform sampler2D baseMap,normalMap,roughMap;
uniform bool hasBase,hasNormal,hasRough;
uniform vec4 factor;
uniform vec3 eye;
uniform float clock;
out vec4 color;
void main(){
 vec4 surface=hasBase?texture(baseMap,st):vec4(1.);
 surface*=factor;
 if(surface.a<.21)discard;
 vec3 n=normalize(nWorld);
 if(hasNormal){
   vec3 mapNorm=texture(normalMap,st).xyz*2.-1.;
   vec3 a=dFdx(pWorld),b=dFdy(pWorld);
   vec2 u=dFdx(st),v=dFdy(st);
   vec3 t=normalize(a*v.y-b*u.y);
   t=normalize(t-n*dot(t,n));
   vec3 bt=normalize(cross(n,t));
   vec3 candidate=normalize(mat3(t,bt,n)*mapNorm);
   if(length(candidate)>0.5)n=normalize(mix(n,candidate,.57));
 }
 float rough=hasRough?texture(roughMap,st).g:.73;
 rough=clamp(rough,.17,.97);
 vec3 sun=normalize(vec3(-.42,.86,-.28));
 vec3 v=normalize(eye-pWorld);
 float diffuse=max(0.,dot(n,sun));
 float ambient=.49+.13*max(n.y,0.);
 vec3 rgb=surface.rgb*(ambient+diffuse*.73);
 vec3 h=normalize(sun+v);
 float spec=pow(max(dot(n,h),0.),mix(78.,9.,rough))*(1.-rough)*.31;
 rgb+=spec*vec3(1.,.94,.78);
 float moss=1.-smoothstep(.40,.8,rough);
 rgb+=moss*.015*surface.rgb;
 float dist=length(pWorld-eye);
 float fog=clamp(1.-exp(-pow(dist*.020,1.50)),0.,.62);
 rgb=mix(rgb,vec3(.59,.72,.79),fog);
 rgb=rgb/(vec3(.80)+rgb*.35);
 color=vec4(pow(max(rgb,vec3(0.)),vec3(.92)),1.);
}`;
function program(gl){const p=gl.createProgram();
 gl.attachShader(p,glShader(gl,gl.VERTEX_SHADER,VS));
 gl.attachShader(p,glShader(gl,gl.FRAGMENT_SHADER,FS));
 gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
 return {p,proj:gl.getUniformLocation(p,'proj'),view:gl.getUniformLocation(p,'view'),
 eye:gl.getUniformLocation(p,'eye'),clock:gl.getUniformLocation(p,'clock'),
 sway:gl.getUniformLocation(p,'sway'),factor:gl.getUniformLocation(p,'factor'),
 hasBase:gl.getUniformLocation(p,'hasBase'),hasNormal:gl.getUniformLocation(p,'hasNormal'),
 hasRough:gl.getUniformLocation(p,'hasRough')};
}
function mul(a,b){const o=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)
   for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];
 return o;
}
function localMat(n){
 if(n.matrix)return new Float32Array(n.matrix);
 const t=n.translation||[0,0,0],q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1];
 const [x,y,z,w]=q; const [sx,sy,sz]=s;
 return new Float32Array([
  (1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,
  2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
  2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,
  t[0],t[1],t[2],1
 ]);
}
function byteReader(binary,gltf,binPos){
 const views=gltf.bufferViews||[],acc=gltf.accessors||[];
 const sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const bytesPer={5121:1,5123:2,5125:4,5126:4};
 const dv=new DataView(binary.buffer,binary.byteOffset,binary.byteLength);
 const cache=new Map();
 return function get(i){
  if(i==null)return null;
  if(cache.has(i))return cache.get(i);
  const a=acc[i],bv=views[a.bufferView];
  if(!a||!bv||!sizes[a.type]||!bytesPer[a.componentType]||a.sparse)
    throw Error('Unsupported GLB accessor '+i);
  const n=sizes[a.type],s=bytesPer[a.componentType],stride=bv.byteStride||n*s;
  const start=binPos+(bv.byteOffset||0)+(a.byteOffset||0);
  const arr=new Float32Array(a.count*n);
  const read=(offset)=>a.componentType===5126?dv.getFloat32(offset,true):
      a.componentType===5125?dv.getUint32(offset,true):
      a.componentType===5123?dv.getUint16(offset,true):dv.getUint8(offset);
  for(let k=0;k<a.count;k++)for(let d=0;d<n;d++)
     arr[k*n+d]=read(start+k*stride+d*s);
  cache.set(i,arr);return arr;
 };
}
function loadImage(gl,binary,g,binPos,textureIndex){
 const t=g.textures?.[textureIndex];
 const im=t&&g.images?.[t.source];
 if(!im||im.bufferView==null)return null;
 const view=g.bufferViews[im.bufferView];
 if(!view)return null;
 const raw=binary.slice(binPos+(view.byteOffset||0),
       binPos+(view.byteOffset||0)+view.byteLength);
 const uri=URL.createObjectURL(new Blob([raw],{type:im.mimeType||'image/png'}));
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([235,236,226,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 const img=new Image();
 img.onload=()=>{
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  URL.revokeObjectURL(uri);state.textures++;
 };
 img.onerror=()=>URL.revokeObjectURL(uri);
 img.src=uri;
 return tex;
}
function convertGLB(gl,binary) {
 const t0=performance.now();
 const dv=new DataView(binary.buffer);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw Error('Invalid GLB header');
 const jsonLen=dv.getUint32(12,true);
 if(dv.getUint32(16,true)!==0x4e4f534a)throw Error('No GLB JSON chunk');
 const g=JSON.parse(new TextDecoder().decode(binary.subarray(20,20+jsonLen)));
 const binHeader=20+jsonLen;
 if(dv.getUint32(binHeader+4,true)!==0x004e4942)throw Error('No GLB binary chunk');
 const binPos=binHeader+8;
 const accessor=byteReader(binary,g,binPos);
 const buckets=new Map();
 let cap=0;
 const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const scaling=30/72;
 function node(i,parent){
  const n=g.nodes[i];if(!n)return;
  const mat=mul(parent,localMat(n));
  if(n.mesh!=null){
   for(const prim of (g.meshes[n.mesh]?.primitives||[])){
    if(prim.mode!=null&&prim.mode!==4)continue;
    if(prim.attributes?.POSITION==null)continue;
    const pos=accessor(prim.attributes.POSITION);
    const nor=accessor(prim.attributes.NORMAL);
    const uv=accessor(prim.attributes.TEXCOORD_0);
    const ind=accessor(prim.indices);
    const count=ind?ind.length:pos.length/3;
    const m=prim.material==null?0:prim.material;
    let a=buckets.get(m);
    if(!a){a=[];buckets.set(m,a);}
    const vertexMax=1100000;
    if(cap>=vertexMax)continue;
    for(let j=0;j<count&&cap<vertexMax;j++){
      const k=ind?ind[j]:j,o=k*3,ut=k*2;
      const x=pos[o],y=pos[o+1],z=pos[o+2];
      const px=mat[0]*x+mat[4]*y+mat[8]*z+mat[12],
        py=mat[1]*x+mat[5]*y+mat[9]*z+mat[13],
        pz=mat[2]*x+mat[6]*y+mat[10]*z+mat[14];
      const nx=nor?mat[0]*nor[o]+mat[4]*nor[o+1]+mat[8]*nor[o+2]:0,
        ny=nor?mat[1]*nor[o]+mat[5]*nor[o+1]+mat[9]*nor[o+2]:1,
        nz=nor?mat[2]*nor[o]+mat[6]*nor[o+1]+mat[10]*nor[o+2]:0;
      const l=Math.hypot(nx,ny,nz)||1;
      a.push(15.5+px*scaling,py*scaling-.12,15.5+pz*scaling,
            nx/l,ny/l,nz/l,uv?uv[ut]:0,uv?uv[ut+1]:0);
      cap++;
    }
   }
  }
  for(const child of n.children||[])node(child,mat);
 }
 const scene=g.scenes?.[g.scene||0]||{nodes:g.nodes.map((_,i)=>i)};
 for(const root of scene.nodes||[])node(root,identity);
 if(cap<30000)throw Error('Meadow GLB has too little geometry: '+cap);
 state.materials=(g.materials||[]).map(m=>{
   const p=m.pbrMetallicRoughness||{};
   return {factor:p.baseColorFactor||[1,1,1,1],
     grass:/^MEADOW\\s*\\|/i.test(m.name||''),
     base:p.baseColorTexture?loadImage(gl,binary,g,binPos,p.baseColorTexture.index):null,
     rough:p.metallicRoughnessTexture?loadImage(gl,binary,g,binPos,p.metallicRoughnessTexture.index):null,
     normal:m.normalTexture?loadImage(gl,binary,g,binPos,m.normalTexture.index):null};
 });
 state.batches=[];
 for(const [mat,arr] of buckets){
    if(!arr.length)continue;
    const vao=gl.createVertexArray(),vbo=gl.createBuffer();
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);
    for(const [id,len,offset] of [[0,3,0],[1,3,3],[2,2,6]]){
      gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,len,gl.FLOAT,false,32,offset*4);
    }
    state.batches.push({vao,vbo,count:arr.length/8,material:mat});
 }
 gl.bindVertexArray(null);
 state.vertices=cap;state.triangles=Math.floor(cap/3);
 state.program=program(gl);state.loadMs=Math.round(performance.now()-t0);
 state.status='ready';
}
function load(gl){
 if(state.status==='ready'||state.status==='loading')return;
 state.status='loading';
 try{
   const bridge=window.VEILFORGE_ASSETS;
   if(!bridge||typeof bridge.readMeadowGLB!=='function')throw Error('Meadow APK asset bridge unavailable (desktop fallback active)');
   let binary;
   if(typeof bridge.meadowSize==='function'&&typeof bridge.readMeadowChunk==='function'){
     const count=bridge.meadowSize();
     if(count<30000||count>40*1024*1024)throw Error('Offline GLB missing or exceeds phone memory safety cap');
     binary=new Uint8Array(count);
     const chunk=192*1024;
     for(let offset=0;offset<count;offset+=chunk){
       const encoded=bridge.readMeadowChunk(offset,Math.min(chunk,count-offset));
       if(!encoded)throw Error('Offline GLB chunk missing at '+offset);
       const part=atob(encoded);
       for(let j=0;j<part.length;j++)binary[offset+j]=part.charCodeAt(j);
     }
   }else{
     const raw=bridge.readMeadowGLB();
     if(!raw||raw.length<50000)throw Error('Offline meadow GLB was not packaged');
     binary=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
   }
   convertGLB(gl,binary);
 }catch(e){state.status='fallback';state.error=String(e&&e.message||e);}
}
function draw(gl,projection,view,eye,clock){
 if(state.status!=='ready')return false;
 const sh=state.program;
 gl.useProgram(sh.p);
 gl.uniformMatrix4fv(sh.proj,false,projection);
 gl.uniformMatrix4fv(sh.view,false,view);
 gl.uniform3f(sh.eye,eye[0],eye[1],eye[2]);
 gl.uniform1f(sh.clock,clock);
 gl.uniform1i(gl.getUniformLocation(sh.p,'baseMap'),0);
 gl.uniform1i(gl.getUniformLocation(sh.p,'normalMap'),1);
 gl.uniform1i(gl.getUniformLocation(sh.p,'roughMap'),2);
 gl.disable(gl.CULL_FACE);
 state.draws=0;
 for(const b of state.batches){
   const m=state.materials[b.material]||{factor:[1,1,1,1]};
   gl.uniform4fv(sh.factor,m.factor);
   gl.uniform1f(sh.sway,m.grass?.035:0.);
   gl.uniform1i(sh.hasBase,m.base?1:0);
   gl.uniform1i(sh.hasNormal,m.normal?1:0);
   gl.uniform1i(sh.hasRough,m.rough?1:0);
   for(const [slot,texture] of [[0,m.base],[1,m.normal],[2,m.rough]]){
     gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture||null);
   }
   gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.count);state.draws++;
 }
 gl.bindVertexArray(null);
 gl.enable(gl.CULL_FACE);
 return true;
}
window.VEILFORGE_MEADOW_GPU={state,load,draw};
})();