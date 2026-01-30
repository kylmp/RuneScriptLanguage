import { DecorationRangeBehavior, Diagnostic, DiagnosticSeverity, Position, Range, window, Uri } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { parseMapFile, type MapEntry, type MapParseError, type MapParseResult, type MapEntryKind } from "../parsing/mapParser";
import { get as getIdName } from "../cache/idCache";
import { LOC, NPC, OBJ } from "../matching/matchType";
import { getLines } from "../utils/stringUtils";
import { getByKey as getIdentifierByKey } from "../cache/identifierCache";
import type { Identifier } from "../types";
import { clearFileDiagnostics, setCustomDiagnostics } from "./diagnostics";
import { Events, logEvent, logMapFileProcessed } from "./devMode";
import { getFileName } from "../utils/fileUtils";

export function isMapFile(uri: Uri) {
  return uri.fsPath.endsWith('.jm2');
}

let activeMapFile: string | undefined;
let activeChunkX: number | undefined;
let activeChunkZ: number | undefined;
let entriesByLine = new Map<number, MapEntry>();
let errorsByLine = new Map<number, MapParseError>();
let pendingEditTimer: NodeJS.Timeout | undefined;
let pendingEditDocument: TextDocument | undefined;
let pendingStartLine = Number.MAX_SAFE_INTEGER;
let pendingEndLine = 0;

const MAP_EDIT_DEBOUNCE_MS = 150;

const mapDecoration = window.createTextEditorDecorationType({
  after: {
    color: 'rgba(160, 160, 160, 0.75)',
    margin: '0 0 0 1.5em',
    fontStyle: 'italic'
  },
  rangeBehavior: DecorationRangeBehavior.ClosedClosed
});

export function getIdentifierAtPosition(position: Position): Identifier | undefined {
  const entry = entriesByLine.get(position.line);
  if (!entry || !entry.idRange.contains(position)) return undefined;
  const type = entry.kind.toUpperCase();
  const name = getIdName(type, String(entry.id));
  if (!name) return undefined;
  return getIdentifierByKey(name + type);
}


export function handleMapFileOpened(document: TextDocument) {
  logEvent(Events.MapFileOpened, () => `on map file ${getFileName(document.uri)}`);
  const start = performance.now();
  clear();
  activeMapFile = document.uri.fsPath;
  const chunk = parseChunkFromPath(activeMapFile);
  activeChunkX = chunk?.x;
  activeChunkZ = chunk?.z;
  const lines = getLines(document.getText());
  const result = parseMapFile(lines);
  indexResult(result, 0);
  applyTextDecorations(document);
  applyDiagnostics();
  logMapFileProcessed(start, document.uri, lines.length, false);
}

function applyTextDecorations(document?: TextDocument) {
  const editor = document ? findEditorForDocument(document) : window.activeTextEditor;
  if (!editor || activeMapFile !== editor.document.uri.fsPath) {
    if (editor) editor.setDecorations(mapDecoration, []);
    return;
  }
  editor.setDecorations(mapDecoration, buildDecorations(editor.document));
}

function applyDiagnostics() {
  const editor = window.activeTextEditor;
  if (!editor || activeMapFile !== editor.document.uri.fsPath) return;
  const diagnosticsList: Diagnostic[] = [];
  for (const entry of entriesByLine.values()) {
    const matchId = entry.kind === 'npc' ? NPC.id : entry.kind === 'loc' ? LOC.id : OBJ.id;
    const name = getIdName(matchId, entry.id.toString());
    if (name) continue;
    const diag = new Diagnostic(entry.idRange, `${matchId} id ${entry.id} not found`, DiagnosticSeverity.Warning);
    diag.source = 'map';
    diagnosticsList.push(diag);
  }
  setCustomDiagnostics(editor.document.uri, diagnosticsList);
}

export function handleMapFileEdited(changeEvent: TextDocumentChangeEvent) {
  const document = changeEvent.document;
  logEvent(Events.MapFileEdited, () => `on map file ${getFileName(document.uri)}`);
  if (!activeMapFile && isMapFile(document.uri)) {
    handleMapFileOpened(document);
    return;
  }
  if (activeMapFile !== document.uri.fsPath) return;
  if (pendingEditDocument && pendingEditDocument.uri.fsPath !== document.uri.fsPath) {
    flushPendingEdits();
  }
  pendingEditDocument = document;
  const { startLine, endLine } = getChangedLineRange(changeEvent);
  pendingStartLine = Math.min(pendingStartLine, startLine);
  pendingEndLine = Math.max(pendingEndLine, endLine);

  if (pendingEditTimer) clearTimeout(pendingEditTimer);
  pendingEditTimer = setTimeout(() => flushPendingEdits(), MAP_EDIT_DEBOUNCE_MS);
}

export function handleMapFileClosed() {
  if (activeMapFile) clearFileDiagnostics(Uri.file(activeMapFile));
  clear();
}

export function clear() {
  activeMapFile = undefined;
  activeChunkX = undefined;
  activeChunkZ = undefined;
  entriesByLine = new Map();
  errorsByLine = new Map();
  if (pendingEditTimer) {
    clearTimeout(pendingEditTimer);
    pendingEditTimer = undefined;
  }
  pendingEditDocument = undefined;
  pendingStartLine = Number.MAX_SAFE_INTEGER;
  pendingEndLine = 0;
}

function getChangedLineRange(changeEvent: TextDocumentChangeEvent): { startLine: number; endLine: number } {
  let startLine = Number.MAX_SAFE_INTEGER;
  let endLine = 0;
  for (const change of changeEvent.contentChanges) {
    startLine = Math.min(startLine, change.range.start.line);
    const addedLines = change.text.split(/\r?\n/).length - 1;
    const changeEndLine = Math.max(change.range.end.line, change.range.start.line + addedLines);
    endLine = Math.max(endLine, changeEndLine);
  }
  if (startLine === Number.MAX_SAFE_INTEGER) startLine = 0;
  return { startLine, endLine };
}

function flushPendingEdits() {
  if (!pendingEditDocument || activeMapFile !== pendingEditDocument.uri.fsPath) {
    pendingEditDocument = undefined;
    pendingStartLine = Number.MAX_SAFE_INTEGER;
    pendingEndLine = 0;
    pendingEditTimer = undefined;
    return;
  }
  const startLine = pendingStartLine === Number.MAX_SAFE_INTEGER ? 0 : pendingStartLine;
  const endLine = pendingEndLine;
  pendingStartLine = Number.MAX_SAFE_INTEGER;
  pendingEndLine = 0;
  pendingEditTimer = undefined;
  applyIncrementalParse(pendingEditDocument, startLine, endLine);
}

function applyIncrementalParse(document: TextDocument, startLine: number, endLine: number) {
  const start = performance.now();
  const lines = getLines(document.getText());
  const bounds = findSectionBounds(lines, startLine, endLine);
  if (!bounds) return;
  const { sectionStart, sectionEnd } = bounds;
  const slice = lines.slice(sectionStart, sectionEnd + 1);
  const result = parseMapFile(slice);
  replaceRange(sectionStart, sectionEnd, result);
  applyTextDecorations(document);
  applyDiagnostics();
  logMapFileProcessed(start, document.uri, sectionEnd - sectionStart, true);
}

function findSectionBounds(lines: string[], startLine: number, endLine: number): { sectionStart: number; sectionEnd: number } | undefined {
  const headerRegex = /^====\s*(\w+)\s*====\s*$/;
  let sectionStart = -1;
  let sectionKind: MapEntryKind | undefined;
  for (let i = Math.min(startLine, lines.length - 1); i >= 0; i--) {
    const match = headerRegex.exec(lines[i] ?? '');
    if (match) {
      const name = match[1]?.toLowerCase();
      if (name === 'loc' || name === 'npc' || name === 'obj') {
        sectionStart = i;
        sectionKind = name;
      }
      break;
    }
  }
  if (sectionStart < 0) {
    for (let i = Math.max(0, startLine); i < lines.length; i++) {
      const match = headerRegex.exec(lines[i] ?? '');
      if (match) {
        const name = match[1]?.toLowerCase();
        if (name === 'loc' || name === 'npc' || name === 'obj') {
          sectionStart = i;
          sectionKind = name;
          break;
        }
      }
    }
  }
  if (sectionStart < 0 || !sectionKind) return undefined;
  let sectionEnd = lines.length - 1;
  for (let i = Math.min(endLine + 1, lines.length - 1); i < lines.length; i++) {
    if (headerRegex.test(lines[i] ?? '')) {
      sectionEnd = i - 1;
      break;
    }
  }
  return { sectionStart, sectionEnd };
}

function indexResult(result: MapParseResult, lineOffset: number) {
  for (const entry of result.entries) {
    const line = entry.line + lineOffset;
    entriesByLine.set(line, offsetEntry(entry, lineOffset));
  }
  for (const error of result.errors) {
    const line = error.line + lineOffset;
    errorsByLine.set(line, offsetError(error, lineOffset));
  }
}

function replaceRange(startLine: number, endLine: number, result: MapParseResult) {
  for (let line = startLine; line <= endLine; line++) {
    entriesByLine.delete(line);
    errorsByLine.delete(line);
  }
  indexResult(result, startLine);
}

function offsetEntry(entry: MapEntry, lineOffset: number): MapEntry {
  return {
    ...entry,
    line: entry.line + lineOffset,
    range: offsetRange(entry.range, lineOffset),
    idRange: offsetRange(entry.idRange, lineOffset)
  };
}

function offsetError(error: MapParseError, lineOffset: number): MapParseError {
  return {
    ...error,
    line: error.line + lineOffset,
    range: error.range ? offsetRange(error.range, lineOffset) : undefined
  };
}

function offsetRange(range: Range, lineOffset: number): Range {
  return new Range(
    new Position(range.start.line + lineOffset, range.start.character),
    new Position(range.end.line + lineOffset, range.end.character)
  );
}

function buildDecorations(document: TextDocument): DecorationOptions[] {
  const decorations: DecorationOptions[] = [];
  for (const [line, entry] of entriesByLine) {
    const lineText = document.lineAt(line).text;
    const label = formatEntry(entry);
    if (!label) continue;
    const range = new Range(new Position(line, lineText.length), new Position(line, lineText.length));
    decorations.push({
      range,
      renderOptions: {
        after: { contentText: label }
      }
    });
  }
  return decorations;
}

function findEditorForDocument(document: TextDocument): TextEditor | undefined {
  return window.visibleTextEditors.find(editor => editor.document.uri.fsPath === document.uri.fsPath);
}

function formatEntry(entry: MapEntry): string {
  const name = resolveName(entry);
  const coord = formatCoord(entry);
  switch (entry.kind) {
    case 'obj': {
      const quantity = entry.extras[0];
      const qtyText = quantity !== undefined ? `, quantity: ${quantity}` : '';
      return `OBJ: ${name} (coordinates: ${coord}${qtyText})`;
    }
    case 'npc':
      return `NPC: ${name} (coordinates: ${coord})`;
    case 'loc': {
      const type = entry.extras[0];
      const rotation = entry.extras[1];
      const extraText = (type !== undefined || rotation !== undefined)
        ? `, type: ${type ?? 'n/a'}, rotation: ${rotation ?? 'n/a'}`
        : '';
      return `LOC: ${name} (coordinates: ${coord}${extraText})`;
    }
  }
}

function resolveName(entry: MapEntry): string {
  const matchId = entry.kind === 'npc' ? NPC.id : entry.kind === 'loc' ? LOC.id : OBJ.id;
  return getIdName(matchId, entry.id.toString()) ?? 'Unknown';
}

function formatCoord(entry: MapEntry): string {
  if (activeChunkX === undefined || activeChunkZ === undefined) {
    return `${entry.level}_${entry.x}_${entry.z}`;
  }
  return `${entry.level}_${activeChunkX}_${activeChunkZ}_${entry.x}_${entry.z}`;
}

function parseChunkFromPath(fsPath: string): { x: number; z: number } | undefined {
  const baseName = fsPath.split(/[/\\]/).pop() ?? '';
  const match = /^m(\d+)_(\d+)\.jm2$/i.exec(baseName);
  if (!match) return undefined;
  const x = Number(match[1]);
  const z = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
  return { x, z };
}
