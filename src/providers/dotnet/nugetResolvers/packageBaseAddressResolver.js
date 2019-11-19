/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';

// This is a required NugetV3 api
// Uses PackageBaseAddress API
export async function packageBaseAddressResolver(serviceUrl, packageName) {
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