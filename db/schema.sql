-- Trivia Bots Admin Dashboard Database Schema
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leagues/Teams table
CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Players table (from Excel data)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id VARCHAR(255) UNIQUE,
    nickname VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    accuracy DECIMAL(5,2), -- 0.00 to 100.00
    personality VARCHAR(50), -- fast, cautious, random, normal
    team VARCHAR(255),
    league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    game_url VARCHAR(500) NOT NULL,
    league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL, -- idle, running, completed, failed
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    total_players INTEGER DEFAULT 0,
    completed_players INTEGER DEFAULT 0,
    failed_players INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player results table (individual player performance per session)
CREATE TABLE IF NOT EXISTS player_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    accuracy DECIMAL(5,2),
    final_score INTEGER,
    final_rank INTEGER,
    status VARCHAR(50) DEFAULT 'completed', -- completed, failed, error
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled games table
CREATE TABLE IF NOT EXISTS scheduled_games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    game_url VARCHAR(500),
    schedule_type VARCHAR(50) NOT NULL, -- weekly, one-time, recurring
    day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc.
    time TIME, -- HH:MM:SS
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GPT-generated content table (storylines, recaps, etc.)
CREATE TABLE IF NOT EXISTS gpt_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- storyline, recap, sponsor_script, rivalry
    content TEXT NOT NULL,
    metadata JSONB, -- Additional structured data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System logs table (for monitoring)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(20) NOT NULL, -- info, warning, error
    message TEXT NOT NULL,
    context JSONB, -- Additional context data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_league ON players(league_id);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(active);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_league ON game_sessions(league_id);
CREATE INDEX IF NOT EXISTS idx_player_results_session ON player_results(session_id);
CREATE INDEX IF NOT EXISTS idx_player_results_player ON player_results(player_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_games_next_run ON scheduled_games(next_run);
CREATE INDEX IF NOT EXISTS idx_scheduled_games_enabled ON scheduled_games(enabled);
CREATE INDEX IF NOT EXISTS idx_gpt_content_session ON gpt_content(session_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);


