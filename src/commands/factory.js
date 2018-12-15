/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { stripSymbolFromVersionRegex, semverLeadingChars } from 'common/utils';
import { githubRequest } from 'common/githubRequest';
import appSettings from 'common/appSettings';

const path = require('path');
const fs = require('fs');
const semver = require('semver');

export function createErrorCommand(errorMsg, codeLens) {
  return codeLens.setCommand(`${errorMsg}`);
}

export function createVersionCommand(localVersion, serverVersion, codeLens) {
  const isLocalValid = semver.valid(localVersion);
  const isLocalValidRange = semver.validRange(localVersion);
  const isServerValid = semver.valid(serverVersion);
  const isServerValidRange = semver.validRange(serverVersion);

  if (!isLocalValid && !isLocalValidRange && localVersion !== 'latest')
    return createInvalidCommand(codeLens);

  if (!isServerValid && !isServerValidRange && serverVersion !== 'latest')
    return createErrorCommand("Invalid semver server version received, " + serverVersion, codeLens);

  if (isLocalValidRange && !isLocalValid) {

    if (!semver.satisfies(serverVersion, localVersion))
      return createNewVersionCommand(serverVersion, codeLens);

    try {
      let matches = stripSymbolFromVersionRegex.exec(localVersion);
      let cleanLocalVersion = (matches && matches[1]) || semver.clean(localVersion) || localVersion;
      if (cleanLocalVersion && semver.eq(serverVersion, cleanLocalVersion)) {
        return createSatisfiesCommand(serverVersion, codeLens);
      }
    } catch (ex) {
      return createSatisfiesCommand(serverVersion, codeLens);
    }

    return createSatisfiedWithNewerCommand(serverVersion, codeLens);
  }

  const hasNewerVersion = semver.gt(serverVersion, localVersion) === true
    || semver.lt(serverVersion, localVersion) === true;

  if (serverVersion !== localVersion && hasNewerVersion)
    return createNewVersionCommand(serverVersion, codeLens);

  return createMatchesLatestVersionCommand(codeLens);
}

export function createNewVersionCommand(newVersion, codeLens) {
  const replaceWithVersion = codeLens.generateNewVersion(newVersion);
  return codeLens.setCommand(
    `${codeLens.getTaggedVersionPrefix()}${codeLens.getInstallIndicator()} ${newVersion}`,
    `${appSettings.extensionName}.updateDependencyCommand`,
    [codeLens, `${replaceWithVersion}`]
  );
}

export function createSatisfiesCommand(serverVersion, codeLens) {
  return codeLens.setCommand(`Satisfies ${serverVersion}`);
}

export function createSatisfiedWithNewerCommand(serverVersion, codeLens) {
  const replaceWithVersion = codeLens.generateNewVersion(serverVersion);
  return codeLens.setCommand(
    `Satisfies ${codeLens.getInstallIndicator()} ${serverVersion}`,
    `${appSettings.extensionName}.updateDependencyCommand`,
    [codeLens, `${replaceWithVersion}`]
  );
}

export function createTagCommand(tag, codeLens) {
  return codeLens.setCommand(tag);
}

export function createLinkCommand(codeLens) {
  const isFile = codeLens.package.meta.type === 'file';
  let cmd = `${appSettings.extensionName}.linkCommand`;
  let title;

  if (isFile) {
    const filePath = path.resolve(path.dirname(codeLens.documentUrl.fsPath), codeLens.package.meta.remoteUrl);
    const fileExists = fs.existsSync(filePath);
    if (fileExists === false)
      title = (cmd = null) || 'Specified resource does not exist';
    else
      title = `${appSettings.openNewWindowIndicator} ${codeLens.package.version}`;
  } else
    title = `${appSettings.openNewWindowIndicator} ${codeLens.package.meta.remoteUrl}`;

  return codeLens.setCommand(title, cmd, [codeLens]);
}

export function createGithubCommand(codeLens) {
  const meta = codeLens.package.meta;
  const fnName = `getLatest${meta.category}`;

  return githubRequest[fnName](meta.userRepo)
    .then(entry => {
      if (!entry)
        return createTagCommand(`${meta.category}: none`, codeLens);

      if (meta.commitish === '' ||
        (semverLeadingChars.includes(meta.commitish[0]) ? meta.commitish[0] : '') + entry.version === meta.commitish)
        return createTagCommand(`${meta.category}: latest`, codeLens);

      const newVersion = codeLens.generateNewVersion(entry.version);
      return codeLens.setCommand(
        `${meta.category}: ${codeLens.getInstallIndicator()} ${entry.version}`,
        `${appSettings.extensionName}.updateDependencyCommand`,
        [codeLens, `${newVersion}`]
      );
    })
    .catch(error => {
      if (error.rateLimitExceeded)
        return createTagCommand('Rate limit exceeded', codeLens);

      if (error.resourceNotFound)
        return createTagCommand('Git resource not found', codeLens);

      if (error.badCredentials)
        return createTagCommand('Bad credentials', codeLens);

      return Promise.reject(error);
    });
}

export function createTaggedVersionCommand(codeLens) {
  const taggedVersion = codeLens.getTaggedVersion();
  let version = codeLens.package.version;

  // check for any leading semver symbols in the version
  // strip before compare if they exist
  const versionLeading = version && version[0];
  if (versionLeading && semverLeadingChars.includes(versionLeading))
    version = version.slice(1);

  if (version === taggedVersion)
    return createTagCommand(`${codeLens.getTaggedVersionPrefix()} ${taggedVersion}`, codeLens);

  return createNewVersionCommand(
    taggedVersion,
    codeLens
  );
}

export function createFixedVersionCommand(codeLens) {
  const version = codeLens.package.meta.tag.version;
  if (!version)
    return createInvalidCommand(codeLens);

  return createTagCommand(`Fixed to ${version}`, codeLens);
}

export function createMatchesLatestVersionCommand(codeLens) {
  return createTagCommand('Latest', codeLens);
}

export function createSatisfiesLatestVersionCommand(codeLens) {
  return createTagCommand('Satisfies latest', codeLens);
}

export function createMatchesPrereleaseVersionCommand(codeLens) {
  return createTagCommand(`Prerelease ${codeLens.package.version}`, codeLens);
}

export function createInvalidCommand(codeLens) {
  return createTagCommand(`Invalid version entered`, codeLens);
}

export function createPackageNotFoundCommand(codeLens) {
  return createErrorCommand(
    `${codeLens.package.name} could not be found`,
    codeLens
  );
}

export function createPackageNotSupportedCommand(codeLens) {
  return createErrorCommand(
    `${codeLens.package.meta.message}`,
    codeLens
  );
}

export function createPackageErrorCommand(codeLens) {
  return createErrorCommand(
    'An unexpected error occured',
    codeLens
  );
}

export function createVersionMatchNotFoundCommand(codeLens) {
  return createErrorCommand(
    `Match not found: ${codeLens.package.version}`,
    codeLens
  );
}