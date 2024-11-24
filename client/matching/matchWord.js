const matchType = require('../resource/matchType');
const { getWords, getWordAtIndex } = require('../utils/matchUtils');
const regexWordMatcher = require('./matchers/regexWordMatcher');
const commandMatcher = require('./matchers/commandMatcher');
const localVarMatcher = require('./matchers/localVarMatcher');
const prevCharMatcher = require('./matchers/prevCharMatcher');
const triggerMatcher = require('./matchers/triggerMatcher');
const configMatcher = require('./matchers/configMatcher');
const parametersMatcher = require('./matchers/parametersMatcher');

async function matchWordFromDocument(document, position) {
  return matchWord(document.lineAt(position.line).text, position.character, document.uri);
}

async function matchWord(lineText, index, uri) {
  if (!lineText || !index || !uri) {
    return null;
  }

  const words = getWords(lineText);
  const word = getWordAtIndex(words, index);
  if (!word || lineText.startsWith('//') || word.value === 'null' || word.value.length <= 1) {
    return response(); // Ignore comments and numbers and null and single character words
  }

  const context = {
    word: word,
    words: words,
    uri: uri,
    line: lineText,
    index: index,
    prevWord: getWordAtIndex(words, word.start - 2),
    prevChar: lineText.charAt(word.start - 1),
    nextChar: lineText.charAt(word.end + 1),
    fileType: uri.path.split(/[#?]/)[0].split('.').pop().trim(),
  }

  const matchers = [
    regexWordMatcher,
    commandMatcher,
    localVarMatcher,
    prevCharMatcher,
    triggerMatcher,
    configMatcher,
    parametersMatcher
  ];

  for (const matcher of matchers) {
    let match = await matcher(context);
    if (match) {
      return response(match, context);
    }
  }
  return response();
}

function response(match, context) {
  return (!match) ? { match: matchType.UNKNOWN } : { match: match, word: context.word.value, fileType: context.fileType, prevChar: context.prevChar };
}

module.exports = { matchWord, matchWordFromDocument };
