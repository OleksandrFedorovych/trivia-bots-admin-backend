/**
 * Test Script for Trivia Bot
 * 
 * Run this to test the bot against a Crowd.live demo game.
 * Usage: node src/test.js [gameUrl]
 */

import { chromium } from 'playwright';
import { createProfile } from './players/playerSchema.js';
import logger from './utils/logger.js';

const GAME_URL = process.argv[2] || 'https://www.crowd.live/FNJCN';

async function testBot() {
  logger.info('=== Trivia Bot Test ===');
  logger.info(`Testing against: ${GAME_URL}`);
  
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 100,      // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // 1. Navigate to game
    logger.info('Step 1: Navigating to game...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 2. Fill registration form
    logger.info('Step 2: Filling registration form...');
    
    // Nickname
    const nicknameInput = await page.$('input[placeholder*="Nickname"]');
    if (nicknameInput) {
      await nicknameInput.fill('TestBot_' + Date.now());
      logger.info('  ✓ Nickname filled');
    } else {
      logger.warn('  ✗ Nickname field not found');
    }
    await page.waitForTimeout(500);

    // Email
    const emailInput = await page.$('input[placeholder*="Email"]');
    if (emailInput) {
      await emailInput.fill(`testbot${Date.now()}@example.com`);
      logger.info('  ✓ Email filled');
    } else {
      logger.warn('  ✗ Email field not found');
    }
    await page.waitForTimeout(500);

    // Phone (optional)
    const phoneInput = await page.$('input[type="tel"]');
    if (phoneInput) {
      await phoneInput.fill('5551234567');
      logger.info('  ✓ Phone filled');
    } else {
      logger.info('  - Phone field not found (may be optional)');
    }
    await page.waitForTimeout(500);

    // Take screenshot of filled form
    await page.screenshot({ path: 'screenshots/test-form-filled.png' });
    logger.info('  Screenshot saved: screenshots/test-form-filled.png');

    // 3. Click Join button
    logger.info('Step 3: Clicking Join button...');
    
    const joinSelectors = [
      'button:has-text("Join")',
      'text=Join',
      '[role="button"]:has-text("Join")',
    ];

    let joined = false;
    for (const selector of joinSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          logger.info(`  ✓ Clicked Join using: ${selector}`);
          joined = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!joined) {
      logger.warn('  ✗ Could not find Join button');
      // Try clicking by text content
      await page.click('text=Join').catch(() => {});
    }

    await page.waitForTimeout(3000);

    // 4. Check what state we're in
    logger.info('Step 4: Checking game state...');
    const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
    
    if (pageText.includes('will be activated') || pageText.includes('waiting')) {
      logger.info('  ✓ In waiting room - game not started yet');
    } else if (pageText.includes('question') || pageText.includes('answer')) {
      logger.info('  ✓ Game is active - questions visible');
    } else if (pageText.includes('error')) {
      logger.warn('  ✗ Error state detected');
    } else {
      logger.info('  ? Unknown state - check screenshot');
    }

    // Take screenshot of current state
    await page.screenshot({ path: 'screenshots/test-after-join.png' });
    logger.info('  Screenshot saved: screenshots/test-after-join.png');

    // 5. Wait and observe
    logger.info('Step 5: Waiting 10 seconds to observe...');
    await page.waitForTimeout(10000);

    // Final screenshot
    await page.screenshot({ path: 'screenshots/test-final.png' });
    logger.info('  Screenshot saved: screenshots/test-final.png');

    logger.info('=== Test Complete ===');
    logger.info('Check screenshots in the screenshots/ folder');

  } catch (error) {
    logger.error('Test failed:', { error: error.message });
    await page.screenshot({ path: 'screenshots/test-error.png' });
  } finally {
    await page.waitForTimeout(5000);  // Keep browser open briefly
    await browser.close();
  }
}

testBot().catch(console.error);


