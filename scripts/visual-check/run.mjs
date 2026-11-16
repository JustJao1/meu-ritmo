import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const src=await readFile(new URL('../../lib/plans.ts',import.meta.url),'utf8');
const themes=[...src.matchAll(/\{id:'([^']+)',name:'([^']+)',description:'[^']+',paper:'(#[0-9a-f]+)'/g)]
 .map(([,id,name,paper])=>({id,name,paper}));
if(themes.length!==22)throw Error('Catálogo visual alterado: esperados 22 temas.');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
await mkdir('visual-artifacts',{recursive:true});
const results=[];
try{
 for(const viewport of [{width:1440,height:900,name:'desktop'},{width:390,height:844,name:'mobile'}]){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'pt-BR'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
   await page.goto('https://meuritmo.net/?demo=pro',{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('.premiumstudio .themelist button').first().waitFor({timeout:30000});
   for(const theme of themes){
    const selector=page.locator('.premiumstudio .themelist button').filter({
      has:page.getByText(theme.name,{exact:true})
    });
    if(await selector.count()!==1)throw Error('Tema não encontrado: '+theme.name);
    await selector.click();
    await page.getByRole('button',{name:'Aplicar ao meu espaço',exact:true}).click();
    await page.waitForFunction(({id,paper})=>{
      const root=document.documentElement;
      return root.dataset.theme===id&&
       getComputedStyle(root).getPropertyValue('--paper').trim().toLowerCase()===paper;
    },theme,{timeout:7000});
    const health=await page.evaluate(()=>{
      const root=document.documentElement;
      const scroller=document.scrollingElement||root;
      return {
        theme:root.dataset.theme,
        horizontalOverflow:scroller.scrollWidth>innerWidth+5,
        dialogWidth:document.querySelector('.overlay .dialog')?.getBoundingClientRect().width??0,
        dialogMaxWidth:innerWidth,
        mainVisible:!!document.querySelector('.appframe')
      };
    });
    if(health.horizontalOverflow||health.dialogWidth>health.dialogMaxWidth+5||!health.mainVisible)
      throw Error('Layout fora da tela: '+JSON.stringify(health));
    await page.screenshot({path:join('visual-artifacts',theme.id+'-'+viewport.name+'.png'),fullPage:true});
    results.push({theme:theme.id,viewport:viewport.name,ok:true});
   }
  }catch(error){
   results.push({viewport:viewport.name,ok:false,error:String(error)});
   await page.screenshot({path:join('visual-artifacts','failure-'+viewport.name+'.png'),fullPage:true}).catch(()=>{});
  }
  if(errors.length)results.push({viewport:viewport.name,ok:false,errors:errors.slice(0,8)});
  await context.close();
 }
}finally{await browser.close();}
const failures=results.filter(r=>!r.ok);
console.log(JSON.stringify({screenshots:results.filter(x=>x.ok).length,failures},null,2));
if(failures.length||results.filter(x=>x.ok).length!==44)process.exitCode=1;
