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
import { odataClientResolver } from './nugetResolvers/odataClientResolver';

const sleep = timeoutMs => new Promise(resolve => setTimeout(resolve, timeoutMs))

// From https://docs.microsoft.com/en-us/nuget/api/overview
// Sorted in order that we want to get them.
const nugetServiceResolvers = [
  { type: 'RegistrationsBaseUrl', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.0.0-beta', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.0.0-rc', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.4.0', resolver: registrationsBaseUrlResolver },
  { type: 'RegistrationsBaseUrl/3.6.0', resolver: registrationsBaseUrlResolver },
  { type: 'PackageBaseAddress/3.0.0', resolver: packageBaseAddressResolver },
  { type: 'SearchAutocompleteService', resolver: searchAutocompleteServiceResolver },
  { type: 'SearchAutocompleteService/3.0.0-beta', resolver: searchAutocompleteServiceResolver },
  { type: 'SearchAutocompleteService/3.0.0-rc', resolver: searchAutocompleteServiceResolver },
  { type: 'SearchQueryService', resolver: searchQueryServiceResolver },
  { type: 'SearchQueryService/3.0.0-beta', resolver: searchQueryServiceResolver },
  { type: 'SearchQueryService/3.0.0-rc', resolver: searchQueryServiceResolver },
];

// key: { response: "...", timestamp: "fetch date" }
const responseCache = {};
// How long the cached responses should be valid.
const cacheValidForMs = 30 * 60 * 1000; // 30 mins.

// key: timestamp
const requestedAt = {};
// How long to wait for other request to finish before starting new one.
const requestTimeoutMs = 15 * 1000; // 15s

async function getVersionResolverFromIndex(index) {
  let response;
  
  if (responseCache[index] !== undefined) {
    if (Date.now() - responseCache[index].timestamp < cacheValidForMs) {
      console.log(`Using cached response for ${index}`);
      response = responseCache[index].response;
    }
  }

  while (response === undefined) {
    // Try to do only 1 request for index response. 
    if (requestedAt[index] === undefined || Date.now() - requestedAt[index] > requestTimeoutMs) {
      requestedAt[index] = Date.now();
      console.log(`Requesting for ${index}`);
      const httpRequest = require('request-light');
      const indexResponse = await httpRequest.xhr({ url: index });
    
      if (indexResponse.status != 200) {
        throw {
          status: indexResponse.status,
          responseText: indexResponse.responseText
        };
      }
  
      response = indexResponse.responseText;
      responseCache[index] = { response, timestamp: Date.now() };
    } else {
      console.log(`Waiting for ${index}`);
      await sleep(250); // Sleep for 500ms before re-checking.
      if (responseCache[index] !== undefined) {
        response = responseCache[index].response;
      }
    }
  }

  // Try to check if xml response, if yes, try OData resolver.
  if (response.startsWith('<?xml version="1.0" encoding="utf-8"?>')) {
    return { index, url: index, type: 'OData/2.0.0', resolver: odataClientResolver };
  } else {
    const indexData = JSON.parse(response);
  
    // Go through the list with each resolver, as we prefer to get a resolver
    // that is towards the start of the service resolver list.
    // More efficient would be to just pick first acceptable resolver, but thats not ideal.

    // Search over priority resolver list.
    for (const priorityResolver of appContrib.dotnetNuGetResolverPriority) {
      const priorityResolverOb = nugetServiceResolvers.find(r => r.type === priorityResolver);
      if (priorityResolverOb) {
        for (const resource of indexData.resources) {
          if (resource['@type'] === priorityResolverOb.type) {
            return { index, url: resource['@id'], ...priorityResolverOb }; // return index + url + resolver
          }
        }
      }
    }

    // Search over default resolvers.
    for (const serviceResolver of nugetServiceResolvers) {
      for (const resource of indexData.resources) {
        if (resource['@type'] === serviceResolver.type) {
          return { index, url: resource['@id'], ...serviceResolver }; // return index + url + resolver
        }
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
    console.log('Available resolvers', availableResolvers)

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