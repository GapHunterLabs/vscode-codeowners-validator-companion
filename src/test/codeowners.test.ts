import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCodeowners,
  isValidOwner,
  findDuplicatedPatterns,
  findInvalidOwners,
  matchesPattern,
  findShadowedPatterns,
} from '../codeowners';

test('parseCodeowners reads pattern + owners, skipping comments and blank lines', () => {
  const text = ['# comment', '', '/docs/ @team-docs', '*.js @frontend-team @lead'].join('\n');
  const entries = parseCodeowners(text);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { pattern: '/docs/', owners: ['@team-docs'], line: 3 });
  assert.deepEqual(entries[1].owners, ['@frontend-team', '@lead']);
});

test('parseCodeowners allows a pattern with zero owners (explicit un-assignment)', () => {
  const entries = parseCodeowners('/vendor/');
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].owners, []);
});

test('isValidOwner accepts @username, @org/team, and an email', () => {
  assert.equal(isValidOwner('@octocat'), true);
  assert.equal(isValidOwner('@my-org/my-team'), true);
  assert.equal(isValidOwner('dev@example.com'), true);
});

test('isValidOwner rejects a malformed owner', () => {
  assert.equal(isValidOwner('not-an-owner'), false);
  assert.equal(isValidOwner('@'), false);
  assert.equal(isValidOwner('@org/'), false);
});

test('findDuplicatedPatterns flags the same pattern declared twice', () => {
  const entries = parseCodeowners(['/docs/ @a', '/src/ @b', '/docs/ @c'].join('\n'));
  const violations = findDuplicatedPatterns(entries);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 3);
});

test('findInvalidOwners flags a malformed owner', () => {
  const entries = parseCodeowners('/docs/ not-an-owner');
  const violations = findInvalidOwners(entries);
  assert.equal(violations.length, 1);
});

test('matchesPattern handles a directory pattern', () => {
  assert.equal(matchesPattern('/docs/', 'docs/readme.md'), true);
  assert.equal(matchesPattern('/docs/', 'docs/api/readme.md'), true);
  assert.equal(matchesPattern('/docs/', 'src/docs/readme.md'), false);
});

test('matchesPattern handles an unanchored pattern (matches anywhere in the tree)', () => {
  assert.equal(matchesPattern('*.md', 'readme.md'), true);
  assert.equal(matchesPattern('*.md', 'docs/readme.md'), true);
});

test('matchesPattern handles ** for arbitrary depth', () => {
  assert.equal(matchesPattern('/src/**/test.ts', 'src/a/b/test.ts'), true);
});

test('matchesPattern rejects a non-matching path', () => {
  assert.equal(matchesPattern('/docs/', 'src/index.ts'), false);
});

test('findShadowedPatterns flags an earlier specific pattern overridden by a later catch-all', () => {
  const entries = parseCodeowners(['/docs/api/*.md @api-team', '/docs/ @docs-team'].join('\n'));
  const violations = findShadowedPatterns(entries);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].line, 1);
});

test('findShadowedPatterns does not flag patterns in the correct broad-then-specific order', () => {
  const entries = parseCodeowners(['/docs/ @docs-team', '/docs/api/*.md @api-team'].join('\n'));
  const violations = findShadowedPatterns(entries);
  assert.equal(violations.length, 0);
});

test('findShadowedPatterns does not flag two unrelated patterns', () => {
  const entries = parseCodeowners(['/docs/ @a', '/src/ @b'].join('\n'));
  assert.equal(findShadowedPatterns(entries).length, 0);
});
