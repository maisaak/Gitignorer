const test = require('node:test');
const assert = require('node:assert/strict');
const { detectStacks, generate } = require('../server');

test('detects stack markers in nested project paths', () => {
  assert.deepEqual(detectStacks(['api/package.json', 'service/pyproject.toml', '.idea/workspace.xml', '.github/workflows/ci.yml']), ['node', 'python', 'github', 'jetbrains']);
});

test('does not infer a language from ordinary files', () => {
  assert.deepEqual(detectStacks(['README.md', 'src/main.ts', 'Cargo.lock']), []);
});

test('only emits common OS rules without a detected or selected stack', () => {
  const { content } = generate({ files: ['README.md'] });
  assert.match(content, /\.DS_Store/);
  assert.match(content, /Thumbs\.db/);
  assert.doesNotMatch(content, /node_modules|dist\/|\.env/);
});

test('preserves custom rules and exceptions while deduplicating generated rules', () => {
  const { content, customRuleCount } = generate({
    files: ['package.json'],
    existing: '# Keep these\nnode_modules/\nsecrets/*.yaml\n!dist/\nsecrets/*.yaml\n',
  });
  assert.equal((content.match(/node_modules\//g) || []).length, 1);
  assert.equal((content.match(/secrets\/\*\.yaml/g) || []).length, 1);
  assert.match(content, /# User Custom Rules[\s\S]*secrets\/\*\.yaml[\s\S]*!dist\//);
  assert.equal(customRuleCount, 2);
});

test('deduplicates rules shared by selected templates', () => {
  const { content } = generate({ selected: ['python', 'go'] });
  assert.equal((content.match(/^\*\.so$/gm) || []).length, 1);
});

test('dotenv patterns are opt-in and lockfiles are never ignored', () => {
  const { content } = generate({ selected: ['node', 'rust'], dotenv: true });
  assert.match(content, /\.env/);
  assert.match(content, /\*\.env/);
  assert.doesNotMatch(content, /Cargo\.lock|package-lock\.json|pnpm-lock\.yaml|yarn\.lock/);
});

test('does not ignore source directories', () => {
  const { content } = generate({ selected: ['node', 'python', 'rust', 'go', 'java'] });
  assert.doesNotMatch(content, /^(src|app)\/$/m);
});
