/**
 * Behavior Engine
 * 
 * Simulates human-like decision making and behavior patterns for bot players.
 * Controls answer selection, timing, mistakes, and streaks.
 */

import { calculateAnswerDelay, randomDelay } from '../utils/timing.js';

/**
 * Player state tracker for maintaining consistency and streaks
 */
class PlayerState {
  constructor(profile) {
    this.profile = profile;
    this.questionsAnswered = 0;
    this.correctAnswers = 0;
    this.currentStreak = 0;      // Positive = hot, negative = cold
    this.isHot = false;
    this.isCold = false;
    this.lastAnswerCorrect = null;
    this.fatigue = 0;            // Increases over time
  }

  recordAnswer(wasCorrect) {
    this.questionsAnswered++;
    if (wasCorrect) {
      this.correctAnswers++;
      this.currentStreak = Math.max(0, this.currentStreak) + 1;
    } else {
      this.currentStreak = Math.min(0, this.currentStreak) - 1;
    }
    
    this.lastAnswerCorrect = wasCorrect;
    this.fatigue += 0.02;
    
    // Update hot/cold status
    this.isHot = this.currentStreak >= 3;
    this.isCold = this.currentStreak <= -3;
  }

  getAccuracyModifier() {
    let modifier = 0;
    
    // Hot streak bonus
    if (this.isHot) {
      modifier += 0.1;
    }
    
    // Cold streak penalty
    if (this.isCold) {
      modifier -= 0.1;
    }
    
    // Fatigue penalty
    modifier -= this.fatigue * 0.5;
    
    return modifier;
  }

  reset() {
    this.questionsAnswered = 0;
    this.correctAnswers = 0;
    this.currentStreak = 0;
    this.isHot = false;
    this.isCold = false;
    this.lastAnswerCorrect = null;
    this.fatigue = 0;
  }
}

/**
 * Behavior Engine class
 */
export class BehaviorEngine {
  constructor() {
    this.playerStates = new Map();
  }

  /**
   * Get or create player state
   * @param {object} profile - Player profile
   * @returns {PlayerState}
   */
  getPlayerState(profile) {
    if (!this.playerStates.has(profile.id)) {
      this.playerStates.set(profile.id, new PlayerState(profile));
    }
    return this.playerStates.get(profile.id);
  }

  /**
   * Decide if player should answer correctly
   * @param {object} profile - Player profile
   * @param {object} options - Decision options
   * @returns {boolean} Should answer correctly
   */
  shouldAnswerCorrectly(profile, options = {}) {
    const { category = 'general', difficulty = 0.5 } = options;
    const state = this.getPlayerState(profile);
    
    // Base accuracy from profile
    let accuracy = profile.accuracy;
    
    // Apply category-specific accuracy if available
    if (profile.knowledgeAreas && profile.knowledgeAreas[category]) {
      accuracy = profile.knowledgeAreas[category];
    }
    
    // Apply state modifiers (streaks, fatigue)
    accuracy += state.getAccuracyModifier();
    
    // Apply difficulty modifier (harder questions = lower accuracy)
    accuracy -= difficulty * 0.2;
    
    // Apply consistency (lower consistency = more variance)
    const variance = (1 - profile.consistency) * 0.2;
    accuracy += (Math.random() - 0.5) * variance;
    
    // Clamp to valid range
    accuracy = Math.max(0.1, Math.min(0.95, accuracy));
    
    // Roll the dice
    const roll = Math.random();
    return roll < accuracy;
  }

  /**
   * Select which answer option to choose
   * @param {object} profile - Player profile
   * @param {array} options - Available answer options
   * @param {number|null} correctIndex - Index of correct answer (if known)
   * @param {object} decisionOptions - Additional options
   * @returns {object} { index, delay, reason }
   */
  selectAnswer(profile, options, correctIndex = null, decisionOptions = {}) {
    const shouldBeCorrect = this.shouldAnswerCorrectly(profile, decisionOptions);
    const delay = calculateAnswerDelay(profile, decisionOptions.difficulty || 0.5);
    
    let selectedIndex;
    let reason;

    if (correctIndex !== null) {
      // We know the correct answer
      if (shouldBeCorrect) {
        selectedIndex = correctIndex;
        reason = 'correct-known';
      } else {
        // Select a wrong answer
        const wrongIndices = options
          .map((_, i) => i)
          .filter(i => i !== correctIndex);
        selectedIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
        reason = 'intentional-wrong';
      }
    } else {
      // We don't know the correct answer, pick randomly with bias
      if (shouldBeCorrect) {
        // Higher chance of first two options (often more common in trivia)
        const weights = options.map((_, i) => Math.max(0.1, 1 - i * 0.2));
        selectedIndex = this.weightedRandom(weights);
        reason = 'guess-biased';
      } else {
        // Random selection
        selectedIndex = Math.floor(Math.random() * options.length);
        reason = 'guess-random';
      }
    }

    // Record the decision (we'll know if it was correct later)
    const state = this.getPlayerState(profile);
    
    return {
      index: selectedIndex,
      delay,
      reason,
      expectedCorrect: shouldBeCorrect,
    };
  }

  /**
   * Weighted random selection
   * @param {array} weights - Weight for each index
   * @returns {number} Selected index
   */
  weightedRandom(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) return i;
    }
    
    return weights.length - 1;
  }

  /**
   * Record answer result and update player state
   * @param {object} profile - Player profile
   * @param {boolean} wasCorrect - Whether the answer was correct
   */
  recordAnswer(profile, wasCorrect) {
    const state = this.getPlayerState(profile);
    state.recordAnswer(wasCorrect);
  }

  /**
   * Decide how to type text (with human-like patterns)
   * @param {object} profile - Player profile
   * @param {string} text - Text to type
   * @returns {object} { text, delays, corrections }
   */
  planTyping(profile, text) {
    const delays = [];
    const corrections = [];
    
    // Base typing speed based on personality
    let baseDelay;
    switch (profile.personality) {
      case 'fast':
        baseDelay = { min: 30, max: 80 };
        break;
      case 'cautious':
        baseDelay = { min: 80, max: 200 };
        break;
      default:
        baseDelay = { min: 50, max: 120 };
    }
    
    for (let i = 0; i < text.length; i++) {
      let delay = randomDelay(baseDelay.min, baseDelay.max);
      
      // Longer pause after spaces and punctuation
      if (text[i] === ' ' || text[i] === '.' || text[i] === ',') {
        delay += randomDelay(50, 150);
      }
      
      // Occasional longer pause (thinking)
      if (Math.random() < 0.05) {
        delay += randomDelay(200, 500);
      }
      
      delays.push(delay);
      
      // Occasional typo and correction
      if (Math.random() < 0.02 && i > 0) {
        corrections.push({
          position: i,
          wrongChar: String.fromCharCode(text.charCodeAt(i) + randomDelay(-2, 2)),
          delay: randomDelay(100, 300),
        });
      }
    }
    
    return { text, delays, corrections };
  }

  /**
   * Reset player state for a new game
   * @param {object} profile - Player profile
   */
  resetPlayer(profile) {
    const state = this.getPlayerState(profile);
    state.reset();
  }

  /**
   * Get player statistics
   * @param {object} profile - Player profile
   * @returns {object} Player stats
   */
  getPlayerStats(profile) {
    const state = this.getPlayerState(profile);
    return {
      questionsAnswered: state.questionsAnswered,
      correctAnswers: state.correctAnswers,
      accuracy: state.questionsAnswered > 0 
        ? state.correctAnswers / state.questionsAnswered 
        : 0,
      currentStreak: state.currentStreak,
      isHot: state.isHot,
      isCold: state.isCold,
      fatigue: state.fatigue,
    };
  }
}

// Export singleton instance
export const behaviorEngine = new BehaviorEngine();

export default behaviorEngine;





