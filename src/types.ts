export type General = {id:string;type:'general';german:string;english:string;level?:string;example?:string;exampleTranslation?:string;exampleSource?:'authored'};
export type Irregular = {id:string;type:'irregular_verb';infinitive:string;english:string;praesens?:string;praeteritum?:string;perfekt?:string;example?:string;exampleTranslation?:string;usage?:string};
export type Preposition = {id:string;type:'verb_preposition';verb:string;preposition:string;case:string;prompt:string;meaningAndExample:string;english?:string;example?:string;exampleTranslation?:string};
export type Vocabulary = General|Irregular|Preposition;
export type Collection = {id:string;name:string;description:string;type:Vocabulary['type'];file:string;count:number};
export type Exercise = 'infinitive'|'praesens'|'praeteritum'|'perfekt';
export type Settings = {selected:string[];exercises:Exercise[];direction:'de-en'|'en-de';order:'random'|'alphabetical';mode:'automatic'|'manual';questionSeconds:number;answerSeconds:number;examples:boolean;countdown:boolean};
export type Card = {id:string;collectionId:string;vocabularyId:string;exercise:string;question:string;answer:string;example?:string;details?:string;questionExample?:string;answerExample?:string;questionLanguage?:'de'|'en';answerLanguage?:'de'|'en'};
export const exercises:Record<Exercise,string> = {infinitive:'English → Infinitive',praesens:'Infinitive → Präsens',praeteritum:'Infinitive → Präteritum',perfekt:'Infinitive → Perfekt'};
export function validVocabulary(v:unknown):v is Vocabulary {
 if(!v || typeof v!=='object') return false;
 const r=v as Record<string,unknown>; const has=(...keys:string[])=>keys.every(k=>typeof r[k]==='string' && !!r[k]);
 if(!has('id')||(r.exampleTranslation!==undefined&&typeof r.exampleTranslation!=='string')) return false;
 switch(r.type){case 'general':return has('german','english')&&(r.example===undefined||typeof r.example==='string')&&(r.exampleSource===undefined||r.exampleSource==='authored');case 'irregular_verb':return has('infinitive','english')&&['praesens','praeteritum','perfekt','example','usage'].every(k=>r[k]===undefined||typeof r[k]==='string');case 'verb_preposition':return has('verb','preposition','case','prompt','meaningAndExample');default:return false;}
}
