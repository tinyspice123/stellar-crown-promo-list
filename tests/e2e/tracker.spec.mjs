import { test, expect } from '@playwright/test';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const SHEET = [
  'Group,Card,Number,Variant,Source,Status,Price,Have,Image',
  'Test Group,Pikachu,1/100,Standard,Playwright,,£1,TRUE,',
  'Test Group,Eevee,2/100,Standard,Playwright,,£2,FALSE,',
].join('\n');
const TEST_IMAGE = path.resolve('assets/icon-192.png');

async function mockTrackerData(page, highResolutionDelay = 0) {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }));
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('https://docs.google.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/csv',
    body: SHEET,
  }));
  await page.route('https://images.pokemontcg.io/**', async route => {
    if (highResolutionDelay && route.request().url().includes('_hires.png'))
      await delay(highResolutionDelay);
    await route.fulfill({ status: 200, contentType: 'image/png', path: TEST_IMAGE });
  });
}

test.beforeEach(async ({ page }) => {
  await mockTrackerData(page);
  await page.goto('/tracker.html?set=stellar-crown', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.item')).toHaveCount(2);
});

test('loads data and filters cards', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search cards' }).fill('Eevee');
  await expect(page.locator('.item')).toHaveCount(1);
  await expect(page.locator('.item .nm')).toHaveText('Eevee');
});

test('centres the lightbox across the viewport', async ({ page }) => {
  await page.locator('.item').first().locator('img').click();
  const lightbox = page.getByRole('dialog', { name: 'Card image viewer' });
  await expect(lightbox).toBeVisible();

  const box = await lightbox.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
});

test('hides the previous image while the next one loads', async ({ page }) => {
  await page.unroute('https://images.pokemontcg.io/**');
  await mockTrackerData(page, 400);

  await page.locator('.item').first().locator('img').click();
  const image = page.locator('#lbImg');
  await expect(image).not.toHaveClass(/loading/);
  await page.keyboard.press('Escape');

  await page.locator('.item').nth(1).locator('img').click();
  await expect(image).toHaveClass(/loading/);
  await expect(image).toBeHidden();
  await expect(image).not.toHaveClass(/loading/);
  await expect(image).toBeVisible();
});
