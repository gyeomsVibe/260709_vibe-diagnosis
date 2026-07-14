const { spawn } = require('child_process');
const path = require('path');

const serverProcess = spawn('node', ['index.js'], {
  cwd: path.join(__dirname),
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

const initMsg = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
}) + '\n';

const callMsg = JSON.stringify({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'run_clinic',
    arguments: {
      projectDir: path.resolve(__dirname, '..', 'examples', 'calculator'),
    },
  },
}) + '\n';

let output = '';

serverProcess.stdout.on('data', (data) => {
  output += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  process.stderr.write(data);
});

serverProcess.stdin.write(initMsg);

setTimeout(() => {
  const initializedNotification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }) + '\n';
  serverProcess.stdin.write(initializedNotification);

  setTimeout(() => {
    serverProcess.stdin.write(callMsg);

    setTimeout(() => {
      console.log('=== MCP Server Responses ===');
      const lines = output.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(line);
        }
      }
      serverProcess.kill();
      process.exit(0);
    }, 3000);
  }, 500);
}, 500);
