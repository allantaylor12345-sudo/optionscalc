/* Stock calculators: DRIP / dividend, yield on cost, FIRE. Runs in the browser. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const num=id=>{const v=parseFloat($(id).value);return isFinite(v)?v:NaN;};
const usd=(v,d)=>(v<0?"-$":"$")+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:d??0,maximumFractionDigits:d??0});
const pct=(v,d)=>(v*100).toFixed(d??2)+"%";
if($("yr"))$("yr").textContent=new Date().getFullYear();

/* ---------- tiny line chart ---------- */
function chart(canvas,xs,series,hline){
 const dpr=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;if(!w)return;
 canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const P={l:70,r:12,t:12,b:28};let mx=0;series.forEach(s=>s.data.forEach(v=>{if(v>mx)mx=v;}));if(hline&&hline.v>mx)mx=hline.v;mx=mx*1.08||1;
 const X=i=>P.l+i/(xs.length-1||1)*(w-P.l-P.r),Y=v=>P.t+(1-v/mx)*(h-P.t-P.b);
 const raw=mx/5,mag=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/mag,st=(f<1.5?1:f<3.5?2:f<7.5?5:10)*mag;
 c.font="11px system-ui,sans-serif";c.strokeStyle="#eef1f4";c.fillStyle="#5b6876";
 for(let v=0;v<=mx;v+=st){const y=Math.round(Y(v))+.5;c.beginPath();c.moveTo(P.l,y);c.lineTo(w-P.r,y);c.stroke();c.textAlign="right";
  c.fillText(v>=1e6?"$"+(v/1e6).toFixed(v%1e6?1:0)+"M":v>=1e3?"$"+(v/1e3).toFixed(0)+"k":"$"+v,P.l-6,y+4);}
 const every=Math.max(1,Math.ceil(xs.length/Math.max(3,Math.floor(w/70))));
 xs.forEach((x,i)=>{if(i%every===0||i===xs.length-1){c.textAlign="center";c.fillText(x,X(i),h-P.b+16);}});
 if(hline){c.setLineDash([5,4]);c.strokeStyle="#d93025";c.beginPath();c.moveTo(P.l,Y(hline.v));c.lineTo(w-P.r,Y(hline.v));c.stroke();c.setLineDash([]);
  c.fillStyle="#d93025";c.textAlign="left";c.fillText(hline.label,P.l+4,Y(hline.v)-5);}
 series.forEach(s=>{c.strokeStyle=s.color;c.lineWidth=2.2;c.setLineDash(s.dash||[]);c.beginPath();s.data.forEach((v,i)=>i?c.lineTo(X(i),Y(v)):c.moveTo(X(i),Y(v)));c.stroke();c.setLineDash([]);c.lineWidth=1;});
}
function bind(ids,fn){ids.forEach(i=>{const e=$(i);if(e)e.addEventListener("input",fn);});fn();window.addEventListener("resize",fn);}

/* ---------- 1. Dividend / DRIP calculator ---------- */
if($("dInit")){
 const ids=["dInit","dMonthly","dPrice","dYield","dDivG","dPriceG","dYears","dTax","dFreq","dDrip"];
 function run(){
  const init=num("dInit"),mon=num("dMonthly"),p0=num("dPrice"),y=num("dYield")/100,dg=num("dDivG")/100,pg=num("dPriceG")/100,yrs=Math.min(60,Math.max(1,Math.round(num("dYears")))),tax=num("dTax")/100,freq=+$("dFreq").value,drip=$("dDrip").checked;
  if([init,mon,p0,y,dg,pg,tax].some(v=>!isFinite(v))||p0<=0)return;
  let price=p0,D=p0*y,shares=init/p0,cash=0,contrib=init,totalNet=0;const rows=[],xs=["0"],val=[init],inv=[init];
  const pm=Math.pow(1+pg,1/12),payEvery=12/freq;
  for(let yr=1;yr<=yrs;yr++){
   let yrGross=0;
   for(let m=1;m<=12;m++){
    price*=pm;
    if(mon>0){shares+=mon/price;contrib+=mon;}
    if(m%payEvery===0){const g=shares*D/freq,n=g*(1-tax);yrGross+=g;totalNet+=n;if(drip)shares+=n/price;else cash+=n;}
   }
   const value=shares*price+cash;
   rows.push([yr,contrib,value,yrGross,yrGross*(1-tax),yrGross/contrib,shares]);xs.push(String(yr));val.push(value);inv.push(contrib);
   D*=1+dg;
  }
  const L=rows[rows.length-1];
  $("dOutValue").textContent=usd(L[2]);$("dOutContrib").textContent=usd(L[1]);
  $("dOutIncome").textContent=usd(L[4])+"/yr";$("dOutMonthly").textContent=usd(L[4]/12)+"/mo";
  $("dOutYoc").textContent=pct(L[5]);$("dOutDivs").textContent=usd(totalNet);
  $("dRows").innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${usd(r[1])}</td><td>${usd(r[2])}</td><td>${usd(r[3])}</td><td>${usd(r[4])}</td><td>${pct(r[5])}</td><td>${r[6].toFixed(1)}</td></tr>`).join("");
  chart($("dChart"),xs,[{data:val,color:"#2563eb"},{data:inv,color:"#9aa5b1",dash:[5,4]}]);
 }
 bind(ids,run);
}

/* ---------- 2. Average cost & yield on cost ---------- */
if($("yRows")){
 const tb=$("yRows");
 function addRow(sh,pr){if(tb.children.length>=12)return;const tr=document.createElement("tr");
  tr.innerHTML=`<td><input type="number" step="1" min="0" value="${sh}"></td><td><input type="number" step="0.01" min="0" value="${pr}"></td><td><button class="x" aria-label="Remove">×</button></td>`;
  tr.querySelectorAll("input").forEach(i=>i.addEventListener("input",run));tr.querySelector(".x").addEventListener("click",()=>{tr.remove();run();});tb.appendChild(tr);}
 function run(){
  let sh=0,cost=0;[...tb.children].forEach(tr=>{const v=[...tr.querySelectorAll("input")].map(i=>parseFloat(i.value));if(v[0]>0&&v[1]>=0){sh+=v[0];cost+=v[0]*v[1];}});
  const avg=sh?cost/sh:0,div=num("yDiv"),px=num("yPx");
  $("yAvg").textContent=sh?"$"+avg.toFixed(2):"–";$("yShares").textContent=sh.toLocaleString("en-US");$("yCost").textContent=usd(cost,2);
  if(!sh||!isFinite(div)||!isFinite(px)){["yYoc","yCur","yInc","yGain"].forEach(i=>$(i).textContent="–");return;}
  $("yYoc").textContent=pct(div/avg);$("yCur").textContent=pct(div/px);
  $("yInc").textContent=usd(div*sh,2)+"/yr · "+usd(div*sh/12,2)+"/mo";
  const g=(px-avg)*sh;$("yGain").textContent=usd(g,2)+" ("+(g>=0?"+":"")+pct(px/avg-1,1)+")";$("yGain").className="v "+(g>=0?"pos":"neg");
 }
 $("yAdd").addEventListener("click",()=>{addRow(10,"");});
 addRow(50,40);addRow(30,35);addRow(20,45);
 bind(["yDiv","yPx"],run);
}

/* ---------- 3. FIRE calculator ---------- */
if($("fExp")){
 const ids=["fExp","fNow","fSave","fRet","fWr","fAge","fTarget"];
 function run(){
  const exp=num("fExp"),now=num("fNow"),save=num("fSave"),r=num("fRet")/100,wr=num("fWr")/100,age=num("fAge"),tgt=num("fTarget");
  if([exp,now,save,r,wr].some(v=>!isFinite(v))||wr<=0)return;
  const target=exp/wr,rm=Math.pow(1+r,1/12)-1;
  let v=now,months=0;const xs=[isFinite(age)?String(age):"0"],val=[now];
  while(v<target&&months<1200){v=v*(1+rm)+save;months++;if(months%12===0){xs.push(isFinite(age)?String(age+months/12):String(months/12));val.push(v);}}
  let mm=months,vv=v;while(mm%12!==0){vv=vv*(1+rm)+save;mm++;}if(mm!==months){xs.push(isFinite(age)?String(age+mm/12):String(mm/12));val.push(vv);}
  for(let k=1;k<=5;k++){for(let j=0;j<12;j++)vv=vv*(1+rm)+save;xs.push(isFinite(age)?String(age+mm/12+k):String(mm/12+k));val.push(vv);}
  const yrs=months/12;
  $("fNum").textContent=usd(target);
  $("fYears").textContent=months>=1200?"100+ years":(yrs<1?Math.ceil(months)+" months":yrs.toFixed(1)+" years");
  $("fAgeOut").textContent=isFinite(age)&&months<1200?"at age "+(age+yrs).toFixed(0):"";
  $("fProg").textContent=pct(Math.min(1,now/target),1);
  $("fIncome").textContent=usd(target*wr)+"/yr · "+usd(target*wr/12)+"/mo";
  if(isFinite(age)&&isFinite(tgt)&&tgt>age){const coast=target/Math.pow(1+r,tgt-age);$("fCoast").textContent=usd(coast);$("fCoastNote").textContent=now>=coast?"You've reached Coast FIRE: with no more savings you'd hit your number by "+tgt+".":"You need "+usd(coast-now)+" more invested to stop saving and still reach FIRE by "+tgt+".";}
  else{$("fCoast").textContent="–";$("fCoastNote").textContent="Enter your age and target age to see your Coast FIRE number.";}
  chart($("fChart"),xs,[{data:val,color:"#2563eb"}],{v:target,label:"FIRE number "+usd(target)});
 }
 bind(ids,run);
}
})();
