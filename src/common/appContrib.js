/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { npmDefaultDependencyProperties } from 'providers/npm/config';
import { pubDefaultDependencyProperties } from 'providers/pub/config';
import { dubDefaultDependencyProperties } from 'providers/dub/config';
import {
  dotnetCSProjDefaultDependencyProperties,
  dotnetDefaultNuGetIndexes
} from 'providers/dotnet/config';
import {
  mavenDefaultDependencyProperties
} from 'providers/maven/config';

const { workspace } = require('vscode');

export default new class AppContribution {

  get showVersionLensesAtStartup() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("showVersionLensesAtStartup", true);
  }

  get showTaggedVersionsAtStartup() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("showTaggedVersionsAtStartup", false);
  }

  get showDependencyStatusesAtStartup() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("showDependencyStatusesAtStartup", false);
  }

  get versionPrefix() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("versionPrefix", "");
  }

  get npmDependencyProperties() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("npm.dependencyProperties", npmDefaultDependencyProperties);
  }

  get npmDistTagFilter() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("npm.distTagFilter", []);
  }

  get pubDependencyProperties() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("pub.dependencyProperties", pubDefaultDependencyProperties);
  }

  get dotnetCSProjDependencyProperties() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dotnet.dependencyProperties", dotnetCSProjDefaultDependencyProperties);
  }

  get dotnetTagFilter() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dotnet.tagFilter", []);
  }

  get dotnetNuGetIndexes() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dotnet.nugetIndexes", dotnetDefaultNuGetIndexes);
  }

  get dotnetNuGetResolverPriority() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dotnet.nugetResolverPriority", []);
  }

  get dotnetIncludePrerelease() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dotnet.includePrerelease", true);
  }

  get dubDependencyProperties() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("dub.dependencyProperties", dubDefaultDependencyProperties);
  }

  get mavenDependencyProperties() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("maven.dependencyProperties", mavenDefaultDependencyProperties);
  }

  get mavenTagFilter() {
    const config = workspace.getConfiguration('versionlens');
    return config.get("maven.tagFilter", []);
  }
  
  get githubTaggedCommits() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('github.taggedCommits', ['Release', 'Tag']);
  }

  get githubAccessToken() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('github.accessToken', null);
  }

  get missingDependencyColour() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('missingDependencyColour', 'red');
  }

  get installedDependencyColour() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('installedDependencyColour', 'green');
  }

  get outdatedDependencyColour() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('outdatedDependencyColour', 'orange');
  }

  get prereleaseDependencyColour() {
    const config = workspace.getConfiguration('versionlens');
    return config.get('prereleaseDependencyColour', 'yellowgreen');
  }

}
