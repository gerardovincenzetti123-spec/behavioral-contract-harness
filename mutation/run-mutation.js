/**
 * Mutation runner.
 *
 * For each mutant: patch the source, run the suite, restore the source.
 *
 *   killed    — the suite failed. The clause is genuinely enforced.
 *   SURVIVED  — the suite passed with the defect present. The tests covering
 *               that clause are decorative. This is a failure of the harness,
 *               not of the engine, and it exits non-zero.
 *
 * The point is not a coverage percentage. It is a specific, checkable claim:
 * every defect we have named is caught by a test that names the same clause.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mutants } from './mutants.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'slot-engine.js');
const original = readFileSync(target, 'utf8');

function suitePasses() {
  try {
    execFileSync('node', ['--test'], { // default patterns: tests/*.test.js; a quoted glob is not expanded on Node 20
      cwd: join(here, '..'),
      stdio: 'pipe',
      shell: false,
    });
    return true;
  } catch {
    return false;
  }
}

console.log('Baseline: running the suite against unmutated source...');
if (!suitePasses()) {
  console.error('FAIL — the suite does not pass before mutation. Fix that first.');
  process.exit(1);
}
console.log('Baseline green.\n');

// Restore the source no matter how this process ends: a mutant left on disk
// would turn the next `npm test` into a lie.
process.on('exit', () => writeFileSync(target, original));
process.on('SIGINT', () => process.exit(130));

let survivors = 0;

for (const mutant of mutants) {
  if (!original.includes(mutant.find)) {
    console.error(`${mutant.id}  ERROR — anchor not found in source; mutant is stale.`);
    survivors += 1;
    continue;
  }

  let survived;
  try {
    writeFileSync(target, original.replace(mutant.find, mutant.replace));
    survived = suitePasses();
  } finally {
    writeFileSync(target, original);
  }

  if (survived) {
    survivors += 1;
    console.log(`${mutant.id}  SURVIVED  [${mutant.clause}]  ${mutant.describes}`);
    console.log(`      No test fails when this defect is present. The clause is unenforced.`);
  } else {
    console.log(`${mutant.id}  killed    [${mutant.clause}]  ${mutant.describes}`);
  }
}

console.log(
  `\n${mutants.length - survivors}/${mutants.length} mutants killed.`,
);

if (survivors > 0) {
  console.error('Mutation check failed: at least one named defect goes undetected.');
  process.exit(1);
}

console.log('Every named defect is caught by the suite.');
