import type { ConfigurationChangeEvent, ExtensionContext, TextDocument, TextDocumentChangeEvent, TextDocumentContentChangeEvent, TextEditor, Uri } from "vscode";
import { window, workspace } from "vscode";
import { clearAllDiagnostics } from "./diagnostics";
import { getFileText, isActiveFile, isValidFile } from "../utils/fileUtils";
import { addUris, removeUris } from "../cache/projectFilesCache";
import { eventAffectsSetting, getSettingValue, Settings } from "./settings";
import { clearDevModeOutput, initDevMode, logEvent, logFileEvent, logSettingsEvent } from "./devMode";
import { getLines } from "../utils/stringUtils";
import { clearFile, processAllFiles, queueFileRebuild, rebuildFileChanges } from "./manager";
import { monitoredFileTypes } from "../runescriptExtension";

// Debounce time only applies to active file text change events, everything else is done ASAP
const debounceTimeMs = 200;

export function registerEventHandlers(context: ExtensionContext): void {
  const patterns = Array.from(monitoredFileTypes, ext => `**/*.${ext}`);
  const fileWatcher = workspace.createFileSystemWatcher(`{${patterns.join(',')}}`);
  const gitBranchWatcher = workspace.createFileSystemWatcher('**/.git/HEAD');
  gitBranchWatcher.onDidCreate(onGitBranchChange);
  fileWatcher.onDidChange(onChangeFile);
  fileWatcher.onDidCreate(onCreateFile);
  fileWatcher.onDidDelete(onDeleteFile);
  const activeFileTextChanged = workspace.onDidChangeTextDocument(onActiveFileTextChange);
  const activeDocumentChanged = window.onDidChangeActiveTextEditor(onActiveDocumentChange);
  const settingsChanged = workspace.onDidChangeConfiguration(onSettingsChange);

  context.subscriptions.push(
    gitBranchWatcher,
    fileWatcher,
    activeFileTextChanged,
    activeDocumentChanged,
    settingsChanged,
  );
}

let pendingChanges: TextDocumentContentChangeEvent[] = [];
let pendingDocument: TextDocument | undefined;
let pendingTimer: NodeJS.Timeout | undefined;
function onActiveFileTextChange(textChangeEvent: TextDocumentChangeEvent): void {
  if (!isActiveFile(textChangeEvent.document.uri)) return;
  if (!isValidFile(textChangeEvent.document.uri)) return;

  pendingDocument = textChangeEvent.document;
  pendingChanges.push(...textChangeEvent.contentChanges);

  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    if (!pendingDocument) return;
    const changes = pendingChanges;
    pendingChanges = [];
    pendingTimer = undefined;
    const linesReparsed = rebuildFileChanges(pendingDocument, changes);
    logFileEvent(pendingDocument.uri, EventType.ActiveFileTextChanged, `${linesReparsed} lines reparsed`);
  }, debounceTimeMs);
}

export function forceRebuild(document: TextDocument): Promise<void> {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingChanges = [];
  pendingTimer = undefined;
  pendingDocument = undefined;
  return queueFileRebuild(document.uri, getLines(document.getText()));
}

async function onActiveDocumentChange(editor: TextEditor | undefined): Promise<void> {
  if (!editor) return;
  if (!isValidFile(editor.document.uri)) return;
  logFileEvent(editor.document.uri, EventType.ActiveFileChanged, 'full reparse');
  updateFileFromDocument(editor.document);
}

function onDeleteFile(uri: Uri) {
  if (!isValidFile(uri)) return;
  logFileEvent(uri, EventType.FileDeleted, 'relevant cache entries invalidated');
  clearFile(uri);
  removeUris([uri]);
}

function onCreateFile(uri: Uri) {
  if (!isValidFile(uri)) return;
  logFileEvent(uri, EventType.FileCreated, 'full parse');
  void updateFileFromUri(uri);
  addUris([uri]);
}

function onChangeFile(uri: Uri) {
  if (isActiveFile(uri)) return; // let the change document text event handle active file changes
  if (!isValidFile(uri)) return;
  logFileEvent(uri, EventType.FileChanged, 'full reparse');
  void updateFileFromUri(uri);
}

function onGitBranchChange() {
  logEvent(EventType.GitBranchChanged, 'full cache rebuild');
  processAllFiles();
}

async function updateFileFromUri(uri: Uri): Promise<void> {
  if (!isValidFile(uri)) return;
  void queueFileRebuild(uri, await getFileText(uri));
}

function updateFileFromDocument(document: TextDocument): void {
  if (!isValidFile(document.uri)) return;
  void queueFileRebuild(document.uri, getLines(document.getText()));
}

function onSettingsChange(event: ConfigurationChangeEvent) {
  if (eventAffectsSetting(event, Settings.ShowHover)) logSettingsEvent(Settings.ShowHover);
  if (eventAffectsSetting(event, Settings.ShowDiagnostics)) {
    logSettingsEvent(Settings.ShowDiagnostics);
    getSettingValue(Settings.ShowDiagnostics) ? processAllFiles() : clearAllDiagnostics();
  }
  if (eventAffectsSetting(event, Settings.DevMode)) {
    logSettingsEvent(Settings.DevMode);
    getSettingValue(Settings.DevMode) ? initDevMode() : clearDevModeOutput();
  }
}

export enum EventType {
  FileSaved = 'file saved',
  ActiveFileTextChanged = 'active file text changed',
  ActiveFileChanged = 'active document changed',
  FileDeleted = 'file deleted',
  FileCreated = 'file created',
  FileChanged = 'file changed',
  SettingsChanged = 'settings changed',
  GitBranchChanged = 'git branch changed'
}
