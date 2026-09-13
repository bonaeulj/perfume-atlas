const perfumes = window.PERFUME_DATA || window.PERFUMES || [];
const atlas = document.querySelector('#atlas'), floatingBottles = document.querySelector('#floatingBottles'), search = document.querySelector('#search'), clearSearch = document.querySelector('#clearSearch'), results = document.querySelector('#searchResults'), workspace = document.querySelector('#workspace'), heroCard = document.querySelector('#heroCard'), detailsPanel = document.querySelector('#detailsPanel'), connections = document.querySelector('#connections'), collectionsPanel = document.querySelector('#collectionsPanel'), collectionGrid = document.querySelector('#collectionGrid'), brandGrid = document.querySelector('#brandGrid'), collectionName = document.querySelector('#collectionName'), brandName = document.querySelector('#brandName'), backToPrevious = document.querySelector('#backToPrevious');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const placements = [[4,33,250,250],[27,6,250,230],[59,17,130,260],[74,-5,290,230],[84,38,190,260],[9,70,190,230],[33,57,280,250],[59,68,180,230],[83,78,210,260],[45,78,170,190]];
const notePopularity = perfumes.reduce((map,p)=>{p.notes.forEach(n=>map[n]=(map[n]||0)+1);return map;},{});let selected = null;const navigationStack=[];
const indexOf=p=>perfumes.indexOf(p);const photoFor=i=>perfumes[i]?.image||'';
function noteFamily(note){
 const value=String(note||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/benzoin|benzonin/.test(value))return 'benzoin';
 if(/tonka/.test(value))return 'tonka bean';
 return value.replace(/\([^)]*\)/g,' ').replace(/\b(?:roasted|grilled|toasted|absolute|essence|extract|oil|resin|resinoid|resinoide|accord|fraction)\b/g,' ').replace(/\bbeans\b/g,'bean').replace(/[^a-z0-9]+/g,' ').trim();
}
const noteFamilyLabel=note=>noteFamily(note).replace(/\b\w/g,c=>c.toUpperCase());
const sharesNoteFamily=(perfume,note)=>perfume.notes.some(candidate=>noteFamily(candidate)===noteFamily(note));
const sharedNoteFamilyCount=(a,b)=>new Set(a.notes.map(noteFamily).filter(family=>b.notes.some(note=>noteFamily(note)===family))).size;
let backgroundImageCount=0,backgroundResizeTimer;
const bitmapPerfumes=()=>perfumes.filter(perfume=>{
 const bitmap=window.BITMAP_POINTS?.[perfume.id];
 return Array.isArray(bitmap)?bitmap.length:bitmap?.p?.length;
});
// Only fragrances with generated bitmap coordinates may occupy layout cells;
// otherwise hidden source images leave large blank gaps in the field.
const desiredBackgroundCount=()=>Math.min(bitmapPerfumes().length,30);
function addFloatingBottles(){
 const count=desiredBackgroundCount(),backgroundPerfumes=bitmapPerfumes().sort(()=>Math.random()-.5).slice(0,count);
 // Keep the gallery in a visible checkerboard instead of scattering cells.
 // Desktop tiles are 350px with a 100px gutter; mobile uses compact tiles.
 const mobile=window.innerWidth<=650,tileSize=mobile?100:350,tileGap=mobile?50:100;
 const columns=Math.max(1,Math.floor((window.innerWidth+tileGap)/(tileSize+tileGap))),rows=Math.ceil(count/columns);
 const totalWidth=columns*tileSize+(columns-1)*tileGap,totalHeight=rows*tileSize+(rows-1)*tileGap;
 floatingBottles.replaceChildren();backgroundImageCount=count;
 backgroundPerfumes.forEach((p,i)=>{
  const column=i%columns,row=Math.floor(i/columns),x=column*(tileSize+tileGap)+tileSize/2-totalWidth/2,y=row*(tileSize+tileGap)+tileSize/2-totalHeight/2;
  const baseX=x/(window.innerWidth*.52),baseY=y/(window.innerHeight*.52),size=tileSize,depth=1,phase=0,button=document.createElement('button');
  button.className='bottle';button.dataset.baseX=baseX.toFixed(4);button.dataset.baseY=baseY.toFixed(4);button.dataset.phase=phase;
  button.style.cssText=`left:50%;top:50%;--size:${size}px;--depth:${depth};z-index:${Math.round(depth*10)}`;
  button.dataset.perfumeId=p.id;
  button.setAttribute('aria-label',`${p.name} by ${p.brand}`);button.innerHTML=`<img src="${photoFor(indexOf(p))}" alt="">`;
  floatingBottles.append(button);
  mountNoteParticles(button,p);
 });
}

let pointerTargetX=0,pointerTargetY=0,pointerX=0,pointerY=0,zoomTarget=0,zoomPosition=0;
let panX=0,panY=0,panTargetX=0,panTargetY=0,dragPointer=null,dragStartX=0,dragStartY=0,dragOriginX=0,dragOriginY=0,didDrag=false;
const touchPointers=new Map();let pinchDistance=0;
window.addEventListener('pointermove',event=>{pointerTargetX=event.clientX/window.innerWidth-.5;pointerTargetY=event.clientY/window.innerHeight-.5;},{passive:true});
document.documentElement.addEventListener('pointerleave',()=>{pointerTargetX=0;pointerTargetY=0;});
floatingBottles.addEventListener('pointerdown',event=>{
 if(selected||event.button!==0)return;
 touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(touchPointers.size===2){const pts=[...touchPointers.values()];pinchDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);return;}
 dragPointer=event.pointerId;dragStartX=event.clientX;dragStartY=event.clientY;dragOriginX=panTargetX;dragOriginY=panTargetY;didDrag=false;
 floatingBottles.setPointerCapture(event.pointerId);floatingBottles.classList.add('is-dragging');
});
floatingBottles.addEventListener('pointermove',event=>{
 if(touchPointers.has(event.pointerId))touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(touchPointers.size>=2){const pts=[...touchPointers.values()];const next=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(pinchDistance)scatterNotes((pinchDistance-next)*.7);pinchDistance=next;return;}
 if(event.pointerId!==dragPointer)return;
 const dx=event.clientX-dragStartX,dy=event.clientY-dragStartY;
 if(Math.hypot(dx,dy)>5)didDrag=true;
 panTargetX=Math.max(-window.innerWidth*.35,Math.min(window.innerWidth*.35,dragOriginX+dx));
 panTargetY=Math.max(-window.innerHeight*.35,Math.min(window.innerHeight*.35,dragOriginY+dy));
});
function finishCanvasDrag(event){
 touchPointers.delete(event.pointerId);if(touchPointers.size<2)pinchDistance=0;
 if(event.pointerId!==dragPointer)return;
 dragPointer=null;floatingBottles.classList.remove('is-dragging');
}
floatingBottles.addEventListener('pointerup',finishCanvasDrag);
floatingBottles.addEventListener('pointercancel',finishCanvasDrag);
window.addEventListener('wheel',event=>{
 if(selected||!results.hidden||event.target.closest('#searchArea'))return;
 event.preventDefault();
 // Wheel input affects only bitmap dispersion; gallery positions and depth
 // remain fixed and can be navigated exclusively by dragging.
 scatterNotes(event.deltaY);
},{passive:false});
function animateBackgroundField(time){
 if(selected||!results.hidden){requestAnimationFrame(animateBackgroundField);return;}
 drawNoteParticles(floatingBottles.querySelectorAll('.bottle'),time);
 pointerX+=(pointerTargetX-pointerX)*.055;pointerY+=(pointerTargetY-pointerY)*.055;
 zoomPosition+=(zoomTarget-zoomPosition)*.075;
 panX+=(panTargetX-panX)*.16;panY+=(panTargetY-panY)*.16;
 floatingBottles.querySelectorAll('.bottle').forEach(button=>{
  const depth=Number(button.style.getPropertyValue('--depth'))||1,baseX=Number(button.dataset.baseX),baseY=Number(button.dataset.baseY);
  const phase=0,scale=1;
  const fieldX=Math.max(-window.innerWidth*.75,Math.min(window.innerWidth*.75,baseX*window.innerWidth*.52+panX));
  const fieldY=Math.max(-window.innerHeight*.75,Math.min(window.innerHeight*.75,baseY*window.innerHeight*.52+panY));
  // Keep the initial field populated edge-to-edge; depth animation can still
  // fade bottles, but never collapses the opening particle canvas to blanks.
  const visibility=1;
  button.style.setProperty('--field-x',`${fieldX.toFixed(2)}px`);button.style.setProperty('--field-y',`${fieldY.toFixed(2)}px`);
  button.style.setProperty('--field-scale',scale.toFixed(4));button.style.opacity=String(visibility);
  button.style.zIndex=String(Math.round(phase*30));
  button.style.setProperty('--parallax-x',`${(-pointerX*54*depth).toFixed(2)}px`);
  button.style.setProperty('--parallax-y',`${(-pointerY*42*depth).toFixed(2)}px`);
 });
 requestAnimationFrame(animateBackgroundField);
}
requestAnimationFrame(animateBackgroundField);
window.addEventListener('resize',()=>{clearTimeout(backgroundResizeTimer);backgroundResizeTimer=setTimeout(()=>{if(desiredBackgroundCount()!==backgroundImageCount)addFloatingBottles();},180);});
function noteGroups(p){return p.noteGroups||{unspecified:p.notes}}function descriptionFor(p){return escapeHTML(p.description)}function notesMarkup(p){const groups=noteGroups(p);return [['Top',groups.top],['Middle',groups.middle],['Base',groups.base],['Key Notes',groups.unspecified]].map(([label,notes])=>notes?.length?`<div class="layer"><span class="layer-title">${label}</span>${notes.map(n=>`<button class="note-button" data-note="${escapeHTML(n)}">${escapeHTML(n)}<span>+</span></button>`).join('')}</div>`:'').join('')||'<span>Not published by the source.</span>'}
function collectionFor(p){return p.collection||'Collection not confirmed'}
function renderDetail(p){openNoteGroups.clear();connections.replaceChildren();document.querySelectorAll('.toggle').forEach(b=>{b.classList.remove('is-open');b.setAttribute('aria-expanded','false');});selected=p;backToPrevious.hidden=navigationStack.length===0;atlas.classList.add('is-focused');workspace.hidden=false;connections.hidden=true;collectionGrid.hidden=true;brandGrid.hidden=true;collectionsPanel.classList.remove('is-expanded');document.querySelector('#collectionsToggle b').textContent='+';collectionName.textContent='Collections';document.querySelector('#collectionsToggle').hidden=!p.collection||!perfumes.some(item=>item.id!==p.id&&item.collection===p.collection);document.querySelector('#brandToggle b').textContent='+';heroCard.innerHTML=`<div class="hero-head">${[p.name,p.gender,p.brand].filter(Boolean).map(escapeHTML).join(' · ')}</div><div class="hero-image"><img src="${photoFor(indexOf(p))}" alt="${escapeHTML(p.name)}"></div><div class="description">${descriptionFor(p)}<a class="source" href="${escapeHTML(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source: ${escapeHTML(p.brand)} ↗</a></div>`;detailsPanel.innerHTML=`<section class="note-section"><span class="section-label">Notes</span><div class="section-body">${notesMarkup(p)}</div></section>${p.accords?.length?`<section class="note-section"><span class="section-label">Accords</span><div class="section-body">${p.accords.map(n=>`<span class="accord">${escapeHTML(n)}</span>`).join('')}</div></section>`:''}`;if(window.matchMedia('(max-width:650px)').matches)detailsPanel.append(connections);brandName.textContent=p.brand;detailsPanel.querySelectorAll('.note-button').forEach(button=>button.addEventListener('click',()=>showConnections(button.dataset.note,button)))}
function toggleGrid(grid,list,button){
 const active=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(active));button.classList.toggle('is-open',active);button.querySelector('b').textContent=active?'−':'+';
 if(active){grid.innerHTML=list.map(p=>`<button class="collection-item" data-id="${p.id}"><img src="${photoFor(indexOf(p))}" alt="${p.name}"></button>`).join('');
 grid.querySelectorAll('.collection-item').forEach(b=>b.addEventListener('click',()=>openPerfume(perfumes.find(p=>p.id===b.dataset.id))));}
 animatePanel(grid,active);
}

const openNoteGroups = new Map();
function showConnections(note, button) {
 const existing=openNoteGroups.get(note),active=!existing||existing.dataset.expanded!=='true';
 if(existing&&!active){existing.remove();openNoteGroups.delete(note);detailsPanel.querySelectorAll('.note-button').forEach(b=>{if(b.dataset.note===note){b.classList.remove('is-selected');b.setAttribute('aria-expanded','false');b.querySelector('span').textContent='+';}});if(!openNoteGroups.size)connections.hidden=true;return;}
 if(!existing){const group=createConnectionGroup(note);group.querySelector('.connection-items').hidden=true;connections.append(group);openNoteGroups.set(note,group);}
 connections.hidden=false;
 openNoteGroups.forEach((group,key)=>{
 const expanded=active&&key===note;group.dataset.expanded=String(expanded);
 const header=group.querySelector('.connection-label');header.setAttribute('aria-expanded',String(expanded));header.querySelector('b').textContent=expanded?'−':'+';
 animatePanel(group.querySelector('.connection-items'),expanded);
 });
 detailsPanel.querySelectorAll('.note-button').forEach(b=>{const expanded=active&&b.dataset.note===note;b.classList.toggle('is-selected',expanded);b.setAttribute('aria-expanded',String(expanded));b.querySelector('span').textContent=expanded?'−':'+';});
}

function openPerfume(p){if(!p)return;if(mobileDialog.open)mobileDialog.close();if(selected&&selected.id!==p.id)navigationStack.push(selected);search.value='';results.hidden=true;atlas.classList.remove('has-search-results','is-searching');renderDetail(p)}function goBack(){const previous=navigationStack.pop();if(previous)renderDetail(previous);backToPrevious.hidden=navigationStack.length===0}function performSearch(){const q=search.value.trim().toLowerCase();if(!q){results.hidden=true;atlas.classList.remove('has-search-results','is-searching');return}const matches=perfumes.filter(p=>[p.name,p.brand,...p.notes].join(' ').toLowerCase().includes(q));results.hidden=false;atlas.classList.add('has-search-results','is-searching');results.innerHTML=matches.length?matches.map(p=>`<button class="result" data-id="${p.id}"><img src="${photoFor(indexOf(p))}" alt="" loading="lazy" decoding="async"><span><b>${p.name}</b><small>${p.brand}</small><small class="result-notes">${p.notes.slice(0,3).map(escapeHTML).join(' · ')}</small></span><i>+</i></button>`).join(''):`<p class="empty">No matching perfume or note.</p>`;results.querySelectorAll('.result').forEach(b=>b.addEventListener('click',()=>openPerfume(perfumes.find(p=>p.id===b.dataset.id))));requestAnimationFrame(updateSearchPosition)}
floatingBottles.addEventListener('click',event=>{if(didDrag){didDrag=false;return;}const button=event.target.closest('.bottle');if(!button||selected)return;openPerfume(perfumes.find(p=>p.id===button.dataset.perfumeId));});
let searchTimer;
backToPrevious.addEventListener('click',goBack);search.addEventListener('blur',()=>{if(!search.value.trim())atlas.classList.remove('is-searching')});search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(performSearch,90)});clearSearch.addEventListener('click',()=>{clearTimeout(searchTimer);search.value='';results.hidden=true;atlas.classList.remove('has-search-results','is-searching');search.focus()});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}if(e.key==='Escape'&&mobileDialog.open){e.preventDefault();closeMobileNote();return;}if(e.key==='Escape'&&selected){selected=null;navigationStack.length=0;backToPrevious.hidden=true;atlas.classList.remove('is-focused');workspace.hidden=true;connections.hidden=true;search.focus()}});document.querySelector('#collectionsToggle').addEventListener('click',e=>toggleGrid(collectionGrid,perfumes.filter(p=>p.brand===selected.brand&&p.collection===selected.collection),e.currentTarget));document.querySelector('#brandToggle').addEventListener('click',e=>toggleGrid(brandGrid,perfumes.filter(p=>p.brand===selected.brand),e.currentTarget));addFloatingBottles();

function createConnectionGroup(note) {
    const group = document.createElement('section');
    group.className = 'connection-group';
    const matches = perfumes.filter(p => p.id !== selected.id && sharesNoteFamily(p,note))
      .sort((a,b) => sharedNoteFamilyCount(b,selected) - sharedNoteFamilyCount(a,selected) || a.name.localeCompare(b.name));
    group.innerHTML = `<button class="connection-label" type="button"><span>With ${escapeHTML(noteFamilyLabel(note))} note</span><b>−</b></button><div class="connection-items">${matches.length ? matches.map(p => `<button class="connection" data-id="${p.id}"><span class="connection-head"><span>${escapeHTML(p.name)} · ${escapeHTML(p.brand)}</span><b>+</b></span><img src="${photoFor(indexOf(p))}" alt="${escapeHTML(p.name)}"></button>`).join('') : '<p class="empty">No other fragrance in this dataset shares this note.</p>'}</div>`;
    group.querySelectorAll('.connection').forEach(b => b.addEventListener('click', () => openPerfume(perfumes.find(p => p.id === b.dataset.id))));

  group.querySelector('.connection-label').addEventListener('click',()=>{
 if(group.closest('#mobileNoteContent')){closeMobileNote();return;}
 const trigger=Array.from(detailsPanel.querySelectorAll('.note-button')).find(b=>b.dataset.note===note);
 if(trigger)showConnections(note,trigger);
 });
 return group;
}
const mobileDialog = document.querySelector('#mobileNoteDialog');
const mobileNoteContent = document.querySelector('#mobileNoteContent');
let mobileTrigger = null;
let mobileScroll = 0;
function openMobileNote(note, button) {
  mobileTrigger = button;
  mobileScroll = workspace.scrollTop;
  button.setAttribute('aria-expanded','true');
  button.querySelector('span').textContent = '−';
  mobileNoteContent.replaceChildren(createConnectionGroup(note));
  const header=mobileNoteContent.querySelector('.connection-label');
 header.querySelector('b').textContent='×';header.setAttribute('aria-label','Close: With '+note+' note');
 mobileDialog.setAttribute('aria-label','With '+note+' note');
 mobileDialog.showModal();mobileDialog.animate([{opacity:0,filter:'blur(8px)',transform:'translateY(12px)'},{opacity:1,filter:'blur(0px)',transform:'translateY(0)'}],motionOptions());
  mobileNoteContent.scrollTop = 0;
}
mobileDialog.addEventListener('cancel',e=>{e.preventDefault();closeMobileNote();});
mobileDialog.addEventListener('close', () => {
  mobileNoteContent.replaceChildren();
  if(mobileTrigger && mobileTrigger.isConnected) {
    mobileTrigger.setAttribute('aria-expanded','false');
    mobileTrigger.querySelector('span').textContent = mobileTrigger.classList.contains('is-selected') ? '−' : '+';
    mobileTrigger.focus({preventScroll:true});
    workspace.scrollTop = mobileScroll;
  }
  mobileTrigger = null;
});
window.matchMedia('(max-width:650px)').addEventListener('change', () => {
  if(mobileDialog.open) mobileDialog.close();
});

function motionOptions(duration=240){return {duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,easing:'ease-in-out'};}
const panelMotions=new WeakMap();
function animatePanel(element,open){
 const previous=panelMotions.get(element),from=element.hidden?0:element.getBoundingClientRect().height;
 if(previous)previous.cancel();if(!open&&element.hidden)return;
 element.hidden=false;const to=open?element.scrollHeight:0;
 const animation=element.animate([{height:from+'px',opacity:from?1:0,filter:open?'blur(8px)':'blur(0px)'},{height:to+'px',opacity:open?1:0,filter:open?'blur(0px)':'blur(8px)'}],motionOptions());
 panelMotions.set(element,animation);
 animation.finished.then(()=>{if(panelMotions.get(element)===animation){element.hidden=!open;panelMotions.delete(element);}}).catch(()=>{});
}
let mobileClosing=false;
async function closeMobileNote(){
 if(!mobileDialog.open||mobileClosing)return;mobileClosing=true;
 await mobileDialog.animate([{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(8px)'}],motionOptions()).finished.catch(()=>{});
 mobileDialog.close();mobileClosing=false;
}

const revealMotions=new WeakMap();
function blurReveal(element){
  revealMotions.get(element)?.cancel();
  // Every image follows the same gather -> reveal motion, including images
  // inserted later by search, collections, details, and connection cards.
  element.classList.add('bitmap-transition');
  const motion=element.animate([{opacity:.18,filter:'blur(14px) contrast(.8)'},{opacity:1,filter:'blur(0px) contrast(1)'}],motionOptions(1000));
  revealMotions.set(element,motion);
}
const watchedImages=new WeakSet();
function bitmapReveal(image){
  const src=image.getAttribute('src')||'';
  const perfume=perfumes.find(p=>src.endsWith(p.image)||p.image.endsWith(src));
  const data=perfume&&window.BITMAP_POINTS?.[perfume.id];
  if(!data||!image.parentElement)return;
  const coords=Array.isArray(data)?data:data.p, palette=Array.isArray(data)?['#777']:data.k, colors=Array.isArray(data)?null:data.c;
  const canvas=document.createElement('canvas');canvas.className='bitmap-reveal-layer';canvas.width=440;canvas.height=440;
  image.parentElement.classList.add('bitmap-reveal-host');image.parentElement.append(canvas);
  const points=coords.map((v,i)=>({x:(v%110)*4,y:Math.floor(v/110)*4,c:palette[colors?.[i]??0]||'#777',a:i*2.4}));
  const start=performance.now(),duration=1000;
  const frame=now=>{const t=Math.min(1,(now-start)/duration),amount=2.35*(1-t),ctx=canvas.getContext('2d');ctx.clearRect(0,0,440,440);for(const p of points){const drift=Math.sin(p.a+now*.003)*8*amount;ctx.fillStyle=p.c;ctx.globalAlpha=.72*(1-t);ctx.fillRect(p.x+drift*amount,p.y+Math.cos(p.a+now*.002)*6*amount,2,2)}if(t<1)requestAnimationFrame(frame);else canvas.remove()};
  requestAnimationFrame(frame);
}
function prepareImage(image){
  if(watchedImages.has(image))return;
  watchedImages.add(image);
  image.classList.add('image-loading');
  image.setAttribute('aria-busy','true');
  let settled=false;
  const finish=()=>{
    if(settled)return;
    settled=true;
    image.removeAttribute('aria-busy');
    image.classList.remove('image-loading');
    if(image.naturalWidth>0){bitmapReveal(image);blurReveal(image);}
  };
  image.addEventListener('load',finish,{once:true});
  image.addEventListener('error',finish,{once:true});
  if(image.complete)finish();
}
function prepareImages(root){
  if(root.matches?.('img'))prepareImage(root);
  root.querySelectorAll?.('img').forEach(prepareImage);
}
prepareImages(document);
new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(prepareImages)))
  .observe(document.body,{childList:true,subtree:true});
new MutationObserver(()=>{
  if(selected&&!heroCard.querySelector('.hero-close')){
    const close=document.createElement('button');close.className='hero-close';close.type='button';close.setAttribute('aria-label','Close and return to main');close.textContent='×';close.addEventListener('click',goHome);heroCard.prepend(close);
  }
}).observe(heroCard,{childList:true});

function goHome(){
  selected=null;
  navigationStack.length=0;
  backToPrevious.hidden=true;
  workspace.hidden=true;
  connections.hidden=true;
  collectionGrid.hidden=true;
  brandGrid.hidden=true;
  search.value='';
  results.hidden=true;
  atlas.classList.remove('is-focused','has-search-results','is-searching');
}

atlas.addEventListener('click',event=>{
  const clickPath=event.composedPath();
  if(!selected||clickPath.includes(workspace)||clickPath.includes(document.querySelector('#searchArea')))return;
  goHome();
});

function updateSearchPosition(){
  atlas.classList.remove('has-search-results');
  if(results.hidden)return;
  const searchBarHeight=document.querySelector('.search-bar').offsetHeight;
  const centeredHeight=searchBarHeight+8+results.scrollHeight;
  if(window.innerHeight/2+centeredHeight/2>window.innerHeight-16){
    atlas.classList.add('has-search-results');
  }
}

search.addEventListener('input',()=>queueMicrotask(updateSearchPosition));
window.addEventListener('resize',updateSearchPosition);
