import { ConfigVarArgSrc, learnConfigKey, getConfigData } from "../../resource/configKeys";
import type { MatchContext, Matcher, Identifier, ConfigLineData } from '../../types';
import { COMPONENT, CONFIG_KEY, GLOBAL_VAR, OBJ, SKIP, getMatchTypeById } from "../matchType";
import { reference } from "../../utils/matchUtils";
import { dataTypeToMatchId } from "../../resource/dataTypeToMatchId";
import { getBlockScopeIdentifier, getByLineIndex } from '../../cache/activeFileCache';

/**
* Looks for matches on config files, both config declarations and config line items
*/
function configMatcherFn(context: MatchContext): void {
  // Check if the line we are matching is a config line
  getConfigLineMatch(context);
}

export function getConfigLineMatch(context: MatchContext): ConfigLineData | undefined {
  // If we are on the first word of a standard config key=val line, return the config_key match type
  if (context.word.index === 0 && context.nextChar === '=') {
    learnConfigKey(context.word.value);
    reference(CONFIG_KEY, context);
    return undefined;
  }

  // At this point only words which have a configKey and paramIndex context are valid to continue
  if (context.word.configKey === undefined || context.word.paramIndex === undefined) return undefined;
    
  // Get the configData from the configKeys static object [defined in configKeys.ts]
  const configKey = context.word.configKey;
  const paramIndex = context.word.paramIndex;
  if (context.file.type === 'if' && isInterfaceScriptOpKey(configKey)) {
    const opcodeName = getConfigParamWord(context, configKey, 0);
    const matchType = opcodeName ? resolveScriptOpMatchType(opcodeName, paramIndex) : undefined;
    if (matchType) {
      reference(matchType, context);
      return { key: configKey, params: [], index: context.word.index };
    }
    reference(SKIP, context);
    return undefined;
  }
  if (context.file.type === 'param' && configKey === 'default' && paramIndex === 0) {
    const iden = getBlockScopeIdentifier(context.line.number);
    const paramType = iden?.signature?.params?.[0]?.type;
    if (paramType) {
      const resolvedMatchType = getMatchTypeById(dataTypeToMatchId(paramType)) ?? SKIP;
      reference(resolvedMatchType, context);
      return { key: configKey, params: [paramType], index: context.word.index };
    }
    reference(SKIP, context);
    return undefined;
  }
  if (context.file.type === 'enum' && configKey === 'default' && paramIndex === 0) {
    const iden = getBlockScopeIdentifier(context.line.number);
    const outputType = iden?.signature?.params?.[1]?.type;
    if (outputType) {
      const resolvedMatchType = getMatchTypeById(dataTypeToMatchId(outputType)) ?? SKIP;
      reference(resolvedMatchType, context);
      return { key: configKey, params: [outputType], index: context.word.index };
    }
    reference(SKIP, context);
    return undefined;
  }
  const configData = getConfigData(configKey, context.file.type);
  if (!configData || (configData.ignoreValues ?? []).includes(context.word.value)) {
    reference(SKIP, context);
    return undefined;
  } 

  // If the configData has vararg params and the word index is on a vararg index, figure out the match type
  if (configData.varArgs && context.word.paramIndex >= configData.varArgs.startIndex) {
    // get varags source identifier
    let iden: Identifier | undefined;
    if (configData.varArgs.idenSrc === ConfigVarArgSrc.BlockName) {
      iden = getBlockScopeIdentifier(context.line.number);
    }
    else if (configData.varArgs.idenSrc === ConfigVarArgSrc.FirstParam) {
      iden = getByLineIndex(context.uri, context.line.number, context.words[1].start)?.identifier;
    }
    // get the param match types from the identifier signature
    const varArgIndex = paramIndex - configData.varArgs.startIndex;
    if (!iden?.signature?.params) return undefined;
    let signatureParams = iden.signature.params;
    if (context.file.type === 'enum' && configKey === 'val' && signatureParams[0]?.type === 'autoint') {
      signatureParams = signatureParams.slice(1);
    }
    const configLineData: ConfigLineData = { key: configKey, params: [...configData.params, ...signatureParams.map(p => p.type)], index: context.word.index };
    if (configData.varArgs.idenSrc === ConfigVarArgSrc.FirstParam) configLineData.params[0] = context.words[1].value;
    const varArgParam = signatureParams[varArgIndex];
    if (!varArgParam) return configLineData;
    reference(getMatchTypeById(dataTypeToMatchId(varArgParam.type)) ?? SKIP, context);
    return configLineData;
  }

  // Resolve the match type from the data type of the type at the param index
  if (paramIndex < configData.params.length) {
    const paramType = configData.params[paramIndex];
    const resolvedMatchType = getMatchTypeById(dataTypeToMatchId(paramType)) ?? SKIP;
    reference(resolvedMatchType, context);
    return { key: configKey, params: configData.params, index: context.word.index };
  }
}

export const configMatcher: Matcher = { priority: 10000, fn: configMatcherFn };

function isInterfaceScriptOpKey(key: string): boolean {
  return /^script\d+op\d+$/.test(key);
}

function getConfigParamWord(context: MatchContext, configKey: string, index: number): string | undefined {
  const word = context.words.find(entry => entry.configKey === configKey && entry.paramIndex === index);
  return word?.value;
}

function resolveScriptOpMatchType(opcodeName: string, paramIndex: number) {
  switch (opcodeName.toLowerCase()) {
    case 'inv_count':
    case 'inv_contains':
      if (paramIndex === 1) return COMPONENT;
      if (paramIndex === 2) return OBJ;
      return undefined;
    case 'pushvar':
      return paramIndex === 1 ? GLOBAL_VAR : undefined;
    case 'testbit':
      return paramIndex === 1 ? GLOBAL_VAR : undefined;
    case 'push_varbit':
      return paramIndex === 1 ? GLOBAL_VAR : undefined;
    default:
      return undefined;
  }
}
