
(function(){
const $=(s,r=document)=>r.querySelector(s),F=(s,t)=>[...document.querySelectorAll(s)].find(e=>e.textContent.includes(t)),up=(e,n=1)=>{while(e&&n--)e=e.parentElement;return e};
/* ---------- sounds (tiny synth, no files) ---------- */
let ac,muted=localStorage.getItem('pr_mute')==='1';
function tone(f,d=.12,type='sine',v=.07,t0=0){if(muted)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+t0;o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+.02)}catch(e){}}
window.PRsound={
 pal:i=>[()=>{tone(240,.14,'triangle');tone(180,.18,'triangle',.07,.1)},()=>{tone(880,.07,'square',.04);tone(1100,.09,'square',.04,.09)},()=>{tone(520,.08,'sawtooth',.03);tone(780,.14,'sawtooth',.03,.08)},()=>{tone(1250,.06);tone(1250,.06,'sine',.07,.1);tone(1500,.1,'sine',.07,.2)}][i%4](),
 ok:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.16,'sine',.06,i*.09)),err:()=>{tone(300,.12,'triangle');tone(220,.2,'triangle',.07,.1)},soft:()=>tone(660,.08,'sine',.05),
 toast:m=>/Please|Could not|not kept|no longer/.test(m)?PRsound.err():/✨|ready|Reopened|score|Loaded/.test(m)?PRsound.ok():PRsound.soft()};
/* ---------- tools (tour + sound buttons) ---------- */
const tools=document.createElement('div');tools.id='fx-tools';document.body.appendChild(tools);
const mk=(t,title,fn)=>{const b=document.createElement('button');b.textContent=t;b.title=title;b.setAttribute('aria-label',title);b.onclick=fn;tools.appendChild(b);return b};
const sb=mk(muted?'🔇':'🔊','Sound on/off',()=>{muted=!muted;localStorage.setItem('pr_mute',muted?'1':'0');sb.textContent=muted?'🔇':'🔊';PRsound.soft()});
mk('🐾','Take a tour',()=>start());
/* ---------- tour ---------- */
const page=/studio/.test(location.pathname)?'studio':/dashboard/.test(location.pathname)?'dashboard':'index';
const S={
 index:[[null,'Welcome to PrintReady AI! 🐾',"This short tour explains the main controls."],
  [()=>F('h1','3D Ideas')||$('h1'),'Your 3D ideas, made print-ready','Upload an STL or OBJ and PrintReady previews it in 3D, checks it, and prepares it for printing.'],
  [()=>F('a,button','Upload Model'),'Start here','Click this to open the Studio and upload your first model.'],
  [()=>F('a,button','Open Studio'),'Studio shortcut','This button is always in the top bar.']],
 dashboard:[[null,'Your dashboard 🐾','Your uploaded models and print activity appear here.'],
  [()=>up(F('h1,h2,h3,h4,p,span','Drop STL, OBJ'),2),'Upload box','Drop a model here or click Quick Upload to open the Studio.'],
  [()=>F('h2','Active Projects'),'Your projects','Models you upload in Studio appear here with a thumbnail, size and score. Click Studio on a card to reopen it.'],
  [()=>up(F('h3','Printer Fleet'),2),'Printer fleet','Click + Add printer to connect a Klipper/Moonraker or OctoPrint printer on your network (needs python server.py). Until then these are demo panels.']],
 studio:[[null,'Welcome to the Studio 🐾','Upload a model, inspect it in 3D, and export G-code.'],
  [()=>up(F('p,div,span','Drop revised'),1),'Upload','Choose or drop an .STL or .OBJ file here. A sample model is loaded for preview.'],
  [()=>$('canvas[style*="cursor"]'),'3D viewer','Drag to rotate, scroll to zoom. Your model rotates slowly until you grab it.'],
  [()=>F('button','Toolpath'),'View modes','Solid, Wireframe, X-Ray, Overhang Heatmap (red = needs support) and Toolpath, which shows the sliced layers.'],
  [()=>$('input[orient=vertical]'),'Layer slider','Scrub through the layers - great with the Toolpath view.'],
  [()=>$('#fx-tools button[title="Filament colour & AR"]'),'Colours and AR','Try filament colours and finishes on your model, and view it at real size in your room with AR on your phone.'],
  [()=>$('#fx-tools button[title="Slicer settings"]'),'Slicer settings','Change layer height, infill, walls, temperatures and speed. The slicer and the estimates follow your choices.'],
  [()=>F('a','Export G-code'),'Export G-code','Slices your model (2 walls, infill, optional supports) and downloads a .gcode file. Preview it before printing!'],
  [()=>F('a','Send to printer'),'Send to printer','Uploads the sliced G-code to a printer you added on the Dashboard. It only starts a print if you confirm a second prompt.'],
  [()=>F('a','Print report'),'Print report','A one-page PDF with views, size, estimates and printing advice.']]};
let i=0,steps=[],ov,spot,tip;
function start(){steps=S[page];i=0;if(ov)end(true);ov=document.createElement('div');ov.id='fx-tour';
 ov.innerHTML='<div class="spot"></div><div class="tip"><img alt=""><div class="tx"><b></b><p></p><div class="row"><span></span><button data-a="back">Back</button><button data-a="next" class="pri">Next</button><button data-a="skip">Skip</button></div></div></div>';
 document.body.appendChild(ov);spot=$('.spot',ov);tip=$('.tip',ov);ov.onclick=e=>{const a=e.target.dataset&&e.target.dataset.a;if(a==='next')go(1);else if(a==='back')go(-1);else if(a==='skip'||e.target===ov)end()};
 addEventListener('keydown',key);addEventListener('resize',place);addEventListener('scroll',place,true);show()}
function key(e){if(!ov)return;if(e.key==='Escape')end();else if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1)}
function go(d){i+=d;if(i<0)i=0;if(i>=steps.length)return end();show()}
function end(quiet){localStorage.setItem('pr_tour_'+page,'1');removeEventListener('keydown',key);removeEventListener('resize',place);removeEventListener('scroll',place,true);if(ov)ov.remove();ov=null;try{window.PRvoice&&PRvoice.stop()}catch(e){}if(!quiet)PRsound.ok()}
function show(){const [t,h,b]=steps[i],el=t&&t();window.__tourEl=el;if(el&&el.scrollIntoView)el.scrollIntoView({block:'center',inline:'nearest'});
 const pal=document.querySelectorAll('#fx-pals img');tip.querySelector('img').src=pal.length?pal[i%pal.length].src:'';
 tip.querySelector('b').textContent=h;tip.querySelector('p').textContent=b;tip.querySelector('.row span').textContent=(i+1)+' / '+steps.length;
 $('[data-a=back]',tip).style.visibility=i?'visible':'hidden';$('[data-a=next]',tip).textContent=i===steps.length-1?'Done 🎉':'Next';PRsound.soft();try{window.PRvoice&&PRvoice.say(h+'. '+b)}catch(e){}place();setTimeout(place,350)}
function place(){if(!ov)return;const el=window.__tourEl,vw=innerWidth,vh=innerHeight,tw=Math.min(380,vw-24);tip.style.width=tw+'px';
 if(el){const r=el.getBoundingClientRect(),p=8;spot.style.cssText=`display:block;left:${r.left-p}px;top:${r.top-p}px;width:${r.width+2*p}px;height:${r.height+2*p}px`;
  const th=tip.offsetHeight;let y=r.bottom+p+14;if(y+th>vh-8)y=Math.max(8,r.top-p-14-th);let x=Math.min(Math.max(12,r.left),vw-tw-12);tip.style.left=x+'px';tip.style.top=Math.min(y,vh-th-8)+'px'}
 else{spot.style.display='none';tip.style.left=(vw-tw)/2+'px';tip.style.top=Math.max(12,(vh-tip.offsetHeight)/2)+'px'}}
window.PRtour={start,end,steps:()=>S[page]};
if(!localStorage.getItem('pr_tour_'+page))setTimeout(start,2200);
})();

