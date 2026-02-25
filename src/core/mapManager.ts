import { DecorationRangeBehavior, Diagnostic, DiagnosticSeverity, Position, Range, window, Uri } from "vscode";
import type { DecorationOptions, TextDocument, TextDocumentChangeEvent, TextEditor } from "vscode";
import { parseMapFile, type MapEntry, type MapParseError, type MapParseResult, type MapSectionKind, type MapTileEntry } from "../parsing/mapParser";
import { get as getIdName, hasSymbols as hasIdSymbols } from "../cache/idCache";
import { FLO, LOC, NPC, OBJ } from "../matching/matchType";
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
let mapTilesByLine = new Map<number, MapTileEntry>();
let errorsByLine = new Map<number, MapParseError>();
let sectionsByLine = new Map<number, string>();
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
  if (!entry) return undefined;
  const { start, end } = entry.idRange;
  if (position.line !== start.line) return;
  if (position.character < start.character || position.character >= end.character) return;
  const type = entry.kind.toUpperCase();
  if (!hasIdSymbols(type)) return undefined;
  const name = getIdName(type, String(entry.id));
  if (!name) return undefined;
  return getIdentifierByKey(name + type);
}

export function getMapSectionHeaders(document: TextDocument): Array<{ line: number; name: string }> {
  if (activeMapFile !== document.uri.fsPath) return [];
  const sections: Array<{ line: number; name: string }> = [];
  for (const [line, name] of sectionsByLine) {
    sections.push({ line, name });
  }
  return sections.sort((a, b) => a.line - b.line);
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
    if (!hasIdSymbols(matchId)) {
      continue;
    }
    const name = getIdName(matchId, entry.id.toString());
    if (name) continue;
    const diag = new Diagnostic(entry.idRange, `${matchId} id ${entry.id} not found`, DiagnosticSeverity.Warning);
    diag.source = 'map';
    diagnosticsList.push(diag);
  }
  if (hasIdSymbols(FLO.id)) {
    for (const entry of mapTilesByLine.values()) {
      if (entry.flags.underlay !== undefined) {
        const name = getIdName(FLO.id, entry.flags.underlay.toString());
        if (!name) {
          const diag = new Diagnostic(entry.range, `FLO id ${entry.flags.underlay} not found`, DiagnosticSeverity.Warning);
          diag.source = 'map';
          diagnosticsList.push(diag);
        }
      }
      if (entry.flags.overlay) {
        const name = getIdName(FLO.id, entry.flags.overlay.id.toString());
        if (!name) {
          const diag = new Diagnostic(entry.range, `FLO id ${entry.flags.overlay.id} not found`, DiagnosticSeverity.Warning);
          diag.source = 'map';
          diagnosticsList.push(diag);
        }
      }
    }
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
  mapTilesByLine = new Map();
  errorsByLine = new Map();
  sectionsByLine = new Map();
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
  let sectionKind: MapSectionKind | undefined;
  for (let i = Math.min(startLine, lines.length - 1); i >= 0; i--) {
    const match = headerRegex.exec(lines[i] ?? '');
    if (match) {
      const name = match[1]?.toLowerCase();
      if (name === 'loc' || name === 'npc' || name === 'obj' || name === 'map') {
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
        if (name === 'loc' || name === 'npc' || name === 'obj' || name === 'map') {
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
  for (const tile of result.mapTiles) {
    const line = tile.line + lineOffset;
    mapTilesByLine.set(line, offsetMapTile(tile, lineOffset));
  }
  for (const error of result.errors) {
    const line = error.line + lineOffset;
    errorsByLine.set(line, offsetError(error, lineOffset));
  }
  for (const section of result.sections) {
    const line = section.line + lineOffset;
    sectionsByLine.set(line, section.name);
  }
}

function replaceRange(startLine: number, endLine: number, result: MapParseResult) {
  for (let line = startLine; line <= endLine; line++) {
    entriesByLine.delete(line);
    mapTilesByLine.delete(line);
    errorsByLine.delete(line);
    sectionsByLine.delete(line);
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

function offsetMapTile(entry: MapTileEntry, lineOffset: number): MapTileEntry {
  return {
    ...entry,
    line: entry.line + lineOffset,
    range: offsetRange(entry.range, lineOffset)
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
  const showEntityHints = hasIdSymbols(LOC.id) || hasIdSymbols(NPC.id) || hasIdSymbols(OBJ.id);
  const decorations: DecorationOptions[] = [];
  if (showEntityHints) {
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
  }
  for (const [line, entry] of mapTilesByLine) {
    const lineText = document.lineAt(line).text;
    const label = formatMapTile(entry);
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
      return `OBJ: ${name} (coord: ${coord}${qtyText})`;
    }
    case 'npc':
      return `NPC: ${name} (coord: ${coord})`;
    case 'loc': {
      const type = entry.extras[0];
      const rotation = entry.extras[1];
      const extraText = (type !== undefined || rotation !== undefined)
        ? `, shape: ${formatLocShape(type)}, rotation: ${rotation ?? '0'}`
        : '';
      return `LOC: ${name} (coord: ${coord}${extraText})`;
    }
  }
}

function formatMapTile(entry: MapTileEntry): string {
  const parts: string[] = [];
  const height = entry.flags.height !== undefined ? entry.flags.height.toString() : 'perlin';
  parts.push(`height: ${height}`);
  if (entry.flags.flags !== undefined) {
    parts.push(`flags: ${formatMapFlags(entry.flags.flags)}`);
  }
  if (entry.flags.overlay) {
    parts.push(`overlay: ${formatOverlay(entry.flags.overlay)}`);
  }
  if (entry.flags.underlay !== undefined) {
    parts.push(`underlay: ${formatFloName(entry.flags.underlay)}`);
  }
  return `MAP: ${parts.join(', ')}`;
}

function resolveName(entry: MapEntry): string {
  const matchId = entry.kind === 'npc' ? NPC.id : entry.kind === 'loc' ? LOC.id : OBJ.id;
  if (!hasIdSymbols(matchId)) return `${entry.id}`;
  return getIdName(matchId, entry.id.toString()) ?? 'Unknown';
}

function formatFloName(id: number): string {
  return getIdName(FLO.id, id.toString()) ?? 'Unknown';
}

function formatOverlay(overlay: { id: number; angle?: number; shape?: number }): string {
  const name = getIdName(FLO.id, overlay.id.toString()) ?? 'Unknown';
  const detailParts: string[] = [];
  if (overlay.shape !== undefined) {
    detailParts.push(formatOverlayShape(overlay.shape));
  }
  if (overlay.angle !== undefined) detailParts.push(`rotation ${overlay.angle}`);
  if (detailParts.length > 0) {
    return `${name} (${detailParts.join(', ')})`;
  }
  return name;
}

function formatMapFlags(flags: number): string {
  const names: string[] = [];
  if ((flags & 0x1) !== 0) names.push('block');
  if ((flags & 0x2) !== 0) names.push('link below');
  if ((flags & 0x4) !== 0) names.push('remove roof');
  if ((flags & 0x8) !== 0) names.push('vis below');
  if ((flags & 0x10) !== 0) names.push('force high detail');
  if (names.length === 0) return 'none';
  if (names.length === 1) return names[0];
  return `(${names.join(', ')})`;
}

function formatLocShape(shape?: number): string {
  switch (shape) {
    case 0: return 'wall straight';
    case 1: return 'wall diagonal corner';
    case 2: return 'wall l';
    case 3: return 'wall square corner';
    case 4: return 'walldecor straight nooffset';
    case 5: return 'walldecor straight offset';
    case 6: return 'walldecor diagonal offset';
    case 7: return 'walldecor diagonal nooffset';
    case 8: return 'walldecor diagonal both';
    case 9: return 'wall diagonal';
    case 10: return 'centrepiece straight';
    case 11: return 'centrepiece diagonal';
    case 12: return 'roof straight';
    case 13: return 'roof diagonal with roofedge';
    case 14: return 'roof diagonal';
    case 15: return 'roof l concave';
    case 16: return 'roof l convex';
    case 17: return 'roof flat';
    case 18: return 'roofedge straight';
    case 19: return 'roofedge diagonal corner';
    case 20: return 'roofedge l';
    case 21: return 'roofedge square corner';
    case 22: return 'ground decor';
    case undefined: return 'n/a';
    default: return `${shape}`;
  }
}

function formatOverlayShape(shape: number): string {
  switch (shape) {
    case 0: return 'plain';
    case 1: return 'diagonal';
    case 2: return 'left semi diagonal small';
    case 3: return 'right semi diagonal small';
    case 4: return 'left semi diagonal big';
    case 5: return 'right semi diagonal big';
    case 6: return 'half square';
    case 7: return 'corner small';
    case 8: return 'corner big';
    case 9: return 'fan small';
    case 10: return 'fan big';
    case 11: return 'trapezium';
    default: return `shape ${shape}`;
  }
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
