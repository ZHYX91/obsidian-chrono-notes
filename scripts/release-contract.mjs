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
