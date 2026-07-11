import { test, expect } from '@playwright/test';

const commentsHeading = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: /comments/i });

test.describe('Video Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('video').first().waitFor({ state: 'visible' });
  });

  test('should load the feed page', async ({ page }) => {
    await expect(page).toHaveTitle(/Short Video Feed/);
  });

  test('should display first video', async ({ page }) => {
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', /.+/);
  });

  test('should autoplay video when in view', async ({ page }) => {
    const video = page.locator('video').first();

    // Wait until the player leaves the paused state (muted autoplay allowed)
    await expect
      .poll(async () => video.evaluate((v: HTMLVideoElement) => !v.paused), {
        timeout: 10000,
      })
      .toBe(true);
  });

  test('should show like button', async ({ page }) => {
    const likeButton = page.getByLabel(/like/i).first();
    await expect(likeButton).toBeVisible();
  });

  test('should open comments drawer', async ({ page }) => {
    const commentButton = page.getByLabel(/comment/i).first();
    await commentButton.click();
    await expect(commentsHeading(page)).toBeVisible();
  });

  test('should toggle mute', async ({ page }) => {
    const video = page.locator('video').first();

    // Autoplay starts muted
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

    const muteButton = page.getByLabel(/unmute/i).first();
    await muteButton.click();

    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('video').first().waitFor({ state: 'visible' });
  });

  test('should navigate to next video with J key', async ({ page }) => {
    const feed = page.locator('.h-screen.overflow-y-scroll').first();

    const initialScroll = await feed.evaluate((el) => el.scrollTop);
    await page.keyboard.press('j');

    await expect
      .poll(async () => feed.evaluate((el) => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(initialScroll);
  });

  test('should toggle mute with M key', async ({ page }) => {
    const video = page.locator('video').first();
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

    await page.keyboard.press('m');
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  });

  test('should open comments with / key', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(commentsHeading(page)).toBeVisible();
  });
});

test.describe('Comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('video').first().waitFor({ state: 'visible' });
  });

  test('should post a comment', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(commentsHeading(page)).toBeVisible();

    const input = page.getByPlaceholder(/add a comment/i);
    await input.fill('Test comment from e2e');
    await input.press('Enter');

    await expect(page.getByText('Test comment from e2e')).toBeVisible();
  });

  test('should close comments drawer', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(commentsHeading(page)).toBeVisible();

    const closeButton = page.getByLabel(/close/i);
    await closeButton.click();

    await expect(commentsHeading(page)).toHaveCount(0);
  });
});

test.describe('Deep link', () => {
  test('should scroll to the video in ?v=', async ({ page, request }) => {
    const response = await request.get('/api/videos?limit=5&feed=foryou');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(1);
    const target = data.items[1];

    await page.goto(`/?v=${target.id}`);
    await page.locator('video').first().waitFor({ state: 'visible' });

    const feed = page.locator('.h-screen.overflow-y-scroll').first();
    await expect
      .poll(async () => feed.evaluate((el) => el.scrollTop), { timeout: 10000 })
      .toBeGreaterThan(100);

    await expect(page.getByText(target.caption, { exact: false }).first()).toBeVisible();
  });
});
