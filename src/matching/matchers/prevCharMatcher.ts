import type { MatchContext, Matcher } from '../../types';
import { CONSTANT, GLOBAL_VAR, LABEL, MESANIM, PROC } from "../matchType";
import { reference } from "../../utils/matchUtils";

/**
* Looks for matches based on the previous character, such as ~WORD indicates a proc reference
*/
function prevCharMatcherFn(context: MatchContext): void {
  switch (context.prevChar) {
    case '^': return reference(CONSTANT, context);
    case '%': return reference(GLOBAL_VAR, context);
    case '@': return labelMatcher(context);
    case '~': return reference(PROC, context);
    case ',': return (context.prevWord && context.prevWord.value === "p") ? reference(MESANIM, context) : undefined;
    default: return undefined;
  }
}

function labelMatcher(context: MatchContext): void {
  if (context.nextChar === '@' && context.word.value.length === 3) {
    return; 
  }
  if (context.prevWord) {
    const prevHasLeadingAt = context.line.text.charAt(context.prevWord.start - 1) === '@';
    const prevHasTrailingAt = context.line.text.charAt(context.prevWord.end + 1) === '@';
    const tagTouchesWord = context.prevWord.end + 1 === context.word.start - 1;
    if (prevHasLeadingAt && prevHasTrailingAt && tagTouchesWord) {
      return;
    }
  }
  reference(LABEL, context);
}

export const prevCharMatcher: Matcher = { priority: 7000, fn: prevCharMatcherFn };
