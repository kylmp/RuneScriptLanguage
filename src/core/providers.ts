import type { ExtensionContext } from "vscode";
import { languages } from "vscode";
import { hoverProvider } from "../provider/hoverProvider";
import { renameProvider } from "../provider/renameProvider";
import { completionProvider, completionTriggers } from "../provider/completion/runescriptCompletionProvider";
import { completionProvider as configCompletionProvider, completionTriggers as configCompletionTriggers } from "../provider/completion/configCompletionProvider";
import { gotoDefinitionProvider } from "../provider/gotoDefinitionProvider";
import { referenceProvider } from "../provider/referenceProvider";
import { color24Provider } from "../provider/color/color24Provider";
import { recolProvider } from "../provider/color/recolorProvider";
import { signatureHelpProvider, signatureMetadata } from "../provider/signatureHelp/runescriptSignatureHelpProvider";
import { configHelpProvider, configMetadata } from "../provider/signatureHelp/configSignatureHelpProvider";
import { semanticTokensLegend, semanticTokensProvider } from "../provider/semanticTokensProvider";
import { languageIds } from "../runescriptExtension";
import { mapCodelensProvider } from "../provider/mapCodelensProvider";

export function registerProviders(context: ExtensionContext) {
  for (const language of languageIds) {
    registerUniversalProviders(language, context);
    registerColorProviders(language, context);
    registerSignatureHelpProviders(language, context);
    registerCompletionProviders(language, context);
  } 
  registerMapProviders(context);
}

function registerMapProviders(context: ExtensionContext): void {
  context.subscriptions.push(languages.registerHoverProvider('jm2', hoverProvider(context)));
  context.subscriptions.push(languages.registerDefinitionProvider('jm2', gotoDefinitionProvider));
  context.subscriptions.push(languages.registerCodeLensProvider('jm2', mapCodelensProvider));
}

function registerUniversalProviders(language: string, context: ExtensionContext): void {
  context.subscriptions.push(
    languages.registerHoverProvider(language, hoverProvider(context)),
    languages.registerRenameProvider(language, renameProvider),
    languages.registerDefinitionProvider(language, gotoDefinitionProvider),
    languages.registerReferenceProvider(language, referenceProvider),
    languages.registerDocumentSemanticTokensProvider(language, semanticTokensProvider, semanticTokensLegend),
  );
}

function registerColorProviders(language: string, context: ExtensionContext): void {
  if (language === 'floconfig' || language === 'interface') {
    context.subscriptions.push(languages.registerColorProvider(language, color24Provider));
  } else if (language.endsWith('config')) {
    context.subscriptions.push(languages.registerColorProvider(language, recolProvider));
  }
}

function registerSignatureHelpProviders(language: string, context: ExtensionContext): void {
  if (language.endsWith('config') || language === 'interface') {
    context.subscriptions.push(languages.registerSignatureHelpProvider(language, configHelpProvider, configMetadata));
  } else if (language === 'runescript') {
    context.subscriptions.push(languages.registerSignatureHelpProvider(language, signatureHelpProvider, signatureMetadata));
  }
}

function registerCompletionProviders(language: string, context: ExtensionContext): void {
  if (language.endsWith('config') || language === 'interface') {
    context.subscriptions.push(languages.registerCompletionItemProvider(language, configCompletionProvider, ...configCompletionTriggers));
  } else if (language === 'runescript') {
    context.subscriptions.push(languages.registerCompletionItemProvider(language, completionProvider, ...completionTriggers));
  }
}
