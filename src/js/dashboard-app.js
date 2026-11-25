
(function(){
const ymd=t=>new Date(t).toISOString().slice(0,10);
function derive(L){const S={count:L.length,hours:0,grams:0,meters:0,scoreSum:0,scoreN:0,days:{}};L.forEach(r=>{const hm=/(\d+)h\s*(\d+)m/.exec((r.est&&r.est.time)||''),g=/(\d+)\s*g/.exec((r.est&&r.est.fil)||''),m=/~([\d.]+)\s*meters/.exec((r.est&&r.est.fil)||'');
 S.hours+=hm?+hm[1]+hm[2]/60:0;S.grams+=g?+g[1]:0;S.meters+=m?+m[1]:0;S.days[ymd(r.t)]=(S.days[ymd(r.t)]||0)+1;if(r.score!=null){S.scoreSum+=r.score;S.scoreN++}});return S}
async function getStats(L){let S=null;try{S=await fetch('/api/stats').then(r=>r.ok?r.json():null)}catch(e){}
 if(!S||S.count==null){try{S=JSON.parse(localStorage.getItem('pr_stats')||'null')}catch(e){}}
 return S&&S.count!=null?S:(L&&L.length?derive(L):null)}
function stats(S){if(!S||!S.count)return;
 const lab=t=>[...document.querySelectorAll('span')].find(s=>s.textContent.trim()===t&&!s.children.length),cardOf=l=>l&&l.parentElement.parentElement,
  setText=(el,t)=>{if(!el)return;[...el.childNodes].forEach(n=>{if(n.nodeType===3)n.remove;el.appendChild(document.createTextNode(' '+t))};
 const day=864e5,now=Date.now(),dk=i=>ymd(now-i*day),week=[0,1,2,3,4,5,6].reduce((a,i)=>a+(S.days[dk(i)]||0),0),avg=S.scoreN?S.scoreSum/S.scoreN:null,H=S.hours,G=S.grams,Mt=S.meters;
 let c=cardOf(lab('Models Analysed'));if(c){c.querySelector('.font-headline-lg').textContent=S.count.toLocaleString();setText(c.querySelector('.font-badge-label'),week+' this week');
  const bars=[...c.querySelectorAll('.flex-1')],cnt=bars.map((_,i)=>S.days[dk(bars.length-1-i)]||0),mx=Math.max(1,...cnt);bars.forEach((b,i)=>b.style.height=Math.max(8,cnt[i]/mx*100)+'%')}
 c=cardOf(lab('Printability Checks'));if(c){c.querySelector('.font-headline-lg').textContent=avg==null?'–':Math.round(avg)+'%';const bg=c.querySelector('.font-badge-label');if(bg)bg.textContent=avg==null?'Run an analysis':'Reliability '+(avg>=95?'A+':avg>=90?'A':avg>=80?'B':avg>=70?'C':'D');const bar=c.querySelector('.h-full');if(bar)bar.style.width=(avg||0)+'%'}
 c=cardOf(lab('Printing Hours Est.'));if(c){c.querySelector('.font-headline-lg').textContent=H<10?H.toFixed(1)+'h':Math.round(H)+'h';const bg=c.querySelector('.font-badge-label');if(bg)bg.textContent=S.count+' model'+(S.count>1?'s':'');const p=c.querySelector('p');if(p)p.textContent='Estimated from all your uploads'}
 const fl=lab('Filament Saved')||lab('Filament Needed');if(fl){fl.textContent='Filament Needed';c=cardOf(fl);c.querySelector('.font-headline-lg').textContent=G>=1000?(G/1000).toFixed(2)+' kg':Math.round(G)+' g';const bg=c.querySelector('.font-badge-label');if(bg)bg.textContent='~'+Mt.toFixed(1)+' m';const p=c.querySelector('p');if(p)p.textContent='15% infill, 2 walls'}}
let L0=[];try{L0=JSON.parse(localStorage.getItem('pr_models')||'[]')}catch(e){}
fetch('/api/records').then(r=>r.ok?r.json():L0).catch(()=>L0).then(L=>{
const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.includes('Sample Figurine Collection'));if(!h)return;
const card=h.closest('.p-space-md'),grid=card.parentElement,head=[...document.querySelectorAll('h2')].find(x=>x.textContent.includes('Active Projects'));
if(head&&L.length){const b=document.createElement('button');b.textContent='Clear my uploads';b.style.cssText='margin-left:12px;font:600 12px system-ui;color:#7c3aed;background:#f1e9ff;border:0;border-radius:999px;padding:4px 12px;cursor:pointer';b.onclick=async()=>{try{await Promise.all(L.map(r=>fetch('/api/files/'+r.id,{method:'DELETE'})));await fetch('/api/records',{method:'PUT',body:'[]'});await fetch('/api/stats',{method:'PUT',body:'{}'})}catch(e){}localStorage.removeItem('pr_models');localStorage.removeItem('pr_stats');Object.keys(localStorage).filter(k=>k.startsWith('prf_')).forEach(k=>localStorage.removeItem(k));location.reload()};head.appendChild(b)}
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
L.slice().reverse().forEach(r=>{const c=card.cloneNode(true),img=c.querySelector('img');img.removeAttribute('data-alt');img.src=r.thumb;img.alt=r.name;
 const sp=[...c.querySelectorAll('span')],set=(m,v)=>{const e=sp.find(x=>x.textContent.trim()===m);if(e)e.textContent=v};
 set('3MF',r.fmt);set('96/100 Excellent',r.score==null?'Not analysed':r.score+'/100 '+(r.score>=90?'Excellent':r.score>=70?'Good':'Needs work'));set('2h 45m',r.est.time||'—');set('184k tris',(r.n>=1000?Math.round(r.n/1000)+'k':r.n)+' tris');
 c.querySelector('h3').textContent=r.name;c.querySelector('p').textContent=r.dim.join(' × ')+' mm • '+r.vol+' cm³ • '+(r.est.lay||'')+' • '+ago(r.t);
 const btns=[...c.querySelectorAll('button')],btn=btns[0];if(btn)btn.onclick=()=>location.href='studio.html#model='+r.id;
 if(btns[1])btns[1].onclick=()=>location.href='studio.html#model='+r.id;
 if(btns[2])btns[2].onclick=async()=>{let blob=null,name=r.name;try{const x=await fetch('/api/files/'+r.id);if(x.ok){blob=await x.blob();name=decodeURIComponent(x.headers.get('X-Name')||r.name)}}catch(e){}
  if(!blob){try{const o=JSON.parse(localStorage.getItem('prf_'+r.id));if(o){blob=new Blob([Uint8Array.from(atob(o.d),ch=>ch.charCodeAt(0))]);name=o.name}}catch(e){}}
  if(!blob)return window.PRui&&PRui.toast('The original file was not kept (big files need python server.py) ',5000);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove()};grid.insertBefore(c,grid.firstElementChild)});
if(L.length){const n=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()==='1,248');if(n)n.textContent=(1248+L.length).toLocaleString()}
getStats(L).then(stats);
}).catch(e=>console.error('dashboard-app',e&&e.message));
})();

/* ---------- real printer fleet (needs python server.py) ---------- */
(function(){
const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Printer Fleet');if(!h)return;
const card=h.parentElement.parentElement.parentElement,chip=[...card.querySelectorAll('span')].find(s=>/Connected/.test(s.textContent)),demos=[...card.children].filter(c=>c.tagName==='DIV'&&/p-space-md/.test(c.className));
card.classList.add('cf-card');const head=h.parentElement.parentElement,esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let list=[],box=document.createElement('div'),timer=null;box.className='pf-box';card.appendChild(box);
const add=document.createElement('button');add.className='pf-add';add.textContent='+ Add printer';
fetch('/api/printers').then(r=>r.ok?r.json():null).then(l=>{if(!l)return;list=l;head.appendChild(add);render();poll();timer=setInterval(poll,5000)}).catch;
function render(){demos.forEach(d=>d.style.display=list.length?'none':'');box.innerHTML='';
 if(!list.length){box.innerHTML='<div class="pf-hint">Demo data shown above. Click <b>+ Add printer</b> to connect a real Klipper/Moonraker or OctoPrint printer on your network.</div>';if(chip)chip.textContent='demo';return}
 list.forEach(p=>{const e=document.createElement('div');e.className='pf';e.dataset.id=p.id;
  e.innerHTML=`<div class="pf-top"><span class="pf-name"><span class="pf-av">${p.type==='moonraker'?'':''}</span><span>${esc(p.name)} <small>${p.type==='moonraker'?'Klipper':'OctoPrint'}</small></span></span><span class="pf-state pf-s-offline">checking…</span></div><div class="pf-job">&nbsp;</div><div class="pf-bar"><i style="width:0"></i></div><div class="pf-temps"><span> –</span><span> –</span><button class="pf-pause" hidden>Pause</button><button class="pf-cam" title="Show camera"></button><button class="pf-cancel" hidden>Cancel print</button><button class="pf-x" title="Remove printer"></button></div><div class="pf-view"></div>`;
  const cam=e.querySelector('.pf-cam'),view=e.querySelector('.pf-view');cam.onclick=async()=>{if(view.firstChild){view.innerHTML='';return}view.textContent='Looking for camera…';let u=null;try{u=(await fetch('/api/printers/'+p.id+'/webcam').then(r=>r.json.url}catch(x){}
   if(!u){view.textContent='No webcam found - enable one in Mainsail / Fluidd / OctoPrint first.';return}const im=new Image();im.alt='printer camera';im.onload=()=>{view.textContent='';view.appendChild(im)};im.onerror=()=>{view.textContent='Camera not reachable from this computer ('+u+')'};im.src=u};
  e.querySelector('.pf-pause').onclick=async()=>{const a=e.dataset.state==='paused'?'resume':'pause';if(a==='resume'&&!confirm('Resume the print on '+p.name+'?\nCheck the printer first (nothing in the way, filament OK).'))return;const r=await fetch('/api/printers/'+p.id+'/'+a,{method:'POST'}),j=await r.json();if(!r.ok)alert('Could not '+a+': '+(j.error||r.status));poll()};
  e.querySelector('.pf-cancel').onclick=async()=>{const job=e.querySelector('.pf-job').textContent;if(!confirm('Cancel the running print on '+p.name+'?\n'+job+'\n\nThis cannot be undone.'))return;const r=await fetch('/api/printers/'+p.id+'/cancel',{method:'POST'}),j=await r.json();if(!r.ok)alert('Could not cancel: '+(j.error||r.status));poll()};
  e.querySelector('.pf-x').onclick=async()=>{if(!confirm('Remove '+p.name+'?'))return;await fetch('/api/printers/'+p.id,{method:'DELETE'});list=list.filter(x=>x.id!==p.id);render()};box.appendChild(e)})}
async function poll(){let on=0;await Promise.all(list.map(async p=>{const e=box.querySelector(`[data-id="${p.id}"]`);if(!e)return;let s;try{s=await fetch('/api/printers/'+p.id+'/status').then(r=>r.json())}catch(x){s={state:'offline'}}
  if(s.state!=='offline'&&s.state!=='error')on++;{const act=s.state==='printing'||s.state==='paused',pb=e.querySelector('.pf-pause');e.dataset.state=s.state;e.querySelector('.pf-cancel').hidden=!act;pb.hidden=!act;pb.textContent=s.state==='paused'?'Resume':'Pause'}const st=e.querySelector('.pf-state');st.className='pf-state pf-s-'+s.state;st.textContent=s.state==='printing'?'Printing ('+s.progress+'%)':s.state==='error'&&s.error?'Error ('+s.error+')':s.state[0].toUpperCase()+s.state.slice(1);
  {const jb=e.querySelector('.pf-job');jb.textContent=s.file?'Job: '+s.file:(s.state==='offline'?'Cannot reach this printer  Is it switched on and on the same network?':'No job right now ');jb.title=s.error||''}e.querySelector('.pf-bar i').style.width=(s.progress||0)+'%';
  const t=e.querySelectorAll('.pf-temps span');t[0].textContent=' '+(s.nozzle??'–')+'°C'+(s.nozzleTarget?' → '+s.nozzleTarget:'');t[1].textContent=' '+(s.bed??'–')+'°C'+(s.bedTarget?' → '+s.bedTarget:'')}));
 if(chip&&list.length)chip.textContent=on+' / '+list.length+' online'}
add.onclick=()=>{const o=document.createElement('div');o.className='pf-modal';o.innerHTML=`<form class="pf-form"><h3>Add a printer </h3>
 <label>Name<input name="name" placeholder="Ender 3 (garage)" required></label>
 <label>Type<select name="type"><option value="moonraker">Klipper / Moonraker (Mainsail, Fluidd)</option><option value="octoprint">OctoPrint</option></select></label>
 <label>Address<input name="url" placeholder="http://192.168.1.50:7125" required></label>
 <label>API key <small>(OctoPrint needs one; Moonraker usually not)</small><input name="key" type="password" autocomplete="off"></label>
 <p class="pf-note">Moonraker is usually on port 7125. OctoPrint: http://octopi.local and the key from Settings → API. Bambu Lab printers aren't supported yet.</p>
 <div class="pf-err"></div><div class="pf-btns"><button type="button" class="c">Cancel</button><button type="submit" class="pri">Add printer</button></div></form>`;
 document.body.appendChild(o);const f=o.querySelector('form');o.querySelector('.c').onclick=()=>o.remove();o.onclick=e=>{if(e.target===o)o.remove()};
 f.onsubmit=async e=>{e.preventDefault();const err=f.querySelector('.pf-err');err.textContent='';let r,j;
  try{r=await fetch('/api/printers',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});j=await r.json()}catch(x){err.textContent='Could not reach the server ('+x.message+')';return}
  if(!r.ok){err.textContent=j.error||'Could not add printer';return}list.push(j);o.remove();render();poll();if(!timer)timer=setInterval(poll,5000)}}
})();

/* ---------- print history (needs python server.py) ---------- */
(function(){
const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Printer Fleet');if(!h)return;const fleet=h.parentElement.parentElement.parentElement;
const pals=[...document.querySelectorAll('#fx-pals img')].map(i=>i.src),pal=k=>pals.length?pals[k%pals.length]:'';
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
const V={uploaded:['','Uploaded','to','upload','up'],start:['▶','Started','on','start','go'],cancel:['⏹','Cancelled print','on','cancel the print','stop'],pause:['⏸','Paused','','pause','wait'],resume:['⏯','Resumed','','resume','go']};
const card=document.createElement('div');card.className='ph-card';
card.innerHTML='<i class="ph-spark s1"></i><i class="ph-spark s2"></i><i class="ph-spark s3"></i><div class="ph-head"><img class="ph-mascot" alt=""><div class="ph-title"><b>Print history</b><small>Recent printer activity </small></div><span class="ph-count">0</span><button type="button" class="ph-clear"> Clear</button></div><div class="ph-list"></div>';
card.querySelector('.ph-mascot').src=pal(1);
const list=card.querySelector('.ph-list'),cnt=card.querySelector('.ph-count');let timer=null;
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
function render(items){list.innerHTML='';cnt.textContent=items.length;cnt.style.display=items.length?'':'none';
 if(!items.length){const e=el('div','ph-empty');const im=el('img');im.src=pal(0);im.alt='';const b=el('div','ph-bubble','No print history yet. Send a model to a printer from the Studio to see activity here. ');e.append(im,b);list.appendChild(e);return}
 items.slice(-12).reverse().forEach((e,k)=>{const v=V[e.action]||['•',e.action,'on',e.action,'up'],bad=!e.ok,row=el('div','ph-row '+(bad?'bad':v[4]));row.style.animationDelay=(k*60)+'ms';
  const dot=el('span','ph-dot',bad?'':v[0]),bub=el('div','ph-msg');
  const line=el('div','ph-line');line.append(el('b',null,bad?'Could not '+v[3]:v[1]));
  if(e.file)line.append(' ',el('code',null,e.file));
  if(v[2])line.append(' '+v[2]+' ',el('b','pr',e.printer));else line.append(' ',el('b','pr',e.printer));
  bub.appendChild(line);if(bad&&e.note)bub.appendChild(el('small','why',e.note));
  row.append(dot,bub,el('span','ph-time',ago(e.t)));list.appendChild(row)})}
async function load(){try{const r=await fetch('/api/history');if(!r.ok)return;render(await r.json())}catch(x){}}
fetch('/api/history').then(r=>r.ok?r.json():null).then(items=>{if(!items)return;fleet.after(card);render(items);timer=setInterval(load,8000)}).catch;
card.querySelector('.ph-clear').onclick=async()=>{if(!confirm('Clear the print history?'))return;await fetch('/api/history',{method:'DELETE'});load()};
})();

/* ---------- dashboard decorations ---------- */
(function(){
const pals=[...document.querySelectorAll('#fx-pals img')].map(i=>i.src);
const lab=t=>[...document.querySelectorAll('span')].find(s=>s.textContent.trim()===t&&!s.children.length);
[['Models Analysed',0,'pink'],['Printability Checks',1,'mint'],['Printing Hours Est.',2,'peach'],['Filament Saved',3,'sky']].forEach(([t,k,c])=>{
 const l=lab(t)||(t==='Filament Saved'&&lab('Filament Needed')),card=l&&l.parentElement.parentElement;if(!card)return;
 card.classList.add('cs-card','cs-'+c);const im=new Image();im.className='cs-pal';im.alt='';if(pals[k])im.src=pals[k];card.appendChild(im)});
const h=[...document.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Printer Fleet');if(h)h.classList.add('cf-title');
})();

