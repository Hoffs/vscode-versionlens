import { VersionHelpers } from 'core/packages';

const assert = require('assert');

const testPrereleases = [
  '2.0.0-preview1.12141.1',
  '2.0.0-preview2.45112.2',
  '2.0.0-preview3.13311.9',
  '2.0.0-preview4.17421.6',
  '2.1.0-preview1-final',
  '2.1.0-legacy.1',
  '2.1.0-legacy.2',
  '2.1.0-legacy.3',
  '2.5.0-tag.1',
  '2.5.0-tag.2',
  '2.5.0-tag.3',
  '2.1.0-beta1',
  '2.1.0-beta2',
  '2.1.0-beta3',
];

export default {

  "returns empty when no matches found": () => {
    const results = VersionHelpers.filterPrereleasesWithinRange('*', []);
    assert.equal(Object.keys(results).length, 0);
  },

  "groups prereleases by name": () => {
    const expected = [
      '2.1.0-preview1-final',
      '2.1.0-legacy.3',
      '2.5.0-tag.3',
      '2.1.0-beta3',
    ]
    const results = VersionHelpers.filterPrereleasesWithinRange('2.*', testPrereleases);
    assert.equal(results.length, expected.length);
    expected.forEach((expectedValue, index) => {
      assert.equal(results[index], expectedValue);
    })
  },

}