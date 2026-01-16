import type { DiagnosticCollection, ExtensionContext, Uri } from 'vscode';
import type { Identifier, MatchResult } from '../types';
import { Diagnostic } from 'vscode';
import { DiagnosticSeverity, languages, Range } from 'vscode';
import { get as getIdentifierFromCache } from '../cache/identifierCache';
import { fileNamePostProcessor } from '../resource/postProcessors';
import { exists as projectFileExists } from '../cache/projectFilesCache';
import { getSettingValue, Settings } from './settings';

let diagnostics: DiagnosticCollection | undefined;

export function registerDiagnostics(context: ExtensionContext): void {
  diagnostics = languages.createDiagnosticCollection('runescript-extension-diagnostics');
  context.subscriptions.push({ dispose: () => disposeDiagnostics() });
}

function disposeDiagnostics(): void {
  diagnostics?.dispose();
  diagnostics = undefined;
}

export function clearAllDiagnostics(): void {
  diagnostics?.clear();
}

export function clearFileDiagnostics(uri: Uri): void {
  diagnostics?.delete(uri);
}

export async function rebuildFileDiagnostics(uri: Uri, matchResults: MatchResult[]): Promise<void> {
  if (!getSettingValue(Settings.ShowDiagnostics) || !diagnostics) return;
  const diagnosticsList: Diagnostic[] = [];
  for (const result of matchResults) {
    // Skip these types as they never have diagnostics
    if ((result.context.matchType.noop || result.context.matchType.hoverOnly)) {
      continue;
    }

    // Build the range for the diagnostic, if needed
    const { line: { number: lineNum }, word: { start, end } } = result.context;
    const range = buildRange(lineNum, start, end);

    // Check for matches that reference an actual file, and make sure the file exists
    if (result.context.matchType.postProcessor === fileNamePostProcessor) {
      const fileName = `${result.word}.${(result.context.matchType.fileTypes || [])[0] ?? 'rs2'}`;
      if (!projectFileExists(fileName)) {
        diagnosticsList.push(buildFileNotFoundDiagnostic(range, fileName));
      }
    }

    // Below this point the identifier itself is needed
    const identifier: Identifier | undefined = getIdentifierFromCache(result.word, result.context.matchType);
    if (!identifier) {
      continue;
    }

    // Check for unknown identifiers that are trying to be used
    else if (!result.context.matchType.referenceOnly && !result.context.declaration && !identifier.declaration) {
      diagnosticsList.push(buildUnknownItemDiagnostic(range, result.context.matchType.id, result.word));
    }
  }
  diagnostics.set(uri, diagnosticsList);
}

export function getFileDiagnostics(uri: Uri): readonly Diagnostic[] {
  return diagnostics?.get(uri) || [];
}

function buildUnknownItemDiagnostic(range: Range, matchTypeId: string, word: string): Diagnostic {
  return buildDiagnostic(range, `Unknown ${matchTypeId.toLowerCase()}: ${word}`);
}

function buildFileNotFoundDiagnostic(range: Range, fileName: string): Diagnostic {
  return buildDiagnostic(range, `Refers to file ${fileName}, but it doesn't exist`);
}

function buildDiagnostic(range: Range, message: string, severity = DiagnosticSeverity.Warning): Diagnostic {
  const diagnostic = new Diagnostic(range, message, severity);
  diagnostic.source = 'runescript';
  return diagnostic;
}

function buildRange(lineNum: number, start: number, end: number): Range {
  return new Range(lineNum, start, lineNum, end + 1);
}


