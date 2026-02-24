import type { MatchContext, Matcher } from '../../types';
import { LOCAL_VAR } from "../matchType";
import { reference, declaration, addExtraData } from "../../utils/matchUtils";
import { TRIGGER_LINE_REGEX } from '../../enum/regex';
import { isTypeKeyword } from '../../enum/type';

/**
* Looks for matches of local variables
*/
function matchLocalVarFn(context: MatchContext): void {
  if (context.prevChar === '$') {
    if (!context.prevWord) {
      return reference(LOCAL_VAR, context);
    }
    const type = context.prevWord.value.startsWith("def_") ? context.prevWord.value.substring(4) : context.prevWord.value;
    const isDeclaration = isTypeKeyword(type);
    if (isDeclaration) {
      addExtraData(context, { param: TRIGGER_LINE_REGEX.test(context.line.text), type: type });
      return declaration(LOCAL_VAR, context);
    }
    return reference(LOCAL_VAR, context);
  }
}

export const matchLocalVar: Matcher = { priority: 6000, fn: matchLocalVarFn };
