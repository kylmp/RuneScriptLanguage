const { commands } = require('../../resource/engineCommands');
const matchType = require('../../resource/matchType');
const identifierSvc = require('../../service/identifierSvc');
const { reference } = require("../../utils/matchUtils");
const { nthIndexOf, truncateMatchingParenthesis } = require('../../utils/stringUtils');

// Looks for matches of values inside of parenthesis
// This includes engine command parameters, proc parameters, label parameters, and queue parameters
async function parametersMatcher(context) {
  let line = context.line;
  let index = context.index;
  if (line.substring(index).indexOf(')') === -1) {
    return null;
  }
  line = truncateMatchingParenthesis(line.substring(0, index));
  const openCount = (line.match(/\(/g) || []).length;
  const closeCount = (line.match(/\)/g) || []).length;
  const openingIndex = nthIndexOf(line, '(', openCount - closeCount);
  if (openingIndex < 0 || line.charAt(Math.max(0, openingIndex - 1)) === ']') {
    return null;
  }
  let name = (line.substring(0, openingIndex).match(/\(?[a-zA-Z_~@]+$/) || [])[0].replace(/^\(/, '');
  const paramIndex = (line.substring(openingIndex).match(/,/g) || []).length;

  let identifier;
  if (name === 'queue') {
    if (paramIndex === 0) return reference(matchType.QUEUE);
    if (paramIndex === 1) return matchType.UNKNOWN;
    identifier = await identifierSvc.get(line.substring(openingIndex + 1, line.indexOf(',')), matchType.QUEUE);
  } else if (name.startsWith('@')) {
    identifier = await identifierSvc.get(name.substring(1), matchType.LABEL);
  } else if (name.startsWith('~')) {
    identifier = await identifierSvc.get(name.substring(1), matchType.PROC);
  } else {
    identifier = commands[name];
  }
  if (!identifier || !identifier.signature || identifier.signature.params.length <= paramIndex) {
    return null;
  }
  return reference(matchType[identifier.signature.params[paramIndex].matchTypeId]);
}

module.exports = parametersMatcher;
