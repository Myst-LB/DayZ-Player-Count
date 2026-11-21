// CLI / GitHub Actions entry point.
//   node scripts/run.js                   -> one update
//   node scripts/run.js --create-message  -> post the webhook message once, prints its id
import { run } from '../lib/update.js';

try {
  process.loadEnvFile?.('.env');
} catch {}

const result = await run(process.env, { createMessage: process.argv.includes('--create-message') });
console.log(JSON.stringify(result, null, 2));
if (result.errors.length) process.exit(1);
