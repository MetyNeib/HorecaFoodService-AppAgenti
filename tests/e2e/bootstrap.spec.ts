import { test, expect } from '@playwright/test';
// Bootstrap smoke test ONLY. Replace with the complete acceptance suite during implementation.
test('bootstrap loads synthetic catalog with no horizontal overflow', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'La base del progetto è pronta.'})).toBeVisible();
  await page.getByLabel('Cerca per nome o codice nel seed').fill('0107417');
  await expect(page.getByText('Birra Lager Adriatica 66 cl',{exact:true})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBe(false);
});
