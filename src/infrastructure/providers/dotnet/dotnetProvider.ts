// vscode references
import * as VsCodeTypes from 'vscode';

// imports
import { ILogger } from 'core/logging';

import { AbstractVersionLensProvider, VersionLensFetchResponse } from 'presentation/providers';

import { DotNetConfig } from './dotnetConfig';
import { createDependenciesFromXml } from './dotnetXmlParserFactory'
import { DotNetClient } from './clients/dotnetClient';
import { NuGetPackageClient } from './clients/nugetPackageClient';
import { NuGetResourceClient } from './clients/nugetResourceClient';
import { NuGetClientData } from './definitions/nuget';
import { RegistryProtocols } from 'core/clients/helpers/urlHelpers';
import { RequestFactory } from 'core/packages';

export class DotNetVersionLensProvider
  extends AbstractVersionLensProvider<DotNetConfig> {

  dotnetClient: DotNetClient;
  nugetPackageClient: NuGetPackageClient;
  nugetResourceClient: NuGetResourceClient;

  constructor(config: DotNetConfig, logger: ILogger) {
    super(config, logger);

    this.dotnetClient = new DotNetClient(
      config,
      logger.child({ namespace: 'dotnet cli' })
    );

    const requestOptions = {
      caching: config.caching,
      http: config.http
    };

    this.nugetResourceClient = new NuGetResourceClient(
      requestOptions,
      logger.child({ namespace: 'dotnet nuget client' })
    );

    this.nugetPackageClient = new NuGetPackageClient(
      config,
      requestOptions,
      logger.child({ namespace: 'dotnet pkg client' })
    );
  }

  async fetchVersionLenses(
    packagePath: string,
    document: VsCodeTypes.TextDocument,
    token: VsCodeTypes.CancellationToken
  ): VersionLensFetchResponse {

    const packageDependencies = createDependenciesFromXml(
      document.getText(),
      this.config.dependencyProperties
    );
    if (packageDependencies.length === 0) return null;

    // ensure latest nuget sources from settings
    this.config.nuget.defrost();

    // get each service index source from the dotnet cli
    const sources = await this.dotnetClient.fetchSources(packagePath)

    // remote sources only
    const remoteSources = sources.filter(
      s => s.protocol === RegistryProtocols.https ||
        s.protocol === RegistryProtocols.http
    );

    // resolve each auto complete service url
    const promised = remoteSources.map(
      async (remoteSource) => {
        return await this.nugetResourceClient.fetchResource(remoteSource);
      }
    );

    const autoCompleteUrls = await Promise.all(promised);
    if (autoCompleteUrls.length === 0) return null;

    const clientData: NuGetClientData = { serviceUrls: autoCompleteUrls }

    const includePrereleases = this.extension.state.prereleasesEnabled.value;

    const context = {
      includePrereleases,
      clientData,
    }

    return RequestFactory.executeDependencyRequests(
      packagePath,
      this.nugetPackageClient,
      packageDependencies,
      context,
    );

  }

}