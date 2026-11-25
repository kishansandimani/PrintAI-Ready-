
/* Tiny QR code generator (byte mode, error correction M, versions 1-10) - no libraries. */
(function(){
const ECC=[-1,10,16,26,18,24,16,18,22,22,26],BLK=[-1,1,1,1,2,2,4,4,4,5,5];
const gmul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z&255};
function divisor(d){const r=new Array(d).fill(0);r[d-1]=1;let root=1;for(let i=0;i<d;i++){for(let j=0;j<d;j++){r[j]=gmul(r[j],root);if(j+1<d)r[j]^=r[j+1]}root=gmul(root,2)}return r}
function remainder(data,div){const r=new Array(div.length).fill(0);for(const b of data){const f=b^r.shift();r.push(0);div.forEach((c,i)=>r[i]^=gmul(c,f))}return r}
const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}return r};
const bit=(x,i)=>((x>>>i)&1)!==0;
function make(text){const bytes=[...new TextEncoder().encode(text)];let ver=1;
 for(;ver<=10;ver++){if(Math.floor(raw(ver)/8)-ECC[ver]*BLK[ver]>=bytes.length+2+(ver>=10?1:0))break}
 if(ver>10)return null;
 const dataCap=Math.floor(raw(ver)/8)-ECC[ver]*BLK[ver],bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1)};
 put(4,4);put(bytes.length,ver>=10?16:8);bytes.forEach(b=>put(b,8));put(0,Math.min(4,dataCap*8-bits.length));while(bits.length%8)bits.push(0);
 const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join,2));for(let p=0xEC;data.length<dataCap;p^=0xEC^0x11)data.push(p);
 const nb=BLK[ver],el=ECC[ver],rc=Math.floor(raw(ver)/8),ns=nb-rc%nb,sl=Math.floor(rc/nb),dv=divisor(el),blocks=[];
 for(let i=0,k=0;i<nb;i++){const dl=sl-el+(i<ns?0:1),d=data.slice(k,k+dl);k+=dl;const e=remainder(d,dv);if(i<ns)d.push(0);blocks.push(d.concat(e))}
 const cw=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==sl-el||j>=ns)cw.push(b[i])});
 const size=ver*4+17,M=Array.from({length:size},()=>new Array(size).fill(false)),F=Array.from({length:size},()=>new Array(size).fill(false));
 const setF=(x,y,d)=>{M[y][x]=d;F[y][x]=true};
 for(let i=0;i<size;i++){setF(6,i,i%2===0);setF(i,6,i%2===0)}
 const finder=(x,y)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)setF(xx,yy,d!==2&&d!==4)}};
 finder(3,3);finder(size-4,3);finder(3,size-4);
 let pos=[];if(ver>1){const n=Math.floor(ver/7)+2,step=Math.ceil((ver*4+4)/(n*2-2))*2;pos=[6];for(let p=size-7;pos.length<n;p-=step)pos.splice(1,0,p)}
 pos.forEach((px,i)=>pos.forEach((py,j)=>{if((i===0&&j===0)||(i===0&&j===pos.length-1)||(i===pos.length-1&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setF(px+dx,py+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}));
 const fmt=mask=>{const d=(0<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((d<<10)|r)^0x5412;
  for(let i=0;i<=5;i++)setF(8,i,bit(b,i));setF(8,7,bit(b,6));setF(8,8,bit(b,7));setF(7,8,bit(b,8));for(let i=9;i<15;i++)setF(14-i,8,bit(b,i));
  for(let i=0;i<8;i++)setF(size-1-i,8,bit(b,i));for(let i=8;i<15;i++)setF(8,size-15+i,bit(b,i));setF(8,size-8,true)};
 fmt(0);
 if(ver>=7){let r=ver;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=(ver<<12)|r;for(let i=0;i<18;i++){const v=bit(b,i),a=size-11+i%3,c=Math.floor(i/3);setF(a,c,v);setF(c,a,v)}}
 let i=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,y=(((right+1)&2)===0)?size-1-vert:vert;if(!F[y][x]&&i<cw.length*8){M[y][x]=bit(cw[i>>>3],7-(i&7));i++}}}
 const mk=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
 const apply=m=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!F[y][x]&&mk[m](x,y))M[y][x]=!M[y][x]};
 const penalty=()=>{let p=0;for(let a=0;a<size;a++){for(const get of[(k)=>M[a][k],(k)=>M[k][a]]){let run=1;for(let k=1;k<size;k++){if(get(k)===get(k-1)){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}}}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++)if(M[y][x]===M[y][x+1]&&M[y][x]===M[y+1][x]&&M[y][x]===M[y+1][x+1])p+=3;
  let dark=0;M.forEach(r=>r.forEach(v=>{if(v)dark++}));p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return p};
 let best=0,bp=1e9;for(let m=0;m<8;m++){apply(m);fmt(m);const p=penalty();if(p<bp){bp=p;best=m}apply(m)}
 apply(best);fmt(best);return M}
function draw(canvas,text,px){const m=make(text);if(!m)return false;const q=4,n=m.length+2*q,s=Math.max(2,Math.floor(px/n)),w=n*s;canvas.width=canvas.height=w;const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,w);g.fillStyle='#2a1659';
 m.forEach((r,y)=>r.forEach((v,x)=>{if(v)g.fillRect((x+q)*s,(y+q)*s,s,s)}));return true}
window.PRqr={make,draw};
})();

