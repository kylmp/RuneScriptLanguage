import type { MatchContext, Matcher } from '../../types';
import { SKIP } from "../matchType";
import { reference } from "../../utils/matchUtils";
import { getSwitchStmtType } from '../../cache/activeFileCache';
import { SWITCH_CASE_REGEX } from '../../enum/regex';

/**
* Looks for matches in case statements
*/
function switchCaseMatcherFn(context: MatchContext): void {
  if (context.word.index > 0 && SWITCH_CASE_REGEX.test(context.line.text) && context.lineIndex < context.line.text.indexOf(' :')) {
    if (context.word.value === 'default') return reference(SKIP, context);
    const resolved = getSwitchStmtType(context.line.number, context.word.braceDepth);
    resolved ? reference(resolved, context) : reference(SKIP, context);
  }
}

export const switchCaseMatcher: Matcher = { priority: 11000, fn: switchCaseMatcherFn };
