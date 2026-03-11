const API_BASE =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://trivia-bots-admin-backend.onrender.com/api';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let error = {};
    try {
      error = text ? JSON.parse(text) : { error: response.statusText };
    } catch {
      error = { error: text || response.statusText };
    }
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const playersAPI = {
  getAll: (params) => {
    const query = new URLSearchParams();
    if (params?.league_id) query.append('league_id', params.league_id);
    if (params?.active !== undefined) query.append('active', String(params.active));
    if (params?.team) query.append('team', params.team);
    return fetchAPI(`/players?${query.toString()}`);
  },
  getById: (id) => fetchAPI(`/players/${id}`),
  sync: (dryRun = false) =>
    fetchAPI('/players/sync', {
      method: 'POST',
      body: JSON.stringify({ dryRun }),
    }),
  update: (id, data) =>
    fetchAPI(`/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id, hardDelete = false) =>
    fetchAPI(`/players/${id}?hardDelete=${hardDelete}`, {
      method: 'DELETE',
    }),
  getStats: () => fetchAPI('/players/stats/summary'),
};

export const playerResultsAPI = {
  addResult: (data) =>
    fetchAPI('/player-results', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const sessionsAPI = {
  getAll: (params) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.league_id) query.append('league_id', params.league_id);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.search) query.append('search', params.search);
    if (params?.start_from) query.append('start_from', params.start_from);
    if (params?.start_to) query.append('start_to', params.start_to);
    return fetchAPI(`/sessions?${query.toString()}`);
  },
  getById: (id) => fetchAPI(`/sessions/${id}`),
  getByIdOptional: async (id) => {
    try {
      return await fetchAPI(`/sessions/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Session not found')) return null;
      throw err;
    }
  },
  create: (data) =>
    fetchAPI('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchAPI(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  addResult: (data) =>
    fetchAPI(`/sessions}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPlayerResults: (limit = 50) => fetchAPI(`/player-results?limit=${limit}`),
};

export const leaguesAPI = {
  getAll: () => fetchAPI('/leagues'),
  getById: (id) => fetchAPI(`/leagues/${id}`),
  create: (data) =>
    fetchAPI('/leagues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    fetchAPI(`/leagues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    fetchAPI(`/leagues/${id}`, {
      method: 'DELETE',
    }),
};

export const gptAPI = {
  analyzeGame: (sessionId) =>
    fetchAPI(`/gpt/analyze-game/${sessionId}`, {
      method: 'POST',
    }),
  analyzeWeekly: (sessionIds, leagueId) =>
    fetchAPI('/gpt/analyze-weekly', {
      method: 'POST',
      body: JSON.stringify({ session_ids: sessionIds, league_id: leagueId }),
    }),
  generateSponsorScript: (sessionId, sponsorName) =>
    fetchAPI(`/gpt/sponsor-script/${sessionId}`, {
      method: 'POST',
      body: JSON.stringify({ sponsor_name: sponsorName }),
    }),
  getContent: (sessionId, contentType) => {
    const query = contentType ? `?content_type=${contentType}` : '';
    return fetchAPI(`/gpt/content/${sessionId}${query}`);
  },
  getRecent: (limit = 20, contentType) => {
    const query = new URLSearchParams();
    query.append('limit', String(limit));
    if (contentType) query.append('content_type', contentType);
    return fetchAPI(`/gpt/recent?${query.toString()}`);
  },
};

