import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:4173')return route.abort();
    // The demo must not modify authenticated account data.
    if(url.pathname.startsWith('/api/')&&route.request().method()!=='GET')return route.abort();
    return route.continue();
  });
  await page.goto('/?demo=pro');
  const studio=page.locator('[aria-labelledby="paneltitle"]');
  await expect(studio).toBeVisible();
  await studio.locator('header button[aria-label="Fechar"]').click();
  await expect(page.locator('.appframe')).toBeVisible();
});
async function openItem(page,type){
  await page.locator('.todayleft .addinline').click();
  const dialog=page.locator('[aria-labelledby="formtitle"]');
  await expect(dialog).toBeVisible();
  if(type!=='Tarefa')await dialog.locator('.typepicker').getByRole('button',{name:type,exact:true}).click();
  return dialog;
}
async function title(dialog,value){
  await dialog.locator('input[required]').first().fill(value);
}
async function save(dialog){
  await dialog.locator('button[type=submit]').click();
  await expect(dialog).toBeHidden();
}
test('demo: create, complete and edit a task',async({page})=>{
  let dialog=await openItem(page,'Tarefa');
  await title(dialog,'QA task fixture');
  await save(dialog);
  let row=page.locator('.taskrow').filter({hasText:'QA task fixture'});
  await expect(row).toBeVisible();
  await row.getByRole('button',{name:'Concluir QA task fixture',exact:true}).click();
  await expect(row).toHaveClass(/completed/);
  await row.locator('.tasktitle').click();
  dialog=page.locator('[aria-labelledby="formtitle"]');
  await title(dialog,'QA task edited');
  await save(dialog);
  await expect(page.locator('.taskrow').filter({hasText:'QA task edited'})).toBeVisible();
  await expect(row).toHaveCount(0);
});
test('demo: add expense and verify listed amount',async({page})=>{
  await page.locator('.financeopen').click();
  await page.getByRole('button',{name:'Registrar gasto',exact:true}).click();
  const dialog=page.locator('[aria-labelledby="formtitle"]');
  await title(dialog,'QA expense fixture');
  await dialog.locator('input[type=number]').fill('17.25');
  await save(dialog);
  const row=page.locator('.expenserow').filter({hasText:'QA expense fixture'});
  await expect(row).toBeVisible();
  await expect(row).toContainText(/17,25/);
});
test('demo: create a calendar event and reminder',async({page})=>{
  let dialog=await openItem(page,'Compromisso');
  await title(dialog,'QA calendar fixture');
  const times=dialog.locator('input[type=time]');
  await times.nth(0).fill('10:00');
  await times.nth(1).fill('11:00');
  await save(dialog);
  await expect(page.locator('.eventrow').filter({hasText:'QA calendar fixture'})).toBeVisible();
  dialog=await openItem(page,'Lembrete');
  await title(dialog,'QA reminder fixture');
  await dialog.locator('input[type=time]').fill('12:00');
  await save(dialog);
  await expect(page.locator('.remindercard').getByRole('button',{name:/QA reminder fixture/})).toBeVisible();
});
