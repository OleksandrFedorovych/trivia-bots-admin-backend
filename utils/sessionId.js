/**
 * Session ID resolution utility
 * Resolves session_id (string) or UUID to database UUID
 */

import { query } from '../db/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve session param (UUID or session_id string) to database UUID */
export async function resolveSessionId(param) {
  if (UUID_REGEX.test(param)) {
    const r = await query('SELECT id FROM game_sessions WHERE id = $1', [param]);
    return r.rows[0]?.id;
  }
  const r = await query('SELECT id FROM game_sessions WHERE session_id = $1', [param]);
  return r.rows[0]?.id;
}
