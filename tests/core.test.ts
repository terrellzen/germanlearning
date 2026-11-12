import {describe,it,expect} from 'vitest';
import {parseExport,convert} from '../scripts/import-vocabulary';
import {PhaseClock,Sequence,generateCards,orderCards,shuffle} from '../src/engine';
import {validVocabulary,type Settings,type Card} from '../src/types';
const settings:Settings={selected:[],exercises:['infinitive','perfekt','praesens'],direction:'de-en',order:'random',mode:'automatic',questionSeconds:10,answerSeconds:5,examples:true,countdown:true};
const cards=['Öl','Apfel','Zug'].map((question,i)=>({id:String(i),collectionId:'a',vocabularyId:String(i),exercise:'de-en',question,answer:'answer'})) as Card[];
describe('Anki import',()=>{
 it('reads metadata, umlauts, quoted delimiters and multiline fields',()=>{const result=parseExport('#separator:tab\n#html:false\nDeck\t"Öl\nStraße"\t"oil\tand more"\ttag\n');expect(result.rows[0]).toEqual(['Deck','Öl\nStraße','oil\tand more','tag']);});
 it('supports quoted CSV',()=>expect(parseExport('Deck,"word, phrase",translation,tags').rows[0][1]).toBe('word, phrase'));
 it('rejects malformed rows',()=>expect(()=>parseExport('a\tb')).toThrow());
 it('deduplicates exact words and preserves different meanings',()=>{const rows=[['deck','an.sehen','to see',''],['deck','an🞌sehen','to see',''],['deck','ansehen','to view','']];expect(convert(rows,'general')).toHaveLength(2);expect(convert(rows,'general')).toEqual(convert(rows,'general'));});
 it('keeps verb senses separate and merges exercise decks',()=>{const rows=[['English to Infinitiv','to like  Wie heißt das Verb auf Deutsch?','mögen  Beispiel: Ich mag Kaffee.  Gebrauch: Akk',''],['Infinitiv → Perfekt','mögen','Perfekt: hat gemocht  English: to like Gebrauch: Akk',''],['Infinitiv → Perfekt','mögen','Perfekt: hat wollen / gewollt  English: would like Gebrauch: Modalverb','']];const out=convert(rows,'irregular_verb');expect(out).toHaveLength(2);expect(out[0]).toMatchObject({perfekt:'hat gemocht',example:'Ich mag Kaffee.'});});
 it('preserves distinct prepositions and raw combined explanation',()=>{const out=convert([['deck','denken ____','denken an (+A) — think of Ich denke an dich.',''],['deck','denken ____','denken über (+A) — think about Ich denke darüber.','']],'verb_preposition');expect(out).toHaveLength(2);expect(out[0]).toMatchObject({preposition:'an',case:'Akkusativ',meaningAndExample:'think of Ich denke an dich.'});});
});
describe('cards and ordering',()=>{
 it('generates only available selected forms',()=>{const out=generateCards([{id:'v',type:'irregular_verb',infinitive:'gehen',english:'to go',perfekt:'ist gegangen'}],'verbs',settings);expect(out.map(c=>c.answer)).toEqual(['gehen','ist gegangen']);expect(new Set(out.map(c=>c.id)).size).toBe(2);});
 it('reverses general vocabulary',()=>expect(generateCards([{id:'a',type:'general',german:'Öl',english:'oil'}],'a',{...settings,direction:'en-de'})[0]).toMatchObject({question:'oil',answer:'Öl'}));
 it('rejects bad runtime records',()=>{expect(validVocabulary({id:'a',type:'general',german:'x'})).toBe(false);expect(validVocabulary({id:'a',type:'irregular_verb',infinitive:'gehen',english:'go',perfekt:123})).toBe(false);});
 it('sorts German and never mutates originals',()=>{expect(orderCards(cards,'alphabetical').map(c=>c.question)).toEqual(['Apfel','Öl','Zug']);expect(shuffle(cards,()=>0)).toHaveLength(3);expect(cards[0].question).toBe('Öl');});
 it('cycles without immediate boundary repeats and preserves navigation history',()=>{const s=new Sequence(cards,'random');const first=[s.current.id,s.next().id,s.next().id];expect(new Set(first).size).toBe(3);const last=s.current.id;const next=s.next().id;expect(next).not.toBe(last);expect(s.previous().id).toBe(last);expect(s.next().id).toBe(next);});
 it('loops one-card decks and alphabetical decks',()=>{const single=new Sequence([cards[0]],'random');expect(single.next().id).toBe(cards[0].id);const s=new Sequence(cards,'alphabetical');expect([s.current.question,s.next().question,s.next().question,s.next().question]).toEqual(['Apfel','Öl','Zug','Apfel']);});
 it('rejects empty sessions',()=>expect(()=>new Sequence([],'random')).toThrow());
});
describe('monotonic phase clock',()=>{
 it('reveals at 10 seconds and advances at 15',()=>{const c=new PhaseClock(10000,5000,0);expect(c.tick(9999)).toBe(false);expect(c.phase).toBe('question');expect(c.tick(10000)).toBe(false);expect(c.phase).toBe('answer');expect(c.tick(14999)).toBe(false);expect(c.tick(15000)).toBe(true);expect(c.phase).toBe('question');});
 it('preserves remaining time through hidden-tab pause and resume',()=>{const c=new PhaseClock(10000,5000,0);c.pause(4000);c.pause(8000);expect(c.left(100000)).toBe(6000);expect(c.tick(100000)).toBe(false);c.resume(100000);expect(c.left(102000)).toBe(4000);expect(c.tick(106000)).toBe(false);expect(c.phase).toBe('answer');});
 it('does not skip cards after delayed callbacks',()=>{const c=new PhaseClock(10000,5000,0);expect(c.tick(100000)).toBe(false);expect(c.phase).toBe('answer');expect(c.left(100000)).toBe(5000);});
 it('resets navigation and supports explicit reveal while paused',()=>{const c=new PhaseClock(10000,5000,0);c.pause(4000);c.reveal(5000);expect(c.paused).toBe(true);expect(c.left(9000)).toBe(5000);c.reset(10000);expect(c.phase).toBe('question');expect(c.left(20000)).toBe(10000);});
});
