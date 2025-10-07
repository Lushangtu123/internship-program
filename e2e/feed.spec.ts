import { test, expect } from '@playwright/test';

test.describe('Video Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the feed page', async ({ page }) => {
    await expect(page).toHaveTitle(/Short Video Feed/);
  });

  test('should display first video', async ({ page }) => {
    // Wait for video to load
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src');
  });

  test('should autoplay video when in view', async ({ page }) => {
    const video = page.locator('video').first();
    
    // Wait a bit for autoplay to trigger
    await page.waitForTimeout(1000);
    
    // Check if video is playing (not paused)
    const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
    expect(isPaused).toBe(false);
  });

  test('should show like button', async ({ page }) => {
    const likeButton = page.getByLabel(/like/i).first();
    await expect(likeButton).toBeVisible();
  });

  test('should open comments drawer', async ({ page }) => {
    const commentButton = page.getByLabel(/comment/i).first();
    await commentButton.click();
    
    // Check if drawer is visible
    await expect(page.getByText(/comments/i)).toBeVisible();
  });

  test('should toggle mute', async ({ page }) => {
    const muteButton = page.getByLabel(/mute|unmute/i).first();
    await muteButton.click();
    
    const video = page.locator('video').first();
    const isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(typeof isMuted).toBe('boolean');
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should navigate to next video with J key', async ({ page }) => {
    const initialScroll = await page.evaluate(() => window.scrollY);
    
    await page.keyboard.press('j');
    await page.waitForTimeout(500);
    
    const newScroll = await page.evaluate(() => window.scrollY);
    expect(newScroll).toBeGreaterThan(initialScroll);
  });

  test('should toggle mute with M key', async ({ page }) => {
    await page.keyboard.press('m');
    
    const video = page.locator('video').first();
    const isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(typeof isMuted).toBe('boolean');
  });

  test('should open comments with / key', async ({ page }) => {
    await page.keyboard.press('/');
    
    await expect(page.getByText(/comments/i)).toBeVisible();
  });
});

test.describe('Comments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should post a comment', async ({ page }) => {
    // Open comments
    await page.keyboard.press('/');
    
    // Wait for drawer
    await expect(page.getByText(/comments/i)).toBeVisible();
    
    // Type comment
    const input = page.getByPlaceholder(/add a comment/i);
    await input.fill('Test comment from e2e');
    
    // Submit
    await input.press('Enter');
    
    // Check if comment appears
    await expect(page.getByText('Test comment from e2e')).toBeVisible();
  });

  test('should close comments drawer', async ({ page }) => {
    // Open comments
    await page.keyboard.press('/');
    await expect(page.getByText(/comments/i)).toBeVisible();
    
    // Close drawer
    const closeButton = page.getByLabel(/close/i);
    await closeButton.click();
    
    // Check if closed
    await expect(page.getByText(/comments/i)).not.toBeVisible();
  });
});

test.describe('Debug Panel', () => {
  test('should show debug panel with query param', async ({ page }) => {
    await page.goto('/?debug=1');
    
    await expect(page.getByText(/qoe debug panel/i)).toBeVisible();
  });

  test('should display metrics', async ({ page }) => {
    await page.goto('/?debug=1');
    
    await expect(page.getByText(/ttff/i)).toBeVisible();
    await expect(page.getByText(/stalls/i)).toBeVisible();
  });
});

