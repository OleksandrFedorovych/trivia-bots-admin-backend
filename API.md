# Admin Dashboard API Documentation

Base URL: `http://localhost:3001/api`

## Players API

### GET /players
Get all players from database

Query parameters:
- `league_id` - Filter by league
- `active` - Filter by active status (true/false)
- `team` - Filter by team name

**Example:**
```bash
GET /api/players?active=true&team=Team1
```

### GET /players/:id
Get a single player by ID

### POST /players/sync
Sync players from Excel file to database

**Body:**
```json
{
  "file": "optional/path/to/players.xlsx",  // Uses config default if not provided
  "dryRun": false  // If true, returns data without saving
}
```

**Response:**
```json
{
  "message": "Players synced successfully",
  "playersFound": 150,
  "created": 120,
  "updated": 30,
  "total": 150
}
```

### PUT /players/:id
Update a player

**Body:**
```json
{
  "nickname": "NewNickname",
  "accuracy": 75.5,
  "team": "Team Name",
  "league_id": "uuid",
  "active": true
}
```

### DELETE /players/:id
Delete/deactivate a player

Query parameters:
- `hardDelete=true` - Permanently delete (default: soft delete)

### GET /players/stats/summary
Get player statistics summary

---

## Sessions API

### GET /sessions
Get all game sessions

Query parameters:
- `status` - Filter by status (idle, running, completed, failed)
- `league_id` - Filter by league
- `limit` - Results limit (default: 50)
- `offset` - Results offset (default: 0)

### GET /sessions/:id
Get a session with all player results

### POST /sessions
Create a new game session

**Body:**
```json
{
  "session_id": "session-1234567890",
  "game_url": "https://www.crowd.live/ABC123",
  "league_id": "uuid",
  "status": "idle"
}
```

### PUT /sessions/:id
Update a session

**Body:**
```json
{
  "status": "completed",
  "start_time": "2024-01-01T10:00:00Z",
  "end_time": "2024-01-01T10:30:00Z",
  "duration_seconds": 1800,
  "total_players": 50,
  "completed_players": 48,
  "failed_players": 2
}
```

### POST /sessions/:id/results
Add player result to a session

**Body:**
```json
{
  "player_id": "uuid",
  "questions_answered": 10,
  "correct_answers": 7,
  "final_score": 350,
  "final_rank": 15,
  "status": "completed",
  "error_message": null
}
```

---

## Leagues API

### GET /leagues
Get all leagues with player counts

### GET /leagues/:id
Get a league with all players

### POST /leagues
Create a new league

**Body:**
```json
{
  "name": "NFL Trivia",
  "description": "Weekly NFL trivia games"
}
```

### PUT /leagues/:id
Update a league

### DELETE /leagues/:id
Delete a league

---

## GPT API

### POST /gpt/analyze-game/:sessionId
Generate game-to-game analysis for a specific session

**Response:**
```json
{
  "session_id": "uuid",
  "analysis": "Full GPT-generated analysis text...",
  "type": "game_analysis",
  "generated_at": "2024-01-01T10:00:00Z"
}
```

### POST /gpt/analyze-weekly
Generate week-to-week analysis comparing multiple sessions

**Body:**
```json
{
  "session_ids": ["uuid1", "uuid2", "uuid3"],
  "league_id": "uuid"  // Optional
}
```

**Response:**
```json
{
  "session_ids": ["uuid1", "uuid2", "uuid3"],
  "league_id": "uuid",
  "analysis": "Full GPT-generated weekly analysis...",
  "type": "weekly_analysis",
  "generated_at": "2024-01-01T10:00:00Z"
}
```

### POST /gpt/sponsor-script/:sessionId
Generate sponsor script for a session

**Body:**
```json
{
  "sponsor_name": "Sponsor Name"
}
```

### GET /gpt/content/:sessionId
Get all GPT-generated content for a session

Query parameters:
- `content_type` - Filter by type (game_analysis, weekly_analysis, sponsor_script)

### GET /gpt/recent
Get recent GPT content

Query parameters:
- `limit` - Results limit (default: 20)
- `content_type` - Filter by type

---

## Health Check

### GET /health
Check API health

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T10:00:00Z"
}
```


