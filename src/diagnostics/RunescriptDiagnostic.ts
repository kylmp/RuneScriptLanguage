import type { Diagnostic, Range, Uri } from 'vscode';
import type { MatchResult } from '../types';

export abstract class RunescriptDiagnostic {
  clearAll(): void { }
  clearFile(_uri: Uri): void { }
  abstract check(result: MatchResult): boolean;
  abstract createDiagnostic(range: Range, result: MatchResult): Diagnostic;
}
