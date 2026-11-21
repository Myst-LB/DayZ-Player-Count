import { getStatus } from './status.js';
import { renameChannel, createWebhookMessage, editWebhookMessage } from './discord.js';

const DEFAULT_ONLINE = '🟢 Online: {players}/{max}';
const DEFAULT_OFFLINE = '🔴 Server Offline';

export function fill(template, s) {
  return template
    .replaceAll('{players}', s.players ?? 0)
    .replaceAll('{max}', s.maxPlayers ?? 0)
    .replaceAll('{queue}', s.queue ?? 0)
    .replaceAll('{time}', s.time ?? '?')
    .replaceAll('{name}', s.name ?? '');
}

export function buildEmbed(s, env) {
  const fields = [];
  if (s.online) {
    fields.push({ name: 'Players', value: `**${s.players}** / ${s.maxPlayers}`, inline: true });
    if (s.queue) fields.push({ name: 'Queue', value: String(s.queue), inline: true });
    if (s.time) fields.push({ name: 'In-game time', value: s.time, inline: true });
  }
  return {
    embeds: [{
      title: env.EMBED_TITLE || s.name || 'DayZ Server',
      description: s.online ? '🟢 **Online**' : '🔴 **Offline**',
      color: s.online ? 0x2ecc71 : 0xe74c3c,
      fields,
      footer: { text: 'Last updated' },
      timestamp: new Date().toISOString(),
    }],
  };
}

// Runs one update. createMessage: post a new webhook message and return its id (one-time setup).
export async function run(env, { createMessage = false } = {}) {
  const result = { status: null, channel: null, webhook: null, errors: [] };

  const status = await getStatus(env);
  result.status = status;

  if (env.DISCORD_BOT_TOKEN && env.DISCORD_CHANNEL_ID) {
    const template = status.online
      ? env.CHANNEL_NAME_ONLINE || DEFAULT_ONLINE
      : env.CHANNEL_NAME_OFFLINE || DEFAULT_OFFLINE;
    try {
      result.channel = await renameChannel(env.DISCORD_BOT_TOKEN, env.DISCORD_CHANNEL_ID, fill(template, status));
    } catch (err) {
      result.errors.push(`channel: ${err.message}`);
    }
  }

  if (env.DISCORD_WEBHOOK_URL) {
    const payload = buildEmbed(status, env);
    try {
      if (createMessage) {
        const id = await createWebhookMessage(env.DISCORD_WEBHOOK_URL, payload);
        result.webhook = { created: true, messageId: id, next: `Set DISCORD_MESSAGE_ID=${id}` };
      } else if (env.DISCORD_MESSAGE_ID) {
        await editWebhookMessage(env.DISCORD_WEBHOOK_URL, env.DISCORD_MESSAGE_ID, payload);
        result.webhook = { edited: true };
      } else {
        result.errors.push('webhook: DISCORD_MESSAGE_ID is not set; run the create-message step once first');
      }
    } catch (err) {
      result.errors.push(`webhook: ${err.message}`);
    }
  }

  if (!result.channel && !result.webhook && !result.errors.length) {
    result.errors.push('Nothing to update: set DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID and/or DISCORD_WEBHOOK_URL');
  }
  return result;
}
