import type { MatchContext, Matcher } from '../../types';
import { SKIP, getMatchTypeById } from '../matchType';
import { reference } from '../../utils/matchUtils';
import { getCallIdentifier, getBlockScopeIdentifier } from '../../cache/activeFileCache';

/**
* Looks for matches of values inside of parenthesis
* This includes return statement params, engine command parameters, proc parameters, label parameters, and queue parameters
*/
function parametersMatcherFn(context: MatchContext): void {
  if (context.file.type !== 'rs2') {
    return;
  }
  if (!context.word.callName || context.word.callNameIndex === undefined || context.word.paramIndex === undefined) return undefined;
  const paramIndex = context.word.paramIndex

  if (context.word.callName === 'return') {
    const iden = getBlockScopeIdentifier(context.line.number);
    if (iden && iden.signature && iden.signature.returns.length > paramIndex) {
      const resolvedMatchType = getMatchTypeById(iden.signature.returns[paramIndex]) ?? SKIP;
      return reference(resolvedMatchType, context);
    }
    return undefined;
  }

  const iden = getCallIdentifier(context.line.number, context.word.callName, context.word.callNameIndex);
  if (iden?.signature && iden.signature.params.length > paramIndex) {
    const matchKey = iden.signature.params[paramIndex].matchTypeId;
    const resolvedMatchType = getMatchTypeById(matchKey) ?? SKIP;
    return reference(resolvedMatchType, context);
  }
}

export const parametersMatcher: Matcher = { priority: 9000, fn: parametersMatcherFn };
