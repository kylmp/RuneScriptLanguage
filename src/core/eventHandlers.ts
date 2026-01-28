import type { ConfigurationChangeEvent, ExtensionContext, TextDocument, TextDocumentChangeEvent, TextDocumentContentChangeEvent, TextEditor, Uri } from "vscode";
import { window, workspace } from "vscode";
import { clearAllDiagnostics, handleFileUpdate } from "./diagnostics";
import { getFileText, isActiveFile, isValidFile } from "../utils/fileUtils";
import { addUris, removeUris } from "../cache/projectFilesCache";
import { eventAffectsSetting, getSettingValue, Settings } from "./settings";
import { clearDevModeOutput, initDevMode, logEvent, logFileEvent, logSettingsEvent, LogType } from "./devMode";
import { getLines } from "../utils/stringUtils";
import { clearFile, processAllFiles, queueFileRebuild } from "./manager";
import { monitoredFileTypes } from "../runescriptExtension";
import { reparseFileWithChanges } from "../parsing/fileParser";
import { getFileIdentifiers } from "../cache/identifierCache";


const debounceTimeMs = 150; // debounce time for normal active file text changes

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
let pendingRebuildPromise: Promise<void> | undefined;
let pendingRebuildResolve: (() => void) | undefined;
const lastRebuildVersionByUri = new Map<string, number>();
const rebuildWaiters: Array<{ uri: string; version: number; resolve: () => void }> = [];
function onActiveFileTextChange(textChangeEvent: TextDocumentChangeEvent): void {
  if (!isActiveFile(textChangeEvent.document.uri) || !isValidFile(textChangeEvent.document.uri)) return;

  pendingDocument = textChangeEvent.document;
  pendingChanges.push(...textChangeEvent.contentChanges);

  if (pendingTimer) clearTimeout(pendingTimer);
  if (!pendingRebuildPromise) {
    pendingRebuildPromise = new Promise<void>((resolve) => {
      pendingRebuildResolve = resolve;
    });
  }
  pendingTimer = setTimeout(() => {
    const doc = pendingDocument;
    if (!doc) return;
    logFileEvent(doc.uri, LogType.ActiveFileTextChanged, `partial reparse`);
    const changes = pendingChanges;
    pendingChanges = [];
    pendingTimer = undefined;
    const parsedFile = reparseFileWithChanges(doc, changes);
    void queueFileRebuild(doc.uri, getLines(doc.getText()), parsedFile).finally(() => {
      lastRebuildVersionByUri.set(doc.uri.fsPath, doc.version);
      for (let i = rebuildWaiters.length - 1; i >= 0; i--) {
        const waiter = rebuildWaiters[i]!;
        if (waiter.uri === doc.uri.fsPath && waiter.version <= doc.version) {
          rebuildWaiters.splice(i, 1);
          waiter.resolve();
        }
      }
      const resolve = pendingRebuildResolve;
      pendingRebuildPromise = undefined;
      pendingRebuildResolve = undefined;
      resolve?.();
    });
  }, debounceTimeMs);
}

export function waitForActiveFileRebuild(document: TextDocument, version = document.version): Promise<void> {
  const uri = document.uri.fsPath;
  const lastVersion = lastRebuildVersionByUri.get(uri) ?? -1;
  if (lastVersion >= version) return Promise.resolve();
  return new Promise<void>((resolve) => {
    rebuildWaiters.push({ uri, version, resolve });
  });
}

async function onActiveDocumentChange(editor: TextEditor | undefined): Promise<void> {
  if (!editor) return;
  if (!isValidFile(editor.document.uri)) return;
  logFileEvent(editor.document.uri, LogType.ActiveFileChanged, 'full reparse');
  updateFileFromDocument(editor.document);
}

function onDeleteFile(uri: Uri) {
  if (!isValidFile(uri)) return;
  logFileEvent(uri, LogType.FileDeleted, 'relevant cache entries invalidated');
  handleFileUpdate(getFileIdentifiers(uri), undefined);
  clearFile(uri);
  removeUris([uri]);
}

function onCreateFile(uri: Uri) {
  if (!isValidFile(uri)) return;
  logFileEvent(uri, LogType.FileCreated, 'full parse');
  void updateFileFromUri(uri);
  addUris([uri]);
}

function onChangeFile(uri: Uri) {
  if (isActiveFile(uri)) return; // let the active document text change event handle active file changes
  if (!isValidFile(uri)) return;
  logFileEvent(uri, LogType.FileChanged, 'full reparse');
  void updateFileFromUri(uri);
}

function onGitBranchChange() {
  logEvent(LogType.GitBranchChanged, 'full cache rebuild');
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
