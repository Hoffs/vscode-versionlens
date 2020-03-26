/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
  formatTagNameRegex,
  sortDescending,
  createChainMutator
} from './utils.js';

const semver = require('semver');

/**
 * @typedef {Object} TaggedVersion
 * @property {String>} name
 * @property {String} version
 */

/**
 * @typedef {Object} VersionMap
 * @property {Array<String>} releases
 * @property {Array<TaggedVersion>} taggedVersions
 */

/**
 * @typedef {Object} VersionInfo
 * @property {String>} version
 * @property {Boolean} isPrerelease
 * @property {String} prereleaseGroup
 */

/**
 * @export
 * @param {Array<TaggedVersion>} tags 
 * @param {String} version 
 * @returns {Array<TaggedVersion>}
 */
export function removeExactVersions(version) {
  return this.filter(tag => tag.version !== version);
}

/**
 * @export
 * @param {Array<TaggedVersion>} tags 
 * @param {String} version 
 * @returns {Array<TaggedVersion>}
 */
export function removeTagsWithName(name) {
  return this.filter(tag => tag.name !== name);
}

/**
 * @export
 * @param {Array<TaggedVersion>} tags
 * @param {String} versionRange
 * @returns {Array<TaggedVersion>}
 */
export function removeOlderVersions(versionRange) {
  return this.filter(tag => !isOlderVersion(tag.version, versionRange));
}

/**
 * @export
 * @param {Array<TaggedVersion>} tags 
 * @param {String} tagName 
 * @param {String} defaultVersion 
 * @returns {String}
 */
export function resolveVersionAgainstTags(tags, tagName, defaultVersion) {
  const tagIndex = tags.findIndex(item => item.name === tagName);
  if (tagIndex > -1)
    return tags[tagIndex].version;
  else
    return defaultVersion;
}

/**
 * @export
 * @param {Array<String>} versions 
 * @returns {Array<String>}
 */
export function pluckSemverVersions(versions) {
  const semverVersions = [];
  versions.forEach(version => {
    if (semver.validRange(version))
      semverVersions.push(version);
  });
  return semverVersions;
}

/**
 * @export
 * @param {String} version 
 * @returns {VersionInfo}
 */
export function parseVersion(version) {
  const prereleaseComponents = semver.prerelease(version);
  const isPrerelease = !!prereleaseComponents && prereleaseComponents.length > 0;
  let prereleaseGroup = '';

  if (isPrerelease) {
    const regexResult = formatTagNameRegex.exec(prereleaseComponents[0]);
    if (regexResult)
      prereleaseGroup = regexResult[0].toLowerCase();
  }

  return {
    version,
    isPrerelease,
    prereleaseGroup
  };
}

/**
 * @export
 * @param {String} versionToCheck 
 * @returns {Boolean}
 */
export function isFixedVersion(versionToCheck) {
  const testRange = new semver.Range(versionToCheck);
  return testRange.set[0][0].operator === "";
}

/**
 * @export
 * @param {String} version 
 * @param {String} requestedVersion 
 * @returns {Boolean}
 */
export function isOlderVersion(version, requestedVersion) {
  let testVersion = version;

  const requestedVersionComponents = semver.prerelease(requestedVersion);
  // check the required version isn't a prerelease
  if (!requestedVersionComponents) {
    // check if the test version is a pre release
    const testVersionComponents = semver.prerelease(testVersion);
    if (testVersionComponents) {
      // strip the test version prerelease info
      // semver always see prereleases as < than releases regardless of version numbering
      testVersion = testVersion.replace('-' + testVersionComponents.join('.'), '');

      // and we only want newer prereleases
      return semver.ltr(testVersion, requestedVersion) || requestedVersion.includes(testVersion);
    }
  }

  return semver.ltr(testVersion, requestedVersion);
}

/**
 * @export
 * @param {String} tagA 
 * @param {String} tagB 
 * @returns {Number}
 */
export function sortTagsByRecentVersion(tagA, tagB) {
  const a = tagA.version;
  const b = tagB.version;

  if (semver.lt(a, b))
    return 1;

  if (semver.gt(a, b))
    return -1;

  return sortDescending(tagA.name, tagB.name);
}

/**
 * @export
 * @param {Array<String>} versions 
 * @returns {VersionMap}
 */
export function pluckTagsAndReleases(versions) {
  const releases = [];
  const taggedVersions = [];

  // parse each version
  const parsedVersions = versions.map(parseVersion);

  // determine releases and tags
  parsedVersions.forEach(versionInfo => {
    if (!versionInfo.isPrerelease) {
      releases.push(versionInfo.version);
      return;
    }

    taggedVersions.push({
      name: versionInfo.prereleaseGroup,
      version: versionInfo.version
    });
  });

  // return the map
  return {
    releases,
    taggedVersions
  };
}

/**
 * @export
 * @param {Array<any>} list 
 * @returns {Array<any>}
 */
export function reduceTagsByUniqueNames() {
  return this.reduce(
    function (unique, current, currentIndex, original) {
      if (unique.findIndex(x => x.name === current.name) === -1) {
        unique.push(current);
      }

      return unique;
    },
    [] // initial uniqueNames
  );
}

/**
 * @returns {Array<TaggedVersion>}
 */
export function removeAmbiguousTagNames() {
  return this.reduce(
    function (results, current, currentIndex, original) {
      let { name, version } = current;

      const regexResult = formatTagNameRegex.exec(name);
      if (!regexResult)
        results.push({
          name,
          version
        })
      else if (regexResult[0].length > 1)
        results.push({
          name: regexResult[0].toLowerCase(),
          version
        });

      return results;
    },
    [] // initial results
  );
}

/**
 * @export
 * @param {Array<TaggedVersion>} taggedVersions 
 * @param {Array<String>} tagNamesToMatch
 * @returns {Array<TaggedVersion>}
 */
export function filterTagsByName(taggedVersions, tagNamesToMatch) {
  // make sure the tag names to match are all lower case
  const lcNamesToMatch = tagNamesToMatch.map(entry => entry.toLowerCase());

  // return the filtered tags
  return taggedVersions.filter(tag => {
    return lcNamesToMatch.includes(tag.name.toLowerCase());
  });
}


/**
 * @export
 * @param {Array<String>} versions 
 * @returns {VersionMap}
 */
export function buildMapFromVersionList(versions, requestedVersion) {
  // filter out any non semver versions
  const semverList = pluckSemverVersions(versions);

  // pluck the release and tagged versions
  const versionMap = pluckTagsAndReleases(semverList);

  // detemine max satisfying versions
  versionMap.maxSatisfyingVersion = deduceMaxSatisfyingFromSemverList(semverList, requestedVersion)

  return versionMap;
}

/**
 * @export
 * @param {Array<String>} versions 
 * @param {String} requestedVersion 
 * @returns {String}
 */
export function deduceMaxSatisfyingFromSemverList(semverList, requestedVersion) {
  // see which version the requested version satisfies
  let maxSatisfyingVersion = requestedVersion;
  try {
    maxSatisfyingVersion = semver.maxSatisfying(
      semverList,
      requestedVersion
    );
  } catch (err) { }

  return maxSatisfyingVersion;
}

/**
 * @export
 * @param {VersionMap} versionMap 
 * @param {String} requestedVersion 
 * @returns {Array<TaggedVersion>}
 */
export function buildTagsFromVersionMap(versionMap, requestedVersion) {
  // check if this is a valid range
  const isRequestedVersionValid = semver.validRange(requestedVersion);
  const versionMatchNotFound = !versionMap.maxSatisfyingVersion;

  // properly sort based on semver
  versionMap.releases = semver.sort(versionMap.releases || []).reverse();
  versionMap.taggedVersions.sort((a, b) => semver.compare(a.version, b.version)).reverse();

  // create the latest release entry
  const latestEntry = {
    name: "latest",
    version: versionMap.releases[0] || versionMap.taggedVersions[0].version,
    // can only be older if a match was found and requestedVersion is a valid range
    isOlderThanRequested: !versionMatchNotFound && isRequestedVersionValid && isOlderVersion(versionMap.releases[0] || versionMap.taggedVersions[0].version, requestedVersion)
  };
  const satisfiesLatest = semver.satisfies(versionMap.maxSatisfyingVersion, latestEntry.version);
  const isFixed = isRequestedVersionValid && isFixedVersion(requestedVersion);
  const isLatestVersion = satisfiesLatest && requestedVersion.replace(/[\^~]/, '') === latestEntry.version;

  // create the satisfies entry
  const satisfiesEntry = {
    name: "satisfies",
    version: versionMap.maxSatisfyingVersion,
    isNewerThanLatest: !satisfiesLatest && versionMap.maxSatisfyingVersion && semver.gt(versionMap.maxSatisfyingVersion, latestEntry.version),
    isLatestVersion,
    satisfiesLatest,
    isInvalid: !isRequestedVersionValid,
    versionMatchNotFound,
    isFixedVersion: isFixed,
    isPrimaryTag: true
  };

  // return an Array<TaggedVersion>
  return [
    satisfiesEntry,

    // only provide the latest when the satisfiesEntry is not the latest
    ...(satisfiesEntry.isLatestVersion ? [] : latestEntry),

    // concat all other tags
    ...applyTagFilterRules(
      versionMap.taggedVersions,
      requestedVersion,
      versionMap.maxSatisfyingVersion,
      latestEntry.version,
      versionMatchNotFound
    )
  ];
}

const versionTagFilterRules = createChainMutator([
  removeExactVersions,
  removeOlderVersions,
  removeTagsWithName,
  removeAmbiguousTagNames,
  reduceTagsByUniqueNames
]);

/**
 * @export
 * @param {Array<TaggedVersion>} taggedVersions
 * @returns {Array<TaggedVersion>}
 */
export function applyTagFilterRules(taggedVersions, requestedVersion, satisifiesVersion, latestVersion, versionMatchNotFound) {
  let filterVersions = taggedVersions.slice()

  if (semver.validRange(requestedVersion)) {
    // filter out any pre releases that are older than the requestedVersion
    filterVersions = removeOlderVersions.call(filterVersions, requestedVersion)
  }

  // tags that have the exact same version as the satisifiesVersion are filtered
  filterVersions = removeExactVersions.call(filterVersions, satisifiesVersion)

  // tags that have the exact same version as the latest are filtered
  filterVersions = removeExactVersions.call(filterVersions, latestVersion)

  if (versionMatchNotFound) {
    // if versionMatchNotFound, tags that are older than the latestVersion are filtered
    filterVersions = removeOlderVersions.call(filterVersions, latestVersion)
  }

  // remove ambiguous tag names
  filterVersions = removeAmbiguousTagNames.call(filterVersions)

  // reduce tags to unique names
  filterVersions = reduceTagsByUniqueNames.call(filterVersions)

  // remove any tags named latest
  filterVersions = removeTagsWithName.call(filterVersions, 'latest')

  return filterVersions.sort(sortTagsByRecentVersion)
}