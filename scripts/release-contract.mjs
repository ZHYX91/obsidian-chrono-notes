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

export function assertReleaseTag(releaseTag, manifestVersion) {
  assert.match(
    releaseTag,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u,
    "Release tag must use stable x.y.z without a v prefix or leading zeroes",
  );
  assert.equal(
    releaseTag,
    manifestVersion,
    "Release tag must match manifest.json version",
  );
}
