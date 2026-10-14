(() => {
  'use strict';
  const root = document.documentElement;
  const body = document.body;
  const reducePref = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');
  const canvas = document.getElementById('emberCanvas');
  const progress = document.getElementById('readingProgress');
  const hero = document.querySelector('.hero');
  const portal = document.querySelector('.portal-section');
  const buttons = [...document.querySelectorAll('.session-card')];
  const qtyOutput = document.getElementById('qtyOutput');
  const foodOutput = document.getElementById('foodOutput');
  const priceOutput = document.getElementById('priceOutput');
  let motionOff = reducePref.matches;
  let qty = 1;
  let chosen = null;
  let px = 0, py = 0;
  let ticking = false;
  let ctx = null, embers = [], raf = null;
  let vw = 0, vh = 0, dpr = 1;

  function isStill(){ return motionOff || reducePref.matches; }
  function resetDepth(){ root.style.setProperty('--heart-x','0px');root.style.setProperty('--heart-y','0px');root.style.setProperty('--heart-r','0deg');root.style.setProperty('--cel-x','0px');root.style.setProperty('--inf-x','0px');root.style.setProperty('--cel-r','0deg');root.style.setProperty('--inf-r','0deg');root.style.setProperty('--fig-y','0px'); }
  function renderMotion(){ body.classList.toggle('motion-off',motionOff);toggle.setAttribute('aria-pressed',String(motionOff));toggle.textContent=motionOff?'Ativar movimento':'Reduzir movimento';if(isStill()){resetDepth();stopEmbers();}else{startEmbers();} }
  toggle.addEventListener('click',()=>{motionOff=!motionOff;renderMotion();});
  reducePref.addEventListener?.('change',()=>{motionOff=reducePref.matches;renderMotion();});

  function pointer(ev){if(isStill()||ev.pointerType==='touch')return;px=ev.clientX/window.innerWidth-.5;py=ev.clientY/window.innerHeight-.5;paintDepth();}
  window.addEventListener('pointermove',pointer,{passive:true});
  function paintDepth(){if(ticking||isStill())return;ticking=true;requestAnimationFrame(()=>{ticking=false;const heartVisible=hero.getBoundingClientRect().bottom>0;const portalRect=portal.getBoundingClientRect();const portalVisible=portalRect.top<window.innerHeight && portalRect.bottom>0;if(heartVisible){root.style.setProperty('--heart-x',(px*20).toFixed(1)+'px');root.style.setProperty('--heart-y',(py*12).toFixed(1)+'px');root.style.setProperty('--heart-r',(px*-2.5).toFixed(2)+'deg');}if(portalVisible){root.style.setProperty('--cel-x',(px*-13).toFixed(1)+'px');root.style.setProperty('--inf-x',(px*13).toFixed(1)+'px');root.style.setProperty('--cel-r',(px*.9).toFixed(2)+'deg');root.style.setProperty('--inf-r',(px*-.9).toFixed(2)+'deg');}});}
  function onScroll(){const m=document.documentElement;const d=Math.max(1,m.scrollHeight-innerHeight);progress.style.width=(100*scrollY/d).toFixed(2)+'%';if(!isStill()){const rect=portal.getBoundingClientRect();if(rect.top<innerHeight&&rect.bottom>0){root.style.setProperty('--fig-y',(Math.max(-24,Math.min(24,-rect.top*.025))).toFixed(1)+'px');}}}
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll,{passive:true});onScroll();
  if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.13});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));}else{document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible'));}

  function choose(btn){chosen={date:btn.dataset.date,time:btn.dataset.time};buttons.forEach(b=>{const sel=b===btn;b.setAttribute('aria-pressed',String(sel));b.querySelector('.session-check').innerHTML=sel?'Selecionada <span aria-hidden="true">✓</span>':'Selecionar <span aria-hidden="true">○</span>';});document.getElementById('selectionFeedback').textContent=`Sessão ${chosen.date}/2026 · portões às ${chosen.time}`;document.getElementById('chosenSession').textContent=`${chosen.date}/2026 · ${chosen.time} (portões)`;const next=document.getElementById('continueSession');next.classList.remove('disabled');next.removeAttribute('aria-disabled');next.removeAttribute('tabindex');}
  buttons.forEach(btn=>btn.addEventListener('click',()=>choose(btn)));
  function updateQty(){qtyOutput.textContent=String(qty);foodOutput.textContent=qty+' kg';priceOutput.textContent=(qty*15).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});document.getElementById('minusQty').disabled=qty<=1;document.getElementById('plusQty').disabled=qty>=6;}
  document.getElementById('minusQty').addEventListener('click',()=>{qty=Math.max(1,qty-1);updateQty()});document.getElementById('plusQty').addEventListener('click',()=>{qty=Math.min(6,qty+1);updateQty()});updateQty();

  // Decorative particle canvas only: no tracking, network or external libraries.
  function resize(){vw=window.innerWidth;vh=window.innerHeight;dpr=Math.min(window.devicePixelRatio||1,1.5);canvas.width=Math.floor(vw*dpr);canvas.height=Math.floor(vh*dpr);canvas.style.width=vw+'px';canvas.style.height=vh+'px';ctx=canvas.getContext('2d');if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(52,Math.max(13,Math.round(vw/36)));embers=Array.from({length:count},(_,i)=>spawn(true));}
  function spawn(scatter=false){return{x:Math.random()*Math.max(1,vw),y:scatter?Math.random()*Math.max(1,vh):vh+5,speed:.3+Math.random()*.8,r:Math.random()*1.7+.35,life:Math.random()*Math.PI*2,drift:Math.random()*1.4-.7};}
  function frame(){if(isStill()||document.hidden){raf=null;return;}if(ctx){ctx.clearRect(0,0,vw,vh);for(let i=0;i<embers.length;i++){const p=embers[i];p.y-=p.speed;p.x+=p.drift*.17+Math.sin(p.life)*.22;p.life+=.016;if(p.y<-9||p.x<0||p.x>vw){embers[i]=spawn();continue;}const o=.17+.55*Math.max(0,Math.sin(p.life)*.5+.5);ctx.beginPath();ctx.fillStyle=`rgba(255,${100+Math.round(o*90)},${40+Math.round(o*20)},${o.toFixed(2)})`;ctx.shadowColor='#f04420';ctx.shadowBlur=12;ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;}raf=requestAnimationFrame(frame);}
  function stopEmbers(){if(raf!==null){cancelAnimationFrame(raf);raf=null;}if(ctx)ctx.clearRect(0,0,vw,vh);}
  function startEmbers(){if(isStill()||document.hidden)return;if(!ctx)resize();if(raf===null)raf=requestAnimationFrame(frame);}
  window.addEventListener('resize',()=>{if(!isStill())resize()},{passive:true});
  document.addEventListener('visibilitychange',()=>{document.hidden?stopEmbers():startEmbers()});
  renderMotion();
})();