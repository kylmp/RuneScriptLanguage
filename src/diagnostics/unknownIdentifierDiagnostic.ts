import { Diagnostic, DiagnosticSeverity, type Range, type Uri } from "vscode";
import type { Identifier, IdentifierKey, MatchResult } from "../types";
import { RunescriptDiagnostic } from "./RunescriptDiagnostic";
import { get as getIdentifier } from "../cache/identifierCache";
import { getFullName, resolveIdentifierKey } from "../utils/cacheUtils";

export class UnknownIdentifierDiagnostic extends RunescriptDiagnostic {
  /**
   * Cache the diagnostics by identifierKey, value is a map keyed by URI anda. range of references in that URI
   */
  cache: Map<IdentifierKey, Map<string, Range[]>> = new Map();

  clearAll(): void {
    this.cache.clear();
  }

  clearFile(uri: Uri): void {
    for (const [key, uris] of this.cache) {
      uris.delete(uri.fsPath);
      if (uris.size === 0) this.cache.delete(key);
    }
  }
  
  check(result: MatchResult): boolean {
    const identifier: Identifier | undefined = getIdentifier(result.word, result.context.matchType);
    if (!identifier) return false;
    return !result.context.matchType.referenceOnly && !result.context.declaration && !identifier.declaration;
  }

  createDiagnostic(range: Range, result: MatchResult): Diagnostic {
    this.cacheDiagnostic(range, resolveIdentifierKey(result.context.word.value, result.context.matchType), result.context.uri.fsPath);
    return this.create(range, result.context.matchType.id, result.word);
  }

  createByRangeIden(range: Range, iden: Identifier, fsPath: string): Diagnostic {
    this.cacheDiagnostic(range, iden.cacheKey, fsPath);
    return this.create(range, iden.matchId, getFullName(iden));
  }

  create(range: Range, matchTypeId: string, name: string): Diagnostic {
    return new Diagnostic(range, `Unknown ${matchTypeId.toLowerCase()}: ${name}`, DiagnosticSeverity.Warning);
  }

  cacheDiagnostic(range: Range, idenKey: string, fsPath: string) {
    const idenDiagnostics = this.cache.get(idenKey) ?? new Map<string, Range[]>();
    const fileIdenDiags = idenDiagnostics.get(fsPath) ?? [];
    fileIdenDiags.push(range);
    idenDiagnostics.set(fsPath, fileIdenDiags);
    this.cache.set(idenKey, idenDiagnostics);
  }

  clearUnknowns(identifierKey: IdentifierKey): Map<string, Range[]> | undefined {
    const cached = this.cache.get(identifierKey);
    this.cache.delete(identifierKey);
    return cached;
  }
}
