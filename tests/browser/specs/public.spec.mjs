import {test,expect} from '@playwright/test';

test.beforeEach(async ({page})=>{
  // No external provider, telemetry, email or payment request is allowed.
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://127.0.0.1:4173'?route.continue():route.abort();
  });
  await page.route('**/api/auth/channels',route=>route.fulfill({json:{stepUpEnabled:false,captchaRequired:false}}));
});
test('landing page renders and does not overflow',async({page})=>{
  const response=await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toContainText('Meu Ritmo');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+5)).toBeTruthy();
});
test('login navigation and password visibility',async({page})=>{
  await page.goto('/entrar');
  const form=page.locator('form');
  await expect(form.locator('[name=email]')).toBeVisible();
  const password=form.locator('[name=password]');
  await expect(password).toHaveAttribute('type','password');
  await form.locator('.authshowpassword').click();
  await expect(password).toHaveAttribute('type','text');
  await page.locator('a[href="/recuperar-senha"]').click();
  await expect(page).toHaveURL(/\/recuperar-senha/);
  await expect(page.locator('input[name=email]')).toBeVisible();
});
test('login error from mocked API is visible',async({page})=>{
  await page.route('**/api/auth/login',route=>route.fulfill({status:401,json:{error:'E-mail ou senha incorretos.'}}));
  await page.goto('/entrar');
  await page.locator('input[name=email]').fill('qa@example.invalid');
  await page.locator('input[name=password]').fill('Fake!Password');
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/entrar/);
});
test('recovery response is displayed without sending email',async({page})=>{
  await page.route('**/api/auth/recover',route=>route.fulfill({json:{message:'Resposta de recuperação de teste.'}}));
  await page.goto('/recuperar-senha');
  await page.locator('input[name=email]').fill('qa@example.invalid');
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('status')).toContainText('Resposta de recuperação de teste.');
});
test('signup checks password confirmation before network request',async({page})=>{
  let requests=0;
  await page.route('**/api/auth/signup',route=>{requests++;return route.abort();});
  await page.goto('/criar-conta');
  await page.locator('input[name=email]').fill('qa@example.invalid');
  await page.locator('input[name=password]').fill('Valid!Password');
  await page.locator('input[name=passwordConfirmation]').fill('Different!Password');
  await page.locator('input[name=phone]').fill('16999999999');
  await page.locator('input[name=username]').fill('quality_test');
  await page.locator('input[name=name]').fill('Quality Test');
  await page.locator('input[name=accept]').check();
  await page.locator('input[name=adult]').check();
  await page.locator('form button[type=submit]').click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(requests).toBe(0);
});
test('private workspace requires authentication',async({page})=>{
  await page.goto('/app');
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.locator('input[name=email]')).toBeVisible();
});
