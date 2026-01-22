/**
 * Crowd.live DOM Selectors
 * 
 * These selectors are used to interact with the Crowd.live trivia platform.
 * Update these if the platform's HTML structure changes.
 */

export const selectors = {
  // Registration Form - Updated for Crowd.live
  registration: {
    nicknameInput: 'input[placeholder*="Nickname"], input[name*="nickname"]',
    nameInput: 'input[placeholder*="Name"]:not([placeholder*="Nickname"])',
    emailInput: 'input[placeholder*="Email"], input[type="email"]',
    phoneInput: 'input[type="tel"]',
    countryCodeDropdown: '.flag-dropdown, .selected-flag, [class*="flag"]',
    joinButton: 'button:has-text("Join")',
    joinButtonAlt: 'text=Join',
  },

  // Game States - arrays of selectors to try (updated for Crowd.live)
  gameState: {
    waitingRoom: [
      'text=/will be activated shortly/i',
      'text=/waiting/i',
      'text=/game will start/i',
      'text=/hang tight/i'
    ],
    countdown: [
      '[class*="countdown"]',
      '[class*="timer"]',
      'text=/starting in/i',
      'text=/get ready/i'
    ],
    questionActive: [
      'section',
      '[role="button"]',
      'button:has-text("Grip Icon")',
      '[class*="question"]',
      '[class*="trivia"]'
    ],
    gameEnded: [
      'text=/game over/i',
      'text=/final scores/i',
      'text=/leaderboard/i',
      'text=/thanks for playing/i',
      'text=/final results/i'
    ],
  },

  // Question & Answers - Updated for Crowd.live structure
  question: {
    container: 'section, [class*="question"], [class*="trivia"]',
    text: 'h1, h2, h3, [class*="question"] p, section p',
    optionsContainer: 'section, [class*="answer"], [class*="option"]',
    // Crowd.live uses buttons with various patterns
    optionButton: 'button[name*="Grip Icon"], button:has-text("A."), button:has-text("B."), button:has-text("C."), button:has-text("D."), [role="button"]',
    optionText: 'span, p, [class*="text"]',
  },

  // Timer & Progress - Updated for Crowd.live
  timer: {
    // Crowd.live shows timer as text like "0:12" or "0:00"
    countdown: '[class*="timer"], [class*="countdown"], text=/\\d+:\\d{2}/',
    progressBar: 'progressbar, [role="progressbar"], [class*="progress"]',
    timeText: '[class*="time"], text=/\\d+:\\d{2}/',
  },

  // Answer Feedback
  feedback: {
    correct: '[class*="correct"], [class*="right"], [class*="green"], text=/correct/i',
    incorrect: '[class*="incorrect"], [class*="wrong"], [class*="red"], text=/wrong/i',
    selected: '[class*="selected"], [aria-selected="true"]',
    locked: '[class*="locked"], [disabled], text=/time has run out/i',
  },

  // Score & Leaderboard - Updated for Crowd.live
  score: {
    // Crowd.live shows points as "48 Points" or "0 Points"
    currentScore: 'text=/\\d+ Point/i, [class*="score"], [class*="points"]',
    rank: '[class*="rank"], [class*="position"]',
    leaderboard: '[class*="leaderboard"], [class*="standings"]',
  },

  // General UI
  ui: {
    loadingSpinner: '[class*="loading"], [class*="spinner"]',
    errorMessage: '[class*="error"], text=/something went wrong/i',
    modal: '[role="dialog"], [class*="modal"]',
  },
};

export default selectors;




