import Papa from 'papaparse';
import type {Vocabulary} from '../src/types';

export type AuthoredExample = {id:string;german:string;english:string;example_de:string};

/** Keep examples separate from the original exports and join on stable sense IDs. */
export function parseAuthoredExamples(text:string):Map<string,AuthoredExample>{
 const parsed=Papa.parse<AuthoredExample>(text.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:true});
 if(parsed.errors.length)throw new Error(`Invalid examples CSV: ${JSON.stringify(parsed.errors)}`);
 const columns=['id','german','english','example_de'];
 if(!columns.every(c=>parsed.meta.fields?.includes(c)))throw new Error('Examples CSV requires id, german, english, and example_de columns');
 const examples=new Map<string,AuthoredExample>();
 for(const row of parsed.data){
  if(!columns.every(c=>typeof row[c as keyof AuthoredExample]==='string')||!row.id.trim()||!row.german.trim()||!row.example_de.trim())throw new Error(`Incomplete example: ${row.id || '(missing ID)'}`);
  if(examples.has(row.id))throw new Error(`Duplicate example ID: ${row.id}`);
  examples.set(row.id,row);
 }
 return examples;
}

export function addMissingExamples(entries:Vocabulary[],examples:Map<string,AuthoredExample>):Vocabulary[]{
 return entries.map(entry=>{
  // A supplied example always wins. Other deck types are never enriched here.
  if(entry.type!=='general'||entry.example?.trim())return entry;
  const addition=examples.get(entry.id);
  if(!addition)return entry;
  if(addition.german!==entry.german||addition.english!==entry.english)throw new Error(`Example does not match vocabulary sense: ${entry.id}`);
  return {...entry,example:addition.example_de,exampleSource:'authored'};
 });
}

export function parseExampleTranslations(text:string):Map<string,string>{
 const parsed=Papa.parse<{example_de:string;example_en:string}>(text.replace(/^\uFEFF/,''),{header:true,skipEmptyLines:true});
 if(parsed.errors.length||!['example_de','example_en'].every(c=>parsed.meta.fields?.includes(c)))throw new Error('Invalid translations CSV: requires example_de and example_en columns');
 const result=new Map<string,string>();
 for(const row of parsed.data){
  if(!row.example_de?.trim()||!row.example_en?.trim())throw new Error('Both sentence languages are required');
  if(result.has(row.example_de))throw new Error(`Duplicate sentence translation: ${row.example_de}`);
  result.set(row.example_de,row.example_en);
 }
 return result;
}

/** Translation lookup uses the complete German sentence, so edits cannot reuse stale English. */
export function addExampleTranslations(entries:Vocabulary[],translations:Map<string,string>):Vocabulary[]{
 return entries.map(entry=>{
  if(!entry.example?.trim()||entry.exampleTranslation?.trim())return entry;
  const translated=translations.get(entry.example);
  return translated?{...entry,exampleTranslation:translated}:entry;
 });
}
