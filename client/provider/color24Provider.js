const vscode = require('vscode');
const { COLOR24 } = require('../enum/regex');

const color24Provider = {
  provideColorPresentations(color, context, token) {
    const r = Math.round(color.red * 255);
    const g = Math.round(color.green * 255);
    const b = Math.round(color.blue * 255);
    const rgb = (r << 16) | (g << 8) | b;

    return [
      {
        label: 'Color Picker',
        textEdit: new vscode.TextEdit(context.range, '0x' + rgb.toString(16).toUpperCase().padStart(6, '0'))
      }
    ];
  },

  provideDocumentColors(document) {
    const text = document.getText();
    let match;

    const matches = [];
    while (match = COLOR24.exec(text)) {
      const rgb = parseInt(match[2], 16);

      const r = (rgb >> 16) & 0xFF;
      const g = (rgb >> 8) & 0xFF;
      const b = rgb & 0xFF;

      matches.push({
        color: new vscode.Color(r / 255, g / 255, b / 255, 1),
        range: new vscode.Range(document.positionAt(match.index + match[1].length + 1), document.positionAt(match.index + match[1].length + match[2].length + 1))
      });
    }

    return matches;
  }
};

module.exports = color24Provider;
