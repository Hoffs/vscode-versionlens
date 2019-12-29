const semver = require('semver');

// Uses older OData client
// Originally written by https://github.com/vradzius at https://github.com/Hoffs/vscode-versionlens/issues/11#issuecomment-568610087
export async function odataClientResolver(serviceUrl, packageName) {
  const odata = require('odata-client');

  if (!serviceUrl.endsWith('/')) {
    serviceUrl = `${serviceUrl}/`;
  }

  const query = odata({ service: serviceUrl, resources: 'Packages' });
  const filterExp = `Id eq '${packageName}'`;
  const response = await query.filter(filterExp).select('Version').orderby('Version', 'desc').get();
  if (response.statusCode != 200) {
    throw {
      status: response.statusCode,
      responseText: response.body
    };
  }

  const convert = require('xml-js');
  const data = convert.xml2js(response.body);
  if (!data) {
    throw { status: 404 };
  } else {
    const packages = data.elements[0].elements.filter(e => e.name === 'entry').map(e => e.elements.filter(e => e.name === 'm:properties')[0]);
    if (packages.length === 0) {
      throw { status: 404 };
    } else {
      return packages.map(e => e.elements.filter(e => e.name === 'd:Version')[0]).map(e => e.elements[0].text).sort((a, b) => semver.compareBuild(a, b)).reverse();
    }
  }
}