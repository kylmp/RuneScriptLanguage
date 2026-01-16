import type { MatchContext, Matcher } from '../../types';
import { SKIP } from "../matchType";
import { reference } from "../../utils/matchUtils";
import { getSwitchStmtType } from '../../cache/activeFileCache';

/**
* Looks for matches in case statements
*/
function switchCaseMatcherFn(context: MatchContext): void {
  if (context.file.type === 'rs2' && context.word.index > 0 && 
    context.words[context.word.index - 1].value === 'case' && context.word.value !== 'default') {
    const resolved = getSwitchStmtType(context.line.number, context.word.braceDepth);
    resolved ? reference(resolved, context) : reference(SKIP, context);
  }
}

export const switchCaseMatcher: Matcher = { priority: 8000, fn: switchCaseMatcherFn };
