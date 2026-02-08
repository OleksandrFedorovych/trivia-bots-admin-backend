/**
 * Test script for player results API
 * Requires: admin backend running (npm run admin:server)
 * Usage: node admin/backend/test-results-api.js
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

async function runTests() {
  console.log('=== Player Results API Tests ===\n');
  let passed = 0;
  let failed = 0;

  try {
    // 1. Get existing sessions
    console.log('1. GET /api/sessions');
    const sessions = await fetchAPI('/sessions');
    console.log(`   Found ${Array.isArray(sessions) ? sessions.length : 0} sessions`);
    passed++;

    // 2. Get existing players
    console.log('\n2. GET /api/players');
    const players = await fetchAPI('/players');
    const playerList = Array.isArray(players) ? players : [];
    console.log(`   Found ${playerList.length} players`);
    passed++;

    if (playerList.length === 0) {
      console.log('   ⚠ Sync players first: POST /api/players/sync');
    }

    // 3. Create a test session if none exist
    let sessionId = null;
    if (Array.isArray(sessions) && sessions.length > 0) {
      sessionId = sessions[0].session_id || sessions[0].id;
      console.log(`\n3. Using existing session: ${sessionId}`);
    } else {
      console.log('\n3. Creating test session');
      const created = await fetchAPI('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          session_id: `test-session-${Date.now()}`,
          game_url: 'https://www.crowd.live/test',
          status: 'running',
        }),
      });
      sessionId = created.session_id || created.id;
      console.log(`   Created session: ${sessionId}`);
    }
    passed++;

    // 4. POST /api/player-results - add result
    const nickname = playerList.length > 0 ? playerList[0].nickname : 'TestPlayer';
    console.log(`\n4. POST /api/player-results (nickname: ${nickname})`);
    const result = await fetchAPI('/player-results', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        nickname,
        questions_answered: 5,
        correct_answers: 4,
        final_score: 100,
        final_rank: 1,
        status: 'completed',
      }),
    });
    console.log(`   Inserted player_result id: ${result.id}`);
    passed++;

    // 5. Verify result in session detail
    console.log('\n5. GET /api/sessions/:id (verify player_results)');
    const sessionDetail = await fetchAPI(`/sessions/${sessionId}`);
    const pr = sessionDetail.player_results || [];
    console.log(`   Session has ${pr.length} player result(s)`);
    if (pr.length > 0) {
      console.log(`   First result: ${pr[0].nickname}, correct: ${pr[0].correct_answers}/${pr[0].questions_answered}`);
    }
    passed++;

    console.log('\n=== All tests passed ===');
  } catch (err) {
    failed++;
    console.error(`\n❌ Test failed: ${err.message}`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
