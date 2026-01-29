import { ConfigVarArgSrc, learnConfigKey, getConfigData } from "../../resource/configKeys";
import type { MatchContext, Matcher, Identifier, ConfigLineData } from '../../types';
import { CONFIG_KEY, SKIP, getMatchTypeById } from "../matchType";
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
    const configLineData: ConfigLineData = { key: configKey, params: [...configData.params, ...iden.signature.params.map(p => p.type)], index: context.word.index };
    if (configData.varArgs.idenSrc === ConfigVarArgSrc.FirstParam) configLineData.params[0] = context.words[1].value;
    const varArgParam = iden.signature.params[varArgIndex];
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
