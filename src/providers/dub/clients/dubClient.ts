import {
  DocumentFactory,
  ResponseFactory,
  SuggestionFactory,
  VersionHelpers,
  PackageSourceTypes,
  PackageDocument,
  SemverSpec,
  PackageRequest,
  IPackageClient,
} from "core/packages";

import {
  HttpClientResponse,
  HttpClientRequestMethods,
} from "core/clients";

import {
  JsonHttpClientRequest
} from 'infrastructure/clients';

import { DubConfig } from '../config';

export class DubClient
  extends JsonHttpClientRequest
  implements IPackageClient<DubConfig> {

  config: DubConfig;

  constructor(config: DubConfig, cacheDuration: number) {
    super({}, cacheDuration);
    this.config = config;
  }

  async fetchPackage(request: PackageRequest<DubConfig>): Promise<PackageDocument> {
    const semverSpec = VersionHelpers.parseSemver(request.package.version);
    const url = `${this.config.getApiUrl()}/${encodeURIComponent(request.package.name)}/info`;

    return createRemotePackageDocument(this, url, request, semverSpec)
      .catch((error: HttpClientResponse) => {
        if (error.status === 404) {
          return DocumentFactory.createNotFound(
            this.config.provider,
            request.package,
            null,
            ResponseFactory.createResponseStatus(error.source, error.status)
          );
        }
        return Promise.reject(error);
      });
  }

}

async function createRemotePackageDocument(
  client: JsonHttpClientRequest,
  url: string,
  request: PackageRequest<DubConfig>,
  semverSpec: SemverSpec
): Promise<PackageDocument> {

  const queryParams = {
    minimize: 'true',
  }

  return client.requestJson(HttpClientRequestMethods.get, url, queryParams)
    .then(httpResponse => {

      const packageInfo = httpResponse.data;

      const provider = request.provider;

      const versionRange = semverSpec.rawVersion;

      const requested = request.package;

      const resolved = {
        name: requested.name,
        version: versionRange,
      };

      const response = {
        source: httpResponse.source,
        status: httpResponse.status,
      };

      const rawVersions = VersionHelpers.extractVersionsFromMap(packageInfo.versions);

      // seperate versions to releases and prereleases
      const { releases, prereleases } = VersionHelpers.splitReleasesFromArray(rawVersions)

      // analyse suggestions
      const suggestions = SuggestionFactory.createSuggestionTags(
        versionRange,
        releases,
        prereleases
      );

      // todo return a ~master entry when no matches found
      return {
        provider,
        source: PackageSourceTypes.registry,
        response,
        type: semverSpec.type,
        requested,
        resolved,
        releases,
        prereleases,
        suggestions,
      };
    });
}

export async function readDubSelections(filePath) {

  return new Promise(function (resolve, reject) {
    const fs = require('fs');

    if (fs.existsSync(filePath) === false) {
      reject(null);
      return;
    }

    fs.readFile(filePath, "utf-8", (err, data) => {
      if (err) {
        reject(err)
        return;
      }

      const selectionsJson = JSON.parse(data.toString());
      if (selectionsJson.fileVersion != 1) {
        reject(new Error(`Unknown dub.selections.json file version ${selectionsJson.fileVersion}`))
        return;
      }

      resolve(selectionsJson);
    });

  });

}