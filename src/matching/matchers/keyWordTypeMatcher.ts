import type { MatchContext, Matcher } from '../../types';
import { KEYWORD_REGEX, TYPE_REGEX } from "../../enum/regex";
import { KEYWORD, TYPE } from "../matchType";
import { reference } from "../../utils/matchUtils";

/**
* Looks for matches with direct word regex checks, such as for coordinates
*/
function keywordTypeMatcherFn(context: MatchContext): void {
  const word = context.word.value;
  if (KEYWORD_REGEX.test(word)) {
    return reference(KEYWORD, context); 
  }
  if (TYPE_REGEX.test(word)) {
    return reference(TYPE, context);
  }
}

export const keywordTypeMatcher: Matcher = { priority: 13000, fn: keywordTypeMatcherFn };
