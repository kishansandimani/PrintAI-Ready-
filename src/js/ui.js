
/* PrintReady AI - shared UI wiring: uploads, drag & drop, notifications, nav links and every "dead" button */
(function(){
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const T=e=>(e.textContent||'').replace(/\s+/g,' ').trim();
const byText=(sel,t,exact)=>$$(sel).find(e=>!e.closest('#fx-tools,#fx-pals,#fx-tour,#cl-pop,.pf-modal')&&(exact?T(e)===t:T(e).includes(t)));
const byIcon=i=>$$('button,a').find(e=>{const s=e.querySelector('.material-symbols-outlined');return s&&s.textContent.trim()===i});
const page=/studio/.test(location.pathname)?'studio':/dashboard/.test(location.pathname)?'dashboard':'index';
const bind=(el,fn)=>{if(!el||el.dataset.wired)return;el.dataset.wired='1';el.addEventListener('click',e=>{e.preventDefault();fn(e)})};
const rnd=(a,b)=>a+Math.random()*(b-a);
/* ---------- toast ---------- */
function toast(m,ms){try{window.PRsound&&PRsound.toast(m)}catch(e){}try{window.PRvoice&&PRvoice.speakToast(m)}catch(e){}const t=document.createElement('div');t.className='ui-toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>{t.style.opacity=0},(ms||4200)-500);setTimeout(()=>t.remove(),ms||4200)}
const soon=m=>toast((m||'This part is not built yet')+' 🐾 - it is on the to-do list!');
/* ---------- picking + handing over files ---------- */
const OK=/\.(stl|obj|3mf)$/i;
const b64=buf=>{let s='';const u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
async function handoff(file){
 if(!OK.test(file.name)){return toast(/\.(step|stp|f3d|iges|igs|sldprt)$/i.test(file.name)?'CAD files like '+file.name.split('.').pop().toUpperCase()+' must be exported as STL first (File → Export → STL in your CAD program).':'Please choose an .STL, .OBJ or .3MF file',6500)}
 if(file.size>250*1048576)return toast('That file is over 250 MB',6000);
 toast('Opening '+file.name+' in the Studio… 📦');const buf=await file.arrayBuffer(),id=Date.now();let stored=false;
 try{const r=await fetch('/api/ping');if(r.ok){const p=await fetch('/api/files/'+id,{method:'PUT',headers:{'X-Name':encodeURIComponent(file.name)},body:buf});stored=p.ok}}catch(e){}
 if(!stored&&buf.byteLength<=1.5e6){try{localStorage.setItem('prf_'+id,JSON.stringify({name:file.name,d:b64(buf)}));stored=true}catch(e){}}
 if(stored)location.href='studio.html#upload='+id;
 else{toast('This file is big, so choose it again inside the Studio (large files can only be passed along when python server.py is running).',7000);setTimeout(()=>location.href='studio.html',2500)}}
function onFile(file){if(!file)return;if(window.PRstudio)PRstudio.ingestFile(file);else handoff(file)}
const inp=document.createElement('input');inp.type='file';inp.id='pr-quick-input';inp.accept='.stl,.obj,.3mf,.STL,.OBJ,.3MF';inp.hidden=true;document.body.appendChild(inp);
inp.onchange=()=>{const f=inp.files[0];inp.value='';onFile(f)};
const pick=()=>inp.click();
window.PRui={toast,soon,pick,onFile,handoff};
/* ---------- drag & drop anywhere ---------- */
const ov=document.createElement('div');ov.className='ui-drop';ov.innerHTML='<div><span>📦</span><b>Drop your model here</b><small>STL · OBJ · 3MF</small></div>';document.body.appendChild(ov);
let dc=0;const hasFiles=e=>e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files');
addEventListener('dragenter',e=>{if(hasFiles(e)){dc++;ov.classList.add('on')}});
addEventListener('dragleave',e=>{if(hasFiles(e)){dc=Math.max(0,dc-1);if(!dc)ov.classList.remove('on')}});
addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dc=0;ov.classList.remove('on');const f=e.dataTransfer.files[0];if(f)onFile(f)});
/* ---------- header: Quick Upload + notifications ---------- */
bind(byText('button','Quick Upload'),pick);
const bell=byIcon('notifications');
bind(bell,async()=>{const old=$('.ui-pop');if(old){old.remove();return}
 let items=[];try{const r=await fetch('/api/history');if(r.ok)items=(await r.json()).slice(-5).reverse().map(e=>[e.ok?({uploaded:'⬆️',start:'▶️',cancel:'⏹️',pause:'⏸️',resume:'⏯️'}[e.action]||'•'):'😿',(e.ok?'':'Could not ')+e.action+' '+(e.file||'')+' · '+e.printer,e.t])}catch(x){}
 if(!items.length){try{items=JSON.parse(localStorage.getItem('pr_models')||'[]').slice(0,5).map(r=>['📦','Uploaded '+r.name,r.t])}catch(x){}}
 const p=document.createElement('div');p.className='ui-pop';const r=bell.getBoundingClientRect();p.style.top=(r.bottom+8)+'px';p.style.right=Math.max(8,innerWidth-r.right)+'px';
 p.innerHTML='<b>Notifications 🔔</b>'+(items.length?'':'<p>You are all caught up! 🐾<br><small>Uploads and printer actions will show up here.</small></p>');
 const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
 items.forEach(([i,t,ts])=>{const d=document.createElement('div');d.className='ui-n';const a=document.createElement('span');a.textContent=i;const b=document.createElement('span');b.textContent=t;const c=document.createElement('small');c.textContent=ago(ts);d.append(a,b,c);p.appendChild(d)});
 document.body.appendChild(p);$$('span',bell).filter(s=>!s.classList.contains('material-symbols-outlined')).forEach(s=>s.style.display='none');
 setTimeout(()=>document.addEventListener('pointerdown',function h(e){if(!p.isConnected){document.removeEventListener('pointerdown',h);return}if(!p.contains(e.target)&&!bell.contains(e.target)){p.remove();document.removeEventListener('pointerdown',h)}}),30)});
/* ---------- sidebar (dashboard + studio) ---------- */
const go=(label,href)=>{const a=byText('a',label);if(a)a.setAttribute('href',href)};
go('AI Analysis','studio.html#analysis');go('Virtual 3D Simulator','studio.html#simulator');go('AI Print Assistant','studio.html#assistant');go('Project History','dashboard.html#history');go('Model Upload','studio.html');
$$('a').forEach(a=>{if(a.getAttribute('href')==='studio.html#analysis'||a.getAttribute('href')==='studio.html#simulator'||a.getAttribute('href')==='studio.html#assistant'){a.addEventListener('click',()=>{if(page==='studio'){setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')),30)}})}});
/* ---------- dashboard ---------- */
if(page==='dashboard'){
 bind(byText('button','New Print Project'),()=>location.href='studio.html');
 bind(byText('button','Calibrate AI Profiles'),()=>location.href='studio.html#slicer');
 bind(byText('button','Batch Slicing Queue'),()=>soon('Batch slicing (a queue of many models)'));
 bind(byText('button','Filament Spool Vault'),()=>location.href='studio.html#colours');
 bind(byText('button','Neural Overhang Analyzer'),()=>location.href='studio.html#analysis');
 bind(byText('button','Firmware Sync'),()=>soon('Printer firmware sync'));
 bind(byText('button','Send',true),()=>soon('Cloud slicing jobs are demo data'));
 const z=byText('h2','Drop STL, OBJ');const zone=z&&(z.closest('[class*="cursor-pointer"]')||z.parentElement);
 if(zone){zone.addEventListener('click',e=>{e.preventDefault();pick()});zone.setAttribute('role','button');zone.tabIndex=0;zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}})}
 const h3=byText('h3','Sample Figurine Collection'),first=h3&&h3.closest('.p-space-md'),grid=first&&first.parentElement;
 const gb=byText('button','Grid',true),lb=byText('button','List',true);
 const mode=m=>{if(grid)grid.style.gridTemplateColumns=m==='list'?'1fr':'';[gb,lb].forEach(b=>b&&b.classList.toggle('ui-on',b===(m==='list'?lb:gb)))};bind(gb,()=>mode('grid'));bind(lb,()=>mode('list'));
 if(grid){grid.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.wired||b.onclick)return;const card=b.closest('.p-space-md');if(!card||card.parentElement!==grid)return;
   const ic=b.querySelector('.material-symbols-outlined'),n=ic&&ic.textContent.trim();
   if(n==='view_in_ar')location.href='studio.html';else if(n==='play_arrow')toast('Open the model in the Studio, then use "Send to printer" 🖨️',5000);else if(n==='download')toast('Demo project - upload your own model and its original file can be downloaded from here ⬇️',5000)})}
 const sr=$('input[placeholder*="Search"]');if(sr&&grid){sr.addEventListener('input',()=>{const q=sr.value.trim().toLowerCase();[...grid.children].forEach(c=>{const t=(c.querySelector('h3')||c).textContent.toLowerCase();c.style.display=!q||t.includes(q)?'':'none'})})}
 const hs=()=>{if(location.hash==='#history'){const t=$('.ph-card')||byText('h2','Active Projects');t&&t.scrollIntoView({behavior:'smooth',block:'center'})}};addEventListener('hashchange',hs);setTimeout(hs,1500);
}
/* ---------- landing page ---------- */
if(page==='index'){
 const modal=(title,body)=>{const o=document.createElement('div');o.className='pf-modal';o.innerHTML='<div class="pf-form"><h3></h3><p class="ui-p"></p><div class="pf-btns"><button type="button" class="pri">Got it 💖</button></div></div>';o.querySelector('h3').textContent=title;o.querySelector('.ui-p').textContent=body;o.onclick=e=>{if(e.target===o||e.target.closest('button'))o.remove()};document.body.appendChild(o)};
 $$('a').forEach(a=>{const t=T(a);if(a.getAttribute('href')!=='#')return;
  if(/Pricing/.test(t))bind(a,()=>modal('Pricing 💖','PrintReady AI is free while it is in beta. Everything runs on your own computer - no account, and your models are never uploaded to a cloud.'));
  else if(/Bambu PLA/.test(t))bind(a,()=>location.href='studio.html#material=PLA');
  else if(/Prusa PETG/.test(t))bind(a,()=>location.href='studio.html#material=PETG');
  else if(/PolyLite TPU/.test(t))bind(a,()=>location.href='studio.html#material=TPU%20(flexible)');
  else if(/Carbon Fiber Nylon/.test(t))bind(a,()=>location.href='studio.html#material=Nylon-CF');
  else if(/Join/.test(t))bind(a,()=>modal('Maker community 🐾','The community hub is a placeholder in this demo - there is no real chat server behind it yet.'))});
 bind(byText('button','Watch Demo'),()=>location.href='studio.html#assistant');
 $$('button').filter(b=>T(b)==='View Details').forEach(b=>bind(b,()=>{const r=b.getBoundingClientRect();for(let k=0;k<6;k++){const p=document.createElement('span');p.className='fx-pop';p.textContent=['💖','✨','🐾','🥕'][k%4];p.style.left=(r.left+r.width/2)+'px';p.style.top=(r.top)+'px';p.style.setProperty('--px',rnd(-60,60)+'px');document.body.appendChild(p);setTimeout(()=>p.remove(),1000)}
  const n=(+localStorage.getItem('pr_boops')||0)+1;try{localStorage.setItem('pr_boops',n)}catch(e){}window.PRsound&&PRsound.pal(Math.floor(Math.random()*4));toast('Feature interactions: '+n,2500)}));
 const sub=byText('button','Subscribe');if(sub)bind(sub,()=>{const f=sub.closest('form,div'),em=f&&$('input[type=email],input[type=text]',f)||$('input[type=email]');const v=em&&em.value.trim();
  if(!v||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))return toast('Please type a valid email address first 💌');try{const l=JSON.parse(localStorage.getItem('pr_subs')||'[]');l.push(v);localStorage.setItem('pr_subs',JSON.stringify(l))}catch(e){}em.value='';toast('Thanks! Saved on this computer only - this demo has no newsletter server 💌',5000)});
}
/* ---------- safety net: leftover "#" links never just jump to the top ---------- */
$$('a[href="#"]').forEach(a=>{if(!a.dataset.wired&&!a.onclick&&!a.closest('#fx-tools'))a.addEventListener('click',e=>{if(a.dataset.wired||a.onclick)return;e.preventDefault();if(page==='studio'&&/Stage View/.test(T(a)))return toast('You are already in Stage View 🎬',2200);soon(T(a).replace(/^\S+\s/,'').slice(0,40)||'This link')})});
})();

