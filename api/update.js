// Vercel serverless function: GET /api/update?key=UPDATE_SECRET
// Add &setup=1 once to post the webhook message and get its DISCORD_MESSAGE_ID.
import { run } from '../lib/update.js';

export default async function handler(req, res) {
  const secret = process.env.UPDATE_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!secret || (req.query.key !== secret && auth !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const result = await run(process.env, { createMessage: req.query.setup === '1' });
    res.status(result.errors.length ? 500 : 200).json(result);
  } catch (err) {
    res.status(500).json({ errors: [err.message] });
  }
}
