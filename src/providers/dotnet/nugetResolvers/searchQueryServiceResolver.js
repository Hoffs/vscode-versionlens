/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';

// This is a required NugetV3 api
// Uses SearchQueryService API
export async function searchQueryServiceResolver(serviceUrl, packageName) {
  const httpRequest = require('request-light');

  // This could take more than 1 and try to search out of those, but for now just assume that first returned entry will be the most correct.
  const queryUrl = `${serviceUrl}?q=${packageName}&prerelease=${appContrib.dotnetIncludePrerelease}&semVerLevel=2.0.0&skip=0&take=1`;
  const response = await httpRequest.xhr({ url: queryUrl });

  if (response.status != 200) {
    throw {
      status: response.status,
      responseText: response.responseText
    };
  }

  const { totalHits, data } = JSON.parse(response.responseText);
  if (totalHits === 0 || data[0].id.toLowerCase() !== packageName.toLowerCase()) {
    throw { status: 404 };
  } else {
    const versions = data[0].versions.map(v => v.version);
    return versions.reverse();
  }
}