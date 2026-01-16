import { CONFIG_DECLARATION_REGEX } from "../../enum/regex";
import type { MatchContext, Matcher } from "../../types";
import { declaration } from "../../utils/matchUtils";
import { COMPONENT, DBROW, DBTABLE, ENUM, GLOBAL_VAR, HUNT, IDK, INV, LOC, MESANIM, NPC, OBJ, PARAM, SEQ, SPOTANIM, STRUCT } from "../matchType";

function configDeclarationMatcherFn(context: MatchContext): void {
  // Check for config file declarations (i.e. declarations with [NAME])
  if (context.file.type !== 'rs2' && context.line.text.startsWith('[') && CONFIG_DECLARATION_REGEX.test(context.line.text)) {
    switch (context.file.type) {
      case "varp": case "varbit": case "varn": case "vars": return declaration(GLOBAL_VAR, context);
      case "obj": return declaration(OBJ, context);
      case "loc": return declaration(LOC, context);
      case "npc": return declaration(NPC, context);
      case "param": return declaration(PARAM, context);
      case "seq": return declaration(SEQ, context);
      case "struct": return declaration(STRUCT, context);
      case "dbrow": return declaration(DBROW, context);
      case "dbtable": return declaration(DBTABLE, context);
      case "enum": return declaration(ENUM, context);
      case "hunt": return declaration(HUNT, context);
      case "inv": return declaration(INV, context);
      case "spotanim": return declaration(SPOTANIM, context);
      case "idk": return declaration(IDK, context);
      case "mesanim": return declaration(MESANIM, context);
      case "if": return declaration(COMPONENT, context);
    }
  }
}

export const configDeclarationMatcher: Matcher = { priority: 1500, fn: configDeclarationMatcherFn};
