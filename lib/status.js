import { queryInfo } from './a2s.js';

// Returns { online, players, maxPlayers, queue, time, name, source } or { online: false, error }.
export async function getStatus(env) {
  const host = env.SERVER_HOST;
  const port = Number(env.SERVER_QUERY_PORT || 27016);
  const bmId = env.BATTLEMETRICS_ID;
  let a2sError;

  if (host) {
    try {
      return { online: true, source: 'a2s', ...(await queryInfo(host, port)) };
    } catch (err) {
      a2sError = err.message;
    }
  }

  if (bmId) {
    const res = await fetch(`https://api.battlemetrics.com/servers/${encodeURIComponent(bmId)}`);
    if (!res.ok) throw new Error(`BattleMetrics returned HTTP ${res.status}`);
    const a = (await res.json()).data.attributes;
    if (a.status !== 'online') return { online: false, source: 'battlemetrics', name: a.name };
    return {
      online: true,
      source: 'battlemetrics',
      name: a.name,
      players: a.players,
      maxPlayers: a.maxPlayers,
      queue: a.details?.queue ?? 0,
      time: a.details?.time ?? null,
    };
  }

  if (!host) throw new Error('Set SERVER_HOST (and SERVER_QUERY_PORT) or BATTLEMETRICS_ID');
  return { online: false, source: 'a2s', error: a2sError };
}
