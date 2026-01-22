/**
 * Game Sessions API Routes
 * Manage game sessions and results
 */

import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/sessions
 * Get all game sessions
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, league_id, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT 
        gs.*,
        l.name as league_name,
        COUNT(pr.id) as result_count
      FROM game_sessions gs
      LEFT JOIN leagues l ON gs.league_id = l.id
      LEFT JOIN player_results pr ON gs.id = pr.session_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND gs.status = $${paramIndex++}`;
      params.push(status);
    }

    if (league_id) {
      sql += ` AND gs.league_id = $${paramIndex++}`;
      params.push(league_id);
    }

    sql += ` GROUP BY gs.id, l.name ORDER BY gs.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:id
 * Get a single session with all player results
 */
router.get('/:id', async (req, res, next) => {
  try {
    // Get session
    const sessionResult = await query(
      `SELECT gs.*, l.name as league_name 
       FROM game_sessions gs 
       LEFT JOIN leagues l ON gs.league_id = l.id 
       WHERE gs.id = $1`,
      [req.params.id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Get player results
    const resultsResult = await query(
      `SELECT 
        pr.*,
        p.nickname,
        p.name,
        p.team
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.session_id = $1
       ORDER BY pr.final_rank ASC NULLS LAST, pr.final_score DESC NULLS LAST`,
      [req.params.id]
    );

    session.player_results = resultsResult.rows;

    res.json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions
 * Create a new game session
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      session_id,
      game_url,
      league_id,
      status = 'idle'
    } = req.body;

    if (!session_id || !game_url) {
      return res.status(400).json({ error: 'session_id and game_url are required' });
    }

    const result = await query(
      `INSERT INTO game_sessions (session_id, game_url, league_id, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session_id, game_url, league_id || null, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Session with this session_id already exists' });
    }
    next(error);
  }
});

/**
 * PUT /api/sessions/:id
 * Update a session (status, results, etc.)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const {
      status,
      start_time,
      end_time,
      duration_seconds,
      total_players,
      completed_players,
      failed_players
    } = req.body;

    const result = await query(
      `UPDATE game_sessions SET
        status = COALESCE($1, status),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        duration_seconds = COALESCE($4, duration_seconds),
        total_players = COALESCE($5, total_players),
        completed_players = COALESCE($6, completed_players),
        failed_players = COALESCE($7, failed_players),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *`,
      [status, start_time, end_time, duration_seconds, total_players, completed_players, failed_players, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions/:id/results
 * Add player results to a session
 */
router.post('/:id/results', async (req, res, next) => {
  try {
    const { player_id, questions_answered, correct_answers, final_score, final_rank, status, error_message } = req.body;

    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    const accuracy = questions_answered > 0 
      ? (correct_answers / questions_answered) * 100 
      : null;

    const result = await query(
      `INSERT INTO player_results (
        session_id, player_id, questions_answered, correct_answers,
        accuracy, final_score, final_rank, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [req.params.id, player_id, questions_answered || 0, correct_answers || 0, accuracy, final_score, final_rank, status || 'completed', error_message]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;


