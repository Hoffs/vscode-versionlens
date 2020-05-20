// vscode references
import * as VsCodeTypes from 'vscode';

import { IFrozenRepository } from 'core/generics';

import { VsCodeFrozenConfig } from 'infrastructure/configuration';
import { createWinstonLogger } from 'infrastructure/logging';

import { registerProviders } from 'presentation/providers';
import {
  registerExtension,
  registerCommands,
  registerTextEditorEvents,
  registerTextDocumentEvents,
  VersionLensExtension,
} from 'presentation/extension';

export async function composition(context: VsCodeTypes.ExtensionContext) {

  const configuration: IFrozenRepository = new VsCodeFrozenConfig(
    VersionLensExtension.extensionName.toLowerCase()
  );

  const extension = registerExtension(configuration);

  const logger = createWinstonLogger(
    VersionLensExtension.extensionName,
    extension.logging
  );

  const appLogger = logger.child({ namespace: 'extension' });

  appLogger.debug('path: %s', context.extensionPath);
  appLogger.debug('log path: %s', context.logPath);
  appLogger.debug('global storage path: %s', context.globalStoragePath);
  appLogger.debug('local storage path: %s', context.storagePath);

  registerTextDocumentEvents(extension.state, appLogger);

  const textEditorEvents = registerTextEditorEvents(extension.state, appLogger);

  const disposables = [
    ...await registerProviders(extension, appLogger),
    ...registerCommands(extension, appLogger)
  ]
  // subscribe command and provider disposables
  context.subscriptions.push(<any>disposables);

  // show icons in active text editor if versionLens.providerActive
  const { window } = require('vscode');
  textEditorEvents.onDidChangeActiveTextEditor(window.activeTextEditor);
}