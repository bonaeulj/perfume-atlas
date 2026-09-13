import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
const root = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(root, 'data');
const offline = process.argv.includes('--offline');
await fs.mkdir(path.join(dir, 'cache'), {recursive:true});
await fs.mkdir(path.join(root, 'images'), {recursive:true});
const stamp = new Date().toISOString();
async function cached(url, key) {
  const file = path.join(dir, 'cache', key);
  if (offline) return fs.readFile(file, 'utf8');
  const response = await fetch(url, {signal:AbortSignal.timeout(30000), headers:{'User-Agent':'PerfumeAtlasResearch/1.0'}});
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  const body = await response.text(); await fs.writeFile(file, body); return body;
}
const plain = s => s.replace(/<br\s*\/?>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\r/g,'');
const clean = s => s.replace(/\s+/g,' ').replace(/^[\s,.]+|[\s,.]+$/g,'').trim();
const title = s => s.replace(/\b\p{L}/gu, c=>c.toUpperCase());
function splitNotes(s) {
  // Commas inside ingredient explanations are not note boundaries.
  return s.split(/,(?![^()]*\))/).map(clean).filter(Boolean).map(title);
}
function csv(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r')cell+=c;}
  if(cell||row.length){row.push(cell);rows.push(row);}const headers=rows.shift();return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
const taxonomyURL='https://raw.githubusercontent.com/parfica/parfica-open-data/main/data/notes.csv';
const taxonomy=csv(await cached(taxonomyURL,'notes.csv')).map(({slug,name_en,group})=>({id:slug,name:name_en,group,source:taxonomyURL,license:'CC0-1.0'}));
const manual = {
  'serpentine':['Grass','Leaves','Pollen','Galbanum','Iris Leaf','Aldehyde','Ozone','Black Musks','Nutmeg','Labdanum','Smoked Cedar','Benzoin','Juniper Wood','Guaiac Wood'],
  'monocle-scent-three-sugi':['Mediterranean Cypress','Madagascan Pepper','Florentine Iris','Virginian Cedar','Pine','Haitian Vetiver'],
  'odeur-du-theatre-du-chatelet':['Ambrette Absolute','Black Pepper Oil','Rose Oxyd','Coffee Accord','Orange Blossom','Orris Concrete','Cashmeran','Virginian Cedarwood','Musk'],
  'series-6-synthetic-tar':['Grilled Cigarettes','Town Gas','Bergamot'],
  'series-6-synthetic-soda':['Lime','Ginger','Pepper'],
  'series-6-synthetic-garage':['Kerosene','Vetiver','Cedarwood'],
  'series-2-red-palisander':['Brazilian Palisander','Virginian Red Wood'],
  'blackpepper':['Madagascan Pepper','Cedarwood','Akigalawood','Tonka Bean','Musky Accord'],
  'copper':['Galbanum','Peppercorns','Ginger','Synthetic Metals','Amber','Vanilla','Myrrh'],
  'rouge':['Pink Peppercorns','Ginger','Beetroot','Geranium','Incense','Patchouli','Cistus'],
  'zero':['Cedarwood','Bergamot','Musk','Haitian Vetiver','Synthetic Rose','Varnish Accord'],
  'stussy-laguna-beach':['Marine Notes','Moss','Atlas Cedar','White Solar Flowers'],
  'marseille':['Savon De Marseille Accord','Neroli Accord','Petalia','Oranger Crystals','Ambrofix','Cosmone'],
  'floriental':['Labdanum','Sandalwood','Vetiver','Incense','Pink Pepper','Plum Liqueur']
};
function cdgNotes(p) {
  const groups={top:[],middle:[],base:[],unspecified:[]}, body=plain(p.body_html);
  if(manual[p.handle]){groups.unspecified=manual[p.handle];return groups;}
  const labels=[...body.matchAll(/\b(Head|Top|Heart|Mid|Middle|Bottom|Base|Dry down|Dry)(?:\s+notes)?\s*:\s*/gi)];
  for(let i=0;i<labels.length;i++) {const m=labels[i], key=/head|top/i.test(m[1])?'top':/heart|mid/i.test(m[1])?'middle':'base';groups[key]=splitNotes(body.slice(m.index+m[0].length,labels[i+1]?.index).split('\n*')[0]);}
  if(labels.length)return groups;
  const timed=[...body.matchAll(/([^,.()]+)\s*\(([TMD])\)/g)];
  if(timed.length){for(const [,name,phase]of timed)groups[{T:'top',M:'middle',D:'base'}[phase]].push(title(clean(name)));return groups;}
  const paragraphs=[...p.body_html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>plain(m[1]));
  const candidate=paragraphs.at(-1)?.split(/\n\s*\n|Concept:|Produced by:|Perfumer:/i)[0]||'';
  if((candidate.match(/,/g)||[]).length>=2 && !/theme of sweet|ritual of Sweet/i.test(candidate))groups.unspecified=splitNotes(candidate.replace(/\.\s*\n/g,', '));
  return groups;
}
const sources=[{id:'cdg',brand:'Comme des Garçons',host:'https://comme-des-garcons-parfum.com'},{id:'tom-ford',brand:'Tom Ford',host:'https://www.tomfordbeauty.com'}];
const tests=[]; const records=[];
const byredoRobots=await cached('https://www.byredo.com/robots.txt','byredo-robots.txt');
tests.push({brand:'Byredo',status:'deferred',reason:'robots.txt general crawler Disallow: /; no catalog crawl attempted',robots:byredoRobots});
for(const source of sources){
  const robots=await cached(source.host+'/robots.txt',source.id+'-robots.txt');
  // Conservative guard if the general crawler policy changes.
  const general=robots.match(/User-agent:\s*\*([\s\S]*?)(?=User-agent:|$)/i)?.[1]||'';
  if(/^Disallow:\s*\/\s*$/mi.test(general))throw Error('Catalog crawling disallowed: '+source.host);
  const products=[];
  for(let page=1;page<=10;page++){const j=JSON.parse(await cached(`${source.host}/products.json?limit=250&page=${page}`,`${source.id}-products-${page}.json`));products.push(...j.products);if(j.products.length<250)break;}
  const seen=new Set();let included=0;
  for(const p of products){
    if(source.id==='tom-ford'&&(p.product_type!=='Fragrance'||/set|candle|body|discovery/i.test(p.title)))continue;
    if(source.id==='cdg'&&(/candle/i.test(p.handle)||['hinoki','incense-series-3','cologne-series-4','stephen-jones-wisteria-hysteria'].includes(p.handle)))continue;
    const identity=clean(p.title).toLowerCase();if(seen.has(identity))continue;seen.add(identity);
    const sourceUrl=`${source.host}/products/${p.handle}`;
    let noteGroups,collection=null;
    if(source.id==='tom-ford'){
      const html=await cached(sourceUrl,`${source.id}-${p.handle}.html`);
      const notes=html.match(/>Key Notes<\/span>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1];
      noteGroups={top:[],middle:[],base:[],unspecified:notes?splitNotes(plain(notes)):[]};
    }else {noteGroups=cdgNotes(p);collection=p.title.match(/^(Series \d+[: ]?\s*[^-:]*?)(?:\s+-\s+|:)/i)?.[1]||(/^Monocle/i.test(p.title)?'Monocle':/^Play /i.test(p.title)?'Play':null);}
    const notes=[...new Set(Object.values(noteGroups).flat())];
    const image=p.images[0];if(!image)throw Error('Missing image '+sourceUrl);
    const id=source.id+'-'+p.handle;
    const imageUrl=new URL(image.src);imageUrl.searchParams.set('width','900');
    const imagePath='images/'+id+path.extname(imageUrl.pathname);
    if(!offline){const r=await fetch(imageUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Image failed '+imageUrl);await fs.writeFile(path.join(root,imagePath),Buffer.from(await r.arrayBuffer()));}
    const description=notes.length?`${p.title} by ${source.brand}. Officially listed notes: ${notes.join(', ')}.`:`${p.title} by ${source.brand}. Note details are not provided in the collected official source.`;
    records.push({id,name:clean(p.title),brand:source.brand,gender:/\bunisex\b|men and women/i.test(plain(p.body_html))?'Unisex':null,description,notes,noteGroups,accords:[],collection,image:imagePath,imageSourceUrl:image.src,sourceUrl,sourceProductId:String(p.id),sourceUpdatedAt:p.updated_at,fetchedAt:stamp,descriptionType:'generated-factual-summary',imageRights:'Brand copyrighted; local QC reference only; public reuse permission not verified',noteExtraction:source.id==='tom-ford'?'official-key-notes':manual[p.handle]?'reviewed-official-prose':'official-note-list',variants:p.variants.map(v=>({sourceId:String(v.id),label:v.title,available:v.available})),qualityFlags:[...(notes.length?[]:['notes-not-published']),...(collection?[]:['collection-not-confirmed']),'accords-not-published']});
    included++; console.log(`${records.length}: ${source.brand} / ${p.title}`);
  }
  tests.push({brand:source.brand,status:'success',catalogCount:products.length,included,source:source.host+'/products.json',checkedAt:stamp});
}
if(records.length<100)throw Error(`Only ${records.length} distinct perfumes. Existing live dataset preserved.`);
// Stable seed membership on later updates, then fill remaining slots from the current catalog.
let prior=[];try{prior=JSON.parse(await fs.readFile(path.join(dir,'perfumes.json'),'utf8'));}catch{}
const priorIds=new Set(prior.map(p=>p.id));records.sort((a,b)=>Number(priorIds.has(b.id))-Number(priorIds.has(a.id))||a.id.localeCompare(b.id));
const selected=records.slice(0,100);
const report={generatedAt:stamp,count:selected.length,byBrand:Object.fromEntries(sources.map(s=>[s.brand,selected.filter(p=>p.brand===s.brand).length])),missingNotes:selected.filter(p=>!p.notes.length).map(p=>p.id),sources:tests,added:selected.filter(p=>!priorIds.has(p.id)).map(p=>p.id),removed:prior.filter(p=>!selected.some(q=>q.id===p.id)).map(p=>p.id),updated:selected.filter(p=>{const old=prior.find(q=>q.id===p.id);return old&&old.sourceUpdatedAt!==p.sourceUpdatedAt;}).map(p=>p.id),policy:'No inferred pyramids, accords, gender, or note-based fake collections. Sizes are variants, not fragrances. Incense/Cologne group pages excluded pending per-scent images.'};
const dbPath=path.join(dir,'perfumes.next.sqlite');await fs.rm(dbPath,{force:true});const db=new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE brands(id TEXT PRIMARY KEY,name TEXT NOT NULL); CREATE TABLE perfumes(id TEXT PRIMARY KEY,brand_id TEXT REFERENCES brands(id),name TEXT NOT NULL,source_url TEXT NOT NULL,image_path TEXT NOT NULL,data_json TEXT NOT NULL); CREATE TABLE perfume_notes(perfume_id TEXT REFERENCES perfumes(id),position TEXT,note TEXT,PRIMARY KEY(perfume_id,position,note)); CREATE TABLE note_taxonomy(id TEXT PRIMARY KEY,name TEXT,group_name TEXT,license TEXT,source_url TEXT); CREATE TABLE sync_runs(created_at TEXT,report_json TEXT);');
for(const s of sources)db.prepare('INSERT INTO brands VALUES(?,?)').run(s.id,s.brand);
for(const p of selected){db.prepare('INSERT INTO perfumes VALUES(?,?,?,?,?,?)').run(p.id,sources.find(s=>s.brand===p.brand).id,p.name,p.sourceUrl,p.image,JSON.stringify(p));for(const [position,ns]of Object.entries(p.noteGroups))for(const n of new Set(ns))db.prepare('INSERT INTO perfume_notes VALUES(?,?,?)').run(p.id,position,n);}
for(const n of taxonomy)db.prepare('INSERT OR IGNORE INTO note_taxonomy VALUES(?,?,?,?,?)').run(n.id,n.name,n.group,n.license,n.source);
db.prepare('INSERT INTO sync_runs VALUES(?,?)').run(stamp,JSON.stringify(report));if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('DB integrity failed');db.close();
if(prior.length)await fs.copyFile(path.join(dir,'perfumes.json'),path.join(dir,'perfumes.previous.json'));
await fs.rename(dbPath,path.join(dir,'perfumes.sqlite'));
await fs.writeFile(path.join(dir,'perfumes.json'),JSON.stringify(selected,null,2)+'\n');
await fs.writeFile(path.join(dir,'note-taxonomy.json'),JSON.stringify(taxonomy,null,2)+'\n');
await fs.writeFile(path.join(dir,'sync-report.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(root,'perfumes-data.js'),'window.PERFUMES = '+JSON.stringify(selected).replace(/</g,'\\u003c')+';\n');
console.log(JSON.stringify(report,null,2));
