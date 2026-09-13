import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const source = '/Users/bonap/Desktop/Fra/fragrance_test_db_50.xlsx';
const output = path.join(path.dirname(new URL(import.meta.url).pathname), 'perfumes-data.js');
const script = String.raw`
import zipfile, xml.etree.ElementTree as E, json
p=${JSON.stringify(source)}; ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'; rns='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
def value(c):
    if c.attrib.get('t') == 'inlineStr': return ''.join(x.text or '' for x in c.findall('.//'+ns+'t'))
    v=c.find(ns+'v'); return '' if v is None else v.text
def rows(z, sheet_target):
    sheet_target=sheet_target.lstrip('/')
    root=E.fromstring(z.read(sheet_target if sheet_target.startswith('xl/') else 'xl/'+sheet_target))
    result=[]
    for row in root.findall('.//'+ns+'row'):
        cells={}
        for c in row.findall(ns+'c'):
            col=''.join(ch for ch in c.attrib['r'] if ch.isalpha())
            cells[col]=value(c)
        result.append(cells)
    headers=result[0]
    return [{headers.get(k):v for k,v in row.items()} for row in result[1:]]
with zipfile.ZipFile(p) as z:
    wb=E.fromstring(z.read('xl/workbook.xml')); rel=E.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    targets={x.attrib['Id']:x.attrib['Target'] for x in rel}
    sheets={s.attrib['name']:targets[s.attrib[rns+'id']] for s in wb.find(ns+'sheets')}
    perfumes=rows(z,sheets['perfumes']); brands=rows(z,sheets['brands']); notes=rows(z,sheets['notes']); pn=rows(z,sheets['perfume_notes'])
brandBy={b.get('id'):b.get('name') for b in brands}; noteBy={n.get('id'):n.get('name') for n in notes}
notesBy={}
for edge in pn:
    notesBy.setdefault(edge.get('perfume_id'),[]).append({'name':noteBy.get(edge.get('note_id')),'position':edge.get('position'),'order':int(edge.get('display_order') or 0)})
data=[]
for p in perfumes:
    pnotes=sorted(notesBy.get(p.get('id'),[]),key=lambda n:n['order'])
    groups={'top':[],'middle':[],'base':[]}
    for n in pnotes:
        key='middle' if n['position']=='heart' else n['position']
        if key in groups and n['name']: groups[key].append(n['name'])
    data.append({'id':p.get('id'),'name':p.get('name'),'brand':brandBy.get(p.get('brand_id'),'Unknown'),'gender':p.get('gender') or 'unisex','description':p.get('description') or 'A fragrance from the prototype collection.','notes':[n['name'] for n in pnotes if n['name']],'noteGroups':groups})
print(json.dumps(data,ensure_ascii=False))
`;
const json = execFileSync('python3', ['-c', script], { encoding: 'utf8' });
fs.writeFileSync(output, `window.PERFUMES = ${json};\n`);
