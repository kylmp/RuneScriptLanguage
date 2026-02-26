import type { MatchContext, Matcher } from '../../types';
import { SKIP, getAllMatchTypes, getMatchTypeById } from '../matchType';
import { reference } from '../../utils/matchUtils';
import { getCallIdentifier, getBlockScopeIdentifier } from '../../cache/activeFileCache';
import { get as getIdentifier } from '../../cache/identifierCache';

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

  const iden = getCallIdentifier(context.uri, context.line.number, context.word.callName, context.word.callNameIndex);
  if (iden?.signature && iden.signature.params.length > paramIndex) {
    const matchKey = iden.signature.params[paramIndex].matchTypeId;
    const resolvedMatchType = getMatchTypeById(matchKey) ?? SKIP;
    return reference(resolvedMatchType, context);
  }

  if (isLabelCall(context)) {
    const resolvedMatchType = resolveByIdentifier(context.word.value);
    if (resolvedMatchType) {
      return reference(resolvedMatchType, context);
    }
  }
}

export const parametersMatcher: Matcher = { priority: 12000, fn: parametersMatcherFn };

function isLabelCall(context: MatchContext): boolean {
  const callNameIndex = context.word.callNameIndex;
  if (callNameIndex === undefined || callNameIndex < 0) return false;
  const callWord = context.words[callNameIndex];
  if (!callWord) return false;
  return context.line.text.charAt(callWord.start - 1) === '@';
}

function resolveByIdentifier(name: string) {
  let resolved: ReturnType<typeof getAllMatchTypes>[number] | undefined;
  for (const matchType of getAllMatchTypes()) {
    if (!matchType.cache || matchType.noop) continue;
    if (!getIdentifier(name, matchType)) continue;
    if (resolved) {
      return undefined;
    }
    resolved = matchType;
  }
  return resolved;
}
