import { expect } from '@playwright/test';

export async function login(page) {
  await page.goto('/users/sign_in');
  await page.getByLabel('Email', { exact: true }).fill('ui@hfs.invalid');
  await page.getByLabel('Password', { exact: true }).fill('HfsDemoLocale2026!');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.waitForFunction(() => window.HFS?.client?.record);
}

export async function reset(page) {
  const response = await page.evaluate(async () => {
    const snapshot = await (await fetch('/snapshot')).json();
    const result = await fetch('/commands', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': snapshot.csrfToken, 'X-HFS-User-Id': String(snapshot.user.id) },
      body: JSON.stringify({ operationId: crypto.randomUUID(), baseVersion: snapshot.version, epoch: snapshot.epoch, type: 'RESET_DEMO', payload: {} }),
    });
    return { status: result.status, text: await result.text() };
  });
  expect(response.status, response.text).toBe(200);
  await page.goto('/');
}


export async function snapshot(page) { await page.waitForFunction(() => window.HFS?.client?.snapshot); return page.evaluate(() => window.HFS.client.snapshot); }

export async function openFooter(page) {
  // Command state is published before the replacement HTML is mounted. Wait for
  // that render, including the scheduled demo sync, before opening its controls.
  await page.waitForFunction(() => {
    const client = window.HFS?.client;
    const source = document.getElementById('workspace-bootstrap');
    if (!client?.record || !source || client.syncing || client.record.outbox.length) return false;
    const rendered = JSON.parse(source.textContent);
    return rendered.version === client.snapshot.version && client.snapshot.state.network !== 'SYNCING';
  });
  const dock = page.locator('.status-dock');
  if (await dock.getAttribute('data-open') !== 'true') await page.locator('.footer-toggle').click();
  const status = page.getByRole('button', { name: 'Stato sincronizzazione', exact: true });
  await status.focus();
  await status.press('Shift');
  await expect(dock).toHaveAttribute('data-open', 'true');
}
