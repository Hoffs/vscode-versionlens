/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Peter Flannery. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export function createPackageNotSupported(name, version, type) {
  return createPackage(
    name,
    version, {
      type,
      packageNotSupported: true,
      message: "Package registry not supported",
      tag: {
        isPrimaryTag: true
      }
    }
  );
}

export function createPackageNotFound(name, version, type) {
  return createPackage(
    name,
    version, {
      type,
      packageNotFound: true,
      message: `${name} could not be found`,
      tag: {
        isPrimaryTag: true
      }
    }
  );
}

export function createInvalidVersion(name, version, type) {
  return createPackage(
    name,
    version, {
      type,
      tag: {
        isInvalid: true,
        isPrimaryTag: true
      }
    }
  );
}

export function createPackageErrored(name, version, type) {
  return createPackage(
    name,
    version, {
      type,
      tag: {
        isErrored: true
      }
    }
  );
}

export function createPackage(name, version, meta, customGenerateVersion) {
  return {
    name,
    version,
    meta,
    customGenerateVersion
  };
}