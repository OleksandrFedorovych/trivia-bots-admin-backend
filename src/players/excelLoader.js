/**
 * Excel File Loader
 * 
 * Loads player profiles from local Excel files (.xlsx)
 * Matches TYSN Universe spreadsheet schema
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProfile } from './playerSchema.js';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default Excel file path (src/data/players.xlsx)
 */
const DEFAULT_EXCEL_PATH = path.join(__dirname, '..', 'data', 'players.xlsx');

/**
 * Excel Loader Class
 */
export class ExcelLoader {
  constructor(filePath = DEFAULT_EXCEL_PATH) {
    this.filePath = filePath;
    this.workbook = null;
  }

  /**
   * Load the Excel file
   */
  load() {
    try {
      this.workbook = XLSX.readFile(this.filePath);
      logger.info(`Loaded Excel file: ${this.filePath}`);
      logger.info(`Sheets found: ${this.workbook.SheetNames.join(', ')}`);
      return true;
    } catch (error) {
      logger.error(`Failed to load Excel file: ${error.message}`);
      return false;
    }
  }

  /**
   * Get sheet data as JSON
   * @param {string} sheetName - Name of the sheet
   * @returns {Array} Array of row objects
   */
  getSheetData(sheetName) {
    if (!this.workbook) {
      this.load();
    }

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      logger.warn(`Sheet not found: ${sheetName}`);
      return [];
    }

    return XLSX.utils.sheet_to_json(sheet);
  }

  /**
   * Find sheet by partial name match
   * @param {string} partialName - Partial sheet name to match
   * @returns {string|null} Full sheet name or null
   */
  findSheet(partialName) {
    if (!this.workbook) {
      this.load();
    }

    const match = this.workbook.SheetNames.find(name =>
      name.toLowerCase().includes(partialName.toLowerCase())
    );
    return match || null;
  }

  /**
   * Load players from Participants sheet (TYSN schema)
   * Expected columns: Participant Name, Email, Phone, Participant ID, Percent Correct
   * @param {object} options - Loading options
   * @returns {Array} Array of player profiles
   */
  loadPlayers(options = {}) {
    const { limit = 50, sheetName = null } = options;

    if (!this.workbook) {
      const loaded = this.load();
      if (!loaded) {
        logger.warn('Excel file not found, returning empty array');
        return [];
      }
    }

    // Try to find the participants sheet
    const participantsSheet = sheetName ||
      this.findSheet('participant') ||
      this.findSheet('player') ||
      this.findSheet('character') ||
      this.workbook.SheetNames[0]; // Fallback to first sheet

    logger.info(`Loading players from sheet: ${participantsSheet}`);

    const data = this.getSheetData(participantsSheet);
    if (data.length === 0) {
      logger.warn('No data found in sheet');
      return [];
    }

    // Log available columns for debugging
    const columns = Object.keys(data[0]);
    logger.debug(`Available columns: ${columns.join(', ')}`);

    const players = [];
    const limitedData = data.slice(0, limit);

    for (const row of limitedData) {
      try {
        const player = this.rowToPlayer(row);
        if (player) {
          players.push(player);
        }
      } catch (error) {
        logger.debug(`Skipping row: ${error.message}`);
      }
    }

    logger.info(`Loaded ${players.length} players from Excel`);
    return players;
  }

  /**
   * Convert Excel row to player profile
   * Handles multiple column name variations
   * @param {object} row - Excel row data
   * @returns {object|null} Player profile or null
   */
  rowToPlayer(row) {
    // Helper to find column value with multiple possible names
    const findValue = (...names) => {
      for (const name of names) {
        // Try exact match
        if (row[name] !== undefined) return row[name];
        // Try case-insensitive
        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
        if (key) return row[key];
        // Try partial match
        const partialKey = Object.keys(row).find(k => k.toLowerCase().includes(name.toLowerCase()));
        if (partialKey) return row[partialKey];
      }
      return null;
    };

    // Extract fields using flexible column matching
    const id = findValue('Participant ID', 'ParticipantID', 'ID', 'id', 'PlayerID', 'CharacterID');
    const name = findValue('Participant Name', 'Name', 'name', 'PlayerName', 'CharacterName', 'Full Name');
    const email = findValue('Email', 'email', 'E-mail');
    const phone = findValue('Phone', 'phone', 'PhoneNumber', 'Phone Number', 'Mobile');
    const percentCorrect = findValue('Percent Correct', 'PercentCorrect', 'Accuracy', 'accuracy', 'Avg Percent Correct');
    const team = findValue('Team', 'team', 'Club', 'ClubName');

    // Skip if no name
    if (!name) {
      return null;
    }

    // Generate ID if not provided
    const finalId = id || `player-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    // Parse accuracy (convert percentage to decimal)
    let accuracy = 0.7; // Default
    if (percentCorrect) {
      const parsed = parseFloat(percentCorrect);
      if (parsed > 1) {
        accuracy = parsed / 100; // Convert 75% to 0.75
      } else if (parsed > 0) {
        accuracy = parsed;
      }
    }

    // Generate nickname from name
    const nickname = name.split(' ')[0] + (Math.floor(Math.random() * 99) + 1);

    // Determine personality based on accuracy
    let personality = 'normal';
    if (accuracy > 0.8) personality = 'fast';
    else if (accuracy < 0.65) personality = 'cautious';
    else if (Math.random() > 0.8) personality = 'random';

    return createProfile({
      id: String(finalId),
      nickname,
      name: String(name),
      email: email ? String(email) : `${finalId}@tysn.game`,
      phone: phone ? String(phone) : `+1415555${String(Math.floor(Math.random() * 9000) + 1000)}`,
      accuracy: Math.min(0.95, Math.max(0.5, accuracy)), // Clamp between 50-95%
      personality,
      team: team ? String(team) : null,
      reactionTime: {
        min: 1500 + Math.floor(Math.random() * 1000),
        max: 5000 + Math.floor(Math.random() * 2000),
        average: 3000 + Math.floor(Math.random() * 1500),
      },
      lateJoinChance: Math.random() * 0.1,
      noShowChance: Math.random() * 0.05,
    });
  }

  /**
   * Load games from Games sheet
   * @returns {Array} Array of game objects
   */
  loadGames() {
    if (!this.workbook) {
      const loaded = this.load();
      if (!loaded) return [];
    }

    const gamesSheet = this.findSheet('game') || this.findSheet('schedule');
    if (!gamesSheet) {
      logger.warn('No games sheet found');
      return [];
    }

    const data = this.getSheetData(gamesSheet);

    return data.map(row => ({
      gameId: row['GameID'] || row['Game ID'],
      league: row['League'],
      season: row['Season'],
      week: row['Week'],
      date: row['Date'],
      cityId: row['CityID'] || row['City ID'],
      crowdpurrCode: row['CrowdpurrCode'] || row['Crowdpurr Code'] || row['Code'],
    })).filter(game => game.crowdpurrCode);
  }

  /**
   * Get Crowd.live URL for a game
   * @param {string} code - CrowdpurrCode
   * @returns {string} Full Crowd.live URL
   */
  getGameUrl(code) {
    return `https://www.crowd.live/${code}`;
  }

  /**
   * Load players grouped by team/club
   * @param {object} options - Loading options
   * @returns {object} Object with team names as keys and player arrays as values
   */
  loadPlayersByTeam(options = {}) {
    const players = this.loadPlayers(options);
    const teams = {};

    players.forEach(player => {
      const teamName = player.team || 'Unassigned';
      if (!teams[teamName]) {
        teams[teamName] = [];
      }
      teams[teamName].push(player);
    });

    logger.info(`Loaded players into ${Object.keys(teams).length} teams`);
    return teams;
  }

  /**
   * Load players for a specific team
   * @param {string} teamName - Team/club name
   * @param {object} options - Loading options
   * @returns {Array} Array of player profiles for the team
   */
  loadTeamPlayers(teamName, options = {}) {
    const allPlayers = this.loadPlayers({ ...options, limit: 500 });
    const teamPlayers = allPlayers.filter(p =>
      p.team && p.team.toLowerCase().includes(teamName.toLowerCase())
    );

    logger.info(`Loaded ${teamPlayers.length} players for team: ${teamName}`);
    return teamPlayers.slice(0, options.limit || 50);
  }

  /**
   * Get list of all teams/clubs
   * @returns {Array} Array of team names
   */
  getTeams() {
    const players = this.loadPlayers({ limit: 500 });
    const teams = new Set();

    players.forEach(player => {
      if (player.team) {
        teams.add(player.team);
      }
    });

    return Array.from(teams).sort();
  }

  /**
   * Load clubs from Clubs sheet
   * @returns {Array} Array of club objects
   */
  loadClubs() {
    if (!this.workbook) {
      const loaded = this.load();
      if (!loaded) return [];
    }

    const clubsSheet = this.findSheet('club') || this.findSheet('team');
    if (!clubsSheet) {
      logger.warn('No clubs sheet found');
      return [];
    }

    const data = this.getSheetData(clubsSheet);

    return data.map(row => ({
      clubId: row['ClubID'] || row['Club ID'] || row['ID'],
      name: row['ClubName'] || row['Club Name'] || row['Name'],
      city: row['City'] || row['CityName'],
      league: row['League'],
    })).filter(club => club.name);
  }
}

// Export singleton
export const excelLoader = new ExcelLoader();

export default excelLoader;

