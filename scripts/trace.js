/**
 * Contract traceability check.
 *
 * The README claims: "A clause with no test is not part of the contract. A test
 * with no clause is scope creep." This script makes that claim executable.
 *
 *   - every clause id declared in the contract (**Cn — ...**) has at least one
 *     test whose name starts with that id;
 *   - every test name starts with a clause id that exists in the contract;
 *   - every mutant targets a clause that exists.
 *
 * Exits non-zero on any gap. Runs as part of `npm run verify`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mutants } from '../mutation/mutants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const contract = readFileSync(join(root, 'contracts', 'slot-engine.contract.md'), 'utf8');
const clauses = [...contract.matchAll(/^\*\*(C\d+) — /gm)].map((m) => m[1]);

const testsDir = join(root, 'tests');
const testNames = readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.js'))
  .flatMap((f) => [...readFileSync(join(testsDir, f), 'utf8').matchAll(/^test\('([^']+)'/gm)].map((m) => m[1]));

let failures = 0;
const fail = (msg) => { failures += 1; console.error(`✗ ${msg}`); };

for (const c of clauses) {
  const n = testNames.filter((t) => t.startsWith(`${c} `)).length;
  if (n === 0) fail(`${c} has no test`);
  else console.log(`✓ ${c}: ${n} test(s)`);
}
for (const t of testNames) {
  const id = t.match(/^(C\d+) /)?.[1];
  if (!id) fail(`test does not name a clause: "${t}"`);
  else if (!clauses.includes(id)) fail(`test names unknown clause ${id}: "${t}"`);
}
for (const m of mutants) {
  if (!clauses.includes(m.clause)) fail(`mutant ${m.id} targets unknown clause ${m.clause}`);
}
console.log(`\n${clauses.length} clauses · ${testNames.length} top-level tests · ${mutants.length} mutants`);
if (failures > 0) {
  console.error(`\nTraceability check failed: ${failures} gap(s).`);
  process.exit(1);
}
console.log('Every clause is tested; every test and mutant names a real clause.');
