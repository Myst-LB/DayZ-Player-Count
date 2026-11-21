import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { parseInfo, queryInfo } from '../lib/a2s.js';
import { fill, buildEmbed } from '../lib/update.js';

function infoReply({ players = 42, max = 60, keywords = 'battleye,shard,lqs3,etm4.000000,mod,14:32' } = {}) {
  const s = (x) => Buffer.from(x + '\0', 'utf8');
  return Buffer.concat([
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x11]),
    s('My DayZ Server'), s('chernarusplus'), s('dayz'), s('DayZ'),
    Buffer.from([0x00, 0x00]), // app id
    Buffer.from([players, max, 0]),
    Buffer.from([0x64, 0x6c, 0x00, 0x01]),
    s('1.26.159040'),
    Buffer.from([0x80 | 0x20]), Buffer.from([0xfe, 0x08]), // EDF: game port 2302 + keywords
    s(keywords),
  ]);
}

test('parses DayZ A2S_INFO reply including queue and time', () => {
  assert.deepEqual(parseInfo(infoReply()), {
    name: 'My DayZ Server', map: 'chernarusplus', version: '1.26.159040',
    players: 42, maxPlayers: 60, queue: 3, time: '14:32',
  });
});

test('handles missing queue/time tags', () => {
  const r = parseInfo(infoReply({ keywords: 'battleye' }));
  assert.equal(r.queue, 0);
  assert.equal(r.time, null);
});

test('queryInfo completes the challenge handshake against a fake server', async () => {
  const server = dgram.createSocket('udp4');
  const challenge = Buffer.from([1, 2, 3, 4]);
  server.on('message', (msg, rinfo) => {
    const hasChallenge = msg.length === 29 && msg.subarray(25).equals(challenge);
    const reply = hasChallenge
      ? infoReply({ players: 7 })
      : Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff, 0x41]), challenge]);
    server.send(reply, rinfo.port, rinfo.address);
  });
  await new Promise((r) => server.bind(0, '127.0.0.1', r));
  try {
    const info = await queryInfo('127.0.0.1', server.address().port, 1000);
    assert.equal(info.players, 7);
  } finally {
    server.close();
  }
});

test('queryInfo times out when nothing answers', async () => {
  await assert.rejects(queryInfo('127.0.0.1', 1, 300), /No reply/);
});

test('templates and embed', () => {
  const s = { online: true, players: 5, maxPlayers: 60, queue: 0, time: '06:00', name: 'X' };
  assert.equal(fill('🟢 {players}/{max} | {time}', s), '🟢 5/60 | 06:00');
  const e = buildEmbed(s, {}).embeds[0];
  assert.equal(e.fields.length, 2); // no queue field when queue is 0
  assert.equal(buildEmbed({ online: false }, {}).embeds[0].color, 0xe74c3c);
});
