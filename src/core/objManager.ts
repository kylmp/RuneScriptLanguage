import { DecorationRangeBehavior, Position, Range, Uri, window } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { getLines } from "../utils/stringUtils";

export function isObjFile(uri: Uri): boolean {
  return uri.fsPath.endsWith('.obj');
}

let activeObjFile: string | undefined;
let pendingEditTimer: NodeJS.Timeout | undefined;
let pendingEditDocument: TextDocument | undefined;

const OBJ_EDIT_DEBOUNCE_MS = 150;

const objRespawnDecoration = window.createTextEditorDecorationType({
  after: {
    color: 'rgba(160, 160, 160, 0.75)',
    margin: '0 0 0 1.5em',
    fontStyle: 'italic'
  },
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

export function handleObjFileOpened(document: TextDocument) {
  activeObjFile = document.uri.fsPath;
  applyObjDecorations(document);
}

export function handleObjFileEdited(changeEvent: TextDocumentChangeEvent) {
  const document = changeEvent.document;
  if (!activeObjFile && isObjFile(document.uri)) {
    handleObjFileOpened(document);
    return;
  }
  if (activeObjFile !== document.uri.fsPath) return;
  pendingEditDocument = document;
  if (pendingEditTimer) clearTimeout(pendingEditTimer);
  pendingEditTimer = setTimeout(() => flushPendingEdits(), OBJ_EDIT_DEBOUNCE_MS);
}

export function handleObjFileClosed() {
  if (activeObjFile) clearDecorations();
  activeObjFile = undefined;
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditTimer = undefined;
  }
  pendingEditDocument = undefined;
}

export function clear() {
  handleObjFileClosed();
}

function flushPendingEdits() {
  if (!pendingEditDocument || activeObjFile !== pendingEditDocument.uri.fsPath) {
    pendingEditDocument = undefined;
    pendingEditTimer = undefined;
    return;
  }
  const doc = pendingEditDocument;
  pendingEditDocument = undefined;
  pendingEditTimer = undefined;
  applyObjDecorations(doc);
}

function applyObjDecorations(document?: TextDocument) {
  const editor = document ? findEditorForDocument(document) : window.activeTextEditor;
  if (!editor || activeObjFile !== editor.document.uri.fsPath) {
    if (editor) editor.setDecorations(objRespawnDecoration, []);
    return;
  }
  editor.setDecorations(objRespawnDecoration, buildRespawnDecorations(editor.document));
}

function buildRespawnDecorations(document: TextDocument): DecorationOptions[] {
  const decorations: DecorationOptions[] = [];
  const lines = getLines(document.getText());
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';
    const match = /^\s*respawnrate\s*=\s*(\d+)\b/.exec(line);
    if (!match) continue;
    const ticks = Number(match[1]);
    if (!Number.isFinite(ticks)) continue;
    const label = formatTimerHint(ticks);
    const range = new Range(new Position(lineNum, line.length), new Position(lineNum, line.length));
    decorations.push({
      range,
      renderOptions: {
        after: { contentText: label }
      }
    });
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

function clearDecorations() {
  const editor = window.activeTextEditor;
  if (!editor) return;
  editor.setDecorations(objRespawnDecoration, []);
}

function findEditorForDocument(document: TextDocument): TextEditor | undefined {
  return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath);
}
