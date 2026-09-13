const { spawnSync } = require('child_process');
const path = require('path');

const scripts = [
  'fuzz_test.cjs',
  'night_fuzz_test.cjs',
  'mechanics_test.cjs',
  'calc_detail_test.cjs',
  'console_check2.cjs',
];

const projectRoot = path.resolve(__dirname, '..');

console.log('Running pure-logic unit tests...\n');
const unit = spawnSync('node', ['--test', 'tests/calc.unit.test.mjs'], { cwd: projectRoot, stdio: 'inherit' });
if (unit.status !== 0) {
  console.error('\nUnit tests failed — aborting.');
  process.exit(1);
}

console.log('\nBuilding production bundle (vite build)...\n');
const build = spawnSync('npx', ['vite', 'build'], { cwd: projectRoot, stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('\nBuild failed — aborting test run.');
  process.exit(1);
}

let anyFailed = false;
for (const script of scripts) {
  console.log(`\n=== Running ${script} ===`);
  const result = spawnSync('node', [path.join(__dirname, script)], { stdio: 'inherit' });
  if (result.status !== 0) {
    anyFailed = true;
    console.log(`\n${script} FAILED (exit code ${result.status})`);
  }
}

console.log('\n' + (anyFailed ? 'SOME TEST SCRIPTS FAILED' : 'ALL TEST SCRIPTS PASSED ✓'));
process.exit(anyFailed ? 1 : 0);
