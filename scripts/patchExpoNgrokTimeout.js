const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'AsyncNgrok.js'
);

const oldValue = 'const TUNNEL_TIMEOUT = 10 * 1000;';
const newValue = 'const TUNNEL_TIMEOUT = 120 * 1000;';

const bodyPatchPairs = [
  {
    from: 'error.body.msg,',
    to: '(error == null ? void 0 : error.body) ? error.body.msg : (error == null ? void 0 : error.message),',
  },
  {
    from: '(_error_body_details = error.body.details) == null ? void 0 : _error_body_details.err,',
    to: '(_error_body_details = (error == null ? void 0 : error.body) == null ? void 0 : error.body.details) == null ? void 0 : _error_body_details.err,',
  },
  {
    from: 'if ((0, _NgrokResolver.isNgrokClientError)(error) && error.body.error_code === 103) {',
    to: 'if ((0, _NgrokResolver.isNgrokClientError)(error) && (((error == null ? void 0 : error.body) == null ? void 0 : error.body.error_code) === 103)) {',
  },
  {
    from: '(error.body == null ? void 0 : error.body.msg) || error.message,',
    to: '(error == null ? void 0 : error.body) ? error.body.msg : (error == null ? void 0 : error.message),',
  },
  {
    from: '(_error_body_details = error.body == null ? void 0 : error.body.details) == null ? void 0 : _error_body_details.err,',
    to: '(_error_body_details = (error == null ? void 0 : error.body) == null ? void 0 : error.body.details) == null ? void 0 : _error_body_details.err,',
  },
  {
    from: 'if ((0, _NgrokResolver.isNgrokClientError)(error) && ((error.body == null ? void 0 : error.body.error_code) === 103)) {',
    to: 'if ((0, _NgrokResolver.isNgrokClientError)(error) && (((error == null ? void 0 : error.body) == null ? void 0 : error.body.error_code) === 103)) {',
  },
  {
    from: "error.toString() + _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')",
    to: "String(error ?? 'Unknown ngrok error') + _chalk().default.gray('\\nCheck the Ngrok status page for outages: https://status.ngrok.com/')",
  },
];

try {
  if (!fs.existsSync(target)) {
    console.log('[patch-expo-ngrok-timeout] target file not found, skipping.');
    process.exit(0);
  }

  const source = fs.readFileSync(target, 'utf8');
  let patched = source;
  let changed = false;

  if (patched.includes(oldValue)) {
    patched = patched.replace(oldValue, newValue);
    changed = true;
  }

  for (const pair of bodyPatchPairs) {
    if (patched.includes(pair.from)) {
      patched = patched.replace(pair.from, pair.to);
      changed = true;
    }
  }

  if (!changed) {
    console.log('[patch-expo-ngrok-timeout] no changes needed.');
    process.exit(0);
  }

  fs.writeFileSync(target, patched, 'utf8');
  console.log('[patch-expo-ngrok-timeout] patched ngrok timeout and error handling.');
} catch (error) {
  console.error('[patch-expo-ngrok-timeout] failed:', error.message);
  process.exit(1);
}
