import type { DiagnosticCollection, ExtensionContext, Diagnostic } from 'vscode';
import type { FileIdentifiers, IdentifierKey, MatchResult } from '../types';
import type { RunescriptDiagnostic } from '../diagnostics/RunescriptDiagnostic';
import { languages, Range, Uri } from 'vscode';
import { getSettingValue, Settings } from './settings';
import { UnknownIdentifierDiagnostic } from '../diagnostics/unknownIdentifierDiagnostic';
import { UnknownFileDiagnostic } from '../diagnostics/unknownFileDiagnostic';
import { get as getIdentifier, getByKey } from '../cache/identifierCache';
import { decodeReferenceToRange } from '../utils/cacheUtils';
import { getFileInfo, getFileName } from '../utils/fileUtils';
import { getAllMatchTypes } from '../matching/matchType';
import { isAdvancedFeaturesEnabled } from '../utils/featureAvailability';

let diagnostics: DiagnosticCollection | undefined;

const unknownIdenDiagnostic = new UnknownIdentifierDiagnostic();
const unknownFileDiagnostic = new UnknownFileDiagnostic();

const runescriptDiagnostics: RunescriptDiagnostic[] = [
  unknownIdenDiagnostic,
  unknownFileDiagnostic
]

export function registerDiagnostics(context: ExtensionContext): void {
  diagnostics = languages.createDiagnosticCollection('runescript-extension-diagnostics');
  context.subscriptions.push({ dispose: () => disposeDiagnostics() });
}

function disposeDiagnostics(): void {
  diagnostics?.dispose();
  diagnostics = undefined;
  runescriptDiagnostics.forEach(d => d.clearAll());
}

export function clearAllDiagnostics(): void {
  diagnostics?.clear();
  runescriptDiagnostics.forEach(d => d.clearAll());
}

export function clearFileDiagnostics(uri: Uri): void {
  diagnostics?.delete(uri);
  runescriptDiagnostics.forEach(d => d.clearFile(uri));
}

export function getFileDiagnostics(uri: Uri): readonly Diagnostic[] {
  return diagnostics?.get(uri) || [];
}

export function setCustomDiagnostics(uri: Uri, diagnosticsList: Diagnostic[]): void {
  if (!getSettingValue(Settings.ShowDiagnostics) || !diagnostics) return;
  diagnostics.set(uri, diagnosticsList);
}

export async function rebuildFileDiagnostics(uri: Uri, matchResults: MatchResult[]): Promise<void> {
  if (!getSettingValue(Settings.ShowDiagnostics) || !diagnostics) return;
  if (!isAdvancedFeaturesEnabled(uri)) {
    clearFileDiagnostics(uri);
    return;
  }
  const diagnosticsList: Diagnostic[] = [];
  for (const result of matchResults) {
    // Skip these types as they never have diagnostics
    if (result.context.matchType.noop || !result.context.matchType.cache) {
      continue;
    }

    // Build the range for the diagnostic
    const { line: { number: lineNum }, word: { start, end } } = result.context;
    const range = new Range(lineNum, start, lineNum, end + 1);

    // Check all match result against all diagnostics, add if detected
    runescriptDiagnostics.forEach(diag => {
      if (diag.check(result)) {
        const newDiagnostic = diag.createDiagnostic(range, result);
        newDiagnostic.source = 'runescript';
        diagnosticsList.push(newDiagnostic);
      }
    });
  }
  diagnostics.set(uri, diagnosticsList);
}

export function handleFileUpdate(before?: FileIdentifiers, after?: FileIdentifiers): void {
  if (!diagnostics) return;
  const beforeDecs = before?.declarations ?? new Set<IdentifierKey>();
  const afterDecs = after?.declarations ?? new Set<IdentifierKey>();
  const addedDeclarations: IdentifierKey[] = [];
  const removedDeclarations: IdentifierKey[] = [];

  for (const key of beforeDecs) {
    if (!afterDecs.has(key)) {
      removedDeclarations.push(key);
    }
  }
  for (const key of afterDecs) {
    if (!beforeDecs.has(key)) {
      addedDeclarations.push(key);
    }
  }

  // New declaration added: clear any cached "unknown identifier" diagnostics for this identifier key.
  for (const key of addedDeclarations) {
    const cleared = unknownIdenDiagnostic.clearUnknowns(key);
    if (!cleared) continue;
    for (const [fileKey, ranges] of cleared) {
      removeDiagnostics(Uri.file(fileKey), ranges)
    }
  }

  // Removed declarations: get the identifier, add "unknown identifier" diagnostic to every reference it has
  for (const key of removedDeclarations) {
    const iden = getByKey(key);
    if (!iden) continue;
    for (const [fsPath, locations] of Object.entries(iden.references)) {
      const uri = Uri.file(fsPath);
      const fileDiagnostics = [...(diagnostics.get(uri) ?? [])];
      for (const location of locations) {
        const range = decodeReferenceToRange(location);
        if (!range) continue;
        const exists = fileDiagnostics.some(d => d.range.isEqual(range));
        if (!exists) {
          fileDiagnostics.push(unknownIdenDiagnostic.createByRangeIden(range, iden, fsPath));
        }
      }
      diagnostics.set(uri, fileDiagnostics);
    }
  }
}

export function handleFileCreated(uri: Uri) {
  const fileKey = getFileName(uri);
  const diagnostics = unknownFileDiagnostic.clearUnknowns(fileKey);
  for (const [uri, ranges] of diagnostics) {
    removeDiagnostics(Uri.file(uri), ranges);
  }
}

export function handleFileDeleted(uri: Uri) {
  // If I delete name.if, I know that the identifier with cache key nameINTERFACE reference ranges
  // need to add the "unknown file" diagnostic
  if (!diagnostics) return;
  const fileInfo = getFileInfo(uri);
  if (fileInfo.type === 'rs2') return;
  const fileKey = `${fileInfo.name}.${fileInfo.type}`;
  const match = getAllMatchTypes().find(m => m.fileTypes?.includes(fileInfo.type));
  if (!match) return;
  const identifier = getIdentifier(fileInfo.name, match);
  if (!identifier) return;
  for (const [fsPath, locations] of Object.entries(identifier.references)) {
    const uri = Uri.file(fsPath);
    const fileDiagnostics = [...(diagnostics.get(uri) ?? [])];
    for (const location of locations) {
      const range = decodeReferenceToRange(location);
      if (!range) continue;
      const exists = fileDiagnostics.some(d => d.range.isEqual(range));
      if (!exists) {
        fileDiagnostics.push(unknownFileDiagnostic.createByFileKey(range, fileKey, fsPath));
      }
    }
    diagnostics.set(uri, fileDiagnostics);
  }
}

function removeDiagnostics(uri: Uri, ranges: Range[]): void {
  if (!diagnostics) return;
  const existing = diagnostics.get(uri) ?? [];
  const filtered = existing.filter(diag =>
    !ranges.some(r => r.isEqual(diag.range))
  );
  diagnostics.set(uri, filtered);
}
