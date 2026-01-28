import type { Range } from "vscode";
import type { MatchResult } from "../types";
import { Diagnostic, DiagnosticSeverity } from "vscode";
import { RunescriptDiagnostic } from "./RunescriptDiagnostic";
import { fileNamePostProcessor } from "../resource/postProcessors";
import { exists as projectFileExists } from '../cache/projectFilesCache';

export class UnknownFileDiagnostic extends RunescriptDiagnostic {
  fileName: string = '';
  
  check(result: MatchResult): boolean {
    if (result.context.matchType.postProcessor !== fileNamePostProcessor) return false;
    this.fileName = `${result.word}.${(result.context.matchType.fileTypes || [])[0] ?? 'rs2'}`;
    return !projectFileExists(this.fileName)
  }

  createDiagnostic(range: Range): Diagnostic {
    return new Diagnostic(range, `Refers to file ${this.fileName}, but it doesn't exist`, DiagnosticSeverity.Warning);
  }
}
