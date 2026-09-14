// Low-resolution, smoothly interpolated colour field. No grain/noise texture.
(() => {
  const host=document.querySelector('#atlas');
  const canvas=document.createElement('canvas');
  canvas.className='color-atmosphere';canvas.setAttribute('aria-hidden','true');
  host.prepend(canvas);
  const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let color=[210,222,219],target=color.slice(),origin=[.5,.5],active=false,last=0,frame=0;
  const resize=()=>{canvas.width=Math.min(1200,innerWidth);canvas.height=Math.round(canvas.width*innerHeight/innerWidth);};
  resize();window.addEventListener('resize',resize);
  const parse=value=>{const h=value.replace('#','');return h.length===6?[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)):[180,195,190];};
  function draw(time){
    frame=0;if(document.hidden)return;
    if(time-last<33){frame=requestAnimationFrame(draw);return;}last=time;
    color=color.map((v,i)=>v+(target[i]-v)*.055);
    const w=canvas.width,h=canvas.height,t=reduced.matches?0:time*.00012;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
    for(let i=0;i<3;i++){
      const x=w*(origin[0]+Math.sin(t+i*2.1)*.34),y=h*(origin[1]+Math.cos(t*.8+i*2.4)*.35);
      const g=ctx.createRadialGradient(x,y,0,x,y,Math.max(w,h)*(.76-i*.08));
      const rgb=color.map(v=>{const base=v+(255-v)*(i===0?.30:.20);return Math.round(base+(255-base)*(i*.18));});
      g.addColorStop(0,`rgba(${rgb.join(',')},.50)`);g.addColorStop(1,`rgba(${rgb.join(',')},0)`);
      ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
    if(active)frame=requestAnimationFrame(draw);
  }
  const sources=new Map();let request=0;
  async function sample(src,u,v,perfume){
    if(!sources.has(src))sources.set(src,(async()=>{
      const img=new Image();img.src=src;await img.decode();
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(img,0,0);
      return context.getImageData(0,0,c.width,c.height);
    })().catch(()=>null));
    const pixels=await sources.get(src);
    if(pixels){
      const {width:w,height:h,data}=pixels,x=Math.max(0,Math.min(w-1,Math.round(u*(w-1)))),y=Math.max(0,Math.min(h-1,Math.round(v*(h-1))));
      const at=(y*w+x)*4;if(data[at+3]>32)return Array.from(data.slice(at,at+3));
      // Transparent margins use the nearest visible image pixel.
      let best=Infinity,rgb=null;
      for(let py=0;py<h;py+=3)for(let px=0;px<w;px+=3){const i=(py*w+px)*4;if(data[i+3]<128)continue;const d=(px-x)**2+(py-y)**2;if(d<best){best=d;rgb=Array.from(data.slice(i,i+3));}}
      if(rgb)return rgb;
    }
    // file:// browsers can prohibit canvas reads; use source-derived coordinates.
    const b=window.BITMAP_POINTS?.[perfume?.id];if(b?.p?.length){let n=0,d=Infinity;b.p.forEach((p,i)=>{const next=(p%110-u*110)**2+(Math.floor(p/110)-v*110)**2;if(next<d){d=next;n=i;}});return parse(b.k[b.c?.[n]??0]);}
    return [190,205,200];
  }
  host.addEventListener('click',async event=>{
    const button=event.target.closest('.bottle'),image=event.target.closest('img');
    if((!button&&!image)||(button&&(didDrag||selected)))return;
    const perfume=button?perfumes.find(p=>p.id===button.dataset.perfumeId):perfumes.find(p=>image.getAttribute('src')===p.image);
    const src=button?perfume?.image:image.currentSrc||image.src;if(!src)return;
    const rect=(image||button).getBoundingClientRect(),x=event.detail?event.clientX:rect.x+rect.width/2,y=event.detail?event.clientY:rect.y+rect.height/2;
    let u=(x-rect.x)/rect.width,v=(y-rect.y)/rect.height;
    if(image&&image.naturalWidth){const scale=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;const left=getComputedStyle(image).objectPosition.startsWith('0%')?0:(rect.width-w)/2;u=(x-rect.x-left)/w;v=(y-rect.y-(rect.height-h)/2)/h;}
    const id=++request,rgb=await sample(src,u,v,perfume);if(id!==request)return;
    target=rgb;origin=[x/innerWidth,y/innerHeight];
    active=true;canvas.classList.add('is-active');if(!frame)frame=requestAnimationFrame(draw);
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(active&&!frame)frame=requestAnimationFrame(draw);});
})();
