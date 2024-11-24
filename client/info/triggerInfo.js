const { expandCsvKeyObject } = require("../utils/matchUtils");

// Define trigger information which will be displayed on hover if a user hovers over a trigger keyword
// Tip: You can use CSV keys such as 'oploc1, oploc2, oploc3' to apply the same info message for all of those triggers
const triggerInfo = expandCsvKeyObject({
  logout: 'The script that executes when the user logs out',
  debugproc: 'Proc that only runs for users with cheats enabled, run with ::debugprocName'
});


function matchTriggerInfo(key) {
  return triggerInfo[key];
}

module.exports = matchTriggerInfo;
