import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Papa from 'papaparse';
import {fileURLToPath} from 'node:url';
import {validVocabulary,type Vocabulary} from '../src/types';
import {addMissingExamples,parseAuthoredExamples,parseExampleTranslations,addExampleTranslations} from './enrich-vocabulary';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function parseExport(text:string){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);const metadata:Record<string,string>={};
 while(lines[0]?.startsWith('#')){const line=lines.shift()!.slice(1);const colon=line.indexOf(':');metadata[line.slice(0,colon)]=line.slice(colon+1);}
 const delimiter=({tab:'\t',comma:',',semicolon:';'} as Record<string,string>)[metadata.separator] || undefined;
 const result=Papa.parse<string[]>(lines.join('\n'),{delimiter,skipEmptyLines:true});
 if(result.errors.length)throw new Error(JSON.stringify(result.errors));
 for(const row of result.data)if(row.length!==4)throw new Error(`Expected four columns, got ${row.length}`);
 return {rows:result.data,metadata};
}
const reviewedPrepositions:Record<string,{english:string;example:string}>=JSON.parse(fs.readFileSync(path.join(root,'scripts/mappings/preposition-meanings.json'),'utf8'));
const id=(...s:string[])=>crypto.createHash('sha256').update(s.join('\x1f')).digest('hex').slice(0,16);
export function convert(rows:string[][],type:string):Vocabulary[]{
 const entries=new Map<string,Vocabulary>();
 for(const [deck,front,back] of rows){
  if(type==='general'){
   const german=front.replace(/(?<=\p{L})[.🞌](?=\p{L})/gu,'');const key=id(german,back);
   entries.set(key,{id:key,type:'general',german,english:back});
  }else if(type==='verb_preposition'){
   const m=back.match(/^(.+) (\S+) \(\+([ADG])\) — (.+)$/);if(!m)throw new Error(`Unrecognized preposition: ${back}`);
   const key=id(front,back);entries.set(key,{id:key,type:'verb_preposition',verb:m[1],preposition:m[2],case:({A:'Akkusativ',D:'Dativ',G:'Genitiv'} as Record<string,string>)[m[3]],prompt:front,meaningAndExample:m[4],...reviewedPrepositions[key]});
  }else{
   let infinitive:string,english:string,fields:Record<string,string>;
   if(deck.endsWith('English to Infinitiv')){
    const m=back.match(/^(.+?)  Beispiel: (.*?)  Gebrauch: (.*)$/);if(!m)throw new Error(`Unrecognized verb: ${back}`);
    infinitive=m[1];english=front.replace(/  Wie heißt das Verb auf Deutsch\?$/,'');fields={example:m[2],usage:m[3]};
   }else{
    const m=back.match(/^(Perfekt|Präteritum|Präsens): (.*?)  English: (.*?) Gebrauch: (.*)$/);if(!m)throw new Error(`Unrecognized form: ${back}`);
    infinitive=front;english=m[3];fields={[({Perfekt:'perfekt',Präteritum:'praeteritum',Präsens:'praesens'} as Record<string,string>)[m[1]]]:m[2],usage:m[4]};
   }
   const key=id(infinitive,english);const old=entries.get(key);
   if(old && old.type==='irregular_verb')for(const [k,v]of Object.entries(fields)){const previous=(old as unknown as Record<string,string>)[k];if(previous&&previous!==v)throw new Error(`Conflicting ${k}: ${infinitive}`);}
   entries.set(key,{...old,id:key,type:'irregular_verb',infinitive,english,...fields});
  }
 }
 const out=[...entries.values()];if(!out.every(validVocabulary))throw new Error('Invalid converted vocabulary');return out;
}
export function runImport(){
 const mappings=JSON.parse(fs.readFileSync(path.join(root,'scripts/mappings/collections.json'),'utf8'));
 const requested=process.argv.includes('--collection')?process.argv[process.argv.indexOf('--collection')+1]:undefined;
 if(requested&&!mappings.some((m:any)=>m.id===requested))throw new Error(`Unknown collection ${requested}`);
 const summary=[];
 const translations=parseExampleTranslations(fs.readFileSync(path.join(root,'data-source/example-translations.csv'),'utf8'));
 const examples=parseAuthoredExamples(fs.readFileSync(path.join(root,'data-source/general-examples.csv'),'utf8'));
 fs.mkdirSync(path.join(root,'public/data'),{recursive:true});
 for(const m of mappings){
  const target=path.join(root,'public/data',m.file);
  if(!requested||requested===m.id){
   const files=fs.readdirSync(path.join(root,'data-source')).filter(f=>f.startsWith(m.pattern));if(files.length!==1)throw new Error(`Expected one source for ${m.id}`);
   const {rows,metadata}=parseExport(fs.readFileSync(path.join(root,'data-source',files[0]),'utf8'));
   const entries=addExampleTranslations(addMissingExamples(convert(rows,m.type),examples),translations);fs.writeFileSync(target,JSON.stringify(entries,null,2)+'\n');
   summary.push({collection:m.id,source:files[0],records:rows.length,entries:entries.length,examples:entries.filter(entry=>'example' in entry && !!entry.example?.trim()).length,translatedExamples:entries.filter(entry=>!!entry.exampleTranslation?.trim()).length,missingExamples:entries.filter(entry=>!('example' in entry) || !entry.example?.trim()).length,metadata,warnings:m.type==='verb_preposition'?['Meaning/example boundaries use reviewed per-entry mappings; raw combined field preserved. New unmapped records use gap-fill exercises.']:m.type==='irregular_verb'?['Forms retained verbatim; grammatical person unspecified.']:[]});
  }
  m.count=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')).length:0;
 }
 fs.writeFileSync(path.join(root,'public/data/manifest.json'),JSON.stringify({collections:mappings.map(({pattern,...m}:any)=>m)},null,2)+'\n');
 fs.writeFileSync(path.join(root,'data/json-import-summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runImport();
