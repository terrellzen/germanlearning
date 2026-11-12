import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const all=['vocabulary-a1','vocabulary-a2','verbs-prepositions','irregular-verbs'].flatMap(name=>JSON.parse(fs.readFileSync(new URL(`public/data/${name}.json`,root),'utf8')));
const score=v=>(v.german||v.infinitive||`${v.verb} ${v.preposition}`).length*5+(v.english||'').length*5+(v.example||'').length+(v.exampleTranslation||'').length;
const candidates=[...new Map([...all].sort((a,b)=>score(b)-score(a)).slice(0,24).concat(
 ...['irregular_verb','verb_preposition'].map(type=>all.filter(v=>v.type===type).sort((a,b)=>score(b)-score(a)).slice(0,4))
).map(v=>[v.id,v])).values()];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
const sizes=[{width:568,height:280},{width:667,height:320},{width:812,height:375},{width:932,height:430}];
try{
 for(const theme of ['light','dark'])for(const mode of ['manual','automatic'])for(const direction of ['de-en','en-de']){
  const page=await browser.newPage({viewport:sizes[0],colorScheme:theme});
  await page.route('**/data/manifest.json',route=>route.fulfill({json:{collections:[{id:'a1',name:'Landscape test vocabulary',type:'general',description:'Real vocabulary with the longest text',file:'landscape.json',count:candidates.length}]}}));
  await page.route('**/data/landscape.json',route=>route.fulfill({json:candidates}));
  await page.goto(process.env.BASE_URL||'http://localhost:5173');
  await page.waitForFunction(()=>!document.querySelector('.start')?.disabled);
  if(mode==='manual')await page.getByRole('button',{name:/Manual flashcards/}).click();
  await page.getByLabel('Vocabulary direction').selectOption(direction);
  await page.getByLabel('Card order').selectOption('alphabetical');
  await page.waitForFunction(()=>!document.querySelector('.start')?.disabled);
  await page.getByRole('button',{name:'Start learning'}).click();
  if(mode==='automatic')await page.getByRole('button',{name:'Pause',exact:false}).click();
  for(let card=0;card<candidates.length;card++){
   await page.getByRole('button',{name:'Reveal answer'}).click();
   for(const size of sizes){
    await page.setViewportSize(size);
    const geometry=await page.evaluate(()=>({
     width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
     contentBottom:document.querySelector('.study-content').getBoundingClientRect().bottom,
     textBottom:Math.max(...[...document.querySelectorAll('.question-side h1,.answer h2,.example,.grammar')].map(e=>e.getBoundingClientRect().bottom)),
     content:[...document.querySelectorAll('.question-side h1,.answer h2,.example,.grammar,.playback button,.study-top button')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};}),
    }));
    assert(geometry.scrollWidth<=geometry.width&&geometry.scrollHeight<=geometry.height,`${direction} ${size.width}x${size.height} scrolls: ${JSON.stringify(geometry)}`);
    assert(geometry.textBottom<=geometry.contentBottom+1,`${direction}: text overlaps playback controls ${JSON.stringify(geometry)}`);
    for(const box of geometry.content)assert(box.left>=-1&&box.top>=-1&&box.right<=size.width+1&&box.bottom<=size.height+1,`${direction}: content outside viewport ${JSON.stringify(box)}`);
   }
   if(card===0){
    await page.setViewportSize(sizes[0]);
    await page.screenshot({path:fileURLToPath(new URL(`data/landscape-${theme}-preview.png`,root))});
    const question=await page.locator('.question-side h1').innerText();
    await page.setViewportSize({width:375,height:812});
    assert.equal(await page.locator('.question-side h1').innerText(),question);
    assert.equal(await page.locator('.topbar').isVisible(),true);
    await page.setViewportSize(sizes[0]);
    assert.equal(await page.locator('.topbar').isVisible(),false);
    await page.getByRole('button',{name:'Show example sentences',exact:true}).click();
    assert.equal(await page.locator('.example').count(),0);
    await page.getByRole('button',{name:'Show example sentences',exact:true}).click();
   }
   await page.getByRole('button',{name:/^Next/}).click();
  }
  await page.close();
  console.log(`${theme} ${mode} ${direction}: passed`);
 }
 console.log(`Landscape: ${candidates.length} long real cards, both themes/modes/directions, rotation, four phone sizes fit without scrolling.`);
}finally{await browser.close();}
