/**
 * Leagues API Routes
 * Manage leagues/teams
 */

import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/leagues
 * Get all leagues
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*, COUNT(DISTINCT p.id) as player_count
       FROM leagues l
       LEFT JOIN players p ON l.id = p.league_id AND p.active = true
       GROUP BY l.id
       ORDER BY l.name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/leagues/:id
 * Get a single league with players
 */
router.get('/:id', async (req, res, next) => {
  try {
    const leagueResult = await query('SELECT * FROM leagues WHERE id = $1', [req.params.id]);
    
    if (leagueResult.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    const league = leagueResult.rows[0];

    // Get players in this league
    const playersResult = await query(
      'SELECT * FROM players WHERE league_id = $1 AND active = true ORDER BY nickname ASC',
      [req.params.id]
    );

    league.players = playersResult.rows;

    res.json(league);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/leagues
 * Create a new league
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await query(
      'INSERT INTO leagues (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'League with this name already exists' });
    }
    next(error);
  }
});

/**
 * PUT /api/leagues/:id
 * Update a league
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const result = await query(
      `UPDATE leagues SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *`,
      [name, description, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/leagues/:id
 * Delete a league
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM leagues WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json({ message: 'League deleted', id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

export default router;


