/**
 * Results Writer
 * 
 * Saves game results back to Excel file
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default results file path
 */
const DEFAULT_RESULTS_PATH = path.join(__dirname, '..', 'data', 'results.xlsx');

/**
 * Results Writer Class
 */
export class ResultsWriter {
  constructor(filePath = DEFAULT_RESULTS_PATH) {
    this.filePath = filePath;
    this.workbook = null;
  }

  /**
   * Load or create workbook
   */
  loadOrCreate() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.workbook = XLSX.readFile(this.filePath);
        logger.info(`Loaded existing results file: ${this.filePath}`);
      } else {
        this.workbook = XLSX.utils.book_new();
        logger.info(`Created new results workbook`);
      }
      return true;
    } catch (error) {
      logger.error(`Failed to load/create results file: ${error.message}`);
      this.workbook = XLSX.utils.book_new();
      return false;
    }
  }

  /**
   * Save game session results
   * @param {object} sessionResults - Results from GameSession
   * @param {object} options - Additional options
   */
  saveSessionResults(sessionResults, options = {}) {
    if (!this.workbook) {
      this.loadOrCreate();
    }

    const {
      gameUrl = 'Unknown',
      league = 'Unknown',
      gameDate = new Date().toISOString(),
    } = options;

    // Prepare results data
    const resultsData = [];
    const timestamp = new Date().toISOString();

    // Add header row if sheet is new
    const headers = [
      'Timestamp',
      'Session ID',
      'Game URL',
      'League',
      'Player ID',
      'Nickname',
      'Questions Answered',
      'Correct Answers',
      'Accuracy %',
      'Final Score',
      'Final Rank',
      'Status',
    ];

    // Process each player's results
    for (const [playerId, playerResult] of Object.entries(sessionResults.players || {})) {
      const row = {
        'Timestamp': timestamp,
        'Session ID': sessionResults.sessionId,
        'Game URL': gameUrl,
        'League': league,
        'Player ID': playerId,
        'Nickname': playerResult.nickname || playerId,
        'Questions Answered': playerResult.questionsAnswered || 0,
        'Correct Answers': playerResult.correctAnswers || 0,
        'Accuracy %': playerResult.questionsAnswered > 0 
          ? ((playerResult.correctAnswers / playerResult.questionsAnswered) * 100).toFixed(1) 
          : 'N/A',
        'Final Score': playerResult.finalScore || 'N/A',
        'Final Rank': playerResult.finalRank || 'N/A',
        'Status': playerResult.error ? `Error: ${playerResult.error}` : 'Completed',
      };
      resultsData.push(row);
    }

    // Get or create Results sheet
    let sheet;
    const sheetName = 'Game Results';
    
    if (this.workbook.Sheets[sheetName]) {
      // Append to existing sheet
      const existingData = XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName]);
      const combinedData = [...existingData, ...resultsData];
      sheet = XLSX.utils.json_to_sheet(combinedData);
    } else {
      // Create new sheet
      sheet = XLSX.utils.json_to_sheet(resultsData, { header: headers });
    }

    // Update workbook
    this.workbook.Sheets[sheetName] = sheet;
    if (!this.workbook.SheetNames.includes(sheetName)) {
      this.workbook.SheetNames.push(sheetName);
    }

    // Save to file
    try {
      XLSX.writeFile(this.workbook, this.filePath);
      logger.info(`Results saved to: ${this.filePath}`);
      logger.info(`Added ${resultsData.length} player results`);
      return true;
    } catch (error) {
      logger.error(`Failed to save results: ${error.message}`);
      return false;
    }
  }

  /**
   * Save session summary
   * @param {object} sessionResults - Results from GameSession
   */
  saveSessionSummary(sessionResults, options = {}) {
    if (!this.workbook) {
      this.loadOrCreate();
    }

    const {
      gameUrl = 'Unknown',
      league = 'Unknown',
    } = options;

    const timestamp = new Date().toISOString();
    
    // Calculate totals
    let totalQuestions = 0;
    let totalCorrect = 0;
    let completed = 0;
    let failed = 0;

    for (const [, playerResult] of Object.entries(sessionResults.players || {})) {
      if (playerResult.error) {
        failed++;
      } else {
        completed++;
        totalQuestions += playerResult.questionsAnswered || 0;
        totalCorrect += playerResult.correctAnswers || 0;
      }
    }

    const summary = {
      'Timestamp': timestamp,
      'Session ID': sessionResults.sessionId,
      'Game URL': gameUrl,
      'League': league,
      'Duration (sec)': sessionResults.duration?.toFixed(1) || 'N/A',
      'Total Players': sessionResults.totalPlayers,
      'Completed': completed,
      'Failed': failed,
      'Total Questions': totalQuestions,
      'Total Correct': totalCorrect,
      'Overall Accuracy %': totalQuestions > 0 
        ? ((totalCorrect / totalQuestions) * 100).toFixed(1) 
        : 'N/A',
    };

    // Get or create Summary sheet
    const sheetName = 'Session Summary';
    let existingData = [];
    
    if (this.workbook.Sheets[sheetName]) {
      existingData = XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName]);
    }

    const combinedData = [...existingData, summary];
    const sheet = XLSX.utils.json_to_sheet(combinedData);

    // Update workbook
    this.workbook.Sheets[sheetName] = sheet;
    if (!this.workbook.SheetNames.includes(sheetName)) {
      this.workbook.SheetNames.push(sheetName);
    }

    // Save to file
    try {
      XLSX.writeFile(this.workbook, this.filePath);
      logger.info(`Session summary saved`);
      return true;
    } catch (error) {
      logger.error(`Failed to save summary: ${error.message}`);
      return false;
    }
  }

  /**
   * Get results file path
   */
  getFilePath() {
    return this.filePath;
  }

  /**
   * Get all saved results
   */
  getAllResults() {
    if (!this.workbook) {
      this.loadOrCreate();
    }

    const sheetName = 'Game Results';
    if (!this.workbook.Sheets[sheetName]) {
      return [];
    }

    return XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName]);
  }

  /**
   * Get all session summaries
   */
  getAllSummaries() {
    if (!this.workbook) {
      this.loadOrCreate();
    }

    const sheetName = 'Session Summary';
    if (!this.workbook.Sheets[sheetName]) {
      return [];
    }

    return XLSX.utils.sheet_to_json(this.workbook.Sheets[sheetName]);
  }
}

// Export singleton
export const resultsWriter = new ResultsWriter();

export default resultsWriter;




