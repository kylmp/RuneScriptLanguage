const regex = {
  COORD: /\b(\d+_){4}\d+\b/,
  COLOR: /\b\d{6}\b/,
  END_OF_BLOCK: /(\r\n|\r|\n)(\[.+|val=.+|\^.+|\d+=.+)(?:$|(\r\n|\r|\n))/,
  START_OF_LINE: /(?<=[\n])(?!.*[\n]).*/,
  END_OF_LINE: /\r\n|\r|\n/,
  WORD_PATTERN: /(\w+:\w+)|([^\`\~\!\@\#\%\^\&\*\(\)\-\$\=\+\[\{\]\}\\\|\;\:\'\\"\,\.\<\>\/\?\s]+)/g,
  CONFIG_LINE: /^\w+=.+$/
}

module.exports = regex;
