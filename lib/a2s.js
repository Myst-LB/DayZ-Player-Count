// Minimal Steam A2S_INFO query (what DayZ server browsers use). No dependencies.
import dgram from 'node:dgram';

const INFO_REQUEST = Buffer.concat([
  Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
  Buffer.from('Source Engine Query\0', 'latin1'),
]);

export function queryInfo(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let finished = false;
    const finish = (err, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      sock.close();
      err ? reject(err) : resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error(`No reply from ${host}:${port} (server offline or wrong query port)`)),
      timeoutMs,
    );

    sock.on('error', finish);
    sock.on('message', (msg) => {
      try {
        if (msg.length < 5 || msg.readInt32LE(0) !== -1) return;
        const type = msg[4];
        if (type === 0x41) {
          // S2C_CHALLENGE: resend the request with the 4-byte challenge appended.
          sock.send(Buffer.concat([INFO_REQUEST, msg.subarray(5, 9)]), port, host);
        } else if (type === 0x49) {
          finish(null, parseInfo(msg));
        }
      } catch (err) {
        finish(err);
      }
    });
    sock.send(INFO_REQUEST, port, host, (err) => err && finish(err));
  });
}

export function parseInfo(buf) {
  let o = 5; // skip 0xFFFFFFFF + 0x49 header
  const byte = () => buf.readUInt8(o++);
  const short = () => { const v = buf.readUInt16LE(o); o += 2; return v; };
  const str = () => {
    const end = buf.indexOf(0, o);
    if (end === -1) throw new Error('Malformed A2S_INFO reply');
    const s = buf.toString('utf8', o, end);
    o = end + 1;
    return s;
  };

  byte(); // protocol
  const name = str();
  const map = str();
  str(); // folder
  str(); // game
  short(); // app id
  const players = byte();
  const maxPlayers = byte();
  byte(); // bots
  o += 4; // server type, environment, visibility, VAC
  const version = str();

  let keywords = '';
  if (o < buf.length) {
    const edf = byte();
    if (edf & 0x80) short(); // game port
    if (edf & 0x10) o += 8; // steam id
    if (edf & 0x40) { short(); str(); } // SourceTV
    if (edf & 0x20) keywords = str();
  }

  // DayZ puts extra info in the keywords, e.g. "battleye,shard,lqs3,etm4.000000,mod,14:32"
  const tags = keywords.split(',');
  const lqs = tags.find((t) => /^lqs\d+$/.test(t));
  const time = tags.find((t) => /^\d{1,2}:\d{2}$/.test(t));

  return {
    name,
    map,
    version,
    players,
    maxPlayers,
    queue: lqs ? Number(lqs.slice(3)) : 0,
    time: time ?? null,
  };
}
