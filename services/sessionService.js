/**
 * Session Service
 * Saves game session results to PostgreSQL database
 */

import { query } from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Save game session results to database
 * @param {object} sessionResults - Session results from GameSession
 * @param {object} options - Additional options (league, league_id)
 * @returns {Promise<object>} Database session record
 */
export async function saveSessionToDatabase(sessionResults, options = {}) {
  const {
    sessionId,
    gameUrl,
    startTime,
    endTime,
    duration,
    totalPlayers,
    completed,
    failed,
    players: playerResults,
  } = sessionResults;

  const {
    league,
    league_id: leagueId,
  } = options;

  try {
    // Get or create league if name provided
    let finalLeagueId = leagueId || null;
    if (league && !leagueId) {
      try {
        const leagueResult = await query(
          'SELECT id FROM leagues WHERE name = $1',
          [league]
        );
        if (leagueResult.rows.length > 0) {
          finalLeagueId = leagueResult.rows[0].id;
        } else {
          // Create league if it doesn't exist
          const newLeague = await query(
            'INSERT INTO leagues (name) VALUES ($1) RETURNING id',
            [league]
          );
          finalLeagueId = newLeague.rows[0].id;
          logger.info(`Created new league: ${league} (${finalLeagueId})`);
        }
      } catch (error) {
        logger.warn(`Failed to get/create league: ${error.message}`);
      }
    }

    // Insert or update game session
    let sessionDb;
    try {
      // Try to find existing session by session_id
      const existing = await query(
        'SELECT id FROM game_sessions WHERE session_id = $1',
        [sessionId]
      );

      if (existing.rows.length > 0) {
        // Update existing session
        const updateResult = await query(
          `UPDATE game_sessions SET
            status = $1,
            start_time = $2,
            end_time = $3,
            duration_seconds = $4,
            total_players = $5,
            completed_players = $6,
            failed_players = $7,
            league_id = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE session_id = $9
          RETURNING *`,
          [
            'completed',
            startTime,
            endTime,
            Math.round(duration),
            totalPlayers || 0,
            completed || 0,
            failed || 0,
            finalLeagueId,
            sessionId,
          ]
        );
        sessionDb = updateResult.rows[0];
        logger.info(`Updated session in database: ${sessionId}`);
      } else {
        // Insert new session
        const insertResult = await query(
          `INSERT INTO game_sessions (
            session_id, game_url, league_id, status,
            start_time, end_time, duration_seconds,
            total_players, completed_players, failed_players
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            sessionId,
            gameUrl,
            finalLeagueId,
            'completed',
            startTime,
            endTime,
            Math.round(duration),
            totalPlayers || 0,
            completed || 0,
            failed || 0,
          ]
        );
        sessionDb = insertResult.rows[0];
        logger.info(`Saved session to database: ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Failed to save session to database: ${error.message}`);
      throw error;
    }

    // Save player results
    if (playerResults && Object.keys(playerResults).length > 0) {
      await savePlayerResultsToDatabase(sessionDb.id, playerResults);
    }

    return sessionDb;
  } catch (error) {
    logger.error(`Failed to save session results: ${error.message}`);
    throw error;
  }
}

/**
 * Save player results to database
 * @param {string} sessionDbId - Database session ID (UUID)
 * @param {object} playerResults - Player results object { playerId: { ... } }
 */
export async function savePlayerResultsToDatabase(sessionDbId, playerResults) {
  const playerIds = Object.keys(playerResults);
  let saved = 0;
  let errors = 0;

  for (const playerId of playerIds) {
    const result = playerResults[playerId];

    if (!result || result.error) {
      // Skip or log error results
      if (result?.error) {
        errors++;
        logger.debug(`Skipping player result with error: ${playerId} - ${result.error}`);
      }
      continue;
    }

    try {
      // Find player in database by participant_id or nickname
      let playerDbId = null;

      // Try by participant_id first (if playerId is a UUID format, use it directly)
      if (playerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's already a UUID, check if player exists
        const check = await query('SELECT id FROM players WHERE id = $1', [playerId]);
        if (check.rows.length > 0) {
          playerDbId = playerId;
        }
      }

      // Try by nickname if UUID not found
      if (!playerDbId && result.nickname) {
        const playerResult = await query(
          'SELECT id FROM players WHERE nickname = $1 LIMIT 1',
          [result.nickname]
        );
        if (playerResult.rows.length > 0) {
          playerDbId = playerResult.rows[0].id;
        }
      }

      // Skip if player not found in database
      if (!playerDbId) {
        logger.debug(`Player not found in database, skipping result: ${playerId} (${result.nickname})`);
        continue;
      }

      // Calculate accuracy
      const accuracy = result.questionsAnswered > 0
        ? (result.correctAnswers / result.questionsAnswered) * 100
        : null;

      // Insert player result (delete old if exists)
      await query(
        'DELETE FROM player_results WHERE session_id = $1 AND player_id = $2',
        [sessionDbId, playerDbId]
      );

      await query(
        `INSERT INTO player_results (
          session_id, player_id, questions_answered, correct_answers,
          accuracy, final_score, final_rank, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sessionDbId,
          playerDbId,
          result.questionsAnswered || 0,
          result.correctAnswers || 0,
          accuracy,
          result.finalScore || null,
          result.finalRank || null,
          'completed',
        ]
      );

      saved++;
    } catch (error) {
      errors++;
      logger.warn(`Failed to save result for player ${playerId}: ${error.message}`);
    }
  }

  logger.info(`Saved ${saved} player results to database (${errors} errors)`);
}

/**
 * Update session status (for real-time monitoring)
 * @param {string} sessionId - Session ID
 * @param {string} status - Status (idle, running, completed, failed)
 * @param {object} updates - Additional updates (start_time, end_time, etc.)
 */
export async function updateSessionStatus(sessionId, status, updates = {}) {
  try {
    const existing = await query(
      'SELECT id FROM game_sessions WHERE session_id = $1',
      [sessionId]
    );

    const updateFields = ['status = $1'];
    const params = [status];
    let paramIndex = 2;

    if (updates.start_time) {
      updateFields.push(`start_time = $${paramIndex++}`);
      params.push(updates.start_time);
    }
    if (updates.end_time) {
      updateFields.push(`end_time = $${paramIndex++}`);
      params.push(updates.end_time);
    }
    if (updates.total_players !== undefined) {
      updateFields.push(`total_players = $${paramIndex++}`);
      params.push(updates.total_players);
    }
    if (updates.completed_players !== undefined) {
      updateFields.push(`completed_players = $${paramIndex++}`);
      params.push(updates.completed_players);
    }
    if (updates.failed_players !== undefined) {
      updateFields.push(`failed_players = $${paramIndex++}`);
      params.push(updates.failed_players);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(sessionId);

    if (existing.rows.length > 0) {
      // Update existing
      await query(
        `UPDATE game_sessions SET ${updateFields.join(', ')} WHERE session_id = $${paramIndex}`,
        params
      );
    } else {
      // Create new session
      await query(
        `INSERT INTO game_sessions (session_id, status, game_url, start_time, total_players)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          sessionId,
          status,
          updates.game_url || '',
          updates.start_time || new Date(),
          updates.total_players || 0,
        ]
      );
    }
  } catch (error) {
    logger.warn(`Failed to update session status: ${error.message}`);
  }
}


