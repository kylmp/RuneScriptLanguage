import { ViewColumn, window } from 'vscode';
import { get } from '../cache/identifierCache';
import { getAllWithPrefix } from '../cache/completionCache';
import { getAllMatchTypes, getMatchTypeById } from '../matching/matchType';
import { serializeIdentifier } from '../resource/identifierFactory';

export function showIdentifierLookupView(): void {
  const panel = window.createWebviewPanel(
    'runescriptIdentifierLookup',
    'Runescript: Identifier Lookup',
    ViewColumn.One,
    { enableScripts: true }
  );
  panel.webview.html = getIdentifierLookupHtml();
  const matchTypeIds = getAllMatchTypes().map(matchType => matchType.id).sort();
  void panel.webview.postMessage({ type: 'init', matchTypeIds });
  panel.webview.onDidReceiveMessage((message) => {
    if (!message) return;
    if (message.type === 'suggest') {
      const matchTypeId = (message.matchTypeId ?? '').toString().trim().toUpperCase();
      const prefix = (message.prefix ?? '').toString();
      if (!matchTypeId || !prefix) {
        void panel.webview.postMessage({ type: 'suggestions', results: [] });
        return;
      }
      const matchType = getMatchTypeById(matchTypeId);
      if (!matchType) {
        void panel.webview.postMessage({ type: 'suggestions', results: [] });
        return;
      }
      const results = getAllWithPrefix(prefix, matchType.id)?.slice(0, 200) ?? [];
      void panel.webview.postMessage({ type: 'suggestions', results });
      return;
    }
    if (message.type !== 'lookup') return;
    const name = (message.name ?? '').toString().trim();
    const matchTypeId = (message.matchTypeId ?? '').toString().trim();
    if (!name || !matchTypeId) {
      void panel.webview.postMessage({ type: 'result', result: 'Name and match type id are required.' });
      return;
    }
    const normalizedMatchTypeId = matchTypeId.toUpperCase();
    const matchType = getMatchTypeById(normalizedMatchTypeId);
    if (!matchType) {
      void panel.webview.postMessage({ type: 'result', result: `Unknown match type id: ${matchTypeId}` });
      return;
    }
    const identifier = get(name, matchType);
    if (!identifier) {
      void panel.webview.postMessage({ type: 'result', result: `No identifier found for "${name}" (${matchType.id})` });
      return;
    }
    const serialized = serializeIdentifier(identifier);
    void panel.webview.postMessage({ type: 'result', result: JSON.stringify(serialized, undefined, 2) });
  });
}

function getIdentifierLookupHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Runescript Identifier Lookup</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        margin: 16px;
      }
      .row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      input {
        flex: 1;
        padding: 6px 8px;
      }
      button {
        padding: 6px 12px;
      }
      pre {
        white-space: pre-wrap;
        padding: 12px;
        border: 1px solid;
        border-radius: 4px;
        min-height: 200px;
      }
    </style>
  </head>
  <body>
    <div class="row">
      <input id="matchType" placeholder="Match type id (e.g. OBJ, LOC, COMMAND)" list="matchTypeOptions" autofocus />
      <datalist id="matchTypeOptions"></datalist>
      <input id="name" placeholder="Identifier name" list="nameOptions" disabled />
      <datalist id="nameOptions"></datalist>
      <button id="find">Find</button>
    </div>
    <pre id="result">Enter a name and match type id, then click Find.</pre>
    <script>
      const vscode = acquireVsCodeApi();
      const nameInput = document.getElementById('name');
      const matchTypeInput = document.getElementById('matchType');
      const result = document.getElementById('result');
      const findButton = document.getElementById('find');
      const nameOptions = document.getElementById('nameOptions');
      let matchTypeIds = [];
      const isMatchTypeValid = (value) => {
        const normalized = (value || '').trim().toUpperCase();
        if (!normalized) return false;
        return matchTypeIds.includes(normalized);
      };
      const updateNameEnabled = () => {
        const enabled = isMatchTypeValid(matchTypeInput.value);
        const wasDisabled = nameInput.disabled;
        nameInput.disabled = !enabled;
        if (enabled && wasDisabled) {
          nameInput.focus();
        }
        if (!enabled) {
          nameInput.value = '';
          nameOptions.innerHTML = '';
        }
      };
      const runLookup = () => {
        vscode.postMessage({
          type: 'lookup',
          name: nameInput.value,
          matchTypeId: matchTypeInput.value
        });
      };
      findButton.addEventListener('click', runLookup);
      nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runLookup();
      });
      nameInput.addEventListener('input', () => {
        if (!isMatchTypeValid(matchTypeInput.value)) return;
        vscode.postMessage({
          type: 'suggest',
          prefix: nameInput.value,
          matchTypeId: matchTypeInput.value
        });
      });
      nameInput.addEventListener('change', () => {
        if (!isMatchTypeValid(matchTypeInput.value)) return;
        if (!nameInput.value.trim()) return;
        runLookup();
      });
      matchTypeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runLookup();
      });
      matchTypeInput.addEventListener('input', updateNameEnabled);
      setTimeout(() => matchTypeInput.focus(), 0);
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message) return;
        if (message.type === 'init') {
          matchTypeIds = (message.matchTypeIds || []).map((id) => id.toUpperCase());
          const options = matchTypeIds.map((id) => '<option value="' + id + '"></option>').join('');
          const datalist = document.getElementById('matchTypeOptions');
          datalist.innerHTML = options;
          updateNameEnabled();
          return;
        }
        if (message.type === 'result') {
          result.textContent = message.result || '';
          return;
        }
        if (message.type === 'suggestions') {
          const results = Array.isArray(message.results) ? message.results : [];
          nameOptions.innerHTML = results.map((value) => '<option value="' + value + '"></option>').join('');
        }
      });
    </script>
  </body>
</html>`;
}
