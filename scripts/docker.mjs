import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';

// Docker Desktop's per-user Windows installer may not be in an already-open IDE's PATH.
const environment = { ...process.env };
let executable = 'docker';
if (process.platform === 'win32') {
  const directories = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Docker', 'Docker', 'resources', 'bin'),
  ].filter(Boolean);
  const directory = directories.find(path => existsSync(join(path, 'docker.exe')));
  if (directory) {
    executable = join(directory, 'docker.exe');
    environment.PATH = directory + delimiter + environment.PATH;
  }
}
const child = spawn(executable, process.argv.slice(2), { env: environment, stdio: 'inherit', shell: false });
child.on('error', error => { console.error(`Docker non disponibile: ${error.message}`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
