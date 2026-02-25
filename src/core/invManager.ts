import { DecorationRangeBehavior, Position, Range, Uri, window } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { getLines } from "../utils/stringUtils";

export function isInvFile(uri: Uri): boolean {
  return uri.fsPath.endsWith('.inv');
}

let activeInvFile: string | undefined;
let pendingEditTimer: NodeJS.Timeout | undefined;
let pendingEditDocument: TextDocument | undefined;

const INV_EDIT_DEBOUNCE_MS = 150;

const invStockDecoration = window.createTextEditorDecorationType({
  after: {
    color: 'rgba(160, 160, 160, 0.75)',
    margin: '0 0 0 1.5em',
    fontStyle: 'italic'
  },
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

export function handleInvFileOpened(document: TextDocument) {
  activeInvFile = document.uri.fsPath;
  applyInvDecorations(document);
}

export function handleInvFileEdited(changeEvent: TextDocumentChangeEvent) {
  const document = changeEvent.document;
  if (!activeInvFile && isInvFile(document.uri)) {
    handleInvFileOpened(document);
    return;
  }
  if (activeInvFile !== document.uri.fsPath) return;
  pendingEditDocument = document;
  if (pendingEditTimer) clearTimeout(pendingEditTimer);
  pendingEditTimer = setTimeout(() => flushPendingEdits(), INV_EDIT_DEBOUNCE_MS);
}

export function handleInvFileClosed() {
  if (activeInvFile) clearDecorations();
  activeInvFile = undefined;
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditTimer = undefined;
  }
  pendingEditDocument = undefined;
}

export function clear() {
  handleInvFileClosed();
}

function flushPendingEdits() {
  if (!pendingEditDocument || activeInvFile !== pendingEditDocument.uri.fsPath) {
    pendingEditDocument = undefined;
    pendingEditTimer = undefined;
    return;
  }
  const doc = pendingEditDocument;
  pendingEditDocument = undefined;
  pendingEditTimer = undefined;
  applyInvDecorations(doc);
}

function applyInvDecorations(document?: TextDocument) {
  const editor = document ? findEditorForDocument(document) : window.activeTextEditor;
  if (!editor || activeInvFile !== editor.document.uri.fsPath) {
    if (editor) editor.setDecorations(invStockDecoration, []);
    return;
  }
  editor.setDecorations(invStockDecoration, buildStockDecorations(editor.document));
}

function buildStockDecorations(document: TextDocument): DecorationOptions[] {
  const decorations: DecorationOptions[] = [];
  const lines = getLines(document.getText());
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';
    const match = /^\s*stock\d+\s*=\s*[^,]+,\s*(\d+)(?:\s*,\s*(\d+))?/.exec(line);
    if (!match) continue;
    const quantity = Number(match[1]);
    if (!Number.isFinite(quantity)) continue;
    const restockValue = match[2] !== undefined ? Number(match[2]) : undefined;
    const label = formatStockHint(quantity, restockValue);
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

function formatStockHint(quantity: number, restockRate?: number): string {
  const restockText = (restockRate === undefined || !Number.isFinite(restockRate))
    ? 'default'
    : formatTickSeconds(restockRate);
  return `  quantity: ${quantity}, restockrate: ${restockText}`;
}

function formatTickSeconds(ticks: number): string {
  const tickLabel = ticks === 1 ? 'tick' : 'ticks';
  const secondsTimes10 = Math.round(ticks * 6);
  const seconds = secondsTimes10 / 10;
  const secondsText = (secondsTimes10 % 10 === 0) ? seconds.toString() : seconds.toFixed(1);
  const secondsLabel = seconds === 1 ? 'second' : 'seconds';
  return `${ticks} ${tickLabel} (${secondsText} ${secondsLabel})`;
}

function clearDecorations() {
  const editor = window.activeTextEditor;
  if (!editor) return;
  editor.setDecorations(invStockDecoration, []);
}

function findEditorForDocument(document: TextDocument): TextEditor | undefined {
  return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath);
}
