
(function(){
const $$=(s,r=document)=>[...r.querySelectorAll(s)],byTxt=(s,t)=>$$(s).find(e=>e.textContent.trim()===t),has=(s,t)=>$$(s).find(e=>e.textContent.includes(t));
const img=document.querySelector('img[data-alt*="mechanical figurine"]');if(!img)return;
const holder=img.closest('.absolute.inset-0'),root=holder.parentElement;img.style.visibility='hidden';
const cv=document.createElement('canvas');cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:5;cursor:grab;touch-action:none';root.appendChild(cv);const g=cv.getContext('2d');
const DEF={layer:0,infill:15,walls:2,nozzle:210,bed:60,speed:40,fan:100,retract:0.8,rspeed:35,supports:true};
const MAT={'PLA':{nozzle:210,bed:60,speed:40,fan:100,retract:0.8,rspeed:35},'PLA+':{nozzle:215,bed:60,speed:40,fan:100,retract:0.8,rspeed:35},'Silk PLA':{nozzle:215,bed:60,speed:30,fan:100,retract:0.8,rspeed:30},'PETG':{nozzle:240,bed:80,speed:35,fan:50,retract:1.2,rspeed:30},'ABS':{nozzle:250,bed:100,speed:40,fan:0,retract:0.8,rspeed:35},'TPU (flexible)':{nozzle:225,bed:50,speed:20,fan:60,retract:0.5,rspeed:20},'Nylon-CF':{nozzle:275,bed:90,speed:35,fan:20,retract:1.0,rspeed:30}};
function loadST(){try{return{...DEF,...JSON.parse(localStorage.getItem('pr_settings')||'{}')}}catch(e){return{...DEF}}}
function loadCL(){const d={hex:'#b79cff',fin:'Matte',name:'Lavender'};try{return{...d,...JSON.parse(localStorage.getItem('pr_color')||'{}')}}catch(e){return d}}
let CL=loadCL(),ST=loadST(),EST={},drag=null,M=null,yaw=-.6,pitch=.55,zoom=1,mode='Solid',auto=true,clip=1,S=1,W=0,H=0;
function fit(){const d=devicePixelRatio||1,r=cv.getBoundingClientRect();W=cv.width=r.width*d;H=cv.height=r.height*d;draw()}
addEventListener('resize',fit);
/* ---------- parsing ---------- */
function stl(buf){const len=buf.byteLength,dv=new DataView(buf),head=new TextDecoder().decode(new Uint8Array(buf,0,Math.min(len,2000))),n=len>=84?dv.getUint32(80,true):0,fits=len>=84&&n>0&&84+50*n<=len,asc=/^\s*solid/i.test(head)&&/facet\s+normal/i.test(head)&&(!fits||84+50*n!==len);
 if(fits&&!asc){const p=new Float32Array(n*9);for(let i=0;i<n;i++)for(let k=0;k<9;k++)p[i*9+k]=dv.getFloat32(96+i*50+k*4,true);return p}
 const t=new TextDecoder().decode(buf),a=[],re=/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;let m;while(m=re.exec(t))a.push(+m[1],+m[2],+m[3]);return new Float32Array(a.length-a.length%9?a.slice(0,a.length-a.length%9):a)}
function obj(t){const v=[],o=[];for(const l of t.split('\n')){const s=l.trim().split(/\s+/);if(s[0]==='v')v.push([+s[1],+s[2],+s[3]]);else if(s[0]==='f'){const ix=s.slice(1).map(x=>{let i=parseInt(x);return i<0?v.length+i:i-1});for(let i=1;i<ix.length-1;i++)for(const j of[ix[0],ix[i],ix[i+1]])o.push(...v[j])}}return new Float32Array(o)}
async function parse3mf(buf){const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
 if(e<0)throw new Error('this does not look like a 3MF (zip) file');const cnt=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files=[];
 for(let k=0;k<cnt;k++){if(dv.getUint32(p,true)!==0x02014b50)break;const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true),name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));files.push({name,meth,csz,lo});p+=46+nl+el+cl}
 const models=files.filter(f=>/\.model$/i.test(f.name));if(!models.length)throw new Error('no 3D model was found inside this 3MF');
 const norm=n=>n.replace(/^\/+/,''),docs={};
 for(const f of models){const nl=dv.getUint16(f.lo+26,true),el=dv.getUint16(f.lo+28,true),st=f.lo+30+nl+el,raw=u.subarray(st,st+f.csz);let xml;
  if(f.meth===0)xml=new TextDecoder().decode(raw);else if(f.meth===8){if(typeof DecompressionStream==='undefined')throw new Error('this browser cannot unzip 3MF files - export STL instead');xml=await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()}else continue;
  docs[norm(f.name)]=new DOMParser().parseFromString(xml,'application/xml')}
 const names=Object.keys(docs);if(!names.length)throw new Error('could not read the model inside this 3MF');
 const rootName=names.find(n=>/^3d\/3dmodel\.model$/i.test(n))||names[0],root=docs[rootName].querySelector('model'),K={micron:.001,millimeter:1,centimeter:10,meter:1000,inch:25.4,foot:304.8}[(root&&root.getAttribute('unit'))||'millimeter']||1;
 const ID=[1,0,0,0,1,0,0,0,1,0,0,0],tf=a=>{const v=(a||'').trim().split(/\s+/).map(Number);return v.length===12&&v.every(isFinite)?v:ID};
 const m4=a=>[[a[0],a[1],a[2],0],[a[3],a[4],a[5],0],[a[6],a[7],a[8],0],[a[9],a[10],a[11],1]];
 const mul=(A,B)=>{const a=m4(A),b=m4(B),r=[];for(let i=0;i<4;i++)for(let j=0;j<4;j++){if(j===3&&i<3)continue;r.push(a[i][0]*b[0][j]+a[i][1]*b[1][j]+a[i][2]*b[2][j]+a[i][3]*b[3][j])}return [r[0],r[1],r[2],r[3],r[4],r[5],r[6],r[7],r[8],r[9],r[10],r[11]]};
 const attr=(el,n)=>el.getAttribute('p:'+n)||el.getAttribute(n)||([...el.attributes].find(x=>x.localName===n)||{}).value||'';
 const tri=[];let objects=0;
 function emit(file,id,M,depth){if(depth>8)return;const doc=docs[file];if(!doc)return;const o=doc.querySelector('resources > object[id="'+id+'"]')||doc.querySelector('object[id="'+id+'"]');if(!o)return;
  const mesh=o.querySelector('mesh');
  if(mesh){objects++;const V=[...mesh.querySelectorAll('vertices > vertex')].map(v=>{const x=+v.getAttribute('x'),y=+v.getAttribute('y'),z=+v.getAttribute('z');return[(x*M[0]+y*M[3]+z*M[6]+M[9])*K,(x*M[1]+y*M[4]+z*M[7]+M[10])*K,(x*M[2]+y*M[5]+z*M[8]+M[11])*K]});
   mesh.querySelectorAll('triangles > triangle').forEach(t=>{for(const a of['v1','v2','v3']){const v=V[+t.getAttribute(a)];if(v)tri.push(v[0],v[1],v[2])}})}
  o.querySelectorAll('components > component').forEach(c=>{const pth=attr(c,'path');emit(pth?norm(pth):file,c.getAttribute('objectid'),mul(tf(c.getAttribute('transform')),M),depth+1)})}
 const items=[...docs[rootName].querySelectorAll('build > item')];
 if(items.length)items.forEach(it=>emit(rootName,it.getAttribute('objectid'),tf(it.getAttribute('transform')),0));
 else names.forEach(n=>docs[n].querySelectorAll('resources > object').forEach(o=>emit(n,o.getAttribute('id'),ID,0)));
 const out=new Float32Array(tri.length-tri.length%9?tri.slice(0,tri.length-tri.length%9):tri);if(items.length>1||objects>1)out.info=objects+' objects kept at their plate positions';return out}
async function parseAny(b,name){const x=(name.split('.').pop()||'').toLowerCase();if(x==='stl')return stl(b);if(x==='obj')return obj(new TextDecoder().decode(b));if(x==='3mf')return await parse3mf(b);
 const e=new Error('unsupported');e.kind=/^(step|stp|iges|igs|f3d|sldprt|ipt|3dm|dwg|dxf)$/.test(x)?'cad':'type';e.ext=x;throw e}
const MAXB=250*1048576;
function showErr(m){toast(m,9000);let el=document.querySelector('.up-err');if(!el){const row=document.querySelector('.up-row');if(row){el=document.createElement('div');el.className='up-err';row.after(el)}}if(el)el.textContent=m}
function clearErr(){const el=document.querySelector('.up-err');if(el)el.remove()}
async function ingest(b,name,size,id,stored){try{if(size>MAXB)throw Object.assign(new Error('big'),{kind:'big'});const p=await parseAny(b,name);if(!p||!p.length)throw Object.assign(new Error('empty'),{kind:'empty'});
  for(let i=0;i<Math.min(p.length,600);i++)if(!isFinite(p[i]))throw Object.assign(new Error('bad numbers'),{kind:'empty'});
  S=1;if(sc){sc.value=100;const i=document.getElementById('scale-indicator');if(i)i.textContent='100.0% Uniform'}setMesh(p,name,size);id=id||Date.now();save(id);countUpload();if(!stored)idbPut(id,b,name);clearErr();toast('Loaded '+name+(p.info?' ('+p.info+')':'')+' ✨',p.info?6000:undefined);if(M.dim.some(v=>v>256))setTimeout(()=>toast('Heads up: this model is '+M.dim.map(v=>v.toFixed(0)).join(' × ')+' mm - bigger than a 256 mm print plate. Use the Fit Bed button to scale it down.',9000),2500)}
 catch(e){const k=e.kind;showErr(k==='cad'?name+' is a CAD file. Please export it as STL first (in your CAD program: File → Export → STL) and upload that.':k==='type'?'Please choose an .STL, .OBJ or .3MF file (this one is .'+(e.ext||'?')+').':k==='big'?'That file is over 250 MB - simplify the model in your CAD tool before exporting.':k==='empty'?'I could not find any 3D triangles in '+name+'. The file may be empty or damaged. Try exporting it again as a binary STL.':'Could not open '+name+': '+(e.message||'unknown problem')+'.')}}
async function ingestFile(f){const b=await f.arrayBuffer();return ingest(b,f.name,f.size)}
function loadDemo(){S=1;if(sc){sc.value=100;const i=document.getElementById('scale-indicator');if(i)i.textContent='100.0% Uniform'}setMesh(build(),'demo_model.stl (built-in)',0);clearErr();toast('Demo model loaded. Use Upload my model to try your own.')}
/* ---------- demo kitten ---------- */
function build(){const o=[],TAU=Math.PI*2;const el=(cx,cy,cz,rx,ry,rz,A=22,B=14)=>{const P=(i,j)=>{const a=(i%A)/A*TAU,b=j/B*Math.PI;return[cx+rx*Math.sin(b)*Math.cos(a),cy+ry*Math.sin(b)*Math.sin(a),cz+rz*Math.cos(b)]};
 for(let i=0;i<A;i++)for(let j=0;j<B;j++){const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1);if(j>0)o.push(...a,...c,...b);if(j<B-1)o.push(...a,...d,...c)}};
 el(0,0,28,22,20,28);el(0,3,68,27,24,22);el(-11,15,5,8,10,6,12,8);el(11,15,5,8,10,6,12,8);el(0,-24,16,5,12,6,12,8);el(0,-34,26,5,8,6,12,8);
 for(const s of[-1,1]){const ap=[s*20,2,98],ct=[s*12,2,82],ring=k=>{const a=(k%10)/10*TAU;return[s*12+9*Math.cos(a),2+7*Math.sin(a),82]};for(let i=0;i<10;i++){o.push(...ap,...ring(i),...ring(i+1));o.push(...ct,...ring(i+1),...ring(i))}}
 return new Float32Array(o)}
/* ---------- model stats ---------- */
function setMesh(p,name,size){const n=p.length/9,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];let vol=0;
 for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[i+k]);mx[k]=Math.max(mx[k],p[i+k])}
 const c=mn.map((v,k)=>(v+mx[k])/2),nm=new Float32Array(n*3);
 for(let t=0;t<n;t++){const b=t*9,a=[p[b],p[b+1],p[b+2]],q=[p[b+3],p[b+4],p[b+5]],r=[p[b+6],p[b+7],p[b+8]];
  const u=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],w=[r[0]-a[0],r[1]-a[1],r[2]-a[2]],x=u[1]*w[2]-u[2]*w[1],y=u[2]*w[0]-u[0]*w[2],z=u[0]*w[1]-u[1]*w[0],l=Math.hypot(x,y,z)||1;
  nm[t*3]=x/l;nm[t*3+1]=y/l;nm[t*3+2]=z/l;vol+=(a[0]*(q[1]*r[2]-q[2]*r[1])-a[1]*(q[0]*r[2]-q[2]*r[0])+a[2]*(q[0]*r[1]-q[1]*r[0]))/6}
 const dim=mx.map((v,k)=>v-mn[k]),rad=Math.hypot(...dim)/2||1,step=Math.max(1,Math.ceil(n/40000)),use=[];for(let t=0;t<n;t+=step)use.push(t);
 M={p,n,nm,mn,mx,c,dim,rad,vol:Math.abs(vol)/1000,sv:vol,name,size,use};zoom=1;auto=true;clip=1;info();draw();audit()}
function info(){if(!M)return;const k=S,d=M.dim.map(v=>v*k),vol=M.vol*k**3,mm=M.dim.reduce((a,b)=>Math.max(a,b))*k;
 const fn=byTxt('span','cyber_kitty_v2.3.stl')||has('span','.stl')||has('span','.obj');if(fn){fn.textContent=M.name;fn.nextElementSibling.textContent=(M.size?(M.size/1048576).toFixed(2)+' MB':'Built-in demo')+' • '+(M.n)+' triangles'}
 $$('p.font-code-md').slice(0,3).forEach((e,i)=>e.firstChild.nodeValue=d[i].toFixed(1)+' ');
 const sv=has('strong','cm³'),sp=has('strong','△');if(sv)sv.textContent=vol.toFixed(1)+' cm³';if(sp)sp.textContent=M.n.toLocaleString()+' △';
 const lay=ST.layer?[ST.layer,'(your setting)']:mm<50?[.12,'Ultra Detail']:mm<130?[.16,'High Detail']:[.2,'Standard'],fv=vol*(.18+.8*ST.infill/100),gr=fv*1.24,len=fv/.02405/100,hrs=fv*1000/(11*lay[0]/.2)/3600+.15;
 const set=(l,v)=>{const e=byTxt('span',l);if(e&&e.nextElementSibling)e.nextElementSibling.textContent=v};
 EST={lay:lay[0]+'mm '+lay[1],time:Math.floor(hrs)+'h '+String(Math.round(hrs%1*60)).padStart(2,'0')+'m',fil:Math.round(gr)+'g (~'+len.toFixed(1)+' meters)'};
 set('Recommended Layer',EST.lay);set('Estimated Print Time',EST.time+' @ Bambu X1C');set('Filament Usage',EST.fil)}
function save(id){try{const t=document.createElement('canvas');t.width=360;t.height=270;const c=t.getContext('2d');c.fillStyle='#f1e9ff';c.fillRect(0,0,360,270);const sh=cv.height,sw=Math.min(cv.width,sh*4/3);c.drawImage(cv,(cv.width-sw)/2,0,sw,sh,0,0,360,270);
 const L=JSON.parse(localStorage.getItem('pr_models')||'[]');L.unshift({id,name:M.name,fmt:M.name.split('.').pop().toUpperCase(),n:M.n,dim:M.dim.map(v=>+v.toFixed(1)),vol:+M.vol.toFixed(1),est:EST,score:null,thumb:t.toDataURL('image/jpeg',.75),t:Date.now()});L.splice(8).forEach(r=>idbDel(r.id));localStorage.setItem('pr_models',JSON.stringify(L));srv.then(ok=>ok&&fetch('/api/records',{method:'PUT',body:JSON.stringify(L)}))}catch(e){}}
async function bump(fn){let S=null;try{S=JSON.parse(localStorage.getItem('pr_stats')||'null')}catch(e){}
 if(await srv){try{const j=await fetch('/api/stats').then(r=>r.json());if(j&&j.count!=null)S=j}catch(e){}}
 S=S||{count:0,hours:0,grams:0,meters:0,scoreSum:0,scoreN:0,days:{}};fn(S);const t=JSON.stringify(S);try{localStorage.setItem('pr_stats',t)}catch(e){}
 if(await srv)fetch('/api/stats',{method:'PUT',body:t})}
function countUpload(){const hm=/(\d+)h\s*(\d+)m/.exec(EST.time||''),g=/(\d+)\s*g/.exec(EST.fil||''),m=/~([\d.]+)\s*meters/.exec(EST.fil||'');
 bump(S=>{S.count++;S.hours+=hm?+hm[1]+hm[2]/60:0;S.grams+=g?+g[1]:0;S.meters+=m?+m[1]:0;const k=new Date().toISOString().slice(0,10);S.days[k]=(S.days[k]||0)+1})}
function saveScore(sc){try{const L=JSON.parse(localStorage.getItem('pr_models')||'[]');if(L[0]&&L[0].name===M.name){const old=L[0].score;bump(S=>{if(old==null){S.scoreSum+=sc;S.scoreN++}else S.scoreSum+=sc-old});L[0].score=sc;localStorage.setItem('pr_models',JSON.stringify(L));srv.then(ok=>ok&&fetch('/api/records',{method:'PUT',body:JSON.stringify(L)}))}}catch(e){}}
/* ---------- drawing ---------- */
function draw(){if(!M||!W)return;g.globalAlpha=1;g.clearRect(0,0,W,H);const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),k=Math.min(W,H)*.36/M.rad*zoom,ox=W/2,oy=H*.52;
 const T=(x,y,z)=>{x-=M.c[0];y-=M.c[1];z-=M.c[2];const x1=x*cy-y*sy,y1=x*sy+y*cy,y2=y1*cp-z*sp,z2=y1*sp+z*cp;return[ox+x1*k,oy-z2*k,y2]};
 const R=M.rad*1.15,zb=M.mn[2],pl=[[-R,-R],[R,-R],[R,R],[-R,R]].map(q=>T(M.c[0]+q[0],M.c[1]+q[1],zb));
 g.beginPath();pl.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath();g.fillStyle='rgba(124,58,237,.10)';g.fill();g.strokeStyle='rgba(124,58,237,.35)';g.lineWidth=2;g.stroke();
 if(mode==='Toolpath'&&G&&G.key===gkey()+useSup){drawPath(T);return}
 const zc=M.mn[2]+clip*M.dim[2]+1e-3,L=[-.4,-.6,.7],list=[];
 for(const t of M.use){const b=t*9;if(clip<1&&(M.p[b+2]+M.p[b+5]+M.p[b+8])/3>zc)continue;const a=T(M.p[b],M.p[b+1],M.p[b+2]),q=T(M.p[b+3],M.p[b+4],M.p[b+5]),r=T(M.p[b+6],M.p[b+7],M.p[b+8]);
  const nx=M.nm[t*3],ny=M.nm[t*3+1],nz=M.nm[t*3+2],x1=nx*cy-ny*sy,y1=nx*sy+ny*cy,ny2=y1*cp-nz*sp,nz2=y1*sp+nz*cp;
  if(ny2>=0&&mode==='Solid'||ny2>=0&&mode==='Overhang Heatmap')continue;list.push([(a[2]+q[2]+r[2])/3,a,q,r,x1*L[0]+ny2*L[1]+nz2*L[2],nz])}
 if(mode!=='X-Ray'&&mode!=='Wireframe')list.sort((u,v)=>v[0]-u[0]);
 g.lineJoin='round';g.globalAlpha=(mode==='Solid'&&CL.fin==='Translucent')?.78:1;
 for(const f of list){g.beginPath();g.moveTo(f[1][0],f[1][1]);g.lineTo(f[2][0],f[2][1]);g.lineTo(f[3][0],f[3][1]);g.closePath();
  const sh=Math.max(0,Math.abs(f[4])),l=.38+.62*sh;
  if(mode==='Wireframe'){g.strokeStyle='rgba(99,14,212,.55)';g.lineWidth=.7;g.stroke();continue}
  if(mode==='X-Ray'){g.fillStyle='rgba(124,58,237,.10)';g.fill();g.strokeStyle='rgba(124,58,237,.18)';g.lineWidth=.5;g.stroke();continue}
  let c=paint(l,sh);if(mode==='Overhang Heatmap'){const o=-f[5];if(o>.707)c=[255*l,70*l,100*l];else if(o>.35)c=[255*l,170*l,60*l];else c=[120*l,220*l,170*l]}
  g.fillStyle=g.strokeStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;g.lineWidth=.6;g.fill();g.stroke()}}
(function loop(){if(auto&&!drag){yaw+=.006;draw()}requestAnimationFrame(loop)})();
/* ---------- interaction ---------- */
cv.onpointerdown=e=>{drag=[e.clientX,e.clientY];auto=false;cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'};
cv.onpointermove=e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.01;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag[1])*.01));drag=[e.clientX,e.clientY];draw()};
cv.onpointerup=()=>{drag=null;cv.style.cursor='grab'};cv.onwheel=e=>{e.preventDefault();zoom=Math.max(.4,Math.min(4,zoom*(e.deltaY<0?1.1:.9)));draw()};
const act='bg-primary-container text-on-primary shadow-sm',off='text-on-surface-variant';
(function(){const x=has('button','X-Ray');if(x){const c=x.cloneNode(true),w=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);let nd;while(nd=w.nextNode())if(nd.nodeValue.includes('X-Ray'))nd.nodeValue='Toolpath';x.parentElement.appendChild(c)}})();
const modes=['Solid','Wireframe','X-Ray','Overhang Heatmap','Toolpath'].map(t=>[t,has('button',t)]);
modes.forEach(([t,b])=>b&&(b.onclick=()=>{if(t==='Toolpath'&&(!G||G.key!==gkey()+useSup)){toast('Slicing… 🍰');setTimeout(()=>{slice(false)},30)}mode=t;modes.forEach(([u,c])=>{if(!c)return;const on=u===t;act.split(' ').forEach(x=>c.classList.toggle(x,on));c.classList.toggle(off,!on)});draw()}));
[['Top',[0,1.5]],['Front',[0,0]],['Right',[1.57,0]],['Iso',[-.6,.55]]].forEach(([t,v])=>{const b=$$('button').find(e=>e.textContent.trim()===t);if(b)b.onclick=()=>{[yaw,pitch]=v;auto=false;draw()}});
[['Auto Center',()=>{zoom=1;yaw=-.6;pitch=.55;auto=true;toast('Centered on the bed.',1800)}],['Lay Flat',()=>layFlat()]].forEach(([t,f])=>{const b=has('button',t);if(b)b.onclick=()=>{f();draw()}});
const sc=document.getElementById('scale-range');if(sc)sc.addEventListener('input',()=>{S=sc.value/100;info()});
const zr=document.querySelector('input[orient=vertical]');if(zr){const lab=byTxt('span','480')||byTxt('p','480');zr.oninput=()=>{clip=zr.value/zr.max;if(lab)lab.textContent=zr.value;draw()}}
/* ---------- stored model files (IndexedDB) ---------- */
const b64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
const srv=fetch('/api/ping').then(r=>r.ok).catch(()=>false);
function idbPut(id,buf,name){srv.then(ok=>{if(ok)return fetch('/api/files/'+id,{method:'PUT',headers:{'X-Name':encodeURIComponent(name)},body:buf});if(buf.byteLength>1.5e6)return;try{localStorage.setItem('prf_'+id,JSON.stringify({name,d:b64(buf)}))}catch(e){}})}
function idbDel(id){try{localStorage.removeItem('prf_'+id)}catch(e){}srv.then(ok=>ok&&fetch('/api/files/'+id,{method:'DELETE'}))}
async function idbGet(id){if(await srv){try{const r=await fetch('/api/files/'+id);if(r.ok)return{name:decodeURIComponent(r.headers.get('X-Name')||'model.stl'),buf:await r.arrayBuffer()}}catch(e){}}
 try{const o=JSON.parse(localStorage.getItem('prf_'+id));return o&&{name:o.name,buf:Uint8Array.from(atob(o.d),c=>c.charCodeAt(0)).buffer}}catch(e){return null}}
/* ---------- files ---------- */
function toast(m,ms){try{window.PRsound&&PRsound.toast(m)}catch(e){}try{window.PRvoice&&PRvoice.speakToast(m)}catch(e){}const t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9999;background:#fff;color:#4a2a8a;font:600 14px system-ui;padding:12px 18px;border-radius:18px;box-shadow:0 10px 30px rgba(124,58,237,.3);max-width:90vw;text-align:center';document.body.appendChild(t);setTimeout(()=>t.remove(),ms||5000)}
document.querySelectorAll('input[type=file]').forEach(i=>{if(i.id==='pr-quick-input')return;i.accept='.stl,.obj,.3mf,.STL,.OBJ,.3MF';i.onchange=()=>{const f=i.files[0];i.value='';if(f)ingestFile(f)}});
/* ---------- slicer -> G-code + toolpath ---------- */
let G=null,useSup=true;const gkey=()=>M.name+'|'+S+'|'+M.n;
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2};
const inside=(pt,loops)=>{let c=false;for(const l of loops)for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
function offset(l,d,all){const n=l.length;if(n<4)return null;const nr=(a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],m=Math.hypot(x,y)||1;return[y/m,-x/m]},n0=nr(l[0],l[1]),mid=[(l[0][0]+l[1][0])/2+n0[0]*.05,(l[0][1]+l[1][1])/2+n0[1]*.05],sg=inside(mid,all)?1:-1,o=[];
 for(let i=0;i<n;i++){const a=l[(i+n-1)%n],b=l[i],c=l[(i+1)%n],n1=nr(a,b),n2=nr(b,c),f=Math.min(Math.max(1+n1[0]*n2[0]+n1[1]*n2[1],.35),2);o.push([b[0]+sg*d*(n1[0]+n2[0])/f,b[1]+sg*d*(n1[1]+n2[1])/f])}return o}
function slice(dl=true){if(!M)return;const k=S,h0=ST.layer||parseFloat(EST.lay)||.2,H=M.dim[2]*k;let h=Math.max(h0,H/500);const nl=Math.max(1,Math.floor(H/h));h=H/nl;
 const lw=.45,fa=Math.PI*.875*.875,Fo=Math.round(ST.speed*45),Fi=Math.round(ST.speed*54),Ff=Math.round(ST.speed*66),ex=h*lw/fa,cx=(M.mn[0]+M.mx[0])/2,cy=(M.mn[1]+M.mx[1])/2,z0=M.mn[2],P=M.p,n=M.n,out=['; PrintReady AI G-code (experimental, 2 walls) - '+M.name,'; layers '+nl+' x '+h.toFixed(3)+' mm','M140 S'+ST.bed,'M104 S'+ST.nozzle,'M190 S'+ST.bed,'M109 S'+ST.nozzle,'G28','G90','M82','G92 E0','M106 S0','G1 Z0.3 F1200'],lay=[];
 let E=0,tz=new Float32Array(n*2);const V=(t,i)=>[(P[t*9+i*3]-cx)*k+128,(P[t*9+i*3+1]-cy)*k+128,(P[t*9+i*3+2]-z0)*k];
 for(let t=0;t<n;t++){const a=V(t,0)[2],b=V(t,1)[2],c=V(t,2)[2];tz[t*2]=Math.min(a,b,c);tz[t*2+1]=Math.max(a,b,c)}
 const f=(x,d=3)=>x.toFixed(d),mv=(x,y,F)=>'G1 X'+f(x)+' Y'+f(y)+' E'+f(E,4)+' F'+F;
 const SG=[];for(let L=0;L<nl;L++){const z=(L+.5)*h,sg=[];
  for(let t=0;t<n;t++){if(tz[t*2]>z||tz[t*2+1]<z)continue;const v=[V(t,0),V(t,1),V(t,2)],pt=[];
   for(let e=0;e<3;e++){const a=v[e],b=v[(e+1)%3];if((a[2]<z)!==(b[2]<z)){const q=(z-a[2])/(b[2]-a[2]);pt.push([a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q])}}
   if(pt.length===2)sg.push([pt[0],pt[1]])}SG.push(sg)}
 const gc=.8,gx0=128-M.dim[0]*k/2-2,gy0=128-M.dim[1]*k/2-2,nx=Math.ceil((M.dim[0]*k+4)/gc),ny=Math.ceil((M.dim[1]*k+4)/gc),NC=nx*ny;let SUP=null,supCells=0;
 if(useSup){const OC=SG.map(sg=>{const o=new Uint8Array(NC);for(let j=0;j<ny;j++){const y=gy0+(j+.5)*gc,xs=[];for(const[a,b]of sg)if((a[1]<=y)!==(b[1]<=y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));xs.sort((u,v)=>u-v);
    for(let q=0;q+1<xs.length;q+=2){const i0=Math.max(0,Math.ceil((xs[q]-gx0)/gc-.5)),i1=Math.min(nx-1,Math.floor((xs[q+1]-gx0)/gc-.5));for(let i=i0;i<=i1;i++)o[j*nx+i]=1}}return o});
  const near=(o,i)=>{const x=i%nx,y=(i/nx)|0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&X<nx&&Y>=0&&Y<ny&&o[Y*nx+X])return true}return false};
  SUP=new Array(nl);let up=new Uint8Array(NC);const zero=new Uint8Array(NC);
  for(let L=nl-1;L>=0;L--){const o=OC[L],ab=L+1<nl?OC[L+1]:zero,cu=new Uint8Array(NC);
   for(let i=0;i<NC;i++){if(o[i])continue;if(up[i])cu[i]=1;else if(ab[i]&&!near(o,i))cu[i]=1;if(cu[i])supCells++}SUP[L]=cu;up=cu}}
 for(let L=0;L<nl;L++){const sg=SG[L],cur=[];lay.push(cur);
  const draw1=(pts,ty,F)=>{if(ST.retract>0)out.push('G1 E'+f(E-ST.retract,4)+' F'+Math.round(ST.rspeed*60));out.push('G0 X'+f(pts[0][0])+' Y'+f(pts[0][1])+' F6000');if(ST.retract>0)out.push('G1 E'+f(E,4)+' F'+Math.round(ST.rspeed*60));for(let j=1;j<pts.length;j++){E+=Math.hypot(pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1])*ex;out.push(mv(pts[j][0],pts[j][1],F));cur.push([pts[j-1][0],pts[j-1][1],pts[j][0],pts[j][1],ty])}};
  if(L===2)out.push('M106 S'+Math.round(ST.fan*2.55));out.push('G1 Z'+f((L+1)*h)+' F1200');
  const key=p=>Math.round(p[0]*400)+','+Math.round(p[1]*400),mp=new Map(),used=new Uint8Array(sg.length),loops=[],opens=[];
  sg.forEach((s,i)=>s.forEach(p=>{const q=key(p);(mp.get(q)||mp.set(q,[]).get(q)).push(i)}));
  for(let i=0;i<sg.length;i++){if(used[i])continue;used[i]=1;const path=[sg[i][0],sg[i][1]];let c0=sg[i][1];
   for(;;){const c=(mp.get(key(c0))||[]).find(j=>!used[j]);if(c===undefined)break;used[c]=1;const s=sg[c],nx=key(s[0])===key(c0)?s[1]:s[0];path.push(nx);c0=nx}
   if(path.length>3&&key(path[0])===key(path[path.length-1]))loops.push(path.slice(0,-1));else opens.push(path)}
  loops.forEach(l=>{draw1([...l,l[0]],0,Fo);if(Math.abs(area(l))>6){for(let w=1;w<ST.walls;w++){const o=offset(l,lw*w,loops);if(!o||!inside(o[0],loops))break;draw1([...o,o[0]],0,Fi)}}});
  opens.forEach(p=>draw1(p,0,Fo));
  const dens=(L<3||L>=nl-3)?1:ST.infill/100,sp=lw/dens,sw=L%2,reg=[];
  loops.forEach(l=>{const o=offset(l,lw*(ST.walls-.5),loops);if(o&&inside(o[0],loops))reg.push(o)});
  const seg=[];reg.forEach(l=>l.forEach((p,i)=>{const q=l[(i+1)%l.length];seg.push(sw?[[p[1],p[0]],[q[1],q[0]]]:[p,q])}));
  if(seg.length&&dens>0){let lo=1e9,hi=-1e9;seg.forEach(s=>s.forEach(p=>{lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1])}));let dir=1;
   for(let y=lo+sp/2;y<hi;y+=sp){const xs=[];seg.forEach(s=>{const[a,b]=s;if((a[1]<=y)!==(b[1]<=y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))});xs.sort((u,v)=>u-v);
    const pr=[];for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>.8)pr.push([xs[i],xs[i+1]]);if(dir<0)pr.reverse();
    pr.forEach(([x1,x2])=>{const A=dir>0?x1:x2,B=dir>0?x2:x1;draw1([sw?[y,A]:[A,y],sw?[y,B]:[B,y]],1,Ff)});dir=-dir}}
  if(SUP){const cu=SUP[L];let dr=1;for(let j=0;j<ny;j+=3){const y=gy0+(j+.5)*gc,runs=[];let i=0;
    while(i<nx){if(cu[j*nx+i]){let i0=i;while(i<nx&&cu[j*nx+i])i++;if(i-i0>=2)runs.push([gx0+i0*gc+.15,gx0+i*gc-.15])}else i++}
    if(dr<0)runs.reverse();runs.forEach(([x1,x2])=>{draw1(dr>0?[[x1,y],[x2,y]]:[[x2,y],[x1,y]],2,Ff)});dr=-dr}}}
 out.push('G1 Z'+f(H+10)+' F1200','M107','M104 S0','M140 S0','M84','; end - filament used approx '+f(E*fa/1000*1.24,1)+' g');
 G={key:gkey()+useSup,lay,h,nl,cx,cy,z0,k};
 if(dl){const blob=new Blob([out.join('\n')],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=M.name.replace(/\.[^.]+$/,'')+'.gcode';document.body.appendChild(a);a.click();a.remove();
  toast('G-code ready: '+nl+' layers, '+out.length.toLocaleString()+' lines (2 walls'+(supCells?', supports '+supCells+' cells':', no supports needed')+'). Experimental - preview it in the Toolpath view or a G-code viewer first! 🖨️')}
 window.__gcode=out;draw()}
function drawPath(T){const n=Math.max(1,Math.round(clip*G.nl));g.lineCap='round';
 [[0,'rgba(124,58,237,.95)'],[1,'rgba(255,110,170,.7)'],[2,'rgba(16,185,129,.85)']].forEach(([ty,col])=>{g.beginPath();for(let L=0;L<n;L++){const zz=(L+1)*G.h/G.k+G.z0;for(const s of G.lay[L]){if(s[4]!==ty)continue;const a=T((s[0]-128)/G.k+G.cx,(s[1]-128)/G.k+G.cy,zz),b=T((s[2]-128)/G.k+G.cx,(s[3]-128)/G.k+G.cy,zz);g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1])}}g.strokeStyle=col;g.lineWidth=Math.max(1,Math.min(W,H)*.0035);g.stroke()})}
const jb=has('a','Jump to Slicer');if(jb){const w=document.createTreeWalker(jb,NodeFilter.SHOW_TEXT);let nd;while(nd=w.nextNode())if(nd.nodeValue.includes('Jump to Slicer'))nd.nodeValue='Export G-code (basic)';jb.onclick=e=>{e.preventDefault();slice()}}
/* ---------- print report ---------- */
function analyze(){let oh=0,bad=0,tot=0;const q=v=>Math.round(v*1e3),E=new Map();
 for(let t=0;t<M.n;t++){if(M.nm[t*3+2]<-.707&&M.p[t*9+2]>M.mn[2]+.5)oh++;if(M.n<150000){const V=[0,1,2].map(i=>q(M.p[t*9+i*3])+','+q(M.p[t*9+i*3+1])+','+q(M.p[t*9+i*3+2]));for(let i=0;i<3;i++){const a=V[i],b=V[(i+1)%3],kk=a<b?a+'|'+b:b+'|'+a;E.set(kk,(E.get(kk)||0)+1)}}}
 E.forEach(c=>{tot++;if(c!==2)bad++});const ohp=oh/M.n*100,man=tot?100-bad/tot*100:100;return{bad,ohp,man,score:Math.max(0,Math.round(100-ohp*.6-(100-man)*.8))}}
function report(){if(!M)return;const A=analyze(),esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),keep=[mode,auto];auto=false;
 mode='Solid';draw();const i1=cv.toDataURL('image/png');mode='Overhang Heatmap';draw();const i2=cv.toDataURL('image/png');mode=keep[0];auto=keep[1];draw();
 const d=M.dim.map(v=>(v*S).toFixed(1)),vol=(M.vol*S**3).toFixed(1),tips=[];
 if(A.ohp>10)tips.push('About '+A.ohp.toFixed(0)+'% of the surface overhangs more than 45°. Turn on tree supports or reorient the model.');else tips.push('Overhangs are low ('+A.ohp.toFixed(1)+'%). Supports are probably not needed.');
 if(A.bad>0)tips.push(A.bad+' open or non-manifold edges found. Repair the mesh (for example in Meshmixer or 3D Builder) before slicing.');else tips.push('The mesh is watertight - no open edges found.');
 tips.push('Recommended layer height: '+(EST.lay||'0.2mm')+'. Estimated print time '+(EST.time||'-')+' using '+(EST.fil||'-')+'.');
 const verdict=A.score>=90?['Ready to print','#0a8f5a']:A.score>=70?['Printable with care','#c27a00']:['Needs fixing first','#c0392b'];
 const w=window.open('','_blank');if(!w){toast('Please allow pop-ups to open the report');return}
 w.document.write(`<!doctype html><meta charset="utf-8"><title>PrintReady report - ${esc(M.name)}</title><style>
 body{font:15px/1.5 system-ui,sans-serif;color:#2a1659;margin:0;padding:32px;background:#fff}h1{margin:0;font-size:28px;color:#7c3aed}.sub{color:#7a6a99;margin-bottom:20px}
 .imgs{display:flex;gap:16px}.imgs figure{flex:1;margin:0;text-align:center;font-size:12px;color:#7a6a99}.imgs img{width:100%;border-radius:16px;background:#f1e9ff}
 table{width:100%;border-collapse:collapse;margin:20px 0}td{padding:9px 12px;border-bottom:1px solid #eadfff}td:first-child{color:#7a6a99;width:42%}
 .badge{display:inline-block;padding:6px 16px;border-radius:999px;color:#fff;font-weight:700;background:${verdict[1]}}li{margin:6px 0}.foot{margin-top:24px;font-size:12px;color:#9a8cb8}
 @media print{body{padding:12px}}</style>
 <h1>PrintReady AI Report</h1><div class="sub">${esc(M.name)} • ${new Date().toLocaleDateString()}</div>
 <p><span class="badge">${verdict[0]} • ${A.score}/100</span></p>
 <div class="imgs"><figure><img src="${i1}"><br>Solid view</figure><figure><img src="${i2}"><br>Overhang heatmap (red = needs support)</figure></div>
 <table><tr><td>Dimensions (W × D × H)</td><td>${d.join(' × ')} mm</td></tr><tr><td>Volume</td><td>${vol} cm³</td></tr><tr><td>Triangles</td><td>${M.n.toLocaleString()}</td></tr>
 <tr><td>Scale</td><td>${(S*100).toFixed(0)}%</td></tr><tr><td>Slicer settings</td><td>${ST.infill}% infill · ${ST.walls} wall${ST.walls>1?'s':''} · ${ST.nozzle}°C nozzle / ${ST.bed}°C bed · ${ST.speed} mm/s · fan ${ST.fan}% · ${matchMat(ST)}</td></tr><tr><td>Layer height</td><td>${esc(EST.lay||'-')}</td></tr><tr><td>Estimated print time</td><td>${esc(EST.time||'-')}</td></tr><tr><td>Filament</td><td>${esc(EST.fil||'-')}</td></tr>
 <tr><td>Overhang faces</td><td>${A.ohp.toFixed(1)}%</td></tr><tr><td>Manifold edges</td><td>${A.man.toFixed(1)}% (${A.bad} open)</td></tr></table>
 <h3>Advice</h3><ul>${tips.map(t=>'<li>'+esc(t)+'</li>').join('')}</ul>
 <div class="foot">Estimates only - generated in your browser by PrintReady AI. Always preview the sliced file before printing.</div>
 <script>setTimeout(function(){print()},500)<\/script>`);w.document.close()}
(function(){const a=has('a','Export G-code');if(!a)return;const r=a.cloneNode(true),w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let nd;while(nd=w.nextNode())if(nd.nodeValue.includes('Export G-code'))nd.nodeValue='Print report (PDF)';
 const ic=r.querySelector('.material-symbols-outlined');if(ic)ic.textContent='picture_as_pdf';r.onclick=e=>{e.preventDefault();report()};a.parentElement.appendChild(r)})();
(function(){const a=has('a','Print report');if(!a)return;const r=a.cloneNode(true),w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let nd,tx;while(nd=w.nextNode())if(nd.nodeValue.includes('Print report')){tx=nd;nd.nodeValue='Supports: ON 🌳'}
 const ic=r.querySelector('.material-symbols-outlined');if(ic)ic.textContent='forest';r.onclick=e=>{e.preventDefault();useSup=!useSup;ST.supports=useSup;saveST();tx.nodeValue='Supports: '+(useSup?'ON 🌳':'OFF');if(mode==='Toolpath'&&M)slice(false);toast('Supports '+(useSup?'on - overhangs get support lines':'off'))};a.parentElement.appendChild(r)})();
/* ---------- send to printer ---------- */
async function sendPrinter(){if(!M)return;if(!(await srv))return toast('Sending to a printer needs the local server - run python server.py');
 let list=[];try{list=await fetch('/api/printers').then(r=>r.json())}catch(e){}
 if(!list.length)return toast('Add a printer on the Dashboard first 🖨️');
 let p=list[0];if(list.length>1){const n=prompt('Send to which printer?\n'+list.map((x,i)=>(i+1)+'. '+x.name).join('\n'),'1');p=list[(parseInt(n)||0)-1];if(!p)return}
 slice(false);const name=M.name.replace(/\.[^.]+$/,'')+'.gcode';
 if(!confirm('Upload '+name+' to '+p.name+'?\n\nYou will be asked separately before anything starts printing.'))return;
 toast('Uploading… 📤');try{const r=await fetch('/api/printers/'+p.id+'/print?name='+encodeURIComponent(name)+'&start=0',{method:'POST',body:new Blob([window.__gcode.join('\n')])}),j=await r.json();
  if(!r.ok)return toast('Upload failed: '+(j.error||r.status));
  if(!confirm('Uploaded '+name+' to '+p.name+' ✅\n\nStart printing NOW?\n\nOnly press OK if the bed is clear, filament is loaded and you have checked the toolpath.\nCancel = keep the file on the printer without starting.'))return toast('Uploaded to '+p.name+' ✨ Start it from your printer when ready.');
  const r2=await fetch('/api/printers/'+p.id+'/start?name='+encodeURIComponent(name),{method:'POST'}),j2=await r2.json();toast(r2.ok?'Print started on '+p.name+' 🚀':'Not started: '+(j2.error||r2.status))}catch(e){toast('Upload failed: '+e.message)}}
(function(){const a=has('a','Export G-code');if(!a)return;const r=a.cloneNode(true),w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT);let nd;while(nd=w.nextNode())if(nd.nodeValue.includes('Export G-code'))nd.nodeValue='Send to printer 🖨️';
 const ic=r.querySelector('.material-symbols-outlined');if(ic)ic.textContent='send';r.onclick=e=>{e.preventDefault();sendPrinter()};a.parentElement.appendChild(r)})();
/* ---------- filament colours + AR ---------- */
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
function paint(l,sh){const b=hex2(CL.hex);let k=l,add=0;
 switch(CL.fin){case 'Silk':k=Math.pow(l,.8);add=Math.pow(sh,10)*150;break;case 'Metallic':k=l*.8;add=Math.pow(sh,5)*170;break;case 'Glow':k=.62+.38*l;add=45;break;case 'Translucent':k=.55+.45*l;break}
 return b.map(v=>Math.min(255,v*k+add))}
const PAL=[['Pastel pink','#ff9ec7'],['Lavender','#b79cff'],['Mint','#7de0b0'],['Sky blue','#7bc8ff'],['Butter yellow','#ffe27a'],['Peach','#ffb38a'],['White','#f4f4f6'],['Black','#2b2b33'],['Red','#e5383b'],['Orange','#ff8c42'],['Green','#3fa34d'],['Blue','#2f6fe4'],['Silk gold','#d4af37','Silk'],['Silver metal','#b8bcc6','Metallic'],['Glow green','#9dff9d','Glow'],['Clear blue','#8fd3ff','Translucent']],FIN=['Matte','Silk','Metallic','Translucent','Glow'];
const saveCL=()=>{try{localStorage.setItem('pr_color',JSON.stringify(CL))}catch(e){}};
const sizeText=()=>M.dim.map(v=>(v*S).toFixed(1)).join(' × ')+' mm';
function buildGLB(){const n=M.n,k=S/1000,pos=new Float32Array(n*9),nor=new Float32Array(n*9),cx=(M.mn[0]+M.mx[0])/2,cy=(M.mn[1]+M.mx[1])/2,z0=M.mn[2],mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
 for(let t=0;t<n;t++){const nx=M.nm[t*3],ny=M.nm[t*3+1],nz=M.nm[t*3+2];for(let v=0;v<3;v++){const b=t*9+v*3,X=(M.p[b]-cx)*k,Y=(M.p[b+1]-cy)*k,Z=(M.p[b+2]-z0)*k;
   pos[b]=X;pos[b+1]=Z;pos[b+2]=-Y;nor[b]=nx;nor[b+1]=nz;nor[b+2]=-ny;
   if(X<mn[0])mn[0]=X;if(X>mx[0])mx[0]=X;if(Z<mn[1])mn[1]=Z;if(Z>mx[1])mx[1]=Z;if(-Y<mn[2])mn[2]=-Y;if(-Y>mx[2])mx[2]=-Y}}
 const c=hex2(CL.hex).map(v=>+Math.pow(v/255,2.2).toFixed(4)),F=CL.fin,pbr={baseColorFactor:[c[0],c[1],c[2],F==='Translucent'?.72:1],metallicFactor:F==='Metallic'?1:F==='Silk'?.55:0,roughnessFactor:F==='Metallic'?.35:F==='Silk'?.3:F==='Translucent'?.2:F==='Glow'?.6:.85},
  mat={name:CL.name+' '+F,pbrMetallicRoughness:pbr,doubleSided:true};if(F==='Translucent')mat.alphaMode='BLEND';if(F==='Glow')mat.emissiveFactor=c.map(v=>+(v*.7).toFixed(4));
 const json={asset:{version:'2.0',generator:'PrintReady AI'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:M.name}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},material:0,mode:4}]}],materials:[mat],
  accessors:[{bufferView:0,componentType:5126,count:n*3,type:'VEC3',min:mn,max:mx},{bufferView:1,componentType:5126,count:n*3,type:'VEC3'}],bufferViews:[{buffer:0,byteOffset:0,byteLength:n*36,target:34962},{buffer:0,byteOffset:n*36,byteLength:n*36,target:34962}],buffers:[{byteLength:n*72}]};
 let js=new TextEncoder().encode(JSON.stringify(json));const pad=(4-js.length%4)%4;if(pad){const t=new Uint8Array(js.length+pad).fill(32);t.set(js);js=t}
 const bin=new Uint8Array(n*72);bin.set(new Uint8Array(pos.buffer),0);bin.set(new Uint8Array(nor.buffer),n*36);
 const h=new DataView(new ArrayBuffer(12+8)),total=12+8+js.length+8+bin.length;h.setUint32(0,0x46546C67,true);h.setUint32(4,2,true);h.setUint32(8,total,true);h.setUint32(12,js.length,true);h.setUint32(16,0x4E4F534A,true);
 const h2=new DataView(new ArrayBuffer(8));h2.setUint32(0,bin.length,true);h2.setUint32(4,0x004E4942,true);return new Blob([h.buffer,js,h2.buffer,bin],{type:'model/gltf-binary'})}
let mvLoad=null;function loadMV(){if(window.customElements&&customElements.get('model-viewer'))return Promise.resolve(true);if(mvLoad)return mvLoad;
 mvLoad=new Promise(res=>{const sc=document.createElement('script');sc.type='module';sc.src='https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';sc.onerror=()=>res(false);document.head.appendChild(sc);setTimeout(()=>res(!!customElements.get('model-viewer')),9000);customElements.whenDefined('model-viewer').then(()=>res(true))});return mvLoad}
async function openAR(){if(!M)return;if(M.n>400000)toast('This model is big - AR may be slow on a phone');const blob=buildGLB(),url=URL.createObjectURL(blob);let info=null;
 if(await srv){try{const r=await fetch('/api/ar',{method:'PUT',headers:{'X-Meta':encodeURIComponent(JSON.stringify({name:M.name,size:sizeText(),color:CL.name+' - '+CL.fin}))},body:blob});if(r.ok)info=await r.json()}catch(e){}}
 const o=document.createElement('div');o.className='pf-modal';const pal=document.querySelector('#fx-pals img');
 o.innerHTML=`<div class="pf-form ar-form"><div class="st-head">${pal?'<img src="'+pal.src+'" alt="">':''}<div><h3>View in AR 🕶️</h3><small>${sizeText()} · ${CL.name} (${CL.fin})</small></div></div><div class="ar-view"><div class="ar-wait">Loading the 3D preview…</div></div>
 <div class="ar-phone"></div><p class="pf-note">Colours on a screen never match real filament exactly - especially silk, metallic and glow types.</p><div class="pf-btns"><button type="button" class="c">Close</button></div></div>`;
 document.body.appendChild(o);const close=()=>{o.remove();URL.revokeObjectURL(url)};o.querySelector('.c').onclick=close;o.onclick=e=>{if(e.target===o)close()};
 const ph=o.querySelector('.ar-phone');
 if(info&&info.running){const base=()=>localStorage.getItem('pr_ar_base')||((info.https?'https':'http')+'://'+info.lanIp+':'+info.port);
  ph.innerHTML=`<b>📱 Open it on your phone</b><div class="ar-qrbox"><canvas class="ar-qr"></canvas><small>Scan with your phone camera</small></div><p>Link (works only on your own network): <input class="ar-link" readonly><button type="button" class="ar-copy">Copy</button></p>
  <p class="pf-note">AR on phones needs a secure <b>https</b> link. Easiest: run <code>cloudflared tunnel --url http://localhost:${info.port}</code> on this computer and paste the https address it prints here:</p><input class="ar-base" placeholder="https://something.trycloudflare.com">`;
  const L=ph.querySelector('.ar-link'),B=ph.querySelector('.ar-base'),show=()=>{L.value=base().replace(/\/+$/,'')+info.path;const okq=window.PRqr&&PRqr.draw(ph.querySelector('.ar-qr'),L.value,190);ph.querySelector('.ar-qrbox').style.display=okq?'':'none'};B.value=localStorage.getItem('pr_ar_base')||'';show();
  B.oninput=()=>{const v=B.value.trim();try{v?localStorage.setItem('pr_ar_base',v):localStorage.removeItem('pr_ar_base')}catch(e){}show()};
  ph.querySelector('.ar-copy').onclick=async()=>{try{await navigator.clipboard.writeText(L.value)}catch(e){L.select();document.execCommand('copy')}toast('Link copied.')}}
 else ph.innerHTML='<b>📱 Phone AR</b><p class="pf-note">To send this model to your phone, start the app with <code>python server.py</code>. The 3D preview above works without it.</p>';
 const ok=await loadMV(),box=o.querySelector('.ar-view');
 if(!ok){box.innerHTML='<div class="ar-wait">The 3D preview needs an internet connection (it uses Google\'s free model-viewer). The phone link above still works once you are online.</div>';return}
 box.innerHTML='';const mv=document.createElement('model-viewer');mv.setAttribute('src',url);mv.setAttribute('ar','');mv.setAttribute('ar-modes','webxr scene-viewer quick-look');mv.setAttribute('ar-scale','fixed');mv.setAttribute('camera-controls','');mv.setAttribute('shadow-intensity','1');mv.setAttribute('exposure','1.1');mv.setAttribute('auto-rotate','');mv.setAttribute('alt','3D model');
 const b=document.createElement('button');b.slot='ar-button';b.className='ar-btn';b.textContent='View in your room (AR)';mv.appendChild(b);box.appendChild(mv)}
function openColours(){const old=document.getElementById('cl-pop');if(old){old.remove();return}const p=document.createElement('div');p.id='cl-pop';
 p.innerHTML=`<b>Filament colour 🎨</b><div class="cl-sw"></div><div class="cl-fin"></div><div class="cl-row"><input type="color" class="cl-c"><span class="cl-name"></span></div><button type="button" class="cl-ar">View in AR 🕶️</button>`;document.body.appendChild(p);
 const sw=p.querySelector('.cl-sw'),fn=p.querySelector('.cl-fin'),nm=p.querySelector('.cl-name'),ci=p.querySelector('.cl-c');
 const upd=()=>{nm.textContent=CL.name+' · '+CL.fin;ci.value=CL.hex;[...sw.children].forEach(b=>b.classList.toggle('on',b.dataset.hex===CL.hex));[...fn.children].forEach(b=>b.classList.toggle('on',b.textContent===CL.fin));saveCL();draw()};
 PAL.forEach(([n,h,f])=>{const b=document.createElement('button');b.type='button';b.title=n+(f?' ('+f+')':'');b.dataset.hex=h;b.style.background=h;b.onclick=()=>{CL.hex=h;CL.name=n;if(f)CL.fin=f;else if(['Silk','Metallic','Glow','Translucent'].includes(CL.fin)&&PAL.some(x=>x[2]===CL.fin&&x[1]===h)===false&&f===undefined&&false)CL.fin='Matte';upd()};sw.appendChild(b)});
 FIN.forEach(f=>{const b=document.createElement('button');b.type='button';b.textContent=f;b.onclick=()=>{CL.fin=f;upd()};fn.appendChild(b)});
 ci.oninput=()=>{CL.hex=ci.value;CL.name='Custom';upd()};p.querySelector('.cl-ar').onclick=()=>{p.remove();openAR()};upd();
 setTimeout(()=>document.addEventListener('pointerdown',function h(e){if(!p.isConnected){document.removeEventListener('pointerdown',h);return}if(!p.contains(e.target)&&!e.target.closest('#fx-tools')){p.remove();document.removeEventListener('pointerdown',h)}}),50)}
(function(){const t=document.getElementById('fx-tools');if(!t)return;const b=document.createElement('button');b.textContent='🎨';b.title='Filament colour & AR';b.setAttribute('aria-label','Filament colour and AR');b.onclick=openColours;t.insertBefore(b,t.firstChild)})();
/* ---------- slicer settings ---------- */
function saveST(){try{localStorage.setItem('pr_settings',JSON.stringify(ST))}catch(e){}srv.then(ok=>ok&&fetch('/api/settings',{method:'PUT',body:JSON.stringify(ST)}))}
function matchMat(v){return Object.keys(MAT).find(k=>MAT[k].nozzle==v.nozzle&&MAT[k].bed==v.bed&&MAT[k].speed==v.speed&&MAT[k].fan==v.fan&&MAT[k].retract==v.retract&&MAT[k].rspeed==v.rspeed)||'Custom'}
function openSettings(){const o=document.createElement('div');o.className='pf-modal';const pal=document.querySelector('#fx-pals img');
 o.innerHTML=`<form class="pf-form st-form"><div class="st-head">${pal?'<img src="'+pal.src+'" alt="">':''}<div><h3>Slicer settings ⚙️</h3><small>Pick how your models get printed</small></div></div>
 <label>Material<select name="material"><option value="Custom">Custom (my own numbers)</option>${Object.keys(MAT).map(k=>`<option value="${k}">${k}</option>`).join('')}</select></label>
 <label>Layer height<select name="layer"><option value="0">Auto - best for the size of the model</option><option value="0.12">0.12 mm - extra fine (slow, smooth)</option><option value="0.16">0.16 mm - fine</option><option value="0.2">0.20 mm - standard</option><option value="0.28">0.28 mm - draft (fast)</option></select></label>
 <label>Infill - how solid the inside is <output class="st-out"></output><input type="range" name="infill" min="0" max="100" step="5"></label>
 <label>Walls - outer shell layers<select name="walls"><option value="1">1 - fast and thin</option><option value="2">2 - normal</option><option value="3">3 - strong</option><option value="4">4 - extra strong</option></select></label>
 <div class="st-two"><label>Nozzle °C<input name="nozzle" type="number" min="150" max="320"></label><label>Bed °C<input name="bed" type="number" min="0" max="130"></label></div>
 <p class="pf-note">Typical: PLA 205-215 / 60 · PETG 235-245 / 75-80 · ABS 245-255 / 100</p>
 <div class="st-two"><label>Speed (mm/s)<input name="speed" type="number" min="10" max="200"></label><label>Cooling fan %<input name="fan" type="number" min="0" max="100"></label></div>
 <div class="st-two"><label>Retraction (mm)<input name="retract" type="number" min="0" max="10" step="0.1"></label><label>Retract speed (mm/s)<input name="rspeed" type="number" min="5" max="100"></label></div>
 <p class="pf-note">Slower speed looks prettier. Fan 0% for ABS, ~50% for PETG, 100% for PLA. Retraction pulls the filament back during travel moves to reduce stringing: ~0.5-1 mm for direct-drive printers, 4-6 mm for Bowden, 0 to turn it off.</p>
 <label class="st-check"><input type="checkbox" name="supports"> Add supports under overhangs</label>
 <div class="pf-btns"><button type="button" class="r">Reset</button><button type="button" class="c">Cancel</button><button type="submit" class="pri">Save ✨</button></div></form>`;
 document.body.appendChild(o);const f=o.querySelector('form'),out=o.querySelector('.st-out'),hint=v=>v==0?'none (hollow)':v<=10?'light':v<=25?'normal':v<=50?'strong':v<100?'very strong':'solid';
 const fill=v=>{f.layer.value=String(v.layer);f.infill.value=v.infill;f.walls.value=String(v.walls);f.nozzle.value=v.nozzle;f.bed.value=v.bed;f.speed.value=v.speed;f.fan.value=v.fan;f.retract.value=v.retract;f.rspeed.value=v.rspeed;f.supports.checked=!!v.supports;f.material.value=matchMat(v);out.textContent=v.infill+'% ('+hint(+v.infill)+')'};
 fill(ST);f.material.onchange=()=>{const m=MAT[f.material.value];if(m){f.nozzle.value=m.nozzle;f.bed.value=m.bed;f.speed.value=m.speed;f.fan.value=m.fan;f.retract.value=m.retract;f.rspeed.value=m.rspeed}};['nozzle','bed','speed','fan','retract','rspeed'].forEach(k=>f[k].oninput=()=>{f.material.value=matchMat({nozzle:+f.nozzle.value,bed:+f.bed.value,speed:+f.speed.value,fan:+f.fan.value,retract:+f.retract.value,rspeed:+f.rspeed.value})});f.infill.oninput=()=>out.textContent=f.infill.value+'% ('+hint(+f.infill.value)+')';
 o.querySelector('.c').onclick=()=>o.remove();o.querySelector('.r').onclick=()=>fill(DEF);o.onclick=e=>{if(e.target===o)o.remove()};
 const cl=(v,a,b,d)=>{v=parseFloat(v);return isNaN(v)?d:Math.min(b,Math.max(a,v))};
 f.onsubmit=e=>{e.preventDefault();ST={layer:cl(f.layer.value,0,0.4,0),infill:cl(f.infill.value,0,100,15),walls:cl(f.walls.value,1,4,2),nozzle:cl(f.nozzle.value,150,320,210),bed:cl(f.bed.value,0,130,60),speed:cl(f.speed.value,10,200,40),fan:cl(f.fan.value,0,100,100),retract:cl(f.retract.value,0,10,0.8),rspeed:cl(f.rspeed.value,5,100,35),supports:f.supports.checked};
  useSup=ST.supports;saveST();G=null;o.remove();if(M){info();if(mode==='Toolpath')slice(false)}toast('Settings saved. The slicer and estimates now use them.')}}
(function(){const t=document.getElementById('fx-tools');if(!t)return;const b=document.createElement('button');b.textContent='⚙️';b.title='Slicer settings';b.setAttribute('aria-label','Slicer settings');b.onclick=openSettings;t.insertBefore(b,t.firstChild)})();
useSup=ST.supports!==false;
srv.then(async ok=>{if(!ok)return;try{const j=await fetch('/api/settings').then(r=>r.json());if(j&&Object.keys(j).length){ST={...DEF,...j};try{localStorage.setItem('pr_settings',JSON.stringify(ST))}catch(e){}useSup=ST.supports!==false;G=null;if(M)info()}}catch(e){}});
/* ---------- analysis ---------- */
const run=has('button','Run Printability Analysis');if(run)run.onclick=()=>{if(!M)return;let oh=0,bad=0,tot=0;const q=v=>Math.round(v*1e3),E=new Map();
 for(let t=0;t<M.n;t++){if(M.nm[t*3+2]<-.707&&M.p[t*9+2]>M.mn[2]+.5)oh++;if(M.n<150000){const V=[0,1,2].map(i=>q(M.p[t*9+i*3])+','+q(M.p[t*9+i*3+1])+','+q(M.p[t*9+i*3+2]));for(let i=0;i<3;i++){const a=V[i],b=V[(i+1)%3],kk=a<b?a+'|'+b:b+'|'+a;E.set(kk,(E.get(kk)||0)+1)}}}
 E.forEach(c=>{tot++;if(c!==2)bad++});const ohp=oh/M.n*100,man=tot?100-bad/tot*100:100,score=Math.max(0,Math.round(100-ohp*.6-(100-man)*.8));
 audit();
 mode='Overhang Heatmap';modes.forEach(([u,c])=>{if(!c)return;const on=u===mode;act.split(' ').forEach(x=>c.classList.toggle(x,on));c.classList.toggle(off,!on)});draw();
 saveScore(score);toast(`Printability score ${score}/100 • overhang faces ${ohp.toFixed(1)}% • manifold ${Math.round(man)}%`)};
setMesh(build(),'demo_model.stl (built-in)',0);fit();
function layFlat(){if(!M)return;const P=M.p,n=M.n,bins=new Map();
 for(let t=0;t<n;t++){const b=t*9,u=[P[b+3]-P[b],P[b+4]-P[b+1],P[b+5]-P[b+2]],v=[P[b+6]-P[b],P[b+7]-P[b+1],P[b+8]-P[b+2]],c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],a=Math.hypot(...c)/2;if(a<1e-9)continue;
  const nx=c[0]/(2*a),ny=c[1]/(2*a),nz=c[2]/(2*a),k=[nx,ny,nz].map(x=>Math.round(x*12)).join(',');const e=bins.get(k)||{a:0,n:[0,0,0]};e.a+=a;e.n[0]+=nx*a;e.n[1]+=ny*a;e.n[2]+=nz*a;bins.set(k,e)}
 let best=null;bins.forEach(e=>{if(!best||e.a>best.a)best=e});if(!best)return toast('No faces found to lay flat');
 const L=Math.hypot(...best.n),nrm=best.n.map(x=>x/L);let tot=0;bins.forEach(e=>tot+=e.a);
 if(best.a/tot<.03)return toast('I could not find a clear flat side on this model, so I left it as it is',4500);
 const d=[0,0,-1],ax=[nrm[1]*d[2]-nrm[2]*d[1],nrm[2]*d[0]-nrm[0]*d[2],nrm[0]*d[1]-nrm[1]*d[0]],s_=Math.hypot(...ax),c_=nrm[0]*d[0]+nrm[1]*d[1]+nrm[2]*d[2];
 let R;if(s_<1e-6)R=c_>0?[[1,0,0],[0,1,0],[0,0,1]]:[[1,0,0],[0,-1,0],[0,0,-1]];else{const k=ax.map(x=>x/s_),K=[[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]];R=[0,1,2].map(i=>[0,1,2].map(j=>(i===j?1:0)+s_*K[i][j]+(1-c_)*(K[i][0]*K[0][j]+K[i][1]*K[1][j]+K[i][2]*K[2][j])))}
 const out=new Float32Array(P.length);let zmin=1e9;for(let i=0;i<P.length;i+=3){const x=P[i],y=P[i+1],z=P[i+2];out[i]=R[0][0]*x+R[0][1]*y+R[0][2]*z;out[i+1]=R[1][0]*x+R[1][1]*y+R[1][2]*z;out[i+2]=R[2][0]*x+R[2][1]*y+R[2][2]*z;if(out[i+2]<zmin)zmin=out[i+2]}
 for(let i=2;i<out.length;i+=3)out[i]-=zmin;setMesh(out,M.name,M.size);toast('Model laid flat on its largest face.',3000)}
/* ---------- live mesh integrity audit ---------- */
function audit(){if(!M)return;setTimeout(()=>{if(!M)return;
 const lab=t=>[...document.querySelectorAll('span')].find(x=>x.textContent.trim()===t&&!x.children.length),row=l=>l&&l.parentElement.parentElement,
  set=(label,txt,ok)=>{const r=row(lab(label));if(!r)return;const v=r.lastElementChild;v.textContent=txt;v.style.color=ok===null?'#8a7fa5':ok?'':'#c0334d';const ic=r.querySelector('.material-symbols-outlined');if(ic){ic.textContent=ok===null?'help':ok?'check_circle':'warning';ic.style.color=ok===null?'#8a7fa5':ok?'':'#c0334d'}};
 let bad=0,man=100;const big=M.n>150000;if(!big){const A=analyze();bad=A.bad;man=A.man}const inv=M.sv<0;
 set('Non-manifold Edges',big?'not checked (big model)':bad+' detected',big?null:bad===0);set('Self-intersecting Faces','not checked',null);set('Surface Normals Alignment',inv?'Inverted - flip needed':'Uniform Outward',!inv);
 const score=Math.max(0,Math.round(100-(100-man)*.8-(inv?25:0))),sb=[...document.querySelectorAll('span')].find(x=>/^\d+ \/ 100$/.test(x.textContent.trim()));if(sb)sb.textContent=score+' / 100';
 const vm=[...document.querySelectorAll('span')].find(x=>/^(Valid Mesh|Needs repair)$/i.test(x.textContent.trim()));if(vm)vm.textContent=(bad===0&&!inv)?'Valid Mesh':'Needs repair';
 const mf=[...document.querySelectorAll('span')].find(x=>/^MANIFOLD/.test(x.textContent.trim()));if(mf)mf.textContent='MANIFOLD '+(big?'?':Math.round(man)+'%')},30)}
function fillHoles(tri){const key=(x,y,z)=>Math.round(x*1e3)+','+Math.round(y*1e3)+','+Math.round(z*1e3),ids=new Map(),pts=[];const id=(x,y,z)=>{const k=key(x,y,z);let i=ids.get(k);if(i===undefined){i=pts.length;ids.set(k,i);pts.push([x,y,z])}return i};
 const T=[];for(let i=0;i<tri.length;i+=9)T.push([id(tri[i],tri[i+1],tri[i+2]),id(tri[i+3],tri[i+4],tri[i+5]),id(tri[i+6],tri[i+7],tri[i+8])]);
 const dir=new Map();T.forEach(t=>{for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],q=a+'>'+b;dir.set(q,(dir.get(q)||0)+1)}});
 const bnd=[];dir.forEach((c,k)=>{const[a,b]=k.split('>').map(Number);if(!dir.has(b+'>'+a))bnd.push([a,b])});if(!bnd.length)return{added:[],loops:0};
 const next=new Map();bnd.forEach(([a,b])=>{(next.get(a)||next.set(a,[]).get(a)).push(b)});const used=new Set(),loops=[];
 for(const[a0,b0]of bnd){if(used.has(a0+'>'+b0))continue;const loop=[a0];let b=b0,ok=true;used.add(a0+'>'+b0);
  while(b!==a0){loop.push(b);const c=(next.get(b)||[]).find(x=>!used.has(b+'>'+x));if(c===undefined||loop.length>3000){ok=false;break}used.add(b+'>'+c);b=c}
  if(ok&&loop.length>=3)loops.push(loop)}
 const added=[];loops.forEach(l=>{const c=[0,1,2].map(i=>l.reduce((s,v)=>s+pts[v][i],0)/l.length);for(let k=0;k<l.length;k++){const a=pts[l[k]],b=pts[l[(k+1)%l.length]];added.push(b[0],b[1],b[2],a[0],a[1],a[2],c[0],c[1],c[2])}});return{added,loops:loops.length}}
function heal(){if(!M)return;const P=M.p,n=M.n,out=[],seen=new Set();let deg=0,dup=0;
 for(let t=0;t<n;t++){const b=t*9,a=[P[b],P[b+1],P[b+2]],q=[P[b+3],P[b+4],P[b+5]],r=[P[b+6],P[b+7],P[b+8]],u=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],v=[r[0]-a[0],r[1]-a[1],r[2]-a[2]],cx=u[1]*v[2]-u[2]*v[1],cy=u[2]*v[0]-u[0]*v[2],cz=u[0]*v[1]-u[1]*v[0];
  if(cx*cx+cy*cy+cz*cz<1e-12){deg++;continue}const key=[a,q,r].map(x=>x.map(y=>Math.round(y*1e4)).join(',')).sort().join('|');if(seen.has(key)){dup++;continue}seen.add(key);for(let i=0;i<9;i++)out.push(P[b+i])}
 const flip=M.sv<0;if(flip)for(let i=0;i<out.length;i+=9)for(let k=0;k<3;k++){const t=out[i+3+k];out[i+3+k]=out[i+6+k];out[i+6+k]=t}
 let holes=0,added=0;if(out.length/9<150000){const H=fillHoles(out);holes=H.loops;added=H.added.length/9;for(const v of H.added)out.push(v)}
 if(!deg&&!dup&&!flip&&!holes){const A=analyze();return toast('Nothing to heal: no broken triangles, normals point outward'+(A.bad?', but '+A.bad+' open edges remain that I cannot fill automatically (very large model or a non-manifold joint) - try Meshmixer or 3D Builder.':' and the mesh is watertight ✨'),7000)}
 setMesh(new Float32Array(out),M.name,M.size);const A=analyze(),bits=[];if(flip)bits.push('flipped inside-out normals');if(holes)bits.push('filled '+holes+' hole'+(holes>1?'s':'')+' ('+added+' triangles)');if(deg||dup)bits.push('removed '+deg+' degenerate and '+dup+' duplicate triangles');
 toast('Auto-heal '+bits.join(', ')+' ✨'+(A.bad?' - '+A.bad+' open edges remain (needs a mesh-repair tool)':' - the mesh is now watertight'),8000)}
/* upload row: demo model kept + clear "Upload my model" */
(function(){const inpO=document.querySelector('input[type=file]:not(#pr-quick-input)'),zone=inpO&&inpO.parentElement;if(!zone)return;const row=document.createElement('div');row.className='up-row';
 row.innerHTML='<button type="button" class="up-main">📂 Upload my model</button><button type="button" class="up-demo">🐱 Use demo model</button><small>or drop a file anywhere on this page · STL, OBJ, 3MF · up to 250 MB</small>';zone.parentElement.insertBefore(row,zone);
 row.querySelector('.up-main').onclick=()=>window.PRui&&PRui.pick();row.querySelector('.up-demo').onclick=()=>loadDemo()})();
/* viewer toolbar + other previously dead controls */
const ico=n=>$$('button').find(b=>{const q=b.querySelector('.material-symbols-outlined');return q&&q.textContent.trim()===n});
const TB={restart_alt:['Reset view',()=>{yaw=-.6;pitch=.55;zoom=1;auto=true;draw()}],open_with:['Center model',()=>{zoom=1;draw()}],rotate_right:['Turn auto-rotate on/off',()=>{auto=!auto;toast(auto?'Auto-rotate on':'Auto-rotate off',1500)}],aspect_ratio:['Fit to view',()=>{zoom=1;yaw=-.6;pitch=.55;auto=false;draw()}],flip_to_front:['Front view',()=>{yaw=0;pitch=0;auto=false;draw()}],flip:['Back view',()=>{yaw=Math.PI;pitch=0;auto=false;draw()}]};
Object.entries(TB).forEach(([i,[t,fn]])=>{const b=ico(i);if(b){b.title=t;b.setAttribute('aria-label',t);b.onclick=fn}});
const fsb=ico('fullscreen');if(fsb){fsb.title='Fullscreen';fsb.onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else{const f=root.requestFullscreen||root.webkitRequestFullscreen;if(!f)return toast('Fullscreen is not available in this browser');const r=f.call(root);if(r&&r.catch)r.catch(()=>toast('Your browser blocked fullscreen - try pressing F11'))}}}
const dg=has('button','Diagnostics'),ah=has('button','Repair Mesh');if(dg)dg.onclick=()=>run&&run.onclick&&run.onclick();if(ah)ah.onclick=heal;
function runHash(){const h=decodeURIComponent(location.hash.slice(1));if(!h)return;let m;
 if(m=/^upload=(\d+)$/.exec(h)){const id=+m[1];history.replaceState(null,'','studio.html');idbGet(id).then(r=>{if(!r)return showErr('I could not find that file any more - please upload it again.');ingest(r.buf,r.name,r.buf.byteLength,id,true)})}
 else if(m=/^model=(\d+)$/.exec(h)){idbGet(+m[1]).then(async r=>{if(!r)return toast('That model was not kept (files over 1.5 MB need the local server: run python server.py) or it was cleared - please upload it again',8000);try{setMesh(await parseAny(r.buf,r.name),r.name,r.buf.byteLength);toast('Reopened '+r.name+' ✨')}catch(e){showErr('Could not reopen '+r.name)}})}
 else if(h==='analysis')setTimeout(()=>run&&run.onclick&&run.onclick(),500);
 else if(h==='simulator'){const b=has('button','Toolpath');setTimeout(()=>b&&b.click(),500)}
 else if(h==='assistant')setTimeout(()=>window.PRtour&&PRtour.start(),700);
 else if(h==='slicer')setTimeout(openSettings,400);
 else if(h==='colours')setTimeout(openColours,400);
 else if(m=/^material=(.+)$/.exec(h)){const k=m[1];if(MAT[k]){ST={...ST,...MAT[k]};saveST();G=null;if(M)info();setTimeout(()=>{toast('Material preset applied: '+k+' ✨ (temperatures, speed, fan, retraction)',5000);openSettings()},500)}else toast('Unknown material preset',3000)}
 else if(h==='demo')loadDemo()}
addEventListener('hashchange',runHash);
['50%','75%','150%','Fit Bed'].forEach(t=>{const b=$$('button').find(x=>x.textContent.trim()===t);if(!b||!sc)return;b.addEventListener('click',()=>{if(t==='Fit Bed'&&M)sc.value=Math.max(20,Math.min(250,Math.floor(Math.min(250/M.dim[0],250/M.dim[1],250/M.dim[2])*100)));
 setTimeout(()=>{sc.dispatchEvent(new Event('input'));if(t==='Fit Bed')toast('Scaled to fill the 256 mm print plate ('+sc.value+'%) ✨',3500)},0)})});
window.PRstudio={ingestFile,loadDemo,heal,openSettings,openColours};
setTimeout(runHash,200);
})();

