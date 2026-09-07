import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}

// Apply committed migrations before publishing production code. Never reset data.
// Local and preview builds must not migrate a shared production database.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL) {
    console.error('Production build requires DATABASE_URL for migrations.');
    process.exit(1);
  }
  run('npx', ['--no-install', 'prisma', 'migrate', 'deploy']);
}

run('npx', ['--no-install', 'next', 'build']);
