/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { inject } from '../../common/di';
import { PackageCodeLens } from '../../common/packageCodeLens';
import { PackageCodeLensList } from '../../common/packageCodeLensList';
import { AbstractCodeLensProvider } from '../abstractCodeLensProvider';
import { npmVersionParser, jspmVersionParser } from './npmVersionParsers';

@inject('jsonParser', 'npm')
export class NpmCodeLensProvider extends AbstractCodeLensProvider {

  constructor(config) {
    super(config);

    this.packageExtensions = {
      'jspm': jspmVersionParser
    };

    this.packageExtensionKeys = Object.keys(this.packageExtensions);

    this.packageDependencyKeys = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ];
  }

  get selector() {
    return {
      language: 'json',
      scheme: 'file',
      pattern: '**/package.json'
    }
  };

  provideCodeLenses(document, token) {
    const jsonDoc = this.jsonParser.parse(document.getText());
    if (!jsonDoc || !jsonDoc.root || jsonDoc.validationResult.errors.length > 0)
      return [];

    const collector = new PackageCodeLensList(document);
    this.collectDependencies_(collector, jsonDoc.root, npmVersionParser);
    this.collectExtensionDependencies_(collector, jsonDoc.root);
    return collector.collection;
  }

  resolveCodeLens(codeLensItem, token) {
    if (codeLensItem instanceof PackageCodeLens) {
      if (codeLensItem.packageVersion === 'latest') {
        super.makeLatestCommand(codeLensItem);
        return;
      }

      if (codeLensItem.commandMeta) {
        super.makeDoMetaCommand(codeLensItem);
        return;
      }

      return npmViewVersion(this.npm, codeLensItem.packageName)
        .then(response => {
          let keys = Object.keys(response);
          let remoteVersion = keys[0];
          return super.makeVersionCommand(
            codeLensItem.packageVersion,
            remoteVersion,
            codeLensItem
          );
        })
        .catch(error => {
          return super.makeErrorCommand(
            error,
            codeLensItem
          );
        });
    }
  }

  collectExtensionDependencies_(collector, rootNode) {
    rootNode.getChildNodes()
      .forEach(node => {
        const testDepProperty = node.key.value;
        if (this.packageExtensionKeys.includes(testDepProperty)) {
          const customParser = this.packageExtensions[testDepProperty];
          this.collectDependencies_(collector, node.value, customParser)
        }
      });
  }

}

function npmViewVersion(npm, packageName) {
  return new Promise((resolve, reject) => {
    npm.load(loadError => {
      if (loadError) {
        reject(loadError);
        return;
      }
      npm.view(packageName, 'version', (viewError, viewResult) => {
        if (viewError) {
          reject(viewError);
          return;
        }
        resolve(viewResult);
      });
    });
  });
}