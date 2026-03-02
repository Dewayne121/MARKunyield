const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

const projectRoot = path.resolve(__dirname, '..');
const apiPort = 3000;

// Check if port is listening
const isPortListening = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });

// Check if ngrok is available
const checkNgrok = () =>
  new Promise((resolve) => {
    const proc = spawn('ngrok', ['version'], { stdio: 'pipe' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });

// Get ngrok URL using ngrok's API
const getNgrokUrl = () =>
  new Promise((resolve, reject) => {
    const proc = spawn('ngrok', ['http', apiPort, '--log=stdout'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: projectRoot,
    });

    let output = '';
    let urlFound = false;

    const onOutput = (data) => {
      const text = data.toString();
      output += text;

      // Look for the tunnel URL in ngrok output
      const match = text.match(/url=https:\/\/([a-z0-9-]+\.ngrok(-free)?\.app)/i) ||
                   text.match(/https:\/\/([a-z0-9-]+\.ngrok(-free)?\.app)/i);
      if (match && !urlFound) {
        urlFound = true;
        const url = match[0] || `https://${match[1]}`;
        console.log(`[NGROK] URL found: ${url}`);

        // Send URL to parent process
        console.log(`__NGROK_URL__${url}__NGROK_URL__`);

        // Don't kill the process - let it keep running
        resolve(url);
      }
    };

    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);

    proc.on('error', (error) => {
      reject(new Error(`Failed to start ngrok: ${error.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!urlFound) {
        proc.kill();
        reject(new Error('Ngrok URL not found within 10 seconds'));
      }
    }, 10000);

    // Keep ngrok running
    proc.on('close', (code) => {
      if (!urlFound) {
        reject(new Error(`Ngrok exited with code ${code}`));
      }
    });
  });

const run = async () => {
  console.log('============================================');
  console.log('  Expo + Ngrok Startup');
  console.log('============================================\n');

  // Check if API is running
  const apiRunning = await isPortListening(apiPort);
  if (!apiRunning) {
    console.error(`[ERROR] Local API is not reachable on port ${apiPort}`);
    console.error('[ERROR] Please start your API server first (unyieldserver)');
    process.exit(1);
  }
  console.log(`[OK] Local API reachable on port ${apiPort}\n`);

  // Check if ngrok is installed
  const ngrokAvailable = await checkNgrok();
  if (!ngrokAvailable) {
    console.error('[ERROR] ngrok is not installed or not in PATH');
    console.error('[ERROR] Download from: https://ngrok.com/download');
    console.error('[ERROR] Extract and add to your PATH');
    process.exit(1);
  }
  console.log('[OK] ngrok is available\n');

  // Start ngrok and get URL
  console.log('[INFO] Starting ngrok for API tunnel...');
  let ngrokUrl;
  try {
    ngrokUrl = await getNgrokUrl();
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }

  console.log(`\n[INFO] ngrok API URL: ${ngrokUrl}`);
  console.log('[INFO] Waiting 2 seconds for ngrok to initialize...\n');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Now start Expo with the ngrok API URL
  console.log('[INFO] Starting Expo with ngrok API URL...\n');

  const expoArgs = ['expo', 'start', '--tunnel', '--clear'];
  const expoEnv = {
    ...process.env,
    EXPO_NO_DEPENDENCY_VALIDATION: '1',
    EXPO_NO_DOCTOR: '1',
    EXPO_PUBLIC_API_URL: ngrokUrl,
    CI: 'false',
  };

  const childCommand = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const childArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npx ${expoArgs.join(' ')}`]
    : expoArgs;

  const expo = spawn(childCommand, childArgs, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: expoEnv,
  });

  console.log(`\n[INFO] EXPO_PUBLIC_API_URL set to: ${ngrokUrl}`);
  console.log('[INFO] Scan the QR code in Expo Go\n');

  expo.on('close', (code) => {
    console.log(`\nExpo exited with code ${code}`);
    process.exit(code || 0);
  });

  expo.on('error', (error) => {
    console.error('Expo error:', error.message);
    process.exit(1);
  });
};

run().catch((error) => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
