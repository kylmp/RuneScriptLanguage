import type { MatchContext, Matcher } from '../../types';
import { TRIGGER_LINE_REGEX } from "../../enum/regex";
import { CATEGORY, TRIGGER, TYPE } from "../matchType";
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
    if (context.word.index <= 1) { 
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
    // This means the trigger has defined params (and maybe return types), lets parse these 
    else if (context.line.text.charAt(context.words[1].end + 2) === '(') {
      const endParamsIndex = context.line.text.indexOf(')');
      if (context.word.start < endParamsIndex) {
        // These are the type keywords in the trigger line params (Else, its a local var parameter, picked by that matcher)
        if (context.word.index % 2 === 0) return reference(TYPE, context);
        return undefined;
      }
      // This means the trigger has defined return types, lets parse these
      if (context.line.text.charAt(endParamsIndex + 1) === '(') {
        const endReturnsIndex = context.line.text.indexOf(')', endParamsIndex + 1);
        if (context.word.start < endReturnsIndex) return reference(TYPE, context);
      }
    }
  }
}

export const triggerMatcher: Matcher = { priority: 7500, fn: triggerMatcherFn };
