const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const stacks = [
  { id: 'node', name: 'Node.js', category: 'Languages', markers: ['package.json'] },
  { id: 'python', name: 'Python', category: 'Languages', markers: ['requirements.txt', 'pyproject.toml'] },
  { id: 'rust', name: 'Rust', category: 'Languages', markers: ['Cargo.toml'] },
  { id: 'go', name: 'Go', category: 'Languages', markers: ['go.mod'] },
  { id: 'java', name: 'Java / Kotlin', category: 'Languages', markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
  { id: 'ruby', name: 'Ruby', category: 'Languages', markers: ['Gemfile'] },
  { id: 'php', name: 'PHP', category: 'Languages', markers: ['composer.json'] },
  { id: 'dart', name: 'Dart / Flutter', category: 'Languages', markers: ['pubspec.yaml'] },
  { id: 'cpp', name: 'C / C++', category: 'Languages', markers: ['CMakeLists.txt', 'meson.build'] },
  { id: 'docker', name: 'Docker', category: 'Tooling', markers: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'] },
  { id: 'github', name: 'GitHub Actions', category: 'Tooling', markers: ['.github/workflows/'] },
  { id: 'jetbrains', name: 'JetBrains', category: 'Editors', markers: ['.idea/'] },
  { id: 'vscode', name: 'VS Code', category: 'Editors', markers: ['.vscode/'] },
  { id: 'eclipse', name: 'Eclipse', category: 'Editors', markers: ['.settings/'] },
];

const templates = {
  node: ['node_modules/', 'npm-debug.log*', 'yarn-debug.log*', 'yarn-error.log*', '.pnpm-debug.log*', '.npm/'],
  python: ['__pycache__/', '*.py[cod]', '*$py.class', '*.so', '.Python', 'develop-eggs/', 'downloads/', 'eggs/', '.eggs/', 'lib/', 'lib64/', 'parts/', 'sdist/', 'var/', 'wheels/', '*.egg-info/', '.installed.cfg', '*.egg', '.venv/', 'venv/', 'env/', 'ENV/', '.pytest_cache/', '.mypy_cache/', '.ruff_cache/', 'htmlcov/', '.coverage', '.tox/'],
  rust: ['/target/', '**/*.rs.bk', '*.pdb'],
  go: ['*.exe', '*.exe~', '*.dll', '*.so', '*.dylib', '*.test', '*.out', '/vendor/'],
  java: ['*.class', '*.log', '*.jar', '*.war', '*.nar', '*.ear', '*.zip', '*.tar.gz', '*.rar', 'target/', '.gradle/', '*.iml'],
  ruby: ['*.gem', '*.rbc', '/.bundle/', '/vendor/bundle/', '/lib/bundler/man/', '/tmp/'],
  php: ['vendor/', 'composer.phar'],
  dart: ['.dart_tool/', '.packages', 'build/', '.flutter-plugins', '.flutter-plugins-dependencies', '.pub-cache/', '.pub/', '/coverage/'],
  cpp: ['cmake-build-*/', 'CMakeFiles/', 'CMakeCache.txt', 'compile_commands.json', 'build/', 'out/'],
  jetbrains: ['.idea/', '*.iws', '*.iml', '*.ipr', 'out/'],
  vscode: ['.vscode/*', '!.vscode/settings.json', '!.vscode/tasks.json', '!.vscode/launch.json', '!.vscode/extensions.json', '*.code-workspace'],
  eclipse: ['.settings/', '.project', '.classpath'],
};

const buildRules = ['dist/', 'build/', '.next/', '.nuxt/', '.cache/', 'coverage/'];
const environmentRules = ['.env', '.env.local', '.env.*.local'];
const osTemplates = [
  { title: 'macOS', rules: ['.DS_Store', '.AppleDouble', '.LSOverride', '._*', '.DocumentRevisions-V100', '.fseventsd', '.Spotlight-V100', '.TemporaryItems', '.Trashes', '.VolumeIcon.icns', '.com.apple.timemachine.donotpresent'] },
  { title: 'Windows', rules: ['Thumbs.db', 'Thumbs.db:encryptable', 'ehthumbs.db', 'ehthumbs_vista.db', '*.stackdump', '[Dd]esktop.ini', '$RECYCLE.BIN/', '*.cab', '*.msi', '*.msix', '*.msm', '*.msp', '*.lnk'] },
  { title: 'Linux', rules: ['*~', '.fuse_hidden*', '.directory', '.Trash-*', '.nfs*'] },
];

function normalizeFile(file) {
  return String(file).trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function detectStacks(files) {
  const paths = files.map(normalizeFile).filter(Boolean);
  const detected = new Set();
  for (const stack of stacks) {
    const found = paths.some((file) => stack.markers.some((marker) => {
      if (marker.endsWith('/')) return file === marker.slice(0, -1) || file.includes(`/${marker}`) || file.startsWith(marker);
      return path.posix.basename(file).toLowerCase() === marker.toLowerCase();
    }));
    if (found) detected.add(stack.id);
  }
  return [...detected];
}

function unique(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generate({ files = [], selected = [], existing = '', dotenv = false }) {
  const detected = detectStacks(Array.isArray(files) ? files : []);
  const stackIds = [...new Set([...detected, ...(Array.isArray(selected) ? selected : [])])]
    .filter((id) => stacks.some((stack) => stack.id === id));
  const sections = [];
  const emittedRules = new Set();
  const addSection = (title, rules) => {
    const cleanRules = unique(rules).filter((rule) => {
      if (emittedRules.has(rule)) return false;
      emittedRules.add(rule);
      return true;
    });
    if (cleanRules.length) sections.push(`# ${title}\n${cleanRules.join('\n')}`);
  };

  for (const id of stackIds) {
    const stack = stacks.find((item) => item.id === id);
    if (templates[id]) addSection(stack.name, templates[id]);
  }

  const hasLanguageStack = stackIds.some((id) => ['node', 'python', 'rust', 'go', 'java', 'ruby', 'php', 'dart', 'cpp'].includes(id));
  const selectedRules = unique(stackIds.flatMap((id) => templates[id] || []));
  if (hasLanguageStack) addSection('Build Output', buildRules.filter((rule) => !selectedRules.includes(rule)));
  if (dotenv) addSection('Environment', [...environmentRules, '*.env']);
  for (const section of osTemplates) addSection(section.title, section.rules);

  const generatedRuleSet = new Set(sections.join('\n').split('\n').filter((line) => line && !line.startsWith('#')));
  const generatedTitles = new Set(sections.map((section) => section.split('\n', 1)[0]));
  const originalLines = String(existing).replace(/\r/g, '').split('\n');
  const customLines = [];
  const seenCustom = new Set();
  for (const line of originalLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && generatedTitles.has(trimmed)) continue;
    if (trimmed && !trimmed.startsWith('#')) {
      if (generatedRuleSet.has(trimmed) || seenCustom.has(trimmed)) continue;
      seenCustom.add(trimmed);
    }
    customLines.push(line);
  }
  while (customLines.length && !customLines[0].trim()) customLines.shift();
  while (customLines.length && !customLines.at(-1).trim()) customLines.pop();
  if (customLines.length) sections.push(`# User Custom Rules\n${customLines.join('\n')}`);

  const content = `${sections.join('\n\n').trim()}\n`;
  const conflicts = originalLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('!') && generatedRuleSet.has(line.slice(1)));
  return { content, detected, selected: stackIds, customRuleCount: customLines.filter((line) => line.trim() && !line.trim().startsWith('#')).length, conflicts };
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large (maximum 1 MB).'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    req.on('error', reject);
  });
}

const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/templates') {
    return sendJson(res, 200, { stacks, os: osTemplates.map(({ title }) => title) });
  }
  if (req.method === 'POST' && url.pathname === '/api/generate') {
    try {
      const payload = await readJson(req);
      return sendJson(res, 200, generate(payload));
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not generate .gitignore.' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD, POST' });
    return res.end('Method not allowed');
  }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, requested);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => console.log(`Gitignorer running on http://0.0.0.0:${PORT}`));
}

module.exports = { detectStacks, generate, server, stacks };
