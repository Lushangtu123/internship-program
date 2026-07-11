import { test, expect } from '@playwright/test';

const commentsHeading = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: /comments/i });

const feedScroll = (page: import('@playwright/test').Page) =>
  page.getByTestId('feed-scroll');

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

    // Dismiss first-visit mute coach if present so it doesn't intercept
    const tip = page.getByRole('button', { name: /tap for sound/i });
    if (await tip.isVisible().catch(() => false)) {
      await tip.click();
      await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
      // mute again for the control under test
      await page.getByLabel(/mute/i).first().click();
      await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    }

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
    const feed = feedScroll(page);

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
    // Wait until the initial comments fetch finishes so it doesn't wipe optimistic UI
    await expect(
      page.getByRole('dialog', { name: /comments/i }).locator('.animate-spin')
    ).toHaveCount(0);

    const text = `Test comment from e2e ${Date.now()}`;
    const input = page.getByPlaceholder(/add a comment/i);
    await input.fill(text);
    await page.getByRole('dialog', { name: /comments/i }).locator('button[type="submit"]').click();

    await expect(page.getByText(text).first()).toBeVisible({ timeout: 10000 });
  });

  test('should close comments drawer', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(commentsHeading(page)).toBeVisible();

    await page
      .getByRole('dialog', { name: /comments/i })
      .getByLabel('Close comments')
      .click();

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

    const feed = feedScroll(page);
    await expect
      .poll(
        async () =>
          feed.evaluate((el) => {
            const height = el.clientHeight || 1;
            return el.scrollTop / height;
          }),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0.5);

    await expect(page.getByText(target.caption, { exact: false }).first()).toBeVisible();
  });

  test('should show not-found banner for missing ?v=', async ({ page }) => {
    await page.goto('/?v=definitely_missing_video_id');
    await expect(page.getByText('Video not found')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Video not found')).toHaveCount(0);
  });
});
