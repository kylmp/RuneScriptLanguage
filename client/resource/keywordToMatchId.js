const matchType = require("./matchType");

const keywordToId = {};

Object.keys(matchType).forEach(matchTypeId => {
  for (let keyword of (matchType[matchTypeId].types || [])) {
    keywordToId[keyword] = matchTypeId;
  }
});

function keywordToMatchId(keyword) {
  return keywordToId[keyword] || matchType.UNKNOWN.id;
}

module.exports = keywordToMatchId;
