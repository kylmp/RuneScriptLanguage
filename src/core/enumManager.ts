import { DecorationRangeBehavior, Position, Range, Uri, window } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { getLines } from "../utils/stringUtils";

export function isEnumFile(uri: Uri): boolean {
  return uri.fsPath.endsWith('.enum');
}

let activeEnumFile: string | undefined;
let pendingEditTimer: NodeJS.Timeout | undefined;
let pendingEditDocument: TextDocument | undefined;

const ENUM_EDIT_DEBOUNCE_MS = 150;

const enumIndexDecoration = window.createTextEditorDecorationType({
  after: {
    color: 'rgba(160, 160, 160, 0.75)',
    margin: '0 0 0 1.5em',
    fontStyle: 'italic'
  },
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

export function handleEnumFileOpened(document: TextDocument) {
  activeEnumFile = document.uri.fsPath;
  applyEnumDecorations(document);
}

export function handleEnumFileEdited(changeEvent: TextDocumentChangeEvent) {
  const document = changeEvent.document;
  if (!activeEnumFile && isEnumFile(document.uri)) {
    handleEnumFileOpened(document);
    return;
  }
  if (activeEnumFile !== document.uri.fsPath) return;
  pendingEditDocument = document;
  if (pendingEditTimer) clearTimeout(pendingEditTimer);
  pendingEditTimer = setTimeout(() => flushPendingEdits(), ENUM_EDIT_DEBOUNCE_MS);
}

export function handleEnumFileClosed() {
  if (activeEnumFile) clearDecorations();
  activeEnumFile = undefined;
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditTimer = undefined;
  }
  pendingEditDocument = undefined;
}

export function clear() {
  handleEnumFileClosed();
}

function flushPendingEdits() {
  if (!pendingEditDocument || activeEnumFile !== pendingEditDocument.uri.fsPath) {
    pendingEditDocument = undefined;
    pendingEditTimer = undefined;
    return;
  }
  const doc = pendingEditDocument;
  pendingEditDocument = undefined;
  pendingEditTimer = undefined;
  applyEnumDecorations(doc);
}

function applyEnumDecorations(document?: TextDocument) {
  const editor = document ? findEditorForDocument(document) : window.activeTextEditor;
  if (!editor || activeEnumFile !== editor.document.uri.fsPath) {
    if (editor) editor.setDecorations(enumIndexDecoration, []);
    return;
  }
  editor.setDecorations(enumIndexDecoration, buildEnumDecorations(editor.document));
}

function buildEnumDecorations(document: TextDocument): DecorationOptions[] {
  const decorations: DecorationOptions[] = [];
  const lines = getLines(document.getText());
  const blocks = findEnumBlocks(lines);
  for (const block of blocks) {
    if (!block.isAutoInt) continue;
    let index = 0;
    for (let lineNum = block.start; lineNum <= block.end; lineNum++) {
      const line = lines[lineNum] ?? '';
      if (!line.startsWith('val=')) continue;
      const range = new Range(new Position(lineNum, line.length), new Position(lineNum, line.length));
      decorations.push({
        range,
        renderOptions: {
          after: { contentText: `index: ${index}` }
        }
      });
      index++;
    }
  }
  return decorations;
}

function findEnumBlocks(lines: string[]): Array<{ start: number; end: number; isAutoInt: boolean }> {
  const blocks: Array<{ start: number; end: number; isAutoInt: boolean }> = [];
  let currentStart = -1;
  let currentAutoInt = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('[') && line.endsWith(']')) {
      if (currentStart >= 0) {
        blocks.push({ start: currentStart, end: i - 1, isAutoInt: currentAutoInt });
      }
      currentStart = i + 1;
      currentAutoInt = false;
      continue;
    }
    if (currentStart >= 0 && line.startsWith('inputtype=')) {
      const value = line.substring('inputtype='.length).trim().toLowerCase();
      currentAutoInt = value === 'autoint';
    }
  }
  if (currentStart >= 0) {
    blocks.push({ start: currentStart, end: lines.length - 1, isAutoInt: currentAutoInt });
  }
  return blocks;
}

function clearDecorations() {
  const editor = window.activeTextEditor;
  if (!editor) return;
  editor.setDecorations(enumIndexDecoration, []);
}

function findEditorForDocument(document: TextDocument): TextEditor | undefined {
  return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath);
}
