/**
 * Crowd.live Page Actions
 * 
 * Low-level page interactions for the Crowd.live trivia platform.
 */

import selectors from '../config/selectors.js';
import { sleep, randomSleep } from '../utils/timing.js';
import { createPlayerLogger } from '../utils/logger.js';

/**
 * Page Actions class for interacting with Crowd.live
 */
export class PageActions {
  constructor(page, profile) {
    this.page = page;
    this.profile = profile;
    this.logger = createPlayerLogger(profile.id);
  }

  /**
   * Navigate to the game URL
   * @param {string} gameUrl - Game URL to navigate to
   */
  async navigateToGame(gameUrl) {
    this.logger.info(`Navigating to game: ${gameUrl}`);
    await this.page.goto(gameUrl, { waitUntil: 'networkidle' });
    await randomSleep(1000, 2000);
  }

  /**
   * Fill the registration form
   */
  async fillRegistrationForm() {
    this.logger.info('Filling registration form');
    const { registration } = selectors;

    // Wait for form to be ready
    await this.page.waitForSelector(registration.nicknameInput, { timeout: 10000 });

    // Fill nickname (required)
    this.logger.debug('Filling nickname');
    await this.fillField(registration.nicknameInput, this.profile.nickname);
    await randomSleep(300, 800);

    // Fill email if field exists
    this.logger.debug('Filling email');
    await this.fillField(registration.emailInput, this.profile.email);
    await randomSleep(300, 800);

    // Fill name if field exists
    if (this.profile.name) {
      this.logger.debug('Filling name');
      await this.fillField(registration.nameInput, this.profile.name);
      await randomSleep(300, 800);
    }

    // Fill phone if field exists
    if (this.profile.phone) {
      this.logger.debug('Filling phone');
      await this.fillPhoneField(this.profile.phone);
      await randomSleep(300, 800);
    }

    this.logger.info('Registration form filled');
  }

  /**
   * Fill a form field with error handling
   * @param {string} selector - Field selector
   * @param {string} value - Value to fill
   */
  async fillField(selector, value) {
    try {
      const field = await this.page.$(selector);
      if (field) {
        await field.click();
        await sleep(100);
        await field.fill('');
        await field.type(value, { delay: 50 + Math.random() * 50 });
        return true;
      }
    } catch (e) {
      this.logger.debug(`Field not found or not fillable: ${selector}`);
    }
    return false;
  }

  /**
   * Country code to local phone number length mapping
   */
  static COUNTRY_PHONE_LENGTHS = {
    '1': 10,    // US, Canada
    '7': 10,    // Russia, Kazakhstan
    '20': 10,   // Egypt
    '27': 9,    // South Africa
    '30': 10,   // Greece
    '31': 9,    // Netherlands
    '32': 9,    // Belgium
    '33': 9,    // France
    '34': 9,    // Spain
    '36': 9,    // Hungary
    '39': 10,   // Italy
    '40': 10,   // Romania
    '41': 9,    // Switzerland
    '43': 10,   // Austria
    '44': 10,   // UK
    '45': 8,    // Denmark
    '46': 9,    // Sweden
    '47': 8,    // Norway
    '48': 9,    // Poland
    '49': 10,   // Germany
    '51': 9,    // Peru
    '52': 10,   // Mexico
    '53': 8,    // Cuba
    '54': 10,   // Argentina
    '55': 11,   // Brazil
    '56': 9,    // Chile
    '57': 10,   // Colombia
    '58': 10,   // Venezuela
    '60': 9,    // Malaysia
    '61': 9,    // Australia
    '62': 10,   // Indonesia
    '63': 10,   // Philippines
    '64': 9,    // New Zealand
    '65': 8,    // Singapore
    '66': 9,    // Thailand
    '81': 10,   // Japan
    '82': 10,   // South Korea
    '84': 9,    // Vietnam
    '86': 11,   // China
    '90': 10,   // Turkey
    '91': 10,   // India
    '92': 10,   // Pakistan
    '93': 9,    // Afghanistan
    '94': 9,    // Sri Lanka
    '95': 9,    // Myanmar
    '98': 10,   // Iran
    '212': 9,   // Morocco
    '213': 9,   // Algeria
    '216': 8,   // Tunisia
    '218': 9,   // Libya
    '220': 7,   // Gambia
    '234': 10,  // Nigeria
    '254': 9,   // Kenya
    '255': 9,   // Tanzania
    '256': 9,   // Uganda
    '260': 9,   // Zambia
    '263': 9,   // Zimbabwe
    '351': 9,   // Portugal
    '352': 9,   // Luxembourg
    '353': 9,   // Ireland
    '354': 7,   // Iceland
    '358': 9,   // Finland
    '370': 8,   // Lithuania
    '371': 8,   // Latvia
    '372': 8,   // Estonia
    '380': 9,   // Ukraine
    '381': 9,   // Serbia
    '385': 9,   // Croatia
    '386': 8,   // Slovenia
    '420': 9,   // Czech Republic
    '421': 9,   // Slovakia
    '852': 8,   // Hong Kong
    '853': 8,   // Macau
    '855': 9,   // Cambodia
    '856': 10,  // Laos
    '880': 10,  // Bangladesh
    '886': 9,   // Taiwan
    '960': 7,   // Maldives
    '961': 8,   // Lebanon
    '962': 9,   // Jordan
    '963': 9,   // Syria
    '964': 10,  // Iraq
    '965': 8,   // Kuwait
    '966': 9,   // Saudi Arabia
    '967': 9,   // Yemen
    '968': 8,   // Oman
    '970': 9,   // Palestine
    '971': 9,   // UAE
    '972': 9,   // Israel
    '973': 8,   // Bahrain
    '974': 8,   // Qatar
    '975': 8,   // Bhutan
    '976': 8,   // Mongolia
    '977': 10,  // Nepal
    '992': 9,   // Tajikistan
    '993': 8,   // Turkmenistan
    '994': 9,   // Azerbaijan
    '995': 9,   // Georgia
    '996': 9,   // Kyrgyzstan
    '998': 9,   // Uzbekistan
  };

  /**
   * Get phone length for a country code
   * @param {string} countryCode - Country dial code (without +)
   * @returns {number} Expected phone number length
   */
  static getPhoneLengthForCountry(countryCode) {
    // Try exact match first
    if (PageActions.COUNTRY_PHONE_LENGTHS[countryCode]) {
      return PageActions.COUNTRY_PHONE_LENGTHS[countryCode];
    }
    // Default to 9 if unknown
    return 9;
  }

  /**
   * Fill phone field with correct digit count for the country
   * @param {string} phone - Phone number (any format, preferably with country code like +1)
   */
  async fillPhoneField(phone) {
    const { registration } = selectors;

    try {
      // Extract country code and determine required length
      let countryCode = '49'; // Default (based on what we see in dropdown)
      let allDigits = phone.replace(/\D/g, '');

      // Try to extract country code from phone
      if (phone.startsWith('+')) {
        // Try 3-digit country codes first, then 2, then 1
        for (const len of [3, 2, 1]) {
          const possibleCode = allDigits.slice(0, len);
          if (PageActions.COUNTRY_PHONE_LENGTHS[possibleCode]) {
            countryCode = possibleCode;
            allDigits = allDigits.slice(len); // Remove country code from digits
            break;
          }
        }
      }

      // Get required length for this country
      const requiredLength = PageActions.getPhoneLengthForCountry(countryCode);

      // Take the right number of digits (pad with random digits if too short)
      let phoneDigits = allDigits.slice(0, requiredLength);
      while (phoneDigits.length < requiredLength) {
        phoneDigits += Math.floor(Math.random() * 10).toString();
      }

      this.logger.debug(`Phone: ${phone} -> Country +${countryCode}, Required: ${requiredLength} digits, Entering: ${phoneDigits}`);

      // Find the phone input field
      const phoneInput = await this.page.$(registration.phoneInput);
      if (!phoneInput) {
        this.logger.debug('Phone input field not found');
        return false;
      }

      // Focus the input by clicking
      await phoneInput.click();
      await sleep(300);

      // Clear using multiple methods to ensure it's empty
      await this.page.keyboard.down('Control');
      await this.page.keyboard.press('a');
      await this.page.keyboard.up('Control');
      await sleep(100);
      await this.page.keyboard.press('Delete');
      await sleep(100);

      await this.page.keyboard.press('Home');
      await sleep(50);
      await this.page.keyboard.down('Shift');
      await this.page.keyboard.press('End');
      await this.page.keyboard.up('Shift');
      await sleep(50);
      await this.page.keyboard.press('Delete');
      await sleep(100);

      // Type the digits one by one
      for (const digit of phoneDigits) {
        await this.page.keyboard.type(digit);
        await sleep(50 + Math.random() * 50);
      }

      this.logger.info(`Phone number entered: ${phoneDigits} (${requiredLength} digits for +${countryCode})`);
      return true;

    } catch (error) {
      this.logger.error('Failed to fill phone field', { error: error.message });
      return false;
    }
  }

  /**
   * Handle returning player screen (Welcome back / Continue Playing)
   * @returns {Promise<boolean>} True if handled, false if not on this screen
   */
  async handleReturningPlayer() {
    try {
      // Check page text for returning player indicators
      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());

      if (pageText.includes('welcome back') || pageText.includes('continue playing')) {
        this.logger.info('Detected returning player screen');
        return await this.clickContinuePlaying();
      }
    } catch (e) {
      this.logger.debug('Not on returning player screen or error checking');
    }
    return false;
  }

  /**
   * Click the Continue Playing button (for returning players)
   * @returns {Promise<boolean>} True if clicked successfully
   */
  async clickContinuePlaying() {
    const continueSelectors = [
      'button:has-text("Continue Playing")',
      'button:has-text("Continue")',
      'button:has-text("Play")',
      'text=Continue Playing',
      'text=Continue',
    ];

    for (const selector of continueSelectors) {
      try {
        const btn = await this.page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          this.logger.info(`Clicking Continue Playing using: ${selector}`);
          await randomSleep(500, 1000);
          await btn.click();
          await randomSleep(1500, 2500);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    this.logger.warn('Could not find Continue Playing button');
    return false;
  }

  /**
   * Click the join button
   */
  async clickJoin() {
    this.logger.info('Clicking join button');

    try {
      // First check for returning player screen
      const wasReturning = await this.handleReturningPlayer();
      if (wasReturning) {
        return true;
      }

      // Try multiple approaches to find and click the join button
      const joinSelectors = [
        'button:has-text("Join")',
        'text=Join',
        'button:has-text("JOIN")',
        '[role="button"]:has-text("Join")',
        'div:has-text("Join"):not(:has(*))',  // Leaf element with Join text
      ];

      for (const selector of joinSelectors) {
        try {
          const button = await this.page.locator(selector).first();
          if (await button.isVisible()) {
            await randomSleep(200, 500);
            await button.click();
            this.logger.info(`Join button clicked using: ${selector}`);

            // After clicking join, check for returning player screen
            await randomSleep(1000, 2000);
            await this.handleReturningPlayer();

            return true;
          }
        } catch (e) {
          this.logger.debug(`Selector failed: ${selector}`);
          continue;
        }
      }

      // Fallback: Try clicking by coordinates if button is visible
      this.logger.warn('Trying coordinate-based click for Join button');
      const joinText = await this.page.locator('text=Join').first();
      if (joinText) {
        const box = await joinText.boundingBox();
        if (box) {
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          this.logger.info('Join button clicked via coordinates');

          // Check for returning player screen
          await randomSleep(1000, 2000);
          await this.handleReturningPlayer();

          return true;
        }
      }

      this.logger.warn('Could not find join button');
      return false;
    } catch (error) {
      this.logger.error('Failed to click join button', { error: error.message });
      return false;
    }
  }

  /**
   * Type text with human-like delays
   * @param {string} selector - Input selector
   * @param {string} text - Text to type
   */
  async typeWithHumanDelay(selector, text) {
    const element = await this.page.$(selector);
    if (!element) {
      this.logger.warn(`Element not found: ${selector}`);
      return;
    }

    await element.click();
    await sleep(100);

    // Clear existing content
    await element.fill('');

    // Type with delays
    for (const char of text) {
      await element.type(char, { delay: 50 + Math.random() * 100 });
    }
  }

  /**
   * Detect the type of question currently displayed
   * @returns {Promise<string>} Question type: 'multiple_choice', 'number_input', 'drag_reorder', 'true_false', 'unknown'
   */
  async detectQuestionType() {
    try {
      // Check for NUMBER INPUT field first (important!)
      const numberInput = await this.page.$('input[type="number"], input[type="tel"], input[inputmode="numeric"], input[placeholder*="number"], input[placeholder*="answer"]');
      if (numberInput) {
        return 'number_input';
      }

      // Check for A/B/C/D buttons (multiple choice)
      const abcdButtons = await this.page.$$('button:has-text("A."), button:has-text("B.")');
      if (abcdButtons.length >= 2) {
        return 'multiple_choice';
      }

      // Check for Grip Icon buttons (drag to reorder)
      const gripButtons = await this.page.$$('button[name*="Grip Icon"]');
      if (gripButtons.length > 0) {
        return 'drag_reorder';
      }

      // Check for True/False
      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());
      if (pageText.includes('true') && pageText.includes('false')) {
        const tfButtons = await this.page.$$('button:has-text("True"), button:has-text("False")');
        if (tfButtons.length >= 2) {
          return 'true_false';
        }
      }

      // Check for any text input field (generic text answer)
      const textInput = await this.page.$('input[type="text"]:not([readonly]), textarea');
      if (textInput) {
        return 'text_input';
      }

      // Check for image-based answers (buttons with images but no letter labels)
      const imageButtons = await this.page.$$('button img, button [class*="image"]');
      if (imageButtons.length > 0) {
        return 'image';
      }

      // Check for any clickable answer areas
      const answerAreas = await this.page.$$('[class*="answer"], [class*="option"], [class*="choice"]');
      if (answerAreas.length > 0) {
        return 'clickable_area';
      }

      return 'unknown';
    } catch (error) {
      this.logger.warn('Could not detect question type', { error: error.message });
      return 'unknown';
    }
  }

  /**
   * Get all answer options on the current question
   * @returns {Promise<object>} { type: string, options: array }
   */
  async getAnswerOptions() {
    try {
      const questionType = await this.detectQuestionType();
      this.logger.info(`Question type detected: ${questionType}`);

      let options = [];

      switch (questionType) {
        case 'multiple_choice':
          // Standard A/B/C/D buttons
          for (let i = 0; i < 4; i++) {
            const letter = String.fromCharCode(65 + i);
            try {
              const btn = await this.page.$(`button:has-text("${letter}.")`);
              if (btn) {
                const text = await btn.textContent();
                options.push({ text: text?.trim() || letter, index: i, type: 'letter' });
              }
            } catch (e) { /* continue */ }
          }
          break;

        case 'number_input':
        case 'text_input':
          // For input questions, we return a single "option" representing the input field
          options.push({ text: 'Number/Text Input', index: 0, type: 'input' });
          break;

        case 'drag_reorder':
          // Grip Icon buttons for drag questions
          const gripButtons = await this.page.$$('button[name*="Grip Icon"]');
          for (let i = 0; i < gripButtons.length; i++) {
            const name = await gripButtons[i].getAttribute('name');
            const text = name?.replace('Grip Icon ', '') || `Item ${i + 1}`;
            options.push({ text: text.trim(), index: i, type: 'drag' });
          }
          break;

        case 'true_false':
          // True/False buttons
          const trueBtn = await this.page.$('button:has-text("True")');
          const falseBtn = await this.page.$('button:has-text("False")');
          if (trueBtn) options.push({ text: 'True', index: 0, type: 'tf' });
          if (falseBtn) options.push({ text: 'False', index: 1, type: 'tf' });
          break;

        case 'image':
        case 'clickable_area':
        default:
          // Get ALL clickable elements more aggressively
          // First try: buttons with any content
          const allButtons = await this.page.$$('button');
          let buttonIndex = 0;
          for (const btn of allButtons) {
            try {
              const isVisible = await btn.isVisible();
              if (!isVisible) continue;

              const text = await btn.textContent() || '';
              const name = await btn.getAttribute('name') || '';
              const className = await btn.getAttribute('class') || '';

              // Skip obvious nav buttons
              const lowerText = text.toLowerCase();
              if (lowerText.includes('sign out') ||
                lowerText.includes('profile') ||
                lowerText.includes('privacy') ||
                lowerText.includes('close') ||
                lowerText.includes('mute') ||
                lowerText.includes('menu') ||
                lowerText.includes('policy')) {
                continue;
              }

              // Include this button
              options.push({
                text: (name || text || `Button ${buttonIndex + 1}`).trim().substring(0, 50),
                index: buttonIndex,
                type: 'generic'
              });
              buttonIndex++;
            } catch (e) { /* skip this button */ }
          }

          // If still no options, try clickable divs/spans in answer areas
          if (options.length === 0) {
            this.logger.debug('No buttons found, trying clickable divs');
            const clickables = await this.page.$$('[class*="answer"], [class*="option"], [class*="choice"], [role="button"]');
            for (let i = 0; i < clickables.length && i < 10; i++) {
              try {
                const isVisible = await clickables[i].isVisible();
                if (isVisible) {
                  const text = await clickables[i].textContent() || `Clickable ${i + 1}`;
                  options.push({ text: text.trim().substring(0, 50), index: i, type: 'clickable' });
                }
              } catch (e) { /* skip */ }
            }
          }
      }

      this.logger.info(`Found ${options.length} answer options of type: ${questionType}`);
      return { type: questionType, options };
    } catch (error) {
      this.logger.warn('Could not get answer options', { error: error.message });
      return { type: 'unknown', options: [] };
    }
  }

  /**
   * Click an answer option by index and type
   * @param {number} index - Option index (0-based)
   * @param {string} questionType - Type of question ('multiple_choice', 'number_input', etc.)
   */
  async clickAnswer(index, questionType = 'multiple_choice') {
    try {
      this.logger.info(`Answering question type: ${questionType}`);

      switch (questionType) {
        case 'multiple_choice':
          return await this.clickMultipleChoiceAnswer(index);

        case 'number_input':
          return await this.submitNumberInput();

        case 'text_input':
          return await this.submitTextInput();

        case 'drag_reorder':
          return await this.clickDragReorderAnswer(index);

        case 'true_false':
          return await this.clickTrueFalseAnswer(index);

        case 'image':
          return await this.clickImageAnswer(index);

        case 'clickable_area':
        case 'generic':
        default:
          return await this.clickGenericAnswer(index);
      }
    } catch (error) {
      this.logger.error('Failed to answer', { error: error.message });
      return false;
    }
  }

  /**
   * Submit a number input answer
   */
  async submitNumberInput() {
    try {
      // Find the number input field
      const inputSelectors = [
        'input[type="number"]',
        'input[type="tel"]',
        'input[inputmode="numeric"]',
        'input[placeholder*="number"]',
        'input[placeholder*="answer"]',
        'input:not([type="hidden"]):not([readonly])'
      ];

      let input = null;
      for (const selector of inputSelectors) {
        input = await this.page.$(selector);
        if (input) break;
      }

      if (!input) {
        this.logger.warn('No number input field found');
        return false;
      }

      // Generate a random number (reasonable range for trivia)
      const randomNumber = Math.floor(Math.random() * 100) + 1;

      // Clear the input and type the number
      await input.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Delete');

      // Type the number
      await input.type(String(randomNumber), { delay: 50 });
      this.logger.info(`Typed number: ${randomNumber}`);

      // Try to submit - look for submit button or press Enter
      const submitBtn = await this.page.$('button[type="submit"], button:has-text("Submit"), button:has-text("OK"), button:has-text("Confirm")');
      if (submitBtn) {
        await submitBtn.click();
        this.logger.info('Clicked submit button');
      } else {
        await this.page.keyboard.press('Enter');
        this.logger.info('Pressed Enter to submit');
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to submit number input', { error: error.message });
      return false;
    }
  }

  /**
   * Submit a text input answer
   */
  async submitTextInput() {
    try {
      // Find text input
      const input = await this.page.$('input[type="text"]:not([readonly]), textarea');
      if (!input) {
        this.logger.warn('No text input field found');
        return false;
      }

      // Type a generic answer
      const answers = ['yes', 'no', 'true', 'false', '1', '2', '3', '4'];
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

      await input.click();
      await this.page.keyboard.press('Control+A');
      await this.page.keyboard.press('Delete');
      await input.type(randomAnswer, { delay: 50 });
      this.logger.info(`Typed text: ${randomAnswer}`);

      // Submit
      const submitBtn = await this.page.$('button[type="submit"], button:has-text("Submit"), button:has-text("OK")');
      if (submitBtn) {
        await submitBtn.click();
      } else {
        await this.page.keyboard.press('Enter');
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to submit text input', { error: error.message });
      return false;
    }
  }

  /**
   * Click a multiple choice answer (A, B, C, D)
   */
  async clickMultipleChoiceAnswer(index) {
    const letter = String.fromCharCode(65 + index); // A, B, C, D
    this.logger.debug(`Clicking multiple choice: ${letter}`);

    const patterns = [
      `button:has-text("${letter}.")`,
      `text=${letter}.`,
      `button >> text=${letter}`,
    ];

    for (const pattern of patterns) {
      try {
        const btn = await this.page.locator(pattern).first();
        if (await btn.isVisible({ timeout: 500 })) {
          await btn.click({ force: true, timeout: 2000 });
          this.logger.info(`Clicked answer ${letter} using: ${pattern}`);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    // JavaScript fallback
    return await this.clickByJavaScript(index);
  }

  /**
   * Handle drag-to-reorder questions
   * This performs actual drag-and-drop to reorder items randomly
   */
  async clickDragReorderAnswer(index) {
    this.logger.debug('Handling drag-to-reorder question');

    try {
      // Find all draggable items
      const draggableSelectors = [
        'button[name*="Grip Icon"]',
        '[draggable="true"]',
        '[class*="draggable"]',
        '[class*="sortable"]',
        '[data-draggable]',
      ];

      let items = [];
      for (const selector of draggableSelectors) {
        items = await this.page.$$(selector);
        if (items.length > 1) break;
      }

      if (items.length < 2) {
        this.logger.warn('Not enough draggable items found');
        return await this.clickByJavaScript(index);
      }

      this.logger.info(`Found ${items.length} draggable items`);

      // Shuffle the items randomly (simulate random ordering)
      const shuffledIndices = this.shuffleArray([...Array(items.length).keys()]);
      this.logger.info(`Random order: ${shuffledIndices.map(i => i + 1).join(' -> ')}`);

      // Perform drag-and-drop for each item to create random order
      for (let i = 0; i < shuffledIndices.length - 1; i++) {
        const fromIndex = shuffledIndices[i];
        const toIndex = shuffledIndices[i + 1];

        if (fromIndex !== toIndex) {
          await this.dragAndDrop(items[fromIndex], items[toIndex]);
          await sleep(300);
        }
      }

      // Look for submit/confirm button after reordering
      const submitSelectors = [
        'button:has-text("Submit")',
        'button:has-text("Confirm")',
        'button:has-text("Done")',
        'button:has-text("Lock In")',
        'button[type="submit"]',
      ];

      for (const selector of submitSelectors) {
        try {
          const btn = await this.page.$(selector);
          if (btn && await btn.isVisible()) {
            await btn.click();
            this.logger.info(`Clicked submit button for drag question: ${selector}`);
            return true;
          }
        } catch (e) { /* continue */ }
      }

      this.logger.info('Drag reorder completed (no submit button found)');
      return true;
    } catch (e) {
      this.logger.debug(`Drag reorder failed: ${e.message}`);
      return await this.clickByJavaScript(index);
    }
  }

  /**
   * Perform drag and drop between two elements
   */
  async dragAndDrop(source, target) {
    try {
      const sourceBox = await source.boundingBox();
      const targetBox = await target.boundingBox();

      if (!sourceBox || !targetBox) {
        this.logger.debug('Could not get bounding boxes for drag');
        return false;
      }

      const sourceCenter = {
        x: sourceBox.x + sourceBox.width / 2,
        y: sourceBox.y + sourceBox.height / 2,
      };
      const targetCenter = {
        x: targetBox.x + targetBox.width / 2,
        y: targetBox.y + targetBox.height / 2,
      };

      // Perform drag with mouse events
      await this.page.mouse.move(sourceCenter.x, sourceCenter.y);
      await this.page.mouse.down();
      await sleep(100);

      // Move in steps for smoother animation
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const x = sourceCenter.x + (targetCenter.x - sourceCenter.x) * (i / steps);
        const y = sourceCenter.y + (targetCenter.y - sourceCenter.y) * (i / steps);
        await this.page.mouse.move(x, y);
        await sleep(50);
      }

      await this.page.mouse.up();
      this.logger.debug('Drag and drop completed');
      return true;
    } catch (error) {
      this.logger.debug(`Drag and drop failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Click a True/False answer
   */
  async clickTrueFalseAnswer(index) {
    const answer = index === 0 ? 'True' : 'False';
    this.logger.debug(`Clicking True/False: ${answer}`);

    try {
      const btn = await this.page.locator(`button:has-text("${answer}")`).first();
      if (await btn.isVisible({ timeout: 500 })) {
        await btn.click({ force: true, timeout: 2000 });
        this.logger.info(`Clicked ${answer}`);
        return true;
      }
    } catch (e) {
      this.logger.debug(`True/False click failed: ${e.message}`);
    }

    return await this.clickByJavaScript(index);
  }

  /**
   * Click an image-based answer
   */
  async clickImageAnswer(index) {
    this.logger.debug(`Clicking image answer ${index + 1}`);

    try {
      // Find image answer containers
      const imageSelectors = [
        'button img',                    // Buttons containing images
        'button [class*="image"]',       // Buttons with image classes
        '[class*="answer"] img',         // Answer containers with images
        '[class*="option"] img',         // Option containers with images
        'img[class*="answer"]',          // Images with answer class
        'img[class*="option"]',          // Images with option class
        '[role="button"] img',           // Role buttons with images
      ];

      // Try to find clickable image elements
      for (const selector of imageSelectors) {
        const elements = await this.page.$$(selector);
        const visibleElements = [];

        for (const el of elements) {
          try {
            if (await el.isVisible()) {
              visibleElements.push(el);
            }
          } catch (e) { /* skip */ }
        }

        if (visibleElements.length > 0 && index < visibleElements.length) {
          // Click the parent button/container of the image
          const element = visibleElements[index];

          // Try to click the parent first (likely the button)
          const parent = await element.evaluateHandle(el => el.parentElement);
          if (parent) {
            try {
              await parent.asElement()?.click({ force: true });
              this.logger.info(`Clicked image answer ${index + 1} (parent)`);
              return true;
            } catch (e) { /* try element directly */ }
          }

          // Click the element directly
          await element.click({ force: true });
          this.logger.info(`Clicked image answer ${index + 1}`);
          return true;
        }
      }

      // Fallback: find any button with image and click by index
      const allImageButtons = await this.page.$$('button:has(img)');
      if (allImageButtons.length > 0 && index < allImageButtons.length) {
        await allImageButtons[index].click({ force: true });
        this.logger.info(`Clicked image button ${index + 1} (fallback)`);
        return true;
      }

    } catch (e) {
      this.logger.debug(`Image click failed: ${e.message}`);
    }

    // Final fallback to generic JavaScript click
    return await this.clickByJavaScript(index);
  }

  /**
   * Click a generic answer button (fallback for unknown types)
   */
  async clickGenericAnswer(index) {
    this.logger.debug(`Clicking generic answer ${index + 1}`);
    return await this.clickByJavaScript(index);
  }

  /**
   * Click answer using JavaScript (bypasses all Playwright checks)
   */
  async clickByJavaScript(index) {
    const clicked = await this.page.evaluate((idx) => {
      // First try: buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      const answerButtons = buttons.filter(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        const rect = btn.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.top > 0;
        return isVisible &&
          !text.includes('sign out') &&
          !text.includes('profile') &&
          !text.includes('privacy') &&
          !text.includes('close') &&
          !text.includes('mute') &&
          !text.includes('menu') &&
          !text.includes('policy');
      });

      if (idx >= 0 && idx < answerButtons.length) {
        answerButtons[idx].click();
        return { clicked: true, type: 'button' };
      }

      // Second try: clickable elements with answer/option/choice classes
      const clickables = Array.from(document.querySelectorAll('[class*="answer"], [class*="option"], [class*="choice"], [role="button"]'));
      const visibleClickables = clickables.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top > 100;
      });

      if (idx >= 0 && idx < visibleClickables.length) {
        visibleClickables[idx].click();
        return { clicked: true, type: 'clickable' };
      }

      // Third try: any large visible element in the main content area
      const allElements = Array.from(document.querySelectorAll('div, span, a'));
      const contentElements = allElements.filter(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 100 &&
          rect.height > 50 &&
          rect.top > 200 &&
          rect.top < window.innerHeight - 100 &&
          style.cursor === 'pointer';
      });

      if (idx >= 0 && idx < contentElements.length) {
        contentElements[idx].click();
        return { clicked: true, type: 'content' };
      }

      return { clicked: false, type: 'none' };
    }, index);

    if (clicked.clicked) {
      this.logger.info(`Clicked answer ${index + 1} via JavaScript (${clicked.type})`);
      return true;
    }

    this.logger.warn(`Could not click answer ${index + 1}`);
    return false;
  }

  /**
   * Get the current question text
   * @returns {Promise<string>} Question text
   */
  async getQuestionText() {
    const { question } = selectors;

    try {
      await this.page.waitForSelector(question.text, { timeout: 5000 });
      const text = await this.page.$eval(question.text, el => el.textContent?.trim() || '');
      return text;
    } catch (error) {
      this.logger.warn('Could not get question text');
      return '';
    }
  }

  /**
   * Get remaining time from timer
   * @returns {Promise<number|null>} Seconds remaining or null
   */
  async getTimeRemaining() {
    const { timer } = selectors;

    try {
      const timerEl = await this.page.$(timer.countdown);
      if (!timerEl) return null;

      const text = await timerEl.textContent();

      // Parse time formats like "0:15" or "15"
      const match = text?.match(/(\d+):?(\d+)?/);
      if (match) {
        if (match[2]) {
          return parseInt(match[1]) * 60 + parseInt(match[2]);
        }
        return parseInt(match[1]);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if answer was correct
   * @returns {Promise<boolean|null>} true=correct, false=wrong, null=unknown
   */
  async checkAnswerResult() {
    try {
      // Small delay for feedback to appear
      await sleep(500);

      // Get page text to check for result indicators
      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());

      // Crowd.live specific patterns for correct/wrong
      // Check for correct indicators
      if (pageText.includes('correct') ||
        pageText.includes('right answer') ||
        pageText.includes('you got it') ||
        pageText.includes('nice!') ||
        pageText.includes('great job')) {
        this.logger.debug('Detected CORRECT answer feedback');
        return true;
      }

      // Check for incorrect indicators
      if (pageText.includes('wrong') ||
        pageText.includes('incorrect') ||
        pageText.includes('time has run out') ||
        pageText.includes('too slow') ||
        pageText.includes('not quite')) {
        this.logger.debug('Detected WRONG answer feedback');
        return false;
      }

      // Try checking for visual feedback (green = correct, red = wrong)
      const greenElements = await this.page.$$('[class*="correct"], [class*="green"], [class*="success"]');
      const redElements = await this.page.$$('[class*="incorrect"], [class*="wrong"], [class*="red"], [class*="error"]');

      if (greenElements.length > redElements.length) {
        this.logger.debug('Detected CORRECT via green elements');
        return true;
      }
      if (redElements.length > greenElements.length) {
        this.logger.debug('Detected WRONG via red elements');
        return false;
      }

      return null;
    } catch (error) {
      this.logger.debug('Error checking answer result', { error: error.message });
      return null;
    }
  }

  /**
   * Check if current screen is a ranking/leaderboard screen
   * @returns {Promise<boolean>} True if on ranking screen
   */
  async isRankingScreen() {
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText.toLowerCase());

      // Check for ranking indicators
      return pageText.includes('ranking') ||
        pageText.includes('leaderboard') ||
        pageText.includes('standings') ||
        pageText.includes('scoreboard') ||
        (pageText.includes('place') && pageText.match(/\d+(st|nd|rd|th)\s*place/i));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the bot's current ranking from "Your ranking: XX" text
   * @param {string} nickname - The bot's nickname (not used, we look for "Your ranking")
   * @returns {Promise<object|null>} { rank: number, score: number } or null
   */
  async getCurrentRanking(nickname) {
    try {
      const pageText = await this.page.evaluate(() => document.body.innerText);

      // Look for "Your ranking: XX" pattern (Crowd.live specific)
      const rankingMatch = pageText.match(/your ranking[:\s]*#?(\d+)/i);

      if (rankingMatch) {
        const rank = parseInt(rankingMatch[1]);

        // Also try to find score/points
        const scoreMatch = pageText.match(/(\d+)\s*point/i);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

        return { rank, score };
      }

      // Fallback: Look for any ranking pattern
      const fallbackMatch = pageText.match(/#(\d+)\s*(?:place|rank)/i);
      if (fallbackMatch) {
        return { rank: parseInt(fallbackMatch[1]), score: null };
      }

      return null;
    } catch (error) {
      this.logger.debug('Could not get ranking', { error: error.message });
      return null;
    }
  }

  /**
   * Get current score
   * @returns {Promise<number|null>} Current score or null
   */
  async getCurrentScore() {
    const { score } = selectors;

    try {
      const scoreEl = await this.page.$(score.currentScore);
      if (!scoreEl) return null;

      const text = await scoreEl.textContent();
      const match = text?.match(/(\d+)/);
      return match ? parseInt(match[1]) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Take a screenshot for debugging
   * @param {string} name - Screenshot name
   */
  async takeScreenshot(name) {
    const timestamp = Date.now();
    const filename = `screenshots/${this.profile.id}-${name}-${timestamp}.png`;
    await this.page.screenshot({ path: filename });
    this.logger.debug(`Screenshot saved: ${filename}`);
  }
}

export default PageActions;




