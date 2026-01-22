/**
 * Player Profile Schema & Utilities
 * 
 * Defines the structure for bot player profiles including
 * identity, behavior traits, and performance settings.
 */

/**
 * Default player profile values
 */
export const defaultProfile = {
  // Identity
  id: null,
  nickname: 'Player',
  name: 'Anonymous',
  email: 'player@example.com',
  phone: '',
  countryCode: '+1',
  
  // Club/Team association
  city: null,
  club: null,
  
  // Performance settings
  accuracy: 0.70,           // 70% correct answers (0.0 - 1.0)
  knowledgeAreas: {         // Performance by category
    general: 0.70,
    sports: 0.75,
    hockey: 0.80,
    football: 0.75,
  },
  
  // Timing behavior
  reactionTime: {
    min: 2000,              // Fastest response (ms)
    max: 10000,             // Slowest response (ms)
    average: 5000,          // Typical response (ms)
  },
  
  // Personality traits
  personality: 'normal',    // 'fast', 'cautious', 'random', 'normal'
  consistency: 0.8,         // How consistent the player is (0-1)
  streakBehavior: true,     // Whether player gets "hot" or "cold" streaks
  
  // Join behavior
  lateJoinChance: 0.10,     // 10% chance to join late
  noShowChance: 0.03,       // 3% chance to not show up
  earlyLeaveChance: 0.02,   // 2% chance to leave early
  
  // Backstory (for content generation)
  backstory: '',
  rivalries: [],
  sponsors: [],
};

/**
 * Create a player profile with defaults
 * @param {object} overrides - Values to override defaults
 * @returns {object} Complete player profile
 */
export function createProfile(overrides = {}) {
  const profile = {
    ...defaultProfile,
    ...overrides,
    reactionTime: {
      ...defaultProfile.reactionTime,
      ...overrides.reactionTime,
    },
    knowledgeAreas: {
      ...defaultProfile.knowledgeAreas,
      ...overrides.knowledgeAreas,
    },
  };
  
  // Generate ID if not provided
  if (!profile.id) {
    profile.id = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  return profile;
}

/**
 * Validate a player profile
 * @param {object} profile - Profile to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateProfile(profile) {
  const errors = [];
  
  if (!profile.id) errors.push('Profile must have an id');
  if (!profile.nickname) errors.push('Profile must have a nickname');
  if (!profile.email) errors.push('Profile must have an email');
  
  if (profile.accuracy < 0 || profile.accuracy > 1) {
    errors.push('Accuracy must be between 0 and 1');
  }
  
  if (profile.reactionTime.min >= profile.reactionTime.max) {
    errors.push('Reaction time min must be less than max');
  }
  
  const validPersonalities = ['fast', 'cautious', 'random', 'normal'];
  if (!validPersonalities.includes(profile.personality)) {
    errors.push(`Personality must be one of: ${validPersonalities.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse a player profile from Google Sheets row
 * @param {array} row - Row data from spreadsheet
 * @param {array} headers - Column headers
 * @returns {object} Player profile
 */
export function parseFromSheetRow(row, headers) {
  const data = {};
  headers.forEach((header, index) => {
    if (row[index] !== undefined && row[index] !== '') {
      data[header] = row[index];
    }
  });
  
  // Convert string numbers to actual numbers
  const numericFields = ['accuracy', 'consistency', 'lateJoinChance', 'noShowChance', 'earlyLeaveChance'];
  numericFields.forEach(field => {
    if (data[field]) {
      data[field] = parseFloat(data[field]);
    }
  });
  
  // Parse reaction time if provided as string (e.g., "2000-10000-5000")
  if (data.reactionTime && typeof data.reactionTime === 'string') {
    const [min, max, average] = data.reactionTime.split('-').map(Number);
    data.reactionTime = { min, max, average };
  }
  
  // Parse knowledge areas if provided as JSON string
  if (data.knowledgeAreas && typeof data.knowledgeAreas === 'string') {
    try {
      data.knowledgeAreas = JSON.parse(data.knowledgeAreas);
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Parse arrays
  ['rivalries', 'sponsors'].forEach(field => {
    if (data[field] && typeof data[field] === 'string') {
      data[field] = data[field].split(',').map(s => s.trim());
    }
  });
  
  return createProfile(data);
}

/**
 * Generate a random phone number
 * @param {string} countryCode - Country code (default '+1')
 * @returns {string} Random phone number
 */
export function generateRandomPhone(countryCode = '+1') {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `${countryCode}${areaCode}${exchange}${subscriber}`;
}

/**
 * Generate a random email from nickname
 * @param {string} nickname - Player nickname
 * @returns {string} Generated email
 */
export function generateEmail(nickname) {
  const sanitized = nickname.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.floor(Math.random() * 1000);
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${sanitized}${random}@${domain}`;
}

export default {
  defaultProfile,
  createProfile,
  validateProfile,
  parseFromSheetRow,
  generateRandomPhone,
  generateEmail,
};





