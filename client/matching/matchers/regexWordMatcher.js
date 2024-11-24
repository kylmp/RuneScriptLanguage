const { COLOR, COORD } = require("../../enum/regex");
const matchType = require("../../resource/matchType");
const { reference } = require("../../utils/matchUtils");

// Looks for matches with direct word regex checks, such as for coordinates
async function regexWordMatcher(context) {
  const word = context.word.value;
  if (COORD.test(word)) {
    return reference(matchType.COORDINATES);
  }
}

module.exports = regexWordMatcher;
