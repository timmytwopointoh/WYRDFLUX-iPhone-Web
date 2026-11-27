/* WYRDFLUX
 * Original offline-first WebGL2 first-person survival shooter, v0.2 systems foundation.
 * No externally loaded shaders, images, fonts, libraries, analytics, or network calls.
 * Dynamic geometry + fixed-step simulation, adapted to Android WebView.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), world=$('world'),radar=$('radar'),rg=radar.getContext('2d');
const TAU=Math.PI*2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),mix=(a,b,t)=>a+(b-a)*t;
let seed=1749;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
let gl=world.getContext('webgl2',{antialias:false,alpha:false,depth:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
if(!gl){$('mainMenu').querySelector('.intro').innerHTML='This device needs WebGL 2 support. Try the latest Android System WebView.';$('startButton').disabled=true;return;}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;layout(location=2) in vec3 tint;layout(location=3) in float glow;layout(location=4) in vec2 uv;
uniform mat4 proj,view;uniform float clock;
out vec3 vWorld,vN,vColor;out float vGlow;out vec2 vUV;
void main(){vWorld=position;vN=normal;vColor=tint;vGlow=glow;vUV=uv;gl_Position=proj*view*vec4(position,1.0);}`;
const FS=`#version 300 es
precision highp float;
in vec3 vWorld,vN,vColor;in float vGlow;in vec2 vUV;
uniform vec3 eye,lightPos,sectorTint,flashDir,shotTint,impactTintA,impactTintB;uniform vec4 shotLamp,impactLightA,impactLightB;uniform float clock,flash,overdrive,visualQuality,hellLevel,styleCode,flashPower,simulationPower;
out vec4 color;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
 // Optional translucent decal pass for physically anchored soft shadows.
 // Opaque geometry is rendered in the normal unblended pass.
 if(vGlow<-.5){
  color=vec4(.006,.009,.018,clamp(-vGlow-1.0,0.0,.32));return;
 }
 vec3 n=normalize(vN),ld=normalize(vec3(-.34,.83,-.42));
 float diffuse=max(.0,dot(n,ld));float hemi=.48+.29*n.y;
 float pt=max(0.,1.-length(vWorld-lightPos)/9.5);pt=pt*pt;
 float pulse=max(0.,1.-length(vWorld-vec3(15.5,1.2,15.5))/7.5)*(.24+.18*sin(clock*1.6));
 float fleck=(hash(floor(vWorld*17.0))-.5)*.045;
 float stripe=pow(abs(sin(vUV.x*7.2)),42.)*.05;
 vec3 ambient=vec3(.27,.31,.44)+sectorTint*.072;
 vec3 linear=vColor*(ambient*(.42+hemi*.80)+diffuse*vec3(.52,.57,.66)+pt*vec3(.42,.53,.72)+pulse*vec3(.25,.11,.43));
 // True short-lived point illumination follows the visible pistol tracer.
 float bulletDist=length(vWorld-shotLamp.xyz);
 float bulletFalloff=pow(max(0.0,1.0-bulletDist/4.8),2.0)*shotLamp.w;
 linear+=shotTint*bulletFalloff*(.20+.75*max(0.0,dot(n,normalize(shotLamp.xyz-vWorld+vec3(0.,.01,0.)))));

 linear+=vColor*(fleck+stripe);
 // Faux PBR: view-dependent metal glints, floor reflection streaks and edge wear.
 vec3 v=normalize(eye-vWorld);float metal=clamp((vColor.b-vColor.r)*1.2+.38,0.0,1.0);
 vec3 h=normalize(ld+v);
 float spec=pow(max(dot(n,h),0.0),mix(9.0,44.0,metal));
 float fres=pow(1.0-max(dot(v,n),0.0),3.0);
 float micro=hash(floor(vWorld*8.0));
 float edgeWear=smoothstep(.65,.95,abs(sin(vUV.x*3.7))*abs(sin(vUV.y*3.7)));
 float metallic=max(metal,smoothstep(.26,.66,dot(vColor,vec3(.333))));
 float brushed=.84+.16*sin(vUV.x*39.+vUV.y*5.);
 float sharp=pow(max(dot(n,normalize(normalize(vec3(.52,.75,.25))+v)),0.),mix(18.,82.,metallic));
 float rimlight=pow(1.0-max(dot(n,v),0.0),4.0);
 linear+=visualQuality*(spec*mix(.1,.46,metallic)*vec3(.53,.79,1.0)
   +sharp*brushed*metallic*.32*vec3(.83,.93,1.0)
   +rimlight*.085*metallic*vec3(.47,.76,1.0)+fres*.045+edgeWear*.035);
 // AFTERLIGHT v0.9: multi-color battlefield light, sharp industrial
 // metal highlights, wet neon floor glints and cheaper approximate contact shade.
 vec3 keyDir=normalize(vec3(-.34,.83,-.42));
 vec3 sideDir=normalize(vec3(.69,.34,.45));
 vec3 secondaryDir=normalize(vec3(-.62,.37,.71));
 float keyGlint=pow(max(dot(n,normalize(keyDir+v)),0.),mix(16.,52.,metallic));
 float blueGlint=pow(max(dot(n,normalize(sideDir+v)),0.),mix(12.,62.,metallic));
 float amberGlint=pow(max(dot(n,normalize(secondaryDir+v)),0.),mix(12.,54.,metallic));
 float industrial=clamp(visualQuality*.85,0.,1.);
 linear+=industrial*metallic*(keyGlint*.11*vec3(.68,.87,1.0)
   +blueGlint*.22*(vec3(.18,.68,1.0)+sectorTint*.13)
   +amberGlint*.11*vec3(1.0,.42,.20));
 float edgeHighlight=pow(1.0-max(dot(v,n),0.),5.);
 linear+=metallic*edgeHighlight*industrial*.067*(vec3(.35,.75,1.0)+sectorTint*.18);
 float wet=smoothstep(.90,.99,n.y)*(1.0-smoothstep(.12,.42,micro))*visualQuality;
 vec2 ground=abs(fract(vWorld.xz*.33)-.5);
 float flooded=1.0-smoothstep(.20,.33,length(ground));
 float cityNeon=.5+.5*sin(vWorld.x*.47+clock*.40)*cos(vWorld.z*.43-clock*.26);
 linear+=wet*(.055+.050*cityNeon+flooded*.06)
   *(vec3(.13,.59,.85)+sectorTint*.38);
 float microGroove=pow(abs(sin(vUV.x*18.5+vUV.y*.9)),37.)*metallic;
 linear+=visualQuality*.032*microGroove;
 linear+=vColor*(fleck+stripe);
 // Near-field bloom guard: prevents world emissive geometry being a giant
 // cyan/white solid plane when the camera gets too close to a pickup or wall.
 float emissiveDistance=length(vWorld-eye);
 float closeFade=smoothstep(.25,1.10,emissiveDistance);
 float safeEmission=max(vGlow,0.0)*mix(.08,1.0,closeFade);
 linear+=vColor*(safeEmission*(.95+.12*sin(clock*2.7+vWorld.x*2.)));
 float dist=length(vWorld-eye);float fog=1.-exp(-pow(dist*.030,1.54));
 float abyssFog=smoothstep(8.,26.,dist);
 fog=mix(fog,abyssFog,hellLevel);
 vec3 fogCol=mix(vec3(.014,.024,.040)+sectorTint*.044,vec3(.0007,.0005,.0017),hellLevel);
 linear=mix(linear,fogCol,clamp(fog,0.,mix(.90,.992,hellLevel)));
 float cone=smoothstep(.86,.975,dot(normalize(vWorld-eye),normalize(flashDir)));
 float flashFalloff=1.-smoothstep(6.,24.,dist);
 linear+=vec3(.71,.78,.86)*flashPower*cone*flashFalloff*(1.-abyssFog*.8);
 linear+=max(vGlow,0.0)*vec3(.048,.030,.063)*closeFade;
 linear*=1.+overdrive*.075;
 float smog=clamp((vWorld.y-1.0)*.0035,0.,.09);linear=mix(linear,vec3(.048,.048,.13),smog);
 linear+=flash*vec3(.25,.18,.31);
 // Restraint-first industrial surface pass: brushed grain, fine pitting,
 // rare chipped paint, orientation-consistent metallic specular glints.
 float horizontal=smoothstep(.69,.93,abs(n.y));
 vec2 surfaceUV=mix(vWorld.xy,vWorld.xz,horizontal);
 float nDotV=max(dot(n,v),.02);
 float brushedGrain=.5+.5*sin(surfaceUV.x*96.0+sin(surfaceUV.y*14.0)*.4);
 float pitted=hash(floor(vec3(surfaceUV*24.0,vWorld.y*8.0)));
 float roughness=mix(.29,.63,clamp(pitted*.32+(1.0-metallic)*.49+
  horizontal*.21,0.0,1.0));
 float brushSpec=pow(max(dot(n,normalize(v+sideDir)),0.0),
  mix(52.0,12.0,roughness));
 float metalMask=metallic*(1.0-smoothstep(.65,1.5,vGlow));
 linear+=visualQuality*metalMask*brushSpec*(.024+.035*brushedGrain)*
  (vec3(.61,.75,.91)+sectorTint*.2);
 float nearSurface=1.0-smoothstep(6.0,25.0,length(vWorld-eye));
 float scratch=pow(.5+.5*sin(surfaceUV.x*24.0+
  floor(surfaceUV.y*11.0)*2.38),22.0);
 float paintChip=smoothstep(.89,.985,pitted)*(.035+.025*horizontal);
 linear+=visualQuality*nearSurface*metalMask*
  (scratch*.018*vec3(.82,.86,.93)+paintChip*vec3(.75,.80,.87));
 float groundJunction=(1.0-horizontal)*(1.0-smoothstep(0.0,.68,vWorld.y));
 linear*=1.0-groundJunction*.14;
 // Physically motivated grime accumulates near the wall/floor intersection.
 // Stable world-space pattern, no shimmering procedural UV animation.
 float soot=hash(floor(vWorld*vec3(2.4,3.8,2.4)));
 linear*=1.0-visualQuality*groundJunction*(.043+.055*soot);
 // Gently separated cool and warm fill preserve silhouettes in dark spaces
 // without turning small metal surfaces into bright uniform neon blocks.
 float blueBounce=max(dot(n,normalize(vec3(.36,.32,.84))),0.0);
 float amberBounce=max(dot(n,normalize(vec3(-.74,.37,-.22))),0.0);
 linear+=visualQuality*(blueBounce*.042*(vec3(.18,.44,.65)+sectorTint*.19)
    +amberBounce*.027*vec3(.83,.38,.17));
 // Per-world original style add-ons. Do not mutate original neon look.
 // Pack 1: infernal forged basalt, flesh and hot magma, directional low-key
 // lighting, warm cracked surfaces, fog and flickering ember illumination.
 // All noise is world-space and therefore stable as the camera moves.
 if(styleCode>.5&&styleCode<1.5){
  float stone=hash(floor(vWorld*vec3(2.8,4.2,2.8)));
  float grain=hash(floor(vWorld*vec3(12.0,6.0,12.0)));
  float fissure=pow(abs(sin(vWorld.x*7.2+vWorld.z*4.1+
    sin(vWorld.y*3.1)*.54)),26.0);
  float low=max(0.0,1.0-smoothstep(.0,3.9,vWorld.y));
  float hearth=1.0/(1.0+length(vWorld.xz-vec2(15.5,15.5))*.11);
  float br=sin(clock*5.2+vWorld.x*.14+vWorld.z*.18);
  float firePulse=.84+.16*br*br;
  float formed=max(dot(n,normalize(vec3(.42,.73,-.26))),0.0);
  float warmRim=pow(1.0-max(dot(n,v),0.0),3.0);
  vec3 darkRock=vColor*(.24+.22*formed+.075*stone)*(1.0-.09*grain);
  vec3 hotFire=vec3(.93,.26,.055)*(low*.21+hearth*.10)*
    (formed*.32+.45)*firePulse;
  vec3 ancient=vec3(.035,.012,.015)*(.5+stone*.3);
  float emissive=max(vGlow,0.0);
  vec3 glowLit=vColor*emissive*(.86+.18*firePulse);
  vec3 infernal=darkRock+hotFire+ancient+glowLit+
    warmRim*.054*vec3(.83,.26,.09);
  // Flesh reflects local fire warmly; micro-pore spec differs from rock.
  float skin=smoothstep(.32,.53,vColor.r)*(1.0-smoothstep(.26,.40,vColor.g));
  float pore=hash(floor(vWorld*vec3(21.,16.,24.)));
  float wet=pow(max(dot(reflect(-v,n),normalize(vec3(.33,.71,.24))),0.),17.);
  infernal+=skin*(vColor*vec3(.28,.17,.14)+
     vec3(.14,.031,.026)*wet*(.25+.75*pore));
  float fleck=clamp(fissure*(.035+low*.26)*(1.-stone*.4),0.,.26);
  infernal+=vec3(.94,.19,.025)*fleck*firePulse*
    (1.0-smoothstep(.45,1.3,emissive));
  float smoke=1.-exp(-pow(length(vWorld-eye)*.054,1.45));
  infernal=mix(infernal,vec3(.045,.018,.018)+
   low*vec3(.066,.018,.007),clamp(smoke,.0,.76));
  linear=infernal;
 }else if(styleCode>3.5&&styleCode<4.5){
  // Pale ivory, golden-hour specular, atmospheric sky fog.
  float sun=max(0.,dot(n,normalize(vec3(-.25,.88,.38))));
  vec3 ivory=vColor*(vec3(.87,.88,.94)*(.65+.49*sun));
  float gleam=pow(max(dot(n,normalize(ld+v)),0.),30.);
  ivory+=vec3(.92,.77,.40)*gleam*.25;
  float fog=1.-exp(-pow(length(vWorld-eye)*.041,1.4));
  linear=mix(ivory,vec3(.58,.70,.85),clamp(fog,0.,.38));
 }else if(styleCode>4.5&&styleCode<5.5){
   // Crisp albedo, flat pixel lighting with intentional 4-tone banding.
   // This style applies to the ENTIRE world, not just character meshes.
   float sunlight=max(.14,dot(n,normalize(vec3(-.32,.76,-.41))));
   float shade=floor(clamp(sunlight,0.,.999)*4.0)/4.0;
   vec3 toon=vColor*(.57+shade*.72);
   float micro=hash(floor(vWorld*9.0));
   toon*=.92+.16*step(.52,micro);
   float fog=1.-exp(-pow(length(vWorld-eye)*.034,1.55));
   linear=mix(toon,vec3(.13,.24,.28)+sectorTint*.08,clamp(fog,0.,.57));
  }else if(styleCode>1.5&&styleCode<2.5){
  // Ink-noir proof-of-interface only. Full hand-drawn characters and
  // animation will require a dedicated sprite/image pack.
  float shade=dot(linear,vec3(.299,.587,.114));
  float bands=floor(clamp(shade,0.,.999)*5.0)/4.0;
  float outline=pow(1.-max(dot(n,v),0.),4.);
  float ink=max(.02,bands-outline*.25);
  linear=vec3(ink);
 }else if(styleCode>2.5&&styleCode<3.5){
  // Retro sector proof-of-interface. Future add-on supplies sprites/maps.
  linear=floor(clamp(linear*4.5,0.,1.)*7.0+.5)/7.0*.89;
  float cel=max(dot(n,normalize(vec3(.3,.65,.25))),0.);
  linear*=mix(.78,1.04,step(.37,cel));
 }
 // WYRDFLUX PC cinematic lighting: two short-lived world-space radiance sources
 // illuminate nearby walls, armor and floor when a real projectile hits.
 // Zero-strength uniforms skip all calculations on Android and lower presets.
 // Falloff is finite, oriented to the surface normal and never paints the HUD.
 if(impactLightA.w>.001){
  vec3 toLight=impactLightA.xyz-vWorld;
  float d=length(toLight);
  float pool=pow(max(0.,1.-d/4.8),2.)*impactLightA.w;
  float facing=.28+.72*max(dot(n,normalize(toLight+vec3(0.,.001,0.))),0.);
  linear+=impactTintA*pool*facing*1.25;
 }
 if(impactLightB.w>.001){
  vec3 toLight=impactLightB.xyz-vWorld;
  float d=length(toLight);
  float pool=pow(max(0.,1.-d/3.8),2.)*impactLightB.w;
  float facing=.28+.72*max(dot(n,normalize(toLight+vec3(0.,.001,0.))),0.);
  linear+=impactTintB*pool*facing*.85;
 }
 // As the neural core fails, overhead arena lights lose power.
 // The self-emissive brain sparks remain visible in the dark.
 linear=linear*simulationPower+vColor*max(vGlow,0.0)*(.64*(1.0-simulationPower));
 // Subtle highlight rolloff instead of harshly blown-out neon.
 linear=linear/(vec3(.70)+linear*.42);
 color=vec4(pow(max(linear,0.),vec3(.94)),1.0);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
let prog;try{prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,VS));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog))}catch(err){$('mainMenu').querySelector('.intro').textContent='The 3D renderer could not start: '+err.message;$('startButton').disabled=true;return}
gl.useProgram(prog);const U={};for(const n of ['proj','view','clock','eye','lightPos','sectorTint','flashDir','flashPower','flash','overdrive','visualQuality','hellLevel','styleCode','simulationPower','shotLamp','shotTint','impactLightA','impactLightB','impactTintA','impactTintB'])U[n]=gl.getUniformLocation(prog,n);
function meshBuffer(dynamic){const vao=gl.createVertexArray(),vbo=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,4, dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);const stride=12*4;for(const [i,len,off] of [[0,3,0],[1,3,3],[2,3,6],[3,1,9],[4,2,10]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,len,gl.FLOAT,false,stride,off*4)}gl.bindVertexArray(null);return {vao,vbo,count:0}}
const staticGPU=meshBuffer(false),dynamicGPU=meshBuffer(true),viewmodelGPU=meshBuffer(true);function upload(gpu,arr){gl.bindBuffer(gl.ARRAY_BUFFER,gpu.vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gpu===dynamicGPU?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);gpu.count=arr.length/12}

/* AFTERLIGHT World Style Add-ons v0.28
 * Each pack supplies shader mood, original geometry, optional environmental
 * effects/creatures, and UI cues without modifying game movement or saves.
 * This registry is bundled offline in every Android APK. Unknown IDs fall
 * back to the normal neon-grid world. Preview styles are QA-only.
 */
const WORLD_STYLE_PACKS=new Map();
function registerWorldStylePack(pack){
 if(!pack||!/^([a-z][a-z0-9-]{1,28})$/.test(pack.id)||
    !Number.isInteger(pack.shaderCode)||pack.shaderCode<0||pack.shaderCode>15||
    typeof pack.name!=='string'||pack.name.length>64||
    WORLD_STYLE_PACKS.has(pack.id))return false;
 WORLD_STYLE_PACKS.set(pack.id,Object.freeze({...pack}));return true;
}
registerWorldStylePack({id:'neon-grid',name:'WYRDFLUX Neon Grid',
 shaderCode:0,materialSet:'cyber-metal',scene:'sector',gunMood:'charged-neon'});
registerWorldStylePack({id:'black-chapel',name:'Black Chapel / Infernal Forge',
 shaderCode:1,materialSet:'charred-basalt-and-bone',
 scene:'hell',staticDetail:addInfernalMegastructure,
 dynamicDetail:drawInfernoAtmosphere,gunMood:'forged-ember'});
registerWorldStylePack({id:'blockworld-breach',name:'Blockworld Breach / Pixel Anomaly',
  shaderCode:5,materialSet:'voxel-grass-stone-sculk',scene:'blockworld',
  dynamicDetail:drawBlockworldAtmosphere,gunMood:'pixel-void'});
registerWorldStylePack({id:'heaven-sanctum',name:'Heaven Sanctum / Celestial Court',
 shaderCode:4,materialSet:'ivory-marble-gold-glass',scene:'heaven',
 dynamicDetail:drawHeavenAtmosphere,gunMood:'radiant-gold'});
registerWorldStylePack({id:'ink-noir',name:'Ink Noir / Rubber-hose Prototype',
 shaderCode:2,materialSet:'monochrome-ink',scene:'sector',
 previewOnly:true,gunMood:'cartoon-metal'});
registerWorldStylePack({id:'retro-sector',name:'Retro Sector / Classic FPS Prototype',
 shaderCode:3,materialSet:'low-color-dither',scene:'sector',
 previewOnly:true,gunMood:'pixel-steel'});
registerWorldStylePack({id:'blackwake-cove',name:'Blackwake Cove / Moonlit Salt and Shale',
 shaderCode:0,materialSet:'wet-basalt-sand',scene:'living',gunMood:'lantern-brass'});
registerWorldStylePack({id:'unlisted-circus',name:'The Unlisted Show / Warm Canvas',
 shaderCode:0,materialSet:'matte-velvet-and-sawdust',scene:'circus',gunMood:'candlelit-brass'});
let stylePreviewId=null,styleTransitionCount=0,lastStyleId='neon-grid';
function activeWorldStylePack(){
 const id=livingRealm.active&&livingRealm.id==='blackwake'?'blackwake-cove':
  (livingRealm.active?'neon-grid':stylePreviewId)||(circus.state==='active'?'unlisted-circus':blockworld.state==='active'?'blockworld-breach':heavenSanctum.state==='active'?'heaven-sanctum':hellBreach.state==='active'?'black-chapel':'neon-grid');
 return WORLD_STYLE_PACKS.get(id)||WORLD_STYLE_PACKS.get('neon-grid');
}
function updateWorldStyle(){
 const pack=activeWorldStylePack();
 if(pack.id!==lastStyleId){lastStyleId=pack.id;styleTransitionCount++;}
 return pack;
}
function renderStyleAtmosphere(m,p,quality){
 const pack=activeWorldStylePack();
 if(typeof pack.dynamicDetail==='function')pack.dynamicDetail(m,p,quality);
}
function buildStyleGeometry(m){
 const pack=activeWorldStylePack();
 if(typeof pack.staticDetail==='function')pack.staticDetail(m);
}

const HEX={blockgreen:[.23,.65,.17],blockgreen2:[.14,.46,.12],blockgreen3:[.34,.74,.23],blockgrass:[.28,.62,.18],blockgrass2:[.20,.53,.17],blockdirt:[.40,.27,.17],blockstone:[.41,.43,.45],blockmoss:[.30,.45,.23],blockore:[.13,.68,.83],blocklog:[.36,.23,.14],blockleaf:[.22,.49,.20],blockleaf2:[.28,.58,.21],blocksky:[.48,.70,.88],blocktorch:[1,.66,.18],blockdeepslate:[.11,.15,.19],blocksculk:[.05,.19,.22],blockcyan:[.05,.86,.91],blockflash:[.84,1,.83],blockface:[.045,.065,.042],blockzombie:[.30,.51,.32],blockzombie2:[.18,.34,.23],blockshirt:[.14,.51,.48],blockshirt2:[.12,.38,.35],blockpants:[.20,.22,.46],blockpants2:[.15,.17,.32],blockbone:[.72,.70,.60],blockspider:[.18,.18,.19],blockspider2:[.11,.12,.13],blockred:[.82,.09,.08],blockwarden:[.09,.15,.17],blockwarden2:[.16,.27,.29],blockwardenchest:[.055,.12,.15],obsidian:[.065,.052,.064],hellstone:[.22,.105,.090],charcoal:[.10,.085,.088],bone:[.47,.40,.29],cinder:[.35,.10,.048],magma:[1,.22,.036],sulfur:[.76,.42,.10],ash:[.23,.19,.17],sinew:[.24,.052,.083],ironblack:[.09,.105,.13],metal:[.28,.35,.48],metal2:[.16,.22,.33],dark:[.07,.11,.19],rim:[.34,.41,.62],white:[.66,.80,.92],pink:[.86,.20,1.0],purple:[.49,.22,.96],cyan:[.12,.93,.87],blue:[.20,.51,.96],red:[1,.19,.36],orange:[1,.46,.18],gold:[1,.74,.25],black:[.035,.045,.075],floor:[.18,.22,.34],glass:[.17,.27,.37],green:[.13,1,.51],brass:[.62,.38,.17],rust:[.33,.16,.15],warm:[1,.59,.28],mist:[.12,.22,.33],chrome:[.55,.66,.78],polished:[.41,.54,.66],titanium:[.32,.39,.49],steelblue:[.22,.37,.54],flesh:[.54,.13,.17],wound:[.19,.031,.044],muscle:[.60,.19,.21],scar:[.37,.062,.070],cartilage:[.44,.31,.25],ember:[.95,.23,.032],shadowflesh:[.115,.057,.092]};
class Mesh{constructor(){this.data=[]}v(p,n,c,e,u,v){this.data.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2],e,u,v)}
 box(x,y,z,sx,sy,sz,color='metal',em=0,rot=0){if(sx<=0||sy<=0||sz<=0)return;const c=Array.isArray(color)?color:HEX[color],hx=sx/2,hy=sy/2,hz=sz/2,co=Math.cos(rot),si=Math.sin(rot);let points=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];points=points.map(p=>[x+co*p[0]+si*p[2],y+p[1],z-si*p[0]+co*p[2]]);
 const faces=[[0,3,2,1,[0,0,-1]],[4,5,6,7,[0,0,1]],[0,4,7,3,[-1,0,0]],[1,2,6,5,[1,0,0]],[3,7,6,2,[0,1,0]],[0,1,5,4,[0,-1,0]]];
 for(const f of faces){const n=[co*f[4][0]+si*f[4][2],f[4][1],-si*f[4][0]+co*f[4][2]],uv=[[0,0],[1,0],[1,1],[0,1]];for(const q of [0,1,2,0,2,3])this.v(points[f[q]],n,c,em,uv[q][0]*sx,uv[q][1]*sz)}}
 tri(a,b,c,color='metal',em=0){
  const tint=Array.isArray(color)?color:HEX[color];
  if(!tint)return;
  const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],
   vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],
   nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,
   len=Math.max(.0001,Math.hypot(nx,ny,nz)),n=[nx/len,ny/len,nz/len];
  for(const seq of [[a,b,c],[c,b,a]])
   for(let i=0;i<3;i++)this.v(seq[i],i===0?n:n.map(v=>v),tint,em,i===1?1:0,i===2?1:0);
 }
 beam(x1,y1,z1,x2,y2,z2,width,color='cyan',em=1){const dx=x2-x1,dy=y2-y1,dz=z2-z1,len=Math.hypot(dx,dy,dz);if(len<.01)return;const c=Array.isArray(color)?color:HEX[color];let ax=-dz/len,az=dx/len;const h=width/2;const points=[[x1+ax*h,y1,z1+az*h],[x1-ax*h,y1,z1-az*h],[x2-ax*h,y2,z2-az*h],[x2+ax*h,y2,z2+az*h]];for(const seq of [[0,1,2],[0,2,3]])for(const q of seq)this.v(points[q],[0,1,0],c,em,0,0)}
 
 // Camera-facing volumetric-looking strip, double-sided to avoid edge-on laser loss.
 ribbon(x1,y1,z1,x2,y2,z2,width,color='cyan',em=1,cam=null,offset=0){
  const c=Array.isArray(color)?color:HEX[color],dx=x2-x1,dy=y2-y1,dz=z2-z1,len=Math.hypot(dx,dy,dz);
  if(len<.004||!c)return;
  const mx=(x1+x2)*.5,my=(y1+y2)*.5,mz=(z1+z2)*.5;
  let vx=cam?cam.x-mx:0,vy=cam?cam.y-my:1,vz=cam?cam.z-mz:0;
  const vl=Math.max(.0001,Math.hypot(vx,vy,vz));vx/=vl;vy/=vl;vz/=vl;
  let sx=dy*vz-dz*vy,sy=dz*vx-dx*vz,sz=dx*vy-dy*vx,sl=Math.hypot(sx,sy,sz);
  if(sl<.0001){sx=-dz;sy=0;sz=dx;sl=Math.hypot(sx,sy,sz)}
  if(sl<.0001){sx=0;sy=1;sz=0;sl=1}
  const k=width/(2*sl);sx*=k;sy*=k;sz*=k;
  const ax=vx*offset,ay=vy*offset,az=vz*offset;
  const q=[[x1-sx+ax,y1-sy+ay,z1-sz+az],[x1+sx+ax,y1+sy+ay,z1+sz+az],[x2+sx+ax,y2+sy+ay,z2+sz+az],[x2-sx+ax,y2-sy+ay,z2-sz+az]];
  for(const face of [[0,1,2,0,2,3],[2,1,0,3,2,0]])for(let i=0;i<6;i++){
   const v=face[i];this.v(q[v],[vx,vy,vz],c,em,(v===1||v===2)?1:0,v>=2?1:0)
  }
 }
}
const SECTORS=['THE BREACH','DEAD CITY','NULL CHAMBERS','FALLEN FOUNDRY','GLOOM DISTRICT','ORBITAL SPIRE','THE IRON HEART'];
const BASE_N=21,N=31,C=N/2,map=[];const edge=(x,z)=>x<0||z<0||x>=N||z>=N;
// All gameplay paths are on a 21x21 navigable, destructible-looking industrial tile grid.
// Nonblocking visual rails and skyline are drawn independently of collision.
const SECTOR_THEMES=[
 {name:'Breach Perimeter',motto:'Fortified access lanes and shattered barricades',accent:'cyan'},
 {name:'Dead City',motto:'Skyscraper canyons, collapsed street grids',accent:'pink'},
 {name:'Null Chambers',motto:'Containment courtyards and electromagnetic gates',accent:'purple'},
 {name:'Fallen Foundry',motto:'Furnace gantries, steel corridors and conveyor fields',accent:'orange'},
 {name:'Gloom District',motto:'Alleys beneath failing neon and occupied housing',accent:'green'},
 {name:'Orbital Spire',motto:'High security relay courtyards and skybridge pylons',accent:'blue'},
 {name:'Iron Heart',motto:"An armored reactor ring at the city's core",accent:'red'}
];
// Distinct hand-specified arena motifs; deterministic and verified traversable.
// Objective and spawn paths remain accessible in every variation.
function createMap(which=sector){
 const oldMap=[];
 for(let z=0;z<BASE_N;z++){
  const row=[];
  for(let x=0;x<BASE_N;x++){
   let wall=(x===0||z===0||x===BASE_N-1||z===BASE_N-1);
   if(!wall){
    const corner=(x>=3&&x<=7||x>=13&&x<=17)&&(z>=3&&z<=7||z>=13&&z<=17);
    switch(which){
     case 0:wall=((x===5||x===15)&&(z>=3&&z<=7||z>=13&&z<=17)&&z!==5&&z!==15)||((z===5||z===15)&&(x>=3&&x<=7||x>=13&&x<=17)&&x!==5&&x!==15);break;
     case 1:wall=((x===4||x===8||x===12||x===16)&&z>=3&&z<=17&&z!==6&&z!==10&&z!==15)||((z===7||z===13)&&x>=3&&x<=17&&x!==5&&x!==10&&x!==15);break;
     case 2:wall=((x===6||x===14)&&z>=5&&z<=15&&z!==8&&z!==10&&z!==12)||((z===6||z===14)&&x>=5&&x<=15&&x!==8&&x!==10&&x!==12)||((x===8||x===12)&&(z===8||z===12));break;
     case 3:wall=((z===4||z===8||z===12||z===16)&&(x>2&&x<18)&&x%5!==0&&x!==10)||((x===5||x===15)&&z>3&&z<18&&z%5!==0);break;
     case 4:wall=(corner&&(x===4||x===7||x===13||x===16)&&(z>=4&&z<=7||z>=13&&z<=16)&&z!==5&&z!==15)||((z===4||z===16)&&x>=7&&x<=14&&x!==10);break;
     case 5:wall=((x===4||x===16)&&z>=4&&z<=16&&z!==7&&z!==10&&z!==13)||((z===4||z===16)&&x>=4&&x<=16&&x!==7&&x!==10&&x!==13)||((x===7||x===13)&&(z===7||z===13));break;
     case 6:wall=((x===7||x===13)&&z>=6&&z<=14&&z!==10)||((z===7||z===13)&&x>=6&&x<=14&&x!==10)||((x===4||x===16)&&z>=4&&z<=16&&z!==6&&z!==10&&z!==14);break;
    }
   }
   row.push(wall?1:0);
  }
  oldMap.push(row);
 }
 // Main arterial cross, three relay access spurs, and safe objective pads.
 for(let i=1;i<BASE_N-1;i++){oldMap[10][i]=0;oldMap[i][10]=0}
 for(let z=2;z<=10;z++){oldMap[z][3]=0;oldMap[z][17]=0}
 for(let z=10;z<=18;z++)oldMap[z][3]=0;
 for(const [cx,cz] of [[3,3],[17,3],[3,17],[10,10],[10,16]]){
  for(let z=Math.max(1,cz-1);z<=Math.min(BASE_N-2,cz+1);z++)
   for(let x=Math.max(1,cx-1);x<=Math.min(BASE_N-2,cx+1);x++)oldMap[z][x]=0;
 }
 // Never generate isolated spawn pockets: disconnected islands become solid
 // while retaining corridors, side rooms and the sector's recognizable motifs.
 const visited=new Uint8Array(BASE_N*BASE_N),queue=[16*BASE_N+10];visited[16*BASE_N+10]=1;
 for(let q=0;q<queue.length;q++){
  const id=queue[q],x=id%BASE_N,z=Math.floor(id/BASE_N);
  for(const [nx,nz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
   const k=nz*BASE_N+nx;if(nx<1||nx>BASE_N-2||nz<1||nz>BASE_N-2||oldMap[nz][nx]||visited[k])continue;
   visited[k]=1;queue.push(k);
  }
 }
 for(let z=1;z<BASE_N-1;z++)for(let x=1;x<BASE_N-1;x++)if(!visited[z*BASE_N+x])oldMap[z][x]=1;
 // Scale authored routes to a ~2.18x larger 31x31 arena.
 map.length=0;
 for(let z=0;z<N;z++){const row=[],bz=Math.round(z*(BASE_N-1)/(N-1));
  for(let x=0;x<N;x++)row.push(oldMap[bz][Math.round(x*(BASE_N-1)/(N-1))]);
  map.push(row);
 }
 // Wide transit avenues and safe five-by-five objectives for large bosses.
 for(let i=1;i<N-1;i++)for(const d of [-1,0,1]){map[15+d][i]=0;map[i][15+d]=0;}
 for(const [cx,cz] of [[5,5],[25,5],[5,25],[15,15],[15,24]]){
  for(let z=Math.max(1,cz-2);z<=Math.min(N-2,cz+2);z++)
   for(let x=Math.max(1,cx-2);x<=Math.min(N-2,cx+2);x++)map[z][x]=0;
 }
 const seen=new Uint8Array(N*N),q=[24*N+15];seen[q[0]]=1;
 for(let head=0;head<q.length;head++){
  const p=q[head],x=p%N,z=Math.floor(p/N);
  for(const [xx,zz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
   if(xx<1||xx>=N-1||zz<1||zz>=N-1||map[zz][xx]||seen[zz*N+xx])continue;
   seen[zz*N+xx]=1;q.push(zz*N+xx);
  }
 }
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)if(!seen[z*N+x])map[z][x]=1;

}
function mapFingerprint(){
 let hash=2166136261;for(let z=0;z<N;z++)for(let x=0;x<N;x++)hash=Math.imul(hash^(map[z][x]?1:0),16777619)>>>0;
 return hash.toString(16).padStart(8,'0');
}

function tile(x,z){const ix=Math.floor(x),iz=Math.floor(z);return edge(ix,iz)?1:map[iz][ix]}
// Sample every solid map cell touched by the collider, not only its four
// corners. Large enemies and narrow wall ends otherwise clip through geometry.
function free(x,z,r=.25){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(r)||r<0)return false;
 for(let iz=Math.floor(z-r);iz<=Math.floor(z+r);iz++)
  for(let ix=Math.floor(x-r);ix<=Math.floor(x+r);ix++)
   if(edge(ix,iz)||map[iz][ix])return false;
 return true;
}
function findRoute(x1,z1,x2,z2,radius=.25){
 const sx=Math.floor(x1),sz=Math.floor(z1),tx=Math.floor(x2),tz=Math.floor(z2);if(edge(sx,sz)||edge(tx,tz))return null;const start=sz*N+sx,end=tz*N+tx,seen=new Uint8Array(N*N),parent=new Int16Array(N*N);parent.fill(-1);let head=0,queue=[start];seen[start]=1;while(head<queue.length){const n=queue[head++];if(n===end)break;const x=n%N,z=Math.floor(n/N);for(const [xx,zz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){if(edge(xx,zz)||map[zz][xx]||!free(xx+.5,zz+.5,radius))continue;const next=zz*N+xx;if(!seen[next]){seen[next]=1;parent[next]=n;queue.push(next)}}}if(!seen[end])return null;let curr=end,prev=parent[curr];while(prev!==start&&prev!==-1){curr=prev;prev=parent[curr]}return {x:(curr%N)+.5,z:Math.floor(curr/N)+.5};
}
function randomOpen(minDist=0){for(let q=0;q<200;q++){const x=1.5+Math.floor(rnd()*(N-2)),z=1.5+Math.floor(rnd()*(N-2));if(free(x,z,.32)&&Math.hypot(x-player.x,z-player.z)>minDist)return{x,z}}return{x:C,z:24.5}}
function addPanel(m,x,z,wallAxis,offset=0){const col=(x+z)%3===0?'metal2':'metal';if(wallAxis==='z'){m.box(x+.5,1.17,z+offset,1.0,2.3,.13,col);m.box(x+.5,1.18,z+offset+.073,.78,1.89,.037,'metal2');m.box(x+.5,1.18,z+offset+.105,.59,1.62,.018,'glass');for(const xx of [x+.12,x+.88])m.box(xx,1.14,z+offset+.12,.035,2.0,.09,'rim');m.box(x+.5,2.18,z+offset+.13,.85,.045,.08,'purple',1.6)}else{m.box(x+offset,1.17,z+.5,.13,2.3,1.0,col);m.box(x+offset+.073,1.18,z+.5,.037,1.89,.78,'metal2');m.box(x+offset+.105,1.18,z+.5,.018,1.62,.59,'glass');for(const zz of [z+.12,z+.88])m.box(x+offset+.12,1.14,zz,.09,2.0,.035,'rim');m.box(x+offset+.13,2.18,z+.5,.08,.045,.85,'cyan',1.4)}}

// Deliberate vertical landmarks and art direction per sector. Non-colliding
// geometry is kept above player head or flattened into walkable floor decals.
function addSectorSetDressing(original){
 const scale=(N-1)/(BASE_N-1),pos=x=>C+(x-10.5)*scale;
 const m={
  box:(x,y,z,sx,sy,sz,col,em=0,rot=0)=>original.box(pos(x),y,pos(z),sx,sy,sz,col,em,rot),
  beam:(x1,y1,z1,x2,y2,z2,width,col,em=0)=>original.beam(pos(x1),y1,pos(z1),pos(x2),y2,pos(z2),width,col,em)
 };

 const t=sector,accent=['cyan','pink','purple','orange','green','blue','red'][t];
 const ring=(x,y,z,r,col=accent,steps=18)=>{
  for(let i=0;i<steps;i++){const a=TAU*i/steps,b=TAU*(i+1)/steps;
   m.beam(x+Math.cos(a)*r,y,z+Math.sin(a)*r,x+Math.cos(b)*r,y,z+Math.sin(b)*r,.033,col,.7);
  }
 };
 if(t===0){for(let x=3;x<19;x+=5){
  m.box(x,3.9,1.5,.24,.8,.44,'rim');m.box(x,4.26,1.5,.45,.09,.56,'cyan',1.9);
  m.box(x,2.75,19.5,.68,.075,.33,'rust');
 }}
 if(t===1){for(const x of [4,9,14,18])for(const z of [4,12,17]){
  m.box(x+.5,3.38,z+.5,1.2,.12,.53,'metal2');
  m.box(x+.5,3.34,z+.2,.9,.035,.035,'pink',1.8);
  m.box(x+.5,3.7,z+.5,.14,.62,.16,'rust');
 }for(let z=3;z<19;z+=4){m.box(2.4,4.35,z,2.0,.1,.35,'black');
 m.box(2.4,4.4,z,.93,.03,.26,'purple',.8)}}
 if(t===2){for(const x of [5,16])for(const z of [5,16]){
  ring(x,3.55,z,.72,'purple',14);
  m.box(x,3.08,z,.17,1.05,.17,'rim');
  m.box(x,3.65,z,.39,.12,.4,'cyan',1.9);
 }for(let i=3;i<18;i+=3)m.beam(i,3.8,10.1,i+1.35,3.55,10.1,.04,'cyan',.6)}
 if(t===3){for(let x=2;x<=18;x+=4){
  m.box(x,3.54,5.4,1.3,.18,.36,'metal');m.box(x,3.48,5.4,1,.045,.12,'orange',1.7);
  m.box(x,3.54,15.4,1.3,.18,.36,'metal');m.box(x,3.48,15.4,1,.045,.12,'orange',1.7);
  for(const z of [6,14])m.box(x,2.91,z,.17,2.1,.17,'rust');
 }for(let i=0;i<20;i++){const x=2+i*.85;m.box(x,.03,10.5,.11,.014,.46,i%2?'black':'brass')}}
 if(t===4){for(let z=3;z<18;z+=4){
   m.box(1.6,3.13,z,.38,.62,.28,'metal2');m.box(1.4,3.2,z,.08,.4,.2,'green',1.8);
   m.box(19.4,3.13,z,.38,.62,.28,'metal2');m.box(19.6,3.2,z,.08,.4,.2,'pink',1.6);
  }for(let x=2;x<19;x+=3)for(let z of [5.5,15.5])m.box(x,.019,z,.36,.02,.035,'green',.6)}
 if(t===5){for(const [x,z] of [[5,5],[16,5],[5,16],[16,16]]){
   m.box(x,3.4,z,.23,2.05,.23,'metal2');m.box(x,4.42,z,.7,.12,.7,'rim');
   ring(x,4.25,z,.83,'blue',16);
  }for(let y=3.7;y<=4.5;y+=.38)ring(10.5,y,10.5,2.15,'cyan',22)}
 if(t===6){for(let y=3.1;y<5.1;y+=.35){ring(10.5,y,10.5,2.0+Math.sin(y*4)*.2,y%2?'red':'orange',24)}
   for(let i=0;i<12;i++){const a=TAU*i/12;
    const x=10.5+Math.cos(a)*3.3,z=10.5+Math.sin(a)*3.3;
    m.box(x,3.15,z,.23,1.5,.23,'rust');
    m.box(x,3.94,z,.35,.08,.35,'red',1.5);
   }
 }
}


/**
 * V0.9 CINEMATIC BATTLEFIELD SET: distinctly layered city, massive overhead
 * gantries, lit megastructures and worn walkable floor detail. Static meshes
 * and sub-floor decals cannot alter the authoritative gameplay collision map.
 * Mesh complexity is deterministic and capped, including for Android.
 */
function addCinematicBattlefield(m){
 const accent=['cyan','pink','purple','orange','green','blue','red'][sector];
 const trim=['blue','purple','cyan','warm','green','cyan','orange'][sector];
 const terrain=sector===3?'rust':sector===6?'titanium':'metal2';
 const ring=(x,y,z,r,clr,thick=.05,n=20)=>{
  for(let i=0;i<n;i++){const a=TAU*i/n,b=TAU*(i+1)/n;
   m.beam(x+Math.cos(a)*r,y,z+Math.sin(a)*r,x+Math.cos(b)*r,y,z+Math.sin(b)*r,thick,clr,1.05);
  }
 };
 // Huge titanium guard stations on four horizons: lit stair-step facades,
 // inset observation windows and separate warm industrial accent lamps.
 for(let k=0;k<20;k++){
  const side=Math.floor(k/5),p=4+(k%5)*5.55;
  const x=side===0?-2.5:side===1?N+2.5:p;
  const z=side===2?-2.5:side===3?N+2.5:p;
  const height=6+(k%4)*2.1+((k*7)%3)*.67;
  const sx=side<2?1.65:2.45,sz=side<2?2.45:1.65;
  m.box(x,height*.5-.8,z,sx,height,sz,terrain);
  m.box(x,height*.62,z,sx+0.2,.09,sz+.2,'chrome',.11);
  m.box(x,height-.17,z,sx*.72,.34,sz*.72,'steelblue',.13);
  m.box(x,height+.04,z,sx*.35,.075,sz*.38,accent,1.55);
  const faceZ=side<2?null:(side===2?z+sz*.53:z-sz*.53);
  const faceX=side<2?(side===0?x+sx*.53:x-sx*.53):null;
  for(let j=0;j<6;j++){
   const y=1+j*1.03;
   if(y>height-1)break;
   const cc=k%3===0?'warm':j%2?accent:trim;
   if(faceZ!==null){
    m.box(x,y,faceZ,sx*.49,.20,.035,cc,.65);
    m.box(x,y+.18,faceZ,sx*.64,.035,.045,'chrome',.18);
   }else{
    m.box(faceX,y,z,.035,.20,sz*.49,cc,.65);
    m.box(faceX,y+.18,z,.045,.035,sz*.64,'chrome',.18);
   }
  }
  if(k%3===0){
   m.box(x,height+.54,z,.16,1.20,.18,'chrome');
   m.box(x,height+1.1,z,.44,.16,.48,'warm',2.1);
  }
 }
 // Four enormous illuminated spine pylons in the corners, safe outside play.
 for(const [x,z] of [[-1,-1],[N+1,-1],[-1,N+1],[N+1,N+1]]){
  m.box(x,5.3,z,.95,10.5,.95,'metal');
  m.box(x,6.6,z,1.35,1.10,1.35,'polished');
  for(let y=1.7;y<9.7;y+=1.75){
   m.box(x,y,z,1.12,.095,1.12,'chrome',.16);
   m.box(x,y+.15,z,.63,.07,.63,accent,.60);
  }
  m.box(x,10.75,z,1.05,.45,1.05,accent,2.2);
 }
 // Skybridge trusses cast a menacing silhouette above gunplay while leaving
 // the entire 31x31 navigation mesh unaffected.
 for(let k=0;k<3;k++){
   const p=5.0+k*10.1, y=10.3+(k%2)*1.55;
  m.box(C,y,p,18.7,.13,.27,'titanium');
  m.box(C,y+.48,p,18.7,.09,.12,'chrome',.16);
  for(const side of [-1,1])m.box(C,y+.1,p+side*.29,18.7,.12,.065,side===1?accent:'steelblue',side===1?.78:.16);
  for(let x=6.7;x<23;x+=2.45){
   m.beam(x,y-.3,p,x+1.3,y+.44,p,.04,'chrome',.15);
   m.beam(x+1.3,y+.44,p,x+2.45,y-.3,p,.04,'steelblue',.12);
  }
  for(const x of [9.0,19.5]){
   m.box(x,y-.19,p,.20,.35,.43,'steelblue');
   m.box(x,y-.4,p,.36,.034,.38,['green','purple','red','blue'][(k+Math.floor(x))%4],.44);
  }
 }
 // Walkable procedural wet-metal panels with puddles and glowing hazard
 // chevrons. These are thin sub-collision decals at <=0.038m.
 for(let i=0;i<66;i++){
  const x=1.75+((i*13.13)%27.0),z=1.65+((i*9.73)%27.0);
  if(tile(x,z)||Math.hypot(x-C,z-C)<3.0)continue;
  const wide=.28+(i%4)*.12, length=.31+(i%6)*.15;
  m.box(x,.027,z,wide,.009,length,'black');
  m.box(x,.033,z,wide*.83,.006,length*.68,i%5===0?'glass':'steelblue',.065);
  if(i%3===0){
   m.box(x-.08,.039,z+.1,.07,.009,.05,accent,.34);
   m.box(x+.11,.040,z-.09,.09,.009,.035,'chrome',.11);
  }
 }
 // Luminous service lanes, warning chevrons, grates and reinforced cables.
 for(let i=2;i<N-2;i+=3){
  if(!tile(C+.5,i+.5)){
   m.box(C-.66,.038,i+.5,.04,.009,.61,accent,.72);
   m.box(C+.67,.038,i+.5,.04,.009,.61,'warm',.63);
   for(const j of [-1,1]){
    m.box(C+j*.90,.041,i+.34,.29,.009,.035,'brass',.21);
    m.box(C+j*1.10,.042,i+.56,.17,.01,.042,'chrome',.11);
   }
  }
  if(!tile(i+.5,C+.5)){
   m.box(i+.5,.037,C-.65,.61,.009,.042,accent,.64);
   m.box(i+.5,.037,C+.67,.61,.009,.042,'warm',.65);
  }
 }
 // Massive center halo frames and elevated magnet rings.
 ring(C,7.65,C,2.9,accent,.08,28);
 ring(C,8.28,C,3.26,'chrome',.052,28);
 for(let a=0;a<TAU;a+=TAU/12){
  const xx=C+Math.cos(a)*3.14,zz=C+Math.sin(a)*3.14;
  m.box(xx,7.85,zz,.22,.54,.22,'titanium',.07);
  m.box(xx,8.09,zz,.13,.11,.13,trim,1.55);
 }
 // Sector-tinted holographic billboards along the perimeter and suspended
 // turbine vents (real geometry instead of flat UI decorations).
 for(const side of [-1,1]){
  for(const z of [5.4,15.3,25.2]){
   const x=side<0?.8:N-.8;
   m.box(x,4.25,z,.18,1.24,2.4,'steelblue');
   m.box(x+side*.09,4.25,z,.04,1.01,2.15,'black');
   for(let j=0;j<6;j++)m.box(x+side*.119,4.63-j*.15,z,.03,.045,1.73-j*.2,j%2?accent:trim,.55+j*.11);
   m.box(x,4.94,z,.29,.065,2.51,'chrome',.2);
  }
 }
 // Distinct skyline signatures to prevent every sector looking identical.
 if(sector===3){for(const z of [4,14,24]){
  m.box(-3.2,6.5,z,1.2,13,1.2,'rust');m.box(-3.2,13.0,z,1.45,.65,1.45,'orange',.67);
  m.box(N+3.2,7.7,z,1.4,15.5,1.4,'rust');m.box(N+3.2,15.7,z,1.3,.55,1.3,'warm',1.5);
 }}
 if(sector===1||sector===4){for(let k=0;k<12;k++){
  const z=2.8+k*2.32,x=k%2?-3.6:N+3.6;
  m.box(x,5.8,z,.19,2.7,1.2,k%3?'purple':'green',.85);
  m.box(x,7.21,z,.31,.095,1.31,'chrome',.4);
 }}
 if(sector===5){ring(C,9.8,C,8.5,'blue',.07,36);ring(C,9.8,C,9.1,'cyan',.035,36)}
 if(sector===6){ring(C,8.5,C,6.5,'red',.07,32);ring(C,8.5,C,7.1,'warm',.038,32)}
}
// Restrained authored industrial prop pass. Never touches collision or pathfinding.
function addMaterialStoryProps(m){
 const palette=['steelblue','rust','polished','brass','metal2','chrome','titanium'];
 const accent=['green','purple','red','blue'][sector%4];
 for(let z=2;z<N-2;z+=3)for(let x=2;x<N-2;x+=3){
  if(tile(x+.5,z+.5))continue;
  const metal=palette[(x*7+z*13+sector*11)%palette.length];
  if((x+z*2)%4===0){
   // Dented service panels with dark recesses, rivets, and non-emissive trim.
   m.box(x+.5,.006,z+.5,.74,.009,.74,'dark',.015);
   m.box(x+.5,.011,z+.5,.67,.006,.66,metal,.045);
   for(const a of [-1,1])for(const b of [-1,1])
    m.box(x+.5+a*.285,.014,z+.5+b*.285,.037,.004,.037,'chrome',.07);
   m.box(x+.5,.015,z+.5,.55,.004,.015,'black',.02);
  }else if((x*5+z*3)%6===0){
   m.box(x+.5,.009,z+.5,.58,.008,.36,'black',.025);
   for(let i=-2;i<=2;i++)
    m.box(x+.5+i*.105,.014,z+.5,.019,.005,.29,'titanium',.025);
   m.box(x+.5,.015,z+.19,.62,.004,.018,'rust',.04);
  }
  if((x*3+z*7)%12===0){
   const angle=(x+z)%3*.2;
   m.box(x+.5,.009,z+.5,.30,.008,.25,'rust',.055,angle);
   m.box(x+.575,.014,z+.475,.21,.005,.12,'black',.025,angle);
  }
 }
 for(let z=2;z<N-2;z+=4)for(let x=2;x<N-2;x+=4){
  if(!tile(x+.5,z+.5))continue;
  for(const [dx,dz] of [[0,-1],[0,1],[-1,0],[1,0]]){
   if(tile(x+.5+dx,z+.5+dz))continue;
   const wx=x+.5+dx*.53,wz=z+.5+dz*.53;
   if((x*11+z*5+sector)%3!==0){
    m.box(wx,1.13,wz,dx===0?.71:.078,1.65,dz===0?.71:.078,'titanium',.035);
    for(const yy of [.49,1.21,1.77])
     m.box(wx,yy,wz,dx===0?.83:.107,.075,dz===0?.83:.107,'metal2',.08);
    m.box(wx,1.87,wz,dx===0?.52:.13,.10,dz===0?.52:.13,'brass',.12);
   }else{
    m.box(wx,.89,wz,dx===0?.63:.085,.49,dz===0?.63:.085,'metal2',.025);
    m.box(wx,.99,wz,dx===0?.44:.05,.08,dz===0?.44:.05,'black',.02);
    m.box(wx,1.11,wz,dx===0?.34:.07,.055,dz===0?.34:.07,accent,.095);
   }
   break;
  }
 }
}
// HELL BREACH: physically separate in-memory arena on the SAME offline
// WebGL2/Android renderer. A real opened north-wall portal leads to the
// arena transition. Three progressively harder rounds return the player
// to the original campaign after a special permanent career achievement.
function createHellMap(){
 map.length=0;
 for(let z=0;z<N;z++){
  const row=[];
  for(let x=0;x<N;x++){
   let wall=x===0||z===0||x===N-1||z===N-1;
   if(x>=4&&x<N-4&&z>=4&&z<N-4){
    const column=(x===6||x===N-7)&&(z===6||z===N-7);
    const slash=(x===9||x===N-10)&&(z>6&&z<N-7)&&z%5===0;
    const alcove=(z===9||z===N-10)&&x>5&&x<N-6&&x%7===0;
    wall=wall||column||slash||alcove;
   }
   if(Math.abs(x-Math.floor(C))<3&&(Math.abs(z-Math.floor(C))<3||z>21))
    wall=false;
   row.push(wall?1:0);
  }
  map.push(row);
 }
 // Three connected collision-backed chambers: the Ossuary, Furnace Choir,
 // and Ash Sanctuary. Each partition has a generous 10-tile central doorway.
 for(const z of [10,21])for(let x=4;x<N-4;x++)
   map[z][x]=(x<=10||x>=21)?1:0;
 // Maintain solid map perimeter and generous traversable sightlines.
 for(let k=0;k<N;k++){map[0][k]=1;map[N-1][k]=1;map[k][0]=1;map[k][N-1]=1;}
}

/** Black Chapel / Infernal Forge: original infernal horror level kit.
 * Collision stays based on createHellMap(), every floor plate is inlaid.
 * Tall decor is anchored to the interior WALLS or above character height.
 */
let infernalStaticDetails=0,infernalAtmosphereDots=0;
function addInfernalMegastructure(m){
 infernalStaticDetails=0;
 const high=$('quality').value==='high',battery=$('quality').value==='battery';
 function box(...args){m.box(...args);infernalStaticDetails++;}
 function beam(...args){m.beam(...args);infernalStaticDetails++;}
 // Ribbed inverted vault arches, pinned to the existing wall/ceiling.
 for(const z of [3.0,8.4,14.2,20.0,26.0]){
  for(const side of [-1,1]){
   const x=C+side*11.5;
   beam(x,4.15,z,x-side*2.5,7.05,z,.24,'obsidian',.022);
   beam(x-side*2.5,7.05,z,C+side*4.2,7.18,z,.17,'hellstone',.017);
   for(let k=0;k<3;k++){
    const y=2.2+k*.74;
    box(x, y,z,.26,.35,.88,'hellstone',.018);
    box(x-side*.18,y+.08,z+.46,.13,.18,.07,'bone',.027);
   }
  }
  box(C,7.06,z,8.8,.27,.56,'ironblack',.018);
  for(let k=0;k<6;k++){
   const x=C+(k-2.5)*1.25;
   beam(x,6.9,z,x+(.5-k/6)*.4,7.54,z-.53,.064,'ash',.016);
  }
 }
 // Massive altar side furnaces visible from the entry, out of the aisle.
 for(const z of [7.1,16.6,24.0]){
  for(const side of [-1,1]){
   const x=C+side*10.35;
   box(x,2.90,z,1.18,5.65,1.35,'obsidian',.025);
   box(x,4.83,z,1.46,.29,1.53,'ironblack',.042);
   box(x,2.74,z+side*.05,.74,1.65,.38,'charcoal',.024);
   box(x,2.60,z+side*.23,.42,1.13,.12,'magma',.43);
   for(let k=0;k<5;k++){
    box(x+(k-2)*.18,3.83,z+.67,.12,.27,.14,'bone',.03);
    box(x+(k-2)*.19,1.80,z+.70,.085,.19,.085,k%2?'sulfur':'magma',.36);
   }
   for(let k=0;k<4;k++){
    beam(x+side*.17,4.44,z-.49,x+side*(.3+k*.15),5.13+k*.13,z-.22,
      .085,'bone',.03);
   }
  }
 }
 // A huge original ossuary entrance relief. It looks monumental without
 // copying a trademark skull sculpt or moving the actual collision doorway.
 for(const side of [-1,1]){
  const x=C+side*2.6,z=1.9;
  box(x,4.22,z,.72,4.1,1.10,'hellstone',.033);
  box(x+side*.07,4.48,z+.58,.50,.69,.19,'obsidian',.023);
  box(x,4.46,z+.715,.25,.21,.10,'magma',.33);
  beam(x-side*.15,6.1,z,x+side*.70,7.12,z-.27,.23,'bone',.021);
  beam(x+side*.70,7.12,z-.27,x+side*1.32,6.76,z-.60,
    .12,'bone',.026);
  for(let k=0;k<4;k++)
   box(x+side*(.08+k*.15),2.75+k*.23,z+.60,.15,.22,.23,
    k%2?'bone':'ash',.016);
 }
 // Forged black iron cages and bone chandeliers suspended from roof.
 for(const [i,coords] of [[0,[8.5,9.0]],[1,[22.5,9.0]],
  [2,[8.5,21.8]],[3,[22.5,21.8]]]){
  const [x,z]=coords;
  box(x,6.75,z,.88,.18,.88,'hellstone',.036);
  box(x,4.95,z,.84,.21,.84,'obsidian',.032);
  beam(x,7.45,z,x,6.84,z,.078,'ironblack',.018);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   beam(x+sx*.36,6.64,z+sz*.36,x+sx*.35,5.06,z+sz*.35,
    .064,'bone',.024);
  }
  box(x,5.31,z,.25,.36,.22,'magma',.37);
 }
 // Low, jagged inlaid molten cracks, never actual holes or movement barriers.
 for(let i=0;i<(battery?35:high?105:67);i++){
  const angle=i*2.39996,rad=3.9+(i%9)*.75;
  const x=C+Math.cos(angle)*rad,z=C+Math.sin(angle)*rad;
  if(x<2||z<2||x>N-2||z>N-2||tile(x,z))continue;
  const len=.25+(i%5)*.065,bright=i%6===0;
  box(x,.024,z,len,.004,.027,'charcoal',.022,angle);
  box(x,.027,z,len*.63,.003,.012,bright?'magma':'cinder',
   bright?.18:.065,angle);
  if(i%4===0)box(x+.14*Math.cos(angle),.029,z+.14*Math.sin(angle),
    .16,.003,.018,'sulfur',.038,angle+.35);
 }
 // High-contrast stepped rear silhouette and mineral hanging teeth.
 for(let i=0;i<14;i++){
  const x=2.4+i*2.05,z=(i%2?N-1.1:1.2),h=3.5+i%4*.45;
  box(x,7.1-h*.45,z,.42,h,.47,i%3?'obsidian':'hellstone',.02);
  beam(x,7.1-h*.95,z,x+(i%2?.18:-.13),6.95-h*.55,z+.16,
    .11,'bone',.03);
 }
}
function drawInfernoAtmosphere(m,p,quality){
 const battery=quality==='battery',high=quality==='high';
 const n=battery?16:high?62:36;
 infernalAtmosphereDots=0;
 // Depth-stable drifting ash, sporadic molten shrapnel, hanging steam.
 // Fixed deterministic positions: never mutate global random seed per frame.
 for(let i=0;i<n;i++){
  const a=i*11.71,b=i*17.63;
  const x=p.x+((((Math.sin(a)*981.4+time*(i%3?.04:.12))%17)+25)%17)-8.5;
  const z=p.z+((((Math.cos(b)*991.9+time*(i%4?.07:.16))%17)+25)%17)-8.5;
  const y=.32+((i*.307+time*(i%5?.10:.26))%5.65);
  if(x<1.4||x>N-1.4||z<1.4||z>N-1.4||tile(x,z))continue;
  const glow=i%9===0?.31:.028;
  m.box(x,y,z,i%6===0?.036:.023,i%5===0?.072:.044,.021,
    i%9===0?'sulfur':'ash',glow);
  infernalAtmosphereDots++;
 }
 // Architectural fire pulses, small separate light sources, not laser beams.
 for(let i=0;i<(battery?3:high?9:6);i++){
  const x=C+(i%2?-10.35:10.35),z=[7.1,16.6,24.0][Math.floor(i/2)%3];
  if(Math.hypot(x-p.x,z-p.z)>22)continue;
  const pulse=.65+.35*Math.sin(time*(5+i*.1)+i*2.6)**2;
  for(let j=0;j<(high?4:2);j++){
   const a=time*1.1+i+j*1.66;
   const xx=x+Math.sin(a)*.17,yy=2.60+j*.23+.14*Math.sin(time*4+j);
   m.beam(xx,yy,z+.75,xx+Math.sin(a*.7)*.08,yy+.29+j*.04,z+.72,
    .041,'magma',.20+.20*pulse);
  }
 }
}


/* Three original, fully dressed infernal rooms. All raised props hug
 * collision-backed walls or the ceiling; walkable floors stay unobstructed.
 */
function addHellRoomProps(m){
 const rooms=[{from:3,to:9,mat:'bone'},
 {from:11,to:20,mat:'hellstone'},{from:22,to:27,mat:'charcoal'}];
 for(let room=0;room<rooms.length;room++){
  const spec=rooms[room];
  for(const side of [-1,1]){
   const x=side<0?2.25:N-2.25;
   for(let z=spec.from;z<=spec.to;z+=2.65){
    m.box(x,4.55,z,.60,4.85,.89,spec.mat,.03);
    m.box(x-side*.24,5.08,z,.16,2.34,.28,'bone',.03);
    for(let j=0;j<4;j++){
     const color=j===1?'scar':j===2?'wound':'obsidian';
     m.box(x-side*.35,3.30+j*.33,z+.44,.11,.19,.10,color,.02);
    }
   }
  }
  // Large hanging bone chandeliers, a complete room ceiling and
  // rib-like arches make each section distinct from the Matrix zone.
  for(let j=0;j<6;j++){
   const x=4.5+j*4.3,z=spec.from+1.6+j%2*.48;
   m.beam(x,7.20,z,x+.31*Math.sin(j*2),5.38,z-.31,
      .15,'bone',.03);
   m.beam(x+.31*Math.sin(j*2),5.38,z-.31,
      x+.52*Math.sin(j*2),4.75,z-.50,.08,'sinew',.028);
  }
  for(let x=3;x<N-3;x+=1.75)for(const z of [spec.from+.33,spec.to-.25]){
   if(tile(x,z))continue;
   m.box(x,.023,z,1.0,.003,.026,
    room===0?'bone':room===1?'cinder':'charcoal',.024);
  }
 }
 // The two dividing walls exist in the collision grid and carry immense
 // overhead archways, not fake screens across the passage.
 for(const z of [10,21]){
  m.box(C,7.10,z,11.5,.52,.65,'obsidian',.031);
  for(const side of [-1,1]){
   const x=C+side*5.25;
   m.box(x,4.77,z,.73,4.6,.69,'hellstone',.028);
   m.box(x-side*.21,4.47,z+.36,.20,2.28,.15,'bone',.028);
   for(let i=0;i<4;i++)
    m.beam(x,6.68,z+.08,x+side*(i+1)*.34,
      7.11-i*.14,z+.31,.083,'bone',.026);
  }
 }
}

/* AFTERLIGHT v0.38: original rune-inspired physical incisions.
 * Reference: historic Futhark's cuttable straight stems and branches.
 * These are ORIGINAL fictional combinations, not translated Norse prayers,
 * copied game/occult symbols, fonts or floating neon glyph textures.
 * Stamped into the actual world floor and wall/slab geometry.
 */
const INFERNAL_RUNE_STROKES=Object.freeze([
 // 10 different straight-segment symbols. Each segment is normalized XY
 // around a fixed chisel origin and forms a physical V-shaped incision.
 [[-.30,-.44,-.30,.45],[-.30,.32,.26,.44],[.26,.44,-.12,.09],[-.12,.09,.28,-.10]],
 [[-.27,-.45,-.27,.45],[.23,-.45,.23,.45],[-.27,.27,.23,.02],[.23,.02,-.27,-.24]],
 [[-.34,.43,0,-.39],[.34,.43,0,-.39],[-.19,.13,.19,.13],[0,-.39,0,-.46]],
 [[-.33,-.39,-.33,.43],[-.33,.43,.26,.43],[.26,.43,-.05,.03],[-.05,.03,.28,-.39]],
 [[-.31,.44,-.31,-.40],[.31,.44,.31,-.40],[-.31,.28,.31,-.17],[-.31,-.23,.31,.27]],
 [[-.33,-.40,.27,.38],[-.33,.38,.27,-.40],[-.10,.13,.12,.13],[-.10,-.13,.12,-.13]],
 [[-.32,.43,.30,.43],[.30,.43,-.30,-.43],[-.30,-.43,.30,-.43],[-.13,.15,.14,.15]],
 [[0,-.44,0,.44],[-.35,.22,0,.44],[0,.44,.35,.22],[-.35,-.25,0,-.06],[0,-.06,.35,-.25]],
 [[-.29,-.42,-.29,.43],[-.29,.43,.29,.19],[.29,.19,-.29,-.08],[-.29,-.08,.29,-.42]],
 [[-.34,.39,.34,.39],[-.34,-.39,.34,-.39],[-.34,.39,.07,0],[.34,-.39,-.07,0]]
]);
const HELL_GLYPHS=[
 {x:15.5,z:15.5,wall:false,seed:.5,r:1.15,glyph:8,hero:true},
 {x:15.5,z:7.5,wall:false,seed:2.7,r:.90,glyph:1},
 {x:7.6,z:15.5,wall:false,seed:1.8,r:.82,glyph:5},
 {x:23.2,z:15.4,wall:false,seed:3.9,r:.84,glyph:6},
 {x:15.5,z:25.5,wall:false,seed:4.9,r:1.00,glyph:3},
 {x:6.5,z:1.04,wall:true,seed:4.0,r:.86,glyph:2},
 {x:15.5,z:1.04,wall:true,seed:2.2,r:1.12,glyph:7,portal:true},
 {x:24.5,z:1.04,wall:true,seed:3.1,r:.91,glyph:4},
 {x:6.5,z:N-1.05,wall:true,seed:1.4,r:.90,glyph:9},
 {x:24.5,z:N-1.05,wall:true,seed:5.0,r:.97,glyph:0},
 {x:1.04,z:14.0,wall:true,side:true,seed:3.2,r:.70,glyph:7},
 {x:N-1.04,z:19.1,wall:true,side:true,seed:1.9,r:.78,glyph:2},
 // Ritual ring inscriptions arranged tangentially around central nave.
 ...Array.from({length:12},(_,i)=>{
  const a=i*Math.PI/6,rad=2.27;
  return {x:C+Math.cos(a)*rad,z:C+Math.sin(a)*rad,
   wall:false,seed:i*.91+6.0,r:.42,glyph:(i*7+1)%10,
   angle:a+Math.PI/2,ring:true};
 })
];
let infernalRunesVisible=0,infernalCracksVisible=0,runicTriangles=0,
 runicCarvedStaticTriangles=0,runicTerrainTriangles=0;
function runePoint(r,u,v,offset=0){
 if(r.wall){
  const north=r.z<C;
  if(r.side){
   const left=r.x<C;
   return [r.x+(left?.090:-.090)+offset*(left?1:-1),
    3+v*r.r,r.z+u*r.r];
  }
  return [r.x+u*r.r,3+v*r.r,
   r.z+(north?(r.portal?.124:.09):-(r.portal?.124:.09))+offset*(north?1:-1)];
 }
 const a=r.angle||0,ca=Math.cos(a),sa=Math.sin(a);
 return [r.x+(u*ca-v*sa)*r.r,
  .042+offset,r.z+(u*sa+v*ca)*r.r];
}
/* Flat stroke as two actual depth-tested surface triangles. Standard
 * camera-facing ribbons visibly float and rotate away from wall surfaces,
 * so use the slab's own surface normal for robust all-angle rendering. */
function runeCutLine(m,a,b,width,color,em,wall,side,north){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
 const length=Math.hypot(dx,dy,dz);
 if(length<.012)return;
 let ux,uy,uz;
 if(!wall){ux=-dz/length;uy=0;uz=dx/length}
 else if(side){ux=0;uy=-dz/length;uz=dy/length}
 else{ux=-dy/length;uy=dx/length;uz=0}
 const h=width*.5;
 const pt=[
  [a[0]-ux*h,a[1]-uy*h,a[2]-uz*h],
  [a[0]+ux*h,a[1]+uy*h,a[2]+uz*h],
  [b[0]+ux*h,b[1]+uy*h,b[2]+uz*h],
  [b[0]-ux*h,b[1]-uy*h,b[2]-uz*h]
 ];
 const normal=wall?(side?[north?1:-1,0,0]:[0,0,north?1:-1]):[0,1,0];
 const cross=[
  (pt[1][1]-pt[0][1])*(pt[2][2]-pt[0][2])-(pt[1][2]-pt[0][2])*(pt[2][1]-pt[0][1]),
  (pt[1][2]-pt[0][2])*(pt[2][0]-pt[0][0])-(pt[1][0]-pt[0][0])*(pt[2][2]-pt[0][2]),
  (pt[1][0]-pt[0][0])*(pt[2][1]-pt[0][1])-(pt[1][1]-pt[0][1])*(pt[2][0]-pt[0][0])
 ];
 const outward=cross[0]*normal[0]+cross[1]*normal[1]+cross[2]*normal[2]>0;
 const seq=outward?[0,1,2,0,2,3]:[0,2,1,0,3,2];
 const c=HEX[color];
 for(const i of seq)m.v(pt[i],normal,c,em,pt[i][0],pt[i][2]);
 runicTriangles+=2;
}
function runeDrawMark(m,r,emissive,quality='balanced'){
 const strokes=INFERNAL_RUNE_STROKES[r.glyph%INFERNAL_RUNE_STROKES.length];
 const wall=!!r.wall,wallSide=!!r.side,north=wallSide?r.x<C:r.z<C;
 for(let i=0;i<strokes.length;i++){
  const [x1,y1,x2,y2]=strokes[i];
  // The same chiseled stroke has an irregular stone-coloured lip,
  // a recessed dark cut, and only a thin emissive core when active.
  if(emissive<=0){
   runeCutLine(m,runePoint(r,x1,y1,.003),runePoint(r,x2,y2,.003),
    .102,'ash',.008,wall,wallSide,north);
   runeCutLine(m,runePoint(r,x1,y1,.007),runePoint(r,x2,y2,.007),
    .075,'wound',.004,wall,wallSide,north);
  }else if(quality!=='battery'||i%2===0){
   const bias=.5+.5*Math.sin(time*.79+r.seed+i*1.13);
   const lit=emissive*(.33+.67*bias);
   runeCutLine(m,runePoint(r,x1,y1,.011),runePoint(r,x2,y2,.011),
    .017,lit>.30?'magma':'scar',lit*.43,wall,wallSide,north);
  }
 }
}
function drawInfernalRuneCarvings(m){
 runicTriangles=0;
 // Unlike previous disconnected glowing strokes, the carvings are physically
 // embedded into textured matte slabs and survive when the pulse turns off.
 for(const rune of HELL_GLYPHS){
  if(rune.portal&&BLENDER_KIT?.hell_runestone){
   // A REAL native Blender Boolean-cut piece with carved depth, not a
   // decal stuck on the wall. One nearest portal stone per chapel.
   blenderPart(m,'hell_runestone',rune.x,3,rune.z,1,Math.PI);
   continue;
  }
  if(rune.wall){
   if(rune.side){
    const left=rune.x<C,x=rune.x+(left?.025:-.025);
    m.box(x,3,rune.z,.100,1.95*rune.r,1.7*rune.r,'obsidian',.007);
    m.box(x+(left?.052:-.052),3,rune.z,.018,1.71*rune.r,1.50*rune.r,'charcoal',.002);
   }else{
    m.box(rune.x,3,rune.z,1.72*rune.r,1.92*rune.r,.108,'obsidian',.006);
    m.box(rune.x,3,rune.z+(rune.z<C?.056:-.056),
     1.53*rune.r,1.75*rune.r,.018,'charcoal',.002);
   }
  }else if(!rune.ring&&!tile(rune.x,rune.z)){
   // A slight raise is purely visible; foot collision remains the same y=0.
   m.box(rune.x,.016,rune.z,1.66*rune.r,.044,1.67*rune.r,'obsidian',.006);
  }
  if(!rune.wall&&tile(rune.x,rune.z))continue;
  runeDrawMark(m,rune,0);
 }
 // Floor arc engraved as broken, uneven stone segments around the ritual boss
 // nave, not a rotating opaque laser or HUD graphic.
 for(let i=0;i<36;i++){
  if(i%11===0)continue; // physical gaps and erosion
  const a=i*TAU/36,b=(i+1)*TAU/36;
  const r=3.19,seed=.03*Math.sin(i*17);
  runeCutLine(m,[C+Math.cos(a)*(r+seed),.039,C+Math.sin(a)*(r+seed)],
   [C+Math.cos(b)*(r+seed),.039,C+Math.sin(b)*(r+seed)],
   .081,'wound',.005,false,false,true);
 }
 runicCarvedStaticTriangles=runicTriangles;
}
function renderInfernalRunes(m,p,quality){
 infernalRunesVisible=0;infernalCracksVisible=0;runicTriangles=0;
 if(hellBreach.state!=='active')return;
 const battery=quality==='battery',high=quality==='high';
 const max=battery?5:high?15:10;
 const drawRange=battery?9:high?16:12;
 const activeStage=hellBreach.stage===3?1.35:hellBreach.stage===2?1.12:1;
 for(const r of HELL_GLYPHS){
  if(infernalRunesVisible>=max)break;
  const runeDistance=Math.hypot(r.x-p.x,r.z-p.z);
  if(runeDistance>drawRange)continue;
  if(!r.wall&&tile(r.x,r.z))continue;
  const beat=.50+.50*Math.sin(time*(r.portal?1.38:.84)+r.seed);
  const nearEnemy=enemies.some(e=>e.hellVariant&&e.hp>0&&
   Math.hypot(e.x-r.x,e.z-r.z)<(r.hero?3.2:1.65));
  const pulse=clamp((.22+.23*beat)*(nearEnemy?1.65:1)*activeStage,0,.8)*(1.-Math.min(1,Math.max(0,(runeDistance-7)/(drawRange-7))));
  runeDrawMark(m,r,pulse,quality);
  infernalRunesVisible++;
  // High-quality cracks ignite briefly, traveling outward from a rune.
  // Surface-contained lines have no collision and do not flicker at camera.
  if(quality!=='battery'&&r.hero&&runeDistance<11){
   for(let arm=0;arm<(high?6:4);arm++){
    const a=r.seed+arm*TAU/6,rad=.66+(arm%2)*.18;
    const wave=(.5+.5*Math.sin(time*.9+arm*1.5));
    for(let seg=0;seg<3;seg++){
     const t=seg/3,u=(seg+1)/3;
     const a0=[r.x+Math.cos(a+.13*t)*rad*t,.050,r.z+Math.sin(a+.15*t)*rad*t];
     const b0=[r.x+Math.cos(a+.13*u)*rad*u,.050,r.z+Math.sin(a+.15*u)*rad*u];
     runeCutLine(m,a0,b0,.017,
       wave>.68&&seg===Math.floor(wave*3)%3?'ember':'wound',
       wave>.68?.16:.005,false,false,true);
     infernalCracksVisible++;
    }
   }
  }
 }
}


/* Native mesh relief based on displacement/proportional-edit terrain lessons:
 * irregular raised stone facets and independent ash colours from one seeded
 * coordinate field. Level collision is still flat, so monsters never trip
 * over purely decorative pebbles. No downloading textured assets. */
function buildInfernalStoneRelief(m,x,z,seed){
 const mat=HEX[(seed%5===0)?'ash':seed%3===0?'hellstone':'charcoal'];
 const h=(u,v)=>.017+.008*Math.sin((x+u)*9.7+(z+v)*4.9)+
                    .006*Math.sin((x+u)*22.2-(z+v)*13.7);
 const r=.44+seed%3*.045;
 const center=[x+.5,h(.5,.5)+.009,z+.5],bounds=[];
 for(let i=0;i<7;i++){
  const a=i*TAU/7,rr=r*(.81+.18*Math.sin(seed*4.13+i*7.19));
  const px=x+.5+Math.cos(a)*rr,pz=z+.5+Math.sin(a)*rr;
  bounds.push([px,h(px-x,pz-z)+.014,pz]);
 }
 for(let i=0;i<7;i++){
  const a=center,b=bounds[(i+1)%7],c=bounds[i];
  const nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
  const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
  const nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const len=Math.max(.0001,Math.hypot(nx,ny,nz));
  const normal=[nx/len,Math.abs(ny/len),nz/len];
  const contrast=.70+.17*Math.sin(seed*7.31+i*2.37);
  const color=mat.map(v=>v*contrast);
  for(const p of [a,b,c])m.v(p,normal,color,.009,p[0],p[2]);
  runicTerrainTriangles++;
 }
}

function buildHellStatic(){
 const m=new Mesh(),high=$('quality').value==='high';
 runicTerrainTriangles=0;runicCarvedStaticTriangles=0;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const wall=!!map[z][x],v=(x*7+z*13)%9;
  m.box(x+.5,-.27,z+.5,.99,.52,.99,v===0?'rust':'black',.008);
  if(wall){
   m.box(x+.5,3.70,z+.5,1.01,7.40,1.01,v%3===0?'rust':'dark',.018);
   for(let i=0;i<2;i++){
    const px=x+.22+i*.52,fire=(x+z)%7===0;
    if(fire)m.box(px,6.65,z+.5,.065,.32,.15,'red',.17);
   }
  }else{
   // Chapel uses exactly the same level walkable ground as the main campaign.
   // Black basalt, ash-covered worn plating, shallow seams. Nothing protrudes
   // enough to catch shoes or invalidate the map's zero-height collisions.
   m.box(x+.5,-.005,z+.5,.97,.028,.97,
    v===0?'rust':v===1?'obsidian':v===2?'hellstone':'charcoal',.009);
   m.box(x+.5,-.014,z+.5,.78,.018,.78,v<3?'obsidian':'ash',.009);
   // Sculpted normal-varying low-relief facets disrupt the repeating tile grid.
   if((x*11+z*19)%4===0)buildInfernalStoneRelief(m,x,z,x*7+z*23);
   if(v===1){
    m.box(x+.5,.012,z+.5,.68,.006,.032,'red',.12);
    m.box(x+.5,.013,z+.5,.46,.004,.012,'warm',.07);
   }
   if(v===2){
    m.box(x+.5,.013,z+.5,.57,.005,.16,'black',.015);
    for(let j=-2;j<=2;j++)
     m.box(x+.5+j*.11,.016,z+.5,.018,.003,.14,'rust',.025);
   }
   if((x*19+z*7)%13===0){
    // Irregular fractures remain inlaid; the dark parts are not real pits.
    m.box(x+.40,.012,z+.42,.40,.005,.021,'black',.025,(x+z)%3*.26);
    m.box(x+.58,.014,z+.53,.24,.003,.012,'red',.09,(x+z)%5*.11);
   }
   if((x+z)%11===0){
    // Tiny flat iron staples across the cracks and a trace of cooled ash.
    m.box(x+.30,.014,z+.30,.12,.004,.030,'brass',.025);
    m.box(x+.67,.014,z+.65,.22,.004,.09,'black',.03);
   }
  }
 }

 // Genuine raised chapel architecture: high buttresses, ribbed vaults,
 // hanging cages and dark iron tracery. All floor-level details are inlaid.
 for(let z=2;z<N-2;z+=4)for(let x of [1,N-2]){
  if(!tile(x+.5,z+.5))continue;
  const toward=x===1?1:-1,cx=x+.5+toward*.39,cz=z+.5;
  m.box(cx,3.78,cz,.22,7.23,.25,'rust',.035);
  m.box(cx,6.93,cz,.43,.22,.45,'titanium',.05);
  for(let j=0;j<3;j++){
   const yy=1.2+j*2.0;
   m.beam(cx,yy,cz,cx+toward*.37,yy+.79,cz,.075,'rust',.03);
  }
  m.box(cx+toward*.14,5.93,cz,.12,.26,.15,'red',.11);
 }
 // Banded arches over the center aisle create a layered horror silhouette.
 for(let z=3;z<N-2;z+=6){
  const y=6.66;
  for(let i=0;i<8;i++){
   const x1=3.0+i*3.2,x2=x1+3.2;
   const archY=y+.34*Math.sin(i/8*Math.PI);
   m.beam(x1,archY,z,x2,archY,z,.075,'rust',.04);
   if(i%2===0)m.beam(x1,archY,z,x1+1.2,7.30,z,.049,'polished',.025);
  }
  for(const x of [5.0,25.0]){
   m.box(x,6.44,z,.43,.40,.43,'black',.02);
   m.box(x,6.22,z,.18,.072,.19,'red',.22);
   for(const side of [-1,1])m.beam(x+side*.16,6.21,z,x+side*.23,6.85,z,.025,'titanium',.03);
  }
 }
 // Gothic and mechanical floor inscriptions: no raised obstacle.
 for(let k=0;k<24;k++){
  const a=k*TAU/24,x=C+Math.cos(a)*5.1,z=C+Math.sin(a)*5.1;
  if(tile(x,z))continue;
  m.box(x,.018,z,.22,.004,.034,k%3===0?'red':'rust',.065,a);
  if(k%4===0)m.beam(x,.019,z,x+Math.cos(a+.75)*.44,.019,z+Math.sin(a+.75)*.44,
    .017,'brass',.027);
 }

 const segments=high?24:14;
 for(let k=0;k<segments;k++){
  const a=k*TAU/segments,x=C+Math.cos(a)*8,z=C+Math.sin(a)*8;
  m.beam(x,.018,z,C+Math.cos(a+.18)*6,.018,C+Math.sin(a+.18)*6,
   .045,'rust',.04);
  if(k%3===0)for(let j=0;j<3;j++)
   m.beam(x,1.3+j*.56,z,x+.3*Math.cos(a),1.9+j*.6,z+.3*Math.sin(a),
    .12,'black',.035);
 }
 // OPEN INFERNAL SKY: former ceiling collided with high-angle shots.
 // The atmospheric sky remains visible and no roof blocks the player's aim.
 for(let i=0;i<10;i++){
  const a=i*TAU/10,px=C+Math.cos(a)*11,pz=C+Math.sin(a)*11;
  if(tile(px,pz))continue;
  m.box(px,.07,pz,.34,.07,.36,'rust',.025);
  m.box(px,.11,pz,.16,.02,.17,'magma',.18);
 }
 buildStyleGeometry(m);
 addHellRoomProps(m);
 drawInfernalRuneCarvings(m);
 // Original large runic portal/sigil: only low emissive, no opaque lasers.
 for(let i=0;i<16;i++){
  const a=i*TAU/16,b=(i+1)*TAU/16;
  m.beam(C+Math.cos(a)*2.25,.019,C+Math.sin(a)*2.25,
   C+Math.cos(b)*2.25,.019,C+Math.sin(b)*2.25,
   .03,'red',.14);
 }
 upload(staticGPU,m.data);
}

/* v0.40 Celestial encounter. Ophanim: Ezekiel's wheels/eyes, seraphic wings. */
function createHeavenMap(){
 map.length=0;
 for(let z=0;z<N;z++){
  const row=[];
  for(let x=0;x<N;x++){
   const edge=x===0||z===0||x===N-1||z===N-1;
   const column=(x===4||x===N-5)&&(z===4||z===N-5);
   // The three-by-three altar footprint is solid in the physics map.
   const altar=x>=14&&x<=16&&z>=4&&z<=6;
   row.push(edge||column||altar?1:0);
  }
  map.push(row);
 }
}
function buildHeavenStatic(){
 const m=new Mesh(),high=$('quality').value==='high';
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const v=(x*7+z*11)%13,solid=!!map[z][x];
  const altar=x>=14&&x<=16&&z>=4&&z<=6;
  m.box(x+.5,-.27,z+.5,.99,.50,.99,solid?'polished':'white',.015);
  if(solid&&!altar){
   m.box(x+.5,3.3,z+.5,1,6.6,1,v%4===0?'gold':'chrome',.04);
   m.box(x+.5,6.2,z+.5,1.08,.28,1.08,'gold',.18);
  }else{
   m.box(x+.5,.012,z+.5,.95,.024,.95,v<3?'polished':'white',.035);
   if((x+z)%5===0)m.box(x+.5,.026,z+.5,.67,.009,.67,'chrome',.065);
   if(x===15||z===15)m.box(x+.5,.035,z+.5,x===15?.032:.85,.008,z===15?.032:.85,'gold',.18);
  }
 }
 // Cathedral arches and vaulted ribs sit above the combat collision plane.
 for(const z of [6,12,19,25]){
  for(const side of [-1,1]){
   const x=C+side*10.2;
   m.box(x,2.2,z,.63,4.2,.63,'white',.12);
   m.box(x,4.5,z,1.0,.29,1.0,'gold',.18);
   for(let j=0;j<9;j++){
    const t=j/8;
    m.beam(x,4.5,z,x-side*(.5+t*8),4.5+1.4*Math.sin(t*Math.PI),z,
      .04,j%3?'white':'gold',.18);
   }
  }
 }
 const n=high?16:10;
 for(let i=0;i<n;i++){
  const a=i*TAU/n,x=C+Math.cos(a)*9.8,z=C+Math.sin(a)*9.8;
  m.box(x,1.7,z,.33,3.3,.33,'gold',.10);
  m.box(x,3.48,z,.70,.22,.70,'white',.19);
 }
 m.box(C,.27,5.5,3.1,.54,2.1,'polished',.15);
 m.box(C,.70,5.5,2.3,.34,1.3,'white',.30);
 m.box(C,1.08,5.5,.78,.45,.70,'gold',.81);
 upload(staticGPU,m.data);
}
function drawHeavenAtmosphere(m,p,q){
 if(heavenSanctum.state!=='active')return;
 const n=q==='battery'?12:q==='high'?48:25;
 for(let i=0;i<n;i++){
  const x=2+((i*7.173)%26),z=2+((i*11.371)%26);
  if(Math.hypot(x-p.x,z-p.z)>18)continue;
  const y=4.1+(i%5)*.42+.22*Math.sin(time*.7+i);
  m.box(x,y,z,.18+(i%3)*.12,.06,.24,i%8===0?'gold':'white',.19);
 }
}
function renderHeavenPortal(m,q){
 if(heavenSanctum.state!=='gate')return;
 const x=heavenSanctum.gateX,z=heavenSanctum.gateZ;
 const n=q==='battery'?12:q==='high'?30:20,p=.77+.23*Math.sin(time*2.4);
 for(let i=0;i<n;i++){
  const a=i*TAU/n,b=(i+1)*TAU/n,r=1.25;
  m.beam(x+Math.cos(a)*r,.09,z+Math.sin(a)*r,
    x+Math.cos(b)*r,.09,z+Math.sin(b)*r,.035,'gold',.62*p);
  m.beam(x+Math.cos(a)*r*.65,.08,z+Math.sin(a)*r*.65,
    x+Math.cos(a+time*.08)*r*.65,5.8,z+Math.sin(a+time*.08)*r*.65,
    .023,'white',.15*p);
 }
 m.box(x,.025,z,1.5,.035,1.5,'white',.5);
 drawRealmPortalFX(m,x,z,'heaven',q);
}
function renderHeavenAltar(m,q){
 if(heavenSanctum.state!=='active')return;
 const x=C,z=5.5,n=q==='battery'?12:24;
 for(let i=0;i<n;i++){
  const a=i*TAU/n+time*.18,b=(i+1)*TAU/n+time*.18;
  m.beam(x+Math.cos(a)*1.2,1.8+Math.sin(a)*.28,z+Math.sin(a)*.6,
    x+Math.cos(b)*1.2,1.8+Math.sin(b)*.28,z+Math.sin(b)*.6,
    .028,'gold',.63);
 }
 m.box(x,1.70+Math.sin(time*1.4)*.10,z,.45,.36,.45,'white',1.4);
}
function renderOphanim(m,e,q){
 const x=e.x,z=e.z,y=2.85+.17*Math.sin(time*1.6+e.id);
  // Heaven guardian: pearl/cyan with amethyst eyes; roaming Ophanim boss stays gold.
  const guardianHalo=e.sanctumGuardian?'cyan':'gold';
  const guardianIris=e.sanctumGuardian?'purple':'blue';
 const n=q==='battery'?18:q==='high'?42:30,w=time*.56;
 // Three physically intersecting, spinning wheels; each has repeated eyes.
 for(let layer=0;layer<3;layer++){
  const r=layer===1?1.72:layer===2?1.20:1.43;
  const pt=(a)=>{
   const u=Math.cos(a)*r,v=Math.sin(a)*r;
   return layer===0?[x+u,y+v,z]:
     layer===1?[x+u*.59,y+v,z+u*.81]:[x+u*.53,y+u*.45,z+v];
  };
  for(let k=0;k<n;k++){
   const a=k*TAU/n+w*(layer===1?-1:1)+layer*.35,b=a+TAU/n;
   const v=pt(a),t=pt(b);
   m.beam(...v,...t,.053,guardianHalo,e.hit>0?.8:.34);
   if(k%3===0){
    const eye=pt(a+TAU/n*.5);
    m.box(eye[0],eye[1],eye[2],.23,.19,.12,'white',.47);
    m.box(eye[0],eye[1],eye[2]-.072,.10,.11,.055,guardianIris,1.45);
    m.box(eye[0],eye[1],eye[2]-.103,.036,.05,.022,'black',.21);
   }
  }
 }
 m.box(x,y,z,.70,.72,.70,guardianHalo,1.3);
 m.box(x,y,z-.38,.27,.29,.14,guardianIris,1.95);
 // Six articulated feather fans use the same actual wing root.
 const fans=q==='battery'?4:6,feathers=q==='battery'?5:9;
 for(let j=0;j<fans;j++){
  const side=j%2?-1:1,row=Math.floor(j/2);
  const rootX=x+side*.35,rootY=y+.15+(1-row)*.17;
  const flap=.22*Math.sin(time*2.4+j*.3);
  for(let f=0;f<feathers;f++){
   const t=f/(feathers-1),reach=1.45+(2-row)*.16;
   const tx=rootX+side*(.7+1.1*t)*reach;
   const ty=rootY+(1.1-t*1.6+flap)*reach;
   const tz=z+(t-.5)*.95;
   m.beam(rootX,rootY,z,tx,ty,tz,.049,f%3===0?guardianHalo:'white',.24);
  }
 }
 if(e.ultimateStage==='charge'||e.ultimateStage==='fire'){
  const r=4.45,count=q==='battery'?14:28;
  for(let i=0;i<count;i++){
   const a=i*TAU/count,b=(i+1)*TAU/count;
   m.beam(x+Math.cos(a)*r,.07,z+Math.sin(a)*r,
    x+Math.cos(b)*r,.07,z+Math.sin(b)*r,.031,guardianHalo,
    e.ultimateStage==='charge'?.39:1.3);
  }
 }
}
function ophanimTick(e,dt){
 if(e.hp<=0)return;
 e.hit=Math.max(0,e.hit-dt);
 if(e.sanctumGuardian&&!e.sanctumHostile){e.moveSpeed=0;e.ultimateStage='idle';return;}
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);
 e.facing=Math.atan2(dx,-dz);
 if(e.ultimateStage==='charge'){
  e.ultimateT-=dt;
  if(e.ultimateT<=0){e.ultimateStage='fire';e.ultimateT=1.55;e.ultimateTick=0;}
  return;
 }
 if(e.ultimateStage==='fire'){
  e.ultimateT-=dt;e.ultimateTick-=dt;
  if(e.ultimateTick<=0){
   e.ultimateTick=.42;
   if(dist<4.1&&lineClear(e.x,e.z,player.x,player.z))hitPlayer(13);
   if(dist<20&&lineClear(e.x,e.z,player.x,player.z)){
    const aim=Math.atan2(dx,-dz);
    for(const offset of [-.21,0,.21]){
     const a=aim+offset,speed=5.6,px=e.x+Math.sin(a)*.7,pz=e.z-Math.cos(a)*.7;
     if(free(px,pz,.12))projectiles.push({x:px,y:1.47,z:pz,
      vx:Math.sin(a)*speed,vz:-Math.cos(a)*speed,life:3.4,col:'gold',
      damage:10+cycleOf(wave)});
    }
    if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
   }
  }
  if(e.ultimateT<=0){e.ultimateStage='idle';e.ultimateClock=5.4;}
  return;
 }
 e.ultimateClock-=dt;
 if(e.ultimateClock<=0&&dist<21&&lineClear(e.x,e.z,player.x,player.z)){
  e.ultimateStage='charge';e.ultimateT=1.85;
  notice('THE OPHANIM // JUDGEMENT CHARGING',2);sound('angelcharge');return;
 }
 if(dist>7.1&&dist<28){
  const oldX=e.x,oldZ=e.z,movement=Math.min(e.speed,e.sanctumGuardian?1.42:.7)*dt;
  collisionMove(e,dx/Math.max(.1,dist)*movement,dz/Math.max(.1,dist)*movement,.71);
  e.moveSpeed=Math.hypot(e.x-oldX,e.z-oldZ)/Math.max(.001,dt);
 }else e.moveSpeed=0;
}
function beginHeavenSanctum(restored=null){
 if(!restored&&heavenSanctum.state!=='gate')return false;
 heavenSanctum={...heavenSanctum,...(restored||{}),state:'active',
  returnWave:restored?.returnWave||wave,
  returnSector:restored?.returnSector??sector,entered:time};
 player.x=C;player.z=N-5;player.vx=0;player.vz=0;player.height=0;player.verticalVel=0;
 enemies=[];spawnPending=0;projectiles=[];lingeringBeams=[];tracers=[];
 inputs.shoot=false;inputs.fire=null;interactProgress=0;
 createHeavenMap();buildStatic();
 // Whether the guardian is peaceful depends on Hell victory THIS run.
 const wrath=!!(restored?.guardianHostile ?? !hellBreach.conqueredThisRun);
 heavenSanctum.guardianHostile=wrath;
 if(!heavenSanctum.guardianDefeated){
  const judge=newEnemy({x:C,z:C},false);
  judge.type='ophanim';judge.boss=true;judge.sanctumGuardian=true;
  judge.sanctumHostile=wrath;
  judge.hp=judge.maxHp=(wrath?2600:1800)*cycleDifficulty(wave).hp;
  judge.speed=wrath?1.65:.85;
  judge.ultimateClock=wrath?1.2:99;judge.ultimateStage='idle';
  judge.attackT=99;judge.damageAtSpawn=runRecord.damageEvents;
  enemies.push(judge);
 }
 afterlightSceneTransition('THE HEAVEN SANCTUM');
 sound('heavenenter');announce('THE HEAVEN SANCTUM // BEYOND THE VEIL',4);
 notice(wrath?'THE OPHANIM JUDGES YOU · SURVIVE ITS WRATH':'THE OPHANIM REMAINS PEACEFUL · DO NOT ATTACK IT',4);
 saveCheckpoint();return true;
}
function finishHeavenSanctum(){
 if(heavenSanctum.state!=='active')return false;
 if(enemies.some(e=>e.sanctumGuardian&&e.sanctumHostile&&e.hp>0)){notice('ALTAR SEALED · DEFEAT THE HOSTILE OPHANIM',3.2);return false;}
 sound('altar');heavenSanctum.state='none';interactProgress=0;afterlightSceneTransition('CELESTIAL ALTAR CLAIMED');
 if(testLabMode){trialFinish(true);return true;}
 const reward=Math.round((3000+cycleOf(wave)*850)*(1+permanentStats().loot));
 meta.heavenSanctumClears=(meta.heavenSanctumClears||0)+1;
  awardPermanent('heaven');
 meta.xp+=6400+cycleOf(wave)*1000;
 player.cash+=reward;totalScore+=11000+cycleOf(wave)*1600;
 player.hp=player.maxHp;player.shield=player.maxShield;player.energy=100;
 saveMeta();evaluateMetaUnlocks();
 player.x=C;player.z=8.5;player.vx=0;player.vz=0;
 enemies=[];spawnPending=0;projectiles=[];lingeringBeams=[];
 createMap(sector);buildStatic();
 announce('CELESTIAL ALTAR CLAIMED // +'+reward+' SALVAGE',4);
 notice('HEAVEN SANCTUM · CAREER XP & RESTORATION',3.5);
 queueWorldRelic('heaven');saveCheckpoint();waveComplete();return true;
}

function openHellGate(){
 if(hellBreach.state!=='pending')return;
 hellBreach.state='gate';hellBreach.stage=0;
 // This is a REAL replacement of the collision-backed north perimeter mesh.
 // Enter by holding ACTIVATE at the visible gateway, then load the bonus map.
 for(let x=Math.floor(C)-2;x<=Math.floor(C)+2;x++){
  map[0][x]=1;map[1][x]=1;map[2][x]=0;
 }
 buildStatic();
 announce('THE WALL HAS OPENED // HELL BREACH',3.5);
 if(testLabMode==='maw'&&free(C,3.7,.32)){player.x=C;player.z=3.7;player.vx=0;player.vz=0;player.yaw=0;}
 notice(testLabMode?'TEST LAB // WALK INTO BLACK CHAPEL':'OPTIONAL SECRET: WALK THROUGH THE RED GATE',3.8);
 saveCheckpoint();
}
function beginHellBreach(restored=null){
 if(!restored&&hellBreach.state!=='gate')return false;
 const prior={...hellBreach};
 hellBreach={...prior,state:'active',stage:restored?.stage||1,
  returnWave:restored?.returnWave||wave,returnSector:restored?.returnSector??sector,
  reward:0,transition:time,encountered:true};
 player.x=C;player.z=N-5;player.vx=0;player.vz=0;
 player.height=0;player.verticalVel=0;inputs.shoot=false;inputs.fire=null;
 hellFootprints=[];
 enemies=[];spawnPending=0;projectiles=[];lingeringBeams=[];tracers=[];
 createHellMap();buildStatic();
 beginHellStage(hellBreach.stage);
 sound('hellenter');announce('HELL BREACH // THE BLACK CHAPEL',4.2);
 notice('THREE BRUTAL TRIALS · SURVIVE FOR A RARE REWARD',4);
 saveCheckpoint();
 return true;
}
function escapeHellBreach(){
 if(hellBreach.state!=='active')return false;
 if(testLabMode){trialFinish(false);return true;}
 sector=hellBreach.returnSector;wave=hellBreach.returnWave;
 hellBreach.state='none';hellBreach.reward=0;hellFootprints=[];
 enemies=[];spawnPending=0;projectiles=[];lingeringBeams=[];tracers=[];
 player.x=C;player.z=8.5;player.vx=0;player.vz=0;
 createMap(sector);buildStatic();phase='play';showScreen(null);overlayPlay(true);
 notice('HELL EXITED · RUN RESTORED · NO BONUS REWARD',3);
 saveCheckpoint();waveComplete();return true;
}
function beginHellStage(stage){
 if(hellBreach.state!=='active')return;
 hellBreach.stage=stage;
 enemies=[];projectiles=[];spawnPending=Math.min(28,7+stage*4+cycleOf(wave)*2);
 spawnClock=.65;
 announce('ABYSS TRIAL '+stage+' / '+hellBreach.stages,3);
 notice(stage===3?'THE ARCHFIEND APPROACHES':'DEMONS ARE HUNTING YOU',2.5);
}
function spawnHellFiend(){
 const boss=hellBreach.stage===3&&spawnPending===1;
 const at=boss?bossSpawnClearance():randomOpen(6);
 let e=newEnemy(at,false);
 // Retire cyber-styled shade, cinder and horned monsters from Hell. The
 // final Archfiend retains its boss mechanics but uses organic Hell Knight art.
 const roll=rnd(),hellKnight=!boss&&hellBreach.stage>=2&&roll<.18,
  pinky=!boss&&!hellKnight&&roll<(hellBreach.stage>=2?.45:.25);
 e.type=boss?'behemoth':hellKnight||pinky?'crusher':'skitter';
 e.hellVariant=boss?'archfiend':hellKnight?'hellknight':pinky?'pinky':'imp';
 e.boss=boss;e.appearT=boss?0:.50;
 const original=ENEMY_STATS[e.type];
 const multiplier=1.8+hellBreach.stage*.30+cycleOf(wave)*.20;
 e.hp=original[0]*multiplier*(boss?3.2:hellKnight?2.1:e.hellVariant==='pinky'?1.23:1.15)*cycleDifficulty(wave).hp;
 e.maxHp=e.hp;
 e.speed=original[1]*(boss?1.08:hellKnight?1.26:e.hellVariant==='pinky'?1.64:1.66);
 e.attackT=boss?1.8:.9;
 e.ultimateClock=boss?2.8:99;
 e.hellStepClock=.12+(e.id%4)*.08;e.organicRoarUntil=time+(boss?1.2:.65);
 e.hellCastStage='idle';e.hellCastDelay=1.5+(e.id%4)*.4;
 enemies.push(e);hellFiendsFought++;
 if(boss){e.damageAtSpawn=runRecord.damageEvents;beginBossIntro(e);}
}
function finishHellBreach(){
 if(hellBreach.state!=='active')return;
 if(testLabMode){hellCompleted++;hellBreach.state='none';trialFinish(true);return;}
 const reward=1400+cycleOf(wave)*550;
 hellBreach.state='none';hellBreach.reward=reward;hellBreach.conqueredThisRun=true;hellCompleted++;hellFootprints=[];
 meta.hellBreachClears=(meta.hellBreachClears||0)+1;
 meta.xp+=4500+cycleOf(wave)*700;
 // Guaranteed career-exclusive forge blueprint: keep the established catalog
 // and archive semantics; never mint an unusable fake weapon ID.
 const prize=WEAPONS.find(w=>w.prototype&&w.variant===23&&w.archetype===8);
 if(prize?.unlockId){
  meta.unlocked[prize.unlockId]=true;
  runRecord.lastUnlocks.push('HELL BREACH RELIC: '+prize.name);
 }
 saveMeta();evaluateMetaUnlocks();
 player.cash+=reward;totalScore+=6400+cycleOf(wave)*1000;
 player.hp=Math.min(player.maxHp,player.hp+Math.max(35,player.maxHp*.3));
 player.shield=Math.min(player.maxShield,player.shield+Math.max(24,player.maxShield*.35));
 player.x=C;player.z=8.5;player.vx=0;player.vz=0;
 enemies=[];spawnPending=0;projectiles=[];lingeringBeams=[];
 createMap(sector);buildStatic();
 afterlightSceneTransition('HELL BREACH CONQUERED');announce('HELL BREACH CONQUERED // +'+reward+' SALVAGE',4);
 notice('BLACK CHAPEL SURVIVOR · + CAREER XP',4);
 queueWorldRelic('hell');saveCheckpoint();
 waveComplete();
}
function advanceHellStage(){
 if(hellBreach.state!=='active')return;
 if(hellBreach.stage>=hellBreach.stages)finishHellBreach();
 else beginHellStage(hellBreach.stage+1);
}
function drawHellGate(m,quality){
 if(hellBreach.state!=='gate')return;
 const x=C,z=.62,h=2.20,cols=['red','rust'];
 for(const side of [-1,1]){
  const px=x+side*2.2;
  m.box(px,h,z,.65,4.5,.66,'rust',.10);
  for(let j=0;j<5;j++){
   const yy=.45+j*.75,flare=.3+.25*Math.sin(time*3+j);
   m.beam(px,yy,z+.18,px+side*.52,yy+.3,z+.38,.09,cols[j%2],flare);
  }
 }
 m.box(x,4.38,z,4.9,.45,.8,'titanium',.10);
 const n=quality==='battery'?12:24,pulse=.55+.45*Math.sin(time*2.4);
 for(let i=0;i<n;i++){
  const a=i*TAU/n,b=(i+1)*TAU/n;
  m.beam(x+Math.cos(a)*1.80,2.3+Math.sin(a)*1.77,z+.4,
   x+Math.cos(b)*1.80,2.3+Math.sin(b)*1.77,z+.4,
   .034,'red',.26*pulse);
 }
 m.box(x,2.25,z-.18,3.5,3.6,.06,'black',.025);
 drawRealmPortalFX(m,x,z+.4,'hell',quality);
 // Do not seal the doorway with a flat red slab. Thin, moving red tears
 // flicker inside the open frame; the actual map cells are walkable.
 for(let j=0;j<7;j++){
  const yy=.66+j*.45,xx=x+Math.sin(time*1.6+j*2.7)*1.02;
  m.beam(xx,yy,z+.35,xx+.035,yy+.16,z+.36,.014,
   j%3===0?'warm':'red',.09*pulse);
 }
}
// Four visually independent demon species. All pieces use the same
// orientation and movement frame as the articulated enemy underneath: no
// world-aligned horns floating beside a turning monster. Low-quality mode
// retains readable eyes and a distinct head silhouette with bounded geometry.

let infernalOrganicModels=0,pinkyDrawn=0,pinkyCharges=0,hellKnightDrawn=0,hellKnightCharges=0,hellKnightShots=0,impDrawn=0,impLeaps=0,impFireballs=0,demonAnimatedVertices=0;
function drawBlenderFleshBody(m,e,q,s,bob,charge,strike){
 if(q==='battery')return false;
 const d=Math.hypot(e.x-player.x,e.z-player.z),high=q==='high';
 const reduced=framePacing.averageMs>22;
 if(d>(high?(desktopPC?(reduced?10.5:14):13):8)||
    infernalOrganicModels>=(high?(desktopPC?(reduced?2:4):3):1))return false;
 const name='hell_'+e.hellVariant;
 if(!BLENDER_KIT?.[name])return false;
 if(!blenderPart(m,name,e.x,bob,e.z,s,e.facing||0,e))return false;
 infernalOrganicModels++;
 // Model is a complete original organic body; overlay responsive claws,
 // two stride accents, and a skeletal torso breath for live attack feedback.
 const pose=enemyPoseMesh(m,e),walk=Math.min(1,(e.moveSpeed||0)/3.5);
 const cycle=Math.sin(e.bob)*walk;
 for(const side of [-1,1]){
  const reach=.44+strike*.32+charge*.12;
  pose.beam(e.x+side*.40*s,1.32*s,e.z-.12*s,
    e.x+side*.58*s,(.77+strike*.13)*s,e.z-reach*s,
    .091*s,'muscle',.029);
  for(let j=0;j<3;j++)
   pose.beam(e.x+side*.58*s+(j-1)*.050,.72*s,e.z-reach*s,
     e.x+side*.61*s+(j-1)*.073,.49*s,e.z-(reach+.15)*s,
     .024*s,'bone',.050+charge*.10);
  if(Math.abs(cycle)>.12)
   pose.box(e.x+side*.21*s,.12*s+Math.max(0,side*cycle)*.10*s,
    e.z-.16*s-cycle*side*.14*s,.16*s,.12*s,.21*s,'scar',.02);
 }
 return true;
}




/* Stance-timed organic animation, informed by IK/GDC locomotion research.
 * This game has no bone weights, so each LOD mesh uses a low-cost soft
 * envelope instead of pretending to have a production skeletal IK rig.
 *
 * Foot targets live in world coordinates during the support phase:
 * continuous root travel is offset in local foot vertices. The offset
 * returns smoothly to zero in swing. No terrain raycasts are necessary
 * in the existing level-floor arena and this never changes collision.
 */
let organicFootPlants=0,organicLockedFeet=0,organicStanceVertices=0,pinkyDodgeHops=0,impLandings=0,organicIKVertices=0;
function smoothOrganic(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function organicStrideRadiansPerMetre(e){
 if(e.hellVariant==='pinky')return 5.5;
 if(e.hellVariant==='hellknight'||e.hellVariant==='archfiend')return 4.1;
 if(e.hellVariant==='imp')return 8.0;
 return 5.0;
}

function prepOrganicPose(e,kind){
 if(e.organicPose&&e.organicPose.time===time&&e.organicPose.kind===kind)
  return e.organicPose;
 const prev=e.organicPose,step=e.bob||0,walk=clamp((e.moveSpeed||0)/4.6,0,1);
 const wind=e.meleeStage==='windup',rush=e.meleeStage==='lunge';
 const retreat=e.meleeStage==='retreat',recovery=e.meleeStage==='recover';
 const windProgress=wind?smoothOrganic(1-(e.meleeT||0)/Math.max(.1,e.meleeTotal||.60)):0;
 const rushProgress=rush?clamp(1-(e.meleeT||0)/
  (kind==='pinky'?.46:kind==='knight'?.49:.22),0,1):0;
 const strike=rush?Math.sin(Math.PI*rushProgress):0;
 const cast=e.hellCastStage==='charge';
 const castProgress=cast?smoothOrganic(1-(e.hellCastT||0)/
  (kind==='imp'?.85:1.12)):0;
 const facing=e.facing||0,cy=Math.cos(facing),sy=Math.sin(facing);
 const yawDelta=prev?Math.atan2(Math.sin(facing-prev.facing),
  Math.cos(facing-prev.facing)):0;
 const turn=clamp(yawDelta*2.2,-.17,.17);
 const names=kind==='pinky'?
   [['fl',-.60,-.82,Math.PI],['fr',.60,-.82,0],
    ['hl',-.51,.83,0],['hr',.51,.83,Math.PI]]:
   kind==='knight'?[['l',-.45,-.18,Math.PI],['r',.45,-.18,0]]:
    [['l',-.39,-.34,Math.PI],['r',.39,-.34,0]];
 const feet={};const oldFeet=prev?.feet||{};
 for(const [name,lx,lz,offset] of names){
  const phase=step+offset;
  const sweep=Math.sin(phase);
  const inStance=walk>.14&&
   (kind!=='imp'||(e.impLeapT||0)<=0)&&sweep<-.14;
  const weight=inStance?smoothOrganic(clamp((-sweep-.14)/.40,0,1)):0;
  const nx=e.x+cy*lx+sy*lz,nz=e.z-sy*lx+cy*lz;
  const prior=oldFeet[name];
  // Latch on support transition, release on swing, reset after teleports.
  const reset=!prior||!prior.inStance||!inStance||
   Math.hypot(prior.anchorX-nx,prior.anchorZ-nz)>1.1||
   Math.hypot((prev?.x??e.x)-e.x,(prev?.z??e.z)-e.z)>.80;
  const ax=reset?nx:prior.anchorX,az=reset?nz:prior.anchorZ;
  const dx=clamp(cy*(ax-nx)-sy*(az-nz),-.68,.68);
  const dz=clamp(sy*(ax-nx)+cy*(az-nz),-.68,.68);
  feet[name]={anchorX:ax,anchorZ:az,dx,dz,
   support:weight,inStance};
  if(weight>.18){
   organicFootPlants++;
   if(Math.hypot(dx,dz)>.016)organicLockedFeet++;
  }
 }
 const landed=clamp(e.impLandingT||0,0,.28)/.28;
 const pose={kind,time,x:e.x,z:e.z,facing,feet,walk,phase:step,
  wind:windProgress,strike,cast:castProgress,turn,
  retreat:retreat?clamp((e.meleeT||0)/.5,0,1):0,
  recover:recovery?clamp((e.meleeT||0)/.54,0,1):0,
  leap:clamp(e.impLeapHeight||0,0,1),land:landed,
  breathing:Math.sin(time*(kind==='imp'?3.3:kind==='knight'?1.7:2.7)+e.id),
  flinch:clamp(e.hit||0,0,.5)};
 e.organicPose=pose;return pose;
}
function animateDemonVertex(kind,e,px,py,pz,role){
 const pose=prepOrganicPose(e,kind),side=px<0?-1:1,phase=pose.phase+
  (side<0?Math.PI:0),step=Math.sin(phase);
 const walk=pose.walk,wind=pose.wind,strike=pose.strike;
 const cast=pose.cast,flinch=pose.flinch;
 if(kind==='pinky'){
  const front=pz<-.23,leg=clamp((1.48-py)/1.14,0,1)*
   clamp((Math.abs(px)-.28)/.30,0,1)*
   (front?clamp((.13-pz)/.53,0,1):clamp((pz-.18)/.50,0,1));
  const gait=step*(front?1:-1)*walk;
  const foot=pose.feet[(front?'f':'h')+(side<0?'l':'r')];
  pz+=gait*leg*(front?.27:.15)+leg*foot.dz*foot.support;
  px+=leg*foot.dx*foot.support;
  py+=Math.max(0,gait)*leg*(front?.19:.12);
  if(!front&&py<.83)pz-=gait*.06*leg;
  if(leg>.6&&foot.support>.3)organicStanceVertices++;
  // Shoulders drop before charging, head snaps during impact and the jaw
  // opens at the strike apex. The ribcage reacts after the head.
  const head=clamp((-pz-.59)/.76,0,1)*clamp((py-.93)/.47,0,1);
  pz-=head*(strike*.31-wind*.14+pose.recover*.055);
  py-=head*(wind*.075+strike*.033);
  if((role==='bone'||role==='wound')&&pz<-.90&&py<1.5)
   py-=head*(strike*.17+wind*.05);
  const body=clamp((py-1)/.73,0,1)*
   (1-clamp((Math.abs(pz)-.54)/.50,0,1));
  py+=body*(.020*pose.breathing-wind*.055+strike*.045);
  px+=body*(.024*Math.sin(pose.phase*.55)*walk+pose.turn*.45)+
   flinch*head*.07;
  // Quick side hop after receiving a hit: body braces, feet release
  // instead of sliding while the physical collider sidesteps.
  py+=body*(e.pinkyHopHeight||0)*.13;
 }else if(kind==='knight'){
  const leg=clamp((1.27-py)/1.08,0,1)*
   clamp((Math.abs(px)-.12)/.28,0,1);
  const foot=pose.feet[side<0?'l':'r'];
  pz+=step*leg*walk*.28+leg*foot.dz*foot.support;
  px+=leg*foot.dx*foot.support;
  py+=Math.max(0,step)*leg*walk*.17;
  if(leg>.6&&foot.support>.3)organicStanceVertices++;
  // Heavy shoulder anticipates a punch, rotates through contact and
  // settles during recovery. The fist does not simply oscillate.
  const arm=clamp((Math.abs(px)-.69)/.33,0,1)*
   clamp((2.43-py)/.86,0,1);
  const wrist=clamp((1.73-py)/.89,0,1);
  pz+=arm*(-step*walk*.12+wind*.19-strike*.53-cast*.24)*
    (.49+.51*wrist);
  py+=arm*wrist*(strike*.18+wind*.09+cast*.22);
  const torso=clamp((py-1.34)/1.25,0,1);
  px+=torso*(pose.turn*.58+Math.sin(pose.phase*.43)*walk*.025+
   flinch*.10);
  pz+=torso*(pose.breathing*.030+wind*.11-strike*.19+
   pose.recover*.05);
  py-=torso*wind*.045;
  if(role==='wound'&&pz<-.40&&py>2.35)
   py-=cast*.085+strike*.095;
 }else{
  const leap=pose.leap,legs=clamp((.97-py)/.9,0,1);
  const arm=clamp((Math.abs(px)-.35)/.35,0,1)*
   clamp((1.60-py)/.91,0,1);
  const foot=pose.feet[side<0?'l':'r'];
  pz+=legs*(step*walk*.23-leap*.14)+legs*foot.dz*foot.support;
  px+=legs*foot.dx*foot.support;
  py+=legs*(Math.max(0,step)*walk*.13+leap*.27);
  if(legs>.6&&foot.support>.3)organicStanceVertices++;
  pz+=arm*(-step*walk*.17-leap*.30-strike*.24-cast*.14);
  py+=arm*(leap*.21+wind*.10);
  const upper=clamp((py-.76)/1.08,0,1);
  pz+=upper*(pose.breathing*.019+leap*.10+wind*.13-
   strike*.09);
  py-=upper*(wind*.12+cast*.075);
  if(pz>.37&&py<1.21)px+=.13*Math.sin(time*4+e.bob*.3)*
   clamp((pz-.37)/1,0,1);
  py+=leap*.52-pose.land*.19;
  px+=upper*(pose.turn*.25+flinch*.09);
 }
 demonAnimatedVertices++;return [px,py,pz];
}

/* VEILFORGE v039 stable creature skin coloration. A real bind-space
 * procedural matte/keratin/wound palette; cached per original Blender mesh. */
function demonSkinColor(kind,batch,vertex){
 if(!batch.__v039Paint){
  const v=batch.v,out=new Float32Array(v.length/2);
  const base=HEX[batch.mat]||HEX.shadowflesh;
  const living=['flesh','muscle','scar','sinew','wound','shadowflesh','charcoal','cartilage','hellstone'].includes(batch.mat);
  const bone=batch.mat==='bone';
  const tone=kind==='pinky'?[.69,.48,.47]:kind==='knight'?[.67,.52,.55]:[.81,.67,.61];
  for(let i=0;i<v.length;i+=6){
   const x=v[i],y=v[i+1],z=v[i+2];
   const pore=.5+.5*Math.sin(x*29.7+y*19.4+z*13.2)*Math.cos(x*13.9-z*18.7+y*27.5);
   const scales=Math.sin((x*11.3+z*8.5)*1.5)*Math.sin((y*7.1-z*14.2)*.9);
   const cracks=Math.abs(Math.sin(x*23.1+z*15.3+Math.sin(y*14.5)*.58));
   // Low-contrast natural dermal pigment avoids moving red stripe moire.
   const detail=(living?.80+.16*pore:bone?.84+.18*pore:.86+.12*pore);
   for(let c=0;c<3;c++){
    const colour=base[c]*detail*(living?tone[c]:1);
    out[i/2+c]=Math.max(.006,Math.min(1,colour));
   }
  }
  batch.__v039Paint=out;
 }
 const i=vertex/2,s=batch.__v039Paint;return [s[i],s[i+1],s[i+2]];
}
/** Fifth Hell species: four-legged eyeless VQ cyborg. Geometry from Blender,
 * with independent mechanical rear legs and two stomping flesh forelegs.
 * The original high-poly master is NOT sent to Android. Budgeted LOD only. */

/* Pinky expression/attack overlay attaches to the creature's own facing and
 * action timeline. This works on both skinned Blender and low-cost fallbacks,
 * so battery-mode monsters are never frozen props. */
// WYRDFLUX 0.61.5 — visually readable, collision-neutral Hell attack language.
// Shared by detailed Blender bodies and cheap fallback sprites: no hidden
// homing and no world-facing stale decals as the enemy turns.
let hellRosterMarkedImp=0,hellRosterMarkedKnight=0,hellRosterMarkedCharger=0;
function drawWyrdfluxHellAttackTelegraph(source,e,quality){
 if(quality==='battery'&&e.hellVariant!=='pinky')return;
 const kind=e.hellVariant,x=e.x,z=e.z;
 let angle=0,range=0,width=.20,color='red',progress=0;
 if(kind==='pinky'&&e.meleeStage==='windup'){
  angle=e.meleeAimed;
  if(!Number.isFinite(angle))return;
  range=3.2;width=.47;color='red';
  progress=clamp(1-(e.meleeT||0)/Math.max(.1,e.meleeTotal||.61),0,1);
  hellRosterMarkedCharger++;
 }else if((kind==='imp'||kind==='hellknight')&&e.hellCastStage==='charge'){
  angle=e.hellCastAim;
  if(!Number.isFinite(angle))return;
  range=kind==='imp'?5.2:7.1;
  width=kind==='imp'?.20:.46;
  color=kind==='imp'?'ember':'magma';
  progress=clamp(1-(e.hellCastT||0)/(kind==='imp'?.85:1.12),0,1);
  if(kind==='imp')hellRosterMarkedImp++;else hellRosterMarkedKnight++;
 }else return;
 const forwardX=Math.sin(angle),forwardZ=-Math.cos(angle);
 const rightX=Math.cos(angle),rightZ=Math.sin(angle);
 // The charger stores its lunge target using -sin(angle), -cos(angle).
 const dx=kind==='pinky'?-Math.sin(e.meleeAimed):forwardX;
 const dz=kind==='pinky'?-Math.cos(e.meleeAimed):forwardZ;
 const rx=-dz,rz=dx;
 const pulse=.25+.28*progress;
 const len=range*(.45+.55*progress);
 const drawCount=quality==='high'?3:1;
 for(let side=0;side<drawCount;side++){
  const lateral=side===0?0:(side===1?-width:width);
  const sx=x+rx*lateral,sz=z+rz*lateral;
  source.beam(sx,.048,sz,sx+dx*len,.048,sz+dz*len,
    side===0?.025:.016,color,pulse);
 }
 // Distinct grounded tell at the enemy's feet, not a second giant light orb.
 if(quality!=='battery')source.box(x,.065,z,
   width*.85,.025,width*.85,color,.08+.12*progress);
}

function drawPinkyAttackCues(source,e,quality){
 drawWyrdfluxHellAttackTelegraph(source,e,quality);
 const m=enemyPoseMesh(source,e),x=e.x,z=e.z;
 const wind=e.meleeStage==='windup',charge=e.meleeStage==='lunge';
 const t=wind?clamp(1-(e.meleeT||0)/Math.max(.1,e.meleeTotal||.61),0,1):
  charge?clamp(1-(e.meleeT||0)/.46,0,1):0;
 const bite=charge?Math.sin(Math.PI*t)*.27:wind?t*.18:0;
 const hit=clamp(e.hit||0,0,.3)/.3;
 const snarl=wind?.8:charge?1.2:.2;
 const headDrop=wind*.12-charge*.085+hit*.09;
 const jawY=1.17-headDrop-bite;
 // Eye lines remain physically attached to the snout during charge/impact.
 for(const side of [-1,1]){
  m.box(x+side*.235,1.74-headDrop,z-1.38,
   .11,.08,.032,hit>.01?'white':'ember',.15+snarl*.26);
  m.beam(x+side*.245,1.70-headDrop,z-1.39,
   x+side*.30,1.69-headDrop,z-1.46,.024,'sulfur',.08);
 }
 m.box(x,jawY,z-1.45,.53,.14,.38,'wound',.03+snarl*.08);
 m.box(x,jawY-.04,z-1.58,.45,.048,.22,'charcoal',.02);
 if(quality!=='battery')for(const side of [-1,1])for(let fang=0;fang<3;fang++){
  const xx=x+side*(.09+fang*.065);
  m.beam(xx,1.34-headDrop,z-1.51,xx,jawY+.04,z-1.60,
   .018,'bone',.02);
 }
 if(wind&&quality!=='battery'){
  // Ground-level warning is aligned with the coming charge, not a vertical
  // laser, and disappears when the animal starts moving.
  m.beam(x-.42,.055,z-1.52,x+.42,.055,z-1.52,.026,'red',.14+.26*t);
 }
}

function drawPinkyDemon(source,e,quality){
 const high=quality==='high',x=e.x,z=e.z,s=.86;
 const d=Math.hypot(x-player.x,z-player.z),pose=enemyPose(e);
 const windup=e.meleeStage==='windup'?1:0,lunge=e.meleeStage==='lunge'?1:0;
 const stride=Math.min(1,(e.moveSpeed||0)/3.8);
 // Fallback uses pos() to rotate each part. Wrapping it in enemyPoseMesh
 // rotated twice and made the legs look sideways in actual Hell gameplay.
 const m={
  // pos() already rotates world coordinates; only rotate each box's OWN
  // axes here, avoiding the old double-yaw bug on Pinky's entire body.
  box(a,b,c,w,h,d,col,em=0,rot=0){
   source.box(a,b,c,w,h,d,col,em,(e.facing||0)+rot);
  },
  beam(...args){source.beam(...args)}
 },model=BLENDER_KIT?.hell_pinky;
 const allowed=quality!=='battery'&&d<(high?(desktopPC?21:14):8)&&pinkyDrawn<(desktopPC?(framePacing.averageMs>22?1:3):1);
 if(model&&allowed&&model.triangles>1500&&model.triangles<=15500){
  const skinRig=window.OrganicRigV037?.prepare('pinky',prepOrganicPose(e,'pinky'),model,e);
  const cy=Math.cos(e.facing||0),sy=Math.sin(e.facing||0);
  const breath=.009*Math.sin(time*2.7+e.id),impact=lunge?.15:windup?-.07:0;
  for(const batch of model.batches){
   const color=HEX[batch.mat]||HEX.flesh;
   const metal=['metal','titanium','chrome','polished','black'].includes(batch.mat);
   const v=batch.v;
   for(let i=0;i<v.length;i+=6){
    let px,py,pz,nx,ny,nz;
    if(skinRig){
     [px,py,pz,nx,ny,nz]=window.OrganicRigV037.skin(skinRig,batch,i);
     organicIKVertices++;demonAnimatedVertices++;
    }else{
     [px,py,pz]=animateDemonVertex('pinky',e,v[i],v[i+1],v[i+2],batch.mat);
     nx=v[i+3];ny=v[i+4];nz=v[i+5];
    }
    source.v([x+s*(cy*px+sy*pz),s*py,z+s*(-sy*px+cy*pz)],
     [cy*nx+sy*nz,ny,-sy*nx+cy*nz],demonSkinColor('pinky',batch,i),metal?.055:.012,px,pz);
   }
   blenderVertices+=v.length/6;
  }
  blenderPassModels++;pinkyDrawn++;
  drawPinkyAttackCues(source,e,quality);
  return;
 }
 // Playable Android fallback: correctly quadrupedal, not a generic soldier.
 const turn=e.facing||0,co=Math.cos(turn),si=Math.sin(turn);
 const pos=(u,v,w)=>[x+co*u+si*w,v,z-si*u+co*w];
 const momentum=clamp((e.moveSpeed||0)/Math.max(1,e.speed||4),0,1);
 const attackTime=clamp(1-(e.meleeT||0)/(lunge?.46:.61),0,1);
 const plunge=lunge?Math.sin(attackTime*Math.PI)*.18:0;
 const breathe=Math.sin(time*2.7+e.id)*.025;
 const crouch=windup?.16:0;
 const bodyY=breathe-crouch-plunge;
 m.box(...pos(0,1.25+bodyY,.07),.94,.77,1.39,'flesh',.02);
 m.box(...pos(0,1.57+bodyY,-.73-lunge*.11),.76,.75,.57,'muscle',.02);
 m.box(...pos(0,1.75+bodyY,-1.10-lunge*.22),.94,.70,.79,'scar',.01);
 m.box(...pos(0,1.26+bodyY,-1.44-lunge*.24),.59,.14,.39,'wound',.02);
 m.box(...pos(0,1.06+bodyY,-1.47-lunge*.25),.72,.17,.47,'cartilage',.02);
 for(const sign of [-1,1]){
  for(const rear of [false,true]){
   const u=sign*(rear?.48:.60),w=rear?.76:-.59;
   const gait=Math.sin(e.bob+(sign<0?Math.PI:0)+(rear?Math.PI:0))*stride;
   const drive=lunge?Math.min(1,attackTime*2):0;
   const lift=Math.max(0,gait)*(.11+.10*momentum);
   const stance=windup?-.07:lunge?(rear?-.035:.10)*drive:0;
   const hip=pos(u,(rear?1.27:1.22)+bodyY*.65,w),
    knee=pos(u*1.13,.68+lift+stance,w+(rear?.20:-.12)+gait*.15-drive*.13),
    foot=pos(u*1.20,.14+lift+stance*.65,w+(rear?.38:-.24)+gait*.24-drive*.33);
   m.beam(...hip,...knee,rear?.107:.18,rear?'metal':'muscle',.02);
   m.beam(...knee,...foot,rear?.085:.145,rear?'titanium':'flesh',.02);
   m.box(...foot,.28,.16,.31,rear?'metal':'scar',.01);
  }
  m.box(...pos(sign*.43,1.86+bodyY,-1.44-lunge*.20),.16,.21,.18,'cartilage',.02);
  for(let t=0;t<4;t++)
   m.beam(...pos(sign*.33+(t-1.5)*.14,1.32+bodyY,-1.56-lunge*.24),
    ...pos(sign*.33+(t-1.5)*.14,1.15+bodyY,-1.65-lunge*.25),.021,'bone',.012);
 }
 drawPinkyAttackCues(source,e,quality);
}


/* Black Chapel heavy biped. The master is a locally sculpted original Foundry
 * study, NOT extracted game data. LOD one nearby body, fallback all devices. */
/* Match the original skinned Hell Knight's readable hit/attack language to
 * its low-poly fallback. All coordinates are monster-local, rotated once and
 * scaled with the Archfiend so the boss's eyes/telegraphs never detach. */
function drawKnightActionCues(source,e,scale,meshDetailed){
 const yaw=e.facing||0,c=Math.cos(yaw),sn=Math.sin(yaw),x=e.x,z=e.z;
 const pos=(u,v,w)=>[x+scale*(c*u+sn*w),scale*v,z+scale*(-sn*u+c*w)];
 const box=(u,v,w,a,b,d,col,em=0)=>
  source.box(...pos(u,v,w),a*scale,b*scale,d*scale,col,em,yaw);
 const hit=clamp(e.hit||0,0,.24)/.24;
 const wind=e.meleeStage==='windup',lunge=e.meleeStage==='lunge';
 const rush=lunge?clamp(1-(e.meleeT||0)/.49,0,1):0;
 const recoil=wind?.13:lunge?Math.sin(Math.PI*rush)*.10:0;
 if(meshDetailed)for(const side of [-1,1]){
  box(side*.16,2.77-recoil,-.56-(lunge?rush*.25:0),
   .095,.075,.04,hit>.01?'white':'ember',.12+hit*.65);
 }
 if(wind){
  // Single low floor slash shared across LODs, not two overlapping decals.
  box(0,.055,-.80,1.1,.025,.32,'red',.12+.12*Math.sin(time*13+e.id)**2);
 }
 if(lunge&&meshDetailed){
  for(const side of [-1,1])
   box(side*.96,1.08-recoil,-.42-rush*.26,
    .13,.13,.16,'wound',.035+hit*.20);
 }
}

function drawHellKnight(source,e,quality){
 drawWyrdfluxHellAttackTelegraph(source,e,quality);
 const x=e.x,z=e.z,dist=Math.hypot(x-player.x,z-player.z),q=quality==='high';
 const knight=BLENDER_KIT?.hell_knight,s=e.hellVariant==='archfiend'?1.46:1.03;
 const pose=enemyPoseMesh(source,e),swing=e.meleeStage==='lunge'?1:e.meleeStage==='windup'?.55:0;
 const casting=e.hellCastStage==='charge';
 if(knight&&quality!=='battery'&&dist<(q?(desktopPC?23:16):10)&&hellKnightDrawn<(desktopPC?(framePacing.averageMs>22?1:3):1)&&
    knight.triangles>=2000&&knight.triangles<=15500){
  const skinRig=window.OrganicRigV037?.prepare('knight',prepOrganicPose(e,'knight'),knight,e);
  const yaw=e.facing||0,c=Math.cos(yaw),sn=Math.sin(yaw);
  const walk=Math.min(1,(e.moveSpeed||0)/3.9),breath=.021*Math.sin(time*1.9+e.id);
  for(const batch of knight.batches){
   const color=HEX[batch.mat]||HEX.shadowflesh,v=batch.v;
   for(let i=0;i<v.length;i+=6){
    let px,py,pz,nx,ny,nz;
    if(skinRig){
     [px,py,pz,nx,ny,nz]=window.OrganicRigV037.skin(skinRig,batch,i);
     organicIKVertices++;demonAnimatedVertices++;
    }else{
     [px,py,pz]=animateDemonVertex('knight',e,v[i],v[i+1],v[i+2],batch.mat);
     nx=v[i+3];ny=v[i+4];nz=v[i+5];
    }
    source.v([x+s*(c*px+sn*pz),s*py,z+s*(-sn*px+c*pz)],
       [c*nx+sn*nz,ny,-sn*nx+c*nz],demonSkinColor('knight',batch,i),batch.mat==='ember'?.15:.015,px,pz);
   }
   blenderVertices+=v.length/6;
  }
  blenderPassModels++;hellKnightDrawn++;
  drawKnightActionCues(source,e,s,true);
 }else{
  // Animated, correctly scaled and oriented organic fallback for battery LOD.
  const yaw=e.facing||0,co=Math.cos(yaw),si=Math.sin(yaw);
  const pos=(u,v,w)=>[x+s*(co*u+si*w),s*v,z+s*(-si*u+co*w)];
  const box=(u,v,w,a,b,d,col,em=0)=>source.box(...pos(u,v,w),a*s,b*s,d*s,col,em,yaw);
  const beam=(u,v,w,u2,v2,w2,width,col,em=0)=>
   source.beam(...pos(u,v,w),...pos(u2,v2,w2),width*s,col,em);
  const stride=clamp((e.moveSpeed||0)/Math.max(1,e.speed||4),0,1);
  const gait=Math.sin(e.bob||0)*stride;
  const wind=e.meleeStage==='windup',lunge=e.meleeStage==='lunge';
  const rush=lunge?clamp(1-(e.meleeT||0)/.49,0,1):0;
  const dip=wind?.18:lunge?.12*Math.sin(Math.PI*rush):0;
  const breath=.025*Math.sin(time*2.1+e.id);
  const torsoY=breath-dip,thrust=lunge?rush*.30:0;
  box(0,1.96+torsoY,.06-thrust*.4,1.20,1.0,.81,'shadowflesh',.015);
  box(0,1.18+torsoY*.5,.02,.78,.89,.66,'hellstone',.015);
  box(0,2.74+torsoY,-.23-thrust,.58,.64,.64,'shadowflesh',.01);
  box(0,2.50+torsoY,-.53-thrust,.62,.23,.43,'charcoal',.015);
  box(0,2.34+torsoY,-.69-thrust,.42,.15,.24,'wound',.01);
  for(const side of [-1,1]){
   const step=gait*side,lift=Math.max(0,step)*.20;
   const armDrive=wind?-.19:lunge?.38*Math.sin(Math.PI*rush):0;
   box(side*.84,2.15+torsoY,.12,.68,.68,.68,'hellstone',.02);
   beam(side*.94,1.95+torsoY,-.01,side*1.11,1.24+armDrive,-.23-thrust,.30,'shadowflesh',.015);
   box(side*1.13,.94+armDrive,-.26-thrust,.39,.57,.40,'shadowflesh',.01);
   box(side*1.15,.55+armDrive,-.40-thrust,.32,.19,.36,'scar',.01);
   beam(side*.39,.99,.09,side*.51,.36+lift,-.13+step*.17,.28,'hellstone',.01);
   box(side*.53,.13+lift,-.27+step*.22,.43,.24,.59,'shadowflesh',.01);
   for(let j=0;j<3;j++)
    beam(side*.51+(j-1)*.11,.16+lift,-.54+step*.22,
      side*.51+(j-1)*.14,.11+lift,-.75+step*.22,.026,'bone',.015);
  }
  const flash=clamp(e.hit||0,0,.24)/.24;
  for(const side of [-1,1])
   box(side*.16,2.77+torsoY,-.56-thrust,.095,.075,.04,
    flash>.01?'white':'ember',.10+flash*.65);
  drawKnightActionCues(source,e,s,false);
 }
 if(casting){
  const pct=clamp(1-(e.hellCastT||0)/1.12,0,1),glow=.2+pct*.65;
  // Casting VFX use the same local-space, boss-scaled transform as the
  // Blender and battery bodies; no detached floating fireballs on Archfiend.
  const yaw=e.facing||0,c=Math.cos(yaw),sn=Math.sin(yaw);
  const pos=(u,v,w)=>[x+s*(c*u+sn*w),s*v,z+s*(-sn*u+c*w)];
  source.box(...pos(0,2.36,-.70),.39*s,.14*s,.19*s,'ember',glow,yaw);
  for(const side of [-1,1])
   source.box(...pos(side*1.13,.79,-.45),.17*s,.16*s,.18*s,'magma',glow,yaw);
 }
}


/** Ashclaw Imp: independent Blender mesh, hunched jackal-limbs and hooked tail.
 *  Body and arms are animated from combat/leap state, not a floating sphere. */

/* Shadow imps are an intentional reveal mechanic, not invisible enemies:
 * a solid dark silhouette, animated jaw/ears/tail and two tracking embers.
 * Their full Blender/LOD flesh appears permanently after the first direct
 * player weapon hit; chains and environmental damage do not reveal them. */
function impShotReveals(variant,cause,revealed){
 return variant==='imp'&&cause==='weapon'&&!revealed;
}
function drawUnrevealedImp(source,e,quality){
 const m=enemyPoseMesh(source,e),x=e.x,z=e.z;
 const jump=clamp(e.impLeapHeight||0,0,1),y=jump*.52;
 const move=clamp((e.moveSpeed||0)/Math.max(1,e.speed||4),0,1);
 const gait=Math.sin(e.bob||0)*move,cast=e.hellCastStage==='charge';
 const wind=e.meleeStage==='windup',lunge=e.meleeStage==='lunge';
 const pulse=.19+.12*Math.sin(time*3.5+e.id);
 const squat=wind?.12:lunge?.06:0;
 // The silhouette is shaded pitch-charcoal instead of hiding geometry.
 m.box(x,1.13+y-squat,z+.10,.58,.78,.48,'black',.008);
 m.box(x,1.47+y-squat,z-.13,.44,.48,.40,'charcoal',.008);
 m.box(x,1.81+y-squat,z-.30,.42,.34,.43,'black',.015);
 m.box(x,1.67+y-squat,z-.52,.36,.13,.26,'black',.013);
 // Distinct ear tips and curved cheek profile ensure the imp is readable.
 for(const side of [-1,1]){
  const step=gait*side,bend=jump*.11+(lunge?.17:0);
  m.beam(x+side*.12,1.95+y,z-.28,
   x+side*.26,2.24+y+.045*Math.sin(time*2+e.id+side),z-.12,
   .07,'charcoal',.015);
  m.beam(x+side*.20,.92+y,z+.15,x+side*.32,.45+y+Math.max(0,step)*.14,z+.19,
   .12,'black',.012);
  m.beam(x+side*.32,.45+y+Math.max(0,step)*.14,z+.19,
   x+side*.36,.13+y+Math.max(0,step)*.10,z-.22+step*.18,.065,'charcoal',.015);
  m.box(x+side*.36,.11+y+Math.max(0,step)*.1,z-.27+step*.18,
   .18,.09,.28,'black',.012);
  m.beam(x+side*.29,1.43+y,z-.17,x+side*.57,1.03+y,z-.28-bend,
   .10,'charcoal',.01);
  m.beam(x+side*.57,1.03+y,z-.28-bend,
   x+side*.63,.69+y,z-.53-bend,.075,'black',.01);
  m.box(x+side*.13,1.78+y-squat,z-.525,.085,.064,.018,
   cast?'magma':'ember',pulse+(cast?.40:0));
  if(quality!=='battery')m.beam(x+side*.63,.70+y,z-.55-bend,
   x+side*.66,.50+y,z-.65-bend,.026,'bone',.02);
 }
 const tail=.16*Math.sin(time*2.4+e.id);
 m.beam(x,.91+y,z+.32,x+tail,.70+y,z+.79,.064,'charcoal',.012);
 m.beam(x+tail,.70+y,z+.79,x+tail*.68,.78+y,z+1.02,.048,'black',.012);
 if(cast){
  const charge=clamp(1-(e.hellCastT||0)/.85,0,1);
  m.box(x,1.49+y,z-.61,.09+charge*.10,.10,.10,'ember',.25+charge*.75);
 }
}

function drawAshImp(source,e,quality){
 drawWyrdfluxHellAttackTelegraph(source,e,quality);
 const x=e.x,z=e.z,s=.91,model=BLENDER_KIT?.hell_imp;
 const distance=Math.hypot(x-player.x,z-player.z);
 const m=enemyPoseMesh(source,e),leap=clamp(e.impLeapHeight||0,0,1);
 const wind=e.meleeStage==='windup',attack=e.meleeStage==='lunge';
 const casting=e.hellCastStage==='charge';
 if(!e.impRevealed){drawUnrevealedImp(source,e,quality);return;}
 if(model&&quality!=='battery'&&distance<(quality==='high'?(desktopPC?21:15):9)&&
   impDrawn<(desktopPC?(framePacing.averageMs>22?2:4):1)&&model.triangles>=2200&&model.triangles<=11000){
  const skinRig=window.OrganicRigV037?.prepare('imp',prepOrganicPose(e,'imp'),model,e);
  const facing=e.facing||0,cy=Math.cos(facing),sn=Math.sin(facing);
  for(const batch of model.batches){
   const v=batch.v,col=HEX[batch.mat]||HEX.charcoal;
   for(let i=0;i<v.length;i+=6){
    let px,py,pz,nx,ny,nz;
    if(skinRig){
     [px,py,pz,nx,ny,nz]=window.OrganicRigV037.skin(skinRig,batch,i);
     organicIKVertices++;demonAnimatedVertices++;
    }else{
     [px,py,pz]=animateDemonVertex('imp',e,v[i],v[i+1],v[i+2],batch.mat);
     nx=v[i+3];ny=v[i+4];nz=v[i+5];
    }
    source.v([x+s*(cy*px+sn*pz),s*py,z+s*(-sn*px+cy*pz)],
     [cy*nx+sn*nz,ny,-sn*nx+cy*nz],demonSkinColor('imp',batch,i),batch.mat==='ember'?.22:.014,px,pz);
   }
   blenderVertices+=v.length/6;
  }
  blenderPassModels++;impDrawn++;
 }else{
  const bob=leap*.53,phase=e.bob,step=Math.sin(phase)*Math.min(1,(e.moveSpeed||0)/4);
  m.box(x,1.18+bob,z+.06,.60,.83,.46,'charcoal',.018);
  m.box(x,1.76+bob,z-.25,.35,.35,.38,'hellstone',.02);
  m.box(x,1.64+bob,z-.47,.38,.13,.30,'wound',.018);
  for(const side of [-1,1]){
   const gait=step*(side<0?-1:1);
   const foot=leap*.27+Math.max(0,gait)*.16;
   m.beam(x+side*.24,.93+bob,z+.1,x+side*.36,.48+bob+foot,z+.21,.14,'charcoal',.01);
   m.beam(x+side*.36,.48+bob+foot,z+.21,x+side*.35,.12+bob+foot,z-.21+gait*.18,.085,'sinew',.01);
   m.box(x+side*.35,.12+bob+foot,z-.36+gait*.18,.28,.12,.32,'charcoal',.01);
   m.beam(x+side*.44,1.46+bob,z-.12,x+side*.65,.95+bob,z-.32+gait*.11,.11,'charcoal',.01);
   m.beam(x+side*.65,.95+bob,z-.32+gait*.11,
    x+side*.75,.60+bob+leap*.15,z-.48-(attack?.20:0),.10,'sinew',.02);
   for(let k=-1;k<=1;k++)
    m.beam(x+side*.74+k*.05,.61+bob,z-.48,
     x+side*.76+k*.05,.38+bob,z-.69,.018,'bone',.025);
   m.beam(x+side*.19,1.90+bob,z-.22,x+side*.27,2.14+bob,z-.08,.060,'bone',.015);
  }
  const tail=Math.sin(time*4+e.id)*.12;
  m.beam(x,.92+bob,z+.24,x+tail,.68+bob,z+.79,.085,'charcoal',.015);
  m.beam(x+tail,.68+bob,z+.79,x+tail*.8,.79+bob,z+1.03,.054,'bone',.015);
 }
 if(casting){
  const c=clamp(1-(e.hellCastT||0)/.85,0,1),glow=.27+c*.87;
  m.box(x,1.52+leap*.53,z-.57,.18+c*.12,.11,.17,'ember',glow);
 }else if(wind){
  m.box(x,.06,z-.39,.43,.026,.30,'red',.22);
 }
 if((e.impRevealUntil||0)>time){
  const flash=clamp((e.impRevealUntil-time)/.7,0,1);
  m.box(x,1.52+leap*.53,z-.57,.16+flash*.19,.13,.17,
   'magma',flash*1.3);
 }
 // Both original Blender-mesh imps and fallback imps get attached,
 // bright orange eyes once fully revealed; shadow silhouettes stay dark.
 const yaw=e.facing||0,forwardX=Math.sin(yaw),forwardZ=-Math.cos(yaw);
 const sideX=Math.cos(yaw),sideZ=Math.sin(yaw);
 for(const side of [-1,1]){
  const ex=x+forwardX*.44+sideX*side*.135,
    ez=z+forwardZ*.44+sideZ*side*.135;
  source.box(ex,1.83+leap*.53,ez,.112,.085,.052,'orange',
    1.6+.45*Math.sin(time*5+e.id),yaw);
  source.box(ex+forwardX*.018,1.83+leap*.53,ez+forwardZ*.018,
    .042,.042,.032,'gold',.36,yaw);
 }
}

function drawCinderCannon(m,e,q){
 const x=e.x,z=e.z,cast=e.hellCastStage==='charge';
 const pulse=cast?clamp(1-(e.hellCastT||0)/.92,0,1):0;
 const recoil=e.hellCastStage==='recover'?.16:0;
 for(const side of [-1,1]){
  m.beam(x+side*.28,1.40,z-.10,x+side*.26,1.30,z-.53+recoil,
    .18,'charcoal',.03);
  m.box(x+side*.28,1.31,z-.57+recoil,.22,.22,.42,'rust',.05);
  m.box(x+side*.28,1.31,z-.82+recoil,.20,.18,.13,'black',.02);
  m.box(x+side*.28,1.31,z-.91+recoil,.10,.10,.04,'orange',.28+pulse);
 }
 if(q!=='battery')for(let i=0;i<5;i++){
  const angle=i*TAU/5+time*.3;
  m.beam(x+Math.cos(angle)*.18,1.46+Math.sin(angle)*.11,z-.87,
    x+Math.cos(angle)*.26,1.46+Math.sin(angle)*.18,z-.99,
    .017,'magma',.22+pulse*.56);
 }
}
function drawHellFiend(source,e,quality){
 if(!e.hellVariant)return;
 const distance=Math.hypot(e.x-player.x,e.z-player.z);
 if(distance>(quality==='high'?24:quality==='balanced'?17:11))return;
 const m=enemyPoseMesh(source,e);
 const species=e.hellVariant;
 if(species==='pinky'){drawPinkyDemon(source,e,quality);return;}
 if(species==='hellknight'||species==='archfiend'){drawHellKnight(source,e,quality);return;}
 if(species==='imp'){drawAshImp(source,e,quality);return;}
 const arch=species==='archfiend',
  horned=species==='horned',shade=species==='shade',cinder=species==='cinder';
 const scale=arch?2.30:horned?1.25:1;
 const x=e.x,z=e.z;
 const action=e.meleeStage||'seek';
 const pose=enemyPose(e);
 const strike=action==='lunge'?1:action==='windup'?.60:0;
 const charge=e.hellCastStage==='charge'?
   clamp(1-(e.hellCastT||0)/.92,0,1):0;
 const bob=Math.sin(e.bob)*.020*pose.move*scale;
 const y=1.79*scale+bob+Math.min(0,pose.crouch)*.2*scale;
 const color=e.hit>0?'white':shade?'black':horned?'rust':'dark';
 const bone=e.hit>0?'white':shade?'titanium':arch?'rust':'polished';
 const eye=shade?'purple':cinder?'orange':'red';
 const fx=Math.sin(time*4.1+e.id)*.035*scale,eyePower=.42+charge*.75;
 // Never draw a robot beneath the demon. Actual Blender full flesh figure
 // takes precedence nearby; distant bodies remain fully organic fallback.
 if(drawBlenderFleshBody(source,e,quality,
    arch?1.45:horned?1.12:1,bob,charge,strike)){
    if(cinder)drawCinderCannon(m,e,quality);
    return;
 }

 // Genuine complete animated demon anatomy replaces the normal sector robot.
 // Legs and claws move against the server-authoritative ground movement state.
 const bodyScale=scale,walk=Math.min(1,(e.moveSpeed||0)/3.5);
 const pace=Math.sin(e.bob)*walk,breath=.04*Math.sin(time*2.4+e.id);
 const torso=shade?.35:arch?.76:horned?.65:.46;
 m.box(x,(.98+breath)*bodyScale,z+.08*bodyScale,
  torso*bodyScale,.80*bodyScale,.48*bodyScale,
  shade?'obsidian':horned?'sinew':'hellstone',.018);
 m.box(x,(1.18+breath)*bodyScale,z-.22*bodyScale,
  .33*bodyScale,.28*bodyScale,.18*bodyScale,
  arch?'bone':shade?'charcoal':'sinew',.019);
 for(const side of [-1,1]){
  const hip=x+side*.22*bodyScale,hipY=.66*bodyScale;
  const phase=Math.sin(e.bob+(side>0?Math.PI:0))*walk;
  const lift=Math.max(0,phase)*.18*bodyScale;
  const kneeZ=z-.03*bodyScale-phase*.22*bodyScale;
  m.beam(hip,hipY,z+.07*bodyScale,
    hip+side*.04*bodyScale,.37*bodyScale+lift,kneeZ,
    .15*bodyScale,shade?'ironblack':'hellstone',.024);
  m.beam(hip+side*.04*bodyScale,.37*bodyScale+lift,kneeZ,
    hip+side*.06*bodyScale,.13*bodyScale+lift,kneeZ-.16*bodyScale,
    .12*bodyScale,shade?'charcoal':'sinew',.025);
  m.box(hip+side*.07*bodyScale,.11*bodyScale+lift,
    kneeZ-.23*bodyScale,.29*bodyScale,.16*bodyScale,.47*bodyScale,
    shade?'ironblack':'hellstone',.04);
  for(let k=0;k<3;k++)m.beam(hip+side*.07*bodyScale+(k-1)*.085*bodyScale,
    .10*bodyScale+lift,kneeZ-.33*bodyScale,
    hip+side*.07*bodyScale+(k-1)*.089*bodyScale,
    .063*bodyScale+lift,kneeZ-.51*bodyScale,
    .024*bodyScale,'bone',.028);
 }
 if(quality!=='battery'){
  const ribs=arch?9:horned?7:5;
  for(let i=0;i<ribs;i++){
   const yy=(.78+i*.115)*bodyScale,spine=.05*Math.sin(e.bob*.35+i);
   const xx=x+spine*bodyScale;
   m.beam(xx,yy,z+.31*bodyScale,xx+.08*bodyScale,
    yy+.19*bodyScale,z+.52*bodyScale,.050*bodyScale,
    i%3===0?'bone':'sinew',.026);
  }
  for(let k=0;k<3;k++)
   m.box(x+(k-1)*.17*bodyScale,(1.35+breath)*bodyScale,
     z-.37*bodyScale,.10*bodyScale,.14*bodyScale,.063*bodyScale,
     k===1?'cinder':'bone',k===1?.13:.02);
 }
 // Attack anticipation is in the actual limb assembly, not only a HUD label.
 if(strike>0){
  const reach=.36+strike*.35;
  for(const side of [-1,1]){
   m.beam(x+side*.39*bodyScale,1.32*bodyScale,z-.22*bodyScale,
    x+side*.58*bodyScale,(.80+strike*.17)*bodyScale,
      z-(reach+.13)*bodyScale,.095*bodyScale,
    'sinew',.06+strike*.22);
   m.box(x+side*.59*bodyScale,(.79+strike*.17)*bodyScale,
      z-(reach+.18)*bodyScale,.18*bodyScale,.18*bodyScale,.22*bodyScale,
      'bone',.04);
  }
 }

 // Skull and deep socket profile; shadows between armor plates define shape.
 m.box(x,y,z-.105*scale,.52*scale,.39*scale,.43*scale,color,.035);
 m.box(x,y+.105*scale,z-.28*scale,.51*scale,.18*scale,.19*scale,bone,.065);
 m.box(x,y-.125*scale,z-.31*scale,.45*scale,.18*scale,.18*scale,'black',.035);
 for(const side of [-1,1]){
  const hx=x+side*.155*scale;
  m.box(hx,y+.065*scale,z-.365*scale,
   (shade?.10:.13)*scale,.083*scale,.072*scale,eye,eyePower);
  // Three species have differently swept horns, shades have needle antennae.
  const baseX=x+side*.215*scale,baseY=y+.20*scale;
  const hornWidth=arch?.17:horned?.14:shade?.045:.09;
  const raise=arch?1.05:horned?.76:shade?.63:.50;
  m.beam(baseX,baseY,z-.08*scale,
   x+side*.40*scale,baseY+raise*.58*scale,z-.04*scale,
   hornWidth*scale,bone,.10);
  m.beam(x+side*.40*scale,baseY+raise*.58*scale,z-.04*scale,
   x+side*(arch?.88:horned?.68:shade?.49:.54)*scale,
   baseY+raise*scale,z-.32*scale,
   hornWidth*.60*scale,bone,.04);
  // Fangs follow the mouth and do not penetrate the floor.
  m.box(hx,y-.223*scale,z-.39*scale,.085*scale,.13*scale,.086*scale,
   'brass',.035);
 }
 m.box(x,y-.32*scale,z-.16*scale,.28*scale,.14*scale,.35*scale,bone,.025);
 // Separate threatening silhouettes on the chest/back.
 const torsoY=(arch?1.22:horned?1.08:1.15)*scale;
 m.box(x,torsoY,z-.34*scale,.52*scale,.43*scale,.16*scale,
  horned?'rust':shade?'black':'metal2',.04);
 m.box(x,torsoY+.08*scale,z-.43*scale,.15*scale,.22*scale,.06*scale,
  eye,.28+charge*.88);
 if(quality!=='battery'){
  const ribs=arch?7:horned?5:3;
  for(let i=0;i<ribs;i++){
   const yy=(.48+i*.17)*scale;
   m.beam(x-.24*scale,yy,z+.16*scale,
    x+.24*scale,yy,z+.15*scale,.047*scale,'rust',.035);
  }
  for(const side of [-1,1]){
   const shoulder=x+side*.53*scale,thrust=(strike*.19+charge*.07)*scale;
   m.box(shoulder,1.32*scale,z+.08*scale,
    (horned?.36:.20)*scale,.23*scale,(arch?.57:.35)*scale,bone,.025);
   m.beam(shoulder,1.23*scale,z-.11*scale,
    shoulder+side*(arch?.42:.27)*scale,.81*scale,z-.43*scale-thrust,
    (arch?.115:.065)*scale,'rust',.035);
   m.beam(shoulder+side*.20*scale,.81*scale,z-.42*scale-thrust,
    shoulder+side*(arch?.60:.37)*scale,.62*scale,z-.65*scale-thrust,
    .052*scale,bone,.035);
  }
 }
 if(shade){
  // Skittering shadow creature: four low limbs and a tapering back.
  for(const side of [-1,1]){
   for(let k=0;k<2;k++){
    const b=k?.16:-.14,angle=Math.sin(time*7+e.bob+side+k)*.11;
    m.beam(x+side*.30,.67,z+b,
      x+side*(.64+angle),.30,z+b+.22,.055,'titanium',.08);
   }
  }
 }else if(cinder){
  drawCinderCannon(m,e,quality);
  // Cinder demon builds a real orange throat glow before its spit attack.
  m.box(x,y-.17*scale,z-.435*scale,.23*scale,
   (.13+charge*.10)*scale,.052*scale,'orange',.25+charge);
  for(const side of [-1,1]){
   m.beam(x+side*.40*scale,.95*scale,z+.30*scale,
    x+side*.62*scale,1.18*scale+fx,z+.59*scale,
    .085*scale,'rust',.045);
  }
 }else if(horned){
  // Heavy species: asymmetric cheek shield and forward tusk.
  m.box(x+.38*scale,y-.12*scale,z-.21*scale,.28*scale,.30*scale,.39*scale,
    'metal2',.028);
  m.box(x-.30*scale,y-.10*scale,z-.34*scale,.16*scale,.25*scale,.32*scale,
    'titanium',.045);
 }else if(arch&&quality!=='battery'){
  // Boss crown and independently curving bone wings; total triangles bounded.
  for(const side of [-1,1]){
   for(let i=0;i<3;i++){
    const cx=x+side*(.66+i*.19)*scale,top=(2.2+i*.21)*scale;
    m.beam(x+side*.63*scale,1.61*scale,z+.21*scale,cx,top,
      z+.28*scale,.11*scale,'rust',.055);
    m.beam(cx,top,z+.28*scale,
      cx+side*.17*scale,top+.35*scale,z+.13*scale,.063*scale,'polished',.045);
   }
  }
  m.box(x,2.00*scale,z-.43*scale,.23*scale,.29*scale,.11*scale,
   'red',.52+.25*Math.sin(time*3));
 }
}


/**
 * AFTERLIGHT v0.23: engineering-scale details with no new collision, no
 * texture downloads and a stable per-sector static vertex budget. Placed
 * only on real exposed wall cells; never over a door or walkable route.
 */

/** Original 0.26 transient visuals: small bounded impact jets + short
 * collapsing sparks on confirmed kills, with Battery/Balance/High limits.
 * All effects are rendered at actual world positions and never collide.
 */
const impactJets=[],deathGhosts=[];
function spawnImpactJet(x,y,z,col='warm',count=5){
 const quality=$('quality').value;
 const n=quality==='battery'?Math.min(2,count):quality==='balanced'?Math.min(4,count):Math.min(7,count);
 for(let i=0;i<n;i++){
  const a=rnd()*TAU,speed=.65+rnd()*2.3,life=.14+rnd()*.23;
  impactJets.push({x,y,z,vx:Math.cos(a)*speed,vy:.38+rnd()*1.9,
    vz:Math.sin(a)*speed,life,max:life,col,size:.010+rnd()*.009});
 }
 if(impactJets.length>86)impactJets.splice(0,impactJets.length-86);
}
function recordDeathGhost(e){
 const boss=isBoss(e),tint=e.hellVariant?'red':boss?'purple':e.type==='crusher'?'orange':'cyan';
 const life=e.hellVariant?1.45:boss?.78:.45;
 deathGhosts.push({x:e.x,z:e.z,scale:boss?1.7:1,col:tint,life,max:life,
  facing:e.facing||0,hellVariant:e.hellVariant||null,
  organicDeadT:e.hellVariant?0:undefined,seed:rnd()*TAU});
 if(deathGhosts.length>22)deathGhosts.shift();
}
function drawDemonDeathBody(m,ghost,quality){
 if(!ghost.hellVariant)return;
 const fall=clamp(1-ghost.life/ghost.max,0,1);
 const collapse=fall<.42?fall/.42:1;
 const fade=clamp((1-fall)/.28,0,1);
 // Even battery/low LOD has a real fallen Pinky body. Previously all
 // corpses vanished on battery and without the Blender animation pack.
 const isPinky=ghost.hellVariant==='pinky';
 const haveClip=quality!=='battery'&&window.OrganicRigV037?.actions()?.actualBlender;
 if(isPinky&&!haveClip){
  const yaw=ghost.facing||0,c=Math.cos(yaw),sn=Math.sin(yaw);
  const pos=(u,v,w)=>[ghost.x+c*u+sn*w,v,ghost.z-sn*u+c*w];
  const m0={box:(u,v,w,a,b,d,col,em=0)=>m.box(...pos(u,v,w),a,b,d,col,em,yaw),
   beam:(a,b,c,d,e,f,w,col,em=0)=>m.beam(...pos(a,b,c),...pos(d,e,f),w,col,em)};
  const h=1.08-collapse*.74,tip=collapse*.44;
  m0.box(0,h,.15,.92,.59,.98,'shadowflesh',.01*fade);
  m0.box(0,h+.23-collapse*.19,-.69-tip,.74,.53,.69,'hellstone',.01*fade);
  m0.box(0,h+.18-collapse*.27,-1.14-tip,.83,.44,.65,'scar',.01*fade);
  m0.box(0,h-.14-collapse*.04,-1.48-tip,.51,.12,.38,'wound',.01*fade);
  for(const side of [-1,1]){
   const spread=side*(.43+collapse*.17);
   m0.beam(spread,h-.17,.53,spread*1.21,.12,.94,.14,'shadowflesh',.01);
   m0.beam(spread,h-.17,-.35,spread*1.29,.12,-.79,.16,'hellstone',.01);
   m0.box(side*.24,h+.34-collapse*.18,-1.43-tip,.085,.07,.045,
    'ember',.13*fade);
  }
  organicDeathFrames++;return;
 }
 if(!haveClip)return;
 const kind=ghost.hellVariant==='pinky'?'pinky':
  ghost.hellVariant==='hellknight'||ghost.hellVariant==='archfiend'?'knight':'imp';
 const name=kind==='pinky'?'hell_pinky':kind==='knight'?'hell_knight':'hell_imp';
 const model=BLENDER_KIT?.[name];if(!model)return;
 ghost.organicDeadT=clamp(1-ghost.life/ghost.max,0,1)*1.33;
 const pose={time,phase:0,walk:0,wind:0,strike:0,cast:0,turn:0,
  leap:0,land:0,breathing:0,feet:{},kind};
 const rig=window.OrganicRigV037.prepare(kind,pose,model,ghost);
 const yaw=ghost.facing||0,c=Math.cos(yaw),sn=Math.sin(yaw);
 const scale=(kind==='knight'?1.03:kind==='pinky'?.86:.91)*
  (ghost.hellVariant==='archfiend'?1.46:1);
 for(const batch of model.batches){
  const v=batch.v,col=HEX[batch.mat]||HEX.shadowflesh;
  for(let i=0;i<v.length;i+=6){
   const [x,y,z,nx,ny,nz]=window.OrganicRigV037.skin(rig,batch,i);
   m.v([ghost.x+scale*(c*x+sn*z),scale*y,ghost.z+scale*(-sn*x+c*z)],
    [c*nx+sn*nz,ny,-sn*nx+c*nz],
    col.map(q=>q*(.62+.38*ghost.life/ghost.max)),.002,x,z);
  }
 }
 organicDeathFrames++;
}
let organicDeathFrames=0;
function renderKineticFX(m,p,quality){
 const battery=quality==='battery',high=quality==='high',
  cam={x:p.x,y:1.64+p.height,z:p.z};
 for(const jet of impactJets.slice(-(battery?8:high?42:22))){
  if(Math.hypot(jet.x-p.x,jet.z-p.z)>(battery?7:18))continue;
  const fade=clamp(jet.life/jet.max,0,1);
  const tail=.012+.033*fade;
  m.ribbon(jet.x-jet.vx*tail,jet.y-jet.vy*tail,
    jet.z-jet.vz*tail,jet.x,jet.y,jet.z,
    jet.size*fade,jet.col,.18+.72*fade,cam);
 }
 const ghosts=battery?4:high?14:8;
 // Draw up to two nearest Hell bodies. Before this, only the most recently
 // killed monster could be seen, even when a Pinky collapsed beside the player.
 const corpses=deathGhosts.filter(g=>g.hellVariant&&
  Math.hypot(g.x-p.x,g.z-p.z)<(battery?7:high?14:9))
  .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))
  .slice(0,battery?1:2);
 for(const corpse of corpses)drawDemonDeathBody(m,corpse,quality);
 for(const ghost of deathGhosts.slice(-ghosts)){
  if(Math.hypot(ghost.x-p.x,ghost.z-p.z)>(battery?8:20))continue;
  const t=clamp(1-ghost.life/ghost.max,0,1),fade=1-t;
  const n=battery?3:high?8:5;
  for(let i=0;i<n;i++){
   const a=i*TAU/n+ghost.seed,spin=a+t*(i%2?-2:2);
   const r=(.15+t*(.28+i%3*.05))*ghost.scale;
   const y=Math.max(.10,(.48+i%3*.30)*ghost.scale+t*.32-t*t*.9);
   const sz=(.07+.065*(i%3))*ghost.scale*fade;
   if(sz<.008)continue;
   m.box(ghost.x+Math.cos(spin)*r,y,ghost.z+Math.sin(spin)*r,
    sz,sz*.62,sz*1.12,i%2?'rust':ghost.col,.12+.36*fade,spin);
  }
 }
}

const engineeringEmitters=[],impactScars=[];
function addEngineeringMicroDetails(m){
 engineeringEmitters.length=0;
 const status=['cyan','orange','green','purple','red','blue','warm'][sector];
 const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
 for(let z=2;z<N-2;z+=3)for(let x=2;x<N-2;x+=3){
  if(engineeringEmitters.length>=26)continue;
  if(!tile(x+.5,z+.5))continue;
  const faces=dirs.filter(([dx,dz])=>!tile(x+.5+dx,z+.5+dz));
  if(!faces.length)continue;
  const [dx,dz]=faces[(x*3+z+sector)%faces.length],xFace=x+.5+dx*.494,zFace=z+.5+dz*.494;
  const acrossZ=dx!==0,cy=1.12+((x*7+z*5)%3)*.19;
  const wx=acrossZ?.028:.69,wz=acrossZ?.69:.028;
  const fx=xFace+dx*.020,fz=zFace+dz*.020;
  // Recessed breaker cabinet, real thin frame, inset vent and four fasteners.
  m.box(fx,cy,fz,wx,.56,wz,'black',.018);
  m.box(fx,cy+.265,fz,wx+.012,.035,wz+.012,'chrome',.05);
  m.box(fx,cy-.265,fz,wx+.012,.035,wz+.012,'titanium',.04);
  for(const edge of [-1,1]){
   const xx=fx+(acrossZ?0:edge*.31),zz=fz+(acrossZ?edge*.31:0);
   m.box(xx,cy,zz,acrossZ?.041:.023,.46,acrossZ?.023:.041,'steelblue',.07);
   for(const yy of [-.21,.21])
    m.box(xx+dx*.010,cy+yy,zz+dz*.010,.028,.025,.028,'brass',.08);
  }
  const frontX=fx+dx*.024,frontZ=fz+dz*.024;
  m.box(frontX,cy+.105,frontZ,acrossZ?.014:.39,.11,acrossZ?.39:.014,'metal2',.02);
  for(let j=-2;j<=2;j++){
   const xx=frontX+(acrossZ?0:j*.092),zz=frontZ+(acrossZ?j*.092:0);
   m.box(xx,cy-.09,zz,acrossZ?.013:.054,.023,acrossZ?.054:.013,'titanium',.07);
  }
  const ledX=frontX+(acrossZ?0:.235),ledZ=frontZ+(acrossZ?.235:0);
  m.box(ledX,cy+.19,ledZ,.048,.046,.048,status,.36);
  // Super-low relief warning chevrons in front of selected panels.
  if((x+z+sector)%4===0){
   const markerX=fx+dx*.79,markerZ=fz+dz*.79;
   if(!tile(markerX,markerZ)){
    for(let i=0;i<3;i++){
     const xx=markerX+(acrossZ?0:(i-1)*.145),zz=markerZ+(acrossZ?(i-1)*.145:0);
     m.box(xx,.016,zz,.093,.006,.036,i%2?'black':'brass',.11,.30);
    }
   }
  }
  engineeringEmitters.push({x:frontX,z:frontZ,y:cy,dx,dz,acrossZ,ledX,ledZ,status,
   vent:(x*3+z*5)%4===0,seed:x*13+z*17+sector*19});
 }
}
// A handful of live breaker arcs and vent wisps, close to the player only.
// On Battery quality, only minimal indicator pulses are drawn.
function drawEngineeringDetailFX(m,p,quality){
 if(hellBreach.state==='active')return;
 const battery=quality==='battery',high=quality==='high';
 const reach=battery?7:high?19:13;
 let effects=0,limit=battery?3:high?18:10;
 for(const e of engineeringEmitters){
  if(effects>=limit)break;
  if(Math.hypot(e.x-p.x,e.z-p.z)>reach)continue;
  const period=4.2+(e.seed%5)*.73,t=(time+e.seed*.19)%period;
  const pulse=.22+.16*Math.sin(time*2.3+e.seed);
  m.box(e.ledX+e.dx*.011,e.y+.19,e.ledZ+e.dz*.011,.030,.029,.030,e.status,pulse);
  effects++;
  if(!battery&&t<.15){
   // Arc crosses a real cabinet at a hand-sized scale, not the sky.
   const a=e.acrossZ?0:1,b=e.acrossZ?1:0,drift=Math.sin(time*61+e.seed)*.031;
   const x1=e.x-a*.14+e.dx*.024,z1=e.z-b*.14+e.dz*.024;
   const x2=e.x+a*.16+e.dx*.024,z2=e.z+b*.16+e.dz*.024;
   const midX=(x1+x2)*.5+e.dx*.045,midZ=(z1+z2)*.5+e.dz*.045;
   m.beam(x1,e.y-.12,z1,midX,e.y-.055+drift,midZ,.010,'cyan',.82);
   m.beam(midX,e.y-.055+drift,midZ,x2,e.y-.16,z2,.009,'white',.38);
   for(let i=0;i<(high?3:1);i++){
    const a2=time*22+i*2.4+e.seed;
    m.box(e.x+Math.sin(a2)*.08,e.y-.21-i*.045,
     e.z+Math.cos(a2)*.07,.016,.023,.016,'warm',.23);
   }
  }
  if(!battery&&e.vent&&effects%2===0){
   const n=high?4:2;
   for(let j=0;j<n;j++){
    const rise=((time*.44+j/n+e.seed*.071)%1);
    const spread=.04+rise*.14,osc=Math.sin(time*1.6+j*2+e.seed);
    m.box(e.x+e.dx*(.04+rise*.13)+(e.acrossZ?0:osc*spread),e.y-.17+rise*.44,
      e.z+e.dz*(.04+rise*.13)+(e.acrossZ?osc*spread:0),
      .026+rise*.020,.042+rise*.027,.026+rise*.019,
      j%2?'mist':'glass',.025);
   }
  }
 }
}
// Physical impact traces are short-lived, world-anchored, quality-capped
// and do not change the map or hit detection.
function recordWallImpact(hit,yaw,pitch){
 if(impactScars.length>=34)impactScars.shift();
 const nx=Math.sin(yaw)*Math.cos(pitch),nz=-Math.cos(yaw)*Math.cos(pitch);
 const floor=hit.y<=.11;
 let x=hit.x,z=hit.z,axis='floor';
 if(!floor){
  if(Math.abs(nx)>Math.abs(nz)){axis='x';x=Math.floor(hit.x)+(nx>0?-.015:1.015);}
  else{axis='z';z=Math.floor(hit.z)+(nz>0?-.015:1.015);}
 }
 impactScars.push({x,z,y:floor?.05:clamp(hit.y,.14,2.78),axis,
  size:.10+.048*rnd(),life:13,max:13,phase:rnd()*TAU});
 spawnImpactJet(hit.x,hit.y,hit.z,'warm',6);
}
function drawWallImpacts(m,p,quality){
 const limit=quality==='battery'?8:quality==='balanced'?18:30;
 let shown=0;
 for(let i=impactScars.length-1;i>=0&&shown<limit;i--){
  const d=impactScars[i],dist=Math.hypot(d.x-p.x,d.z-p.z);
  if(dist>(quality==='battery'?7:17))continue;
  shown++;
  const fade=clamp(d.life/d.max,0,1),s=d.size*(.72+.28*fade),bright=fade>.43?'black':'rust';
  if(d.axis==='floor'){
   m.box(d.x,.046,d.z,s*1.45,.004,s*1.25,bright,.014);
   m.box(d.x,.050,d.z,s*.62,.003,s*.60,'dark',.01);
   if(quality==='high'){
    m.box(d.x+Math.cos(d.phase)*s*.6,.050,d.z+Math.sin(d.phase)*s*.7,s*.45,.003,.018,'brass',.035,d.phase);
   }
  }else{
   const wx=d.axis==='x'?.007:s*1.45,wz=d.axis==='z'?.007:s*1.45;
   m.box(d.x,d.y,d.z,wx,s*1.30,wz,bright,.008);
   m.box(d.x,d.y,d.z,d.axis==='x'?.010:s*.5,s*.52,d.axis==='z'?.010:s*.5,'dark',.01);
   if(quality==='high'){
    m.box(d.x,d.y+s*.80,d.z,d.axis==='x'?.008:s*.43,.015,d.axis==='z'?.008:s*.43,'brass',.038);
   }
  }
 }
}


/** AFTERLIGHT v0.24: sculpted, scene-specific upper-story machinery.
 * Hero structures do not change the authoritatively collision-backed map.
 * Only 6 distant animated units are updated per frame; detail caps scale
 * with Battery/Balanced/High. Static scene contents remain deterministic.
 */
const atmosphericMachines=[];
function addSectorMechanicalDetail(m){
 atmosphericMachines.length=0;
 const accent=['cyan','pink','purple','orange','green','blue','red'][sector];
 const warning=['warm','red','purple','warm','green','cyan','orange'][sector];
 // Suspended service bridges with real underside, brackets, hanging cables.
 for(let i=0;i<5;i++){
  const x=4.6+i*5.25,z=i%2?N-3.1:3.1,y=5.25+(i%2)*.56;
  m.box(x,y,z,2.1,.19,.86,'titanium',.07);
  m.box(x,y+.18,z,2.13,.07,.67,'black',.03);
  for(const side of [-1,1]){
   m.beam(x+side*1.02,y-.18,z-.37,x+side*.71,y-.65,z-.37,.075,'chrome',.05);
   m.box(x+side*.84,y-.12,z+.39,.08,.35,.08,'rust',.03);
  }
  m.box(x,y-.16,z,.94,.032,.24,warning,.19);
  for(let j=-2;j<=2;j++)m.box(x+j*.36,y+.24,z,.026,.11,.57,'metal2',.02);
 }
 // Huge sector-specific skyline equipment beyond the walkable shell.
 for(let i=0;i<7;i++){
  const edgeSide=i%4,x=edgeSide===0?-2.9:edgeSide===1?N+2.9:3+i*3.5;
  const z=edgeSide===2?-2.8:edgeSide===3?N+2.8:3+i*3.5;
  const h=8+(i%3)*2.4;
  m.box(x,h*.48,z,1.15,h,1.14,sector===3?'rust':'metal2',.018);
  m.box(x,h-.13,z,1.55,.18,1.53,'polished',.07);
  m.box(x,h+.15,z,.72,.48,.73,'dark',.05);
  for(let j=1;j<=4;j++){
   const y=.65+(h-1.4)*j/5;
   m.box(x,y,z,1.26,.065,1.24,'chrome',.11);
   m.box(x+.58,y+.08,z,.035,.12,.66,accent,.16);
  }
  for(let j=0;j<3;j++){
   const tx=x+(j-1)*.36;
   m.beam(tx,h+.32,z-.23,tx+.14,h+1.18+(j%2)*.35,z+.22,.055,'steelblue',.08);
  }
 }
 // Sector-themed static details: ducts, tubes, suspended reactor plates.
 if(sector===1||sector===4){
  for(let i=0;i<7;i++){
   const x=2+i*4.35,z=i%2?N-2.1:2.1;
   m.box(x,4.7,z,1.18,1.03,.19,'dark',.02);
   m.box(x,4.73,z+.13,.88,.66,.034,sector===1?'pink':'green',.27);
   for(let j=0;j<6;j++)m.box(x-.45+j*.18,4.45,z+.151,.06,.035,.023,'chrome',.09);
  }
 }else if(sector===3){
  for(let i=0;i<6;i++){
   const x=3+i*4.45,z=i%2?N-2.25:2.25;
   for(let j=0;j<3;j++)m.beam(x-.60,5.18+j*.25,z,x+.60,5.18+j*.25,z,.082,'rust',.03);
   m.box(x,5.94,z,.87,.27,.44,'metal',.03);
   m.box(x,5.97,z+.23,.52,.037,.035,'orange',.37);
  }
 }else if(sector===2||sector===5){
  for(let i=0;i<7;i++){
   const a=i*TAU/7,x=C+Math.cos(a)*9.75,z=C+Math.sin(a)*9.75;
   m.box(x,6.24,z,.30,1.48,.30,'titanium',.08);
   m.box(x,6.97,z,.58,.17,.57,accent,.38);
   m.box(x,5.95,z,.61,.08,.61,'chrome',.14);
  }
 }else if(sector===6){
  for(let i=0;i<7;i++){
   const a=i*TAU/7,x=C+Math.cos(a)*7.2,z=C+Math.sin(a)*7.2;
   m.box(x,5.24,z,.54,1.22,.55,'rust',.09);
   m.box(x,5.65,z,.22,.19,.23,'red',.34);
   for(let j=0;j<3;j++)m.box(x,4.79+j*.27,z+.28,.37,.06,.036,'orange',.13);
  }
 }
 // Three live turbine cores, carefully high enough to clear all traversal.
 for(let i=0;i<3;i++){
  const x=4.9+i*10.5,z=(i%2)?N-4.1:4.1,y=6.95+(i%2)*.43;
  m.box(x,y,z,1.65,1.63,.23,'metal2',.06);
  m.box(x,y,z+.15,1.35,1.34,.055,'black',.02);
  for(const side of [-1,1]){
   m.box(x+side*.76,y,z+.17,.092,1.54,.15,'chrome',.12);
   m.box(x,y+side*.76,z+.17,1.54,.092,.15,'chrome',.12);
  }
  m.box(x,y,z+.19,.18,.19,.19,accent,.29);
  atmosphericMachines.push({x,y,z:z+.25,seed:i*11+sector*5,col:accent});
 }
}
// Motion uses the existing triangles path; no extra draw calls or textures.
function drawSectorMachineMotion(m,p,quality){
 if(hellBreach.state==='active')return;
 const high=quality==='high',battery=quality==='battery';
 const limit=battery?1:high?3:2;
 for(let i=0;i<Math.min(limit,atmosphericMachines.length);i++){
  const fan=atmosphericMachines[i];
  if(Math.hypot(fan.x-p.x,fan.z-p.z)>(battery?16:30))continue;
  const a=time*(1.3+i*.35),blades=battery?3:high?6:4,r=.48;
  for(let k=0;k<blades;k++){
   const t=a+k*TAU/blades,xx=fan.x+Math.cos(t)*r,yy=fan.y+Math.sin(t)*r;
   m.beam(fan.x,fan.y,fan.z,xx,yy,fan.z,.075,'titanium',.08);
   if(high)m.box(xx,yy,fan.z,.17,.065,.07,'chrome',.12,t);
  }
  const flick=.14+.18*Math.max(0,Math.sin(time*1.7+i*3.3));
  m.box(fan.x,fan.y,fan.z+.045,.13,.13,.06,fan.col,flick);
  if(!battery){
   for(let j=0;j<(high?4:2);j++){
    const rise=(time*.31+j*.27+i*.17)%1;
    m.box(fan.x+(j-2)*.10+.11*Math.sin(time*.8+j),
       fan.y-.49+rise*.62,fan.z+.33+rise*.09,
       .035+rise*.015,.048+rise*.025,.03,'mist',.025);
   }
  }
 }
}

function buildCircusStatic(){
 // A dedicated non-industrial floor: worn oak, packed sawdust, dark velvet
 // apron and a warm show ring. This bypasses ALL industrial asset emitters.
 const m=new Mesh(),centerZ=C-2,radius=12.15,ringZ=C-3.3;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const xx=x+.5,zz=z+.5,d=Math.hypot(xx-C,zz-centerZ);
  if(d>radius){m.box(xx,-.024,zz,.99,.055,.99,[.055,.024,.037],0);continue;}
  const ring=Math.hypot(xx-C,zz-ringZ),aisle=Math.abs(xx-C)<1.55&&zz>ringZ+4.7;
  const colors=ring<5.42?[[.30,.195,.112],[.34,.220,.136],[.28,.176,.096]]:
   aisle?[[.43,.11,.12],[.29,.078,.087],[.48,.24,.16]]:
   [[.22,.105,.077],[.26,.130,.080],[.18,.075,.060]];
  m.box(xx,-.025,zz,.985,.05,.985,colors[(x*7+z*11)%3],.004);
  if((x+z)%3===0&&ring>=5.42)
   m.box(xx,.002,zz,.86,.007,.02,[.33,.21,.135],.008);
 }
 // Canvas-covered backstage at the northern edge, velvet steps and footrail.
 for(let i=0;i<16;i++){
  const x=C-7.6+i*.98;
  m.box(x,.008,3.0,.92,.038,.42,i%2?[.31,.075,.093]:[.62,.50,.37],.015);
 }
 for(let i=0;i<20;i++){
  const a=i*TAU/20,b=(i+1)*TAU/20,r=5.37;
  m.beam(C+Math.cos(a)*r,.072,ringZ+Math.sin(a)*r,
   C+Math.cos(b)*r,.072,ringZ+Math.sin(b)*r,.060,'brass',.08);
 }
 upload(staticGPU,m.data);
}
function buildStatic(){impactScars.length=0;engineeringEmitters.length=0;atmosphericMachines.length=0;
 if(circus.state==='active'){buildCircusStatic();return;}
 if(livingRealm.active){upload(staticGPU,[]);return;}
 // The independent real-GLB Meadow renderer supplies its own ground/flowers.
 // Never upload industrial floor or metal walls underneath the Meadow scene.
 if(afterlightMeadowActive()){
  // When the Blender GLB is still loading or the GPU cannot draw it,
  // keep the verified meadow fallback instead of exposing a blank floor.
  if(window.VEILFORGE_MEADOW_GPU?.state?.status!=='ready'&&
     typeof buildMeadowFallback==='function')buildMeadowFallback();
  else upload(staticGPU,[]);
  return;
 }if(blockworld.state==='active'){buildBlockworldStatic();return;}if(heavenSanctum.state==='active'){buildHeavenStatic();return;}if(hellBreach.state==='active'){buildHellStatic();return;}const m=new Mesh();seed=1749;for(let z=0;z<N;z++)for(let x=0;x<N;x++){
 m.box(x+.5,-.26,z+.5,1,.46,1,(x+z)%7===0?'metal2':'dark');
 if(tile(x+.5,z+.5)){
 m.box(x+.5,.86,z+.5,1,2.2,1,'metal2');
 if(!tile(x+.5,z-.5))addPanel(m,x,z,'z',-.01);
 if(!tile(x+.5,z+1.5))addPanel(m,x,z,'z',.99);
 if(!tile(x-.5,z+.5))addPanel(m,x,z,'x',-.01);
 if(!tile(x+1.5,z+.5))addPanel(m,x,z,'x',.99);
 m.box(x+.5,2.03,z+.5,.93,.055,.93,'rim');continue;
 }
 // All walkable surfaces share a genuine y=0 ground plane. Surface details
 // sit within 15mm of it, so character soles and view camera never bury in
 // raised fake tiles while the collision map remains unchanged.
 m.box(x+.5,-.006,z+.5,.97,.024,.97,(x+z)%4===0?'floor':'metal2');
 m.box(x+.5,-.015,z+.5,.84,.016,.84,'floor');
 if((x*3+z)%5===0){for(const a of [-.25,-.12,0,.12,.25])m.box(x+.5+a,.001,z+.5,.022,.008,.77,'dark')}
 if((x+2*z)%7===0){m.box(x+.5,.009,z+.5,.69,.007,.038,(x+z)%2===0?'purple':'cyan',.20)}
 if((x+z)%3===0)m.box(x+.5,.009,z+.5,.13,.008,.13,'metal');
 if((x+z*3)%11===0){m.box(x+.5,2.65,z+.5,.65,.04,.15,'rim');m.box(x+.5,2.59,z+.5,.32,.025,.065,['green','purple','red','blue'][(x+z)%4],.64)}
 if((x*5+z)%13===0){m.box(x+.5,2.72,z+.5,.12,.12,.12,'metal2');m.box(x+.5,2.67,z+.5,.08,.01,.23,'blue',.35)}
 }
 // AFTERLIGHT VISUAL KIT v0.3: modular panel seams, culverts, live cables, hazard glyphs.
 // Surface-only details: collision remains governed by the tested v0.2 map.
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){
   if(tile(x+.5,z+.5))continue;
   if((x+z*3)%3===0){
     m.box(x+.5,-.001,z+.16,.79,.012,.021,'brass');
     m.box(x+.5,-.001,z+.84,.79,.012,.021,'rim');
     for(const sx of [.16,.84])m.box(x+sx,.003,z+.5,.026,.012,.56,'dark');
   }
   if((x*7+z*11)%13===0){
     // Floor drainage/grill with a cooled luminous trace and inset conduits.
     m.box(x+.5,.009,z+.5,.78,.008,.44,'black');
     for(let k=-2;k<=2;k++)m.box(x+.5+k*.13,.014,z+.5,.025,.006,.38,'rim');
     m.box(x+.5,.014,z+.67,.7,.005,.018,'orange',.16);
   }
   if((x*17+z*5)%19===0){
     for(let k=0;k<4;k++)m.box(x+.27+k*.15,.012,z+.5,.075,.007,.32,k%2?'black':'warm',.075);
   }
 }
 // High-mounted infrastructure uses no walk-blocking geometry.
 for(let z=4;z<N-2;z+=8){
    for(let x=3;x<N-2;x+=9){
     m.box(x+.5,3.25,z+.5,.14,1.25,.14,'rim');
     m.box(x+.5,3.84,z+.5,.47,.19,.47,'metal');
     m.box(x+.5,3.73,z+.5,.22,.027,.22,['green','purple','red','blue'][(x+z)%4],.62);
      m.box(x+.5,4.04,z+.5,.22,.026,.22,'metal2',.07);
     // two suspended slack cables linking pieces of the grid
     if(x+5<N-2)for(let j=0;j<5;j++)m.beam(x+.5+j,3.70-.27*Math.sin((j/4)*Math.PI),z+.5,x+1.5+j,3.70-.27*Math.sin(((j+1)/4)*Math.PI),z+.5,.022,'black',0);
   }
 }
 // Relay landing markers and high-intensity aerial waypoints.
 for(const o of RELAYS){
   for(let a=0;a<TAU;a+=TAU/12){let b=a+TAU/12;
     m.beam(o.x+Math.cos(a)*1.08,.055,o.z+Math.sin(a)*1.08,o.x+Math.cos(b)*1.08,.055,o.z+Math.sin(b)*1.08,.036,'warm',.85);
   }
   m.box(o.x,2.42,o.z,.08,1.76,.08,'mist',.08);
   m.box(o.x,3.35,o.z,.25,.25,.25,'warm',1.85);
 }
 // Remove the recurring center reactor sculpture entirely; objective state persists.
 const cx=C,cz=C;
 // Dramatic vertical megacity silhouettes beyond the playable area.
 for(let i=0;i<105;i++){let a=rnd()*TAU,r=22+rnd()*30,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r,h=3+rnd()*13,w=.7+rnd()*2.7;m.box(x,h/2-1,z,w,h,w,'dark');m.box(x,h*.67,z,w*.65,.09,w*.65,'rim');if(i%2===0)for(let y=1;y<h-1;y+=.82){m.box(x,y,z+w*.51,w*.65,.045,.025,i%5?'purple':'cyan',.45);if(i%6===0)m.box(x+w*.51,y,z,.025,.045,w*.65,'warm',.6)} if(i%11===0){m.box(x,h-.62,z,w*.6,1.1,w*.6,'metal2');m.box(x,h-.02,z,.18,.12,.18,'warm',2.8)}}
 // Site perimeter searchlights & neon beacons.
 for(let i=1;i<N-1;i+=3){for(let z of [1,N-2]){m.box(i+.5,2.3,z+.5,.12,4.5,.12,'rim');m.box(i+.5,4.65,z+.5,.22,.34,.22,'cyan',2.6)}for(let x of [1,N-2]){m.box(x+.5,2.3,i+.5,.12,4.5,.12,'rim');m.box(x+.5,4.65,i+.5,.22,.34,.22,'purple',2.6)}}
 addSectorSetDressing(m);
 addMaterialStoryProps(m);
 addEngineeringMicroDetails(m);
 addSectorMechanicalDetail(m);
 addCinematicBattlefield(m);
 // Distant terrain and atmospheric horizon.
 m.box(C,-1.1,C,150,.38,150,'dark');
 upload(staticGPU,m.data);
}
// Minimal mat4 functions, column-major for GLSL.
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o}
function lookAt(ex,ey,ez,tx,ty,tz){let fx=tx-ex,fy=ty-ey,fz=tz-ez;let f=1/Math.hypot(fx,fy,fz);fx*=f;fy*=f;fz*=f;let sx=-fz,sz=fx,sl=1/Math.hypot(sx,sz);sx*=sl;sz*=sl;let ux=-fy*sz,uy=-fz*sx+fx*sz,uz=fy*sx;return new Float32Array([sx,ux,-fx,0,0,uy,-fy,0,sz,uz,-fz,0,-sx*ex-sz*ez,-ux*ex-uy*ey-uz*ez,fx*ex+fy*ey+fz*ez,1])}
// WebGL view up vector is explicitly Y-up, with cross(right,forward) preserving handedness.
function cameraView(){
 if(introCine.active){const cam=cinematicCamera();return lookAt(cam.x,cam.y,cam.z,cam.target.x,cam.target.y,cam.target.z)}
  if(bossCine.active){const cam=bossCamera();return lookAt(cam.x,cam.y,cam.z,cam.target.x,cam.target.y,cam.target.z)}
 const pitch=clamp(player.pitch,-1.20,1.20),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const fx=Math.sin(player.yaw)*cp,fz=-Math.cos(player.yaw)*cp;
 const eyeY=1.64+player.height+Math.sin(player.bob)*.028-player.recoil*.028-player.landKick*.09;
 return lookAt(player.x,eyeY,player.z,
  player.x+fx+player.lean*.10,eyeY+sp+Math.sin(player.bob)*.008,player.z+fz);
}
function drawMesh(gpu){if(!gpu.count)return;gl.bindVertexArray(gpu.vao);gl.drawArrays(gl.TRIANGLES,0,gpu.count)}
const WEAPONS=[
 {name:'FLUXSIDE',sub:'WYR-P1 // INDUCTION SIDEARM',dmg:36,rate:.31,spread:.032,shots:1,range:18,col:'cyan',effect:'energy',startingSidearm:true},
 {name:'SHARD CANNON',sub:'S-12 // PARTICLE BURST',dmg:12,rate:.65,spread:.16,shots:6,range:10,col:'orange',effect:'scatter'},
 {name:'LANCER RAIL',sub:'L-09 // COIL ACCELERATOR',dmg:92,rate:1.25,spread:.009,shots:1,range:31,col:'pink',effect:'pierce'},
 {name:'NOVA LAUNCHER',sub:'N-4 // AREA PLASMA',dmg:49,rate:1.12,spread:.042,shots:1,range:17,col:'purple',effect:'splash'},
 {name:'SPECTRE CARBINE',sub:'SC-8 // PULSE TWINBARREL',dmg:12,rate:.13,spread:.06,shots:2,range:18,col:'blue',effect:'pulse',rarity:'rare'},
 {name:'INFERNO REPEATER',sub:'IR-3 // THERMAL IGNITER',dmg:20,rate:.26,spread:.065,shots:1,range:16,col:'orange',effect:'ignite',rarity:'rare'},
 {name:'CRYO NEEDLE',sub:'CN-5 // SUBZERO ACCELERATOR',dmg:29,rate:.36,spread:.02,shots:1,range:21,col:'cyan',effect:'freeze',rarity:'rare'},
 {name:'TESLA FORK',sub:'TF-9 // CHAIN CONDUCTOR',dmg:34,rate:.57,spread:.095,shots:2,range:17,col:'purple',effect:'arc',rarity:'epic'},
 {name:'GRAVITON MAUL',sub:'GM-1 // SIEGE IMPACTOR',dmg:115,rate:1.52,spread:.038,shots:1,range:22,col:'gold',effect:'gravity',rarity:'legendary'},
 {name:'NEEDLE STORM',sub:'NS-11 // MICROSHARD ROTARY',dmg:8,rate:.12,spread:.18,shots:4,range:14,col:'green',effect:'shred',rarity:'epic'}
];
// 240 new forge weapons built from ten distinct real combat/mesh families.
// A variant is not just a rename: rate, recoil, scatter, traits, damage, color,
// heat and projectile profile are deterministic and saved under a stable ID.
// 10 original handcrafted silhouettes are the parent rigs, so Android meshes
// remain bounded; modular attachments give each unlocked weapon visual identity.
const ORIGINAL_WEAPON_COUNT=10;
const FORGE_NAMES=['GHOST','FERAL','IRONWIND','PARALLAX','NIGHTFALL','MERCURY','SHATTER',
 'HAZARD','ECLIPSE','VOIDSONG','STORMGLASS','HELIOS','REDLINE','SUNDOWN','NEBULA',
 'COLDSTAR','CINDER','NULLFIELD','ECHOCRAFT','DARKMATTER','OBLIVION',
 'INFINITY','CROWNLESS','LASTLIGHT'];
const FORGE_MODS=['ignite','freeze','arc','gravity','pierce','splash','shred',
 'shield','vamp','overclock','glass','recoil'];
const FORGE_COLORS=['green','purple','red','blue','orange','cyan','pink','gold'];
for(let tier=0;tier<FORGE_NAMES.length;tier++)for(let base=0;base<ORIGINAL_WEAPON_COUNT;base++){
 const root=WEAPONS[base],mod=FORGE_MODS[(tier+base*3)%FORGE_MODS.length];
 const elite=tier>=20,mid=tier>=12;
 const shotMultiplier=1+((tier+base)%3===0?1:0),damageScale=.78+tier*.054+((base*7+tier)%5)*.033;
 const rateScale=.84+((tier+base*3)%7)*.095;
 const w={...root,startingSidearm:false,name:FORGE_NAMES[tier]+' '+root.name,sub:'F-'+(tier+1)+' // '+mod.toUpperCase()+' '+root.sub.split('//').pop().trim(),
  dmg:Math.round(root.dmg*damageScale*10)/10,
  rate:Math.round(Math.max(.075,root.rate*rateScale)*1000)/1000,
  shots:Math.min(9,Math.max(1,Math.round(root.shots*(shotMultiplier===2?1.28:1)))),
  spread:Math.max(.006,root.spread*(.80+(tier%5)*.11)),
  range:Math.min(34,root.range+((tier*3+base)%5)-1),
  col:FORGE_COLORS[(tier+base)%FORGE_COLORS.length],
  rarity:elite?(tier===23?'mythic':'legendary'):mid?'epic':tier>=5?'rare':'common',
  variant:tier,archetype:base,modifier:mod,prototype:true,
  unlockId:'gun-'+tier+'-'+base,weaponClass:root.name,visualIndex:base,
  projectileProfile:(tier*11+base*7)%5,
  // Deliberate drawbacks prevent every high-DPS forge from being a pure upgrade.
  selfRisk:mod==='glass'?.30+Math.min(.4,tier*.012):0};
 WEAPONS.push(w);
}
if(WEAPONS.length!==250)throw Error('Forge catalog must contain 250 functional guns');
const CIRCUS_GUN_INDEX=WEAPONS.length;
WEAPONS.push({name:"JESTER'S POPPER",sub:"JP-1 · MISPRINTED FUNHOUSE SPECIAL",
 dmg:13,rate:.43,spread:.105,shots:3,range:17,col:'pink',
 effect:'scatter',rarity:'mythic',visualIndex:1,
 circusGun:true,unlockId:'special-circus-popper'});
const WYRDFLUX_GUN_CLASSES=['LASER RIFLES','SHOTGUNS','RAILGUNS','ROCKETS',
 'MACHINE LASERS','FLAME WEAPONS','ICE WEAPONS','ELECTRIC WEAPONS',
 'HEAVY CANNONS','MACHINE GUNS'];
function wyrdfluxWeaponClass(w){
 const idx=w?.visualIndex??w?.archetype??WEAPONS.indexOf(w);
 return w?.startingSidearm?'SIDEARMS':WYRDFLUX_GUN_CLASSES[Math.max(0,idx)%WYRDFLUX_GUN_CLASSES.length]||'LASER RIFLES';
}
function wyrdfluxWeaponBrief(w){
 return wyrdfluxWeaponClass(w)+' · '+Math.round(w.dmg)+' DAMAGE · '+
  (w.shots>1?w.shots+' SHOTS · ':'')+
  (w.effect==='splash'?'EXPLOSIVE':w.effect==='pierce'?'PIERCING':
   w.effect==='freeze'?'FREEZES':w.effect==='ignite'?'BURNS':
   w.effect==='arc'?'CHAIN LIGHTNING':w.effect==='gravity'?'GRAVITY':
   w.effect==='scatter'?'SPREAD':'ENERGY');
}

/* Four world-locked mythic weapon recipes. They NEVER enter the ordinary armory
 * lottery. Only completion of that dimension can offer its weapon; the
 * temporary meadow test lab awards nothing to the permanent career save.
 * All weapons reuse known combat effects and original sculpted gun rigs.
 */
const WORLD_MYTHIC_WEAPONS=[
 {name:'ABYSS HEARTBREAKER',sub:'BLACK CHAPEL // HELLFIRE CORE',dmg:156,rate:1.34,
  spread:.024,shots:2,range:25,col:'red',effect:'ignite',rarity:'mythic',visualIndex:3,worldSource:'hell'},
 {name:'SERAPHIM HALO',sub:'HEAVEN SANCTUM // DIVINE ARC',dmg:57,rate:.38,
  spread:.018,shots:4,range:31,col:'gold',effect:'arc',rarity:'mythic',visualIndex:7,worldSource:'heaven'},
 {name:"WARDEN'S ECHO",sub:'BLOCKWORLD // SONIC CORE',dmg:188,rate:1.64,
  spread:.015,shots:1,range:29,col:'cyan',effect:'gravity',rarity:'mythic',visualIndex:8,worldSource:'blockworld'},
 {name:'THORN QUEEN',sub:'THE MEADOW // SPORE-STORM',dmg:41,rate:.44,
  spread:.12,shots:8,range:23,col:'green',effect:'shred',rarity:'mythic',visualIndex:9,worldSource:'meadow'},
 {name:'BLACKWAKE BROADSIDE',sub:'SECRET SHIPWRECK // CURSED TIDAL CANNON',dmg:61,rate:.88,
  spread:.055,shots:2,range:23,col:'cyan',effect:'splash',rarity:'mythic',
  visualIndex:3,worldSource:'blackwake'}
];
for(const weapon of WORLD_MYTHIC_WEAPONS)WEAPONS.push(weapon);
if(WEAPONS.length!==256)throw Error('World mythic catalog must contain 256 distinct weapons');
const WYRDFLUX_BASE_WEAPON_COUNT=WEAPONS.length;
function worldRelicCardFor(world){
 const index=WEAPONS.findIndex(w=>w.worldSource===world);
 return index>=0?ARMORY_CARDS[index]:null;
}
function queueWorldRelic(world){
 if(testLabMode||worldRelicOffer||!WORLD_MYTHIC_WEAPONS.some(w=>w.worldSource===world))return false;
 const card=worldRelicCardFor(world);
 if(!card||activeGun[card.weaponIndex])return false;
 // A genuine 9% treasure chance per successful boss-room clear.
 if(rnd()>=.09)return false;
 worldRelicOffer=world;
 announce('✦ MYTHIC '+world.toUpperCase()+' RELIC FOUND ✦',3.5);
 notice('A WORLD-EXCLUSIVE SUPER WEAPON MAY APPEAR IN YOUR NEXT CHOICE',3.6);
 return true;
}


const UPGRADES=[
 {id:'plating',tag:'DEFENSE',rarity:'common',icon:'⬡',name:'REACTIVE PLATING',text:'+28 armor capacity; repair 38 armor.',max:9,apply:()=>{player.maxHp+=28;player.hp=Math.min(player.maxHp,player.hp+38)}},
 {id:'barrier',tag:'DEFENSE',rarity:'common',icon:'◇',name:'PHASE BARRIER',text:'+24 shield capacity; recharge shields.',max:9,apply:()=>{player.maxShield+=24;player.shield=player.maxShield}},
 {id:'coils',tag:'OFFENSE',rarity:'common',icon:'↗',name:'HIGH-VOLT COILS',text:'+18% damage. Stacks multiplicatively.',max:8,apply:()=>player.damageMult*=1.18},
 {id:'ferro',tag:'OFFENSE',rarity:'common',icon:'✦',name:'FERRO ROUNDS',text:'+14% firing speed.',max:8,apply:()=>player.speedMult*=1.14},
 {id:'blink',tag:'MOBILITY',rarity:'common',icon:'≋',name:'BLINK MOTOR',text:'+13% movement; dash cooldown -15%.',max:6,apply:()=>{player.moveMult*=1.13;player.dashMult*=.85}},
 {id:'afterburner',tag:'OVERDRIVE',rarity:'common',icon:'⚡',name:'AFTERBURNER',text:'+26% overdrive energy from damage.',max:6,apply:()=>player.rageMult*=1.26},
 {id:'regen',tag:'DEFENSE',rarity:'common',icon:'⌬',name:'REGEN MATRIX',text:'+30% passive shield recharge.',max:6,apply:()=>player.regenMult*=1.30},
 {id:'cache',tag:'UTILITY',rarity:'common',icon:'✴',name:'FIELD CACHE',text:'+220 salvage, fully repair armor.',max:99,apply:()=>{player.cash+=220;player.hp=player.maxHp}},
 {id:'crit',tag:'OFFENSE',rarity:'rare',icon:'✳',name:'PRECISION CATALYST',text:'+9% critical chance. Critical hits deal 1.85× damage.',max:6,apply:()=>{}},
 {id:'arc',tag:'ELEMENTAL',rarity:'rare',icon:'ϟ',name:'ARC CONDUCTOR',text:'Weapon hits can chain electricity between enemies.',max:6,apply:()=>{}},
 {id:'blast',tag:'ELEMENTAL',rarity:'rare',icon:'☄',name:'VOLATILE REACTOR',text:'Defeated hostiles burst into area damage.',max:5,apply:()=>{}},
 {id:'vamp',tag:'SUSTAIN',rarity:'rare',icon:'✚',name:'NANITE HARVEST',text:'Restore armor on eliminations.',max:5,apply:()=>{}},
 {id:'echo',tag:'OFFENSE',rarity:'rare',icon:'≫',name:'ECHO CHAMBER',text:'Sometimes fires a free extra volley.',max:5,apply:()=>{}},
 {id:'shock',tag:'MOBILITY',rarity:'rare',icon:'◈',name:'PHASE SHOCKWAVE',text:'Dashing blasts nearby hostiles and throws sparks.',max:5,apply:()=>{}},
 {id:'scav',tag:'UTILITY',rarity:'rare',icon:'◫',name:'SALVAGE ENGINE',text:'More salvage and armor from pickups.',max:6,apply:()=>{}},
 {id:'haste',tag:'MOBILITY',rarity:'rare',icon:'❯',name:'KINETIC SURGE',text:'More momentum on sprint and dash; recover energy faster.',max:5,apply:()=>{player.moveMult*=1.065}},
 {id:'vortex',tag:'ELEMENTAL',rarity:'epic',icon:'◎',name:'ION VORTEX',text:'Kills pull nearby hostiles into a destructive storm.',max:3,apply:()=>{}},
 {id:'guard',tag:'DEFENSE',rarity:'epic',icon:'▣',name:'AEGIS CONVERTER',text:'Eliminations restore shields and cool your equipped gun.',max:5,apply:()=>{}},
 {id:'frenzy',tag:'OFFENSE',rarity:'epic',icon:'♜',name:'BATTLE FRENZY',text:'Kills grant short, stacking fire-rate surges.',max:4,apply:()=>{}},
 {id:'leap',tag:'MOBILITY',rarity:'epic',icon:'↟',name:'ZERO-G BOUNCE',text:'Higher jumps, aerial control and a landing burst.',max:3,apply:()=>{}},
 {id:'prism',tag:'ELEMENTAL',rarity:'epic',icon:'✺',name:'PRISMATIC BARRAGE',text:'Shots ricochet a luminous arc through extra targets.',max:4,apply:()=>{}},
 {id:'pulse',tag:'OVERDRIVE',rarity:'epic',icon:'✹',name:'CORE PULSE',text:'Overdrive periodically shocks nearby enemies.',max:4,apply:()=>{}},
 {id:'mirage',tag:'MOBILITY',rarity:'legendary',icon:'⋈',name:'MIRAGE RUNNER',text:'Every dash launches three escalating lightning echoes.',max:2,apply:()=>{}},
 {id:'singularity',tag:'ELEMENTAL',rarity:'legendary',icon:'◉',name:'SINGULARITY ENGINE',text:'Chain lightning and reactor detonations feed one another.',max:2,apply:()=>{}},
 {id:'phoenix',tag:'SUSTAIN',rarity:'legendary',icon:'✷',name:'PHOENIX PROTOCOL',text:'Once per run, survive lethal damage and erupt with energy.',max:1,apply:()=>{}}
];

/* Extended progression catalogue. Every pick has an immediate effect OR a
 * live gameplay hook below; no placeholder 'upgrade' cards. */
function addAugment(id,tag,rarity,icon,name,text,max,apply=()=>{}){
 UPGRADES.push({id,tag,rarity,icon,name,text,max,apply});
}
const heals=(h,s=0)=>{player.hp=Math.min(player.maxHp,player.hp+h);player.shield=Math.min(player.maxShield,player.shield+s)};
addAugment('hellflash','UTILITY','rare','◉','ABYSS FLASHLIGHT','Toggle a focused light with F while in Hell.',1,()=>{player.hellFlashOn=true;notice('FLASHLIGHT EQUIPPED · PRESS F',3)});
addAugment('titanalloy','DEFENSE','common','⬢','TITAN ALLOY','+18 max armor; repair 18 immediately.',9,()=>{player.maxHp+=18;heals(18)});
addAugment('veilstitch','SUSTAIN','common','✚','VEIL STITCH','Heal 27 armor and regenerate shields.',9,()=>heals(27,13));
addAugment('magcoil','OFFENSE','common','ϟ','MAGNETIC COILS','Shots deal 25% more damage.',9,()=>player.damageMult*=1.25);
addAugment('accelerant','OFFENSE','common','➤','ACCELERANT','Fire 9% faster.',8,()=>player.speedMult*=1.09);
addAugment('gyro','MOBILITY','common','⟲','GYRO ACTUATORS','Movement improves by 9%.',8,()=>player.moveMult*=1.09);
addAugment('blinkcell','MOBILITY','common','↟','BLINK CELLS','Dash cooldown reduced by 10%.',7,()=>player.dashMult*=.90);
addAugment('healcell','DEFENSE','common','◇','SHIELD CELLS','+15 maximum shields and refill.',8,()=>{player.maxShield+=15;player.shield=player.maxShield});
addAugment('collector','UTILITY','common','▣','LOOT MAGNET','Gain 140 salvage and mend armor.',12,()=>{player.cash+=140;heals(12)});
addAugment('ragefeed','OVERDRIVE','common','⚡','RAGE FEEDER','Overdrive charges 18% faster.',6,()=>player.rageMult*=1.18);
addAugment('healregen','DEFENSE','common','❖','NANO DEFLECTOR','Passive shield regeneration improves by 19%.',7,()=>player.regenMult*=1.19);
addAugment('capacitor','UTILITY','common','◈','CAPACITOR STORAGE','Restore 100 energy and 15 shields.',12,()=>{player.energy=100;heals(0,15)});
addAugment('rush','OFFENSE','common','✦','KINETIC BITE','15% more damage while dashing or moving fast.',5);
addAugment('armorwhip','DEFENSE','common','◉','REACTIVE WEAVE','Get bonus shielding after each wave.',6);
addAugment('secondwind','SUSTAIN','common','☘','SECOND WIND','Eliminations have a chance to heal you.',6);
addAugment('flashstep','MOBILITY','rare','⇝','FLASH STEP','Dash pulses briefly stun nearby enemies.',5);
addAugment('kindle','ELEMENTAL','rare','♨','THERMITE ROUNDS','Hits scorch enemies over time.',6);
addAugment('cryoshot','ELEMENTAL','rare','❅','CRYO FRAGMENTS','Hits slow enemies and briefly weaken armor.',5);
addAugment('rupture','OFFENSE','rare','✧','ARMOR RUPTURE','Repeated hits stack vulnerability on the target.',5);
addAugment('hunter','OFFENSE','rare','⊕','HUNTER KILLCHAIN','Elite and boss damage grows per rank.',6);
addAugment('execution','OFFENSE','rare','⚔','EXECUTION MATRIX','Extra damage to targets below 25% health.',5);
addAugment('healshot','SUSTAIN','rare','✚','VITALITY TAP','Weapon hits repair a small amount of shielding.',6);
addAugment('burnout','ELEMENTAL','rare','☼','BURNOUT VENT','Scorched enemies burst on death.',5);
addAugment('chaincoil','ELEMENTAL','rare','⤴','LIGHTNING SPLINTER','Shots sometimes arc to another target.',5);
addAugment('supplydrop','UTILITY','rare','⬕','SUPPLY DROP','Immediately gain 350 salvage and a full shield.',8,()=>{player.cash+=350;player.shield=player.maxShield});
addAugment('aegisblock','DEFENSE','rare','▣','AEGIS LAYER','Raises maximum armor and shields by 20.',6,()=>{player.maxHp+=20;player.maxShield+=20;heals(20,20)});
addAugment('zerofriction','MOBILITY','rare','➠','ZERO FRICTION','Improve movement 7% and dash recharge 7%.',7,()=>{player.moveMult*=1.07;player.dashMult*=.93});
addAugment('bloodprice','OFFENSE','rare','✖','REDLINE CONVERTER','Damage rises as your armor falls.',4);
addAugment('overload','OVERDRIVE','rare','◐','OVERLOAD CAPACITOR','Overdrive lasts longer and pulses sooner.',5);
addAugment('warlock','OFFENSE','epic','☠','WARLOCK DIRECTIVE','Every eighth hit releases a damaging surge.',3);
addAugment('gravwell','ELEMENTAL','epic','◎','GRAVITY WELL','Your explosions pull surviving hostiles inward.',4);
addAugment('barrage','OFFENSE','epic','≫','BARRAGE CIRCUIT','Occasional extra free shot in every volley.',5);
addAugment('bulwarkcore','DEFENSE','epic','⬡','BULWARK CORE','Eliminating armored enemies restores shields.',5);
addAugment('deathmark','OFFENSE','epic','⟡','DEATH MARK','Critical hits make targets vulnerable to the next attack.',4);
addAugment('heattrace','ELEMENTAL','epic','♨','PLASMA TRACES','Continuous fire scorches nearby targets.',4);
addAugment('shockfield','OVERDRIVE','epic','ϟ','STORM FIELD','Overdrive emits more frequent electric bursts.',5);
addAugment('laststand','SUSTAIN','epic','♜','LAST STAND','Damage taken below 30% health is reduced.',3);
addAugment('coldsnap','ELEMENTAL','epic','❄','COLD SNAP','Frozen enemies can shatter, damaging adjacent units.',3);
addAugment('bossbreaker','OFFENSE','epic','⚒','SIEGE BREAKER','Large bosses take increasing bonus damage.',5);
addAugment('teslabeacon','ELEMENTAL','legendary','⚡','TESLA BEACON','Every few seconds automatically arcs to a nearby enemy.',2);
addAugment('supernova','ELEMENTAL','legendary','✷','SUPERNOVA HEART','Every seventh kill triggers a large nova explosion.',2);
addAugment('chronolock','MOBILITY','legendary','◷','CHRONO LOCK','Dashes slow enemies near your path.',2);
addAugment('hivemind','OFFENSE','legendary','✸','HIVE DIRECTOR','Every fourth kill fires a burst at surviving enemies.',2);
addAugment('titanprotocol','DEFENSE','legendary','▣','TITAN PROTOCOL','Huge armor capacity and restore half your missing health.',2,()=>{player.maxHp+=75;player.hp=clamp(player.hp+(player.maxHp-player.hp)*.5,0,player.maxHp)});
addAugment('doomreactor','ELEMENTAL','legendary','☄','DOOM REACTOR','Scorch + chain + shatter effects fuse into explosions.',2);

 // 96 original named modules across twelve mechanics with concrete gameplay
 // effects, ten varied stat parameters and honest tradeoffs on cursed gear.
const MODULE_ROOTS=[
 ['BULWARK','DEFENSE','⬢'],['PALLADIUM','DEFENSE','◇'],
 ['CUTTHROAT','OFFENSE','✦'],['FLASHPOINT','OFFENSE','≫'],
 ['PHANTOM STEP','MOBILITY','➠'],['CYCLONE MOTOR','MOBILITY','⟲'],
 ['COOLANT INDUCTOR','UTILITY','ϟ'],['SALVAGE BLOOM','UTILITY','◫'],
 ['CURSED RELIQUARY','CURSE','☠'],['GLASS MIRROR','CURSE','◉'],
 ['PHOENIX RESERVE','SUSTAIN','✚'],['DISRUPTION FIELD','ELEMENTAL','✳']
];
const MODULE_SUFFIXES=['SEED','LATTICE','CROWN','SPECTRUM','RIPTIDE','ECLIPSE','APEX','SINGULARITY'];
for(let family=0;family<MODULE_ROOTS.length;family++)for(let variant=0;variant<8;variant++){
 const [root,tag,icon]=MODULE_ROOTS[family],tier=variant>=7?'mythic':variant>=5?'legendary':variant>=3?'epic':variant>=1?'rare':'common';
 const n=variant+1,rank=n+family%3,id='mod-'+family+'-'+variant;
 const text=[
  '+'+(11+rank*4)+' max armor and immediate repairs.',
  '+'+(8+rank*5)+' maximum shielding and instant recharge.',
  '+'+(5+rank*2)+'% damage for all guns.',
  '+'+(5+rank*2)+'% fire-rate, marginally more heat.',
  '+'+(3+rank)+'% movement speed.',
  'Dash recharge '+(5+rank*2)+'% faster, with a small energy refill.',
  '+'+(7+rank*2)+'% weapon cooling and 10 stamina.',
  '+'+(100+rank*42)+' salvage and '+(5+rank*2)+' shields.',
  'Shiny but cursed: +'+(12+rank*4)+'% damage, -'+(8+rank*3)+'% max shields.',
  'High-risk glass cannon: +'+(18+rank*5)+'% damage, -'+(9+rank*4)+' max armor.',
  'Restore '+(10+rank*6)+' armor and '+(10+rank*3)+' shields.',
  'Shockwave when purchased; +'+(6+rank*2)+'% damage.'
 ][family];
 const apply=()=>{switch(family){
  case 0:player.maxHp+=11+rank*4;player.hp=Math.min(player.maxHp,player.hp+11+rank*4);break;
  case 1:player.maxShield+=8+rank*5;player.shield=player.maxShield;break;
  case 2:player.damageMult*=1+(5+rank*2)/100;break;
  case 3:player.speedMult*=1+(5+rank*2)/100;player.heat=Math.min(1,player.heat+.04);break;
  case 4:player.moveMult*=1+(3+rank)/100;break;
  case 5:player.dashMult*=1-(5+rank*2)/100;player.energy=Math.min(100,player.energy+9);break;
  case 6:player.coolingMult=Math.min(2.5,(player.coolingMult||1)*(1+(7+rank*2)/100));player.energy=Math.min(100,player.energy+10);break;
  case 7:player.cash+=100+rank*42;player.shield=Math.min(player.maxShield,player.shield+5+rank*2);break;
  case 8:player.damageMult*=1+(12+rank*4)/100;
   player.maxShield=Math.max(1,player.maxShield*(1-(8+rank*3)/100));player.shield=Math.min(player.shield,player.maxShield);break;
  case 9:player.damageMult*=1+(18+rank*5)/100;
   player.maxHp=Math.max(12,player.maxHp-(9+rank*4));player.hp=Math.min(player.hp,player.maxHp);break;
  case 10:player.hp=Math.min(player.maxHp,player.hp+10+rank*6);player.shield=Math.min(player.maxShield,player.shield+10+rank*3);break;
  case 11:player.damageMult*=1+(6+rank*2)/100;blastAt(player.x,player.z,25+rank*11,2.6,0,'shock');break;
 }};
 UPGRADES.push({id,tag,rarity:tier,icon,name:root+' // '+MODULE_SUFFIXES[variant],
  text,max:1,apply,metaLock:true,unlockId:id,prototype:true});
}
if(UPGRADES.length!==166)throw Error('WYRDFLUX special catalog must contain 166 augments (including the Hell flashlight perk)');
/* Fluxside pistol's twenty separately identifiable, combinable mechanics.
   Every perk works with the base pistol or a permitted pistol-legendary combo. */
const PISTOL_UPGRADES=Object.freeze([
 {id:'px-twin',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'✶',name:'TWIN CHAMBER',text:'Two real bullets fire from one trigger pull.',max:1,apply:()=>{}},
 {id:'px-fan',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'≋',name:'IRON FAN',text:'Four extra rounds spread in a wide fan pattern.',max:1,apply:()=>{}},
 {id:'px-pierce',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'⇥',name:'LANCER BORE',text:'Laser rounds pierce enemies behind the target.',max:1,apply:()=>{}},
 {id:'px-bloom',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'◉',name:'BLOOM IMPACT',text:'Impact generates area damage.',max:1,apply:()=>{}},
 {id:'px-ricochet',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'↗',name:'GHOST BANKSHOT',text:'Impact ricochets into a nearby visible target.',max:1,apply:()=>{}},
 {id:'px-chain',kind:'pistol',tag:'PISTOL',rarity:'legendary',icon:'ϟ',name:'STORM CYLINDER',text:'Lightning arcs from impact into three nearby targets.',max:1,apply:()=>{}},
 {id:'px-ignite',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'♨',name:'CINDER BRAND',text:'Pistol impacts set targets burning.',max:1,apply:()=>{}},
 {id:'px-freeze',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'❄',name:'WINTER SEAL',text:'Pistol impacts freeze targets.',max:1,apply:()=>{}},
 {id:'px-gravity',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'◎',name:'GRAVITY WRENCH',text:'Nearby enemies are pulled toward the impact.',max:1,apply:()=>{}},
 {id:'px-expose',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'◇',name:'BREACH ROUNDS',text:'Impact exposes weak points for follow-up damage.',max:1,apply:()=>{}},
 {id:'px-drain',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'♥',name:'BLOOD TITHE',text:'Recover health from successful hits.',max:1,apply:()=>{}},
 {id:'px-shield',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'⬡',name:'AEGIS CYLINDER',text:'Recharge shields from successful hits.',max:1,apply:()=>{}},
 {id:'px-chrono',kind:'pistol',tag:'PISTOL',rarity:'legendary',icon:'◷',name:'CLOCK STOPPER',text:'Stun regular enemies briefly on impact.',max:1,apply:()=>{}},
 {id:'px-burst',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'⇶',name:'TRIPLE HAMMER',text:'Two rapid extra rounds fire in each cycle.',max:1,apply:()=>{}},
 {id:'px-shards',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'✧',name:'SHRAPNEL HALO',text:'Impact produces a ring of damaging fragments.',max:1,apply:()=>{}},
 {id:'px-seeker',kind:'pistol',tag:'PISTOL',rarity:'legendary',icon:'⌁',name:'HOUND CHAMBER',text:'Near-misses can seek a target inside the aim cone.',max:1,apply:()=>{}},
 {id:'px-dash',kind:'pistol',tag:'PISTOL',rarity:'rare',icon:'➤',name:'THUNDER STEP',text:'Hits reduce dash cooldown.',max:1,apply:()=>{}},
 {id:'px-thunder',kind:'pistol',tag:'PISTOL',rarity:'legendary',icon:'✦',name:'FIFTH BELL',text:'Every fifth shot generates an explosive thunderclap.',max:1,apply:()=>{}},
 {id:'px-energize',kind:'pistol',tag:'PISTOL',rarity:'epic',icon:'☀',name:'HALO ENGINE',text:'Successful hits restore stamina.',max:1,apply:()=>{}},
 {id:'px-execute',kind:'pistol',tag:'PISTOL',rarity:'legendary',icon:'☄',name:'REQUIEM CYLINDER',text:'Critically wounded enemies trigger a singularity burst.',max:1,apply:()=>{}},
]);
UPGRADES.push(...PISTOL_UPGRADES);
if(PISTOL_UPGRADES.length!==20)throw Error('PISTOL_UPGRADES_COUNT');
// Official unlock: only the final Brain defeat grants a permanent account-wide drone.
const WYRDFLUX_SHADOW_TEST_BUILD=false;
const WYRDFLUX_SHADOW_DELAY=10,WYRDFLUX_SHADOW_STAGGER=1,WYRDFLUX_SHADOW_MAX_DRONES=5;
UPGRADES.push({id:'shadow',tag:'UTILITY',rarity:'epic',icon:'◈',name:'SHADOW RELAY',
 text:'Add a vivid replay drone, following the previous drone one second later.',
 max:WYRDFLUX_SHADOW_MAX_DRONES-1,apply:()=>notice('SHADOW DRONE ONLINE',2.5)});

const pistolHas=(mods,key)=>!!mods&&Number(mods['px-'+key]||0)>0;
function pistolImpact(mods,enemy,damage,shot){
 if(!mods||!enemy)return;
 const has=key=>pistolHas(mods,key);
 const nearby=(r,cap)=>enemies.filter(e=>e!==enemy&&e.hp>0&&
  Math.hypot(e.x-enemy.x,e.z-enemy.z)<r&&lineClear(enemy.x,enemy.z,e.x,e.z)).slice(0,cap);
 if(has('bloom'))blastAt(enemy.x,enemy.z,damage*.28,2.5,1,'pistol-bloom');
 if(has('ricochet'))for(const e of nearby(6,1))damageEnemy(e,damage*.40,'pistol-bankshot',1);
 if(has('chain'))for(const e of nearby(4.5,3))damageEnemy(e,damage*.28,'pistol-arc',1);
 if(has('ignite')&&enemy.hp>0)appliedWeaponTrait(enemy,'ignite');
 if(has('freeze')&&enemy.hp>0)appliedWeaponTrait(enemy,'freeze');
 if(has('gravity'))for(const e of nearby(3.8,5))
  collisionMove(e,(enemy.x-e.x)*.20,(enemy.z-e.z)*.20,enemyCollisionRadius(e));
 if(has('expose')&&enemy.hp>0){enemy.vulnUntil=Math.max(enemy.vulnUntil||0,time+2.8);
  enemy.vulnStack=Math.min(5,(enemy.vulnStack||0)+2);}
 if(has('drain'))player.hp=Math.min(player.maxHp,player.hp+4);
 if(has('shield'))player.shield=Math.min(player.maxShield,player.shield+9);
 if(has('chrono')&&enemy.hp>0&&!isBoss(enemy))
  enemy.stunUntil=Math.max(enemy.stunUntil||0,time+.42);
 if(has('shards'))for(const e of nearby(2.6,5))damageEnemy(e,damage*.16,'pistol-shard',1);
 if(has('dash'))player.dashCool=Math.max(0,player.dashCool-.42);
 if(has('thunder')&&shot%5===0)blastAt(enemy.x,enemy.z,damage*.40,3.2,1,'pistol-thunder');
 if(has('energize')){player.energy=Math.min(100,player.energy+7);
  const t=wyrdfluxGunThermal(gun);t.heat=Math.max(0,t.heat-.035);}
 if(has('execute')&&enemy.hp>0&&enemy.hp/Math.max(1,enemy.maxHp)<.23){
  for(const e of nearby(3,5))damageEnemy(e,damage*.24,'pistol-singularity',1);
  damageEnemy(enemy,damage*.20,'pistol-execute',1);
 }
 const powers=Object.keys(mods).filter(k=>k.startsWith('px-')&&mods[k]>0);
 if(powers.length){
  spark(enemy.x,enemy.z,has('ignite')?'orange':has('freeze')?'cyan':has('chain')?'purple':'gold',
   Math.min(12,3+Math.floor(powers.length/2)));
  // Only one accent per third shot even with every pistol mod installed.
  if(shot%3===0)wyrdfluxSoundAsset('pistol_'+powers[Math.floor(shot/3)%powers.length].slice(3));
 }
}
function pistolNearMiss(mods,damage){
 if(!pistolHas(mods,'seeker'))return false;
 const hits=enemies.filter(e=>e.hp>0&&Math.hypot(e.x-player.x,e.z-player.z)<13&&
   lineClear(player.x,player.z,e.x,e.z))
  .map(e=>({e,delta:Math.abs(Math.atan2(Math.sin(Math.atan2(e.x-player.x,-(e.z-player.z))-player.yaw),
   Math.cos(Math.atan2(e.x-player.x,-(e.z-player.z))-player.yaw)))}))
  .filter(v=>v.delta<.24).sort((a,b)=>a.delta-b.delta);
 if(!hits.length)return false;
 damageEnemy(hits[0].e,damage*.40,'pistol-seeker',1);
 spark(hits[0].e.x,hits[0].e.z,'cyan',5);return true;
}


// Repeatable progression offered after clearing the first final boss.
// Unlike normal capped augments these keep endless cycles meaningful.
const ASCENSION_UPGRADES=[
 {id:'ascend-damage',tag:'ASCENSION',rarity:'epic',icon:'✦',name:'EVER-RISING POWER',
  text:'Permanently multiply weapon damage by 18%.',max:100000000,ascend:true,
  apply:()=>player.damageMult=Math.min(1e9,player.damageMult*1.18)},
 {id:'ascend-armor',tag:'ASCENSION',rarity:'rare',icon:'⬢',name:'ETERNAL ALLOY',
  text:'Permanently gain 24 maximum armor; repair 24.',max:100000000,ascend:true,
  apply:()=>{player.maxHp=Math.min(1e9,player.maxHp+24);player.hp=Math.min(player.maxHp,player.hp+24)}},
 {id:'ascend-shield',tag:'ASCENSION',rarity:'rare',icon:'◇',name:'INFINITE CAPACITOR',
  text:'Permanently gain 18 maximum shields and recharge.',max:100000000,ascend:true,
  apply:()=>{player.maxShield=Math.min(1e9,player.maxShield+18);player.shield=player.maxShield}},
 {id:'ascend-speed',tag:'ASCENSION',rarity:'epic',icon:'≫',name:'OVERCLOCK CASCADE',
  text:'Fire 6% faster, permanently.',max:100000000,ascend:true,
  apply:()=>{player.speedMult=Math.min(9,player.speedMult*1.06)}},
 {id:'ascend-mobility',tag:'ASCENSION',rarity:'rare',icon:'↟',name:'PHASE RUNNER',
  text:'Move 4% faster, permanently.',max:100000000,ascend:true,
  apply:()=>{player.moveMult=Math.min(5,player.moveMult*1.04)}},
 {id:'ascend-recovery',tag:'ASCENSION',rarity:'epic',icon:'✚',name:'RECLAMATION',
  text:'Repair 35% of armor and shield capacity.',max:100000000,ascend:true,
  apply:()=>{player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.35);
    player.shield=Math.min(player.maxShield,player.shield+player.maxShield*.35)}}
];
const ARMORY_CARDS=WEAPONS.map((w,i)=>({kind:'weapon',weaponIndex:i,id:'weapon-'+i,
 tag:'NEW WEAPON',rarity:w.rarity||'rare',icon:['ϟ','⊗','⌁','✦','⚡','♨','❄','⟲','✹','✴'][i%10],
 name:w.name,text:wyrdfluxWeaponBrief(w)+(w.selfRisk?' · HEALTH RISK':'')+'. Equip now.',max:1,worldSource:w.worldSource||null,metaLock:!!w.prototype,unlockId:w.unlockId}));
const RARITY_WEIGHT={common:10,rare:5,epic:2,legendary:.55,mythic:.035};
const FUSIONS=[
 {id:'storm',requires:['arc','crit'],name:'STORMCROWN',description:'Critical arcs strike a bonus target'},
 {id:'detonator',requires:['blast','shock'],name:'DETONATION STEP',description:'Dash shockwaves trigger reactor bursts'},
 {id:'battery',requires:['guard','arc'],name:'THUNDER BULWARK',description:'Chain lightning repairs shields'},
 {id:'reaper',requires:['vamp','frenzy'],name:'REAPER ENGINE',description:'Eliminations heal and accelerate your weapons'},
 {id:'apocalypse',requires:['singularity','vortex'],name:'APOCALYPSE FIELD',description:'Storms multiply the shockwave on elimination'},
 {id:'miragearc',requires:['mirage','arc'],name:'GHOST CIRCUIT',description:'Dash echoes propagate lightning'},
 {id:'hellwinter',requires:['kindle','cryoshot'],name:'HELLWINTER',description:'Burning and frozen targets explode when hit'},
 {id:'stormwell',requires:['arc','gravwell'],name:'STORMWELL',description:'Electrical arcs drag targets together'},
 {id:'siegerush',requires:['hunter','rush'],name:'SIEGE RUSH',description:'Momentum massively amplifies boss damage'},
 {id:'phoenixshield',requires:['phoenix','aegisblock'],name:'PHOENIX BULWARK',description:'Resurrection restores all shielding'},
 {id:'deathstar',requires:['supernova','blast'],name:'DEATH STAR',description:'Large blasts cause stronger reactor cascades'},
 {id:'hailstorm',requires:['coldsnap','chaincoil'],name:'HAILSTORM',description:'Arc strikes shatter frozen enemies'},
 {id:'warpspeed',requires:['flashstep','chronolock'],name:'WARP SPEED',description:'Dashes stun and freeze nearby hostile squads'},
 {id:'reaperstorm',requires:['vamp','hivemind'],name:'REAPER SWARM',description:'Eliminations heal and trigger drone barrages'}
];

// Account-wide, offline meta-progression. This key is never deleted when a
// run dies or the checkpoint is reset; schema is additive for save migration.
const META_KEY='afterlight-meta-v017';
function makeMeta(){return {version:1,runs:0,deaths:0,abandons:0,xp:0,kills:0,shots:0,
 dashes:0,overdrives:0,bossKills:0,perfectBosses:0,perfectPuppets:0,
 ascensions:0,waves:0,maxWave:0,shadowBrainWins:0,hellBreachClears:0,heavenSanctumClears:0,blockworldClears:0,passiveStacks:{},unlocked:{}}}
function readMeta(){
 try{
  const saved=JSON.parse(localStorage.getItem(META_KEY)||'null');
  if(!saved||typeof saved!=='object')return makeMeta();
  const baseline=makeMeta();
  for(const key of Object.keys(baseline)){
   if(key==='unlocked'||key==='passiveStacks')continue;
   const n=Number(saved[key]);
   if(Number.isFinite(n))baseline[key]=clamp(Math.floor(n),0,1000000000);
  }
  if(saved.passiveStacks&&typeof saved.passiveStacks==='object'&&!Array.isArray(saved.passiveStacks)){
    for(const [key,value] of Object.entries(saved.passiveStacks).slice(0,32))
     if(/^(heaven|block)-[a-z-]{3,32}$/.test(key)&&Number.isFinite(Number(value)))
      baseline.passiveStacks[key]=clamp(Math.floor(Number(value)),0,100000);
   }
   if(saved.unlocked&&typeof saved.unlocked==='object'){
   for(const [k,v] of Object.entries(saved.unlocked).slice(0,600))
    if(v===true&&/^(gun-|mod-)[\w-]{1,24}$/.test(k))baseline.unlocked[k]=true;
  }
  return baseline;
 }catch(_){return makeMeta()}
}
const meta=readMeta();
function wyrdfluxShadowUnlocked(){return meta.shadowBrainWins>0}
function wyrdfluxShadowCount(){
 return wyrdfluxShadowUnlocked()&&player?
  Math.min(WYRDFLUX_SHADOW_MAX_DRONES,1+Math.max(0,Number(player.perks?.shadow||0))):0;
}
// No toggle: the Brain permanently grants the first drone; later upgrades add more.
function refreshWyrdfluxShadowMenu(){
 const previous=document.getElementById('wyrdfluxShadowButton');
 if(previous)previous.remove(); // older UI / save compatibility
}


/* v0.42 Permanent world rewards: no test-lab payouts, real cross-run effects. */
const PASSIVES=[
 ['heaven-grace','GRACE OF LIGHT','HEAVEN','health',.02,'✧'],
 ['heaven-reflex',"ANGEL'S REFLEX",'HEAVEN','move',.01,'☼'],
 ['heaven-core','BLESSED CORE','HEAVEN','damage',.02,'✦'],
 ['heaven-shell','RADIANT SHELL','HEAVEN','defense',.02,'◈'],
 ['heaven-recovery','SACRED RECOVERY','HEAVEN','regen',.25,'✚'],
 ['heaven-reach','HALO REACH','HEAVEN','pickup',.02,'◎'],
 ['heaven-fortune','DIVINE FORTUNE','HEAVEN','loot',.03,'✤'],
 ['block-edge','DIAMOND EDGE','BLOCKWORLD','damage',.02,'◆'],
 ['block-apple','GOLDEN APPLE HEART','BLOCKWORLD','health',.02,'❤'],
 ['block-feather','FEATHER FALLING','BLOCKWORLD','move',.02,'↟'],
 ['block-blast','BLAST SHIELD','BLOCKWORLD','defense',.03,'⬡'],
 ['block-looting','LOOTING','BLOCKWORLD','loot',.03,'◈'],
 ['block-haste','HASTE','BLOCKWORLD','attack',.03,'⇢'],
 ['block-protection','PROTECTION','BLOCKWORLD','defense',.02,'▣']
].map(([id,name,src,stat,rate,icon])=>Object.freeze({id,name,src,stat,rate,icon}));
function permanentStats(){
 const r={damage:0,health:0,move:0,defense:0,regen:0,pickup:0,loot:0,attack:0};
 for(const p of PASSIVES)r[p.stat]+=(Number(meta.passiveStacks?.[p.id])||0)*p.rate;
 r.damage=Math.min(r.damage,4);r.health=Math.min(r.health,4);r.move=Math.min(r.move,1.5);
 r.attack=Math.min(r.attack,2);r.defense=Math.min(r.defense,.75);
 r.regen=Math.min(r.regen,8);r.pickup=Math.min(r.pickup,2.5);r.loot=Math.min(r.loot,3);
 return r;
}
function passiveTotalStacks(){return PASSIVES.reduce((n,p)=>n+(Number(meta.passiveStacks[p.id])||0),0)}
function passiveText(stat,amount){
 return stat==='regen'?'+'+amount.toFixed(2)+' HP/SEC':
   '+'+(amount*100).toFixed(1)+'%';
}
function applyPermanentBase(){
 if(!player)return;
 const p=permanentStats(),old=player.permanentApplied||{damage:0,health:0,move:0,attack:0};
 const oldHealth=player.maxHp,h=(1+p.health)/(1+old.health);
 player.maxHp*=h;player.hp=Math.min(player.maxHp,player.hp+Math.max(0,player.maxHp-oldHealth));
 player.damageMult*=(1+p.damage)/(1+old.damage);
 player.moveMult*=(1+p.move)/(1+old.move);
 player.speedMult*=(1+p.attack)/(1+old.attack);
 player.permanentApplied={damage:p.damage,health:p.health,move:p.move,attack:p.attack};
}
function awardPermanent(room){
 if(testLabMode)return null;
 const source=room==='heaven'?'HEAVEN':'BLOCKWORLD',pool=PASSIVES.filter(p=>p.src===source);
 let r=rnd();
 try{if(window.crypto?.getRandomValues){const a=new Uint32Array(1);window.crypto.getRandomValues(a);r=a[0]/4294967296}}catch(_){}
 const p=pool[Math.min(pool.length-1,Math.floor(r*pool.length))];
 meta.passiveStacks[p.id]=Math.min(100000,(Number(meta.passiveStacks[p.id])||0)+1);
 saveMeta();applyPermanentBase();
 if(typeof notice==='function')notice('✦ '+p.name.toUpperCase()+' PERMANENT PASSIVE · '+passiveText(p.stat,p.rate),4);
 const el=$('permanentAward');
 if(el){
  el.querySelector('strong').textContent=p.icon+' '+p.name;
  el.querySelector('p').textContent='+'+passiveText(p.stat,p.rate).slice(1)+' EACH · STACKS '+meta.passiveStacks[p.id]+' · TOTAL '+passiveText(p.stat,meta.passiveStacks[p.id]*p.rate);
  el.classList.remove('hidden');
 }
 return p;
}
function refreshPermanentMenu(){
 const list=$('permanentList'),sum=$('permanentSummary'),total=$('permanentTotals');
 if(!list||!sum||!total)return;
 const p=permanentStats();
 sum.textContent='PERMANENT STACKS '+passiveTotalStacks()+' · HEAVEN '+meta.heavenSanctumClears+
  ' CLEARS · BLOCKWORLD '+meta.blockworldClears+' CLEARS';
 total.textContent=Object.entries(p).map(([k,v])=>k.toUpperCase()+' '+passiveText(k,v)).join(' · ');
 list.replaceChildren();
 for(const item of PASSIVES){
  const stacks=Number(meta.passiveStacks[item.id])||0;
  const row=document.createElement('div');row.className='permanentRow'+(stacks?' owned':'');
  const strong=document.createElement('strong');strong.textContent=item.icon+' '+item.name;
  const small=document.createElement('small');
  small.textContent=item.src+' · '+passiveText(item.stat,item.rate)+' EACH · STACKS '+stacks+
    ' · TOTAL '+passiveText(item.stat,item.rate*stacks);
  row.append(strong,small);list.appendChild(row);
 }
}
function initPermanentMenu(){
 const css=document.createElement('style');
 css.textContent='#permanentButton{display:block;margin:10px auto;width:85%;max-width:290px;padding:12px;color:#f4faff;background:#25374b;border:1px solid #8ccbe8;border-radius:8px;font-weight:900;letter-spacing:1px}'+
 '#permanentPanel,#permanentAward{position:fixed;inset:0;z-index:600;overflow-y:auto;padding:22px;color:#eefaff;background:#091522f4;font:500 14px/1.5 system-ui,sans-serif}'+
 '#permanentPanel h2,#permanentAward h2{font-size:23px;color:#b6e5ff}'+
 '.permanentRow{padding:10px 14px;margin:8px 0;background:#1a2939;border:1px solid #4c6678;border-radius:8px}'+
 '.permanentRow.owned{border-color:#e9ce88} .permanentRow strong,.permanentRow small{display:block}'+
 '.permanentRow small{font-size:12px;color:#c0d5e7;margin-top:4px}'+
 '.permanentClose{background:#31526b;color:#fff;border:1px solid #9cd2f0;padding:12px 18px;border-radius:8px;font-weight:bold}'+
 '#permanentAward{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}'+
 '#permanentAward strong{font-size:29px;color:#f9d48b}#permanentAward p{font-size:17px}'+
 '#permanentPanel.hidden,#permanentAward.hidden{display:none}';
 document.head.appendChild(css);
 const button=document.createElement('button');button.id='permanentButton';
 button.textContent='✦ PERMANENT PASSIVES';($('mainMenu').querySelector('.menuActions')||$('mainMenu').querySelector('.menuInner')||$('mainMenu')).appendChild(button);
 const panel=document.createElement('section');panel.id='permanentPanel';panel.className='hidden';
 panel.innerHTML='<h2>✦ PERMANENT PASSIVES</h2><p id="permanentSummary"></p><p id="permanentTotals"></p><div id="permanentList"></div><button class="permanentClose">BACK TO MAIN MENU</button>';
 document.body.appendChild(panel);
 button.addEventListener('click',()=>{refreshPermanentMenu();panel.classList.remove('hidden');});
 panel.querySelector('button').addEventListener('click',()=>panel.classList.add('hidden'));
 const reward=document.createElement('section');reward.id='permanentAward';reward.className='hidden';
 reward.innerHTML='<h2>NEW PERMANENT PASSIVE</h2><strong></strong><p></p><button class="permanentClose">CONTINUE</button>';
 document.body.appendChild(reward);
 reward.querySelector('button').addEventListener('click',()=>reward.classList.add('hidden'));
}

const defaultRunRecord=()=>({creditedKills:0,creditedDashes:0,creditedShots:0,
 creditedOverdrives:0,dashes:0,shots:0,overdrives:0,damageEvents:0,
 bossKills:0,creditedBossKills:0,perfectBosses:0,creditedPerfectBosses:0,lastCreditedWave:0,
 perfectPuppets:0,creditedPerfectPuppets:0,ascensions:0,creditedAscensions:0,
 lastUnlocks:[]});
let runRecord=defaultRunRecord();
function saveMeta(){if(testLabMode)return;try{localStorage.setItem(META_KEY,JSON.stringify(meta))}catch(_){}}
function itemGate(id){
 if(id.startsWith('gun-')){
  const a=id.split('-'),tier=Number(a[1]),base=Number(a[2]);
  if(!Number.isInteger(tier)||!Number.isInteger(base))return {stat:'xp',required:1e9};
  if(tier<6)return {stat:'xp',required:55+tier*180+base*31};
  if(tier<12)return {stat:'kills',required:150+(tier-6)*195+base*33,alsoXp:950};
  if(tier<18)return {stat:'perfectBosses',required:1+(tier-12)*2+base%3,alsoXp:2400};
  if(tier<22)return {stat:'ascensions',required:1+(tier-18)*2+base%2,alsoXp:5500};
  return {stat:tier===23?'perfectPuppets':'maxWave',
   required:tier===23?2+base%3:63+base*2,alsoXp:17000+base*1300};
 }
 const parts=id.split('-'),family=Number(parts[1]),tier=Number(parts[2]);
 if(!Number.isInteger(family)||!Number.isInteger(tier))return {stat:'xp',required:1e9};
 if(tier<3)return {stat:'xp',required:80+tier*270+family*35};
 if(tier<5)return {stat:'dashes',required:50+(tier-3)*150+family*40,alsoXp:600};
 if(tier<6)return {stat:'bossKills',required:4+family*2,alsoXp:1800};
 if(tier<7)return {stat:'ascensions',required:2+family%4,alsoXp:3900};
 return {stat:family%3===0?'perfectPuppets':family%3===1?'maxWave':'perfectBosses',
  required:family%3===0?1+Math.floor(family/6):family%3===1?42+family*3:10+family,
  alsoXp:9500+family*920};
}
function gateDescription(id){
 const gate=itemGate(id);const label={xp:'TOTAL XP',kills:'CAREER KILLS',
 perfectBosses:'FLAWLESS BOSSES',perfectPuppets:'FLAWLESS NULL PUPPETS',
 ascensions:'ASCENSIONS',maxWave:'HIGHEST WAVE',dashes:'CAREER DASHES',bossKills:'BOSSES DEFEATED'}[gate.stat]||gate.stat;
 return label+' '+Number(meta[gate.stat]||0)+' / '+gate.required+
  (gate.alsoXp?' · XP '+meta.xp+' / '+gate.alsoXp:'');
}
function eligibleMeta(id){
 if(!id)return true;
 const gate=itemGate(id);
 return (meta[gate.stat]||0)>=gate.required&&(!gate.alsoXp||meta.xp>=gate.alsoXp);
}
function hasMetaUnlock(item){if(item?.id==='shadow')return wyrdfluxShadowUnlocked();return !item?.metaLock||!!meta.unlocked[item.unlockId]}
function evaluateMetaUnlocks(){
 const newOnes=[];
 for(const item of [...WEAPONS.slice(ORIGINAL_WEAPON_COUNT),...UPGRADES.filter(u=>u.metaLock)]){
  const key=item.unlockId;
  if(key&&!meta.unlocked[key]&&eligibleMeta(key)){
   meta.unlocked[key]=true;newOnes.push(item.name);
  }
 }
 if(newOnes.length){
  runRecord.lastUnlocks.push(...newOnes);
  runRecord.lastUnlocks=runRecord.lastUnlocks.slice(-28);
 }
 saveMeta();return newOnes;
}
function metaCounts(){
 return {guns:Object.keys(meta.unlocked).filter(k=>k.startsWith('gun-')).length,
  specials:Object.keys(meta.unlocked).filter(k=>k.startsWith('mod-')).length};
}
function creditMeta(reason='wave'){
 if(testLabMode)return [];
 if(!runRecord)return [];
 if(reason==='wave'&&runRecord.lastCreditedWave>=wave)return evaluateMetaUnlocks();
 const k=Math.max(0,kills-runRecord.creditedKills);
 const d=Math.max(0,runRecord.dashes-runRecord.creditedDashes);
 const shots=Math.max(0,runRecord.shots-runRecord.creditedShots);
 const od=Math.max(0,runRecord.overdrives-runRecord.creditedOverdrives);
 const bosses=Math.max(0,runRecord.bossKills-runRecord.creditedBossKills);
 const clean=Math.max(0,runRecord.perfectBosses-runRecord.creditedPerfectBosses);
 const perfectP=Math.max(0,runRecord.perfectPuppets-runRecord.creditedPerfectPuppets);
 const ascend=Math.max(0,runRecord.ascensions-runRecord.creditedAscensions);
 meta.kills+=k;meta.dashes+=d;meta.shots+=shots;meta.overdrives+=od;
 meta.bossKills+=bosses;meta.perfectBosses+=clean;
 meta.perfectPuppets+=perfectP;meta.ascensions+=ascend;
 runRecord.creditedKills=kills;runRecord.creditedDashes=runRecord.dashes;
 runRecord.creditedShots=runRecord.shots;runRecord.creditedOverdrives=runRecord.overdrives;
 runRecord.creditedBossKills=runRecord.bossKills;
 runRecord.creditedPerfectBosses=runRecord.perfectBosses;
 runRecord.creditedPerfectPuppets=runRecord.perfectPuppets;
 runRecord.creditedAscensions=runRecord.ascensions;
 // Attempt XP is paid on both death and survival. Wave-complete rewards
 // cannot be claimed twice after restoring a checkpoint.
 const bonus=reason==='wave'?16+Math.min(120,localWaveOf(wave)*5)+(wave%3===0?35:0):0;
 meta.xp+=Math.floor(k*2+d*.4+shots*.06+od*8+bosses*30+clean*90+perfectP*350+ascend*440+bonus);
 if(reason==='wave'){meta.waves++;runRecord.lastCreditedWave=wave;}
 if(reason==='death')meta.deaths++;
 if(reason==='abandon')meta.abandons++;
 meta.maxWave=Math.max(meta.maxWave,wave);
 return evaluateMetaUnlocks();
}
// Mobile-friendly paginated armory archive: every one of the 336 gated
// weapons/modules can be inspected without rendering 336 DOM rows at once.
let archiveLimit=48;
function archiveItems(){
 const category=$('archiveFilter').value,query=$('archiveSearch').value.toLowerCase().trim();
 const wanted=document.getElementById('wyrdfluxArchiveClass')?.value||'all';
 return [...WEAPONS.slice(ORIGINAL_WEAPON_COUNT),...UPGRADES.filter(u=>u.metaLock)]
  .filter(u=>(wanted==='all'||(u.effect&&wyrdfluxWeaponClass(u)===wanted))&&(category==='all'||category==='guns'&&u.unlockId.startsWith('gun-')||
   category==='specials'&&u.unlockId.startsWith('mod-')||
   category==='mythic'&&u.rarity==='mythic')&&
   (!query||(u.name+' '+u.sub+' '+u.text+' '+(u.effect?wyrdfluxWeaponClass(u):'')).toLowerCase().includes(query)))
  .sort((a,b)=>{
   const aGot=!!meta.unlocked[a.unlockId],bGot=!!meta.unlocked[b.unlockId];
   if(aGot!==bGot)return aGot?-1:1;
   return (RARITY_WEIGHT[b.rarity]||0)-(RARITY_WEIGHT[a.rarity]||0);
  });
}
function renderArchivePage(){
 const list=$('archiveList');if(!list)return;
 const filtered=archiveItems(),displayed=filtered.slice(0,archiveLimit);
 list.replaceChildren();
 for(const u of displayed){
  const opened=!!meta.unlocked[u.unlockId];
  const row=document.createElement('div');
  row.className='archiveEntry '+(opened?'acquired ':'locked ')+rarityClass(u);
  const title=document.createElement('strong');title.textContent=u.name;
  title.classList.add('wyrdflux-rare-label');title.dataset.echo=u.name;
  const p=document.createElement('small');
  p.textContent=(u.effect?wyrdfluxWeaponClass(u)+' · ':'')+(opened?'UNLOCKED · '+u.rarity.toUpperCase():'LOCKED · '+u.rarity.toUpperCase()+' · '+gateDescription(u.unlockId));
  row.append(title,p);list.appendChild(row);
 }
 $('archiveMore').classList.toggle('hidden',filtered.length<=archiveLimit);
 $('archiveShowing').textContent='SHOWING '+displayed.length+' OF '+filtered.length+
  ' BLUEPRINTS · INCLUDING MYTHIC CHALLENGES';
}
function openArchive(){
 let select=document.getElementById('wyrdfluxArchiveClass');
 if(!select){
  select=document.createElement('select');select.id='wyrdfluxArchiveClass';
  select.setAttribute('aria-label','Weapon class');
  for(const name of ['all',...WYRDFLUX_GUN_CLASSES]){
   const option=document.createElement('option');
   option.value=name;option.textContent=name==='all'?'ALL WEAPON CLASSES':name;
   select.append(option);
  }
  select.addEventListener('change',()=>{archiveLimit=48;renderArchivePage();});
  $('archiveFilter')?.insertAdjacentElement('afterend',select);
 }
 const counts=metaCounts();
 $('archiveOverview').textContent='RUNS '+meta.runs+' · XP '+meta.xp+
  ' · KILLS '+meta.kills+' · BOSSES '+meta.bossKills+' · ASCENSIONS '+meta.ascensions+
  ' · BEST WAVE '+meta.maxWave+' · HELL BREACH CLEARS '+(meta.hellBreachClears||0);
 $('archiveCount').textContent=(ORIGINAL_WEAPON_COUNT+counts.guns)+' / 250 GUNS · '+
  counts.specials+' / 96 SPECIALS UNLOCKED';
 archiveLimit=48;
 renderArchivePage();showScreen('archiveScreen');
}

const stacks=id=>Number(player?.perks?.[id]||0);
const activeFusions=()=>FUSIONS.filter(f=>f.requires.every(id=>stacks(id)>0));
function weightedUpgradeChoices(){
 const available=UPGRADES.filter(u=>!/(overdrive|rage|afterburner)/i.test((u.id||'')+' '+(u.tag||'')+' '+(u.name||''))&&
   stacks(u.id)<u.max&&hasMetaUnlock(u)&&(u.id!=='hellflash'||hellBreach.state==='active')).concat((cycleOf(wave)>1||localWaveOf(wave)===CAMPAIGN_WAVES)?ASCENSION_UPGRADES.filter(u=>stacks(u.id)<u.max):[]);
 const featuredPistol=rnd()<.24?PISTOL_UPGRADES.filter(u=>stacks(u.id)<u.max):[];
 const result=[],needed=ARMORY_CARDS.filter(u=>!u.worldSource&&!activeGun[u.weaponIndex]&&u.weaponIndex>0&&hasMetaUnlock(u));
 // Only the completing world can make its own exclusive gun appear.
 const relic=worldRelicOffer?worldRelicCardFor(worldRelicOffer):null;
 if(relic&&!activeGun[relic.weaponIndex])result.push(relic);
 worldRelicOffer=null;
 // A full-run victory always rewards one endless legacy power choice.
 // It is not hidden behind random ordinary augment odds.
 if(localWaveOf(wave)===CAMPAIGN_WAVES){
  result.push(ASCENSION_UPGRADES[Math.floor(rnd()*ASCENSION_UPGRADES.length)]);
 }
 // The armory can appear as the first choice on early waves and regularly
 // thereafter. Players retain full agency: not picking it doesn't unlock it.
 const armoryRound=(wave===1||wave%2===0||rnd()<.36);
 if(needed.length&&armoryRound){
  const pool=needed.map(u=>({u,weight:RARITY_WEIGHT[u.rarity]*(1+Math.min(wave,12)*.06)*(u.metaLock?.42:1)}));
  let ticket=rnd()*pool.reduce((n,v)=>n+v.weight,0);
  let chosen=pool[pool.length-1].u;
  for(const p of pool){ticket-=p.weight;if(ticket<=0){chosen=p.u;break}}
  result.push(chosen);
 }
 for(let i=result.length;i<3&&available.length;i++){
  const pool=available.filter(u=>!result.includes(u));
  if(!pool.length)break;
  let total=0;
  const weighted=pool.map(u=>{
   let weight=RARITY_WEIGHT[u.rarity];
   if(wave%3===0&&u.rarity==='rare')weight*=2.2;
   if(wave%5===0&&u.rarity==='epic')weight*=3;
   if(wave%7===0&&u.rarity==='legendary')weight*=3.6;
   if(FUSIONS.some(f=>f.requires.includes(u.id)&&f.requires.some(x=>x!==u.id&&stacks(x)>0)))weight*=2.25;
   weight*=1+Math.min(stacks(u.id),5)*.10;
   total+=weight;return {u,weight};
  });
  let ticket=rnd()*total,chosen=weighted[weighted.length-1].u;
  for(const v of weighted){ticket-=v.weight;if(ticket<=0){chosen=v.u;break}}
  result.push(chosen);
 }
 if(!result.length){
  // Even a 500+ level endless run must not strand the player on an empty
  // upgrade menu after every ordinary perk/gun reaches its stack cap.
  return [
   {id:'wyrdflux-salvage',tag:'UTILITY',rarity:'rare',kind:'perk',name:'SALVAGE WINDFALL',icon:'✧',
    text:'Collect 500 credits from the ruins; repeatable.',max:999999,
    apply:()=>{player.cash+=500;}},
   {id:'wyrdflux-armor',tag:'SUSTAIN',rarity:'epic',kind:'perk',name:'AETHER REFORGE',icon:'⬡',
    text:'Permanently increase maximum shield by 8.',max:999999,
    apply:()=>{player.maxShield+=8;player.shield=Math.min(player.maxShield,player.shield+22);}},
   {id:'wyrdflux-force',tag:'OFFENSE',rarity:'legendary',kind:'perk',name:'ETERNAL FORCE',icon:'✦',
    text:'Increase all weapon damage by 2 percent.',max:999999,
    apply:()=>{player.damageMult*=1.02;}}
  ];
 }
 if(wave%3===0&&!result.some(u=>u.rarity!=='common')){
   const better=available.filter(u=>u.rarity!=='common'&&!result.includes(u));
   if(better.length)result[result.length-1]=better[Math.floor(rnd()*better.length)];
 }
 if(featuredPistol.length&&result.length){const pick=featuredPistol[Math.floor(rnd()*featuredPistol.length)];
  if(!result.includes(pick))result[Math.min(2,result.length-1)]=pick;}
 return result;
}
function grantUpgrade(u){
 rememberWyrdfluxRunItem(u.kind==='weapon'?'WEAPON':'UPGRADE',u.name,u.text||'');
 if(u.kind==='weapon'){
  if(!activeGun[u.weaponIndex]){
   activeGun[u.weaponIndex]=true;gun=u.weaponIndex;mixGun=-1;
   player.energy=100;player.shield=Math.min(player.maxShield,player.shield+16);
   notice('NEW WEAPON UNLOCKED // '+WEAPONS[gun].name,2.5);
   burst(player.x,player.z,WEAPONS[gun].col,1.8);
   hudWeapon();saveCheckpoint();
  }
  return;
 }
 const old=activeFusions().map(f=>f.id);
 player.perks??={};player.perks[u.id]=(player.perks[u.id]||0)+1;
 u.apply();
 if(u.kind==='pistol')wyrdfluxSoundAsset('pistol_'+u.id.slice(3));
 const fresh=activeFusions().filter(f=>!old.includes(f.id));
 player.fusions=activeFusions().map(f=>f.id);
 if(fresh.length){announce('FUSION UNLOCKED // '+fresh.map(f=>f.name).join(' + '),3.2);notice(fresh.map(f=>f.description).join(' · '),3.5);spark(player.x,player.z,'gold',40);player.fusionJustUnlocked=fresh.map(f=>f.name).join(' + ')}
 saveCheckpoint();
}
function rarityClass(u){return 'rarity-'+u.rarity}

// The timeline never terminates at the seventh sector. Wave is absolute;
// localWave and cycleOf wrap the same seven-sector 21-wave campaign forever.
const CAMPAIGN_WAVES=21;
const cycleOf=n=>Math.max(1,Math.floor((Math.max(1,n)-1)/CAMPAIGN_WAVES)+1);
const localWaveOf=n=>((Math.max(1,n)-1)%CAMPAIGN_WAVES)+1;
const cycleDifficulty=n=>{
 const passes=Math.max(0,cycleOf(n)-1);
 // Each full campaign makes foes 2.5x stronger: 1 / 2.5 / 6.25 / 15.625.
 // Cap at finite values to avoid runaway overflow on very long careers.
 const cyclePower=Math.min(1e8,Math.pow(2.5,Math.min(21,passes)));
 return {hp:cyclePower,damage:cyclePower,
  speed:Math.min(1.75,1+passes*.075),extra:Math.min(14,passes*2)};
};
// Cinematic is a render-only preview of the actual arena. It never mutates
// the user's saved progression, active enemies or weapon inventory.
const introCine={active:false,clock:0,duration:15.6,shot:'fracture',shown:false,
 actorCount:0,skipCount:0,replayCount:0,lastCaption:'',flash:0};
const bossCine={active:false,clock:0,duration:3,id:null,type:null,seen:0,skipped:0,finished:0};
let phase='menu',player, enemies=[],projectiles=[],particles=[],tracers=[],pickups=[],impactFlashes=[],debris=[],wave=0,kills=0,totalScore=0,sector=0,last=0,stepDebt=0,time=0,announcedUntil=0,toastUntil=0,shake=0,damageUntil=0,gun=0,mixGun=-1,wyrdfluxPrimarySlot=-1,wyrdfluxSecondarySlot=0,activeGun=Array(WEAPONS.length).fill(false).map((v,i)=>i===0),spawnPending=0,spawnClock=0,upgradeChoices=[],muted=false,ctxAudio=null,worldRelicOffer=null;
const inputs={keys:new Set(),moveX:0,moveZ:0,shoot:false,fire:null,look:null,joystick:null,interact:false,focus:false};

/* v0.27: private test sessions never touch campaign checkpoints or career XP.
 * Rendering culls GPU/CPU construction only: simulation and hit detection
 * always include every spawned enemy, even when outside the camera frustum.
 */
let testLabMode=null,visibleEnemyMeshes=0,culledEnemyMeshes=0,spawnVisuals=0;

/* v0.56: three independently rendered Blender Living Worlds rooms.
 * Entry suspends the arena without touching account-wide saves or Android.
 * Each scene requires an actual packaged and readable Blender GLB.
 */
const LIVING_REALM_INFO=Object.freeze({
 witch:{title:"BLACKTHORN WITCH CABIN",chance:.03,portal:"MUSHROOM CIRCLE",color:"purple"},
 greenhouse:{title:"VERDANT SANCTUARY",chance:.02,portal:"VINE GATE",color:"green"},
 library:{title:"FORBIDDEN ARCHIVE",chance:.01,portal:"FLOATING BOOK PORTAL",color:"cyan"},
 blackwake:{title:"BLACKWAKE COVE",chance:0,portal:"THE TIDAL CAVERN",color:"cyan"}
});
const ECLIPSE_CATALYST=Object.freeze({name:"ECLIPSE CATALYST",sub:"ARCHIVE ELEMENTAL · 200 CHARGES",
 dmg:195,rate:.32,shots:1,spread:.025,range:31,col:"purple",effect:"arc"});
const livingRealm={active:false,id:null,pending:null,claimed:false,
 returnState:null,testOnly:false,lastEventWave:0,visits:0,choiceResult:null};

/** Blackwake's secret is solved inside an ordinary arena, never by chance alone.
 * Three scattered shell marks are found in order; the tide cave then appears.
 * This remains separate from Circus toy clues and normal realm invitations.
 */
// Small in-world chest inside the shifted wreck. Blender Z-up local position
// (x=-4.55, y=7.65) maps through the isolated GLB at 0.95x.
const BLACKWAKE_CHEST_WORLD=Object.freeze({x:C-4.55*.95,z:C-7.65*.95});
const BLACKWAKE_CLUES=Object.freeze([
 {name:'SALT-SCARRED COMPASS',hint:'A compass points where no land exists',x:C-7,z:C+5},
 {name:'DROWNED ANCHOR',hint:'The broken chain tastes of moonlit brine',x:C+6,z:C+1},
 {name:"CAPTAIN'S TIDE CHART",hint:'Three marks make the shore remember',x:C-5,z:C-6}
]);
function freshBlackwake(){return {step:0,state:'hidden',gate:null,visited:false,claimed:false};}
let blackwake=freshBlackwake();
/* Inline-only WYRDFLUX Blackwake Kraken core, inserted into runtime's game closure.
 * Four shootable tentacles, exactly three synchronized one-second ambushes,
 * one front chest guard; a SEPARATE half-submerged offshore body with a blinking
 * single eye (never attached to any tentacle); prize lock until defeat. */
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

function blackwakeClueSite(index){
 const clue=BLACKWAKE_CLUES[index];if(!clue)return null;
 const points=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2],
 [3,0],[-3,0],[0,3],[0,-3],[4,0],[-4,0],[0,4],[0,-4]];
 for(const [dx,dz] of points){
  const x=clue.x+dx,z=clue.z+dz;
  if(x>=2&&x<N-2&&z>=2&&z<N-2&&free(x,z,.36))return {x,z};
 }
 return null;
}
function blackwakeClueAvailable(){
 return phase==='play'&&wave>=3&&!testLabMode&&!livingRealm.active&&
  circus.state!=='active'&&blackwake.state==='hidden'&&blackwake.step<3&&
  blockworld.state!=='active'&&hellBreach.state!=='active'&&heavenSanctum.state!=='active';
}
function discoverBlackwakeClue(index){
 if(!blackwakeClueAvailable()||index!==blackwake.step)return false;
 const spot=blackwakeClueSite(index);if(!spot||
  Math.hypot(spot.x-player.x,spot.z-player.z)>2.2)return false;
 blackwake.step++;sound('upgrade');burst(spot.x,spot.z,'cyan',1.25);
 if(blackwake.step===3){
  blackwake.state='gate';
  const choices=[[C+5,C+6],[C-6,C+6],[C+5,C-5],[C-5,C-5],[C,C+9]];
  blackwake.gate=choices.map(([x,z])=>({x,z})).find(p=>free(p.x,p.z,.40))||randomOpen(6);
  announce('THE TIDE RECEDES · A HIDDEN CAVERN OPENS',4);
  notice('FOLLOW THE SALT-BLUE LIGHT · WALK THROUGH THE PORTAL',4);
 }else{
  announce('THE TIDAL MAP REMEMBERS '+blackwake.step+' / 3',2.8);
  notice(BLACKWAKE_CLUES[blackwake.step]?.hint||'THE SEA IS LISTENING',3.5);
 }
 saveCheckpoint();return true;
}
function enterBlackwake(){
 if(blackwake.state!=='gate'||!blackwake.gate)return false;
 if(!enterLivingRealm('blackwake'))return false;
 blackwake.state='active';blackwake.visited=true;
 afterlightSceneTransition('BLACKWAKE COVE · THE SHIP THAT NEVER RETURNED');
 return true;
}
function blackwakeChestReward(){
 if(!livingRealm.active||livingRealm.id!=='blackwake'||livingRealm.claimed)return false;
 if(blackwakeKraken.state!=='defeated'){
  notice('THE KRAKEN GUARDS THE CHEST · DEFEAT IT FIRST',3);return false;
 }
 const i=WEAPONS.findIndex(w=>w.worldSource==='blackwake');
 if(i<0)return false;
 livingRealm.claimed=true;blackwake.claimed=true;
 const priorGun=gun;
 activeGun[i]=true;gun=i;mixGun=-1;
 // The treasure mythic becomes a permanent two-input weapon, not a spare slot.
 const forged=priorGun!==i&&activeGun[priorGun]&&forgeWyrdfluxWeapon(priorGun,i);
 player.perks??={};player.perks.corsair=Math.max(1,player.perks.corsair||0);
 const haul=Math.round(900+cycleOf(wave)*380);
 player.cash+=haul;totalScore+=2800+cycleOf(wave)*480;
 rememberWyrdfluxRunItem('HIDDEN ENCOUNTER',forged?WEAPONS[gun].name:'BLACKWAKE BROADSIDE',
  'Menu treasure chest recovered · tidal cannon · +12% salvage from enemy kills');
 hudWeapon();sound('upgrade');burst(C+.7,C-1.8,'gold',3.0,.85);
 announce((forged?'MYTHIC TIDAL GUN FUSED · ':'BLACKWAKE BROADSIDE · ')+
   'THE MENU TREASURE IS REAL',4.5);
 notice("CORSAIR'S GREED · +12% SALVAGE · "+haul+' TREASURE',4.8);
 return true;
}

function livingFireEquipped(){
 return activeGun.some((owned,i)=>owned&&
   (WEAPONS[i]?.effect==='ignite'||WEAPONS[i]?.modifier==='ignite'||
    /inferno|flame|fire|thermal/i.test(WEAPONS[i]?.name||'')))||
    stacks('kindle')>0||stacks('heattrace')>0;
}
function livingRenderer(id){return window.WYRDFLUX_REALM_RENDERERS?.[id]||null}
function livingAssetReady(id){
 return !!LIVING_REALM_INFO[id]&&!!livingRenderer(id)&&
  Number(window.WYRDFLUX_REALM_ASSETS?.size?.(id)||0)>=40000;
}
const BLACKWAKE_GANGWAY_PATH=Object.freeze([
 [C,25.5],[C,18.2],[C-.65,13.7],[C-1.0,11.15],
 [C-2.85,9.85],[BLACKWAKE_CHEST_WORLD.x,BLACKWAKE_CHEST_WORLD.z]
]);
function blackwakeGangwayDistance(px,pz){
 let best=Infinity;
 for(let i=1;i<BLACKWAKE_GANGWAY_PATH.length;i++){
   const [ax,az]=BLACKWAKE_GANGWAY_PATH[i-1],[bx,bz]=BLACKWAKE_GANGWAY_PATH[i];
   const vx=bx-ax,vz=bz-az,len=vx*vx+vz*vz||1;
   const t=clamp(((px-ax)*vx+(pz-az)*vz)/len,0,1);
   best=Math.min(best,Math.hypot(px-ax-vx*t,pz-az-vz*t));
 }
 return best;
}
function drawBlackwakeGangway(m,q){
 if(!livingRealm.active||livingRealm.id!=='blackwake')return;
 const renderer=livingRenderer('blackwake'),high=q==='high';
 for(let seg=1;seg<BLACKWAKE_GANGWAY_PATH.length;seg++){
   const [ax,az]=BLACKWAKE_GANGWAY_PATH[seg-1],[bx,bz]=BLACKWAKE_GANGWAY_PATH[seg];
   const length=Math.hypot(bx-ax,bz-az),parts=Math.max(1,Math.ceil(length/.65));
   const angle=Math.atan2(bx-ax,bz-az);
   for(let j=0;j<parts;j++){
     const t=(j+.5)/parts,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
     const y=clamp(renderer?.heightAt?.(x,z)||0,-.05,1.7)+.075;
     // The physics corridor uses the exact same polyline and width.
     m.box(x,y,z,1.22,.10,length/parts+.08,j%5===0?'brass':'rust',.055,angle);
     if(j%3===0){
       m.box(x,y+.12,z,.095,.11,.10,'cyan',.5+.25*Math.sin(time*3+j));
       if(high)m.beam(x,y+.12,z,x,y+.38,z,.022,'cyan',.18);
     }
   }
 }
}
function buildLivingMap(coverage,realmId){
 map.length=0;
 for(let z=0;z<N;z++){
  const row=[];
  for(let x=0;x<N;x++){
   const boundary=x===0||z===0||x===N-1||z===N-1;
   const modeled=!!coverage?.[z*32+x];
   // Witch walls are solid. Never carve a fake passage through their geometry.
   const safePath=realmId==='blackwake'?
     blackwakeGangwayDistance(x+.5,z+.5)<.94:
     realmId!=='witch'&&(
       (Math.abs(x-Math.floor(C))<2&&z>=10&&z<=27)||
       (Math.abs(x-Math.floor(C))<3&&Math.abs(z-25)<3));
   row.push(boundary||(modeled&&!safePath)?1:0);
  }
  map.push(row);
 }
}
function livingExitZ(){return livingRealm.id==='witch'?20.6:27;}
const WYRDFLUX_REALM_OBJECTIVES=Object.freeze({
 witch:{name:"THE WITCH'S BARGAIN",instructions:"1. You are inside Blackthorn Cabin. Follow the purple altar at the middle of the room. 2. Stand near it and HOLD E / controller X for 2 seconds. 3. Choose Silver Spore, Black Candle or Thorned Chalice. Each has a RANDOM blessing or curse. 4. Walk through the blue doorway portal to exit automatically."},
 greenhouse:{name:"THE GREENHOUSE'S GIFT",instructions:"1. Do not bring fire weapons or fire perks. 2. Find the glowing GREEN altar. 3. HOLD E / controller X for 2 seconds to fully restore health and armor and receive Living Roots regeneration. 4. Walk through the entrance portal to resume automatically."},
 library:{name:"THE FORBIDDEN ARCHIVE",instructions:"1. Follow the floating books toward the glowing CYAN altar. 2. HOLD E / controller X for 2 seconds. 3. Collect the Eclipse Catalyst: 200 elemental shots. 4. Walk through the entrance portal to resume automatically."},
 blackwake:{name:"BLACKWAKE COVE · KRAKEN OF THE WRECK",instructions:"1. Follow the cyan-lit plank gangway from the tide cave to the wreck. Its hull is solid; use the marked walkway to reach the treasure. 2. Look offshore: a half-submerged purple Kraken watches you through ONE huge blinking eye. 2. Its front tentacle guards the gold chest, while THREE more rise near your position. Move out of the warning circles within ONE SECOND before they slam down. 3. Shoot any tentacle to damage the Kraken; its attacks and tidal force push you away from the chest. 4. After the Kraken is DEAD, HOLD E / X at the chest for 2 seconds to claim Blackwake Broadside and Corsair's Greed. 5. Return through the tide cave."}
});
function updateLivingRealmInstructions(){
 let pane=document.getElementById('wyrdfluxRealmGuide');
 if(!livingRealm.active){pane?.remove();return;}
 const info=WYRDFLUX_REALM_OBJECTIVES[livingRealm.id];
 if(!pane){
  pane=document.createElement('aside');pane.id='wyrdfluxRealmGuide';
  pane.setAttribute('role','status');pane.setAttribute('aria-label','Secret realm objectives');
  const title=document.createElement('h3');title.id='wyrdfluxRealmGuideTitle';
  const instructions=document.createElement('p');instructions.id='wyrdfluxRealmGuideSteps';
  const progress=document.createElement('strong');progress.id='wyrdfluxRealmGuideProgress';
  pane.append(title,instructions,progress);document.body.appendChild(pane);
 }
 const title=pane.querySelector('#wyrdfluxRealmGuideTitle');
 const steps=pane.querySelector('#wyrdfluxRealmGuideSteps');
 const progress=pane.querySelector('#wyrdfluxRealmGuideProgress');
 if(title.textContent!==info.name)title.textContent=info.name;
 if(steps.textContent!==info.instructions)steps.textContent=info.instructions;
 const target=livingRealm.id==='blackwake'&&!livingRealm.claimed?BLACKWAKE_CHEST_WORLD:{x:C,z:livingRealm.claimed?livingExitZ():14};
 const distance=Math.hypot(target.x-player.x,target.z-player.z);
 progress.textContent=livingRealm.claimed?
  'REWARD CLAIMED | EXIT PORTAL '+distance.toFixed(1)+'m | WALK THROUGH':
  livingRealm.id==='blackwake'&&blackwakeKraken.state==='active'?
  'KRAKEN '+Math.ceil(blackwakeKraken.hp)+' / '+blackwakeKraken.maxHp+' HP | CHEST LOCKED | DODGE 1s SLAMS':
  'REWARD ALTAR '+distance.toFixed(1)+'m | HOLD E / X FOR 2s';
 pane.classList.toggle('claimed',livingRealm.claimed);
 pane.style.display=time-(livingRealm.enteredAt??time)>=5?'none':'';
}
function enterLivingRealm(id,testOnly=false){
 if(livingRealm.active||!LIVING_REALM_INFO[id])return false;
 if(id==='greenhouse'&&livingFireEquipped()){
  notice('THE PLANTS REJECT FIRE · REMOVE FIRE WEAPONS FOR A FUTURE RUN',3.4);
  return false;
 }
 const renderer=livingRenderer(id);
 if(!livingAssetReady(id)){notice('ORIGINAL BLENDER ROOM NOT YET INSTALLED',3.5);return false;}
 renderer.load(gl);
 if(renderer.state.status!=='ready'||(id==='blackwake'&&!renderer.state.blackwakeMetrics?.verified)){
  notice('BLENDER ROOM LOAD FAILED · ORIGINAL ARENA LEFT INTACT',3.5);
  return false;
 }
 if(!testOnly)saveCheckpoint();
 livingRealm.returnState={
  location:{x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch,
   height:player.height,verticalVel:player.verticalVel,vx:player.vx,vz:player.vz},
  map:map.map(row=>row.slice()),enemies,projectiles,particles,tracers,pickups,
  lingeringBeams,spawnPending,spawnClock,meadowEpisodeActive
 };
 wyrdfluxPlayerShots=[];resetWyrdfluxShadowReplay();
  livingRealm.active=true;livingRealm.id=id;livingRealm.enteredAt=time;livingRealm.claimed=false;
 livingRealm.choiceResult=null;livingRealm.testOnly=!!testOnly;livingRealm.visits++;
 livingRealm.pending=null;
 // Hide Meadow's color and flora while the private shoreline is open.
 if(id==='blackwake')document.body.classList.remove('meadow-magic-mode');
 enemies=[];projectiles=[];particles=[];tracers=[];pickups=[];lingeringBeams=[];
 spawnPending=0;spawnClock=999;inputs.shoot=false;inputs.fire=null;
 buildLivingMap(renderer.state.colliderCells,id);
 // The cabin spans approx z=9.8..21.2: use an interior spawn rather than outdoors.
 const spots=id==='witch'?
  [[C,19.2],[C-1.3,19.0],[C+1.3,19.0],[C,18.2]]:
  id==='blackwake'?[[C,25.5],[C+1,25.5],[C-1,25.2]]:
  [[C,25.5],[C,24.5],[C+1,24.5]];
 const spawn=spots.find(([x,z])=>free(x,z,.34));
 if(!spawn){notice('NO SAFE BLENDER ROOM SPAWN',4);
  livingRealm.active=false;livingRealm.id=null;return false;}
 player.x=spawn[0];player.z=spawn[1];player.height=0;player.verticalVel=0;
 player.vx=0;player.vz=0;player.yaw=0;player.pitch=0;
 buildStatic();document.body.classList.add('wyrdflux-living-realm');
 if(id==='blackwake')beginBlackwakeKraken();
 offerCircusToy(id);
 afterlightSceneTransition(LIVING_REALM_INFO[id].title);
 notice('FOLLOW REALM GUIDE | HOLD E OR CONTROLLER X AT THE ALTAR',5);
 updateLivingRealmInstructions();updateHUD(true);return true;
}
function leaveLivingRealm(){
  if(!livingRealm.active)return false;
  wyrdfluxPlayerShots=[];resetWyrdfluxShadowReplay();
 const prior=livingRealm.returnState,testOnly=livingRealm.testOnly,id=livingRealm.id;
 if(id==='blackwake'){blackwake.state='done';blackwakeKraken=freshBlackwakeKraken();}
 livingRealm.active=false;livingRealm.id=null;livingRealm.claimed=false;
 livingRealm.choiceResult=null;livingRealm.returnState=null;livingRealm.testOnly=false;
 document.body.classList.remove('wyrdflux-living-realm');
 updateLivingRealmInstructions();
 livingRenderer(id)?.dispose?.(gl);
 $('wyrdfluxWitchChoices')?.remove();
 if(prior){
  map.length=0;for(const row of prior.map)map.push(row.slice());
  enemies=prior.enemies;projectiles=prior.projectiles;particles=prior.particles;
  tracers=prior.tracers;pickups=prior.pickups;lingeringBeams=prior.lingeringBeams;
  spawnPending=prior.spawnPending;spawnClock=prior.spawnClock;
  meadowEpisodeActive=prior.meadowEpisodeActive;
  if(meadowEpisodeActive)document.body.classList.add('meadow-magic-mode');
  Object.assign(player,prior.location);
 }
 buildStatic();inputs.shoot=false;inputs.fire=null;interactProgress=0;
 if(circus.state==='armed')beginCircusPuzzle();
 else if(circus.state==='toy'){circus.state='done';circus.toy=null;}
 phase='play';showScreen(null);overlayPlay(true);
 if(testOnly){toMenu();return true;}
 afterlightSceneTransition('RETURN TO WYRDFLUX');
 notice('YOUR RUN RESUMES WHERE YOU LEFT IT',2.8);
 saveCheckpoint();updateHUD(true);return true;
}
function livingWitchChoice(selection){
 if(!livingRealm.active||livingRealm.id!=='witch'||livingRealm.claimed)return false;
 const good=rnd()<.52;livingRealm.claimed=true;
 const names=['THE SILVER SPORE','THE BLACK CANDLE','THE THORNED CHALICE'];
 const name=names[selection]||names[0];
 if(good){
  if(selection===0){player.damageMult*=1.35;notice(name+' · BLESSING: +35% DAMAGE',3.5);}
  else if(selection===1){player.maxShield+=75;player.shield=player.maxShield;notice(name+' · BLESSING: +75 MAX SHIELD',3.5);}
  else{player.perks??={};player.perks.vamp=(player.perks.vamp||0)+2;notice(name+' · BLESSING: LIFESTEAL',3.5);}
 }else{
  if(selection===0){player.maxShield=Math.max(20,player.maxShield*.80);player.shield=Math.min(player.shield,player.maxShield);notice(name+' · CURSE: SHIELD ATROPHY',3.5);}
  else if(selection===1){player.damageMult*=.82;notice(name+' · CURSE: WEAPON INSTABILITY',3.5);}
  else{player.hp=Math.max(1,player.hp*.55);notice(name+' · CURSE: BLOOD SACRIFICE',3.5);}
 }
 livingRealm.choiceResult={choice:selection,good};rememberWyrdfluxRunItem(good?'BLESSING':'CURSE',name,good?'Witch boon received':'Witch curse received');$('wyrdfluxWitchChoices')?.remove();
 phase='play';overlayPlay(true);showScreen(null);
 announce(good?'THE WITCH BLESSES YOU':'THE WITCH HAS CURSED YOU',3.2);
 sound('upgrade');return true;
}
function claimLivingReward(){
 if(!livingRealm.active||livingRealm.claimed)return false;
 if(livingRealm.id==='witch'){
  phase='pause';overlayPlay(false);document.exitPointerLock?.();
  let overlay=$('wyrdfluxWitchChoices');
  if(!overlay){overlay=document.createElement('section');overlay.id='wyrdfluxWitchChoices';
   overlay.style.cssText='position:fixed;inset:0;z-index:710;background:#08050beE;display:grid;place-items:center;padding:25px;color:#f1e5ff;font:16px system-ui';
   const inner=document.createElement('div');inner.style.cssText='max-width:630px;text-align:center;border:1px solid #ad83e1;padding:32px;background:#191024';
   const title=document.createElement('h2');title.textContent='THE WITCH OFFERS THREE BARGAINS';inner.appendChild(title);
   const warning=document.createElement('p');warning.textContent='Each sealed choice may bless or curse you. You will not know until you commit.';inner.appendChild(warning);
   ['THE SILVER SPORE','THE BLACK CANDLE','THE THORNED CHALICE'].forEach((name,i)=>{
    const btn=document.createElement('button');btn.className='secondary';btn.textContent=name;btn.style.margin='8px';
    btn.addEventListener('click',()=>livingWitchChoice(i));inner.appendChild(btn);
   });
   const back=document.createElement('button');back.textContent='LEAVE WITHOUT CHOOSING';back.className='secondary';
   back.addEventListener('click',()=>{overlay.remove();phase='play';overlayPlay(true);});inner.appendChild(back);
   overlay.appendChild(inner);document.body.appendChild(overlay);
  }return true;
 }
 if(livingRealm.id==='blackwake')return blackwakeChestReward();
 if(livingRealm.id==='greenhouse'){
  if(livingFireEquipped()){notice('FIRE OFFENDS THE PLANTS · NO BLESSING GRANTED',3);return false;}
  player.hp=player.maxHp;player.shield=player.maxShield;
  player.perks??={};player.perks.livingroots=Math.max(1,player.perks.livingroots||0);
  livingRealm.claimed=true;rememberWyrdfluxRunItem('REALM BOON','LIVING ROOTS','Health + armor restored; regeneration enabled');announce('LIVING ROOTS · FULL HEALTH & ARMOR · REGENERATION',4);sound('upgrade');return true;
 }
 if(livingRealm.id==='library'){
  player.eclipseCharges=200;player.eclipseArmed=true;
  livingRealm.claimed=true;rememberWyrdfluxRunItem('REALM BOON','ECLIPSE CATALYST','200 elemental charges claimed');hudWeapon();
  announce('ECLIPSE CATALYST · 200 DEVASTATING ELEMENTAL SHOTS',4);sound('upgrade');return true;
 }
 return false;
}
function startLivingRealmTest(id){
 if(phase!=='menu'||!livingAssetReady(id)){
  const status=$('wyrdfluxLivingTestStatus');
  if(status)status.textContent='ORIGINAL BLENDER '+(id||'ROOM')+' GLB NOT YET PACKAGED · NO FAKE SCENE';
  return false;
 }
 testLabMode='living-'+id;resetGame();
 phase='play';showScreen(null);overlayPlay(true);
 player.maxHp=350;player.hp=350;player.maxShield=200;player.shield=200;
 player.x=C;player.z=24.5;wave=1;sector=0;
 if(!enterLivingRealm(id,true)){toMenu();return false;}
 $('wyrdfluxLivingTestPanel')?.classList.add('hidden');world.focus();return true;
}
function installLivingRealmTestMenu(){
 if(!desktopPC||!location.hash.includes('qa')||$('wyrdfluxLivingTestButton'))return;
 const parent=$('mainMenu')?.querySelector('.menuActions')||$('mainMenu');
 if(!parent)return;
 const b=document.createElement('button');b.id='wyrdfluxLivingTestButton';b.type='button';
 b.className='secondary';b.textContent='TEST SECRET REALMS';b.style.cssText='position:fixed;left:clamp(18px,4vw,66px);bottom:clamp(16px,4vh,42px);z-index:681;padding:11px 15px;background:#251935eb;border:1px solid #b78be5;color:#f5ebff;border-radius:9px';parent.appendChild(b);
 const panel=document.createElement('div');panel.id='wyrdfluxLivingTestPanel';panel.className='hidden';
 panel.style.cssText='position:absolute;inset:0;z-index:680;background:#05060bee;display:grid;place-items:center;color:#eee;font:16px system-ui';
 const body=document.createElement('div');body.style.cssText='background:#161126;border:1px solid #ac82fa;padding:28px;min-width:min(430px,90vw);display:grid;gap:12px';
 const title=document.createElement('h2');title.textContent='WYRDFLUX · TEST SECRET REALMS';body.appendChild(title);
 for(const [id,cfg] of Object.entries(LIVING_REALM_INFO)){
  const entry=document.createElement('button');entry.className='secondary';
  entry.textContent='ENTER '+cfg.title;entry.addEventListener('click',()=>startLivingRealmTest(id));
  body.appendChild(entry);
 }
 const status=document.createElement('small');status.id='wyrdfluxLivingTestStatus';status.textContent='Only verified packaged original Blender scenes can load.';body.appendChild(status);
 const close=document.createElement('button');close.className='secondary';close.textContent='BACK TO MENU';close.addEventListener('click',()=>panel.classList.add('hidden'));body.appendChild(close);
 panel.appendChild(body);$('mainMenu').appendChild(panel);
 b.addEventListener('click',()=>{panel.classList.remove('hidden');});
}
function drawLivingRealmAmbient(m,p,q){
 if(!livingRealm.active)return;
 drawCircusToy(m);
 const id=livingRealm.id,a=time;
 // Independent animation overlays run only while this dimension is active.
 if(id==='witch'){
  for(let i=0;i<8;i++){const ang=i*TAU/8+a*.24;
   const x=C+Math.cos(ang)*2,z=14+Math.sin(ang)*2;
   m.box(x,.26+Math.abs(Math.sin(a*3+i))*.17,z,.13,.43,.12,i%2?'purple':'green',.35+Math.sin(a*4+i)*.16);}
  m.box(C,.45,14,1.3,.85,1.3,'black',.16);
  m.box(C,1.0+Math.sin(a*2)*.18,14,.45,.10,.45,'green',.45);
 }else if(id==='greenhouse'){
  for(let i=0;i<14;i++){const ang=i*TAU/14+a*.35;
   m.box(C+Math.cos(ang)*1.3,.40+Math.sin(a*3+i)*.22,14+Math.sin(ang)*1.3,.06,.08,.06,'cyan',.3);}
  m.box(C,1.35+Math.sin(a*1.7)*.15,14,.35,.52,.35,'green',1.5);
 }else if(id==='blackwake'){
  drawBlackwakeGangway(m,q);
  const n=q==='battery'?5:q==='high'?17:9;
  for(let i=0;i<n;i++){
   const x=C+Math.sin(i*2.47)*9,z=C-4+((i*5.2)%14);
   if(Math.hypot(x-p.x,z-p.z)>17)continue;
   m.box(x,.035+Math.sin(time*1.4+i)*.025,z,.22,.021,.30,
    i%4?'cyan':'white',.13);
  }
  if(!livingRealm.claimed)m.box(BLACKWAKE_CHEST_WORLD.x,.94,BLACKWAKE_CHEST_WORLD.z,.11,.10,.11,
   'gold',.20+.12*Math.sin(time*2));
  drawBlackwakeKraken(m,q);
  drawBlackwakeKrakenGunFX(m,p,q);
 }else if(id==='library'){
  for(let i=0;i<22;i++){
   const ang=i*TAU/22+a*(i%2?.20:-.16),r=2.0+(i%5)*.34;
   m.box(C+Math.cos(ang)*r,1.7+(i%4)*.38+Math.sin(a*1.3+i)*.24,14+Math.sin(ang)*r,
    .32,.07,.26,i%3?'purple':'blue',.10);}
 }
 for(let i=0;i<16;i++){const a2=i*TAU/16+a*.55,r=1.1+.08*Math.sin(a*3+i);
  m.beam(C+Math.cos(a2)*r,.09,livingExitZ(),C+Math.cos(a2+.25)*r,.09,livingExitZ()+Math.sin(a2+.25)*r,
    .035,'purple',.7);}
 drawRealmPortalFX(m,C,livingExitZ(),id,q,true);
 m.box(C,.95+Math.sin(a*2.1)*.16,livingExitZ(),.42,.45,.16,'cyan',1.3);
 if(!livingRealm.claimed&&id!=='blackwake')m.box(C,.7+Math.sin(a*1.6)*.08,14,.75,.48,.75,
    id==='greenhouse'?'green':id==='library'?'cyan':'purple',.65);
}

function drawCircusToy(m){
 if(!livingRealm.active||circus.state!=='toy'||
   circus.toyRealm!==livingRealm.id||!circus.toy)return;
 const p=circus.toy,t=time;
 // Wind-up laughing jack-in-the-box: simple original carved stage prop.
 m.box(p.x,.25,p.z,.40,.35,.40,'metal2',.2,Math.sin(t*.38)*.12);
 m.box(p.x,.48,p.z,.43,.11,.44,'gold',.7);
 m.box(p.x,.70+Math.sin(t*2)*.07,p.z,.23,.28,.19,'pink',.9);
 m.box(p.x,.87+Math.sin(t*2)*.07,p.z,.13,.08,.08,'white',1.6);
 for(const eye of [-1,1])m.box(p.x+eye*.055,.74,p.z-.10,.026,.04,.016,'dark');
 m.beam(p.x+.21,.38,p.z,p.x+.39,.38,p.z,.041,'brass',.8);
 m.box(p.x+.39,.37,p.z,.08,.12,.055,'cyan',.8);
 for(let i=0;i<8;i++){
  const a=TAU*i/8+t*.8;
  m.box(p.x+Math.cos(a)*.6,.13+Math.sin(t+i)*.06,
   p.z+Math.sin(a)*.6,.046,.05,.046,i%2?'gold':'purple',.65);
 }
}
function drawCircusSignals(m,q){
 if(circus.state==='puzzle'){
  for(const p of circus.points){
   const done=p.id<circus.step;
   const col=done?'green':p.color,rad=.62+Math.sin(time*2+p.id)*.08;
   m.box(p.x,.08,p.z,.5,.10,.5,'dark',.45);
   m.box(p.x,.20,p.z,.22,.18,.22,col,1.5);
   m.beam(p.x,.25,p.z,p.x,3.5+Math.sin(time*2+p.id)*.25,
    p.z,.08,col,done?.30:1.6);
   for(let k=0;k<(q==='battery'?5:10);k++){
    const a=TAU*k/(q==='battery'?5:10)+time*.55;
    m.box(p.x+Math.cos(a)*rad,.12,p.z+Math.sin(a)*rad,
     .06,.05,.06,col,.85);
   }
  }
 }else if(circus.state==='gate'&&circus.portal){
  const p=circus.portal,n=q==='battery'?10:18;
  for(let i=0;i<n;i++){
   const a=TAU*i/n+time*.30,b=TAU*(i+1)/n+time*.30;
   m.beam(p.x+Math.cos(a)*1.25,2.15+Math.sin(a)*2.0,p.z,
    p.x+Math.cos(b)*1.25,2.15+Math.sin(b)*2.0,p.z,
    .09,i%3?'purple':'gold',1.2);
  }
  m.box(p.x,.15,p.z,1.3,.18,.40,'dark',.9);
  drawRealmPortalFX(m,p.x,p.z,'circus',q);
 }
}
function drawCircusStage(m,q){
 if(circus.state!=='active')return;
 const battery=q==='battery',high=q==='high';
 const segments=battery?20:high?40:28,
  centerZ=C-2.0,rim=12.25,ringZ=C-3.3;
 const canvasA=[.38,.071,.078],canvasB=[.71,.63,.49],
  canvasShade=[.21,.045,.052],wood=[.24,.14,.09],brass=[.60,.41,.19];
 // True closed BIG TOP: sloped striped canopy, deep canvas walls,
 // visible rigging, and a central wooden/sawdust arena. No electronics.
 const apex=[C,9.80,centerZ];
 for(let i=0;i<segments;i++){
  const a=i*TAU/segments,b=(i+1)*TAU/segments;
  const p=[C+Math.cos(a)*rim,4.2,centerZ+Math.sin(a)*rim];
  const t=[C+Math.cos(b)*rim,4.2,centerZ+Math.sin(b)*rim];
  const main=i%2?canvasB:canvasA;
  m.tri(apex,p,t,main,.012);
  const wallLow=[p[0],.05,p[2]],wallNext=[t[0],.05,t[2]];
  // South entrance flaps: a 3m gap aligned with the player's aisle.
  const theta=(a+b)*.5,atDoor=Math.abs(Math.sin(theta)-1)<.035&&Math.cos(theta)>-.25&&Math.cos(theta)<.25;
  if(!atDoor){
   m.tri(p,wallLow,wallNext,i%3===0?canvasShade:main,.011);
   m.tri(p,wallNext,t,main,.011);
  }else{
   // Velvet curtains stand to either side of the open rear vestibule.
   m.beam(p[0],4.2,p[2],p[0],.05,p[2],.17,'red',.04);
   m.beam(t[0],4.2,t[2],t[0],.05,t[2],.17,'red',.04);
  }
  if(i%(battery?4:5)===0){
   m.beam(...apex,...p,.070,'brass',.045);
   m.beam(p[0],4.2,p[2],p[0],.14,p[2],.19,'brass',.095);
  }
 }
 // Three low, concentric rows: audience surrounds the ACTUAL circular ring.
 // Avoid the south-facing entrance aisle and reject anything near the player's
 // initial footprint. All seating is visual only, never collision barriers.
 const seats=battery?16:high?32:24,tiers=battery?2:3;
 for(let level=0;level<tiers;level++){
  const radius=6.65+level*1.07;
  for(let i=0;i<seats;i++){
   const a=i*TAU/seats,z=ringZ+Math.sin(a)*radius,
    x=C+Math.cos(a)*radius;
   if(z>C+3.20&&Math.abs(x-C)<2.20)continue;
   const y=.28+level*.34,dir=a+Math.PI/2;
   m.box(x,y,z,.79,.19,.63,wood,.025,dir);
   m.box(x,y+.31,z,.68,.51,.14,
    (i+level)%3===0?'red':'warm',.025,dir);
   if((i+level)%4===0)m.box(x,y-.17,z,.12,.22,.12,'brass',.035);
  }
 }
 // Circular sawdust center, four stage arcs and a clear down-aisle.
 m.box(C,.025,ringZ,10.8,.038,10.1,[.29,.19,.13],.03);
 for(let i=0;i<(battery?16:32);i++){
  const a=i*TAU/(battery?16:32),b=(i+1)*TAU/(battery?16:32),r=5.50;
  m.beam(C+Math.cos(a)*r,.115,ringZ+Math.sin(a)*r,
   C+Math.cos(b)*r,.115,ringZ+Math.sin(b)*r,.10,'brass',.14);
 }
 for(let j=0;j<7;j++){
  const z=C+5.1+j*.77;
  m.box(C,.055,z,2.75,.045,.71,j%2?[.20,.11,.10]:[.31,.17,.13],.03);
 }
 // Kerosene footlights and a dramatic warm spotlight: theatrical, not sci-fi.
 for(let i=0;i<(battery?6:12);i++){
  const a=i*TAU/(battery?6:12);
  const x=C+Math.cos(a)*5.65,z=ringZ+Math.sin(a)*5.65;
  m.box(x,.18,z,.20,.18,.20,'brass',.19);
  m.box(x,.32,z,.08,.14,.07,'warm',.35+.13*Math.sin(time*1.1+i));
 }
 // Low-cost suspended ropes and central chandelier; no particle flood.
 for(let k=0;k<(battery?4:8);k++){
  const a=k*TAU/(battery?4:8),x=C+Math.cos(a)*9.45,z=centerZ+Math.sin(a)*9.45;
  m.beam(C,9.65,centerZ,x,3.6,z,.025,'brass',.06);
 }
 m.box(C,7.80,ringZ,.80,.15,.78,'brass',.15);
 for(let k=0;k<4;k++){
  const a=k*TAU/4;
  m.beam(C+Math.cos(a)*.25,7.74,ringZ+Math.sin(a)*.25,
   C+Math.cos(a)*1.3,6.8,ringZ+Math.sin(a)*1.3,.045,'warm',.24);
 }
 // The aisle-trigger is an actual brass-ring threshold, not a cutscene timer.
 const mark=CIRCUS_RING_SHOW_MARK;
 m.box(mark.x,.034,mark.z,2.5,.024,.12,
  circus.performance==='waiting'?'gold':'brass',.21);
 if(circus.performance==='waiting'){
  m.box(mark.x,.06,mark.z,1.3,.025,.07,'gold',.17);
 }
 if(circus.defeated>=4&&!circus.claimed){
  m.box(C,.33,ringZ,.56,.24,.48,'gold',.48);
 }
 // Return portal retains the striped canvas and brass identity of the tent.
 drawRealmPortalFX(m,C,C+10,'circus',q,true);
}
function drawCircusPerformer(m,e,q){
 // Fallback geometry uses the same airborne transform as the real Blender rig.
 const lift=Math.max(0,e.circusFloat||0),spin=e.circusSpin||0;
 if(lift||spin){
  const original=m,c=Math.cos(spin),si=Math.sin(spin);
  const point=(x,y,z)=>({x:e.x+(x-e.x)*c-(z-e.z)*si,y:y+lift,
   z:e.z+(x-e.x)*si+(z-e.z)*c});
  m={box:(x,y,z,sx,sy,sz,col,em,rot)=>{
    const p=point(x,y,z);original.box(p.x,p.y,p.z,sx,sy,sz,col,em,(rot||0)+spin);
   },beam:(ax,ay,az,bx,by,bz,w,col,em)=>{
    const a=point(ax,ay,az),b=point(bx,by,bz);
    original.beam(a.x,a.y,a.z,b.x,b.y,b.z,w,col,em);
   }};
 }
 const x=e.x,z=e.z,boss=!!e.boss,morph=clamp(e.circusMorph||0,0,1),
  t=e.circusClock||0,scale=boss?1.68:1,step=Math.sin(e.bob);
 const col=['pink','cyan','gold','purple'][e.circusKind],flesh=e.hit>0?'white':'red';
 const bodyY=1.02*scale+.06*Math.sin(t*2.2),headY=1.79*scale;
 // At a distance: charming theatrical toy silhouettes in alternating colors.
 m.box(x,bodyY,z,.53*scale,.90*scale,.40*scale,col,.4);
 m.box(x,headY,z,.48*scale,.45*scale,.42*scale,'white',.3);
 m.box(x,headY+.35*scale,z,.36*scale,.31*scale,.35*scale,col,.7);
 for(const side of [-1,1]){
  const armSwing=step*.10*scale;
  m.beam(x+side*.37*scale,1.39*scale,z,x+side*.66*scale,
   (.65+armSwing)*scale,z,.14*scale,'purple',.2);
  m.beam(x+side*.2*scale,.67*scale,z,x+side*.26*scale,
   (.05-armSwing)*scale,z,.15*scale,'gold');
  m.box(x+side*.12*scale,headY+.05*scale,z-.225*scale,
   .045*scale,.06*scale,.025*scale,'dark');
 }
 m.box(x,headY-.17*scale,z-.26*scale,.18*scale,.04*scale,.04*scale,'red',.7);
 if(morph<.08)return;
 // Close-up silhouettes deform into exposed brass joints and cartilage:
 // asymmetric maw, jagged crown, joint overgrowth and extra limb pairs.
 const grow=morph*morph,twist=Math.sin(t*8)*.12*grow;
 m.box(x+twist,bodyY,z-.13*grow,.60*scale*(1+.3*grow),
  .95*scale,.48*scale,'dark',.3+grow*.45);
 m.box(x,headY-.16*scale,z-.26*scale,.31*scale*grow,
  .22*scale*grow,.18*scale*grow,flesh,1.3*grow);
 for(let i=0;i<7;i++){
  const px=x+(i-3)*.054*scale,py=(headY-.25+Math.sin(t*5+i)*.015)*scale;
  m.box(px,py,z-.38*scale,.035*scale,.10*scale*grow,.04*scale,
   i%2?'white':'gold',.7*grow);
 }
 for(const side of [-1,1]){
  const left=x+side*.3*scale;
  m.beam(left,1.3*scale,z-.1,left+side*(.7+grow*.5)*scale,
   (.6+Math.sin(t*6+side)*.2)*scale,z-.2,.07+grow*.06,
   'red',grow*.8);
  m.beam(left+side*.2*scale,1.0*scale,z,left+side*.85*scale,
   (.3+Math.sin(t*7)*.2)*scale,z-.5*grow,
   .045+grow*.04,'brass',grow);
 }
 if(boss){
  const ringN=q==='battery'?8:14,r=1.6*scale;
  for(let i=0;i<ringN;i++){
   const a=TAU*i/ringN+t*.5,b=TAU*(i+1)/ringN+t*.5;
   m.beam(x+Math.cos(a)*r,2.0*scale,z+Math.sin(a)*r,
    x+Math.cos(b)*r,2.0*scale,z+Math.sin(b)*r,.045,'gold',.65);
  }
 }
}


/** Shared material-aware portal language. Existing gameplay gate logic is
 * untouched. Bounded 8-18 segments and no textures or additional shaders. */
function drawRealmPortalFX(m,x,z,kind,q='balanced',exit=false){
 const n=q==='battery'?8:q==='high'?18:12;
 const t=time*(exit?-.34:.38),pulse=.53+.12*Math.sin(time*2.4);
 const palette={hell:'red',heaven:'gold',circus:'pink',witch:'purple',
  library:'cyan',greenhouse:'green',blackwake:'cyan',
  blockworld:'blockcyan',meadow:'green'};
 const color=palette[kind]||'purple';
 const radius=kind==='hell'?1.62:kind==='blackwake'?1.53:1.34;
 for(let i=0;i<n;i++){
  const a=i*TAU/n+t,b=(i+1)*TAU/n+t;
  m.beam(x+Math.cos(a)*radius,2.02+Math.sin(a)*1.64,z,
   x+Math.cos(b)*radius,2.02+Math.sin(b)*1.64,z,.035,
   color,pulse+(i%3===0?.17:0));
 }
 if(kind==='blackwake'){
  // Water pours down one edge of the sea cave; foam travels along the floor.
  for(let i=0;i<(q==='battery'?4:9);i++){
   const a=time*.55+i*.73;
   m.box(x+Math.sin(a)*radius,.06+.045*Math.sin(a*2),z+Math.cos(a)*.53,
    .09,.04,.15,i%3?'cyan':'white',.32);
  }
  for(const side of [-1,1])m.box(x+side*1.70,1.5,z,.58,3.12,.80,'obsidian',.09);
 }else if(kind==='witch'){
  for(let i=0;i<4;i++)m.box(x+Math.sin(i*1.77)*1.16,.15,
   z+Math.cos(i*1.77)*.34,.15,.16,.15,i%2?'purple':'green',.28);
 }else if(kind==='greenhouse'){
  for(const side of [-1,1])for(let k=0;k<3;k++)
   m.beam(x+side*(radius+.06),.25+k*.75,z,
    x+side*(radius+.10),.85+k*.75,z+.11,.046,'green',.26);
 }else if(kind==='library'){
  for(let i=0;i<4;i++)m.box(x+Math.cos(time*.22+i*TAU/4)*(radius+.18),
   .55+i*.76,z+.11,.20,.06,.15,i%2?'cyan':'purple',.33);
 }else if(kind==='circus'){
  for(const side of [-1,1])m.box(x+side*1.49,1.9,z,.22,3.6,.25,
   side>0?'red':'gold',.13);
  m.beam(x-1.52,3.9,z,x+1.52,3.9,z,.10,'gold',.28);
 }else if(kind==='hell'){
  for(let k=0;k<5;k++)m.beam(x+Math.sin(k*1.7+time*.5)*.7,
   .35+k*.60,z+.10,x+Math.sin(k*1.7+time*.5+1)*.5,
   .72+k*.55,z+.14,.030,'magma',.34);
 }else if(kind==='heaven'){
  for(let k=0;k<4;k++)m.beam(x+Math.sin(k*TAU/4)*.8,.22,z,
   x+Math.sin(k*TAU/4)*1.14,4.7,z,.027,'white',.21);
 }else if(kind==='blockworld'){
  for(let k=0;k<7;k++){const a=k*TAU/7+time*.5;
   m.box(x+Math.cos(a)*1.58,2.0+Math.sin(a)*1.74,z,.12,.12,.12,
    k%2?'blockore':'blockcyan',.38);
  }
 }
 m.box(x,.036,z,.87,.028,.48,color,.15);
}

/** Refine the original Breach/Dead City sectors without raising draw calls or
 * map collision costs. These pieces join the existing Mesh batch, cap by
 * quality, and stop updating outside the player's nearby corridor. */
function drawOriginalSectorFinesse(m,p,q){
 if(phase!=='play'||livingRealm.active||circus.state==='active'||
  hellBreach.state==='active'||heavenSanctum.state==='active'||
  blockworld.state==='active'||afterlightMeadowActive())return;
 const count=q==='battery'?6:q==='high'?20:12; // less junk in the entry arena
 for(let i=0;i<count;i++){
  const x=2.5+((i*7.17+sector*3.1)%26),z=2.5+((i*11.31+sector*.9)%26);
  if(Math.hypot(x-p.x,z-p.z)>12||!free(x,z,.24))continue;
  const t=.24+.08*Math.sin(time*.9+i*3.1),
   metals=i%5===0?'chrome':i%3===0?'rust':'metal2';
  // Recessed bolts, steel seams, scattered grit and small leaking reflections.
  m.box(x,.030,z,.35,.022,.08,metals,.035);
  if(i%2===0)m.box(x+.11,.04,z+.16,.055,.02,.055,
    i%6===0?'orange':'ironblack',i%6===0?t:.03);
  if(i%5===0&&q!=='battery')
   m.beam(x-.38,.035,z+.24,x+.40,.035,z+.21,.016,'charcoal',.015);
 }
}
function drawBlackwakeEntranceFX(m,q){
 if(blackwakeClueAvailable()){
  const site=blackwakeClueSite(blackwake.step);
  if(site&&Math.hypot(site.x-player.x,site.z-player.z)<20){
   m.box(site.x,.08,site.z,.28,.14,.25,'obsidian',.15);
   m.box(site.x,.21+Math.sin(time*2)*.06,site.z,.16,.09,.20,'gold',.45);
  }
 }
 if(blackwake.state==='gate'&&blackwake.gate)
  drawRealmPortalFX(m,blackwake.gate.x,blackwake.gate.z,'blackwake',q);
}
function drawLivingWorldGate(m){
 if(!livingRealm.pending||livingRealm.active)return;
 const cfg=LIVING_REALM_INFO[livingRealm.pending],a=time,r=1.4;
 drawRealmPortalFX(m,C,24.5,livingRealm.pending,$('quality').value);
 for(let i=0;i<16;i++){const ang=i*TAU/16+a*.28;
  m.box(C+Math.cos(ang)*r,.17+Math.sin(a*2+i)*.05,24.5+Math.sin(ang)*r,
   .20,.22,.2,cfg.color,.45);}
}

// Five percent of eligible non-boss wave transitions enter a Meadow Rift.
const MEADOW_WAVE_CHANCE=.05;
let meadowEpisodeActive=false,meadowEpisodeResume=false,meadowEpisodeCount=0;
function afterlightMeadowActive(){return !livingRealm.active&&(testLabMode === 'meadow'||meadowEpisodeActive);}
// A Meadow Rift is a separate temporary scene. Its body flag, daylit palette
// and title overlay may NEVER survive a normal map, Continue, Restart or Menu.
function clearMeadowWorldVisuals(){
 if(stylePreviewId==='sunlit-meadow')stylePreviewId=null;
 document.body.classList.remove('meadow-magic-mode');
 document.getElementById('afterlightWorldLoading')?.remove();
}
function trialStart(mode){
 if(!['maw','hell','angel','heaven','creeper','blockworld','pixelwarden','warden','circus'].includes(mode))return false;
 introCine.active=false;testLabMode=mode;resetGame();
 if(mode==='meadow')afterlightWorldLoading('MEADOW OF THE LOST');
 phase='play';showScreen(null);overlayPlay(true);
 wave=6;sector=1;createMap(sector);buildStatic();
 player.maxHp=350;player.hp=350;player.maxShield=200;player.shield=200;
 player.damageMult=2;player.energy=100;player.cash=1500;
 player.x=C;player.z=10.5;player.yaw=0;player.pitch=0;
 if(!free(player.x,player.z,.32)){
  let spots=[[C,12.5],[C,15.5],[C-2,12.5],[C+2,12.5],[C,20.5]];
  let pos=spots.find(([x,z])=>free(x,z,.32));
  if(!pos){const v=randomOpen(5);pos=[v.x,v.z];}
  player.x=pos[0];player.z=pos[1];
 }
 // Temporary weapon selection, not a career unlock.
 for(const i of [0,1,2,3,4])activeGun[i]=true;
 gun=1;mixGun=-1;enemies=[];spawnPending=0;spawnClock=99;projectiles=[];pickups=[];
 if(mode==='circus'){
  // Reuse the real grotesque performers, real arena and prize interaction.
  // Trial mode suppresses saveCheckpoint, unlocks and career progression.
  circus.state='gate';circus.portal={x:C,z:C+8};
  if(!enterCircus())throw Error('Circus test realm failed to initialize');
  announce('TEST LAB // THE UNLISTED SHOW',3.3);
  notice('CIRCUS TEST · NO CAMPAIGN PROGRESS SAVED',4);
 }else if(mode==='creeper'){
  blockworld={...blockworld,state:'trigger',returnWave:wave,returnSector:sector};
  const e=makeBlockworldEnemy('creeper',{x:C,z:14},true);
  e.appearT=0;enemies.push(e);
  announce('TEST LAB // DEFEAT THE CREEPER TO SHIFT WORLDS',4);
 }else if(mode==='blockworld'||mode==='pixelwarden'){
  blockworld={...blockworld,state:'shift',returnWave:wave,returnSector:sector};
  if(!beginBlockworld({stage:mode==='pixelwarden'?3:1,returnWave:wave,returnSector:sector}))
   throw Error('Blockworld route unavailable');
  notice(mode==='pixelwarden'?'TEST LAB // WARDEN BOSS':'TEST LAB // BLOCKWORLD TRIALS',4);
 }else if(mode==='maw'){
  const e=newEnemy({x:C,z:1.90},false);
  e.type='wallmaw';e.boss=true;e.hp=e.maxHp=ENEMY_STATS.wallmaw[0];
  e.x=C;e.z=1.90;e.speed=0;e.facing=Math.PI;e.attackT=99;e.ultimateClock=99;
  e.wall={phase:'emerge',clock:0,attack:0,attackT:2.6,
   summonT:8,mouth:0,lash:0,aim:0,casts:0};
  e.damageAtSpawn=runRecord.damageEvents;enemies.push(e);beginBossIntro(e);
  announce('TEST LAB // WALL MAW ENCOUNTER',3);
  notice('DEFEAT THE WALL MAW · ENTER THE RED GATE',4);
 }else if(mode==='warden'){
  const e=newEnemy(bossSpawnClearance(),false);
  e.type='warden';e.boss=true;e.hp=e.maxHp=ENEMY_STATS.warden[0]*3.2;
  e.appearT=0;e.attackT=2;e.ultimateClock=4;
  enemies.push(e);announce('TEST LAB // ORIGINAL BLENDER IRON WARDEN',3);
 }else if(mode==='angel'){
  const e=newEnemy(bossSpawnClearance(),false);
  e.type='ophanim';e.boss=true;e.hp=e.maxHp=ENEMY_STATS.ophanim[0];
  e.speed=.66;e.ultimateClock=2.6;e.ultimateStage='idle';e.attackT=99;
  e.appearT=0;e.damageAtSpawn=runRecord.damageEvents;
  enemies.push(e);beginBossIntro(e);
  notice('TEST LAB // DEFEAT THE OPHANIM TO OPEN THE LIGHT',4);
 }else if(mode==='heaven'){
  heavenSanctum={...heavenSanctum,state:'gate',returnWave:wave,returnSector:sector};
  if(!beginHeavenSanctum())throw Error('Heaven Sanctum test route unavailable');
  notice('TEST LAB // HEAVEN SANCTUM ALTAR',4);
 }else{
  hellBreach.state='gate';hellBreach.returnWave=wave;hellBreach.returnSector=sector;
  if(!beginHellBreach())throw Error('Black Chapel test route unavailable');
  notice('TEST LAB // BLACK CHAPEL · THREE TRIALS',3);
 }
 $('testLabPanel').classList.add('hidden');
 hudWeapon();updateHUD();resize();world.focus();return true;
}
function trialFinish(completed=false){
 if(!testLabMode)return false;
 endBossIntro(true);phase='dead';enemies=[];spawnPending=0;
 projectiles=[];lingeringBeams=[];inputs.shoot=false;inputs.fire=null;
 overlayPlay(false);
 $('endKicker').textContent='PRIVATE TEST LAB // NO CAREER PROGRESS';
 $('endHeading').textContent=completed?(testLabMode==='creeper'||testLabMode==='blockworld'||testLabMode==='pixelwarden'?'BLOCKWORLD BREACH CLEARED':testLabMode==='angel'||testLabMode==='heaven'?'HEAVEN SANCTUM CLEARED':testLabMode==='circus'?'CIRCUS SHOW COMPLETE':'HELL BREACH CLEARED'):'SIMULATION ENDED';
 $('endStats').textContent=completed?
   (testLabMode==='creeper'||testLabMode==='blockworld'||testLabMode==='pixelwarden'?'CREEPER / BLOCKWORLD / WARDEN · TEST COMPLETED':testLabMode==='angel'||testLabMode==='heaven'?'OPHANIM / HEAVEN SANCTUM · TEST COMPLETED':testLabMode==='circus'?'THE UNLISTED SHOW · TEST COMPLETED':'WALL MAW / BLACK CHAPEL · TEST COMPLETED'):
   'RETRY THE TEST OR RETURN TO YOUR SAVED CAMPAIGN';
 $('runUnlockSummary').textContent='Your campaign checkpoint, XP and unlocks remain unchanged.';
 showScreen('endScreen');return true;
}
function enemyRenderVisible(e,view,q){
 if(introCine.active||bossCine.active)return true;
 const dx=e.x-view.x,dz=e.z-view.z,dist=Math.hypot(dx,dz);
 if(dist<(q==='battery'?6:9))return true;
 if(dist>(hellBreach.state==='active'?(q==='battery'?14:q==='balanced'?18:22):(q==='battery'?20:q==='balanced'?28:36)))return false;
 const dot=Math.sin(view.yaw)*dx-Math.cos(view.yaw)*dz;
 if(dist>15&&dot<dist*.17)return false;
 if(dist>9&&dot<-dist*.22)return false;
 return true;
}
function drawSpawnSignal(m,e,q){
 const x=e.x,z=e.z,t=clamp((e.appearT||0)/.5,0,1);
 const r=.22+(.5-t)*.30,accent=e.type==='ophanim'?'gold':e.hellVariant?'red':e.type==='drone'?'orange':'cyan';
 const n=q==='battery'?4:q==='high'?8:6;
 for(let i=0;i<n;i++){
  const a=i*TAU/n+time*.55,b=(i+1)*TAU/n+time*.55;
  m.beam(x+Math.cos(a)*r,.028,z+Math.sin(a)*r,
   x+Math.cos(b)*r,.028,z+Math.sin(b)*r,.021,accent,.14+.22*t);
 }
 m.box(x,Math.max(.13,.65-1.1*t),z,.20,.12,.19,'metal2',.06);
 m.box(x,.025,z,.34,.006,.34,accent,.18*t);
}

// Stamina is spent only on deliberate sprint/dash, not analog walking.
// L3 must be clicked; simply tilting the movement stick never sprints.
const wyrdfluxSprint={latched:false,exhausted:false};
const WYRDFLUX_DASH_STAMINA_COST=45;
function wyrdfluxSprintAllowed(moving,keyboardShift){
 if(player.energy<5&&!wyrdfluxSprint.exhausted){
  wyrdfluxSprint.exhausted=true;wyrdfluxSprint.latched=false;
 }
 if(wyrdfluxSprint.exhausted&&player.energy>50)
  wyrdfluxSprint.exhausted=false;
 const requested=desktopPC&&pcPadState.mode==='gamepad'?
  wyrdfluxSprint.latched:keyboardShift;
 return !!moving&&!!requested&&!wyrdfluxSprint.exhausted&&player.energy>=5&&player.dashT===0;
}
const defaultPlayer=()=>({x:C,z:24.5,yaw:0,pitch:0,bob:0,height:0,verticalVel:0,hp:55,maxHp:55,shield:12,maxShield:12,energy:100,rage:0,rageActive:0,rageMult:1,coolingMult:1,damageMult:.30,speedMult:1,moveMult:1,regenMult:1,dashMult:1,dashCool:0,dashT:0,lastHit:-99,nextShot:0,cash:0,perks:{},fusions:[],frenzyT:0,recoil:0,muzzleT:0,impactGlow:0,phoenixUsed:false,pulseClock:0,heat:0,weaponThermals:[],knockbackT:0,knockbackX:0,knockbackZ:0,vx:0,vz:0,lean:0,fovKick:0,landKick:0,dashDirX:0,dashDirZ:-1,stepFx:0});

/** AFTERLIGHT v0.26: bounded inertial viewmodel motion.
 * The camera ray and collision stay authoritative; only the held gun moves.
 * Uses real camera angular change, including same-thumb fire-and-drag aiming.
 */
const weaponMotion={subject:null,yaw:0,pitch:0,swayX:0,swayY:0};
function updateWeaponMotion(dt){
 if(weaponMotion.subject!==player){
  weaponMotion.subject=player;weaponMotion.yaw=player.yaw;weaponMotion.pitch=player.pitch;
  weaponMotion.swayX=0;weaponMotion.swayY=0;return;
 }
 const yawStep=Math.atan2(Math.sin(player.yaw-weaponMotion.yaw),
                          Math.cos(player.yaw-weaponMotion.yaw));
 const pitchStep=player.pitch-weaponMotion.pitch;
 weaponMotion.yaw=player.yaw;weaponMotion.pitch=player.pitch;
 const response=clamp(dt*14,0,1);
 weaponMotion.swayX=mix(weaponMotion.swayX,clamp(-yawStep*2.4,-.16,.16),response);
 weaponMotion.swayY=mix(weaponMotion.swayY,clamp(-pitchStep*2.2,-.12,.12),response);
}

const RELAYS=[{id:'NORTH',name:'NORTH GRID RELAY',x:5.5,z:5.5},{id:'EAST',name:'EAST GRID RELAY',x:25.5,z:5.5},{id:'SOUTH',name:'SOUTH GRID RELAY',x:5.5,z:25.5}];
let relayState={},coreOnline=false,interactProgress=0,saveTimer=0,missionFlash=0;
let wyrdfluxRunPickups=[];
function rememberWyrdfluxRunItem(category,label,detail){
 if(testLabMode||!label)return;
 wyrdfluxRunPickups.push({category:String(category).slice(0,30),label:String(label).slice(0,100),detail:String(detail||'').slice(0,200),wave,at:Math.floor(time)});
 if(wyrdfluxRunPickups.length>256)wyrdfluxRunPickups.shift();
}
function activeRelays(){return RELAYS.filter(x=>relayState[x.id]).length}
function objective(){
 if(blackwake.state==='gate'&&blackwake.gate&&!livingRealm.active)
  return {name:'TIDAL CAVE · BLACKWAKE COVE',id:'BLACKWAKE_GATE',kind:'blackwakegate',...blackwake.gate};
 if(circus.state==='active')return circus.defeated===4&&!circus.claimed?
  {name:'CLAIM THE MISPRINTED TICKET',id:'CIRCUS_PRIZE',kind:'circusprize',x:C,z:C}:
  {name:'FIND THE EXIT CURTAIN',id:'CIRCUS_EXIT',kind:'circusexit',x:C,z:C+10};
 if(circus.state==='puzzle')return {name:'THREE LIGHTS · FOLLOW THE TOY SONG',
  id:'CIRCUS_LIGHT',kind:'circuslight',x:circus.points[circus.step]?.x||C,
  z:circus.points[circus.step]?.z||C};
 if(circus.state==='gate')return {name:'A PURPLE CURTAIN HAS APPEARED',
  id:'CIRCUS_GATE',kind:'circusgate',x:circus.portal?.x||C,z:circus.portal?.z||C+8};
 if(livingRealm.active)return livingRealm.claimed?
  {name:'RETURN TO YOUR RUN',id:'LIVING_EXIT',kind:'livingexit',x:C,z:livingExitZ()}:
  {name:'SECRET REALM · '+LIVING_REALM_INFO[livingRealm.id].title,id:'LIVING_REWARD',kind:'livingreward',x:livingRealm.id==='blackwake'?BLACKWAKE_CHEST_WORLD.x:C,z:livingRealm.id==='blackwake'?BLACKWAKE_CHEST_WORLD.z:14};
 if(livingRealm.pending)return {name:'SECRET GATE · '+LIVING_REALM_INFO[livingRealm.pending].portal,
  id:'LIVING_GATE',kind:'livinggate',x:C,z:24.5};
 if(blockworld.state==='active')return {name:'BLOCKWORLD BREACH // '+(blockworld.stage===3?'WARDEN BOSS':'TRIAL '+blockworld.stage+'/3'),id:'BLOCK_ROOM',kind:'blockwave',x:C,z:C};
 if(blockworld.state==='shift'||blockworld.state==='trigger')return {name:'CREEPER ANOMALY // WORLD SHIFT',id:'BLOCK_GATE',kind:'blockwave',x:C,z:C};
 if(heavenSanctum.state==='gate')return {name:'HEAVEN SANCTUM // ENTER THE LIGHT',id:'HEAVEN_GATE',kind:'heavengate',x:heavenSanctum.gateX,z:heavenSanctum.gateZ};
 if(heavenSanctum.state==='active')return {name:'HEAVEN SANCTUM // CELESTIAL ALTAR',id:'HEAVEN_ALTAR',kind:'heavenaltar',x:C,z:5.5};
 if(hellBreach.state==='gate')return {name:'HELL BREACH // ENTER THE GATE',id:'HELL_GATE',kind:'hellgate',x:hellBreach.gateX,z:hellBreach.gateZ};
 if(hellBreach.state==='active')return {name:'BLACK CHAPEL // TRIAL '+hellBreach.stage+'/3',id:'ABYSS',kind:'hellwave',x:C,z:C};
 if(hellBreach.state==='pending')return {name:'THE WALL HAS FALLEN // CLEAR HOSTILES',id:'SEAL',kind:'hellwave',x:C,z:2.5};
 const pending=RELAYS.filter(x=>!relayState[x.id]);if(pending.length){pending.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));return {...pending[0],kind:'relay'}}return coreOnline?null:{name:'CENTRAL POWER CORE',id:'CORE',x:C,z:C,kind:'core'}}
function interactTarget(){
 if(circus.state==='active'){
  const options=[];
  if(circus.defeated>=4&&!circus.claimed)
   options.push({name:'TAKE THE MISPRINTED TICKET',id:'CIRCUS_PRIZE',
    kind:'circusprize',x:C,z:C});
  options.push({name:'EXIT THE SHOW',id:'CIRCUS_EXIT',
   kind:'circusexit',x:C,z:C+10});
  return options.find(o=>Math.hypot(o.x-player.x,o.z-player.z)<2.0)||null;
 }
 if(circus.state==='puzzle')
  return circus.points.map(p=>({name:p.color.toUpperCase()+' SPOTLIGHT',id:'CIRCUS_'+p.id,
   kind:'circuslight',index:p.id,x:p.x,z:p.z}))
   .find(p=>Math.hypot(p.x-player.x,p.z-player.z)<2.1)||null;
 if(circus.state==='gate'&&circus.portal){
  const p=circus.portal;
  if(Math.hypot(p.x-player.x,p.z-player.z)<2.2)return {name:'ENTER THE UNLISTED SHOW',
   id:'CIRCUS_GATE',kind:'circusgate',x:p.x,z:p.z};
 }
 if(livingRealm.active){
  const options=[];
  if(circus.state==='toy'&&circus.toyRealm===livingRealm.id&&circus.toy)
   options.push({name:'WIND THE STRANGE TOY',id:'CIRCUS_TOY',
    kind:'circustoy',x:circus.toy.x,z:circus.toy.z});
  if(!livingRealm.claimed)options.push({name:livingRealm.id==='blackwake'?'OPEN THE ORIGINAL TREASURE CHEST':'CLAIM SECRET BOON',id:'LIVING_REWARD',kind:'livingreward',x:livingRealm.id==='blackwake'?BLACKWAKE_CHEST_WORLD.x:C,z:livingRealm.id==='blackwake'?BLACKWAKE_CHEST_WORLD.z:14});
  options.push({name:'RETURN TO YOUR RUN',id:'LIVING_EXIT',kind:'livingexit',x:C,z:livingExitZ()});
  return options.find(o=>Math.hypot(o.x-player.x,o.z-player.z)<2.2)||null;
 }
 if(blackwakeClueAvailable()){
  const marker=blackwakeClueSite(blackwake.step);
  if(marker&&Math.hypot(marker.x-player.x,marker.z-player.z)<2.2)
   return {name:'STUDY '+BLACKWAKE_CLUES[blackwake.step].name,id:'BLACKWAKE_CLUE',kind:'blackwakeclue',index:blackwake.step,...marker};
 }
 if(blackwake.state==='gate'&&blackwake.gate&&Math.hypot(blackwake.gate.x-player.x,blackwake.gate.z-player.z)<2.5)
  return {name:'ENTER BLACKWAKE COVE · SEA CAVE',id:'BLACKWAKE_GATE',kind:'blackwakegate',...blackwake.gate};
 const o=objective();return o&&o.kind!=='hellwave'&&o.kind!=='blockwave'&&Math.hypot(o.x-player.x,o.z-player.z)<=(o.kind==='hellgate'?2.75:o.kind==='heavengate'?2:o.kind==='heavenaltar'?2.2:1.7)?o:null}
function interactRequired(o){return o?.kind?.startsWith('circus')?1.2:o?.kind==='relay'?1.1:o?.kind==='hellgate'||o?.kind==='heavengate'?1.25:2.0;}
let wyrdfluxPortalGuardUntil=0;
const WYRDFLUX_AUTO_PORTALS=new Set(['blackwakegate','circusgate','circusexit','livinggate','livingexit','heavengate','hellgate']);
function tryInteract(dt){const o=interactTarget();
 if(o&&WYRDFLUX_AUTO_PORTALS.has(o.kind)){
   interactProgress=0;
   // Dimensional doorways are walked through; chests and altars still need E/X.
   if(time<wyrdfluxPortalGuardUntil||Math.hypot(o.x-player.x,o.z-player.z)>1.05)return;
   wyrdfluxPortalGuardUntil=time+2.2;
   if(o.kind==='blackwakegate'){wyrdfluxBeginRealmLoad('blackwake',()=>enterBlackwake(),'BLACKWAKE COVE');return;}
   if(o.kind==='circusgate'){wyrdfluxBeginRealmLoad('circus',()=>enterCircus(),'THE UNLISTED SHOW');return;}
   if(o.kind==='circusexit'){wyrdfluxBeginRealmLoad('meadow',()=>leaveCircus(),'RETURN TO YOUR RUN');return;}
   if(o.kind==='livinggate'){const id=livingRealm.pending;wyrdfluxBeginRealmLoad(id,()=>enterLivingRealm(id),LIVING_REALM_INFO[id]?.title||'HIDDEN REALM');return;}
   if(o.kind==='livingexit'){wyrdfluxBeginRealmLoad('meadow',()=>leaveLivingRealm(),'RETURN TO YOUR RUN');return;}
   if(o.kind==='heavengate'){wyrdfluxBeginRealmLoad('heaven',()=>{const ok=beginHeavenSanctum();if(ok)sound('upgrade');return ok;},'HEAVEN SANCTUM');return;}
   if(o.kind==='hellgate'){wyrdfluxBeginRealmLoad('hell',()=>{const ok=beginHellBreach();if(ok)sound('upgrade');return ok;},'THE BLACK CHAPEL');return;}
 }
 if(!o||!(inputs.interact||inputs.keys.has('e'))){interactProgress=Math.max(0,interactProgress-dt*2.6);return}
 interactProgress+=dt;const req=interactRequired(o);if(interactProgress<req)return;
 interactProgress=0;inputs.interact=false;
 if(o.kind==='blackwakeclue'){discoverBlackwakeClue(o.index);return;}
 if(o.kind==='blackwakegate'){enterBlackwake();return;}
 if(o.kind==='circustoy'){touchCircusToy();return;}
 if(o.kind==='circuslight'){touchCircusLight(o.index);return;}
 if(o.kind==='circusgate'){enterCircus();return;}
 if(o.kind==='circusprize'){claimCircusPrize();return;}
 if(o.kind==='circusexit'){leaveCircus();return;}
 if(o.kind==='livinggate'){enterLivingRealm(livingRealm.pending);return;}
 if(o.kind==='livingexit'){leaveLivingRealm();return;}
 if(o.kind==='livingreward'){claimLivingReward();return;}
 if(o.kind==='heavengate'){beginHeavenSanctum();sound('upgrade');return;}
 if(o.kind==='heavenaltar'){finishHeavenSanctum();sound('upgrade');return;}
 if(o.kind==='hellgate'){beginHellBreach();sound('upgrade');return;}
 if(o.kind==='relay'){relayState[o.id]=true;player.cash+=180;totalScore+=275;player.shield=Math.min(player.maxShield,player.shield+24);announce(o.id+' GRID REBOOTED',1.5);notice('GRID ONLINE +180 SALVAGE',2.4)}
 else {coreOnline=true;player.cash+=750;totalScore+=1200;player.hp=player.maxHp;player.shield=player.maxShield;player.energy=100;announce('POWER RESTORED',3);notice('CORE POWERED +750 // STAMINA RESTORED',3)}
 sound('upgrade');saveCheckpoint();updateHUD(true)
}
function jump(){if(phase!=='play'||bossCine.active||player.height>.012||player.energy<8)return false;player.verticalVel=5.7+stacks('leap')*.7;player.energy-=8;sound('upgrade');return true}
function updateObjectiveUI(){const o=objective();$('objectiveName').textContent=o?o.name:'GRID ONLINE // CITY POWER RESTORED';$('objectiveStatus').textContent=o?o.kind==='hellgate'?'WALK THROUGH THE RED GATE TO ENTER HELL':o.kind==='hellwave'?`DEMONS REMAIN ${enemies.length+spawnPending} · EXTRA DIFFICULTY`:o.kind==='blockwave'?`BLOCKWORLD HOSTILES ${enemies.length} · WARDEN IN TRIAL 3`:`${activeRelays()}/3 RELAYS ONLINE · ${Math.round(Math.hypot(o.x-player.x,o.z-player.z))}m TO TARGET`:'3/3 RELAYS · CORE RESTORED';if(o?.kind==='heavenaltar')$('objectiveStatus').textContent=heavenSanctum.guardianHostile&&!heavenSanctum.guardianDefeated?'DEFEAT HOSTILE JUDGE BEFORE USING ALTAR':'ACTIVATE GOLD ALTAR · CLAIM A PERMANENT BLESSING';
 if(o?.kind==='heavengate')$('objectiveStatus').textContent='WALK THROUGH THE PORTAL · ENTER HEAVEN SANCTUM';
 if(o?.kind==='livinggate')$('objectiveStatus').textContent='WALK INTO THE SECRET PORTAL · WITCH 3% / GREENHOUSE 2% / LIBRARY 1%';
 if(o?.kind==='livingreward')$('objectiveStatus').textContent='READ REALM GUIDE | FIND GLOWING ALTAR | HOLD E / CONTROLLER X FOR 2 SECONDS';
 if(o?.kind==='livingexit')$('objectiveStatus').textContent='WALK THROUGH THE EXIT PORTAL TO RESUME YOUR EXACT RUN';
 if(o?.kind==='relay')$('objectiveStatus').textContent='ACTIVATE · +180 SALVAGE AND +24 SHIELD';
 if(o?.kind==='core')$('objectiveStatus').textContent='ACTIVATE · FULL RESTORATION, STAMINA AND +750 SALVAGE';
 if(o?.kind==='circuslight')$('objectiveStatus').textContent=
   'THE TOY SANG: COLD MOON · GOLD CROWN · RED CURTAIN · '+circus.step+'/3';
 if(o?.kind==='circusgate')$('objectiveStatus').textContent='WALK THROUGH THE PORTAL · ENTER THE SECRET STAGE';
 if(o?.kind==='circusprize')$('objectiveStatus').textContent="CLAIM JESTER'S POPPER";
 if(o?.kind==='circusexit')$('objectiveStatus').textContent='WALK THROUGH THE EXIT PORTAL TO RETURN TO YOUR RUN';
 updateLivingRealmInstructions();
 let d=o?Math.atan2(o.x-player.x,-(o.z-player.z))-player.yaw:0;$('objectiveArrow').style.transform=`rotate(${d}rad)`;
 const target=interactTarget(),near=!!target;
 updateWyrdfluxInteractPrompt(target);
 $('hellSkipButton')?.classList.toggle('hidden',hellBreach.state!=='gate');
 $('interactButton').classList.toggle('hidden',!near||WYRDFLUX_AUTO_PORTALS.has(target?.kind));$('interactHint').textContent=near?(WYRDFLUX_AUTO_PORTALS.has(target?.kind)?'WALK THROUGH':'HOLD E / ACTIVATE'):'';
 $('interactFill').style.width=clamp(interactProgress/(interactRequired(target))*100,0,100)+'%';$('objectiveCard').classList.toggle('restored',!o)
}

function wyrdfluxPromptDetails(o){
 if(!o)return null;
 return o.kind==='relay'?'RESTORE '+o.name+' · +180 SALVAGE / +24 SHIELD':
  o.kind==='core'?'RESTORE CENTRAL CORE · FULL HEALTH + SHIELD / +750 SALVAGE / FULL STAMINA':
  o.kind==='circustoy'?'WIND THE TOY · READ THE RHYME':
   o.kind==='circuslight'?'ACTIVATE '+o.name:
   o.kind==='circusgate'?'ENTER THE UNLISTED SHOW':
   o.kind==='circusprize'?"CLAIM JESTER'S POPPER · UNIQUE CIRCUS GUN":
   o.kind==='circusexit'?'RETURN TO YOUR ORIGINAL RUN':
   o.kind==='livinggate'?'ENTER '+LIVING_REALM_INFO[livingRealm.pending].title+' · SECRET REWARD':
  o.kind==='livingreward'?(livingRealm.id==='witch'?'WITCH ALTAR · CHOOSE A BLESSING OR CURSE':
   livingRealm.id==='greenhouse'?'GREEN ALTAR · FULL HEAL + ARMOR / LIVING ROOTS (NO FIRE)':
   'ARCHIVE ALTAR · 200 ECLIPSE CATALYST SHOTS'):
  o.kind==='livingexit'?'EXIT PORTAL · RETURN TO YOUR EXACT RUN':
  o.kind==='heavengate'?'ENTER HEAVEN · RARE PERMANENT BLESSINGS':
  o.kind==='heavenaltar'?'CLAIM CELESTIAL ALTAR · PERMANENT PASSIVE':
  o.kind==='hellgate'?'ENTER HELL · THREE-STAGE BONUS CHALLENGE':
  'ACTIVATE '+o.name;
}
function updateWyrdfluxInteractPrompt(target){
 if(!desktopPC)return;
 let el=document.getElementById('wyrdfluxInteractionPrompt');
 if(!el){el=document.createElement('aside');el.id='wyrdfluxInteractionPrompt';
  el.setAttribute('role','status');el.setAttribute('aria-live','off');document.body.appendChild(el);}
 const visible=phase==='play'&&!!target&&!puppetFinale.active;
 el.classList.toggle('hidden',!visible);
 if(!visible)return;
 const label=WYRDFLUX_AUTO_PORTALS.has(target.kind)?'WALK THROUGH PORTAL · '+wyrdfluxPromptDetails(target):'HOLD E / CONTROLLER X · '+interactRequired(target).toFixed(1)+'s · '+wyrdfluxPromptDetails(target);
 if(el.dataset.label!==label){el.textContent=label;el.dataset.label=label;}
 el.style.setProperty('--hold-progress',WYRDFLUX_AUTO_PORTALS.has(target.kind)?'0%':(100*clamp(interactProgress/interactRequired(target),0,1)).toFixed(1)+'%');
}
// WYRDFLUX title-side stat rails use the real saved run, or the actual
// fresh player loadout if there is no Continue run. No invented placeholders.
// On the desktop, detailed stats belong to the PAUSE screen, not the title.
// Use the actual live player/current gun so values cannot silently fall behind.
function refreshWyrdfluxPauseStats(){
 if(!desktopPC||!player)return;
 const sheet=$('pauseScreen')?.querySelector('.sheet')||$('pauseScreen');
 if(!sheet)return;
 // Old builds appended floating rails to the title. Remove any orphan DOM.
 $('mainMenu')?.querySelectorAll('.wyrdfluxMenuStatRail')
  .forEach(panel=>panel.remove());
 let dashboard=document.getElementById('wyrdfluxPauseStatDashboard');
 if(!dashboard){
  dashboard=document.createElement('section');
  dashboard.id='wyrdfluxPauseStatDashboard';
  dashboard.className='wyrdfluxPauseStatDashboard';
  dashboard.setAttribute('aria-label','Live player statistics for the current run');
  const heading=document.createElement('h3');
  heading.textContent='CURRENT RUN · CHARACTER STATISTICS';
  dashboard.appendChild(heading);
  const grid=document.createElement('div');grid.className='wyrdfluxPauseStatGrid';
  dashboard.appendChild(grid);
  const inventory=document.getElementById('wyrdfluxRunInventory');
  if(inventory?.parentElement===sheet)sheet.insertBefore(dashboard,inventory);
  else sheet.appendChild(dashboard);
 }
 const weapon=WEAPONS[gun]||WEAPONS[0],perks=player.perks||{};
 const damage=Math.max(0,(weapon.dmg||0)*(player.damageMult||1));
 const attackSpeed=Math.max(0,(player.speedMult||1)/Math.max(.075,weapon.rate||1));
 const crit=Math.min(65,Math.max(0,7+(perks.crit||0)*9.5));
 const move=Math.max(0,(player.moveMult||1)*100);
 const rank=Math.max(1,runLevel.rank||1);
 const stats=[
  ['DAMAGE',damage.toFixed(1),'Current shot damage',Math.min(100,damage*.55)],
  ['ATTACK SPEED',attackSpeed.toFixed(2)+'/s','Shots every second',Math.min(100,attackSpeed*15)],
  ['MOVE SPEED',move.toFixed(0)+'%','Running pace',Math.min(100,move*.65)],
  ['CRIT CHANCE',crit.toFixed(1)+'%','Perk-dependent chance',Math.min(100,crit*1.5)],
  ['HEALTH',Math.ceil(player.hp||0)+' / '+Math.ceil(player.maxHp||0),'Current hit points',100*(player.hp||0)/Math.max(1,player.maxHp||1)],
  ['SHIELD',Math.ceil(player.shield||0)+' / '+Math.ceil(player.maxShield||0),'Current protection',100*(player.shield||0)/Math.max(1,player.maxShield||1)],
  ['DASH COOLDOWN',(3.1*(player.dashMult||1)).toFixed(2)+'s','Time between dashes',Math.min(100,100/(player.dashMult||1)/1.4)],
  ['RUN LEVEL',String(rank),'Uncapped progression',Math.min(100,rank*4)]
 ];
 const grid=dashboard.querySelector('.wyrdfluxPauseStatGrid');
 grid.replaceChildren();
 for(const side of ['left','right']){
  const panel=document.createElement('section');
  panel.className='wyrdfluxMenuStatRail wyrdfluxMenuStatRail-'+side;
  panel.setAttribute('aria-label',side==='left'?'Offense and mobility':'Survival and progression');
  const header=document.createElement('div');header.className='wyrdfluxMenuStatHeader';
  header.textContent=side==='left'?'OFFENSE · MOBILITY':'SURVIVAL · PROGRESSION';
  const context=document.createElement('div');context.className='wyrdfluxMenuStatContext';
  context.textContent=side==='left'?weapon.name:'CYCLE '+cycleOf(wave)+' · WAVE '+localWaveOf(wave);
  panel.append(header,context);
  for(const [name,value,description,power] of stats.slice(side==='left'?0:4,side==='left'?4:8)){
   const row=document.createElement('div');row.className='wyrdfluxMenuStatRow';
   row.title=description;
   const line=document.createElement('div');line.className='wyrdfluxMenuStatText';
   const label=document.createElement('span');label.textContent=name;
   const num=document.createElement('strong');num.textContent=value;
   line.append(label,num);
   const bar=document.createElement('div');bar.className='wyrdfluxMenuStatBar';
   const fill=document.createElement('i');fill.style.width=clamp(power,0,100)+'%';
   bar.appendChild(fill);row.append(line,bar);panel.appendChild(row);
  }
  grid.appendChild(panel);
 }
}
const screens=['cinematicIntro','mainMenu','upgradeScreen','pauseScreen','endScreen','archiveScreen','loading'];function showScreen(id){
 for(let s of screens)$(s).classList.toggle('hidden',s!==id);
 if(id==='pauseScreen')refreshWyrdfluxPauseStats();
 if(id==='mainMenu')$('mainMenu')?.querySelectorAll('.wyrdfluxMenuStatRail').forEach(x=>x.remove());
 // Locking the cursor while firing is correct; keeping it locked over
 // the upgrade/pause/weapon menus makes PC controls unusable.
 if(id&&window.AFTERLIGHT_DESKTOP?.enabled)document.exitPointerLock?.();
 // Pause decoder while in gameplay; resume at the exact frame when returning
 // to the treasure screen. Browsers may block autoplay, so keep PNG fallback.
 const orbit=document.getElementById('wyrdfluxTreasureOrbit');
 if(orbit){
  const menu=$('mainMenu');
  if(id==='mainMenu'){
   orbit.play().catch(()=>{});
   if(orbit.readyState>=2)requestAnimationFrame(()=>{
    if(!menu.classList.contains('hidden'))menu.classList.add('wyrdfluxOrbitReady');
   });
  }else{
   menu?.classList.remove('wyrdfluxOrbitReady');
   orbit.pause();
  }
 }
}

// THE UNWRITTEN: WYRDFLUX's original, in-engine reality-fracture opening.
// A floating shard monolith opens portals to meadow, inferno and blockworld,
// summons two hunters, collapses, and hands the player the first wave.
const INTRO_CHAPTERS=[
 {at:0,shot:'fracture',serial:'WYRDFLUX // 01',title:'REALITY DID NOT END. IT SPLINTERED.'},
 {at:3.15,shot:'bleed',serial:'WYRDFLUX // 02',title:'THREE WORLDS. ONE IMPOSSIBLE SKY.'},
 {at:6.45,shot:'hunted',serial:'WYRDFLUX // 03',title:'EVERY REALITY HAS ITS HUNTERS.'},
 {at:9.65,shot:'collapse',serial:'WYRDFLUX // 04',title:'THE FRACTURE IS CLOSING.'},
 {at:12.1,shot:'title',serial:'WYRDFLUX // 05',title:'SURVIVE THE IMPOSSIBLE.'}
];
function cinematicEase(t){const x=clamp(t,0,1);return x*x*(3-2*x)}
function cineLerp(a,b,t){return a+(b-a)*cinematicEase(t)}
function cinematicCamera(){
 const t=introCine.clock,lerp=(a,b,k)=>({x:cineLerp(a[0],b[0],k),
  y:cineLerp(a[1],b[1],k),z:cineLerp(a[2],b[2],k)});
 let point,target;
 if(t<3.15){const k=t/3.15;
  point=lerp([C-2.3,.8,C+5.4],[C-4,2.1,C+8.5],k);
  target=lerp([C,2.0,C],[C,4.5,C],k);
 }else if(t<6.45){const k=(t-3.15)/3.3;
  point=lerp([C-8,4.4,C+7],[C+6.8,6.8,C+5.0],k);
  target=lerp([C-1,3.3,C],[C+1.8,3.0,C-.5],k);
 }else if(t<9.65){const k=(t-6.45)/3.2;
  point=lerp([C+6.8,3.4,C+8.2],[C+1.6,2.0,C+4.4],k);
  target=lerp([C-1,2.8,C],[C+.8,2.1,C],k);
 }else if(t<12.1){const k=(t-9.65)/2.45;
  point=lerp([C+.9,2.0,C+4.4],[C,10.5,C+15.8],k);
  target=lerp([C,3.2,C],[C,2.0,C],k);
 }else{const k=(t-12.1)/3.5;
  point=lerp([C,10.5,C+15.8],[C-1.8,11.7,C+18.4],k);
  target={x:C,y:3.3+.9*k,z:C};
 }
 const quake=t>9.65&&t<10.7?.17*(1-(t-9.65)/1.05)*Math.sin(t*31):0;
 return {x:point.x+quake,y:point.y+.065*Math.sin(t*1.4),z:point.z,
  target,roll:0};
}
function cinematicRobot(type,x,z,facing,bob,id){
 return {type,id,x,z,facing,bob,hit:0,hp:180,maxHp:180,boss:false,
  moveSpeed:1.6,attackT:0,meleeStage:'seek',meleeT:0,meleeTotal:.45,
  rangedStage:'idle',rangedT:0,rangedTotal:1,ultimateStage:'idle',
  ultimateT:0,slowUntil:0,stunUntil:0,vulnUntil:0};
}
function drawOpeningActors(m,quality,cam){
 const t=introCine.clock,energy=clamp(t/9.65,0,1);
 introCine.actorCount=0;
 // Render-only shards have zero impact on progression or collisions.
 const n=quality==='battery'?9:quality==='balanced'?16:24;
 m.box(C,2.6,C,1.18,2.8,1.18,'dark',.35+energy*.28,t*.06);
 m.box(C,3,C,.25,3.6,.25,'purple',1.8+energy*.65,t*.13);
 for(let i=0;i<n;i++){
  const a=i*2.399963+t*(.12+energy*.3);
  const r=1.65+(i%4)*.55+energy*.7;
  const y=1.1+(i%7)*.65+Math.sin(t*1.6+i)*.16;
  const spin=t*(i%2?.3:-.26)+i;
  m.box(C+Math.cos(a)*r,y,C+Math.sin(a)*r,
   .12+(i%3)*.055,.28+(i%4)*.09,.10,
   i%6===0?'cyan':i%4===0?'purple':'metal2',.26,spin);
 }
 if(t>=2.4){
  const gates=[{x:C-5,z:C-1,c:'green'},{x:C+4.6,z:C-2.5,c:'red'},
   {x:C+.2,z:C+5,c:'cyan'}];
  for(let g=0;g<3;g++){
   const gate=gates[g],fade=clamp((t-2.4-g*.30)/.70,0,1);
   const segments=g===2?4:10;
   for(let i=0;i<segments;i++){
    const a=TAU*i/segments,b=TAU*(i+1)/segments,r=1.8;
    const pt=ang=>g===2?
     {x:gate.x+Math.sign(Math.cos(ang))*r*.8,y:3+Math.sign(Math.sin(ang))*r}:
     {x:gate.x+Math.cos(ang)*r*.77,y:3+Math.sin(ang)*r};
    const p=pt(a),q=pt(b);
    m.beam(p.x,p.y,gate.z,q.x,q.y,gate.z,.08,gate.c,1.55*fade);
   }
   for(let i=0;i<(quality==='battery'?3:7);i++){
    const a=i*TAU/7+t*(g===1?-.95:.55),r=.6+.17*Math.sin(t*2+i);
    m.box(gate.x+Math.cos(a)*r,3+Math.sin(a)*r,gate.z+.08,
     .065,.09,.05,i%2?'white':gate.c,fade*.85);
   }
  }
 }
 if(t>=6.25&&t<11.25){
  const predator=cinematicRobot('stalker',C-2.2+Math.sin(t*1.1)*.45,
   C+1.9,Math.PI*.45,time*4,-910);
  const sentinel=cinematicRobot('skitter',C+2.2,C+1.1+Math.cos(t)*.55,
   -Math.PI*.4,time*5,-911);
  addRobot(m,predator);addRobot(m,sentinel);introCine.actorCount+=2;
 }
 if(t>=9.65){
  const collapse=clamp((t-9.65)/2.45,0,1),rings=quality==='battery'?7:12;
  for(let i=0;i<rings;i++){
   const a=i*TAU/rings+t*.85,r=.9+collapse*8;
   m.beam(C+Math.cos(a)*r,3.2,C+Math.sin(a)*r,
    C+Math.cos(a+TAU/rings)*r,3.2+.15*Math.sin(t*8+i),
    C+Math.sin(a+TAU/rings)*r,.055,i%3===0?'white':'purple',1.3*(1-collapse*.55));
  }
  if(t<12.1)m.box(C,3,C,1.8+collapse*2.6,1.2+collapse*2,1.8+collapse*2.6,
   'white',.3+collapse*1.5);
 }
}
function updateOpeningScene(){
 const t=introCine.clock;
 let current=INTRO_CHAPTERS[0];
 for(const chapter of INTRO_CHAPTERS)if(t>=chapter.at)current=chapter;
 if(current.shot!==introCine.shot){
  introCine.shot=current.shot;
  const screen=$('cinematicIntro');
  screen.dataset.shot=current.shot;
  const caption=$('cinemaCaption');
  caption.querySelector('small').textContent=current.serial;
  caption.querySelector('strong').textContent=current.title;
  introCine.lastCaption=current.title;
  cinematicStinger(current.shot);
 }
 introCine.flash=t>=10.75&&t<11.6?Math.max(0,(1-(t-10.75)/.85))*.86:0;
 $('cinematicIntro').style.setProperty('--cineflash',String(introCine.flash));
 $('cinematicIntro').style.setProperty('--cine-progress',(clamp(t/introCine.duration,0,1)*100).toFixed(1)+'%');
 if(t>=introCine.duration)finishOpening(false);
}
function startOpening(replay=false,forWave=false){
 if((phase==='play'&&!forWave)||phase==='pause'||phase==='upgrade')return false;
 introCine.forWave=!!forWave;
 document.body.classList.remove('afterlight-intro-finished');
 introCine.active=true;introCine.shown=true;introCine.clock=0;introCine.actorCount=0;
 introCine.shot='';introCine.flash=0;
 if(replay)introCine.replayCount++;
 phase='cinematic';showScreen('cinematicIntro');overlayPlay(false);
 $('cinematicIntro').dataset.shot='fracture';
 $('cinemaAudio').classList.toggle('hidden',audioUnlocked||muted);
 updateOpeningScene();
 return true;
}

/** PC launch overview uses actual current checkpoint and meta records.
 * Pure DOM textContent avoids injecting saved data as HTML. The run inventory
 * is always visible at startup and updates on every return to title. */
function refreshAfterlightPcCollection(){
 if(!desktopPC)return;
 const menu=$('mainMenu')?.querySelector('.menuInner');
 if(!menu)return;
 let box=document.getElementById('afterlightPcCollection');
 if(!box){
  box=document.createElement('section');box.id='afterlightPcCollection';
  box.setAttribute('aria-label','Current run collection and upgrades');
  const actions=menu.querySelector('.menuActions');
  (menu.querySelector('#wyrdfluxMenuTestRow')||actions)?.insertAdjacentElement('afterend',box);
 }
 let record=null;
 try{record=JSON.parse(localStorage.getItem('su2-save')||'null')}catch(_){}
 const equipped=Array.isArray(record?.activeGun)?
  record.activeGun.flatMap((on,i)=>on&&WEAPONS[i]?[WEAPONS[i].name]:[]):[];
 const perks=Object.entries(record?.player?.perks||{}).filter(([,amount])=>
  Number.isFinite(Number(amount))&&Number(amount)>0).map(([id,amount])=>{
   const item=UPGRADES.find(x=>x.id===id);
   return (item?.name||id)+' ×'+Math.floor(Number(amount));
  });
 const savedPassives=Object.entries(meta.passiveStacks||{}).filter(([,n])=>n>0).map(([id,n])=>{
  const passive=PASSIVES.find(x=>x.id===id);
  return (passive?.name||id)+' ×'+n;
 });
 const permanentCount=Object.keys(meta.unlocked||{}).filter(key=>meta.unlocked[key]).length;
 box.replaceChildren();
 const headline=document.createElement('div');headline.className='afterlightPcCollectionTop';
 const name=document.createElement('strong');name.textContent='CURRENT COLLECTION';
 const stage=document.createElement('small');stage.textContent=record?.wave>0?
  'WAVE '+String(record.wave).padStart(2,'0')+' · '+equipped.length+' GUNS · '+perks.length+' UPGRADES':
  'NO SAVED RUN · '+permanentCount+' CAREER BLUEPRINTS';
 headline.append(name,stage);box.append(headline);
 const grid=document.createElement('div');grid.className='afterlightPcCollectionGrid';
 const addPanel=(label,entries,empty)=>{
  // Keep all three collections folded on title. Expanding is deliberate,
  // not an automatic nested scrolling area hiding the treasure scene.
  const part=document.createElement('details');
  part.className='wyrdfluxCollectionCard';
  const heading=document.createElement('summary');
  const headingLabel=document.createElement('strong');
  headingLabel.textContent=label+' ('+entries.length+')';
  const headingPreview=document.createElement('small');
  headingPreview.textContent=entries.length?
   entries.slice(0,1).join(' · ')+(entries.length>1?' · +'+(entries.length-1):''):empty;
  heading.append(headingLabel,headingPreview);
  part.append(heading);
  const group=document.createElement('div');group.className='afterlightPcCollectionItems';
  const names=entries.length?entries:[empty];
  for(const item of names){
   const chip=document.createElement('span');chip.textContent=item;
   chip.className=entries.length?'collectedItem':'emptyItem';
   const collectible=WEAPONS.find(w=>w.name===item);
   if(collectible?.rarity&&collectible.rarity!=='common'){
    chip.classList.add('rarity-'+collectible.rarity,'wyrdflux-rare-label');
    chip.dataset.echo=item;
   }
   group.appendChild(chip);
  }
  part.append(group);grid.appendChild(part);
 };
 addPanel('RUN WEAPONS',equipped,'Start or resume a run to collect weapons');
 addPanel('RUN UPGRADES',perks,'No augment collected yet');
 addPanel('PERMANENT PASSIVES',savedPassives,'No permanent world passives yet');
 box.append(grid);
}


function wyrdfluxReadableText(value){
 return String(value).replace(/sector[\s-]+uprising(?:[\s-]+(?:ii|2))?|afterlight/gi,'WYRDFLUX')
  .split('//').join(' · ').replace(/\s{2,}/g,' ').trim();
}
function brandWyrdfluxUI(){
 document.title='WYRDFLUX';
 // Player-facing text only: storage keys, Android package and bridge IDs
 // are intentionally retained for existing installed saves.
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let n;const nodes=[];
 while((n=walker.nextNode())){
  if(n.parentElement?.closest('script,style,textarea'))continue;
  if(/sector[\s-]+uprising|afterlight/i.test(n.nodeValue))nodes.push(n);
 }
 for(const node of nodes)node.nodeValue=wyrdfluxReadableText(node.nodeValue);
 for(const el of document.body.querySelectorAll('[title],[aria-label],[placeholder]')){
  for(const attr of ['title','aria-label','placeholder']){
   if(el.hasAttribute(attr)&&/sector[\s-]+uprising|afterlight/i.test(el.getAttribute(attr)))
    el.setAttribute(attr,wyrdfluxReadableText(el.getAttribute(attr)));
  }
 }
 const logo=$('cinemaLogo');
 if(logo){
  const strong=logo.querySelector('strong');
  if(strong){const accent=document.createElement('em');accent.textContent='FLUX';
   strong.replaceChildren(document.createTextNode('WYRD'),accent);}
  const small=logo.querySelector('small');if(small)small.textContent='THE UNWRITTEN · THE FRACTURED WORLDS';
  const subtitle=logo.querySelector('span');if(subtitle)subtitle.textContent='SURVIVE THE IMPOSSIBLE';
 }
}
function installWyrdfluxTreasureMenu(){
 if(!desktopPC)return;
 const menu=$('mainMenu');
 if(!menu)return;
 menu.querySelectorAll('.wyrdfluxMenuStatRail').forEach(x=>x.remove());
 menu.classList.add('wyrdfluxTreasureMenu');
 // Genuinely Blender-rendered orbiting camera sequence, not scrolling a still
 // photo or a GPU-heavy second game scene. The PNG remains a safe fallback.
 if(!document.getElementById('wyrdfluxTreasureOrbit')){
  const movie=document.createElement('video');
  movie.id='wyrdfluxTreasureOrbit';
  movie.src='desktop/assets/menu/wyrdflux-treasure-orbit.mp4';
  movie.poster='desktop/assets/menu/wyrdflux-treasure-menu.png';
  movie.autoplay=true;movie.loop=true;movie.muted=true;
  movie.playsInline=true;movie.preload='auto';
  movie.setAttribute('aria-hidden','true');
  movie.setAttribute('disablepictureinpicture','');
  movie.tabIndex=-1;
  const reveal=()=>{
   if(movie.readyState<2||!movie.videoWidth||menu.classList.contains('hidden'))return;
   requestAnimationFrame(()=>{
    if(!menu.classList.contains('hidden'))menu.classList.add('wyrdfluxOrbitReady');
   });
  };
  movie.addEventListener('loadeddata',reveal);
  movie.addEventListener('playing',reveal);
  movie.addEventListener('error',()=>{
   menu.classList.remove('wyrdfluxOrbitReady');movie.remove();
  },{once:true});
  menu.insertBefore(movie,menu.firstChild);
 }
 const title=menu.querySelector('.menuInner h1');
 if(title){title.textContent='WYRDFLUX';title.classList.add('wyrdfluxDualTitle');
  title.dataset.echo='WYRDFLUX';}
 const eyebrow=menu.querySelector('.eyebrow');
 if(eyebrow)eyebrow.textContent='THE TREASURY // BEYOND THE BROKEN WORLDS';
 const subtitle=menu.querySelector('.subtitle');
 if(subtitle)subtitle.textContent='HUNT · COMBINE · ASCEND';
 const intro=menu.querySelector('.intro');
 if(intro)intro.textContent='Slay to level up. Chain kills for bonus XP, unlock wild guns and fuse their effects. Every world is a new chance.';
 const start=$('startButton');
 if(start)start.textContent='START NEW RUN  ›';
 const resume=$('continueButton');
 if(resume)resume.textContent='CONTINUE RUN';
 const archive=$('archiveButton');
 if(archive)archive.textContent='WEAPONS & PASSIVES';
 const test=$('testLabButton');
 if(test){
   test.textContent='TEST REALMS';
   if(!location.hash.includes('qa')){
    test.classList.add('hidden');test.setAttribute('aria-hidden','true');test.tabIndex=-1;
    $('testLabPanel')?.classList.add('hidden');
   }
  }
 // Put testing in one intentional compact row, instead of leaving a second
 // full-height button below a nested collection scrollbar.
 const actions=menu.querySelector('.menuActions');
 if(actions&&test&&!$('wyrdfluxMenuTestRow')&&location.hash.includes('qa')){
  const quick=document.createElement('div');
  quick.id='wyrdfluxMenuTestRow';quick.className='wyrdfluxMenuTestRow';
  actions.insertAdjacentElement('afterend',quick);
  test.classList.add('wyrdfluxLabMenuButton');
  quick.appendChild(test);
  const circusBtn=document.createElement('button');
  circusBtn.id='wyrdfluxCircusTestButton';
  circusBtn.type='button';circusBtn.className='wyrdfluxCircusTestButton';
  circusBtn.textContent='CIRCUS REALM · TEST';
  circusBtn.setAttribute('aria-label','Enter the Circus Realm test. No campaign progress is saved.');
  circusBtn.title='TEST ONLY · No saved career changes or rare encounter requirement';
  circusBtn.addEventListener('click',()=>{
   if(phase!=='menu')return;
   unlockSoundtrack();trialStart('circus');
  });
  quick.appendChild(circusBtn);
 }
 const labPanel=$('testLabPanel');
 if(labPanel&&!$('wyrdfluxCloseTestLab')){
  const close=document.createElement('button');
  close.id='wyrdfluxCloseTestLab';close.type='button';
  close.className='wyrdfluxCloseTestLab secondary';
  close.textContent='CLOSE TEST REALMS';
  close.addEventListener('click',()=>{
   labPanel.classList.add('hidden');
   test?.setAttribute('aria-expanded','false');
   test?.focus({preventScroll:true});
  });
  labPanel.appendChild(close);
 }
 const replay=$('replayIntroButton');
 if(replay)replay.remove(); // Intro occurs automatically before the main menu.
 const footer=menu.querySelector('.menuFoot span');
 if(footer)footer.textContent='WYRDFLUX · PC EDITION';
  // Player-facing retail patch label, independent of internal build/source versions.
  if(!$('wyrdfluxPatchNumber')){
   const patch=document.createElement('div');patch.id='wyrdfluxPatchNumber';
   patch.setAttribute('aria-label','Patch number 0.01');
   patch.textContent='PATCH 0.01';menu.appendChild(patch);
  }
  if(!location.hash.includes('qa')){
   menu.classList.add('wyrdfluxRetailMenu');
   for(const b of menu.querySelectorAll('button')){
    if(/^test/i.test(b.id)||/\bTEST(?:ING)?\b/i.test(b.textContent||'')){
     b.classList.add('hidden');b.tabIndex=-1;b.setAttribute('aria-hidden','true');
    }
   }
  }
}


/* PC title-flow: do not autoplay a long intro when the EXE starts.
 * Show native loading then the gold-chest menu. First deployment plays the
 * existing cinematic after the level is prepared, immediately before wave 1.
 * Continue resumes directly to saved combat, without interrupting saves. */
let wyrdfluxStartTicket=0,wyrdfluxMenuGuardUntil=0;
function showWyrdfluxLoading(label='PREPARING THE WYRDFLUX WORLD'){
 showScreen('loading');overlayPlay(false);
 const title=$('loading')?.querySelector('h2');if(title)title.textContent='WYRDFLUX';
 const sub=$('loadingText');if(sub)sub.textContent=label;
 const bar=$('loadProgress');if(bar)bar.style.width='34%';
}
function showWyrdfluxTitle(){
 phase='menu';introCine.active=false;introCine.forWave=false;
 // New Run owns the cinematic after the title menu. Never offer a duplicate replay.
 if(desktopPC)$('replayIntroButton')?.remove();
 showScreen('mainMenu');overlayPlay(false);
 document.body.classList.add('afterlight-intro-finished');
 brandWyrdfluxUI();refreshAfterlightPcCollection();checkCheckpoint();
 const bar=$('loadProgress');if(bar)bar.style.width='100%';
}
function bootWyrdfluxMenu(){
 if(!desktopPC){startOpening(false);return;}
 showWyrdfluxLoading('PREPARING TREASURE CAVE · WAKING THE RENDERER');
 requestAnimationFrame(()=>{
  const bar=$('loadProgress');if(bar)bar.style.width='82%';
  setTimeout(()=>showWyrdfluxTitle(),300);
 });
}
function startWyrdfluxRun(resume=false){
 if(!desktopPC){startGame(resume);return;}
 if((phase!=='menu'&&phase!=='dead')||performance.now()<wyrdfluxMenuGuardUntil)return;
 const ticket=++wyrdfluxStartTicket;
 phase='loading';showWyrdfluxLoading(resume?'RESTORING CHECKPOINT · LOADING WORLD':'FORGING WORLD · PREPARING WAVE ONE');
 setTimeout(()=>{
  if(ticket!==wyrdfluxStartTicket||phase!=='loading')return;
  startGame(resume);
  if(!resume)startOpening(false,true);
  else{showScreen(null);overlayPlay(true);}
 },500);
}

function finishOpening(skipped=false){
 if(!introCine.active)return false;
 const intoRun=!!introCine.forWave;
 introCine.active=false;introCine.forWave=false;
 if(skipped)introCine.skipCount++;
 if(intoRun){
  // The cinematic follows Start New Run, not app launch. Enter wave one at
  // its natural first frame and never restart or erase a pending career run.
  phase='play';$('cinematicIntro').style.setProperty('--cineflash','0');
  showScreen(null);overlayPlay(true);world.focus();
  announce('WAVE '+String(localWaveOf(wave)).padStart(2,'0')+' // '+SECTORS[sector],2.3);
  saveCheckpoint();return true;
 }
 phase='menu';
 $('cinematicIntro').style.setProperty('--cineflash','0');
 showScreen('mainMenu');overlayPlay(false);
 document.body.classList.add('afterlight-intro-finished');
 $('mainMenu').classList.remove('menu-arrive');
 // Restart CSS entrance without reloading or destroying a saved run.
 void $('mainMenu').offsetHeight;
 $('mainMenu').classList.add('menu-arrive');
 refreshAfterlightPcCollection();
 return true;
}
function overlayPlay(on){if(!on){inputs.shoot=false;inputs.fire=null;}$('combatScan').classList.toggle('hidden',!on);$('hud').classList.toggle('hidden',!on);$('aim').classList.toggle('hidden',!on);$('weaponHud').classList.toggle('hidden',!on);$('touchUI').classList.toggle('hidden',!on||!touch);$('objectiveCard').classList.toggle('hidden',!on)}
const desktopPC=!!window.AFTERLIGHT_DESKTOP?.enabled;
let touch=!desktopPC&&(navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad/i.test(navigator.userAgent));

function afterlightWorldLoading(title='ENTERING THE MEADOW'){
 const prev=document.getElementById('afterlightWorldLoading');
 if(prev)prev.remove();
 const veil=document.createElement('section');veil.id='afterlightWorldLoading';
 veil.setAttribute('role','status');veil.setAttribute('aria-live','polite');
 veil.innerHTML='<div><div class="worldload-title">✦ '+title+'</div>'+
  '<p class="worldload-detail" id="worldloadDetail">AWAKENING THE FIELD · PREPARING 3D WORLD</p>'+
  '<div class="worldload-track"><span id="worldloadFill"></span></div></div>';
 document.body.appendChild(veil);
 const start=performance.now(),target=title;
 function tickLoad(){
  if(!veil.isConnected||phase!=='play'||testLabMode!=='meadow'){veil.remove();return;}
  const state=window.VEILFORGE_MEADOW_GPU?.state;
  const elapsed=performance.now()-start;
  const ready=state?.status==='ready'&&state?.monster==='ready';
  const fallback=state?.status==='fallback'||state?.monster==='fallback';
  const width=ready?100:fallback?100:Math.min(90,Math.round(12+elapsed/100));
  const bar=veil.querySelector('#worldloadFill');if(bar)bar.style.width=width+'%';
  const detail=veil.querySelector('#worldloadDetail');
  if(detail)detail.textContent=ready?'FIELD READY · ALL 3D MODELS LOADED':
   fallback?'COMPATIBILITY MODE · ENTERING THE FIELD':
   state?.status==='ready'?'ANIMATING CREATURES · FINISHING TEXTURES':
   'AWAKENING THE FIELD · PREPARING 3D WORLD';
  if((ready||fallback||elapsed>12500)&&elapsed>500){
   veil.style.opacity='0';veil.style.pointerEvents='none';
   setTimeout(()=>veil.remove(),440);return;
  }
  requestAnimationFrame(tickLoad);
 }
 requestAnimationFrame(tickLoad);
}


// PC Patch 0.04: six actual, independent 16:9 scene artworks. They are loaded
// from packaged files, not a composite atlas or synthetic progress animation.
const WYRDFLUX_PC_LOADING_ART=Object.freeze({
 blackwake:'engine/assets/loading/blackwake.jpg',
 heaven:'engine/assets/loading/heaven.jpg',
 meadow:'engine/assets/loading/meadow.jpg',
 hell:'engine/assets/loading/hell.jpg',
 blockworld:'engine/assets/loading/blockworld.jpg',
 circus:'engine/assets/loading/circus.jpg'
});
const WYRDFLUX_PC_CURATED_LOADING_TIPS=["PC: Use W, A, S and D to navigate a fight while keeping your aim on threats.","PC: Q triggers a stamina-consuming dash when it is ready.","PC: A deliberate dash costs stamina; keep enough reserve to escape danger.","PC: Controller left stick moves the player; right stick controls the view.","PC: Controller A jumps during gameplay.","PC: Controller B dashes during gameplay.","PC: Controller X activates chests, altars and other deliberate interactions.","PC: Controller L3 toggles sprint; stick tilt alone does not enable it.","PC: Controller triggers provide the regular firing and focus controls.","PC: On menus, controller A confirms the highlighted choice.","PC: D-pad navigation moves between available menu options.","PC: The right stick can scroll overflowing inventory and upgrade screens.","PC: LB and RB cycle weapons without opening the inventory.","PC: Watch the pistol recoil after every shot; it moves the view as well as the gun.","PC: You cannot fire indefinitely: each equipped weapon accumulates heat.","PC: The temperature bar above weapon selection shows how hot your gun is.","PC: Repeated firing builds heat faster than careful bursts.","PC: Allow an overheated weapon time to vent before attacking again.","PC: Switching guns does not remove the heat stored in the first gun.","PC: Every gun has its own firing rate, spread, damage and projectile profile.","PC: The starter FLUXSIDE pistol is a full progression path, not disposable equipment.","PC: FLUXSIDE can fuse with a Legendary or Mythic weapon, but not an ordinary shop gun.","PC: Two compatible Legendary pistol combinations can be forged again.","PC: Forging permanently consumes both ingredients and equips one new weapon.","PC: A fused gun keeps the special traits inherited from its components.","PC: Look at a weapon's rarity as well as its raw damage before forging.","PC: A slow, hard-hitting railgun can be safer than spraying into the distance.","PC: Shotgun spreads reward careful distance and target positioning.","PC: Splash weapons can catch multiple clustered hostiles with one shot.","PC: Chain-lightning upgrades are strongest when enemies stay close together.","PC: Freeze effects can buy time against fast-moving enemies.","PC: Fire effects reward repeat pressure on dangerous targets.","PC: Gravity effects help gather enemies for splash or piercing damage.","PC: Piercing effects can punish enemies standing in a line.","PC: Recovering shields after a hit is safer than letting the health bar empty.","PC: Health and shields have different recovery rules; watch them separately.","PC: Many upgrades are stackable, but specialized pistol upgrades may be one-time.","PC: The pistol's TWIN CHAMBER adds another bullet per trigger pull.","PC: IRON FAN adds a spread of four more rounds to the pistol.","PC: LANCER BORE lets pistol rounds pierce enemies standing behind the target.","PC: BLOOM IMPACT turns a pistol strike into an area burst.","PC: GHOST BANKSHOT can turn a pistol hit into a nearby ricochet.","PC: STORM CYLINDER adds arcing lightning to pistol impacts.","PC: CINDER BRAND adds burning damage to pistol hits.","PC: WINTER SEAL can freeze targets you strike with the pistol.","PC: GRAVITY WRENCH draws nearby hostiles toward pistol impacts.","PC: BREACH ROUNDS opens a target to stronger follow-up attacks.","PC: BLOOD TITHE restores health through successful pistol hits.","PC: AEGIS CYLINDER restores shields through successful pistol hits.","PC: CLOCK STOPPER briefly stuns ordinary foes hit by the pistol.","PC: TRIPLE HAMMER adds extra rounds in a pistol firing cycle.","PC: SHRAPNEL HALO releases damaging fragments around pistol impacts.","PC: HOUND CHAMBER improves near-miss seeking within the aiming cone.","PC: THUNDER STEP can reduce dash cooldown through pistol hits.","PC: FIFTH BELL rewards firing rhythm with a thunderclap every fifth shot.","PC: HALO ENGINE can restore stamina through successful pistol hits.","PC: REQUIEM CYLINDER makes critically wounded enemies erupt.","WORLD: The Meadow's flowers and water help distinguish it from industrial combat zones.","WORLD: A Meadow Rift can open as a rare temporary departure from the main run.","WORLD: Optional areas preserve your main-run progression while you explore.","WORLD: Watch portal effects carefully: walk through a doorway rather than holding interact.","WORLD: Reward altars still require deliberate activation, unlike portal crossings.","WORLD: A hidden area is not automatically safe simply because enemies are absent.","WORLD: The Blackwake Cove entrance is revealed by a sequence of three tidal clues.","WORLD: Follow the salt-blue lights when the Blackwake sea cave opens.","WORLD: The Blackwake treasure chest remains sealed while its Kraken lives.","WORLD: The Kraken has four separately destructible tentacles sharing its total health.","WORLD: Defeated Kraken tentacles leave a permanent severed stump.","WORLD: The Kraken's tidal attack is a vertical water lance; move away from its mark.","WORLD: Use the Kraken's deliberate pauses to reposition and cool your weapon.","WORLD: The Blackwake treasure can produce a permanent mythic weapon fusion.","WORLD: The Blackwake treasure also grants Corsair's Greed salvage benefit.","WORLD: The Circus begins with a strange toy and three colored spotlight clues.","WORLD: Remember the Circus clue sequence: cold moon, gold crown, red curtain.","WORLD: The Circus performers initially dance with their backs to the player.","WORLD: Interrupting the Circus performance angers its cast.","WORLD: Circus enemies become more dangerous when their performance is broken.","WORLD: The Circus prize includes JESTER'S POPPER, an unusual special gun.","WORLD: The Hell Breach contains three stages of extra-dangerous combat.","WORLD: Hell Imps can hide in shadow before their modeled form is revealed.","WORLD: Watch the Pinky's charge telegraph and dodge across its path.","WORLD: Hell Knights combine heavy close-range attacks with ranged pressure.","WORLD: The Wall Maw is attached to its arena wall, not a roaming enemy.","WORLD: At half health the Wall Maw can break away interior walls.","WORLD: The Wall Maw gains reinforced armor in its second phase.","WORLD: The Heaven Sanctum contains an Ophanim that may be peaceful or hostile.","WORLD: Attacking a peaceful sanctuary guardian can change the encounter.","WORLD: The Heaven altar provides permanent progression rewards.","WORLD: A Blockworld anomaly may be triggered by the rare Creeper encounter.","WORLD: The Blockworld's Iron Warden has shielded rites and waves of mites.","WORLD: Defeat the Warden's summoned mites to resume damaging its protected phases.","WORLD: Boss laser warnings are meaningful; use walls to break their line of fire.","WORLD: Boss health bars have separate styles so you know which threat is active.","WORLD: The Traveler boss has a separate shield you must first break.","WORLD: Some enemy projectiles may redirect once toward your previous position.","WORLD: Dashing rocket-stalker enemies signal their launch before the rush.","WORLD: A rocket-stalker can sometimes chain a second dash after its first.","WORLD: Do not stand directly ahead of a rocket-stalker's charging thrusters.","WORLD: Enemy contact can create knockback; use room geometry to stay grounded.","WORLD: Keep moving during boss attacks, but avoid spending all stamina at once.","WORLD: A boss's charge warning gives time to take cover or dodge.","WORLD: Some boss parts have individual health or invulnerability phases.","WORLD: Your progress persists when you return from a secret area.","WORLD: Round-end upgrade choices improve the run you are currently playing.","WORLD: The post-boss shop offers choices different from regular level rewards.","WORLD: A powerful single-target gun is not always best against a swarm.","WORLD: A strong multi-target effect can be worth more than nominal damage.","WORLD: Weapon overheating creates safe windows to swap firing lanes and reposition.","WORLD: A tighter spread improves precision but does not always improve total damage.","WORLD: Choose upgrades based on the enemy types that threaten your current build.","WORLD: Protect your existing legendary weapons until you find a useful fusion.","WORLD: Legendary rarity does not eliminate the need to watch fire rate and heat.","WORLD: You can explore hidden locations without resetting the main campaign.","WORLD: Save progress after major rewards and before long encounters.","WORLD: Learn enemy windups; a good dodge prevents more damage than extra armor.","WORLD: The gun's muzzle flash and recoil help indicate each shot fired.","WORLD: The player can jump to reposition around low terrain and incoming effects.","WORLD: An exposed boss weak point may only stay open for a short window.","WORLD: A staggered enemy is an opportunity to change your attack angle.","WORLD: Your strongest weapon may be better saved for a dangerous boss phase."];
const WYRDFLUX_PC_LOADING_TIPS=Object.freeze([...new Set([
 ...WYRDFLUX_PC_CURATED_LOADING_TIPS,
 ...UPGRADES.filter(u=>u&&u.name&&u.text&&!/overdrive/i.test(u.name+' '+u.text))
  .map(u=>'UPGRADE · '+u.name+' — '+u.text)
])].slice(0,200));
if(WYRDFLUX_PC_LOADING_TIPS.length!==200)
 throw Error('PC realm loading tips require 200 distinct, actual-game tips');
let wyrdfluxWorldLoadingBusy=false,wyrdfluxWorldLoadingTicket=0;
function wyrdfluxCancelWorldLoading(){
 wyrdfluxWorldLoadingTicket++;wyrdfluxWorldLoadingBusy=false;
 document.getElementById('wyrdfluxPcRealmLoad')?.remove();
}
function wyrdfluxBeginRealmLoad(scene,perform,label='ENTERING THE NEXT REALM'){
 if(wyrdfluxWorldLoadingBusy)return false;
 if(!desktopPC)return perform();
 wyrdfluxWorldLoadingBusy=true;
 const ticket=++wyrdfluxWorldLoadingTicket;
 const startedAt=performance.now();
 const veil=document.createElement('section');
 veil.id='wyrdfluxPcRealmLoad';veil.setAttribute('role','status');
 veil.setAttribute('aria-live','polite');
 const art=document.createElement('img');art.className='wyrdfluxRealmLoadArt';
 art.alt='';art.setAttribute('aria-hidden','true');
 const shade=document.createElement('div');shade.className='wyrdfluxRealmLoadShade';
 const inner=document.createElement('div');inner.className='wyrdfluxRealmLoadInner';
 const title=document.createElement('h2');title.textContent=label;
 const tip=document.createElement('p');tip.className='wyrdfluxRealmLoadTip';
 tip.textContent=WYRDFLUX_PC_LOADING_TIPS[(Math.abs((runRecord?.shots||0)+(runRecord?.kills||0)+(wave||0)*17+Math.round(time*10))+ticket*47)%200];
 const detail=document.createElement('small');detail.textContent='READING REALM ART';
 const meter=document.createElement('div');meter.className='wyrdfluxRealmLoadMeter';
 const fill=document.createElement('span');meter.appendChild(fill);
 inner.append(title,tip,detail,meter);veil.append(art,shade,inner);
 document.body.appendChild(veil);
 const valid=()=>ticket===wyrdfluxWorldLoadingTicket&&veil.isConnected;
 const paint=(pct,msg)=>{if(!valid())return;fill.style.width=pct+'%';detail.textContent=msg;};
 let source=WYRDFLUX_PC_LOADING_ART[scene];
 const decoded=new Promise(resolve=>{
  if(!source){art.hidden=true;resolve(false);return;}
  art.onload=()=>resolve(true);
  art.onerror=()=>{art.hidden=true;resolve(false);};
  art.src=source;
 });
 const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
 // The veil is allowed to paint BEFORE synchronous map/GLB/texture preparation.
 (async()=>{
  await nextFrame();if(!valid())return;
  const pictureReady=await decoded;if(!valid())return;
  paint(pictureReady?30:18,pictureReady?'ART DECODED · PREPARING REALM':'PREPARING REALM');
  await nextFrame();if(!valid())return;
  let completed=false;
  try{completed=perform()!==false;}catch(err){console.error('WYRDFLUX_REALM_LOAD_FAILED',err);}
  if(!valid())return;
  if(!completed){paint(0,'REALM UNAVAILABLE · RETURNING TO RUN');}
  else paint(88,'WORLD GEOMETRY · COLLISION · ENEMIES INITIALIZED');
  if(completed&&livingRealm.active){
   const renderer=livingRenderer(livingRealm.id);
   completed=!renderer||renderer.state.status==='ready';
  }
  if(!completed)paint(0,'WORLD NOT READY · RETURNING TO RUN');
  else paint(92,'REALM READY · SETTLING SCENE');
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,4000-(performance.now()-startedAt))));
  if(!valid())return;
  if(completed)paint(100,'REALM READY');
  await nextFrame();await nextFrame();
  if(!valid())return;
  veil.classList.add('wyrdfluxRealmLoadDone');
  wyrdfluxWorldLoadingBusy=false;
  setTimeout(()=>{if(valid())veil.remove();},450);
 })();
 return true;
}

function afterlightSceneTransition(name){
 let p=document.getElementById('afterlightTransition');
 if(!p){p=document.createElement('div');p.id='afterlightTransition';document.body.appendChild(p);}
 p.textContent='✦ '+name+' ✦';
 p.style.cssText='position:fixed;inset:0;z-index:670;display:grid;place-items:center;background:#020713ef;color:#e9dcff;font:800 clamp(18px,6vw,33px) system-ui;letter-spacing:.08em;text-align:center;padding:20px;pointer-events:none;transition:opacity .55s ease';
 p.style.opacity='1';requestAnimationFrame(()=>p.style.opacity='0');
 setTimeout(()=>{if(p.style.opacity==='0')p.style.display='none';},680);
}
function notice(text,secs=2){$('toast').textContent=wyrdfluxReadableText(text);$('toast').classList.remove('hidden');toastUntil=time+secs}
function announce(text,secs=2.2){$('waveAnnounce').textContent=wyrdfluxReadableText(text);$('waveAnnounce').classList.remove('hidden');announcedUntil=time+secs}
// ORIGINAL AFTERLIGHT SOUNDTRACK: generated locally with WebAudio instruments
// and no external audio files or copyrighted melodies/samples.
let musicTimer=null,musicNext=0,musicStep=0,musicBus=null,fxBus=null,noiseBuffer=null;
let audioCompressor=null,audioUnlocked=false,lastSynthProfile='none';
const MUSIC_BPM=124,MUSIC_STEP=60/MUSIC_BPM/4;
const MUSIC_BASS=[36.708,0,0,36.708,0,43.654,0,0,43.654,0,32.703,0,0,32.703,41.203,0,
                  36.708,0,0,36.708,43.654,0,0,43.654,32.703,0,0,41.203,0,36.708,0,0];
const MUSIC_LEAD=[0,293.665,0,0,349.228,0,440.0,0,0,523.251,0,440.0,0,349.228,0,329.628,
                  0,293.665,0,349.228,0,440.0,0,0,391.995,0,349.228,0,329.628,0,293.665,0];
function ensureAudio(){
 if(ctxAudio)return ctxAudio;
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)return null;
 ctxAudio=new AC();
 audioCompressor=ctxAudio.createDynamicsCompressor();
 audioCompressor.threshold.value=-18;audioCompressor.knee.value=18;
 audioCompressor.ratio.value=3.5;audioCompressor.attack.value=.003;audioCompressor.release.value=.15;
 audioCompressor.connect(ctxAudio.destination);
 musicBus=ctxAudio.createGain();musicBus.gain.value=desktopPC?.27:.09;musicBus.connect(audioCompressor);
 fxBus=ctxAudio.createGain();fxBus.gain.value=.34;fxBus.connect(audioCompressor);
 scoreReverb();noiseBuffer=ctxAudio.createBuffer(1,Math.ceil(ctxAudio.sampleRate*.26),ctxAudio.sampleRate);
 const ch=noiseBuffer.getChannelData(0);let n=93617;
 for(let i=0;i<ch.length;i++){n=(Math.imul(1664525,n)+1013904223)>>>0;ch[i]=(n/2147483648-1)*.82}
 return ctxAudio;
}
function audioTone(freq,when,length,vol=.10,wave='sawtooth',dest=null,finish=null){
 const a=ctxAudio;if(!a||a.state!=='running'||!Number.isFinite(freq))return;
 const osc=a.createOscillator(),g=a.createGain(),end=when+Math.max(.012,length);
 osc.type=wave;osc.frequency.setValueAtTime(Math.max(22,freq),when);
 if(finish)osc.frequency.exponentialRampToValueAtTime(Math.max(22,finish),end-.003);
 g.gain.setValueAtTime(.0001,when);
 g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),when+Math.min(.01,length*.2));
 g.gain.exponentialRampToValueAtTime(.0001,end);
 osc.connect(g);g.connect(dest||fxBus);osc.start(when);osc.stop(end+.01);
}
function audioNoise(when,length,vol=.09,freq=2800,mode='bandpass',dest=null){
 const a=ctxAudio;if(!a||a.state!=='running'||!noiseBuffer)return;
 const source=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();
 source.buffer=noiseBuffer;filter.type=mode;filter.frequency.value=freq;filter.Q.value=.7;
 g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),when+.003);
 g.gain.exponentialRampToValueAtTime(.0001,when+Math.min(.25,length));
 source.connect(filter);filter.connect(g);g.connect(dest||fxBus);
 source.start(when);source.stop(when+Math.min(.25,length)+.004);
}
function synthGunSound(weaponIndex,secondaryIndex=-1){
 if(muted||!ensureAudio()||ctxAudio.state!=='running')return;
 const a=ctxAudio,t=a.currentTime,
  selected=WEAPONS[clamp(weaponIndex,0,WEAPONS.length-1)],
  idx=selected.visualIndex??clamp(weaponIndex,0,ORIGINAL_WEAPON_COUNT-1);
 lastSynthProfile=selected.name;scoreDucking();
 if(selected.prototype){
  const f=210+(selected.variant||0)*29+(selected.archetype||0)*27;
  audioTone(f,t+.014,.068,.025,selected.variant%2?'square':'triangle',null,f*.59);
 }
 // Ten deliberately distinct acoustic profiles: each barrel/coil sounds different.
 if(selected.startingSidearm){ // FLUXSIDE: heavy mechanical crack with a spatially fading synthesized echo
  audioNoise(t,.105,.18,2400,'bandpass');
  audioTone(156,t,.24,.19,'sawtooth',null,54);
  audioTone(83,t+.012,.34,.10,'triangle',null,39);
  audioTone(615,t+.006,.067,.042,'square',null,240);
  for(let i=0;i<3;i++){
   const delay=[.17,.39,.68][i],falloff=[.073,.038,.017][i];
   audioTone(112-i*17,t+delay,.34+i*.10,falloff,'triangle',null,65-i*10);
   audioNoise(t+delay,.12,falloff*.46,950-i*180,'lowpass');
  }
 }else if(idx===0){ // VOLT: short electrical ion pulse, sharp upward harmonic sting
  audioTone(550,t,.082,.14,'sawtooth',null,180);
  audioTone(980,t+.01,.065,.075,'triangle',null,470);audioNoise(t,.044,.038,5300);
 }else if(idx===1){ // SHARD: punchy scatter blast with rattling casings
  audioNoise(t,.17,.20,1900);audioTone(130,t,.18,.13,'triangle',null,42);
  for(let i=0;i<3;i++)audioTone(700-i*95,t+.045+i*.023,.06,.028,'square',null,290);
 }else if(idx===2){ // RAIL: crystalline charging chirp into a deep linear accelerator snap
  audioTone(280,t,.23,.18,'sawtooth',null,65);
  audioTone(1700,t+.013,.17,.1,'sine',null,320);audioNoise(t+.01,.13,.09,3600);
 }else if(idx===3){ // NOVA: bass-heavy launcher with a rising plasma exhaust
  audioTone(105,t,.28,.22,'sawtooth',null,36);
  audioTone(290,t+.027,.19,.11,'triangle',null,96);audioNoise(t,.23,.13,930,'lowpass');
 }else if(idx===4){ // SPECTRE: two tight offset staccato laser notes
  audioTone(710,t,.06,.11,'square',null,360);audioTone(840,t+.025,.065,.10,'square',null,410);
 }else if(idx===5){ // INFERNO: roaring thermal burst
  audioNoise(t,.23,.13,1550,'lowpass');audioTone(320,t,.18,.14,'sawtooth',null,95);
 }else if(idx===6){ // CRYO: crystalline glassy high chime with sub pulse
  audioTone(1275,t,.19,.13,'sine',null,540);audioTone(430,t+.018,.14,.065,'triangle',null,235);
 }else if(idx===7){ // TESLA: branching lightning arcs, stochastic crackles
  audioTone(1600,t,.19,.095,'sawtooth',null,205);audioNoise(t,.16,.17,4600,'highpass');
  for(let i=0;i<5;i++){
   const tt=t+.016+i*.023;
   audioNoise(tt,.025,.06,1800+i*370,'highpass');
   audioTone(420+i*290,tt,.036,.042,'square',null,135+i*30);
  }
 }else if(idx===8){ // GRAVITON: huge seismic gravity impact and inharmonic falling coil
  audioTone(190,t,.36,.22,'triangle',null,32);audioTone(66,t+.012,.38,.16,'sawtooth',null,26);
  audioNoise(t+.02,.21,.13,720,'lowpass');
 }else{ // NEEDLE STORM: mechanical rotary ticks and shredded high frequency tails
  audioTone(480,t,.055,.085,'square',null,170);audioNoise(t,.08,.105,4600);
  audioTone(790,t+.014,.037,.04,'triangle',null,430);
 }
 if(secondaryIndex>=0&&secondaryIndex!==idx){
  const i=secondaryIndex;
  audioTone(275+i*53,t+.021,.095,.045,i%2?'triangle':'sine',null,150+i*21);
 }
}


/* ORIGINAL AFTERLIGHT ADAPTIVE SOUNDTRACK v0.41: original eight-bar themes,
 * locally synthesized instruments, independently voiced orchestral / industrial
 * arrangements, scene and combat-aware layers. No copyrighted audio or melodies.
 */
let scoreRoom=null,scoreSend=null,scoreWet=null,scoreVoices=[],scoreDuckingUntil=0;
let scoreSceneId='none',scoreBpm=0,scoreIntensity=.20,scoreChanges=0,scoreCue='';
let scoreDriveCurve=null,scoreLayerBus=null,scoreLayerRetired=0;
// One recognizable long-form lead phrase per theme; notes sustain and overlap
// intentionally instead of chattering for a fraction of a beat.
const SCORE_HITS=[2,6,10,13,18,22,26,30,34,38,42,46,50,54,58,61];
const SCORE_NOTE_BEATS=[1.50,1.25,2.75,1.50,1.80,1.25,3.65,1.50,
  1.75,1.25,2.75,1.50,1.75,1.25,3.90,2.90];
// First four bars announce the hook; the answering four bars bloom and resolve.
const SCORE_HOOKS={
 heaven:[12,16,19,21,19,16,14,12],angel:[12,16,19,16,12,9,7,12],
 hell:[0,0,1,7,0,10,7,0],archfiend:[0,7,1,0,10,7,12,1],
 heart:[0,7,0,10,7,5,3,0],city:[7,10,12,10,7,3,5,7],
 boss:[0,0,7,0,10,7,5,3],title:[7,12,10,7,3,5,7,10]
};
const SCORE_SONGS={
 title:{name:'THE SIGNAL REMAINS',bpm:90,roots:[38,34,41,36],pad:'pad',lead:'bell',drum:'silent',chord:'minor',
  melody:[7,12,10,7,3,5,7,10,12,7,5,3,0,3,5,7]},
 breach:{name:'PERIMETER PULSE',bpm:126,roots:[38,34,36,33],pad:'pad',lead:'lead',drum:'electro',chord:'minor',
  melody:[0,7,10,7,5,3,7,12,10,7,3,5,7,10,5,3]},
 city:{name:'NEON GHOST TRAFFIC',bpm:118,roots:[41,36,38,34],pad:'glass',lead:'lead',drum:'break',chord:'minor',
  melody:[7,10,12,10,7,3,5,7,10,12,15,12,10,7,5,3]},
 null:{name:'THE EMPTY FREQUENCY',bpm:106,roots:[36,32,34,29],pad:'choir',lead:'bell',drum:'broken',chord:'minor',
  melody:[12,10,7,3,5,7,3,0,7,10,12,15,10,7,5,3]},
 forge:{name:'HAMMERFALL INDUSTRIES',bpm:138,roots:[40,36,33,35],pad:'brass',lead:'drive',drum:'forge',chord:'minor',
  melody:[0,0,7,5,3,0,10,7,0,12,10,7,5,3,0,7]},
 gloom:{name:'LAST LIGHT IN THE RAIN',bpm:110,roots:[38,33,34,36],pad:'glass',lead:'bell',drum:'break',chord:'minor',
  melody:[7,5,3,0,3,7,10,7,5,3,0,3,5,7,12,10]},
 orbit:{name:'ASCENT ARRAY',bpm:124,roots:[43,39,36,41],pad:'choir',lead:'lead',drum:'electro',chord:'major',
  melody:[12,7,10,14,12,10,7,5,7,10,12,17,14,12,10,7]},
 heart:{name:'THE IRON HEARTBEAT',bpm:148,roots:[38,35,34,33],pad:'brass',lead:'drive',drum:'forge',chord:'minor',
  melody:[0,7,0,10,7,5,3,0,7,12,10,7,3,5,7,0]},
 boss:{name:'COLLISION OF TITANS',bpm:150,roots:[38,34,31,33],pad:'brass',lead:'drive',drum:'forge',chord:'minor',
  melody:[0,0,7,0,10,7,5,3,0,12,10,7,5,3,7,0]},
 hell:{name:'BLACK CHAPEL // ASH MACHINE',bpm:160,roots:[29,32,27,30],pad:'brass',lead:'drive',drum:'hell',chord:'dread',
  melody:[0,0,1,7,0,10,7,0,0,12,10,7,1,0,7,0]},
 archfiend:{name:'THE ARCHFIEND ENGINE',bpm:170,roots:[29,27,32,30],pad:'brass',lead:'drive',drum:'hell',chord:'dread',
  melody:[0,7,1,0,10,7,12,1,0,7,13,12,1,0,7,1]},
 veil:{name:'THE VEIL IS THIN',bpm:76,roots:[38,34,41,36],pad:'choir',lead:'bell',drum:'silent',chord:'sus',
  melody:[12,10,7,5,10,12,14,12,7,5,3,7,10,12,7,5]},
 angel:{name:'THE WHEELS OF JUDGEMENT',bpm:112,roots:[43,46,41,48],pad:'choir',lead:'brass',drum:'judgement',chord:'lydian',
  melody:[12,16,19,16,12,9,7,12,19,16,14,12,9,7,12,16]},
 heaven:{name:'SANCTUM // EIGHT WINDOWS OF LIGHT',bpm:82,roots:[43,48,46,50],pad:'choir',lead:'bell',drum:'heaven',chord:'lydian',
  melody:[12,16,19,16,14,12,9,7,12,14,16,21,19,16,14,12]}
};
SCORE_SONGS.block={
 name:'GRASS ABOVE, CAVES BELOW',bpm:104,roots:[43,41,36,38],
 pad:'glass',lead:'bell',drum:'break',chord:'major',
 melody:[7,12,14,12,7,5,4,7,12,14,16,12,9,7,5,7]
};
SCORE_SONGS.circusidle={
 name:'THE BIG TOP WAITS',bpm:80,roots:[43,46,41,38],
 pad:'glass',lead:'bell',drum:'silent',chord:'sus',
 melody:[7,12,10,7,5,3,5,7,10,12,14,12,7,5,3,7]
};
SCORE_SONGS.circusdance={
 name:'MARIONETTES ON THE SAWDUST',bpm:112,roots:[43,48,46,41],
 pad:'glass',lead:'bell',drum:'silent',chord:'major',
 melody:[12,16,19,21,19,16,12,9,12,16,21,19,16,14,12,7]
};
SCORE_SONGS.circussilence={
 name:'THE CURTAIN HOLDS ITS BREATH',bpm:112,roots:[41,38,36,34],
 pad:'pad',lead:'harp',drum:'silent',chord:'dread',melody:Array(16).fill(0)
};
SCORE_SONGS.circusattack={
 name:'THE MARIONETTE FEEDS',bpm:153,roots:[29,32,27,31],
 pad:'brass',lead:'drive',drum:'hell',chord:'dread',
 melody:[0,1,7,0,12,7,1,0,10,7,0,1,12,10,7,0]
};
SCORE_SONGS.blockboss={
 name:'DEEP DARK // HEARTBEAT',bpm:78,roots:[29,27,31,24],
 pad:'choir',lead:'brass',drum:'judgement',chord:'dread',
 melody:[0,7,10,7,1,0,7,12,10,7,1,0,3,7,0,1]
};
// V3: never silently reuse combat/title music in the three new living realms.
for(const [id,original,label,bpm] of [
 ['witch','gloom',"BLACKTHORN'S BARGAIN",86],
 ['greenhouse','heaven','VERDANT SANCTUARY',91],
 ['library','veil','ARCANE AURORA LIBRARY',79]
]) SCORE_SONGS[id]={...SCORE_SONGS[original],name:label,bpm};
const SCORE_SECTORS=['breach','city','null','forge','gloom','orbit','heart'];
const SCORE_CHORDS={minor:[0,3,7,10],major:[0,4,7,11],dread:[0,1,7,10],sus:[0,5,7,10],lydian:[0,4,7,11,14]};
function scoreChoose(){
 if(phase==='upgrade'&&bossShopOpen)return 'shop';
 if(livingRealm?.active&&livingRealm.id==='blackwake')return 'blackwake';
 if(livingRealm?.active&&['witch','greenhouse','library'].includes(livingRealm.id))return livingRealm.id;
 if(meadowEpisodeActive)return 'meadow';
 if(circus.state==='active'){
  if(circus.encore==='ascension')return 'ringleader';
  if(circus.encore==='finale')return 'ringleaderfinale';
  if(circus.performance==='reveal')return 'circusreveal';
  if(circus.performance==='waiting')return 'circusidle';
  if(circus.performance==='dance')return 'circusdance';
  if(circus.performance==='silence')return 'circussilence';
  return 'circusattack';
 }
 if(blockworld.state==='active')return blockworld.stage===3?'blockboss':'block';
 if(blockworld.state==='shift'||blockworld.state==='trigger')return 'block';
 if(heavenSanctum.state==='active')return 'heaven';
 if(heavenSanctum.state==='gate')return 'veil';
 if(enemies.some(e=>e.type==='ophanim'&&e.hp>0))return 'angel';
 if(hellBreach.state==='active')return hellBreach.stage>=3?'archfiend':'hell';
 if(hellBreach.state==='gate'||hellBreach.state==='pending')return 'veil';
 if(phase==='play'&&enemies.some(e=>e.hp>0&&isBoss(e)))return 'boss';
 if(phase!=='play')return 'title';
 return SCORE_SECTORS[Math.max(0,Math.min(6,sector|0))];
}
function scoreTarget(id){
 if(id==='circussilence')return .003;
 if(id==='circusidle')return .13;
 if(id==='circusdance')return .29;
 if(id==='circusattack')return .87;
 if(phase!=='play')return .12;
 if(id==='heaven'||id==='veil')return .13;
 if(id==='block')return blockworld.state==='active'?.56:.24;
 if(id==='blockboss')return .94;
 if(id==='angel'||id==='boss'||id==='archfiend')return .98;
 if(id==='hell')return .70+Math.min(.25,hellBreach.stage*.11);
 const near=enemies.reduce((n,e)=>n+(e.hp>0&&Math.hypot(e.x-player.x,e.z-player.z)<9?1:0),0);
 return clamp(.24+near*.12+Math.min(enemies.length,12)*.025+
  (player.hp<player.maxHp*.38?.15:0),.2,1);
}
function scoreReverb(){
 if(!ctxAudio||scoreRoom)return;
 try{
  const a=ctxAudio,count=Math.floor(a.sampleRate*1.05),imp=a.createBuffer(2,count,a.sampleRate);
  let x=0x6ced11;
  for(let channel=0;channel<2;channel++){
   const data=imp.getChannelData(channel);
   for(let i=0;i<count;i++){
    x=(Math.imul(x,1664525)+1013904223)>>>0;
    data[i]=(x/2147483648-1)*Math.exp(-5.15*i/count)*.34;
   }
  }
  scoreRoom=a.createConvolver();scoreRoom.buffer=imp;
  scoreSend=a.createGain();scoreWet=a.createGain();
  scoreSend.gain.value=.30;scoreWet.gain.value=.30;
  scoreSend.connect(scoreRoom);scoreRoom.connect(scoreWet);scoreWet.connect(musicBus);
 }catch(_){scoreRoom=null;scoreSend=null;scoreWet=null;}
}
function scoreVoice(midi,when,length,volume=.05,kind='lead',pan=0){
 const a=ctxAudio;if(!a||a.state!=='running'||!musicBus||!Number.isFinite(midi))return false;
 const battery=$('quality').value==='battery';
 scoreVoices=scoreVoices.filter(end=>end>when);
 if(scoreVoices.length>=(battery?24:48))return false;
 const t=Math.max(when,a.currentTime+.002),end=t+Math.max(.07,length);
 scoreVoices.push(end+.04);
 let attack=.01,release=.23,wave='triangle',low=3200,reverb=.13;
 if(kind==='pad'||kind==='choir'){attack=kind==='choir'?.34:.25;release=.77;wave=kind==='choir'?'sine':'triangle';low=kind==='choir'?2350:1850;reverb=.42;}
 else if(kind==='bell'||kind==='glass'){attack=.003;release=.58;wave='sine';low=kind==='bell'?7200:5500;reverb=.48;}
 else if(kind==='harp'){attack=.005;release=.18;wave='triangle';low=5200;reverb=.34;}
 else if(kind==='brass'){attack=.055;release=.58;wave='sawtooth';low=2600;reverb=.19;}
 else if(kind==='drive'){attack=.004;release=.10;wave='sawtooth';low=2600;reverb=.07;}
 else if(kind==='bass'){attack=.003;release=.08;wave='triangle';low=840;reverb=.03;}
 const hz=440*Math.pow(2,(midi-69)/12),env=a.createGain(),filter=a.createBiquadFilter();
 filter.type='lowpass';filter.frequency.setValueAtTime(Math.max(160,low*.60),t);
 if(kind==='choir'||kind==='pad'||kind==='brass'){
  filter.frequency.exponentialRampToValueAtTime(low,t+Math.min(.72,length*.38));
  filter.frequency.exponentialRampToValueAtTime(low*.72,end);
 }
 const rise=Math.min(attack,length*.28),rel=Math.max(t+rise+.014,end-Math.min(release,length*.46));
 env.gain.setValueAtTime(.00001,t);
 env.gain.linearRampToValueAtTime(Math.max(.0002,Math.min(.24,volume)),t+rise);
 env.gain.setValueAtTime(Math.max(.00015,volume*(kind==='choir'||kind==='pad'?.80:.63)),rel);
 env.gain.exponentialRampToValueAtTime(.00001,end);
 let input=filter;
 if(kind==='drive'){
  const shaper=a.createWaveShaper();
  if(!scoreDriveCurve){
   scoreDriveCurve=new Float32Array(256);
   for(let i=0;i<256;i++)scoreDriveCurve[i]=Math.tanh(((i/255)*2-1)*2.45)/Math.tanh(2.45);
  }
  shaper.curve=scoreDriveCurve;shaper.oversample='none';
  shaper.connect(filter);input=shaper;
 }
 filter.connect(env);
 if(a.createStereoPanner&&!battery){
  const p=a.createStereoPanner();p.pan.value=clamp(pan,-.65,.65);env.connect(p);p.connect(scoreLayerBus||musicBus);
 }else env.connect(scoreLayerBus||musicBus);
 if(scoreSend&&!battery&&reverb>.06){
  const wet=a.createGain();wet.gain.value=reverb;env.connect(wet);wet.connect(scoreSend);
 }
 const o=a.createOscillator();o.type=wave;o.frequency.setValueAtTime(hz,t);
 if(kind==='choir'||kind==='pad')o.detune.setValueAtTime(-3,t);
 o.connect(input);o.start(t);o.stop(end+.01);
 if(!battery&&['choir','pad','bell','glass','brass','drive','harp'].includes(kind)){
  const h=a.createOscillator(),g=a.createGain();
  h.type=kind==='drive'?'square':'sine';
  h.frequency.setValueAtTime(hz*(kind==='choir'?1.003:kind==='bell'?2.71:kind==='glass'?2.01:2),t);
  g.gain.value=kind==='choir'?.43:kind==='bell'?.32:.16;
  h.connect(g);g.connect(input);h.start(t);h.stop(end+.01);
 }
 return true;
}
function scoreKick(t,heavy=false){
 audioTone(heavy?116:142,t,.18,heavy?.18:.13,'sine',musicBus,heavy?38:48);
 if(heavy)audioNoise(t,.04,.024,590,'lowpass',musicBus);
}
function scoreSnare(t,strong=false){
 audioNoise(t,.13,strong?.092:.055,strong?1450:2350,'bandpass',musicBus);
 audioTone(184,t,.078,strong?.035:.016,'triangle',musicBus,88);
}

/* Audio "weight": a punchy onset followed by a tuned low-frequency body and
 * a slowly fading wide halo. Kept rare (one every four bars, on mode changes).
 * These are original synthesized hits, not sampled cinematic braaams. */
function scoreImpact(at,character='cinematic',power=.70){
 if(!ctxAudio||ctxAudio.state!=='running')return;
 const p=clamp(power,.25,1),t=Math.max(at,ctxAudio.currentTime+.003);
 const holy=character==='celestial',infernal=character==='infernal';
 audioTone(holy?98:infernal?48:65,t,holy?2.6:2.15,.115*p,holy?'sine':'sawtooth',
   musicBus,holy?82:infernal?31:41);
 audioTone(holy?196:infernal?36:49,t+.025,holy?3.15:2.25,.080*p,
   holy?'sine':'triangle',musicBus,holy?156:infernal?26:35);
 audioNoise(t+.006,holy?.40:.24,.032*p,holy?2500:infernal?520:920,
   holy?'bandpass':'lowpass',musicBus);
 if(holy){
  [67,71,74].forEach((n,i)=>scoreVoice(n,t+.13+i*.085,3.45,.047*p,'bell',i%2?.34:-.34));
 }else if(infernal)scoreVoice(29,t+.18,2.55,.052*p,'drive');
}

function scoreDrum(song,s,t){
 const battery=$('quality').value==='battery',kind=song.drum;
 if(kind==='silent')return;
 if(kind==='heaven'){
  if(s%16===0)scoreVoice(43,t,.78,.036,'bell');
  if(s%16===12&&!battery)scoreVoice(74,t,.74,.031,'harp',.35);
  return;
 }
 if(kind==='judgement'){
  if(s%8===0)scoreKick(t,true);
  if(s%8===4)scoreSnare(t);
  if(!battery&&s%4===2)audioNoise(t,.035,.027,6000,'highpass',musicBus);
  return;
 }
 if(s%4===0)scoreKick(t,kind==='hell'||kind==='forge');
 if(s%8===4)scoreSnare(t,kind==='hell'||kind==='forge');
 if(!battery&&s%2===0&&(scoreIntensity>.35||s%4===0))
  audioNoise(t,.034,.027,8500,'highpass',musicBus);
 if(!battery&&scoreIntensity>.62&&s%16===15)scoreSnare(t);
 if(kind==='break'&&scoreIntensity>.38&&(s%16===10||s%16===14))scoreKick(t);
 if((kind==='hell'||kind==='forge')&&scoreIntensity>.56&&(s%8===6||s%8===7))scoreKick(t,true);
}
let wyrdfluxTitleMusicStart=-1,wyrdfluxTitleBassDropped=false;
function scoreStepPlay(step,at){
 if(scoreSceneId==='title'){
  // Entirely original slow-to-bouncy menu melody. No audio files needed.
  // The first 15 seconds are gentle; a bass drop opens a rhythmic middle;
  // the song settles with an audible melodic phrase rather than silence.
  if(step===0||wyrdfluxTitleMusicStart<0){
   wyrdfluxTitleMusicStart=at;wyrdfluxTitleBassDropped=false;
  }
  const elapsed=at-wyrdfluxTitleMusicStart;
  const groove=elapsed>=15&&elapsed<47,settled=elapsed>=47;
  const note=[0,3,7,10,7,5,3,7,12,10,7,5,3,5,7,10][step%16];
  const chord=[0,5,7,10][Math.floor(step/8)%4];
  if(groove&&!wyrdfluxTitleBassDropped){
   wyrdfluxTitleBassDropped=true;
   audioTone(105,at,.50,.095,'sine',musicBus,36);
   audioTone(52,at+.042,.71,.075,'triangle',musicBus,31);
   scoreImpact(at,'cinematic',.43);
  }
  if(step%4===0){
   scoreVoice(50+chord,at,groove?.33:.56,
    groove?.057:settled?.035:.025,'bass');
   if(groove){
    audioTone(88,at,.15,.050,'sine',musicBus,42);
    if(step%8===4)audioNoise(at+.01,.065,.025,3300,'bandpass',musicBus);
   }
  }
  if(step%2===0){
   scoreVoice(62+note,at,groove?.24:.44,
    groove?.050:settled?.044:.034,'bell',step%4?.15:-.15);
   if(!groove&&step%8===0)scoreVoice(74+chord,at,.82,.017,'pad');
  }
  if(groove&&step%4===2)
   scoreVoice(74+[7,5,3,0][Math.floor(step/4)%4],
    at,.18,.027,'harp',step%8?.22:-.22);
  if(settled&&step%16===0)
   scoreVoice(57+chord,at,.99,.034,'pad');
  return;
 }
 if(scoreSceneId==='circussilence')return;
 if(scoreSceneId==='circusidle'||scoreSceneId==='circusdance'){
  // Original whimsical theater waltz: celesta, soft oom-pah bass, and
  // descending ribbon notes; quiet until the player walks into the ring.
  const upbeat=scoreSceneId==='circusdance',root=upbeat?55:50,
   accents=[0,4,7,9,7,4,2,5,7,12,9,7,4,2,0,4],
   i=step%16,t=60/(upbeat?112:80);
  if(i%12===0)scoreVoice(root-12,at,t*.65,upbeat?.045:.022,'bass');
  if(i%4===0)scoreVoice(root+accents[Math.floor(i/4)],at,t*.95,
    upbeat?.054:.025,'bell',i%8?.24:-.24);
  if(upbeat&&i%6===3)scoreVoice(root+7,at,t*.24,.022,'harp');
  return;
 }
 const song=SCORE_SONGS[scoreSceneId]||SCORE_SONGS.breach,pos=step%128,
  bar=Math.floor(pos/16),slot=pos%16,battery=$('quality').value==='battery',
  root=song.roots[Math.floor(bar/2)%4],chord=SCORE_CHORDS[song.chord],
  ambient=['heaven','silent'].includes(song.drum),beat=60/song.bpm;
 if(slot===0){
  const opening=bar%2===0,epic=scoreSceneId==='heaven'||scoreSceneId==='angel';
  scoreVoice(root,at,beat*(epic?2.1:1.08),ambient?.057:.089,'bass');
  if(opening){
   if(!battery)for(let i=0;i<3;i++)
    scoreVoice(root+12+chord[i]+(i===2?12:0),at+i*.035,beat*(epic?7.6:5.9),
     ambient?.043:.027,song.pad,[-.5,0,.5][i]);
   else scoreVoice(root+12,at,beat*3.5,.032,song.pad);
  }
  if(!battery&&bar%4===0&&(ambient||scoreIntensity>.60))
   scoreImpact(at,epic?'celestial':song.drum==='hell'?'infernal':'cinematic',.62);
 }
 if(!ambient&&step%4===0&&slot!==0)
  scoreVoice(root,at,beat*.45,scoreIntensity>.55?.079:.05,'bass');
 if(!battery&&song.drum==='hell'&&step%2===0&&scoreIntensity>.42){
  const riff=[0,0,1,7,0,0,10,7,0,0,12,7,1,0,7,0][Math.floor((step%32)/2)];
  scoreVoice(root+12+riff,at,beat*.18,.043+scoreIntensity*.020,'drive',step%4?.18:-.18);
 }
 scoreDrum(song,step,at);
 const mi=SCORE_HITS.indexOf(step%64);
 if(mi>=0&&(ambient||scoreIntensity>.30||mi%2===0)){
  const phraseB=Math.floor(step/64)%2===1,sign=SCORE_HOOKS[scoreSceneId];
  const base=sign?sign[mi%8]:song.melody[mi];
  const note=phraseB?(mi%8===7?0:base+(mi===5?2:mi===6?3:0)):base;
  const length=beat*SCORE_NOTE_BEATS[mi]*(ambient?1.55:scoreSceneId==='angel'?1.25:1);
  const instrument=ambient&&scoreSceneId==='heaven'?'choir':song.lead;
  scoreVoice(root+24+note,at,length,
    ambient?.073:.043+scoreIntensity*.027,instrument,mi%2?.32:-.32);
  if(!battery&&mi%4===2&&scoreIntensity>.56&&song.drum!=='heaven')
   scoreVoice(root+12+note,at+.055,beat*SCORE_NOTE_BEATS[mi]*1.15,
     .027+scoreIntensity*.012,song.pad,mi%2?-.21:.21);
 }
 if(!battery&&step%8===0&&(ambient||scoreIntensity>.46)){
  const i=(Math.floor(step/8)+bar)%chord.length;
  scoreVoice(root+24+chord[i],at,beat*(ambient?.9:.42),
   ambient?.040:.029,ambient?'harp':'glass',i%2?.36:-.36);
 }
 if(!battery&&song.drum==='heaven'&&step%16===8)
  scoreVoice(root+31,at,beat*5.4,.041,'choir',.2);
 if(!battery&&song.drum==='judgement'&&step%16===12)
  scoreVoice(root+19,at,beat*3.9,.067,'bell');
}
function scoreDucking(){if(ctxAudio)scoreDuckingUntil=ctxAudio.currentTime+.18;}
function scoreCrossfadeScene(now){
 if(!ctxAudio||!musicBus)return;
 const old=scoreLayerBus,layer=ctxAudio.createGain();
 layer.gain.setValueAtTime(.00001,now);
 layer.gain.setTargetAtTime(1,now,.34);
 layer.connect(musicBus);
 scoreLayerBus=layer;
 if(old){
  old.gain.cancelScheduledValues(now);
  old.gain.setTargetAtTime(.00001,now,.38);
  scoreLayerRetired++;
  setTimeout(()=>{try{old.disconnect()}catch(_){}
    scoreLayerRetired=Math.max(0,scoreLayerRetired-1)},6500);
 }
}
function scoreStinger(){
 if(!ctxAudio||ctxAudio.state!=='running'||muted)return;
 const t=ctxAudio.currentTime;
 if(scoreSceneId==='angel'){
  scoreImpact(t,'celestial',.85);
  [55,62,67,74].forEach((n,i)=>scoreVoice(n,t+i*.25,2.75,.09,'bell',i%2?.4:-.4));
 }else if(scoreSceneId==='heaven'||scoreSceneId==='veil'){
  scoreImpact(t,'celestial',.66);
  [55,62,67,71,74].forEach((n,i)=>scoreVoice(n,t+i*.28,4.3,.073,'choir'));
 }else if(scoreSceneId==='hell'){
  scoreImpact(t,'infernal',.88);scoreVoice(29,t,2.1,.12,'drive');scoreKick(t+.03,true);
 }
}

/* Entirely original 156 BPM infernal battle score, not DOOM/Painkiller
 * music and no playback of copyrighted recordings or compositions.
 * Driven by the existing fixed WebAudio oscillator/noise scheduler.
 */
const HELL_BPM=156,HELL_STEP=60/HELL_BPM/4;
const HELL_RIFF=[41.20,0,41.20,46.25,41.20,0,34.65,41.20,
  41.20,0,55.00,46.25,34.65,41.20,0,36.71,
  41.20,41.20,0,46.25,41.20,0,34.65,36.71,
  41.20,0,55.0,61.74,46.25,41.20,34.65,30.87];
function hellCombatScore(step,at){
 const idx=step%32,bass=HELL_RIFF[idx],arch=hellBreach.stage===3?1.2:1;
 if(step%4===0){
  audioTone(112,at,.21,.21*arch,'sine',musicBus,38);
  audioTone(47,at+.006,.17,.135*arch,'triangle',musicBus,29);
 }
 if(step%8===4){
  audioNoise(at,.20,.14*arch,2100,'bandpass',musicBus);
  audioTone(185,at,.11,.075,'square',musicBus,52);
 }
 if(step%2===0&&$('quality').value!=='battery')
  audioNoise(at,.032,.05,7300,'highpass',musicBus);
 if(step%4===3&&hellBreach.stage>1)
  audioNoise(at,.055,.049,4100,'highpass',musicBus);
 if(bass){
  audioTone(bass*2,at,.115,.14*arch,'sawtooth',musicBus,bass*1.43);
  if(idx%4===0)audioTone(bass,at,.185,.105,'square',musicBus,bass*.90);
 }
 if(idx===0||idx===16){
  audioTone(82.4,at,.62,.054,'sawtooth',musicBus,66.5);
  audioTone(123.47,at+.08,.51,.042,'triangle',musicBus,116.54);
 }
 if(hellBreach.stage===3&&(idx===14||idx===30))
  audioTone(246.94,at,.33,.052,'sawtooth',musicBus,116.54);
 if(idx===6||idx===22)
  audioNoise(at,.06,.063,730,'lowpass',musicBus);
}

function soundtrackBeat(step,at){
 if(hellBreach.state==='active'){hellCombatScore(step,at);return;}
 const idx=step%32,bar=Math.floor(step/16),lead=MUSIC_LEAD[idx],bass=MUSIC_BASS[idx];
 // Original four-on-the-floor warehouse techno at 124 BPM, keyed in D minor.
 if(step%4===0){
  audioTone(128,at,.19,.31,'sine',musicBus,42);
  audioTone(55,at+.008,.18,.11,'triangle',musicBus,33);
 }
 if(step%8===4)audioNoise(at,.16,.13,1900,'bandpass',musicBus);
 if(step%2===0)audioNoise(at,.034,.045,7900,'highpass',musicBus);
 if(step%4===3)audioNoise(at,.026,.025,9900,'highpass',musicBus);
 if(bass)audioTone(bass,at,.20,.125,'sawtooth',musicBus,bass*.86);
 if(lead&&(step%32<16||bar%2===1)){
  audioTone(lead,at,.135,.044,'triangle',musicBus,lead*.99);
  audioTone(lead*2,at+.012,.10,.016,'sine',musicBus);
 }
 if(idx===0||idx===16){
  audioTone(146.83,at,.64,.025,'sine',musicBus);
  audioTone(220,at,.62,.018,'triangle',musicBus);
 }
}
let soundtrackStyle='neon-grid',hellMusicGain=1;
// Patch 0.01 optional authored WAV assets. Their actual masters live on the
// owner's desktop, then enter Electron's ASAR-unpacked audio directory.
// If missing, the verified original WebAudio generator remains the fallback.
const WYRD_PATCH_AUDIO_ROOT='desktop/assets/audio/patch001/';
const WYRD_PATCH_MUSIC_MAP=Object.freeze({
 title:'title',breach:'breach',city:'city',null:'null',
 forge:'forge',gloom:'gloom',orbit:'orbit',heart:'heart',boss:'boss',
 hell:'hell',archfiend:'archfiend',heaven:'heaven',angel:'angel',
 veil:'veil',block:'block',blockboss:'warden',
 witch:'witch',greenhouse:'greenhouse',library:'library',
 warden:'warden',meadow:'meadow',blackwake:'blackwake',
 shop:'shop',merchant:'shop',puppet:'boss',maw:'hell',
 circusidle:'circusidle',circusdance:'circusdance',
 circussilence:'circussilence',circusreveal:'circusreveal',circusattack:'circusattack',
 ringleader:'ringleader',ringleaderfinale:'ringleaderfinale'
});
const WYRD_PATCH_FX_NAMES=new Set([
 'shot_pistol','shot_ultra','shot_rifle','hit','upgrade','maw','warden',
 'sonicboom','creeperhiss','blockshift','blockenter','heavengate',
 'heavenenter','altar','angelcharge','hellenter','ringleader_ascend',
 'ringleader_revive','ringleader_finale','menu_confirm']);
let wyrdPatchMusic=null,wyrdPatchMusicId=null,wyrdPatchPrevious=null;
const wyrdPatchMissing=new Set(),wyrdPatchSfxPool=new Map();
function wyrdfluxMusicAsset(id){
 if(!desktopPC||!audioUnlocked||muted)return false;
 const file=WYRD_PATCH_MUSIC_MAP[id]||'breach';
 if(wyrdPatchMissing.has('music/'+file))return false;
 if(wyrdPatchMusicId!==file){
  const extension=window.WYRDFLUX_AUDIO_PACK?.v3?'.ogg':'.wav';
  const next=new Audio(WYRD_PATCH_AUDIO_ROOT+'music/'+file+extension);
  next.preload='auto';next.loop=true;next.volume=0;
  next.addEventListener('error',()=>{
   wyrdPatchMissing.add('music/'+file);
   if(wyrdPatchMusic===next){wyrdPatchMusic=null;wyrdPatchMusicId=null;}
  },{once:true});
  const play=next.play();
  if(play?.catch)play.catch(()=>{wyrdPatchMissing.add('music/'+file);});
  wyrdPatchPrevious=wyrdPatchMusic;
  wyrdPatchMusic=next;wyrdPatchMusicId=file;
 }
 if(wyrdPatchMusic){
  if(wyrdPatchMusic.paused){
   const resume=wyrdPatchMusic.play();
   if(resume?.catch)resume.catch(()=>wyrdPatchMissing.add('music/'+file));
  }
  wyrdPatchMusic.volume=Math.min(.25,wyrdPatchMusic.volume+.012);
  if(wyrdPatchPrevious){
   wyrdPatchPrevious.volume=Math.max(0,wyrdPatchPrevious.volume-.012);
   if(wyrdPatchPrevious.volume<=.01){
    wyrdPatchPrevious.pause();wyrdPatchPrevious=null;
   }
  }
 }
 return !!wyrdPatchMusic;
}
// Patch 0.01 audio packs may contain all 256 guns, category bullet FX,
// and 20 simultaneous pistol mods. Sounds are lazy-loaded and voice-limited.
// Fallback remains the original WebAudio synthesis for missing files.
function wyrdfluxSoundAsset(type){
 if(!desktopPC||!audioUnlocked||muted)return false;
 const isShot=type==='shot';
 const isPistol=String(type).startsWith('pistol_');
 const v2=!!window.WYRDFLUX_AUDIO_PACK?.v2;
 const variant=isShot&&v2?(Math.max(0,runRecord.shots|0)%3):0;
 const name=isShot?'gun_'+String(gun).padStart(3,'0')+
  (variant?'_alt'+variant:''):String(type);
 const path=(isShot?'guns/':'fx/')+name;
 if(!isShot&&!isPistol&&!WYRD_PATCH_FX_NAMES.has(name)&&
    !/^(?:projectile_|boss_|enemy_|ui_|pickup|reload|casing|gun_|critical_|weakspot_|level_|shop_|wave_|water_|fire_|rain_|wind_|footstep_|world_|circus_)/.test(name))return false;
 if(wyrdPatchMissing.has(path))return false;
 let pool=wyrdPatchSfxPool.get(path);
 if(!pool){
  pool=Array.from({length:isShot?6:isPistol?2:3},()=>{
   const a=new Audio(WYRD_PATCH_AUDIO_ROOT+path+'.wav');
   a.preload='auto';a.volume=isShot?.32:isPistol?.145:.21;
   a.addEventListener('error',()=>wyrdPatchMissing.add(path),{once:true});
   return a;
  });
  wyrdPatchSfxPool.set(path,pool);
 }
 const a=pool.find(x=>x.paused||x.ended);
 if(!a)return true;
 try{a.currentTime=0;}catch(_){}
 const play=a.play();
 if(play?.catch)play.catch(()=>wyrdPatchMissing.add(path));
 return true;
}
function musicScheduler(){
 if(!ctxAudio||ctxAudio.state!=='running')return;
 const now=ctxAudio.currentTime;
 if(muted){
  if(wyrdPatchMusic)wyrdPatchMusic.pause();
  if(wyrdPatchPrevious)wyrdPatchPrevious.pause();
  musicBus.gain.setTargetAtTime(.00001,now,.04);return;
 }
 const id=scoreChoose(),song=SCORE_SONGS[id];
 if(wyrdfluxMusicAsset(id)){
  if(id!==scoreSceneId){scoreSceneId=id;scoreBpm=song.bpm;scoreCue=song.name;scoreChanges++;}
  musicBus.gain.setTargetAtTime(.00001,now,.07);
  fxBus.gain.setTargetAtTime(.34,now,.17);
  return;
 }
 if(wyrdPatchMusic){wyrdPatchMusic.pause();wyrdPatchMusic=null;wyrdPatchMusicId=null;}
 if(id!==scoreSceneId){
  scoreSceneId=id;scoreBpm=song.bpm;scoreCue=song.name;
  scoreChanges++;musicStep=0;musicNext=now+.07;scoreCrossfadeScene(now);scoreStinger();
 }
 const target=scoreTarget(id);
 scoreIntensity+=clamp(target-scoreIntensity,-.037,.037);
 const quiet=phase!=='play';
 const gain=(quiet?.065:id==='angel'?.118:id==='heaven'?.107:
   id==='hell'||id==='archfiend'?.129:.101)*(now<scoreDuckingUntil?.70:1);
 musicBus.gain.setTargetAtTime(Math.min(.48,gain*(desktopPC?3:1)),now,.17);
 fxBus.gain.setTargetAtTime(.34,now,.17);
 if(scoreWet)scoreWet.gain.setTargetAtTime(
  id==='heaven'||id==='veil'?.45:id==='angel'?.30:.23,now,.32);
 soundtrackStyle=id;hellMusicGain=['hell','archfiend'].includes(id)?1.5:1;
 if(musicNext<now-.32)musicNext=now+.03;
 let iterations=0;
 while(musicNext<now+.16&&iterations++<6){
  scoreStepPlay(musicStep++,musicNext);
  musicNext+=60/song.bpm/4;
 }
}
function unlockSoundtrack(){
 try{
  if(!ensureAudio())return;
  if(ctxAudio.state==='suspended'){const p=ctxAudio.resume();p?.catch?.(()=>{});}
  audioUnlocked=true;musicNext=ctxAudio.currentTime+.035;
  if(!musicTimer)musicTimer=setInterval(musicScheduler,75);
 }catch(_){}
}
function cinematicStinger(shot){
 if(muted||!audioUnlocked||!ctxAudio||ctxAudio.state!=='running')return;
 const t=ctxAudio.currentTime;
 if(shot==='bleed'){
  audioTone(73.416,t,.30,.065,'sawtooth',musicBus,46.249);
  audioNoise(t+.055,.18,.044,1350,'lowpass',musicBus);
 }else if(shot==='hunted'){
  audioTone(65.40,t,.8,.12,'sawtooth',musicBus,27.5);
  audioTone(130.81,t+.03,.55,.065,'triangle',musicBus,61.74);
  audioNoise(t+.05,.20,.055,950,'lowpass',musicBus);
 }else if(shot==='collapse'){
  audioTone(220,t,.45,.080,'sawtooth',musicBus,55);
  audioNoise(t+.05,.16,.076,5100,'highpass',musicBus);
 }else if(shot==='title'){
  for(let i=0;i<3;i++)audioTone([146.83,220,293.66][i],t+i*.11,.66,.055,'triangle',musicBus);
 }
}
function sound(type){
 if(muted)return;
 try{
  if(!ensureAudio())return;
  if(ctxAudio.state==='suspended'){const p=ctxAudio.resume();p?.catch?.(()=>{});}
  if(ctxAudio.state!=='running')return;
  if(wyrdfluxSoundAsset(type))return;
  if(type==='shot'){synthGunSound(gun,mixGun);return;}
  const t=ctxAudio.currentTime;
  if(type==='thrusterboost'){
    audioNoise(t,.29,.125,1450,'lowpass');
    audioTone(82,t,.30,.20,'sawtooth',fxBus,310);
    audioNoise(t+.075,.15,.078,2400,'bandpass');
   }
   else if(type==='creeperhiss'){audioNoise(t,.25,.063,2400,'bandpass');audioTone(360,t,.32,.040,'triangle',fxBus,155);}
  else if(type==='blockshift'){scoreImpact(t,'cinematic',.94);audioNoise(t,.24,.11,6000,'highpass');audioTone(110,t,.78,.16,'triangle',fxBus,55);}
  else if(type==='blockenter'){[392,494,587,784].forEach((f,i)=>audioTone(f,t+i*.16,.54,.075,'square',fxBus));}
  else if(type==='warden'){scoreImpact(t,'infernal',1);audioTone(45,t,.98,.18,'sine',fxBus,28);}
  else if(type==='sonicboom'){audioTone(74,t,.38,.22,'sawtooth',fxBus,35);audioNoise(t,.18,.078,930,'bandpass');}
  else if(type==='arrow'){audioNoise(t,.08,.035,5000,'highpass');}
  else if(type==='heavengate'){scoreImpact(t,'celestial',.9);[55,62,67,74].forEach((n,i)=>scoreVoice(n,t+i*.27,3.8,.105,'bell'));}
  else if(type==='heavenenter'){scoreImpact(t,'celestial',.65);[55,59,62,67,71,74].forEach((n,i)=>scoreVoice(n,t+i*.22,4.8,.085,'choir'));}
  else if(type==='altar'){scoreImpact(t,'celestial',1);[55,62,67,71,74,79].forEach((n,i)=>scoreVoice(n,t+i*.22,5.1,.095,'bell'));}
  else if(type==='angelcharge'){audioTone(220,t,.24,.07,'sine',null,440);audioTone(660,t+.05,.40,.05,'sine',null,330);}
  else if(type==='hellenter'){scoreImpact(t,'infernal',.95);audioTone(57,t,2.25,.17,'sawtooth',null,31);audioNoise(t,.3,.06,670,'lowpass');}
  else if(type==='maw'){
    audioTone(54,t,.56,.16,'sawtooth',null,29);
    audioTone(89,t+.085,.49,.08,'triangle',null,37);
    audioNoise(t,.24,.05,430,'bandpass');
  }else if(type==='hit'){audioTone(530,t,.11,.075,'triangle',null,140);audioNoise(t,.055,.040,2700);}
  else if(type==='upgrade'){audioTone(440,t,.14,.088,'sine',null,690);audioTone(660,t+.095,.18,.075,'triangle',null,1000);}
  else{audioTone(340,t,.095,.07,'sine',null,210);}
 }catch(_){}
}
function loadPrefs(){try{const data=JSON.parse(localStorage.getItem('su2-prefs')||'{}');muted=!!data.muted;if(!desktopPC&&['high','balanced','battery'].includes(data.quality))$('quality').value=data.quality;
 if(desktopPC)$('quality').value='high';$('soundButton').textContent='AUDIO + MUSIC: '+(muted?'OFF':'ON');$('bestScore').textContent='BEST RUN '+String(Number(data.best)||0).padStart(5,'0')}catch(_){}}
function savePrefs(){try{const data=JSON.parse(localStorage.getItem('su2-prefs')||'{}');data.muted=muted;data.quality=$('quality').value;if(!testLabMode)data.best=Math.max(data.best||0,totalScore);localStorage.setItem('su2-prefs',JSON.stringify(data))}catch(_){}}
function saveCheckpoint(){if(livingRealm.active||circus.state==='active'||testLabMode||!['play','upgrade','pause'].includes(phase))return;try{const data={schema:9,phase:phase==='pause'?'play':phase,player:{...player},wyrdfluxRunPickups:wyrdfluxRunPickups.slice(-256),wave,cycle:cycleOf(wave),sector,kills,totalScore,gun,mixGun,wyrdfluxPrimarySlot,wyrdfluxSecondarySlot,activeGun,fusedWeapons:WEAPONS.slice(WYRDFLUX_BASE_WEAPON_COUNT),relayState:{...relayState},coreOnline,runRecord:{...runRecord},runLevel:{...runLevel},upgradeDraftKind,bossShopDue,bossShopOpen,bossShopVisited,wyrdfluxSecrets:{...wyrdfluxSecrets},blackwake:{...blackwake},
 circus:{...circus,returnState:null},worldRelicOffer,meadowEpisodeActive,livingRealmPending:livingRealm.pending,livingLastEventWave:livingRealm.lastEventWave,hellBreach:{...hellBreach},heavenSanctum:{...heavenSanctum},blockworld:{...blockworld}};localStorage.setItem('su2-save',JSON.stringify(data));$('continueButton').disabled=false}catch(_){}}
function clearCheckpoint(){if(testLabMode)return;try{localStorage.removeItem('su2-save')}catch(_){}$('continueButton').disabled=true}
function checkCheckpoint(){try{const s=JSON.parse(localStorage.getItem('su2-save'));if(s&&s.player&&s.wave>0)$('continueButton').disabled=false}catch(_){}}
function resetGame(){resetWyrdfluxShadowReplay();wyrdfluxPlayerShots=[];WEAPONS.length=WYRDFLUX_BASE_WEAPON_COUNT;wyrdfluxSprint.latched=false;wyrdfluxSprint.exhausted=false;
 endBossIntro();clearMeadowWorldVisuals();wyrdfluxRunPickups=[];
 clearCircusHitDistortion();circus=freshCircus();blackwake=freshBlackwake();blackwakeKraken=freshBlackwakeKraken();
 document.body.classList.remove('wyrdflux-circus');
 if(livingRealm.active)livingRenderer(livingRealm.id)?.dispose?.(gl);
 livingRealm.active=false;livingRealm.id=null;livingRealm.pending=null;livingRealm.claimed=false;
 livingRealm.choiceResult=null;livingRealm.returnState=null;livingRealm.testOnly=false;
 livingRealm.lastEventWave=0;document.body.classList.remove('wyrdflux-living-realm');runLevel=defaultRunLevel();upgradeDraftKind='wave';bossShopDue=0;bossShopOpen=false;bossShopVisited=0;wyrdfluxSecrets={thirteen:false,emberstep:false};meadowEpisodeActive=false;meadowEpisodeResume=false;heatMarks=[];heatNextHit=0;runRecord=defaultRunRecord();worldRelicOffer=null;document.body.classList.remove('armory-open');$('loadoutToggle')?.setAttribute('aria-expanded','false');seed=1749;hellFootprints=[];heavenSanctum={state:'none',gateX:C,gateZ:C,returnWave:0,returnSector:0,entered:0};blockworld={state:'none',stage:0,returnWave:0,returnSector:0,transition:0,found:false,triggers:blockworld.triggers||0,creepersExploded:blockworld.creepersExploded||0,wardenBooms:blockworld.wardenBooms||0,stormCount:0,stormCooldown:4.2,stormStrikes:[],burns:[],lavaBlocks:[],lavaNextHit:0,stormDamageBaseline:0};hellBreach={state:'none',stage:0,stages:3,kills:0,gateX:C,gateZ:2.25,
 returnWave:0,returnSector:0,reward:0,transition:0,encountered:false,conqueredThisRun:false};
 Object.assign(puppetFinale,{active:false,t:0,clock:0,sparks:0});
 player=defaultPlayer();applyPermanentBase();enemies=[];projectiles=[];particles=[];tracers=[];lingeringBeams=[];wyrdfluxContactFX=[];pickups=[];impactFlashes=[];debris=[];burstRings=[];for(const t of combatTexts)t.el?.remove();combatTexts=[];time=0;wave=0;sector=0;kills=0;relayState={};coreOnline=false;interactProgress=0;saveTimer=0;inputs.interact=false;totalScore=0;gun=0;mixGun=-1;wyrdfluxPrimarySlot=-1;wyrdfluxSecondarySlot=0;activeGun=Array(WEAPONS.length).fill(false).map((v,i)=>i===0);spawnPending=0;spawnClock=0;createMap();buildStatic();updateHUD()}
// Actual new-run scene preparation behind a blocking cinematic veil.
// The player, map, static geometry, camera and shader are prepared BEFORE
// the veil leaves; two real WebGL frames warm textures and GPU state.
let wyrdfluxStartupValidated=false,wyrdfluxStartupFrames=0;
function beginWyrdfluxStartupLoading(resume){
 if(!desktopPC)return null;
 document.getElementById('wyrdfluxStartupVeil')?.remove();
 wyrdfluxStartupValidated=false;wyrdfluxStartupFrames=0;
 const veil=document.createElement('section');veil.id='wyrdfluxStartupVeil';
 const startedAt=performance.now();
 veil.setAttribute('role','status');veil.setAttribute('aria-live','polite');
 const inner=document.createElement('div');inner.className='wyrdfluxStartupInner';
 const title=document.createElement('strong');title.textContent='WYRDFLUX · ENTERING THE FRACTURE';
 const detail=document.createElement('p');detail.id='wyrdfluxStartupDetail';
 detail.textContent=resume?'RESTORING YOUR RUN · LOADING WORLD DATA':'GENERATING FIRST SECTOR · PREPARING YOUR CHARACTER';
 const art=document.createElement('img');art.className='wyrdfluxStartupArt';
 art.src='engine/assets/loading/launch.jpg';art.alt='';art.setAttribute('aria-hidden','true');
 veil.appendChild(art);
 const bar=document.createElement('div');bar.className='wyrdfluxStartupTrack';
 const fill=document.createElement('span');fill.id='wyrdfluxStartupFill';fill.style.width='12%';
 bar.appendChild(fill);inner.append(title,detail,bar);veil.appendChild(inner);
 document.body.appendChild(veil);return {veil,detail,fill,startedAt};
}
function finishWyrdfluxStartupLoading(screen){
 if(!screen)return;
 screen.fill.style.width='47%';
 screen.detail.textContent='WORLD BUILT · WARMING THE GPU AND PLAYER VIEW';
 let checks=0;
 function frame(){
  if(!screen.veil.isConnected)return;
  checks++;
  try{
   // Actually draw the freshly built sector behind the loading veil.
   if(player&&phase!=='menu')render();
   wyrdfluxStartupFrames++;
   screen.fill.style.width=(checks===1?'78':'100')+'%';
   const hasWorld=player&&Number.isFinite(player.x)&&Number.isFinite(player.z)&&
     (staticGPU.count>0||afterlightMeadowActive()||livingRealm.active)&&world.width>0&&world.height>0;
   if(checks<2){requestAnimationFrame(frame);return;}
   wyrdfluxStartupValidated=!!hasWorld&&!gl.isContextLost()&&gl.getError()===gl.NO_ERROR;
   screen.detail.textContent=wyrdfluxStartupValidated?'WORLD AND PLAYER READY · ENTERING':
     'GPU VALIDATION FAILED · ENTERING COMPATIBILITY MODE';
   if(!wyrdfluxStartupValidated)notice('WORLD GPU CHECK FAILED · USE PC ULTRA OR REPORT THIS BUILD',4);
   const remaining=Math.max(0,4000-(performance.now()-screen.startedAt));
   setTimeout(()=>{
    if(!screen.veil.isConnected)return;
    screen.veil.classList.add('wyrdfluxStartupComplete');
    setTimeout(()=>screen.veil.remove(),360);
   },remaining);
  }catch(err){
   wyrdfluxStartupValidated=false;
   screen.detail.textContent='SCENE PREPARATION FAILED · '+String(err?.message||err).slice(0,90);
   console.error('WYRDFLUX_STARTUP_GPU_PREPARE_FAILED',err);
   // Show the actual failure rather than abruptly exposing an uninitialized map.
  }
 }
 requestAnimationFrame(frame);
}
function startGame(resume=false){const startupScreen=beginWyrdfluxStartupLoading(resume);testLabMode=null;introCine.active=false;resetGame();let pendingUpgrade=false,resumeHell=null,resumeHeaven=null,resumeBlock=null;if(!resume){meta.runs++;evaluateMetaUnlocks();}if(resume){try{const save=JSON.parse(localStorage.getItem('su2-save'));if(save?.player&&save.wave>0){wyrdfluxRunPickups=Array.isArray(save.wyrdfluxRunPickups)?save.wyrdfluxRunPickups.slice(-256):[];pendingUpgrade=save.phase==='upgrade';worldRelicOffer=typeof save.worldRelicOffer==='string'?save.worldRelicOffer:null;livingRealm.pending=LIVING_REALM_INFO[save.livingRealmPending]?save.livingRealmPending:null;livingRealm.lastEventWave=Math.max(0,Number(save.livingLastEventWave)||0);meadowEpisodeResume=!!save.meadowEpisodeActive;hellBreach.conqueredThisRun=!!save.hellBreach?.conqueredThisRun;resumeHell=save.hellBreach&&['gate','pending','active'].includes(save.hellBreach.state)?save.hellBreach:null;
resumeHeaven=save.heavenSanctum&&['gate','active'].includes(save.heavenSanctum.state)?save.heavenSanctum:null;
resumeBlock=save.blockworld&&['trigger','shift','active'].includes(save.blockworld.state)?save.blockworld:null;runRecord={...defaultRunRecord(),...(save.runRecord||{})};runLevel={...defaultRunLevel(),...(save.runLevel||{})};bossShopDue=Math.max(0,Number(save.bossShopDue)||0);bossShopOpen=!!save.bossShopOpen;bossShopVisited=Math.max(0,Number(save.bossShopVisited)||0);wyrdfluxSecrets={thirteen:false,emberstep:false,...(save.wyrdfluxSecrets||{})};
 blackwake={...freshBlackwake(),...(save.blackwake||{})};
 if(blackwake.state==='active')blackwake.state='done';
 if(save.circus&&['toy','armed','puzzle','gate','done'].includes(save.circus.state)){
  circus={...freshCircus(),...save.circus,returnState:null};
  if(circus.state==='toy'||circus.state==='armed')circus.state='done';
 }
 upgradeDraftKind=['kill','shop','bossreward'].includes(save.upgradeDraftKind)?save.upgradeDraftKind:'wave';player={...defaultPlayer(),...save.player};player.perks={...(save.player.perks||{})};player.fusions=activeFusions().map(f=>f.id);wave=save.wave;sector=save.sector||0;kills=save.kills||0;totalScore=save.totalScore||0;WEAPONS.push(...(Array.isArray(save.fusedWeapons)?save.fusedWeapons.slice(0,128).filter(w=>w&&w.fusedWeapon&&Number.isFinite(w.dmg)&&w.fusionDepth):[]));gun=save.gun||0;activeGun=Array.from({length:WEAPONS.length},(_,i)=>!!save.activeGun?.[i]);if(!activeGun.some(Boolean))activeGun[0]=true;gun=activeGun[save.gun]?save.gun:activeGun.findIndex(Boolean);mixGun=-1;wyrdfluxPrimarySlot=Number.isInteger(save.wyrdfluxPrimarySlot)?save.wyrdfluxPrimarySlot:-1;wyrdfluxSecondarySlot=Number.isInteger(save.wyrdfluxSecondarySlot)?save.wyrdfluxSecondarySlot:0;if(save.schema<4){player.x=C+(player.x-10.5)*1.5;player.z=C+(player.z-10.5)*1.5;}
relayState=Object.fromEntries(RELAYS.map(r=>[r.id,!!save.relayState?.[r.id]]));coreOnline=!!save.coreOnline;
if(!Number.isFinite(player.x)||!Number.isFinite(player.z)||!free(player.x,player.z,.26)){player.x=C;player.z=24.5}player.hp=clamp(Number(player.hp)||100,1,Math.max(100,player.maxHp));player.height=0;player.verticalVel=0;}}catch(_){}}
 phase='play';showScreen(null);overlayPlay(true);world.focus();if(resume&&wave>0){sector=0;beginWave(wave,true);player.x=clamp(player.x,1.5,N-1.5);player.z=clamp(player.z,1.5,N-1.5);if(!free(player.x,player.z,.3)){player.x=C;player.z=24.5}}else beginWave(1);hudWeapon();resize();savePrefs();if(pendingUpgrade){phase='play';if(upgradeDraftKind==='shop'&&bossShopOpen){
  // A saved merchant visit is a combat-free intermission. beginWave() rebuilds
  // its spawn queue on resume; discard that queue before restoring the shop.
  spawnPending=0;spawnClock=0;enemies.length=0;projectiles.length=0;
  presentBossShop();
 }else if(upgradeDraftKind==='kill')presentUpgradeDraft('kill');
 else if(upgradeDraftKind==='bossreward')presentBossVictoryReward();
 else presentUpgradeDraft('wave');}
 else if(resumeBlock?.state==='active'){
  blockworld={...blockworld,...resumeBlock,state:'shift'};
  beginBlockworld(resumeBlock);
 }else if(resumeBlock?.state==='trigger'||resumeBlock?.state==='shift'){
  blockworld={...blockworld,...resumeBlock,state:'trigger',transition:0};
  spawnPending=0;enemies=[];
  const gate=makeBlockworldEnemy('creeper',randomOpen(6),true);
  if(gate){gate.appearT=0;enemies.push(gate);}
 }else if(resumeHeaven?.state==='active'){
  heavenSanctum={...heavenSanctum,...resumeHeaven,state:'gate'};
  beginHeavenSanctum(resumeHeaven);
 }else if(resumeHeaven?.state==='gate'){
  heavenSanctum={...heavenSanctum,...resumeHeaven,state:'gate'};
  enemies=[];spawnPending=0;
 }else if(resumeHell?.state==='active'){
  hellBreach={...hellBreach,...resumeHell,state:'gate'};
  beginHellBreach(resumeHell);
 }else if(resumeHell?.state==='gate'||resumeHell?.state==='pending'){
  hellBreach={...hellBreach,...resumeHell,state:'pending'};
  enemies=[];spawnPending=0;openHellGate();
 }
 finishWyrdfluxStartupLoading(startupScreen);
}

// Original tiered counter art. It uses local CSS geometry, no remote fonts.
function paintWyrdfluxWaveCounter(aboutToStart=false){
 if(!desktopPC)return;
 let el=document.getElementById('wyrdfluxWaveCrown');
 if(!el){
  el=document.createElement('aside');el.id='wyrdfluxWaveCrown';
  el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  const label=document.createElement('small'),number=document.createElement('strong'),
    lower=document.createElement('span');
  label.className='waveCrownLabel';number.className='waveCrownNumber';
  lower.className='waveCrownNext';el.append(label,number,lower);
  document.body.append(el);
 }
 const local=localWaveOf(wave),cycle=cycleOf(wave);
 const nextLocal=local===CAMPAIGN_WAVES?1:local+1,nextCycle=local===CAMPAIGN_WAVES?cycle+1:cycle;
 const level=cycle>=5?'unstable':cycle>=3?'fractured':cycle>=2?'charged':'calm';
 el.dataset.intensity=level;
 el.dataset.phase=aboutToStart?'next':'live';
 el.querySelector('small').textContent=aboutToStart?'COMING UP':'SURVIVE THE WAVE';
 el.querySelector('strong').textContent='WAVE '+String(local).padStart(2,'0');
 el.querySelector('span').textContent='NEXT '+String(nextLocal).padStart(2,'0')+
  (nextCycle!==cycle?' · NEW LOOP '+nextCycle:'')+(cycle>1?' · LOOP '+cycle:'');
 el.classList.remove('waveCrownPulse');
 void el.offsetWidth;el.classList.add('waveCrownPulse');
}
function beginWave(n,resuming=false){resetWyrdfluxShadowReplay();puppetFinale.active=false;
 wave=Math.max(1,Math.floor(n));waveKillsStart=kills;waveDamageTaken=0;waveStartedAt=time;
 if(!resuming){runLevel.waveEarned=0;runLevel.roundDraftsClaimed=0;}
 const loop=cycleOf(wave),local=localWaveOf(wave),difficulty=cycleDifficulty(wave);
 const restarting=!resuming&&loop>1&&local===1;
 const oldSector=sector,wasMeadow=meadowEpisodeActive;
 sector=Math.floor((local-1)/3);
 // Standard campaign nonboss waves only; persistent resume never rerolls.
 const eligible=!testLabMode&&local>1&&local%3!==0&&
  typeof window.VEILFORGE_MEADOW_GPU?.load==='function'&&
  typeof createMeadowMap==='function'&&
  hellBreach.state==='none'&&heavenSanctum.state==='none'&&blockworld.state==='none';
 meadowEpisodeActive=resuming?meadowEpisodeResume:!!(eligible&&rnd()<MEADOW_WAVE_CHANCE);
 meadowEpisodeResume=false;
 if(!resuming){
  livingRealm.pending=null;
  const eligibleLiving=!testLabMode&&local>2&&local%3!==0&&
   !meadowEpisodeActive&&!restarting&&wave>livingRealm.lastEventWave+1&&
   hellBreach.state==='none'&&heavenSanctum.state==='none'&&blockworld.state==='none';
  if(eligibleLiving){
   const roll=rnd();
   const wanted=roll<.01?'library':roll<.03?'greenhouse':roll<.06?'witch':null;
   if(wanted&&(wanted!=='greenhouse'||!livingFireEquipped())&&
     !(circus.seen&&circus.toyRealm===wanted)&&livingAssetReady(wanted)){
    livingRealm.pending=wanted;livingRealm.lastEventWave=wave;
   }
  }
 }
 if(meadowEpisodeActive){
  meadowEpisodeCount++;
  stylePreviewId='sunlit-meadow';
  document.body.classList.add('meadow-magic-mode');
  window.VEILFORGE_MEADOW_GPU?.load?.(gl);
  afterlightWorldLoading('A MEADOW RIFT OPENS');
 }else if(wasMeadow||stylePreviewId==='sunlit-meadow'||document.body.classList.contains('meadow-magic-mode')){
  clearMeadowWorldVisuals();
 }
 if(restarting){
  // New world loop, same character. Keep perks/fusions/loadout/salvage and
  // cumulative kills, but reset map objectives and reposition the player.
  relayState={};coreOnline=false;interactProgress=0;
  player.x=C;player.z=24.5;player.vx=0;player.vz=0;
  player.height=0;player.verticalVel=0;
  player.hp=Math.min(player.maxHp,player.hp+Math.max(10,player.maxHp*.28));
  player.shield=Math.min(player.maxShield,player.shield+Math.max(5,player.maxShield*.48));
  player.phoenixUsed=false;
 }
 if(sector!==oldSector||restarting||wasMeadow!==meadowEpisodeActive){
  createMap(sector);if(meadowEpisodeActive)createMeadowMap();buildStatic();
  if(!free(player.x,player.z,.29)){
   player.x=C;player.z=24.5;player.vx=0;player.vz=0;
  }
  if(!restarting)announce('NEW SECTOR // '+SECTOR_THEMES[sector].name,3);
 }
 // Bound concurrent enemy creation for phone performance even after 100 loops.
 spawnPending=Math.min(54,5+Math.floor(local*1.6)+Math.floor(local/3)+difficulty.extra);
 spawnClock=.15;
 enemies.length=0;projectiles.length=0;wyrdfluxContactFX=[];pickups.length=0;heatMarks=[];heatNextHit=0;
 if(!resuming&&!restarting){
  player.shield=Math.min(player.maxShield,player.shield+4+stacks('armorwhip')*8);
  player.hp=Math.min(player.maxHp,player.hp+2);
 }
 phase='play';
 wyrdfluxSelectAnomaly(resuming);
 paintWyrdfluxWaveCounter();
  if(restarting)announce('ENDLESS CYCLE '+loop+' // HOSTILES EVOLVED',3.6);
 else announce(meadowEpisodeActive?'MEADOW RIFT // BONUS WORLD':`WAVE ${String(local).padStart(2,'0')} // ${SECTORS[sector]}`,2.7);
 updateHUD();saveCheckpoint();
}

const BOSS_CLASSES=['warden','behemoth','overseer','colossus','warden','behemoth','puppet'];
// Iron Warden is unlocked for regular campaign bosses after the first finale.
function wyrdfluxCampaignBossType(waveNumber,sectorIndex){
 const type=BOSS_CLASSES[sectorIndex]||'behemoth';
 return type==='warden'&&cycleOf(waveNumber)===1?
  (sectorIndex===0?'behemoth':'overseer'):type;
}
let hellBreach={state:'none',stage:0,stages:3,kills:0,gateX:C,gateZ:2.25,
 returnWave:0,returnSector:0,reward:0,transition:0,encountered:false,conqueredThisRun:false};
let heavenSanctum={state:'none',gateX:C,gateZ:C,returnWave:0,returnSector:0,entered:0};

/* AFTERLIGHT v0.42 — standalone, offline BLOCKWORLD anomaly.
 * Familiar Minecraft-style voxel geometry and behavior are original mesh code,
 * not downloaded Mojang textures, official game files, or music.
 * Classic Steve dimensional proportions 8x8x8 head / 8x12x4 body /
 * 4x12x4 limbs guide the zombie and skeleton rigs.
 */
const BLOCKWORLD_SPAWN_CHANCE=.0005;
let blockworld={state:'none',stage:0,returnWave:0,returnSector:0,transition:0,found:false,
 triggers:0,creepersExploded:0,wardenBooms:0,stormCount:0,stormCooldown:4.2,stormStrikes:[],burns:[],lavaBlocks:[],lavaNextHit:0,stormDamageBaseline:0};
const BLOCKWORLD_MOBS=['zombie','spider','skeleton','creeper'];
const BLOCKWORLD_DATA={
 creeper:{hp:85,speed:.89},zombie:{hp:95,speed:.72},
 spider:{hp:75,speed:1.64},skeleton:{hp:78,speed:.90},
 warden:{hp:2700,speed:1.03}
};
function makeBlockworldEnemy(kind,pos,trigger=false){
 const spec=BLOCKWORLD_DATA[kind];if(!spec)return null;
 const e=newEnemy(pos,false),difficulty=cycleDifficulty(wave);
 e.type='pixel'+kind;e.blockKind=kind;e.blockTrigger=trigger;
 e.boss=kind==='warden';e.hp=e.maxHp=spec.hp*(1+(localWaveOf(wave)-1)*.06)*difficulty.hp;
 e.speed=spec.speed*Math.min(1.45,difficulty.speed);
 e.appearT=trigger?0:.38;e.attackT=kind==='skeleton'?1.7:1.0;
 e.facing=0;e.blockFuse=0;e.blockCharge=0;e.blockLeap=0;
 e.blockBoomUntil=0;e.blockAttack='idle';e.blockClock=2.1;
 return e;
}
function createBlockworldMap(){
 map.length=0;
 for(let z=0;z<N;z++){
  const row=[];
  for(let x=0;x<N;x++){
   const perimeter=x===0||z===0||x===N-1||z===N-1;
   const pillar=(x===5||x===N-6)&&(z===5||z===N-6);
   const ruin=(z===8||z===N-9)&&(x===9||x===N-10);
   row.push(perimeter||pillar||ruin?1:0);
  }
  map.push(row);
 }
}
function buildBlockworldStatic(){
 const m=new Mesh(),high=$('quality').value==='high',
   boss=blockworld.stage>=3;
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){
  const h=(x*43+z*17)%13,wall=!!map[z][x],px=x+.5,pz=z+.5;
  m.box(px,-.41,pz,1,.80,1,boss?'blocksculk':'blockdirt');
  if(wall){
   m.box(px,1.3,pz,.995,2.60,.995,boss?'blockdeepslate':'blockstone');
   m.box(px,2.60,pz,1.01,.13,1.01,boss?'blocksculk':(h%4===0?'blockmoss':'blockgrass'));
   if(h%5===0)m.box(px,1.66,pz+.504,.38,.38,.022,boss?'blockcyan':'blockore',boss?.25:.07);
  }else{
   m.box(px,-.005,pz,.98,.023,.98,boss?(h<4?'blocksculk':'blockdeepslate'):(h%5===0?'blockgrass2':'blockgrass'));
   if(!boss&&h%7===0)m.box(px,.003,pz,.32,.007,.29,'blockgrass2');
   if(boss&&h%11===0)m.box(px,.018,pz,.30,.033,.30,'blockcyan',.28);
  }
 }
 // Vertical chunks of actual voxel-looking rock; all solid props sit over
 // collision-backed floor blocks, with a broad central combat corridor.
 for(const [x,z] of [[3.5,3.5],[27.5,4.5],[3.5,26.5],[27.5,26.5],[7.5,5.5],[23.5,24.5]]){
  for(let y=1;y<=4;y++)m.box(x,y,z,.96,1,.96,boss?'blockdeepslate':'blocklog');
  if(!boss){
   for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
    m.box(x+dx,4.6,z+dz,1.03,1.02,1.03,'blockleaf');
    if(high&&dx===0&&dz===0)m.box(x+dx,5.6,z+dz,.91,.95,.91,'blockleaf2');
   }
  }else{
   m.box(x,4.5,z,.55,.5,.55,'blockcyan',.15);
  }
 }
 // Recognizable four-sided cube-shaped torches and glowing ore deposits.
 for(const [x,z] of [[5.5,8.5],[25.5,8.5],[5.5,22.5],[25.5,22.5]]){
  m.box(x,1.25,z,.13,.85,.13,boss?'blockcyan':'blocklog');
  m.box(x,1.72,z,.22,.20,.22,boss?'blockcyan':'blocktorch',boss?1.8:1.9);
  if(high)for(let k=0;k<3;k++)m.box(x+.13*Math.sin(k*2),1.87+k*.15,z+.08*Math.cos(k*2),
   .07,.065,.07,boss?'blockcyan':'blocktorch',.6);
 }
 // Full roof / sky changes; no color-only re-skin of the regular arena.
 for(let z=0;z<N;z+=2)for(let x=0;x<N;x+=2){
  if((x*11+z*3)%5===0&&!boss)continue;
  m.box(x+1,7.4,z+1,2,.22,2,boss?'blockdeepslate':'blocksky');
 }
 m.box(C,-1.1,C,150,.38,150,boss?'blockdeepslate':'blockdirt');
 upload(staticGPU,m.data);
}
function drawBlockworldAtmosphere(m,p,q){
 if(blockworld.state!=='active')return;
 const boss=blockworld.stage===3,cap=q==='battery'?8:q==='high'?44:22;
 for(let i=0;i<cap;i++){
  const x=2+(i*8.37)%27,z=2+(i*5.83)%27,y=.32+((i*.37+time*(boss?.18:.065))%4);
  if(Math.hypot(x-p.x,z-p.z)>19||tile(x,z))continue;
  m.box(x,y,z,boss?.06:.043,boss?.06:.043,boss?.06:.043,
   boss?'blockcyan':'blocktorch',boss?.56:.07);
 }

 // Persistent soot and spreading cubic lava are geometry-based, not an
 // opaque screen overlay; low quality caps the number of visible hazards.
 if(boss){
  const burns=(blockworld.burns||[]),lava=(blockworld.lavaBlocks||[]);
  const max=q==='battery'?24:q==='balanced'?48:88;
  for(const tileMark of burns.slice(-max)){
   if(Math.hypot(tileMark.x+.5-p.x,tileMark.z+.5-p.z)>17)continue;
   m.box(tileMark.x+.5,.028,tileMark.z+.5,.91,.026,.91,'charcoal',.11);
   m.box(tileMark.x+.5,.044,tileMark.z+.5,.33,.013,.36,'blockdeepslate',.04);
  }
  for(const hot of lava.slice(-max)){
   if(hot.readyAt>time||Math.hypot(hot.x+.5-p.x,hot.z+.5-p.z)>17)continue;
   const pulse=.35+.22*Math.sin(time*4+hot.x*2+hot.z);
   m.box(hot.x+.5,.07,hot.z+.5,.93,.11,.93,'magma',.28+pulse);
   m.box(hot.x+.5,.135,hot.z+.5,.40,.02,.47,'orange',.48+pulse);
   if(q!=='battery'){
    m.box(hot.x+.5,.16,hot.z+.5,.22,.015,.23,'gold',.3+pulse);
   }
  }
  for(const strike of (blockworld.stormStrikes||[]).slice(-12)){
   if(Math.hypot(strike.x-p.x,strike.z-p.z)>18)continue;
   if(strike.t>0){
    const warn=clamp(1-strike.t/1.55,0,1);
    m.box(strike.x,.055,strike.z,1.65,.033,1.65,'blockcyan',.07+.34*warn);
    m.box(strike.x,.082,strike.z,.44,.018,.44,'white',.18+.42*warn);
   }else if(strike.impactUntil>time){
    const power=clamp((strike.impactUntil-time)/.32,0,1);
    let ox=strike.x,oy=6.75,oz=strike.z;
    for(let j=1;j<=7;j++){
     const t=j/7,xx=strike.x+(j===7?0:Math.sin(j*4+time*37)*.20);
     const zz=strike.z+(j===7?0:Math.cos(j*3+time*24)*.18),yy=6.75-6.58*t;
     m.beam(ox,oy,oz,xx,yy,zz,.045+.085*power,j%3?'blockflash':'blockcyan',1.9*power);
     ox=xx;oy=yy;oz=zz;
    }
    m.box(strike.x,.13,strike.z,1.55,.16,1.55,'white',1.1*power);
   }
  }
 }
 if(blockworld.transition>0){
  const flash=clamp(blockworld.transition/1.25,0,1);
  for(let i=0;i<(q==='battery'?18:54);i++){
   const a=i*2.39996,r=.3+(i%7)*.29;
   m.box(p.x+Math.cos(a)*r,1.1+(i%6)*.19,p.z+Math.sin(a)*r,
    .10+flash*.11,.11+flash*.11,.10+flash*.11,i%2?'blockgrass':'white',flash*1.25);
  }
 }
}
function blockworldShift(e){
 if(blockworld.state!=='trigger')return false;
 blockworld.state='shift';blockworld.transition=1.3;
 blockworld.creepersExploded++;blockworld.found=true;
 spawnPending=0;enemies=[];projectiles=[];lingeringBeams=[];
 inputs.shoot=false;inputs.fire=null;
 burst(e.x,e.z,'blockgrass',4.3);spark(e.x,e.z,'blockgrass',35);
 shake=Math.max(shake,.19);
 sound('blockshift');
 announce('BLOCKWORLD BREACH // THE ROOM HAS CHANGED',4.0);
 notice('CREEPER ANOMALY · ZERO EXPLOSION DAMAGE',3.5);
 saveCheckpoint();return true;
}
function beginBlockworld(restored=null){
 if(!restored&&!['shift','trigger'].includes(blockworld.state))return false;
 const old={...blockworld},stage=Math.max(1,Math.min(3,restored?.stage||1));
 blockworld={...old,...(restored||{}),state:'active',stage,
  returnWave:restored?.returnWave||old.returnWave||wave,
  returnSector:restored?.returnSector??old.returnSector??sector,transition:0,found:true};
 enemies=[];spawnPending=0;projectiles=[];pickups=[];tracers=[];lingeringBeams=[];
 player.x=C;player.z=N-5;player.vx=0;player.vz=0;player.height=0;player.verticalVel=0;
 inputs.shoot=false;inputs.fire=null;
 createBlockworldMap();buildStatic();
 beginBlockworldStage(stage);
 sound('blockenter');
 announce('BLOCKWORLD BREACH // PIXEL DIMENSION',4);
 notice('SURVIVE THE MONSTERS · DEFEAT THE WARDEN',4);
 saveCheckpoint();return true;
}
function beginBlockworldStage(stage){
 if(blockworld.state!=='active')return;
 blockworld.stage=stage;enemies=[];projectiles=[];spawnPending=0;
 if(stage===3){
  blockworld.stormCount=0;blockworld.stormCooldown=4.3;
  blockworld.stormStrikes=[];blockworld.burns=[];blockworld.lavaBlocks=[];
  blockworld.lavaNextHit=0;blockworld.stormDamageBaseline=runRecord.damageEvents;
  buildStatic();
  const e=makeBlockworldEnemy('warden',bossSpawnClearance());
  e.blockClock=2.3;e.attackT=1.9;e.appearT=0;
  e.damageAtSpawn=runRecord.damageEvents;
  enemies.push(e);
  sound('warden');
  beginBossIntro(e);
  announce('THE WARDEN // DARKNESS HAS AWAKENED',4);
  return;
 }
 const count=stage===1?9:12;
 for(let i=0;i<count;i++){
  const kind=BLOCKWORLD_MOBS[(i*7+stage*3)%4];
  const pos=randomOpen(7),e=makeBlockworldEnemy(kind,pos);
  if(e)enemies.push(e);
 }
 announce('BLOCKWORLD TRIAL '+stage+' / 3 · '+count+' MONSTERS',3.5);
}
function finishBlockworld(){
 if(blockworld.state!=='active')return false;
 blockworld.state='none';blockworld.transition=0;enemies=[];spawnPending=0;
 projectiles=[];pickups=[];lingeringBeams=[];
 if(testLabMode){trialFinish(true);return true;}
 meta.blockworldClears=(meta.blockworldClears||0)+1;
 awardPermanent('blockworld');
 meta.xp+=5000+cycleOf(wave)*850;saveMeta();evaluateMetaUnlocks();
 const payout=Math.round((2200+cycleOf(wave)*680)*(1+permanentStats().loot));
 player.cash+=payout;totalScore+=12000+cycleOf(wave)*2000;
 player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.45);
 player.shield=player.maxShield;player.x=C;player.z=8.5;
 createMap(sector);buildStatic();announce('BLOCKWORLD CLEARED // A PERMANENT GIFT',4);
 notice('WARDEN DEFEATED · +'+payout+' SALVAGE · PASSIVE AWARDED',4);
 queueWorldRelic('blockworld');saveCheckpoint();waveComplete();return true;
}
function blockworldCreeperTick(e,dt,dx,dz,dist){
 const near=dist<2.65&&lineClear(e.x,e.z,player.x,player.z);
 e.blockFuse=clamp((e.blockFuse||0)+(near?dt:-dt*1.8),0,1.5);
 if(near&&e.blockFuse<1.5&&e.blockFuse>.08&&Math.floor((e.blockFuse-dt)*4)!==Math.floor(e.blockFuse*4))
  sound('creeperhiss');
 if(e.blockFuse>=1.5){
  if(!e.blockTrigger&&dist<3.15)hitPlayer(14);
  damageEnemy(e,e.hp+10000,'creeper-fuse');
  return;
 }
 e.moveSpeed=0;
 if(dist>2.12&&dist<30){
  const ox=e.x,oz=e.z,speed=e.speed*dt;
  collisionMove(e,dx/Math.max(.1,dist)*speed,dz/Math.max(.1,dist)*speed,.29);
  e.moveSpeed=Math.hypot(e.x-ox,e.z-oz)/Math.max(.001,dt);
  e.bob+=dt*(e.moveSpeed>0?7:0);
 }
 enemyTurnToward(e,dx,dz,dt,4);
}

/* Escalating Warden storm: first volley scars the ground, second volley
 * ignites existing strikes into bounded spreading lava. Retain walkable lanes,
 * telegraph every impact, cap dynamic GPU geometry and save hazard state. */
function blockworldBurn(x,z,makeLava=false){
 const gx=Math.floor(x),gz=Math.floor(z);
 if(gx<2||gz<2||gx>N-3||gz>N-3||tile(gx+.5,gz+.5))return;
 blockworld.burns||(blockworld.burns=[]);
 if(!blockworld.burns.some(t=>t.x===gx&&t.z===gz))
  blockworld.burns.push({x:gx,z:gz});
 if(blockworld.burns.length>88)blockworld.burns.shift();
 if(makeLava)blockworldLavaSeed(gx,gz);
}
function blockworldLavaSeed(x,z){
 const pool=blockworld.lavaBlocks||(blockworld.lavaBlocks=[]);
 const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2],[-2,0],[0,-2]];
 for(let i=0;i<offsets.length&&pool.length<70;i++){
  const nx=x+offsets[i][0],nz=z+offsets[i][1];
  if(nx<2||nz<2||nx>N-3||nz>N-3||tile(nx+.5,nz+.5))continue;
  if(pool.some(t=>t.x===nx&&t.z===nz))continue;
  pool.push({x:nx,z:nz,readyAt:time+.35+i*.32});
 }
}
function blockworldStormTick(dt){
 if(blockworld.state!=='active'||blockworld.stage!==3)return;
 // Multiple Wardens can call this in one simulation frame; hazards advance once.
 if(blockworld.stormLastTickAt===time)return;
 blockworld.stormLastTickAt=time;
 blockworld.stormStrikes||(blockworld.stormStrikes=[]);
 blockworld.burns||(blockworld.burns=[]);
 blockworld.lavaBlocks||(blockworld.lavaBlocks=[]);
 blockworld.stormCooldown=(blockworld.stormCooldown??4.3)-dt;
 if(blockworld.stormCooldown<=0){
  blockworld.stormCount=(blockworld.stormCount||0)+1;
  blockworld.stormCooldown=6.2;
  const count=blockworld.stormCount===1?7:9;
  for(let i=0;i<count;i++){
   const angle=i*TAU/count+blockworld.stormCount*.71,ring=i<3?2.5:6.0+(i%3)*1.45;
   let x=clamp(player.x+Math.cos(angle)*ring,2.4,N-2.4);
   let z=clamp(player.z+Math.sin(angle)*ring,2.4,N-2.4);
   if(tile(x,z)){const pos=randomOpen(5);x=pos.x;z=pos.z;}
   // Include this frame's dt: the processing loop below subtracts dt immediately.
   // Preserve the full visible 1.1s minimum dodge warning on the first strike.
   blockworld.stormStrikes.push({x,z,t:1.1+i*.105+dt,hit:false,impactUntil:0});
  }
  if(blockworld.stormCount>=2){
   for(const old of blockworld.burns.slice(0,12))blockworldLavaSeed(old.x,old.z);
   announce('WARDEN STORM II // THE SCARS TURN TO LAVA',3.4);
  }else announce('WARDEN STORM // WATCH THE GROUND',3.0);
  notice('LIGHTNING MARKERS · DODGE BEFORE IMPACT',2.2);
 }
 for(const strike of blockworld.stormStrikes){
  strike.t-=dt;
  if(strike.hit||strike.t>0)continue;
  strike.hit=true;strike.impactUntil=time+.32;
  blockworldBurn(strike.x,strike.z,blockworld.stormCount>=2);
  const radius=1.13;
  if(Math.hypot(player.x-strike.x,player.z-strike.z)<radius)hitPlayer(17);
  burst(strike.x,strike.z,'blockcyan',radius,.36);
  spark(strike.x,strike.z,'blockflash',16);
  shake=Math.max(shake,.11);sound('sonicboom');
 }
 blockworld.stormStrikes=blockworld.stormStrikes.filter(t=>t.t>-.68);
 const hot=blockworld.lavaBlocks.find(t=>t.readyAt<=time&&
  Math.abs(player.x-(t.x+.5))<.51&&Math.abs(player.z-(t.z+.5))<.51);
 if(hot){
  if(player.dashT>0&&!wyrdfluxSecrets.emberstep&&blockworld.stormCount>=2&&
    runRecord.damageEvents===blockworld.stormDamageBaseline){
   wyrdfluxSecrets.emberstep=true;player.cash+=777;player.energy=100;
   player.shield=Math.min(player.maxShield,player.shield+75);
   rememberWyrdfluxRunItem('HIDDEN EASTER EGG','EMBERSTEP','Unhurt through two storms, dash over living lava · +777 salvage');
   announce('EMBERSTEP // THE LAVA REMEMBERS YOU',4);
   notice('SECRET DISCOVERED · +777 SALVAGE · STAMINA RESTORED',3.5);
  }
  if(time>=(blockworld.lavaNextHit||0)&&player.dashT<=.12){
   blockworld.lavaNextHit=time+.65;hitPlayer(9);
   if(time%2<.7)notice('LAVA IS SPREADING · KEEP MOVING',1.1);
  }
 }
}
function blockworldEnemyTick(e,dt){
 const kind=e.blockKind;if(!kind)return false;
 if(e.hp<=0)return true;
 e.hit=Math.max(0,e.hit-dt);e.attackT-=dt;
 e.blockLeap=Math.max(0,e.blockLeap-dt);
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);
 if(kind==='creeper'){blockworldCreeperTick(e,dt,dx,dz,dist);return true;}
 enemyTurnToward(e,dx,dz,dt,kind==='warden'?2.5:5.0);
 const warden=kind==='warden',skeleton=kind==='skeleton',
  spider=kind==='spider',range=warden?2.35:skeleton?7.5:spider?1.45:1.17;
 if(warden){
  blockworldStormTick(dt);
  if(e.blockAttack==='charge'){
   e.blockClock-=dt;
   if(e.blockClock<=0){
    e.blockAttack='recover';e.blockClock=1.3;e.blockBoomUntil=time+.32;
    if(dist<=14)hitPlayer(18); // Warden's sonic boom ignores obstructing walls
    blockworld.wardenBooms++;sound('sonicboom');
    burst(e.x,e.z,'blockcyan',2.3);
   }
   return true;
  }
  if(e.blockAttack==='recover'){
   e.blockClock-=dt;if(e.blockClock<=0){e.blockAttack='idle';e.blockClock=4.1;}
   return true;
  }
  e.blockClock-=dt;
  if(dist>3.5&&dist<14&&e.blockClock<=0){
   e.blockAttack='charge';e.blockClock=1.7;notice('WARDEN // SONIC BOOM CHARGING',1.8);
   sound('warden');return true;
  }
 }
 if(skeleton&&e.attackT<=0&&dist<13&&lineClear(e.x,e.z,player.x,player.z)){
  const a=Math.atan2(dx,-dz),vel=6.9;
  projectiles.push({x:e.x+Math.sin(a)*.5,y:1.35,z:e.z-Math.cos(a)*.5,
   vx:Math.sin(a)*vel,vz:-Math.cos(a)*vel,life:4.2,col:'blockbone',
   damage:11,blockArrow:true});
  if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
  e.attackT=2.1;sound('arrow');e.moveSpeed=0;return true;
 }
 if(!skeleton&&e.attackT<=0&&dist<range){
  e.attackT=warden?1.8:spider?.87:1.25;
  if(spider)e.blockLeap=.48;
  hitPlayer(warden?22:spider?9:11);
  shake=Math.max(shake,warden?.12:.04);
  e.moveSpeed=0;return true;
 }
 const chase=(skeleton?dist<4.6?-.55:dist>8.4?1:0:dist>range*.85?1:0);
 if(chase&&dist<29){
  const ox=e.x,oz=e.z,velocity=e.speed*dt*chase;
  collisionMove(e,dx/Math.max(.1,dist)*velocity,dz/Math.max(.1,dist)*velocity,
   warden?.65:spider?.49:.29);
  e.moveSpeed=Math.hypot(e.x-ox,e.z-oz)/Math.max(dt,.001);
  e.bob+=dt*(e.moveSpeed>0?(spider?14:warden?4.0:7.5):0);
 }else e.moveSpeed=0;
 return true;
}

let wallMawCasts=0,hellFiendsFought=0,hellCompleted=0,hellFootprints=[];
const BOSS_NAMES={pixelwarden:'THE WARDEN // DEEP DARK',warden:'IRON WARDEN',behemoth:'SIEGE BEHEMOTH',overseer:'HIVE OVERSEER',colossus:'NULL COLOSSUS',puppet:'THE NULL PUPPET',wallmaw:'THE WALL MAW',ophanim:'THE OPHANIM // MANY-EYED THRONE',traveler:'THE TRAVELER'};
const BOSS_REVEALS={
 pixelwarden:{title:'THE DEEP DARK HEARS YOU',line:'THE HEARTBEAT IN THE STONE',col:'blockcyan',angle:1.2,spin:.42,rad:6.8,height:3.6},
 warden:{title:'IRON PROTOCOL',line:'THE GATEKEEPER AWAKENS',col:'purple',angle:-1.5,spin:1.2,rad:5.8,height:3.6},
 behemoth:{title:'SIEGE PROTOCOL',line:'THE GROUND WILL TREMBLE',col:'orange',angle:.5,spin:-1.1,rad:6.4,height:3.2},
 overseer:{title:'HIVE PROTOCOL',line:'A THOUSAND EYES ARE WATCHING',col:'green',angle:-2,spin:2.1,rad:6,height:5.2},
 colossus:{title:'NULL PROTOCOL',line:'THE FINAL SIGNAL DESCENDS',col:'red',angle:1.3,spin:2.3,rad:7.6,height:6.5},
 puppet:{title:'THE END OF THE MACHINE',line:'SEVER THE ARMS. EXPOSE THE MIND.',col:'red',angle:.9,spin:2.1,rad:8.2,height:5.7},
 wallmaw:{title:'THE WALL IS ALIVE',line:'THE ABYSS HAS A FACE',col:'red',angle:1.25,spin:.9,rad:7.1,height:3.4},
 ophanim:{title:'BE NOT AFRAID',line:'THE WHEELS HAVE OPENED THEIR EYES',col:'gold',angle:1.0,spin:.45,rad:7.4,height:4.7},
 traveler:{title:'THE TRAVELER',line:'ITS SECOND SKY HAS ARRIVED',col:'cyan',angle:1.6,spin:1.3,rad:8,height:6.9}
};
function bossCamera(){
 const e=enemies.find(x=>x.id===bossCine.id),t=BOSS_REVEALS[bossCine.type]||BOSS_REVEALS.warden;
 if(!e)return {x:C-4,y:5,z:C+5,target:{x:C,y:3,z:C}};
 const p=cinematicEase(bossCine.clock/bossCine.duration),a=t.angle+t.spin*p,r=t.rad*(1-.30*p);
 if(e.type==='wallmaw')return {x:C+1.5*Math.sin(p*1.6),y:3.45+.22*Math.sin(p*Math.PI),
  z:8.7-p*1.4,target:{x:e.x,y:2.58,z:e.z+.35}};
 return {x:clamp(e.x+Math.cos(a)*r,1.2,N-1.2),y:t.height+.55*Math.sin(p*Math.PI),
  z:clamp(e.z+Math.sin(a)*r,1.2,N-1.2),
  target:{x:e.x,y:e.type==='colossus'?4.2:e.type==='overseer'?3.3:2.8,z:e.z}};
}
function bossIntroSound(type){
 if(muted||!audioUnlocked||!ctxAudio||ctxAudio.state!=='running')return;
 const now=ctxAudio.currentTime,tones={warden:[98,392],behemoth:[49,110],overseer:[280,630],colossus:[72,580],puppet:[48,690],wallmaw:[43.65,293.66],ophanim:[220,659.25],traveler:[91,551]};
 const f=tones[type]||tones.warden;
 audioTone(f[0],now,.72,.12,type==='behemoth'?'triangle':'sawtooth',musicBus,Math.max(26,f[0]*.4));
 audioTone(f[1],now+.14,.44,.065,type==='overseer'||type==='ophanim'?'sine':'triangle',musicBus,Math.max(60,f[1]*.5));
 if(type==='behemoth'||type==='colossus'||type==='puppet'||type==='wallmaw')audioNoise(now+.08,.22,.07,type==='behemoth'?400:4000,'bandpass',musicBus);
}
function beginBossIntro(e){
 if(bossCine.active||phase!=='play'||!isBoss(e))return false;
 const t=BOSS_REVEALS[e.type]||BOSS_REVEALS.warden;
 bossCine.active=true;bossCine.clock=0;bossCine.duration=matchMedia('(prefers-reduced-motion: reduce)').matches?.75:3;
 bossCine.id=e.id;bossCine.type=e.type;bossCine.seen++;
 const layer=$('bossEntrance');layer.dataset.archetype=e.type;
 const rare=WYRD_RARE_BOSSES[e.wyrdfluxRareBoss];
 $('bossEntranceName').textContent=rare?.name||BOSS_NAMES[e.type];
 $('bossEntranceTitle').textContent=rare?.title||t.title;
 $('bossEntranceLine').textContent=rare?.line||t.line;
 layer.classList.remove('hidden');document.body.classList.add('boss-intro-active');
 inputs.keys.clear();inputs.shoot=false;inputs.fire=null;inputs.interact=false;inputs.moveX=0;inputs.moveZ=0;
 player.vx=0;player.vz=0;document.exitPointerLock?.();bossIntroSound(e.type);return true;
}
function endBossIntro(skipped=false){
 if(!bossCine.active)return false;
 const arrived=enemies.find(x=>x.id===bossCine.id);
 if(arrived?.type==='wallmaw'&&arrived.wall?.phase==='emerge'){
  arrived.wall.clock=2.2;arrived.wall.phase='stalk';
 }
 bossCine.active=false;bossCine.id=null;bossCine.finished++;if(skipped)bossCine.skipped++;
 $('bossEntrance').classList.add('hidden');document.body.classList.remove('boss-intro-active');
 inputs.keys.clear();inputs.shoot=false;inputs.fire=null;inputs.interact=false;inputs.moveX=0;inputs.moveZ=0;
 inputs.look=null;inputs.joystick=null;$('stick').style.transform='none';player.vx=0;player.vz=0;
 return true;
}
function updateBossIntro(dt){
 if(!bossCine.active)return;
 if(!enemies.some(x=>x.id===bossCine.id&&x.hp>0)){endBossIntro();return}
 bossCine.clock+=dt;
 $('bossEntrance').style.setProperty('--boss-progress',String(clamp(bossCine.clock/bossCine.duration,0,1)));
 if(bossCine.clock>=bossCine.duration)endBossIntro();
}
function drawBossArrival(m,quality,camera){
 if(!bossCine.active)return;
 const e=enemies.find(x=>x.id===bossCine.id);if(!e)return;
 if(e.type==='ophanim'){
  const p=clamp(bossCine.clock/Math.max(.001,bossCine.duration),0,1);
  const n=quality==='battery'?12:quality==='high'?28:20;
  for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){
   const a=i*TAU/n+time*(ring%2?.55:-.35),b=a+TAU/n;
   const r=1.25+ring*.63+p*1.7,y=2.4+ring*.52;
   m.beam(e.x+Math.cos(a)*r,y,e.z+Math.sin(a)*r,
     e.x+Math.cos(b)*r,y,e.z+Math.sin(b)*r,.031,
     ring===1?'white':'gold',.23+.35*p);
  }
  return;
 }
 if(e.type==='wallmaw'){
  const t=clamp(bossCine.clock/Math.max(.001,bossCine.duration),0,1);
  for(let i=0;i<(quality==='high'?20:12);i++){
   const a=i*TAU/(quality==='high'?20:12);
   const x=e.x+Math.cos(a)*3.15,y=2.6+Math.sin(a)*2.05;
   const tipx=e.x+Math.cos(a+.18)*2.0,tipy=2.6+Math.sin(a+.18)*1.55;
   m.beam(x,y,.75,tipx,tipy,1.38,.024,'red',.13+.20*t);
  }
  return;
 }
 const t=BOSS_REVEALS[e.type],p=clamp(bossCine.clock/bossCine.duration,0,1);
 const n=quality==='battery'?10:quality==='balanced'?16:24;
 for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){
  const radius=1+ring*.8+p*(e.type==='behemoth'?4:2.5),a=i*TAU/n+bossCine.clock*(ring?.5:-.3),b=a+TAU/n;
  m.beam(e.x+Math.cos(a)*radius,.19+ring*.1,e.z+Math.sin(a)*radius,
   e.x+Math.cos(b)*radius,.19+ring*.1,e.z+Math.sin(b)*radius,.052,t.col,1.2);
 }
 const bits=quality==='battery'?4:quality==='balanced'?7:11;
 for(let i=0;i<bits;i++){
  const a=i*TAU/bits+bossCine.clock*(e.type==='overseer'?2.4:.8),r=e.type==='colossus'?2.5:1.7;
  const x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r,h=.55+(i%3)*.5;
  if(e.type==='warden')m.box(x,h,z,.17,h*1.9,.17,i%2?'chrome':'purple',1.2);
  else if(e.type==='behemoth'){m.box(x,.3+h*.2,z,.22,.16,.22,i%2?'orange':'gold',1.8);m.beam(e.x,.5,e.z,x,.3+h*.2,z,.05,'orange',.8);}
  else if(e.type==='overseer'){m.box(x,2.3+h*.35,z,.23,.14,.27,'steelblue',.2,a);m.box(x,2.3+h*.35,z-.12,.17,.1,.06,'green',2);}
  else{
   const midX=(e.x+x)*.5+.23*Math.sin(bossCine.clock*28+i),midZ=(e.z+z)*.5+.19*Math.cos(bossCine.clock*22+i);
   m.ribbon(e.x,4,e.z,midX,3.5+h,midZ,.07,'red',2,camera);
   m.ribbon(midX,3.5+h,midZ,x,2.4+h,z,.05,i%2?'purple':'white',1.7,camera);
  }
 }
}

const ENEMY_STATS={
 sentinel:[48,.77],crusher:[103,.47],drone:[39,.96],stalker:[58,1.24],artillery:[73,.39],
 skitter:[38,1.58],sniper:[70,.48],bulwark:[143,.45],leech:[56,.98],
 warden:[830,.47],behemoth:[1350,.68],overseer:[970,.51],colossus:[2100,.31],puppet:[3200,0],wallmaw:[1720,0],ophanim:[2550,.66],saucer:[125,1.18],traveler:[2600,.85]
};
const isBoss=e=>!!e.boss||['warden','behemoth','overseer','colossus','puppet','wallmaw','ophanim','traveler'].includes(e.type);

/* Six short, measurable random wave anomalies. All are isolated from the
   final Brain, special living realms, Test Lab, and protected base saves. */
const WYRD_ANOMALIES=[
 {id:'ion',name:'ION DOWNPOUR',text:'Electrical surges strike roaming hostiles.',duration:22,color:'cyan'},
 {id:'grav',name:'GRAVITY SHEAR',text:'A distant gravity well drags enemy formations.',duration:21,color:'purple'},
 {id:'bloom',name:'EMERALD AFTERGLOW',text:'Periodic shield replenishment during combat.',duration:25,color:'green'},
 {id:'surge',name:'CRIMSON ACCELERATOR',text:'Enemies surge faster for a dangerous bonus.',duration:19,color:'red'},
 {id:'twin',name:'TWIN SKY HUNTERS',text:'Two elevated weaving UFO targets enter the arena.',duration:30,color:'gold'},
 {id:'comet',name:'PRISM COMET FALL',text:'Precise comets fall on isolated enemies.',duration:24,color:'pink'}
];
const WYRD_RARE_BOSSES={
 mirror:{name:'THE MIRROR REGENT',title:'FRACTURED REFLECTION',line:'ITS SATELLITES WILL NOT FOLLOW STRAIGHT LINES',color:'pink'},
 ember:{name:'THE EMBER CROWN',title:'SOVEREIGN OF THE AFTERBURN',line:'THE SCARLET RINGS DEMAND MOVEMENT',color:'orange'}
};
let wyrdfluxAnomaly={id:null,until:0,clock:0,pulse:0,twinsFallen:0};
function wyrdfluxSelectAnomaly(resuming=false){
 wyrdfluxAnomaly={id:null,until:0,clock:0,pulse:0,twinsFallen:0};
 if(resuming||testLabMode||wave<=2||wave%3===0||
    hellBreach.state!=='none'||heavenSanctum.state!=='none'||
    blockworld.state!=='none'||livingRealm.active||livingRealm.pending||
    meadowEpisodeActive||circus.state==='active'||rnd()>=.18)return;
 const entry=WYRD_ANOMALIES[Math.floor(rnd()*WYRD_ANOMALIES.length)];
 wyrdfluxAnomaly={id:entry.id,until:time+entry.duration,clock:1.1,pulse:0,twinsFallen:0};
 announce('RARE ANOMALY // '+entry.name,3.4);notice(entry.text,3);
 if(entry.id==='twin'){
  for(let i=0;i<2;i++){
   const at=randomOpen(7),e=newEnemy(at,false);
   e.type='saucer';e.boss=false;e.wyrdfluxTwin=i+1;
   e.saucer={clock:i*2.8,volley:0,hover:4.65+i*.36,orbit:i*Math.PI,shieldBurst:0};
   e.hp=e.maxHp=(160+40*i)*cycleDifficulty(wave).hp;
   e.speed=1.65*cycleDifficulty(wave).speed;e.attackT=1.7+i*.4;
   e.appearT=.2;e.bob=i*Math.PI;enemies.push(e);
  }
  burst(player.x,player.z,'green',3);
 }
}
function tickWyrdfluxAnomaly(dt){
 const a=wyrdfluxAnomaly;
 if(!a.id||phase!=='play'||time>a.until)return;
 a.clock-=dt;if(a.clock>0)return;
 a.pulse++;a.clock=a.id==='surge'?.6:2.35;
 const alive=enemies.filter(e=>e?.hp>0&&!e.boss&&!e.krakenPart&&!e.blockKind&&!e.circusActor);
 if(a.id==='ion'||a.id==='comet'){
  const hits=alive.slice().sort((x,y)=>((x.id*17+a.pulse*13)%41)-((y.id*17+a.pulse*13)%41)).slice(0,a.id==='comet'?1:2);
  for(const e of hits){const color=a.id==='ion'?'cyan':'pink';
   spark(e.x,e.z,color,8);burst(e.x,e.z,color,1.05,.23);
   damageEnemy(e,a.id==='ion'?6+wave*.12:12+wave*.15,'anomaly',1);
  }
 }else if(a.id==='grav'){
  for(const e of alive.slice(0,14)){
   const d=Math.hypot(C-e.x,C-e.z);
   if(d>1.2)collisionMove(e,(C-e.x)/d*.34,(C-e.z)/d*.34,enemyCollisionRadius(e));
   spark(e.x,e.z,'purple',2);
  }
 }else if(a.id==='bloom'){
  player.shield=Math.min(player.maxShield,player.shield+3.5);
  spark(player.x,player.z,'green',9);
 }else if(a.id==='surge'){
  for(const e of alive.slice(0,20))e.speed=Math.min(e.speed*1.025,4.2);
  if(alive[0])spark(alive[0].x,alive[0].z,'red',6);
 }
}
function tickWyrdfluxRareBoss(e,dt){
 if(!e.wyrdfluxRareBoss||e.hp<=0)return;
 e.wyrdfluxRareBossClock=(e.wyrdfluxRareBossClock??2.3)-dt;
 if(e.wyrdfluxRareBossClock>0)return;
 const mirror=e.wyrdfluxRareBoss==='mirror',count=mirror?9:12;
 e.wyrdfluxRareBossClock=mirror?4.1:5;
 // A traveling, dodgeable spoke pattern rather than instant aim damage.
 const base=Math.atan2(player.x-e.x,-(player.z-e.z));
 for(let i=0;i<count;i++){
  const angle=base+TAU*i/count+(mirror?.28:.12)*Math.sin(time*1.3);
  projectiles.push({x:e.x+Math.sin(angle)*.9,y:mirror?3.75:1.3,
    z:e.z-Math.cos(angle)*.9,vx:Math.sin(angle)*(mirror?4.9:3.8),
    vz:-Math.cos(angle)*(mirror?4.9:3.8),
    damage:mirror?7.5:10.5,life:3.7,col:mirror?'pink':'orange'});
 }
 if(projectiles.length>160)projectiles.splice(0,projectiles.length-160);
 spark(e.x,e.z,mirror?'pink':'orange',20);
 burst(e.x,e.z,mirror?'purple':'red',3.2,.6);
}
function drawWyrdfluxRareBoss(m,e,q){
 if(!e.wyrdfluxRareBoss||e.hp<=0)return;
 const mirror=e.wyrdfluxRareBoss==='mirror',color=mirror?'pink':'orange';
 const y=mirror?(e.saucer?.hover||5.1):2.6,r=mirror?2.65:2.2;
 const n=q==='battery'?10:18,spin=time*(mirror?.75:-.58);
 for(let i=0;i<n;i++){
  const angle=spin+i*TAU/n,next=spin+(i+1)*TAU/n;
  m.beam(e.x+Math.cos(angle)*r,y,e.z+Math.sin(angle)*r,
   e.x+Math.cos(next)*r,y,e.z+Math.sin(next)*r,.04,color,.8);
 }
 m.beam(e.x,y-1.2,e.z,e.x,y+1.15,e.z,.09,color,.55);
}


// AFTERLIGHT v0.16 — The Null Puppet. Disconnected cannon arms shield a
// suspended biological command core. All danger uses the same fixed 60Hz
// gameplay clock and all scorch marks expire; nothing modifies the collision map.
let heatMarks=[],heatNextHit=0;
const puppetFinale={active:false,t:0,duration:3.7,x:0,y:4.15,z:0,clock:0,sparks:0,completed:0};
function puppetPower(){
 if(puppetFinale.active){
  const p=clamp(puppetFinale.t/puppetFinale.duration,0,1);
  return clamp(.18-.10*p+.08*(.5+.5*Math.sin(time*19))*(1-p),.07,.30);
 }
 const e=enemies.find(e=>e.type==='puppet'&&e.puppet?.phase==='head'&&e.hp>0);
 if(!e)return 1;
 const hp=clamp(e.puppet.head/Math.max(.001,e.puppet.headMax),0,1);
 const dim=clamp((.80-hp)/.80,0,1);
 return clamp(1-.70*dim-.16*dim*(.5+.5*Math.sin(time*(8+dim*24))),.14,1);
}
function puppetSparks(count){
 if(!puppetFinale.active)return;
 for(let i=0;i<count;i++){
  const a=rnd()*TAU,v=2.4+rnd()*7;
  particles.push({x:puppetFinale.x+(rnd()-.5)*.6,y:puppetFinale.y+(rnd()-.5)*.7,
   z:puppetFinale.z+(rnd()-.5)*.6,vx:Math.cos(a)*v,vy:(rnd()-.14)*8,
   vz:Math.sin(a)*v,life:.7+rnd()*1.15,max:1.85,
   col:i%6===0?'white':i%3===0?'cyan':i%2?'orange':'purple',size:.026+rnd()*.045});
 }
 puppetFinale.sparks+=count;
 if(particles.length>320)particles.splice(0,particles.length-320);
}
function startPuppetFinale(e){
 if(puppetFinale.active)return;
 Object.assign(puppetFinale,{active:true,t:0,x:e.x,z:e.z,y:puppetPoint(e,'head').y,clock:0,sparks:0});
 if(localWaveOf(wave)===CAMPAIGN_WAVES){
  spawnPending=0;enemies=enemies.filter(x=>x===e);
 }
 projectiles.length=0;lingeringBeams.length=0;heatMarks.length=0;
 inputs.shoot=false;inputs.fire=null;player.vx=0;player.vz=0;
 puppetSparks(95);shake=Math.max(shake,.22);sound('upgrade');
 if(desktopPC)vibrateWyrdfluxPad(.92,295,'hurt');
 announce('NULL PUPPET DESTROYED // SIMULATION POWER FAILURE',3.5);
 notice('NEURAL CORE COLLAPSE · ASCENSION UNLOCKED',3.5);
}
function tickPuppetFinale(dt){
 const d=puppetFinale;d.t=Math.min(d.duration,d.t+dt);d.clock-=dt;
 if(d.clock<=0&&d.t<d.duration-.25){
  puppetSparks(d.t>2.4?28:15);d.clock=d.t>2.4?.08:.15;
 }
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*7;p.life-=dt}
 particles=particles.filter(p=>p.life>0);shake*=.95;
 if(d.t>=d.duration){
  d.active=false;d.completed++;
  // Existing saved wave-reward choice starts wave 22 with the exact
  // same gear, perk stacks, fusions and salvage; the map is recreated.
  if(phase==='play'&&spawnPending===0&&enemies.length===0&&wave>0)waveComplete();
 }else updateHUD(false);
}
function renderPuppetFinale(m,quality){
 if(!puppetFinale.active)return;
 const d=puppetFinale,p=clamp(d.t/d.duration,0,1),scale=Math.max(.035,1-Math.pow(p,1.55));
 const height=d.y+(p<.2?p*.9:-Math.pow(Math.max(0,p-.2),1.3)*5);
 const n=quality==='high'?64:quality==='balanced'?38:20;
 for(let i=0;i<n;i++){
  const a=i*2.39996,spread=Math.max(0,p-.35)*2.7;
  const x=d.x+Math.cos(a)*(.26+.39*(i%7)/7)*scale+Math.sin(a*3)*spread;
  const y=height+Math.sin(a*1.8)*(.42*scale)+Math.cos(a*2)*spread;
  const z=d.z+Math.sin(a)*(.26+.39*(i%7)/7)*scale+Math.cos(a*3)*spread;
  const sz=(.16+.09*(i%5)/5)*scale;
  m.box(x,y,z,sz,sz*.9,sz*.8,i%7===0?'white':i%3===0?'red':'purple',
   (1-p)*(.7+2.8*(.5+.5*Math.sin(time*28+i))),a+time*(i%2?-2:2));
 }
 for(let i=0,n=quality==='high'?46:quality==='balanced'?27:14;i<n;i++){
  const a=i*TAU/n+time*(i%2?2:-2),dist=1.2+p*4.9;
  m.beam(d.x,height,d.z,d.x+Math.cos(a)*dist,
   height+Math.sin(a*3+time*8)*(1+p*2),d.z+Math.sin(a)*dist,
   .014+.012*(1-p),i%4===0?'white':i%3===0?'orange':'cyan',1.65*(1-p*.65));
 }
}

const PUPPET_PALETTE={left:'red',right:'blue',head:'purple'};
// Damped spring joints are shared by mesh, collision and firing origins. Once
// detached, each cannon transitions to gravity and a bouncing floor collision.
function puppetHome(e,part){
 const bob=.10*Math.sin(time*1.35+e.id);
 if(part==='left')return {x:e.x-2.5,y:3+bob,z:e.z-.42};
 if(part==='right')return {x:e.x+2.5,y:3-bob,z:e.z-.42};
 return {x:e.x,y:4.15+.14*Math.sin(time*1.15),z:e.z};
}
function ensurePuppetPhysics(e){
 const p=e.puppet;if(!p)return;
 if(!p.joints){
  p.joints={};
  for(const part of ['left','right','head']){
   p.joints[part]={...puppetHome(e,part),vx:0,vy:0,vz:0,spin:0,spinSpeed:0,detached:false,bounces:0};
  }
 }
}
function puppetPoint(e,part){
 ensurePuppetPhysics(e);
 return e.puppet?.joints?.[part]||puppetHome(e,part);
}
function puppetSpringStep(e,dt){
 ensurePuppetPhysics(e);const p=e.puppet;
 for(const side of ['left','right','head']){
  const j=p.joints[side];if(!j)continue;
  if(j.detached){
   j.vy-=13.5*dt;
   j.x+=j.vx*dt;j.y+=j.vy*dt;j.z+=j.vz*dt;
   j.spin+=j.spinSpeed*dt;j.spinSpeed*=Math.max(0,1-1.9*dt);
   j.vx*=Math.max(0,1-.94*dt);j.vz*=Math.max(0,1-.94*dt);
   // Arm pieces settle independently. The floor mesh stays untouched.
   if(j.y<.34){
    j.y=.34;if(j.vy<-.38){j.vy=-j.vy*.29;j.bounces++}
    else j.vy=0;
    j.vx*=.7;j.vz*=.7;
   }
   continue;
  }
  const home=puppetHome(e,side);
  const signal=p.phase==='arms'?p.stage:'head';
  const swing=(side==='head'?.07:.24)*Math.sin(time*(side==='head'?1.6:2.8)+(side==='left'?0:1.9));
  home.x+=side==='head'?swing*.3:(side==='left'?-1:1)*swing;
  home.z+=side==='head'?swing*.2:Math.cos(time*2.2+(side==='left'?0:1.8))*.18;
  if(signal==='fire'&&side!=='head')home.y+=.22;
  const stiff=side==='head'?19:25,damp=side==='head'?7.8:8.5;
  for(const axis of ['x','y','z']){
   const vKey='v'+axis;
   j[vKey]+=((home[axis]-j[axis])*stiff-j[vKey]*damp)*dt;
   j[vKey]=clamp(j[vKey],-5,5);j[axis]+=j[vKey]*dt;
  }
  j.spin=Math.sin(time*(side==='head'?.4:1.5)+(side==='left'?0:1.5))*(side==='head'?.04:.10);
 }
}
function puppetRayPart(e,ox,oy,oz,dx,dy,dz,range){
 const p=e.puppet;if(!p)return null;let nearest=null;
 for(const key of ['left','right','head']){
  // The shielded head is still hittable, but registers no damage until both
  // arm circuits are destroyed. Independent ray tests prevent center-mass abuse.
  if(key!=='head'&&p[key]<=0)continue;
  const point=puppetPoint(e,key),radius=key==='head'?1.12:.92;
  const vx=point.x-ox,vy=point.y-oy,vz=point.z-oz,t=vx*dx+vy*dy+vz*dz;
  if(t<.18||t>range+radius)continue;
  const sideSq=Math.max(0,vx*vx+vy*vy+vz*vz-t*t);
  if(sideSq>radius*radius)continue;
  const distance=Math.max(.2,t-Math.sqrt(radius*radius-sideSq));
  if(!nearest||distance<nearest.distance)nearest={part:key,distance};
 }
 return nearest;
}
// Five readable, simultaneous two-arm patterns. Visual rays and actual
// collisions call exactly this function, so telegraphs match damage paths.
function puppetSweepAngle(p,side,q){
 const a=side==='left'?p.startLeft:p.startRight;
 const sign=side==='left'?1:-1,t=clamp(q,0,1),u=t*2-1;
 switch((p.pattern||0)%5){
  case 0:return a+sign*u*1.18;
  case 1:return a-sign*u*1.38;
  case 2:return a+sign*(u*.95+.22*Math.sin(t*Math.PI));
  case 3:return a+sign*(.72*Math.sin(t*Math.PI*1.55)+u*.43);
  default:return a+sign*(.56*Math.sin(t*Math.PI*2+(.7*(side==='right')))+u*.68);
 }
}
function puppetBeamInfo(e,side){
 const p=e.puppet,part=puppetPoint(e,side),active=p[side]>0;
 const progress=clamp(1-p.clock/Math.max(.01,p.fireDuration),0,1);
 const base=side==='left'?p.startLeft:p.startRight;
 const angle=p.stage==='charge'?base:puppetSweepAngle(p,side,progress);
 const dx=Math.sin(angle),dz=-Math.cos(angle);
 let reach=15.5;
 for(let d=.5;d<reach;d+=.45){if(tile(part.x+dx*d,part.z+dz*d)){reach=d-.45;break}}
 return {origin:part,angle,dx,dz,reach:Math.max(.5,reach),active,
  tipX:part.x+dx*reach,tipZ:part.z+dz*reach};
}
function addHeatMark(x,z,power=1){
 if(tile(x,z)||edge(Math.floor(x),Math.floor(z)))return;
 const xx=Math.floor(x*2)/2+.25,zz=Math.floor(z*2)/2+.25;
 const existing=heatMarks.find(m=>Math.abs(m.x-xx)<.01&&Math.abs(m.z-zz)<.01);
 if(existing){existing.life=Math.min(4.2,Math.max(existing.life,2.8+power*.7));return}
 heatMarks.push({x:xx,z:zz,life:3.15+power*.45,max:3.15+power*.45});
 if(heatMarks.length>160)heatMarks.splice(0,heatMarks.length-160);
}
function hitPuppetPart(e,dmg,preferred=null,cause='weapon'){
 const p=e.puppet;if(!p)return dmg;
 let part=preferred;
 if(part==='head'&&(p.left>0||p.right>0)){
  if(cause==='weapon'&&time>(p.shieldNotice||0)){
   combatText(e.x,e.z,'CORE SHIELDED','gold');p.shieldNotice=time+1.6;
  }
  return 0;
 }
 if(part!=='head'&&part!=='left'&&part!=='right')
  part=p.left>0?'left':p.right>0?'right':'head';
 if(p[part]<=0)part=p.left>0?'left':p.right>0?'right':'head';
 if(part==='head'&&(p.left>0||p.right>0))return 0;
 const applied=Math.min(p[part],dmg);
 if(applied<=0)return 0;
 ensurePuppetPhysics(e);
 const joint=p.joints[part];
 const outward=part==='left'?-1:part==='right'?1:0;
 joint.vx=clamp(joint.vx+outward*(.16+applied/140),-3.5,3.5);
 joint.vy=clamp(joint.vy+applied/180,-2.5,3.4);
 joint.vz=clamp(joint.vz-.12-applied/470,-3,3);
 p[part]-=applied;
 if(p[part]<=0){
  p[part]=0;
  if(part==='head'&&!p.rebornCount){
   // The first apparent brain death is a full second-round transformation.
   p.rebornCount=1;p.phase='reborn';p.head=p.headMax*.68;
   p.stage='charge';p.clock=2.1;p.stageDuration=p.clock;
   p.cycle=0;p.pattern=0;p.hitCooldown=0;
   e.hit=.4;shake=Math.max(shake,.15);
   burst(e.x,e.z,'red',4.1);spark(e.x,e.z,'pink',32);
   announce('THE BRAIN REFORMS · FINAL NEURAL ROUND',3.2);
   notice('SECOND LIFE · DODGE THE BLOOD-RED STARBURSTS',3.5);
   sound('warden');return applied;
  }
  if(part!=='head'){
   joint.detached=true;joint.vy=2.9;joint.vx+=outward*2.15;
   joint.vz=-1.2;joint.spinSpeed=outward*(2.1+Math.min(1.8,applied/550));
  }else joint.vy=2.8;
  const point=puppetPoint(e,part),col=PUPPET_PALETTE[part];
  burst(point.x,point.z,col,part==='head'?3.8:2.5);
  spark(point.x,point.z,col,28);
  if(part!=='head'){
   combatText(point.x,point.z,part.toUpperCase()+' CANNON DESTROYED','gold');
   if(p.left<=0&&p.right<=0){
    p.phase='head';p.stage='charge';p.clock=1.55;p.stageDuration=1.55;
    p.cycle=0;p.pattern=0;
    announce('ARMOR BROKEN // DESTROY THE BRAIN',2.7);
    notice('THE NULL PUPPET CORE IS VULNERABLE',2.5);
   }else notice('ONE CANNON REMAINS // STAY MOBILE',1.8);
  }else{
   announce('THE NULL PUPPET // SIGNAL TERMINATED',3.1);
  }
 }
 return applied;
}
function puppetTick(e,dt){
 const p=e.puppet;if(!p||e.hp<=0)return;
 e.hit=Math.max(0,e.hit-dt);e.bob+=dt*1.2;e.moveSpeed=0;
 puppetSpringStep(e,dt);
 const parts=p.phase==='arms'?['left','right'].filter(side=>p[side]>0):[];
 p.clock-=dt;
 if(p.phase==='head'||p.phase==='reborn'){
  // A second crimson brain phase follows the first exposed health bar.
  if(p.clock<=0){
   p.stage=p.stage==='charge'?'fire':p.stage==='fire'?'recover':'charge';
   p.clock=p.stage==='charge'?(p.phase==='reborn'?.76:1.08):
    p.stage==='fire'?(p.phase==='reborn'?.90:.62):(p.phase==='reborn'?.40:.72);
   p.stageDuration=p.clock;
   if(p.stage==='fire'){
    const count=p.phase==='reborn'?16:10;
    for(let k=0;k<count;k++){
     const a=TAU*k/count+time*.35;
     const dx=Math.sin(a),dz=-Math.cos(a);
     const x=e.x+dx*5.4,z=e.z+dz*5.4;
     addHeatMark(x,z,.5);
    }
    if(Math.hypot(player.x-e.x,player.z-e.z)<(p.phase==='reborn'?4.75:4.1))
      hitPlayer(p.phase==='reborn'?13:11);
    if(p.phase==='reborn'){
     for(let k=0;k<12;k++){
      const a=TAU*k/12+time*.55;
      projectiles.push({x:e.x+Math.sin(a)*.82,y:1.65,
       z:e.z+Math.cos(a)*.82,
       vx:Math.sin(a)*4.3,vz:Math.cos(a)*4.3,
       life:3.35,col:k%3===0?'pink':'red',damage:9.5});
     }
     if(projectiles.length>160)projectiles.splice(0,projectiles.length-160);
    }
    burst(e.x,e.z,p.phase==='reborn'?'red':'purple',3.8);
   }
  }
  return;
 }
 if(p.stage==='charge'){
  if(p.clock>0){
   p.startLeft=Math.atan2(player.x-(e.x-2.5),-(player.z-(e.z-.42)));
   p.startRight=Math.atan2(player.x-(e.x+2.5),-(player.z-(e.z-.42)));
  }
  if(p.clock<=0){
   p.stage='fire';p.fireDuration=p.left>0&&p.right>0?2.05:1.7;
   p.clock=p.fireDuration;p.stageDuration=p.clock;p.markClock=0;
   // All five dual-beam patterns give a complete, readable charge warning.
   if(p.pattern===2){p.startLeft-=.25;p.startRight+=.25;}
   ensurePuppetPhysics(e);
   if(p.joints.left&&!p.joints.left.detached)p.joints.left.vz+=.75;
   if(p.joints.right&&!p.joints.right.detached)p.joints.right.vz+=.75;
   burst(e.x,e.z,'red',2.0);
  }
 }else if(p.stage==='fire'){
  p.markClock-=dt;
  const sample=p.markClock<=0;
  if(sample)p.markClock=.17;
  for(const side of parts){
   const ray=puppetBeamInfo(e,side);
   if(!ray.active)continue;
   const dx=player.x-ray.origin.x,dz=player.z-ray.origin.z;
   const along=dx*ray.dx+dz*ray.dz;
   const offset=Math.abs(dx*ray.dz-dz*ray.dx);
   if(along>0&&along<ray.reach&&offset<.42&&time>(p.hitCooldown||0)){
    hitPlayer(17);p.hitCooldown=time+.43;
   }
   if(sample){
    for(let d=1.0;d<ray.reach;d+=.78)
     addHeatMark(ray.origin.x+ray.dx*d,ray.origin.z+ray.dz*d,1);
   }
  }
  if(p.clock<=0){p.stage='recover';p.clock=.95;p.stageDuration=p.clock;}
 }else if(p.clock<=0){
  p.cycle++;p.pattern=p.cycle%5;p.stage='charge';
  p.clock=Math.max(1.15,(p.left>0&&p.right>0?1.48:1.25)-Math.min(.20,(cycleOf(wave)-1)*.035));
  p.stageDuration=p.clock;
 }
}
function updateHeat(dt){
 for(const mark of heatMarks)mark.life-=dt;
 heatMarks=heatMarks.filter(mark=>mark.life>0);
 if(time<heatNextHit||player.dashT>.12)return;
 // Hot floor tiles cause periodic, mitigatable DOT rather than instant death.
 const dangerous=heatMarks.some(h=>h.life>.65&&Math.hypot(h.x-player.x,h.z-player.z)<.43);
 if(dangerous){heatNextHit=time+.52;hitPlayer(3.4);}
}
function renderHeat(m,quality){
 for(const h of heatMarks.slice(-(quality==='battery'?75:quality==='balanced'?115:160))){
  const fraction=clamp(h.life/h.max,0,1);
  const color=fraction>.74?'warm':fraction>.45?'orange':fraction>.22?'red':'rust';
  const e=fraction>.72?1.25:fraction>.35?.75:.13;
  m.box(h.x,.014,h.z,.46,.005,.46,'black',.04);
  m.box(h.x,.016,h.z,.27+.08*fraction,.003,.27+.08*fraction,color,e*.65);
  if(quality==='high'&&fraction>.52)
   m.box(h.x,.017,h.z,.11,.002,.11,fraction>.86?'white':'orange',.38*fraction);
 }
}
function renderPuppet(m,e,quality,cam){
 const p=e.puppet;if(!p)return;
 const center=puppetPoint(e,'head'),pulse=.72+.28*Math.sin(time*3.1);
 const y=center.y,x=e.x,z=e.z;
 // Head floats independently in a reactor-glass jar: open frontal lattice
 // keeps the sculpted biological mass visible without unavailable alpha glass.
 m.box(x,y-1.70,z,1.20,.28,1.40,'metal2');
 m.box(x,y+1.53,z,1.50,.30,1.48,'titanium');
 for(let i=0;i<12;i++){
  const a=i*TAU/12,r=1.23,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;
  m.box(xx,y+.12,zz,.09,2.62,.09,i%3===0?'chrome':'glass',.16,a);
  if(i%2===0){
   m.box(xx,y-1.12,zz,.21,.14,.22,'blue',.34);
   m.box(xx,y+1.24,zz,.22,.08,.24,'polished',.13);
  }
 }
 if(p.phase==='arms')for(const yy of [y-1.28,y-.45,y+.55,y+1.25]){
  for(let i=0;i<18;i++){
   const a=i*TAU/18,b=a+TAU/18;
   m.beam(x+Math.cos(a)*1.23,yy,z+Math.sin(a)*1.23,
    x+Math.cos(b)*1.23,yy,z+Math.sin(b)*1.23,.055,yy===y+1.25?'chrome':'blue',yy===y+1.25?.17:.27);
  }
 }
 // Neural lobes: asymmetric faceted sulci with animated membrane and synapses.
 const lobes=quality==='battery'?12:quality==='balanced'?22:34;
 for(let i=0;i<lobes;i++){
  const column=Math.floor(i/2),hemisphere=i%2?-1:1;
  const a=column*2.39996,yy=y+.20+Math.sin(a*1.8)*.45;
  const xx=x+hemisphere*(.32+.13*Math.cos(a*2)),zz=z+Math.sin(a)*.58;
  const sz=.33+.07*Math.sin(i*2.4);
  m.box(xx,yy,zz,sz,.24+.08*Math.cos(i),.33,i%5===0?'red':i%4===0?'pink':'purple',.33+pulse*.30,a*.19);
  if(i%4===0)m.box(xx,yy+.14,zz-.07,.14,.08,.12,'warm',.25+pulse*.25);
 }
 m.box(x,y-.7,z,.38,.60,.39,'red',1.0+pulse*.4);
 if(p.phase==='reborn'){
  const n=quality==='high'?18:12;
  for(let i=0;i<n;i++){
   const a=TAU*i/n+time*.56,r=1.52+.16*Math.sin(time*5+i);
   m.beam(x+Math.cos(a)*r,y+.46,z+Math.sin(a)*r,
    x+Math.cos(a)*r*.68,y+.90+.18*Math.sin(time*4+i),z+Math.sin(a)*r*.68,
    .048,i%3===0?'white':'red',.90+pulse*.65);
  }
  m.box(x,y+1.13,z,.90,.16,.66,'red',1.3+pulse);
 }
 if(p.phase==='arms')for(let i=0;i<7;i++){
  const a=i*TAU/7+time*.22;
  m.box(x+Math.cos(a)*.72,y+.65*Math.sin(a),z+Math.sin(a)*.62,.11,.12,.11,i%2?'purple':'cyan',.55);
 }
 // Energy puppetry: thin separated arcs, no solid shoulders or body connection.
 for(const side of ['left','right']){
  const point=puppetPoint(e,side),sx=side==='left'?-1:1;
  if(p[side]>0){
   const intensity=p.stage==='charge'?1.25:p.stage==='fire'?1.85:.55;
   const tint=side==='left'?'red':'blue';
   m.ribbon(x+sx*.75,y+.30,z, x+sx*1.55,y+.70,z-.12,.028,tint,intensity,cam);
   m.ribbon(x+sx*1.55,y+.70,z-.12,point.x,point.y+.34,point.z,.028,'purple',intensity*.7,cam);
   m.box(point.x,point.y,point.z,1.18,.72,1.04,'titanium',0,p.joints?.[side]?.spin||0);
   m.box(point.x,point.y+.48,point.z,.96,.24,1.14,'chrome',.12);
   m.box(point.x,point.y-.37,point.z,.85,.22,.92,'dark');
   for(const k of [-1,0,1]){
    m.box(point.x+k*.31,point.y+.16,point.z-.55,.22,.32,.13,'polished',.11);
    m.box(point.x+k*.31,point.y+.16,point.z-.65,.11,.19,.06,tint,p.stage==='charge'?2.3:.65);
   }
   m.box(point.x,point.y-.07,point.z-.75,.61,.41,.35,'steelblue');
   m.box(point.x,point.y-.07,point.z-.96,.39,.26,.13,p.stage==='fire'?'white':tint,
    p.stage==='charge'?2.4:p.stage==='fire'?3.1:.75);
   for(let k=0;k<6;k++){
    const a=k*TAU/6+time*.38;
    m.box(point.x+Math.cos(a)*.56,point.y,point.z+Math.sin(a)*.45,.11,.11,.16,'rim',.1,a);
   }
  }else{
   // Free-falling metal debris obeys the same position used by hit physics.
   const spin=p.joints?.[side]?.spin||0;
   m.box(point.x,point.y,point.z,.72,.22,.68,'rust',.05,spin);
   m.box(point.x+.18,point.y+.13,point.z-.19,.28,.13,.32,'metal2',.1,spin+.12);
   m.box(point.x-.18,point.y+.03,point.z+.19,.22,.12,.25,'chrome',.06,spin-.2);
  }
 }
 const coreShielded=p.phase==='arms';
 if(coreShielded){
  for(let k=0;k<12;k++){
   const a=TAU*k/12+time*.7,b=a+TAU/12;
   m.beam(x+Math.cos(a)*1.52,y,z+Math.sin(a)*1.52,
    x+Math.cos(b)*1.52,y,z+Math.sin(b)*1.52,.032,'cyan',.70);
  }
 }
 // No rings around the exposed brain after the arms are destroyed.
 // Real part-wise health telemetry lives on each visible physical component.
 for(const side of ['left','right']){
  if(p[side]<=0)continue;
  const point=puppetPoint(e,side),portion=p[side]/p[side+'Max'];
  m.box(point.x,point.y+.82,point.z,1.25,.055,.065,'black',.08);
  m.box(point.x-(1-portion)*.625,point.y+.84,point.z-.01,1.25*portion,.066,.067,
   PUPPET_PALETTE[side],1.1);
 }
 m.box(x,y+1.83,z,1.60,.06,.06,'black');
 const hp=p.head/p.headMax;
 m.box(x-(1-hp)*.8,y+1.85,z-.01,1.6*hp,.07,.07,coreShielded?'cyan':'red',coreShielded?.35:1.25);
}
function renderPuppetBeams(m,e,quality,cam){
 const p=e.puppet;if(!p)return;
 if(p.phase==='head'||p.phase==='reborn'){
  // Exact radius of each telegraphed neural shockwave.
  if(p.stage==='charge'){
   const n=quality==='battery'?12:quality==='balanced'?18:26,r=p.phase==='reborn'?4.75:4.08;
   const charge=clamp(1-p.clock/Math.max(.01,p.stageDuration),0,1);
   for(let k=0;k<n;k++){
    const a=k*TAU/n,b=(k+1)*TAU/n;
    m.beam(e.x+Math.cos(a)*r,.085,e.z+Math.sin(a)*r,
     e.x+Math.cos(b)*r,.085,e.z+Math.sin(b)*r,.025,p.phase==='reborn'?'red':'purple',.27+charge*.55);
   }
  }
  return;
 }
 if(p.stage!=='charge'&&p.stage!=='fire')return;
 const charging=p.stage==='charge';
 for(const side of ['left','right']){
  if(p[side]<=0)continue;
  const beam=puppetBeamInfo(e,side),hue=HEX[side==='left'?'red':'blue'];
  // Floor telegraph stays down, but the damaging laser crosses the player's
  // CHEST, not over their head. Gameplay remains collision-backed in X/Z.
  const muzzleY=Math.min(1.88,beam.origin.y),impactY=1.32;
  m.ribbon(beam.origin.x,charging?.10:muzzleY,beam.origin.z,
   beam.tipX,charging?.12:impactY,beam.tipZ,charging?.055:.115,
   hue.map(v=>v*(charging?.37:.78)),charging?.25:1.25,cam);
  if(charging&&quality!=='battery'){
   // Show the envelope before damage. Both arm beams still fire together.
   for(const at of [.10,.50,.90]){
    const a=puppetSweepAngle(p,side,at),vx=Math.sin(a),vz=-Math.cos(a);
    let reach=11.5;
    for(let d=1;d<11.5;d+=.7){
     if(tile(beam.origin.x+vx*d,beam.origin.z+vz*d)){reach=d-.7;break}
    }
    m.ribbon(beam.origin.x,.10,beam.origin.z,
     beam.origin.x+vx*Math.max(1,reach),.11,
     beam.origin.z+vz*Math.max(1,reach),.018,hue.map(v=>v*.32),.30,cam);
   }
  }
  if(!charging){
   m.ribbon(beam.origin.x,muzzleY,beam.origin.z,
    beam.tipX,impactY,beam.tipZ,.028,'white',1.10,cam,.015);
   m.box(beam.tipX,impactY,beam.tipZ,.23,.08,.23,'orange',.78);
  }
 }
}
// Two 120-mite rites (3x) with strictly bounded simultaneous live actors.
const WARDEN_RITE_HP_GATES=Object.freeze([.67,.34]);
const WARDEN_MITES_PER_RITE=120;
const WARDEN_MAX_ACTIVE_MITES=42;
function ensureWardenRite(e){
 if(e.type!=='warden')return null;
 return e.wardenRite??=( {phase:0,active:false,stage:'idle',clock:0,
  spawned:0,spawnClock:0,lift:0,chantClock:0,cleared:0});
}
function startWardenRite(e){
 const r=ensureWardenRite(e);
 if(!r||r.active||r.phase>=2)return false;
 r.phase++;r.active=true;r.stage='chant';r.clock=0;r.spawned=0;
 r.spawnClock=0;r.chantClock=0;
 e.moveSpeed=0;e.attackT=99;e.rangedStage='idle';e.rangedT=0;
 e.ultimateStage='idle';e.ultimateClock=99;
 announce('IRON WARDEN // VOID CHANT '+r.phase+'/2',3);
 notice('WARDEN SHIELDED · DEFEAT 120 MITES',4.6);
 burst(e.x,e.z,'purple',2.6,.75);sound('warden');return true;
}
function spawnWardenMite(e){
 const r=ensureWardenRite(e);
 if(!r?.active||r.spawned>=WARDEN_MITES_PER_RITE)return false;
 const i=r.spawned++,a=i*2.39996323+(r.phase===2?.35:0);
 const radius=1.6+(i%7)*.35;
 const candidates=[radius,2.9,1.1,3.8].map(d=>[e.x+Math.cos(a)*d,e.z+Math.sin(a)*d]);
 const at=candidates.find(([x,z])=>free(x,z,.16))||[e.x,e.z];
 const mite=newEnemy({x:at[0],z:at[1]},false);
 mite.type='endermite';mite.boss=false;mite.wardenMite=true;
 mite.wardenParentId=e.id;mite.wardenRitePhase=r.phase;
 mite.hp=mite.maxHp=(r.phase===1?16:21)*cycleDifficulty(wave).hp;
 mite.speed=2.05*cycleDifficulty(wave).speed;mite.attackT=.8+(i%6)*.14;
 mite.orbitAngle=a;mite.orbitRadius=1.8+(i%9)*.29;
 mite.orbitDrift=i%2?1:-1;mite.bob=i*.83;
 mite.appearT=0;mite.moveSpeed=0;enemies.push(mite);
 if(i%5===0)spark(mite.x,mite.z,'purple',3);
 return true;
}
function tickWardenRite(e,dt){
 const r=ensureWardenRite(e);
 if(!r)return false;
 if(!r.active){r.lift=Math.max(0,r.lift-dt*1.4);return false;}
 r.clock+=dt;r.lift=Math.min(3.1,r.lift+dt*1.35);
 r.chantClock-=dt;
 if(r.chantClock<=0){r.chantClock=1.1;
  if(audioUnlocked&&!muted&&ctxAudio?.state==='running'){
   const t=ctxAudio.currentTime;
   audioTone(r.phase===1?82:64,t,.44,.075,'sawtooth',fxBus,35);
   audioTone(r.phase===1?164:128,t+.12,.37,.045,'triangle',fxBus,21);
  }
 }
 if(r.spawned<WARDEN_MITES_PER_RITE){
  r.spawnClock-=dt;
  while(r.spawned<WARDEN_MITES_PER_RITE&&r.spawnClock<=0){
   const alive=enemies.filter(x=>x.wardenMite&&x.wardenParentId===e.id&&x.hp>0).length;
   if(alive>=WARDEN_MAX_ACTIVE_MITES){r.spawnClock=.075;break;}
   spawnWardenMite(e);r.spawnClock+=.075;
  }
 }
 if(r.stage==='chant'&&r.spawned>=36&&r.clock>=3.6){
  r.stage='swarm';r.clock=0;
  notice('120 MITES IN WAVES · SHIELD ACTIVE',3.4);
 }
 if(r.stage==='swarm'&&r.clock>=3.0){
  r.stage='disperse';r.clock=0;
  announce('THE SWARM SPREADS OUT // PREPARE FOR ATTACK',2.7);
 }
 if(r.stage==='disperse'&&r.clock>=1.3){r.stage='attack';r.clock=0;}
 const alive=enemies.filter(x=>x.wardenMite&&x.wardenParentId===e.id&&x.hp>0).length;
 if(r.stage==='attack'&&r.spawned===WARDEN_MITES_PER_RITE&&alive===0){
  r.active=false;r.stage='recover';r.clock=0;r.cleared++;
  e.attackT=1.65;e.ultimateClock=2.7;
  burst(e.x,e.z,'cyan',2.7,.63);sound('upgrade');
  announce('WARDEN SHIELD SHATTERED // DAMAGE HIM NOW',3.6);
  notice(r.phase===1?'FIRST RITE BROKEN // SECOND SUMMON AT 34% HP':
   'FINAL RITE BROKEN // FINISH THE WARDEN',4);
 }
 e.moveSpeed=0;e.rangedStage='idle';e.ultimateStage='idle';return true;
}
function tickWardenMite(e,dt){
 const boss=enemies.find(x=>x.id===e.wardenParentId&&x.hp>0);
 const r=boss?.wardenRite;
 e.hit=Math.max(0,(e.hit||0)-dt);e.bob+=dt*12.5;
 e.attackT=Math.max(0,e.attackT-dt);
 const ox=e.x,oz=e.z,a=e.orbitAngle;
 let x=e.x,z=e.z;
 if(r?.active&&(r.stage==='chant'||r.stage==='swarm')){
  e.orbitAngle+=dt*(r.stage==='swarm'?2.05:1.25)*e.orbitDrift;
  const d=e.orbitRadius+(r.stage==='swarm'?.55:.2)*Math.sin(e.bob*.55);
  x=boss.x+Math.cos(e.orbitAngle)*d;z=boss.z+Math.sin(e.orbitAngle)*d;
 }else if(r?.active&&r.stage==='disperse'){
  e.orbitAngle+=dt*.80*e.orbitDrift;
  const d=e.orbitRadius+1.6+Math.min(1.2,r.clock)*1.2;
  x=boss.x+Math.cos(e.orbitAngle)*d;z=boss.z+Math.sin(e.orbitAngle)*d;
 }else{
  const dx=player.x-e.x,dz=player.z-e.z,d=Math.max(.01,Math.hypot(dx,dz));
  const sidestep=Math.sin(a)*.20,pace=Math.min(1,dt*e.speed);
  x=e.x+(dx/d-sidestep*dz/d)*pace;
  z=e.z+(dz/d+sidestep*dx/d)*pace;
  if(d<.54&&e.attackT<=0){
   e.attackT=1.25+(e.id%5)*.15;
   hitPlayer(2.4+(r?.phase||1)*.35);spark(e.x,e.z,'purple',3);
  }
 }
 const dx=x-e.x,dz=z-e.z;
 if(Math.hypot(dx,dz)>.001){
  collisionMove(e,dx,dz,.14);
  e.moveSpeed=Math.hypot(e.x-ox,e.z-oz)/Math.max(.001,dt);
  e.facing=Math.atan2(dx,-dz);
 }
}
function drawWardenRiteFX(m,q){
 if(!desktopPC)return;
 for(const e of enemies){
  const r=e.type==='warden'?e.wardenRite:null;
  if(!r?.active)continue;
  const y=.3+r.lift,ring=q==='high'?16:10,spin=time*(r.phase===1?.72:1.05);
  // Animated glyph halos and converging violet beams around the airborne rig.
  for(let layer=0;layer<2;layer++){
   const radius=1.0+layer*.64,height=y+.24+layer*.4;
   for(let i=0;i<ring;i++){
    const a=spin*(layer?1:-1)+TAU*i/ring;
    const b=spin*(layer?1:-1)+TAU*(i+1)/ring;
    const ax=e.x+Math.cos(a)*radius,az=e.z+Math.sin(a)*radius;
    const bx=e.x+Math.cos(b)*radius,bz=e.z+Math.sin(b)*radius;
    m.beam(ax,height,az,bx,height,bz,.018+(layer?.005:.011),
     i%3===0?'cyan':'purple',.8+.35*Math.sin(time*7+i));
    if(q==='high'&&i%2===0)
     m.box(ax,height+.12*Math.sin(time*5+i),az,.075,.075,.075,
      i%3===0?'white':'pink',.75);
   }
  }
  for(let i=0;i<6;i++){
   const a=TAU*i/6+time*.52,d=1.15+.13*Math.sin(time*3+i);
   m.beam(e.x+Math.cos(a)*d,.08,e.z+Math.sin(a)*d,
    e.x+Math.cos(a+.4)*.61,y+2.2,e.z+Math.sin(a+.4)*.61,
    .018,i%2?'purple':'cyan',.41);
  }
 }
}
function drawWardenMite(m,e){
 const y=.19+Math.sin(e.bob)*.012,x=e.x,z=e.z,face=e.facing||0;
 const q=$('quality').value,skin=e.hit>0?'white':'dark';
 // Six properly grounded, jointed legs: toes remain at 2cm above the floor,
 // never magically hover alongside/above the abdomen.
 const co=Math.cos(face),si=Math.sin(face);
 const local=(lx,lz)=>({x:x+lx*co+lz*si,z:z-lx*si+lz*co});
 m.box(x,y,z,.31,.18,.47,skin,.07,face);
 m.box(x,y+.06,z-.15,.24,.12,.24,e.hit>0?'white':'purple',.30,face);
 m.box(x,y+.095,z+.16,.21,.085,.26,'blue',.24,face);
 m.box(x,y-.03,z-.02,.30,.055,.35,'ironblack',.08,face);
 for(const side of [-1,1])for(let leg=0;leg<3;leg++){
  const phase=e.bob+leg*1.95+side*.8,step=Math.sin(phase)*.095,spacing=(-.17+leg*.17);
  const hip=local(side*.14,spacing),knee=local(side*(.26+leg*.032),spacing+step*.55),
   toe=local(side*(.31+leg*.044),spacing-.06+step);
  const lifted=Math.max(0,Math.sin(phase))*(e.moveSpeed>0.04?.035:.008);
  m.beam(hip.x,y-.045,hip.z,knee.x,.095+lifted,knee.z,.021,skin,.10);
  m.beam(knee.x,.095+lifted,knee.z,toe.x,.020+lifted,toe.z,.015,'purple',.14);
  m.box(toe.x,.018+lifted,toe.z,.052,.022,.060,'charcoal',.05,face);
 }
 for(const side of [-1,1]){
  const eye=local(side*.085,-.243),feel=local(side*.19,-.40);
  m.box(eye.x,y+.04,eye.z,.048,.046,.036,'pink',1.1);
  if(q==='high')m.beam(eye.x,y+.06,eye.z,feel.x,y+.22,feel.z,.009,'cyan',.25);
 }
}
let enemyId=0,meleeHits=0,rangedChargedShots=0,meleeRetreats=0,advancedVolleys=0;
function newEnemy(pos,boss=false){
 let variant='sentinel';
 if(boss){
  variant=wyrdfluxCampaignBossType(wave,sector);
  if(sector!==6&&heavenSanctum.state==='none'&&hellBreach.state==='none'&&rnd()<.02)variant='ophanim';
   else if(!testLabMode&&sector!==6&&localWaveOf(wave)>=9&&rnd()<.17)variant='traveler';
  else if(sector!==6&&(sector===1?rnd()<.57:rnd()<.13))variant='wallmaw';
 }
 else{
  const r=rnd();
  if(localWaveOf(wave)>=11&&r<.11)variant='bulwark';
  else if(localWaveOf(wave)>=8&&r<.23)variant='sniper';
  else if(localWaveOf(wave)>=6&&r<.39)variant='artillery';
  else if(localWaveOf(wave)>=5&&r<.56)variant='leech';
  else if(localWaveOf(wave)>=4&&r<.68)variant='skitter';
  else if(localWaveOf(wave)>=3&&r<.79)variant='stalker';
  else if(localWaveOf(wave)>=2&&r<.89)variant='drone';
  else if(localWaveOf(wave)>=2&&r<.96)variant='crusher';
  if(sector===2&&localWaveOf(wave)>=6&&r<.30)variant='sniper';
  if(sector===4&&localWaveOf(wave)>=12&&r<.28)variant='leech';
  if(sector===5&&localWaveOf(wave)>=16&&r<.19)variant='bulwark';
   if(!testLabMode&&localWaveOf(wave)>=7&&rnd()<.07)variant='saucer';
 }
 const [base,speed]=ENEMY_STATS[variant],difficulty=cycleDifficulty(wave);
  const mawVitality=variant==='wallmaw'&&cycleOf(wave)>1?1.35:1;
  const maxHp=base*(1+(localWaveOf(wave)-1)*.09)*difficulty.hp*mawVitality;
 const unit={id:enemyId++,x:pos.x,z:pos.z,y:0,type:variant,boss:!!boss,
  hp:maxHp,maxHp,speed:speed*difficulty.speed,attackT:.7+rnd()*1.2,
  signatureClock:5.8+rnd()*3,signatureStage:'idle',signatureT:0,wander:rnd()*TAU,
  bob:rnd()*TAU,hit:0,pathT:0,sidestep:rnd()<.5?-1:1,
  summonClock:4.5+rnd()*3,attackPhase:0,facing:0,turnRate:3.8,moveSpeed:0,intent:'advance',intentClock:.4+rnd()*.6,intentSide:rnd()<.5?-1:1,flinch:0,flinchVel:0,weightShift:0,meleeStage:'seek',meleeT:0,meleeAimed:0,meleeHit:false,retreatDirX:0,retreatDirZ:0,rangedStage:'idle',rangedT:0,rangedAim:0,ultimateClock:4.5+rnd()*2,ultimateStage:'idle',ultimateT:0,ultimateAngle:0,ultimateSweep:0,ultimateTick:0};
  if(variant==='saucer'||variant==='traveler'){
   unit.saucer={clock:0,volley:0,hover:variant==='traveler'?5.43:4.28,
    orbit:unit.id*2.39996,shieldBurst:0};
   unit.attackT=variant==='traveler'?2.5:3.6;
   if(variant==='traveler'){
    unit.travelerShieldMax=maxHp*.82;
    unit.travelerShield=unit.travelerShieldMax;
   }
  }
  if(variant==='ophanim'){
   unit.ultimateClock=2.8;unit.ultimateStage='idle';unit.attackT=99;unit.moveSpeed=0;
  }
  if(variant==='wallmaw'){
   unit.wall={phase:'emerge',clock:0,attack:0,attackT:cycleOf(wave)>1?1.7:2.6,summonT:cycleOf(wave)>1?5:7.5,
    mouth:0,lash:0,aim:0,casts:0};
   unit.x=C;unit.z=1.90;unit.facing=Math.PI;
   unit.attackT=99;unit.ultimateClock=99;
  }
  if(variant==='puppet'){
   const armMax=maxHp*.30,headMax=maxHp-armMax*2;
   unit.puppet={left:armMax,right:armMax,head:headMax,
    leftMax:armMax,rightMax:armMax,headMax,
    phase:'arms',cycle:0,stage:'charge',clock:1.65,stageDuration:1.65,
    startLeft:0,startRight:0,fireDuration:2.05,reach:0,
    pattern:0,hitCooldown:0,pulseClock:1.9};
   unit.facing=0;unit.attackT=99;unit.ultimateClock=99;
  }
  return unit;
}
function bossTerrainClear(x,z,r){
 for(const a of [-r,0,r])for(const b of [-r,0,r]){
  if(tile(x+a,z+b))return false;
 }
 return true;
}
function bossSpawnClearance(){
 for(const p of [{x:C,z:C},{x:C,z:C+4},{x:C+4,z:C},{x:C-4,z:C},{x:C,z:C-4}]){
  if(bossTerrainClear(p.x,p.z,1.58)&&Math.hypot(p.x-player.x,p.z-player.z)>4)return p;
 }
 for(let k=0;k<24;k++){
  const p=randomOpen(8);
  if(p.x>3&&p.x<N-3&&p.z>3&&p.z<N-3&&bossTerrainClear(p.x,p.z,1.58))return p;
 }
 return {x:C,z:C};
}
function spawnEnemy(){
 let pos=randomOpen(5);
 if(Math.hypot(pos.x-player.x,pos.z-player.z)<4)pos=randomOpen(6);
 const boss=hellBreach.state==='active'?false:(wave%3===0)&&spawnPending===1;
 if(boss)pos=(localWaveOf(wave)===CAMPAIGN_WAVES&&free(C,C,.32))?{x:C,z:C}:bossSpawnClearance();
 if(hellBreach.state==='active'){spawnHellFiend();return;}
 // A strict 0.05% roll is made for each eligible ordinary spawn, never for
 // bosses, Test Lab, Hell/Heaven or another special pending encounter.
 if(!boss&&!testLabMode&&wave>1&&blockworld.state==='none'&&
    heavenSanctum.state==='none'&&hellBreach.state==='none'&&
    !enemies.some(isBoss)&&rnd()<BLOCKWORLD_SPAWN_CHANCE){
  blockworld={...blockworld,state:'trigger',stage:0,
   returnWave:wave,returnSector:sector,found:true,
   triggers:blockworld.triggers+1,transition:0};
  const gate=makeBlockworldEnemy('creeper',pos,true);
  enemies.push(gate);spawnPending=1; // caller decrements to zero
  announce('AN UNFAMILIAR GREEN SHAPE...',2.8);
  notice('SECRET ENCOUNTER // THE CREEPER',2.6);
  sound('creeperhiss');saveCheckpoint();return;
 }
 const enemy=newEnemy(pos,boss);
 if(boss&&!testLabMode&&localWaveOf(wave)<CAMPAIGN_WAVES&&wave>5&&
    !['puppet','ophanim','wallmaw'].includes(enemy.type)&&rnd()<.13){
  const mirror=rnd()<.5;enemy.wyrdfluxRareBoss=mirror?'mirror':'ember';
  enemy.wyrdfluxRareBossClock=2.5;
  if(mirror){
   enemy.type='traveler';enemy.saucer={clock:0,volley:0,hover:5.45,orbit:enemy.id*.87,shieldBurst:0};
   enemy.travelerShieldMax=enemy.maxHp*.32;enemy.travelerShield=enemy.travelerShieldMax;
   enemy.speed=1.05*cycleDifficulty(wave).speed;enemy.attackT=2.3;
  }else{
   enemy.type='behemoth';enemy.speed=.86*cycleDifficulty(wave).speed;
   enemy.attackT=1.2;enemy.ultimateClock=2;
  }
  enemy.hp=enemy.maxHp=Math.max(enemy.maxHp,mirror?1800:2100);
 }
  // Some bulky enemies require more clearance than randomOpen's default radius.
  // Search for a legal foothold before their first rendered/animated frame.
  if(!boss&&!free(enemy.x,enemy.z,enemyCollisionRadius(enemy))){
   let placed=false;
   for(let i=0;i<36;i++){
    const p=randomOpen(4);
    if(free(p.x,p.z,enemyCollisionRadius(enemy))){enemy.x=p.x;enemy.z=p.z;placed=true;break;}
   }
   if(!placed)return; // skip a blocked spawn rather than embedding in a wall
  }
  enemy.appearT=boss?0:.50;if(boss)enemy.damageAtSpawn=runRecord.damageEvents;enemies.push(enemy);
 if(boss){burst(enemy.x,enemy.z,BOSS_REVEALS[enemy.type].col,2.7);beginBossIntro(enemy)}
}
// Sweep short steps to prevent high-speed dashes, lunges and knockback from
// tunnelling through a wall. Retain axis-wise sliding used by original movement.
function collisionMove(obj,dx,dz,r=.26){
 if(!obj||!Number.isFinite(dx)||!Number.isFinite(dz)||!Number.isFinite(obj.x)||!Number.isFinite(obj.z))return;
 const distance=Math.max(Math.abs(dx),Math.abs(dz));
 if(distance>8)return; // corrupt simulation delta: fail closed, never teleport
 const count=Math.max(1,Math.ceil(distance/.16)),sx=dx/count,sz=dz/count;
 for(let i=0;i<count;i++){
  const charging=obj!==player&&obj?.type&&
    (obj.meleeStage==='lunge'||obj.thrusterPhase==='slide'||
     (obj.impLeapT||0)>0||(obj.pinkyHopT||0)>0);
  const gap=Math.max(1.24,1+r*.60);
  if(free(obj.x+sx,obj.z,r)&&
     (!charging||Math.hypot(obj.x+sx-player.x,obj.z-player.z)>=gap))obj.x+=sx;
  if(free(obj.x,obj.z+sz,r)&&
     (!charging||Math.hypot(obj.x-player.x,obj.z+sz-player.z)>=gap))obj.z+=sz;
 }
}
function lineClear(x1,z1,x2,z2){let dist=Math.hypot(x2-x1,z2-z1),steps=Math.ceil(dist/.12);for(let s=1;s<steps;s++){const t=s/steps;if(tile(mix(x1,x2,t),mix(z1,z2,t)))return false}return true}

/**
 * Camera-space 3D hit detection. This path is shared by damage, the target
 * reticle and visual tracers; shooting upward no longer hits ground enemies.
 * Enemy hit volumes are bounded upright capsules. Environment stops projectiles
 * at the first solid wall/floor rather than displaying an impossible straight
 * line through the world.
 */
// WYRDFLUX v0616: artist-readable weak spots that map to the SAME 3D hit
// volumes used for damage. The regular melee cohort has a narrow head plate;
// ranged units briefly open a chest cooling core for 0.55s after shooting.
// Bosses have guarded weak cores, respecting Warden rites, Traveler shields
// and custom Puppet/Kraken multi-part boss mechanics.
let wyrdfluxWeakspotHits=0,wyrdfluxBossWeakspotHits=0,wyrdfluxRangedRecoveryWeakspots=0;
function wyrdfluxWeakspotSpec(e){
 if(!e||e.hp<=0||e.wardenMite||e.krakenPart||e.circusActor||e.type==='puppet')return null;
 if(e.saucer){
  return {part:'weakcore',y:e.saucer.hover+.25,front:0,radius:e.type==='traveler'?.37:.30,
   open:!(e.travelerShield>0),boss:true};
 }
 if(e.type==='wallmaw'){
  return {part:'weakcore',y:1.72,front:-1.00,radius:.44,open:e.wall?.phase!=='emerge',boss:true};
 }
 if(e.type==='warden'){
  return {part:'weakcore',y:2.02,front:.30,radius:.34,
   open:!e.wardenRite?.active,boss:true};
 }
 if(e.blockKind==='warden'){
  return {part:'weakcore',y:1.69,front:.42,radius:.30,open:true,boss:true};
 }
 if(e.type==='ophanim'){
  return {part:'weakcore',y:2.1,front:.38,radius:.34,open:true,boss:true};
 }
 const boss=isBoss(e);
 if(boss){
  return {part:'weakcore',y:e.type==='colossus'?3.85:2.58,
   front:.40,radius:e.type==='colossus'?.40:.32,open:true,boss:true};
 }
 const shooter=RANGED_TYPES.has(e.type)||e.hellVariant==='imp'||e.hellVariant==='hellknight';
 if(shooter){
  return {part:'weakcore',
   y:e.type==='drone'?1.72:e.hellVariant==='hellknight'?1.85:1.44,
   front:.31,radius:.235,open:(e.weakOpenUntil||0)>time,
   postShot:true,boss:false};
 }
 return {part:'weakhead',y:e.type==='crusher'||e.type==='bulwark'?2.22:1.77,
  front:.30,radius:e.type==='crusher'?.285:.24,open:true,boss:false};
}
function drawWyrdfluxWeakspotVisual(m,e,q){
 const spot=wyrdfluxWeakspotSpec(e);
 if(!spot)return;
 const dist=Math.hypot(e.x-player.x,e.z-player.z);
 if(dist>(spot.boss?32:q==='battery'?9:q==='high'?22:14))return;
 const p=spot.front,angle=e.facing||0;
 const x=e.type==='wallmaw'?e.x:e.x-Math.sin(angle)*p;
 const z=e.type==='wallmaw'?e.z+1.00:e.z-Math.cos(angle)*p;
 const open=spot.open,th=.026,col=open?'orange':'rust';
 // A recessed angular vent/eye, not the glowing orb that obscured Warden's face.
 const size=spot.radius*(spot.boss?.94:.75);
 m.box(x,spot.y,z,size*1.5,size*1.35,th,
   open?'wound':'ironblack',.025,angle);
 if(open){
  m.box(x,spot.y,z+(e.type==='wallmaw'?.028:0),size*.70,size*.75,.035,
   col,spot.postShot?.59:.30,angle);
  if(q==='high')for(const side of [-1,1])
   m.beam(x+side*size*.71,spot.y-size*.5,z,
    x+side*size*.71,spot.y+size*.5,z,.013,'brass',.16);
 }
}

function shotRay3D(yaw,pitch,range){
 const cp=Math.cos(pitch),sp=Math.sin(pitch),nx=Math.sin(yaw)*cp,nz=-Math.cos(yaw)*cp;
 const ox=player.x,oy=1.64+player.height,oz=player.z;
 let best=null,tHit=range,bestPart=null;
 for(const e of enemies){
   if(e.hp<=0)continue;
   if(e.krakenPart){
    const rx=e.x-ox,rz=e.z-oz,fwd=rx*Math.sin(yaw)-rz*Math.cos(yaw),
     side=Math.abs(rx*Math.cos(yaw)+rz*Math.sin(yaw));
    if(fwd>.18&&side<.82){
     const y=oy+Math.tan(pitch)*fwd;
     if(y>.12&&y<Math.max(2.8,(blackwakeKraken.parts[e.krakenIndex]?.tipY||2.5)+.6)){
      const t=Math.max(.2,(fwd-Math.sqrt(Math.max(0,.82*.82-side*side)))/Math.max(.06,cp));
      if(t<tHit){tHit=t;best=e;bestPart='tentacle';}
     }
    }
    continue;
   }
   if(e.type==='puppet'){
    const part=puppetRayPart(e,ox,oy,oz,nx,sp,nz,range);
    if(part&&part.distance<tHit){tHit=part.distance;best=e;bestPart=part.part}
    continue;
   }
   const rx=e.x-ox,rz=e.z-oz,horizontal=rx*Math.sin(yaw)-rz*Math.cos(yaw);
  if(horizontal<=.2||horizontal>range*cp+.7)continue;
  const side=Math.abs(rx*Math.cos(yaw)+rz*Math.sin(yaw));
  const boss=isBoss(e),drone=e.type==='drone',wide=e.saucer?(e.type==='traveler'?2.1:1.05):e.wardenMite?.16:e.type==='wallmaw'?(e.wall?.enraged?8.8:2.05):boss?Math.min(2.0,e.type==='colossus'?1.9:1.35):e.type==='crusher'||e.type==='bulwark'?.65:drone?.50:.42;
  if(side>wide)continue;
  const y=oy+Math.tan(pitch)*horizontal;
  const bottom=e.saucer?e.saucer.hover-(e.type==='traveler'?1.05:.88):e.wardenMite?.09:drone?1.20:boss?.15:.06,top=e.saucer?e.saucer.hover+(e.type==='traveler'?1.25:.88):e.wardenMite?.62:e.type==='wallmaw'&&e.wall?.enraged?8.2:drone?2.30:boss?(e.type==='colossus'?7.2:5.4):e.type==='crusher'||e.type==='bulwark'?3.1:2.35;
  if(y<bottom||y>top)continue;
  const t=Math.max(.2,(horizontal-Math.sqrt(Math.max(0,wide*wide-side*side)))/Math.max(.01,cp));
  if(t<tHit){
   tHit=t;best=e;bestPart=null;
   const spot=wyrdfluxWeakspotSpec(e);
   if(spot?.open&&Math.abs(y-spot.y)<=spot.radius&&side<=spot.radius){
    // A glow or painted icon cannot grant a bonus behind a solid wall.
    // We apply the occlusion test below before returning this hit.
    bestPart=spot.part;
   }
  }
 }
 // Occlusion: step along the actual 3D ray. A high-aim shot may clear a wall.
 let impactDist=tHit,blocked=false;
 for(let t=.2;t<=tHit;t+=.20){
  const x=ox+nx*t,y=oy+sp*t,z=oz+nz*t;
  if(y<.045||(tile(x,z)&&y<2.95)||(edge(Math.floor(x),Math.floor(z))&&y<3.4)){
   impactDist=t;blocked=true;break;
  }
 }
 if(blocked){best=null;bestPart=null;}
 const t=clamp(impactDist,.2,range);
 return {enemy:best,hitPart:bestPart,hit:{x:ox+nx*t,y:Math.max(.045,oy+sp*t),z:oz+nz*t},distance:t,dirY:sp,pitch,blocked};
}
function nearestEnemyAlongRay(angle,range,spread){let best=null,closest=range;for(const e of enemies){const d=Math.hypot(e.x-player.x,e.z-player.z);if(d>range||d<.25)continue;const theta=Math.atan2(e.x-player.x,-(e.z-player.z));const diff=Math.atan2(Math.sin(theta-angle),Math.cos(theta-angle));const hitWidth=e.wardenMite?.16:isBoss(e)?1.1:(e.type==='crusher'||e.type==='bulwark')?.63:e.type==='drone'?.44:.38;if(Math.abs(diff)>Math.atan2(hitWidth,d)+spread*.35||!lineClear(player.x,player.z,e.x,e.z))continue;if(d<closest){best=e;closest=d}}return best}
function spark(x,z,col='purple',count=8){for(let i=0;i<count;i++)particles.push({x,y:.65+rnd()*1.4,z,vx:(rnd()-.5)*4,vy:rnd()*3,vz:(rnd()-.5)*4,life:.22+rnd()*.52,max:.75,col,size:.018+rnd()*.04});if(particles.length>240)particles.splice(0,particles.length-240)}

let combatTexts=[],burstRings=[];
function burst(x,z,col='cyan',r=1.5,duration=.42){burstRings.push({x,z,col,r,life:duration,max:duration});if(burstRings.length>24)burstRings.shift();spark(x,z,col,14)}
function combatText(x,z,label,col='cyan'){const holder=$('combatFloats');const el=holder?document.createElement('div'):null;if(el){el.className='floatText '+(col==='gold'?'gold':'');el.textContent=label;holder.appendChild(el)}combatTexts.push({x,z,label,col,el,life:.65,y:1.8,vy:1.1});if(combatTexts.length>24){const old=combatTexts.shift();old?.el?.remove()}}
function blastAt(x,z,damage,radius,depth=0,source='blast'){
 burst(x,z,source==='shock'?'cyan':'orange',radius);
 let hit=0;
 for(const e of [...enemies]){
  if(hit>=(enemies.some(x=>x.wardenMite)?46:10))break;const d=Math.hypot(e.x-x,e.z-z);if(d>radius)continue;
  hit++;damageEnemy(e,damage*Math.max(.25,1-d/(radius*1.4)),source,depth+1);
  if(stacks('gravwell')&&e.hp>0&&d>.25){
   const pull=Math.min(.42,.12*stacks('gravwell')),nx=e.x+(x-e.x)/d*pull,nz=e.z+(z-e.z)/d*pull;
   if(free(nx,nz,.28)){e.x=nx;e.z=nz}
  }
 }
}
function chainFrom(root,dmg,hopBonus=0){
 const hops=Math.min(5,1+Math.floor(stacks('arc')*.6)+hopBonus),visited=new Set([root.id]);
 let last=root,count=0;
 for(let i=0;i<hops;i++){
  let best=null,bestDist=3.1+stacks('arc')*.38;
  for(const e of enemies){if(visited.has(e.id)||e.hp<=0)continue;const d=Math.hypot(e.x-last.x,e.z-last.z);if(d<bestDist&&lineClear(last.x,last.z,e.x,e.z)){best=e;bestDist=d}}
  if(!best)break;
  visited.add(best.id);count++;
  tracers.push({x1:last.x,y1:1.42,z1:last.z,x2:best.x,y2:1.42,z2:best.z,life:.83,max:.83,col:'cyan',accent:'purple',kind:'arc',phase:rnd()*TAU});
  spark(best.x,best.z,'cyan',6);
  damageEnemy(best,dmg*Math.pow(.77,i),'arc');
  last=best;
 }
 if(count&&stacks('guard'))player.shield=Math.min(player.maxShield,player.shield+count*1.5*stacks('guard'));
}

function armorImpact(e,col='cyan',critical=false){
 if(impactFlashes.length>=28)impactFlashes.shift();
 const life=critical?.31:.21;
 impactFlashes.push({x:e.x,y:e.type==='warden'?2.05:e.type==='drone'?1.7:1.3,z:e.z-.34,
  life,max:life,col,scale:critical?.48:.27,phase:rnd()*TAU});
}
function scatterArmor(e){
 const boss=isBoss(e),heavy=e.type==='crusher'||e.type==='bulwark';
 const count=boss?23:heavy?13:9;
 const palette=boss?['rim','purple','metal','pink']:e.type==='drone'?['metal','orange','rim']:['metal2','rim','rust','brass'];
 for(let i=0;i<count;i++){
  const angle=rnd()*TAU,speed=.6+rnd()*2.6,s=(boss?.095:.065)+rnd()*(boss?.16:.08);
  debris.push({x:e.x+(rnd()-.5)*.33,y:(boss?1.3:.65)+rnd()*(boss?2.4:1.0),z:e.z+(rnd()-.5)*.33,
   vx:Math.cos(angle)*speed,vy:1.3+rnd()*3.7,vz:Math.sin(angle)*speed,
   size:s,life:1.1+rnd()*1.5,col:palette[i%palette.length],spin:rnd()*TAU});
 }
 if(debris.length>120)debris.splice(0,debris.length-120);
}
function damageEnemy(e,dmg,cause='weapon',depth=0,hitPart=null){
  if(!e||e.hp<=0)return;
  if(e.krakenPart){blackwakeKrakenDamage(e,dmg);return;}
  // The Ringmaster's first lethal shot is an Encore cue, not a kill.
  // The airborne shield rejects every source of damage (including DOT/AOE).
  if(e.circusActor&&e.boss&&circus.state==='active'){
   if(circus.encore==='ascension'){
    if(cause==='weapon'||cause==='arc')spark(e.x,e.z,'purple',4);
    return;
   }
   if(circus.encore==='first'&&e.hp-Math.max(.1,Number(dmg)||0)<=e.maxHp*.08){
    beginCircusEncore(e);return;
   }
  }
  // Player damage during the staged dancing or mask reveal is an intentional
  // high-risk choice. The reward path remains identical; only threat changes.
  if(e.circusActor&&circus.state==='active'&&
     ['weapon','arc','blast','shock','burnout','frost'].includes(cause)){
    // Puppets are untouchable mannequins until the player walks into the ring.
    if(circus.performance==='waiting')return;
    if(['dance','silence','reveal'].includes(circus.performance))enrageCircus(e);
  }
  if(e.type==='warden'){
   const rite=ensureWardenRite(e);
   if(rite.active){if(cause==='weapon'||cause==='arc')spark(e.x,e.z,'purple',3);return;}
   const threshold=WARDEN_RITE_HP_GATES[rite.phase];
   if(threshold!=null&&e.hp-dmg<=e.maxHp*threshold){
    e.hp=e.maxHp*threshold;startWardenRite(e);return;
   }
  }
  if(e.type==='traveler'&&(e.travelerShield||0)>0){
   e.travelerShield=Math.max(0,e.travelerShield-Math.max(.1,dmg));
   e.hit=.24;e.saucer.shieldBurst=.7;
   spark(e.x,e.z,e.travelerShield>0?'cyan':'orange',8);
   if(e.travelerShield===0){
    announce('TRAVELER SHIELD BROKEN · CORE EXPOSED',3);
    burst(e.x,e.z,'cyan',3.8,.8);
   }
   return;
  }
  if(e.wardenMite){
   e.hp=Math.max(0,e.hp-Math.max(.1,dmg));e.hit=.15;
   if(e.hp<=0){spark(e.x,e.z,'purple',5);
    enemies=enemies.filter(x=>x!==e);sound('hit');}
   return;
  }
  if(e.sanctumGuardian&&!e.sanctumHostile){e.sanctumHostile=true;heavenSanctum.guardianHostile=true;e.speed=1.65;e.ultimateClock=.45;announce('THE OPHANIM HAS BEEN ANGERED',2.5);notice('YOU STRUCK THE PEACEFUL JUDGE · PREPARE FOR JUDGEMENT',3.5);saveCheckpoint();}
  let actual=Math.max(.1,dmg);
  if(e.type==='wallmaw'&&e.wall?.enraged)actual*=.5;
  if(e.type==='puppet'){
   actual=hitPuppetPart(e,actual,hitPart,cause);
   if(actual<=0){
    const p=e.puppet;
    if(p&&p.left<=0&&p.right<=0&&p.head<=0)actual=Math.max(.1,e.hp);
    else return;
   }
  }
  // First DIRECT shot tears away the imp's smoke disguise. Preserve this
  // on the enemy object so it cannot re-shade between animation/LOD frames.
  if(actual>0&&impShotReveals(e.hellVariant,cause,e.impRevealed)){
   e.impRevealed=true;e.impRevealUntil=time+.7;
   spark(e.x,e.z,'magma',11);spawnImpactJet(e.x,1.30,e.z,'ember',9);
  }
  if(desktopPC&&actual>0){
   e.pcLastHealthHit=time;
   e.pcHealthTrail=clamp(e.hp/Math.max(1,e.maxHp),0,1);
   e.pcHealthTrailUntil=time+.38;
  }
  e.hp=e.type==='puppet'&&e.puppet?Math.max(0,e.puppet.left+e.puppet.right+e.puppet.head):Math.max(0,e.hp-actual);e.hit=.24;if(e.type!=='puppet'){e.flinchVel=Math.min(2.2,(e.flinchVel||0)+actual/(isBoss(e)?420:95));e.intentClock=Math.min(e.intentClock||0,.18)}
 if(cause==='weapon'||cause==='arc'){
  armorImpact(e,cause==='arc'?'cyan':e.type==='artillery'?'gold':'pink',false);
  spawnImpactJet(e.x,Math.min(2.2,isBoss(e)?2.0:1.2),e.z-.3,cause==='arc'?'cyan':'warm',4);
 }
 if(cause==='weapon'){player.impactGlow=.13}
 spark(e.x,e.z,e.type==='crusher'?'orange':cause==='arc'?'cyan':'pink',Math.min(6,2+Math.ceil(actual/28)));
 if(cause==='weapon'&&stacks('arc')>0&&rnd()<Math.min(.8,.10+stacks('arc')*.115))chainFrom(e,actual*(.30+stacks('arc')*.07),activeFusions().some(f=>f.id==='storm')?1:0);
 if(cause==='weapon'&&stacks('prism')>0&&rnd()<Math.min(.45,.06+stacks('prism')*.09))chainFrom(e,actual*.26,1);
 if(e.hp<=0){
  if(e.wyrdfluxTwin){
   wyrdfluxAnomaly.twinsFallen++;
   if(wyrdfluxAnomaly.twinsFallen===2){
    player.cash+=36;player.shield=Math.min(player.maxShield,player.shield+18);
    announce('TWIN SKY HUNTERS // DOUBLE KILL',2.6);
    notice('+36 SALVAGE · +18 SHIELD',2.6);sound('upgrade');
   }
  }
  if(e.wyrdfluxRareBoss){
   player.cash+=75;player.shield=Math.min(player.maxShield,player.shield+28);
   notice('RARE BOSS BOUNTY · +75 SALVAGE · +28 SHIELD',3.2);
  }
  if(e.type==='puppet'){
    if(!testLabMode){const newShadow=!wyrdfluxShadowUnlocked();meta.shadowBrainWins=Math.max(1,meta.shadowBrainWins||0);saveMeta();if(newShadow){announce('SHADOW RELAY // PERMANENTLY UNLOCKED',4);notice('FIRST DRONE ACTIVE · FUTURE DRONES TRAIL BY ONE SECOND',3.5);sound('upgrade');}}
    startPuppetFinale(e);
   }
  if(e.sanctumGuardian){heavenSanctum.guardianDefeated=true;notice('CELESTIAL JUDGEMENT ENDED · ALTAR UNSEALED',3.3);}
  recordDeathGhost(e);
  if(e.blockKind==='creeper'&&e.blockTrigger&&blockworld.state==='trigger')blockworldShift(e);
   if(e.type==='ophanim'&&heavenSanctum.state==='none'){
   heavenSanctum={state:'gate',gateX:e.x,gateZ:e.z,returnWave:wave,
    returnSector:sector,entered:0};
   sound('heavengate');announce('THE OPHANIM HAS FALLEN // THE LIGHT OPENS',4);
   notice('STAND IN THE LIGHT · HOLD ACTIVATE',3.8);
  }
  if(e.type==='wallmaw'&&hellBreach.state==='none'){
   hellBreach.state='pending';hellBreach.encountered=true;
   hellBreach.returnWave=wave;hellBreach.returnSector=sector;
  }
  if(hellBreach.state==='active')hellBreach.kills++;
   if(e.circusActor)circusActorDeath(e);
  kills++;const boss=isBoss(e),base=e.type==='crusher'||e.type==='bulwark'?180:100;
  creditRunKillXP(boss);
   if(boss){if(!testLabMode&&!e.circusActor)bossShopDue++;runRecord.bossKills++;if((e.damageAtSpawn??-1)===runRecord.damageEvents){
    runRecord.perfectBosses++;if(e.type==='puppet')runRecord.perfectPuppets++;
   }}
  totalScore+=Math.round((boss?1500:base)*(1+permanentStats().loot));player.cash+=(boss?400:42)*(1+stacks('scav')*.19)*(1+permanentStats().loot)*(1+(player.perks?.corsair? .12:0));
  spark(e.x,e.z,'pink',boss?40:24);scatterArmor(e);burst(e.x,e.z,boss?'purple':'orange',boss?2.1:.95);
  if(rnd()<.14+.025*stacks('scav'))pickups.push({x:e.x,z:e.z,life:20,type:rnd()<.45?'health':'shield'});
  enemies=enemies.filter(o=>o!==e);sound('hit');
  if(stacks('vamp'))player.hp=Math.min(player.maxHp,player.hp+Math.min(16,2.7*stacks('vamp')));
  if(stacks('guard')){player.shield=Math.min(player.maxShield,player.shield+4.8*stacks('guard'));wyrdfluxGunThermal(gun).heat=Math.max(0,wyrdfluxGunThermal(gun).heat-.045*stacks('guard'))}
  if(stacks('frenzy'))player.frenzyT=Math.min(7,player.frenzyT+1.9+stacks('frenzy')*.4);
  if(stacks('secondwind')&&rnd()<Math.min(.72,.13+stacks('secondwind')*.08))player.hp=Math.min(player.maxHp,player.hp+4*stacks('secondwind'));
  if(stacks('bulwarkcore')&&(boss||e.type==='crusher'||e.type==='bulwark'))player.shield=Math.min(player.maxShield,player.shield+14*stacks('bulwarkcore'));
  if(stacks('burnout')&&e.burnUntil>time&&depth<2)blastAt(e.x,e.z,14+stacks('burnout')*7,1.5+stacks('burnout')*.1,depth,'burnout');
  if(stacks('coldsnap')&&e.slowUntil>time&&depth<2)blastAt(e.x,e.z,12+stacks('coldsnap')*7,1.4+stacks('coldsnap')*.14,depth,'frost');
  if(stacks('supernova')&&kills%7===0&&depth<3)blastAt(e.x,e.z,27+stacks('supernova')*28,2.3,depth,'shock');
  if(stacks('hivemind')&&kills%4===0&&depth<3){const victim=enemies.find(t=>t.hp>0);if(victim)chainFrom(victim,14*stacks('hivemind'),2);}
  if(stacks('blast')>0&&depth<=2&&(cause!=='shock'||activeFusions().some(f=>f.id==='detonator'))){blastAt(e.x,e.z,(14+stacks('blast')*13)*player.damageMult,1.55+stacks('blast')*.12,depth,'blast')}
  if(stacks('vortex')>0){for(const t of enemies){const d=Math.hypot(t.x-e.x,t.z-e.z);if(d<3.2&&d>.1){const nx=t.x+(e.x-t.x)/d*.13*stacks('vortex'),nz=t.z+(e.z-t.z)/d*.13*stacks('vortex');if(free(nx,nz,.24)){t.x=nx;t.z=nz}}}burst(e.x,e.z,'purple',2)}
  if(stacks('singularity')&&stacks('vortex')&&depth<2)blastAt(e.x,e.z,16*stacks('singularity'),2.8,depth,'arc');
 }
}


function appliedWeaponTrait(e,trait){
 if(!e||e.hp<=0)return;
 if(trait==='ignite'){e.burnUntil=Math.max(e.burnUntil||0,time+3.3);e.burnTick=Math.min(e.burnTick||time+.5,time+.5);spark(e.x,e.z,'orange',2)}
 if(trait==='freeze'){e.slowUntil=Math.max(e.slowUntil||0,time+2.1);e.vulnUntil=Math.max(e.vulnUntil||0,time+1.5);e.vulnStack=Math.min(5,(e.vulnStack||0)+1);spark(e.x,e.z,'cyan',3)}
 if(trait==='shred'){e.vulnUntil=Math.max(e.vulnUntil||0,time+4.2);e.vulnStack=Math.min(5,(e.vulnStack||0)+1)}
 if(trait==='gravity'){
  for(const t of enemies){if(t===e||t.hp<=0)continue;let dx=e.x-t.x,dz=e.z-t.z,d=Math.hypot(dx,dz);
   if(d<3.1&&d>.2){const tx=t.x+dx/d*.4,tz=t.z+dz/d*.4;if(free(tx,tz,.28)){t.x=tx;t.z=tz}}
  }
 }
 if(trait==='arc')chainFrom(e,12+stacks('arc')*4,1);
}
let lingeringBeams=[],wyrdfluxContactFX=[];
function wyrdfluxTracerMuzzle(p){
 const yaw=p.yaw,pitch=clamp(p.pitch,-1.2,1.2);
 return {x:p.x+Math.cos(yaw)*.13+Math.sin(yaw)*.25,
  y:1.64+p.height-.15+Math.sin(pitch)*.25,
  z:p.z+Math.sin(yaw)*.13-Math.cos(yaw)*.25};
}
function queueWyrdfluxContactFX(hit,kind,col,distance){
 const speed=kind==='rocket'?15:kind==='rail'?105:kind==='cryo'?24:37;
 const radius=kind==='rocket'?2.0:kind==='rail'?.70:.46;
 wyrdfluxContactFX.push({x:hit.x,y:Math.max(.07,hit.y),z:hit.z,
  kind,col:kind==='rocket'?'orange':col,
  delay:Math.min(1.9,Math.max(0,distance)/speed),
  life:.72,max:.72,radius,seed:rnd()*TAU});
 if(wyrdfluxContactFX.length>32)wyrdfluxContactFX.splice(0,wyrdfluxContactFX.length-32);
}

// WYRDFLUX v0616 — persisted per-weapon thermal state.
// Kept on player so checkpoint/resume and swapping gun tabs cannot
// clear an overheated weapon. Each equipped gun cools while unequipped.
let wyrdfluxThermalLockCount=0,wyrdfluxThermalRejects=0,wyrdfluxThermalSteamFrames=0;
function wyrdfluxGunThermal(index=gun){
 if(!Array.isArray(player.weaponThermals))player.weaponThermals=[];
 if(!player.weaponThermals[index])player.weaponThermals[index]={heat:0,lock:0,quiet:0,overheated:false};
 const t=player.weaponThermals[index];
 t.heat=clamp(Number(t.heat)||0,0,1);
 t.lock=clamp(Number(t.lock)||0,0,8);
 t.quiet=clamp(Number(t.quiet)||0,0,3);
 t.overheated=!!t.overheated;
 return t;
}
function coolWyrdfluxThermals(dt){
 if(!player||!Array.isArray(player.weaponThermals))return;
 for(const t of player.weaponThermals){
  if(!t)continue;
  t.quiet=Math.max(0,(t.quiet||0)-dt);
  t.lock=Math.max(0,(t.lock||0)-dt);
  if(t.quiet<=0)t.heat=Math.max(0,(t.heat||0)-dt*.31*Math.max(.65,Math.min(2.5,player.coolingMult||1)));
  if(t.overheated&&t.lock<=0&&t.heat<=.28)t.overheated=false;
 }
 player.heat=wyrdfluxGunThermal(gun).heat;
}
function fireWyrdfluxThermal(gunId,weapon){
 const t=wyrdfluxGunThermal(gunId);
 if(t.overheated||t.lock>0){
  wyrdfluxThermalRejects++;
  player.heat=t.heat;
  if((player.thermalNoticeUntil||0)<time){
   player.thermalNoticeUntil=time+2;
   notice('WEAPON OVERHEATED · WAIT FOR VENTS TO COOL',1.6);
  }
  return false;
 }
 t.heat=clamp(t.heat+clamp((weapon.rate||.3)*.26,.10,.30),0,1);
 t.quiet=.40;
 if(t.heat>=.995){
  t.overheated=true;t.lock=1.25;wyrdfluxThermalLockCount++;
  notice('OVERHEATED · VENTING, WEAPON LOCKED',1.9);
 }
 player.heat=t.heat;
 return true;
}
function drawWyrdfluxWeaponSteam(m,bx,by,bz,p){
 const t=wyrdfluxGunThermal(gun),heat=t.heat;
 if(heat<.20)return;
 const quality=$('quality').value;
 const count=quality==='battery'?1:quality==='high'?Math.ceil(2+heat*8):Math.ceil(1+heat*4);
 const steam=clamp((heat-.17)/.83,0,1);
 for(let i=0;i<count;i++){
  const side=i%2?-1:1,period=((time*(.47+steam*.31)+i*.167+gun*.091)%1),
   x=bx+side*(.11+.065*Math.sin(i*3.91+time*2)),
   y=by+.19+period*(.18+steam*.33),
   z=bz-.20-(i%3)*.15+period*.075;
  // Camera-local smoke streaks. No huge opaque spheres.
  m.beam(x,by+.17,z,x+.08*Math.sin(time*2+i),y,z+.03,
   (.009+.024*steam)*(1-period*.65),period>.7?'ash':'mist',
   .03+.16*steam*(1-period));
 }
 if(t.overheated){
  m.box(bx,by+.26,bz-.25,.15,.028,.10,'rust',.11+.20*Math.sin(time*12)**2);
 }
 wyrdfluxThermalSteamFrames++;
}


/* PC projectile simulation: every non-beam shot travels through live 3D
 * collision geometry. The aim ray is for the crosshair/range only, never
 * applied damage. Hit callbacks run solely at the actual flight contact. */
let wyrdfluxPlayerShots=[];
/* SHADOW TEST: short bounded replay history and independently timed drones.
   Drones replay actual old directions, never auto-aim at current enemies. */
const WYRDFLUX_SHADOW_COLORS=['cyan','pink','green','orange','purple'];
const wyrdfluxShadowDelay=i=>WYRDFLUX_SHADOW_DELAY+i*WYRDFLUX_SHADOW_STAGGER;
const wyrdfluxShadowColor=i=>WYRDFLUX_SHADOW_COLORS[i%WYRDFLUX_SHADOW_COLORS.length];
let wyrdfluxShadowHistory=[],wyrdfluxShadowShots=[],wyrdfluxShadowCursors=[],wyrdfluxShadowEmitted=0;
let wyrdfluxShadowPulses=[],wyrdfluxShadowLastAudio=[];
function wyrdfluxShadowAudio(index,kind){
 if(typeof muted==='undefined'||muted||typeof ctxAudio==='undefined'||!ctxAudio||
    !audioUnlocked||ctxAudio.state!=='running')return;
 const t=ctxAudio.currentTime;
 if(t-(wyrdfluxShadowLastAudio[index]??-10)<.105)return;
 wyrdfluxShadowLastAudio[index]=t;
 // Original synthesized firing sound: metallic downchirp, harmonic spark and a
 // brief filtered crack, deliberately lower in level than the player's gun.
 const root=[280,330,392,440,523][index%5];
 audioTone(root*2,t,.075,.039,'triangle',fxBus,root*.64);
 audioTone(root*2.98,t+.008,.11,.022,'sine',fxBus,root*1.3);
 audioNoise(t+.005,kind==='rocket'?.12:.065,.023,4200,'highpass',fxBus);
}
function resetWyrdfluxShadowReplay(){
 wyrdfluxShadowHistory=[];wyrdfluxShadowShots=[];wyrdfluxShadowCursors=[];wyrdfluxShadowEmitted=0;wyrdfluxShadowPulses=[];wyrdfluxShadowLastAudio=[];
}
function wyrdfluxRecordShadowShot(shot){
 if(!wyrdfluxShadowCount())return;
 // Max four real historical pellet rays per trigger keeps stacked replay affordable.
 wyrdfluxShadowShots.push(shot);
 if(wyrdfluxShadowShots.length>1600)wyrdfluxShadowShots.splice(0,wyrdfluxShadowShots.length-1600);
}
function wyrdfluxShadowSample(at){
 const a=wyrdfluxShadowHistory,n=a.length;
 if(!n||at<a[0].t||at>a[n-1].t)return null;
 let l=0,h=n-1;while(l<h){const m=(l+h)>>1;if(a[m].t<at)l=m+1;else h=m;}
 const before=a[Math.max(0,l-1)],after=a[l],
  f=clamp((at-before.t)/Math.max(.0001,after.t-before.t),0,1);
 return {x:mix(before.x,after.x,f),z:mix(before.z,after.z,f),
  height:mix(before.height,after.height,f),yaw:mix(before.yaw,after.yaw,f)};
}
function wyrdfluxShadowSide(i){return i===0?0:(i%2?1:-1)*Math.ceil(i/2)*.57}
function wyrdfluxShadowFire(shot,index){
 if(wyrdfluxPlayerShots.length>=160)return;
 wyrdfluxShadowEmitted++;wyrdfluxShadowPulses[index]=time;wyrdfluxShadowAudio(index,shot.kind);
 const off=wyrdfluxShadowSide(index),x=shot.x+Math.cos(shot.angle)*off-Math.sin(shot.angle)*.55,
  y=1.49+shot.height+Math.sin(shot.elevation)*.23,
  z=shot.z+Math.sin(shot.angle)*off+Math.cos(shot.angle)*.55;
 const dx=Math.sin(shot.angle)*Math.cos(shot.elevation),dy=Math.sin(shot.elevation),
  dz=-Math.cos(shot.angle)*Math.cos(shot.elevation);
 const col=wyrdfluxShadowColor(index),range=Math.max(1,Math.min(48,shot.range)),
  speed=Math.max(8,Math.min(160,shot.speed));
 const life=Math.min(1.7,range/speed+.24);
 const tracer={x1:x,y1:y,z1:z,x2:x,y2:y,z2:z,life,max:life,col,accent:'white',
  kind:shot.kind,phase:index*.81,shadow:true};
 if(tracers.length<75)tracers.push(tracer);
 wyrdfluxPlayerShots.push({x,y,z,dx,dy,dz,speed,remaining:range,travelled:0,
  tracer:tracers.includes(tracer)?tracer:null,kind:'shadow',
  resolve:(enemy,hit,ray)=>{
   if(!enemy){if(ray.blocked)queueWyrdfluxContactFX(hit,shot.kind,col,0);return;}
   queueWyrdfluxContactFX(hit,shot.kind,col,0);
   damageEnemy(enemy,shot.damage,'shadow',0,ray.hitPart);
   if(shot.kind==='rocket')for(const other of [...enemies]){
    if(other===enemy||other.hp<=0)continue;
    const dist=Math.hypot(other.x-hit.x,other.z-hit.z);
    if(dist<1.35&&lineClear(hit.x,hit.z,other.x,other.z))
     damageEnemy(other,shot.damage*.36*(1-dist/1.7),'shadow',1);
   }
  }});
}
function tickWyrdfluxShadowReplay(dt){
 const count=wyrdfluxShadowCount();if(!count)return;
 wyrdfluxShadowHistory.push({t:time,x:player.x,z:player.z,height:player.height,yaw:player.yaw});
 // Preserve snapshots for the last drone (10 + 4 seconds) at high frame rates.
 const oldest=time-wyrdfluxShadowDelay(WYRDFLUX_SHADOW_MAX_DRONES-1)-.65;
 while(wyrdfluxShadowHistory.length>2500||
    (wyrdfluxShadowHistory.length>1&&wyrdfluxShadowHistory[0].t<oldest))
  wyrdfluxShadowHistory.shift();
 for(let i=0;i<count;i++){
  const until=time-wyrdfluxShadowDelay(i);
  if(until<0)continue;
  const from=wyrdfluxShadowCursors[i]??(until-Math.max(.08,dt*2));
  for(const shot of wyrdfluxShadowShots)if(shot.t>from&&shot.t<=until)
   wyrdfluxShadowFire(shot,i);
  wyrdfluxShadowCursors[i]=until;
 }
 const oldestShot=time-wyrdfluxShadowDelay(WYRDFLUX_SHADOW_MAX_DRONES-1)-.25;
 while(wyrdfluxShadowShots.length&&wyrdfluxShadowShots[0].t<oldestShot)
  wyrdfluxShadowShots.shift();
}
function drawWyrdfluxShadowDrones(m,p,q){
 if(phase!=='play')return;
 const n=wyrdfluxShadowCount();if(!n)return;
 for(let i=0;i<n;i++){
  const past=wyrdfluxShadowSample(time-wyrdfluxShadowDelay(i));
  if(!past)continue;
  const side=wyrdfluxShadowSide(i),a=past.yaw,
   x=past.x+Math.cos(a)*side-Math.sin(a)*.80,
   z=past.z+Math.sin(a)*side+Math.cos(a)*.80,
   y=1.54+past.height+.085*Math.sin(time*5+i*1.75);
  const dist=Math.hypot(x-p.x,z-p.z);
  if(dist<.50||dist>(q==='battery'?17:30))continue;
  const color=wyrdfluxShadowColor(i),glow=1.3+.35*Math.sin(time*6+i),
   shotFlash=Math.max(0,1-(time-(wyrdfluxShadowPulses[i]??-99))*7);
  // Five independent high-visibility craft with armored fuselages, glowing
  // curved rotor halos, forked winglets, belly thrusters and an active muzzle.
  m.box(x,y,z,.41,.20,.49,'metal2',.34,a);
  m.box(x,y+.11,z,.29,.10,.32,'chrome',.46,a);
  m.box(x,y+.17,z-.08,.23,.045,.24,color,glow,a);
  m.box(x,y-.045,z-.29,.15,.08,.22,color,1.7+shotFlash*2.7,a);
  m.box(x,y-.15,z+.12,.28,.08,.24,'dark',.1,a);
  for(const sign of [-1,1]){
   const wingX=x+Math.cos(a)*sign*.32,
    wingZ=z+Math.sin(a)*sign*.32;
   m.box(wingX,y-.03,wingZ,.25,.06,.34,'polished',.24,a);
   m.box(wingX,y+.02,wingZ,.16,.035,.21,color,glow*.95,a);
   m.box(wingX,y-.09,wingZ,.105,.085,.12,'metal',.12,a);
   m.beam(wingX,y-.18,wingZ,wingX,y-.34,wingZ,.065,color,.45*glow);
  }
  const ringR=.39;
  for(let k=0;k<(q==='battery'?8:12);k++){
   const t=time*(i%2?-.9:1.05)+k*TAU/(q==='battery'?8:12),next=t+TAU/(q==='battery'?8:12);
   m.beam(x+Math.cos(t)*ringR,y+.11,z+Math.sin(t)*ringR,
    x+Math.cos(next)*ringR,y+.11,z+Math.sin(next)*ringR,.028,color,glow*.35);
  }
  m.beam(x,y-.25,z,x,y-.52,z,.065,color,.36*glow);
  if(shotFlash>0)m.beam(x,y+.015,z-.24,x-Math.sin(a)*.7,y+.015,z-Math.cos(a)*.7,
    .08+shotFlash*.06,color,shotFlash*2.6);
 }
}
function tickWyrdfluxPlayerProjectiles(dt){
 if(!wyrdfluxPlayerShots.length)return;
 const alive=[];
 for(const bullet of wyrdfluxPlayerShots){
  let ended=false;
  const distance=Math.min(bullet.remaining,bullet.speed*dt);
  const steps=Math.max(1,Math.ceil(distance/.18));
  for(let j=0;j<steps&&!ended;j++){
   const move=distance/steps;
   bullet.x+=bullet.dx*move;bullet.y+=bullet.dy*move;bullet.z+=bullet.dz*move;
   bullet.travelled+=move;bullet.remaining-=move;
   const x=bullet.x,y=bullet.y,z=bullet.z;
   const hit={x,y:Math.max(.045,y),z};
   let victim=null,part=null;
   const blocked=y<.045||(tile(x,z)&&y<2.95)||
    (edge(Math.floor(x),Math.floor(z))&&y<3.4);
   if(!blocked){
    for(const e of enemies){
     if(e.hp<=0)continue;
     if(e.type==='puppet'){
      const point=puppetRayPart(e,x-bullet.dx*.18,y-bullet.dy*.18,
       z-bullet.dz*.18,bullet.dx,bullet.dy,bullet.dz,.36);
      if(point){victim=e;part=point.part;break;}
      continue;
     }
     const width=e.krakenPart?.82:
      e.saucer?(e.type==='traveler'?2.1:1.05):
      e.wardenMite?.20:e.type==='wallmaw'&&e.wall?.enraged?8.8:
      isBoss(e)?Math.min(2,e.type==='colossus'?1.9:1.35):
      e.type==='crusher'||e.type==='bulwark'?.68:e.type==='drone'?.53:.46;
     if(Math.hypot(e.x-x,e.z-z)>width)continue;
     const bottom=e.krakenPart?(e.y||0)-.1:
      e.saucer?e.saucer.hover-(e.type==='traveler'?1.05:.88):e.wardenMite?.09:
      e.type==='drone'?1.20:isBoss(e)?.15:.06;
     const top=e.krakenPart?
       (blackwakeKraken.parts[e.krakenIndex]?.tipY||2.5)+.65:
       e.saucer?e.saucer.hover+(e.type==='traveler'?1.25:.88):e.wardenMite?.62:
       e.type==='wallmaw'&&e.wall?.enraged?8.2:
       e.type==='drone'?2.30:isBoss(e)?(e.type==='colossus'?7.2:5.4):
       e.type==='crusher'||e.type==='bulwark'?3.1:2.35;
     if(y<bottom||y>top)continue;
     victim=e;
     const spot=wyrdfluxWeakspotSpec(e);
     if(spot?.open&&Math.abs(y-spot.y)<=spot.radius&&
        Math.hypot(e.x-x,e.z-z)<=spot.radius)part=spot.part;
     break;
    }
   }
   if(blocked||victim){
    ended=true;
    bullet.resolve(victim,hit,{hitPart:part,blocked,distance:bullet.travelled});
    if(bullet.tracer)bullet.tracer.life=Math.min(bullet.tracer.life,.17);
   }else if(bullet.tracer){
    bullet.tracer.x2=x;bullet.tracer.y2=y;bullet.tracer.z2=z;
    bullet.tracer.life=Math.max(bullet.tracer.life,.13);
   }
  }
  if(!ended&&bullet.remaining>.01)alive.push(bullet);
  else if(!ended){
   bullet.resolve(null,{x:bullet.x,y:bullet.y,z:bullet.z},
    {hitPart:null,blocked:false,distance:bullet.travelled});
  }
 }
 wyrdfluxPlayerShots=alive;
}

function shoot(){
 if(phase!=='play'||(livingRealm.active&&livingRealm.id!=='blackwake')||bossCine.active||time<player.nextShot)return;
 const eclipseActive=!!player.eclipseArmed&&(player.eclipseCharges||0)>0;
 const ultra=!eclipseActive?fluxsideUltraCombo(gun,mixGun):null;
 const w=eclipseActive?ECLIPSE_CATALYST:WEAPONS[gun],
  aux=eclipseActive?WEAPONS[gun]:
   isAllowedWeaponMix(gun,mixGun)?WEAPONS[mixGun]:null;
 if(!fireWyrdfluxThermal(gun,w))return;
 if(eclipseActive){
  player.eclipseCharges--;runRecord.eclipseShots=(runRecord.eclipseShots||0)+1;
  const ammo=$('ammoText');if(ammo)ammo.textContent=String(player.eclipseCharges)+' / 200';
  if(player.eclipseCharges<=0){
   player.eclipseArmed=false;notice('ECLIPSE CATALYST EXHAUSTED · NORMAL WEAPONS RESTORED',3.5);
   hudWeapon();
  }
 }
 const traits=new Set([...(w.fusionTraits||[]),w.effect||'energy',w.modifier,aux?.effect,aux?.modifier].filter(Boolean)),rocket=traits.has('splash'),scatter=traits.has('scatter');
 const realProjectile=!traits.has('pierce')&&!/(?:LASER|BEAM|RAIL|LANCER)/i.test(w.name||'');
 const pistolMods=!eclipseActive&&(gun===0||w.pistolLineage||mixGun===0&&isAllowedWeaponMix(gun,mixGun))?player.perks:null;
 if(pistolHas(pistolMods,'pierce'))traits.add('pierce');
 if(eclipseActive)traits.add('arc');
 const extra=aux?.effect==='scatter'?Math.min(5,aux.shots):1;
 const repeats=(stacks('echo')>0&&rnd()<Math.min(.52,.08+stacks('echo')*.10)?Math.max(1,Math.floor(w.shots*.4)):0)+(stacks('barrage')&&rnd()<Math.min(.7,.13*stacks('barrage'))?Math.max(1,Math.ceil(w.shots*.5)):0);
 const baseShots=w.shots*extra+repeats+(pistolHas(pistolMods,'twin')?1:0)+
    (pistolHas(pistolMods,'burst')?2:0);
 const fanCount=pistolHas(pistolMods,'fan')?4:0;
 const count=Math.min(18,baseShots+fanCount),loud=rocket||traits.has('gravity');
 player.nextShot=time+w.rate/(player.speedMult*(player.frenzyT>0?1.25+stacks('frenzy')*.11:1)*(traits.has('overclock')?1.19:1));
 if(w.selfRisk)player.shield=Math.max(0,player.shield-w.selfRisk);
 player.recoil=Math.min(1.65,player.recoil+(w.startingSidearm?1.12:w.pistolLineage?.94:traits.has('pierce')?.55:scatter?.39:loud?.34:.19));
 player.muzzleT=w.startingSidearm?.175:traits.has('pierce')?.19:rocket?.18:.135;
 if(desktopPC)vibrateWyrdfluxPad(w.startingSidearm?.78:rocket?.38:traits.has('pierce')?.25:scatter?.17:.095,w.startingSidearm?185:rocket?110:68,'shot');
 runRecord.shots++;sound('shot');
 if(ultra)wyrdfluxSoundAsset('pistol_combo_legendary');
 else if(runRecord.shots%3===0)
  wyrdfluxSoundAsset('projectile_'+(w.modifier||w.effect||'energy'));
 shake=Math.max(shake,w.startingSidearm?.054:loud?.07:.024);
 if(w.circusGun){
  // Original paper-popper attack: bright but not more damaging than a
  // standard shotgun. Confetti has a strict particle budget.
  const colors=['pink','gold','cyan','purple','green'];
  for(let k=0;k<9;k++){
   const a=rnd()*TAU,dist=.24+rnd()*.45;
   particles.push({x:player.x+Math.sin(player.yaw)*dist,
    y:1.5+player.height+(rnd()-.5)*.18,
    z:player.z-Math.cos(player.yaw)*dist,
    vx:Math.cos(a)*(.8+rnd()*1.3),vy:.4+rnd()*1.2,
    vz:Math.sin(a)*(.8+rnd()*1.3),life:.44+rnd()*.5,
    max:1,col:colors[k%5],size:.028+rnd()*.035});
  }
  if(particles.length>240)particles.splice(0,particles.length-240);
  if(rnd()<.17)sound('upgrade');
 }
 const facing=player.yaw,spread=Math.max(w.spread,scatter?.115:.01)*(inputs.focus?.36:1);
 const legacyBeamStyle=realProjectile?null:traits.has('pierce')?'rail':
  traits.has('arc')?'arc':traits.has('energy')?'energy':null;
 for(let i=0;i<count;i++){
  const fanShot=fanCount>0&&i>=count-fanCount;
  const angle=fanShot?facing+(i-(count-fanCount)+.5-fanCount/2)*.16:
    facing+(rnd()-.5)*2*spread;
  const elevation=clamp(player.pitch+(rnd()-.5)*spread*.75,-1.20,1.20);
  const ray=shotRay3D(angle,elevation,w.range);
  const predictedEnemy=ray.enemy,predictedHit=ray.hit;
  const hit=predictedHit;
  const safeMuzzleNear=clamp(Math.min(.47,w.range*.12),.10,.47);
  const duration=traits.has('pierce')?1.32:
   rocket?Math.min(3.25,Math.max(1.18,ray.distance/15+.56)):
   scatter?.72:traits.has('freeze')?Math.max(.96,ray.distance/24+.22):.96;
  const effect=w.circusGun?'confetti':rocket?'rocket':traits.has('pierce')?'rail':traits.has('freeze')?'cryo':traits.has('ignite')?'thermal':traits.has('arc')?'arc':'energy';
  // Alternate core/infusion hues; every weapon has a recognizably different trail.
  const fluxPalette=pistolMods?[
    pistolHas(pistolMods,'ignite')?'orange':null,
    pistolHas(pistolMods,'freeze')?'cyan':null,
    pistolHas(pistolMods,'chain')?'purple':null,
    pistolHas(pistolMods,'thunder')?'gold':null,
    pistolHas(pistolMods,'execute')?'red':null].filter(Boolean):[];
  const col=w.circusGun?['pink','gold','cyan','green','purple'][i%5]:
    fluxPalette.length?fluxPalette[i%fluxPalette.length]:
    (i%2?aux?.col:null)||w.col||'cyan';
  const muzzle=wyrdfluxTracerMuzzle(player);
  if(i<4&&wyrdfluxShadowCount())wyrdfluxRecordShadowShot({
   t:time,x:player.x,z:player.z,height:player.height,angle,elevation,
   range:w.range,kind:effect,speed:rocket?15:effect==='cryo'?24:realProjectile?39:125,
   damage:Math.max(.12,(ultra?ultra.damage:w.dmg)*player.damageMult*.43/
    Math.max(1,Math.min(count,4)))
  });
  tracers.push({legendary:!!ultra||['legendary','mythic'].includes(w.rarity),ultra:!!ultra,
   pistolGlow:!eclipseActive&&gun===0,x1:muzzle.x,y1:muzzle.y,z1:muzzle.z,
   x2:hit.x,y2:hit.y,z2:hit.z,life:duration,max:duration,col,accent:aux?.col||w.col,
   kind:effect,phase:rnd()*TAU,dirY:ray.dirY,lastRenderedSegment:0});
  if(tracers.length>85)tracers.splice(0,tracers.length-85);
  if(legacyBeamStyle&&i<2){
   const start=safeMuzzleNear,dist=Math.hypot(hit.x-player.x,hit.y-(1.56+player.height),hit.z-player.z);
   if(dist>start+.28){
    const dx=Math.sin(angle)*Math.cos(elevation),dy=Math.sin(elevation),
     dz=-Math.cos(angle)*Math.cos(elevation);
    const linger=legacyBeamStyle==='rail'?.60:legacyBeamStyle==='arc'?.35:.27;
    lingeringBeams.push({x1:muzzle.x+dx*start,
     y1:muzzle.y+dy*start,z1:muzzle.z+dz*start,
     x2:hit.x,y2:hit.y,z2:hit.z,
     life:linger,max:linger,style:legacyBeamStyle,phase:rnd()*TAU,
     col:aux?.col||w.col,collisionBound:true});
   }
   if(lingeringBeams.length>22)lingeringBeams.splice(0,lingeringBeams.length-22);
  }

  const resolveShot=(enemy,hit,ray)=>{
  if(!enemy){
   if(i===0)pistolNearMiss(pistolMods,ultra?.damage||w.dmg);
   if(i===0&&ray.blocked)recordWallImpact(hit,angle,elevation);
   if(ray.blocked&&(i===0||rocket))queueWyrdfluxContactFX(hit,effect,col,
    realProjectile?0:Math.hypot(hit.x-muzzle.x,hit.y-muzzle.y,hit.z-muzzle.z));
   if(i===0&&hit.y<2.9&&hit.x>1&&hit.x<N-1&&hit.z>1&&hit.z<N-1){
    spark(hit.x,hit.z,w.col,rocket?9:4);
   }
   if(rocket&&ray.blocked){
    const radius=(1.1+(aux?.effect==='splash'?.20:0))*(scatter?.52:1);
    for(const other of [...enemies]){
     const dist=Math.hypot(other.x-hit.x,other.z-hit.z);
     if(other.hp>0&&dist<radius&&lineClear(hit.x,hit.z,other.x,other.z))
      damageEnemy(other,w.dmg*.42*(1-dist/(radius*1.6)),'splash',1);
    }
   }
   return;
  }
  if(i===0||rocket)queueWyrdfluxContactFX(hit,effect,col,
   realProjectile?0:Math.hypot(hit.x-muzzle.x,hit.y-muzzle.y,hit.z-muzzle.z));
  const crit=stacks('crit')>0&&rnd()<Math.min(.65,.07+stacks('crit')*.095);
  const shotgunScale=count>1?Math.max(.32,1/Math.sqrt(count/Math.max(1,w.shots))):1;
  let damage=(ultra?ultra.damage:w.dmg*(['legendary','mythic'].includes(w.rarity)?1.48:1))*(1+Math.min(.60,Math.max(0,w.rate-.52)*.48))*shotgunScale*player.damageMult*(crit?1.85:1);
  if(stacks('rush')&&Math.hypot(player.vx,player.vz)>1.1)damage*=1+stacks('rush')*.15;
  if(stacks('hunter')&&(enemy.boss||enemy.type==='warden'))damage*=1+stacks('hunter')*.13;
  if(stacks('execution')&&enemy.hp/enemy.maxHp<.25)damage*=1+stacks('execution')*.17;
  if(stacks('bossbreaker')&&enemy.boss)damage*=1+stacks('bossbreaker')*.19;
  if(stacks('bloodprice'))damage*=1+(1-player.hp/player.maxHp)*stacks('bloodprice')*.25;
  if(enemy.vulnUntil>time)damage*=1+Math.min(.5,(enemy.vulnStack||1)*.06);
  const weak=ray.hitPart==='weakhead'||ray.hitPart==='weakcore';
  if(weak){
   const bossWeak=isBoss(enemy),postShot=!!wyrdfluxWeakspotSpec(enemy)?.postShot;
   damage*=ray.hitPart==='weakhead'?1.75:bossWeak?1.65:1.55;
   wyrdfluxWeakspotHits++;
   if(bossWeak)wyrdfluxBossWeakspotHits++;
   if(postShot)wyrdfluxRangedRecoveryWeakspots++;
   if(i===0)combatText(enemy.x,enemy.z,bossWeak?'BOSS CORE':'WEAK SPOT','gold');
  }
  const oldX=enemy.x,oldZ=enemy.z;
  damageEnemy(enemy,damage,'weapon',0,ray.hitPart);
  if(ultra&&i===0)applyFluxsideUltraImpact(ultra,enemy,damage);
  else if(i===0)applyWyrdfluxSuperImpact(w,enemy,damage);
  if(i===0)pistolImpact(pistolMods,enemy,damage,runRecord.shots);
  for(const effectName of traits)if(enemy.hp>0)appliedWeaponTrait(enemy,effectName);
   if(traits.has('shield'))player.shield=Math.min(player.maxShield,player.shield+.52);
   if(traits.has('vamp'))player.hp=Math.min(player.maxHp,player.hp+.44);
   if(traits.has('recoil'))player.dashCool=Math.max(0,player.dashCool-.025);
  if(stacks('kindle'))appliedWeaponTrait(enemy,'ignite');
  if(stacks('cryoshot'))appliedWeaponTrait(enemy,'freeze');
  if(stacks('rupture'))appliedWeaponTrait(enemy,'shred');
  if(stacks('healshot'))player.shield=Math.min(player.maxShield,player.shield+.4*stacks('healshot'));
  if(crit&&stacks('deathmark')&&enemy.hp>0){enemy.vulnUntil=Math.max(enemy.vulnUntil||0,time+3);enemy.vulnStack=Math.min(5,(enemy.vulnStack||0)+stacks('deathmark'));}
  if(stacks('heattrace')&&player.heat>.58&&enemy.hp>0){appliedWeaponTrait(enemy,'ignite');
   if(stacks('heattrace')>1)for(const t of enemies)if(t!==enemy&&Math.hypot(t.x-enemy.x,t.z-enemy.z)<1.25)appliedWeaponTrait(t,'ignite');
  }
  if(stacks('doomreactor')&&enemy.hp>0&&enemy.burnUntil>time&&enemy.slowUntil>time&&(enemy.doomTick||0)<time){
   enemy.doomTick=time+1.8;
   blastAt(enemy.x,enemy.z,20+stacks('doomreactor')*13,1.45,1,'doom');
  }
  if(stacks('warlock')){
   player.hitCounter=(player.hitCounter||0)+1;
   if(player.hitCounter%8===0)blastAt(oldX,oldZ,18+stacks('warlock')*13,1.6,0,'shock');
  }
  if(crit){combatText(oldX,oldZ,'CRITICAL','gold');spark(oldX,oldZ,'gold',8)}
  if(rocket){
   const radius=(1.1+(aux?.effect==='splash'?.20:0))*(scatter?.52:1);
   // Visual contact is emitted at the collision point after the bolt arrives.
   for(const other of [...enemies]){
    if(other===enemy||other.hp<=0)continue;
    const dist=Math.hypot(other.x-hit.x,other.z-hit.z);
    if(dist<radius&&lineClear(hit.x,hit.z,other.x,other.z))damageEnemy(other,damage*.42*(1-dist/(radius*1.6)),'splash',1);
   }
  }
  if(traits.has('pierce')){
   const behind=enemies.filter(e=>e!==enemy&&e.hp>0&&Math.hypot(e.x-player.x,e.z-player.z)<w.range&&lineClear(player.x,player.z,e.x,e.z)
     &&Math.abs(Math.atan2(Math.sin(Math.atan2(e.x-player.x,-(e.z-player.z))-angle),Math.cos(Math.atan2(e.x-player.x,-(e.z-player.z))-angle)))<.07
     &&Math.abs((1.64+player.height+Math.tan(elevation)*Math.hypot(e.x-player.x,e.z-player.z))-(isBoss(e)?2.7:e.type==='drone'?1.75:1.28))<(isBoss(e)?2.4:1.15));
   for(const e of behind.slice(0,2))damageEnemy(e,damage*.5,'pierce');
  }
  };
  if(realProjectile){
   const speed=rocket?15:effect==='cryo'?24:w.circusGun?22:w.startingSidearm?34:39;
   const dirX=Math.sin(angle)*Math.cos(elevation),dirY=Math.sin(elevation),
    dirZ=-Math.cos(angle)*Math.cos(elevation);
   const t=tracers[tracers.length-1];
   if(t){t.x2=muzzle.x;t.y2=muzzle.y;t.z2=muzzle.z;}
   wyrdfluxPlayerShots.push({x:muzzle.x,y:muzzle.y,z:muzzle.z,
    dx:dirX,dy:dirY,dz:dirZ,speed,remaining:w.range,travelled:0,
    tracer:t,resolve:resolveShot,kind:effect});
   if(wyrdfluxPlayerShots.length>180)wyrdfluxPlayerShots.splice(0,wyrdfluxPlayerShots.length-180);
  }else resolveShot(predictedEnemy,predictedHit,ray);
 }
 updateHUD();
}
let wyrdfluxDamagePulse=0;
function ensureWyrdfluxDamageVignette(){
 let v=document.getElementById('wyrdfluxDamageVignette');
 if(!v){v=document.createElement('div');v.id='wyrdfluxDamageVignette';
  v.setAttribute('aria-hidden','true');document.body.appendChild(v);}
 return v;
}
function updateWyrdfluxDamageVignette(dt){
 if(!desktopPC)return;
 wyrdfluxDamagePulse=Math.max(0,wyrdfluxDamagePulse-dt*2.5);
 ensureWyrdfluxDamageVignette().style.opacity=
  phase==='play'?String(Math.min(.93,wyrdfluxDamagePulse)):'0';
}
let circusHitDistortion=0;
function playCircusHitDistortion(){
 if(circus.state!=='active')return;
 circusHitDistortion=1.7;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 document.body.classList.remove('wyrdflux-circus-hit');
 void world.offsetWidth;
 document.body.classList.add('wyrdflux-circus-hit');
}
function clearCircusHitDistortion(){
 circusHitDistortion=0;
 document.body.classList.remove('wyrdflux-circus-hit');
}
function hitPlayer(damage){if(phase!=='play')return;if(player.dashT>.12)return;
 if(circus.state==='active')playCircusHitDistortion();
 if(desktopPC){
  const severity=clamp(damage/Math.max(10,player.maxHp*.24),0,1);
  wyrdfluxDamagePulse=Math.max(wyrdfluxDamagePulse,.40+severity*.55);
  vibrateWyrdfluxPad(.30+severity*.61,Math.round(105+severity*185),'hurt');
 }
 runRecord.damageEvents++;const hpShieldBefore=player.hp+player.shield;let left=damage*cycleDifficulty(wave).damage*(1-permanentStats().defense);if(stacks('laststand')&&player.hp/player.maxHp<.30)left*=Math.max(.49,1-.16*stacks('laststand'));if(player.shield>0){let used=Math.min(player.shield,left);player.shield-=used;left-=used}player.hp=Math.max(0,player.hp-left);waveDamageTaken+=Math.max(0,hpShieldBefore-player.hp-player.shield);if(player.hp<=0&&stacks('phoenix')>0&&!player.phoenixUsed){player.phoenixUsed=true;player.hp=player.maxHp*.46;player.shield=stacks('aegisblock')?player.maxShield:player.maxShield*.75;player.rage=100;blastAt(player.x,player.z,190,3.7,0,'shock');announce('PHOENIX PROTOCOL REIGNITED',2.6)}player.lastHit=time;shake=.08;damageUntil=time+.21;updateHUD();if(player.hp<=0)gameOver()}
function gameOver(){clearCircusHitDistortion();if(testLabMode){trialFinish(false);return;}creditMeta('death');phase='dead';lingeringBeams=[];overlayPlay(false);clearCheckpoint();savePrefs();$('endKicker').textContent='SIGNAL LOST // UNIT DOWN';$('endHeading').textContent='SECTOR FALLEN.';$('endStats').textContent=`WAVE ${wave} · ${kills} ELIMINATIONS · ${totalScore} SCORE · CAREER XP ${meta.xp}`;
 const e=$('runUnlockSummary');if(e)e.textContent=runRecord.lastUnlocks.length?
   'NEW BLUEPRINTS: '+runRecord.lastUnlocks.slice(-5).join(' · '):
   'EVERY ATTEMPT COUNTS. CAREER PROGRESS SAVED.';
 showScreen('endScreen')}

function showAfterlightWaveReport(){
 if(testLabMode)return;
 let panel=document.getElementById('afterlightWaveReport');
 if(!panel){
  panel=document.createElement('section');panel.id='afterlightWaveReport';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.style.cssText='position:fixed;inset:0;z-index:690;display:grid;place-items:center;padding:18px;background:radial-gradient(ellipse at 50% 22%,#152e46f2 0%,#040814fa 75%);color:#eefcff;font-family:system-ui,sans-serif;overflow:auto';
  panel.innerHTML='<div style="width:min(520px,95vw);border:1px solid #99c9de75;border-radius:24px;background:linear-gradient(145deg,#192d43,#111a32 62%,#291d40);box-shadow:0 20px 65px #000b,0 0 45px #d8c5ff21;padding:clamp(20px,5vw,35px);text-align:center"><div style="font-size:35px">✦ ✧ ✦</div><p style="letter-spacing:.24em;color:#d1bdf4;margin:8px 0">WYRDFLUX · RUN REPORT</p><h2 id="afReportTitle" style="font-size:clamp(27px,7vw,40px);margin:4px 0 14px;color:#fff">WAVE SECURED</h2><div id="afReportStats" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0"></div><p style="color:#c9ddf1;margin-bottom:20px">A new choice awaits. Your equipment and abilities carry forward.</p><button id="afReportContinue" style="width:100%;min-height:51px;border:1px solid #efd7a5;border-radius:13px;background:linear-gradient(90deg,#c797f0,#93e6ef);color:#12162c;font-weight:900;font-size:16px;letter-spacing:.06em">CONTINUE TO UPGRADES ✨</button></div>';
  document.body.appendChild(panel);
  panel.querySelector('#afReportContinue').addEventListener('click',()=>{panel.style.display='none';document.getElementById('upgradeScreen')?.querySelector('button')?.focus?.();});
 }
 const number=x=>Math.max(0,Math.round(x)).toLocaleString('en-US');
 const values=[['HOSTILES DEFEATED',number(kills-waveKillsStart)],['LEVELS BANKED',number(runLevel.waveEarned)],['TIME SURVIVED',number(time-waveStartedAt)+'s'],['TOTAL SCORE',number(totalScore)]];
 panel.querySelector('#afReportTitle').textContent='WAVE '+String(localWaveOf(wave)).padStart(2,'0')+' SECURED';
 panel.querySelector('#afReportStats').replaceChildren(...values.map(([label,value])=>{
  const tile=document.createElement('div');tile.style.cssText='border:1px solid #b8d9ef35;border-radius:13px;background:#e5edff0d;padding:14px 9px';
  const n=document.createElement('strong');n.textContent=value;n.style.cssText='display:block;font-size:clamp(23px,5vw,31px);color:#f5deaf';
  const t=document.createElement('small');t.textContent=label;t.style.cssText='display:block;font-size:10px;letter-spacing:.1em;color:#a8c3db;margin-top:5px';
  tile.append(n,t);return tile;
 }));
 panel.style.display='grid';
}


/* PC-first run leveling: every kill feeds XP, streaks get 4.6 second chains.
 * A strong run may accumulate multiple reward drafts before the wave ends. */
const defaultRunLevel=()=>({rank:1,xp:0,pending:0,waveEarned:0,roundDraftsClaimed:0,combo:0,comboUntil:0,
 bestCombo:0,totalXP:0,drafts:0});
let runLevel=defaultRunLevel(),upgradeDraftKind='wave';
let bossShopDue=0,bossShopOpen=false,bossShopVisited=0;
let wyrdfluxSecrets={thirteen:false,emberstep:false};

// The Unlisted Show is not discoverable from a normal wave portal. A strange
// toy has a low chance to appear in Witch, Greenhouse or Library, once/run.
// A three-light puzzle opens only after the player touches it and returns.
const CIRCUS_TOY_CHANCE=.08; // Only when entering an already-rare secret scene.
const CIRCUS_BONUS_CHANCE=.008; // 0.8% special encore on successful clear.
const CIRCUS_COLOR_ORDER=Object.freeze(['blue','gold','red']);
const CIRCUS_PERFORMER_NAMES=Object.freeze([
 'THE PORCELAIN STAR','THE RIBBON ORACLE','THE TICKET TAKER','THE GRAND IMPOSTOR']);
function freshCircus(){return {state:'none',seen:false,toy:null,toyRealm:null,
 points:[],step:0,portal:null,defeated:0,bonus:null,
 returnState:null,visits:0,claimed:false,lastWave:0,encore:'first',encoreKills:0};}
let circus=freshCircus();
function chooseCircusToy(realmId){
 const spots=realmId==='witch'?
 [[C+1.25,17.3],[C-1.4,17.3],[C,18.1]]:
 [[C+1.8,20.5],[C-1.7,20.5],[C,22.2],[C+1.3,18]];
 const found=spots.find(([x,z])=>free(x,z,.33));
 return found?{x:found[0],z:found[1]}:null;
}
function offerCircusToy(realmId){
 if(circus.seen||circus.state!=='none'||testLabMode||rnd()>=CIRCUS_TOY_CHANCE)return false;
 const toy=chooseCircusToy(realmId);
 if(!toy)return false;circus.toy=toy;circus.toyRealm=realmId;
 circus.state='toy';circus.seen=true;
 notice('A CLOCKWORK TOY WHISPERS FROM THE SHADOWS',3.5);return true;
}
function circusLightSites(){
 const anchors=[[C-7,C+2],[C+7,C+1],[C,C-7]],result=[];
 for(const [ax,az] of anchors){
  let spot=null;
  for(let d=0;d<=5&&!spot;d++)for(const [x,z] of
   [[ax+d,az],[ax-d,az],[ax,az+d],[ax,az-d]]){
    if(x>1&&z>1&&x<N-2&&z<N-2&&free(x,z,.32)&&
     result.every(p=>Math.hypot(p.x-x,p.z-z)>5)){spot={x,z};break;}
  }
  result.push(spot||randomOpen(5));
 }
 return result.map((p,i)=>({...p,id:i,color:CIRCUS_COLOR_ORDER[i]}));
}
function touchCircusToy(){
 if(!livingRealm.active||circus.state!=='toy'||livingRealm.id!==circus.toyRealm)return false;
 circus.state='armed';circus.toy=null;
 notice('A TINY VOICE SINGS: COLD MOON, GOLD CROWN, RED CURTAIN',5);
 announce('IT SAYS THE SHOW BEGINS OUTSIDE',3.4);sound('upgrade');
 return true;
}
function beginCircusPuzzle(){
 if(circus.state!=='armed')return false;
 circus.state='puzzle';circus.step=0;
 circus.points=circusLightSites();circus.portal=null;
 circus.lastWave=wave;announce('THREE LIGHTS WAIT IN THE ARENA',4);
 notice('REMEMBER THE TOY: MOON · CROWN · CURTAIN',4.5);
 saveCheckpoint();return true;
}
function touchCircusLight(id){
 if(circus.state!=='puzzle'||!Number.isInteger(id)||!circus.points[id])return false;
 if(id!==circus.step){
  circus.step=0;notice('WRONG BEAT · THE LIGHTS RESET',2.6);
  sound('hit');return false;
 }
 const point=circus.points[id];circus.step++;
 burst(point.x,point.z,point.color,1.4,.56);sound('upgrade');
 if(circus.step===3){
  circus.state='gate';circus.portal={x:C,z:C+8};
  if(!free(circus.portal.x,circus.portal.z,.35))circus.portal=randomOpen(5);
  announce('THE UNLISTED DOOR IS OPEN',4);
  notice('HOLD E / X AT THE PURPLE CURTAIN',4);
 }else notice(circus.step+'/3 LIGHTS · THE TOY IS WATCHING',2.7);
 saveCheckpoint();return true;
}
function circusStageMap(){
 map.length=0;
 for(let z=0;z<N;z++){
  const row=[];
  for(let x=0;x<N;x++)row.push(x===0||z===0||x===N-1||z===N-1?1:0);
  map.push(row);
 }
}
const CIRCUS_DANCE_SECONDS=5.5,CIRCUS_PAUSE_SECONDS=.65,CIRCUS_TURN_SECONDS=1.45;
const CIRCUS_RING_SHOW_MARK=Object.freeze({x:C,z:C+5.55,radius:1.80});
function playerReachedCircusRing(){
 return Math.hypot(player.x-CIRCUS_RING_SHOW_MARK.x,
   player.z-CIRCUS_RING_SHOW_MARK.z)<=CIRCUS_RING_SHOW_MARK.radius;
}
function circusScreech(anger=false){
 // Fully original descending theatrical dissonance, kept inside the game's
 // WebAudio compressor to protect ears. The violent *motion* sells the scare;
 // audio level is bounded rather than physically dangerous.
 if(!muted&&ensureAudio()&&ctxAudio.state==='running'){
  const t=ctxAudio.currentTime+.006;
  audioTone(anger?1380:1100,t,.63,anger?.12:.095,'sawtooth',fxBus,184);
  audioTone(anger?1920:1530,t+.025,.38,.065,'square',fxBus,320);
  audioTone(135,t+.04,.89,.075,'triangle',fxBus,42);
  audioNoise(t+.018,.23,anger?.13:.10,3500,'bandpass',fxBus);
  scoreDuckingUntil=t+.73;
 }
 shake=Math.max(shake,anger?.38:.22);
 if(desktopPC)vibrateWyrdfluxPad(anger?.92:.68,anger?285:190,'hurt');
}
function beginCircusReveal(interrupted=false){
 if(circus.state!=='active'||!['dance','silence','reveal'].includes(circus.performance))return false;
 circus.performance='reveal';circus.introT=0;
 circusScreech(interrupted);
 wyrdfluxSoundAsset('circus_crew_turn');
 if(interrupted)announce('THE SMILES TEAR OPEN · ENRAGED',3);
 else announce('THE MUSIC DIES · THEY TURN',2.8);
 return true;
}
function circusMakeActor(i){
 // Stage on the NORTH side. Player enters from the SOUTH aisle and has
 // several seconds to watch the backs of their costumes before the reveal.
 const locations=[[C-3.4,C-4.7],[C+3.4,C-4.7],[C-1.8,C-7.5],[C+1.8,C-6.5]];
 const p=locations[i],e=newEnemy({x:p[0],z:p[1]},false);
 delete e.saucer;delete e.travelerShield;delete e.travelerShieldMax;
 const boss=i===3;
 e.type=boss?'circus_ringmaster':'circus_performer';e.circusActor=true;
 e.circusKind=i;e.boss=boss;e.appearT=0;
 e.hp=e.maxHp=(boss?2300:160+i*50)*cycleDifficulty(wave).hp;
 e.speed=Math.min(boss?2.70:3.10,(boss?2.05:2.45)*cycleDifficulty(wave).speed);
 e.circusMorph=0;e.circusClock=i*.38;e.attackT=99;e.bob=i*.93;
 e.circusTurn=0;e.circusEnraged=false;e.circusDamageBoost=1;
 e.ultimateStage='idle';return e;
}
function enrageCircus(trigger){
 if(circus.state!=='active'||!['dance','silence','reveal'].includes(circus.performance))return false;
 circus.enraged=true;circus.performance='reveal';circus.introT=0;
 for(const e of enemies){
  if(!e.circusActor||e.hp<=0)continue;
  e.circusEnraged=true;e.circusDamageBoost=1.75;
  e.speed=Math.min(e.boss?2.85:3.30,e.speed*1.30);
  e.attackT=.3;e.circusClock=0;
 }
 announce('THE MUSIC STOPS · THE CAST HAS SEEN YOU',3.2);
 notice('YOU BROKE THE PERFORMANCE · RED EYES · +75% ENEMY DAMAGE · NO EXTRA REWARD',4.3);
 burst(trigger?.x||C,trigger?.z||C,'red',2.6,.5);
 circusScreech(true);
 return true;
}
function enterCircus(){
 if(circus.state!=='gate'||livingRealm.active||(testLabMode&&testLabMode!=='circus'))return false;
 saveCheckpoint();
 circus.returnState={map:map.map(row=>row.slice()),enemies,
  projectiles,particles,tracers,lingeringBeams,wyrdfluxContactFX,pickups,
  spawnPending,spawnClock,position:{x:player.x,z:player.z,
   yaw:player.yaw,pitch:player.pitch,height:player.height,
   verticalVel:player.verticalVel,vx:player.vx,vz:player.vz}};
 circus.state='active';circus.visits++;circus.defeated=0;
 circus.claimed=false;circus.performance='waiting';circus.introT=0;
 circus.enraged=false;circus.encore='first';circus.encoreKills=0;
 enemies=[];projectiles=[];particles=[];tracers=[];lingeringBeams=[];
 wyrdfluxContactFX=[];pickups=[];spawnPending=0;spawnClock=999;
 circusStageMap();buildStatic();
 for(let i=0;i<4;i++)enemies.push(circusMakeActor(i));
 if(desktopPC){
  const rig=window.WYRDFLUX_CIRCUS_PUPPETS;
  if(rig?.state.status==='idle')rig.load(gl);
  if(rig?.state.status==='failed')notice('RIGGED CIRCUS MODELS UNAVAILABLE · FALLBACK ENABLED',3.5);
 }
 player.x=C;player.z=C+10;player.yaw=0;player.pitch=0;
 player.vx=0;player.vz=0;player.height=0;player.verticalVel=0;
 inputs.shoot=false;inputs.fire=null;
 document.body.classList.add('wyrdflux-circus');
 afterlightSceneTransition('THE UNLISTED SHOW');
 announce('THE AUDIENCE IS MADE OF EMPTY SEATS',4);
 notice('WALK DOWN THE AISLE · THE SHOW STARTS AT THE GOLD RING',5);
 updateHUD(true);return true;
}
function leaveCircus(){
 if(circus.state!=='active')return false;
 clearCircusHitDistortion();
 const prior=circus.returnState;
 if(prior){
  map.length=0;for(const row of prior.map)map.push(row.slice());
  enemies=prior.enemies;projectiles=prior.projectiles;particles=prior.particles;
  tracers=prior.tracers;lingeringBeams=prior.lingeringBeams;
  wyrdfluxContactFX=prior.wyrdfluxContactFX;pickups=prior.pickups;
  spawnPending=prior.spawnPending;spawnClock=prior.spawnClock;
  Object.assign(player,prior.position);
 }
 circus.returnState=null;circus.state='done';circus.performance='done';circus.points=[];circus.portal=null;
 document.body.classList.remove('wyrdflux-circus');
 inputs.shoot=false;inputs.fire=null;inputs.interact=false;
 buildStatic();interactProgress=0;
 afterlightSceneTransition('CURTAIN CLOSED · BACK TO WYRDFLUX');
 notice('THE UNLISTED SHOW WILL NOT RETURN THIS RUN',3);
 if(testLabMode==='circus'){
  // The test returns to the result screen, not an empty campaign wave.
  // Career saves were never touched.
  trialFinish(true);return true;
 }
 saveCheckpoint();updateHUD(true);return true;
}
function beginCircusEncore(boss){
 if(circus.state!=='active'||circus.encore!=='first'||!boss?.boss||boss.hp<=0)return false;
 circus.encore='ascension';circus.encoreKills=0;circus.defeated=0;
 boss.hp=Math.max(1,boss.maxHp*.08);boss.circusEncore=true;boss.circusFloat=0;boss.circusSpin=0;boss.attackT=99;
 boss.circusEnraged=true;boss.circusMorph=1;
 enemies=enemies.filter(e=>!e.circusActor||e.boss);
 for(let i=0;i<3;i++){
  const actor=circusMakeActor(i);actor.circusEncore=true;actor.circusMorph=1;
  actor.circusTurn=1;actor.circusEnraged=true;actor.attackT=.8+i*.22;
  actor.maxHp*=1.35;actor.hp=actor.maxHp;enemies.push(actor);
 }
 circus.performance='attack';circusScreech(true);sound('ringleader_ascend');sound('ringleader_revive');
 announce('THE GRAND IMPOSTOR · ONE FINAL ENCORE',4);
 notice('RINGLEADER INVULNERABLE · DEFEAT THE REVIVED CAST',5);
 burst(boss.x,boss.z,'purple',3.5,.72);
 return true;
}
function finishCircusEncore(){
 if(circus.state!=='active'||circus.encore!=='ascension'||circus.encoreKills<3)return false;
 const boss=enemies.find(e=>e.circusActor&&e.boss&&e.hp>0);
 if(!boss)return false;
 circus.encore='finale';boss.circusEncore=false;boss.hp=Math.max(1,boss.maxHp*.52);
 boss.attackT=1.5;boss.speed=Math.min(3.3,boss.speed*1.15);
 boss.circusDamageBoost=1.3;circus.defeated=3;sound('ringleader_finale');
 announce('THE RINGLEADER DESCENDS · FINAL ACT',4);
 notice('SHIELD BROKEN · FINISH THE GRAND IMPOSTOR',4);
 burst(boss.x,boss.z,'gold',3.5,.7);return true;
}
function circusActorDeath(e){
 if(circus.state!=='active'||!e.circusActor)return;
 burst(e.x,e.z,e.circusEncore?'purple':'pink',2,.6);
 wyrdfluxSoundAsset(['circus_acrobat_landing','circus_mime_porcelain_crack',
  'circus_crew_collapse','circus_ringleader_brass'][e.circusKind]||'circus_crew_collapse');
 if(circus.encore==='ascension'){
  if(e.boss||!e.circusEncore)return;
  circus.encoreKills=Math.min(3,circus.encoreKills+1);
  announce('REVIVED PERFORMERS LEFT · '+(3-circus.encoreKills),2.4);
  if(circus.encoreKills===3)finishCircusEncore();
  return;
 }
 circus.defeated=Math.min(4,circus.defeated+1);
 announce(CIRCUS_PERFORMER_NAMES[e.circusKind]+' TAKES A BOW',2.4);
 if(circus.defeated===4&&circus.encore==='finale'){
  announce('THE CURTAIN FALLS · THE PRIZE IS YOURS',3.2);
  notice('CLAIM YOUR PRIZE AT CENTER STAGE · HOLD E / X',4);
 }
}
function claimCircusPrize(){
 if(circus.state!=='active'||circus.encore!=='finale'||circus.defeated!==4||circus.claimed)return false;
 circus.claimed=true;activeGun[CIRCUS_GUN_INDEX]=true;
 gun=CIRCUS_GUN_INDEX;mixGun=-1;
 player.cash+=Math.round(600*cycleOf(wave));
 player.maxShield+=18;player.shield=Math.min(player.maxShield,player.shield+18);
 // 0.8% chance of ONE cosmetic/utility encore, never stacked.
 if(rnd()<CIRCUS_BONUS_CHANCE){
  const effects=['PARTY LEGS','TICKET ARMOR','THE LAST LAUGH'];
  const choice=effects[Math.floor(rnd()*effects.length)];
  circus.bonus=choice;
  if(choice==='PARTY LEGS')player.moveMult*=1.08;
  else if(choice==='TICKET ARMOR'){
   player.maxShield+=25;player.shield=Math.min(player.maxShield,player.shield+25);
  }else player.damageMult*=1.04;
  notice('ULTRA-RARE ENCORE · '+choice,5);
 }
 rememberWyrdfluxRunItem('HIDDEN ENCOUNTER',"JESTER'S POPPER",
  'Unique confetti scattergun · +18 shield · +salvage');
 hudWeapon();sound('upgrade');burst(C,C,'gold',3.4,.7);
 announce("JESTER'S POPPER · THE SHOW GOES ON",4);
 return true;
}
// Suspended stage halo and three slow rings; bounded segments and no collision.
function drawCircusEncoreFX(m,q){
 if(circus.state!=='active'||circus.encore!=='ascension')return;
 const boss=enemies.find(e=>e.circusActor&&e.boss&&e.hp>0);
 if(!boss)return;
 const x=boss.x,z=boss.z,y=1.2+(boss.circusFloat||0),n=q==='battery'?10:q==='high'?24:15;
 for(let layer=0;layer<3;layer++)for(let k=0;k<n;k++){
  const a=TAU*k/n+time*(layer%2?-.56:.66),b=a+TAU/n;
  const r=1.15+layer*.37,h=y+layer*.66;
  m.beam(x+Math.cos(a)*r,h,z+Math.sin(a)*r,
   x+Math.cos(b)*r,h,z+Math.sin(b)*r,.031,layer===1?'purple':'gold',.42);
 }
 for(const side of [-1,1])m.beam(x+side*.25,y-.5,z,x+side*.8,.04,z,.04,'purple',.28);
}
function tickCircus(dt){
 if(circus.state!=='active')return;
 // Dance is peaceful and choreographed. Reveal turns the cast through 180°
 // while their masks split. Early player hits shorten the turn, but do NOT
 // boost chest drops or Jester's Popper reward.
 if(circus.performance==='waiting'){
  if(playerReachedCircusRing()){
   circus.performance='dance';circus.introT=0;
   for(const e of enemies)if(e.circusActor)e.circusClock=0;
   announce('THE UNLISTED SHOW · THE CAST BEGINS TO DANCE',2.8);
   notice('WATCH THE DANCE · SHOOT EARLY AND THEY TURN ENRAGED',4.0);
  }
 }else if(circus.performance==='dance'){
  circus.introT+=dt;
  if(circus.introT>=CIRCUS_DANCE_SECONDS){
   circus.performance='silence';circus.introT=0;
   notice('THE MELODY STOPS · SOMETHING IS WRONG',1.8);
  }
 }else if(circus.performance==='silence'){
  circus.introT+=dt;
  if(circus.introT>=CIRCUS_PAUSE_SECONDS)beginCircusReveal(false);
 }else if(circus.performance==='reveal'){
  circus.introT+=dt;
  const turnDuration=circus.enraged?.37:CIRCUS_TURN_SECONDS;
  const t=clamp(circus.introT/turnDuration,0,1);
  for(const e of enemies){
   if(!e.circusActor||e.hp<=0)continue;
   e.circusTurn=t*t*(3-2*t);
   e.circusMorph=t*t;
  }
  if(t>=1){
   circus.performance='attack';
   for(const e of enemies)if(e.circusActor&&e.hp>0)e.attackT=.55;
   notice(circus.enraged?'THE CAST IS ENRAGED · SURVIVE THE SHOW':
     'THE SMILES HAVE FALLEN · SURVIVE THE SHOW',3);
  }
 }
 for(const e of [...enemies]){
  if(!e.circusActor||e.hp<=0)continue;
  // Rise above the ring with a slow Y-axis rotation; no combat until 3 kills.
  if(e.boss&&circus.encore==='ascension'){
   e.circusFloat=Math.min(2.55,(e.circusFloat||0)+dt*1.15);
   e.circusSpin=(e.circusSpin||0)+dt*.46;
   e.circusClock+=dt*.4;e.hit=Math.max(0,e.hit-dt);
   e.attackT=99;continue;
  }
  if(e.boss&&circus.encore==='finale')
   e.circusFloat=Math.max(0,(e.circusFloat||0)-dt*1.8);
  const dx=player.x-e.x,dz=player.z-e.z;
  const dist=Math.max(.05,Math.hypot(dx,dz));
  e.circusClock+=dt;
  // 3D costume bobs, side steps, and mirrored arm sweeps are not attacks.
  const dancing=circus.performance==='dance';
  e.bob+=dt*(dancing?2.75:circus.performance==='reveal'?2.2:e.circusEnraged?9.2:6.2);
  if(dancing||['waiting','silence','reveal'].includes(circus.performance)){
   e.circusTurn=circus.performance==='reveal'?e.circusTurn:0;
   e.hit=Math.max(0,e.hit-dt);
   continue; // No movement, collisions, contact damage or ranged aggression.
  }
  // After the reveal, let the original distance-based grotesque morph intensify.
  const wanted=dist<7?1:.90;
  e.circusMorph+=(wanted-e.circusMorph)*Math.min(1,dt*2.8);
  e.hit=Math.max(0,e.hit-dt);e.attackT-=dt;
  if(dist>1.15)collisionMove(e,dx/dist*e.speed*dt,dz/dist*e.speed*dt,.38);
  if(dist<1.7&&e.attackT<=0){
   e.attackT=(e.boss?1.1:1.7)*(e.circusEnraged?.69:1);
   hitPlayer((e.boss?13:7.5+e.circusKind*2)*(e.circusDamageBoost||1));
   spark(e.x,e.z,e.circusEnraged?'red':'pink',6);
  }
 }
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
 for(const p of tracers)p.life-=dt;
 tracers=tracers.filter(p=>p.life>0);
 for(const p of wyrdfluxContactFX){p.delay-=dt;if(p.delay<=0)p.life-=dt;}
 wyrdfluxContactFX=wyrdfluxContactFX.filter(p=>p.life>0);
 for(const b of lingeringBeams)b.life-=dt;
 lingeringBeams=lingeringBeams.filter(b=>b.life>0);
 for(const b of burstRings)b.life-=dt;
 burstRings=burstRings.filter(b=>b.life>0);
 if(circus.claimed&&Math.hypot(player.x-C,player.z-(C+10))<1.9)
  notice('HOLD E / X TO RETURN TO YOUR RUN',1);
}

// Opening level takes about five consecutive basic enemy kills; thereafter
// thresholds rise indefinitely without a hard character-level limit.
const runLevelThreshold=rank=>Math.round(148+43*Math.max(0,rank-1)+28*Math.pow(Math.max(0,rank-1),1.20));
function showWyrdfluxLevelBank(final=false){
 if(!desktopPC)return;
 let el=document.getElementById('wyrdfluxRoundLevelBurst');
 if(!el){el=document.createElement('aside');el.id='wyrdfluxRoundLevelBurst';
  el.setAttribute('aria-live','off');el.setAttribute('aria-hidden','true');
  document.body.appendChild(el);}
 const earned=Math.max(0,runLevel.waveEarned||0);
 el.textContent=final?'ROUND COMPLETE · '+earned+' LEVEL'+(earned===1?'':'S')+' EARNED':
  '+'+earned+' LEVEL'+(earned===1?'':'S')+' BANKED';
 el.dataset.final=String(final);
 el.classList.remove('wyrdfluxLevelBankBurst');
 void el.offsetWidth;
 el.classList.add('wyrdfluxLevelBankBurst');
}

function refreshRunLevelHud(){
 if(!desktopPC)return;
 let root=document.getElementById('wyrdfluxRunLevel');
 if(!root){root=document.createElement('aside');root.id='wyrdfluxRunLevel';
  root.setAttribute('aria-live','off');document.body.appendChild(root);}
 const multiplier=Math.min(4,1+Math.floor(Math.max(0,runLevel.combo-1)/3)*.25);
 const remaining=Math.max(1,runLevelThreshold(runLevel.rank));
 root.style.display=phase==='play'?'block':'none';
 root.textContent='LVL '+runLevel.rank+' · XP '+runLevel.xp+'/'+remaining+' · BANKED '+runLevel.pending+
  (time<runLevel.comboUntil&&runLevel.combo>1?' · '+runLevel.combo+' KILL COMBO ×'+multiplier.toFixed(2):'');
 root.style.setProperty('--run-level-fill',(100*Math.min(1,runLevel.xp/remaining)).toFixed(2)+'%');
}

// Independent on-screen kill streak milestones; don't replace boss or wave
// messages. The underlying 4.6-second combo and XP multiplier stay intact.
function wyrdfluxKillComboAnnouncement(count,multiplier){
 if(!desktopPC||phase!=='play')return false;
 if(count!==3&&count!==5&&count!==10&&count!==15&&count!==20&&
   !(count>=30&&count%10===0))return false;
 let el=$('wyrdfluxKillComboAnnouncement');
 if(!el){
  el=document.createElement('aside');
  el.id='wyrdfluxKillComboAnnouncement';
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  document.body.appendChild(el);
 }
 el.dataset.tier=count>=20?'legendary':count>=10?'epic':count>=5?'rare':'common';
 el.textContent=count+' KILL COMBO · XP ×'+multiplier.toFixed(2);
 el.classList.remove('wyrdfluxComboPop');
 void el.offsetWidth;el.classList.add('wyrdfluxComboPop');
 return true;
}
function creditRunKillXP(boss=false){
 if(phase!=='play'||testLabMode)return;
 const continuedCombo=time<=runLevel.comboUntil;
 runLevel.combo=continuedCombo?runLevel.combo+1:1;
 if(!continuedCombo)runLevel.comboDamageStart=runRecord.damageEvents;
 runLevel.comboUntil=time+4.6;
 runLevel.bestCombo=Math.max(runLevel.bestCombo,runLevel.combo);
 // Hell Bell requires thirteen kills earned IN Hell, not a combo carried in from another realm.
 // Reset on any intervening non-Hell kill or damage event.
 runLevel.hellFlawlessCombo=hellBreach.state==='active'&&
  runRecord.damageEvents===runLevel.comboDamageStart?
  (continuedCombo?(runLevel.hellFlawlessCombo||0):0)+1:0;
 const multiplier=Math.min(4,1+Math.floor((runLevel.combo-1)/3)*.25);
 const gained=Math.max(1,Math.round((boss?125:28)*multiplier));
 wyrdfluxKillComboAnnouncement(runLevel.combo,multiplier);
 runLevel.xp+=gained;
 // Secret I: thirteen consecutive kills in Hell with no damage taken.
 if(!testLabMode&&hellBreach.state==='active'&&!wyrdfluxSecrets.thirteen&&
    runLevel.hellFlawlessCombo>=13&&runRecord.damageEvents===runLevel.comboDamageStart){
  wyrdfluxSecrets.thirteen=true;player.cash+=1313;player.energy=100;
  rememberWyrdfluxRunItem('HIDDEN EASTER EGG','THIRTEENTH BELL','13 flawless Hell kills · +1313 salvage · full stamina');
  burst(player.x,player.z,'gold',3.6);spark(player.x,player.z,'purple',32);
  announce('THE THIRTEENTH BELL HAS TOLLED',4);
  notice('SECRET DISCOVERED · +1313 SALVAGE · STAMINA RESTORED',4);
 }
runLevel.totalXP+=gained;
 let levels=0;
 while(Number.isFinite(runLevel.xp)&&runLevel.xp>=runLevelThreshold(runLevel.rank)){
  runLevel.xp-=runLevelThreshold(runLevel.rank);
  runLevel.rank++;runLevel.pending++;runLevel.waveEarned++;levels++;
 }
 if(levels)showWyrdfluxLevelBank(false); // Animated count, no combat pause.
 refreshRunLevelHud();
}
// Categorized artwork for all reward cards; guns use an original vector silhouette.
function wyrdfluxChoiceGlyph(card,item){
 const slot=card?.querySelector('.icon');if(!slot||!item)return;
 const id=String(item.id||''),tag=String(item.tag||'').toLowerCase();
 const kind=item.kind==='weapon'?'weapon':
  /health|heart|heal|plating|fortify|medresupply/i.test(id)?'health':
  /shield|bastion|barrier|overshield/i.test(id)?'defense':
  /rage|reactor|power|afterburner|overdrive/i.test(id)?'overdrive':
  /move|dash|stride|blink|speed|kinetic/i.test(id)?'mobility':
  /gun|weapon|coil|flux|rapid|damage|paradox/i.test(id)?'offense':
  tag.replace(/[^a-z]/g,'')||'utility';
 card.classList.add('wyrdfluxChoiceCard','wyrdfluxChoice-'+kind);
 if(['legendary','mythic'].includes(item.rarity))card.classList.add('wyrdfluxChoiceSuper');
 slot.setAttribute('aria-hidden','true');
 if(kind==='weapon'){
  slot.replaceChildren();
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 40');svg.setAttribute('focusable','false');
  svg.setAttribute('aria-hidden','true');svg.classList.add('wyrdfluxGunGlyph');
  const p=document.createElementNS(ns,'path');
  p.setAttribute('d','M4 12 L19 12 L24 8 L44 8 L47 11 L59 11 L59 17 L49 17 L44 22 L35 22 L30 34 L21 34 L26 22 L17 22 L17 19 L4 19 Z');
  p.setAttribute('fill','currentColor');p.setAttribute('stroke','currentColor');
  p.setAttribute('stroke-linejoin','round');p.setAttribute('stroke-width','1.5');
  const cut=document.createElementNS(ns,'path');cut.setAttribute('d','M29 12 H43 M9 16 H19');
  cut.setAttribute('stroke','#180e21');cut.setAttribute('stroke-width','2');
  svg.append(p,cut);slot.appendChild(svg);
 }else if(!slot.textContent?.trim()){
  slot.textContent=({health:'✚',defense:'⬡',mobility:'➤',overdrive:'⚡',
    offense:'✦',elemental:'✳',sustain:'♥',utility:'◈',curse:'☠'})[kind]||'◆';
 }
 card.dataset.choiceType=kind==='weapon'?'GUN':kind.toUpperCase();
}
function presentUpgradeDraft(kind='wave'){
 upgradeDraftKind=kind;
 $('upgradeScreen')?.classList.toggle('wyrdfluxKillDraft',kind==='kill');
 const draftTag=$('upgradeScreen')?.querySelector('.eyebrow');
 if(draftTag)draftTag.textContent=kind==='kill'?'ROUND REWARDS // '+(runLevel.pending+1)+' PICKS REMAIN':'FIELD FABRICATOR // WAVE CLEARED';
 phase='upgrade';
 saveCheckpoint();
 $('upgradeTitle').textContent=kind==='kill'?'LEVEL '+runLevel.rank+' · PICK '+(runLevel.roundDraftsClaimed+1)+' OF '+runLevel.waveEarned:
  localWaveOf(wave)===CAMPAIGN_WAVES?'ENDLESS CYCLE '+(cycleOf(wave)+1)+' // CHOOSE YOUR LEGACY':
  wave%3===0?'SECTOR SECURED. REBUILD.':'CHOOSE YOUR AUGMENT';
 upgradeChoices=weightedUpgradeChoices();
 $('upgradeCards').replaceChildren(...upgradeChoices.map(u=>{
  const b=document.createElement('button');
  b.className='card '+rarityClass(u)+(u.kind==='weapon'?' weaponCard':'');
  const rarity=u.rarity.toUpperCase();
  const clean=String(u.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  b.innerHTML='<span class="tag">'+u.tag+' · '+rarity+'</span>'+
   '<span class="icon">'+u.icon+'</span><strong class="wyrdflux-rare-label" data-echo="'+clean+'">'+clean+'</strong>'+
   '<p>'+u.text+'</p><small class="upgradeStack">'+
   (u.kind==='weapon'?'NEW ARMORY UNLOCK · EQUIP':
    u.ascend?'ASCENSION RANK '+stacks(u.id):
    'OWNED '+stacks(u.id)+' / '+u.max+' · SYNERGY POTENTIAL')+'</small>';
  wyrdfluxChoiceGlyph(b,u);
  b.addEventListener('click',()=>{
   grantUpgrade(u);hudWeapon();sound('upgrade');
   if(kind==='kill'){
    runLevel.drafts++;runLevel.roundDraftsClaimed++;
    phase='upgrade';advanceRoundEndRewards();
   }else{
    showScreen(null);beginWave(wave+1);overlayPlay(true);saveCheckpoint();
   }
   if(player.fusionJustUnlocked){
    announce('FUSION // '+player.fusionJustUnlocked,3);
    player.fusionJustUnlocked='';
   }
  });
  return b;
 }));
 overlayPlay(false);showScreen('upgradeScreen');
 // The round report is displayed once when the wave ends, before rewards.
}
function presentPendingRunLevel(){
 // Combat never stops for a level: all XP selections are claimed after wave clear.
 return false;
}
function presentBossVictoryReward(){
 bossShopOpen=false;upgradeDraftKind='bossreward';phase='upgrade';
 const screen=$('upgradeScreen'),grid=$('upgradeCards');
 screen?.classList.remove('wyrdfluxKillDraft');
 const eyebrow=screen?.querySelector('.eyebrow');
 if(eyebrow)eyebrow.textContent='BOSS DEFEATED · FREE TROPHY REWARD';
 $('upgradeTitle').textContent='CHOOSE YOUR VICTORY REWARD';
 const picks=weightedUpgradeChoices().slice(0,3);
 grid.replaceChildren(...picks.map(u=>{
  const b=document.createElement('button');b.className='card '+rarityClass(u);
  const tag=document.createElement('span');tag.className='tag';tag.textContent='FREE BOSS REWARD · '+u.rarity.toUpperCase();
  const icon=document.createElement('span');icon.className='icon';icon.textContent=u.icon;
  const name=document.createElement('strong');name.textContent=u.name;
  const text=document.createElement('p');text.textContent=u.text;
  b.append(tag,icon,name,text);wyrdfluxChoiceGlyph(b,u);b.addEventListener('click',()=>{
   grantUpgrade(u);sound('upgrade');hudWeapon();presentBossShop();
  });return b;
 }));
 overlayPlay(false);showScreen('upgradeScreen');saveCheckpoint();
}
function advanceRoundEndRewards(){
 // Claim every earned level, then each boss trophy+shop, then standard wave pick.
 if(runLevel.pending>0){
  runLevel.pending--;presentUpgradeDraft('kill');return;
 }
 if(!testLabMode&&bossShopDue>0){
  bossShopDue--;presentBossVictoryReward();return;
 }
 presentUpgradeDraft('wave');
}


/* WYRDFLUX v0.59 - boss-only salvage shop. These are not part of
 * UPGRADES or the ordinary random draft pool. They affect actual stats,
 * persist in the run checkpoint and use the game's existing upgrade screen
 * so both mouse and Xbox UI navigation share the working input path. */
const BOSS_SHOP_STOCK=[
 {id:'paradox',name:'PARADOX CHAMBER',icon:'✦',cost:940,max:3,rarity:'epic',
  text:'Permanent +12% damage during this run.',apply:()=>{player.damageMult*=1.12;}},
 {id:'bastion',name:'BASTION FILAMENT',icon:'⬡',cost:740,max:3,rarity:'rare',
  text:'+45 maximum shield and immediately recharge 45 shield.',apply:()=>{player.maxShield+=45;player.shield=Math.min(player.maxShield,player.shield+45);}},
 {id:'heart',name:'RIFTED HEART',icon:'♥',cost:850,max:3,rarity:'rare',
  text:'+50 maximum health and immediately recover 50 health.',apply:()=>{player.maxHp+=50;player.hp=Math.min(player.maxHp,player.hp+50);}},
 {id:'kinetic',name:'KINETIC GOVERNOR',icon:'❯',cost:990,max:2,rarity:'epic',
  text:'Dash cooldown reduced by 12%.',apply:()=>{player.dashMult=Math.max(.52,player.dashMult*.88);}},
 {id:'reactor',name:'COOLANT RESERVOIR',icon:'⚡',cost:1180,max:2,rarity:'legendary',
  text:'Weapons cool 16% faster between bursts.',apply:()=>{player.coolingMult=Math.min(2.5,(player.coolingMult||1)*1.16);}},
 // New permanent-in-run enhancements (tracked by stable shop IDs for saves).
 {id:'fluxcap',name:'FLUX CAPACITOR',icon:'✧',cost:1190,max:5,rarity:'epic',
  text:'+6% gun damage.',apply:()=>{player.damageMult*=1.06;}},
 {id:'rapidcoil',name:'RAPID COIL',icon:'ϟ',cost:1180,max:5,rarity:'rare',
  text:'Shoot 5% faster.',apply:()=>{player.speedMult*=1.05;}},
 {id:'fortify',name:'HEAVY PLATING',icon:'▣',cost:1120,max:5,rarity:'rare',
  text:'+35 max health. Heal 35.',apply:()=>{player.maxHp+=35;player.hp=Math.min(player.maxHp,player.hp+35);}},
 {id:'overshield',name:'SHIELD ARRAY',icon:'⬟',cost:1040,max:6,rarity:'rare',
  text:'+30 max shield. Recharge 30.',apply:()=>{player.maxShield+=30;player.shield=Math.min(player.maxShield,player.shield+30);}},
 {id:'riftstride',name:'RIFT STRIDE',icon:'➤',cost:1020,max:6,rarity:'epic',
  text:'Move 4% faster.',apply:()=>{player.moveMult*=1.04;}},
 {id:'regenpulse',name:'REPAIR ENGINE',icon:'✚',cost:1240,max:5,rarity:'epic',
  text:'Shields regenerate 12% faster.',apply:()=>{player.regenMult*=1.12;}},
 // Repeatable supplies keep every later-loop merchant useful even when
 // all permanent shop upgrades reach their ownership cap.
 {id:'medresupply',name:'MEDICAL RESUPPLY',icon:'♥',cost:690,repeatable:true,rarity:'common',
  text:'Restore 40% health.',apply:()=>{player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.4);}},
 {id:'shieldresupply',name:'SHIELD RESUPPLY',icon:'⬡',cost:640,repeatable:true,rarity:'common',
  text:'Restore 50% shield.',apply:()=>{player.shield=Math.min(player.maxShield,player.shield+player.maxShield*.5);}},
 {id:'powercell',name:'POWER CELL',icon:'⚡',cost:900,repeatable:true,rarity:'rare',
  text:'Restore all stamina and vent the equipped weapon.',apply:()=>{player.energy=100;const t=wyrdfluxGunThermal(gun);t.heat=0;t.lock=0;t.quiet=0;t.overheated=false;}},
 {id:'fullrepair',name:'FULL REPAIR',icon:'✚',cost:1450,repeatable:true,rarity:'epic',
  text:'Fully restore health and shield.',apply:()=>{player.hp=player.maxHp;player.shield=player.maxShield;}}
];
function wyrdfluxShopPrice(item,owned,waveNumber=wave){
 const passes=Math.max(0,cycleOf(waveNumber)-1);
 // Slightly higher baseline plus a compounding endless-cycle surcharge.
 return Math.round(item.cost*1.20*Math.pow(1.4,Math.min(12,passes))*
  (1+.22*Math.max(0,owned)));
}
function presentBossShop(){
 bossShopOpen=true;upgradeDraftKind='shop';phase='upgrade';
 const screen=$('upgradeScreen'),grid=$('upgradeCards');
 screen?.classList.remove('wyrdfluxKillDraft');
 const eyebrow=screen?.querySelector('.eyebrow');
 if(eyebrow)eyebrow.textContent='BOSS COMPLETE · BUY UPGRADES';
 $('upgradeTitle').textContent='THE RIFT MERCHANT · '+Math.floor(player.cash)+' SALVAGE';
 const owned=player.bossShopPerks||(player.bossShopPerks={});
 const available=BOSS_SHOP_STOCK.filter(item=>item.repeatable||(owned[item.id]||0)<item.max);
 const ordered=available.length?available.map((_,i)=>available[(i+bossShopVisited)%available.length]).slice(0,5):[];
 const cards=ordered.map(item=>{
  const n=owned[item.id]||0,price=wyrdfluxShopPrice(item,n);
  const b=document.createElement('button');
  b.className='card bossShopCard '+(item.rarity==='legendary'?'legendary':'');
  const tag=document.createElement('span');tag.className='tag';tag.textContent='BOSS SHOP EXCLUSIVE · '+item.rarity.toUpperCase();
  const icon=document.createElement('span');icon.className='icon';icon.textContent=item.icon;
  const title=document.createElement('strong');title.textContent=item.name;
  const desc=document.createElement('p');desc.textContent=item.text;
  const cost=document.createElement('small');cost.className='upgradeStack';
  cost.textContent=price+' SALVAGE · '+(item.repeatable?'RESTOCK · BOUGHT '+n:'OWNED '+n+'/'+item.max);
  b.append(tag,icon,title,desc,cost);wyrdfluxChoiceGlyph(b,item);
  b.disabled=player.cash<price;
  b.setAttribute('aria-label',item.name+', '+price+' salvage'+(b.disabled?', not enough salvage':''));
  b.addEventListener('click',()=>{
   if(!bossShopOpen||phase!=='upgrade'||player.cash<price||(!item.repeatable&&(owned[item.id]||0)>=item.max))return;
   player.cash-=price;owned[item.id]=(owned[item.id]||0)+1;item.apply();
   rememberWyrdfluxRunItem('BOSS SHOP',item.name,'Paid '+price+' salvage · '+item.text);
   sound('upgrade');notice(item.name+' INSTALLED · '+Math.floor(player.cash)+' SALVAGE REMAIN',2.5);
   updateHUD();presentBossShop();saveCheckpoint();
  });
  return b;
 });
 const next=document.createElement('button');next.className='card bossShopContinue';
 next.innerHTML='<span class="tag">SAVE YOUR SALVAGE</span><span class="icon">➜</span><strong>CONTINUE</strong><p>Claim your reward and fight again.</p>';
 next.addEventListener('click',()=>{
  bossShopOpen=false;bossShopVisited++;
  if(bossShopDue>0){bossShopDue--;presentBossShop();saveCheckpoint();}
  else{advanceRoundEndRewards();}
 });
 grid.replaceChildren(...cards,next);
 overlayPlay(false);showScreen('upgradeScreen');saveCheckpoint();
}
function waveComplete(){
 if(phase!=='play')return;
 showWyrdfluxLevelBank(true);

 // Meadow is currently a private test arena: its mythic is only a temporary
 // weapon choice during testing and cannot mutate account-wide career data.
 if((testLabMode==='meadow'||meadowEpisodeActive)&&rnd()<.09)worldRelicOffer='meadow';
 if(runRecord.lastCreditedWave<wave){
  if(localWaveOf(wave)===CAMPAIGN_WAVES)runRecord.ascensions++;
  const found=creditMeta('wave');
  if(found.length)notice(found.length+' PERMANENT BLUEPRINTS UNLOCKED · VIEW ARCHIVE',3.2);
 }
 // Round-end sequence: report, every banked level, free boss trophies,
 // boss merchants and only then the normal wave upgrade.
 advanceRoundEndRewards();
 showAfterlightWaveReport();
}
function useOverdrive(){return false;} // Retired: only per-gun heat/venting remains.
function dash(){if(phase!=='play'||bossCine.active||player.dashCool>0||
 wyrdfluxSprint.exhausted||player.energy<WYRDFLUX_DASH_STAMINA_COST)return false;
 const k=inputs.keys,fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=-fz,rz=fx;
 let forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))-inputs.moveZ;
 let strafe=Number(k.has('d'))-Number(k.has('a'))+inputs.moveX;
 if(Math.hypot(forward,strafe)<.12)forward=1;
 const dx=fx*forward+rx*strafe,dz=fz*forward+rz*strafe,len=Math.max(.01,Math.hypot(dx,dz));
 player.dashDirX=dx/len;player.dashDirZ=dz/len;
 runRecord.dashes++;player.energy-=WYRDFLUX_DASH_STAMINA_COST;
 if(player.energy<5){wyrdfluxSprint.exhausted=true;wyrdfluxSprint.latched=false;}
 player.dashCool=3.1*player.dashMult;player.dashT=.26;burst(player.x,player.z,'cyan',stacks('shock')?2.1:1.1);if(stacks('shock')||stacks('mirage'))blastAt(player.x,player.z,(stacks('shock')*21+stacks('mirage')*29)*player.damageMult,1.6+stacks('shock')*.22,0,'shock');if(stacks('flashstep')||stacks('chronolock')){
 for(const e of enemies){
  if(Math.hypot(e.x-player.x,e.z-player.z)<2.5+stacks('chronolock')*.4){
   if(stacks('chronolock'))e.slowUntil=Math.max(e.slowUntil||0,time+2.2*stacks('chronolock'));
   if(stacks('flashstep')&&!isBoss(e))e.stunUntil=Math.max(e.stunUntil||0,time+.24*stacks('flashstep'));
  }
 }
}
if(stacks('mirage')&&stacks('arc')){const near=enemies.filter(e=>Math.hypot(e.x-player.x,e.z-player.z)<4).slice(0,3);for(const e of near)chainFrom(e,14*stacks('mirage'),2)}notice('PHASE DASH',.4);return true}

// WYRDFLUX v0.60.4: distinct boss identities. Each has a readable
// signature telegraph, own rhythm, unique actual collision and a cooldown.
// No instant off-screen damage; save/load recovers gracefully from defaults.
const BOSS_SIGNATURES=Object.freeze({
 behemoth:{title:'SIEGE BEHEMOTH · SEISMIC STOMP',warn:1.55,cooldown:9.8},
 overseer:{title:'HIVE OVERSEER · NEEDLE CONSTELLATION',warn:1.20,cooldown:8.1},
 colossus:{title:'NULL COLOSSUS · FRACTURE PATH',warn:1.75,cooldown:11.2}
});
function bossSignatureTick(e,dt,dx,dz,dist){
 const cfg=BOSS_SIGNATURES[e.type];if(!cfg||e.hp<=0||phase!=='play')return false;
 if(!Number.isFinite(e.signatureClock))e.signatureClock=5.8+(e.id%4);
 if(!e.signatureStage)e.signatureStage='idle';
 if(e.signatureStage==='idle'){
  e.signatureClock-=dt;
  if(e.signatureClock>0||dist>19||!lineClear(e.x,e.z,player.x,player.z)||
    e.ultimateStage==='charge'||e.ultimateStage==='fire')return false;
  e.signatureStage='charge';e.signatureT=cfg.warn;
  // Snapshot attack target when winding up; players can dodge the warning.
  e.signatureTargetX=player.x;e.signatureTargetZ=player.z;
  e.signatureStartX=e.x;e.signatureStartZ=e.z;
  e.signaturePulse=0;
  e.rangedStage='idle';e.attackT=Math.max(e.attackT,cfg.warn+.6);
  notice(cfg.title,2);sound('warden');
  return true;
 }
 if(e.signatureStage==='charge'){
  e.signatureT-=dt;e.moveSpeed=0;e.attackT=Math.max(e.attackT,.2);
  if(e.signatureT>0)return true;
  e.signatureStage='fire';e.signatureT=.34;
  const targetX=e.signatureTargetX,targetZ=e.signatureTargetZ;
  if(e.type==='behemoth'){
   // A ground-based crater shockwave, not another laser beam.
   const radius=4.45;
   for(let i=0;i<14;i++){
    const a=TAU*i/14;
    addHeatMark(e.x+Math.cos(a)*radius*.74,e.z+Math.sin(a)*radius*.74,.22);
   }
   if(Math.hypot(player.x-e.x,player.z-e.z)<radius&&player.dashT<=0)
    hitPlayer(16);
   shake=Math.max(shake,.12);burst(e.x,e.z,'orange',3.7);spark(e.x,e.z,'gold',22);
  }else if(e.type==='overseer'){
   // Five distinct hive-needle volleys converge on the marked approach cone.
   const a=Math.atan2(targetX-e.x,-(targetZ-e.z)),count=7;
   for(let i=0;i<count;i++){
    const spread=(i-3)*.195,angle=a+spread;
    projectiles.push({x:e.x+Math.sin(angle)*.9,y:2.35,z:e.z-Math.cos(angle)*.9,
     vx:Math.sin(angle)*5.2,vz:-Math.cos(angle)*5.2,
     damage:9.5,life:3.8,col:i%2?'green':'cyan'});
   }
   if(projectiles.length>160)projectiles.splice(0,projectiles.length-160);
   burst(e.x,e.z,'green',2.5);spark(e.x,e.z,'green',18);
  }else if(e.type==='colossus'){
   // Burn a precise, dodgeable six-segment fracture corridor toward the
   // recorded position. Damage checks the actual corridor only once.
   const angle=Math.atan2(targetX-e.x,-(targetZ-e.z)),reach=13.5;
   const lx=Math.sin(angle),lz=-Math.cos(angle);
   for(let i=2;i<21;i++){
    const d=i*.65;addHeatMark(e.x+lx*d,e.z+lz*d,.65);
   }
   const ax=player.x-e.x,az=player.z-e.z;
   const along=ax*lx+az*lz,side=Math.abs(ax*lz-az*lx);
   if(along>1&&along<reach&&side<.95&&player.dashT<=0)hitPlayer(21);
   shake=Math.max(shake,.11);burst(e.x,e.z,'red',4.2);spark(e.x,e.z,'pink',25);
  }
  return true;
 }
 if(e.signatureStage==='fire'){
  e.signatureT-=dt;if(e.signatureT<=0){
   e.signatureStage='cooldown';e.signatureT=1.25;
   e.signatureClock=cfg.cooldown;
  }
  return true;
 }
 if(e.signatureStage==='cooldown'){
  e.signatureT-=dt;
  if(e.signatureT<=0)e.signatureStage='idle';
 }
 return false;
}
function drawBossSignature(m,e,q){
 const cfg=BOSS_SIGNATURES[e.type];if(!cfg)return;
 const high=q==='high',x=e.x,z=e.z,charge=e.signatureStage==='charge',
  progress=charge?clamp(1-e.signatureT/cfg.warn,0,1):0;
 const wave=Math.sin(time*(charge?13:3)+e.id)*.5+.5;
 // Modeling pass: additional readable, boss-exclusive silhouettes with joints
 // that articulate at the actual combat stage. Respect cheap LOD budgets.
 if(e.type==='behemoth'){
  for(const side of [-1,1]){
   const cx=x+side*1.35,apex=2.75+.21*Math.sin(e.bob+side);
   m.box(cx,apex-.37,z+.34,.70,.84,1.02,'rust',.12);
   m.box(cx+side*.15,apex+.19,z-.16,.82,.27,.67,'titanium',.07);
   m.beam(cx,apex,z-.55,cx+side*.34,apex+.75+progress*.25,z-.90,
    .14,'brass',.30);
   m.beam(cx+side*.37,apex+.78+progress*.25,z-.90,
    cx+side*.44,apex+1.22+progress*.25,z-1.38,.074,'gold',.40);
   m.box(cx+side*.29,.60+Math.abs(Math.sin(e.bob))*.09,z+.28,.46,.45,.85,'ironblack',.08);
  }
  m.box(x,2.55+progress*.16,z-.88,1.5,.32,.31,'orange',.16+.75*progress);
 }else if(e.type==='overseer'){
  const petals=high?10:6;
  for(let i=0;i<petals;i++){
   const a=TAU*i/petals+time*.14,r=1.45+.18*Math.sin(time*2+i),
    sx=x+Math.cos(a)*r,sz=z+Math.sin(a)*r;
   m.beam(x,3.05,z,sx,3.15+.25*Math.sin(time*3+i),sz,
    .095,'steelblue',.25);
   m.box(sx,3.25+.12*Math.sin(time*3+i),sz,.44,.40,.36,'green',.24+progress*.4,a);
   m.box(sx,3.24+.12*Math.sin(time*3+i),sz-.20,.18,.16,.08,'white',.32+progress*.75);
   m.box(sx,3.24+.12*Math.sin(time*3+i),sz-.25,.075,.08,.06,'purple',1.1+progress);
  }
  m.box(x,3.24,z-.83,.6,.55,.18,'green',.55+wave*.30);
 }else if(e.type==='colossus'){
  for(const side of [-1,1]){
   for(let i=0;i<(high?6:4);i++){
    const y=1.1+i*.7;
    m.beam(x+side*.70,y,z+.45,x+side*(1.2+i*.16),y+.42+progress*.12,z+.64,
     .07,'ironblack',.10);
    m.box(x+side*(1.23+i*.16),y+.45+progress*.12,z+.67,
     .25,.45,.27,i%2?'red':'chrome',.32+progress*.8);
   }
   m.box(x+side*.75,3.4,z-.55,.36,1.1,.35,'titanium',.13);
  }
  const n=high?14:9,r=2.0+.20*Math.sin(time*1.7);
  for(let i=0;i<n;i++){
   const a=TAU*i/n+time*.22,b=a+TAU/n;
   m.beam(x+Math.cos(a)*r,4.2+progress*.3,z+Math.sin(a)*r,
    x+Math.cos(b)*r,4.2+progress*.3,z+Math.sin(b)*r,
    .035,'red',.25+progress);
  }
 }
 if(!charge)return;
 const color=e.type==='behemoth'?'orange':e.type==='overseer'?'green':'red';
 const r=e.type==='behemoth'?4.45:e.type==='overseer'?2.7:3.3;
 for(let i=0,n=high?24:13;i<n;i++){
  const a=TAU*i/n,b=TAU*(i+1)/n;
  m.beam(x+Math.cos(a)*r,.042,z+Math.sin(a)*r,
   x+Math.cos(b)*r,.042,z+Math.sin(b)*r,
   .027,color,.21+progress*.95);
 }
 if(e.type==='colossus'){
  const a=Math.atan2(e.signatureTargetX-x,-(e.signatureTargetZ-z));
  const lx=Math.sin(a),lz=-Math.cos(a);
  for(let i=1;i<13;i++){
   const d=i;
   m.box(x+lx*d,.02,z+lz*d,.66,.018,.66,'red',.11+progress*.75);
  }
 }
}
function bossUltimateTick(e,dt,dx,dz,dist){
 if(!isBoss(e)||e.hp<=0)return;
 if(e.signatureStage==='charge'||e.signatureStage==='fire')return;
 const amp=e.type==='colossus'?.78:e.type==='behemoth'?.64:.47;
 const warn=e.type==='colossus'?1.8:1.45;
 const duration=e.type==='colossus'?2.3:e.type==='behemoth'?1.9:1.65;
 if(e.ultimateStage==='idle'){
  e.ultimateClock-=dt;
  if(e.ultimateClock<=0&&dist<21&&lineClear(e.x,e.z,player.x,player.z)){
   e.ultimateStage='charge';e.ultimateT=warn;
   e.ultimateAngle=Math.atan2(dx,-dz);e.ultimateSweep=amp;e.ultimateTick=0;
   e.attackT=Math.max(e.attackT,warn+.35);
   burst(e.x,e.z,e.type==='colossus'?'red':'purple',2.2);
   notice(BOSS_NAMES[e.type]+' // ULTIMATE CHARGING — DODGE!',2);
  }
  return;
 }
 if(e.ultimateStage==='charge'){
  e.ultimateT-=dt;
  if(e.ultimateT<=0){e.ultimateStage='fire';e.ultimateT=duration;e.ultimateTick=0;
   spark(e.x,e.z,e.type==='colossus'?'red':'pink',22);}
  return;
 }
 if(e.ultimateStage==='fire'){
  e.ultimateT-=dt;e.ultimateTick-=dt;
  const pct=clamp(1-e.ultimateT/duration,0,1);
  const angle=e.ultimateAngle+(pct*2-1)*e.ultimateSweep;
  const lx=Math.sin(angle),lz=-Math.cos(angle);
  const projection=dx*lx+dz*lz,side=Math.abs(dx*lz-dz*lx);
  if(e.ultimateTick<=0){
   e.ultimateTick=.36;
   if(projection>0&&projection<bossLaserVisibleDistance(e,angle)&&
       side<(e.type==='colossus'?.95:.78)&&
       Math.abs((1.64+player.height)-1.62)<.95&&
       lineClear(e.x,e.z,player.x,player.z))
    hitPlayer(e.type==='colossus'?22:13);
  }
  if(e.ultimateT<=0){e.ultimateStage='cooldown';e.ultimateT=1;e.ultimateClock=e.type==='colossus'?9:10.5;}
  return;
 }
 if(e.ultimateStage==='cooldown'){e.ultimateT-=dt;if(e.ultimateT<=0)e.ultimateStage='idle';}
}

// Explicit combat intentions keep positioning deliberate without overriding
// the existing real windup, projectile, lunge, hit and recovery states.
const MOTION_STYLE={
 sentinel:[1.6,.21,1.5],crusher:[1.2,.05,.9],drone:[3,.45,1.8],
 stalker:[1.9,.60,1.5],artillery:[7.4,.33,1.3],skitter:[1.7,.80,1.6],
 sniper:[8.3,.42,1.9],bulwark:[1.75,.10,1],leech:[1.4,.48,1.2],
 warden:[3.7,.14,1.25],behemoth:[3.8,.35,1],overseer:[5.9,.46,1.35],
 colossus:[5.3,.18,1.2]
};
function chooseEnemyIntent(e,dist,los){
 const [range,flank]=MOTION_STYLE[e.type]||MOTION_STYLE.sentinel;
 const roll=rnd();
 e.intentClock=(e.type==='skitter'||e.type==='drone'?.65:1.1)+rnd()*.85;
 e.intent=!los?'seek':dist<range*.7?(roll<.68?'withdraw':'orbit'):
  dist>range*1.35?(roll<.24?'flank':'advance'):
  roll<flank?'orbit':roll<.66?'hold':roll<.85?'flank':'advance';
 if(['crusher','bulwark'].includes(e.type))e.intent=dist>range?'advance':'hold';
 if(e.type==='sniper'&&dist<5)e.intent='withdraw';
 if(e.type==='stalker'&&dist<range*1.9)e.intent='orbit';
 if(e.type==='skitter'&&dist<range*1.6)e.intent=roll<.72?'orbit':'flank';
 if(e.intent==='flank'||e.intent==='orbit')e.intentSide=rnd()<.5?-1:1;
}
function steerEnemy(e,dx,dz,dist){
 const [range,,repel]=MOTION_STYLE[e.type]||MOTION_STYLE.sentinel;
 const fx=dx/Math.max(.01,dist),fz=dz/Math.max(.01,dist),sx=-fz*(e.intentSide||1),sz=fx*(e.intentSide||1);
 let along=dist>range?1:-.35,side=0;
 if(e.intent==='withdraw')along=-1;
 if(e.intent==='hold'){along=dist>range+.5?.36:0;side=0;}
 if(e.intent==='orbit'){along=dist>range?.34:-.18;side=.96;}
 if(e.intent==='flank'){along=.42;side=.80;}
 if(e.intent==='seek')along=1;
 let mx=along*fx+side*sx,mz=along*fz+side*sz,neighbors=0;
 for(const other of enemies){
  if(other===e||other.hp<=0||other.type==='puppet')continue;
  const x=e.x-other.x,z=e.z-other.z,d2=x*x+z*z;
  if(d2<.025||d2>3.0625)continue;
  const d=Math.sqrt(d2),force=(1.75-d)/d;
  mx+=x*force*repel*.56;mz+=z*force*repel*.56;
  if(++neighbors>=3)break;
 }
 const mag=Math.max(1,Math.hypot(mx,mz));
 return {x:mx/mag,z:mz/mag};
}
const RANGED_TYPES=new Set(['drone','warden','artillery','sniper','behemoth','overseer','colossus']);
const MELEE_TYPES=new Set(['sentinel','crusher','stalker','skitter','bulwark','leech']);
function enemyTurnToward(e,dx,dz,dt,rate=3.8){
 if(Math.hypot(dx,dz)<.002)return;
 const target=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(target-e.facing),Math.cos(target-e.facing));
 e.facing+=clamp(delta,-rate*dt,rate*dt);
}
function fireChargedShot(e){
 if(e.hp<=0||phase!=='play')return;
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);
 if(dist<.25||!lineClear(e.x,e.z,player.x,player.z))return;
 const sp=e.hellVariant==='archfiend'?5.5:e.type==='sniper'?8.5:e.type==='artillery'?3.6:e.type==='colossus'?4:4.7;
 const stage=cycleOf(wave),deep=stage>1||localWaveOf(wave)>=15;
 const baseShots=e.hellVariant==='archfiend'?5:e.type==='artillery'?3:e.type==='colossus'?5:e.type==='overseer'?3:e.type==='behemoth'?3:1;
 const style=e.attackPhase||0;
 const shots=Math.min(7,baseShots+(deep&&['artillery','overseer','colossus','behemoth'].includes(e.type)?
  (style%3===0?2:1):0));
 e.attackPhase=(style+1)%6;
 e.lastVolleyCount=shots;e.lastVolleyPattern=deep?style%3:0;
 const aim=Math.atan2(dx,-dz);
 const color=e.hellVariant==='archfiend'?'red':e.type==='colossus'?'red':e.type==='overseer'?'green':e.type==='sniper'?'cyan':
  e.type==='behemoth'?'gold':e.type==='warden'?'pink':e.type==='artillery'?'orange':'purple';
 for(let k=0;k<shots;k++){
  // Spread always has a readable charge; advanced waves alternate fan,
   // tight split, and crossing volleys without instant or homing hits.
   const spread=deep&&(style%3===1)?(e.type==='sniper'?.018:.115):
    deep&&style%3===2?(e.type==='sniper'?.012:.23):(e.type==='sniper'?.01:.19);
   const angle=aim+(k-(shots-1)/2)*spread;
  projectiles.push({x:e.hellVariant==='archfiend'?e.x+Math.sin(angle)*.70:e.x,
   y:e.hellVariant==='archfiend'?2.75:e.type==='drone'?1.8:isBoss(e)?2.1:e.type==='sniper'?1.9:1.5,
   z:e.hellVariant==='archfiend'?e.z-Math.cos(angle)*.70:e.z,
   vx:Math.sin(angle)*sp,vz:-Math.cos(angle)*sp,life:5,col:color,
   damage:(e.type==='colossus'?10:e.type==='behemoth'?12:e.type==='warden'?15:e.type==='sniper'?17:8)*
     (deep?Math.min(1.44,1.08+Math.max(0,stage-1)*.045):1)});
 }
 if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
 rangedChargedShots++;advancedVolleys+=deep?1:0;
 e.weakOpenUntil=time+.55; // chest cooling vent becomes shootable
 spark(e.x,e.z,color,12);
 burst(e.x,e.z,color,.45);
}
function tickMelee(e,dt,dx,dz,dist){
 const stage=e.meleeStage;
 if(stage==='seek')return false;
 e.meleeT-=dt;
 const fast=e.type==='skitter'||e.type==='stalker',big=e.type==='bulwark'||e.type==='crusher';
 if(stage==='windup'){
  enemyTurnToward(e,dx,dz,dt,big?2.5:6.5);
  if(e.meleeT<=0){e.meleeStage='lunge';e.meleeT=e.hellVariant==='imp'?.22:e.hellVariant==='hellknight'?.49:e.hellVariant==='pinky'?.46:e.hellVariant==='horned'?.41:big?.36:fast?.21:.28;e.meleeHit=false;if(e.hellVariant==='horned')hellHornedRushes++;if(e.hellVariant==='pinky')pinkyCharges++;if(e.hellVariant==='hellknight')hellKnightCharges++;}
 }else if(stage==='lunge'){
  const towardX=-Math.sin(e.meleeAimed),towardZ=-Math.cos(e.meleeAimed),speed=e.hellVariant==='imp'?7.4:e.hellVariant==='hellknight'?4.7:e.hellVariant==='pinky'?6.5:e.hellVariant==='horned'?5.8:big?5:fast?8.0:6.0;
  const beforeX=e.x,beforeZ=e.z;
  collisionMove(e,towardX*speed*dt,towardZ*speed*dt,enemyCollisionRadius(e));
  e.moveSpeed=Math.hypot(e.x-beforeX,e.z-beforeZ)/Math.max(dt,.001);
  e.bob+=e.hellVariant?
    Math.hypot(e.x-beforeX,e.z-beforeZ)*organicStrideRadiansPerMetre(e):
    dt*(12+e.moveSpeed*1.1);
  const d=Math.hypot(player.x-e.x,player.z-e.z);
  if(!e.meleeHit&&d<(big?1.85:1.45)&&lineClear(e.x,e.z,player.x,player.z)){
   const ax=player.x-e.x,az=player.z-e.z;
   const forward=ax*towardX+az*towardZ;
   if(forward>-.45){
    e.meleeHit=true;meleeHits++;
    hitPlayer(e.hellVariant==='imp'?9:e.hellVariant==='hellknight'?27:e.hellVariant==='pinky'?19:e.hellVariant==='horned'?22:e.type==='crusher'?19:e.type==='bulwark'?16:e.type==='leech'?9:fast?10:11);
    if(e.type==='leech'){player.energy=Math.max(0,player.energy-8);e.hp=Math.min(e.maxHp,e.hp+4);}
    spark(player.x,player.z,big?'orange':'red',6);shake=Math.max(shake,.07);
    e.meleeStage='retreat';e.meleeT=Math.max(e.meleeT,.44);
    collisionMove(e,-towardX*.38,-towardZ*.38,enemyCollisionRadius(e));
   }
  }
  if(e.meleeT<=0){e.meleeStage='retreat';e.meleeT=big?.38:.5;meleeRetreats++;}
 }else if(stage==='retreat'){
  // A real backward step creates room before the next attack, even at point blank.
  const awayX=Math.sin(e.meleeAimed),awayZ=Math.cos(e.meleeAimed),speed=big?2.9:3.3;
  const oldX=e.x,oldZ=e.z;collisionMove(e,awayX*dt*speed,awayZ*dt*speed,enemyCollisionRadius(e));
  e.moveSpeed=Math.hypot(e.x-oldX,e.z-oldZ)/Math.max(.001,dt);
   e.bob+=e.hellVariant?
    Math.hypot(e.x-oldX,e.z-oldZ)*organicStrideRadiansPerMetre(e):dt*8;
  if(e.meleeT<=0){e.meleeStage='recover';e.meleeT=big?.54:.36;}
 }else if(stage==='recover'){
  e.moveSpeed=0;
  if(e.meleeT<=0){e.meleeStage='seek';e.attackT=big?1.45:fast?.68:1.04;}
 }
 return true;
}
// The Wall Maw is a WALL-BORN creature. It never receives locomotion
// steering; all movement is face emergence, claws, tongue and mouth state.
function wallMawTick(e,dt){
 const w=e.wall;if(!w)return;
 if(!w.enraged&&e.hp<=e.maxHp*.5){
  w.enraged=true;w.armor=2;w.phase='transform';w.clock=0;w.mouth=1;
  // Remove interior room walls; safe collision perimeter stays intact.
  for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)map[z][x]=0;
  buildStatic();announce('WALL MAW // THE ROOM BREAKS APART',3.2);
  notice('PHASE TWO · 2× ARMOR · DODGE THE FIRE',3.6);shake=Math.max(shake,.4);
  return;
 }
 if(w.phase==='transform'){w.clock+=dt;if(w.clock>=1.8){w.phase='stalk';w.attackT=.60;w.clock=0;}return;}
 e.hit=Math.max(0,e.hit-dt);w.clock+=dt;w.mouth=Math.max(0,w.mouth-dt*1.5);
 w.lash=Math.max(0,w.lash-dt*1.8);
 if(w.phase==='emerge'){
  e.moveSpeed=0;if(w.clock>=2.2){w.phase='stalk';w.clock=0;}
  return;
 }
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);
 if(w.phase==='stalk'){
  w.attackT-=dt;
  if(w.attackT>0||dist>28)return;
  w.phase='charge';w.clock=0;w.attack=(w.attack+1)%4;
  w.aim=Math.atan2(dx,dz);
  notice('WALL MAW // '+(w.attack===1?'SCREAM':w.attack===2?'FANGS':'HELLFIRE')+' INCOMING',1.8);
  return;
 }
 if(w.phase==='charge'&&w.clock>=(cycleOf(wave)>1?.82:1.05)){
  w.phase='cast';w.clock=0;w.mouth=1;w.lash=1;
  wallMawCasts++;w.casts++;sound('maw');
  if(w.attack===1){
   burst(e.x,3.3,'red',4);
   if(dist<6.6&&Math.abs(player.x-e.x)<4.5&&lineClear(e.x,e.z,player.x,player.z))hitPlayer((11+cycleOf(wave)*2)*(cycleOf(wave)>1?1.3:1));
  }else if(w.attack===2){
   const near=dist<7&&Math.abs(player.x-e.x)<3.8;
   if(near&&lineClear(e.x,e.z,player.x,player.z))hitPlayer((13+cycleOf(wave)*2)*(cycleOf(wave)>1?1.3:1));
   for(let j=0;j<7;j++){
    const a=j*TAU/7+time*.23;
    spark(e.x+Math.cos(a)*1.6,e.z+2.1+Math.sin(a)*1.4,'red',3);
   }
  }else{
   const bonus=cycleOf(wave)>1?Math.min(8,cycleOf(wave)*2):0;
   const n=(w.enraged?(w.attack===3?13:10):(w.attack===3?10:8))+bonus,
    base=Math.atan2(dx,dz);
   for(let i=0;i<n;i++){
    const ang=base+(i-(n-1)/2)*.135,vel=(w.enraged?7.3:5.7)+cycleOf(wave)*.22;
    projectiles.push({x:e.x+Math.sin(ang)*.9,y:1.9,z:e.z+1.4,
      vx:Math.sin(ang)*vel,vz:Math.cos(ang)*vel,
      life:6,col:'red',damage:12+cycleOf(wave)*1.4});
   }
  }
  w.summonT-=.9;
  return;
 }
 if(w.phase==='cast'&&w.clock>=.50){
  w.phase='stalk';w.clock=0;
   w.attackT=(w.enraged?1.05:1.42)*(cycleOf(wave)>1?.73:1)+(.22*Math.sin(time+e.id));
 }
 w.summonT-=dt;
 if(w.summonT<=0&&enemies.length<(cycleOf(wave)>1?16:8)){
  w.summonT=cycleOf(wave)>1?9:12;
  for(let i=0;i<(cycleOf(wave)>1?Math.min(3,cycleOf(wave)):1);i++){
   const at=randomOpen(7),d=Math.hypot(at.x-player.x,at.z-player.z);
   if(d<4)continue;
   const add=newEnemy(at,false);add.type='skitter';
   add.hellVariant='imp';add.hp*=1.35;add.maxHp=add.hp;
   add.speed*=1.22;add.hellCastStage='idle';
   add.hellCastDelay=1.8+i*.6;add.impLeapCooldown=.8+i*.4;
   enemies.push(add);
  }
 }
}

// Demon intelligence is a distinct layer on the existing pathfinding and
// fair enemy combat. Shades feint sideways, Cinders charge a visible spit,
// Horned demons telegraph a heavy rush, and the Archfiend fires wider fans.
let hellCinderShots=0,hellShadeFeints=0,hellHornedRushes=0;
function hellEnemyInstinct(e,dt,dx,dz,dist){
 if(hellBreach.state!=='active'||!e.hellVariant)return false;
 const type=e.hellVariant;
 if(type==='imp'){
  // Bound leap arc stays collision checked; ember fire comes from the throat.
  e.impLeapHeight=Math.max(0,e.impLeapHeight||0);
  e.impLandingT=Math.max(0,(e.impLandingT||0)-dt);
  if((e.impLeapT||0)>0){
   e.impLeapT=Math.max(0,e.impLeapT-dt);
   const progress=clamp(1-e.impLeapT/.62,0,1);
   e.impLeapHeight=Math.sin(progress*Math.PI);
   const ox=e.x,oz=e.z,dx0=Math.sin(e.impLeapYaw),dz0=-Math.cos(e.impLeapYaw);
   collisionMove(e,dx0*dt*5.9,dz0*dt*5.9,enemyCollisionRadius(e));
   e.moveSpeed=Math.hypot(e.x-ox,e.z-oz)/Math.max(.001,dt);
   e.bob+=Math.hypot(e.x-ox,e.z-oz)*organicStrideRadiansPerMetre(e);
   if(e.impLeapT<=0){
    e.impLeapHeight=0;e.impLeapCooldown=2.4+(e.id%3)*.22;
    e.impLandingT=.28;impLandings++;
    if(Math.hypot(player.x-e.x,player.z-e.z)<.85&&
       lineClear(e.x,e.z,player.x,player.z))hitPlayer(10+hellBreach.stage);
    spark(e.x,e.z,'cinder',3);
   }
   return true;
  }
  if(e.hellCastStage==='charge'){
   e.hellCastT-=dt;e.moveSpeed=0;
   enemyTurnToward(e,dx,dz,dt,5.2);
   if(e.hellCastT<=0){
    if(dist>2&&dist<12.5&&lineClear(e.x,e.z,player.x,player.z)){
     const angle=Number.isFinite(e.hellCastAim)?e.hellCastAim:Math.atan2(dx,-dz),speed=6.8;
     const px=e.x+Math.sin(angle)*.50,pz=e.z-Math.cos(angle)*.50;
     if(free(px,pz,.14)){
      projectiles.push({x:px,y:1.44,z:pz,vx:Math.sin(angle)*speed,
       vz:-Math.cos(angle)*speed,life:2.55,col:'ember',
       damage:9+hellBreach.stage*1.6});
      if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
      impFireballs++;e.weakOpenUntil=time+.55;
     }
    }
    e.hellCastStage='recover';e.hellCastT=.55;
   }
   return true;
  }
  if(e.hellCastStage==='recover'){
   e.hellCastT-=dt;e.moveSpeed=0;
   if(e.hellCastT<=0){
    e.hellCastStage='idle';e.hellCastDelay=2.6+(e.id%4)*.28;
   }
   return true;
  }
  e.impLeapCooldown=(e.impLeapCooldown??(1.4+(e.id%4)*.2))-dt;
  e.hellCastDelay=(e.hellCastDelay??(2.1+(e.id%3)*.35))-dt;
  if(e.meleeStage==='seek'&&e.impLeapCooldown<=0&&dist>2.2&&dist<6.8&&
     lineClear(e.x,e.z,player.x,player.z)){
   e.impLeapT=.62;e.impLeapYaw=Math.atan2(dx,-dz);
   e.impLeapHeight=.01;e.impLeapCooldown=2.6;impLeaps++;
   return true;
  }
  if(e.meleeStage==='seek'&&e.hellCastDelay<=0&&dist>3.8&&dist<12&&
     lineClear(e.x,e.z,player.x,player.z)){
   e.hellCastStage='charge';e.hellCastT=.85;
   e.hellCastAim=Math.atan2(dx,-dz); // lock direction: no unfair last-frame targeting
   e.attackT=Math.max(e.attackT,1.02);e.moveSpeed=0;
   return true;
  }
  if(e.meleeStage==='seek'&&dist>1.5){
   e.intent='flank';e.intentClock=Math.max(e.intentClock||0,.55);
  }
  return false;
 }
 if(type==='shade'){
  e.hellFeintCooldown=(e.hellFeintCooldown??(1.1+e.id%4*.26))-dt;
  if(e.hellFeintCooldown<=0&&dist>2.4&&dist<8.5){
   e.intent='orbit';e.intentSide=-(e.intentSide||1);
   e.intentClock=1.2;e.hellFeintCooldown=2.3+.19*(e.id%5);
   e.hellFeintT=.50;hellShadeFeints++;
  }
  e.hellFeintT=Math.max(0,(e.hellFeintT||0)-dt);
  return false;
 }
 if(type==='hellknight'){
  // Slow heavy advance, 1.12s visible telegraph and two bounded fireballs;
  // an interrupted cast never leaves projectiles or a loop behind.
  if(e.hellCastStage==='charge'){
   e.hellCastT-=dt;e.moveSpeed=0;enemyTurnToward(e,dx,dz,dt,2.2);
   if(e.hellCastT<=0){
    if(dist>2.6&&dist<16&&lineClear(e.x,e.z,player.x,player.z)){
     const angle=Number.isFinite(e.hellCastAim)?e.hellCastAim:Math.atan2(dx,-dz),speed=5.3;
     for(const off of [-.105,.105]){
      const a=angle+off,px=e.x+Math.sin(a)*.67,pz=e.z-Math.cos(a)*.67;
      if(free(px,pz,.14))projectiles.push({x:px,y:2.16,z:pz,
       vx:Math.sin(a)*speed,vz:-Math.cos(a)*speed,life:3.0,
       col:'red',damage:14+2*hellBreach.stage});
     }
     if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
     hellKnightShots++;e.weakOpenUntil=time+.55;spark(e.x,e.z,'magma',5);
    }
    e.hellCastStage='recover';e.hellCastT=.50;
   }
   return true;
  }
  if(e.hellCastStage==='recover'){
   e.hellCastT-=dt;e.moveSpeed=0;
   if(e.hellCastT<=0){e.hellCastStage='idle';e.hellCastDelay=4.0+(e.id%4)*.28;}
   return true;
  }
  e.hellCastDelay=(e.hellCastDelay??(2.4+(e.id%3)*.31))-dt;
  if(e.hellCastDelay<=0&&dist>4.2&&dist<13.2&&
     e.meleeStage==='seek'&&lineClear(e.x,e.z,player.x,player.z)){
   e.hellCastStage='charge';e.hellCastT=1.12;
   e.hellCastAim=Math.atan2(dx,-dz); // twin volley stays on the announced bearing
   e.attackT=Math.max(e.attackT,1.6);e.moveSpeed=0;return true;
  }
  if(e.meleeStage==='seek'&&dist>2.3){
   e.intent='advance';e.intentClock=Math.max(e.intentClock||0,.68);
  }
  return false;
 }
 if(type==='pinky'){
  // Short collision-checked evasive hop under damage, not teleportation.
  e.pinkyDodgeCooldown=(e.pinkyDodgeCooldown??0)-dt;
  if((e.pinkyHopT||0)>0){
   e.pinkyHopT=Math.max(0,e.pinkyHopT-dt);
   const progress=clamp(1-e.pinkyHopT/.36,0,1);
   e.pinkyHopHeight=Math.sin(Math.PI*progress);
   const ox=e.x,oz=e.z;
   collisionMove(e,e.pinkyHopX*dt*3.9,e.pinkyHopZ*dt*3.9,
     enemyCollisionRadius(e));
   e.moveSpeed=Math.hypot(e.x-ox,e.z-oz)/Math.max(.001,dt);
   e.bob+=Math.hypot(e.x-ox,e.z-oz)*organicStrideRadiansPerMetre(e);
   return true;
  }
  e.pinkyHopHeight=0;
  if(e.hit>.12&&e.pinkyDodgeCooldown<=0&&e.meleeStage==='seek'&&
    dist>1.8&&dist<9&&lineClear(e.x,e.z,player.x,player.z)){
   const direction=e.id%2?-1:1,mag=Math.max(.01,dist);
   e.pinkyHopX=direction*(-dz/mag);e.pinkyHopZ=direction*dx/mag;
   if(free(e.x+e.pinkyHopX*.8,e.z+e.pinkyHopZ*.8,
         enemyCollisionRadius(e))){
    e.pinkyHopT=.36;e.pinkyDodgeCooldown=3.4;pinkyDodgeHops++;
    return true;
   }
  }
  // Eyeless heavy quadruped approaches before a telegraphed rush and retreat.
  if(e.meleeStage==='seek'&&dist>2.1){
   e.intent='advance';e.intentClock=Math.max(e.intentClock||0,.68);
  }
  return false;
 }
 if(type==='horned'){
  // The charge is already implemented in tickMelee; insist on an advance
  // approach instead of glitchy orbiting against corners.
  if(e.meleeStage==='seek'&&dist>2.5){
   e.intent='advance';e.intentClock=Math.max(e.intentClock||0,.70);
  }
  return false;
 }
 if(type==='cinder'){
  e.hellCastDelay=(e.hellCastDelay??(1.6+(e.id%4)*.4))-dt;
  if(e.hellCastStage==='charge'){
   e.hellCastT-=dt;e.moveSpeed=0;
   enemyTurnToward(e,dx,dz,dt,3.2);
   if(e.hellCastT<=0){
    const a=Math.atan2(dx,-dz),speed=6.6;
    if(dist>1&&dist<15&&lineClear(e.x,e.z,player.x,player.z)){
     // Fast red bolt, one projectile with an honest .92s warning.
     const mx=e.x+Math.sin(a)*.36,mz=e.z-Math.cos(a)*.36;
     if(free(mx,mz,.13))projectiles.push({x:mx,y:1.55,z:mz,vx:Math.sin(a)*speed,
      vz:-Math.cos(a)*speed,life:3.2,col:'orange',
      damage:12+hellBreach.stage*1.7});
     if(projectiles.length>100)projectiles.splice(0,projectiles.length-100);
     hellCinderShots++;spark(e.x,e.z,'orange',4);
    }
    e.hellCastStage='recover';e.hellCastT=.35;
   }
   return true;
  }
  if(e.hellCastStage==='recover'){
   e.hellCastT-=dt;e.moveSpeed=0;
   if(e.hellCastT<=0){
    e.hellCastStage='idle';e.hellCastDelay=3.2+.3*(e.id%4);
   }
   return true;
  }
  if(e.hellCastDelay<=0&&dist>3.3&&dist<11.5&&
     e.meleeStage==='seek'&&lineClear(e.x,e.z,player.x,player.z)){
   e.hellCastStage='charge';e.hellCastT=.92;
   e.hellCastDelay=3.6;e.attackT=Math.max(e.attackT,1.35);
   e.moveSpeed=0;
   return true;
  }
 }
 return false;
}
function enemyCollisionRadius(e){
 if(e.wardenMite)return .145;
 if(e.blockKind)return e.blockKind==='warden'?.69:e.blockKind==='spider'?.54:.32;
 if(e.type==='behemoth')return 1.22;
 if(e.type==='colossus')return 1.34;
 if(e.type==='overseer')return 1.02;
 if(e.type==='warden')return .82;
 if(e.hellVariant==='imp')return .31;
 if(e.hellVariant==='hellknight')return .68;
 if(e.hellVariant==='pinky')return .63;
 if(e.hellVariant==='horned')return .46;
 if(e.hellVariant==='archfiend')return 1.22;
 if(e.type==='bulwark'||e.type==='crusher')return .40;
 if(isBoss(e))return .76;
 return e.type==='skitter'?.23:.27;
}

function wyrdfluxDiscVolley(e){
 if(projectiles.length>145)return false;
 const boss=e.type==='traveler',count=boss?30:10,velocity=boss?3.9:3.4;
 const phase=e.saucer.volley++*.21,delay=1.2+(e.id%5)*.13;
 for(let i=0;i<count;i++){
  const a=phase+i*TAU/count;
  projectiles.push({x:e.x+Math.sin(a)*.65,y:e.saucer.hover-.22,
   z:e.z+Math.cos(a)*.65,vx:Math.sin(a)*velocity,
   vz:Math.cos(a)*velocity,vy:0,life:5.2,redirectDelay:delay,
   redirected:false,ufoShot:true,col:boss?'pink':'cyan',
   damage:boss?6.1:5.4});
 }
 if(projectiles.length>170)projectiles.splice(0,projectiles.length-170);
 sound('warden');return true;
}
function tickWyrdfluxSaucer(e,dt){
 const data=e.saucer,dx=player.x-e.x,dz=player.z-e.z;
 const d=Math.max(.01,Math.hypot(dx,dz));
 data.clock+=dt;data.shieldBurst=Math.max(0,data.shieldBurst-dt);
 e.hit=Math.max(0,(e.hit||0)-dt);e.bob+=dt*2.1;e.attackT-=dt;
 // The disc floats ABOVE regular wall height; its collision footprint stays
 // in a reachable open arena cell for consistent hit detection.
 const orbit=Math.atan2(dx,dz)+Math.sin(data.clock*.72+data.orbit)*1.03;
 const speed=e.speed*(d>10?1.22:d<5?-.48:.42)*(e.wyrdfluxTwin?1.28:1);
 // UFOs fly over walls rather than being treated as grounded pathfinders.
 e.x=clamp(e.x+Math.sin(orbit)*speed*dt,1.5,N-1.5);
 e.z=clamp(e.z+Math.cos(orbit)*speed*dt,1.5,N-1.5);
 if(e.attackT<=0&&d<27){
  wyrdfluxDiscVolley(e);e.attackT=e.type==='traveler'?4.5:5.2;
 }
}
function drawWyrdfluxSaucer(m,e,q){
 const boss=e.type==='traveler',r=boss?2.25:1.12;
 const y=e.saucer.hover+.13*Math.sin(time*1.55+e.id),
  spin=time*(boss?.5:.9),segments=q==='battery'?12:20;
 const accent=e.wyrdfluxRareBoss?'orange':e.wyrdfluxTwin?'green':boss?'pink':'cyan';
 // Original concentric rings built from local triangles/beams; no external IP.
 m.box(e.x,y-.13,e.z,r*.76,.20,r*.76,'dark',.25,spin);
 m.box(e.x,y+.20,e.z,r*.37,.31,r*.37,'metal2',.34,spin);
 m.box(e.x,y+.43,e.z,r*.23,.10,r*.23,'purple',1.1,spin);
 for(let i=0;i<segments;i++){
  const a=spin+i*TAU/segments,b=spin+(i+1)*TAU/segments;
  m.beam(e.x+Math.cos(a)*r,y,e.z+Math.sin(a)*r,
   e.x+Math.cos(b)*r,y,e.z+Math.sin(b)*r,.105,'chrome',.3);
  if(i%2===0)m.box(e.x+Math.cos(a)*r*.87,y+.11,
   e.z+Math.sin(a)*r*.87,.08,.07,.08,i%4===0?'white':accent,1.2);
 }
 // Visible shell encloses the boss and fades only after its separate shield HP
 // has been exhausted. A wireframe sphere communicates the target hit volume.
 if(boss&&e.travelerShield>0){
  const pulse=.8+.18*Math.sin(time*4+e.id),sr=r+0.47;
  for(const lat of [-.65,0,.65]){
   const ringR=sr*Math.sqrt(1-(lat/1.45)**2);
   for(let i=0;i<segments;i++){
    const a=TAU*i/segments,b=TAU*(i+1)/segments;
    m.beam(e.x+Math.cos(a)*ringR,y+lat,e.z+Math.sin(a)*ringR,
     e.x+Math.cos(b)*ringR,y+lat,e.z+Math.sin(b)*ringR,
     .024,'cyan',.36*pulse+e.saucer.shieldBurst*.7);
   }
  }
  for(let i=0;i<8;i++){
   const a=TAU*i/8+spin*.27;
   m.beam(e.x+Math.cos(a)*sr,y-1.2,e.z+Math.sin(a)*sr,
    e.x+Math.cos(a)*sr,y+1.2,e.z+Math.sin(a)*sr,
    .022,'blue',.28*pulse);
  }
 }
}

// WYRDFLUX v0616: the regular STALKER is now a readable rocket rusher.
// Charge starts with a 0.75 s warning, and freezes an attack bearing;
// the slide never teleports through walls or homing-corrects after launch.
let basicThrusterStarts=0,basicThrusterHits=0,basicThrusterWallStops=0;
function bossLaserVisibleDistance(e,angle,maxDistance=23){
 const vx=Math.sin(angle),vz=-Math.cos(angle);
 for(let d=.30;d<=maxDistance;d+=.10){
   if(tile(e.x+vx*d,e.z+vz*d))return Math.max(.15,d-.10);
 }
 return maxDistance;
}
function tickBasicThrusterRush(e,dt,dx,dz,dist){
 if(e.type!=='stalker'||e.hellVariant||e.blockKind||isBoss(e))return false;
 const phase=e.thrusterPhase||'idle';
 if(e.stunUntil>time){
  e.thrusterPhase='idle';e.thrusterCooldown=Math.max(e.thrusterCooldown||0,1.0);return true;
 }
 if(phase!=='idle'){
  e.thrusterClock=Math.max(0,(e.thrusterClock||0)-dt);
  e.moveSpeed=0;
  if(phase==='windup'){
   enemyTurnToward(e,dx,dz,dt,5);
   e.weakOpenUntil=Math.max(e.weakOpenUntil||0,time+.15);
   if(e.thrusterClock<=0){e.thrusterPhase='slide';e.thrusterClock=.47;sound('thrusterboost');}
   return true;
  }
  if(phase==='slide'){
   const x=e.x,z=e.z,speed=11.2;
   collisionMove(e,e.thrusterDX*speed*dt,e.thrusterDZ*speed*dt,enemyCollisionRadius(e));
   const moved=Math.hypot(e.x-x,e.z-z);
   e.moveSpeed=moved/Math.max(.001,dt);
   e.bob+=moved*7.2;
   if(!e.thrusterHit&&Math.hypot(e.x-player.x,e.z-player.z)<1.45&&
     lineClear(e.x,e.z,player.x,player.z)){
    e.thrusterHit=true;
    if(player.dashT<=.12){
     hitPlayer(13);
     player.knockbackT=.34;player.knockbackX=e.thrusterDX*5.4;
     player.knockbackZ=e.thrusterDZ*5.4;
     basicThrusterHits++;
     shake=Math.max(shake,.14);
     collisionMove(e,-e.thrusterDX*.64,-e.thrusterDZ*.64,enemyCollisionRadius(e));
    }
    e.thrusterClock=0;
   }
   if(moved<speed*dt*.20){
    e.thrusterClock=0;basicThrusterWallStops++;
   }
   if(e.thrusterClock<=0){
    e.thrusterPhase='recover';e.thrusterClock=.70;
   }
   return true;
  }
  if(phase==='recover'){
   if(e.thrusterClock<=0){
    if((e.thrusterChainRemaining||0)>0&&
        Math.hypot(player.x-e.x,player.z-e.z)>2.1&&
        lineClear(e.x,e.z,player.x,player.z)){
       e.thrusterChainRemaining--;e.thrusterPhase='windup';
       e.thrusterClock=.36;
       const dd=Math.max(.1,Math.hypot(player.x-e.x,player.z-e.z));
       e.thrusterDX=(player.x-e.x)/dd;e.thrusterDZ=(player.z-e.z)/dd;
       e.thrusterHit=false;basicThrusterStarts++;
      }else{
       e.thrusterPhase='idle';e.thrusterCooldown=5.2+(e.id%4)*.52;
       e.attackT=Math.max(e.attackT,1.0);
      }
   }
   return true;
  }
 }
 e.thrusterCooldown=(e.thrusterCooldown??(1.9+(e.id%5)*.55))-dt;
 if(e.thrusterCooldown<=0&&e.meleeStage==='seek'&&dist>3.7&&dist<11.5&&
    lineClear(e.x,e.z,player.x,player.z)){
   const size=Math.max(.1,dist);
   e.thrusterPhase='windup';e.thrusterClock=.75;
   e.thrusterDX=dx/size;e.thrusterDZ=dz/size;
   e.thrusterHit=false;e.moveSpeed=0;
   e.thrusterChainRemaining=rnd()<.28?1:0;
   e.facing=Math.atan2(-e.thrusterDX,-e.thrusterDZ);
   basicThrusterStarts++;return true;
 }
 return false;
}
function drawBasicThrusterRushFX(m,e,quality){
 if(e.type!=='stalker'||e.hellVariant||e.blockKind)return;
 const stage=e.thrusterPhase||'idle';
 const active=stage==='windup'||stage==='slide';
 if(!active)return;
 const s=enemyPoseMesh(m,e),x=e.x,z=e.z,high=quality==='high';
 const pulse=stage==='windup'?.32+.35*Math.sin(time*18+e.id)**2:.92;
 // Two back-mounted asymmetric thrusters, compact flame tails, not blobs.
 for(const side of [-1,1]){
  s.box(x+side*.25,1.41,z+.31,.16,.32,.29,'titanium',.12);
  s.box(x+side*.25,1.40,z+.49,.105,.12,.07,'magma',pulse);
  s.beam(x+side*.25,1.39,z+.49,x+side*.25,1.41,z+.56+(stage==='slide'?.55:.15),
   .045,stage==='slide'?'orange':'rust',pulse);
  // Both forearms reach OUT IN FRONT during the slide.
  if(stage==='slide'||high){
   s.beam(x+side*.40,1.48,z-.16,x+side*.43,1.48,z-.56,
    .09,'metal',.06);
   s.box(x+side*.43,1.48,z-.70,.23,.16,.29,'rim',.12);
  }
 }
 if(quality!=='battery'&&stage==='slide'){
  m.beam(x,.05,z,x-e.thrusterDX*.85,.05,z-e.thrusterDZ*.85,.055,'ash',.10);
 }
}

function enemyTick(e,dt){
 if(e.hp<=0)return;
 if((e.appearT||0)>0){e.appearT=Math.max(0,e.appearT-dt);return;}
 tickWyrdfluxRareBoss(e,dt);
 if(e.wardenMite){tickWardenMite(e,dt);return;}
 if(e.type==='warden'&&tickWardenRite(e,dt))return;
 if(e.type==='puppet'){puppetTick(e,dt);return;}
 if(e.saucer){tickWyrdfluxSaucer(e,dt);return;}
 if(e.type==='wallmaw'){wallMawTick(e,dt);return;}
 if(e.type==='ophanim'){ophanimTick(e,dt);return;}
 if(e.blockKind){blockworldEnemyTick(e,dt);return;}
 e.hit=Math.max(0,e.hit-dt);e.attackT-=dt;
 e.flinchVel=(e.flinchVel||0)-((e.flinch||0)*30+(e.flinchVel||0)*10)*dt;
 e.flinch=clamp((e.flinch||0)+e.flinchVel*dt,-.19,.23);
 e.weightShift+=(clamp((e.moveSpeed||0)/5,0,1)-(e.weightShift||0))*Math.min(1,dt*7);
 e.intentClock=(e.intentClock||0)-dt;
 if(e.burnUntil>time&&time>=(e.burnTick||0)){
  e.burnTick=time+.52;damageEnemy(e,3+stacks('kindle')*2,'burn',1);if(e.hp<=0)return;
 }
 e.pathT-=dt;
 const dx=player.x-e.x,dz=player.z-e.z,dist=Math.hypot(dx,dz);
 if(hellEnemyInstinct(e,dt,dx,dz,dist))return;
 if(tickBasicThrusterRush(e,dt,dx,dz,dist))return;
 if(e.intentClock<=0)chooseEnemyIntent(e,dist,lineClear(e.x,e.z,player.x,player.z));
 bossSignatureTick(e,dt,dx,dz,dist);
 bossUltimateTick(e,dt,dx,dz,dist);
 if(e.stunUntil>time&&!isBoss(e))return;
 if(dist<.01)return;
 const ranged=RANGED_TYPES.has(e.type);
 const bossLocked=e.ultimateStage==='charge'||e.ultimateStage==='fire';
 if(ranged&&e.rangedStage==='charge'){
  enemyTurnToward(e,dx,dz,dt,3.1);e.rangedT-=dt;e.moveSpeed=0;
  if(e.rangedT<=0){
   e.rangedStage='fire';e.rangedT=.55;fireChargedShot(e); // 0.55s exposed recovery
   const rates={drone:1.5,artillery:2.15,sniper:2.35,warden:1.45,behemoth:2.3,overseer:1.65,colossus:1.9};
   e.attackT=rates[e.type]||1.6;
  }
  return;
 }
 if(ranged&&e.rangedStage==='fire'){
  e.rangedT-=dt;if(e.rangedT<=0)e.rangedStage='idle';
  e.moveSpeed=0;return;
 }
 if(MELEE_TYPES.has(e.type)&&tickMelee(e,dt,dx,dz,dist))return;
 if(e.type==='drone')e.bob+=dt*4.3;
 const preferred=(MOTION_STYLE[e.type]||MOTION_STYLE.sentinel)[0];
 const steering=steerEnemy(e,dx,dz,dist);
 let mx=steering.x,mz=steering.z;
 if(e.pathT<=0){
  e.pathT=.55+rnd()*.25;
  e.route=!lineClear(e.x,e.z,player.x,player.z)?findRoute(e.x,e.z,player.x,player.z,enemyCollisionRadius(e)):null;
 }
 if(e.route){
  const rx=e.route.x-e.x,rz=e.route.z-e.z,rd=Math.hypot(rx,rz);
  if(rd>.12){mx=rx/rd;mz=rz/rd;}else e.pathT=0;
 }
 e.moveSpeed=0;
 if(dist<35&&!bossLocked&&(dist>preferred||['orbit','flank','withdraw','seek'].includes(e.intent))){
  const move=e.speed*dt*(wave>5?1.2:1)*(e.slowUntil>time?.48:1);
  const ox=e.x,oz=e.z;
  const radius=enemyCollisionRadius(e);
   collisionMove(e,mx*move,mz*move,radius);
  if(Math.hypot(e.x-ox,e.z-oz)<.004){
   e.pathT=0;e.wander+=e.sidestep*dt*1.7;
   collisionMove(e,Math.cos(e.wander)*move*.9,Math.sin(e.wander)*move*.9,radius);
  }
  const vx=e.x-ox,vz=e.z-oz;
  e.moveSpeed=Math.hypot(vx,vz)/Math.max(dt,.001);
  if(e.hellVariant&&e.moveSpeed>.24&&hellBreach.state==='active'){
   e.hellStepClock=(e.hellStepClock??.25)-dt;
   if(e.hellStepClock<=0){
    const sx=e.x+Math.sin(e.facing||0)*.12,sz=e.z+Math.cos(e.facing||0)*.12;
    hellFootprints.push({x:sx,z:sz,life:5,max:5,
     size:e.hellVariant==='archfiend'?.35:
       e.hellVariant==='horned'?.25:.13,
     color:e.hellVariant==='shade'?'black':'rust'});
    if(hellFootprints.length>72)hellFootprints.splice(0,hellFootprints.length-72);
    e.hellStepClock=e.hellVariant==='shade'?.21:
     e.hellVariant==='archfiend'?.55:.33;
   }
  }
  if(e.moveSpeed>.07){
   const aiming=ranged||e.intent==='orbit'||e.intent==='flank';
   enemyTurnToward(e,aiming?dx:vx,aiming?dz:vz,dt,e.turnRate);
   if(!ranged)e.bob+=e.hellVariant?
     Math.hypot(vx,vz)*organicStrideRadiansPerMetre(e):
     dt*(4.8+e.moveSpeed*2.1);
  }
 }else if(ranged||bossLocked)enemyTurnToward(e,dx,dz,dt,bossLocked?2.5:4.2);
 if(e.type==='overseer'&&e.hp>0&&phase==='play'){
  e.summonClock-=dt;
  if(e.summonClock<=0&&enemies.length<28){
   e.summonClock=6.5;
   for(const side of [-1,1]){
    const sx=e.x+side*1.6,sz=e.z+1.4;
    if(free(sx,sz,.3)){
     const escort=newEnemy({x:sx,z:sz},false);escort.type='drone';escort.speed=ENEMY_STATS.drone[1];
     escort.maxHp=escort.hp=Math.max(20,ENEMY_STATS.drone[0]*(1+localWaveOf(wave)*.07)*cycleDifficulty(wave).hp);enemies.push(escort);
    }
   }
   burst(e.x,e.z,'purple',2);
  }
 }
 if(bossLocked)return;
 const range=ranged?(e.type==='artillery'||e.type==='sniper'?13:e.type==='overseer'?12:10):2.5;
 if(e.attackT<=0&&dist<range&&lineClear(e.x,e.z,player.x,player.z)){
  if(ranged){
   e.rangedStage='charge';
   e.rangedT=e.hellVariant==='archfiend'?1.45:e.type==='sniper'?1.28:e.type==='artillery'?.87:e.type==='colossus'?1.30:
    e.type==='behemoth'?1.07:e.type==='warden'?.87:e.type==='overseer'?.85:.58;
   // Late-wave volleys remain dodgeable: at least .70s of visible warning.
    e.rangedT=Math.max(.70,e.rangedT*(cycleOf(wave)>1?.94:1));
    e.rangedTotal=e.rangedT;e.rangedAim=Math.atan2(dx,-dz);
  }else{
   e.meleeStage='windup';
   e.meleeT=e.hellVariant==='imp'?.38:e.hellVariant==='pinky'?.61:e.hellVariant==='hellknight'?.87:e.hellVariant==='horned'?.96:e.type==='bulwark'||e.type==='crusher'?.72:e.type==='skitter'?.25:e.type==='stalker'?.32:.49;
   e.meleeTotal=e.meleeT;e.meleeAimed=Math.atan2(-dx,-dz);e.meleeHit=false;
  }
 }
}

let hellTremorClock=10.7,hellTremorLife=0,hellTremorCount=0;
function updateHellSeismic(dt){
 if(hellBreach.state!=='active'){
  hellTremorLife=0;hellTremorClock=10.7;return;
 }
 hellTremorClock-=dt;
 if(hellTremorClock<=0){
  hellTremorClock=12.8+3.3*Math.sin(hellTremorCount*2.64)**2;
  hellTremorLife=1.22;hellTremorCount++;
  if(audioUnlocked&&!muted&&ctxAudio?.state==='running'){
   const t=ctxAudio.currentTime;
   audioTone(42,t,.72,.13,'sawtooth',fxBus,27);
   audioNoise(t,.22,.06,240,'lowpass',fxBus);
  }
 }
 hellTremorLife=Math.max(0,hellTremorLife-dt);
}
function tick(dt){if(phase!=='play'||bossCine.active)return;time+=dt;
 tickWyrdfluxPlayerProjectiles(dt);
 if(puppetFinale.active){tickPuppetFinale(dt);return;}
 updateWyrdfluxDamageVignette(dt);updateHellSeismic(dt);updateWeaponMotion(dt);tickWyrdfluxAnomaly(dt);
 if(circusHitDistortion>0){
  circusHitDistortion=Math.max(0,circusHitDistortion-dt);
  if(circusHitDistortion===0)document.body.classList.remove('wyrdflux-circus-hit');
 }player.dashCool=Math.max(0,player.dashCool-dt);player.dashT=Math.max(0,player.dashT-dt);player.rageActive=0;player.rage=0;player.frenzyT=Math.max(0,player.frenzyT-dt);player.recoil=Math.max(0,player.recoil-dt*3.1);coolWyrdfluxThermals(dt);player.muzzleT=Math.max(0,(player.muzzleT||0)-dt);player.impactGlow=Math.max(0,player.impactGlow-dt);if(false&&stacks('pulse')){player.pulseClock-=dt;if(player.pulseClock<=0){player.pulseClock=Math.max(.40,2.15-stacks('pulse')*.32-stacks('shockfield')*.17-stacks('overload')*.09);blastAt(player.x,player.z,12+stacks('pulse')*16,2.45,0,'shock')}}if(player.hp>0&&player.hp<player.maxHp&&permanentStats().regen>0)player.hp=Math.min(player.maxHp,player.hp+permanentStats().regen*dt);if(time-player.lastHit>6.0)player.shield=clamp(player.shield+dt*(coreOnline?3.8:2.2)*player.regenMult,0,player.maxShield);
 if(stacks('livingroots')&&time-player.lastHit>3&&player.hp<player.maxHp)
  player.hp=Math.min(player.maxHp,player.hp+dt*4.5);

 const k=inputs.keys;let forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))-inputs.moveZ;
 let strafe=Number(k.has('d'))-Number(k.has('a'))+inputs.moveX;
 const length=Math.hypot(forward,strafe),isMoving=length>.08;
 const sprint=wyrdfluxSprintAllowed(isMoving,k.has('shift'));
 forward/=Math.max(1,length);strafe/=Math.max(1,length);
 const fx=Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=-fz,rz=fx;
 const baseSpeed=3.05*player.moveMult*(sprint?1.55:1)*(inputs.focus?.68:1); // v0616 +7% ordinary movement; dash unchanged
 let targetX=(fx*forward+rx*strafe)*baseSpeed,targetZ=(fz*forward+rz*strafe)*baseSpeed;
 // Thruster enemies throw the player backward, retaining normal wall collision.
 // Smoothly decay impulse rather than teleport the camera or breaking dash.
 if((player.knockbackT||0)>0&&player.dashT<=0){
  const fade=Math.min(1,player.knockbackT/.34);
  targetX+=(player.knockbackX||0)*fade;
  targetZ+=(player.knockbackZ||0)*fade;
  player.knockbackT=Math.max(0,player.knockbackT-dt);
 }
 if(player.dashT>0){targetX=player.dashDirX*2.35*player.moveMult*3.75;targetZ=player.dashDirZ*2.35*player.moveMult*3.75}
 const response=clamp(dt*(player.dashT>0?26:isMoving?11:16),0,1);
 player.vx=mix(player.vx,targetX,response);player.vz=mix(player.vz,targetZ,response);
 const ox=player.x,oz=player.z;
 collisionMove(player,player.vx*dt,player.vz*dt);
 const moved=Math.hypot(player.x-ox,player.z-oz);
 if(moved<.002&&Math.hypot(player.vx,player.vz)>.4){player.vx*=.35;player.vz*=.35}
 if(moved>.0005&&player.height<=.015){
  player.bob+=moved*5.0*(player.dashT>0?1.5:1);
  player.stepFx+=moved;
  if(player.stepFx>.65){player.stepFx=0;if($('quality').value!=='battery'&&rnd()<.6)spark(player.x,player.z,'mist',2)}
 }
 player.lean=mix(player.lean,strafe*.075+(player.dashT>0?.05:0),clamp(dt*10,0,1));
 player.fovKick=mix(player.fovKick,player.dashT>0?.17:sprint?.085:0,clamp(dt*7,0,1));
 player.landKick=Math.max(0,player.landKick-dt*2.9);

 player.energy=clamp(player.energy+(sprint?-26:player.dashT>0?0:22)*dt,0,100);
 if(player.energy<5){wyrdfluxSprint.exhausted=true;wyrdfluxSprint.latched=false;}
 if(wyrdfluxSprint.exhausted&&player.energy>50)wyrdfluxSprint.exhausted=false;
 if(player.height>0||player.verticalVel>0){player.height+=player.verticalVel*dt;player.verticalVel-=17.5*dt;if(player.height<0){const hardLanding=player.verticalVel< -5;if(hardLanding){player.landKick=Math.min(.12,Math.abs(player.verticalVel)*.013);shake=Math.max(shake,.045);spark(player.x,player.z,'mist',8)}if(stacks('leap')>0&&player.verticalVel< -4){blastAt(player.x,player.z,12+stacks('leap')*10,1.4+stacks('leap')*.2,0,'shock')}player.height=0;player.verticalVel=0}}
 if(k.has('arrowleft'))player.yaw-=dt*1.7;if(k.has('arrowright'))player.yaw+=dt*1.7;
 tickWyrdfluxShadowReplay(dt);
 if(livingRealm.active){
  if(livingRealm.id==='blackwake'){
   tickBlackwakeKraken(dt);
   if(!document.body.classList.contains('armory-open')&&(inputs.shoot||(k.has('f')&&!stacks('hellflash'))))shoot();
  }
  tryInteract(dt);updateLivingRealmInstructions();
  runLevel.comboUntil+=dt;waveStartedAt+=dt;
  updateHUD(false);return;
 }
 if(circus.state==='active'){
  if(!document.body.classList.contains('armory-open')&&
   (inputs.shoot||(k.has('f')&&!stacks('hellflash'))))shoot();
  tryInteract(dt);tickCircus(dt);
  updateHUD(false);return;
 }
 if(!document.body.classList.contains('armory-open')&&(inputs.shoot||(k.has('f')&&!stacks('hellflash'))))shoot();tryInteract(dt);
 saveTimer+=dt;if(saveTimer>=18){saveTimer=0;saveCheckpoint()};
 if(spawnPending>0){spawnClock-=dt;if(spawnClock<=0){spawnEnemy();spawnPending--;spawnClock=Math.max(.65,1.25-localWaveOf(wave)*.04)+(framePacing.averageMs>24?.08:0)}}
 for(const e of [...enemies])enemyTick(e,dt);
  updateHeat(dt);
 if(stacks('teslabeacon')&&phase==='play'){
  player.beaconClock=(player.beaconClock||0)-dt;
  if(player.beaconClock<=0){
   player.beaconClock=Math.max(1.65,4.1-stacks('teslabeacon')*.8);
   const target=enemies.find(e=>e.hp>0&&Math.hypot(e.x-player.x,e.z-player.z)<9);
   if(target){tracers.push({x1:player.x,y1:1.4,z1:player.z,x2:target.x,y2:1.4,z2:target.z,
    life:.85,max:.85,col:'cyan',accent:'white',kind:'arc',phase:rnd()*TAU});
    damageEnemy(target,13+stacks('teslabeacon')*12,'arc');chainFrom(target,10+stacks('teslabeacon')*4,1);}
  }
 }
 for(const p of [...projectiles]){
   p.life-=dt;
   if(p.ufoShot&&!p.redirected){
    p.redirectDelay-=dt;
    if(p.redirectDelay<=0){
     // One single synchronized retarget to the player's SNAPSHOT position.
     const tx=player.x,tz=player.z,ty=1.64+player.height;
     const dx=tx-p.x,dz=tz-p.z,dy=ty-p.y;
     const d=Math.max(.1,Math.hypot(dx,dy,dz)),v=10.4;
     p.vx=dx/d*v;p.vz=dz/d*v;p.vy=dy/d*v;
     p.redirected=true;p.targetX=tx;p.targetZ=tz;p.targetY=ty;
    }
   }
   p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=(p.vy||0)*dt;
   if(p.life<=0||(tile(p.x,p.z)&&(!p.ufoShot||p.y<2.95))){
    spark(p.x,p.z,p.col,4);projectiles=projectiles.filter(o=>o!==p);continue;
   }
   const heightOK=!p.ufoShot||Math.abs(p.y-(1.64+player.height))<.68;
   if(heightOK&&Math.hypot(p.x-player.x,p.z-player.z)<.36){
    hitPlayer(p.damage);spark(p.x,p.z,p.col,8);
    projectiles=projectiles.filter(o=>o!==p);
   }
  }
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*7;p.life-=dt}particles=particles.filter(p=>p.life>0);
 for(const b of tracers)b.life-=dt;tracers=tracers.filter(b=>b.life>0);
  for(const fx of wyrdfluxContactFX){fx.delay-=dt;if(fx.delay<=0)fx.life-=dt;}
  wyrdfluxContactFX=wyrdfluxContactFX.filter(fx=>fx.life>0);
 for(const b of lingeringBeams)b.life-=dt;
 lingeringBeams=lingeringBeams.filter(b=>b.life>0);
 for(const v of impactFlashes)v.life-=dt;impactFlashes=impactFlashes.filter(v=>v.life>0);
 for(const print of hellFootprints)print.life-=dt;
 hellFootprints=hellFootprints.filter(p=>p.life>0);
 for(const mark of impactScars)mark.life-=dt;
 impactScars.splice(0,impactScars.length,...impactScars.filter(mark=>mark.life>0));
 for(const jet of impactJets){jet.life-=dt;jet.x+=jet.vx*dt;jet.y+=jet.vy*dt;jet.z+=jet.vz*dt;jet.vy-=dt*9;}
 for(let i=impactJets.length-1;i>=0;i--)if(impactJets[i].life<=0)impactJets.splice(i,1);
 for(const ghost of deathGhosts)ghost.life-=dt;
 for(let i=deathGhosts.length-1;i>=0;i--)if(deathGhosts[i].life<=0)deathGhosts.splice(i,1);
 for(const d of debris){
  d.life-=dt;d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;d.vy-=dt*10.8;
  if(d.y<d.size*.55){d.y=d.size*.55;d.vy=Math.abs(d.vy)*.21;d.vx*=.82;d.vz*=.82}
 }
 debris=debris.filter(d=>d.life>0);for(const r of burstRings)r.life-=dt;burstRings=burstRings.filter(r=>r.life>0);for(const t of combatTexts){t.life-=dt;t.y+=dt*t.vy;if(t.life<=0)t.el?.remove()}combatTexts=combatTexts.filter(t=>t.life>0);
 for(const p of [...pickups]){p.life-=dt;if(Math.hypot(p.x-player.x,p.z-player.z)<.68*(1+permanentStats().pickup)){if(p.type==='health'){player.hp=Math.min(player.maxHp,player.hp+32+stacks('scav')*4);notice('FIELD MEDKIT +32',1.4)}else{player.shield=Math.min(player.maxShield,player.shield+28+stacks('scav')*4);notice('SHIELD CELL +28',1.4)}pickups=pickups.filter(o=>o!==p);sound('pickup')}else if(p.life<=0)pickups=pickups.filter(o=>o!==p)}
 if(blockworld.state==='shift'){
  blockworld.transition=Math.max(0,blockworld.transition-dt);
  if(blockworld.transition===0){
   wyrdfluxBeginRealmLoad('blockworld',()=>beginBlockworld(),'BLOCKWORLD BREACH');
   return;
  }
 }
 // Level choices stay banked until the end-of-round reward sequence.
 if(spawnPending===0&&enemies.length===0&&wave>0&&!puppetFinale.active){
  if(blockworld.state==='active'){
   if(blockworld.stage<3)beginBlockworldStage(blockworld.stage+1);
   else finishBlockworld();
   return;
  }
  if(blockworld.state==='trigger'||blockworld.state==='shift'){/* Wait for safe Creeper gateway. */}
  else if(hellBreach.state==='pending'){openHellGate();}
  else if(hellBreach.state==='active'){advanceHellStage();return;}
  else if(heavenSanctum.state==='gate'||heavenSanctum.state==='active'){/* Wait for the player to enter or claim the altar. */}
  else if(hellBreach.state==='none'){waveComplete();return;}
 }
 if(time>toastUntil)$('toast').classList.add('hidden');if(time>announcedUntil)$('waveAnnounce').classList.add('hidden');$('damage').style.opacity=String(clamp((damageUntil-time)*1.9,0,.42));shake*=.87;$('hitflash').style.opacity=String(clamp(player.impactGlow*3.4,0,.85));updateHUD(false);refreshRunLevelHud()
}


function enemyArmorSkin(m,e){
 const boss=isBoss(e),crusher=e.type==='crusher'||e.type==='bulwark',drone=e.type==='drone',s=boss?(e.type==='colossus'?2.55:e.type==='behemoth'?2.30:e.type==='overseer'?2.08:1.85):crusher?1.25:1;
 const quality=$('quality').value,dist=Math.hypot(e.x-player.x,e.z-player.z);
 if((quality==='battery'&&dist>10)||(quality==='balanced'&&dist>18)||dist>26)return;
 const bx=e.x,bz=e.z,phase=e.bob,hit=e.hit>0;
 const plate=hit?'white':boss?'metal2':crusher?'rim':e.type==='stalker'?'dark':'metal';
 const trim=e.type==='colossus'?'red':e.type==='behemoth'?'gold':e.type==='overseer'?'green':boss?'purple':e.type==='bulwark'?'blue':e.type==='sniper'?'pink':e.type==='leech'?'green':e.type==='artillery'?'gold':drone?'orange':e.type==='stalker'||e.type==='skitter'?'red':'cyan';
 const worn=e.hp/e.maxHp<.55?'rust':'metal2',high=quality==='high'&&dist<12,near=dist<10;
 if(drone){
  const fly=1.65+Math.sin(phase)*.17;
  // Rotating surveillance camera, bolted shell panels, and service underside.
  m.box(bx,fly+.27,bz,.53,.055,.41,plate,.09);
  m.box(bx,fly+.315,bz-.08,.18,.028,.19,trim,.65);
  m.box(bx,fly-.22,bz,.38,.075,.37,worn,0);
  for(const side of [-1,1]){
   m.box(bx+side*.25,fly+.18,bz-.04,.085,.05,.34,'brass');
   m.box(bx+side*.58,fly+.03,bz,.26,.045,.255,plate);
   m.box(bx+side*.58,fly-.09,bz,.16,.045,.18,'dark');
   if(high)m.box(bx+side*.6,fly+.08,bz-.115,.13,.03,.065,trim,.52);
  }
  m.box(bx,fly,bz-.34,.15,.12,.08,hit?'white':trim,2.2);
  if(high)for(let i=0;i<3;i++)m.box(bx+(i-1)*.16,fly+.128,bz+.22,.045,.03,.07,'rim');
  return;
 }
 // Floating segmented armored fascia over skeletal gait rig. Nearer enemies expose
 // vents, rivets, capacitors and changing wear without loading external textures.
 const y=Math.sin(phase)*.022;
 const chestY=y+1.21*s, front=bz-.282*s,shoulderY=y+1.51*s,faceY=y+1.78*s;
 m.box(bx,chestY+.135*s,front,.49*s,.23*s,.066*s,plate,.11);
 m.box(bx,chestY-.135*s,front,.42*s,.16*s,.069*s,worn);
 m.box(bx,faceY-.03*s,bz-.283*s,.37*s,.12*s,.063*s,hit?'white':trim,1.9+(e.attackT<.4?.95:0));
 for(const side of [-1,1]){
  const sx=bx+side*.18*s,ax=bx+side*(boss?.7:.43)*s;
  m.box(sx,chestY+.012*s,front-.044*s,.19*s,.46*s,.035*s,plate,.03);
  m.box(sx,chestY+.21*s,front-.069*s,.17*s,.025*s,.051*s,'rim');
  m.box(ax,shoulderY+.09*s,bz-.115*s,(boss?.45:.27)*s,.12*s,.43*s,plate);
  m.box(ax,shoulderY+.155*s,bz-.13*s,.08*s,.025*s,.31*s,'brass');
  if(near){
   const stride=Math.sin(phase+side*1.57);
   const lift=Math.max(0,stride)*.085*s;
   m.box(bx+side*.18*s+stride*.1*s,y+.51*s+lift,bz-.205*s,.19*s,.20*s,.075*s,plate);
   m.box(bx+side*.18*s-stride*.08*s,y+.28*s+lift,bz-.205*s,.145*s,.30*s,.055*s,worn);
   m.box(ax+side*.04*s,y+.97*s-stride*.15*s,bz-.24*s,.155*s,.18*s,.05*s,plate);
   m.box(ax+side*.04*s,y+1.02*s-stride*.15*s,bz-.277*s,.09*s,.025*s,.06*s,trim,.42);
  }
 }
 m.box(bx,chestY+.02*s,front-.07*s,.083*s,.35*s,.048*s,trim,hit?2.6:.45);
 m.box(bx,faceY+.17*s,bz-.09*s,.25*s,.065*s,.24*s,plate);
 // Subtle readable class markings and damage, highest detail only up close.
 if(high){
  for(let i=0;i<3;i++){
   m.box(bx+(i-1)*.11*s,chestY-.04*s,front-.082*s,.048*s,.055*s,.035*s,i===1?trim:'brass',i===1?.8:0);
   m.box(bx+(i-1)*.125*s,faceY-.135*s,bz-.272*s,.046*s,.037*s,.042*s,'black');
  }
  for(const side of [-1,1]){
   const x=bx+side*.28*s;
   m.box(x,y+1.06*s,bz+.218*s,.063*s,.24*s,.045*s,worn);
   m.box(x,y+1.34*s,bz+.234*s,.072*s,.16*s,.048*s,'brass');
  }
 }
 if(boss){
  const pulse=.75+.25*Math.sin(phase*1.8);
  for(const side of [-1,1]){
   m.box(bx+side*.43*s,y+1.5*s,bz-.33*s,.21*s,.56*s,.075*s,plate);
   m.box(bx+side*.43*s,y+1.77*s,bz-.36*s,.16*s,.05*s,.088*s,trim,pulse*2);
  }
  if(near){for(let i=0;i<5;i++){const xx=bx+(i-2)*.16*s;
   m.box(xx,y+1.84*s,bz+.245*s,.095*s,.16*s,.08*s,i%2?'brass':plate);
  }}
 }
}

function drawBossUltimate(m,e,cam,quality){
 const stage=e.ultimateStage;
 if(!isBoss(e)||(stage!=='charge'&&stage!=='fire'))return;
 const originY=e.type==='colossus'?4.2:e.type==='behemoth'?3.8:3.1;
 const x=e.x,z=e.z,col=e.type==='colossus'?'red':e.type==='behemoth'?'gold':e.type==='overseer'?'green':'pink';
 const warn=e.type==='colossus'?1.8:1.45;
 const duration=e.type==='colossus'?2.3:e.type==='behemoth'?1.9:1.65;
 const charge=stage==='charge';
 const phase=charge?clamp(1-e.ultimateT/warn,0,1):clamp(1-e.ultimateT/duration,0,1);
 const a=charge?e.ultimateAngle-e.ultimateSweep:e.ultimateAngle+(phase*2-1)*e.ultimateSweep;
 const dx=Math.sin(a),dz=-Math.cos(a),range=bossLaserVisibleDistance(e,a),
  x2=x+dx*range,z2=z+dz*range;
 if(charge){
  const line=HEX[col].map(v=>v*(.15+.52*phase));
  m.ribbon(x,.06,z,x2,.06,z2,.065+phase*.11,line,.75+phase,cam);
  const radius=.35+phase*1.15;
  for(let i=0;i<12;i++){
   const t=i*TAU/12,u=(i+1)*TAU/12;
   m.beam(x+Math.cos(t)*radius,originY+Math.sin(time*5)*.07,z+Math.sin(t)*radius,
    x+Math.cos(u)*radius,originY+Math.sin(time*5)*.07,z+Math.sin(u)*radius,.05,col,1.7+phase*2);
  }
  m.box(x,originY,z,.40+phase*.58,.40+phase*.58,.40+phase*.58,col,1.6+phase*2);
 }else{
  const pulse=.86+.14*Math.sin(time*33);
  // Near-muzzle descent to chest height, then a flat visible collision ray.
  const entry=Math.min(1.8,range),ax=x+dx*entry,az=z+dz*entry;
  m.ribbon(x,originY,z,ax,1.62,az,.48,col,2.0*pulse,cam);
  m.ribbon(ax,1.62,az,x2,1.62,z2,e.type==='colossus'?.90:.67,col,2.3*pulse,cam);
  m.ribbon(ax,1.62,az,x2,1.62,z2,.23,'white',4.4*pulse,cam,.014);
  if(quality!=='battery'){
   m.ribbon(x,.06,z,x2,.06,z2,.18,HEX[col].map(v=>v*.51),.94,cam,.015);
   for(let k=0;k<5;k++){
    const t=(k+.5)/5;
    m.box(x+dx*range*t,1.62,z+dz*range*t,.13,.12,.14,col,1.2+Math.sin(time*12+k)*.6);
   }
  }
  m.box(x,originY,z,.70,.68,.70,'white',3.4);
 }
}

function addMechanicalPolish(m,e,s,near,high){
 const bx=e.x,bz=e.z,boss=isBoss(e),health=e.hp/e.maxHp,osc=Math.sin(e.bob);
 const trim=boss?e.type==='colossus'?'red':e.type==='behemoth'?'orange':e.type==='overseer'?'green':'purple':
  e.type==='sniper'?'pink':e.type==='leech'?'green':e.type==='skitter'?'red':'cyan';
 const sheen=health<.42?'rust':boss?'chrome':'polished';
 // Layered chrome panels with recessed seams and bright beveled edges.
 const y=1.25*s,front=bz-.31*s;
 m.box(bx,y+.20*s,front,.56*s,.13*s,.058*s,sheen,.13);
 m.box(bx,y-.26*s,front,.53*s,.07*s,.052*s,'titanium');
 for(const side of [-1,1]){
  const shoulder=bx+side*(boss?.65:.42)*s;
  const actuator=osc*side*.105*s;
  m.box(shoulder,y+.33*s,bz-.09*s,(boss?.40:.26)*s,.09*s,.43*s,sheen,.13);
  m.box(shoulder,y+.36*s,bz-.11*s,(boss?.19:.14)*s,.015*s,.27*s,'chrome',.20);
  m.box(shoulder+side*.065*s,y-.38*s+actuator,bz-.22*s,.12*s,.22*s,.11*s,'steelblue',.10);
  if(near){
   // Moving hydraulic struts visibly flex during each gait stride.
   const swing=Math.sin(e.bob+side*1.57);
   m.beam(bx+side*.22*s,.82*s,bz+.15*s,bx+side*(.24+swing*.07)*s,.34*s+Math.max(0,swing)*.07*s,bz+.15*s,
     .052*s,'chrome',.12);
   m.box(shoulder,y-.25*s+actuator,bz-.31*s,.075*s,.25*s,.065*s,'chrome',.23);
   m.box(bx+side*.22*s,.39*s,bz-.31*s,.18*s,.14*s,.07*s,sheen,.10);
  }
  if(high){
   m.box(shoulder,y+.40*s,bz-.24*s,.08*s,.025*s,.14*s,trim,1.1);
   m.box(bx+side*.23*s,y+.07*s,front-.043*s,.12*s,.02*s,.02*s,'chrome',.3);
   for(let k=0;k<3;k++)m.box(shoulder,y+(k-1)*.1*s,bz-.29*s,.021*s,.022*s,.02*s,'brass',.21);
  }
 }
 if(near){
  // Sensor iris reacts to the boss ultimate charge, attacks and damage.
  const charge=boss&&e.ultimateStage==='charge';
  const radius=(charge?.19:.12)*s;
  m.box(bx,1.80*s,bz-.31*s,radius,.075*s,.045*s,'black');
  m.box(bx,1.80*s,bz-.345*s,radius*.65,.065*s,.025*s,trim,charge?3.1:1.35);
  if(boss){
   const pulse=.52+.45*Math.sin(time*4.5+e.id);
   m.box(bx,1.27*s,bz-.43*s,.30*s,.24*s,.10*s,'chrome',.23);
   m.box(bx,1.27*s,bz-.50*s,.19*s,.15*s,.04*s,trim,1.2+pulse);
   for(let k=0;k<4;k++){
    const angle=e.bob*.24+k*TAU/4;
    m.box(bx+Math.cos(angle)*.62*s,1.31*s+Math.sin(angle*2)*.05*s,bz+Math.sin(angle)*.56*s,
      .08*s,.11*s,.10*s,k%2?'chrome':'titanium',.26,angle);
   }
  }
 }
}

/**
 * Art-directed hard-surface enemy refinement: triple-layer plated helmets,
 * movable actuators, heated vents, articulated energy cores and damaged armor.
 * Models are procedural geometry, deliberately detail-LOD'd for Android.
 */
function drawRegularEnemyRefinements(m,e,quality,dist){
 if(dist>14||quality==='battery'||isBoss(e))return;
 const x=e.x,z=e.z,stride=Math.sin(e.bob),walk=Math.min(1,(e.moveSpeed||0)/Math.max(.1,e.speed||1));
 if(e.type==='skitter'){
  // Shiny segmented carapace and grounded arched spider-limbs.
  m.box(x,.51,z+.24,.52,.19,.58,'ironblack',.11,e.facing||0);
  m.box(x,.59,z-.31,.39,.22,.36,'rust',.15,e.facing||0);
  for(const side of [-1,1])for(let k=0;k<3;k++){
   const zz=z-.32+k*.36,phase=e.bob+k*2.1+(side>0?Math.PI:0);
   const knee=x+side*(.66+.07*Math.sin(phase)),toe=x+side*(.98+.04*k);
   const offset=Math.sin(phase)*.10*walk;
   m.beam(x+side*.22,.52,zz,knee,.32+Math.abs(offset),zz+.04,.042,'charcoal',.10);
   m.beam(knee,.32+Math.abs(offset),zz+.04,toe,.018+Math.max(0,offset)*.45,zz-.12+offset,
    .025,'chrome',.12);
  }
 }else if(e.type==='stalker'){
  // Dorsal blades articulate when slashing and settle behind the thin head.
  for(let side of [-1,1])for(let i=0;i<3;i++){
   const y=1.65+i*.33,flare=(e.meleeStage==='windup'?.38:.08)+.07*Math.sin(time*3+i);
   m.beam(x+side*.26,y,z+.28,x+side*(.66+i*.16+flare),y+.53,z+.48,
    .055,'rust',.11);
  }
  for(const side of [-1,1])m.box(x+side*.15,1.91,z-.42,.045,.10,.04,'red',.50);
 }else if(e.type==='leech'){
  const mouth=e.meleeStage==='lunge'?.3:0;
  m.box(x,1.48,z-.42,.38,.34,.25,'purple',.22);
  for(let i=0;i<5;i++){
   const a=TAU*i/5+time*.12,xx=x+Math.cos(a)*.22,zz=z+.20+Math.sin(a)*.22;
   m.beam(xx,1.50,zz,xx+Math.cos(a)*(.42+mouth),1.02+Math.sin(time*3+i)*.12,
    zz+Math.sin(a)*(.42+mouth),.031,i%2?'green':'purple',.24);
  }
 }else if(e.type==='sniper'||e.type==='artillery'){
  const charge=e.rangedStage==='charge'?1:0,side=e.id%2?-1:1;
  m.beam(x+side*.27,1.52,z+.22,x+side*.38,2.45+charge*.1,z+.31,
   .08,'titanium',.11);
  m.box(x+side*.38,2.40+charge*.1,z+.31,.18,.23,.19,'chrome',.09);
  m.box(x+side*.38,2.48+charge*.1,z+.12,.11,.09,.09,
   e.type==='sniper'?'cyan':'orange',.55+charge*1.1);
 }
}
function drawEliteArmorDetails(m,e,s,quality,dist){
 const boss=isBoss(e),drone=e.type==='drone',close=dist<8,high=quality==='high'&&dist<13;
 if((quality==='battery'&&dist>8)||(quality==='balanced'&&dist>15)||dist>24)return;
 const bx=e.x,bz=e.z;
 const accent=e.type==='colossus'?'red':e.type==='behemoth'?'orange':e.type==='overseer'?'green':boss?'purple':
  e.type==='sniper'?'pink':e.type==='leech'?'green':e.type==='skitter'?'red':e.type==='artillery'?'warm':e.type==='bulwark'?'blue':'cyan';
 const damage=e.hp/e.maxHp,throb=.62+.38*Math.sin(time*4.7+e.id),stride=Math.sin(e.bob),shimmer=damage<.42?'rust':'chrome';
 if(drone){
  const fly=1.65+Math.sin(e.bob)*.17;
  m.box(bx,fly+.33,bz,.35,.072,.36,'chrome',.15);
  m.box(bx,fly-.19,bz-.11,.43,.065,.23,'polished',.13);
  for(const side of [-1,1]){
   m.box(bx+side*.32,fly+.20,bz,.14,.06,.30,'titanium',.1);
   m.box(bx+side*.59,fly+.125,bz,.16,.055,.19,accent,.46+throb);
   if(close){
    m.beam(bx+side*.32,fly-.12,bz,bx+side*.61,fly-.26,bz-.10,.033,'chrome',.11);
    m.box(bx+side*.62,fly-.20,bz-.22,.11,.055,.21,'black',.12);
   }
  }
  m.box(bx,fly,bz-.40,.23,.12,.055,accent,2.0);
  return;
 }
 const baseY=Math.sin(e.bob)*.022, chest=1.29*s+baseY, face=1.79*s+baseY,front=bz-.36*s;
 // Broad armor chest plates with recessed seams, multi-sided lower buckler.
 m.box(bx,chest+.13*s,front,.64*s,.11*s,.075*s,shimmer,.14);
 m.box(bx,chest-.16*s,front,.58*s,.12*s,.074*s,'titanium',.06);
 m.box(bx,face+.17*s,bz-.14*s,.44*s,.10*s,.30*s,shimmer,.15);
 m.box(bx,face-.09*s,bz-.335*s,.48*s,.055*s,.08*s,accent,1.13+throb*.56);
 m.box(bx,face-.21*s,bz-.265*s,.38*s,.035*s,.06*s,'chrome',.16);
 for(const side of [-1,1]){
  const sx=bx+side*(boss?.63:.42)*s;
  // Progressive three-stage armor sleeve and vented arm guard.
  m.box(sx,chest+.35*s,bz-.09*s,(boss?.47:.30)*s,.085*s,.47*s,shimmer,.12);
  m.box(sx,chest+.42*s,bz-.11*s,(boss?.37:.20)*s,.028*s,.31*s,'chrome',.25);
  m.box(sx,chest+.19*s,bz-.33*s,.17*s,.09*s,.062*s,accent,.84);
  const shift=-stride*side*.12*s;
  m.box(sx+side*.035*s,chest-.36*s+shift,bz-.15*s,.17*s,.30*s,.19*s,'steelblue',.07);
  m.box(sx+side*.038*s,chest-.52*s+shift,bz-.30*s,.22*s,.16*s,.095*s,'chrome',.11);
  // Suspension strut follows the step cycle and is visibly jointed.
  if(close){
   m.beam(sx,chest-.16*s,bz+.11*s,sx+side*.10*s,chest-.50*s+shift,bz+.12*s,.047*s,'polished',.12);
   m.box(sx+side*.10*s,chest-.50*s+shift,bz+.12*s,.08*s,.08*s,.09*s,'brass',.18);
   m.box(bx+side*.23*s,.49*s+Math.abs(stride)*.03*s,bz-.34*s,.19*s,.14*s,.10*s,shimmer,.12);
  }
  if(high){
   for(let j=0;j<3;j++)m.box(sx+side*.05*s,chest+.13*s,bz-.335*s+j*.04*s,.032*s,.033*s,.028*s,'brass',.13);
   m.box(bx+side*.19*s,chest+.045*s,front-.055*s,.10*s,.04*s,.022*s,accent,.42);
  }
 }
 // Moving neck-collar iris and chest capacitors. Foreground glint pulses
 // during attack windup and when the boss charges its laser.
 const charge=boss&&e.ultimateStage==='charge';
 const energy=charge?3.2:1.2+Math.max(0,.27-e.attackT)*1.6;
 m.box(bx,chest+.025*s,front-.065*s,.18*s,.26*s,.062*s,'black',.08);
 m.box(bx,chest+.025*s,front-.094*s,.115*s,.16*s,.055*s,accent,energy);
 for(let j=0;j<3;j++){
  const x=bx+(j-1)*.13*s;
  m.box(x,chest-.30*s,front-.056*s,.055*s,.05*s,.045*s,j===1?accent:'chrome',j===1?.9:.12);
 }
 if(boss){
  // Huge segmented shoulders and crown differentiate bosses from infantry.
  for(const side of [-1,1]){
   m.box(bx+side*.77*s,chest+.42*s,bz+.06*s,.40*s,.13*s,.51*s,'titanium',.11);
   m.box(bx+side*.81*s,chest+.49*s,bz-.13*s,.29*s,.10*s,.42*s,shimmer,.21);
   m.box(bx+side*.81*s,chest+.53*s,bz-.19*s,.20*s,.04*s,.23*s,accent,1.2);
   m.box(bx+side*.84*s,chest-.25*s,bz-.23*s,.27*s,.48*s,.10*s,'polished',.12);
  }
  // Rotating segmented crown/collar assembly.
  const r=.83*s,spin=e.bob*.27+(charge?time*.85:time*.13),yy=2.33*s;
  for(let i=0;i<8;i++){
   const a=i*TAU/8+spin;
   const x=bx+Math.cos(a)*r,z=bz+Math.sin(a)*r;
   m.box(x,yy+.06*Math.sin(time*3+i),z,.15*s,.13*s,.17*s,i%3?'chrome':accent,i%3?.18:1.0,a);
  }
  // Huge weapon coil housings with individually moving core elements.
  for(const side of [-1,1]){
   const x=bx+side*1.1*s,z=bz-.34*s;
   m.box(x,1.47*s,z,.20*s,.46*s,.22*s,'titanium',.10);
   m.box(x,1.48*s,z-.19*s,.17*s,.17*s,.12*s,accent,1.8+throb*.6);
   if(close)for(let i=0;i<3;i++)m.box(x,1.25*s+i*.21*s,z+.12*s,.09*s,.037*s,.14*s,'brass',.15);
  }
  if(e.type==='colossus'){
   for(const side of [-1,1]){
    const x=bx+side*1.1*s;
    m.beam(x,2.5*s,bz+.14*s,x+side*.28*s,3.05*s,bz+.22*s,.085*s,'chrome',.1);
    m.box(x+side*.28*s,3.08*s,bz+.22*s,.24*s,.18*s,.24*s,'red',1.5);
   }
  }else if(e.type==='overseer'){
   for(let i=0;i<4;i++){
    const a=time*.43+i*TAU/4;
    const x=bx+Math.cos(a)*1.35*s,z=bz+Math.sin(a)*1.35*s;
    m.box(x,2.0*s+.15*Math.sin(time*2+i),z,.15*s,.12*s,.22*s,'steelblue',.12,a);
    m.box(x,2.0*s+.15*Math.sin(time*2+i),z-.14*s,.12*s,.08*s,.06*s,'green',1.4);
   }
  }
 }
 if(damage<.42){
  // Structural damage is visible even without texture maps.
  m.box(bx+.15*s,chest+.13*s,front-.098*s,.15*s,.05*s,.028*s,'rust');
  if(close){m.box(bx-.17*s,face-.18*s,bz-.36*s,.07*s,.025*s,.022*s,'warm',.55);}
 }
}
function enemyPoseMesh(original,e){
 // Transform the ENTIRE articulated robot rig around its current movement heading.
 // The previous implementation rotated isolated boxes only, so limbs stayed world-aligned.
 const yaw=e.facing||0,co=Math.cos(yaw),si=Math.sin(yaw),ox=e.x,oz=e.z;
 const p=(x,z)=>({x:ox+co*(x-ox)+si*(z-oz),z:oz-si*(x-ox)+co*(z-oz)});
 return {
  box(x,y,z,w,h,d,col,em=0,rot=0){const v=p(x,z);original.box(v.x,y,v.z,w,h,d,col,em,yaw+rot)},
  beam(x1,y1,z1,x2,y2,z2,w,col,em=1){
   const a=p(x1,z1),b=p(x2,z2);original.beam(a.x,y1,a.z,b.x,y2,b.z,w,col,em);
  },
  ribbon(x1,y1,z1,x2,y2,z2,w,col,em=1,cam=null,off=0){
   const a=p(x1,z1),b=p(x2,z2);original.ribbon(a.x,y1,a.z,b.x,y2,b.z,w,col,em,cam,off);
  }
 };
}

function drawCombatAnimation(m,e,quality){
 const distance=Math.hypot(e.x-player.x,e.z-player.z);
 if(distance>(quality==='battery'?11:quality==='balanced'?19:27))return;
 const dx=-Math.sin(e.facing||0),dz=-Math.cos(e.facing||0);
 const tx=Math.cos(e.facing||0),tz=-Math.sin(e.facing||0);
 const y=isBoss(e)?2.2:e.type==='drone'?1.73:1.29;
 const color=e.hellVariant==='shade'?'purple':e.hellVariant?'red':e.type==='sniper'?'cyan':e.type==='colossus'?'red':e.type==='behemoth'?'gold':
   e.type==='overseer'?'green':e.type==='artillery'?'orange':e.type==='leech'?'green':
   e.type==='skitter'||e.type==='stalker'?'red':'pink';
 const cam={x:player.x,y:1.64+player.height,z:player.z};
 if(e.rangedStage==='charge'&&e.rangedTotal){
  const t=clamp(1-e.rangedT/e.rangedTotal,0,1),pulse=.7+.3*Math.sin(time*23+e.id);
  const x=e.x+dx*.59,z=e.z+dz*.59,rad=.18+t*.23,bright=1.2+t*2.7;
  m.box(x,y,z,.16+t*.19,.15+t*.16,.16+t*.18,color,bright*pulse);
  const count=quality==='high'?12:8;
  for(let i=0;i<count;i++){
   const a=TAU*i/count+time*(1.5+t*4),b=a+TAU/count;
   m.beam(x+tx*Math.cos(a)*rad,y+Math.sin(a)*rad,z+tz*Math.cos(a)*rad,
    x+tx*Math.cos(b)*rad,y+Math.sin(b)*rad,z+tz*Math.cos(b)*rad,.029,color,1.3+t*1.8);
  }
  // Advanced volleys announce their dangerous spread ahead of time.
  if((cycleOf(wave)>1||localWaveOf(wave)>=15)&&quality!=='battery'){
   const target=e.rangedAim||0;
   for(const side of [-1,1]){
    const angle=target+side*(e.type==='sniper'?.05:.18);
    m.ribbon(x,y,z,e.x+Math.sin(angle)*5,.13,e.z-Math.cos(angle)*5,
     .020,color,.24+t*.32,cam);
   }
  }
  // A visible charge gathers toward the muzzle, telegraphing enemy fire.
  if(quality!=='battery')for(let i=0;i<4;i++){
   const a=time*2.2+TAU*i/4;
   m.ribbon(x+tx*Math.cos(a)*(.65-.32*t),y+Math.sin(a)*(.65-.32*t),z+tz*Math.cos(a)*(.65-.32*t),
    x,y,z,.025,color,(.7+t)*pulse,cam);
  }
 }
 if(e.rangedStage==='fire'){
  m.box(e.x+dx*.7,y,e.z+dz*.7,.24,.22,.24,'white',3.0);
 }
 const state=e.meleeStage;
 if(state!=='windup'&&state!=='lunge')return;
 const w=e.type==='crusher'||e.type==='bulwark'?1.4:e.type==='skitter'?.72:1.05;
 const phase=state==='windup'?clamp(1-e.meleeT/(e.meleeTotal||.4),0,1)*.34:
  clamp(1-e.meleeT/(e.type==='crusher'||e.type==='bulwark'?.36:e.type==='skitter'||e.type==='stalker'?.21:.28),0,1);
 const angle=-1.0+phase*2.35;
 const r=.47+phase*.54,px=e.x+dx*.3,py=y+.1,pz=e.z+dz*.3;
 // Animated pivoting blade and readable swept slash—no instant contact damage.
 const sx=px+tx*Math.sin(angle)*r,sy=py+Math.cos(angle)*.43,sz=pz+tz*Math.sin(angle)*r;
 const bx=px+dx*.22,by=py-.16,bz=pz+dz*.22;
 m.beam(bx,by,bz,sx,sy,sz,.075*w,e.type==='leech'?'green':'chrome',.5);
 m.box(sx,sy,sz,.14*w,.065*w,.13*w,state==='windup'?color:'white',state==='windup'?1.4:2.3);
 if(state==='lunge'){
  const segments=quality==='battery'?4:7,glow=clamp(.8-e.meleeT*1.2,.1,.85);
  let ox=null;
  for(let i=0;i<=segments;i++){
   const a=angle-.72+i*(1.44/segments),f=.58+.25*Math.sin(i/segments*Math.PI);
   const x=px+dx*.72+tx*Math.sin(a)*w*f;
   const yy=py+Math.cos(a)*w*.47;
   const z=pz+dz*.72+tz*Math.sin(a)*w*f;
   if(ox)m.ribbon(ox.x,ox.y,ox.z,x,yy,z,.047*glow,color,1.8*glow,cam);
   ox={x,y:yy,z};
  }
 }
}
// Mechanical pose computed from authoritative hit/windup stages.
function enemyPose(e){
 const m=e.meleeStage||'seek',rs=e.rangedStage||'idle';
 const move=clamp((e.weightShift||0)*.55+Math.min(1,(e.moveSpeed||0)/Math.max(.7,e.speed||1))*.45,0,1);
 const burst=m==='lunge'?1:m==='windup'?.72:m==='retreat'?.38:m==='recover'?.24:0;
 const strafe=e.intent==='flank'||e.intent==='orbit';
 const crouch=(e.type==='skitter'||e.type==='stalker')?.12:e.type==='sniper'&&rs==='charge'?.19:0;
 return {move,burst,strafe,crouch,lean:clamp((e.flinch||0)*.8+(strafe?(e.intentSide||1)*.08*move:0),-.21,.21),
  slash:m==='lunge',retreat:m==='retreat',braced:rs==='charge'||m==='windup',
  charge:rs==='charge',side:e.intentSide||1,action:m!=='seek'?m:rs==='charge'?'aim':rs==='fire'?'fire':e.intent||'guard'};
}
// Built on the Windows PC with actual Blender 5.2 source meshes.
// Rig joints remain procedural; sculpted masks/crowns ride on joint transforms.
// Embedded JSON removes any Android network requirement.
let BLENDER_KIT=null,blenderVertices=0,blenderPassModels=0;
try{
 const raw=document.getElementById('afterlightBlenderKit')?.textContent||'';
 if(raw){const parsed=JSON.parse(raw);if(parsed.schema===1)BLENDER_KIT=parsed.models}
  const pinky=document.getElementById('afterlightPinkyKit')?.textContent||'';
  if(pinky){const extra=JSON.parse(pinky);if(extra.schema===1&&extra.models?.hell_pinky&&
   extra.models.hell_pinky.triangles>1500&&extra.models.hell_pinky.triangles<=15500)
   BLENDER_KIT=Object.assign({},BLENDER_KIT||{},extra.models)}
 const knight=document.getElementById('afterlightHellKnightKit')?.textContent||'';
 if(knight){const extra=JSON.parse(knight);
  if(extra.schema===1&&extra.models?.hell_knight&&
     extra.models.hell_knight.triangles>=2000&&extra.models.hell_knight.triangles<=15500)
   BLENDER_KIT=Object.assign({},BLENDER_KIT||{},extra.models);
 }
 const imp=document.getElementById('afterlightImpKit')?.textContent||'';
 if(imp){const extra=JSON.parse(imp);
  if(extra.schema===1&&extra.models?.hell_imp&&
    extra.models.hell_imp.triangles>=2200&&extra.models.hell_imp.triangles<=11000)
   BLENDER_KIT=Object.assign({},BLENDER_KIT||{},extra.models);
 }
 const stone=document.getElementById('afterlightRunestoneKit')?.textContent||'';
 if(stone){const parsed=JSON.parse(stone);
  if(parsed.schema===1&&parsed.models?.hell_runestone&&
    parsed.models.hell_runestone.triangles>=100&&
    parsed.models.hell_runestone.triangles<=3900)
   BLENDER_KIT=Object.assign({},BLENDER_KIT||{},parsed.models);
 }
}catch(_){BLENDER_KIT=null}
function blenderPart(m,name,x,y,z,s,yaw=0,motion=null){
 const model=BLENDER_KIT?.[name];if(!model)return false;
 const co=Math.cos(yaw),si=Math.sin(yaw);
 for(const batch of model.batches){
  // Shadow-form shades are charcoal; do not render bright red stripe
  // materials on moving flesh. Reuse the same original triangles at all LODs.
  const shade=motion?.hellVariant==='shade';
  const color=shade?(HEX.ironblack||HEX.charcoal):HEX[batch.mat]||HEX.metal;
  const glimmer=shade?.011:['red','cyan','purple','gold'].includes(batch.mat)?.23:.032;
  const v=batch.v;
  const cycle=motion?Math.sin(motion.bob||0)*Math.min(1,(motion.moveSpeed||0)/4):0;
  const charge=motion?.hellCastStage==='charge'?.13:0;
  for(let i=0;i<v.length;i+=6){
   const px=v[i],py=v[i+1],pz=v[i+2],nx=v[i+3],ny=v[i+4],nz=v[i+5];
   // Small continuous foot-stance and attack deformations driven by actual
   // gait and casts, rather than disconnected flickering body fragments.
   const lower=motion?clamp((.98-py)*1.3,0,1):0;
   const upper=motion?clamp((py-.90)*.80,0,1):0;
   const sway=(px>=0?1:-1)*cycle;
   const ux=px+upper*charge*(px>=0?.08:-.08);
   const uy=py+lower*Math.max(0,sway)*.12+upper*charge*.05;
   const uz=pz+lower*sway*.16-upper*(cycle*.11+charge*.12);
   m.v([x+s*(co*ux+si*uz),y+s*uy,z+s*(-si*ux+co*uz)],
     [co*nx+si*nz,ny,-si*nx+co*nz],color,glimmer,px,pz);
  }
  blenderVertices+=v.length/6;
 }
 blenderPassModels++;
 return true;
}
// Original demonic relief, mounted to the north face and animated as a
// single sculpt. Chest, mouth, protruding eyes, horns and tendrils emerge
// through layers. The object is never a walking enemy stuck in a wall.
function renderWallMaw(m,e,quality){
 const w=e.wall;if(!w)return;
 const introProgress=bossCine.active&&bossCine.id===e.id?bossCine.clock*.78:0;
 const rise=w.phase==='emerge'?cinematicEase(clamp(Math.max(w.clock,introProgress)/2.2,0,1)):1;
 const pull=.25+rise*.90,sick=.5+.5*Math.sin(time*2.7+e.id);
 const x=e.x,z=e.z-1.16+pull;
 const scream=w.phase==='charge'?clamp(w.clock/1.05,0,1):w.phase==='cast'?.9:0;
 for(const side of [-1,1]){
  const curl=Math.sin(time*4.5+e.id+side)*.23+scream*.45;
  m.beam(x+side*1.82,4.34,.53,x+side*(2.25+curl),3.44,z+.34,
    .24,'rust',.12+scream*.40);
  m.beam(x+side*(2.25+curl),3.44,z+.34,
    x+side*(2.80+curl),2.96-scream*.16,z+.84,
    .18,'bone',.08+scream*.45);
  for(let tip=0;tip<3;tip++)
   m.beam(x+side*(2.80+curl),2.96-scream*.16,z+.84,
     x+side*(2.86+curl)+side*.15*tip,2.56-scream*.10-tip*.09,z+1.05,
     .048,'polished',.08+scream*.25);
 }
 if(scream>.2&&quality!=='battery'){
  for(let i=0;i<6;i++){
   const theta=i*TAU/6+time*.8,r=.78+.20*scream;
   m.beam(x+Math.cos(theta)*r,1.72+Math.sin(theta)*r,z+1.1,
     x+Math.cos(theta+.28)*(r+.60),1.72+Math.sin(theta+.28)*(r+.55),z+1.33,
     .028,'magma',.30+scream*.55);
  }
 }
 if(w.enraged){
  const throb=.94+.06*Math.sin(time*3.7);
  m.box(x,4.12,z-.12,18.4*throb,7.8,.92,'rust',.08);
  m.box(x,4.45,z+.44,14.9*throb,5.75,.48,'dark',.03);
  for(const side of [-1,1]){
   m.box(x+side*4.5,5.35,z+.72,2.6,2.0,.44,'black',.02);
   m.box(x+side*4.5,5.36,z+.96,1.25,.86,.18,'red',1.1+.4*Math.sin(time*4));
  }
  m.box(x,2.66,z+.86,8.5,2.48,.52,'black',.04);
  m.box(x,2.66,z+1.12,5.0,1.25,.25,'red',.95+.65*w.mouth);
 }
 const hit=e.hit>0,mouth=w.mouth;
 const skull=hit?'white':'rust',bone=hit?'white':'titanium',flesh='black';
 // Root that remains part of the wall, with no world-space locomotion.
 // The thick biological root ALWAYS reaches the actual north boundary at
 // z=.38. Head emergence changes thickness, not the wall attachment.
 const back=.38,rootDepth=Math.max(.45,z-back),rootCenter=(z+back)*.5;
 m.box(x,2.52,rootCenter,3.72,4.35,rootDepth,'dark',.035);
 for(const side of [-1,1]){
  m.beam(x+side*1.58,4.35,.51,x+side*1.26,3.62,z-.17,.16,'rust',.05);
  m.beam(x+side*1.63,.81,.50,x+side*1.17,1.58,z-.09,.18,'black',.025);
 }
 m.box(x,2.50,z,2.70,3.28,.78,skull,.12);
 m.box(x,2.65,z+.28,2.20,2.75,.53,'metal2',.045);
 // True Blender-built 3D armour mounted to this existing deforming wall boss.
 // Keep moving jaw, eye tracking, fracture geometry and damage volumes intact.
 // Battery skips the mesh; Balanced culls at 11m; High at 19m.
 if(quality!=='battery'&&Math.hypot(e.x-player.x,e.z-player.z)<(quality==='high'?19:11)
    &&blenderPassModels<($('quality').value==='high'?10:5)){
   blenderPart(m,'wallmaw_carapace',x,3.04,z+.48,1.26,Math.PI);
 }

 for(const side of [-1,1]){
  const sx=x+side*.85;
  m.box(sx,2.68,z+.51,.68,1.25,.37,skull,.09,side*.13);
  // Deep black eye sockets frame ruby red tracking pupils.
  m.box(sx,3.26,z+.73,.67,.53,.23,flesh,.02);
  m.box(sx+side*.07+.15*Math.sin(w.aim)*rise,3.25,z+.86,
   .19,.20,.10,'red',1.15*sick+.28);
  m.box(sx+side*.07,3.25,z+.91,.058,.058,.045,'white',.34);
  m.beam(sx,3.92,z+.38,sx+side*.38,4.90,z-.06,.24,bone,.09);
  m.beam(sx+side*.38,4.90,z-.06,sx+side*.90,5.25,z-.27,.19,bone,.03);
  m.beam(sx,2.11,z+.46,sx+side*1.13,1.60,z+.34,.18,'rust',.06);
  m.beam(sx+side*.42,2.03,z+.58,sx+side*.85,1.25,z+1.02,.16,bone,.04);
 }
 // Mouth: mechanical mandibles separate on casts and reveal hot throat.
 const gap=.20+mouth*.32+.10*Math.sin(time*3.1)*sick;
 m.box(x,1.75+gap*.5,z+.74,1.58,.22,.30,bone,.06);
 m.box(x,1.52-gap*.75,z+.75,1.62,.34,.38,skull,.08);
 m.box(x,1.70,z+.94,1.18,.36+gap,.16,'black',.035);
 m.box(x,1.70,z+1.025,.39,.20+gap*.40,.12,'red',.65+mouth*1.3);
 for(let k=-3;k<=3;k++){
  const px=x+k*.20;
  m.box(px,1.74+gap*.18,z+1.065,.085,.22+mouth*.055,.11,'polished',.02);
  m.box(px,1.50-gap*.70,z+1.065,.082,.17+mouth*.08,.11,'brass',.03);
 }

 // The torn perimeter is architectural: staggered fractured armour, not
 // a separate floating skull or a billboard. Severity rises as boss weakens.
 const severity=clamp(1-e.hp/Math.max(1,e.maxHp),0,1);
 const tear=.25+rise*.75;
 for(const side of [-1,1]){
  for(let j=0;j<4;j++){
   const bandY=.80+j*1.06,baseX=x+side*(1.46+j%2*.18),
      hingeZ=.49+j%2*.08,faceZ=z+.26;
   // Independent armour vanes hinge out from the wall as the boss emerges.
   const flare=tear*(.18+j*.031)+severity*.12,
    outerX=baseX+side*(.15+flare);
   m.beam(baseX,bandY,hingeZ,outerX,bandY+.30,faceZ,.12,
      j%2?'titanium':'rust',.06);
   m.box(outerX,bandY+.33,faceZ,.18,.52,.11,
      hit?'white':j%2?'metal2':'rust',.06,side*.21);
  }
  // Reinforced, flexing tendons run all the way back into the perimeter.
  const sway=Math.sin(time*(2.8+side*.2)+e.id)*.07*tear;
  for(let j=0;j<3;j++){
   const yy=1.20+j*1.24,xx=x+side*(1.05+j*.12);
   m.beam(xx+side*.18,yy,.40,xx+sway,yy+.12,z+.24,.095,'black',.05);
   m.beam(xx+sway,yy+.12,z+.24,xx+side*.38,yy+.38,z+.50,.058,'red',.10+severity*.08);
  }
 }
 // Procedural wall fractures spread into the reinforced structure as HP falls.
 const fractures=quality==='battery'?6:quality==='balanced'?10:16;
 for(let i=0;i<fractures;i++){
  const side=i%2?-1:1,level=i>>1,
   x0=x+side*(1.25+(i%5)*.22),y0=.53+(level*.63)%4.36,
   x1=x0+side*(.16+.12*Math.sin(i*4.17)),
   y1=y0+.19+((i*7)%3)*.14,zf=.485;
  m.beam(x0,y0,zf,x1,y1,zf,.014+(severity*.006),'black',.012);
  if(severity>.30&&i%2===0)
   m.beam(x1,y1,zf,x1+side*.17,y1+.13,zf,.009,'red',.06+severity*.20);
 }
 // The casting phase pulses across actual tendons before the mouth fires.
 if(w.phase==='charge'){
  const surge=.32+.68*Math.sin(time*13+e.id)**2;
  for(let j=0;j<5;j++){
   const a=j*TAU/5,x1=x+Math.cos(a)*.48,y1=1.8+Math.sin(a)*.46;
   m.beam(x1,y1,z+.95,x+Math.cos(a+.35)*.92,
    1.8+Math.sin(a+.35)*.80,z+.57,.020,'red',surge*.48);
  }
 }


 // Face-mounted tendons contract with each jaw movement and charge cycle.
 // Separate tapered rows react to the true mouth state, preserving hit boxes.
 if(quality!=='battery'){
  for(const side of [-1,1])for(let k=0;k<3;k++){
   const bx=x+side*(.44+k*.23),yy=2.05+k*.39,
    pullBack=.20+mouth*.16+.045*Math.sin(time*3.5+k+e.id);
   m.beam(bx,yy,z+.58,bx+side*.10,yy-.28-pullBack,z+.87,
    .041,'rust',.08+mouth*.24);
   m.beam(bx+side*.10,yy-.28-pullBack,z+.87,
    bx+side*.08,yy-.47-pullBack,z+1.02,
    .023,mouth>.5?'red':'titanium',.06+mouth*.27);
  }
 }
 // Staggered shards are visible ONLY during the actual 2.2-second emergence.
 // They settle down without becoming gameplay obstacles or permanent clutter.
 if(w.phase==='emerge'){
  const shards=quality==='battery'?6:quality==='high'?18:12;
  for(let i=0;i<shards;i++){
   const start=i*.035,t=clamp((rise-start)/Math.max(.05,1-start),0,1);
   if(t<=0||t>=1)continue;
   const side=i%2?-1:1,bx=x+side*(1.1+i%5*.31),
    by=.75+(i%7)*.51+t*.48-1.85*t*t;
   if(by<.07)continue;
   const zz=z+.38+t*(.45+i%4*.09);
   const size=(.14+(i%4)*.038)*(1-t*.43);
   m.box(bx+side*t*.45,by,zz,size,size*.70,size*.81,
    i%3===0?'rust':'titanium',.05,side*(t*1.6+i*.18));
  }
 }

 const arms=quality==='battery'?3:6;
 for(let i=0;i<arms;i++){
  const side=i%2?-1:1,sy=.90+i*.51;
  const wx=x+side*(1.45+i*.24),ex=x+side*(1.8+Math.sin(time*3+i)*.23);
  m.beam(x+side*1.13,sy+.58,z-.17,wx,sy,z+.20,.115,'rust',.09);
  m.beam(wx,sy,z+.20,ex,sy-.27+mouth*.13,z+.70,.080,bone,.05);
 }
 if(w.phase==='charge'){
  const k=clamp(w.clock/1.05,0,1),width=.18+.25*k;
  m.box(x,1.7,z+1.08,width,width,width,'red',.38+.9*k);
  for(let i=0;i<8;i++){
   const a=i*TAU/8+time*3,r=.62+.4*k;
   m.beam(x,1.7,z+1.08,x+Math.cos(a)*r,1.7+Math.sin(a)*r,z+.98,
    .018,'red',.25+k*.4);
  }
 }
}

/** Lightweight joint finishing for existing real enemy actions.
 * This uses the exact heading transform from the animated skeleton, so
 * elbows, cables and vents rotate with the character (not the room).
 */
let lastMotionDetails=0;
function drawEnemyMotionPolish(source,e,quality){
 if(quality==='battery'||e.type==='wallmaw'||e.type==='puppet')return false;
 const dist=Math.hypot(e.x-player.x,e.z-player.z);
 if(dist>(quality==='high'?15:9))return false;
 const rig=enemyPoseMesh(source,e),pose=enemyPose(e),heavy=isBoss(e);
 const s=heavy?1.45:e.type==='crusher'||e.type==='bulwark'?1.16:1;
 const stride=Math.sin(e.bob),brace=pose.braced?1:0;
 const flare=e.hit>0?Math.min(1,e.hit*3.5):0;
 const charging=e.rangedStage==='charge'||e.ultimateStage==='charge';
 const metal=flare>.08?'white':e.hellVariant?'rust':heavy?'chrome':'titanium';
 const aura=e.hellVariant?'red':heavy?'orange':e.type==='sniper'?'cyan':e.type==='leech'?'green':'blue';
 const x=e.x,z=e.z;
 for(const side of [-1,1]){
  const shoulder=x+side*.36*s,y=1.47*s;
  // A two-link hydraulic cylinder moves against the actual walk cycle.
  const knee=x+side*(.24+.025*Math.abs(stride))*s;
  const piston=(.08*stride*pose.move+.09*pose.burst)*s;
  rig.beam(shoulder,y,z+.25*s,knee,1.05*s+piston,z+.27*s,.036*s,'black',.04);
  rig.beam(knee,1.05*s+piston,z+.27*s,
   knee+side*.05*s,.82*s+piston,z+.30*s,.028*s,metal,.10);
  rig.box(x+side*.30*s,1.29*s+Math.abs(stride)*.023*s,
    z+.225*s,.115*s,.20*s,.052*s,metal,.09);
  // Separate vent fins breathe faster during a weapon charge/windup.
  if(quality==='high')for(let i=0;i<3;i++){
   const vent=1.35+i*.095,breathe=.035*Math.sin(time*4.3+e.id+i+side);
   rig.box(x+side*(.23+.02*i)*s,vent*s+breathe,z+.29*s,
     .065*s,.034*s,.047*s,i===1?'brass':metal,.08);
  }
  if(charging||pose.braced){
   rig.box(x+side*.31*s,(1.63+brace*.04)*s,z-.22*s,
     .13*s,.063*s,.045*s,aura,.24+.27*Math.sin(time*13+e.id+side)**2);
  }
 }
 // Distinctive breathing servo and armored clavicle, no silhouette explosion.
 const inhalation=Math.sin(time*(heavy?1.65:2.1)+e.id)*.018*s;
 rig.box(x,1.56*s+inhalation,z-.242*s,.28*s,.074*s,.065*s,metal,.10);
 if(flare>.01){
  const flick=.28+flare*.56;
  rig.box(x,1.54*s,z-.282*s,.13*s,.09*s,.034*s,'white',flick);
 }
 return true;
}


/* Dedicated original voxel rigs — Steve-reference cuboid anatomy (8x8x8,
 * 8x12x4, 4x12x4) for undead bipeds, low octoped spider and giant Warden.
 * Each part rotates with actual unit facing, legs animate with travel speed.
 */
function drawBlockMob(m,e,q){
 const kind=e.blockKind;if(!kind)return;
 const x=e.x,z=e.z,yaw=e.facing||0,co=Math.cos(yaw),si=Math.sin(yaw);
 const local=(xx,zz)=>({x:x+co*xx+si*zz,z:z-si*xx+co*zz});
 const box=(xx,y,zz,w,h,d,col,glow=0,rot=0)=>{
  const p=local(xx,zz);m.box(p.x,y+(kind==='spider'?Math.sin(e.bob)*.021:0),p.z,
   w,h,d,e.hit>0?'blockflash':col,glow,yaw+rot);
 };
 const beam=(x1,y1,z1,x2,y2,z2,th,col,glow=0)=>{
  const a=local(x1,z1),b=local(x2,z2);
  m.beam(a.x,y1,a.z,b.x,y2,b.z,th,e.hit>0?'blockflash':col,glow);
 };
 const walk=clamp((e.moveSpeed||0)/(e.speed||1),0,1),swing=Math.sin(e.bob)*walk;
 const winding=e.meleeStage==='windup'||e.rangedStage==='charge'||e.blockAttack==='charge';
 const striking=e.meleeStage==='lunge'||e.rangedStage==='fire'||e.blockAttack==='boom';
 const attackMotion=(winding?.45:0)+(striking?1:0);
 if(kind==='creeper'){
  const flash=e.blockFuse>.08&&Math.sin(e.blockFuse*29)>0;
  const green=flash?'blockflash':'blockgreen',pattern=flash?'blockflash':'blockgreen2';
  box(0,1.56+.038*Math.sin(time*3+e.id),0,.64,.64,.64,green);
  if(e.blockFuse>.20)box(0,2.00,-.07,.20,.05,.30,flash?'blockflash':'blockgreen3',.35);
  box(0,.94,0,.47,.72,.38,green);
  box(0,.52,0,.42,.22,.34,pattern);
  for(const side of [-1,1])for(const front of [-1,1]){
   box(side*.215,.17+Math.max(0,swing*side*front)*.07,front*.20,
    .26,.34,.23,pattern);
  }
  const face=-.328;
  for(const side of [-1,1])box(side*.165,1.66,face,.125,.145,.026,'blockface');
  box(0,1.47,face,.16,.175,.026,'blockface');
  box(-.13,1.35,face,.12,.19,.027,'blockface');box(.13,1.35,face,.12,.19,.027,'blockface');
  if(q!=='battery'){
   for(let i=0;i<12;i++){
    const row=Math.floor(i/4),col=i%4;
    if((i*7+e.id)%3===0)box(-.22+col*.15,1.80-row*.15,-.334,.07,.065,.008,'blockgreen3');
   }
   for(let i=0;i<7;i++)
    box((i%3-1)*.125,.72+Math.floor(i/3)*.16,-.198,.06,.07,.014,i%2?'blockgreen3':'blockgreen2');
  }
  if(e.blockFuse>.13){
   const t=e.blockFuse/1.5;
   for(let j=0;j<4;j++){const a=j*TAU/4+time*3,r=.58+.14*t;
    beam(Math.cos(a)*r,.11,Math.sin(a)*r,Math.cos(a+1.3)*r,.11,Math.sin(a+1.3)*r,
     .025,flash?'blockflash':'blockgreen',t);
   }
  }
  return;
 }
 if(kind==='spider'){
  const lift=Math.max(0,e.blockLeap||0)*1.9;
  box(0,.52+lift,0,.82,.43,.97,'blockspider');
  box(0,.52+lift,-.53-.07*attackMotion,.64,.51,.62,'blockspider2');
  for(let i=-1;i<=1;i+=2){
   box(i*.17,.65+lift,-.847,.145,.115,.03,'blockred',1.0);
  }
  for(const side of [-1,1])for(let j=0;j<4;j++){
   const f=j-1.5,pulse=Math.sin(e.bob+j*1.7+side)*walk*.12;
   const sx=side*.33,sz=f*.22;
   const ex=side*(.83+.07*j),ez=f*.4;
   beam(sx,.52+lift,sz,ex,.52+lift+(.10+(j%2)*.06),ez,.073,'blockspider');
   beam(ex,.52+lift+.1,ez,side*(1.05+.04*j),.08+Math.max(0,pulse)+lift,ez+f*.15,.065,'blockspider2');
  }
  if(q==='high')for(let i=0;i<8;i++)
   box((i%4-1.5)*.19,.75+lift,-.17+Math.floor(i/4)*.35,.14,.03,.14,'blockspider2');
  return;
 }
 if(kind==='warden'){
  const heart=.45+.45*Math.sin(time*4.2+e.id),charge=e.blockAttack==='charge';
  const crouch=charge?.12:0;
  box(0,1.45-crouch,0,1.27,1.30,.72,'blockwarden');
  box(0,2.42-crouch,0,1.04,.64,.83,'blockwarden');
  box(0,2.69-crouch,-.13,.88,.29,.49,'blockwarden2');
  box(0,1.66-crouch,-.38,.91,.71,.055,'blockwardenchest');
  for(const side of [-1,1]){
   // The asymmetrical curved horns and shoulder blades define the Warden silhouette.
   beam(side*.43,2.67-crouch,-.09,side*.78,2.85-crouch,-.08,.15,'blockwarden');
   beam(side*.78,2.85-crouch,-.08,side*.87,3.15-crouch,-.13,.13,'blockcyan',.55);
   box(side*(.74+attackMotion*.11),1.62-crouch-attackMotion*.10,-attackMotion*.24,.44,1.23,.51,'blockwarden2');
   box(side*.74,.95-crouch,.00,.46,.42,.56,'blockwarden');
   box(side*.31,.42+Math.max(0,swing*side)*.08,0,.47,.82,.54,'blockwarden');
   box(side*.74,2.11-crouch,-.16,.27,.12,.22,'blockcyan',.15);
  }
  for(let i=0;i<5;i++){
   const w=.63-i*.068;
   box(0,1.28+i*.12-crouch,-.425,w,.070,.039,'blockcyan',.48+heart*1.25+(charge?.4:0));
  }
  for(let i=0;i<5;i++)box((i-2)*.10,1.90-crouch,-.419,.046,.18,.025,'blockwarden',.12);
  if(e.blockBoomUntil>time){
   const t=clamp((e.blockBoomUntil-time)/.32,0,1);
   const dx=player.x-e.x,dz=player.z-e.z,len=Math.max(.1,Math.hypot(dx,dz));
   for(let j=0;j<7;j++){
    const p=j/7,sway=.1*Math.sin(time*25+j*2);
    m.beam(e.x+dx*p+sway,1.85+.2*Math.sin(p*TAU*3),e.z+dz*p,
      e.x+dx*(p+.15),1.85+.2*Math.sin((p+.15)*TAU*3),e.z+dz*(p+.15)+sway,
      .09+t*.09,'blockcyan',t*2.1);
   }
  }
  return;
 }
 // Zombie + Skeleton use identical classically articulated box dimensions.
 const skeleton=kind==='skeleton',skin=skeleton?'blockbone':'blockzombie',
   clothes=skeleton?'blockbone':'blockshirt';
 const armSwing=Math.sin(e.bob)*walk*.30+attackMotion*.31;
 box(0,1.66-.035*attackMotion,-.035*attackMotion,.62,.62,.62,skin);
 if(skeleton){
  box(-.15,1.72,-.323,.10,.115,.018,'blockface');
  box(.15,1.72,-.323,.10,.115,.018,'blockface');
  box(0,1.56,-.325,.18,.09,.018,'blockface');
 }else{
  box(-.145,1.71,-.323,.16,.10,.021,'blockface');
  box(.145,1.71,-.323,.16,.10,.021,'blockface');
  box(-.14,1.44,-.319,.13,.07,.018,'blockzombie2');
  box(.14,1.44,-.319,.13,.07,.018,'blockzombie2');
 }
 box(0,1.04,0,skeleton?.42:.62,.90,.33,clothes);
 if(skeleton)for(let i=0;i<5;i++)box(0,.81+i*.115,-.18,.56,.047,.05,'blockbone');
 else{
  box(0,1.38,-.175,.61,.13,.015,'blockshirt2');
  box(0,.73,-.175,.58,.12,.016,'blockshirt2');
 }
 for(const side of [-1,1]){
  box(side*.405,1.10+(skeleton?-.01:0)+Math.max(0,swing*side)*.05,-.20+armSwing*side*.34-attackMotion*.20,
   skeleton?.16:.29,.83,skeleton?.16:.30,skeleton?'blockbone':skin);
  box(side*.17,.39+Math.max(0,swing*side)*.11,-swing*side*.12,
   skeleton?.18:.29,.79,.29,skeleton?'blockbone':'blockpants');
  if(!skeleton)box(side*.17,.10+Math.max(0,swing*side)*.08,-.09,.31,.17,.43,'blockpants2');
 }
 if(skeleton){
  // Slim bow held in the skeleton's left hand, with string and crossbar.
  beam(-.62,1.55+attackMotion*.12,-.34-attackMotion*.13,-.82,1.17,-.47,.045,'blocklog');
  beam(-.82,1.17,-.47,-.62,.75,-.34,.045,'blocklog');
  beam(-.62,1.55,-.34,-.62,.75,-.34,.015,'blockbone');
 }
}

function addRobot(source,e){
 if(e.wardenMite){drawWardenMite(source,e);return;}
 if(e.circusActor){
  if(desktopPC&&window.WYRDFLUX_CIRCUS_PUPPETS?.state.status==='ready')return;
  // Fail-safe fallback only when the authored Blender rigs are not installed.
  drawCircusPerformer(source,e,$('quality').value);return;
 }
 if(e.saucer){drawWyrdfluxSaucer(source,e,$('quality').value);return;}
 if(e.type==='warden'&&desktopPC&&livingRenderer('warden')?.state.status==='ready')return;
 if(e.blockKind){drawBlockMob(source,e,$('quality').value);return;}
 if(e.type==='puppet'){renderPuppet(source,e,$('quality').value,{x:player.x,y:1.64+player.height,z:player.z});return;}
 if(e.type==='wallmaw'){renderWallMaw(source,e,$('quality').value);return;}
 if(e.type==='ophanim'){renderOphanim(source,e,$('quality').value);return;}
 const m=enemyPoseMesh(source,e);
 const boss=isBoss(e),crusher=e.type==='crusher'||e.type==='bulwark',drone=e.type==='drone';
 const s=boss?(e.type==='colossus'?2.55:e.type==='behemoth'?2.30:e.type==='overseer'?2.08:1.85):crusher?1.25:1,step=Math.sin(e.bob),twist=Math.sin(e.bob*.47),hit=e.hit>0;
 const body=hit?'white':boss?'rim':crusher?'metal':e.type==='stalker'||e.type==='skitter'?'dark':'metal2',accent=hit?'pink':e.type==='colossus'?'red':e.type==='behemoth'?'orange':e.type==='overseer'?'green':boss?'purple':drone?'orange':e.type==='sniper'?'pink':e.type==='leech'?'green':e.type==='stalker'||e.type==='skitter'?'red':e.type==='artillery'?'gold':'cyan';
 const posture=enemyPose(e),facing=0,telegraph=e.rangedStage==='charge'||e.meleeStage==='windup'||e.ultimateStage==='charge',em=telegraph?2.4:1.4;
 const bx=e.x,bz=e.z,y=Math.sin(e.bob)*.022*posture.move+(posture.braced?-.085:posture.slash?.085:posture.retreat?-.045:0)-posture.crouch;
 // In reaction to aimed shots and ultimate windup the torso compresses then re-extends.
 const recoilAnim=clamp((e.flinch||0)*.55,-.12,.13)+(e.hit>0?Math.min(.11,e.hit*.5):e.ultimateStage==='charge'?.05*Math.sin(time*18):0);
 if(drone){
  const fly=1.65+Math.sin(e.bob)*.17+.08*Math.sin(time*3+e.id),spin=e.bob*1.9+(posture.strafe?posture.side*.2:0);
  m.box(bx,fly,bz,.64,.21,.61,body,.1,facing);
  m.box(bx,fly+.15,bz,.46,.19,.4,'rim',0,facing);
  m.box(bx,fly-.1,bz,.25,.11,.28,'dark',0,facing);
  m.box(bx,fly,bz-.27,.52,.09,.085,accent,em,facing);
  m.box(bx,fly+.26,bz,.22,.025,.22,'orange',.85,facing);
  for(const side of [-1,1]){
   const px=bx+side*.57,pz=bz+Math.sin(spin+side)*.025;
   m.beam(bx+side*.21,fly,bz,px,fly-.025,pz,.115,'rim');
   m.box(px,fly,pz,.3,.12,.29,'metal');
   m.box(px,fly+.075,pz,.12,.035,.12,accent,1.3);
   for(let k=0;k<4;k++){const a=spin*5+TAU*k/4;
    m.beam(px-Math.cos(a)*.30,fly+.12,pz-Math.sin(a)*.30,px+Math.cos(a)*.30,fly+.12,pz+Math.sin(a)*.30,.012,'white',.4)
   }
  }
  for(let i=0;i<3;i++){const z=bz+.26+i*.12;m.box(bx,fly-.035,z,.22,.035,.04,'rim')}
 }else if(!boss){
  // Mechanical gait built from animated hip, knee, heel, toe and armor panels.
  m.box(bx+posture.lean*.20,y+(1.19-recoilAnim-posture.burst*.09)*s,bz+.06*posture.burst,.64*s,.79*s,.42*s,body,.06,facing);
  m.box(bx+posture.lean*.2,y+(1.25-posture.burst*.09)*s,bz-.25*s,.43*s,.22*s,.07*s,accent,1.0+em*.3,facing);
  m.box(bx,y+.96*s,bz,.54*s,.18*s,.47*s,'dark',0,facing);
  m.box(bx+posture.lean*.42,y+(1.78-posture.burst*.08)*s,bz+(posture.slash?-.10:posture.braced?.05:0)*s,.44*s,.36*s,.43*s,'rim',0,facing+twist*.025);
  m.box(bx,y+1.78*s,bz-.255*s,.36*s,.095*s,.07*s,accent,telegraph?3.1:2.1,facing);
  m.box(bx,y+1.99*s,bz,.18*s,.075*s,.18*s,'brass',0,facing);
  for(const side of [-1,1]){
   const stride=Math.sin(e.bob+side*1.57),lift=Math.max(0,stride)*.085*s;
   const hipX=bx+side*.19*s,walkAmp=clamp((e.moveSpeed||0)/.7,0,1);
   const strideX=Math.sin(e.bob+(side>0?Math.PI:0))*walkAmp;
   const lateral=posture.strafe?posture.side*.08*posture.move:0;
    const kneeX=hipX+side*.022*s+lateral*s,kneeZ=bz-.06*s-strideX*.13*s;
   const ankleX=hipX-side*.018*s+lateral*.85*s,ankleZ=bz+.10*s+strideX*.22*s;
   // Hip posture and crouch must not sink shoes below the walkable floor.
    const footY=Math.max(0,.006*Math.sin(e.bob)*posture.move);
    const footLift=Math.max(0,strideX)*.095*s*posture.move+(posture.slash?.05*s:0);
   m.beam(hipX,y+.89*s,bz,kneeX,y+.53*s+footLift,kneeZ,.13*s,'metal');
   m.box(kneeX,y+.51*s+footLift,kneeZ,.22*s,.21*s,.29*s,'rim');
   m.beam(kneeX,y+.48*s+footLift,kneeZ,ankleX,footY+.16*s+footLift,ankleZ,.13*s,'metal2');
   m.box(ankleX,footY+.115*s+footLift,ankleZ-.19*s,.34*s,.18*s,.46*s,'rim',0,facing);
   const shoulder=posture.braced?(side>0?.13:.06):posture.slash?(side>0?.23:-.02):0;
    const ax=bx+side*.44*s+posture.lean*.20,armSwing=-strideX*.14*s*posture.move;
   m.box(ax,y+(1.51+shoulder*.35)*s,bz-shoulder*.3*s,.33*s,.21*s,.37*s,'rim',0,facing);
   m.beam(ax,y+(1.42+shoulder*.35)*s,bz,ax+side*.04*s,y+(.99+shoulder)*s+Math.abs(armSwing)*.16,bz-(.08+shoulder*.75)*s+armSwing,.14*s,'metal');
   m.box(ax+side*.04*s,y+(.91+shoulder)*s+Math.abs(armSwing)*.16,bz-(.12+shoulder*.85)*s+armSwing,.22*s,.27*s,.21*s,body,0,facing);
   m.box(ax,y+(1.55+shoulder*.38)*s,bz-.21*s,.25*s,.09*s,.045*s,accent,.55+(posture.braced?.8:0),facing);
  }
  for(let j=0;j<3;j++)m.box(bx+(j-1)*.13*s,y+1.42*s,bz+.23*s,.07*s,.18*s,.035*s,'rust');
  if(e.type==='stalker'||e.type==='skitter'){
   m.box(bx,y+1.96*s,bz-.2*s,.43*s,.08*s,.09*s,'red',2.4,facing);
   for(const side of [-1,1])m.beam(bx+side*.38*s,y+1.33*s,bz,bx+side*.7*s,y+.62*s,bz-.4*s,.06*s,'red',1.5);
  }
  if(e.type==='artillery'||e.type==='sniper'){
   for(const side of [-1,1]){
    m.box(bx+side*.5*s,y+1.62*s,bz-.17*s,.37*s,.35*s,.76*s,'metal',0,facing);
    m.box(bx+side*.5*s,y+(1.62+(posture.charge?.12:0))*s,bz-.64*s,.23*s,.24*s,.14*s,'gold',telegraph?2.05:.65,facing);
    m.box(bx+side*.5*s,y+1.86*s,bz-.17*s,.34*s,.1*s,.45*s,'rim',0,facing);
   }
  }
  if(crusher){m.box(bx,y+(1.22-posture.burst*.08)*s,bz-.34*s,.57*s,.31*s,.16*s,'metal',0,facing);
   for(const side of [-1,1])m.box(bx+side*.44*s,y+1.55*s,bz,.23*s,.17*s,.55*s,'brass',0,facing)}
 }else{
  const pulse=.65+Math.sin(e.bob*2.2)*.35;
  m.box(bx,y+(1.27-recoilAnim)*s,bz,1.02*s,.91*s,.62*s,body,0,facing);
  m.box(bx,y+1.28*s,bz-.34*s,.57*s,.28*s,.12*s,'purple',1.4+pulse,facing);
  m.box(bx,y+1.78*s,bz,.5*s,.36*s,.43*s,'rim',0,facing+twist*.04);
  m.box(bx,y+1.81*s,bz-.28*s,.41*s,.10*s,.08*s,accent,2.5+pulse,facing);
  for(const side of [-1,1]){
   m.box(bx+side*.61*s,y+(1.51+(posture.braced?.12:0))*s,bz,.42*s,.65*s,.43*s,'metal',0,facing);
   m.box(bx+side*.62*s,y+(1.51+(posture.braced?.12:0))*s,bz-.27*s,.30*s,.17*s,.1*s,'pink',pulse+(posture.braced?.65:0),facing);
   m.box(bx+side*.26*s,y+.53*s+Math.sin(e.bob+side)*.1*s,bz,.35*s,.86*s,.4*s,'rim',0,facing);
   m.box(bx+side*.26*s,Math.max(0,.025*s+Math.sin(e.bob+side)*.008*s)+.13*s,bz-.11*s,.37*s,.18*s,.57*s,'metal2',0,facing);
   m.beam(bx+side*.65*s,y+1.55*s,bz,bx+side*.84*s,y+1.35*s,bz-.5*s,.13*s,'brass');
  }
  const centerY=y+1.48*s;
  for(let i=0;i<9;i++){const a=e.bob*.28+i*TAU/9,b=a+TAU/9;
   m.beam(bx+Math.cos(a)*.76*s,centerY+Math.sin(a*2)*.06*s,bz+Math.sin(a)*.76*s,bx+Math.cos(b)*.76*s,centerY+Math.sin(b*2)*.06*s,bz+Math.sin(b)*.76*s,.026*s,'pink',pulse);
  }
  m.box(bx,y+2.29*s,bz,.8*s,.1*s,.71*s,'dark',0,facing);
 }
 // Distinct attack silhouettes at close range; cheaper LOD when distant.
 if(!boss&&!drone&&Math.hypot(e.x-player.x,e.z-player.z)<13){
  if(e.type==='skitter'||e.type==='stalker'){
   for(const side of [-1,1]){
    const xx=bx+side*(.52+(posture.slash?.16:.04))*s;
    m.beam(xx,y+1.11*s,bz-.1*s,xx+side*.25*s,y+(.78+posture.burst*.12)*s,
      bz-(.48+posture.burst*.10)*s,.055*s,'red',posture.braced?.75:.24);
    m.box(xx+side*.25*s,y+(.78+posture.burst*.12)*s,
     bz-(.48+posture.burst*.10)*s,.11*s,.11*s,.32*s,'chrome',.14);
   }
  }else if(e.type==='sniper'){
   m.box(bx,y+(1.67+(posture.charge?.08:0))*s,bz-.48*s,.14*s,.16*s,.74*s,'titanium',.12);
   m.box(bx,y+1.91*s,bz-.52*s,.11*s,.075*s,.19*s,
     posture.charge?'cyan':'blue',posture.charge?1.45:.32);
  }else if(e.type==='crusher'||e.type==='bulwark'){
   const sh=posture.braced?.08:0;
   m.box(bx-.48*s,y+(1.31+sh)*s,bz-.28*s,.20*s,.63*s,.54*s,
    'titanium',.08,posture.slash?-.12:0);
   m.box(bx+.48*s,y+(1.40+sh)*s,bz-.33*s,.26*s,.38*s,.40*s,'rust',.05);
  }else if(e.type==='leech'){
   for(const side of [-1,1])
    m.beam(bx+side*.18*s,y+1.51*s,bz+.18*s,
     bx+side*.42*s,y+.84*s,bz-.33*s,.044,'green',.37);
  }
 }
 // Blender's actual triangle meshes replace plain head silhouettes
 // at medium/high quality and follow the already animated rig heading.
 if(BLENDER_KIT&&$('quality').value!=='battery'&&!drone){
  const distanceToCamera=Math.hypot(e.x-player.x,e.z-player.z);
  if((e.appearT||0)<=0&&distanceToCamera<($('quality').value==='high'?12:7.5)&&
    blenderPassModels<($('quality').value==='high'?6:3)){
   const part=boss?'boss_crown':
    e.type==='stalker'||e.type==='skitter'?'stalker_mask':'sentinel_helmet';
   blenderPart(source,part,bx+posture.lean*.42,
      y+(1.78-posture.burst*.08)*s,bz-.025*s,.93*s,e.facing||0);
  }
 }
 enemyArmorSkin(m,e);
 const distance=Math.hypot(e.x-player.x,e.z-player.z),quality=$('quality').value;
 drawEliteArmorDetails(m,e,s,quality,distance);
 if(isBoss(e))drawBossSignature(m,e,quality);
 else drawRegularEnemyRefinements(m,e,quality,distance);
 if(distance<(quality==='battery'?7:quality==='balanced'?14:22)){
  addMechanicalPolish(m,e,s,distance<10,quality==='high'&&distance<11);
 }
 // Fixed-height in-world target health telemetry.
 // Health is visible only when an enemy was recently hit or is a boss, not a floating label.
 if(!desktopPC&&(boss||e.hit>0)){const bar=boss?1.9:.65,h=boss?2.68*s:drone?2.23:2.20*s;
 source.box(bx,h+y*.1,bz,bar,.035,.045,'red',.18);
 source.box(bx-bar*(1-e.hp/e.maxHp)/2,h+.025+y*.1,bz,bar*clamp(e.hp/e.maxHp,0,1),.04,.055,accent,1.6);}
}


/**
 * Weapon mesh in CAMERA coordinates, independent of player world yaw, pitch,
 * translation and sector geometry. Sway and recoil are local offsets only.
 * This prevents a turning player from leaving the muzzle aimed at world -Z.
 */
function viewmodelPose(p){
 const bob=Math.sin(p.bob),walk=clamp(Math.hypot(p.vx,p.vz)/3.8,0,1);
 const breath=Math.sin(time*1.45)*.005*(1-walk*.82)*(inputs.focus?.35:1);
 const counter=Math.cos(p.bob*2)*.012*walk;
 return {
  x:.36+(p.lean||0)*.7+bob*.012+weaponMotion.swayX*.34,
  y:-.41+bob*.018+counter+breath+weaponMotion.swayY*.29-
   (p.recoil||0)*(WEAPONS[gun].startingSidearm?.33:[.10,.16,.24,.17,.08,.12,.11,.13,.28,.09][WEAPONS[gun].visualIndex??gun])-
   (p.landKick||0)*.45,
  z:-.80+(p.recoil||0)*(WEAPONS[gun].startingSidearm?.47:[.12,.22,.32,.25,.08,.15,.12,.16,.38,.09][WEAPONS[gun].visualIndex??gun])-.022*walk,
  recoil:p.recoil||0,
  flash:clamp((p.muzzleT||0)/.105,0,1)
 };
}

/**
 * Distinct equipment silhouettes: every weapon has a recognisable receiver,
 * barrel arrangement, charge module and material finish. All coordinates are
 * camera-local so the previous yaw/pitch viewmodel fix remains intact.
 */
// Forged archetypes share the original ten optimized functioning weapons,
 // but each has a recognizable SECONDARY silhouette, seeded receiver proportions,
 // barrel apparatus, and a moving mechanism. Geometry is bounded by quality.
 const FORGE_SHAPES=['TWIN FANG','CYCLOTRON','SIEGE CLAW','ORCHID','LATTICE','WASP NEST',
  'MONOLITH','SLICER','SPIRAL CROWN','HARPOON','VOID PRISM','GLASS ENGINE'];
 function forgeSilhouetteParts(m,bx,by,bz,w){
  if(!Number.isInteger(w.variant))return;
  const v=w.variant,kind=v%12,tier=Math.floor(v/12),a=w.archetype;
  const high=$('quality').value==='high',battery=$('quality').value==='battery';
  const glow=w.col,subGlow=['green','purple','red','blue'][(v+a)%4];
  const t=time,flash=clamp((player.muzzleT||0)/.16,0,1);
  const tilt=.14*Math.sin(v*2.21+a),depth=.08*(a%4),wing=.19+.045*(a%3);
  const nose=bz-.61-depth-.05*(v%3);
  const receiver=by+.075;
  const metal=tier?'chrome':'titanium',rib=tier?'polished':'metal2';
  // Lower-tier and apex-tier shapes differ in actual silhouette, not tint alone.
  if(tier)for(const sign of [-1,1])
   m.box(bx+sign*(.22+wing*.20),receiver+.05,nose+.24,.055,.19,.34,metal,.12,sign*tilt);
  if(kind===0){ // twin forward bayonets / compressed shock spine
   for(const side of [-1,1]){
    m.box(bx+side*wing,by+.05,nose-.23,.092,.13,.79,metal,.12,side*.17);
    m.box(bx+side*(wing+.035),by+.11,nose-.60,.042,.14,.23,glow,.62);
    m.box(bx+side*.13,by+.24,nose+.26,.095,.11,.45,rib,.08);
   }
  }else if(kind===1){ // vertical cyclotron and floating condenser gates
   m.box(bx,by+.34,nose+.24,.23,.30,.55,metal,.14);
   for(let i=0;i<(battery?3:high?7:5);i++){
    const angle=i*TAU/(battery?3:high?7:5)+t*.65;
    m.box(bx+Math.cos(angle)*.23,by+.38+Math.sin(angle)*.13,nose-.14,.10,.08,.14,i%2?rib:glow,.45,angle);
   }
   m.box(bx,by+.56,nose-.15,.10,.20,.14,glow,.65);
  }else if(kind===2){ // mechanized siege claws, opening on firing
   const open=flash*.13+.025*Math.sin(t*3.7+a);
   for(const side of [-1,1]){
    m.box(bx+side*(.23+open),by+.13,nose+.03,.12,.27,.68,metal,.07,side*.12);
    m.box(bx+side*(.26+open),by+.22,nose-.50,.14,.13,.31,glow,.78,side*.26);
    m.box(bx+side*(.33+open),by-.05,nose-.38,.07,.22,.25,'black',.05,side*.32);
   }
  }else if(kind===3){ // asymmetric orchid / side-mounted energy petals
   const sides=[-1,1];
   for(let i=0;i<sides.length;i++){
    const side=sides[i],width=side<0?.43:.23;
    m.box(bx+side*.24,by+(side<0?.25:-.10),nose+.07,width,.11,.58,metal,.12,side*.27);
    m.box(bx+side*.28,by+(side<0?.30:-.04),nose-.26,.08,.055,.39,glow,.65,side*.20);
   }
   m.box(bx-.06,by+.36,nose+.31,.11,.24,.18,subGlow,.45);
  }else if(kind===4){ // four visible linear accelerator rails
   for(const side of [-1,1])for(const row of [-1,1]){
    m.box(bx+side*.22,by+row*.18,nose-.25,.068,.09,.88,metal,.10);
    if(!battery)m.box(bx+side*.22,by+row*.18,nose-.53,.042,.053,.28,glow,.72);
   }
  }else if(kind===5){ // box magazine with wasp-like microbees at the muzzle
   m.box(bx,by-.22,bz+.05,.32,.25,.48,'rust',.13);
   const count=battery?3:6;
   for(let i=0;i<count;i++){
    const angle=i*TAU/count;
    m.box(bx+Math.cos(angle)*.20,by+.08+Math.sin(angle)*.18,nose-.30,
     .095,.095,.42,metal,.12,angle);
   }
   m.box(bx,by+.30,nose+.26,.39,.05,.31,subGlow,.30);
  }else if(kind===6){ // raised monolithic spine and offset armored counterweight
   m.box(bx,by+.42,nose+.10,.18,.53,.68,metal,.15,tilt);
   m.box(bx,by+.72,nose-.05,.13,.12,.19,glow,.5);
   m.box(bx-.26,by-.09,nose+.19,.36,.31,.41,rib,.08,-.16);
   m.box(bx+.19,by-.18,nose-.22,.13,.18,.47,metal,.12);
  }else if(kind===7){ // twin independently spinning cutting drums
   for(const side of [-1,1]){
    const spin=t*(3.7+v*.08)+side*.9;
    m.box(bx+side*.18,by+.10,nose-.20,.20,.20,.67,'dark',.12);
    const count=battery?3:5;
    for(let i=0;i<count;i++){
     const angle=TAU*i/count+spin;
     m.box(bx+side*.18+Math.cos(angle)*.11,by+.10+Math.sin(angle)*.11,nose-.34,
      .075,.065,.45,i%2?rib:metal,.10,angle);
    }
   }
  }else if(kind===8){ // spinning halo crown and suspended optic
   for(let j=0;j<2;j++){
    const n=battery?5:8,rad=.20+j*.09;
    for(let i=0;i<n;i++){
     const angle=t*(j?-.7:.6)+TAU*i/n+a*.07;
     m.box(bx+Math.cos(angle)*rad,by+.24+Math.sin(angle)*rad,nose-.18-j*.20,
      .085,.07,.12,i%2?metal:glow,.35,angle);
    }
   }
   m.box(bx,by+.24,nose-.64,.16,.13,.17,subGlow,.76);
  }else if(kind===9){ // long harpoon darts and split recoil shroud
   m.box(bx,by+.16,nose-.49,.12,.14,1.12,metal,.06);
   for(const side of [-1,1]){
    m.box(bx+side*.16,by+.13,nose-.57,.08,.08,.53,glow,.4,side*.11);
    m.box(bx+side*.24,by+.27,nose-.18,.13,.05,.42,rib,.09,side*.25);
   }
   m.box(bx,by+.16,nose-1.07,.08,.09,.31,'chrome',.24);
  }else if(kind===10){ // floating prism cubes with modest luminous connectors
   const n=battery?3:high?7:5;
   for(let i=0;i<n;i++){
    const z=nose-.2-i*.12,angle=t*.36+i*1.29;
    m.box(bx+Math.cos(angle)*.20,by+.17+Math.sin(angle)*.13,z,
     .10,.10,.14,i%2?metal:subGlow,.4,angle);
   }
   m.box(bx,by+.13,nose-.49,.23,.19,.32,'black');
   m.box(bx,by+.13,nose-.56,.12,.10,.13,glow,.73);
  }else{ // under-slung glass engine and moving piston stack
   m.box(bx,by-.25,bz+.03,.35,.32,.48,'glass',.13);
   m.box(bx,by-.25,bz-.23,.27,.22,.13,subGlow,.47);
   for(const side of [-1,1]){
    m.box(bx+side*.24,by+.17,nose+.06,.13,.26,.52,metal,.12,side*.15);
    m.box(bx+side*.24,by+.39,nose-.22,.08,.16,.13,glow,.59);
   }
   if(!battery)m.box(bx,by+.22+.055*Math.sin(t*4.1+v),nose-.3,.19,.13,.18,metal,.15);
  }
  // Signature bayonet/brace geometry varies by exact base and tier, preventing
  // identical receiver profiles even across the same 24 silhouette families.
  const number=Math.min(5,battery?2:2+(a%3)+(tier?1:0));
  for(let i=0;i<number;i++){
   const z=bz+.25-i*(.12+.008*(a%3));
   const sign=i%2?-1:1;
   m.box(bx+sign*(.12+.015*(a%5)),by+.17+.04*(a%2),z,
    .085+.006*(v%4),.055+.007*(a%3),.09, i%2?metal:rib,.08,tilt*sign);
  }
  if(tier&&high){
   m.box(bx,by+.18,nose-.84,.095,.10,.09,glow,.35);
  }
 }
function addCinematicWeaponParts(m,bx,by,bz){
 const effect=WEAPONS[gun].effect,glow=WEAPONS[gun].col;
 forgeSilhouetteParts(m,bx,by,bz,WEAPONS[gun]);
 const high=$('quality').value==='high',warm=effect==='ignite'||effect==='splash',pulse=.6+.4*Math.sin(time*6.2);
 const front=bz-.65;
 // Common industrial receiver has brushed chrome seams and a glowing capacitor.
 m.box(bx,by+.09,bz-.19,.32,.037,.42,'chrome',.13);
 m.box(bx,by+.20,bz+.17,.20,.09,.32,'polished',.1);
 m.box(bx,by-.11,bz-.02,.24,.18,.31,'titanium');
 for(const side of [-1,1]){
  m.box(bx+side*.17,by+.045,bz-.20,.035,.17,.51,'chrome',.16);
  m.box(bx+side*.174,by+.17,bz+.02,.023,.045,.28,glow,.48+pulse*.37);
  m.box(bx+side*.11,by-.13,bz+.18,.08,.11,.15,'black');
 }
 if(effect==='energy'){
  // Luminous linear accelerator with stabilizer rings and forked prongs.
  for(let i=0;i<6;i++){
   const z=front+i*.102;
   m.box(bx,by+.16,z,.21,.045,.027,'chrome',.1);
   m.box(bx,by+.18,z,.12,.018,.037,glow,1.05);
  }
  for(const side of [-1,1])m.box(bx+side*.17,by+.02,front-.12,.06,.09,.44,'steelblue',.25);
 }else if(effect==='scatter'){
  // Shotgun: multi-barrel crown with heavy heat shield and revolving shell cell.
  for(const side of [-1,0,1]){
   m.box(bx+side*.10,by+.01,front-.12,.10,.11,.54,'titanium',.08);
   m.box(bx+side*.10,by+.012,front-.40,.095,.093,.08,'chrome',.19);
   m.box(bx+side*.10,by+.01,front-.45,.058,.051,.034,'black');
  }
  for(let i=0;i<6;i++){const a=i*TAU/6;
   m.box(bx+Math.cos(a)*.13,by-.16+Math.sin(a)*.12,bz+.17,.077,.082,.19,i%2?'brass':'steelblue',.10,a);
  }
  m.box(bx,by+.18,front+.15,.40,.07,.49,'chrome',.14);
 }else if(effect==='pierce'){
  // Long railgun: paired superconducting rails + high energy plasma throat.
  for(const side of [-1,1]){
   m.box(bx+side*.15,by+.02,front-.23,.09,.12,.81,'polished',.14);
   m.box(bx+side*.15,by+.11,front-.24,.045,.038,.78,glow,1.1);
  }
  for(let i=0;i<7;i++){
   const z=front-i*.13;
   m.box(bx,by+.04,z,.34,.045,.035,i%2?'titanium':'chrome',.21);
   m.box(bx,by+.038,z-.02,.12,.034,.054,glow,.65);
  }
  m.box(bx,by+.045,front-.89,.12,.11,.23,'black');
 }else if(effect==='splash'){
  // Rocketeer: massive hexagonal barrel, launch ring and finned exhaust.
  m.box(bx,by-.01,front-.04,.34,.34,.67,'titanium',.08);
  m.box(bx,by+.02,front-.10,.26,.24,.52,'black');
  for(let i=0;i<8;i++){
   const a=i*TAU/8;
   m.box(bx+Math.cos(a)*.17,by+Math.sin(a)*.17,front-.29,.052,.06,.44,'polished',.19,a);
  }
  m.box(bx,by,front-.43,.46,.39,.10,'chrome',.26);
  m.box(bx,by,front-.49,.24,.22,.04,glow,.95);
  for(const side of [-1,1]){
   m.box(bx+side*.23,by+.17,front+.14,.08,.17,.42,'steelblue');
   m.box(bx+side*.23,by+.28,front+.15,.064,.045,.18,'warm',1.10);
  }
 }else if(effect==='pulse'){
  // Hyper-fast paired plasma needles.
  for(const side of [-1,1]){
   m.box(bx+side*.105,by+.01,front-.12,.10,.11,.73,'polished',.12);
   m.box(bx+side*.105,by+.11,front-.31,.064,.029,.39,glow,1.35);
   m.box(bx+side*.105,by+.015,front-.48,.072,.075,.052,'chrome',.25);
  }
  m.box(bx,by+.24,bz-.19,.14,.10,.37,'steelblue',.11);
 }else if(effect==='ignite'){
  // Furnace rifle with animated orange vent spine and steel thermal jacket.
  m.box(bx,by+.15,front+.10,.34,.22,.56,'rust',.17);
  for(let i=0;i<8;i++){
   const z=front-i*.077;
   m.box(bx,by+.28,z,.21,.028,.047,i%2?'brass':'titanium',.08);
   m.box(bx,by+.305,z,.08,.025,.036,'warm',.6+pulse*.8);
  }
  for(const side of [-1,1])m.box(bx+side*.20,by-.01,front+.12,.08,.25,.33,'metal');
 }else if(effect==='freeze'){
  // Cryogenic reactor canisters, chromium ribs and frosty coolant valves.
  for(const side of [-1,1]){
   m.box(bx+side*.18,by+.06,bz+.04,.11,.23,.32,'glass',.25);
   m.box(bx+side*.18,by+.13,bz+.04,.075,.13,.24,'cyan',1.18);
   for(let k=0;k<3;k++)m.box(bx+side*.18,by+.06,bz-.08+k*.10,.14,.03,.035,'chrome',.22);
  }
  m.box(bx,by+.16,front-.24,.14,.13,.50,'polished');
  m.box(bx,by+.18,front-.34,.07,.08,.38,'white',.58);
 }else if(effect==='arc'){
  // Tesla fork: visibly separated conductor arms and active micro-arcs.
  for(const side of [-1,1]){
   m.box(bx+side*.18,by+.11,front-.15,.09,.12,.78,'chrome',.19);
   m.box(bx+side*.18,by+.16,front-.57,.06,.14,.26,glow,1.45);
   m.beam(bx+side*.18,by+.20,front+.15,bx+side*.18,by+.34,front-.40,.038,'cyan',1.2);
  }
  if(high){
   const wobble=Math.sin(time*23)*.045;
   m.ribbon(bx-.18,by+.31,front-.35,bx+.18,by+.31+wobble,front-.46,.038,'white',1.8,{x:0,y:0,z:0});
  }
 }else if(effect==='gravity'){
  // Siege impaction core: rotating high-mass singularity coils and broad shroud.
  m.box(bx,by+.14,front+.08,.39,.22,.53,'chrome',.24);
  for(let i=0;i<9;i++){
   const angle=time*.48+i*TAU/9;
   m.box(bx+Math.cos(angle)*.21,by+.1+Math.sin(angle)*.16,front-.35,.088,.10,.10,i%2?'gold':'steelblue',1.08,angle);
  }
  m.box(bx,by+.07,front-.55,.19,.19,.24,'black',.11);
  m.box(bx,by+.07,front-.68,.16,.16,.09,glow,2.0);
 }else if(effect==='shred'){
  // Rotating microneedle battery.
  for(let i=0;i<5;i++){
   const a=time*8+i*TAU/5;
   m.box(bx+Math.cos(a)*.125,by+Math.sin(a)*.125,front-.23,.065,.07,.64,'polished',.1);
   m.box(bx+Math.cos(a)*.125,by+Math.sin(a)*.125,front-.60,.048,.052,.075,glow,1.3);
  }
  m.box(bx,by+.25,front+.08,.26,.045,.34,'brass',.12);
 }
 // Dual technology is physically readable: a second glowing conduit and an
 // oscillating resonator with the secondary weapon's actual elemental color.
 if(mixGun>=0&&mixGun!==gun&&activeGun[mixGun]){
  const second=WEAPONS[mixGun].col;
  for(const side of [-1,1])m.box(bx+side*.225,by+.05,bz-.13,.034,.05,.60,second,1.10);
  for(let k=0;k<6;k++){
   const a=k*TAU/6+time*.9;
   m.box(bx+Math.cos(a)*.22,by+.06+Math.sin(a)*.17,bz+.20,.065,.06,.075,k%2?second:glow,1.0,a);
  }
  if(high)m.ribbon(bx-.21,by+.19,front+.05,bx+.21,by+.19+.035*Math.sin(time*17),front-.04,
   .028,second,1.22,{x:0,y:0,z:0});
 }
}

/**
 * Original animated ten-gun performance rigs. Every mechanism is in camera
 * space (not world-space) and is quality bounded. Effects are synchronized to
 * the real shot timer, so the graphics and dedicated synth audio share timing.
 */
function drawAnimatedWeaponRig(m,bx,by,bz,p){
 const kind=WEAPONS[gun].visualIndex??gun,hi=$('quality').value==='high',battery=$('quality').value==='battery';
 const flash=clamp((p.muzzleT||0)/.16,0,1),heat=clamp(p.heat||0,0,1);
 const flick=.55+.45*Math.sin(time*24.0),cam={x:0,y:0,z:0},front=bz-.85;
 const accent=WEAPONS[gun].col;
 const arc=(x1,y1,z1,x2,y2,z2,color=accent,amp=.035,steps=4,brightness=1)=>{
  let a={x:x1,y:y1,z:z1};
  for(let i=1;i<=steps;i++){
   const t=i/steps,wiggle=(i===steps?0:Math.sin(time*63+i*12.23+gun*1.7)*amp);
   const b={x:x1+(x2-x1)*t+wiggle,y:y1+(y2-y1)*t+wiggle*.73,z:z1+(z2-z1)*t};
   m.ribbon(a.x,a.y,a.z,b.x,b.y,b.z,.012+flash*.013,color,brightness*(.65+.35*flick),cam);
   if(hi&&i<steps&&i%2===0){
    const branch=.11+flash*.12;
    m.ribbon(b.x,b.y,b.z,b.x+wiggle+branch,b.y+.04,b.z-.12,.009,'white',brightness*.48,cam);
   }
   a=b;
  }
 };
 if(kind===0){ // VOLT: two oscillating charged arms, mechanical recoil pistons
  for(const side of [-1,1]){
   const x=bx+side*(.18+.026*Math.sin(time*12+side));
   m.box(x,by+.12,front+.12,.085,.070,.31,'chrome',.11);
   m.box(x+side*.024,by+.16,front-.12,.095,.055,.08,accent,1.0+flash*1.9);
   if(flash>.03||hi&&Math.sin(time*6+side)>0.7)
    arc(x,by+.16,front+.07,bx+side*.08,by+.23,front-.26,accent,.025+flash*.04,4,.8+flash*2);
  }
  for(let j=0;j<4;j++){
   const r=.13+flash*.04,z=front+j*.10;
   m.box(bx,by+.15,z,.12+flash*.06,.033,.036,j%2?'cyan':'white',.45+flash*.6);
  }
 }else if(kind===1){ // SHARD: sliding pump, six rotating chambers, brass recoil
  const slide=flash*.16;
  m.box(bx,by+.18,front+.22+slide,.43,.095,.29,'titanium',.10);
  m.box(bx,by+.24,front+.22+slide,.34,.043,.12,'chrome',.18);
  for(let j=0;j<6;j++){
   const a=j*TAU/6+flash*.44,r=.145;
   m.box(bx+Math.cos(a)*r,by-.155+Math.sin(a)*r,bz+.17,.064,.063,.22,
     j%2?'brass':'steelblue',.18,a);
  }
  if(flash>.03)for(let j=0;j<3;j++)m.box(bx+(j-1)*.16,by+.12+flash*.08,front-.35,.036,.028,.10,'warm',flash*.8);
 }else if(kind===2){ // LANCER: traveling charge beads accelerate down dual rails
  for(let j=0;j<8;j++){
   const z=front-.16-j*.095;
   const progress=((time*6.5+j*.11)%1),bright=.45+flash*1.8+progress*.5;
   m.box(bx-.16,by+.12,z,.035,.028,.08,j%2?'pink':'white',bright);
   m.box(bx+.16,by+.12,z,.035,.028,.08,j%2?'white':'pink',bright);
  }
  if(flash>.025){
   arc(bx-.16,by+.12,front-.58,bx+.16,by+.12,front-.64,'pink',.04,5,flash*2.0);
   m.box(bx,by+.08,front-.81,.16,.14,.21,'white',flash*3.0);
  }
 }else if(kind===3){ // NOVA: retracting blast shutters, venting plasma ball
  const open=.04+flash*.11;
  for(const side of [-1,1]){
   m.box(bx+side*(.20+open),by+.06,front-.35,.11,.29,.36,'polished',.16);
   m.box(bx+side*(.20+open),by+.24,front-.36,.052,.05,.30,'purple',.75+flash*1.1);
  }
  const r=.15+.085*flash;
  for(let i=0;i<8;i++){
   const a=i*TAU/8+time*.8;
   m.box(bx+Math.cos(a)*r,by+.02+Math.sin(a)*r,front-.48,.055,.055,.065,
     i%2?'purple':'warm',.7+flash*.9,a);
  }
 }else if(kind===4){ // SPECTRE: alternating two-barrel recoil and flash
  const left=Math.sin(time*36)>0;
  for(const side of [-1,1]){
   const hot=side<0===left,zz=front-.38+(hot?flash*.12:0);
   m.box(bx+side*.105,by+.02,zz,.115,.12,.11,'chrome',.23);
   m.box(bx+side*.105,by+.04,zz-.068,.052,.046,.08,hot?'white':'blue',hot?2.2*flash:.8);
  }
  for(let j=0;j<3;j++)m.box(bx,by+.27,front+.10+j*.08,.13,.025,.042,'blue',.3+flash*.9);
 }else if(kind===5){ // INFERNO: thermal metal expanding vents and flame wisps
  for(let j=0;j<7;j++){
   const z=front-.50+j*.09,wave=Math.sin(time*11+j*1.9);
   const hot=(.12+heat*.8)*(1+.15*wave);
   m.box(bx,by+.33+wave*.012,z,.15,.036,.051,j%2?'warm':'orange',hot);
   if(heat>.20&&j%2===0)
    m.ribbon(bx,by+.36,z,bx+wave*.035,by+.43+heat*.08,z-.07,.018,'orange',heat*.6,cam);
  }
 }else if(kind===6){ // CRYO: hexagonal crystal ornaments and cold vapor
  for(let j=0;j<6;j++){
   const a=time*1.7+j*TAU/6,xx=bx+Math.cos(a)*.18,yy=by+.19+Math.sin(a)*.13;
   m.box(xx,yy,front-.25,.062,.11,.07,'cyan',.65+flash*.5,a);
  }
  for(const side of [-1,1])m.ribbon(bx+side*.17,by+.18,front+.06,
   bx+side*.17+.028*Math.sin(time*3+side),by+.37,front-.20,.028,'mist',.18+flash*.5,cam);
 }else if(kind===7){ // TESLA: animated fork arms and real branching lightning
  const wide=.25+flash*.11+.035*Math.sin(time*8);
  for(const side of [-1,1]){
   const tipX=bx+side*wide,tipY=by+.18+flash*.065,tipZ=front-.58;
   m.box(bx+side*.20,by+.11,front-.18,.115,.12,.64,'polished',.14);
   m.box(tipX,tipY,tipZ,.085,.19,.15,'purple',1.15+flash*2.3);
   // Audible electrical crackle and visible branching discharge are paired.
   arc(bx+side*.18,by+.30,front+.14,tipX,tipY,tipZ,'purple',.045+flash*.06,5,.72+flash*2.9);
   arc(tipX,tipY,tipZ,bx+side*.07,by+.24,front-.78,'cyan',.047,4,.7+flash*2);
  }
  arc(bx-wide,by+.20,front-.60,bx+wide,by+.20,front-.60,
   'white',.080+flash*.07,hi?7:4,1.4+flash*3.5);
  if(flash>.06)for(let i=0;i<3;i++){
   const ang=time*24+i*TAU/3;
   arc(bx+Math.cos(ang)*.19,by+.13+Math.sin(ang)*.10,front-.42,
       bx+Math.cos(ang+1.4)*.30,by+.15+Math.sin(ang+1.4)*.21,front-.74,
       i%2?'white':'purple',.050,3,flash*2.6);
  }
 }else if(kind===8){ // GRAVITON: magnetized masses collapse on discharge
  const radius=.25-flash*.13;
  for(let j=0;j<8;j++){
   const a=j*TAU/8+time*(1+flash*4),x=bx+Math.cos(a)*radius,y=by+.10+Math.sin(a)*radius;
   m.box(x,y,front-.45,.065,.072,.08,j%2?'gold':'chrome',.75+flash*1.0,a);
  }
  m.box(bx,by+.10,front-.48,.13+flash*.10,.14+flash*.10,.12+flash*.12,
   flash>.15?'white':'gold',1.1+flash*3.0);
 }else if(kind===9){ // NEEDLE: accelerating rotary drill spindles
  const speed=heat>.06?18+heat*48:time*3;
  for(let i=0;i<5;i++){
   const a=i*TAU/5+time*speed,xx=bx+Math.cos(a)*.145,yy=by+.05+Math.sin(a)*.145;
   m.box(xx,yy,front-.38,.058,.063,.48,'polished',.10);
   m.box(xx,yy,front-.69,.052,.048,.11,'green',.72+flash*.9);
  }
  if(flash>.03)m.box(bx,by+.05,front-.85,.12,.11,.16,'white',flash*2.3);
 }
 // Hybrid resonance pulses accent the selected secondary elemental color.
 if(mixGun>=0&&activeGun[mixGun]&&mixGun!==gun&&!battery){
  const second=WEAPONS[mixGun].col,k=.75+.25*Math.sin(time*7+mixGun);
  for(const side of [-1,1])m.box(bx+side*.22,by+.16,front+.29,.04,.06,.33,second,(.65+flash*.8)*k);
 }
}
// Full gun meshes now share one cinematic-viewmodel transform. It reduces
// geometry occupying the screen and lowers it next to a wall; shooting ray
// stays in world space, so this cannot alter damage or bullet collision.
let lastGunWallFactor=0,lastGunScreenScale=1;
function weaponMeshTransform(m,p){
 const directionX=Math.sin(p.yaw),directionZ=-Math.cos(p.yaw);
 let wallFactor=0;
 for(let d=.25;d<=1.30;d+=.15){
  if(tile(p.x+directionX*d,p.z+directionZ*d)){
   wallFactor=clamp((1.35-d)/1.10,0,1);break;
  }
 }
 const scale=.79-wallFactor*.08;
 lastGunWallFactor=wallFactor;lastGunScreenScale=scale;
 const pos=(x,y,z)=>[x*scale+.12,y*scale-.060-wallFactor*.18,z*scale-.12-wallFactor*.16];
 return {
  v(p,n,c,em,u,v){const x=pos(p[0],p[1],p[2]);m.v(x,n,c,em,u,v);},
  box(x,y,z,sx,sy,sz,c,em=0,rot=0){
   const v=pos(x,y,z);
   m.box(v[0],v[1],v[2],sx*scale,sy*scale,sz*scale,c,em,rot);
  },
  beam(x1,y1,z1,x2,y2,z2,w,c,em=1){
   const a=pos(x1,y1,z1),b=pos(x2,y2,z2);
   m.beam(...a,...b,w*scale,c,em);
  },
  ribbon(x1,y1,z1,x2,y2,z2,w,c,em=1,cam=null,off=0){
   const a=pos(x1,y1,z1),b=pos(x2,y2,z2);
   m.ribbon(...a,...b,w*scale,c,em,cam,off*scale);
  }
 };
}

function drawWyrdfluxWeaponSignatureFX(m,bx,by,bz,p){
 if(!desktopPC||$('quality').value==='battery')return;
 const w=WEAPONS[gun],combo=fluxsideUltraCombo(gun,mixGun);
 const effect=combo?.style||w.modifier||w.effect||'energy';
 const superWeapon=!!combo||['legendary','mythic'].includes(w.rarity);
 const flash=clamp((p.muzzleT||0)/.19,0,1),heat=clamp(p.heat||0,0,1);
 const pulse=.45+.55*Math.sin(time*24+gun),front=bz-.84;
 const high=$('quality').value==='high',n=high?7:4;
 const col=combo?.legend?.col||w.col||'cyan',camera={x:0,y:0,z:0};
 if(superWeapon){
  // Cinematic triple gyroscopic crowns spin around the REAL 3D first-person gun.
  // Bounds/vertex budgets are fixed; never obscure the crosshair.
  const rings=combo?3:2,segments=high?16:10;
  for(let layer=0;layer<rings;layer++){
   const radius=.16+layer*.074,depth=bz-.35-layer*.12;
   const spin=time*(layer%2?-1.35:1.55)+layer*.63;
   for(let i=0;i<segments;i++){
    const a=i*TAU/segments+spin,b=a+TAU/segments;
    const glow=combo?1.3:.72;
    m.beam(bx+Math.cos(a)*radius,by+.035+Math.sin(a)*radius,depth,
     bx+Math.cos(b)*radius,by+.035+Math.sin(b)*radius,depth,
     .013+flash*.011,i%4?'gold':col,glow+flash*1.9);
   }
  }
  if(flash>.025){
   // Super weapon muzzle burst stays local; travel beams are separately capped.
   for(let ray=0;ray<8;ray++){
    const a=ray*TAU/8+time*2.4,r=.14+flash*.16;
    m.beam(bx,by+.035,bz-.98,
     bx+Math.cos(a)*r,by+.035+Math.sin(a)*r,bz-.99-flash*.13,
     .018,ray%2?col:'white',1.5+flash*2.3);
   }
  }
 }
 // Multi-layer luminous muzzle, with physically bounded plasma crowns and
 // articulated sliding rails. The actual hit ray and collision are untouched.
 if(flash>.03){
  const glow=effect==='freeze'?'cyan':effect==='ignite'?'orange':
   effect==='gravity'?'purple':col;
  const spread=.045+flash*.11,petals=high?8:5;
  m.box(bx,by+.022,front-.46,.038+flash*.049,.038+flash*.049,.082,'white',1.3+flash*2.1);
  for(let i=0;i<petals;i++){
   const a=i*TAU/petals+time*6,rad=spread*(.65+.35*Math.sin(time*19+i));
   m.beam(bx+Math.cos(a)*.028,by+.022+Math.sin(a)*.028,front-.44,
     bx+Math.cos(a)*rad,by+.022+Math.sin(a)*rad,front-.46-flash*.18,
     .012+flash*.011,i%3?'white':glow,flash*(i%2?1.7:2.2));
  }
  for(const side of [-1,1])m.box(bx+side*.12,by-.15,front+.20-flash*.15,
    .049,.075,.25,side>0?'chrome':'titanium',.18+flash*.45,side*.18);
 }
 if(effect==='pierce'){ // twin-rail ion beads accelerate into a brilliant pinprick
  for(let i=0;i<n;i++){
   const progress=((i/n+time*2.6)%1),z=front-.42-progress*.39;
   for(const side of [-1,1])
    m.box(bx+side*(.105-.032*progress),by+.036,z,
      .017,.016,.048,col,.7+flash*2.0+progress*.75);
  }
  if(flash>.025)m.box(bx,by+.035,front-.83,.065+flash*.055,.065+flash*.055,.12,'white',3.5*flash);
 }else if(effect==='scatter'||effect==='shred'){ // staggered pellets or rotating shrapnel
  for(let i=0;i<n;i++){
   const a=TAU*i/n+time*(effect==='shred'?6.2:.6);
   const r=(effect==='shred'?.17:.12)+flash*.12;
   m.box(bx+Math.cos(a)*r,by+Math.sin(a)*r,front-.22,
     .025,.021,.09,i%2?'white':col,(.24+flash*1.3),a);
  }
 }else if(effect==='freeze'){ // staggered ice splinters, no full-screen flash plane
  for(let i=0;i<n;i++){
   const z=front-i*.07,a=time*.5+i*TAU/n;
   m.box(bx+Math.sin(a)*.14,by+.02+Math.cos(a)*.11,z,
     .035,.11,.035,i%2?'white':'cyan',.36+flash*1.2,a);
  }
 }else if(effect==='ignite'||effect==='splash'){ // pulsing exhaust and vent petals
  for(let i=0;i<n;i++){
   const a=TAU*i/n,blast=Math.max(.0,flash);
   const rad=.12+.06*Math.sin(time*6+i)+blast*.13;
   m.box(bx+Math.cos(a)*rad,by+.015+Math.sin(a)*rad,front-.14-blast*.22,
     .023,.035,.068,i%2?'orange':'warm',.18+blast*2.0,a);
  }
 }else if(effect==='gravity'){ // paired counter-rotating gravity halos
  for(let i=0;i<n;i++){
   const a=i*TAU/n+time*2.5;
   const r=.16+.045*Math.sin(time*3+i);
   m.box(bx+Math.cos(a)*r,by+.02+Math.sin(a)*r,front-.22,
     .038,.029,.044,i%2?'purple':'pink',.43+heat*.7,a);
  }
 }else if(effect==='arc'||effect==='energy'||effect==='pulse'){ // finite coil discharges
  for(let i=0;i<(high?4:2);i++){
   const a=i*TAU/4+time*9,src=front+.16;
   m.ribbon(bx+Math.sin(a)*.115,by+.03+Math.cos(a)*.075,src,
    bx+Math.sin(a+1)*.16,by+.03+Math.cos(a+1)*.10,front-.31,
    .011,i%2?'white':col,.30+flash*2.2,camera);
  }
 }
}


/**
 * FLUXSIDE / WYR-P1 — original camera-space induction pistol, following the
 * existing WYRDFLUX sculpt palette. A unique compact frame, chamber, rails,
 * cycling slide, brass detailing and true depth mesh. No image substitutes.
 * Preserve first-person GPU overlay and controller aim: cosmetics only.
 */
function drawFluxsidePistol(m,bx,by,bz,p){
 const flash=clamp((p.muzzleT||0)/.175,0,1),kick=clamp(p.recoil||0,0,1),
  quality=$('quality').value,detail=quality!=='battery',hi=quality==='high',
  slide=Math.min(.16,kick*.15+flash*.045),front=bz-.55;
 // Color and lighting match all installed pistol perks and the legendary
 // weapon currently fused with Fluxside; base silver is never erased.
 const pistolCombo=fluxsideUltraCombo(gun,mixGun);
 const pistolInstalled=PISTOL_UPGRADES.filter(u=>pistolHas(player?.perks,u.id.slice(3)));
 const pistolIds=pistolInstalled.map(u=>u.id.slice(3));
 const pistolTint=pistolCombo?.legend?.col||(
   pistolIds.includes('ignite')?'orange':pistolIds.includes('freeze')?'cyan':
   pistolIds.includes('chain')?'purple':pistolIds.includes('execute')?'red':
   pistolIds.includes('thunder')?'gold':null);
 // Recolored real alloy panels with chrome engravings, not a flat texture swap.
 const FLUXSIDE_CHROME_SKINSET={slide:pistolTint||'chrome',
  rail:pistolTint||'polished',collar:pistolTint||'chrome',grip:'black'};
 m.box(bx,by+.055,bz-.035,.35,.215,.59,'metal',.10);
 m.box(bx,by+.18,bz-.075+slide,.34,.115,.57,FLUXSIDE_CHROME_SKINSET.slide,.14);
 m.box(bx,by+.238,bz-.05+slide,.285,.032,.42,FLUXSIDE_CHROME_SKINSET.rail,.17);
 m.box(bx,by+.253,bz-.18+slide,.105,.024,.20,'black',.055);
 m.box(bx,by+.252,bz+.115+slide,.088,.047,.085,'chrome',.18); // rear sight
 m.box(bx,by+.262,front-.095+slide,.080,.058,.055,'chrome',.18); // front sight
 // Real double-beveled muzzle, not a full-length rifle barrel.
 m.box(bx,by+.075,front-.075,.195,.175,.22,'chrome',.14);
 m.box(bx,by+.078,front-.207,.166,.148,.05,FLUXSIDE_CHROME_SKINSET.collar,.13);
 m.box(bx,by+.078,front-.244,.090,.078,.034,'black',.025);
 // Grip, trigger bridge and copper/brass magazine heel.
 m.box(bx,by-.19,bz+.14,.235,.36,.22,'black',.08,-.16);
 m.box(bx,by-.37,bz+.19,.245,.065,.24,'brass',.17);
 m.box(bx,by-.18,bz-.085,.20,.055,.26,'titanium',.10);
 m.box(bx,by-.20,bz-.08,.095,.16,.08,'dark',.02);
 m.box(bx,by-.12,bz-.08,.055,.13,.05,'chrome',.20);
 // Recoil-driven chamber window and matched precision side ribs.
 for(const side of [-1,1]){
  m.box(bx+side*.176,by+.135,bz-.075+slide,.026,.115,.48,'chrome',.14);
  m.box(bx+side*.183,by+.092,bz-.21+slide,.018,.041,.23,'cyan',.38+flash*1.8);
  m.box(bx+side*.18,by-.10,bz+.14,.025,.28,.15,'brass',.09);
  m.box(bx+side*.123,by-.29,bz+.255,.022,.24,.035,'titanium',.09);
  m.box(bx+side*.153,by+.221,bz-.045+slide,.028,.025,.43,'chrome',.10);
  m.box(bx+side*.168,by+.038,bz-.31,.018,.035,.18,'polished',.09);
  if(detail){
   for(let j=0;j<5;j++){
    const z=bz+.108-j*.069;
    m.box(bx+side*.177,by+.203,z+slide,.025,.035,.035,'black',.045);
   }
   m.beam(bx+side*.115,by-.048,bz+.10,bx+side*.115,by-.044,front-.04,
    .025,'brass',.18);
  }
 }
 // Engraved, individually lit module inlays; all twenty can coexist.
 const signal={twin:'gold',fan:'pink',pierce:'cyan',bloom:'purple',
  ricochet:'gold',chain:'purple',ignite:'orange',freeze:'cyan',gravity:'purple',
  expose:'gold',drain:'red',shield:'blue',chrono:'cyan',burst:'orange',
  shards:'pink',seeker:'green',dash:'gold',thunder:'purple',energize:'cyan',execute:'red'};
 for(let i=0;i<pistolIds.length;i++){
  const color=signal[pistolIds[i]]||'gold',side=i%2?-1:1,
    z=bz+.12-Math.floor(i/2)*.055;
  m.box(bx+side*.173,by+.177,z+slide,.024,.033,.033,color,.55+.24*Math.sin(time*3+i)**2);
 }
 if(pistolIds.includes('twin')||pistolIds.includes('burst'))
  for(const side of [-1,1])m.box(bx+side*.065,by+.079,front-.24,.065,.057,.09,
   pistolIds.includes('burst')?'orange':'gold',.44+flash);
 if(pistolIds.includes('pierce'))for(const side of [-1,1])
  m.beam(bx+side*.11,by+.095,front-.41,bx+side*.11,by+.095,front-.04,.016,'cyan',.64+flash);
 if(pistolIds.some(id=>id==='gravity'||id==='bloom'||id==='thunder')){
  const steps=hi?12:8;
  for(let i=0;i<steps;i++){
   const a=TAU*i/steps+time*.9,b=a+TAU/steps;
   const tint=pistolIds.includes('gravity')?'purple':pistolIds.includes('thunder')?'gold':'cyan';
   m.beam(bx+Math.cos(a)*.13,by+.07+Math.sin(a)*.13,front-.14,
    bx+Math.cos(b)*.13,by+.07+Math.sin(b)*.13,front-.14,.010,tint,.20+flash*.8);
  }
 }
 // Flux capacitor and magnetic cheek vents are original WYRDFLUX geometry.
 m.box(bx,by-.024,bz-.22,.175,.075,.23,'black',.08);
 m.box(bx,by-.017,bz-.22,.092,.046,.19,'cyan',.65+flash*1.2);
 if(detail)for(let i=0;i<(hi?8:5);i++){
  const a=i*TAU/(hi?8:5),x=bx+Math.cos(a)*.115,y=by+.063+Math.sin(a)*.086;
  m.beam(x,y,front-.15,x+Math.cos(a)*.013,y+Math.sin(a)*.012,front-.01,
   .019,i%2?'chrome':'brass',.14);
 }
 if(flash>.02){
  m.box(bx,by+.08,front-.29,.11+flash*.13,.11+flash*.12,.17+flash*.22,'white',2.2*flash);
  for(let j=0;j<4;j++){
   const a=j*TAU/4+time*18;
   m.beam(bx,by+.08,front-.29,
    bx+Math.cos(a)*flash*.21,by+.08+Math.sin(a)*flash*.18,front-.47,
    .022,'cyan',1.2*flash);
  }
 }
}
function drawFirstPersonWeapon(p,aspect){
 if(!['play','pause','upgrade'].includes(phase))return;
 const a=viewmodelPose(p),baseMesh=new Mesh(),m=weaponMeshTransform(baseMesh,p),bx=a.x,by=a.y,bz=a.z;
 const glow=WEAPONS[gun].fusedWeapon?WEAPONS[gun].col:
   activeWorldStylePack().id==='black-chapel'?'magma':WEAPONS[gun].col;
 if(WEAPONS[gun].startingSidearm){drawFluxsidePistol(m,bx,by,bz,p);}else{

 // Subtle mechanics tied to the ACTUAL recoil and cooldown; no extra beam
 // crosses the reticle or stretches into the playable world.
 const action=clamp(p.recoil||0,0,1),flash=a.flash;
 const camQuality=$('quality').value;
 const weaponSpeed=WEAPONS[gun].rate;
 const sliderTravel=.11*action+.04*flash;
 const cycle=(time*TAU)/(Math.max(.14,weaponSpeed)*4);
 const weaponCharge=clamp((p.heat||0)*1.2,0,1);
 const triggerPulse=.5+.5*Math.sin(time*17+gun);
 for(const side of [-1,1]){
  m.box(bx+side*.205,by+.105,bz-.02+sliderTravel,.068,.095,.36,'chrome',.10);
  m.box(bx+side*.205,by+.169,bz-.17+sliderTravel,.038,.025,.15,glow,.22+flash*.65);
  m.box(bx+side*.205,by-.075,bz+.09-sliderTravel*.2,.055,.035,.18,'dark',.03);
 }
 if(camQuality!=='battery'){
  // The discharge rings close up after every shot, then recover smoothly.
  const rings=camQuality==='high'?6:4;
  for(let i=0;i<rings;i++){
   const t=i*TAU/rings+time*.29;
   const rad=.16+.024*Math.sin(t*2+gun)+flash*.08;
   m.box(bx+Math.cos(t)*rad,by+.025+Math.sin(t)*rad,bz-.64-sliderTravel,
    .031+flash*.013,.034+flash*.014,.056,flash>.04?'white':glow,
    .16+flash*.80,t);
  }
  if((p.heat||0)>.16){
   for(let j=0;j<3;j++){
    const spread=(j-1)*.13,y=by+.25+((time*.65+j*.29)%1)*.24;
    m.box(bx+spread+.04*Math.sin(time*2+j),y,bz-.28,.022,.047,.018,'mist',.025);
   }
  }
 }
 // Exposed mechanical details with genuinely time-dependent transforms:
 // cycling barrel, reciprocating bolt, vibrating energy conduit, recoil grip.
 if(camQuality!=='battery'){
  for(let j=0;j<5;j++){
   const phi=cycle+j*TAU/5,ring=.13+.06*weaponCharge;
   m.box(bx+Math.cos(phi)*ring,by+.11+Math.sin(phi)*ring,bz-.47-.08*action,
    .048,.049,.22,j%2?'chrome':glow,.25+flash*.85,phi);
  }
  m.box(bx-.29,by-.03-action*.08,bz+.07+sliderTravel,.10,.22,.32,'titanium',.09,-.09*action);
  m.box(bx+.23,by+.25+Math.sin(cycle*.45)*.015,bz-.19,
   .17,.045,.29,glow,.18+weaponCharge*.65);
  for(let j=0;j<3;j++){
   const dz=bz-.29-j*.11;
   m.beam(bx+.21,by-.03+Math.sin(cycle+j)*.018,dz,
    bx+.21,by+.13+Math.sin(cycle+j)*.018,dz-.04,
    .020,j%2?'purple':glow,.22+.55*weaponCharge);
  }
 }
 // Rounded barrel cuffs and softened side rails. Reuse the sculpted base
 // mesh but add actual 3D circular segments instead of more square boxes.
 const segments=camQuality==='high'?8:6;
 for(const side of [-1,1]){
  const cx=bx+side*.19,cy=by+.075,r=.092,front=bz-.58,back=bz-.12;
  for(let j=0;j<segments;j++){
   const a=j*TAU/segments,b=(j+1)*TAU/segments;
   const x1=cx+Math.cos(a)*r,y1=cy+Math.sin(a)*r;
   const x2=cx+Math.cos(b)*r,y2=cy+Math.sin(b)*r;
   m.beam(x1,y1,front,x2,y2,front,.023,'chrome',.12+flash*.28);
   if(j%2===0)m.beam(x1,y1,front,x1,y1,back,.031,'titanium',.085);
  }
 }
 // Retained camera-space silhouette, upgraded with weapon-specific attachments.
 addCinematicWeaponParts(m,bx,by,bz);
 drawAnimatedWeaponRig(m,bx,by,bz,p);
 drawWyrdfluxWeaponSignatureFX(m,bx,by,bz,p);
  // Every inherited fusion element is visibly encoded on this gun.
  if(WEAPONS[gun].fusedWeapon){
   const palette={arc:'purple',energy:'cyan',splash:'orange',scatter:'gold',
     pierce:'pink',ignite:'orange',freeze:'cyan',gravity:'purple',shred:'green',
     recoil:'white',shield:'blue',vamp:'red',overclock:'gold'};
   for(const [i,trait] of (WEAPONS[gun].fusionTraits||[]).slice(0,10).entries()){
     const theta=i*2.399963+time*.4,ring=.14+(i%3)*.07;
     m.box(bx+Math.sin(theta)*ring,by+.03+Math.cos(theta)*ring,bz-.38-(i%4)*.085,
       .045,.045,.12,palette[trait]||WEAPONS[gun].col,.48+.22*Math.sin(time*7+i));
   }
  }
 if(BLENDER_KIT&&$('quality').value!=='battery')
  blenderPart(m,'gun_induction_coil',bx,by+.04,bz-.20,.63,0);

 // World-specific forged barrel/rib overlay: combat physics/weapon data unchanged.
 if(activeWorldStylePack().id==='black-chapel'){
  const recoil=clamp(p.recoil||0,0,1),heat=clamp(p.heat||0,0,1);
  for(const side of [-1,1]){
   m.box(bx+side*.235,by+.015,bz-.13+.09*recoil,
      .115,.235,.53,'ironblack',.035,side*.16);
   m.box(bx+side*.29,by+.12,bz-.22,.078,.069,.29,'bone',.024);
   m.beam(bx+side*.24,by-.10,bz+.25,bx+side*.25,by+.01,bz-.56,
      .033,'sinew',.06);
  }
  m.box(bx,by+.24,bz+.15,.18,.18,.46,'hellstone',.06);
  m.box(bx,by+.31,bz-.30,.14,.045,.25,'magma',.26+heat*.65);
  for(let j=0;j<4;j++){
   const z=bz-.48-j*.125;
   m.box(bx,by+.16,z,.11,.022,.075,'sulfur',.11+recoil*.48);
  }
 }

 // Receiver and charge rails preserve the earlier rifle outline.
 m.box(bx,by,bz,.32,.27,.68,'metal',.09);
 m.box(bx,by+.125,bz,.25,.09,.72,'rim');
 m.box(bx,by-.10,bz+.12,.17,.29,.17,'black');
 m.box(bx,by+.17,bz-.18,.12,.065,.31,glow,1.25);
 m.box(bx,by-.16,bz+.1,.20,.13,.20,'dark');
 m.box(bx,by+.08,bz+.19,.16,.06,.21,'brass',.12);
 // Every forward-facing component is now laid out in local -Z.
 m.box(bx,by+.005,bz-.50,.14,.105,.46,'dark');
 for(const side of [-1,1]){
  m.box(bx+side*.09,by+.018,bz-.54,.035,.055,.43,'rim');
  m.box(bx+side*.07,by-.056,bz-.26,.032,.038,.19,'metal2');
 }
 const barrelZ=bz-.79;
 m.box(bx,by+.02,barrelZ,.165,.14,.13,glow,1.6+(p.heat||0)*1.4);
 m.box(bx,by+.025,barrelZ-.05,.104,.09,.048,'black');
 const tip=barrelZ-.105,ey=by+.025;
 if(a.flash>0){
  const f=a.flash,energy=4.1*f;
  m.box(bx,ey,tip,.11+.21*f,.11+.19*f,.11+.23*f,'white',energy);
  const cam={x:0,y:0,z:0};
  for(let j=0;j<6;j++){
   const t=j*TAU/6+time*14,spread=.21+.12*f;
   m.ribbon(bx,ey,tip,
    bx+Math.cos(t)*spread,ey+Math.sin(t)*spread*.7,tip-.24*f,
    .020+.022*f,glow,2.8*f,cam);
  }
 }
 if((p.heat||0)>.03){
  m.box(bx,by+.06,bz-.62,.10+(p.heat||0)*.11,.08+(p.heat||0)*.10,.10+(p.heat||0)*.10,glow,(p.heat||0)*1.3);
 }
 }
 drawWyrdfluxWeaponSteam(m,bx,by,bz,p);
 // Overlay pass: clear only depth so the weapon never intersects world walls,
 // and apply a fixed near-camera view instead of the rotating world view.
 gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.uniformMatrix4fv(U.proj,false,perspective(1.03,aspect,.035,12));
 gl.uniformMatrix4fv(U.view,false,lookAt(0,0,0,0,0,-1));
 gl.uniform3f(U.eye,0,0,0);
 gl.uniform3f(U.lightPos,.3,.65,-.5);
 gl.uniform4f(U.shotLamp,0,0,0,0); // camera-space weapon is separately lit
 gl.uniform4f(U.impactLightA,0,0,0,0);gl.uniform4f(U.impactLightB,0,0,0,0); // never brighten camera-space gun
 gl.uniform1f(U.flash,0);
 upload(viewmodelGPU,baseMesh.data);
 drawMesh(viewmodelGPU);
}


/**
 * Bounded animated environmental render kit. All decorative, no collisions or
 * enemy AI changes. Quality-tiered to preserve affordable Android preview.
 */
function drawCinematicAtmosphere(m,p,quality){
 const accent=['green','purple','red','blue'][sector%4];
  const accent2=['blue','green','purple','red'][(sector+1)%4];
 const cam={x:p.x,y:1.64+p.height,z:p.z};
 const high=quality==='high',battery=quality==='battery';
 // Fast hairline sky streaks. The previous thick searchlight cones are removed.
 // Only small fast filaments remain, moving rapidly across the skyline.
 const streaks=battery?2:high?8:5,skyCols=['cyan','blue','purple','red','green'];
 for(let i=0;i<streaks;i++){
  const progress=((time*(23+i*1.73)+i*13.37+sector*9.43)%84)-42;
  const x=C+progress,z=C-16+(i*7.1)%32;
  const y=9.8+(i%4)*1.65,col=skyCols[(i+sector)%skyCols.length];
  m.beam(x,y,z,x+.22,y+.012,z+.09,.008,col,.11);
  if(high&&i%3===0)m.beam(x-.11,y,z,x+.07,y+.008,z+.04,.004,'white',.075);
 }
 // Slow orbital delivery craft and thermal thruster streaks above the skyline.
 const ships=battery?1:high?4:2;
 for(let i=0;i<ships;i++){
  const phase=time*(.19+i*.008)+i*2.7,radius=18.5+i*1.5;
  const x=C+Math.sin(phase)*radius,z=C+Math.cos(phase)*radius;
  const y=7.2+(i%3)*2.25+.22*Math.sin(time*.4+i);
  const yaw=phase+.13,col=i%2?'warm':accent;
  m.box(x,y,z,.64,.13,.91,'steelblue',.12,yaw);
  m.box(x,y+.06,z,.29,.17,.34,'chrome',.19,yaw);
  for(const side of [-1,1]){
   m.box(x+side*.46,y-.01,z,.34,.055,.27,'titanium',.08,yaw);
   m.box(x+side*.48,y-.065,z+.26,.14,.04,.16,col,1.55);
  }
  m.beam(x,y,z+.20,x+Math.sin(phase-.4)*.14,y-.02,z+Math.cos(phase-.4)*.19+.22,
   .008,col,.18);
 }
 // Removed recurring floating central magnetic rings and electrical arcs.
 // Restrained steam from inactive service vents. No additional ceiling lights.
 if(!battery){
  for(let i=0;i<(high?9:5);i++){
   const x=3+((i*13+sector*7)%25),z=3+((i*17+sector*3)%25);
   if(tile(x,z))continue;
   const base=time*.53+i*.83;
   for(let j=0;j<(high?4:3);j++){
    const py=.11+j*.22+((base*1.4)%1)*.13,ang=base+j*1.8;
    m.box(x+.18*Math.sin(ang),py,z+.18*Math.cos(ang*.7),
     .031+j*.011,.055+j*.019,.024+j*.008,j%2?'mist':'glass',.04);
   }
  }
 }
 // Distant falling sparks, illuminated rain and drifting atmospheric ash.
 // Render near the player so the particles remain visible in the larger world.
 const count=battery?15:high?62:37;
 for(let i=0;i<count;i++){
  const a=i*17.593,px=p.x+((Math.sin(a*1.19)*1049.7+time*(i%4===0?.34:.12))%24+36)%24-12;
  const pz=p.z+((Math.cos(a*.57)*791.31+time*(i%6===0?.23:.10))%24+36)%24-12;
  const py=.12+((i*.317+time*(i%3===0?.23:.09))%4.6);
  const warm=(i+sector)%7===0;
  const flick=.45+.55*Math.sin(time*1.7+i*2.1);
  if(px<1||px>N-1||pz<1||pz>N-1)continue;
  m.box(px,py,pz,warm?.019:.014,warm?.044:.11,warm?.016:.012,warm?'warm':'mist',warm?flick*.26:.055);
 }
}

let lastBossWarningKey='';
function syncCinematicHUD(){
 // Update UI only when the state changes; the charge meter reflects the
 // actual 1.45/1.8s server-side boss countdown, not a decorative fake timer.
 const quality=$('quality').value,sectorID=String(sector);
 if(document.body.dataset.sector!==sectorID)document.body.dataset.sector=sectorID;
 if(document.body.dataset.quality!==quality)document.body.dataset.quality=quality;
 const box=$('bossWarning');
 if(!box)return;
 const core=phase==='play'&&!bossCine.active?enemies.find(e=>e.type==='puppet'&&e.puppet):null;
 const vital=$('puppetVitals');
 if(vital){
  vital.classList.toggle('hidden',!core);
  if(core){
   const p=core.puppet;
   $('puppetLeftBar').style.width=(100*p.left/p.leftMax).toFixed(1)+'%';
   $('puppetRightBar').style.width=(100*p.right/p.rightMax).toFixed(1)+'%';
   $('puppetCoreBar').style.width=(100*p.head/p.headMax).toFixed(1)+'%';
   vital.classList.toggle('exposed',p.phase!=='arms');
   $('puppetPhase').textContent=p.phase==='arms'?'DISABLE BOTH CANNONS':
    p.phase==='reborn'?'SECOND ROUND · REFORMED BRAIN':'EXPOSED CORE // FINISH IT';
  }
 }
 const boss=phase==='play'?enemies.find(e=>isBoss(e)&&(e.ultimateStage==='charge'||e.ultimateStage==='fire')):null;
 const stage=boss?.ultimateStage||'idle', key=boss?boss.id+':'+stage:'idle';
 if(key!==lastBossWarningKey){
  lastBossWarningKey=key;
  box.classList.toggle('hidden',!boss);
  box.classList.toggle('firing',stage==='fire');
  if(boss){
   $('bossWarningText').textContent=boss.type==='ophanim'?
    (stage==='charge'?'CELESTIAL JUDGEMENT CHARGING':'CELESTIAL JUDGEMENT — EVADE!'):
    (stage==='charge'?'ULTIMATE LASER CHARGING':'ULTIMATE LASER — EVADE!');
   const hint=box.querySelector('.bossWarningHint');
   if(hint)hint.textContent=boss.type==='ophanim'?
    (stage==='charge'?'MOVE OUT OF THE GOLDEN CIRCLE':'RADIANT BURSTS · KEEP MOVING'):
    (stage==='charge'?'BREAK LINE OF FIRE · PREPARE TO DASH':'SWEEP ACTIVE · MOVE OUT OF THE BEAM');
  }
 }
 if(boss&&stage==='charge'){
  const duration=boss.type==='ophanim'?1.85:boss.type==='colossus'?1.8:1.45;
  const pct=clamp(1-boss.ultimateT/duration,0,1)*100;
  box.style.setProperty('--charge',pct.toFixed(1)+'%');
 }
}
// Near-field contact shadow decals make articulated enemies read as grounded.
// They are blended on real depth-tested floor geometry before opaque enemies.
// This is a material-space shadow approximation, not a ray-traced shadow map.
let lastContactShadows=0,lastContactVertices=0;
function contactShadowDisk(m,x,z,r,alpha,quality){
 const steps=quality==='high'?16:quality==='balanced'?12:9;
 const levels=quality==='high'?3:quality==='balanced'?2:1;
 for(let layer=levels;layer>=1;layer--){
  const radius=r*(.49+.51*layer/levels);
  const opacity=Math.min(.26,alpha*(layer===1?1:.38));
  const color=[.006,.009,.018],normal=[0,1,0],negativeGlow=-1-opacity;
  for(let i=0;i<steps;i++){
   const angle=i*TAU/steps,next=(i+1)*TAU/steps;
   m.v([x,.018,z],normal,color,negativeGlow,0,0);
   m.v([x+Math.cos(angle)*radius,.018,z+Math.sin(angle)*radius],
    normal,color,negativeGlow,1,0);
   m.v([x+Math.cos(next)*radius,.018,z+Math.sin(next)*radius],
    normal,color,negativeGlow,1,1);
  }
 }
}
function renderContactShadows(quality){
 const shadow=new Mesh(),budget=quality==='high'?24:quality==='balanced'?17:10;
 const visible=enemies.filter(e=>e.hp>0&&(e.appearT||0)<.25&&e.type!=='wallmaw'&&Math.hypot(e.x-player.x,e.z-player.z)<(quality==='high'?21:16))
  .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))
  .slice(0,budget);
 lastContactShadows=visible.length+(player.height>.08?1:0);
 for(const e of visible){
  const boss=isBoss(e),fly=e.type==='drone';
  const radius=e.type==='wallmaw'?.55:e.type==='puppet'?2.65:boss?1.75:fly?.66:e.type==='crusher'||e.type==='bulwark'?.75:.55;
  const elevation=fly?1.5:e.type==='puppet'?2.5:0;
  const strength=fly?.10:e.type==='puppet'?.21:boss?.20:.155;
  contactShadowDisk(shadow,e.x,e.z,radius,strength*(elevation?.8:1),quality);
 }
 if(player.height>.08)contactShadowDisk(shadow,player.x,player.z,
  .37+player.height*.12,.14/(1+player.height*.2),quality);
 lastContactVertices=shadow.data.length/12;
 if(!shadow.data.length)return;
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);gl.disable(gl.CULL_FACE);
 upload(dynamicGPU,shadow.data);drawMesh(dynamicGPU);
 gl.enable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);
}

/* AFTERLIGHT PC native screen-space health HUD.
 * Enemy bars are projected from their moving 3D coordinates each render tick,
 * never rotate with monster meshes, and are drawn over all WebGL geometry.
 * A hit reveals an enemy bar for 1.5 seconds. Bosses are anchored top-center
 * until dead, regardless of whether their head is on screen. */
const afterlightPcHealth={layer:null,nodes:[],boss:null,bossName:null,count:0,bossHP:0,damageVisible:0};
function afterlightPcHealthInit(){
 if(!desktopPC)return;
 if(afterlightPcHealth.layer)return;
 const layer=document.createElement('div');
 layer.id='afterlightPcHealthLayer';layer.setAttribute('aria-hidden','true');
 const count=18;
 for(let i=0;i<count;i++){
  const bar=document.createElement('div');bar.className='afterlightTargetHealth';
  const tail=document.createElement('div');tail.className='afterlightTargetHealthTrail';
  const fill=document.createElement('div');fill.className='afterlightTargetHealthFill';
  const crown=document.createElement('span');crown.className='afterlightTargetHealthPip';
  const back=document.createElement('div');back.className='afterlightTargetHealthTrack';
  back.append(tail,fill,crown);bar.append(back);layer.append(bar);
  afterlightPcHealth.nodes.push({bar,tail,fill,crown});
 }
 const boss=document.createElement('section');boss.id='afterlightBossHealth';
 const caption=document.createElement('div');caption.className='afterlightBossHealthCaption';
 const tag=document.createElement('span');tag.textContent='THREAT DETECTED // BOSS';
 const title=document.createElement('strong');title.id='afterlightBossHealthName';
 const fraction=document.createElement('b');fraction.id='afterlightBossHealthValue';
 caption.append(tag,title,fraction);
 const track=document.createElement('div');track.className='afterlightBossHealthTrack';
 const trail=document.createElement('div');trail.className='afterlightBossHealthTrail';
 const fill=document.createElement('div');fill.className='afterlightBossHealthFill';
 const segments=document.createElement('div');segments.className='afterlightBossHealthSegments';
 track.append(trail,fill,segments);boss.append(caption,track);layer.append(boss);
 afterlightPcHealth.layer=layer;const shieldTrack=document.createElement('div');shieldTrack.className='wyrdfluxTravelerShieldTrack';
 const shieldFill=document.createElement('div');shieldFill.className='wyrdfluxTravelerShieldFill';
 const shieldLabel=document.createElement('span');shieldLabel.className='wyrdfluxTravelerShieldLabel';
 shieldTrack.append(shieldFill,shieldLabel);boss.append(shieldTrack);
 afterlightPcHealth.boss={root:boss,title,fraction,trail,fill,shieldTrack,shieldFill,shieldLabel};
 document.body.appendChild(layer);
}
function afterlightPcProject(worldPos,view,proj,rect){
 const x=worldPos[0],y=worldPos[1],z=worldPos[2];
 const vx=view[0]*x+view[4]*y+view[8]*z+view[12],
  vy=view[1]*x+view[5]*y+view[9]*z+view[13],
  vz=view[2]*x+view[6]*y+view[10]*z+view[14],
  vw=view[3]*x+view[7]*y+view[11]*z+view[15];
 const clipX=proj[0]*vx+proj[4]*vy+proj[8]*vz+proj[12]*vw;
 const clipY=proj[1]*vx+proj[5]*vy+proj[9]*vz+proj[13]*vw;
 const clipW=proj[3]*vx+proj[7]*vy+proj[11]*vz+proj[15]*vw;
 if(clipW<=.05||!Number.isFinite(clipX)||!Number.isFinite(clipY))return null;
 const nx=clipX/clipW,ny=clipY/clipW;
 if(Math.abs(nx)>1.04||Math.abs(ny)>1.04)return null;
 return [rect.left+rect.width*(nx+1)*.5,rect.top+rect.height*(1-ny)*.5,clipW];
}
function afterlightPcBossTitle(e){
 if(e.meadowBossName)return e.meadowBossName;
 if(e.wyrdfluxRareBoss)return WYRD_RARE_BOSSES[e.wyrdfluxRareBoss]?.name||e.type;
 const def=BOSS_REVEALS[e.type];
 return String(def?.name||def?.title||e.type||'UNKNOWN TITAN').replace(/[_-]/g,' ').toUpperCase();
}
function renderAfterlightPcHealth(view,proj){
 if(!desktopPC)return;
 afterlightPcHealthInit();
 const hide=phase!=='play'||introCine.active||bossCine.active;
 if(!afterlightPcHealth.layer)return;
 afterlightPcHealth.layer.style.display=hide?'none':'block';
 if(hide){afterlightPcHealth.count=0;
  document.body.classList.remove('wyrdflux-boss-on');return;}
 const rect=world.getBoundingClientRect();
 const krakenEncounter=livingRealm.active&&livingRealm.id==='blackwake'&&blackwakeKraken.state==='active';
 const bossTarget=krakenEncounter?{
   type:'kraken',hp:blackwakeKraken.hp,maxHp:blackwakeKraken.maxHp,
   meadowBossName:'THE BLACKWAKE KRAKEN',pcHealthTrail:blackwakeKraken.hp/Math.max(1,blackwakeKraken.maxHp)
 }:livingRealm.active?null:enemies.find(e=>e.hp>0&&isBoss(e));
 document.body.classList.toggle('wyrdflux-boss-on',!!bossTarget);
 const bossHud=afterlightPcHealth.boss;
 bossHud.root.style.display=bossTarget?'block':'none';
 if(bossTarget){
   const theme=krakenEncounter?'blackwake':bossTarget.type==='wallmaw'?'wallmaw':
     bossTarget.type==='ophanim'?'heaven':bossTarget.type==='warden'?'blockworld':
     hellBreach.state==='active'?'hell':bossTarget.type==='colossus'?'siege':
     bossTarget.type==='behemoth'?'siege':bossTarget.type==='overseer'?'hive':'default';
   bossHud.root.dataset.bossTheme=theme;
   const label=bossHud.root.querySelector('.afterlightBossHealthCaption span');
   if(label)label.textContent=krakenEncounter?'TIDAL ABYSS // ANCIENT KRAKEN':
     theme==='hell'?'INFERNAL TYRANT // HELL BREACH':
     theme==='wallmaw'?'THE WALL ITSELF IS ALIVE':
     theme==='heaven'?'CELESTIAL JUDGMENT':
     theme==='blockworld'?'ANCIENT CORE // GUARDIAN':
     theme==='siege'?'SIEGE PROTOCOL // COMMANDER':
     'THREAT DETECTED // BOSS';
  const pct=clamp(bossTarget.hp/Math.max(1,bossTarget.maxHp),0,1);
  const rite=bossTarget.wardenRite;
  const left=rite?.active?enemies.filter(x=>x.wardenMite&&x.wardenParentId===bossTarget.id).length:0;
  bossHud.title.textContent=rite?.active?
   'IRON WARDEN · SHIELDED · MITES '+(Math.max(0,120-(rite?.spawned||0))+left)+' LEFT':
   afterlightPcBossTitle(bossTarget);
  bossHud.fraction.textContent=Math.ceil(bossTarget.hp)+' / '+Math.ceil(bossTarget.maxHp);
   const isTraveler=bossTarget.type==='traveler';
   bossHud.shieldTrack.style.display=isTraveler?'block':'none';
   if(isTraveler){
    const shieldPct=clamp((bossTarget.travelerShield||0)/Math.max(1,bossTarget.travelerShieldMax),0,1);
    bossHud.shieldFill.style.width=(shieldPct*100).toFixed(2)+'%';
    bossHud.shieldLabel.textContent=shieldPct>0?
     'SHIELD '+Math.ceil(bossTarget.travelerShield)+' / '+Math.ceil(bossTarget.travelerShieldMax):
     'SHIELD BROKEN · CORE EXPOSED';
   }
  bossHud.fill.style.width=(100*pct).toFixed(2)+'%';
  bossHud.trail.style.width=(100*Math.max(pct,
   time<(bossTarget.pcHealthTrailUntil||0)?bossTarget.pcHealthTrail||pct:pct)).toFixed(2)+'%';
  afterlightPcHealth.bossHP=pct;
 }else afterlightPcHealth.bossHP=0;
 const damaged=enemies.filter(e=>e.hp>0&&!isBoss(e)&&!e.wardenMite&&
  Number.isFinite(e.pcLastHealthHit)&&time-e.pcLastHealthHit<1.5)
  .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-
                Math.hypot(b.x-player.x,b.z-player.z)).slice(0,afterlightPcHealth.nodes.length);
 let used=0;
 for(const e of damaged){
  const h=e.meadowKind?1.31:e.type==='drone'?2.36:
   e.hellVariant==='pinky'?2.22:2.47;
  const y=(window.VEILFORGE_MEADOW_GPU?.heightAt&&afterlightMeadowActive()?
   window.VEILFORGE_MEADOW_GPU.heightAt(e.x,e.z):0)+h;
  const coords=afterlightPcProject([e.x,y,e.z],view,proj,rect);
  if(!coords)continue;
  const node=afterlightPcHealth.nodes[used++];
  const age=time-e.pcLastHealthHit,alpha=age>1?.95*clamp((1.5-age)/.5,0,1):.95;
  const pct=clamp(e.hp/Math.max(1,e.maxHp),0,1);
  const lag=time<(e.pcHealthTrailUntil||0)?Math.max(pct,e.pcHealthTrail||pct):pct;
  const width=clamp(72+75/(1+coords[2]*.10),74,142);
  node.bar.style.cssText='display:block;opacity:'+alpha.toFixed(2)+
    ';width:'+Math.round(width)+'px;transform:translate(-50%,-100%) translate('+
    Math.round(coords[0])+'px,'+Math.round(coords[1])+'px)';
  node.tail.style.width=(100*lag).toFixed(2)+'%';
  node.fill.style.width=(100*pct).toFixed(2)+'%';
  node.crown.textContent=Math.ceil(e.hp);
 }
 for(let i=used;i<afterlightPcHealth.nodes.length;i++)
  afterlightPcHealth.nodes[i].bar.style.display='none';
 afterlightPcHealth.count=used;afterlightPcHealth.damageVisible=damaged.length;
}

function activePistolShotLight(){
 // Hit-scan gameplay stays unchanged; its traveling bolt lights the scene.
 // One strongest source limits GPU cost on the owner's older NVIDIA card.
 let best=null;
 for(const b of tracers){
  if(!b.pistolGlow||b.life<=0)continue;
  const elapsed=b.max-b.life,dx=b.x2-b.x1,dy=b.y2-b.y1,dz=b.z2-b.z1;
  const len=Math.hypot(dx,dy,dz);
  if(len<.08||elapsed*37>len+.30)continue;
  if(!best||elapsed<best.elapsed)best={b,elapsed,len,dx,dy,dz};
 }
 if(!best)return [0,0,0,0];
 const {b,elapsed,len,dx,dy,dz}=best,t=clamp(elapsed*37/len,0,1);
 return [b.x1+dx*t,b.y1+dy*t,b.z1+dz*t,1.55*Math.max(0,1-elapsed*.8)];
}
// Stage real collision/armor flash lights on the *existing* PC high GPU path.
// No new lights on Android, during menus or in Blender-authored living realms.
// Cap the two brightest nearby events so automatic guns cannot flood the scene.
function wyrdfluxCinematicImpactLights(p){
 const off={a:[0,0,0,0],b:[0,0,0,0],ta:[0,0,0],tb:[0,0,0]};
 if(!desktopPC||$('quality').value!=='high'||phase!=='play'||livingRealm.active)return off;
 const eyeY=1.64+(p.height||0);
 let first=null,second=null;
 function consider(fx,power){
  if(!(power>.005)||!Number.isFinite(fx.x)||!Number.isFinite(fx.y)||!Number.isFinite(fx.z))return;
  const distance=Math.hypot(fx.x-p.x,fx.y-eyeY,fx.z-p.z);
  if(distance>15)return;
  const score=power/(1+distance*.13);
  const item={fx,power,score};
  if(!first||score>first.score){second=first;first=item;}
  else if(!second||score>second.score)second=item;
 }
 for(const fx of wyrdfluxContactFX){
  if(fx.delay>0||fx.life<=0)continue;
  const fade=clamp(fx.life/Math.max(.01,fx.max),0,1);
  consider(fx,Math.min(1.25,(fx.kind==='rocket'?1.15:.73)*fade*fade));
 }
 for(const fx of impactFlashes){
  if(fx.life<=0)continue;
  const fade=clamp(fx.life/Math.max(.01,fx.max),0,1);
  consider(fx,(fx.scale>.4?.95:.50)*fade*fade);
 }
 function pack(item){
  if(!item)return [[0,0,0,0],[0,0,0]];
  const fx=item.fx,tint=HEX[fx.col]||HEX.warm;
  return [[fx.x,fx.y,fx.z,item.power],tint];
 }
 const a=pack(first),b=pack(second);
 return {a:a[0],ta:a[1],b:b[0],tb:b[1]};
}
function render(){
 document.body.classList.toggle('hell-breach',hellBreach.state==='active');
 document.body.classList.toggle('wyrdflux-circus',circus.state==='active');
 document.body.classList.toggle('heaven-sanctum',heavenSanctum.state==='active');
 syncCinematicHUD();if(player&&!introCine.active)updateTargetReticle();const p=player||defaultPlayer();const cineCam=introCine.active?cinematicCamera():bossCine.active?bossCamera():null;const ratio=Number(devicePixelRatio)||1;const q=$('quality').value;// Desktop render targets are independently supersampled and no longer
 // bound by Android's 1.6x DPR and aggressive battery-mode raster cap.
 const res=(desktopPC&&q==='high'?Math.max(1.55,Math.min(ratio*1.25,2.25)):
   q==='high'?Math.min(ratio,1.6):q==='balanced'?Math.min(ratio,1.12):.7)*framePacing.scale;
 const maxW=desktopPC?3840:8192,maxH=desktopPC?2160:8192;
 const w=Math.max(1,Math.min(maxW,Math.round(world.clientWidth*res))),
  h=Math.max(1,Math.min(maxH,Math.round(world.clientHeight*res)));if(world.width!==w||world.height!==h){world.width=w;world.height=h;gl.viewport(0,0,w,h)}gl.clearColor(circus.state==='active'?.048:blockworld.state==='active'?(blockworld.stage===3?.018:.29):heavenSanctum.state==='active'?.50:hellBreach.state==='active'?.003:.017,circus.state==='active'?.022:blockworld.state==='active'?(blockworld.stage===3?.072:.49):heavenSanctum.state==='active'?.64:hellBreach.state==='active'?.001:.016,circus.state==='active'?.030:blockworld.state==='active'?(blockworld.stage===3?.092:.70):heavenSanctum.state==='active'?.79:hellBreach.state==='active'?.006:.047,1);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);
 const lessMotion=matchMedia('(prefers-reduced-motion: reduce)').matches?.24:1;
 const shudder=hellBreach.state==='active'&&hellTremorLife>0?
  .034*lessMotion*clamp(hellTremorLife/.86,0,1)*Math.sin(time*26):0;
 const wobble=shake*(rnd()-.5)*.12+shudder;
 const oldYaw=p.yaw;p.yaw+=wobble;
 const pcProj=perspective(Math.PI/(inputs.focus?3.95:2.9)+p.fovKick,w/h,.05,85);
 const pcView=cameraView();
 gl.uniformMatrix4fv(U.proj,false,pcProj);
 gl.uniformMatrix4fv(U.view,false,pcView);p.yaw=oldYaw;gl.uniform1f(U.simulationPower,puppetPower());
 gl.uniform3f(U.eye,cineCam?cineCam.x:p.x,cineCam?cineCam.y:1.64+p.height,cineCam?cineCam.z:p.z);gl.uniform3f(U.lightPos,C,2.5,C);const pistolLamp=activePistolShotLight();gl.uniform4f(U.shotLamp,...pistolLamp);gl.uniform3f(U.shotTint,.18,.76,1.0);gl.uniform3f(U.sectorTint,...(circus.state==='active'?[.62,.28,.16]:blockworld.state==='active'?(blockworld.stage===3?[.03,.55,.65]:[.23,.61,.28]):heavenSanctum.state==='active'?[.91,.75,.45]:hellBreach.state==='active'?[.72,.08,.12]:[[.34,.1,.8],[.03,.66,.6],[.7,.12,.52],[.95,.29,.12],[.44,.62,.14],[.27,.36,.91],[.91,.15,.32]][sector]||[.3,.3,.5]));gl.uniform1f(U.hellLevel,hellBreach.state==='active'?1:0);gl.uniform3f(U.flashDir,Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch));gl.uniform1f(U.flashPower,hellBreach.state==='active'&&stacks('hellflash')&&p.hellFlashOn?1.7:0);gl.uniform1f(U.styleCode,updateWorldStyle().shaderCode);gl.uniform1f(U.clock,time);gl.uniform1f(U.visualQuality,q==='high'?1:q==='balanced'?.65:.25);gl.uniform1f(U.flash,damageUntil>time?.2:0);const impactLamps=wyrdfluxCinematicImpactLights(p);gl.uniform4f(U.impactLightA,...impactLamps.a);gl.uniform4f(U.impactLightB,...impactLamps.b);gl.uniform3f(U.impactTintA,...impactLamps.ta);gl.uniform3f(U.impactTintB,...impactLamps.tb);gl.uniform1f(U.overdrive,0);drawMesh(staticGPU);
 if(livingRealm.active){
  const renderer=livingRenderer(livingRealm.id);
  if(renderer?.state.status==='ready')renderer.draw(gl,pcProj,pcView,[p.x,1.64+p.height,p.z],time,[]);
  gl.useProgram(prog);gl.enable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);
  const scenery=new Mesh();drawLivingRealmAmbient(scenery,p,q);drawWyrdfluxShadowDrones(scenery,p,q);
  upload(dynamicGPU,scenery.data);drawMesh(dynamicGPU);
  if(!bossCine.active)drawFirstPersonWeapon(p,w/h);
  if(phase==='play'&&!bossCine.active)drawRadar();
  // Show the Kraken boss HP before the isolated realm renderer returns.
  if(desktopPC)renderAfterlightPcHealth(pcView,pcProj);
  return;
 }
 if(!introCine.active)renderContactShadows(q);else{lastContactShadows=0;lastContactVertices=0;}
 const m=new Mesh();drawWyrdfluxShadowDrones(m,p,q);drawOriginalSectorFinesse(m,p,q);drawLivingWorldGate(m);drawBlackwakeEntranceFX(m,q);drawCircusSignals(m,q);drawCircusStage(m,q);renderPuppetFinale(m,q);blenderVertices=0;blenderPassModels=0;lastMotionDetails=0;infernalOrganicModels=0;pinkyDrawn=0;hellKnightDrawn=0;impDrawn=0;demonAnimatedVertices=0;organicFootPlants=0;organicLockedFeet=0;organicStanceVertices=0;organicIKVertices=0;organicDeathFrames=0;
 const motionBudget=q==='battery'?0:q==='high'?10:6;
 visibleEnemyMeshes=0;culledEnemyMeshes=0;spawnVisuals=0;
 if(circus.state!=='active'&&heavenSanctum.state!=='active'&&blockworld.state!=='active'&&!afterlightMeadowActive())for(const r of RELAYS){const on=!!relayState[r.id],col=on?'cyan':'orange',pulse=.82+Math.sin(time*2.4+r.x)*.13;
 m.box(r.x,.12,r.z,1.45,.23,1.45,'metal2');m.box(r.x,.25,r.z,1.12,.08,1.12,'rim');m.box(r.x,.84,r.z,.34,1.1,.35,on?'metal':'dark');
 for(const side of [-1,1]){m.box(r.x+side*.48,.62,r.z,.09,.78,.09,'rim');m.box(r.x+side*.48,1.02,r.z,.24,.075,.18,col,pulse*1.8)}
 // The video caught this floating neon box from a few inches away.
 const relayNear=Math.hypot(r.x-p.x,r.z-p.z);
 if(relayNear>.67)m.box(r.x,1.38+Math.sin(time*2+r.x)*.08,r.z,
  .29,.14,.29,col,pulse*.87);m.box(r.x,.23,r.z,.75,.02,.75,col,on?1.5:.35);
 }
 // No floating central power cube: underlying core objective stays functional.
 if(introCine.active)drawOpeningActors(m,q,cineCam);
 if(!introCine.active)for(const e of enemies){
   // Keep v0.50 latest renderer hardening: reject transient invalid actors
   // before distance culling or submission of geometry.
   if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.z)){
    culledEnemyMeshes++;continue;
   }
   if(!enemyRenderVisible(e,p,q)){culledEnemyMeshes++;continue;}
   visibleEnemyMeshes++;
   if((e.appearT||0)>.25){drawSpawnSignal(m,e,q);spawnVisuals++;continue;}
   if(e.blockKind)drawBlockMob(m,e,q);
    else if(e.hellVariant)drawHellFiend(m,e,q);
   else{
    addRobot(m,e);
    drawBasicThrusterRushFX(m,e,q);
    if(!e.blockKind&&!e.saucer&&e.type!=='ophanim'&&lastMotionDetails<motionBudget&&drawEnemyMotionPolish(m,e,q))lastMotionDetails++;
   }
   drawWyrdfluxWeakspotVisual(m,e,q);
   drawWyrdfluxRareBoss(m,e,q);
   if(e.type==='puppet')renderPuppetBeams(m,e,q,{x:p.x,y:1.64+p.height,z:p.z});
   else{
    // Organic Hell enemies have no robot sword or neon blade attack overlays.
    if(!e.circusActor&&!e.hellVariant&&!e.blockKind&&!e.saucer&&e.type!=='ophanim')drawCombatAnimation(m,e,q);
    if(!e.blockKind&&!e.saucer&&e.type!=='ophanim'&&(e.ultimateStage==='charge'||e.ultimateStage==='fire'))
     drawBossUltimate(m,e,{x:p.x,y:1.64+p.height,z:p.z},q);
   }
  }
  if(bossCine.active)drawBossArrival(m,q,cineCam);
  renderHeat(m,q);
  if(desktopPC)renderAfterlightPcHealth(pcView,pcProj);
  // Low-cost flat prints fade directly on the floor and never collide.
  if(hellBreach.state==='active')for(const step of hellFootprints.slice(-(q==='battery'?18:q==='balanced'?35:65))){
   const fade=clamp(step.life/step.max,0,1);
   const width=step.size*(.6+.4*fade);
   m.box(step.x,.019,step.z,width,.003,width*.61,step.color,.045*fade);
  }
 drawWallImpacts(m,p,q);
 renderKineticFX(m,p,q);
 renderStyleAtmosphere(m,p,q);
 renderInfernalRunes(m,p,q);
 for(const b of projectiles){
  if(Math.hypot(b.x-p.x,b.z-p.z)<.55)continue;
  m.box(b.x,b.y,b.z,.12,.12,.12,b.col,1.10);
  m.box(b.x,b.y,b.z,.18,.027,.18,b.col,.43);
   if(b.ufoShot){
    const radius=b.redirected?.17:.13;
    for(let k=0;k<6;k++){
     const a=TAU*k/6+time*5,c=TAU*(k+1)/6+time*5;
     m.beam(b.x+Math.cos(a)*radius,b.y,b.z+Math.sin(a)*radius,
      b.x+Math.cos(c)*radius,b.y,b.z+Math.sin(c)*radius,
      .027,b.redirected?'pink':'cyan',.9);
    }
   }
  const vl=Math.max(.01,Math.hypot(b.vx,b.vz)),tail=.35;
  m.ribbon(b.x-b.vx/vl*tail,b.y,b.z-b.vz/vl*tail,b.x,b.y,b.z,.09,b.col,2.1,{x:p.x,y:1.64+p.height,z:p.z});
 }
 for(const dot of particles){
  if(Math.hypot(dot.x-p.x,dot.y-(1.64+p.height),dot.z-p.z)<.29)continue;
  m.box(dot.x,dot.y,dot.z,dot.size*.83,dot.size*.83,dot.size*.83,dot.col,1.4);
}
 for(const p of pickups){
   // Small pickups used to become giant near-plane glowing blocks in the video.
   // Cull while overlapping the camera rather than flooding the whole viewport.
   const near=Math.hypot(p.x-player.x,p.z-player.z);
   if(near<.68)continue;
   const a=.42+Math.sin(time*3)*.08,scale=near<1.45?.68:1;
   m.box(p.x,a,p.z,.28*scale,.31*scale,.28*scale,p.type==='health'?'green':'cyan',.70);
   m.box(p.x,a,p.z,.33*scale,.036,.33*scale,'chrome',.14);
  }




 // Deliberately lingering legacy beams for energy, Tesla and rail guns.
 // True wall-collision endpoint is reused and brightness falls every frame.
 const beamCam={x:p.x,y:1.64+p.height,z:p.z};
 const cap=q==='battery'?5:q==='balanced'?10:16;
 for(const b of lingeringBeams.slice(-cap)){
  const fade=clamp(b.life/b.max,0,1),
   dx=b.x2-b.x1,dy=b.y2-b.y1,dz=b.z2-b.z1;
  if(Math.hypot(dx,dy,dz)<.12)continue;

  // The laser tip follows the same travelling bolt as the tracer; only the
  // close, bright wake behind that tip is drawn, never the whole static ray.
  const len=Math.hypot(dx,dy,dz),elapsed=Math.max(0,b.max-b.life);
  const velocity=b.style==='rail'?168:b.style==='arc'?116:134;
  const travelled=Math.min(len,elapsed*velocity);
  const tailStart=Math.max(0,travelled-(b.style==='rail'?3.4:1.65));
  const u=travelled/len,v=tailStart/len;
  if(travelled<.10)continue;
  const tx=b.x1+dx*u,ty=b.y1+dy*u,tz=b.z1+dz*u;
  const sx=b.x1+dx*v,sy=b.y1+dy*v,sz=b.z1+dz*v;
  const col=HEX[b.col]||HEX.cyan,wav=.014*Math.sin(time*20+b.phase);
  const width=(b.style==='rail'?.076:b.style==='arc'?.058:.049)*Math.sqrt(fade);
  m.ribbon(sx,sy,sz,tx,ty,tz,width,
   col.map(v=>v*.66),.56*fade,beamCam);
  m.ribbon(sx,sy,sz,tx+wav,ty+wav*.4,tz,
   Math.min(.029,width*.45),'white',1.05*fade,beamCam,.008);
  m.box(tx,ty,tz,.08,.08,.10,b.col,1.3*fade);
  if(b.style==='arc'&&q!=='battery'){
   const n=q==='high'?5:3;
   let ox=sx,oy=sy,oz=sz;
   for(let j=1;j<=n;j++){
    const t=j/n,dist=v+(u-v)*t,zag=j===n?0:Math.sin(time*19+j*8+b.phase)*.042*fade;
    const x=b.x1+dx*dist+zag,y=b.y1+dy*dist-zag*.2,z=b.z1+dz*dist;
    m.ribbon(ox,oy,oz,x,y,z,.014*fade,'cyan',.5*fade,beamCam);
    ox=x;oy=y;oz=z;
   }
  }
 }
 // V0.12 video-driven combat polish: energy bolts are SMALL MOVING PROJECTILES,
 // not giant flat wedges extending from the player's muzzle to the enemy.
 // Physical laser trails never exceed 0.95 world units, irrespective of range.
 const cam={x:p.x,y:1.64+p.height,z:p.z};
 const fxBudget=q==='battery'?18:q==='balanced'?36:58;
 for(const b of tracers.slice(-fxBudget)){
  const age=clamp(1-b.life/(b.max||.96),0,1),elapsed=(b.max||.96)-b.life;
  const dx=b.x2-b.x1,dy=b.y2-b.y1,dz=b.z2-b.z1;
  const dist=Math.max(.001,Math.hypot(dx,dy,dz));
  const dirX=dx/dist,dirY=dy/dist,dirZ=dz/dist;
  const speed=b.kind==='rail'?105:b.kind==='rocket'?15:b.kind==='cryo'?24:b.kind==='scatter'?28:37;
  const travelled=Math.min(dist,Math.max(0,elapsed*speed));
  const arrives=dist/speed,after=Math.max(0,elapsed-arrives);
  const col=HEX[b.col]||HEX.cyan,secondary=HEX[b.accent]||col;
  // Key invariant verified by PC regression. Never draw a multi-meter beam.
  const tailLength=(b.kind==='rail'?.95:b.kind==='rocket'?.64:b.kind==='cryo'?.48:.52)*.4;
  const headActive=elapsed>=0&&elapsed<=arrives+.045;
  const brightness=clamp(1-after*4.5,0,1);
  const bx=b.x1+dirX*travelled,by=b.y1+dirY*travelled,bz=b.z1+dirZ*travelled;
  if(headActive&&brightness>.01){
   const tail=Math.min(travelled,tailLength);
   const x1=bx-dirX*tail,y1=by-dirY*tail,z1=bz-dirZ*tail;
   const base=(b.kind==='rocket'?.09:b.kind==='rail'?.07:b.kind==='cryo'?.075:.056)*.4;
   // Narrow luminous filament, small white hot core and tiny volumetric head.
   m.ribbon(x1,y1,z1,bx,by,bz,base,secondary.map(v=>v*.212),.54*brightness,cam);
   m.ribbon(bx-dirX*Math.min(tail,.20),by-dirY*Math.min(tail,.20),bz-dirZ*Math.min(tail,.20),
     bx,by,bz,base*.25,'white',1.08*brightness,cam,.005);
   const radius=(b.kind==='rocket'?.18:b.kind==='rail'?.11:.08)*brightness*.56;
   m.box(bx,by,bz,radius*1.4,radius*1.4,radius*1.8,b.col,1.30*brightness);
   m.box(bx,by,bz,radius*.60,radius*.60,radius*.98,'white',1.52*brightness);
   if(b.legendary&&q!=='battery'&&
      b===tracers[tracers.length-1]&&brightness>.1){
    // Short-lived celestial crown travels with the projectile, never a giant
    // camera-to-enemy beam. Only newest crowned bolt is expanded each frame.
    const points=b.ultra?10:6,ring=(b.ultra?.18:.12)*brightness;
    for(let k=0;k<points;k++){
     const a=k*TAU/points+time*(b.ultra?7:4)+b.phase,
      next=a+TAU/points;
     m.beam(bx+Math.cos(a)*ring,by+Math.sin(a)*ring,bz,
      bx+Math.cos(next)*ring,by+Math.sin(next)*ring,bz,
      .012,b.ultra?'gold':b.col,brightness*(b.ultra?1.85:1.1));
    }
   }
   // Tiny original Blender induction-coil housing rotates with rocket shots.
    if(desktopPC&&q==='high'&&b.kind==='rocket'&&brightness>.3&&
       b===tracers[tracers.length-1])
      blenderPart(m,'gun_induction_coil',bx,by,bz,.065,time*8);
    if(q!=='battery'&&b.kind!=='rocket'){
    const twist=elapsed*(b.kind==='rail'?70:24)+b.phase;
    for(let j=0;j<3;j++){
     const a=twist+j*TAU/3,r=.08+(b.kind==='arc'?.075:.025);
     m.box(bx+Math.cos(a)*r,by+Math.sin(a)*r,bz,.019,.019,.073,
       j===1?'white':b.col,.56*brightness,a);
    }
   }
   if(q==='high'){
    for(let i=0;i<3;i++){
     const t=(i+.5)/3,off=Math.sin(elapsed*25+b.phase+i*2.3)*.022;
     m.box(bx-dirX*tail*t+off,by-dirY*tail*t+off,bz-dirZ*tail*t-off,
      .023,.023,.023,i===0?'white':b.col,.5*brightness);
    }
   }
  }
  // Hot air dissipates in small separate wisps near the projectile, never a
  // continuous opaque translucent plane across the room.
  const vaporFade=Math.pow(clamp(1-age,0,1),1.65);
  if(q!=='battery'&&vaporFade>.025){
   const n=q==='high'?5:3;
   for(let i=0;i<n;i++){
    const d=Math.min(travelled,(i+.8)*.43);
    if(d<=.04)continue;
    const drift=Math.sin(i*4.11+b.phase+time*4)*(.06+age*.09);
    const x=bx-dirX*d+drift,z=bz-dirZ*d+drift*.37,y=by-dirY*d+.04+i*.035;
    const size=(.028+.014*i/n)*vaporFade*.4;
    m.box(x,y,z,size,size*2.0,size,i%2?b.col:'mist',.064*vaporFade);
   }
  }
  // A small post-hit flash, instead of a flat beam frozen at its endpoint.
  if(after>0&&after<.19){
   const flash=1-after/.19;
   m.box(b.x2,b.y2,b.z2,.032*flash,.028*flash,.032*flash,secondary,.46*flash);
   if(q==='high'&&after<.12){
    for(let i=0;i<4;i++){
     const a=i*TAU/4+b.phase;
     m.beam(b.x2,b.y2,b.z2,b.x2+Math.cos(a)*.21*flash,b.y2+Math.sin(a)*.17*flash,
      b.z2+Math.sin(a)*.18*flash,.014,b.col,.55*flash);
    }
   }
  }
  b.lastRenderedSegment=headActive?Math.min(travelled,tailLength):0;
 }
 // Impact bursts occupy the exact world collision point, not the target's
  // center or the gun's muzzle. World-height rings and sparks are quality-capped.
  for(const fx of wyrdfluxContactFX.slice(-(q==='battery'?5:q==='balanced'?9:14))){
   if(fx.delay>0)continue;
   const age=clamp(1-fx.life/fx.max,0,1),fade=(1-age)*(1-age);
   const r=.14+fx.radius*age,segments=q==='battery'?8:12;
   const hot=clamp(1-age*3,0,1);
   m.box(fx.x,fx.y,fx.z,.18+hot*.45,.18+hot*.45,.18+hot*.45,
    'white',1.9*hot);
   m.box(fx.x,fx.y,fx.z,r*.34,r*.34,r*.34,fx.col,1.15*fade);
   for(let i=0;i<segments;i++){
    const a=i*TAU/segments,b=(i+1)*TAU/segments;
    m.beam(fx.x+Math.cos(a)*r,fx.y,fx.z+Math.sin(a)*r,
     fx.x+Math.cos(b)*r,fx.y,fx.z+Math.sin(b)*r,
     .058*Math.max(.18,fade),fx.col,2.0*fade);
    if(i%2===0)m.beam(fx.x+Math.cos(a)*r*.8,fx.y+Math.sin(a)*r*.65,fx.z,
     fx.x+Math.cos(b)*r*.8,fx.y+Math.sin(b)*r*.65,fx.z,
     .029*Math.max(.2,fade),i%4===0?'white':fx.col,1.4*fade);
   }
   if(fx.kind==='rocket'&&q!=='battery')for(let i=0;i<6;i++){
    const a=fx.seed+i*2.39996,d=r*(.8+i*.12);
    m.box(fx.x+Math.cos(a)*d,fx.y+Math.sin(a*1.7)*r*.53,
     fx.z+Math.sin(a)*d,.07+fade*.08,.08+fade*.09,.10,
     i%2?'gold':'orange',1.15*fade);
   }
  }
  for(const h of impactFlashes.slice(-(q==='battery'?8:22))){
  const a=clamp(h.life/h.max,0,1),r=h.scale*(1-a*.75);
  m.box(h.x,h.y,h.z,.07+r*.18,.08+r*.18,.07+r*.18,'white',a*2.8);
  for(let i=0;i<4;i++){
   const t=h.phase+i*TAU/4;
   m.ribbon(h.x,h.y,h.z,h.x+Math.cos(t)*r,h.y+Math.sin(t)*r*.55,h.z+Math.sin(t)*r,
    .024*a,h.col,1.8*a,cam,.005);
  }
 }
 for(const d of debris.slice(-(q==='battery'?32:q==='balanced'?75:120))){
  m.box(d.x,d.y,d.z,d.size,Math.max(.025,d.size*.56),d.size*.72,d.col,d.life<.3?.06:.2,d.spin+time*.8);
 }

 // Lightweight animated shockwave rings. Each burst uses a bounded fixed segment budget.
 for(const ring of burstRings.slice(-($('quality').value==='battery'?6:14))){
  const scale=ring.r*(1-ring.life/ring.max)*1.14+.12,y=.19+(1-ring.life/ring.max)*.05,segments=10;
  for(let i=0;i<segments;i++){const a=i*TAU/segments,b=(i+1)*TAU/segments;
   m.beam(ring.x+Math.cos(a)*scale,y,ring.z+Math.sin(a)*scale,ring.x+Math.cos(b)*scale,y,ring.z+Math.sin(b)*scale,.022,ring.col,1.8*ring.life/ring.max);
  }
 }
 const muzzle=$('muzzleOverlay');if(muzzle)muzzle.style.opacity=String(clamp((p.muzzleT||0)*9.5+(p.heat||0)*.11,0,1));
 for(const t of combatTexts){
  if(!t.el)continue;
  const dx=t.x-p.x,dz=t.z-p.z,fw=dx*Math.sin(p.yaw)-dz*Math.cos(p.yaw),side=dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw);
  if(fw<.15){t.el.style.display='none';continue}
  t.el.style.display='block';
  const left=50+side/fw*31,top=50-(t.y-(1.64+p.height)-p.pitch*fw)/fw*37;
  t.el.style.left=clamp(left,8,90)+'%';t.el.style.top=clamp(top,12,87)+'%';t.el.style.opacity=String(clamp(t.life*2,0,1));
 }
 // Cinematic atmosphere uses quality-capped, near-player particles and searchlights.
 if(hellBreach.state==='active'){
  const n=q==='battery'?7:q==='high'?20:13;
  for(let i=0;i<n;i++){
   const a=i*2.39996,x=p.x+Math.sin(a*3.71+time*.25)*8.5,
     z=p.z+Math.cos(a*2.19+time*.16)*8.5;
   if(x>1&&x<N-1&&z>1&&z<N-1)
    m.box(x,.2+((i*.37+time*.29)%3.4),z,.018,.044,.018,
     i%5===0?'warm':'red',.11);
  }
 }else if(circus.state!=='active'){
  drawCinematicAtmosphere(m,cineCam?{x:cineCam.x,z:cineCam.z,height:cineCam.y-1.64}:p,q);
  drawEngineeringDetailFX(m,cineCam?{x:cineCam.x,z:cineCam.z,height:cineCam.y-1.64}:p,q);
  drawSectorMachineMotion(m,cineCam?{x:cineCam.x,z:cineCam.z,height:cineCam.y-1.64}:p,q);
 }
 drawHellGate(m,q);renderHeavenPortal(m,q);renderHeavenAltar(m,q);
 // Beacon rings float at the relays, accelerating as power is restored.
 if(circus.state!=='active'&&hellBreach.state!=='active'&&blockworld.state!=='active'&&heavenSanctum.state!=='active')for(const r of RELAYS){const active=!!relayState[r.id],c=active?'cyan':'orange';
   for(let j=0;j<14;j++){const a=j*TAU/14+time*(active?.7:.29),b=a+TAU/14;
     m.beam(r.x+Math.cos(a)*.64,1.62+Math.sin(time*1.8+r.x)*.09,r.z+Math.sin(a)*.64,r.x+Math.cos(b)*.64,1.62+Math.sin(time*1.8+r.x)*.09,r.z+Math.sin(b)*.64,.018,c,active?1.8:.7);
   }
 }
 // Removed the center reactor orbit entirely; no rotating floating sculpture.
 // World entities finish before the camera-space weapon pass.
 drawWardenRiteFX(m,q);drawCircusEncoreFX(m,q);
 upload(dynamicGPU,m.data);drawMesh(dynamicGPU);
 // Blender armatures are drawn AFTER the arena depth pass, before first-person
 // gun overlay. Four GPU-skinned models replace dozens of generated block cuboids.
 if(desktopPC&&circus.state==='active'){
  const puppets=window.WYRDFLUX_CIRCUS_PUPPETS;
  if(puppets?.state.status==='idle')puppets.load(gl);
  if(puppets?.state.status==='ready'){
   puppets.draw(gl,pcProj,pcView,[p.x,1.64+p.height,p.z],time,
    enemies.filter(e=>e.circusActor),q,circus.performance);
   gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  }
 }
 if(desktopPC){
  const originalWarden=enemies.filter(e=>e?.type==='warden'&&!e.hellVariant&&e.hp>0);
  const renderer=livingRenderer('warden');
  if(originalWarden.length&&renderer){
   if(renderer.state.status==='idle')renderer.load(gl);
   if(renderer.state.status==='ready'){
    renderer.drawBoss(gl,pcProj,pcView,[p.x,1.64+p.height,p.z],time,originalWarden);
    gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
   }
  }
 }
 if(!bossCine.active)drawFirstPersonWeapon(p,w/h);if(phase==='play'&&!bossCine.active)drawRadar();}
function drawRadar(){const w=radar.width,h=radar.height,cx=w/2,cy=h/2,r=57;rg.clearRect(0,0,w,h);rg.save();rg.beginPath();rg.arc(cx,cy,r,0,TAU);rg.clip();rg.fillStyle='#051120cf';rg.fillRect(0,0,w,h);rg.strokeStyle='#5acfc338';for(const a of [20,39,56]){rg.beginPath();rg.arc(cx,cy,a,0,TAU);rg.stroke()}
 const scale=5.0,ca=Math.cos(player.yaw),sa=Math.sin(player.yaw);function plot(x,z){let dx=x-player.x,dz=z-player.z;return [cx+(dx*ca+dz*sa)*scale,cy+(dz*ca-dx*sa)*scale]}
 for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++)if(map[z][x]&&(x+z)%2===0){const [px,py]=plot(x+.5,z+.5);rg.fillStyle='#6f8b9c30';rg.fillRect(px,py,3,3)}
 if(hellBreach.state!=='active'&&heavenSanctum.state!=='active'&&blockworld.state!=='active')for(const r of RELAYS){const [x,y]=plot(r.x,r.z);rg.fillStyle=relayState[r.id]?'#46fcd4':'#ffb96a';rg.fillRect(x-2,y-2,5,5)}
 const objectivePoint=objective();if(objectivePoint){const [x,y]=plot(objectivePoint.x,objectivePoint.z);rg.strokeStyle='#ffffff';rg.strokeRect(x-4,y-4,8,8)}
 for(const e of enemies){const [x,y]=plot(e.x,e.z);rg.fillStyle=isBoss(e)?'#f2a5ff':'#ff6b7a';rg.beginPath();rg.arc(x,y,isBoss(e)?4:2.1,0,TAU);rg.fill()}
 rg.fillStyle='#5bffdf';rg.beginPath();rg.moveTo(cx,cy-7);rg.lineTo(cx-5,cy+5);rg.lineTo(cx+5,cy+5);rg.fill();rg.restore()}
let waveKillsStart=0,waveDamageTaken=0,waveStartedAt=0;
let hudNext=0;function updateHUD(force=true){if(!player||(!force&&time<hudNext))return;hudNext=time+.17;const pct=(x,max)=>`${Math.round(clamp(x/max*100,0,100))}%`;$('healthBar').style.width=pct(player.hp,player.maxHp);$('shieldBar').style.width=pct(player.shield,player.maxShield);$('rageBar').style.width=pct(player.rage,100);$('energyBar').style.width=pct(player.energy,100);$('healthText').textContent=Math.ceil(player.hp);$('shieldText').textContent=Math.ceil(player.shield);$('rageText').textContent=Math.floor(player.rage)+'%';$('energyText').textContent=Math.ceil(player.energy);
 const thermal=wyrdfluxGunThermal(gun),ammo=$('ammoText');
  updateWyrdfluxHeatMeter(thermal);
 if(ammo)ammo.textContent=thermal.overheated?
  'OVERHEATED · '+Math.ceil(thermal.heat*100)+'% · COOLING':
  ((player.eclipseArmed&&(player.eclipseCharges||0)>0)?
    String(player.eclipseCharges)+' / 200':'∞')+
    ' · HEAT '+Math.ceil(thermal.heat*100)+'%';
 $('waveText').textContent=cycleOf(wave)>1?`${cycleOf(wave)}·${String(localWaveOf(wave)).padStart(2,'0')}`:String(wave).padStart(2,'0');$('enemyText').textContent=String(enemies.length+spawnPending).padStart(2,'0');$('cashText').textContent=String(player.cash).padStart(4,'0');$('missionLabel').textContent=heavenSanctum.state==='active'?'HEAVEN SANCTUM // THE CELESTIAL ALTAR':
 heavenSanctum.state==='gate'?'ASCEND INTO THE LIGHT':hellBreach.state==='active'?
 'HELL BREACH // TRIAL '+hellBreach.stage+'/'+hellBreach.stages:
 hellBreach.state==='gate'?'THE BLACK CHAPEL IS OPEN':
 coreOnline?'POWER ONLINE · HOLD THE AREA':
 `RESTORE POWER · ${SECTORS[sector]}`;for(const [id,label] of [['healthBar','HEALTH: life remaining'],['shieldBar','SHIELD: protection before health'],['energyBar','ENERGY: used for dash and jump']]){$(id)?.setAttribute('title',label);$(id)?.setAttribute('aria-label',label)}const combo=$('fusionLabel');if(combo){combo.textContent='';combo.classList.remove('active')}
 updateObjectiveUI();
 const warden=enemies.find(e=>e?.type==='warden'&&e.hp>0&&e.wardenRite?.active);
 if(warden){
  const rite=warden.wardenRite;
  const remaining=Math.max(0,WARDEN_MITES_PER_RITE-rite.spawned)+
   enemies.filter(e=>e?.wardenMite&&e.wardenParentId===warden.id&&e.hp>0).length;
  $('missionLabel').textContent='WARDEN SHIELD · '+remaining+' MITES LEFT';
 }
}

// Fluxside is the player's fallback gun. It may only fuse with a LEGENDARY,
// never an ordinary weapon. Other weapon pairs retain their existing rules.
// Each legendary gets an identifiable and potentially run-changing Ultra Combo.
function wyrdfluxLegendaryFusionClass(w){
 return !!w&&(['legendary','mythic'].includes(w.rarity)||w.pistolLineage===true);
}
function isAllowedWeaponMix(a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||a===b||b<0||a<0||
    !activeGun[a]||!activeGun[b]||!WEAPONS[a]||!WEAPONS[b])return false;
 if(a===0||b===0)return ['legendary','mythic'].includes(WEAPONS[a===0?b:a].rarity);
 if(WEAPONS[a].pistolLineage||WEAPONS[b].pistolLineage)
   return wyrdfluxLegendaryFusionClass(WEAPONS[a])&&wyrdfluxLegendaryFusionClass(WEAPONS[b]);
 return true;
}
const FLUXSIDE_ULTRA_FAMILIES=Object.freeze({
 arc:['STORM EMPEROR','arc'],freeze:['ABSOLUTE ZERO','freeze'],
 ignite:['SUNBREAKER','ignite'],splash:['CATACLYSM','splash'],
 gravity:['VOID CROWN','gravity'],pierce:['STARLANCE','pierce'],
 shred:['BONE HURRICANE','shred'],shield:['AEGIS FLUX','shield'],
 vamp:['BLOOD COMET','vamp'],overclock:['CHRONOBREAK','overclock'],
 glass:['GLASS REQUIEM','glass'],recoil:['THUNDERSTEP','recoil'],
 scatter:['CROWN SHOT','scatter'],energy:['PARADOX','energy']
});
function fluxsideUltraCombo(a,b){
 if(!isAllowedWeaponMix(a,b)||(a!==0&&b!==0))return null;
 const index=a===0?b:a,legend=WEAPONS[index],family=legend.modifier||
  legend.effect||'energy';
 const [signature,style]=FLUXSIDE_ULTRA_FAMILIES[family]||
   FLUXSIDE_ULTRA_FAMILIES[legend.effect]||FLUXSIDE_ULTRA_FAMILIES.energy;
 return {index,legend,style,signature,name:'ULTRA COMBO · '+signature+' / '+legend.name,
  // Base legendary is meaningful even with a tiny backup pistol; boost
  // cannot recursively compound with echo/other fusions.
  damage:Math.max(legend.dmg*3.25,WEAPONS[0].dmg*5.4),
  radius:3.15,chain:style==='arc'?6:style==='pierce'?5:4};
}
// A forge consumes BOTH owned weapons. One permanently equipped, serialized
// superweapon inherits every unique effect, including legendary-pistol lineage.
function forgeWyrdfluxWeapon(a,b){
 if(!isAllowedWeaponMix(a,b))return false;
 if(WEAPONS.length>=WYRDFLUX_BASE_WEAPON_COUNT+128){
   notice('FORGE LIMIT REACHED · 128 UNIQUE FUSIONS THIS RUN',3);return false;
 }
 const first=WEAPONS[a],second=WEAPONS[b],ultra=fluxsideUltraCombo(a,b);
 const traits=[...new Set([...(first.fusionTraits||[]),first.effect,first.modifier,
   ...(second.fusionTraits||[]),second.effect,second.modifier].filter(Boolean))].slice(0,12);
 const legendary=wyrdfluxLegendaryFusionClass(first)&&wyrdfluxLegendaryFusionClass(second);
 const lineage=!!(a===0||b===0||first.pistolLineage||second.pistolLineage);
 const depth=Math.max(first.fusionDepth||0,second.fusionDepth||0)+1;
 const name=(ultra?ultra.name:
   lineage?'ULTRA FORGE · '+first.name.replace(/^ULTRA (?:COMBO|FORGE) · /,'').slice(0,22)+
     ' × '+second.name.replace(/^ULTRA (?:COMBO|FORGE) · /,'').slice(0,22):
   weaponMixName(a,b)).slice(0,88);
 const dmg=Math.round(Math.max(ultra?.damage||0,
   Math.max(first.dmg,second.dmg)*(legendary?2.0:1.35)+
   Math.min(first.dmg,second.dmg)*.65)*(1+Math.min(.75,(depth-1)*.10)));
 const index=WEAPONS.length;
 const fused={name,sub:'PERMANENT FORGE · '+depth+'-STAGE BOUND SUPERWEAPON',
   dmg,rate:Math.max(.18,Math.min(first.rate,second.rate)*.88),
   spread:Math.max(.006,Math.min(first.spread,second.spread)*.77),
   shots:Math.min(9,Math.max(first.shots,second.shots)+(depth>1?1:0)),
   range:Math.max(first.range,second.range),col:ultra?'gold':first.col,
   effect:ultra?.style||first.effect||second.effect,
   rarity:first.rarity==='mythic'||second.rarity==='mythic'?'mythic':
     legendary||lineage?'legendary':'epic',
   visualIndex:first.visualIndex??second.visualIndex??(a%10),
   fusionTraits:traits,fusionDepth:depth,pistolLineage:lineage,
   fusionSources:[...(first.fusionSources||[a]),...(second.fusionSources||[b])].slice(0,30),
   fusionGold:legendary||lineage,startingSidearm:false,
   fusedWeapon:true,modifier:traits.includes('arc')?'arc':traits.includes('splash')?'splash':traits[0]||'energy'};
 WEAPONS.push(fused);
 activeGun[a]=false;activeGun[b]=false;activeGun[index]=true;
 gun=index;mixGun=-1;
 if(Array.isArray(player.weaponThermals))player.weaponThermals[index]=
   {heat:0,lock:0,quiet:0,overheated:false};
 rememberWyrdfluxRunItem('TRUE WEAPON FORGE',name,
   'Consumed both '+first.name+' and '+second.name+' · '+traits.join(', '));
 burst(player.x,player.z,legendary?'gold':'purple',2.5,.8);
 sound('upgrade');announce('WEAPONS CONSUMED · '+name,3.5);
 hudWeapon();saveCheckpoint();return true;
}
// Non-pistol legendary weapons have actual secondary superweapon effects.
// Capped, LOS checked and nonrecursive to avoid chain explosions or FPS spikes.
function applyWyrdfluxSuperImpact(w,enemy,damage){
 if(!w||!enemy||!['legendary','mythic'].includes(w.rarity))return;
 const radius=w.effect==='splash'?3.15:2.15,chain=w.effect==='arc'?4:2;
 const others=enemies.filter(e=>e!==enemy&&e.hp>0&&
  Math.hypot(e.x-enemy.x,e.z-enemy.z)<radius&&
  lineClear(enemy.x,enemy.z,e.x,e.z)).slice(0,chain);
 for(const e of others){
  if(w.effect==='freeze'||w.effect==='ignite'||w.effect==='shred')
   appliedWeaponTrait(e,w.effect);
  damageEnemy(e,damage*.22,'superweapon',1);
 }
 if(w.effect==='gravity'&&enemy.hp>0)
  enemy.slowUntil=Math.max(enemy.slowUntil||0,time+.75);
 burst(enemy.x,enemy.z,w.col||'gold',1.85,.42);
 spark(enemy.x,enemy.z,'gold',Math.min(14,5+others.length*2));
}
function applyFluxsideUltraImpact(ultra,enemy,damage){
 if(!ultra||!enemy)return;
 const x=enemy.x,z=enemy.z,r=ultra.style==='splash'?4.2:ultra.radius;
 const victims=enemies.filter(e=>e!==enemy&&e.hp>0&&Math.hypot(e.x-x,e.z-z)<r)
  .sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))
  .slice(0,ultra.chain);
 if(ultra.style==='shield')player.shield=Math.min(player.maxShield,player.shield+18);
 if(ultra.style==='vamp')player.hp=Math.min(player.maxHp,player.hp+12);
 if(ultra.style==='overclock')player.nextShot=Math.max(time+.07,player.nextShot-.14);
 if(ultra.style==='recoil')player.dashCool=Math.max(0,player.dashCool-1.4);
 for(const victim of victims){
  const shock=damage*(ultra.style==='arc'?.55:ultra.style==='splash'?.48:.31);
  if(ultra.style==='gravity')collisionMove(victim,
    (x-victim.x)*.16,(z-victim.z)*.16,.35);
  if(ultra.style==='freeze')appliedWeaponTrait(victim,'freeze');
  if(ultra.style==='ignite')appliedWeaponTrait(victim,'ignite');
  if(ultra.style==='shred')appliedWeaponTrait(victim,'shred');
  damageEnemy(victim,shock,'ultra-combo',0);
 }
 if(ultra.style==='freeze')appliedWeaponTrait(enemy,'freeze');
 if(ultra.style==='ignite')appliedWeaponTrait(enemy,'ignite');
 burst(x,z,ultra.style==='ignite'?'orange':ultra.style==='freeze'?'cyan':
  ultra.style==='gravity'?'purple':'gold',1.8,.5);
}
function weaponMixName(a,b){
 if(!isAllowedWeaponMix(a,b))return WEAPONS[a].name;
 const ultra=fluxsideUltraCombo(a,b);if(ultra)return ultra.name;
 const first=WEAPONS[a],second=WEAPONS[b];
 if([first,second].some(w=>w.effect==='splash')&&[first,second].some(w=>w.effect==='scatter'))return 'ROCKET BUCKSHOT';
 if([first,second].some(w=>w.effect==='freeze')&&[first,second].some(w=>w.effect==='ignite'))return 'THERMAL SHATTER';
 if([first,second].some(w=>w.effect==='arc')&&[first,second].some(w=>w.effect==='splash'))return 'THUNDER ROCKETS';
 return first.name+' × '+second.name.split(' ')[0];
}
// Distinct bottom-screen signature whenever two actual weapons are fused.
function syncWyrdfluxGunFusion(primary,secondary,label){
 let ribbon=document.getElementById('wyrdfluxGunFusion');
 if(!ribbon){
  ribbon=document.createElement('div');
  ribbon.id='wyrdfluxGunFusion';ribbon.className='hidden';
  ribbon.setAttribute('role','status');ribbon.setAttribute('aria-live','polite');
  const eyebrow=document.createElement('span');eyebrow.className='fusionEyebrow';
  const name=document.createElement('strong');name.className='fusionSignature';
  const detail=document.createElement('small');detail.className='fusionClasses';
  ribbon.append(eyebrow,name,detail);
  $('hud')?.append(ribbon);
 }
 if(!secondary){ribbon.classList.add('hidden');ribbon.removeAttribute('data-echo');return;}
 const changed=ribbon.dataset.echo!==label;
 ribbon.querySelector('.fusionEyebrow').textContent=primary.startingSidearm||secondary.startingSidearm?'✦ ULTRA COMBO ✦':'✦ FUSED WEAPON ✦';
 ribbon.querySelector('.fusionSignature').textContent=label;
 ribbon.querySelector('.fusionClasses').textContent=
  wyrdfluxWeaponClass(primary)+' + '+wyrdfluxWeaponClass(secondary);
 ribbon.dataset.echo=label;
 ribbon.classList.remove('hidden');
 if(changed){ribbon.classList.remove('fusionReveal');void ribbon.offsetWidth;
  ribbon.classList.add('fusionReveal');}
}
let weaponIdentityOnHud=null;
function revealEquippedWeaponName(key){
 // The weapon's identity gets a short, nonblocking screen reveal only when
 // the actual selected gun/fusion changes (not every HUD refresh or shot).
 if(weaponIdentityOnHud===key)return;
 weaponIdentityOnHud=key;
 const title=$('weaponTitle'),sub=$('weaponSub');
 for(const el of [title,sub]){
  if(!el)continue;
  el.classList.remove('wyrdfluxWeaponNameReveal');
  void el.offsetWidth;
  el.classList.add('wyrdfluxWeaponNameReveal');
 }
}
function updateWyrdfluxHeatMeter(thermal){
 if(!desktopPC)return;
 let wrapper=$('wyrdfluxHeatMeter');
 if(!wrapper){
   wrapper=document.createElement('div');wrapper.id='wyrdfluxHeatMeter';
   wrapper.setAttribute('role','progressbar');wrapper.setAttribute('aria-label','Current weapon temperature');
   wrapper.setAttribute('aria-valuemin','0');wrapper.setAttribute('aria-valuemax','100');
   const heading=document.createElement('div');heading.className='heatMeterTitle';
   const caption=document.createElement('span');caption.textContent='WEAPON TEMPERATURE';
   const count=document.createElement('span');count.className='heatMeterValue';count.textContent='0%';
   heading.append(caption,count);
   const track=document.createElement('div');track.className='heatMeterTrack';
   const fill=document.createElement('div');fill.className='heatMeterFill';track.append(fill);
   wrapper.append(heading,track);
   const selector=$('weaponSelect'),parent=$('weaponHud');
   if(selector?.parentElement)selector.insertAdjacentElement('beforebegin',wrapper);
   else parent?.append(wrapper);
 }
 const heat=clamp(thermal?.heat||0,0,1);
 const fill=wrapper.querySelector('.heatMeterFill'),value=wrapper.querySelector('.heatMeterValue');
 wrapper.setAttribute('aria-valuenow',String(Math.round(heat*100)));
 wrapper.classList.toggle('venting',!!thermal?.overheated);
 if(fill){fill.style.width=(heat*100).toFixed(1)+'%';
   fill.style.background=heat>.77?'linear-gradient(90deg,#e8552f,#ff2828)':
     heat>.46?'linear-gradient(90deg,#ffce58,#f68226)':
     'linear-gradient(90deg,#4aaeb5,#ffd156)';}
 if(value)value.textContent=thermal?.overheated?'VENTING · '+Math.ceil(heat*100)+'%':
   Math.ceil(heat*100)+'%';
}

/* Two independently equipped slots; an ordinary Fluxside pistol remains
 * a sidearm until its legendary forge permanently promotes the lineage. */
function wyrdfluxBasicSidearm(i){
 const w=WEAPONS[i];return i===0||!!(w?.pistolLineage&&
  !['legendary','mythic'].includes(w.rarity));
}
function wyrdfluxRepairSlots(){
 const owns=i=>Number.isInteger(i)&&i>=0&&!!activeGun[i];
 if(!owns(wyrdfluxPrimarySlot)||wyrdfluxBasicSidearm(wyrdfluxPrimarySlot))
  wyrdfluxPrimarySlot=activeGun.findIndex((yes,i)=>yes&&!wyrdfluxBasicSidearm(i));
 if(!owns(wyrdfluxSecondarySlot)||wyrdfluxSecondarySlot===wyrdfluxPrimarySlot)
  wyrdfluxSecondarySlot=owns(0)&&0!==wyrdfluxPrimarySlot?0:
   activeGun.findIndex((yes,i)=>yes&&i!==wyrdfluxPrimarySlot);
 if(!owns(gun))gun=wyrdfluxPrimarySlot>=0?wyrdfluxPrimarySlot:wyrdfluxSecondarySlot;
}
function wyrdfluxEquipSlot(slot,index){
 if(!activeGun[index]||(slot==='primary'&&wyrdfluxBasicSidearm(index)))return false;
 if(slot==='primary'){
  if(index===wyrdfluxSecondarySlot)wyrdfluxSecondarySlot=wyrdfluxPrimarySlot;
  wyrdfluxPrimarySlot=index;
 }else{
  if(index===wyrdfluxPrimarySlot)wyrdfluxPrimarySlot=wyrdfluxSecondarySlot;
  wyrdfluxSecondarySlot=index;
 }
 gun=index;
 if(mixGun>=0&&!isAllowedWeaponMix(gun,mixGun))mixGun=-1;
 hudWeapon();saveCheckpoint();sound('upgrade');return true;
}
function wyrdfluxSwapSlot(){
 wyrdfluxRepairSlots();
 const other=gun===wyrdfluxPrimarySlot?wyrdfluxSecondarySlot:wyrdfluxPrimarySlot;
 if(other>=0&&activeGun[other]&&other!==gun){
  gun=other;
  if(mixGun>=0&&!isAllowedWeaponMix(gun,mixGun))mixGun=-1;
  hudWeapon();saveCheckpoint();return true;
 }
 return false;
}
function wyrdfluxCycleCombo(step=1){
 const choices=[-1,...activeGun.map((owned,i)=>owned&&isAllowedWeaponMix(gun,i)?i:-1)
  .filter(i=>i>=0)];
 const index=choices.indexOf(mixGun);
 mixGun=choices[(Math.max(0,index)+step+choices.length)%choices.length];
 hudWeapon();saveCheckpoint();
 notice(mixGun<0?'COMBO DISABLED':'COMBO CHANGED',1.2);
 return mixGun;
}

function hudWeapon(){
 wyrdfluxRepairSlots();
 if(mixGun>=0&&!isAllowedWeaponMix(gun,mixGun))mixGun=-1;
 const eclipseReady=(player?.eclipseCharges||0)>0,usingEclipse=!!(eclipseReady&&player.eclipseArmed);
 const main=usingEclipse?ECLIPSE_CATALYST:WEAPONS[gun],
  secondary=usingEclipse?WEAPONS[gun]:mixGun>=0&&mixGun!==gun&&activeGun[mixGun]?WEAPONS[mixGun]:null;
 $('weaponTitle').textContent=main.name;
 $('weaponSub').textContent=main.sub||main.effect?.toUpperCase()||'ACTIVE WEAPON';
 revealEquippedWeaponName([gun,mixGun,usingEclipse?1:0].join(':'));
  syncWyrdfluxGunFusion(main,usingEclipse?null:secondary,
   !usingEclipse&&secondary?weaponMixName(gun,mixGun):'');
 const thermal=wyrdfluxGunThermal(gun);
 $('ammoText').textContent=thermal.overheated?
  'VENTING · '+Math.ceil(thermal.heat*100)+'% HEAT':
  (usingEclipse?String(player.eclipseCharges)+' / 200':'∞')+
    ' · HEAT '+Math.ceil(thermal.heat*100)+'%';
 updateWyrdfluxHeatMeter(thermal);
  const target=$('weaponSelect');target.replaceChildren();
 const addRow=(heading,mix,slot=null)=>{
  const row=document.createElement('div');row.className='weaponLoadoutRow';
  const label=document.createElement('span');label.className='loadoutLabel';label.textContent=heading;row.appendChild(label);
  const slider=document.createElement('div');slider.className='weaponTabs weaponClassTabs';
  if(mix){const hint=document.createElement('span');hint.className='loadoutLabel';hint.textContent='SELECT TO CONSUME BOTH GUNS AND CREATE ONE';slider.appendChild(hint);}
  const owned=WEAPONS.map((w,i)=>({w,i})).filter(({i})=>activeGun[i]&&(!mix||isAllowedWeaponMix(gun,i))&&!(slot==='primary'&&wyrdfluxBasicSidearm(i)))
   .sort((a,b)=>WYRDFLUX_GUN_CLASSES.indexOf(wyrdfluxWeaponClass(a.w))-
    WYRDFLUX_GUN_CLASSES.indexOf(wyrdfluxWeaponClass(b.w))||a.i-b.i);
  let lastClass='';
  for(const {w,i} of owned){
   const family=wyrdfluxWeaponClass(w);
   if(lastClass!==family){const label=document.createElement('span');
    label.className='gunClassHeading';label.textContent=family;slider.append(label);lastClass=family;}
   const btn=document.createElement('button');btn.textContent=WEAPONS[i].name;
   btn.dataset.gunClass=wyrdfluxWeaponClass(WEAPONS[i]);
   btn.title=WEAPONS[i].name;btn.className=(mix?mixGun===i:slot==='primary'?wyrdfluxPrimarySlot===i:slot==='secondary'?wyrdfluxSecondarySlot===i:gun===i)?'selected':'';
   btn.addEventListener('click',()=>{if(mix)forgeWyrdfluxWeapon(gun,i);else if(slot)wyrdfluxEquipSlot(slot,i);else chooseWeapon(i)});
   slider.appendChild(btn);
  }
  row.appendChild(slider);target.appendChild(row);
 };
 addRow('PRIMARY',false,'primary');addRow('SECONDARY',false,'secondary');
 addRow('FORGE · CONSUMES BOTH',true);
 if(desktopPC){
  let cycle=document.getElementById('wyrdfluxComboSwitch');
  if(!cycle){cycle=document.createElement('button');cycle.id='wyrdfluxComboSwitch';
   cycle.type='button';cycle.addEventListener('click',()=>wyrdfluxCycleCombo());
   document.getElementById('weaponHud')?.appendChild(cycle);}
  cycle.textContent=mixGun<0?'CHANGE COMBO · C':'COMBO ACTIVE · C TO CHANGE';
  cycle.title='Cycle compatible non-destructive gun combinations. Forge is separate.';
 }
 if(eclipseReady){
  const row=document.createElement('div');row.className='weaponLoadoutRow';
  const button=document.createElement('button');button.id='wyrdfluxEclipseToggle';
  button.textContent=usingEclipse?'ECLIPSE ACTIVE · '+player.eclipseCharges+' CHARGES · V TO SWITCH':
   'ARM ECLIPSE CATALYST · '+player.eclipseCharges+' CHARGES · V';
  button.className='selected';
  button.addEventListener('click',()=>{player.eclipseArmed=!player.eclipseArmed;hudWeapon();saveCheckpoint();});
  row.appendChild(button);target.appendChild(row);
 }
}
function chooseWeapon(i){
 if(i<0||i>=WEAPONS.length||!activeGun[i])return false;
 const slot=wyrdfluxBasicSidearm(i)?'secondary':'primary';
 return wyrdfluxEquipSlot(slot,i);
}
// Loadout picker stays out of the firing controls until the player taps it.
$('archiveSearch').addEventListener('input',()=>{archiveLimit=48;renderArchivePage()});
 $('archiveFilter').addEventListener('change',()=>{archiveLimit=48;renderArchivePage()});
 $('archiveMore').addEventListener('click',()=>{archiveLimit=Math.min(500,archiveLimit+48);renderArchivePage()});
 $('archiveButton').addEventListener('click',openArchive);
 $('endArchiveButton').addEventListener('click',openArchive);
 $('archiveBackButton').addEventListener('click',()=>{
  phase='menu';showScreen('mainMenu');overlayPlay(false);savePrefs();checkCheckpoint();
 });
 $('loadoutToggle')?.addEventListener('click',()=>{
 const open=document.body.classList.toggle('armory-open');
 $('loadoutToggle').setAttribute('aria-expanded',String(open));
 $('loadoutToggle').setAttribute('aria-label',open?'Close weapon loadout':'Open weapon loadout');
 if(desktopPC){
  inputs.shoot=false;inputs.fire=null;inputs.focus=false;
  if(open)document.exitPointerLock?.();
  document.body.classList.toggle('afterlight-pc-menu-cursor',open);
 }
});
let aimReticleTime=-1;
function updateTargetReticle(){
 if(time-aimReticleTime<.13)return;
 aimReticleTime=time;
 const target=phase==='play'&&!!shotRay3D(player.yaw,player.pitch,Math.min(WEAPONS[gun].range,26)).enemy;
 $('aim')?.classList.toggle('targeting',target);
}
function refreshWyrdfluxRunInventory(){
 if(!desktopPC||!player)return;
 const root=$('pauseScreen');if(!root)return;
 let panel=document.getElementById('wyrdfluxRunInventory');
 if(!panel){
  panel=document.createElement('section');panel.id='wyrdfluxRunInventory';
  panel.setAttribute('aria-label','Current run collected weapons upgrades and rewards');
  const sheet=root.querySelector('.sheet')||root;
  const title=document.createElement('h3');title.textContent='YOUR CURRENT RUN · EVERYTHING COLLECTED';
  panel.appendChild(title);sheet.appendChild(panel);
 }
 while(panel.children.length>1)panel.lastChild.remove();
 const summary=document.createElement('p');summary.className='runInventorySummary';
 summary.textContent='CYCLE '+cycleOf(wave)+' · WAVE '+localWaveOf(wave)+
  ' · '+kills+' KILLS · '+Math.round(player.cash)+' SALVAGE · RUN LEVEL '+runLevel.rank+
  ' · '+runRecord.ascensions+' ASCENSIONS';
 panel.appendChild(summary);
 const addGroup=(heading,entries)=>{
  const group=document.createElement('section');group.className='runInventoryGroup';
  const name=document.createElement('h4');name.textContent=heading+' · '+entries.length;group.appendChild(name);
  const list=document.createElement('ul');
  if(!entries.length){
   const li=document.createElement('li');li.className='runInventoryEmpty';
   li.textContent='Nothing acquired yet';list.appendChild(li);
  }
  for(const entry of entries){
   const li=document.createElement('li');
   const strong=document.createElement('strong');strong.textContent=entry.name;
   li.appendChild(strong);
   if(entry.detail){const desc=document.createElement('small');desc.textContent=entry.detail;li.appendChild(desc);}
   list.appendChild(li);
  }
  group.appendChild(list);panel.appendChild(group);
 };
 addGroup('OWNED WEAPONS',activeGun.flatMap((v,i)=>v?[{name:WEAPONS[i].name+
  (i===gun?' · EQUIPPED':'')+(i===mixGun?' · INFUSED':''),
  detail:WEAPONS[i].description||WEAPONS[i].effect||''}]:[]));
 addGroup('BOSS SHOP EXCLUSIVES',Object.entries(player.bossShopPerks||{}).filter(([_,n])=>Number(n)>0)
  .map(([id,count])=>{const item=BOSS_SHOP_STOCK.find(u=>u.id===id);
   return {name:(item?.name||id.toUpperCase())+' ×'+count,detail:item?.text||''};}));
 addGroup('RUN PERKS / AUGMENTS',Object.entries(player.perks||{}).filter(([_,n])=>Number(n)>0)
  .map(([id,count])=>{const up=UPGRADES.find(u=>u.id===id)||ASCENSION_UPGRADES.find(u=>u.id===id);
   return {name:(up?.name||id.toUpperCase())+' ×'+count,detail:up?.text||''};}));
 addGroup('FUSIONS',activeFusions().map(f=>({name:f.name,detail:f.description||''})));
 addGroup('PERMANENT PASSIVES',PASSIVES.filter(v=>(meta.passiveStacks?.[v.id]||0)>0)
  .map(v=>({name:v.name+' ×'+meta.passiveStacks[v.id],detail:v.src+' · '+v.stat})));
 const specials=[];
 if(player.eclipseCharges>0)specials.push({name:'ECLIPSE CATALYST',detail:player.eclipseCharges+' elemental shots left'});
 if(player.perks?.livingroots>0)specials.push({name:'LIVING ROOTS',detail:'Regeneration from the Enchanted Greenhouse'});
 if(livingRealm.choiceResult)specials.push({name:'WITCH BARGAIN',detail:livingRealm.choiceResult.good?'Blessing':'Curse'});
 addGroup('SPECIAL ITEMS',specials);
 addGroup('COLLECTED THIS RUN · IN ORDER',wyrdfluxRunPickups.map(x=>({
  name:'W'+localWaveOf(x.wave||1)+' · '+x.label,
  detail:x.category+(x.detail?' · '+x.detail:'')
 })).reverse());
}
function pause(){if(phase==='play'){wyrdfluxSprint.latched=false;endBossIntro(true);saveCheckpoint();phase='pause';document.getElementById('wyrdfluxHellExit')?.classList.toggle('hidden',hellBreach.state!=='active');inputs.shoot=false;inputs.fire=null;inputs.interact=false;inputs.keys.clear();showScreen('pauseScreen');refreshWyrdfluxRunInventory();overlayPlay(false);document.exitPointerLock?.()}else if(phase==='pause'){phase='play';showScreen(null);overlayPlay(true)}}
function toMenu(){
 wyrdfluxCancelWorldLoading();
 wyrdfluxSprint.latched=false;
 document.getElementById('wyrdfluxWaveCrown')?.remove();
 document.body.classList.remove('wyrdflux-boss-on');
 clearCircusHitDistortion();if(circus.state==='active')leaveCircus();
 // Save current run and cancel pending async start before returning to title.
 if(phase==='play'||phase==='upgrade')saveCheckpoint();
 ++wyrdfluxStartTicket;
 if(livingRealm.active)leaveLivingRealm();
 clearMeadowWorldVisuals();stylePreviewId=null;endBossIntro(true);
 document.body.classList.remove('armory-open');
 $('loadoutToggle')?.setAttribute('aria-expanded','false');
 $('permanentAward')?.classList.add('hidden');
 $('permanentPanel')?.classList.add('hidden');
 $('afterlightWorldLoading')?.remove();
 introCine.active=false;introCine.forWave=false;introCine.clock=0;
 introCine.flash=0;lingeringBeams=[];wyrdfluxContactFX=[];
 $('cinematicIntro').style.setProperty('--cineflash','0');
 inputs.keys.clear();inputs.shoot=false;inputs.fire=null;inputs.interact=false;
 inputs.focus=false;inputs.moveX=0;inputs.moveZ=0;
 inputs.joystick=null;inputs.look=null;
 if(desktopPC){
  pcPadState.previous=Array.from(navigator.getGamepads?.()||[])
   .find(p=>p&&p.index===pcPadState.index)?.buttons?.map(b=>!!b.pressed)||[];
  pcPadState.selection=0;pcPadState.navCooldown=.35;
 }
 wyrdfluxMenuGuardUntil=performance.now()+420;
 testLabMode=null;$('testLabPanel').classList.add('hidden');
 $('testLabButton')?.setAttribute('aria-expanded','false');
 showWyrdfluxTitle();savePrefs();
 let best=0;try{best=Number(JSON.parse(localStorage.getItem('su2-prefs')||'{}').best)||0}catch(_){}
 $('bestScore').textContent='BEST RUN '+String(Math.round(best)).padStart(5,'0');
 $('startButton')?.blur();
}
function resize(){const ww=innerWidth,hh=innerHeight;world.style.width=ww+'px';world.style.height=hh+'px';radar.width=124;radar.height=124}

/** Phone-specific stable frame-pacing guard, never alters simulation speed.
 * Only the render target scale is adjusted, at most once every 120 frames.
 * Full quality returns slowly when the device has enough GPU headroom.
 */
const framePacing={scale:1,sum:0,count:0,averageMs:16.7,adjustments:0};
function sampleFramePacing(dt){
 const quality=$('quality').value;
 if(phase!=='play'||quality==='battery'){
  framePacing.sum=0;framePacing.count=0;
  if(quality==='battery')framePacing.scale=1;
  return;
 }
 if(!(dt>0&&dt<.095))return;
 framePacing.sum+=dt*1000;framePacing.count++;
 if(framePacing.count<120)return;
 const ms=framePacing.sum/framePacing.count;
 framePacing.averageMs=ms;framePacing.sum=0;framePacing.count=0;
 const floor=desktopPC&&quality==='high'?.84:quality==='high'?.73:.79;
 let next=framePacing.scale;
 if(ms>26.5)next=Math.max(floor,next-.075);
 else if(ms<17.7)next=Math.min(1,next+.0375);
 if(Math.abs(next-framePacing.scale)>.0005){
  framePacing.scale=next;framePacing.adjustments++;
 }
}


/** Windows Gamepad API support. A connected Xbox controller does NOT hijack
 * the keyboard until the player actually presses one of its buttons.
 * Standard-mapping pads only; unplugging/keyboard/mouse returns to PC input.
 * UI uses real DOM button focus/click, so upgrades and weapon menus work. */
const pcPadState={mode:'keyboard',index:null,connected:false,id:'',
 previous:[],selection:0,navCooldown:0,switches:0,pressedButtons:0,
 hapticsSupported:false,hapticEvents:0,lastRumbleAt:0};
function vibrateWyrdfluxPad(strength=.3,duration=85,kind='shot'){
 if(!desktopPC||pcPadState.mode!=='gamepad'||typeof navigator.getGamepads!=='function')return false;
 const now=performance.now(),cooldown=kind==='hurt'?85:75;
 if(now-pcPadState.lastRumbleAt<cooldown)return false;
 const pad=Array.from(navigator.getGamepads()||[]).find(p=>p&&p.index===pcPadState.index);
 if(!pad)return false;
 const strong=clamp(strength,0,1),weak=clamp(strength*.70+.04,0,1);
 const ms=Math.round(clamp(duration,25,340));
 let call=null;
 try{
  if(pad.vibrationActuator?.playEffect)
   call=pad.vibrationActuator.playEffect('dual-rumble',{startDelay:0,duration:ms,strongMagnitude:strong,weakMagnitude:weak});
  else if(pad.hapticActuators?.[0]?.pulse)
   call=pad.hapticActuators[0].pulse(strong,ms);
  else return false;
  pcPadState.lastRumbleAt=now;pcPadState.hapticsSupported=true;pcPadState.hapticEvents++;
  Promise.resolve(call).catch(()=>{pcPadState.hapticsSupported=false;});
  return true;
 }catch(_err){pcPadState.hapticsSupported=false;return false;}
}
function setAfterlightInputMode(mode,index=null,id=''){
 if(!desktopPC)return;
 if(pcPadState.mode!==mode||pcPadState.index!==index)wyrdfluxSprint.latched=false;
 if(mode==='gamepad'){
  if(pcPadState.mode!=='gamepad'||pcPadState.index!==index)pcPadState.switches++;
  pcPadState.index=index;pcPadState.id=id;
  if(pcPadState.mode!=='gamepad'){
   document.exitPointerLock?.();
   inputs.keys.clear();
   inputs.shoot=false;inputs.focus=false;
   pcPadState.selection=0;pcPadState.navCooldown=0;
  }
 }else{
  if(pcPadState.mode==='gamepad'){
   inputs.shoot=false;inputs.focus=false;inputs.interact=false;
   inputs.moveX=0;inputs.moveZ=0;inputs.keys.delete('shift');
  }
  pcPadState.index=null;
 }
 pcPadState.mode=mode;
 if(mode==='gamepad'&&pcPadMenuRoot()){
  const targets=pcPadVisibleControls();
  if(targets.length&&!targets.includes(document.activeElement))targets[0].focus({preventScroll:true});
 }
 document.body.classList.toggle('afterlight-gamepad-active',mode==='gamepad');
 document.body.dataset.afterlightInput=mode;
}
function pcPadMenuRoot(){
 let root=null;
 const report=document.getElementById('afterlightWaveReport');
 if(report&&getComputedStyle(report).display!=='none')root=report;
 else if($('wyrdfluxWitchChoices')&&getComputedStyle($('wyrdfluxWitchChoices')).display!=='none')root=$('wyrdfluxWitchChoices');
 else if($('permanentAward')&&!$('permanentAward').classList.contains('hidden'))root=$('permanentAward');
 else if($('permanentPanel')&&!$('permanentPanel').classList.contains('hidden'))root=$('permanentPanel');
 else if($('wyrdfluxLivingTestPanel')&&!$('wyrdfluxLivingTestPanel').classList.contains('hidden'))root=$('wyrdfluxLivingTestPanel');
 else if($('testLabPanel')&&!$('testLabPanel').classList.contains('hidden')&&phase==='menu')root=$('testLabPanel');
 else if(document.body.classList.contains('armory-open'))root=$('weaponHud');
 else if(phase==='upgrade')root=$('upgradeScreen');
 else if(phase==='pause')root=$('pauseScreen');
 else if(phase==='menu')root=$('mainMenu');
 else if(phase==='dead')root=$('endScreen');
 else if(phase==='cinematic')root=$('cinematicIntro');
 else if(phase==='archive')root=$('archiveScreen');
 return root;
}
function pcPadVisibleControls(){
 const root=pcPadMenuRoot();
 if(!root)return [];
 return [...root.querySelectorAll('button,select,[role="button"]')].filter(b=>
  !b.disabled&&!b.classList.contains('hidden')&&
  b.getClientRects().length>0&&getComputedStyle(b).visibility!=='hidden'
 );
}
function pcPadMoveSelection(dir){
 const targets=pcPadVisibleControls();
 if(!targets.length)return;
 const active=targets.indexOf(document.activeElement);
 const base=active>=0?active:pcPadState.selection;
 const next=((base+dir)%targets.length+targets.length)%targets.length;
 pcPadState.selection=next;
 targets[next].focus({preventScroll:false});
}
function pcPadPressSelection(){
 const targets=pcPadVisibleControls();
 const active=targets.includes(document.activeElement)?
  document.activeElement:targets[Math.min(pcPadState.selection,targets.length-1)];
 if(active)active.click();
}
function pcPadCycleWeapon(step){
 const available=[];
 for(let i=0;i<activeGun.length;i++)if(activeGun[i])available.push(i);
 if(!available.length)return;
 const at=Math.max(0,available.indexOf(gun));
 chooseWeapon(available[(at+step+available.length)%available.length]);
}
// Scroll the real overflow container, not window/body (which never scroll).
// Scroll speed is frame-time based and gamepad deadzoned; no movement in play.
function pcPadScrollMenu(vertical,horizontal,dt){
 const root=pcPadMenuRoot();if(!root)return false;
 let moved=false;
 if(Math.abs(vertical)>.15){
  const candidates=[root,...root.querySelectorAll('*')].filter(el=>{
   const css=getComputedStyle(el);
   return el.scrollHeight>el.clientHeight+3&&/(auto|scroll)/.test(css.overflowY);
  });
  const selected=candidates.filter(el=>el.contains(document.activeElement));
  // A focused nested scroller must win over its scrollable ancestors.
  // Otherwise right-stick input can move the whole overlay while the
  // intended inventory/upgrade list remains stuck.
  const ranked=selected.length?selected:candidates;
  const panel=ranked.sort((a,b)=>a.contains(b)?1:b.contains(a)?-1:
   (b.scrollHeight-b.clientHeight)-(a.scrollHeight-a.clientHeight))[0];
  if(panel){
   const before=panel.scrollTop;
   panel.scrollTop=clamp(before+vertical*570*Math.min(dt,.09),0,panel.scrollHeight-panel.clientHeight);
   moved=Math.abs(panel.scrollTop-before)>.01;
  }
 }
 if(Math.abs(horizontal)>.18){
  const controls=[...root.querySelectorAll('.weaponTabs,[data-gamepad-scroll-x]')];
  const focused=controls.find(el=>el.contains(document.activeElement));
  const panel=focused||controls.find(el=>el.scrollWidth>el.clientWidth+3);
  if(panel&&panel.scrollWidth>panel.clientWidth+3){
   const before=panel.scrollLeft;
   panel.scrollLeft=clamp(before+horizontal*690*Math.min(dt,.09),0,panel.scrollWidth-panel.clientWidth);
   moved=moved||Math.abs(panel.scrollLeft-before)>.01;
  }
 }
 return moved;
}
// D-pad changes the active two-weapon setup without requiring a mouse.
function pcPadCycleInfusion(step){wyrdfluxCycleCombo(step)}
function pcPadSwapLoadout(){if(wyrdfluxSwapSlot())notice('SWAPPED EQUIPPED GUN',1.2)}
function pcPadClearInfusion(){
 if(mixGun<0)return;
 mixGun=-1;hudWeapon();saveCheckpoint();notice('INFUSION OFF',1.1);
}
function pcPadDeadzone(n){
 const magnitude=Math.abs(n||0);
 return magnitude<.17?0:Math.sign(n)*(magnitude-.17)/.83;
}
function pcPadWasPressed(buttons,index){return buttons[index]&&!pcPadState.previous[index]}
function pollAfterlightGamepad(dt){
 if(!desktopPC||typeof navigator.getGamepads!=='function')return;
 const pads=Array.from(navigator.getGamepads()||[]).filter(p=>p&&p.connected!==false);
 pcPadState.connected=pads.length>0;
 let pad=pads.find(p=>p.index===pcPadState.index)||pads[0];
 if(!pad){
  if(pcPadState.mode==='gamepad')setAfterlightInputMode('keyboard');
  pcPadState.previous=[];pcPadState.id='';
  return;
 }
 const pressed=(pad.buttons||[]).map(b=>!!(b?.pressed||(b?.value||0)>.55));
  // Auto-detect and focus the first menu action without a sacrificial A press.
  if(pcPadState.mode!=='gamepad'){
   setAfterlightInputMode('gamepad',pad.index,pad.id||'XInput controller');
   const targets=pcPadVisibleControls();
   const first=phase==='menu'&&targets.includes($('startButton'))?
      $('startButton'):targets[0];
   if(first)first.focus({preventScroll:true});
   pcPadState.selection=Math.max(0,targets.indexOf(first));
   pcPadState.previous=pressed.map(()=>false);
  }
  const was=i=>pcPadWasPressed(pressed,i),down=i=>!!pressed[i];
 pcPadState.pressedButtons=pressed.filter(Boolean).length;
 pcPadState.navCooldown=Math.max(0,pcPadState.navCooldown-dt);
 const menu=!!pcPadMenuRoot();
 if(menu&&performance.now()<wyrdfluxMenuGuardUntil){
  pcPadState.previous=pressed;inputs.shoot=false;inputs.fire=null;return;
 }
 const axes=pad.axes||[];
 if(menu){
  // Right stick scrolls ALL overflow screens; horizontally it browses armory tabs.
  pcPadScrollMenu(pcPadDeadzone(axes[3]),pcPadDeadzone(axes[2]),dt);
  inputs.moveX=0;inputs.moveZ=0;inputs.shoot=false;inputs.focus=false;
  inputs.interact=false;inputs.keys.delete('shift');
  wyrdfluxSprint.latched=false;
  let direction=0;
  if(was(12))direction=-1;
  else if(was(13))direction=1;
  else if(was(14))direction=-1;
  else if(was(15))direction=1;
  else if(pcPadState.navCooldown===0){
   if(pcPadDeadzone(axes[1])>.65||pcPadDeadzone(axes[0])>.70)direction=1;
   if(pcPadDeadzone(axes[1])<-.65||pcPadDeadzone(axes[0])<-.70)direction=-1;
  }
  if((was(14)||was(15))&&['wyrdfluxDisplayMode','wyrdfluxDisplayMonitor'].includes(document.activeElement?.id)){
   const item=document.activeElement;
   item.selectedIndex=clamp(item.selectedIndex+(was(14)?-1:1),0,item.options.length-1);
   item.dispatchEvent(new Event('change',{bubbles:true}));
   direction=0;pcPadState.navCooldown=.19;
  }
  if(direction){pcPadMoveSelection(direction);pcPadState.navCooldown=.19;}
  if(was(0))pcPadPressSelection();
  if(was(1)){
   if($('wyrdfluxWitchChoices')){$('wyrdfluxWitchChoices').querySelector('button:last-of-type')?.click();}
   else if($('permanentAward')&&!$('permanentAward').classList.contains('hidden'))$('permanentAward').querySelector('button')?.click();
   else if($('permanentPanel')&&!$('permanentPanel').classList.contains('hidden'))$('permanentPanel').querySelector('button')?.click();
   else if($('wyrdfluxLivingTestPanel')&&!$('wyrdfluxLivingTestPanel').classList.contains('hidden'))$('wyrdfluxLivingTestButton')?.click();
   else if($('testLabPanel')&&!$('testLabPanel').classList.contains('hidden')&&phase==='menu')$('testLabButton')?.click();
   else if(document.body.classList.contains('armory-open'))$('loadoutToggle')?.click();
   else if(phase==='pause')pause();
   else if(phase==='archive')$('archiveBackButton')?.click();
   else if(phase==='menu')$('startButton')?.focus();
  }
  if(was(9)){
   if(phase==='pause'&&!$('wyrdfluxWitchChoices'))pause();
   else if(phase==='menu'&&pcPadMenuRoot()===$('mainMenu'))$('startButton')?.click();
  }
  if(was(4))pcPadMoveSelection(-1);
  if(was(5))pcPadMoveSelection(1);
  if(was(8))pcPadMoveSelection(-1);
  if(was(11))pcPadMoveSelection(1);
 }else if(phase==='play'&&!bossCine.active){
  inputs.moveX=pcPadDeadzone(axes[0]);
  // Standard Xbox/Gamepad API: up is axis[1] < 0, down is > 0.
  // Our movement integrator already negates moveZ to obtain forward speed.
  // Do NOT negate here too, or up travels backward and down travels forward.
  inputs.moveZ=pcPadDeadzone(axes[1]);
  const lookX=pcPadDeadzone(axes[2]),lookY=pcPadDeadzone(axes[3]);
  player.yaw+=lookX*2.8*dt;
  player.pitch=clamp(player.pitch-lookY*2.15*dt,-1.20,1.20);
  inputs.shoot=down(7);
  inputs.focus=down(6);
  inputs.interact=down(2);
  inputs.keys.delete('shift'); // stick deflection NEVER becomes keyboard sprint
  if(was(10)){
   wyrdfluxSprint.latched=!wyrdfluxSprint.latched&&!wyrdfluxSprint.exhausted&&player.energy>=5;
   notice(wyrdfluxSprint.latched?'SPRINT · L3 TO WALK':'WALK · L3 TO SPRINT',.8);
  }
  if(was(0))jump();
  if(was(1))dash();
  // Y no longer activates a removed Overdrive mode.
  // LB/RB change the core; D-pad left/right cycle the paired weapon,
  // D-pad up swaps core and infusion, D-pad down clears infusion.
  if(was(4))pcPadCycleWeapon(-1);
  if(was(5))pcPadCycleWeapon(1);
  if(was(14))pcPadCycleInfusion(-1);
  if(was(15))pcPadCycleInfusion(1);
  if(was(12))pcPadSwapLoadout();
  if(was(13))pcPadClearInfusion();
  if(was(8)||was(11))$('loadoutToggle')?.click();
  if(was(9))pause();
 }else{
  inputs.shoot=false;inputs.focus=false;inputs.interact=false;
  inputs.moveX=0;inputs.moveZ=0;inputs.keys.delete('shift');
 }
 pcPadState.previous=pressed;
}
if(desktopPC){
 addEventListener('gamepadconnected',event=>{
  pcPadState.connected=true;pcPadState.id=event.gamepad?.id||'Controller';
 });
 addEventListener('gamepaddisconnected',event=>{
  if(pcPadState.index===event.gamepad?.index)setAfterlightInputMode('keyboard');
  pcPadState.previous=[];
 });
 addEventListener('pointerdown',()=>{
  if(pcPadState.mode==='gamepad')setAfterlightInputMode('keyboard');
 },{capture:true});
 // A controller button is required for controller-mode activation;
 // connection alone only updates readiness.
}

function frame(ms){const dt=last?Math.min(.08,(ms-last)/1000):.016;last=ms;if(desktopPC)pollAfterlightGamepad(dt);sampleFramePacing(dt);if(introCine.active){introCine.clock+=dt;updateOpeningScene()}if(bossCine.active)updateBossIntro(dt);stepDebt=Math.min(.07,stepDebt+dt);let steps=0;while(stepDebt>=1/60&&steps<5){if(phase==='play'&&!bossCine.active)tick(1/60);else{if(phase==='upgrade')runLevel.comboUntil+=1/60;time+=1/60;}stepDebt-=1/60;steps++}render();requestAnimationFrame(frame)}
function pointer(e){return {x:e.clientX,y:e.clientY}};
let lastJoy=0;
function moveStick(e){if(!inputs.joystick||e.pointerId!==inputs.joystick.id)return;const box=$('joystick').getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2,dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),s=Math.min(d,43)/Math.max(d,1);$('stick').style.transform=`translate(${dx*s}px,${dy*s}px)`;inputs.moveX=dx*s/43;inputs.moveZ=dy*s/43}
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();inputs.joystick={id:e.pointerId};$('joystick').setPointerCapture(e.pointerId);moveStick(e)});$('joystick').addEventListener('pointermove',moveStick);for(const t of ['pointercancel','pointerup','lostpointercapture'])$('joystick').addEventListener(t,e=>{if(inputs.joystick?.id===e.pointerId){inputs.joystick=null;inputs.moveX=0;inputs.moveZ=0;$('stick').style.transform='none'}});
$('aimZone').addEventListener('pointerdown',e=>{e.preventDefault();inputs.look={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)});$('aimZone').addEventListener('pointermove',e=>{if(inputs.look?.id!==e.pointerId)return;player.yaw+=(e.clientX-inputs.look.x)*.0046;player.pitch=clamp(player.pitch+(inputs.look.y-e.clientY)*.0045,-1.20,1.20);inputs.look.x=e.clientX;inputs.look.y=e.clientY});for(const t of ['pointerup','pointercancel','lostpointercapture'])$('aimZone').addEventListener(t,e=>{if(inputs.look?.id===e.pointerId)inputs.look=null});
// Independent mobile pointer capture: the firing thumb also controls camera look.
// A different pointer can remain captured by the left movement joystick.
$('shootButton').addEventListener('pointerdown',e=>{
 if(phase!=='play'||bossCine.active||inputs.fire)return;
 e.preventDefault();
 inputs.fire={id:e.pointerId,x:e.clientX,y:e.clientY};
 inputs.shoot=true;shoot();
 e.currentTarget.setPointerCapture(e.pointerId);
});
$('shootButton').addEventListener('pointermove',e=>{
 const finger=inputs.fire;
 if(!finger||finger.id!==e.pointerId)return;
 e.preventDefault();
 player.yaw+=(e.clientX-finger.x)*.0046;
 player.pitch=clamp(player.pitch+(finger.y-e.clientY)*.0045,-1.20,1.20);
 finger.x=e.clientX;finger.y=e.clientY;
});
for(const t of ['pointerup','pointercancel','lostpointercapture']){
 $('shootButton').addEventListener(t,e=>{
  if(inputs.fire?.id!==e.pointerId)return;
  inputs.fire=null;
  inputs.shoot=false;
 });
}
$('dashButton').addEventListener('click',dash);$('specialButton').addEventListener('click',useOverdrive);
$('jumpButton').addEventListener('click',jump);
$('focusButton').addEventListener('click',()=>{inputs.focus=!inputs.focus;$('focusButton').classList.toggle('active',inputs.focus)});
$('hellSkipButton').addEventListener('click',()=>{
 if(phase!=='play'||hellBreach.state!=='gate')return;
 if(testLabMode){trialFinish(false);return;}
 hellBreach.state='none';hellBreach.reward=0;
 createMap(sector);buildStatic();
 notice('SECRET GATE LEFT BEHIND · RESUMING NORMAL CAMPAIGN',2.8);
 waveComplete();
});
$('interactButton').addEventListener('pointerdown',e=>{e.preventDefault();inputs.interact=true;e.currentTarget.setPointerCapture(e.pointerId)});
for(const t of ['pointerup','pointercancel','lostpointercapture'])$('interactButton').addEventListener(t,()=>inputs.interact=false);
addEventListener('contextmenu',e=>{if(phase==='play')e.preventDefault()});
world.addEventListener('pointerdown',e=>{
 if(e.button===2&&!document.body.classList.contains('armory-open'))inputs.focus=true;
});addEventListener('pointerup',e=>{if(e.button===2)inputs.focus=false});
$('world').addEventListener('pointerdown',e=>{
 if(phase==='play'&&!touch&&e.button===0&&!document.body.classList.contains('armory-open')){
  if(desktopPC)setAfterlightInputMode('keyboard');
  inputs.shoot=true;world.requestPointerLock?.();shoot();
 }
});
addEventListener('pointerup',()=>{if(!touch)inputs.shoot=false});
addEventListener('mousemove',e=>{
 if(desktopPC&&(e.movementX||e.movementY)&&pcPadState.mode==='gamepad')
  setAfterlightInputMode('keyboard');
 if(document.pointerLockElement===world&&phase==='play'&&
    !document.body.classList.contains('armory-open')){
  player.yaw+=e.movementX*.0025;
  player.pitch=clamp(player.pitch-e.movementY*.0027,-1.20,1.20);
 }
});
addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(desktopPC){
  setAfterlightInputMode('keyboard');
  if(key==='tab'){
   e.preventDefault();
   if(phase==='play')$('loadoutToggle')?.click();
   return;
  }
  if(key==='enter'&&phase==='upgrade'){
   const report=$('afReportContinue');
   if(report&&getComputedStyle(report.parentElement.parentElement).display!=='none'){
    report.click();e.preventDefault();return;
   }
   const focus=document.activeElement;
   if(focus?.matches?.('#upgradeCards button')){focus.click();e.preventDefault();return;}
  }
 }
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
 inputs.keys.add(key);if(e.repeat)return;
 if(/^[0-9]$/.test(key))chooseWeapon(key==='0'?9:Number(key)-1);
 if(key==='escape'||key==='p')pause();
 if(key==='q')dash();
 if(key==='c'&&phase==='play')wyrdfluxCycleCombo();
 if(key==='z'&&phase==='play')wyrdfluxSwapSlot();
 // R is free for future controls; Overdrive removed from player controls.
  if(key==='v'&&phase==='play'&&(player.eclipseCharges||0)>0){player.eclipseArmed=!player.eclipseArmed;hudWeapon();notice('ECLIPSE '+(player.eclipseArmed?'ARMED':'STOWED'),1.6);}
  if(key==='f'&&phase==='play'&&hellBreach.state==='active'&&stacks('hellflash')){player.hellFlashOn=!player.hellFlashOn;notice('FLASHLIGHT '+(player.hellFlashOn?'ON':'OFF'),1.6);}
 if(key===' ')jump();
 if(key==='enter'&&phase==='menu'&&performance.now()>=wyrdfluxMenuGuardUntil)startWyrdfluxRun(false);
});addEventListener('keyup',e=>inputs.keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>{inputs.keys.clear();inputs.shoot=false;inputs.fire=null;inputs.moveX=0;inputs.moveZ=0;inputs.interact=false;inputs.focus=false;if(phase==='play')pause()});
$('cinemaSkip').addEventListener('click',()=>finishOpening(true));
 $('bossEntranceSkip').addEventListener('click',()=>endBossIntro(true));
$('cinemaAudio').addEventListener('click',()=>{
 unlockSoundtrack();$('cinemaAudio').classList.add('hidden');
});
$('replayIntroButton')?.addEventListener('click',()=>{unlockSoundtrack();startOpening(true)});
if(desktopPC){const sheet=$('pauseScreen')?.querySelector('.sheet')||$('pauseScreen');if(sheet){const escape=document.createElement('button');escape.id='wyrdfluxHellExit';escape.type='button';escape.className='secondary hidden';escape.style.marginTop='12px';escape.textContent='EXIT HELL · RETURN TO RUN';escape.addEventListener('click',()=>{if(window.confirm('Leave Hell without bonus rewards?'))escapeHellBreach();});sheet.appendChild(escape);}}
installLivingRealmTestMenu();
$('testLabButton').addEventListener('click',()=>{const p=$('testLabPanel');p.classList.toggle('hidden');$('testLabButton').setAttribute('aria-expanded',String(!p.classList.contains('hidden')))});
$('testWallMaw').addEventListener('click',()=>{unlockSoundtrack();trialStart('maw')});
$('testBlackChapel').addEventListener('click',()=>{unlockSoundtrack();trialStart('hell')});
// Native test-lab controls are added without changing the published v0.39 HTML.
for(const [id,label,mode] of [['testHeavenBoss','TEST OPHANIM BOSS','angel'],['testHeavenRoom','TEST HEAVEN ROOM','heaven'],['testCreeper','TEST CREEPER EVENT','creeper'],['testBlockworld','TEST BLOCKWORLD ROOM','blockworld'],['testPixelWarden','TEST WARDEN BOSS','pixelwarden']]){
 const b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;
 $('testLabPanel').appendChild(b);
 b.addEventListener('click',()=>{unlockSoundtrack();trialStart(mode)});
}
$('startButton').addEventListener('click',()=>{unlockSoundtrack();startWyrdfluxRun(false)});$('continueButton').addEventListener('click',()=>{unlockSoundtrack();startWyrdfluxRun(true)});$('pauseButton').addEventListener('click',pause);$('resumeButton').addEventListener('click',pause);$('exitButton').addEventListener('click',toMenu);$('retryButton').addEventListener('click',()=>{unlockSoundtrack();if(testLabMode)trialStart(testLabMode);else startWyrdfluxRun(false)});$('endMenuButton').addEventListener('click',toMenu);$('soundButton').addEventListener('click',()=>{muted=!muted;if(!muted)unlockSoundtrack();$('soundButton').textContent='AUDIO + MUSIC: '+(muted?'OFF':'ON');if(ctxAudio&&muted){musicBus?.gain.setTargetAtTime(.00001,ctxAudio.currentTime,.04);fxBus?.gain.setTargetAtTime(.00001,ctxAudio.currentTime,.04);}savePrefs()});$('quality').addEventListener('change',savePrefs);// Gun and infusion controls are generated with their own live click handlers in hudWeapon().
// Public instrumentation is read-only except bounded test-only stepping and run start; no network interface.
window.__sector2={
 shadowStateForTest:()=>location.hash.includes('qa')?{
  testBuild:WYRDFLUX_SHADOW_TEST_BUILD,unlocked:wyrdfluxShadowUnlocked(),
  enabled:wyrdfluxShadowUnlocked(),count:wyrdfluxShadowCount(),
  seconds:WYRDFLUX_SHADOW_DELAY,stagger:WYRDFLUX_SHADOW_STAGGER,replay:wyrdfluxShadowSample(time-WYRDFLUX_SHADOW_DELAY),
  storedSteps:wyrdfluxShadowHistory.length,storedShots:wyrdfluxShadowShots.length,
  activeProjectiles:wyrdfluxPlayerShots.filter(p=>p.kind==='shadow').length,
  emitted:wyrdfluxShadowEmitted,
  time:Math.round(time*100)/100,glError:gl.getError()
 }:null,
 primeShadowForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  spawnPending=1;spawnClock=999;enemies=[];meta.shadowBrainWins=1;player.perks??={};player.perks.shadow=2;
  player.hp=player.maxHp;player.shield=player.maxShield;
  return wyrdfluxShadowCount()===3;
 },
 comboAnnouncementForTest:(count=5)=>location.hash.includes('qa')?
  (wyrdfluxKillComboAnnouncement(count,Math.min(4,1+Math.floor((count-1)/3)*.25)),
   {text:$('wyrdfluxKillComboAnnouncement')?.textContent||'',
    tier:$('wyrdfluxKillComboAnnouncement')?.dataset.tier||''}):null,
 loadingScreenForTest:()=>location.hash.includes('qa')?{
  tipCount:WYRDFLUX_PC_LOADING_TIPS.length,
  sceneNames:Object.keys(WYRDFLUX_PC_LOADING_ART),
  shown:!!document.getElementById('wyrdfluxPcRealmLoad'),
  ready:!wyrdfluxWorldLoadingBusy
 }:null,
 showLoadingSceneForTest:(id)=>location.hash.includes('qa')&&
  Object.hasOwn(WYRDFLUX_PC_LOADING_ART,id)?
  wyrdfluxBeginRealmLoad(id,()=>true,'LOADING '+id.toUpperCase()):false,
 state:()=>({phase,wave,sector,kills,totalScore,
 livingRealm:{active:livingRealm.active,id:livingRealm.id,pending:livingRealm.pending,
  claimed:livingRealm.claimed,testOnly:livingRealm.testOnly,visits:livingRealm.visits,
  loadStatus:livingRealm.active?livingRenderer(livingRealm.id)?.state.status||'unavailable':null,
  drawnTriangles:livingRealm.active?livingRenderer(livingRealm.id)?.state.triangles||0:0,
  animatedDraws:livingRealm.active?livingRenderer(livingRealm.id)?.state.draws||0:0,
  assetBytes:Object.fromEntries(['witch','greenhouse','library','warden'].map(id=>[id,window.WYRDFLUX_REALM_ASSETS?.size?.(id)||0]))},
 eclipse:{charges:player?.eclipseCharges||0,armed:!!player?.eclipseArmed},
 wardenRite:((boss)=>boss?{
  phase:boss.wardenRite?.phase||0,stage:boss.wardenRite?.stage||'idle',
  invulnerable:!!boss.wardenRite?.active,lift:boss.wardenRite?.lift||0,
  summoned:boss.wardenRite?.spawned||0,
  remaining:enemies.filter(e=>e.wardenMite&&e.wardenParentId===boss.id).length,
  cleared:boss.wardenRite?.cleared||0}:null)(
  enemies.find(e=>e.type==='warden'&&e.hp>0)),
 gamepadRumble:{supported:pcPadState.hapticsSupported,events:pcPadState.hapticEvents},
 damageVignette:wyrdfluxDamagePulse,
 wardenPBR:{ready:livingRenderer('warden')?.state.status==='ready',
  vertices:livingRenderer('warden')?.state.vertices||0,
  triangles:livingRenderer('warden')?.state.triangles||0},
 hellFlashlight:{equipped:!!player?.perks?.hellflash,on:!!player?.hellFlashOn},
 runLevel:{...runLevel},sprintControl:{latched:wyrdfluxSprint.latched,exhausted:wyrdfluxSprint.exhausted,dashCost:WYRDFLUX_DASH_STAMINA_COST},startupLoad:{verified:wyrdfluxStartupValidated,frames:wyrdfluxStartupFrames},pcInput:desktopPC?{mode:pcPadState.mode,connected:pcPadState.connected,index:pcPadState.index,id:pcPadState.id,switches:pcPadState.switches,buttons:pcPadState.pressedButtons,pointerLocked:document.pointerLockElement===world,armoryOpen:document.body.classList.contains('armory-open'),moveX:inputs.moveX,moveZ:inputs.moveZ,shoot:inputs.shoot}:null,player:player&&{x:player.x,z:player.z,hp:player.hp,shield:player.shield,maxHp:player.maxHp,maxShield:player.maxShield,damageMult:player.damageMult,cash:player.cash,rage:player.rage},enemies:enemies.length,spawnPending,weapon:WEAPONS[gun].name,weaponMix:mixGun>=0?WEAPONS[mixGun].name:null,hybridName:weaponMixName(gun,mixGun),ownedWeapons:activeGun.map((v,i)=>v?WEAPONS[i].name:null).filter(Boolean),upgradeCatalogCount:UPGRADES.length,weaponCatalogCount:WEAPONS.length,pcMusicMultiplier:desktopPC?3:1,pcHealthBars:desktopPC?{visible:afterlightPcHealth.count,bossRatio:afterlightPcHealth.bossHP,damagedRecent:afterlightPcHealth.damageVisible,overlay:!!afterlightPcHealth.layer}:null,meadowWaveChance:MEADOW_WAVE_CHANCE,meadowEpisodeActive,meadowEpisodeCount,fusionCount:FUSIONS.length,meleeHits,meleeRetreats,rangedChargedShots,enemyCombat:enemies.slice(0,6).map(e=>({type:e.type,x:e.x,z:e.z,facing:e.facing,intent:e.intent,flinch:e.flinch||0,stage:e.meleeStage,ranged:e.rangedStage,animation:enemyPose(e).action,moveSpeed:e.moveSpeed||0,maxHp:e.maxHp,baseSpeed:e.speed,hellVariant:e.hellVariant||null,hellCastStage:e.hellCastStage||null,bodyRadius:enemyCollisionRadius(e)})),bossUltStages:enemies.filter(isBoss).map(e=>e.ultimateStage),bossUltsActive:enemies.filter(e=>isBoss(e)&&e.ultimateStage==='fire').length,relays:activeRelays(),coreOnline,energy:player.energy,height:player.height,objective:objective()?.id||null,interactProgress,staticVertices:staticGPU.count,dynamicVertices:dynamicGPU.count,engineeringCabinets:engineeringEmitters.length,atmosphericMachines:atmosphericMachines.length,impactScarCount:impactScars.length,detailPass:'flesh-horror-v029',infernalFX:{fullBodyModels:infernalOrganicModels,runes:infernalRunesVisible,crackSegments:infernalCracksVisible,runicSymbols:INFERNAL_RUNE_STROKES.length,placedCarvings:HELL_GLYPHS.length,blenderPortalRunestone:!!BLENDER_KIT?.hell_runestone,blenderRuneStoneTriangles:BLENDER_KIT?.hell_runestone?.triangles||0,carvedStaticTriangles:runicCarvedStaticTriangles,basaltReliefTriangles:runicTerrainTriangles,emissiveRuneTriangles:runicTriangles,tremors:hellTremorCount,tremorLife:hellTremorLife,musicGain:hellMusicGain,scoreBpm:hellBreach.state==='active'?HELL_BPM:MUSIC_BPM},stylePack:{active:activeWorldStylePack().id,shaderCode:activeWorldStylePack().shaderCode,registered:[...WORLD_STYLE_PACKS.keys()],transitions:styleTransitionCount,staticDetails:infernalStaticDetails,atmosphereDots:infernalAtmosphereDots},testLab:{active:!!testLabMode,mode:testLabMode,visibleEnemyMeshes,culledEnemyMeshes,spawnVisuals},animationFX:{enemyPolish:lastMotionDetails,impactJets:impactJets.length,deathEchoes:deathGhosts.length,weaponSway:[weaponMotion.swayX,weaponMotion.swayY],renderScale:framePacing.scale,averageFrameMs:framePacing.averageMs},visualKit:'afterlight-v021-wall-maw-hell-breach',
 hellBreach:{state:hellBreach.state,stage:hellBreach.stage,stages:hellBreach.stages,
  kills:hellBreach.kills,reward:hellBreach.reward,encountered:hellBreach.encountered,
  persistentClears:meta.hellBreachClears||0},
 wallMaw:enemies.find(e=>e.type==='wallmaw')?
  {hp:enemies.find(e=>e.type==='wallmaw').hp,
   phase:enemies.find(e=>e.type==='wallmaw').wall?.phase,
   casts:enemies.find(e=>e.type==='wallmaw').wall?.casts,
   x:enemies.find(e=>e.type==='wallmaw').x,z:enemies.find(e=>e.type==='wallmaw').z}:null,
 wallMawCasts,hellFiendsFought,hellCompleted,hellCinderShots,hellShadeFeints,hellHornedRushes,hellKnightShots,hellKnightCharges,hellFootprintCount:hellFootprints.length,skyLightDesign:'fast_hairline_0.008_m',
 blenderKitModels:Object.keys(BLENDER_KIT||{}).length,blenderVertices,blenderPassModels,blenderActionLibrary:window.OrganicRigV037?.actions(),pinkyDrawn,pinkyCharges,pinkyAvailable:!!BLENDER_KIT?.hell_pinky,hellKnightDrawn,hellKnightAvailable:!!BLENDER_KIT?.hell_knight,impDrawn,impAvailable:!!BLENDER_KIT?.hell_imp,hellRosterMarkedImp,hellRosterMarkedKnight,hellRosterMarkedCharger,impLeaps,impFireballs,impLandings,pinkyDodgeHops,organicFootPlants,organicLockedFeet,organicStanceVertices,organicDeathFrames,organicIKVertices,organicIKConstraints:window.OrganicRigV037?.diagnostics().constraints||0,organicSkeletonActive:!!window.OrganicRigV037,demonAnimatedVertices,organicHellRoster:['imp','pinky','hellknight','archfiend'],contactShadowCount:lastContactShadows,contactShadowVertices:lastContactVertices,
 weaponChassis:WEAPONS[gun].prototype?FORGE_SHAPES[WEAPONS[gun].variant%FORGE_SHAPES.length]+' MK-'+(Math.floor(WEAPONS[gun].variant/12)+1):null,meta:{...meta,passiveStacks:{...meta.passiveStacks},unlockedCount:Object.keys(meta.unlocked).length},blockworld:{...blockworld,rarity:BLOCKWORLD_SPAWN_CHANCE,alive:enemies.filter(e=>!!e.blockKind).map(e=>e.blockKind)},permanentPassives:{stacks:passiveTotalStacks(),bonuses:permanentStats(),heavenClears:meta.heavenSanctumClears,blockworldClears:meta.blockworldClears},metaCounts:metaCounts(),movementStyles:Object.keys(MOTION_STYLE).length,puppet:enemies.find(e=>e.type==='puppet')?.puppet||null,heatTiles:heatMarks.length,lightDensity:'reduced',laserScale:.4,laserOpacityApprox:.4,bossIntro:{active:bossCine.active,type:bossCine.type,clock:bossCine.clock,seen:bossCine.seen,skipped:bossCine.skipped,finished:bossCine.finished,camera:bossCine.active?bossCamera():null},cinematic:{active:introCine.active,shown:introCine.shown,shot:introCine.shot,clock:introCine.clock,duration:introCine.duration,actorCount:introCine.actorCount,skipCount:introCine.skipCount,replayCount:introCine.replayCount,camera:introCine.active?cinematicCamera():null},weaponAnimationCount:ORIGINAL_WEAPON_COUNT,soundProfileCount:ORIGINAL_WEAPON_COUNT,weaponVariantCount:WEAPONS.length-ORIGINAL_WEAPON_COUNT,forgeChassisCount:FORGE_SHAPES.length*2,advancedVolleys,bossBeamPatterns:5,soundtrackBpm:scoreBpm||MUSIC_BPM,soundtrackOriginal:true,adaptiveScore:{scene:scoreSceneId,cue:scoreCue,bpm:scoreBpm,drawnOutLead:true,impactTailSeconds:3.45,crossfadeActive:!!scoreLayerBus,retiredLayers:scoreLayerRetired,intensity:Math.round(scoreIntensity*100)/100,sceneCount:Object.keys(SCORE_SONGS).length,transitions:scoreChanges,polyphony:scoreVoices.length,reverb:!!scoreRoom,ducking:ctxAudio?ctxAudio.currentTime<scoreDuckingUntil:false},soundtrackActive:audioUnlocked&&!muted&&ctxAudio?.state==='running',ascensionUpgradeCount:ASCENSION_UPGRADES.length,cycle:cycleOf(wave),localWave:localWaveOf(wave),difficulty:cycleDifficulty(wave),viewmodelPose:viewmodelPose(player),cameraYaw:player.yaw,cameraPitch:player.pitch,lastShotEndpointY:tracers.length?tracers[tracers.length-1].y2:null,lastShotDirectionY:tracers.length?(tracers[tracers.length-1].dirY||0):null,arenaTiles:N,arenaArea:N*N,openFloorTiles:map.reduce((a,row)=>a+row.filter(v=>!v).length,0),mapFingerprint:mapFingerprint(),layout:SECTOR_THEMES[sector].name,augmentCount:Object.values(player.perks||{}).reduce((a,b)=>a+b,0),fusions:[...(player.fusions||[])],perks:{...(player.perks||{})},burstCount:burstRings.length,laserCount:tracers.length,lingerBeamCount:lingeringBeams.length,lingerBeamSeconds:Math.max(0,...lingeringBeams.map(b=>b.life)),
 lingerBeamStyles:[...new Set(lingeringBeams.map(b=>b.style))],lingerCollisionSafe:lingeringBeams.every(b=>b.collisionBound),
 puppetFinale:{active:puppetFinale.active,progress:puppetFinale.t/puppetFinale.duration,sparks:puppetFinale.sparks,completed:puppetFinale.completed,power:puppetPower()},gunWallFactor:lastGunWallFactor,gunScreenScale:lastGunScreenScale,laserTrailSeconds:Math.max(0,...tracers.map(t=>t.life)),laserMaxSegment:Math.max(0,...tracers.map(t=>t.lastRenderedSegment||0)),hybridRocketBuckshot:(mixGun>=0&&[WEAPONS[gun],WEAPONS[mixGun]].some(w=>w.effect==='splash')&&[WEAPONS[gun],WEAPONS[mixGun]].some(w=>w.effect==='scatter')),viewmodelVertices:viewmodelGPU.count,impactCount:impactFlashes.length,debrisCount:debris.length,muzzleFlash:player.muzzleT||0,speed:Math.round(Math.hypot(player.vx,player.vz)*100)/100,lean:player.lean,visualQuality:$('quality').value}),start:()=>startGame(false),resumeForTest:()=>{if(!location.hash.includes('qa'))return false;startGame(true);return phase==='play'||phase==='upgrade'},renderForTest:()=>{if(!location.hash.includes('qa'))return false;render();return true},previewStyleForTest:id=>{if(!location.hash.includes('qa'))return false;if(id!==null&&!WORLD_STYLE_PACKS.has(id))return false;stylePreviewId=id;render();return gl.getError()===gl.NO_ERROR;},startTrialForTest:mode=>{if(!location.hash.includes('qa'))return false;return trialStart(mode)},
 hellRosterV0615ForTest:()=>{
  if(!location.hash.includes('qa')||testLabMode!=='hell'||hellBreach.state!=='active')return null;
  // This is a real renderer probe in the no-save test realm, never a
  // pretend precomputed game-state assertion.
  const oldSave=localStorage.getItem('su2-save');
  const roster=[['imp','skitter'],['pinky','crusher'],['hellknight','crusher']];
  const placed=[];
  for(let i=0;i<roster.length;i++){
   const [variant,type]=roster[i],candidates=[];
   const front=player.yaw||0;
   for(const d of [4.3,5.6,7.3,3.1])for(const side of [-.55,0,.55]){
    const a=front+side+i*.12;
    candidates.push({x:player.x+Math.sin(a)*d,z:player.z-Math.cos(a)*d});
   }
   const pos=candidates.find(p=>free(p.x,p.z,.7)&&lineClear(p.x,p.z,player.x,player.z))||
     randomOpen(5);
   const e=newEnemy(pos,false);
   e.type=type;e.hellVariant=variant;e.hp=e.maxHp=600;
   e.appearT=0;e.attackT=99;e.impRevealed=true;
   e.meleeStage=variant==='pinky'?'windup':'seek';
   e.meleeT=.35;e.meleeTotal=.61;
   e.meleeAimed=Math.atan2(-(player.x-e.x),-(player.z-e.z));
   e.hellCastStage=variant==='pinky'?'idle':'charge';
   e.hellCastT=variant==='imp'?.58:.82;
   e.hellCastAim=Math.atan2(player.x-e.x,-(player.z-e.z));
   e.facing=e.hellCastAim;
   enemies.push(e);placed.push({variant,x:e.x,z:e.z});
  }
  const before={imp:hellRosterMarkedImp,knight:hellRosterMarkedKnight,
    charger:hellRosterMarkedCharger};
  render();
  const kit={
   imp:BLENDER_KIT?.hell_imp?.triangles||0,
   pinky:BLENDER_KIT?.hell_pinky?.triangles||0,
   knight:BLENDER_KIT?.hell_knight?.triangles||0
  };
  return {placed,kit,rendererGLValid:gl.getError()===gl.NO_ERROR,
   telegraphs:{
    imp:hellRosterMarkedImp>before.imp,
    knight:hellRosterMarkedKnight>before.knight,
    charger:hellRosterMarkedCharger>before.charger},
   actualBlenderAnimatedSkin:!!window.OrganicRigV037?.actions().actualBlender,
   runSaveUnchanged:localStorage.getItem('su2-save')===oldSave};
 },
finishTrialForTest:()=>{if(!location.hash.includes('qa')||!testLabMode)return false;return trialFinish(true)},
 puppetFinaleForTest:()=>{
  if(!location.hash.includes('qa'))return null;
  resetGame();phase='play';showScreen(null);testLabMode='puppet-finale';
  wave=CAMPAIGN_WAVES;sector=6;player.perks={vamp:2};player.cash=777;
  player.hp=player.maxHp;player.shield=player.maxShield;
  enemies=[];spawnPending=0;
  const e=newEnemy({x:C,z:C},true),hp=3200,arm=hp*.30,core=hp-arm*2;
  e.type='puppet';e.boss=true;e.hp=e.maxHp=hp;
  e.puppet={left:arm,right:arm,head:core,leftMax:arm,rightMax:arm,headMax:core,
   phase:'arms',cycle:0,stage:'charge',clock:1.65,stageDuration:1.65,
   startLeft:0,startRight:0,fireDuration:2.05,pattern:0,hitCooldown:0};
  enemies.push(e);player.x=C;player.z=C+7;
  damageEnemy(e,arm+2,'weapon',0,'left');
  damageEnemy(e,arm+2,'weapon',0,'right');
  const exposed=e.puppet?.phase==='head';
  damageEnemy(e,core-.72,'weapon',0,'head');
  const nearOne=e.hp>0&&e.hp<1&&Math.ceil(e.hp)===1&&e.puppet.head>0;
  const powerNearDeath=puppetPower();
  // Final accurate hit must remove boss completely even though HUD rounded to 1.
  damageEnemy(e,.73,'weapon',0,'head');
  const secondPhase=e.puppet.phase==='reborn'&&e.puppet.rebornCount===1&&
    e.puppet.head>core*.60&&!puppetFinale.active;
  const secondHp=e.puppet.head;
  // The new crimson phase is a second actual health bar, not a fake cinematic.
  damageEnemy(e,secondHp+.8,'weapon',0,'head');
  const finalHit=e.hp===0&&e.puppet.head===0;
  const finaleStarted=puppetFinale.active&&enemies.every(x=>x!==e);
  const firstSparks=puppetFinale.sparks;
  render();const gpuValid=gl.getError()===gl.NO_ERROR;
  for(let n=0;n<Math.ceil(puppetFinale.duration*60)+3;n++)tick(1/60);
  const deathComplete=!puppetFinale.active&&puppetFinale.completed>0;
  const rewardOffered=phase==='upgrade'&&runRecord.ascensions>=1;
  const cashBeforeNext=player.cash;
  beginWave(wave+1);
  const nextCycle=cycleOf(wave)===2&&localWaveOf(wave)===1&&phase==='play';
  const inventoryPreserved=player.perks.vamp===2&&player.cash===cashBeforeNext&&
   player.cash>777&&activeGun[0]===true;
  const answer={exposed,nearOne,secondPhase,secondHp,finalHit,finaleStarted,firstSparks,powerNearDeath,
   gpuValid,deathComplete,rewardOffered,nextCycle,inventoryPreserved,
   finaleSparks:puppetFinale.sparks,cycle:cycleOf(wave),wave,phase};
  return answer;
 },
 gamepadAllMenusForTest:()=>{
  if(!location.hash.includes('qa'))return null;
  const result={};const screens=[
   ['mainMenu','menu'],['pauseScreen','pause'],['upgradeScreen','upgrade'],
   ['endScreen','dead'],['archiveScreen','archive']
  ];
  for(const [id,p] of screens){
   // Exercise the real generated reward cards, not an empty hidden template.
   // Navigation on an unpopulated upgrade screen is not a meaningful test.
   if(id==='upgradeScreen')presentUpgradeDraft('kill');
   else {phase=p;showScreen(id);}
   if(id==='pauseScreen')refreshWyrdfluxRunInventory();
   const root=pcPadMenuRoot(),targets=pcPadVisibleControls();
   if(targets.length){targets[0].focus({preventScroll:true});pcPadMoveSelection(1);}
   result[id]=root?.id===id&&targets.length>0&&targets.includes(document.activeElement);
  }
  phase='menu';showScreen('mainMenu');
  const permanent=$('permanentPanel');
  if(permanent){permanent.classList.remove('hidden');result.permanentPanel=pcPadMenuRoot()===permanent;
   permanent.classList.add('hidden');}
  const lab=$('testLabPanel');
  if(lab){lab.classList.remove('hidden');result.testLabPanel=pcPadMenuRoot()===lab;
   lab.classList.add('hidden');}
  result.runInventory=!!$('wyrdfluxRunInventory')&&
   $('wyrdfluxRunInventory').textContent.includes('YOUR CURRENT RUN')&&
   $('wyrdfluxRunInventory').textContent.includes('SALVAGE');
  result.interactPromptDefined=typeof updateWyrdfluxInteractPrompt==='function'&&
   typeof wyrdfluxPromptDetails==='function';
  return result;
 },
 wardenRitesForTest:()=>{
  if(!location.hash.includes('qa')||testLabMode!=='warden')return null;
  const w=enemies.find(e=>e.type==='warden'&&e.hp>0);
  if(!w)return null;
  const mites=()=>enemies.filter(e=>e.wardenMite&&e.wardenParentId===w.id);
  // Complete ALL threefold batches; do not assume all 120 mites coexist.
  const advance=()=>{
   let peak=0,firstHitRadius=null,levitation=false,gpu=false;
   for(let step=0;step<560&&w.wardenRite.active;step++){
    tickWardenRite(w,.10);
    const active=mites();
    peak=Math.max(peak,active.length);
    if(firstHitRadius==null&&active.length)
     firstHitRadius=enemyCollisionRadius(active[0]);
    levitation=levitation||w.wardenRite.lift>2.5;
    if(step===43){
     render();gpu=gl.getError()===gl.NO_ERROR;
    }
    if(w.wardenRite.stage==='attack')
     for(const m of active)damageEnemy(m,1e9,'weapon');
   }
   return {spawned:w.wardenRite.spawned,peak,firstHitRadius,levitation,gpu,
    cleared:!w.wardenRite.active};
  };
  damageEnemy(w,w.maxHp*.36,'weapon');
  const firstStarted=w.wardenRite?.phase===1&&w.wardenRite.active;
  const firstHp=w.hp;damageEnemy(w,999999,'weapon');
  const firstInvulnerable=Math.abs(w.hp-firstHp)<.01;
  const first=advance();
  const firstUnsealed=first.cleared&&w.wardenRite.cleared===1;
  damageEnemy(w,w.maxHp*.37,'weapon');
  const secondStarted=w.wardenRite?.phase===2&&w.wardenRite.active;
  const secondHp=w.hp;damageEnemy(w,999999,'weapon');
  const secondInvulnerable=Math.abs(w.hp-secondHp)<.01;
  const second=advance();
  const secondUnsealed=second.cleared&&w.wardenRite.cleared===2;
  const before=w.hp;damageEnemy(w,5,'weapon');
  return {firstStarted,firstInvulnerable,firstCount:first.spawned,
   firstPeak:first.peak,firstHitRadius:first.firstHitRadius,
   firstLevitation:first.levitation,firstGPU:first.gpu,firstUnsealed,
   secondStarted,secondInvulnerable,secondCount:second.spawned,
   secondPeak:second.peak,secondLevitation:second.levitation,
   secondGPU:second.gpu,secondUnsealed,killableAgain:w.hp<before,
   finalPhase:w.wardenRite.phase};
 },
 enterLivingRealmForTest:(id)=>{if(!location.hash.includes('qa'))return false;
  if(phase==='menu'){startLivingRealmTest(id);return livingRealm.active&&livingRealm.id===id;}
  if(phase==='play'&&!livingRealm.active)return enterLivingRealm(id,true);
  return false;},
 krakenForTest:()=>{if(!location.hash.includes('qa')||!livingRealm.testOnly||
  livingRealm.id!=='blackwake')return null;
  const k=blackwakeKraken;
  return {state:k.state,partCount:k.parts.length,
   warningSeconds:BLACKWAKE_KRAKEN_WARNING,
   slamCount:k.slamCount,hp:k.hp,maxHp:k.maxHp,
   mode:k.mode,attackCount:k.attackCount,geyserCount:k.geyserCount,
   geyserHits:k.geyserHits,waterWarning:k.geyserClock,
   severed:k.severedCount,bloodDrops:k.bloodDrops.length,
   bloodPools:k.bloodPools.length,
   limbs:k.parts.map(p=>({id:p.i,hp:p.hp,maxHp:p.maxHp,severed:p.severed,
      bleedTime:p.bleedTime,stumpY:p.stumpY})),
   body:{x:k.body.x,y:k.body.y,z:k.body.z,halfSubmerged:k.body.halfSubmerged,
     scale:k.body.scale},
   bodyOffshore:k.body.halfSubmerged&&
    Math.hypot(k.body.x-BLACKWAKE_CHEST_WORLD.x,k.body.z-BLACKWAKE_CHEST_WORLD.z)>7,
   eyeMount:'body',eyeCount:1,eyeBlinkPeriod:5.6,eyeBlink:k.eye.blink,
   targetSnapshot:k.parts.slice(1).every(t=>Number.isFinite(t.aimX)&&Number.isFinite(t.aimZ))};},
 defeatKrakenForTest:()=>{if(!location.hash.includes('qa')||!livingRealm.testOnly||
   livingRealm.id!=='blackwake'||blackwakeKraken.state!=='active')return false;
  // Real per-limb severance: the old one-shot test bypassed three arms.
  for(const part of blackwakeKraken.parts){
   if(!part.severed)blackwakeKrakenDamage(part.enemy,part.hp+100);
  }
  return blackwakeKraken.state==='defeated'&&blackwakeKraken.severedCount===4;},
 severKrakenLimbForTest:i=>{
  if(!location.hash.includes('qa')||!livingRealm.testOnly||
     livingRealm.id!=='blackwake'||blackwakeKraken.state!=='active')return false;
  const p=blackwakeKraken.parts[i];
  if(!p||p.severed)return false;
  blackwakeKrakenDamage(p.enemy,p.hp+100);
  return p.severed&&p.enemy.hp===0;
 },
 forceKrakenWaterLanceForTest:()=>{
  if(!location.hash.includes('qa')||!livingRealm.testOnly||
     livingRealm.id!=='blackwake'||blackwakeKraken.state!=='active')return false;
  blackwakeKrakenGeyser();return blackwakeKraken.mode==='geyser';
 },
 claimLivingRealmForTest:()=>{if(!location.hash.includes('qa')||!livingRealm.active)return false;
  if(livingRealm.id==='witch')return livingWitchChoice(0);
  return claimLivingReward();},
 exitLivingRealmForTest:()=>{if(!location.hash.includes('qa'))return false;return leaveLivingRealm();},
 returnToMenuForTest:()=>{if(!location.hash.includes('qa'))return false;toMenu();return phase==='menu';},
 beginIntroForTest:()=>{if(!location.hash.includes('qa'))return false;
  if(phase==='play')saveCheckpoint();
  phase='menu';return startOpening(true)},
 advanceIntroForTest:seconds=>{if(!location.hash.includes('qa')||!introCine.active||!Number.isFinite(seconds))return false;
  introCine.clock=Math.min(introCine.duration,Math.max(0,introCine.clock+clamp(seconds,0,20)));
  updateOpeningScene();render();return true},
 skipIntroForTest:()=>{if(!location.hash.includes('qa'))return false;return finishOpening(true)},
 rayForTest:(yaw,pitch,range=15)=>{if(!location.hash.includes('qa')||phase!=='play'||!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
   const hit=shotRay3D(yaw,clamp(pitch,-1.20,1.20),clamp(range,1,36));
   return {enemyType:hit.enemy?.type||null,distance:hit.distance,endY:hit.hit.y,dirY:hit.dirY};
 },
 equipGunForTest:i=>{if(!location.hash.includes('qa')||phase!=='play'||!activeGun[i])return false;return chooseWeapon(i)},setViewForTest:(yaw,pitch)=>{if(!location.hash.includes('qa')||phase!=='play'||!Number.isFinite(yaw)||!Number.isFinite(pitch))return false;player.yaw=yaw;player.pitch=clamp(pitch,-1.20,1.20);return true},step:seconds=>{for(let n=0;n<Math.min(300,Math.ceil(seconds*60));n++)tick(1/60)},shoot:()=>shoot(),jump:()=>jump(),dash:()=>dash(),setPositionForTest:(x,z)=>{if(phase==='play'&&Number.isFinite(x)&&Number.isFinite(z)&&free(x,z,.26)){player.x=x;player.z=z;return true}return false},holdInteractForTest:(seconds)=>{inputs.interact=true;for(let n=0;n<Math.min(300,Math.ceil(seconds*60));n++)tick(1/60);inputs.interact=false},save:()=>saveCheckpoint(),waveComplete:()=>{spawnPending=0;enemies=[];waveComplete()},
 finalBossForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  endBossIntro(true);beginWave(CAMPAIGN_WAVES);
  spawnPending=1;spawnClock=0;tick(1/60);
  return !!enemies.find(e=>e.type==='puppet')&&bossCine.active;
 },
 forcePuppetPatternForTest:pattern=>{
  if(!location.hash.includes('qa')||phase!=='play'||!Number.isInteger(pattern)||pattern<0||pattern>4)return false;
  const e=enemies.find(e=>e.type==='puppet'&&e.puppet?.phase==='arms');if(!e)return false;
  e.puppet.pattern=pattern;e.puppet.stage='charge';e.puppet.clock=1.4;
  e.puppet.stageDuration=1.4;e.puppet.fireDuration=2.05;return true;
 },
 damagePuppetForTest:(part,damage)=>{
  if(!location.hash.includes('qa')||phase!=='play'||!['left','right','head'].includes(part)||!Number.isFinite(damage))return false;
  const e=enemies.find(e=>e.type==='puppet');if(!e)return false;
  damageEnemy(e,clamp(damage,.01,1e6),'weapon',0,part);return true;
 },
 tickBossForTest:seconds=>{
  if(!location.hash.includes('qa')||phase!=='play'||bossCine.active||!Number.isFinite(seconds))return false;
  for(let i=0,n=Math.min(900,Math.floor(Math.max(0,seconds)*60));i<n&&phase==='play';i++)tick(1/60);
  return true;
 },
 spawnBossForTest:(type='colossus')=>{if(!location.hash.includes('qa')||phase!=='play'||!BOSS_NAMES[type])return false;
  const pos={x:player.x+5,z:player.z};if(!free(pos.x,pos.z,.65))return false;
  const e=newEnemy(pos,true);e.type=type;e.boss=true;
   if(type==='puppet'&&!e.puppet){
    const hp=e.maxHp,arm=hp*.30;
    e.puppet={left:arm,right:arm,head:hp-2*arm,leftMax:arm,rightMax:arm,headMax:hp-2*arm,phase:'arms',
     cycle:0,stage:'charge',clock:1.65,stageDuration:1.65,startLeft:0,startRight:0,fireDuration:2.05,pattern:0,hitCooldown:0};
   }
   e.ultimateClock=type==='puppet'?99:0;enemies.push(e);return true;
 },
 triggerBossIntroForTest:(type='warden')=>{
  if(!location.hash.includes('qa')||phase!=='play'||!BOSS_NAMES[type])return false;
  if(bossCine.active)endBossIntro(true);
  const pos=randomOpen(8);
  if(!pos||!free(pos.x,pos.z,.32))return false;
  const e=newEnemy(pos,true);e.type=type;e.boss=true;
  if(type==='puppet'&&!e.puppet){
   const arm=e.maxHp*.30;
   e.puppet={left:arm,right:arm,head:e.maxHp-2*arm,
    leftMax:arm,rightMax:arm,headMax:e.maxHp-2*arm,
    phase:'arms',cycle:0,stage:'charge',clock:1.65,stageDuration:1.65,
    startLeft:0,startRight:0,fireDuration:2.05,pattern:0,hitCooldown:0};
  }
  enemies.push(e);return beginBossIntro(e);
 },
 advanceBossIntroForTest:seconds=>{
  if(!location.hash.includes('qa')||!bossCine.active||!Number.isFinite(seconds))return false;
  updateBossIntro(clamp(seconds,0,6));render();return true;
 },
 skipBossIntroForTest:()=>location.hash.includes('qa')&&endBossIntro(true),
 // QA-only meta-progression controls. Production UI cannot modify career stats.
 addCareerXPForTest:amount=>{
  if(!location.hash.includes('qa')||!Number.isFinite(amount)||amount<0||amount>1000000)return false;
  meta.xp+=Math.floor(amount);evaluateMetaUnlocks();return true;
 },
 setCareerStatForTest:(key,value)=>{
  if(!location.hash.includes('qa')||!['kills','bossKills','perfectBosses','perfectPuppets','ascensions','maxWave','dashes','shots'].includes(key)||!Number.isFinite(value)||value<0||value>1000000)return false;
  meta[key]=Math.floor(value);evaluateMetaUnlocks();return true;
 },
 grantUnlockedVariantForTest:i=>{
  if(!location.hash.includes('qa')||phase!=='play'||!Number.isInteger(i)||i<ORIGINAL_WEAPON_COUNT||i>=WEAPONS.length)return false;
  const w=WEAPONS[i];
  if(!meta.unlocked[w.unlockId])return false;
  grantUpgrade(ARMORY_CARDS[i]);return !!activeGun[i];
 },
 dieForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  player.hp=0;gameOver();return phase==='dead';
 },
 archiveForTest:()=>{
  if(!location.hash.includes('qa'))return false;
  openArchive();return $('archiveList').children.length;
 },
 grantWeaponForTest:i=>{if(!location.hash.includes('qa')||phase!=='play'||i<0||i>=WEAPONS.length)return false;grantUpgrade(ARMORY_CARDS[i]);hudWeapon();return !!activeGun[i]},
 setMixForTest:i=>{if(!location.hash.includes('qa')||phase!=='play'||i===gun||(i!==-1&&!activeGun[i]))return false;mixGun=i;hudWeapon();return true},
 grantForTest:id=>{if(!location.hash.includes('qa')||phase!=='play')return false;const u=UPGRADES.find(u=>u.id===id);if(!u||stacks(id)>=u.max)return false;grantUpgrade(u);return true},
 spawnWallMawForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  endBossIntro(true);spawnPending=0;enemies=[];projectiles=[];
  const e=newEnemy({x:C,z:1.90},false);
  e.type='wallmaw';e.boss=true;e.hp=e.maxHp=ENEMY_STATS.wallmaw[0];
  e.x=C;e.z=1.9;e.speed=0;e.wall={phase:'emerge',clock:0,attack:0,
   attackT:2.6,summonT:18,mouth:0,lash:0,aim:0,casts:0};
  e.damageAtSpawn=runRecord.damageEvents;enemies.push(e);
  return true;
 },
 defeatWallMawForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  const e=enemies.find(e=>e.type==='wallmaw');if(!e)return false;
  damageEnemy(e,e.hp+10000,'weapon');
  spawnPending=0;
  for(const leftover of [...enemies])damageEnemy(leftover,leftover.hp+1000,'weapon');
  return hellBreach.state==='pending'||hellBreach.state==='gate';
 },
 spawnPinkyNearForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
  const a=player.yaw||0;
  const candidates=[
   {x:player.x+Math.sin(a)*3.5,z:player.z-Math.cos(a)*3.5},
   {x:player.x+Math.sin(a)*4,z:player.z-Math.cos(a)*4},
   {x:player.x+3.5,z:player.z},
   {x:player.x-3.5,z:player.z}
  ];
  const p=candidates.find(p=>free(p.x,p.z,.67)&&lineClear(p.x,p.z,player.x,player.z));
  if(!p)return false;
  const e=newEnemy(p,false);e.type='crusher';e.hellVariant='pinky';
  e.hp=e.maxHp=ENEMY_STATS.crusher[0]*2.0;
  e.speed=ENEMY_STATS.crusher[1]*1.64;e.attackT=.18;
  e.meleeStage='seek';e.meleeT=0;e.appearT=0;
  e.facing=Math.atan2(player.x-e.x,-(player.z-e.z));
  enemies.push(e);return true;
 },
 spawnHellKnightNearForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
  const a=player.yaw||0,candidates=[
    {x:player.x+Math.sin(a)*4.4,z:player.z-Math.cos(a)*4.4},
    {x:player.x+4,z:player.z},{x:player.x-4,z:player.z},
    {x:player.x,z:player.z+4}
   ];
  const p=candidates.find(p=>free(p.x,p.z,.70)&&lineClear(p.x,p.z,player.x,player.z));
  if(!p)return false;
  const e=newEnemy(p,false);e.type='crusher';e.hellVariant='hellknight';
  e.hp=e.maxHp=ENEMY_STATS.crusher[0]*3.5;e.speed=ENEMY_STATS.crusher[1]*1.26;
  e.attackT=.24;e.meleeStage='seek';e.appearT=0;e.hellCastStage='idle';
  e.hellCastDelay=.15;e.facing=Math.atan2(player.x-e.x,-(player.z-e.z));
  enemies.push(e);return true;
 },
 translatePlantedFeetForTest:()=>{
   if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
   const picked=enemies.filter(e=>['pinky','hellknight','imp'].includes(e.hellVariant));
   if(picked.length<3)return false;
   let moved=0;
   for(const e of picked){
    const nx=e.x+.078,nz=e.z+.032;
    if(free(nx,nz,enemyCollisionRadius(e))){
     e.x=nx;e.z=nz;e.moveSpeed=3.2;
     moved++;
    }
   }
   // QA collision-checked root translation during fixed support phase;
   // real gameplay pathfinding performs this movement outside QA.
   time+=.028;
   return moved>=1;
  },
 setOrganicStanceForTest:()=>{
   if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
   const picked=enemies.filter(e=>['pinky','hellknight','imp'].includes(e.hellVariant));
   if(picked.length<3)return false;
   for(const e of picked){e.moveSpeed=3.2;e.bob=Math.PI*1.5;e.organicPose=null;}
   return true;
  },
 triggerPinkyHitForTest:()=>{
   if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
   const e=enemies.find(e=>e.hellVariant==='pinky');if(!e)return false;
   e.hit=.30;e.pinkyDodgeCooldown=0;e.meleeStage='seek';
   return true;
  },
 forceImpCastForTest:()=>{
   if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
   const e=enemies.find(e=>e.hellVariant==='imp');if(!e)return false;
   // Stage a genuinely clear, ranged shot in the same bounded arena physics.
   // During the earlier mixed encounter the Imp had chased into point-blank
   // range; its perfectly valid AI refused a ranged attack at that distance.
   const choices=[];
   for(const radius of [5.0,4.4,6.0]){
    for(let j=0;j<8;j++){
     const a=(player.yaw||0)+j*Math.PI/4;
     choices.push({x:player.x+Math.sin(a)*radius,z:player.z-Math.cos(a)*radius});
    }
   }
   const valid=p=>{
    const dist=Math.hypot(player.x-p.x,player.z-p.z);
    if(dist<=2.1||dist>=12.4||!free(p.x,p.z,.35)||
       !lineClear(p.x,p.z,player.x,player.z))return false;
    const aim=Math.atan2(player.x-p.x,-(player.z-p.z));
    return free(p.x+Math.sin(aim)*.50,p.z-Math.cos(aim)*.50,.14);
   };
   const p=valid(e)?{x:e.x,z:e.z}:choices.find(valid);
   if(!p)return false;
   e.x=p.x;e.z=p.z;e.pathT=0;e.route=null;
   e.facing=Math.atan2(player.x-e.x,-(player.z-e.z));
   e.impLeapT=0;e.impLeapHeight=0;e.impLeapCooldown=4;
   e.meleeStage='seek';e.hellCastStage='charge';e.hellCastT=.06;
   e.attackT=Math.max(1.3,e.attackT||0);return true;
  },
 spawnImpNearForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
  const a=player.yaw||0,candidates=[
   {x:player.x+Math.sin(a)*4,z:player.z-Math.cos(a)*4},
   {x:player.x+4,z:player.z},{x:player.x-4,z:player.z},
   {x:player.x,z:player.z+4}
  ];
  const p=candidates.find(p=>free(p.x,p.z,.33)&&lineClear(p.x,p.z,player.x,player.z));
  if(!p)return false;
  const e=newEnemy(p,false);e.type='skitter';e.hellVariant='imp';
  e.hp=e.maxHp=ENEMY_STATS.skitter[0]*2.2;
  e.speed=ENEMY_STATS.skitter[1]*1.66;
  e.attackT=.36;e.appearT=0;e.meleeStage='seek';
  e.hellCastStage='idle';e.impLeapCooldown=.06;e.hellCastDelay=.24;
  e.facing=Math.atan2(player.x-e.x,-(player.z-e.z));
  enemies.push(e);return true;
 },
 spawnHellVariantForTest:(variant)=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active'||
   !['imp','archfiend','pinky','hellknight'].includes(variant))return false;
  const type=variant==='archfiend'?'behemoth':variant==='horned'||variant==='pinky'||variant==='hellknight'?'crusher':
   'skitter';
  const pos=variant==='archfiend'?bossSpawnClearance():randomOpen(5);
  const e=newEnemy(pos,false);e.type=type;e.boss=variant==='archfiend';
  e.hellVariant=variant;
  e.hp=e.maxHp=ENEMY_STATS[type][0]*(variant==='archfiend'?3.2:variant==='hellknight'?2.55:1.7);
  e.speed=ENEMY_STATS[type][1]*(variant==='pinky'?1.64:variant==='hellknight'?1.26:variant==='imp'?1.66:1.3);
  e.hellCastStage='idle';e.hellCastDelay=.03;
  e.hellStepClock=.08;
  e.attackT=1.2;
  enemies.push(e);return true;
 },
 enterHellForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='gate')return false;
  return beginHellBreach();
 },
 spawnOphanimForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  endBossIntro(true);enemies=[];spawnPending=0;projectiles=[];
  const e=newEnemy(bossSpawnClearance(),false);
  e.type='ophanim';e.boss=true;e.hp=e.maxHp=ENEMY_STATS.ophanim[0];
  e.appearT=0;e.ultimateStage='idle';e.ultimateClock=2.6;e.attackT=99;
  e.damageAtSpawn=runRecord.damageEvents;enemies.push(e);return true;
 },
 defeatOphanimForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play')return false;
  const e=enemies.find(e=>e.type==='ophanim');if(!e)return false;
  damageEnemy(e,e.hp+1e6,'weapon');spawnPending=0;
  return heavenSanctum.state==='gate';
 },
 enterHeavenForTest:()=>location.hash.includes('qa')&&phase==='play'&&beginHeavenSanctum(),
 claimHeavenAltarForTest:()=>location.hash.includes('qa')&&phase==='play'&&finishHeavenSanctum(),
 heavenStateForTest:()=>location.hash.includes('qa')?{...heavenSanctum,wave,phase,playerX:player.x,playerZ:player.z}:null,
 advanceHellForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='active')return false;
  endBossIntro(true);
  spawnPending=0;
  for(const e of [...enemies])damageEnemy(e,e.hp+1e6,'weapon');
  advanceHellStage();
  return true;
 },
 skipHellForTest:()=>{
  if(!location.hash.includes('qa')||phase!=='play'||hellBreach.state!=='gate')return false;
  $('hellSkipButton').click();return hellBreach.state==='none';
 },
 staticGlowNearTest:(distance=.45)=>{
  if(!location.hash.includes('qa')||phase!=='play'||!Number.isFinite(distance))return null;
  const t=clamp((distance-.25)/.85,0,1),smooth=t*t*(3-2*t);
  return {distance,emissionScale:.08+.92*smooth};
 },
 spawnTypeForTest:(type='sentinel',distance=2.0)=>{
  if(!location.hash.includes('qa')||phase!=='play'||!ENEMY_STATS[type]||isBoss({type}))return false;
  const x=player.x+distance,z=player.z;if(!free(x,z,.28))return false;
  const e=newEnemy({x,z},false);e.type=type;e.speed=ENEMY_STATS[type][1];
  e.maxHp=e.hp=ENEMY_STATS[type][0]*(1+(localWaveOf(wave)-1)*.09)*cycleDifficulty(wave).hp;e.speed*=cycleDifficulty(wave).speed;e.attackT=0;
  e.facing=0;e.meleeStage='seek';e.meleeT=0;e.rangedStage='idle';enemies.unshift(e);return true;
 },
 spawnEnemyForTest:n=>{if(!location.hash.includes('qa')||phase!=='play')return 0;for(let i=0;i<Math.min(5,Math.max(0,n|0));i++){const candidate={x:clamp(player.x+1.4+i*.6,1.5,19.5),z:player.z};if(free(candidate.x,candidate.z,.34))enemies.push(newEnemy(candidate,false))}return enemies.length},
 blastForTest:()=>{if(!location.hash.includes('qa')||phase!=='play')return false;blastAt(player.x,player.z,120,3,0,'shock');return true}};
createMap();player=defaultPlayer();buildStatic();resize();loadPrefs();checkCheckpoint();evaluateMetaUnlocks();initPermanentMenu();refreshWyrdfluxShadowMenu();refreshAfterlightPcCollection();installWyrdfluxTreasureMenu();brandWyrdfluxUI();
// A short native loading view replaces the unconditional launch cinematic.
bootWyrdfluxMenu();
addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{
 if(!ctxAudio)return;
 if(document.hidden){try{ctxAudio.suspend()?.catch?.(()=>{})}catch(_){}}
 else if(audioUnlocked&&!muted){
  try{ctxAudio.resume()?.catch?.(()=>{})}catch(_){}
  musicNext=ctxAudio.currentTime+.055;
 }
});
requestAnimationFrame(frame);
})();
