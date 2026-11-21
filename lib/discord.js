const API = 'https://discord.com/api/v10';

async function discord(method, url, body, token) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bot ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

// Renames a channel, skipping the call when the name is already right.
// Discord only allows 2 renames per channel every 10 minutes.
export async function renameChannel(token, channelId, name) {
  const current = await discord('GET', `/channels/${channelId}`, null, token);
  if (!current.ok) throw new Error(`Could not read channel (HTTP ${current.status}): ${current.data?.message ?? ''}`);
  if (current.data.name === name) return { changed: false, name };

  const res = await discord('PATCH', `/channels/${channelId}`, { name }, token);
  if (res.status === 429) {
    return { changed: false, rateLimited: true, retryAfter: res.data?.retry_after, name };
  }
  if (!res.ok) throw new Error(`Rename failed (HTTP ${res.status}): ${res.data?.message ?? ''}`);
  return { changed: true, name };
}

function webhookBase(webhookUrl) {
  const u = new URL(webhookUrl);
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

export async function createWebhookMessage(webhookUrl, payload) {
  const res = await discord('POST', `${webhookBase(webhookUrl)}?wait=true`, payload);
  if (!res.ok) throw new Error(`Webhook post failed (HTTP ${res.status}): ${res.data?.message ?? ''}`);
  return res.data.id;
}

export async function editWebhookMessage(webhookUrl, messageId, payload) {
  const res = await discord('PATCH', `${webhookBase(webhookUrl)}/messages/${messageId}`, payload);
  if (!res.ok) throw new Error(`Webhook edit failed (HTTP ${res.status}): ${res.data?.message ?? ''}`);
}
