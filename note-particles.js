(() => {
  const fields=new WeakMap();
  window.colorAtParticle=(button,x,y)=>{
    const f=fields.get(button);if(!f)return '#b7c9c2';
    const rect=f.canvas.getBoundingClientRect();
    const px=(x-rect.left)/rect.width*440,py=(y-rect.top)/rect.height*440;
    let nearest=null,distance=Infinity;
    for(const p of f.points){const d=(p.x+165+p.dx*f.amount-px)**2+(p.y+165+p.dy*f.amount-py)**2;if(d<distance){nearest=p;distance=d;}}
    return nearest?.color||'#b7c9c2';
  };
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let lastScroll=-Infinity, strength=1, targetStrength=1, lastFrame=0,lastPaint=0,hasInteracted=false;
  window.scatterNotes=delta=>{
    if(reduced.matches)return;
    lastScroll=performance.now();
    hasInteracted=true;
    // Downward scrolling progressively releases the bitmap into a wide,
    // screen-filling field; upward scrolling gathers it into the silhouette.
    targetStrength=delta>0?2.35:0;
  };
  window.mountNoteParticles=(button,perfume)=>{
    const bitmapData=window.BITMAP_POINTS[perfume.id];
    if(!bitmapData)return;
    const coordinates=Array.isArray(bitmapData)?bitmapData:bitmapData.p;
    const colorIndexes=Array.isArray(bitmapData)?null:bitmapData.c;
    const palette=Array.isArray(bitmapData)?['#111']:bitmapData.k;
    const canvas=document.createElement('canvas');
    canvas.className='note-particles';canvas.width=880;canvas.height=880;
    canvas.setAttribute('aria-hidden','true');
    button.replaceChildren(canvas);
    const notes=perfume.notes.length?perfume.notes:['Unspecified note'];
    const points=coordinates.map((value,i)=>{
      const angle=i*2.399963, radius=34+(i*29%132);
      return {x:value%110,y:Math.floor(value/110),note:notes[i%notes.length],color:palette[colorIndexes?.[i]??0]||'#111',
        dx:Math.cos(angle)*radius,dy:Math.sin(angle)*radius,phase:i*.37};
    });
    const colorGroups=new Map();
    for(const point of points){if(!colorGroups.has(point.color))colorGroups.set(point.color,[]);colorGroups.get(point.color).push(point);}
    fields.set(button,{canvas,ctx:canvas.getContext('2d'),points,colorGroups,amount:1});
    button.addEventListener('pointermove',event=>{
      const box=canvas.getBoundingClientRect(),x=(event.clientX-box.left)/box.width*440,y=(event.clientY-box.top)/box.height*440;
      const field=fields.get(button);let nearest=null,distance=9;
      for(const p of points){const d=(p.x+p.dx*field.amount-x)**2+(p.y+p.dy*field.amount-y)**2;if(d<distance){nearest=p;distance=d;}}
      button.title=nearest?`${perfume.name} · ${nearest.note}`:perfume.name;
    });
  };
  window.drawNoteParticles=(buttons,time)=>{
    if(time-lastPaint<33)return;
    lastPaint=time;
    const dt=Math.min(50,time-lastFrame||16);lastFrame=time;
    const active=time-lastScroll<180;
    strength+=(targetStrength-strength)*(1-Math.exp(-dt/(active?150:420)));
    for(const button of buttons){
      const f=fields.get(button);if(!f)continue;
      const target=reduced.matches?0:targetStrength;
      const old=f.amount;f.amount+=(target-f.amount)*(1-Math.exp(-dt/(active?110:330)));
      if(f.drawn&&f.amount<.0005&&old<.0005)continue;
      f.drawn=true;const {ctx}=f;ctx.clearRect(0,0,880,880);
      const a=f.amount;
      for(const [color,group] of f.colorGroups){
        ctx.fillStyle=color;
        for(const p of group){
          const drift=Math.sin(time*.0015+p.phase)*4*a;
          ctx.fillRect((p.x+165+p.dx*a+drift)*2,(p.y+165+p.dy*a+Math.cos(time*.001+p.phase)*4*a)*2,1.6,1.6);
        }
      }
    }
  };
})();
