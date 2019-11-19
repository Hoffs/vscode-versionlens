/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';
const semver = require('semver');

// This is an optional NugetV3 api
// Uses SearchAutocompleteService API
async function getNugetVersionsFromSearchAutocompleteService(serviceUrl, packageName) {
  const httpRequest = require('request-light');
  const queryUrl = `${serviceUrl}?id=${packageName}&prerelease=${appContrib.dotnetIncludePrerelease}&semVerLevel=2.0.0`;
  const response = await httpRequest.xhr({ url: queryUrl }); 
  
  if (response.status != 200) {
    throw {
      status: response.status,
      responseText: response.responseText
    };
  }

  const pkg = JSON.parse(response.responseText);
  if (pkg.totalHits == 0) {
    throw { status: 404 };
  } else {
    return pkg.data.reverse();
  }
}

// This is a required NugetV3 api
// Uses PackageBaseAddress API
async function getNugetVersionsFromPackageBaseAddress(serviceUrl, packageName) {
  const httpRequest = require('request-light');
  // From SearchAutocompleteService
  if (!serviceUrl.endsWith('/')) {
    serviceUrl = `${serviceUrl}/`;
  }

  const queryUrl = `${serviceUrl}${packageName.toLowerCase()}/index.json`;
  const response = await httpRequest.xhr({ url: queryUrl });

  if (response.status != 200) {
    throw {
      status: response.status,
      responseText: response.responseText
    };
  }

  const data = JSON.parse(response.responseText);
  if (!data.versions) {
    throw { status: 404 };
  } else {
    
    if (!appContrib.dotnetIncludePrerelease) {
      // If we don't want pre-release, filter out versions which don't have -
      data.versions = data.versions.filter(ver => ver.indexOf("-") === -1);
    }

    if (data.versions.length === 0) {
      throw { status: 404 };
    }

    return data.versions.reverse();
  }
}

// This is a required NugetV3 api
// Uses RegistrationsBaseUrl API
async function getNugetVersionsFromRegistrationsBaseUrl(serviceUrl, packageName) {
  const httpRequest = require('request-light');
  // From SearchAutocompleteService
  if (!serviceUrl.endsWith('/')) {
    serviceUrl = `${serviceUrl}/`;
  }

  const queryUrl = `${serviceUrl}${packageName.toLowerCase()}/index.json`;
  const response = await httpRequest.xhr({ url: queryUrl });

  if (response.status != 200) {
    throw {
      status: response.status,
      responseText: response.responseText
    };
  }

  const data = JSON.parse(response.responseText);
  if (data.count === 0) {
    throw { status: 404 };
  } else {
    const promises = data.items.filter(item => item['@type'] == 'catalog:CatalogPage').map(item => getRegistrationBaseUrlPageVersions(item['@id']));
    const results = await Promise.all(promises);
    return [].concat(...results).sort().reverse();
  }
}

async function getRegistrationBaseUrlPageVersions(pageUrl) {
  const httpRequest = require('request-light');
  const { status, responseText } = await httpRequest.xhr({ url: pageUrl });

  if (status != 200) {
    throw { status, responseText };
  }

  const data = JSON.parse(responseText);
  if (data.count === 0) {
    return [];
  }

  const itemList = data['@type'] === 'catalog:CatalogPage' ? data.items : data.items[0].items;
  let versions = itemList.map(item => item.catalogEntry.version);
  if (!appContrib.dotnetIncludePrerelease) {
    // If we don't want pre-release, filter out versions which don't have -
    versions = versions.filter(ver => ver.indexOf("-") === -1);
  }

  return versions;
}

// From https://docs.microsoft.com/en-us/nuget/api/overview
// Sorted in order that we want to get them.
const nugetServiceResolvers = [
  { type: 'PackageBaseAddress/3.0.0', resolver: getNugetVersionsFromPackageBaseAddress },
  { type: 'SearchAutocompleteService', resolver: getNugetVersionsFromSearchAutocompleteService },
  { type: 'SearchAutocompleteService/3.0.0-beta', resolver: getNugetVersionsFromSearchAutocompleteService },
  { type: 'SearchAutocompleteService/3.0.0-rc', resolver: getNugetVersionsFromSearchAutocompleteService },
  { type: 'RegistrationsBaseUrl', resolver: getNugetVersionsFromRegistrationsBaseUrl },
  { type: 'RegistrationsBaseUrl/3.0.0-beta', resolver: getNugetVersionsFromRegistrationsBaseUrl },
  { type: 'RegistrationsBaseUrl/3.0.0-rc', resolver: getNugetVersionsFromRegistrationsBaseUrl },
  { type: 'RegistrationsBaseUrl/3.4.0', resolver: getNugetVersionsFromRegistrationsBaseUrl },
  { type: 'RegistrationsBaseUrl/3.6.0', resolver: getNugetVersionsFromRegistrationsBaseUrl },
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