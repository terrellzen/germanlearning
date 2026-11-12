import {useEffect,useRef,useState} from 'react';
import {PhaseClock,Sequence} from './engine';
import type {Card,Settings} from './types';
export function useStudySession(cards:Card[],settings:Settings){
 const [sequence]=useState(()=>new Sequence(cards,settings.order));
 const clock=useRef(new PhaseClock(settings.questionSeconds*1000,settings.answerSeconds*1000,performance.now()));
 const [,render]=useState(0);const update=()=>render(n=>n+1);
 useEffect(()=>{if(settings.mode!=='automatic')return;
  const visibility=()=>{if(document.hidden){clock.current.pause(performance.now());update();}};
  document.addEventListener('visibilitychange',visibility);visibility();
  const timer=window.setInterval(()=>{if(clock.current.tick(performance.now()))sequence.next();update();},60);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
 },[sequence,settings.mode]);
 const navigate=(direction:'next'|'previous')=>{sequence[direction]();clock.current.reset(performance.now());update();};
 const reveal=()=>{clock.current.reveal(performance.now());update();};
 const toggle=()=>{const c=clock.current;c.paused?c.resume(performance.now()):c.pause(performance.now());update();};
 return {card:sequence.current,phase:clock.current.phase,paused:clock.current.paused,remaining:clock.current.left(performance.now()),navigate,reveal,toggle};
}
