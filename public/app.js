const state = { stacks: [], detected: new Set(), overrides: new Map(), result: null, debounce: null, paths: [] };
const byId = (id) => document.getElementById(id);
const stackGroups = byId('stack-groups');

async function loadTemplates() {
  try {
    const response = await fetch('/api/templates');
    if (!response.ok) throw new Error('Could not load technology list.');
    const data = await response.json();
    state.stacks = data.stacks;
    renderStacks();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function isSelected(id) {
  return state.overrides.has(id) ? state.overrides.get(id) : state.detected.has(id);
}

function renderStacks() {
  const groups = [...new Set(state.stacks.map((item) => item.category))];
  stackGroups.replaceChildren();
  for (const group of groups) {
    const section = document.createElement('div');
    section.className = 'stack-group';
    const heading = document.createElement('div');
    heading.className = 'stack-group-label';
    heading.textContent = group;
    const cards = document.createElement('div');
    cards.className = 'stack-grid';
    for (const stack of state.stacks.filter((item) => item.category === group)) {
      const label = document.createElement('label');
      label.className = `stack-card${isSelected(stack.id) ? ' selected' : ''}${state.detected.has(stack.id) ? ' auto-detected' : ''}`;
      label.htmlFor = `stack-${stack.id}`;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.id = `stack-${stack.id}`;
      check.checked = isSelected(stack.id);
      check.addEventListener('change', () => {
        state.overrides.set(stack.id, check.checked);
        renderStacks();
        scheduleGenerate();
      });
      const icon = document.createElement('span');
      icon.className = `stack-icon icon-${stack.id}`;
      icon.textContent = abbreviations[stack.id] || stack.name.slice(0, 2);
      const text = document.createElement('span');
      text.className = 'stack-name';
      text.textContent = stack.name;
      const checkMark = document.createElement('span');
      checkMark.className = 'check-mark';
      checkMark.textContent = '✓';
      label.append(check, icon, text, checkMark);
      cards.append(label);
    }
    section.append(heading, cards);
    stackGroups.append(section);
  }
  const count = state.detected.size;
  byId('detected-count').textContent = count ? `${count} detected` : 'Nothing detected yet';
}

const abbreviations = { node: 'JS', python: 'Py', rust: 'Rs', go: 'Go', java: 'Jv', ruby: 'Rb', php: 'Ph', dart: 'Da', cpp: 'C+', docker: 'Dk', github: 'GH', jetbrains: 'JB', vscode: 'VS', eclipse: 'Ec' };

function updateFilePaths(paths) {
  state.paths = [...new Set(paths.map((path) => path.replaceAll('\\', '/').trim()).filter(Boolean))];
  byId('file-list').value = state.paths.join('\n');
  const row = byId('file-list-row');
  row.hidden = !state.paths.length;
  byId('file-count').textContent = `${state.paths.length} ${state.paths.length === 1 ? 'file' : 'files'} scanned locally`;
  detectAndGenerate();
}

async function detectAndGenerate() {
  const files = byId('file-list').value.split(/\r?\n/).map((path) => path.trim()).filter(Boolean);
  state.paths = files;
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, selected: [...state.overrides].filter(([, selected]) => selected).map(([id]) => id), existing: byId('existing-rules').value, dotenv: byId('dotenv-toggle').checked }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Generation failed.');
    state.detected = new Set(result.detected);
    state.result = result;
    renderStacks();
    renderOutput(result);
    const detectedNames = state.stacks.filter((item) => state.detected.has(item.id)).map((item) => item.name);
    byId('preview-status-text').textContent = detectedNames.length ? `${detectedNames.length} stack${detectedNames.length > 1 ? 's' : ''} detected` : 'Rules generated';
    const listRow = byId('file-list-row');
    listRow.hidden = files.length === 0;
    if (files.length) byId('file-count').textContent = `${files.length} ${files.length === 1 ? 'path' : 'paths'} scanned locally`;
    hideNotice();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

function renderOutput(result) {
  const content = result.content || '';
  const lines = content.replace(/\n$/, '').split('\n');
  const code = byId('output-code');
  code.replaceChildren();
  lines.forEach((line, index) => {
    const span = document.createElement('span');
    span.className = line.startsWith('#') ? 'code-comment' : line.startsWith('!') ? 'code-negation' : 'code-rule';
    span.textContent = line || ' ';
    code.append(span);
    if (index < lines.length - 1) code.append(document.createTextNode('\n'));
  });
  byId('line-numbers').textContent = lines.map((_, index) => index + 1).join('\n');
  byId('line-badge').textContent = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;
  byId('custom-count').textContent = result.customRuleCount ? `${result.customRuleCount} custom ${result.customRuleCount === 1 ? 'rule' : 'rules'} kept` : 'No custom rules';
  if (result.conflicts.length) showNotice(`A custom exception conflicts with a generated rule: ${result.conflicts.join(', ')}. Your custom rule is placed last and takes priority.`, 'warning');
}

function scheduleGenerate() {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(detectAndGenerate, 180);
}

function showNotice(message, type) {
  const notice = byId('notice');
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
}
function hideNotice() { byId('notice').hidden = true; }

byId('file-list').addEventListener('input', () => {
  const paths = byId('file-list').value.split(/\r?\n/).map((path) => path.trim()).filter(Boolean);
  state.paths = paths;
  byId('file-list-row').hidden = !paths.length;
  byId('file-count').textContent = `${paths.length} ${paths.length === 1 ? 'path' : 'paths'} scanned locally`;
  scheduleGenerate();
});
byId('existing-rules').addEventListener('input', scheduleGenerate);
byId('dotenv-toggle').addEventListener('change', scheduleGenerate);
byId('generate-button').addEventListener('click', detectAndGenerate);

byId('browse-files').addEventListener('click', (event) => { event.stopPropagation(); byId('file-picker').click(); });
byId('dropzone').addEventListener('click', (event) => { if (!event.target.closest('button')) byId('file-picker').click(); });
byId('dropzone').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); byId('file-picker').click(); } });
byId('file-picker').addEventListener('change', (event) => {
  const files = [...event.target.files].map((file) => file.webkitRelativePath || file.name);
  updateFilePaths(files);
  event.target.value = '';
});
const dropzone = byId('dropzone');
for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('drag-active'); });
for (const eventName of ['dragleave', 'drop']) dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('drag-active'); });
dropzone.addEventListener('drop', (event) => {
  const files = [...event.dataTransfer.files].map((file) => file.webkitRelativePath || file.name);
  if (files.length) updateFilePaths(files);
});
byId('clear-files').addEventListener('click', () => updateFilePaths([]));

byId('copy-button').addEventListener('click', async () => {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(state.result.content);
    showNotice('Copied .gitignore to clipboard.', 'success');
    setTimeout(hideNotice, 2200);
  } catch {
    showNotice('Clipboard access was blocked. Select the preview and copy it manually.', 'error');
  }
});
byId('download-button').addEventListener('click', () => {
  if (!state.result) return;
  const blob = new Blob([state.result.content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '.gitignore';
  link.click();
  URL.revokeObjectURL(link.href);
  showNotice('Downloaded .gitignore.', 'success');
  setTimeout(hideNotice, 2200);
});

loadTemplates().then(detectAndGenerate);
