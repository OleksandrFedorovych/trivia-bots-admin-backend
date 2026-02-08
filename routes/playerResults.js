/**
 * Player Results API Routes
 * Manage player_results table (individual player performance per session)
 */

import express from 'express';
import { query } from '../db/index.js';
import { resolveSessionId } from '../utils/sessionId.js';

const router = express.Router();

/**
 * POST /api/player-results
 * Insert into player_results only (no session table writes).
 * Body: session_id, nickname or player_id, questions_answered, correct_answers, final_score, final_rank, status
 */
router.post('/', async (req, res, next) => {
  try {
    const { session_id, player_id, participant_id, nickname, questions_answered, correct_answers, final_score, final_rank, status, error_message } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const sessionDbId = await resolveSessionId(session_id);
    if (!sessionDbId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let playerDbId = typeof player_id === 'string' && UUID_REGEX.test(player_id) ? player_id : null;
    if (!playerDbId && participant_id) {
      const row = await query('SELECT id FROM players WHERE participant_id = $1 LIMIT 1', [String(participant_id).trim()]);
      if (row.rows.length > 0) playerDbId = row.rows[0].id;
    }
    if (!playerDbId && nickname) {
      const row = await query('SELECT id FROM players WHERE nickname = $1 LIMIT 1', [String(nickname).trim()]);
      if (row.rows.length > 0) playerDbId = row.rows[0].id;
    }
    if (!playerDbId && participant_id) {
      const emailFallback = `${String(participant_id).trim()}@tysn.game`;
      const row = await query('SELECT id FROM players WHERE email = $1 LIMIT 1', [emailFallback]);
      if (row.rows.length > 0) playerDbId = row.rows[0].id;
    }
    if (!playerDbId) {
      return res.status(404).json({ error: `Player not found (participant_id: ${participant_id || '?'}, nickname: ${nickname || '?'}). Sync players from Excel first.` });
    }
    const accuracy = questions_answered > 0
      ? (correct_answers / questions_answered) * 100
      : null;

    await query(
      'DELETE FROM player_results WHERE session_id = $1 AND player_id = $2',
      [sessionDbId, playerDbId]
    );

    const result = await query(
      `INSERT INTO player_results (
        session_id, player_id, questions_answered, correct_answers,
        accuracy, final_score, final_rank, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [sessionDbId, playerDbId, questions_answered || 0, correct_answers || 0, accuracy, final_score ?? null, final_rank ?? null, status || 'completed', error_message ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/player-results
 * - ?session_id=xxx - results for a session
 * - ?limit=50 - recent results (for homepage)
 */
router.get('/', async (req, res, next) => {
  try {
    const { session_id, limit = 50 } = req.query;

    if (session_id) {
      const sessionDbId = await resolveSessionId(session_id);
      if (!sessionDbId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const result = await query(
        `SELECT pr.*, p.nickname, p.name, p.team, gs.session_id
         FROM player_results pr
         JOIN players p ON pr.player_id = p.id
         JOIN game_sessions gs ON pr.session_id = gs.id
         WHERE pr.session_id = $1
         ORDER BY pr.final_rank ASC NULLS LAST, pr.final_score DESC NULLS LAST`,
        [sessionDbId]
      );
      return res.json(result.rows);
    }

    const limitInt = Math.min(parseInt(limit) || 50, 100);
    const result = await query(
      `SELECT pr.*, p.nickname, p.name, p.team, gs.session_id, gs.game_url
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       JOIN game_sessions gs ON pr.session_id = gs.id
       ORDER BY pr.id DESC
       LIMIT $1`,
      [limitInt]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
