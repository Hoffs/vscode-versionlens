/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import appContrib from 'common/appContrib';
 
// This is a required NugetV3 api
// Uses RegistrationsBaseUrl API
export async function registrationsBaseUrlResolver(serviceUrl, packageName) {
  const httpRequest = require('request-light');

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
    const promises = data.items.map(item => getRegistrationBaseUrlPageVersions(item['@id']));
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

  const itemList = data.lower || data.upper ? data.items : data.items.flatMap(it => it.items);
  let versions = itemList.map(item => item.catalogEntry.version);
  if (!appContrib.dotnetIncludePrerelease) {
    // If we don't want pre-release, filter out versions which don't have -
    versions = versions.filter(ver => ver.indexOf("-") === -1);
  }

  return versions;
}
