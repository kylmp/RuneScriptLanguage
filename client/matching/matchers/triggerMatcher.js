const matchTriggerInfo = require("../../info/triggerInfo");
const matchType = require("../../resource/matchType");
const triggers = require("../../resource/triggers");
const { reference, declaration } = require("../../utils/matchUtils");

// Looks for matches with known runescript triggers
async function triggerMatcher(context) {
  if (context.prevChar === '[' && context.nextChar === ',' && context.word.index === 0) {
    const triggerInfo = matchTriggerInfo(context.word.value);
    return triggerInfo ? reference(matchType.TRIGGER) : matchType.UNKNOWN;
  }
  if (context.prevChar === ',') {
    if (context.prevWord === 'p') {
      return reference(matchType.MESANIM);
    }
    if (context.nextChar === ']') {
      const trigger = triggers[context.prevWord.value.toUpperCase()];
      if (trigger) {
        return trigger.declaration ? declaration(trigger.match) : reference(trigger.match);
      }
    }
  }
}

module.exports = triggerMatcher;
