/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';
const semver = require('semver');

import { packageBaseAddressResolver } from './nugetResolvers/packageBaseAddressResolver';
import { registrationsBaseUrlResolver } from './nugetResolvers/registrationsBaseUrlResolver';
import { searchAutocompleteServiceResolver } from './nugetResolvers/searchAutocompleteServiceResolver';
import { searchQueryServiceResolver } from './nugetResolvers/searchQueryServiceResolver';

// From https://docs.microsoft.com/en-us/nuget/api/overview
// Sorted in order that we want to get them.
const nugetServiceResolvers = [
  { type: 'PackageBaseAddress/3.0.0', resolver: packageBaseAddressResolver },
  { type: 'SearchAutocompleteService', resolver: searchAutocompleteServiceResolver },
  { type: 'SearchAutocompleteService/3.0.0-beta', resolver: searchAutocompleteServiceResolver },
  { type: 'SearchAutocompleteService/3.0.0-rc', resolver: searchAutocompleteServiceResolver },
  { type: 'RegistrationsBaseUrl', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.0.0-beta', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.0.0-rc', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.4.0', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.6.0', resolver: registrationsBaseUrlResolver },
  { type: 'SearchQueryService', resolver: searchQueryServiceResolver },
  { type: 'SearchQueryService/3.0.0-beta', resolver: searchQueryServiceResolver },
  { type: 'SearchQueryService/3.0.0-rc', resolver: searchQueryServiceResolver },
];

async function getVersionResolverFromIndex(index) {
  const httpRequest = require('request-light');
  const indexResponse = await httpRequest.xhr({ url: index });

  if (indexResponse.status != 200) {
    throw {
      status: indexResponse.status,
      responseText: indexResponse.responseText
    };
  }

  const indexData = JSON.parse(indexResponse.responseText);

  // Go through the list with each resolver, as we prefer to get a resolver
  // that is towards the start of the service resolver list.
  // More efficient would be to just pick first acceptable resolver, but thats not ideal.
  for (const serviceResolver of nugetServiceResolvers) {
    for (const resource of indexData.resources) {
      if (resource['@type'] === serviceResolver.type) {
        return { index, url: resource['@id'], ...serviceResolver }; // return index + url + resolver
      }
    }
  }

  throw { status: 404, responseText: 'No services with available resolvers found in nuget indexes.' };
}

async function getAvailableResolvers() {
  const promises = appContrib.dotnetNuGetIndexes.map(getVersionResolverFromIndex);

  // Remap error'ed as resolved.
  const resolved = promises.map(p => {
    return p.then(
      result => Promise.resolve(result),
      error => Promise.resolve(error)
    );
  });

  try {
    const results = await Promise.all(resolved);
    const availableResolvers = results.filter(r => r.resolver !== undefined);

    if (availableResolvers.length == 0) {
      throw { status: 404 };
    }

    // return a list of just resolver closures.
    return availableResolvers.map(resolver => (packageName) => resolver.resolver(resolver.url, packageName));
  } catch (error) {
    throw { status: 404 };
  }
}

export async function nugetGetPackageVersions(packageName) {
  const resolvers = await getAvailableResolvers();
  const versionPromises = resolvers.map(resolver => resolver(packageName));

  // Remap error'ed as resolved.
  const resolved = versionPromises.map(p => {
    return p.then(
      result => Promise.resolve(result),
      error => Promise.resolve(error)
    );
  });

  try {
    const results = await Promise.all(resolved);
    const dataResults = results.filter(result => Array.isArray(result)).sort((a, b) => semver.gt(a[0], b[0])); // Filter arrays and sort by first/highest version

    // If no results assume no successful resolves.
    if (dataResults.length === 0) {
      throw results[0];
    }

    return dataResults[0];
  } catch (error) {
    throw { status: 404 };
  }  
}