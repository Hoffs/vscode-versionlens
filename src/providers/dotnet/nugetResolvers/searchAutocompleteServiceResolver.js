/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';

// This is an optional NugetV3 api
// Uses SearchAutocompleteService API
export async function searchAutocompleteServiceResolver(serviceUrl, packageName) {
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

