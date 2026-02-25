import type { CancellationToken, DocumentSemanticTokensProvider, TextDocument } from 'vscode';
import { EventEmitter, SemanticTokensLegend, SemanticTokensBuilder } from 'vscode';
import { getActiveCacheFile, getAllMatches, getAllParsedWords } from '../cache/activeFileCache';
import { SemanticTokenType } from '../enum/semanticTokens';
import { isAdvancedFeaturesEnabled } from '../utils/featureAvailability';
import { getFileInfo } from '../utils/fileUtils';
import { KEYWORD_REGEX, SWITCH_TYPE_REGEX, TYPE_REGEX } from '../enum/regex';

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
    if (!isAdvancedFeaturesEnabled(document.uri)) {
      if (getFileInfo(document.uri).type !== 'rs2') {
        return new SemanticTokensBuilder(semanticTokensLegend).build();
      }
      if (document.uri.fsPath !== getActiveCacheFile()) {
        return new SemanticTokensBuilder(semanticTokensLegend).build();
      }
      return buildCommandCandidateTokens(document);
    }
    // Only provide tokens for the document the active cache was built for.
    if (document.uri.fsPath !== getActiveCacheFile()) {
      return new SemanticTokensBuilder(semanticTokensLegend).build();
    }
    if (!enabled) {
      return cachedTokens ?? new SemanticTokensBuilder(semanticTokensLegend).build();
    }
    enabled = false;
    const builder = new SemanticTokensBuilder(semanticTokensLegend);
    for (const wordMatch of getAllMatches()) {
      const tokenConfig = wordMatch.context.matchType.semanticTokenConfig;
      let token = wordMatch.context.declaration ? tokenConfig?.declaration : tokenConfig?.reference;
      if (!token && wordMatch.context.word.inString && wordMatch.context.matchType.referenceOnly) {
        token = SemanticTokenType.Property;
      }
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

function buildCommandCandidateTokens(document: TextDocument) {
  const builder = new SemanticTokensBuilder(semanticTokensLegend);
  const wordsByLine = getAllParsedWords();
  for (const [lineNum, words] of wordsByLine.entries()) {
    const lineText = document.lineAt(lineNum).text;
    for (const word of words) {
      if (word.inString || word.inInterpolation) continue;
      if (KEYWORD_REGEX.test(word.value) || TYPE_REGEX.test(word.value) || SWITCH_TYPE_REGEX.test(word.value)) {
        continue;
      }
      const nextNonWhitespace = lineText.slice(word.end + 1).match(/\S/);
      if (!nextNonWhitespace) continue;
      const nextIndex = word.end + 1 + nextNonWhitespace.index!;
      if (lineText.charAt(nextIndex) !== '(') continue;
      const length = word.end - word.start + 1;
      builder.push(lineNum, word.start, length, tokenTypeIndex.get(SemanticTokenType.Function)!, 0);
    }
  }
  return builder.build();
}
