import assert from "node:assert/strict";

export function assertPackageVersionContract(manifest, packageJson, versions) {
  assert.equal(
    manifest.version,
    packageJson.version,
    "manifest.json and package.json versions must match",
  );
  assert.equal(
    versions[manifest.version],
    manifest.minAppVersion,
    "versions.json must map the package version to manifest.json minAppVersion",
  );
}

export function assertPackageLockContract(packageJson, packageLock) {
  assert.equal(
    packageLock?.lockfileVersion,
    3,
    "package-lock.json must use lockfileVersion 3",
  );
  assert.equal(packageLock?.name, packageJson.name, "package-lock root name must match package.json");
  assert.equal(packageLock?.version, packageJson.version, "package-lock root version must match package.json");
  const importer = packageLock?.packages?.[""];
  assert.ok(importer, "package-lock.json must contain the root package");
  assert.equal(importer.name, packageJson.name, "package-lock root package name must match package.json");
  assert.equal(importer.version, packageJson.version, "package-lock root package version must match package.json");
  assert.equal(importer.engines?.node, packageJson.engines?.node, "package-lock Node.js engine must match package.json");
  for (const field of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const declared = packageJson[field] ?? {};
    const locked = importer[field] ?? {};
    assert.deepEqual(
      Object.keys(locked).sort(),
      Object.keys(declared).sort(),
      `package-lock.json ${field} keys must match package.json`,
    );
    for (const [name, specifier] of Object.entries(declared)) {
      assert.equal(
        locked[name],
        specifier,
        `package-lock.json ${field}.${name} specifier must match package.json`,
      );
    }
  }
}

export function assertReleaseTag(releaseTag, manifestVersion) {
  assertStableReleaseVersion(releaseTag, "Release tag");
  assert.equal(
    releaseTag,
    manifestVersion,
    "Release tag must match manifest.json version",
  );
}

export function assertStableReleaseVersion(releaseVersion, label = "Release version") {
  assert.match(
    releaseVersion,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u,
    `${label} must use stable x.y.z without a v prefix or leading zeroes`,
  );
}
