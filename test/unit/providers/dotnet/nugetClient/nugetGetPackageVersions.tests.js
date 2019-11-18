/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2019 Ignas Maslinskas. All rights reserved.
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { nugetGetPackageVersions } from 'providers/dotnet/nugetClient.js';

const assert = require('assert');
const mock = require('mock-require');

let requestLightMock = null;

export default {

  beforeAll: () => {
    // mock require modules
    requestLightMock = {
      xhr: options => { throw new Error('Not implemented') }
    }

    mock('request-light', requestLightMock)
  },

  // reset all require mocks
  afterAll: () => mock.stopAll,

  // TODO: Fix this test
  'rejects when a package is not found': done => {
    const testPackageName = 'test-package';

    requestLightMock.xhr = options => {
      return Promise.resolve({
        status: 200,
        responseText: JSON.stringify({ 'totalHits': 0, 'data': [] })
      })
    }

    nugetGetPackageVersions(testPackageName)
      .then(results => done(new Error('Should not be called')))
      .catch(actual => {
        assert.ok(actual !== null, 'Expected error object not to be null')
        assert.ok(actual.status === 404, 'Expected error status to be 404')
        done()
      })
  },

  'uses SearchAutocompleteService to resolve package': done => {
    const testPackageName = 'test-package';
    const serviceUrl = 'https://test.com/autocomplete';

    requestLightMock.xhr = options => {
      if (options.url === 'https://api.nuget.org/v3/index.json') {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify({
            resources: [{
              '@id': serviceUrl,
              '@type': 'SearchAutocompleteService',
            }]
          })
        })
      }
      if (options.url.indexOf(serviceUrl) !== -1) {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify({ 'totalHits': 1, 'data': ['1.0.0'] })
        })
      }
    }

    nugetGetPackageVersions(testPackageName)
      .then(actual => {
        assert.ok(actual !== null, 'Expected results array not to be null')
        assert.ok(actual.length === 1, 'Expected results array to contain 1 item')
        done()
      })
      .catch(error => done(new Error('Should not be called')))
  },

  'uses PackageBaseAddress/3.0.0 to resolve package': done => {
    const testPackageName = 'test-package';
    const serviceUrl = 'https://test.com/service';

    requestLightMock.xhr = options => {
      if (options.url === 'https://api.nuget.org/v3/index.json') {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify({
            resources: [{
              '@id': serviceUrl,
              '@type': 'PackageBaseAddress/3.0.0',
            }]
          })
        })
      }
      if (options.url.indexOf(serviceUrl) !== -1) {
        return Promise.resolve({
          status: 200,
          responseText: JSON.stringify({ 'versions': ['1.0.0'] })
        })
      }
    }

    nugetGetPackageVersions(testPackageName)
      .then(actual => {
        assert.ok(actual !== null, 'Expected results array not to be null')
        assert.ok(actual.length === 1, 'Expected results array to contain 1 item')
        done()
      })
      .catch(error => done(new Error('Should not be called')))
  },

}