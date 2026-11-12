import {type Vocabulary,type Card,type Settings,exercises} from './types';
export function generateCards(entries:Vocabulary[],collectionId:string,settings:Settings):Card[]{
 const cards:Card[]=[];
 for(const v of entries){
  const add=(exercise:string,question:string,answer:string,example?:string,details?:string,sides:Partial<Pick<Card,'questionExample'|'answerExample'|'questionLanguage'|'answerLanguage'>>={})=>{
   if(question?.trim()&&answer?.trim())cards.push({id:`${collectionId}:${v.id}:${exercise}`,collectionId,vocabularyId:v.id,exercise,question,answer,example,details,...sides});
  };
  const translation=(german:string,english:string,example?:string,exampleTranslation?:string)=>{
   const germanFirst=settings.direction==='de-en';
   add(settings.direction,germanFirst?german:english,germanFirst?english:german,example,undefined,{
    questionLanguage:germanFirst?'de':'en',answerLanguage:germanFirst?'en':'de',
    questionExample:germanFirst?example:exampleTranslation,answerExample:germanFirst?exampleTranslation:example,
   });
  };
  switch(v.type){
   case 'general':translation(v.german,v.english,v.example,v.exampleTranslation);break;
   case 'verb_preposition':
    if(v.english)translation(`${v.verb} ${v.preposition} + ${v.case}`,v.english,v.example,v.exampleTranslation);
    else add('Complete the preposition',v.prompt,`${v.verb} ${v.preposition} + ${v.case}`,v.meaningAndExample,'Meaning & source example',{questionLanguage:'de',answerLanguage:'de',answerExample:v.meaningAndExample});
    break;
   case 'irregular_verb':
    for(const exercise of settings.exercises){
     const englishFirst=exercise==='infinitive';
     add(exercises[exercise],englishFirst?v.english:v.infinitive,englishFirst?v.infinitive:v[exercise]||'',v.example,v.usage,{
      questionLanguage:englishFirst?'en':'de',answerLanguage:'de',
      // Conjugation examples may contain the target form: show those only after reveal.
      questionExample:englishFirst?v.exampleTranslation:undefined,answerExample:v.example,
     });
    }
    break;
  }
 }
 return [...new Map(cards.map(c=>[c.id,c])).values()];
}
export function shuffle<T>(input:T[],random=Math.random):T[]{const result=[...input];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function orderCards(cards:Card[],order:Settings['order'],last?:string){const result=order==='random'?shuffle(cards):[...cards].sort((a,b)=>new Intl.Collator('de').compare(a.question,b.question));if(order==='random'&&result.length>1&&result[0].id===last)[result[0],result[1]]=[result[1],result[0]];return result;}
export class Sequence{
 private cycle:Card[]; private history:Card[]=[];private cursor=0;private position=0;
 constructor(private cards:Card[],private order:Settings['order']){if(!cards.length)throw new Error('No study cards');this.cycle=orderCards(cards,order);this.history=[this.cycle[0]];}
 get current(){return this.history[this.position];}
 next(){if(this.position<this.history.length-1){this.position++;return this.current;}this.cursor++;if(this.cursor===this.cycle.length){this.cycle=orderCards(this.cards,this.order,this.current.id);this.cursor=0;}this.history.push(this.cycle[this.cursor]);this.position++;return this.current;}
 previous(){this.position=Math.max(0,this.position-1);return this.current;}
}
export class PhaseClock{
 phase:'question'|'answer'='question';paused=false;remaining:number;private started:number;
 constructor(private questionMs:number,private answerMs:number,now:number){this.remaining=questionMs;this.started=now;}
 left(now:number){return Math.max(0,this.remaining-(this.paused?0:now-this.started));}
 pause(now:number){if(!this.paused){this.remaining=this.left(now);this.paused=true;}}
 resume(now:number){if(this.paused){this.started=now;this.paused=false;}}
 reset(now:number){this.phase='question';this.remaining=this.questionMs;this.started=now;}
 reveal(now:number){this.phase='answer';this.remaining=this.answerMs;this.started=now;}
 tick(now:number){if(this.paused||this.left(now)>0)return false;if(this.phase==='question'){this.reveal(now);return false;}this.reset(now);return true;}
}
