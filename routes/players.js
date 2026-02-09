/**
 * Players API Routes
 * Manage TYSN Universe master spreadsheet and player data
 */

import express from 'express';
import { query } from '../db/index.js';
import { excelLoader } from '../src/players/excelLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../../src/config/default.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /api/players
 * Get all players (from database)
 */
router.get('/', async (req, res, next) => {
  try {
    const { league_id, active, team } = req.query;

    let sql = 'SELECT * FROM players WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (league_id) {
      sql += ` AND league_id = $${paramIndex++}`;
      params.push(league_id);
    }

    if (active !== undefined) {
      sql += ` AND active = $${paramIndex++}`;
      params.push(active === 'true');
    }

    if (team) {
      sql += ` AND team = $${paramIndex++}`;
      params.push(team);
    }

    sql += ' ORDER BY nickname ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/players/:id
 * Get a single player by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM players WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/players/sync
 * Sync players from Excel file to database
 * Loads from players.xlsx and upserts to database
 */
router.post('/sync', async (req, res, next) => {
  try {
    const playersFile = req.body.file || config.data.playersFile;
    const { dryRun = false } = req.body;

    console.log(`Loading players from: ${playersFile}`);

    // Load players from Excel (use excelLoader singleton, but allow custom file path)
    // Note: excelLoader uses a default path, but we can pass file path if needed
    // For now, we'll use the default path from config
    const players = excelLoader.loadPlayers({ limit: 1000 }); // Load all players

    if (players.length === 0) {
      return res.json({
        message: 'No players found in Excel file',
        synced: 0,
        created: 0,
        updated: 0
      });
    }

    if (dryRun) {
      return res.json({
        message: 'Dry run - no changes made',
        playersFound: players.length,
        players: players.map(p => ({
          nickname: p.nickname,
          participant_id: p.participantId,
          email: p.email,
          accuracy: p.accuracy
        }))
      });
    }

    let created = 0;
    let updated = 0;

    // Upsert each player
    for (const player of players) {
      // Check if player exists (by participant_id or email)
      let existing = null;

      if (player.participantId) {
        const result = await query(
          'SELECT id FROM players WHERE participant_id = $1',
          [player.participantId]
        );
        if (result.rows.length > 0) {
          existing = result.rows[0];
        }
      }

      if (!existing && player.email) {
        const result = await query(
          'SELECT id FROM players WHERE email = $1',
          [player.email]
        );
        if (result.rows.length > 0) {
          existing = result.rows[0];
        }
      }

      if (existing) {
        // Update existing player
        await query(
          `UPDATE players SET 
            nickname = $1, 
            name = $2, 
            email = $3, 
            phone = $4, 
            accuracy = $5, 
            personality = $6, 
            team = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8`,
          [
            player.nickname,
            player.name,
            player.email,
            player.phone,
            player.accuracy ? player.accuracy * 100 : null, // Convert 0-1 to 0-100
            player.personality || 'normal',
            player.team || null,
            existing.id
          ]
        );
        updated++;
      } else {
        // Insert new player
        await query(
          `INSERT INTO players (
            participant_id, nickname, name, email, phone, 
            accuracy, personality, team, active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            player.participantId || null,
            player.nickname,
            player.name,
            player.email,
            player.phone,
            player.accuracy ? player.accuracy * 100 : null,
            player.personality || 'normal',
            player.team || null,
            true
          ]
        );
        created++;
      }
    }

    res.json({
      message: 'Players synced successfully',
      playersFound: players.length,
      created,
      updated,
      total: created + updated
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/players/:id
 * Update a player
 */
router.put('/:id', async (req, res, next) => {
  try {
    const {
      nickname,
      name,
      email,
      phone,
      accuracy,
      personality,
      team,
      league_id,
      active
    } = req.body;

    const result = await query(
      `UPDATE players SET 
        nickname = COALESCE($1, nickname),
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        accuracy = COALESCE($5, accuracy),
        personality = COALESCE($6, personality),
        team = COALESCE($7, team),
        league_id = COALESCE($8, league_id),
        active = COALESCE($9, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *`,
      [nickname, name, email, phone, accuracy, personality, team, league_id, active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/players/:id
 * Delete a player (soft delete - set active = false)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { hardDelete = false } = req.query;

    if (hardDelete === 'true') {
      // Hard delete
      const result = await query('DELETE FROM players WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json({ message: 'Player deleted', id: result.rows[0].id });
    } else {
      // Soft delete
      const result = await query(
        'UPDATE players SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json({ message: 'Player deactivated', id: result.rows[0].id });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/players/stats/summary
 * Get player statistics summary
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(*) FILTER (WHERE active = true) as active_players,
        COUNT(DISTINCT team) as total_teams,
        COUNT(DISTINCT league_id) as total_leagues,
        AVG(accuracy) as avg_accuracy
      FROM players
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;

