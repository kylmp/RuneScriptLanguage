import type { MatchContext, Matcher } from '../../types';
import { TRIGGER_LINE_REGEX } from "../../enum/regex";
import { CATEGORY, SKIP, TRIGGER } from "../matchType";
import { runescriptTrigger } from "../../resource/triggers";
import { reference, declaration, addExtraData } from "../../utils/matchUtils";

/**
* Looks for matches with known runescript triggers, see triggers.ts
*/
function triggerMatcherFn(context: MatchContext): void {
  if (context.file.type !== 'rs2') {
    return undefined;
  }
  if (TRIGGER_LINE_REGEX.test(context.line.text)) {
    if (context.word.index > 1) return reference(SKIP, context);
    const trigger = runescriptTrigger[context.words[0].value.toLowerCase()];
    if (trigger) {
      if (context.word.index === 0) {
        addExtraData(context, { triggerName: context.words[1].value })
        return reference(TRIGGER, context);
      }
      if (context.word.value.charAt(0) === '_') {
        addExtraData(context, { matchId: trigger.match.id, categoryName: context.word.value.substring(1) })
        return reference(CATEGORY, context);
      }
      return trigger.declaration ? declaration(trigger.match, context) : reference(trigger.match, context);
    }
  }
}

export const triggerMatcher: Matcher = { priority: 9000, fn: triggerMatcherFn };
