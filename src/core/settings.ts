import type { ConfigurationChangeEvent } from "vscode";
import { workspace } from "vscode";

interface Setting<T> {
  id: string;
  getValue: () => T;
}

export enum Settings {
  ShowDiagnostics = 'enable diagnostics',
  ShowHover = 'enable hover',
  DevMode = 'enable dev mode',
}

export function getSettingValue(setting: Settings): boolean {
  return extensionSettings[setting].getValue();
}

export function getSettingId(setting: Settings): string {
  return extensionSettings[setting].id;
}

export function eventAffectsSetting(event: ConfigurationChangeEvent, setting: Settings): boolean {
  return event.affectsConfiguration(getSettingId(setting));
}

const extensionSettings: Record<Settings, Setting<boolean>> = {
  [Settings.ShowDiagnostics]: {
    id: 'runescript.diagnostics.enabled',
    getValue: () => workspace.getConfiguration('runescript').get('diagnostics.enabled', true) as boolean
  },
  [Settings.ShowHover]: {
    id: 'runescript.hover.enabled',
    getValue: () => workspace.getConfiguration('runescript').get('hover.enabled', true) as boolean
  },
  [Settings.DevMode]: {
    id: 'runescript.devMode.enabled',
    getValue: () => workspace.getConfiguration('runescript').get('devMode.enabled', false) as boolean
  },
};
