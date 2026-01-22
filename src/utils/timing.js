/**
 * Timing utilities for human-like behavior simulation
 */

/**
 * Generate a random delay within a range
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} Random delay in ms
 */
export function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for a random duration within a range
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {Promise<void>}
 */
export async function randomSleep(min, max) {
  const delay = randomDelay(min, max);
  await sleep(delay);
  return delay;
}

/**
 * Generate human-like typing delay
 * @param {number} textLength - Length of text to type
 * @param {object} options - Timing options
 * @returns {number} Total typing duration in ms
 */
export function calculateTypingDuration(textLength, options = {}) {
  const { min = 50, max = 150 } = options;
  let totalDelay = 0;
  
  for (let i = 0; i < textLength; i++) {
    totalDelay += randomDelay(min, max);
    // Occasionally add a longer pause (simulating thinking)
    if (Math.random() < 0.1) {
      totalDelay += randomDelay(200, 500);
    }
  }
  
  return totalDelay;
}

/**
 * Generate answer timing based on player profile
 * @param {object} profile - Player profile with timing settings
 * @param {number} questionDifficulty - Optional difficulty modifier (0-1)
 * @returns {number} Delay before answering in ms
 */
export function calculateAnswerDelay(profile, questionDifficulty = 0.5) {
  const { reactionTime } = profile;
  const { min, max, average } = reactionTime;
  
  // Base delay around the average
  let delay = average;
  
  // Add randomness
  const variance = (max - min) * 0.3;
  delay += (Math.random() - 0.5) * variance;
  
  // Adjust for difficulty (harder questions = longer thinking time)
  delay += questionDifficulty * randomDelay(500, 2000);
  
  // Apply personality modifiers
  if (profile.personality === 'fast') {
    delay *= 0.7;
  } else if (profile.personality === 'cautious') {
    delay *= 1.3;
  } else if (profile.personality === 'random') {
    delay *= 0.5 + Math.random();
  }
  
  // Ensure within bounds
  return Math.max(min, Math.min(max, Math.floor(delay)));
}

/**
 * Determine if player should join late based on profile
 * @param {object} profile - Player profile
 * @returns {object} { shouldJoinLate, delay }
 */
export function calculateJoinTiming(profile) {
  const { lateJoinChance = 0.15, noShowChance = 0.05 } = profile;
  
  // Check for no-show
  if (Math.random() < noShowChance) {
    return { shouldJoin: false, delay: 0, reason: 'no-show' };
  }
  
  // Check for late join
  if (Math.random() < lateJoinChance) {
    const lateDelay = randomDelay(30000, 120000); // 30s to 2min late
    return { shouldJoin: true, delay: lateDelay, reason: 'late' };
  }
  
  // Normal join with small variance
  const normalDelay = randomDelay(1000, 10000);
  return { shouldJoin: true, delay: normalDelay, reason: 'on-time' };
}

export default {
  randomDelay,
  sleep,
  randomSleep,
  calculateTypingDuration,
  calculateAnswerDelay,
  calculateJoinTiming,
};





