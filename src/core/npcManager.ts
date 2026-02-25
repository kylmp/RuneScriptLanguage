import { DecorationRangeBehavior, Position, Range, Uri, window } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { getLines } from "../utils/stringUtils";
import { CONFIG_DECLARATION_REGEX } from "../enum/regex";

export function isNpcFile(uri: Uri): boolean {
  return uri.fsPath.endsWith('.npc');
}

let activeNpcFile: string | undefined;
let pendingEditTimer: NodeJS.Timeout | undefined;
let pendingEditDocument: TextDocument | undefined;

const NPC_EDIT_DEBOUNCE_MS = 150;

const npcTimerDecoration = window.createTextEditorDecorationType({
  after: {
    color: 'rgba(160, 160, 160, 0.75)',
    margin: '0 0 0 1.5em',
    fontStyle: 'italic'
  },
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

export function handleNpcFileOpened(document: TextDocument) {
  activeNpcFile = document.uri.fsPath;
  applyNpcDecorations(document);
}

export function handleNpcFileEdited(changeEvent: TextDocumentChangeEvent) {
  const document = changeEvent.document;
  if (!activeNpcFile && isNpcFile(document.uri)) {
    handleNpcFileOpened(document);
    return;
  }
  if (activeNpcFile !== document.uri.fsPath) return;
  pendingEditDocument = document;
  if (pendingEditTimer) clearTimeout(pendingEditTimer);
  pendingEditTimer = setTimeout(() => flushPendingEdits(), NPC_EDIT_DEBOUNCE_MS);
}

export function handleNpcFileClosed() {
  if (activeNpcFile) clearDecorations();
  activeNpcFile = undefined;
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditTimer = undefined;
  }
  pendingEditDocument = undefined;
}

export function clear() {
  handleNpcFileClosed();
}

function flushPendingEdits() {
  if (!pendingEditDocument || activeNpcFile !== pendingEditDocument.uri.fsPath) {
    pendingEditDocument = undefined;
    pendingEditTimer = undefined;
    return;
  }
  const doc = pendingEditDocument;
  pendingEditDocument = undefined;
  pendingEditTimer = undefined;
  applyNpcDecorations(doc);
}

function applyNpcDecorations(document?: TextDocument) {
  const editor = document ? findEditorForDocument(document) : window.activeTextEditor;
  if (!editor || activeNpcFile !== editor.document.uri.fsPath) {
    if (editor) editor.setDecorations(npcTimerDecoration, []);
    return;
  }
  editor.setDecorations(npcTimerDecoration, buildTimerDecorations(editor.document));
}

function clearDecorations() {
  const editor = window.activeTextEditor;
  if (!editor) return;
  editor.setDecorations(npcTimerDecoration, []);
}

function buildTimerDecorations(document: TextDocument): DecorationOptions[] {
  const decorations: DecorationOptions[] = [];
  const lines = getLines(document.getText());
  let currentMaxrange = 7;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';
    if (line.startsWith('[') && CONFIG_DECLARATION_REGEX.test(line)) {
      currentMaxrange = 7;
      continue;
    }
    const timerMatch = /^\s*(timer|respawnrate|regenrate)\s*=\s*(\d+)\b/.exec(line);
    if (timerMatch) {
      const ticks = Number(timerMatch[2]);
      if (Number.isFinite(ticks)) {
        const label = formatTimerHint(ticks);
        const range = new Range(new Position(lineNum, line.length), new Position(lineNum, line.length));
        decorations.push({
          range,
          renderOptions: {
            after: { contentText: label }
          }
        });
      }
    }

    const rangeMatch = /^\s*(maxrange|wanderrange|huntrange|attackrange)\s*=\s*(\d+)\b/.exec(line);
    if (rangeMatch) {
      const rangeKey = rangeMatch[1] ?? '';
      const rangeValue = Number(rangeMatch[2]);
      if (Number.isFinite(rangeValue)) {
        if (rangeKey === 'maxrange') {
          currentMaxrange = rangeValue;
        }
        const label = formatRangeHint(rangeValue, rangeKey, currentMaxrange);
        const range = new Range(new Position(lineNum, line.length), new Position(lineNum, line.length));
        decorations.push({
          range,
          renderOptions: {
            after: { contentText: label }
          }
        });
      }
    }
  }
  return decorations;
}

function formatTimerHint(ticks: number): string {
  const tickLabel = ticks === 1 ? 'tick' : 'ticks';
  const secondsTimes10 = Math.round(ticks * 6);
  const seconds = secondsTimes10 / 10;
  const secondsText = (secondsTimes10 % 10 === 0) ? seconds.toString() : seconds.toFixed(1);
  return `${ticks} ${tickLabel} (${secondsText}s)`;
}

function formatRangeHint(rangeValue: number, rangeKey: string, maxrangeValue: number): string {
  let tiles: number;
  if (rangeKey === 'wanderrange' || rangeKey === 'huntrange') {
    tiles = rangeValue;
  } else if (rangeKey === 'attackrange') {
    tiles = maxrangeValue + rangeValue;
  } else {
    tiles = rangeValue + 1;
  }
  const tileLabel = tiles === 1 ? 'tile' : 'tiles';
  const zonesTimes10 = Math.round((tiles / 8) * 10);
  const zones = zonesTimes10 / 10;
  const zonesText = (zonesTimes10 % 10 === 0) ? zones.toString() : zones.toFixed(1);
  const zoneLabel = zones === 1 ? 'zone' : 'zones';
  return `${tiles} ${tileLabel} (${zonesText} ${zoneLabel})`;
}

function findEditorForDocument(document: TextDocument): TextEditor | undefined {
  return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath);
}
