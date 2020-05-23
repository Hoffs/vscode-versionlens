import Fixtures from './fixtures/dotnetSources'

import { DotNetClient } from 'infrastructure/providers/dotnet/clients/dotnetClient';

import {
  ClientResponseSource,
  UrlHelpers
} from '/core/clients';

import { DotNetConfig } from 'infrastructure/providers/dotnet/dotnetConfig';
import { LoggerMock } from 'test/unit/mocks/loggerMock';
import { VersionLensExtension } from '/presentation/extension';

const assert = require('assert');
const mock = require('mock-require');

let defaultExtensionMock: VersionLensExtension;

export const DotnetClientRequestTests = {

  beforeEach: () => {

    defaultExtensionMock = new VersionLensExtension(
      {
        get: (k) => null,
        defrost: () => null
      },
      null
    );

  },

  // reset all require mocks
  afterEach: () => mock.stop('@npmcli/promise-spawn'),

  "fetchSources": {

    "returns an Array<DotNetSource> of enabled sources": async () => {
      const testFeeds = [
        'https://test.feed/v3/index.json',
      ];

      const expected = [
        {
          enabled: true,
          machineWide: false,
          url: testFeeds[0],
          protocol: UrlHelpers.RegistryProtocols.https
        },
        {
          enabled: true,
          machineWide: false,
          url: 'https://api.nuget.org/v3/index.json',
          protocol: UrlHelpers.RegistryProtocols.https
        },
        {
          enabled: true,
          machineWide: false,
          url: 'http://non-ssl/v3/index.json',
          protocol: UrlHelpers.RegistryProtocols.http
        },
        {
          enabled: true,
          machineWide: true,
          url: 'C:\\Program Files (x86)\\Microsoft SDKs\\NuGetPackages\\',
          protocol: UrlHelpers.RegistryProtocols.file
        },
      ]

      let promiseSpawnMock = (cmd, args, opts) => {
        return Promise.resolve({
          code: 0,
          stdout: Fixtures.enabledSources
        });
      };
      mock('@npmcli/promise-spawn', promiseSpawnMock);

      // setup test feeds
      const config = new DotNetConfig(
        new VersionLensExtension(
          {
            get: (k) => <any>testFeeds,
            defrost: () => null
          },
          null
        )
      )

      const cut = new DotNetClient(config, new LoggerMock());
      return cut.fetchSources('.')
        .then(actualSources => {
          assert.deepEqual(actualSources, expected);
        });

    },

    "return 0 items when no sources are enabled": async () => {
      const testFeeds = [];

      let promiseSpawnMock = (cmd, args, opts) => {
        return Promise.resolve({
          code: 0,
          stdout: Fixtures.disabledSource
        });
      };
      mock('@npmcli/promise-spawn', promiseSpawnMock);

      // setup test feeds
      const config = new DotNetConfig(
        new VersionLensExtension(
          {
            get: (k) => <any>testFeeds,
            defrost: () => null
          },
          null
        )
      )

      const cut = new DotNetClient(config, new LoggerMock());
      return cut.fetchSources('.')
        .then(actualSources => {
          assert.equal(actualSources.length, 0);
        });
    },

    "returns only enabled sources when some sources are disabled": async () => {
      const testFeeds = [];
      const expected = [
        {
          enabled: true,
          machineWide: false,
          url: 'https://api.nuget.org/v3/index.json',
          protocol: UrlHelpers.RegistryProtocols.https
        },
      ]

      let promiseSpawnMock = (cmd, args, opts) => {
        return Promise.resolve({
          code: 0,
          stdout: Fixtures.enabledAndDisabledSources
        });
      };
      mock('@npmcli/promise-spawn', promiseSpawnMock);

      // setup test feeds
      const config = new DotNetConfig(
        new VersionLensExtension(
          {
            get: (k) => <any>testFeeds,
            defrost: () => null
          },
          null
        )
      )

      const cut = new DotNetClient(config, new LoggerMock());
      return cut.fetchSources('.')
        .then(actualSources => {
          assert.deepEqual(actualSources, expected);
        });
    },

    "returns fallback url on error": async () => {

      let promiseSpawnMock = (cmd, args, opts) => {
        return Promise.reject({
          code: '0',
          stdout: Fixtures.invalidSources
        });
      };
      mock('@npmcli/promise-spawn', promiseSpawnMock);

      const config = new DotNetConfig(defaultExtensionMock);
      const cut = new DotNetClient(
        config,
        new LoggerMock()
      );

      const expectedErrorResp = {
        enabled: true,
        machineWide: false,
        protocol: 'https:',
        url: config.fallbackNugetSource,
      }

      return cut.fetchSources('.')
        .then(actual => {
          assert.deepEqual(actual, [expectedErrorResp]);
        });
    },



  }

}