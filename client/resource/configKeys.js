// === STATIC CONFIG KEY MATCHES ===
const configKeys = {
  walkanim: { params: [param('seq'), param('seq'), param('seq'), param('seq')] },
  multivar: { params: [param('var')], fileTypes: ["loc", "npc"] },
  multiloc: { params: [param('int'), param('loc')], fileTypes: ["loc"] },
  multinpc: { params: [param('int'), param('npc')], fileTypes: ["npc"] },
  basevar: { params: [param('var')], fileTypes: ["varbit"] },

  category: { params: [param('category')] },
  huntmode: { params: [param('hunt')], fileTypes: ["npc"] },
  table: { params: [param('dbtable')], fileTypes: ["dbrow"] },
  column: { params: [param('dbcolumn', true)], fileTypes: ["dbrow"] },
}

// === REGEX CONFIG KEY MATCHES ===
const regexConfigKeys = [
  { regex: /stock\d+/, params: [param('obj'), param('int'), param('int')], fileTypes: ["inv"] },
  { regex: /count\d+/, params: [param('obj'), param('int')], fileTypes: ["obj"] },
  { regex: /\w*anim\w*/, params: [param('seq')], fileTypes: ["loc", "npc", "if", "spotanim"] },
  { regex: /replaceheldleft|replaceheldright/, params: [param('obj')], fileTypes: ["seq"] },
]

// === CONFIG KEYS THAT ARE HANDLED MANUALLY IN CONFIG_MATCHER ===
const specialCaseKeys = ['val', 'param', 'data'];

function param(type, declaration = false) {
  return {typeId: type, declaration: declaration};
}

module.exports = { configKeys, regexConfigKeys, specialCaseKeys };
