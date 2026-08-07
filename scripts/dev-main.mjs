// Builds main+preload, waits for the Vite dev server, then launches Electron
// with LUMEN_DEV_SERVER_URL set. Restarts Electron when main-process code rebuilds.
import { spawn } from 'node:child_process';
import { context } from 'esbuild';

const DEV_URL = 'http://localhost:5180';

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Dev server at ${url} never came up`);
}

let electronProc = null;
function launch() {
  electronProc?.kill();
  electronProc = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    env: { ...process.env, LUMEN_DEV_SERVER_URL: DEV_URL },
  });
}

await waitForServer(DEV_URL);

// esbuild >= 0.17: watch mode lives on the context API, not build().
const ctx = await context({
  entryPoints: ['src/main/index.ts', 'src/preload/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron', 'better-sqlite3'],
  outdir: 'out',
  outExtension: { '.js': '.cjs' },
  plugins: [
    {
      name: 'restart-electron',
      setup(build) {
        let first = true;
        build.onEnd((result) => {
          if (result.errors.length > 0) return;
          if (first) {
            first = false;
            launch();
          } else {
            console.log('[dev-main] rebuilt, restarting electron');
            launch();
          }
        });
      },
    },
  ],
});

await ctx.watch();

process.on('SIGINT', async () => {
  electronProc?.kill();
  await ctx.dispose();
  process.exit(0);
});
