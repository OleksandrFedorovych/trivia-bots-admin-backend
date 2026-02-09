/**
 * Game Sessions API Routes
 * Manage game sessions and results
 */

import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve session param (UUID or session_id string) to database UUID */
async function resolveSessionId(param) {
  if (UUID_REGEX.test(param)) {
    const r = await query('SELECT id FROM game_sessions WHERE id = $1', [param]);
    return r.rows[0]?.id;
  }
  const r = await query('SELECT id FROM game_sessions WHERE session_id = $1', [param]);
  return r.rows[0]?.id;
}

/**
 * GET /api/sessions
 * Get all game sessions
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, league_id, limit = 50, offset = 0, search, start_from, start_to } = req.query;
    
    let sql = `
      SELECT 
        gs.*,
        l.name as league_name,
        COUNT(pr.id) as result_count,
        ROUND(AVG(pr.accuracy)::numeric, 2) as avg_accuracy
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

    if (search && search.trim()) {
      sql += ` AND (gs.session_id ILIKE $${paramIndex} OR l.name ILIKE $${paramIndex} OR gs.game_url ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (start_from) {
      sql += ` AND gs.start_time >= $${paramIndex++}::timestamptz`;
      params.push(start_from);
    }

    if (start_to) {
      sql += ` AND gs.start_time <= $${paramIndex++}::timestamptz`;
      params.push(start_to);
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
 * :id can be UUID or session_id (e.g. session-1770421050714)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const dbId = await resolveSessionId(req.params.id);
    if (!dbId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    console.log("-------> dbId:", req.params.id);
    const sessionResult = await query(
      `SELECT gs.*, l.name as league_name 
       FROM game_sessions gs 
       LEFT JOIN leagues l ON gs.league_id = l.id 
       WHERE gs.id = $1`,
      [dbId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    const resultsResult = await query(
      `SELECT pr.*, p.nickname, p.name, p.team
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.session_id = $1
       ORDER BY pr.final_rank ASC NULLS LAST, pr.final_score DESC NULLS LAST`,
      [dbId]
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
      status = 'idle',
      start_time,
      end_time,
      duration,
      total_players,
      completed_players,
      failed_players
    } = req.body;


    if (!session_id || !game_url) {
      return res.status(400).json({ error: 'session_id and game_url are required' });
    }

    const durationSeconds = duration != null ? Math.round(Number(duration)) : null;
    const totalPlayersInt = total_players != null ? Math.round(Number(total_players)) : null;
    const completedPlayersInt = completed_players != null ? Math.round(Number(completed_players)) : null;
    const failedPlayersInt = failed_players != null ? Math.round(Number(failed_players)) : null;
    
    let exist = await query(
      'SELECT id FROM game_sessions WHERE session_id = $1',
      [session_id]
    );

    // if (exist.rows.length <= 0) {
      await query(
        `INSERT INTO game_sessions (session_id, game_url, league_id, status, start_time, end_time, duration_seconds, total_players, completed_players, failed_players)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [session_id, game_url, league_id || null, status, start_time, end_time, durationSeconds, totalPlayersInt, completedPlayersInt, failedPlayersInt]
      );
    // }

    res.status(201).json(exist.rows[0]);
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
 * :id can be UUID or session_id (e.g. session-1770421050714)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const dbId = await resolveSessionId(req.params.id);
    if (!dbId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const {
      status,
      end_time,
      duration,
      total_players,
      completed_players,
      failed_players
    } = req.body;
    const result = await query(
      `UPDATE game_sessions SET
        status = COALESCE($1::varchar, status),
        end_time = COALESCE($2::timestamptz, end_time),
        duration_seconds = COALESCE($3::int, duration_seconds),
        total_players = COALESCE($4::int, total_players),
        completed_players = COALESCE($5::int, completed_players),
        failed_players = COALESCE($6::int, failed_players),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [status ?? null, end_time ?? null, duration ?? null, total_players ?? null, completed_players ?? null, failed_players ?? null, dbId]
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
 * :id can be UUID or session_id (e.g. session-1770421050714)
 * Body: player_id (UUID) or nickname for lookup, questions_answered, correct_answers, final_score, final_rank
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


