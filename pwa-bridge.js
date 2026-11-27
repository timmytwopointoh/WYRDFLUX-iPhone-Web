(()=>{'use strict';const models={"scene": {"path": "meadow/MeadowArena-GameLOD.glb", "size": 25944488}, "monster": {"path": "meadow/MeadowCatFiend.glb", "size": 1706704}, "witch": {"path": "realms/Blackthorn-Cabin-v5.glb", "size": 37255428}, "greenhouse": {"path": "realms/Enchanted-Greenhouse.glb", "size": 35553168}, "library": {"path": "realms/Arcane-Aurora-Library.glb", "size": 8223032}, "warden": {"path": "realms/Wyrdflux-Iron-Warden-v056.glb", "size": 4514348}, "blackwake": {"path": "realms/Blackwake-Cove-v0604.glb", "size": 2404200}, "circus0": {"path": "realms/Wyrdflux-HumanCircus-0-acrobat.glb", "size": 2015908}, "circus1": {"path": "realms/Wyrdflux-HumanCircus-1-mime.glb", "size": 1804576}, "circus2": {"path": "realms/Wyrdflux-HumanCircus-2-dancer.glb", "size": 2036440}, "circus3": {"path": "realms/Wyrdflux-HumanCircus-3-ringleader.glb", "size": 2230020}};let activeId='',active=null;
function size(id){return models[id]?.size||0}
function bytes(id){if(id===activeId&&active)return active;const m=models[id];if(!m)return null;
const x=new XMLHttpRequest();x.open('GET',m.path,false);x.overrideMimeType('text/plain; charset=x-user-defined');x.send(null);
if(x.status!==200)throw Error('WYRDFLUX model HTTP '+x.status+' '+id);
const s=x.responseText;if(s.length!==m.size)throw Error('WYRDFLUX model length '+id);
const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&255;activeId=id;active=b;return b}
function part(id,off,len){const b=bytes(id);if(!b)return '';const a=b.subarray(off,off+Math.min(len,192*1024));let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s)}
window.VEILFORGE_ASSETS={meadowSize:()=>size('scene'),monsterSize:()=>size('monster'),readMeadowChunk:(o,n)=>part('scene',o,n),readMonsterChunk:(o,n)=>part('monster',o,n),readMeadowGLB:()=>size('scene')<=1048576?part('scene',0,size('scene')):''};
window.WYRDFLUX_REALM_ASSETS={size,readChunk:part,available:()=>Object.fromEntries(Object.keys(models).filter(k=>k!=='scene'&&k!=='monster').map(k=>[k,true]))};
window.addEventListener('error',e=>console.error('WYRDFLUX WEB',e.message));
})();