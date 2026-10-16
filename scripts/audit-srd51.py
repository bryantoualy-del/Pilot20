#!/usr/bin/env python3
"""Read-only census against the official CC PDF. Requires pdftotext; never fetches books.
Usage: python scripts/audit-srd51.py /private/path/SRD5.1-CCBY4.0License.pdf
"""
import hashlib,json,pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
pdf=pathlib.Path(sys.argv[1]);manifest=json.loads((root/'src/catalog/data/srd51-manifest.json').read_text())
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==manifest['sourceSha256'],'Different source revision; review provenance before updating'
s=subprocess.check_output(['pdftotext','-raw',str(pdf),'-']).decode()
s=re.sub(r'[\t\r\u00a0]+',' ',s);s=re.sub(' +',' ',s);s=re.sub(r'\f?System Reference Document 5.1 \d+\s*\n','',s)
s=s.replace('\u00ad','').replace('‐','-').replace('‑','-').replace('—','-').replace('–','-').replace('’',"'")
lines=s.splitlines();start=lines.index('Spell Lists');end=lines.index('Spell Descriptions');lists={};cls=None
for line in lines[start+1:end]:
 line=line.strip();m=re.fullmatch('(Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Warlock|Wizard) Spells',line)
 if m:cls=m[1].lower();lists[cls]=[];continue
 if re.fullmatch(r'(?:[1-9](?:st|nd|rd|th) Level|Cantrips \(0 Level\))',line):continue
 if line and cls:lists[cls].append(line)
assert {k:sorted(v) for k,v in lists.items()}==manifest['classLists'],'Class spell lists differ'
school='abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation'
p=re.compile(r'(?m)^([^\n]+)\n((?:[1-9](?:st|nd|rd|th)-+level (?:'+school+r')|(?:'+school+r') cantrip)(?: \(ritual\))?)\s*\nCasting Time: ',re.I)
headers=p.findall(s[s.index('Spell Descriptions'):]);ids=sorted('srd51:'+re.sub('[^a-z0-9]+','-',name.lower()).strip('-') for name,_ in headers)
assert ids==manifest['spellIds'];assert len(ids)==319
print(json.dumps({'sourceSha256':manifest['sourceSha256'],'spells':len(ids),'classListCounts':{k:len(v) for k,v in lists.items()}},indent=2))
