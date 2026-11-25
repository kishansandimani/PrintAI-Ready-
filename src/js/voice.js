(function(){
/* PrintReady AI - voice: cute talking pals (speech output) + voice commands (speech input).
   Uses the browser's built-in Web Speech API - no libraries, nothing is installed or uploaded by this app.
   NOTE: Edge/Chrome send your voice to their own online speech service for recognition, so voice INPUT needs internet.
   Voice can never start, pause or cancel a print - those always need a real click and a confirmation. */
const TTS=window.speechSynthesis,SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const page=/studio/.test(location.pathname)?'studio':/dashboard/.test(location.pathname)?'dashboard':'index';
const $=(s,r=document)=>r.querySelector(s);
let cfg={on:true,voice:'',pitch:1.45,rate:1.05};
try{Object.assign(cfg,JSON.parse(localStorage.getItem('pr_voice')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('pr_voice',JSON.stringify(cfg))}catch(e){}};

/* ---------- cute voice (output) ---------- */
// Friendly/young sounding voices first (Edge "Ana" is a child voice, "Jenny"/"Aria" are bright), then any English voice.
const PREF=[/\bAna\b/i,/Jenny/i,/Aria/i,/Michelle/i,/Sonia/i,/Libby/i,/Emma/i,/Zira/i,/Samantha/i,/Karen/i,/Tessa/i,/Google UK English Female/i,/Google US English/i,/female/i];
const PAL={pitch:[.85,1.1,1.3,1.6],rate:[.92,1,1.06,1.14]};       // Bamboo, Pip, Foxy, Chirpy each sound a little different
let voices=[];
function loadVoices(){voices=TTS?TTS.getVoices().filter(v=>/^en/i.test(v.lang)):[];fillSelect()}
function chosen(){if(!voices.length)return null;let v=voices.find(x=>x.name===cfg.voice);if(v)return v;for(const re of PREF){v=voices.find(x=>re.test(x.name));if(v)return v}return voices[0]}
const clean=t=>String(t).replace(/[\p{Extended_Pictographic}‍️]/gu,'').replace(/G-code/gi,'G code').replace(/\bSTL\b/g,'S T L').replace(/\bOBJ\b/g,'O B J').replace(/\b3MF\b/g,'3 M F').replace(/&/g,' and ').replace(/\s+/g,' ').trim();
let lastTxt='',lastT=0,mute=0;
function say(text,o){o=o||{};if(!TTS||!cfg.on||mute>Date.now()&&!o.force)return;const t=clean(text);if(!t)return;
 const now=Date.now();if(t===lastTxt&&now-lastT<1500)return;lastTxt=t;lastT=now;
 if(o.interrupt!==false)try{TTS.cancel()}catch(e){}
 const pi=o.pal==null?null:o.pal%4,v=chosen();
 const parts=t.match(/[^.!?]+[.!?]*/g)||[t];                     // short chunks avoid the browser cutting long speech off
 parts.forEach(p=>{const u=new SpeechSynthesisUtterance(p.trim());if(v){u.voice=v;u.lang=v.lang}else u.lang='en-US';
  u.pitch=Math.max(0,Math.min(2,cfg.pitch*(pi==null?1:PAL.pitch[pi]/1.1)));u.rate=Math.max(.5,Math.min(2,cfg.rate*(pi==null?1:PAL.rate[pi])));u.volume=1;
  try{TTS.speak(u)}catch(e){}})}
const stop=()=>{try{TTS&&TTS.cancel()}catch(e){}};

/* ---------- panel ---------- */
const tools=$('#fx-tools');
const btn=document.createElement('button');btn.textContent='🎤';btn.title='Voice Assistant';btn.setAttribute('aria-label','Voice');if(tools)tools.appendChild(btn);
const P=document.createElement('div');P.id='fx-voice';P.hidden=true;
P.innerHTML='<div class="vh"><b>🎙 Voice Assistant</b><button type="button" class="vx" aria-label="Close">×</button></div>'
 +'<button type="button" class="vmic" aria-label="Start listening">🎤</button>'
 +'<div class="vsay" aria-live="polite"></div>'
 +'<label class="vrow"><input type="checkbox" class="v-on"> Assistant reads messages aloud</label>'
 +'<label class="vrow">Voice <select class="v-voice"></select></label>'
 +'<label class="vrow">Voice pitch <input type="range" class="v-pitch" min="0.8" max="2" step="0.05"></label>'
 +'<label class="vrow">Speed <input type="range" class="v-rate" min="0.7" max="1.5" step="0.05"></label>'
 +'<button type="button" class="vtest">▶ Say hi</button>'
 +'<small class="vhint"></small>';
document.body.appendChild(P);
const sayBox=$('.vsay',P),mic=$('.vmic',P),selV=$('.v-voice',P),hint=$('.vhint',P);
const show=t=>{sayBox.textContent=t};
function fillSelect(){if(!selV)return;selV.innerHTML='';const auto=document.createElement('option');auto.value='';auto.textContent='Automatic voice selection';selV.appendChild(auto);
 voices.forEach(v=>{const o=document.createElement('option');o.value=v.name;o.textContent=v.name.replace(/^Microsoft /,'').replace(/ Online \(Natural\)/,' (natural)');selV.appendChild(o)});selV.value=cfg.voice}
$('.v-on',P).checked=cfg.on;$('.v-pitch',P).value=cfg.pitch;$('.v-rate',P).value=cfg.rate;
$('.v-on',P).onchange=e=>{cfg.on=e.target.checked;save();if(!cfg.on)stop()};
selV.onchange=()=>{cfg.voice=selV.value;save()};
$('.v-pitch',P).oninput=e=>{cfg.pitch=+e.target.value;save()};$('.v-rate',P).oninput=e=>{cfg.rate=+e.target.value;save()};
$('.vtest',P).onclick=()=>say("PrintReady voice test. Your model is ready to print.",{force:true,pal:2});
$('.vx',P).onclick=()=>{P.hidden=true;stopListen()};
btn.onclick=()=>{P.hidden=!P.hidden;if(P.hidden)stopListen();else{if(!sayBox.textContent)show('Tap the mic, then say “help” to hear what I understand.')}};
addEventListener('keydown',e=>{if(e.key==='Escape'&&!P.hidden){P.hidden=true;stopListen()}});
if(!TTS){$('.v-on',P).parentElement.hidden=selV.parentElement.hidden=$('.v-pitch',P).parentElement.hidden=$('.v-rate',P).parentElement.hidden=$('.vtest',P).hidden=true}
if(!SR){mic.disabled=true;hint.textContent='Voice input needs Microsoft Edge or Google Chrome. (Voice output still works.)'}
else hint.textContent='Voice input needs internet and microphone permission. It can never start or cancel a print.';
if(TTS){loadVoices();TTS.addEventListener&&TTS.addEventListener('voiceschanged',loadVoices)}

/* ---------- voice commands (input) ---------- */
let rec=null,listening=false;
function stopListen(){listening=false;mic.classList.remove('on');if(rec){try{rec.abort()}catch(e){}rec=null}}
function listen(){if(!SR)return;if(listening)return stopListen();stop();
 rec=new SR();rec.lang='en-US';rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1;let final='';
 rec.onstart=()=>{listening=true;mic.classList.add('on');show('Listening… 🐾')};
 rec.onresult=e=>{let tmp='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)final+=r[0].transcript;else tmp+=r[0].transcript}show('“'+(final||tmp).trim()+'”')};
 rec.onerror=e=>{const m={'not-allowed':'The microphone is blocked. Click the lock icon next to the address, allow the microphone, then try again.','service-not-allowed':'The microphone is blocked. Click the lock icon next to the address, allow the microphone, then try again.','no-speech':"I didn't hear anything. Tap the mic and try again.",'audio-capture':'I cannot find a microphone.','network':'Voice input needs an internet connection.'}[e.error];if(e.error!=='aborted')show(m||'Voice input stopped ('+e.error+').')};
 rec.onend=()=>{listening=false;mic.classList.remove('on');rec=null;if(final.trim()){const t=final.trim(),r=run(t);show('“'+t+'”  →  '+r);say(r,{force:true,pal:2})}};
 try{rec.start()}catch(e){show('Could not start the microphone.')}}
mic.onclick=listen;

const norm=t=>' '+t.toLowerCase().replace(/[^a-z0-9+\-\s]/g,' ').replace(/\b(please|hey|hi there|pal|bamboo|pip|foxy|chirpy|can you|could you|would you|for me|now)\b/g,' ').replace(/\s+/g,' ').trim()+' ';
const txt=e=>(e.textContent||'').trim().replace(/\s+/g,' ');
const find=(sel,re)=>[...document.querySelectorAll(sel)].find(e=>re.test(txt(e)));
const click=(el,ok)=>{if(!el)return null;el.click();return ok};
const need=r=>page==='studio'?r():'That works in the Studio. Say “open studio” first.';
const MAT={'pla':'PLA','pla+':'PLA+','pla plus':'PLA+','silk':'Silk PLA','silk pla':'Silk PLA','petg':'PETG','abs':'ABS','tpu':'TPU','nylon':'Nylon-CF','nylon cf':'Nylon-CF'};
const go=(url,r)=>{setTimeout(()=>{location.href=url},700);return r};
const HELP='You can say: open studio, open dashboard, use the demo model, wireframe, x-ray, heatmap, toolpath, export G code, print report, lay flat, heal, fit bed, slicer settings, colours, material PETG, take the tour, or stop talking.';
const CMDS=[
 [/ (help|what can you do|what can i say|commands) /,()=>HELP],
 [/ (hello|hi|hey|good morning|good evening) $/,()=>"Hi! I'm your PrintReady pal. Say help to hear what I can do."],
 [/ (thank you|thanks) /,()=>"You're welcome."],
 [/ (stop talking|be quiet|quiet|silence|shush|stop) /,()=>{stop();return 'Voice responses paused.'}],
 [/ (mute|turn off|disable) (the )?(voice|talking|speech) | voice off /,()=>{setTimeout(()=>{cfg.on=false;$('.v-on',P).checked=false;save()},50);return "Okay, I'll be quiet. Turn me back on in the voice panel."}],
 [/ (unmute|turn on|enable) (the )?(voice|talking|speech) | voice on /,()=>{cfg.on=true;$('.v-on',P).checked=true;save();return 'Voice responses are enabled.'}],
 [/ (tour|guide me|show me around|walk me through) /,()=>window.PRtour?(setTimeout(()=>PRtour.start(),300),'Starting the tour!'):'The tour is not available here.'],
 [/ (home|landing|start) page | (go|open|take me) (to )?(the )?home /,()=>go('index.html','Going home!')],
 [/ dashboard /,()=>page==='dashboard'?'You are already on the dashboard.':go('dashboard.html','Opening the dashboard!')],
 [/ (open|go to|show|take me to) (the )?studio | studio /,()=>page==='studio'?'You are already in the Studio.':go('studio.html','Opening the Studio!')],
 [/ add (a |another )?printer /,()=>page==='dashboard'?click(find('button',/Add printer/),'Opening add printer.')||'I could not find that button.':'Printers are on the dashboard. Say open dashboard.'],
 [/ (demo|kitten) /,()=>need(()=>click($('.up-demo'),'Loading the demo kitten!')||'I could not find the demo button.')],
 [/ upload /,()=>{const b=$('.up-main')||find('button,a',/upload/i);if(b){b.scrollIntoView({block:'center'});b.focus()}return 'Please click the Upload button yourself. Browsers only let you pick a file with a real click.'}],
 [/ wire ?frame /,()=>need(()=>click(find('button',/^Wireframe$/),'Wireframe view.')||'I could not find that view.')],
 [/ (x ?ray|x-ray|xray) /,()=>need(()=>click(find('button',/^X-Ray$/),'X-ray view.')||'I could not find that view.')],
 [/ (heat ?map|overhang|overhangs) /,()=>need(()=>click(find('button',/Overhang Heatmap/),'Overhang heat map. Red means it needs support.')||'I could not find that view.')],
 [/ (toolpath|tool path|simulator|simulate) /,()=>need(()=>click(find('button',/^Toolpath$/),'Toolpath view.')||'I could not find that view.')],
 [/ solid /,()=>need(()=>click(find('button',/^Solid$/),'Solid view.')||'I could not find that view.')],
 [/ (front|top|right|iso|isometric) view | view (front|top|right|iso|isometric) /,t=>need(()=>{const m=/(front|top|right|iso)/.exec(t)[1];return click(find('button',new RegExp('^'+m+'$','i')),m+' view.')||'I could not find that view.'})],
 [/ reset (the )?view /,()=>need(()=>click($('button[title="Reset view"]'),'View reset.')||'I could not find that button.')],
 [/ (export|download|make|create|generate|slice)( the| a| my)?( basic)? (g ?-?code|gcode|g code) | ^ slice /,()=>need(()=>click(find('a,button',/Export G-code/),'Slicing your model and exporting the G code!')||'Load a model first.')],
 [/ (print )?report | pdf /,()=>need(()=>click(find('a,button',/Print report/),'Opening the print report.')||'I could not find the report button.')],
 [/ (lay|lie) flat | flat on /,()=>need(()=>click(find('button,a',/Lay flat/i),'Laying it flat.')||'I could not find the lay flat button.')],
 [/ (heal|fix|repair|auto ?heal) /,()=>need(()=>click(find('button',/Repair Mesh/),'Healing your mesh.')||'I could not find the heal button.')],
 [/ (diagnostics|analy[sz]e|analysis|check (the )?(mesh|model)) /,()=>need(()=>click(find('button',/Diagnostics/),'Checking your model.')||'I could not find the diagnostics button.')],
 [/ fit (to )?(the )?(bed|plate) /,()=>need(()=>click(find('button',/^Fit Bed$/),'Fitting it to the print plate.')||'I could not find that button.')],
 [/ (slicer )?settings | gear /,()=>need(()=>click($('#fx-tools button[title="Slicer settings"]'),'Here are the slicer settings.')||'I could not find the settings.')],
 [/ (colou?rs?|filament|ar|augmented reality|in my room) /,()=>need(()=>click($('#fx-tools button[title="Filament colour & AR"]'),'Opening colours and A R.')||'I could not find the colour panel.')],
 [/ material (pla\+|pla plus|pla|silk pla|silk|petg|abs|tpu|nylon cf|nylon) /,t=>need(()=>{const k=MAT[/material (pla\+|pla plus|pla|silk pla|silk|petg|abs|tpu|nylon cf|nylon) /.exec(t)[1]];history.replaceState(null,'',location.pathname);location.hash='material='+encodeURIComponent(k);return 'Applying the '+k+' preset.'})]
];
function run(text){const t=norm(text);mute=Date.now()+1500;                       // the spoken reply replaces the toast voice
 for(const [re,fn] of CMDS){if(re.test(t)){try{return fn(t)}catch(e){return 'Oops, that did not work.'}}}
 return 'Hmm, I did not understand “'+text+'”. Say help to hear what I can do.'}

window.PRvoice={say,stop,run,listen,cfg,pal:(i,t)=>say(t,{pal:i}),speakToast:m=>{if(m&&m.length<=140)say(m,{interrupt:false})}};
})();
