import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function startService(scriptName, label) {
  const child = spawn('node', [path.join(__dirname, scriptName)], {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    console.log(`${label} exited with code ${code ?? 0}`);
  });

  return child;
}

console.log('Starting all services...');
startService('server.js', 'Damage Reports API');
startService('return-home-package-server.js', 'Return Home Package Service');
startService('notification-server.js', 'Notification Server');
startService('domains/assessments/server.js', 'Assessments Domain');
startService('domains/municipal/server.js', 'Municipal Domain');
startService('auth-server.js', 'Auth Server');
