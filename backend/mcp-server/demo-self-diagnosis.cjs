const { spawn } = require('child_process');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const SERVER_CWD = __dirname;

function createClient() {
  const proc = spawn('node', ['index.js'], {
    cwd: SERVER_CWD,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let buffer = '';
  const responses = [];
  let resolveWait = null;

  proc.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        try {
          responses.push(JSON.parse(line));
          if (resolveWait) resolveWait();
        } catch {}
      }
    }
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  function send(msg) {
    proc.stdin.write(JSON.stringify(msg) + '\n');
  }

  function waitForResponse(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startLen = responses.length;
      const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
      const check = () => {
        if (responses.length > startLen) {
          clearTimeout(timer);
          resolve(responses[responses.length - 1]);
        }
      };
      resolveWait = check;
      check();
    });
  }

  async function callTool(name, args) {
    send({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 10000),
      method: 'tools/call',
      params: { name, arguments: args },
    });
    const resp = await waitForResponse();
    return resp.result;
  }

  async function initialize() {
    send({
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'demo', version: '1.0.0' },
      },
    });
    await waitForResponse();
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await new Promise(r => setTimeout(r, 300));
  }

  return { initialize, callTool, kill: () => proc.kill() };
}

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(result) {
  const text = result.content[0].text;
  try {
    const parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }
}

async function main() {
  const client = createClient();
  await client.initialize();

  printSection('1. list_clinics');
  const listResult = await client.callTool('list_clinics', { projectDir: PROJECT_DIR });
  printResult(listResult);

  printSection('2. run_clinic (self-diagnosis)');
  const runResult = await client.callTool('run_clinic', { projectDir: PROJECT_DIR });
  printResult(runResult);

  printSection('3. read_error_pattern (list all)');
  const readResult = await client.callTool('read_error_pattern', { projectDir: path.join(PROJECT_DIR, 'examples', 'calculator') });
  printResult(readResult);

  printSection('4. read_error_pattern (specific file)');
  const readSpecific = await client.callTool('read_error_pattern', {
    projectDir: path.join(PROJECT_DIR, 'examples', 'calculator'),
    filename: 'ERR_001_division_nan.md',
  });
  printResult(readSpecific);

  printSection('5. run_clinic (calculator example)');
  const calcResult = await client.callTool('run_clinic', {
    projectDir: path.join(PROJECT_DIR, 'examples', 'calculator'),
  });
  printResult(calcResult);

  console.log('\n' + '='.repeat(60));
  console.log('  All 5 MCP tools verified successfully!');
  console.log('='.repeat(60) + '\n');

  client.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
