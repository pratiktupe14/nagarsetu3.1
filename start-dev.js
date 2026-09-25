const { spawn, execSync } = require('child_process');
const path = require('path');

console.log('=======================================================');
console.log('  Starting NAGARSETU 3.1 (Backend API, Frontend & AI)  ');
console.log('=======================================================');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const pythonCmd = isWin ? 'python' : 'python3';

// 1. Start Express Backend API on Port 5000
const backend = spawn(npmCmd, ['start'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Frontend Server on Port 3000
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit',
  shell: true
});

// 3. Start Python FastAPI AI Service on Port 8000
const aiService = spawn(pythonCmd, ['main.py'], {
  cwd: path.join(__dirname, 'ai_service'),
  stdio: 'inherit',
  shell: true
});

function killProcess(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (isWin) {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch (e) {
    try { proc.kill(); } catch (err) {}
  }
}

const shutdown = () => {
  killProcess(backend);
  killProcess(frontend);
  killProcess(aiService);
  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
