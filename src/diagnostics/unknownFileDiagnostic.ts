import type { Range } from "vscode";
import type { MatchResult } from "../types";
import { Diagnostic, DiagnosticSeverity } from "vscode";
import { RunescriptDiagnostic } from "./RunescriptDiagnostic";
import { fileNamePostProcessor } from "../resource/postProcessors";
import { exists as projectFileExists } from '../cache/projectFilesCache';
import { MAPFILE } from "../matching/matchType";

export class UnknownFileDiagnostic extends RunescriptDiagnostic {
  // Tempoary holds file name between check() and create() calls
  fileName: string = '';
  // For this file (key), here are all the diagnostics that look for it (uri + ranges)
  cache: Map<string, Map<string, Range[]>> = new Map();
  
  check(result: MatchResult): boolean {
    if (result.context.matchType.postProcessor !== fileNamePostProcessor) return false;
    this.fileName = resultToFileKey(result);
    return !projectFileExists(this.fileName)
  }

  createDiagnostic(range: Range, result: MatchResult): Diagnostic {
    this.cacheDiagnostic(range, this.fileName, result.context.uri.fsPath);
    return this.create(range, this.fileName);
  }

  createByFileKey(range: Range, fileKey: string, fsPath: string): Diagnostic {
    this.cacheDiagnostic(range, fileKey, fsPath);
    return this.create(range, fileKey);
  } 

  create(range: Range, fileKey: string) {
    return new Diagnostic(range, `Refers to file ${fileKey}, but it doesn't exist`, DiagnosticSeverity.Warning);
  }

  cacheDiagnostic(range: Range, fileKey: string, fsPath: string) {
    const fileDiagnostics = this.cache.get(fileKey) ?? new Map<string, Range[]>();
    const diagnostics = fileDiagnostics.get(fsPath) ?? [];
    diagnostics.push(range);
    fileDiagnostics.set(fsPath, diagnostics);
    this.cache.set(fileKey, fileDiagnostics);
  }

  getDiagnosticsForFile(fileKey: string): Map<string, Range[]> {
    return this.cache.get(fileKey) ?? new Map();
  }

  clearUnknowns(fileKey: string): Map<string, Range[]> {
    const diagnosticsForFile = this.cache.get(fileKey);
    this.cache.delete(fileKey);
    return diagnosticsForFile ?? new Map();
  }
}

function resultToFileKey(result: MatchResult) {
  const fileType = (result.context.matchType.fileTypes || [])[0] ?? 'rs2';
  if (result.context.matchType.id === MAPFILE.id) {
    const first = result.word.charAt(0).toLowerCase();
    const value = first === 'l' ? `m${result.word.substring(1)}` : result.word;
    return `${value}.${fileType}`;
  }
  return `${result.word}.${fileType}`;
}
