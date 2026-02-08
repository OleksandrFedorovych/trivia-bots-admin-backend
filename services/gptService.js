/**
 * GPT Service
 * Generate analysis and content using OpenAI API
 */

import OpenAI from 'openai';
import { query } from '../db/index.js';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate game-to-game analysis
 * Analyzes a specific game session and provides insights
 */
export async function analyzeGame(sessionId) {
  try {
    // Get session and results
    const sessionResult = await query(
      `SELECT gs.*, l.name as league_name 
       FROM game_sessions gs 
       LEFT JOIN leagues l ON gs.league_id = l.id 
       WHERE gs.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];

    // Get top performers
    const topResults = await query(
      `SELECT 
        p.nickname,
        p.team,
        pr.final_score,
        pr.final_rank,
        pr.accuracy,
        pr.correct_answers,
        pr.questions_answered
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.session_id = $1
       ORDER BY pr.final_rank ASC
       LIMIT 10`,
      [sessionId]
    );

    // Get team performance
    const teamStats = await query(
      `SELECT 
        p.team,
        COUNT(*) as players,
        AVG(pr.accuracy) as avg_accuracy,
        SUM(pr.final_score) as total_score,
        AVG(pr.final_rank) as avg_rank
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.session_id = $1 AND p.team IS NOT NULL
       GROUP BY p.team
       ORDER BY avg_rank ASC`,
      [sessionId]
    );

    // Build prompt
    const prompt = `Analyze this trivia game session and provide insights:

Game Session:
- League: ${session.league_name || 'N/A'}
- Game URL: ${session.game_url}
- Date: ${session.start_time}
- Total Players: ${session.total_players}
- Completed: ${session.completed_players}

Top Performers:
${topResults.rows.map((r, i) =>
      `${i + 1}. ${r.nickname} (${r.team || 'No team'}) - Rank #${r.final_rank}, Score: ${r.final_score}, Accuracy: ${r.accuracy?.toFixed(1)}%`
    ).join('\n')}

Team Performance:
${teamStats.rows.map(t =>
      `${t.team}: ${t.players} players, Avg Accuracy: ${t.avg_accuracy?.toFixed(1)}%, Total Score: ${t.total_score}, Avg Rank: ${t.avg_rank?.toFixed(1)}`
    ).join('\n')}

Provide:
1. Key highlights (top performers, surprises, upsets)
2. Team analysis (which teams performed best/worst)
3. Notable storylines or rivalries that emerged
4. 2-3 talking points for post-game discussion

Keep it engaging and suitable for a live trivia show recap.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sports trivia analyst. Provide engaging, insightful analysis of trivia game results with a focus on storylines, rivalries, and key moments.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const analysis = completion.choices[0].message.content;

    // Save to database
    await query(
      `INSERT INTO gpt_content (session_id, content_type, content)
       VALUES ($1, 'game_analysis', $2)`,
      [sessionId, analysis]
    );

    return analysis;
  } catch (error) {
    if (error.code === 'insufficient_quota' || error.message.includes('API key')) {
      throw new Error('OpenAI API key not configured or quota exceeded');
    }
    throw error;
  }
}

/**
 * Generate week-to-week analysis
 * Compares multiple game sessions and identifies trends
 */
export async function analyzeWeekly(sessionIds, leagueId = null) {
  try {
    let sessionsQuery = `
      SELECT gs.*, l.name as league_name
      FROM game_sessions gs
      LEFT JOIN leagues l ON gs.league_id = l.id
      WHERE gs.id = ANY($1::uuid[])
      ORDER BY gs.start_time ASC
    `;
    const params = [sessionIds];

    if (leagueId) {
      sessionsQuery = sessionsQuery.replace('WHERE gs.id', 'WHERE gs.league_id = $2 AND gs.id');
      params.push(leagueId);
    }

    const sessionsResult = await query(sessionsQuery, params);
    const sessions = sessionsResult.rows;

    if (sessions.length === 0) {
      throw new Error('No sessions found');
    }

    // Get player performance trends
    const playerTrends = await query(
      `SELECT 
        p.nickname,
        p.team,
        pr.session_id,
        pr.final_rank,
        pr.final_score,
        pr.accuracy,
        gs.start_time
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       JOIN game_sessions gs ON pr.session_id = gs.id
       WHERE pr.session_id = ANY($1::uuid[])
       ORDER BY p.nickname, gs.start_time ASC`,
      [sessionIds]
    );

    // Get team trends
    const teamTrends = await query(
      `SELECT 
        p.team,
        gs.start_time,
        AVG(pr.final_rank) as avg_rank,
        AVG(pr.accuracy) as avg_accuracy,
        SUM(pr.final_score) as total_score
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       JOIN game_sessions gs ON pr.session_id = gs.id
       WHERE pr.session_id = ANY($1::uuid[]) AND p.team IS NOT NULL
       GROUP BY p.team, gs.start_time
       ORDER BY p.team, gs.start_time ASC`,
      [sessionIds]
    );

    // Build prompt
    const prompt = `Analyze these ${sessions.length} trivia game sessions and provide week-to-week insights:

Sessions:
${sessions.map((s, i) =>
      `Week ${i + 1} (${s.start_time}): ${s.league_name || 'N/A'} - ${s.completed_players} players completed`
    ).join('\n')}

Player Performance Trends:
${groupBy(playerTrends.rows, 'nickname').map(([nickname, results]) => {
      const ranks = results.map(r => `Rank #${r.final_rank}`).join(' → ');
      return `${nickname}: ${ranks}`;
    }).join('\n')}

Team Performance Trends:
${groupBy(teamTrends.rows, 'team').map(([team, results]) => {
      const ranks = results.map(r => `Avg Rank ${r.avg_rank?.toFixed(1)}`).join(' → ');
      return `${team}: ${ranks}`;
    }).join('\n')}

Provide:
1. Overall trends (improving/declining players and teams)
2. Emerging rivalries or storylines
3. Most improved players/teams
4. Consistency analysis (who's most reliable)
5. Predictions for next week based on trends
6. 3-5 key talking points for weekly recap

Make it engaging and suitable for a weekly trivia show summary.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a sports trivia analyst. Provide engaging weekly analysis comparing multiple games, identifying trends, rivalries, and storylines.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const analysis = completion.choices[0].message.content;

    // Save to database (for the most recent session)
    if (sessions.length > 0) {
      await query(
        `INSERT INTO gpt_content (session_id, content_type, content, metadata)
         VALUES ($1, 'weekly_analysis', $2, $3)`,
        [sessions[sessions.length - 1].id, analysis, JSON.stringify({ session_ids: sessionIds })]
      );
    }

    return analysis;
  } catch (error) {
    if (error.code === 'insufficient_quota' || error.message.includes('API key')) {
      throw new Error('OpenAI API key not configured or quota exceeded');
    }
    throw error;
  }
}

/**
 * Generate sponsor script/recap
 */
export async function generateSponsorScript(sessionId, sponsorName = 'Sponsor') {
  try {
    const sessionResult = await query(
      `SELECT gs.*, l.name as league_name 
       FROM game_sessions gs 
       LEFT JOIN leagues l ON gs.league_id = l.id 
       WHERE gs.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];

    const topResults = await query(
      `SELECT 
        p.nickname,
        pr.final_rank,
        pr.final_score
       FROM player_results pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.session_id = $1
       ORDER BY pr.final_rank ASC
       LIMIT 5`,
      [sessionId]
    );

    const prompt = `Create a 30-60 second sponsor script for ${sponsorName} to read during a trivia game recap.

Game Highlights:
- Winner: ${topResults.rows[0]?.nickname || 'N/A'} (Rank #${topResults.rows[0]?.final_rank || 'N/A'})
- Top 3: ${topResults.rows.slice(0, 3).map(r => r.nickname).join(', ')}
- League: ${session.league_name || 'N/A'}
- Total Players: ${session.total_players}

Create an engaging, natural script that:
1. Highlights the game excitement
2. Mentions the sponsor naturally
3. Transitions smoothly to/from game content
4. Is conversational and energetic
5. Is 30-60 seconds when read aloud

Format as a script with stage directions if needed.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional scriptwriter for live sports trivia shows. Create engaging, natural sponsor scripts that feel authentic and exciting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const script = completion.choices[0].message.content;

    // Save to database
    await query(
      `INSERT INTO gpt_content (session_id, content_type, content, metadata)
       VALUES ($1, 'sponsor_script', $2, $3)`,
      [sessionId, script, JSON.stringify({ sponsor_name: sponsorName })]
    );

    return script;
  } catch (error) {
    if (error.code === 'insufficient_quota' || error.message.includes('API key')) {
      throw new Error('OpenAI API key not configured or quota exceeded');
    }
    throw error;
  }
}

// Helper function
function groupBy(array, key) {
  return Object.entries(
    array.reduce((acc, item) => {
      const groupKey = item[key];
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {})
  );
}


