const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { applyStandardDiff, applySearchReplace } = require('../dist/index.cjs');

let passed = 0;
let failed = 0;
for (const [directory, apply] of [['standard-diff', applyStandardDiff], ['search-replace', applySearchReplace]]) {
  for (const file of fs.readdirSync(path.join(__dirname, '../test/fixtures', directory))) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
    const fixture = yaml.load(fs.readFileSync(path.join(__dirname, '../test/fixtures', directory, file), 'utf8'));
    for (const testCase of fixture.apply_diff_tests ?? []) {
      const input = testCase.input;
      if (typeof input.diff_content !== 'string') {
        console.log(`${directory}/${file}: ${testCase.name} skipped (no diff_content)`);
        continue;
      }
      const result = apply(input.original_content, input.diff_content, {
        start_line: input.start_line,
        end_line: input.end_line,
        matchThreshold: input.matchThreshold,
      });
      const expected = testCase.expected;
      const ok = result.success === expected.success && (!expected.success || result.content === (expected.content ?? ''));
      if (ok) passed++;
      else {
        failed++;
        console.error(`${directory}/${file}: ${testCase.name}`);
        if (expected.success && result.success) {
          const expectedLines = (expected.content ?? '').split('\n');
          const receivedLines = result.content.split('\n');
          for (let i = 0; i < Math.max(expectedLines.length, receivedLines.length); i++) {
            if (expectedLines[i] !== receivedLines[i]) {
              console.error('first difference', i + 1, JSON.stringify(expectedLines[i]), JSON.stringify(receivedLines[i]));
              break;
            }
          }
        }
      }
    }
  }
}
console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
