(function(){
"use strict";
const $=id=>document.getElementById(id);
if(!$("strat"))return;
const DESC={
 covered_call:"Own 100 shares and sell 1 call against them. You collect premium now; your upside is capped at the strike.",
 csp:"Sell a put and keep cash to buy 100 shares at the strike. You collect premium and get assigned if the stock falls below the strike.",
 long_call:"Buy a call. Risk is limited to the premium paid; upside is unlimited.",
 long_put:"Buy a put. Profits when the stock falls; risk is limited to the premium paid.",
 bull_call:"Buy a call and sell a higher-strike call. A cheaper bullish bet with capped profit.",
 bear_put:"Buy a put and sell a lower-strike put. A cheaper bearish bet with capped profit.",
 iron_condor:"Sell an out-of-the-money put spread and call spread. Profits if the stock stays inside a range.",
 collar:"Own shares, buy a protective put and sell a call to help pay for it. Limits both loss and gain.",
 long_straddle:"Buy a call and a put at the same strike. Profits from a large move in either direction.",
 custom:"Build any combination of stock and option legs (up to 8)."
};
let st={strat:document.body.dataset.strategy||"covered_call",S:100,iv:30,days:30,r:4.5,q:0,n:1,at:0,legs:[]};

/* ---------- math ---------- */
function ncdf(x){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989422804014327*Math.exp(-x*x/2);
 const p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>0?1-p:p;}
function npdf(x){return 0.3989422804014327*Math.exp(-x*x/2);}
function bs(type,S,K,T,r,q,v){
 if(T<=0||v<=0||S<=0||K<=0){const c=type==="call";return{price:c?Math.max(S-K,0):Math.max(K-S,0),delta:c?(S>K?1:0):(S<K?-1:0),gamma:0,theta:0,vega:0};}
 const sq=Math.sqrt(T),d1=(Math.log(S/K)+(r-q+v*v/2)*T)/(v*sq),d2=d1-v*sq,eq=Math.exp(-q*T),er=Math.exp(-r*T);
 const g=eq*npdf(d1)/(S*v*sq),vega=S*eq*npdf(d1)*sq/100,dec=-S*eq*npdf(d1)*v/(2*sq);
 if(type==="call")return{price:S*eq*ncdf(d1)-K*er*ncdf(d2),delta:eq*ncdf(d1),gamma:g,theta:(dec-r*K*er*ncdf(d2)+q*S*eq*ncdf(d1))/365,vega};
 return{price:K*er*ncdf(-d2)-S*eq*ncdf(-d1),delta:eq*(ncdf(d1)-1),gamma:g,theta:(dec+r*K*er*ncdf(-d2)-q*S*eq*ncdf(-d1))/365,vega};
}
const sgn=l=>l.pos==="long"?1:-1;
const mult=l=>l.kind==="stock"?l.qty:l.qty*100;
function plExp(x){let p=0;for(const l of st.legs){
 if(l.kind==="stock")p+=sgn(l)*(x-l.strike)*l.qty;
 else{const iv=l.kind==="call"?Math.max(x-l.strike,0):Math.max(l.strike-x,0);p+=sgn(l)*(iv-l.price)*l.qty*100;}}return p;}
function plAt(x,daysLeft){const T=Math.max(daysLeft,0)/365,r=st.r/100,q=st.q/100,v=st.iv/100;let p=0;
 for(const l of st.legs){if(l.kind==="stock")p+=sgn(l)*(x-l.strike)*l.qty;
  else p+=sgn(l)*(bs(l.kind,x,l.strike,T,r,q,v).price-l.price)*l.qty*100;}return p;}

/* ---------- presets ---------- */
function step(S){return S<10?0.5:S<50?1:S<200?5:10;}
function rk(x){const s=step(st.S);return Math.max(s,Math.round(x/s)*s);}
function leg(kind,pos,qty,strike){return{kind,pos,qty,strike:+strike.toFixed(2),price:0,auto:true};}
function preset(name){const S=st.S,n=st.n;
 const m={covered_call:[leg("stock","long",100*n,S),leg("call","short",n,rk(S*1.05))],
 csp:[leg("put","short",n,rk(S*0.95))],
 long_call:[leg("call","long",n,rk(S))],
 long_put:[leg("put","long",n,rk(S))],
 bull_call:[leg("call","long",n,rk(S)),leg("call","short",n,rk(S*1.05))],
 bear_put:[leg("put","long",n,rk(S)),leg("put","short",n,rk(S*0.95))],
 iron_condor:[leg("put","long",n,rk(S*0.9)),leg("put","short",n,rk(S*0.95)),leg("call","short",n,rk(S*1.05)),leg("call","long",n,rk(S*1.1))],
 collar:[leg("stock","long",100*n,S),leg("put","long",n,rk(S*0.95)),leg("call","short",n,rk(S*1.05))],
 long_straddle:[leg("call","long",n,rk(S)),leg("put","long",n,rk(S))]};
 return m[name]||st.legs;}

/* ---------- legs UI ---------- */
function renderLegs(){const tb=$("legs");tb.innerHTML="";
 st.legs.forEach((l,i)=>{const tr=document.createElement("tr");
  tr.innerHTML=`<td><select data-f="kind"><option value="call">Call</option><option value="put">Put</option><option value="stock">Stock</option></select></td>
  <td><select data-f="pos"><option value="long">Buy</option><option value="short">Sell</option></select></td>
  <td><input data-f="qty" type="number" min="1" step="1"></td>
  <td><input data-f="strike" type="number" min="0.01" step="0.5"></td>
  <td><input data-f="price" type="number" min="0" step="0.01"></td>
  <td><button class="x" title="Remove leg" aria-label="Remove leg">×</button></td>`;
  tr.querySelector('[data-f=kind]').value=l.kind;tr.querySelector('[data-f=pos]').value=l.pos;
  tr.querySelector('[data-f=qty]').value=l.qty;tr.querySelector('[data-f=strike]').value=l.strike;
  const pr=tr.querySelector('[data-f=price]');pr.value=l.price.toFixed(2);pr.classList.toggle("manual",!l.auto);if(l.kind==="stock"){pr.type="text";pr.disabled=true;pr.value="–";}
  tr.querySelectorAll("select").forEach(s=>s.addEventListener("change",()=>{l[s.dataset.f]=s.value;if(s.dataset.f==="kind")l.auto=true;toCustom();renderLegs();update();}));
  tr.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>{const v=parseFloat(inp.value);if(!isFinite(v))return;
   const f=inp.dataset.f;l[f]=f==="qty"?Math.max(1,Math.round(v)):v;
   if(f==="price"){l.auto=false;inp.classList.add("manual");}
   if(f!=="price")toCustomIfStructural(f);update();}));
  tr.querySelector(".x").addEventListener("click",()=>{st.legs.splice(i,1);toCustom();renderLegs();update();});
  tb.appendChild(tr);});
 $("addLeg").disabled=st.legs.length>=8;}
function toCustom(){if(st.strat!=="custom"){st.strat="custom";$("strat").value="custom";$("desc").textContent=DESC.custom;}}
function toCustomIfStructural(f){if(f==="qty")toCustom();}

/* ---------- main update ---------- */
function readInputs(){const g=(id,d,min)=>{const v=parseFloat($(id).value);return isFinite(v)?Math.max(v,min):d;};
 st.S=g("S",st.S,0.01);st.iv=g("iv",st.iv,0.1);st.days=Math.round(g("days",st.days,0));st.r=g("r",st.r,-5);st.q=g("q",st.q,0);st.n=Math.round(g("n",st.n,1));}
function reprice(){const T=st.days/365,r=st.r/100,q=st.q/100,v=st.iv/100;
 st.legs.forEach(l=>{if(!l.auto)return;l.price=l.kind==="stock"?0:Math.max(0.01,+bs(l.kind,st.S,l.strike,T,r,q,v).price.toFixed(2));});
 const rows=$("legs").children;st.legs.forEach((l,i)=>{if(!rows[i])return;const p=rows[i].querySelector('[data-f=price]');if(l.auto&&l.kind!=="stock"&&document.activeElement!==p)p.value=l.price.toFixed(2);});}

function fmt(v,dec){if(!isFinite(v))return v>0?"Unlimited":"Unlimited";const a=Math.abs(v);
 const s=a.toLocaleString("en-US",{minimumFractionDigits:dec??(a>=1000?0:2),maximumFractionDigits:dec??(a>=1000?0:2)});return(v<0?"-$":"$")+s;}
const pct=v=>(v*100).toFixed(2)+"%";

function analyze(){const ks=[0,st.S];st.legs.forEach(l=>ks.push(l.strike));
 const far=Math.max(...ks)*10+100;ks.push(far);const pts=[...new Set(ks)].sort((a,b)=>a-b),vals=pts.map(plExp);
 const slope=plExp(far*2)-plExp(far);
 const maxP=slope>1e-9?Infinity:Math.max(...vals),maxL=slope<-1e-9?-Infinity:Math.min(...vals);
 const be=[];for(let i=0;i<pts.length-1;i++){const a=vals[i],b=vals[i+1];
  if(Math.abs(a)<1e-9&&i>0)be.push(pts[i]);else if(a*b<0)be.push(pts[i]+(pts[i+1]-pts[i])*(-a)/(b-a));}
 return{maxP,maxL,be:[...new Set(be.map(x=>+x.toFixed(2)))]};}

function probProfit(){const T=st.days/365;if(T<=0)return plExp(st.S)>0?1:0;
 const v=st.iv/100,m=Math.log(st.S)+(st.r/100-st.q/100-v*v/2)*T,sd=v*Math.sqrt(T),lo=Math.exp(m-6*sd),hi=Math.exp(m+6*sd),N=2000,ratio=hi/lo;
 let p=0,prev=ncdf(-6);for(let i=1;i<=N;i++){const a=lo*Math.pow(ratio,(i-1)/N),b=lo*Math.pow(ratio,i/N),c=ncdf((Math.log(b)-m)/sd);
  if(plExp(Math.sqrt(a*b))>0)p+=c-prev;prev=c;}return Math.min(1,Math.max(0,p));}

function greeks(){const T=st.days/365,r=st.r/100,q=st.q/100,v=st.iv/100;let D=0,G=0,Th=0,V=0;
 st.legs.forEach(l=>{if(l.kind==="stock"){D+=sgn(l)*l.qty;return;}const g=bs(l.kind,st.S,l.strike,T,r,q,v),k=sgn(l)*l.qty*100;
  D+=k*g.delta;G+=k*g.gamma;Th+=k*g.theta;V+=k*g.vega;});return{D,G,Th,V};}

function update(){readInputs();reprice();
 const at=$("at");at.max=st.days;if(st.at>st.days)st.at=st.days;at.value=st.at;
 $("atLbl").textContent=st.at===0?"Today":(st.at>=st.days?"Expiration":"In "+st.at+" day"+(st.at>1?"s":""));
 let net=0;st.legs.forEach(l=>{if(l.kind!=="stock")net+=-sgn(l)*l.price*l.qty*100;});
 $("netK").textContent=net>=0?"Net credit":"Net debit";$("net").textContent=fmt(Math.abs(net));$("net").className="v "+(net>=0?"pos":"neg");
 const a=analyze();$("maxP").textContent=a.maxP<=0?fmt(a.maxP):fmt(a.maxP);$("maxL").textContent=a.maxL>=0?fmt(a.maxL):fmt(a.maxL);
 $("be").textContent=a.be.length?a.be.map(x=>"$"+x.toFixed(2)).join("  ·  "):"None";
 const p=probProfit();$("pop").textContent=st.legs.length?(p*100).toFixed(1)+"%":"–";
 extras(a,net);
 const g=greeks();$("gD").textContent=g.D.toFixed(1);$("gG").textContent=g.G.toFixed(2);
 $("gT").textContent=fmt(g.Th);$("gT").className="v "+(g.Th>=0?"pos":"neg");$("gV").textContent=fmt(g.V);
 draw();table();ruler();saveHash();}

function extras(a,net){const ann=x=>st.days>0?" ("+pct(x*365/st.days)+" /yr)":"";let k="Return on risk",v="–";
 const stock=st.legs.find(l=>l.kind==="stock"&&l.pos==="long"),call=st.legs.find(l=>l.kind==="call"&&l.pos==="short"),put=st.legs.find(l=>l.kind==="put"&&l.pos==="short");
 if(st.strat==="covered_call"&&stock&&call){const S0=stock.strike,prem=call.price,called=(prem+call.strike-S0)/S0,flat=prem/S0;
  k="If called · If unchanged · Downside cushion";v=pct(called)+ann(called)+"  ·  "+pct(flat)+"  ·  "+pct(prem/S0);}
 else if(st.strat==="csp"&&put){const ret=put.price/(put.strike-put.price);k="Return on cash · Effective buy price";
  v=pct(ret)+ann(ret)+"  ·  $"+(put.strike-put.price).toFixed(2);}
 else if(isFinite(a.maxP)&&isFinite(a.maxL)&&a.maxL<0){const rr=a.maxP/-a.maxL;v=pct(rr);}
 $("extraK").textContent=k;$("extra").textContent=v;}


/* ---------- strike ruler (covered call / CSP) ---------- */
function ruler(){
 let box=$("ruler");
 if(!box){box=document.createElement("div");box.id="ruler";box.style.margin="0 0 12px";$("maxP").closest(".stats").after(box);}
 const call=st.legs.find(l=>l.kind==="call"&&l.pos==="short"),put=st.legs.find(l=>l.kind==="put"&&l.pos==="short");
 let leg=null,type=null;
 if(st.strat==="covered_call"&&call){leg=call;type="call";}else if(st.strat==="csp"&&put){leg=put;type="put";}
 if(!leg||!(leg.strike>0)){box.style.display="none";return;}
 box.style.display="block";
 const k=leg.strike,sp=st.S,W=420,d=(sp/k-1)*100,R=Math.max(4,Math.ceil(Math.abs(d)/2)*2+2);
 const x=p=>14+(p/k-1+R/100)/(2*R/100)*(W-28),xs=x(k),xp=Math.min(Math.max(x(sp),14),W-14);
 const itm=type==="call"?sp>k:sp<k,cor=itm?"#d93025":"#0f9d58",anc=xp<70?"start":(xp>W-70?"end":"middle");
 const G="rgba(15,157,88,.16)",Rd="rgba(217,48,37,.14)",left=type==="call"?G:Rd,right=type==="call"?Rd:G;
 let t="";for(const f of[-R,-R/2,R/2,R]){const xx=x(k*(1+f/100));t+=`<line x1="${xx.toFixed(1)}" y1="40" x2="${xx.toFixed(1)}" y2="43" stroke="#9aa5b1"/><text x="${xx.toFixed(1)}" y="53" text-anchor="middle" font-size="9" fill="#5b6876">$${(k*(1+f/100)).toFixed(2)}</text>`;}
 const msg=type==="call"?(itm?`Stock is <b>${d.toFixed(1)}% above</b> the strike: likely to be called away at expiration.`:`Stock can rise <b>${(-d).toFixed(1)}%</b> before reaching the strike.`)
  :(itm?`Stock is <b>${(-d).toFixed(1)}% below</b> the strike: likely to be assigned at expiration.`:`Stock can fall <b>${d.toFixed(1)}%</b> before reaching the strike.`);
 const zl=type==="call"?"keep shares":"assigned",zr=type==="call"?"called away":"keep premium";
 box.innerHTML=`<div style="font-size:12px;color:var(--mut);margin-bottom:2px">Stock price vs strike</div>
<svg viewBox="-18 0 ${W+36} 66" style="width:100%;height:auto;display:block" role="img" aria-label="Stock ${sp} versus strike ${k}">
<rect x="14" y="28" width="${(xs-14).toFixed(1)}" height="12" fill="${left}"/><rect x="${xs.toFixed(1)}" y="28" width="${(W-14-xs).toFixed(1)}" height="12" fill="${right}"/>
<text x="18" y="37" font-size="8.5" fill="#5b6876">${zl}</text><text x="${W-18}" y="37" font-size="8.5" fill="#5b6876" text-anchor="end">${zr}</text>${t}
<line x1="${xs.toFixed(1)}" y1="22" x2="${xs.toFixed(1)}" y2="44" stroke="#16202c" stroke-width="2"/><text x="${xs.toFixed(1)}" y="64" text-anchor="middle" font-size="10" font-weight="600" fill="#16202c">strike $${k.toFixed(2)}</text>
<line x1="${xp.toFixed(1)}" y1="13" x2="${xp.toFixed(1)}" y2="40" stroke="${cor}" stroke-width="1.3" stroke-dasharray="2 2"/><circle cx="${xp.toFixed(1)}" cy="34" r="5" fill="${cor}" stroke="#fff" stroke-width="2"/>
<text x="${xp.toFixed(1)}" y="9" text-anchor="${anc}" font-size="10.5" font-weight="700" fill="${cor}">stock $${sp.toFixed(2)}</text></svg>
<div style="font-size:13px;color:${cor}">${msg}</div>`;
}

/* ---------- chart ---------- */
let CH=null;
function range(){const v=st.iv/100,T=Math.max(st.days,1)/365,mv=Math.exp(2.6*v*Math.sqrt(T));
 const ks=st.legs.filter(l=>l.kind!=="stock").map(l=>l.strike);
 let lo=Math.min(st.S/mv,...ks.map(k=>k*0.92)),hi=Math.max(st.S*mv,...ks.map(k=>k*1.08));
 lo=Math.max(lo,0.01);if(hi-lo<st.S*0.1){lo=st.S*0.9;hi=st.S*1.1;}return[lo,hi];}
function ticks(a,b,n){const raw=(b-a)/n,mag=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/mag,s=(f<1.5?1:f<3.5?2:f<7.5?5:10)*mag,t=[];
 for(let x=Math.ceil(a/s)*s;x<=b+1e-9;x+=s)t.push(+x.toFixed(10));return t;}
function draw(hx){const c=$("chart"),dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(!w)return;
 c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const P={l:68,r:14,t:12,b:30},[lo,hi]=range(),N=320,xs=[],e=[],t=[],left=st.days-st.at;
 for(let i=0;i<N;i++){const x=lo+(hi-lo)*i/(N-1);xs.push(x);e.push(plExp(x));t.push(plAt(x,left));}
 let y0=Math.min(0,...e,...t),y1=Math.max(0,...e,...t);const sp=(y1-y0)||1;y0-=sp*.08;y1+=sp*.08;
 const X=x=>P.l+(x-lo)/(hi-lo)*(w-P.l-P.r),Y=y=>P.t+(y1-y)/(y1-y0)*(h-P.t-P.b);
 ctx.font="11px system-ui,sans-serif";ctx.fillStyle="#5b6876";ctx.strokeStyle="#eef1f4";ctx.lineWidth=1;
 ticks(y0,y1,6).forEach(v=>{const y=Math.round(Y(v))+.5;ctx.beginPath();ctx.moveTo(P.l,y);ctx.lineTo(w-P.r,y);ctx.stroke();ctx.textAlign="right";ctx.fillText(fmt(v,0),P.l-6,y+4);});
 ticks(lo,hi,Math.max(3,Math.floor(w/90))).forEach(v=>{const x=Math.round(X(v))+.5;ctx.beginPath();ctx.moveTo(x,P.t);ctx.lineTo(x,h-P.b);ctx.stroke();ctx.textAlign="center";ctx.fillText("$"+v,x,h-P.b+16);});
 const zy=Y(0);
 // fill
 const poly=()=>{ctx.beginPath();ctx.moveTo(X(xs[0]),zy);xs.forEach((x,i)=>ctx.lineTo(X(x),Y(e[i])));ctx.lineTo(X(xs[N-1]),zy);ctx.closePath();};
 ctx.save();ctx.beginPath();ctx.rect(P.l,P.t,w-P.l-P.r,zy-P.t);ctx.clip();poly();ctx.fillStyle="rgba(15,157,88,.13)";ctx.fill();ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(P.l,zy,w-P.l-P.r,h-P.b-zy);ctx.clip();poly();ctx.fillStyle="rgba(217,48,37,.12)";ctx.fill();ctx.restore();
 ctx.strokeStyle="#9aa5b1";ctx.beginPath();ctx.moveTo(P.l,zy);ctx.lineTo(w-P.r,zy);ctx.stroke();
 // current price
 const sx=X(st.S);ctx.setLineDash([3,3]);ctx.strokeStyle="#9aa5b1";ctx.beginPath();ctx.moveTo(sx,P.t);ctx.lineTo(sx,h-P.b);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle="#5b6876";ctx.textAlign="left";ctx.fillText("Now $"+st.S,Math.min(sx+4,w-70),P.t+11);
 // lines
 const line=(arr,col,dash)=>{ctx.setLineDash(dash);ctx.strokeStyle=col;ctx.lineWidth=2.2;ctx.beginPath();xs.forEach((x,i)=>i?ctx.lineTo(X(x),Y(arr[i])):ctx.moveTo(X(x),Y(arr[i])));ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;};
 if(left>0)line(t,"#8a6df1",[6,4]);line(e,"#2563eb",[]);
 analyze().be.forEach(b=>{if(b<lo||b>hi)return;ctx.fillStyle="#fff";ctx.strokeStyle="#16202c";ctx.beginPath();ctx.arc(X(b),zy,4,0,7);ctx.fill();ctx.stroke();});
 CH={X,Y,lo,hi,P,w,h};
 if(hx!=null){const px=Math.min(Math.max(hx,P.l),w-P.r),x=lo+(px-P.l)/(w-P.l-P.r)*(hi-lo);
  ctx.strokeStyle="#16202c55";ctx.beginPath();ctx.moveTo(px,P.t);ctx.lineTo(px,h-P.b);ctx.stroke();
  const pe=plExp(x),pt=plAt(x,left);ctx.fillStyle="#2563eb";ctx.beginPath();ctx.arc(px,Y(pe),4,0,7);ctx.fill();
  const tip=$("tip");tip.style.display="block";
  tip.innerHTML="Stock $"+x.toFixed(2)+" ("+((x/st.S-1)*100).toFixed(1)+"%)<br>Expiry: <b>"+fmt(pe)+"</b>"+(left>0?"<br>"+$("atLbl").textContent+": <b>"+fmt(pt)+"</b>":"");
  tip.style.left=Math.min(px+12,w-tip.offsetWidth-4)+"px";tip.style.top=Math.max(4,Y(pe)-50)+"px";}
 else $("tip").style.display="none";}

function table(){const left=st.days-st.at,moves=[-.2,-.15,-.1,-.05,0,.05,.1,.15,.2];
 $("plt").innerHTML=moves.map(m=>{const x=st.S*(1+m),pe=plExp(x),pt=plAt(x,left);
  return`<tr class="${m===0?"cur":""}"><td>$${x.toFixed(2)}</td><td>${m>0?"+":""}${(m*100).toFixed(0)}%</td><td class="${pe>=0?"pos":"neg"}">${fmt(pe)}</td><td class="${pt>=0?"pos":"neg"}">${fmt(pt)}</td></tr>`;}).join("");}

/* ---------- state in URL ---------- */
function saveHash(){try{const s={...st,legs:st.legs.map(l=>[l.kind[0],l.pos[0],l.qty,l.strike,l.auto?null:l.price])};
 history.replaceState(null,"","#"+encodeURIComponent(JSON.stringify(s)));}catch(e){}}
function loadHash(){try{if(location.hash.length<3)return false;const s=JSON.parse(decodeURIComponent(location.hash.slice(1)));
 const K={c:"call",p:"put",s:"stock"},Pp={l:"long",s:"short"};
 Object.assign(st,s,{legs:(s.legs||[]).slice(0,8).map(a=>({kind:K[a[0]]||"call",pos:Pp[a[1]]||"long",qty:+a[2]||1,strike:+a[3]||st.S,price:a[4]==null?0:+a[4],auto:a[4]==null}))});return true;}catch(e){return false;}}

/* ---------- wiring ---------- */
function setInputs(){["S","iv","days","r","q","n"].forEach(id=>$(id).value=st[id]);$("strat").value=st.strat;$("desc").textContent=DESC[st.strat]||"";}
$("strat").addEventListener("change",e=>{st.strat=e.target.value;$("desc").textContent=DESC[st.strat];readInputs();if(st.strat!=="custom")st.legs=preset(st.strat);renderLegs();update();});
["S","n"].forEach(id=>$(id).addEventListener("change",()=>{readInputs();if(st.strat!=="custom"){st.legs=preset(st.strat);renderLegs();}update();}));
["S","iv","days","r","q"].forEach(id=>$(id).addEventListener("input",update));
$("at").addEventListener("input",e=>{st.at=+e.target.value;update();});
$("addLeg").addEventListener("click",()=>{if(st.legs.length>=8)return;st.legs.push(leg("call","long",st.n,rk(st.S)));toCustom();renderLegs();update();});
$("resetP").addEventListener("click",()=>{st.legs.forEach(l=>{l.auto=true;if(l.kind==="stock")l.strike=st.S;});renderLegs();update();});
$("share").addEventListener("click",()=>{const u=location.href;(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).catch(()=>{}).finally(()=>{const t=$("toast");t.style.display="block";setTimeout(()=>t.style.display="none",1600);});});
const cv=$("chart");
cv.addEventListener("mousemove",e=>{const r=cv.getBoundingClientRect();draw(e.clientX-r.left);});
cv.addEventListener("mouseleave",()=>draw());
cv.addEventListener("touchmove",e=>{const r=cv.getBoundingClientRect();draw(e.touches[0].clientX-r.left);},{passive:true});
window.addEventListener("resize",()=>draw());
$("yr").textContent=new Date().getFullYear();

if(!loadHash())st.legs=preset(st.strat);
setInputs();renderLegs();update();
})();

/* ---------- Wheel strategy calculator ---------- */
(function(){
"use strict";
const $=id=>document.getElementById(id);
if(!$("wS"))return;
const ids=["wS","wKp","wPp","wKc","wPc","wD","wN"];
const pct=v=>(v*100).toFixed(2)+"%";
const usd=v=>(v<0?"-$":"$")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function calc(){
 const v={};ids.forEach(i=>{v[i]=parseFloat($(i).value);});
 if(ids.some(i=>!isFinite(v[i]))||v.wKp<=0||v.wD<=0)return;
 const n=Math.max(1,Math.round(v.wN)),sh=100*n,D=v.wD,cap=v.wKp*sh,ann=(r,d)=>pct(r*365/d);
 const aRet=v.wPp/v.wKp;
 const bProfit=(v.wPp+v.wPc+(v.wKc-v.wKp))*sh,bRet=bProfit/cap;
 const basis=v.wKp-v.wPp,basis2=basis-v.wPc;
 const rows=[
  ["1. Put expires worthless","Keep the put premium, repeat",usd(v.wPp*sh),pct(aRet),ann(aRet,D),D+" days"],
  ["2. Assigned → call sold → called away","Full wheel cycle",usd(bProfit),pct(bRet),ann(bRet,2*D),2*D+" days"],
  ["3. Assigned → call expires worthless","You keep the shares, sell another call",usd((v.wPp+v.wPc)*sh)+" premium",pct((v.wPp+v.wPc)/v.wKp),ann((v.wPp+v.wPc)/v.wKp,2*D),2*D+" days"]];
 $("wRows").innerHTML=rows.map(r=>`<tr><td><b>${r[0]}</b><br><span style="color:var(--mut);font-size:12px">${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join("");
 $("wCap").textContent=usd(cap);$("wBasis").textContent="$"+basis.toFixed(2);$("wBasis2").textContent="$"+basis2.toFixed(2);
 $("wBE").textContent="$"+basis.toFixed(2);
 $("wWarn").style.display=v.wKc<basis?"block":"none";
}
ids.forEach(i=>$(i).addEventListener("input",calc));calc();
})();


/* ---------- Roll calculator ---------- */
(function(){
"use strict";
const $=id=>document.getElementById(id);
if(!$("rS"))return;
const ids=["rS","rK1","rP0","rP1","rD1","rK2","rP2","rD2","rN"];
const pct=v=>(v*100).toFixed(2)+"%";
const usd=v=>(v<0?"-$":"$")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const cls=v=>v>=0?"pos":"neg";
function calc(){
 const v={};ids.forEach(i=>v[i]=parseFloat($(i).value));
 if(ids.some(i=>!isFinite(v[i]))||v.rS<=0||v.rP0<=0)return;
 const n=Math.max(1,Math.round(v.rN)),m=100*n,S=v.rS,d1=Math.max(1,v.rD1),d2=Math.max(1,v.rD2);
 const captured=(v.rP0-v.rP1)/v.rP0,intr=Math.max(0,S-v.rK1),extr=Math.max(0,v.rP1-intr);
 const net=v.rP2-v.rP1,dK=v.rK2-v.rK1;
 const retWorthless=net/S,retCalled=(net+Math.max(0,v.rK2-S))/S;
 const perDayOld=extr/d1,perDayNew=Math.max(0,v.rP2-Math.max(0,S-v.rK2))/d2;
 $("rCap").textContent=pct(captured);$("rCap").className="v "+cls(captured);
 $("rLock").textContent=usd((v.rP0-v.rP1)*m);$("rLock").className="v "+cls(v.rP0-v.rP1);
 $("rNet").textContent=(net>=0?"Credit ":"Debit ")+usd(Math.abs(net)*m);$("rNet").className="v "+cls(net);
 $("rDK").textContent=(dK>=0?"+":"-")+"$"+Math.abs(dK).toFixed(2)+" ("+(dK>=0?"+":"-")+usd(Math.abs(dK)*m)+" upside)";
 $("rLeft").textContent=usd(extr*m)+" time value";
 $("rRows").innerHTML=[
  ["Close now","Buy back the call; the shares keep any gain",usd((v.rP0-v.rP1)*m)+" on the call","–"],
  ["Hold to expiration",intr>0?"Shares called away at $"+v.rK1.toFixed(2)+"; you earn the remaining time value":"If the stock stays below $"+v.rK1.toFixed(2)+", the call expires and you keep the rest",usd(extr*m)+" more",pct(extr/S*365/d1)+" /yr"],
  ["Roll: new call expires worthless","Net "+(net>=0?"credit":"debit")+" kept",usd(net*m),pct(retWorthless*365/d2)+" /yr"],
  ["Roll: called away at new strike","Net "+(net>=0?"credit":"debit")+" + stock gain up to $"+v.rK2.toFixed(2),usd((net+Math.max(0,v.rK2-S))*m),pct(retCalled*365/d2)+" /yr"]
 ].map(r=>`<tr><td><b>${r[0]}</b><br><span style="color:var(--mut);font-size:12px">${r[1]}</span></td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("");
 const tips=[];
 if(captured>=0.5)tips.push(`You've captured <b>${pct(captured)}</b> of the original premium. Many traders close or roll once 50–80% is captured, because the remaining premium is small compared with the risk left.`);
 if(captured<0)tips.push(`The call now costs more than you sold it for. Rolling will not erase that loss; it only moves the position to a new strike or date.`);
 if(net<0)tips.push(`This roll is a <b>debit</b>: you pay to roll. That is usually only worth it if the higher strike adds more upside than the cost.`);
 tips.push(`Time value per day: current call <b>${usd(perDayOld*m)}</b>/day vs new call <b>${usd(perDayNew*m)}</b>/day.`+(Math.abs(perDayNew-perDayOld)*m<0.5?" About the same.":perDayNew>perDayOld?" The new call earns more per day.":" The current call still earns more per day."));
 if(intr>0)tips.push(`The current call is <b>in the money</b> by $${intr.toFixed(2)}. If it is American-style, early assignment becomes more likely as time value shrinks.`);
 $("rTips").innerHTML=tips.map(t=>`<li>${t}</li>`).join("");
}
ids.forEach(i=>$(i).addEventListener("input",calc));calc();
})();
