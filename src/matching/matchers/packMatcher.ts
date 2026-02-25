import type { MatchContext, MatchType, Matcher } from '../../types';
import { reference } from "../../utils/matchUtils";
import { dataTypeToMatchId } from "../../resource/dataTypeToMatchId";
import { COMPONENT, GLOBAL_VAR, SKIP, UNKNOWN, getMatchTypeById } from "../matchType";

/**
* Looks for matches in pack files
*/
function packMatcherFn(context: MatchContext): void {
  if (context.file.type === 'pack' && context.word.index === 1) {
    const eqIndex = context.line.text.indexOf('=');
    if (eqIndex >= 0) {
      const value = context.line.text.slice(eqIndex + 1);
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        const leadingOffset = value.indexOf(trimmed);
        context.word.start = eqIndex + 1 + Math.max(0, leadingOffset);
        context.word.end = context.word.start + trimmed.length - 1;
        context.word.value = trimmed;
      }
    }
    let match: MatchType;
    if (context.word.value.startsWith("null")) {
      match = SKIP;
    } else if (GLOBAL_VAR.fileTypes?.includes(context.file.name)) {
      match = GLOBAL_VAR;
    } else if (context.file.name === 'interface' && context.word.value.includes(':')) {
      match = COMPONENT;
    } else {
      match = getMatchTypeById(dataTypeToMatchId(context.file.name)) ?? SKIP;
    }
    if (match.id !== SKIP.id && match.id !== UNKNOWN.id) {
      context.packId = context.words[0].value;
    }
    reference(match, context);
  }
}

export const packMatcher: Matcher = { priority: 1000, fn: packMatcherFn };
