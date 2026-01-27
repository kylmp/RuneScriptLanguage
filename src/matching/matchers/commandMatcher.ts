import type { MatchContext, Matcher } from '../../types';
import { get as getIdentifier } from "../../cache/identifierCache";
import { COMMAND, SKIP } from "../matchType";
import { reference, declaration } from "../../utils/matchUtils";
import { TRIGGER_LINE_REGEX } from "../../enum/regex";

/**
* Looks for matches of known engine commands
*/
const commandMatcherFn = (context: MatchContext): void => {
  const command = getIdentifier(context.word.value, COMMAND);
  if (command) {
    if (TRIGGER_LINE_REGEX.test(context.line.text)) {
      if (context.word.index === 1) return declaration(COMMAND, context);
      else if (context.word.index > 1) return reference(SKIP, context);
    }
    if (command.signature && command.signature.params.length > 0 && context.nextChar !== '('){
      return undefined;
    }
    reference(COMMAND, context);
  }
}

export const commandMatcher: Matcher = { priority: 8000, fn: commandMatcherFn };
