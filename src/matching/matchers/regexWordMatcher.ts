import type { MatchContext, Matcher } from '../../types';
import { COLOR_REGEX, COORD_REGEX, NUMBER_REGEX, SWITCH_TYPE_REGEX } from "../../enum/regex";
import { COLOR, COORDINATES, SKIP, SWITCH } from "../matchType";
import { reference } from "../../utils/matchUtils";

/**
* Looks for matches with direct word regex checks, such as for coordinates
*/
function regexWordMatcherFn(context: MatchContext): void {
  const word = context.word.value;
  if (NUMBER_REGEX.test(word)) {
    return reference(SKIP, context); // extension doesnt need to know if word is a number, but we can short circuit the matchers here by returning SKIP
  }
  if (COORD_REGEX.test(word)) {
    return reference(COORDINATES, context);
  }
  if (COLOR_REGEX.test(word)) {
    return reference(COLOR, context);
  }
  if (SWITCH_TYPE_REGEX.test(word)) {
    return reference(SWITCH, context);
  }
}

export const regexWordMatcher: Matcher = { priority: 5000, fn: regexWordMatcherFn };
