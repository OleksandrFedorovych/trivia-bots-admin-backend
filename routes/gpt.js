/**
 * GPT Content API Routes
 * Generate game analysis, weekly summaries, and sponsor scripts
 */

import express from 'express';
import { analyzeGame, analyzeWeekly, generateSponsorScript } from '../services/gptService.js';
import { query } from '../db/index.js';

const router = express.Router();

/**
 * POST /api/gpt/analyze-game/:sessionId
 * Generate game-to-game analysis for a specific session
 */
router.post('/analyze-game/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const analysis = await analyzeGame(sessionId);
    
    res.json({
      session_id: sessionId,
      analysis,
      type: 'game_analysis',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('OpenAI API key')) {
      return res.status(503).json({ 
        error: 'GPT service unavailable',
        message: error.message 
      });
    }
    next(error);
  }
});

/**
 * POST /api/gpt/analyze-weekly
 * Generate week-to-week analysis comparing multiple sessions
 * Body: { session_ids: [uuid, ...], league_id?: uuid }
 */
router.post('/analyze-weekly', async (req, res, next) => {
  try {
    const { session_ids, league_id } = req.body;

    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return res.status(400).json({ error: 'session_ids array is required' });
    }

    const analysis = await analyzeWeekly(session_ids, league_id);
    
    res.json({
      session_ids,
      league_id: league_id || null,
      analysis,
      type: 'weekly_analysis',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('OpenAI API key')) {
      return res.status(503).json({ 
        error: 'GPT service unavailable',
        message: error.message 
      });
    }
    next(error);
  }
});

/**
 * POST /api/gpt/sponsor-script/:sessionId
 * Generate sponsor script for a session
 * Body: { sponsor_name?: string }
 */
router.post('/sponsor-script/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { sponsor_name = 'Sponsor' } = req.body;

    const script = await generateSponsorScript(sessionId, sponsor_name);
    
    res.json({
      session_id: sessionId,
      sponsor_name,
      script,
      type: 'sponsor_script',
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    if (error.message.includes('OpenAI API key')) {
      return res.status(503).json({ 
        error: 'GPT service unavailable',
        message: error.message 
      });
    }
    next(error);
  }
});

/**
 * GET /api/gpt/content/:sessionId
 * Get all GPT-generated content for a session
 */
router.get('/content/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { content_type } = req.query;

    let sql = 'SELECT * FROM gpt_content WHERE session_id = $1';
    const params = [sessionId];

    if (content_type) {
      sql += ' AND content_type = $2';
      params.push(content_type);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gpt/recent
 * Get recent GPT content
 * Query: ?limit=10&content_type=game_analysis
 */
router.get('/recent', async (req, res, next) => {
  try {
    const { limit = 20, content_type } = req.query;

    let sql = `
      SELECT gc.*, gs.session_id, gs.game_url, l.name as league_name
      FROM gpt_content gc
      JOIN game_sessions gs ON gc.session_id = gs.id
      LEFT JOIN leagues l ON gs.league_id = l.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (content_type) {
      sql += ` AND gc.content_type = $${paramIndex++}`;
      params.push(content_type);
    }

    sql += ` ORDER BY gc.created_at DESC LIMIT $${paramIndex++}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;


