import {execFileSync} from 'node:child_process';
import {cpSync,existsSync,mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const command=(bin,args,options={})=>execFileSync(bin,args,{cwd:root,encoding:'utf8',...options});
const git=(args,options={})=>command('git',['-c','credential.helper=','-c','credential.helper=!gh auth git-credential',...args],options);
const gh=args=>command('gh',args);
const repository=JSON.parse(gh(['repo','view','--json','nameWithOwner'])).nameWithOwner;
if(!/^[\w.-]+\/[\w.-]+$/.test(repository))throw new Error('Invalid repository name');
if(git(['status','--porcelain']).trim())throw new Error('Commit source changes before publishing so build.json identifies the deployed source.');
const [owner,name]=repository.split('/');
let pages;
try{pages=JSON.parse(gh(['api',`repos/${repository}/pages`]));}
catch(e){if(!String(e.stderr).includes('404'))throw e;}
const customDomain=pages?.cname;
const base=customDomain||name.toLowerCase()===`${owner.toLowerCase()}.github.io`?'/':`/${name}/`;
const sourceCommit=git(['rev-parse','HEAD']).trim();
for(const task of ['validate:vocab','test','build'])command('npm',['run',task],{stdio:'inherit',env:{...process.env,VITE_BASE_PATH:base}});
const dist=path.join(root,'dist');
if(!existsSync(path.join(dist,'index.html')))throw new Error('Production build is missing index.html');
writeFileSync(path.join(dist,'.nojekyll'),'');
if(customDomain)writeFileSync(path.join(dist,'CNAME'),customDomain+'\n');
writeFileSync(path.join(dist,'build.json'),JSON.stringify({repository,sourceCommit,base},null,2)+'\n');
const checkout=mkdtempSync(path.join(tmpdir(),'stillwort-pages-'));
try{
 git(['init','--initial-branch=gh-pages'],{cwd:checkout});
 git(['remote','add','origin',`https://github.com/${repository}.git`],{cwd:checkout});
 for(const [key,fallback]of [['user.name','Stillwort deployment'],['user.email',`${owner}@users.noreply.github.com`]]){
  let value=fallback;try{value=git(['config','--get',key]).trim()||fallback;}catch{}
  git(['config',key,value],{cwd:checkout});
 }
 const existing=git(['ls-remote','--heads','origin','gh-pages'],{cwd:checkout}).trim();
 if(existing){
  git(['fetch','--depth=1','origin','gh-pages'],{cwd:checkout});
  git(['checkout','-B','gh-pages','FETCH_HEAD'],{cwd:checkout});
 }
 for(const file of readdirSync(checkout))if(file!=='.git')rmSync(path.join(checkout,file),{recursive:true,force:true});
 cpSync(dist,checkout,{recursive:true});
 git(['add','--all'],{cwd:checkout});
 if(!existing||git(['diff','--cached','--name-only'],{cwd:checkout}).trim()){
  git(['commit','-m',`Publish Stillwort from ${sourceCommit.slice(0,7)}`],{cwd:checkout,stdio:'inherit'});
  git(['push','origin','HEAD:gh-pages'],{cwd:checkout,stdio:'inherit'});
 }
 const body=JSON.stringify({build_type:'legacy',source:{branch:'gh-pages',path:'/'}});
 if(!pages||pages.build_type!=='legacy'||pages.source?.branch!=='gh-pages'||pages.source?.path!=='/'){
  command('gh',['api','--method',pages?'PUT':'POST',`repos/${repository}/pages`,'--input','-'],{input:body});
 }
 console.log(`Publication requested: ${customDomain?`https://${customDomain}/`:`https://${owner}.github.io${base}`}`);
 console.log(`Source commit: ${sourceCommit}`);
 console.log(`Check status: gh api repos/${repository}/pages/builds/latest`);
}finally{rmSync(checkout,{recursive:true,force:true});}
