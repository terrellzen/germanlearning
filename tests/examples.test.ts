import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {parseAuthoredExamples,addMissingExamples,type AuthoredExample,parseExampleTranslations,addExampleTranslations} from '../scripts/enrich-vocabulary';
import {convert,parseExport} from '../scripts/import-vocabulary';
import {generateCards} from '../src/engine';
import {validVocabulary,type General,type Settings,type Vocabulary} from '../src/types';
const examples=parseAuthoredExamples(fs.readFileSync('data-source/general-examples.csv','utf8'));
const translations=parseExampleTranslations(fs.readFileSync('data-source/example-translations.csv','utf8'));
const settings:Settings={selected:[],exercises:['perfekt'],direction:'de-en',order:'alphabetical',mode:'manual',questionSeconds:10,answerSeconds:5,examples:true,countdown:true};
const entry:General={id:'one',type:'general',german:'der Apfel',english:'apple'};
const addition:AuthoredExample={id:'one',german:'der Apfel',english:'apple',example_de:'Für unterwegs nehme ich einen Apfel mit.'};

describe('authored context examples',()=>{
 it('parses spreadsheet CSV with BOM, quotes and multiline content',()=>{
  const result=parseAuthoredExamples('\uFEFFid,german,english,example_de\r\none,Öl,oil,"Sie sagt: ""Ich brauche Öl.""\nDann kocht sie."\r\n');
  expect(result.get('one')?.example_de).toBe('Sie sagt: "Ich brauche Öl."\nDann kocht sie.');
 });
 it('rejects missing columns, empty examples, malformed rows and duplicate IDs',()=>{
  expect(()=>parseAuthoredExamples('id,german\none,Apfel')).toThrow();
  expect(()=>parseAuthoredExamples('id,german,english,example_de\none,Apfel,apple,')).toThrow();
  expect(()=>parseAuthoredExamples('id,german,english,example_de\none,Apfel,apple,test,extra')).toThrow();
  expect(()=>parseAuthoredExamples('id,german,english,example_de\none,Apfel,apple,Ein Apfel liegt hier.\none,Apfel,apple,Noch ein Apfel.')).toThrow('Duplicate');
 });
 it('fills a missing example without mutating the source vocabulary',()=>{
  const out=addMissingExamples([entry],new Map([['one',addition]]));
  expect(out[0]).toMatchObject({example:addition.example_de,exampleSource:'authored'});
  expect(entry).not.toHaveProperty('example');
  expect(addMissingExamples(out,new Map([['one',addition]]))).toEqual(out);
 });
 it('preserves existing examples and never enriches the other deck types',()=>{
  const entries:Vocabulary[]=[{...entry,example:'Mein eigener Apfel ist rot.'},{id:'one',type:'irregular_verb',infinitive:'essen',english:'eat',example:'Ich esse einen Apfel.'},{id:'one',type:'verb_preposition',verb:'warten',preposition:'auf',case:'Akkusativ',prompt:'warten ____',meaningAndExample:'wait for',example:'Ich warte auf dich.'}];
  expect(addMissingExamples(entries,new Map([['one',addition]]))).toEqual(entries);
 });
 it('rejects a mismatched sense rather than attaching an unrelated example',()=>{
  expect(()=>addMissingExamples([entry],new Map([['one',{...addition,english:'pear'}]]))).toThrow('does not match');
 });
 it('leaves new vocabulary without a matching authored example untouched',()=>{
  expect(addMissingExamples([entry],new Map())).toEqual([entry]);
 });
 it('validates optional example fields at runtime',()=>{
  expect(validVocabulary({...entry,example:42})).toBe(false);
  expect(validVocabulary({...entry,example:'Ein Apfel liegt auf dem Tisch.',exampleSource:'authored'})).toBe(true);
 });
 for(const level of ['a1','a2']){
  it(`covers every ${level.toUpperCase()} entry and survives reimport`,()=>{
   const filename=fs.readdirSync('data-source').find(f=>f.startsWith(`Schritte International ${level.toUpperCase()}`))!;
   const baseline=convert(parseExport(fs.readFileSync(`data-source/${filename}`,'utf8')).rows,'general');
   const enriched=addExampleTranslations(addMissingExamples(baseline,examples),translations);
   const published=JSON.parse(fs.readFileSync(`public/data/vocabulary-${level}.json`,'utf8')) as General[];
   expect(enriched).toEqual(published);
   expect(enriched.every(v=>v.type==='general' && !!v.example?.trim())).toBe(true);
   // Content keys keep different meanings distinct and retain source IDs/text.
   expect(enriched.map(({id,type,...v})=>({id,type,german:'german' in v?v.german:'',english:v.english}))).toEqual(baseline);
   for(const direction of ['de-en','en-de'] as const){
    const cards=generateCards(enriched,level,{...settings,direction});
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every(c=>!!c.example?.trim())).toBe(true);
   }
  });
 }
 it('preserves original irregular-verb and preposition fields while adding sentence translations',()=>{
  for(const [prefix,type,file] of [['Verbs-','irregular_verb','irregular-verbs.json'],['Preposition-','verb_preposition','verbs-prepositions.json']]){
   const filename=fs.readdirSync('data-source').find(f=>f.startsWith(prefix))!;
   const baseline=convert(parseExport(fs.readFileSync(`data-source/${filename}`,'utf8')).rows,type);
   expect(addMissingExamples(baseline,examples)).toEqual(baseline);
   const published=JSON.parse(fs.readFileSync(`public/data/${file}`,'utf8'));
   expect(published.map(({exampleTranslation,...v}:Vocabulary)=>v)).toEqual(baseline);
   expect(published.every((v:Vocabulary)=>!!v.exampleTranslation)).toBe(true);
  }
 });
});


describe('paired sentence languages',()=>{
 it('parses translations and rejects empty or duplicate pairs',()=>{
  expect(parseExampleTranslations('example_de,example_en\nHallo!,Hello!').get('Hallo!')).toBe('Hello!');
  expect(()=>parseExampleTranslations('example_de,example_en\nHallo!,')).toThrow();
  expect(()=>parseExampleTranslations('example_de,example_en\nHallo!,Hello!\nHallo!,Hi!')).toThrow('Duplicate');
 });
 it('matches exact sentences and preserves supplied translations',()=>{
  const source={...entry,example:addition.example_de};
  const lookup=new Map([[addition.example_de,'I take an apple with me for the journey.']]);
  expect(addExampleTranslations([source],lookup)[0].exampleTranslation).toBe(lookup.get(addition.example_de));
  expect(source).not.toHaveProperty('exampleTranslation');
  expect(addExampleTranslations([{...source,exampleTranslation:'My own translation.'}],lookup)[0].exampleTranslation).toBe('My own translation.');
  expect(addExampleTranslations([{...source,example:'A revised German sentence.'}],lookup)[0]).not.toHaveProperty('exampleTranslation');
 });
 it('puts German context on the German side and English context on the English side',()=>{
  const v={...entry,example:'Ich esse einen Apfel.',exampleTranslation:'I eat an apple.'};
  const forward=generateCards([v],'general',settings)[0];
  expect(forward).toMatchObject({questionLanguage:'de',questionExample:v.example,answerLanguage:'en',answerExample:v.exampleTranslation});
  const reverse=generateCards([v],'general',{...settings,direction:'en-de'})[0];
  expect(reverse).toMatchObject({questionLanguage:'en',questionExample:v.exampleTranslation,answerLanguage:'de',answerExample:v.example});
 });
 it('pairs preposition examples and keeps target conjugations hidden until reveal',()=>{
  const prep:Vocabulary={id:'p',type:'verb_preposition',verb:'warten',preposition:'auf',case:'Akkusativ',prompt:'warten ____',meaningAndExample:'wait for',english:'wait for',example:'Ich warte auf dich.',exampleTranslation:'I am waiting for you.'};
  expect(generateCards([prep],'prep',settings)[0]).toMatchObject({questionExample:prep.example,answerExample:prep.exampleTranslation});
  const verb:Vocabulary={id:'v',type:'irregular_verb',infinitive:'gehen',english:'to go',perfekt:'ist gegangen',example:'Er ist gegangen.',exampleTranslation:'He has gone.'};
  const cards=generateCards([verb],'verbs',{...settings,exercises:['infinitive','perfekt']});
  expect(cards[0]).toMatchObject({questionLanguage:'en',questionExample:verb.exampleTranslation,answerLanguage:'de',answerExample:verb.example});
  expect(cards[1].questionExample).toBeUndefined();
  expect(cards[1].answerExample).toBe(verb.example);
 });
 it('never substitutes a German example on an English side when a translation is missing',()=>{
  const v={...entry,example:'Ich esse einen Apfel.'};
  expect(generateCards([v],'general',settings)[0].answerExample).toBeUndefined();
  expect(generateCards([v],'general',{...settings,direction:'en-de'})[0].questionExample).toBeUndefined();
 });
 it('has a translation for every published German example',()=>{
  const manifest=JSON.parse(fs.readFileSync('public/data/manifest.json','utf8'));
  for(const collection of manifest.collections){
   const entries=JSON.parse(fs.readFileSync(`public/data/${collection.file}`,'utf8')) as Vocabulary[];
   for(const v of entries){
    expect(v.example?.trim()).toBeTruthy();
    expect(v.exampleTranslation?.trim()).toBeTruthy();
    expect(v.exampleTranslation).toBe(translations.get(v.example!));
   }
  }
 });
});
