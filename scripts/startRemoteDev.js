const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const localtunnel = require('localtunnel');

const projectRoot = path.resolve(__dirname, '..');

const metroPort = Number(process.env.METRO_PORT || 8090);
const apiPort = Number(process.env.API_PORT || 3000);
const shouldClear = process.argv.includes('--clear');
const tunnelRetries = Number(process.env.TUNNEL_RETRIES || 4);
const metroPortSearchRange = Number(process.env.METRO_PORT_RANGE || 20);
const monitorEnabled = process.env.TUNNEL_MONITOR === '1';
const monitorIntervalMs = Number(process.env.TUNNEL_MONITOR_MS || 30000);
const tunnelProvider = String(process.env.TUNNEL_PROVIDER || 'auto').toLowerCase();
const metroTunnelProvider = String(process.env.METRO_TUNNEL_PROVIDER || 'localtunnel').toLowerCase();
const metroFallbackLocaltunnel = process.env.METRO_FALLBACK_LOCALTUNNEL === '1';
const allowUnverifiedCloudflareApi = process.env.ALLOW_UNVERIFIED_CLOUDFLARE_API !== '0';
const createApiBackupTunnel = process.env.API_CREATE_BACKUP_TUNNEL !== '0';
const requireStableApiTunnel = process.env.REQUIRE_STABLE_API_TUNNEL === '1';
const emergencyApiFallbackUrl = String(process.env.EXPO_PUBLIC_API_EMERGENCY_URL || 'https://unyield-main.onrender.com').trim();
const cloudflaredPath = process.env.CLOUDFLARED_PATH || path.join(projectRoot, 'scripts', '.bin', 'cloudflared.exe');
const ngrokPath = process.env.NGROK_PATH || '';

const readWindowsUserEnvVar = (name) => {
  if (process.platform !== 'win32') return '';
  try {
    const result = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', name], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0 || !result.stdout) return '';
    const text = String(result.stdout);
    const match = text.match(new RegExp(`${name}\\s+REG_SZ\\s+(.+)$`, 'mi'));
    return match ? String(match[1]).trim() : '';
  } catch {
    return '';
  }
};

const ngrokAuthToken =
  process.env.NGROK_AUTHTOKEN ||
  process.env.NGROK_AUTH_TOKEN ||
  readWindowsUserEnvVar('NGROK_AUTHTOKEN') ||
  readWindowsUserEnvVar('NGROK_AUTH_TOKEN') ||
  '';
const ngrokDomain = process.env.NGROK_DOMAIN || '';
const ngrokRegion = process.env.NGROK_REGION || '';

let apiTunnel;
let apiFallbackTunnel;

const getApiFallbackProviderOrder = (primaryProvider) => {
  const order = [];
  const push = (provider) => {
    if (!provider || provider === primaryProvider || order.includes(provider)) {
      return;
    }
    if (provider === 'ngrok' && !ngrokAuthToken) {
      return;
    }
    order.push(provider);
  };

  if (primaryProvider === 'ngrok') {
    // Keep a non-ngrok fallback in case the free ngrok tunnel rotates.
    push('localtunnel');
    push('cloudflare');
    return order;
  }

  if (primaryProvider === 'cloudflare') {
    push('ngrok');
    push('localtunnel');
    return order;
  }

  if (primaryProvider === 'localtunnel') {
    push('ngrok');
    push('cloudflare');
    return order;
  }

  push('ngrok');
  push('localtunnel');
  push('cloudflare');
  return order;
};

const canBindHost = (port, host) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      if (error && (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL')) {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });

const isHostListening = (port, host) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

const isPortAvailable = async (port) => {
  const ipv4Listening = await isHostListening(port, '127.0.0.1');
  if (ipv4Listening) return false;
  const ipv6Listening = await isHostListening(port, '::1');
  if (ipv6Listening) return false;
  const ipv4Available = await canBindHost(port, '127.0.0.1');
  if (!ipv4Available) return false;
  const ipv6Available = await canBindHost(port, '::1');
  return ipv6Available;
};

const findAvailablePort = async (startPort, attempts) => {
  for (let offset = 0; offset <= attempts; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortAvailable(candidate);
    if (free) return candidate;
  }
  return null;
};

const checkLocalApi = async () => {
  try {
    const response = await fetch(`http://localhost:${apiPort}/api/health`);
    if (!response.ok) {
      console.warn(`[WARN] API health check returned ${response.status}.`);
      return;
    }
    console.log(`[OK] Local API reachable on port ${apiPort}.`);
  } catch {
    console.warn(`[WARN] Could not reach local API on port ${apiPort}.`);
    console.warn('[WARN] Start unyieldserver first or API requests will fail remotely.');
  }
};

const closeTunnel = async (tunnel) => {
  if (!tunnel) return;
  try {
    await tunnel.close();
  } catch {
    // ignore shutdown errors
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchTextWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
};

const verifyTunnel = async (url, requireOk = false) => {
  try {
    const response = await fetchWithTimeout(url);
    if (requireOk) {
      return response.ok;
    }
    return response.status < 500;
  } catch {
    return false;
  }
};

const stopExistingNgrokProcesses = (label = 'ngrok') => {
  if (process.env.NGROK_KILL_EXISTING === '0') {
    return;
  }

  try {
    if (process.platform === 'win32') {
      const result = spawnSync('cmd.exe', ['/d', '/s', '/c', 'taskkill /F /IM ngrok.exe'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const stdout = result.stdout ? String(result.stdout) : '';
      const stderr = result.stderr ? String(result.stderr) : '';
      const combined = `${stdout}\n${stderr}`.toLowerCase();
      if (combined.includes('success') || combined.includes('terminated')) {
        console.log(`[INFO] ${label}: stopped stale local ngrok process(es).`);
      }
    } else {
      spawnSync('pkill', ['-f', 'ngrok'], {
        cwd: projectRoot,
        stdio: 'ignore',
      });
    }
  } catch {
    // ignore cleanup failures
  }
};

const verifyApiHealthJson = async (baseUrl) => {
  const endpoint = `${baseUrl}/api/health`;
  try {
    const { response, text } = await fetchTextWithTimeout(
      endpoint,
      { headers: { 'bypass-tunnel-reminder': 'true' } },
      8000
    );
    if (!response.ok) {
      return { ok: false, reason: `status ${response.status}` };
    }
    try {
      const json = JSON.parse(text);
      if (json && String(json.status).toLowerCase() === 'ok') {
        return { ok: true };
      }
      return { ok: false, reason: 'health response missing status=ok' };
    } catch {
      const short = text.slice(0, 120).replace(/\s+/g, ' ');
      return { ok: false, reason: `non-JSON health response: ${short}` };
    }
  } catch (error) {
    return { ok: false, reason: error.message };
  }
};

const verifyApiHealthJsonWithRetry = async (baseUrl, attempts = Number(process.env.API_HEALTH_RETRIES || 8)) => {
  let lastProbe = { ok: false, reason: 'unknown' };
  for (let probeAttempt = 1; probeAttempt <= attempts; probeAttempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    lastProbe = await verifyApiHealthJson(baseUrl);
    if (lastProbe.ok) {
      return lastProbe;
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(450 * probeAttempt);
  }
  return lastProbe;
};

const verifyMetroStatus = async (baseUrl) => {
  const endpoint = `${baseUrl}/status`;
  try {
    const { response, text } = await fetchTextWithTimeout(endpoint, {}, 8000);
    if (!response.ok) {
      return { ok: false, reason: `status ${response.status}` };
    }
    if (String(text).toLowerCase().includes('packager-status:running')) {
      return { ok: true };
    }
    const short = String(text).slice(0, 120).replace(/\s+/g, ' ');
    return { ok: false, reason: `unexpected /status payload: ${short}` };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
};

const waitForMetroReady = async (metroUrl, timeoutMs = Number(process.env.METRO_READY_TIMEOUT_MS || 90000)) => {
  const startedAt = Date.now();
  let lastReason = 'unknown';

  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const probe = await verifyMetroStatus(metroUrl);
    if (probe.ok) {
      return { ok: true };
    }
    lastReason = probe.reason;
    // eslint-disable-next-line no-await-in-loop
    await wait(2000);
  }

  return { ok: false, reason: lastReason };
};

const createTunnelWithRetry = async ({ port, label, verifyPath = null, requireOk = false }) => {
  for (let attempt = 1; attempt <= tunnelRetries; attempt++) {
    try {
      const tunnel = await localtunnel({ port });
      if (!verifyPath) {
        return tunnel;
      }
      const probeUrl = `${tunnel.url}${verifyPath}`;
      const healthy = await verifyTunnel(probeUrl, requireOk);
      if (healthy) {
        return tunnel;
      }
      await closeTunnel(tunnel);
      console.warn(`[WARN] ${label} tunnel unhealthy on attempt ${attempt}/${tunnelRetries}. Retrying...`);
    } catch (error) {
      console.warn(`[WARN] ${label} tunnel failed on attempt ${attempt}/${tunnelRetries}: ${error.message}`);
    }
    await wait(1200 * attempt);
  }
  throw new Error(`${label} tunnel could not be established after ${tunnelRetries} attempts.`);
};

const createCloudflareTunnelOnce = ({ port, label }) =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(cloudflaredPath)) {
      reject(new Error(`cloudflared binary not found at ${cloudflaredPath}`));
      return;
    }

    const args = ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'];
    const proc = spawn(cloudflaredPath, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outputHistory = [];
    const pushOutput = (text) => {
      outputHistory.push(text.trim());
      if (outputHistory.length > 8) outputHistory.shift();
    };

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      const details = outputHistory.filter(Boolean).join(' | ');
      reject(new Error(`${label} cloudflared tunnel startup timed out.${details ? ` Last output: ${details}` : ''}`));
    }, 25000);

    const onOutput = (chunk) => {
      const text = String(chunk);
      pushOutput(text);
      const match = text.match(/https:\/\/[-a-z0-9]+\.trycloudflare\.com/i);
      if (!match || settled) return;

      settled = true;
      clearTimeout(timeout);
      const url = match[0];
      resolve({
        url,
        close: async () => {
          if (proc.killed) return;
          await new Promise((done) => {
            const timer = setTimeout(done, 1500);
            proc.once('exit', () => {
              clearTimeout(timer);
              done();
            });
            proc.kill();
          });
        },
        on: (event, cb) => {
          if (event === 'close') proc.on('exit', cb);
        },
      });
    };

    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);
    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const details = outputHistory.filter(Boolean).join(' | ');
      reject(new Error(`${label} cloudflared exited early with code ${code}.${details ? ` Last output: ${details}` : ''}`));
    });
  });

const createCloudflareTunnelWithRetry = async ({ port, label, verifyPath = null, requireOk = false }) => {
  for (let attempt = 1; attempt <= tunnelRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const tunnel = await createCloudflareTunnelOnce({ port, label });
      if (!verifyPath) {
        return tunnel;
      }
      const probeUrl = `${tunnel.url}${verifyPath}`;
      let healthy = false;
      for (let probeAttempt = 1; probeAttempt <= 5; probeAttempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        healthy = await verifyTunnel(probeUrl, requireOk);
        if (healthy) {
          return tunnel;
        }
        // eslint-disable-next-line no-await-in-loop
        await wait(700 * probeAttempt);
      }
      // eslint-disable-next-line no-await-in-loop
      await tunnel.close();
      console.warn(`[WARN] ${label} cloudflare tunnel unhealthy on attempt ${attempt}/${tunnelRetries}. Retrying...`);
    } catch (error) {
      console.warn(`[WARN] ${label} cloudflare tunnel failed on attempt ${attempt}/${tunnelRetries}: ${error.message}`);
      if (String(error.message).includes('429 Too Many Requests') || String(error.message).includes('error code: 1015')) {
        const rateLimitError = new Error(`${label} cloudflare quick tunnel is rate-limited (429/1015).`);
        rateLimitError.code = 'CLOUDFLARE_RATE_LIMITED';
        throw rateLimitError;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(1200 * attempt);
  }
  throw new Error(`${label} cloudflare tunnel could not be established after ${tunnelRetries} attempts.`);
};

const ensureNgrokConfigFile = () => {
  const tempDir = path.join(projectRoot, 'scripts', '.tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const configPath = path.join(tempDir, 'ngrok.generated.yml');
  const sanitizedToken = String(ngrokAuthToken || '').replace(/\r?\n/g, '').trim();
  const config = `version: "2"\nauthtoken: ${sanitizedToken}\n`;
  fs.writeFileSync(configPath, config, 'utf8');
  return configPath;
};

const buildNgrokSpawn = (port) => {
  const baseArgs = ['http', String(port), '--log', 'stdout'];
  if (ngrokAuthToken) {
    // Use an explicit minimal config to avoid stale global config/policies.
    const configPath = ensureNgrokConfigFile();
    baseArgs.push(`--config=${configPath}`);
  }
  if (ngrokDomain) {
    baseArgs.push('--domain', ngrokDomain);
  }
  if (ngrokRegion) {
    baseArgs.push('--region', ngrokRegion);
  }

  if (ngrokPath) {
    return { command: ngrokPath, args: baseArgs };
  }
  if (process.platform === 'win32') {
    const escapeCmdArg = (value) => {
      const str = String(value);
      if (!/[ \t"&|<>^]/.test(str)) {
        return str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };
    const commandLine = ['npx', 'ngrok@latest', ...baseArgs].map(escapeCmdArg).join(' ');
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', commandLine] };
  }
  return { command: 'npx', args: ['ngrok@latest', ...baseArgs] };
};

const extractNgrokUrl = (text) => {
  const urlMatch = text.match(/url=(https:\/\/[^\s"'`]+)/i);
  if (urlMatch) {
    return urlMatch[1];
  }
  const directMatch = text.match(/https:\/\/[a-z0-9.-]+\.ngrok(?:-free)?\.app/ig);
  if (directMatch && directMatch.length > 0) {
    return directMatch[0];
  }
  return null;
};

const createNgrokTunnelOnce = ({ port, label }) =>
  new Promise((resolve, reject) => {
    const { command, args } = buildNgrokSpawn(port);
    const proc = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const outputHistory = [];
    const pushOutput = (text) => {
      outputHistory.push(text.trim());
      if (outputHistory.length > 10) outputHistory.shift();
    };

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill();
      const details = outputHistory.filter(Boolean).join(' | ');
      reject(new Error(`${label} ngrok tunnel startup timed out.${details ? ` Last output: ${details}` : ''}`));
    }, 25000);

    const onOutput = (chunk) => {
      const text = String(chunk);
      pushOutput(text);
      const url = extractNgrokUrl(text);
      if (!url || settled) return;

      settled = true;
      clearTimeout(timeout);
      resolve({
        url,
        close: async () => {
          if (proc.killed) return;
          await new Promise((done) => {
            const timer = setTimeout(done, 1500);
            proc.once('exit', () => {
              clearTimeout(timer);
              done();
            });
            proc.kill();
          });
        },
        on: (event, cb) => {
          if (event === 'close') proc.on('exit', cb);
        },
      });
    };

    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);
    proc.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const details = outputHistory.filter(Boolean).join(' | ');
      reject(new Error(`${label} ngrok exited early with code ${code}.${details ? ` Last output: ${details}` : ''}`));
    });
  });

const createNgrokTunnelWithRetry = async ({ port, label, verifyPath = null, requireOk = false }) => {
  stopExistingNgrokProcesses(label);
  await wait(400);
  for (let attempt = 1; attempt <= tunnelRetries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const tunnel = await createNgrokTunnelOnce({ port, label });
      if (!verifyPath) {
        return tunnel;
      }
      const probeUrl = `${tunnel.url}${verifyPath}`;
      let healthy = false;
      for (let probeAttempt = 1; probeAttempt <= 5; probeAttempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        healthy = await verifyTunnel(probeUrl, requireOk);
        if (healthy) {
          return tunnel;
        }
        // eslint-disable-next-line no-await-in-loop
        await wait(700 * probeAttempt);
      }
      // eslint-disable-next-line no-await-in-loop
      await tunnel.close();
      console.warn(`[WARN] ${label} ngrok tunnel unhealthy on attempt ${attempt}/${tunnelRetries}. Retrying...`);
    } catch (error) {
      console.warn(`[WARN] ${label} ngrok tunnel failed on attempt ${attempt}/${tunnelRetries}: ${error.message}`);
      const text = String(error.message || '');
      if (text.includes('ERR_NGROK_108') || text.includes('limited to 1 simultaneous ngrok agent sessions')) {
        const limitError = new Error(`${label} ngrok session limit reached (ERR_NGROK_108).`);
        limitError.code = 'ERR_NGROK_108';
        throw limitError;
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(1200 * attempt);
  }
  throw new Error(`${label} ngrok tunnel could not be established after ${tunnelRetries} attempts.`);
};

const createBestTunnel = ({ port, label, verifyPath = null, requireOk = false, providerOverride = null }) => {
  const activeProvider = providerOverride || tunnelProvider;
  const allowCloudflare = activeProvider === 'cloudflare' || activeProvider === 'auto';
  const allowLocaltunnel = activeProvider === 'localtunnel' || activeProvider === 'auto';

  if (allowCloudflare) {
    return createCloudflareTunnelWithRetry({
      port,
      label,
      // Cloudflare quick tunnels can return transient probe failures.
      verifyPath: null,
      requireOk: false,
    }).catch((error) => {
      if (!allowLocaltunnel) throw error;
      console.warn(`[WARN] ${label}: cloudflare failed, falling back to localtunnel.`);
      return createTunnelWithRetry({ port, label, verifyPath, requireOk });
    });
  }

  if (allowLocaltunnel) {
    return createTunnelWithRetry({ port, label, verifyPath, requireOk });
  }

  throw new Error('Unsupported tunnel provider. Use "cloudflare", "localtunnel", or "auto".');
};

const createTunnelByProvider = ({ provider, port, label, verifyPath = null, requireOk = false }) => {
  if (provider === 'cloudflare') {
    return createCloudflareTunnelWithRetry({
        port,
        label,
        // Cloudflare quick tunnels can return transient probe failures.
        verifyPath: null,
        requireOk: false,
      });
  }
  if (provider === 'ngrok') {
    return createNgrokTunnelWithRetry({ port, label, verifyPath, requireOk });
  }
  if (provider === 'localtunnel') {
    return createTunnelWithRetry({ port, label, verifyPath, requireOk });
  }
  throw new Error(`Unsupported provider "${provider}"`);
};

const createApiTunnelWithRetry = async ({ providerOrder, label = 'API' }) => {
  let lastError;
  for (const provider of providerOrder) {
    let tunnel;
    try {
      // eslint-disable-next-line no-await-in-loop
      tunnel = await createTunnelByProvider({
        provider,
        port: apiPort,
        label,
        verifyPath: '/api/health',
        requireOk: true,
      });
      // eslint-disable-next-line no-await-in-loop
      const probe = await verifyApiHealthJsonWithRetry(tunnel.url);
      if (probe.ok) {
        tunnel.provider = provider;
        return tunnel;
      }
      if (provider === 'cloudflare' && allowUnverifiedCloudflareApi) {
        console.warn(
          `[WARN] ${label} cloudflare probe failed (${probe.reason}), continuing with unverified tunnel.`
        );
        tunnel.provider = provider;
        tunnel.unverified = true;
        return tunnel;
      }
      const probeError = new Error(`${label} ${provider} probe failed (${probe.reason}).`);
      probeError.code = 'PROBE_FAILED';
      lastError = probeError;
      console.warn(`[WARN] ${probeError.message}`);
    } catch (error) {
      lastError = error;
      console.warn(`[WARN] ${label} ${provider} setup failed: ${error.message}`);
      if (provider === 'cloudflare' && error.code === 'CLOUDFLARE_RATE_LIMITED') {
        console.warn('[WARN] Cloudflare quick tunnel is rate-limited. Skipping to next provider.');
      }
      if (provider === 'ngrok' && String(error.message).includes('ERR_NGROK_4018')) {
        console.warn('[WARN] ngrok requires a verified account token. Set NGROK_AUTHTOKEN to use ngrok.');
      }
      if (provider === 'ngrok' && (error.code === 'ERR_NGROK_108' || String(error.message).includes('ERR_NGROK_108'))) {
        console.warn('[WARN] ngrok session limit reached. Skipping ngrok and continuing with other providers.');
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await closeTunnel(tunnel);
    // eslint-disable-next-line no-await-in-loop
    await wait(500);
    if (provider === 'cloudflare' && providerOrder.includes('localtunnel')) {
      console.warn(`[WARN] Falling back to localtunnel for ${label}...`);
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`${label} tunnel could not be validated.`);
};

const createMetroTunnelWithRetry = async (resolvedMetroPort) => {
  const providerOrder = metroTunnelProvider === 'auto'
    ? ['localtunnel', 'cloudflare']
    : [metroTunnelProvider];

  for (let attempt = 1; attempt <= tunnelRetries; attempt += 1) {
    for (const provider of providerOrder) {
      let tunnel;
      try {
        // eslint-disable-next-line no-await-in-loop
        tunnel = await createTunnelByProvider({
          provider,
          port: resolvedMetroPort,
          label: 'Metro',
          // Expo isn't running yet, so /status is not available at tunnel bootstrap time.
          verifyPath: null,
          requireOk: false,
        });
        return tunnel;
      } catch (error) {
        console.warn(
          `[WARN] Metro ${provider} setup failed on attempt ${attempt}/${tunnelRetries}: ${error.message}`
        );
      }
      // eslint-disable-next-line no-await-in-loop
      await closeTunnel(tunnel);
      // eslint-disable-next-line no-await-in-loop
      await wait(500);
      if (provider === 'cloudflare') {
        console.warn('[WARN] Falling back to localtunnel for Metro...');
      }
    }
    // eslint-disable-next-line no-await-in-loop
    await wait(1000 * attempt);
  }
  throw new Error(`Metro tunnel could not be validated after ${tunnelRetries} attempts.`);
};

const shutdown = async (code = 0) => {
  await closeTunnel(apiFallbackTunnel);
  await closeTunnel(apiTunnel);
  process.exit(code);
};

const waitForProcessExit = (proc) =>
  new Promise((resolve) => {
    proc.once('error', (error) => resolve({ error }));
    proc.once('exit', (code) => resolve({ code: code ?? 0 }));
  });

const joinUniqueCsv = (...values) => values
  .flatMap((value) => String(value || '').split(',').map((item) => item.trim()))
  .filter(Boolean)
  .filter((value, index, arr) => arr.indexOf(value) === index)
  .join(',');

const startExpoProcess = ({ port, apiUrl, apiFallbackUrl }) => {
  // Use Expo's native --tunnel mode for best reliability
  const expoArgs = ['expo', 'start', '--tunnel', '--port', String(port)];
  if (shouldClear) expoArgs.push('--clear');

  const childCommand = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const childArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npx ${expoArgs.join(' ')}`]
    : expoArgs;

  const expoEnv = {
    ...process.env,
    EXPO_NO_DEPENDENCY_VALIDATION: '1',
    EXPO_NO_DOCTOR: '1',
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_PUBLIC_API_FALLBACK_URL: apiFallbackUrl || process.env.EXPO_PUBLIC_API_FALLBACK_URL || '',
    CI: 'false',
  };

  return spawn(childCommand, childArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: expoEnv,
  });
};

const run = async () => {
  await checkLocalApi();
  const resolvedMetroPort = await findAvailablePort(metroPort, metroPortSearchRange);
  if (!resolvedMetroPort) {
    throw new Error(`No free Metro port found in range ${metroPort}-${metroPort + metroPortSearchRange}.`);
  }
  if (resolvedMetroPort !== metroPort) {
    console.log(`[INFO] Metro port ${metroPort} is busy. Using ${resolvedMetroPort} instead.`);
  }

  console.log('');
  console.log('Starting API tunnel...');
  console.log(`- Metro: Using Expo native --tunnel mode`);
  console.log(`- API:   http://localhost:${apiPort}`);
  console.log(`- API provider preference: ${tunnelProvider}`);
  if (requireStableApiTunnel) {
    console.log('- API stable mode: enabled (ngrok only)');
  } else if (tunnelProvider === 'auto' && ngrokAuthToken) {
    console.log('- API auto order: ngrok -> cloudflare -> localtunnel');
  } else if (tunnelProvider === 'auto' && !ngrokAuthToken) {
    console.log('- API auto order: cloudflare -> localtunnel (ngrok skipped: no auth token)');
  }

  if (requireStableApiTunnel && !ngrokAuthToken) {
    throw new Error('REQUIRE_STABLE_API_TUNNEL=1 requires NGROK_AUTHTOKEN (or NGROK_AUTH_TOKEN).');
  }

  // Auto mode now prefers ngrok when token is available, then cloudflare, then localtunnel.
  if (tunnelProvider === 'auto') {
    const providerOrder = ngrokAuthToken
      ? ['ngrok', 'cloudflare', 'localtunnel']
      : ['cloudflare', 'localtunnel'];
    apiTunnel = await createApiTunnelWithRetry({
      providerOrder: requireStableApiTunnel ? ['ngrok'] : providerOrder,
      label: 'API Primary',
    });
  } else {
    apiTunnel = await createApiTunnelWithRetry({
      providerOrder: [tunnelProvider],
      label: 'API Primary',
    });
  }

  const apiUrl = apiTunnel.url;
  const fallbackProviderOrder = getApiFallbackProviderOrder(apiTunnel.provider);
  let apiFallbackUrl = process.env.EXPO_PUBLIC_API_FALLBACK_URL || '';

  if (createApiBackupTunnel && fallbackProviderOrder.length > 0) {
    console.log(`- API primary provider: ${apiTunnel.provider}`);
    console.log(`- API backup provider:  ${fallbackProviderOrder.join(', ')}`);
    try {
      apiFallbackTunnel = await createApiTunnelWithRetry({
        providerOrder: fallbackProviderOrder,
        label: 'API Backup',
      });
      apiFallbackUrl = apiFallbackTunnel.url;
    } catch (error) {
      console.warn(`[WARN] Could not create API backup tunnel: ${error.message}`);
    }
  } else {
    console.log(`- API primary provider: ${apiTunnel.provider}`);
    console.log('- API backup provider:  disabled');
  }

  console.log('');
  console.log('Tunnel URL');
  console.log(`- API tunnel: ${apiUrl}`);
  if (apiFallbackUrl) {
    console.log(`- API backup: ${apiFallbackUrl}`);
  }
  const fallbackEnvValue = joinUniqueCsv(
    apiFallbackUrl,
    process.env.EXPO_PUBLIC_API_FALLBACK_URL || '',
    emergencyApiFallbackUrl
  );
  if (fallbackEnvValue) {
    console.log(`- API fallback env: ${fallbackEnvValue}`);
  }
  console.log('');
  console.log('Starting Expo with native --tunnel mode...');
  console.log('[INFO] Expo will generate its own tunnel URL for Metro.');
  console.log('[INFO] If this session restarts, re-scan the newest QR code in Expo Go.');
  console.log('[INFO] Web shortcut "w" opens localhost on your PC by design.');

  // Non-blocking tunnel sanity checks for API only.
  verifyTunnel(`${apiUrl}/api/health`, true).then((healthy) => {
    if (!healthy) {
      console.warn('[WARN] API tunnel did not pass initial health check. The app may fail API calls until tunnel warms up.');
    }
  });

  if (apiFallbackUrl) {
    verifyTunnel(`${apiFallbackUrl}/api/health`, true).then((healthy) => {
      if (!healthy) {
        console.warn('[WARN] API backup tunnel did not pass initial health check.');
      }
    });
  }

  apiTunnel.on('close', () => {
    console.error('API tunnel closed.');
  });
  apiFallbackTunnel?.on?.('close', () => {
    console.error('API backup tunnel closed.');
  });

  // Optional passive monitor: warns only, never force-kills the Expo session.
  if (monitorEnabled) {
    setInterval(async () => {
      const apiHealthy = await verifyTunnel(`${apiUrl}/api/health`, true);
      if (!apiHealthy) {
        console.warn('[WARN] API tunnel health check failed. Session remains running.');
      }
      if (apiFallbackUrl) {
        const fallbackHealthy = await verifyTunnel(`${apiFallbackUrl}/api/health`, true);
        if (!fallbackHealthy) {
          console.warn('[WARN] API backup tunnel health check failed. Session remains running.');
        }
      }
    }, monitorIntervalMs);
  }

  const expo = startExpoProcess({
    port: resolvedMetroPort,
    apiUrl,
    apiFallbackUrl: fallbackEnvValue,
  });

  console.log('[OK] Expo starting with native tunnel. Scan the QR code in Expo Go.');

  const result = await waitForProcessExit(expo);
  if (result.error) {
    console.error('Expo process error:', result.error.message);
    await shutdown(1);
    return;
  }
  await shutdown(result.code || 0);
  return;
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('uncaughtException', async (error) => {
  console.error('Uncaught error:', error.message);
  await shutdown(1);
});

run().catch(async (error) => {
  console.error('Remote dev bootstrap failed:', error.message);
  await shutdown(1);
});
