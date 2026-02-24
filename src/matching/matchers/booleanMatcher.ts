import type { MatchContext, Matcher } from '../../types';
import { BOOLEAN_REGEX } from "../../enum/regex";
import { BOOLEAN } from "../matchType";
import { reference } from "../../utils/matchUtils";

/**
* Looks for matches with direct word regex checks, such as for coordinates
*/
function booleanMatcherFn(context: MatchContext): void {
  const word = context.word.value;
  if (BOOLEAN_REGEX.test(word)) {
    return reference(BOOLEAN, context);
  }
}

export const booleanMatcher: Matcher = { priority: 11500, fn: booleanMatcherFn };
