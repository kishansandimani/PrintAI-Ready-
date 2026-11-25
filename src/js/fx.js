
(function(){
  const mk=(t,c,p)=>{const e=document.createElement(t);if(c)e.className=c;if(p)p.appendChild(e);return e};
  const rnd=(a,b)=>a+Math.random()*(b-a);
  /* ---------- animated background ---------- */
  const bg=mk('div');bg.id='fx-bg';document.body.appendChild(bg);
  ['b1','b2','b3'].forEach(c=>mk('div','blob '+c,bg));
  const icons=['','','','','','','','','',''];
  for(let i=0;i<8;i++){
    const e=mk('span','fx-float',bg);e.textContent=icons[i%icons.length];
    e.style.left=rnd(0,100)+'vw';e.style.fontSize=rnd(14,32)+'px';
    e.style.animationDuration=rnd(24,42)+'s';e.style.animationDelay=(-rnd(0,30))+'s';
    e.style.setProperty('--dx',rnd(-45,45)+'px');e.style.setProperty('--rot',rnd(-45,45)+'deg');
  }
  for(let i=0;i<8;i++){
    const t=mk('div','fx-twinkle',bg);t.style.left=rnd(0,100)+'vw';t.style.top=rnd(0,100)+'vh';
    t.style.animationDelay=rnd(0,3)+'s';t.style.animationDuration=rnd(4,7)+'s';
  }
  /* ---------- assistant controls ---------- */
  const bots=[
    ['@@IMG bamboo.png@@',['PrintReady assistant.','Your model is ready to print.','Select for a status update.','Ready for your next model.']],
    ['@@IMG pip.png@@',['PrintReady assistant ','Model processing is ready. ','Layer preview is available.','No mesh issues detected.']],
    ['@@IMG foxy.png@@',['PrintReady assistant ','Model loaded successfully.','Surface inspection is ready. ','Select for a status update. ']],
    ['@@IMG chirpy.png@@',['PrintReady assistant ','Your model is ready. ','Infill preview is ready.','Print preparation complete.']]
  ];
  const dock=mk('div');dock.id='fx-pals';document.body.appendChild(dock);
  bots.forEach(([src,lines],pi)=>{
    const el=mk('div','fx-bot',dock);
    const img=mk('img','',el);img.src=src;img.alt='PrintReady assistant';
    const say=mk('div','fx-say',el);
    const talk=txt=>{say.textContent=txt;el.classList.add('talk');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('talk'),2600)};
    el.addEventListener('click',()=>{
      const ln=lines[Math.floor(Math.random()*lines.length)];talk(ln);window.PRsound&&PRsound.pal(pi);try{window.PRvoice&&PRvoice.pal(pi,ln)}catch(e){}
      const r=el.getBoundingClientRect();
      for(let k=0;k<3;k++){const p=mk('span','fx-pop',document.body);p.textContent=['💖','✨','🐾'][k%3];
        p.style.left=(r.left+r.width/2)+'px';p.style.top=(r.top+20)+'px';p.style.setProperty('--px',rnd(-45,45)+'px');
        setTimeout(()=>p.remove(),1000)}
    });
  });
})();

