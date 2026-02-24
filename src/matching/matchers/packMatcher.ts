import type { MatchContext, MatchType, Matcher } from '../../types';
import { reference } from "../../utils/matchUtils";
import { dataTypeToMatchId } from "../../resource/dataTypeToMatchId";
import { COMPONENT, GLOBAL_VAR, SKIP, UNKNOWN, getMatchTypeById } from "../matchType";

/**
* Looks for matches in pack files
*/
function packMatcherFn(context: MatchContext): void {
  if (context.file.type === 'pack' && context.word.index === 1) {
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
