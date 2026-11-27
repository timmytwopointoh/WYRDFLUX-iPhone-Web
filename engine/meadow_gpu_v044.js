/* AFTERLIGHT V0.44 — Native-quality optional textured meadow GPU scene in WebGL2.
 * Loaded only in the TEST MEADOW ARENA; current career meshes and saves untouched.
 * GLB stays local in APK, accessed by fixed-name read-only Java bridge so the
 * existing file:///android_asset/index.html origin (and localStorage) is kept.
 */
(()=>{'use strict';
const state={status:'idle',error:null,materials:[],batches:[],triangles:0,vertices:0,
  textures:0,draws:0,loadMs:0,monster:'idle',actorBatches:[],actorMaterials:[],actorTriangles:0,terrainHeight:[],sceneRole:'meadow',source:'offline GLB',renderer:'independent textured WebGL2'};
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
uniform bool isActor;
uniform vec3 actorPos;
uniform float actorScale,actorYaw,walkPhase;
uniform float actorAttack,actorStride;
uniform int actorPart;
out vec3 pWorld,nWorld;out vec2 st;
void main(){
 vec3 p=pos;
 vec3 n=norm;
 if(isActor){
   float phase=sin(walkPhase);
   float gait=clamp(actorStride,0.,1.);
   float strike=clamp(actorAttack,0.,1.);
   float flex=actorPart==3?phase*.52*gait+strike*.36:actorPart==4?-phase*.52*gait-strike*.28:
              actorPart==5?-phase*.48*gait:actorPart==6?phase*.48*gait:0.0;
   if(actorPart==3||actorPart==4){
     vec3 pivot=vec3(actorPart==3?-.35:.35,.90,0.0);
     p-=pivot;
     p.yz=mat2(cos(flex),-sin(flex),sin(flex),cos(flex))*p.yz;
     p+=pivot;p.z-=strike*.12;
   }else if(actorPart==5||actorPart==6){
     vec3 pivot=vec3(actorPart==5?-.17:.17,.45,0.);
     p-=pivot;
     p.yz=mat2(cos(flex),-sin(flex),sin(flex),cos(flex))*p.yz;
     p+=pivot;
   }else if(actorPart==2){
     p.x+=sin(walkPhase*.48)*.024+p.x*strike*.028;
     p.y+=sin(walkPhase*.69)*.012-strike*.034;
     p.z-=strike*.060;
   }else if(actorPart==7){
     p.x+=sin(walkPhase*.74+pos.y*4.)*(.075+strike*.025);
   }
   p.y+=.015*sin(walkPhase*1.2)+gait*.018*sin(walkPhase*2.0)-strike*.019;
   p*=actorScale;
   float co=cos(actorYaw),si=sin(actorYaw);
   p=vec3(p.x*co-p.z*si,p.y,p.x*si+p.z*co)+actorPos;
   n=normalize(vec3(n.x*co-n.z*si,n.y,n.x*si+n.z*co));
 }else{
   float tip=clamp(uv.y,0.,1.);
   p.x+=sway*tip*(sin(clock*1.2+pos.x*.77+pos.z*.46)+.28*sin(clock*2.3+pos.z));
   p.z+=sway*tip*.45*cos(clock*.8+pos.x*.34);
 }
 pWorld=p; nWorld=n;st=uv;
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
uniform int role;
uniform bool isActor;
uniform float actorPalette,actorDamage;
out vec4 color;
void main(){
 vec4 surface=hasBase?texture(baseMap,st):vec4(1.);
 surface*=factor;
 // The original full-scene 1k grassy scan looked beige on a sunlit phone.
 // Reproject its high-frequency photo detail through a saturated meadow tint.
 if(!isActor&&role==1){
   float l=dot(surface.rgb,vec3(.27,.64,.09));
   vec3 living=vec3(l*.40+.075,l*.74+.22,l*.28+.04);
   surface.rgb=mix(surface.rgb,living,.81);
 }
 if(!isActor&&role==2)surface.rgb=mix(surface.rgb,vec3(.26,.29,.13),.11);
 if(isActor){
   if(role==4)surface.rgb=mix(surface.rgb,vec3(.84,.15,.75),.20+actorPalette*.16);
   if(role==5)surface.rgb=mix(surface.rgb,vec3(.93,.87,.87),.20);
   if(actorDamage>.01)surface.rgb=mix(surface.rgb,vec3(1.0,.20,.35),min(.8,actorDamage));
 }
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
 float ambient=.60+.15*max(n.y,0.);
 vec3 rgb=surface.rgb*(ambient+diffuse*.82);
 vec3 h=normalize(sun+v);
 float spec=pow(max(dot(n,h),0.),mix(78.,9.,rough))*(1.-rough)*.31;
 rgb+=spec*vec3(1.,.94,.78);
 float moss=1.-smoothstep(.40,.8,rough);
 rgb+=moss*.015*surface.rgb;
 float dist=length(pWorld-eye);
 float fog=clamp(1.-exp(-pow(dist*.014,1.35)),0.,.40);
 rgb=mix(rgb,vec3(.67,.81,.89),fog);
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
 hasRough:gl.getUniformLocation(p,'hasRough'),
 isActor:gl.getUniformLocation(p,'isActor'),actorPos:gl.getUniformLocation(p,'actorPos'),
 actorScale:gl.getUniformLocation(p,'actorScale'),actorYaw:gl.getUniformLocation(p,'actorYaw'),
 walkPhase:gl.getUniformLocation(p,'walkPhase'),actorPart:gl.getUniformLocation(p,'actorPart'),
 actorAttack:gl.getUniformLocation(p,'actorAttack'),actorStride:gl.getUniformLocation(p,'actorStride'),
 role:gl.getUniformLocation(p,'role'),actorPalette:gl.getUniformLocation(p,'actorPalette'),
 actorDamage:gl.getUniformLocation(p,'actorDamage')};
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
 const terrainSum=new Float32Array(32*32),terrainCount=new Float32Array(32*32);
 let cap=0;
 // Surface collision is extracted from the SAME Blender GLB triangles used by
 // the GPU. Bridge planks are not a decoration the player can walk through.
 const namedBridgeTriangles=[],raisedWalkableTriangles=[];
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
    const name=(n.name||'')+' '+(g.meshes[n.mesh]?.name||'')+' '+(g.materials[m]?.name||'');
    const namedBridge=/bridge|footbridge|walkway|planks?|boardwalk|deck[_ ]/i.test(name);
    let triPoints=[];
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
      const wx=15.5+px*scaling,wy=py*scaling-.12,wz=15.5+pz*scaling;
      a.push(wx,wy,wz,nx/l,ny/l,nz/l,uv?uv[ut]:0,uv?uv[ut+1]:0);
      triPoints.push([wx,wy,wz,ny/l]);
      if(triPoints.length===3){
       const p=triPoints;triPoints=[];
       const up=(p[0][3]+p[1][3]+p[2][3])/3;
       const maxY=Math.max(p[0][1],p[1][1],p[2][1]);
       const minY=Math.min(p[0][1],p[1][1],p[2][1]);
       if(up>.54&&maxY>0.045&&minY<2.6){
        const flat=p.flatMap(v=>v.slice(0,3));
        if(namedBridge&&namedBridgeTriangles.length<28000)namedBridgeTriangles.push(flat);
        else if(!namedBridge&&raisedWalkableTriangles.length<48000)
         raisedWalkableTriangles.push(flat);
       }
      }
      if(/ground.*sculpt|sculpt.*bank|ground/i.test(n.name||'')){
        const tx=Math.round(wx),tz=Math.round(wz);
        if(tx>=0&&tx<32&&tz>=0&&tz<32){
          const index=tz*32+tx;terrainSum[index]+=wy;terrainCount[index]++;
        }
      }
      cap++;
    }
   }
  }
  for(const child of n.children||[])node(child,mat);
 }
 const scene=g.scenes?.[g.scene||0]||{nodes:g.nodes.map((_,i)=>i)};
 for(const root of scene.nodes||[])node(root,identity);
 if(cap<30000)throw Error('Meadow GLB has too little geometry: '+cap);
 let avgH=0,numH=0;
 for(let i=0;i<terrainSum.length;i++)if(terrainCount[i]>0){
    terrainSum[i]/=terrainCount[i];avgH+=terrainSum[i];numH++;
 }
 avgH=numH?avgH/numH:0;
 for(let z=0;z<32;z++)for(let x=0;x<32;x++){
   const i=z*32+x;
   if(terrainCount[i]>0)continue;
   let best=Infinity,near=avgH;
   for(let k=0;k<1024;k++){
     if(terrainCount[k]<=0)continue;
     const dx=x-(k%32),dz=z-Math.floor(k/32),d=dx*dx+dz*dz;
     if(d<best){best=d;near=terrainSum[k];}
   }
   terrainSum[i]=near;
 }
 state.terrainHeight=Array.from(terrainSum);
 state.terrainSampleCount=numH;
 // Rasterize elevated Blender walkable faces into a quarter-meter collision
 // grid. This uses actual mesh positions and barycentric triangle heights,
 // rather than guessed bridge rectangles or a visual-only water crossing.
 const side=125,grid=new Float32Array(side*side).fill(-999);
 let bridgeTriangles=0,bridgeCells=0;
 const getTerrain=(x,z)=>{
  const ix=Math.max(0,Math.min(30,Math.floor(x))),
   iz=Math.max(0,Math.min(30,Math.floor(z))),fx=x-ix,fz=z-iz;
  const q=(a,b)=>terrainSum[Math.min(31,b)*32+Math.min(31,a)]||0;
  return q(ix,iz)*(1-fx)*(1-fz)+q(ix+1,iz)*fx*(1-fz)+
   q(ix,iz+1)*(1-fx)*fz+q(ix+1,iz+1)*fx*fz;
 };
 const rasterize=list=>{
  for(const tri of list){
   const [ax,ay,az,bx,by,bz,cx,cy,cz]=tri;
   const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
   if(Math.abs(det)<.000012)continue;
   const lx=Math.max(2,Math.floor(Math.min(ax,bx,cx)*4)),
    hx=Math.min(122,Math.ceil(Math.max(ax,bx,cx)*4)),
    lz=Math.max(2,Math.floor(Math.min(az,bz,cz)*4)),
    hz=Math.min(122,Math.ceil(Math.max(az,bz,cz)*4));
   if(hx<lx||hz<lz)continue;
   bridgeTriangles++;
   for(let j=lz;j<=hz;j++)for(let i=lx;i<=hx;i++){
    const x=i*.25,z=j*.25;
    const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,
     v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,w=1-u-v;
    if(u<-.001||v<-.001||w<-.001)continue;
    const y=u*ay+v*by+w*cy,ground=getTerrain(x,z);
    if(y>ground+.055&&y<ground+2.25&&y>grid[j*side+i])
     grid[j*side+i]=y;
   }
  }
 };
 // Prefer named Blender bridge pieces. If the asset exporter stripped names,
 // inspect all elevated faces so the walkable platform still has a floor.
 rasterize(namedBridgeTriangles.length?namedBridgeTriangles:raisedWalkableTriangles);
 for(let i=0;i<grid.length;i++)if(grid[i]>-900)bridgeCells++;
 state.bridgeHeightGrid=grid;state.bridgeGridSide=side;
 state.bridgeSurfaceSamples=bridgeCells;
 state.bridgeTriangleCount=bridgeTriangles;
 state.bridgeColliderSource=namedBridgeTriangles.length?'named Blender bridge':'raised GLB walkable triangles';
 state.materials=(g.materials||[]).map(m=>{
   const p=m.pbrMetallicRoughness||{};
   return {name:m.name||'',factor:p.baseColorFactor||[1,1,1,1],
     // Only move actual grass/reeds, never the terrain mesh or wooden bridge.
      grass:/(?:grass(?:[_ -]?blades?)?|reeds?|foliage|leaves)/i.test(m.name||'')&&
        !/(?:ground|terrain|soil|creek|river|water|bridge|rock|bank|path)/i.test(m.name||''),
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

// ACTUAL Blender cat-fiend PBR geometry. Geometry is only uploaded once; pose,
// yaw, scale, damage flash, and palette are uniforms applied per enemy instance.
function heightAt(x,z){
 const h=state.terrainHeight;
 if(!h||h.length!==1024)return 0;
 const px=Math.min(30.999,Math.max(.001,x)),pz=Math.min(30.999,Math.max(.001,z));
 const ix=Math.floor(px),iz=Math.floor(pz);
 const fx=px-ix,fz=pz-iz;
 const q=(i,j)=>h[Math.min(31,j)*32+Math.min(31,i)]||0;
 const ground=q(ix,iz)*(1-fx)*(1-fz)+q(ix+1,iz)*fx*(1-fz)+
        q(ix,iz+1)*(1-fx)*fz+q(ix+1,iz+1)*fx*fz;
 const grid=state.bridgeHeightGrid,side=state.bridgeGridSide||0;
 if(!grid||!side)return ground;
 const i=Math.max(0,Math.min(side-1,Math.round(px*4))),
  j=Math.max(0,Math.min(side-1,Math.round(pz*4)));
 // Small patch averaging prevents stepping through plank seams at the edge
 // of adjacent triangles; bridge support cannot change non-meadow maps.
 let deck=-999;
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const col=i+dx,row=j+dz;
  if(col>=0&&col<side&&row>=0&&row<side)
   deck=Math.max(deck,grid[row*side+col]);
 }
 return deck>ground+.055?deck:ground;
}
function loadMonster(gl){
 const bridge=window.VEILFORGE_ASSETS;
 if(!bridge||typeof bridge.monsterSize!=='function')throw Error('Blender cat-fiend asset bridge missing');
 const n=bridge.monsterSize();
 if(n<5000||n>12*1024*1024)throw Error('Blender cat-fiend file missing or exceeds safety cap');
 const binary=new Uint8Array(n);
 const chunk=192*1024;
 for(let offset=0;offset<n;offset+=chunk){
    const b64=bridge.readMonsterChunk(offset,Math.min(chunk,n-offset));
    if(!b64)throw Error('Blender fiend asset chunk missing '+offset);
    const block=atob(b64);
    for(let j=0;j<block.length;j++)binary[offset+j]=block.charCodeAt(j);
 }
 const dv=new DataView(binary.buffer);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw Error('Invalid cat-fiend GLB header');
 const jsonLen=dv.getUint32(12,true);
 const g=JSON.parse(new TextDecoder().decode(binary.subarray(20,20+jsonLen)));
 const binChunk=20+jsonLen,binPos=binChunk+8;
 if(dv.getUint32(binChunk+4,true)!==0x004e4942)throw Error('Blender cat-fiend binary data missing');
 const accessor=byteReader(binary,g,binPos);
 const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const buckets=new Map();
 let vertexTotal=0;
 function jointGroup(name){
   if(name.startsWith('ARM_L'))return 3;
   if(name.startsWith('ARM_R'))return 4;
   if(name.startsWith('LEG_L'))return 5;
   if(name.startsWith('LEG_R'))return 6;
   if(name.startsWith('TAIL'))return 7;
   if(name.startsWith('HEAD'))return 2;
   return 0;
 }
 function node(i,parent){
    const n=g.nodes[i];if(!n)return;
    const m=mul(parent,localMat(n));
    if(n.mesh!=null){
       for(const prim of (g.meshes[n.mesh]?.primitives||[])){
          if(prim.mode!=null&&prim.mode!==4)continue;
          if(prim.attributes?.POSITION==null)continue;
          const p=accessor(prim.attributes.POSITION);
          const norm=accessor(prim.attributes.NORMAL);
          const uv=accessor(prim.attributes.TEXCOORD_0);
          const idx=accessor(prim.indices);
          const count=idx?idx.length:p.length/3,material=prim.material||0,group=jointGroup(n.name||'');
          const key=material+'|'+group;
          let v=buckets.get(key);
          if(!v){v=[];buckets.set(key,v);}
          for(let j=0;j<count;j++){
             const k=idx?idx[j]:j,o=k*3,t=k*2;
             const x=p[o],y=p[o+1],z=p[o+2];
             const px=m[0]*x+m[4]*y+m[8]*z+m[12],
                   py=m[1]*x+m[5]*y+m[9]*z+m[13],
                   pz=m[2]*x+m[6]*y+m[10]*z+m[14];
             const nx=norm?m[0]*norm[o]+m[4]*norm[o+1]+m[8]*norm[o+2]:0,
                   ny=norm?m[1]*norm[o]+m[5]*norm[o+1]+m[9]*norm[o+2]:1,
                   nz=norm?m[2]*norm[o]+m[6]*norm[o+1]+m[10]*norm[o+2]:0;
             const len=Math.hypot(nx,ny,nz)||1;
             v.push(px,py,pz,nx/len,ny/len,nz/len,uv?uv[t]:0,uv?uv[t+1]:0);
             vertexTotal++;
          }
       }
    }
    for(const child of n.children||[])node(child,m);
 }
 const scene=g.scenes?.[g.scene||0]||{nodes:g.nodes.map((_,i)=>i)};
 for(const i of scene.nodes||[])node(i,identity);
 if(vertexTotal<3000)throw Error('Cat-fiend sculpt lacks modeled polygons');
 state.actorMaterials=(g.materials||[]).map(m=>{
   const p=m.pbrMetallicRoughness||{},name=m.name||'';
   return {name,factor:p.baseColorFactor||[1,1,1,1],
    role:/purple|organza|lavender|tutu|skirt/i.test(name)?4:
         /porcelain|skin/i.test(name)?5:0,
    base:p.baseColorTexture?loadImage(gl,binary,g,binPos,p.baseColorTexture.index):null,
    rough:p.metallicRoughnessTexture?loadImage(gl,binary,g,binPos,p.metallicRoughnessTexture.index):null,
    normal:m.normalTexture?loadImage(gl,binary,g,binPos,m.normalTexture.index):null};
 });
 state.actorBatches=[];
 for(const [key,arr] of buckets){
   if(!arr.length)continue;
   const [material,part]=key.split('|').map(Number);
   const vao=gl.createVertexArray(),vbo=gl.createBuffer();
   gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);
   for(const [id,num,offset] of [[0,3,0],[1,3,3],[2,2,6]]){
      gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,num,gl.FLOAT,false,32,offset*4);
   }
   state.actorBatches.push({vao,vbo,count:arr.length/8,material,part});
 }
 gl.bindVertexArray(null);
 state.actorTriangles=Math.round(vertexTotal/3);
 state.monster='ready';
 console.info('AFTERLIGHT_V044_BLENDER_CATFIEND_REAL_3D_READY',
              state.actorTriangles,state.actorBatches.length);
}
function beginMonster(gl){
 if(state.monster==='ready'||state.monster==='loading')return;
 state.monster='loading';
 try{loadMonster(gl);}catch(e){
    state.monster='fallback';
    state.monsterError=String(e?.message||e);
    console.warn('AFTERLIGHT_V044_CATFIEND_IMPORT_ERROR',state.monsterError);
 }
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
   setTimeout(()=>beginMonster(gl),300);
 }catch(e){state.status='fallback';state.error=String(e&&e.message||e);}
}
function draw(gl,projection,view,eye,clock,creatures=[]){
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
 gl.uniform1i(sh.isActor,0);
 gl.uniform1f(sh.actorDamage,0);
 gl.uniform1f(sh.actorPalette,0);
 gl.disable(gl.CULL_FACE);
 state.draws=0;
 for(const b of state.batches){
   const m=state.materials[b.material]||{factor:[1,1,1,1]};
   gl.uniform4fv(sh.factor,m.factor);
   // A material named "MEADOW | flower/rock/sky" is not green turf.
   // Preserve flower colors and keep soil, water and stone from grass tinting.
   const materialName=m.name||'';
   const ground=/creekbed|fore?st_ground|terrain|soil|ground|mud|bank|dirt/i.test(materialName);
   const vegetation=/grass|leafy|leaves|fern|moss|reed|foliage/i.test(materialName);
   gl.uniform1i(sh.role,ground?2:vegetation?1:0);
   gl.uniform1f(sh.sway,m.grass?.035:0.);
   gl.uniform1i(sh.hasBase,m.base?1:0);
   gl.uniform1i(sh.hasNormal,m.normal?1:0);
   gl.uniform1i(sh.hasRough,m.rough?1:0);
   for(const [slot,texture] of [[0,m.base],[1,m.normal],[2,m.rough]]){
     gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture||null);
   }
   gl.bindVertexArray(b.vao);gl.drawArrays(gl.TRIANGLES,0,b.count);state.draws++;
 }
 if(state.monster==='ready'&&Array.isArray(creatures)){
   gl.uniform1i(sh.isActor,1);
   gl.uniform1f(sh.sway,0.);
   for(const e of creatures){
     if(!e||!e.meadowKind||e.hp<=0)continue;
     const dx=e.x-eye[0],dz=e.z-eye[2];
     if(dx*dx+dz*dz>24*24)continue;
     const index=e.meadowKind==='sporeling'?1:e.meadowKind==='briar-wraith'?2:0;
     const scale=index===0?.47:index===1?.38:.52;
     // Blender -Y is the cat's face, transformed to GLB +Z by its Y-up export.
     // The original zero-angle engine convention faces -Z, so add PI.
     // Use simulated enemy heading, not the camera angle, for honest facing.
     const angle=(Number.isFinite(e.facing)?e.facing:
       Math.atan2(eye[0]-e.x,-(eye[2]-e.z)))+Math.PI;
     gl.uniform3f(sh.actorPos,e.x,heightAt(e.x,e.z)+.02,e.z);
     gl.uniform1f(sh.actorScale,scale);
     gl.uniform1f(sh.actorYaw,angle);
     gl.uniform1f(sh.walkPhase,(e.bob||0)*2.7+clock*.28);
     const attacking=e.meleeStage==='windup'||e.meleeStage==='lunge'||
       e.rangedStage==='charge'||e.rangedStage==='fire'||(e.hit||0)>.12;
     gl.uniform1f(sh.actorAttack,attacking?Math.min(1,.50+(e.hit||0)):0);
     gl.uniform1f(sh.actorStride,Math.min(1.5,Math.max(0,(e.moveSpeed||0)/Math.max(.5,e.speed||1))));
     gl.uniform1f(sh.actorPalette,index*.34);
     gl.uniform1f(sh.actorDamage,Math.min(1,(e.hit||0)*2.4));
     for(const b of state.actorBatches){
       const m=state.actorMaterials[b.material]||{factor:[1,1,1,1]};
       gl.uniform4fv(sh.factor,m.factor);
       gl.uniform1i(sh.role,m.role||0);
       gl.uniform1i(sh.actorPart,b.part);
       gl.uniform1i(sh.hasBase,m.base?1:0);
       gl.uniform1i(sh.hasNormal,m.normal?1:0);
       gl.uniform1i(sh.hasRough,m.rough?1:0);
       for(const [slot,texture] of [[0,m.base],[1,m.normal],[2,m.rough]]){
         gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture||null);
       }
       gl.bindVertexArray(b.vao);
       gl.drawArrays(gl.TRIANGLES,0,b.count);
       state.draws++;
     }
   }
   gl.uniform1i(sh.isActor,0);
 }
 gl.bindVertexArray(null);
 gl.enable(gl.CULL_FACE);
 return true;
}
window.VEILFORGE_MEADOW_GPU={state,load,draw,beginMonster,heightAt};
})();