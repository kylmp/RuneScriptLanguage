const matchType = require('./matchType');
const { getWords, getWordAtIndex } = require('../utils/matchUtils');

// Do not reorder the matchers unless there is a reason to 
// quicker potential matches are processed earlier in order to short circuit faster
const matchers = [
  require('./matchers/regexWordMatcher'),
  require('./matchers/commandMatcher'),
  require('./matchers/localVarMatcher'),
  require('./matchers/prevCharMatcher'),
  require('./matchers/triggerMatcher'),
  require('./matchers/configMatcher'),
  require('./matchers/parametersMatcher')
];

/**
 * Match with one word given a vscode document and a vscode position
 */
function matchWordFromDocument(document, position) {
  return matchWord(document.lineAt(position.line).text, document.uri, position.character);
}

/**
 * Match with one word given a line of text and an index position
 */
function matchWord(lineText, uri, index) {
  if (!lineText || !uri || !index) {
    return undefined;
  }
  const context = getBaseContext(lineText, uri);
  const word = getWordAtIndex(context.words, index);
  const wordContext = {
    ...context,
    word: word,
    index: index,
    prevWord: (word.index === 0) ? undefined : context.words[word.index - 1],
    prevChar: lineText.charAt(word.start - 1),
    nextChar: lineText.charAt(word.end + 1),
  }
  return match(wordContext);
}

/**
 * Match with all words given a line of text
 */
function matchWords(lineText, uri) {
  if (!lineText || !uri) {
    return undefined;
  }
  const context = getBaseContext(lineText, uri);
  const matches = [];
  for (let i = 0; i < context.words.length; i++) {
    const wordContext = {
      ...context,
      word: context.words[i],
      index: context.words[i].start,
      prevWord: (i === 0) ? undefined : context.words[i-1],
      prevChar: lineText.charAt(context.words[i].start - 1),
      nextChar: lineText.charAt(context.words[i].end + 1),
    }
    matches.push(match(wordContext));
  }
  return matches;
}

/**
 * Context items shared by both matchWord and matchWords
 */ 
function getBaseContext(lineText, uri) {
  lineText = lineText.split('//')[0]; // Ignore anything after a comment
  const words = getWords(lineText);
  const fileSplit = uri.path.split('\\').pop().split('/').pop().split('.');
  return {
    words: words,
    uri: uri,
    line: lineText,
    file: {name: fileSplit[0], type: fileSplit[1]},
  }
}

/**
 * Iterates thru all matchers to try to find a match, short circuits early if a match is made  
 */
function match(context) {
  if (!context.word || context.word.value === 'null' || context.word.value.length <= 1) { // Also ignore null and single character words
    return response(); 
  }

  for (const matcher of matchers) {
    let match = matcher(context);
    if (match) {
      return response(match, context);
    }
  }
  return response();
}

/**
 * Build the response object for a match response
 */ 
function response(match, context) {
  if (!match || !context) {
    return undefined;
  }
  if (match.id === matchType.COMPONENT.id && !context.word.value.includes(':')) {
    context.word.value = `${context.file.name}:${context.word.value}`;
  }
  return { match: match, word: context.word.value, context: context };
}

module.exports = { matchWords, matchWordFromDocument };