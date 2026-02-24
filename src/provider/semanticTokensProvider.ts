import type { CancellationToken, DocumentSemanticTokensProvider, TextDocument } from 'vscode';
import { EventEmitter, SemanticTokensLegend, SemanticTokensBuilder } from 'vscode';
import { getActiveCacheFile, getAllMatches } from '../cache/activeFileCache';
import { SemanticTokenType } from '../enum/semanticTokens';

const tokenTypes = Object.values(SemanticTokenType);
const tokenTypeIndex = new Map<string, number>(tokenTypes.map((t, i) => [t, i]));
const tokenModifiers: string[] = [];
const tokensChanged = new EventEmitter<void>();
let enabled = false;
let cachedTokens: ReturnType<SemanticTokensBuilder['build']> | undefined;

export const semanticTokensLegend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

export const semanticTokensProvider: DocumentSemanticTokensProvider = {
  onDidChangeSemanticTokens: tokensChanged.event,
  provideDocumentSemanticTokens(document: TextDocument, _token: CancellationToken) {
    // Only provide tokens for the document the active cache was built for.
    if (document.uri.fsPath !== getActiveCacheFile()) {
      return new SemanticTokensBuilder(semanticTokensLegend).build();
    }
    if (!enabled) {
      return cachedTokens ?? new SemanticTokensBuilder(semanticTokensLegend).build();
    }
    enabled = false;
    const builder = new SemanticTokensBuilder(semanticTokensLegend);
    const typesWithSemanticTokenConfig = getAllMatches().filter(match => match.context.matchType.semanticTokenConfig !== undefined)
    for (const wordMatch of typesWithSemanticTokenConfig) {
      const tokenConfig = wordMatch.context.matchType.semanticTokenConfig;
      const token = wordMatch.context.declaration ? tokenConfig?.declaration : tokenConfig?.reference;
      if (!token) continue;
      const lineNum = wordMatch.context.line.number;
      const start = wordMatch.context.word.start;
      const length = wordMatch.context.word.end - wordMatch.context.word.start + 1;
      builder.push(lineNum, start, length, tokenTypeIndex.get(token)!, 0);
    }
    const tokens = builder.build();
    cachedTokens = tokens;
    return tokens;
  }
};

export function rebuildSemanticTokens(): void {
  enabled = true;
  tokensChanged.fire();
}
