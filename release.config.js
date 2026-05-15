// semantic-release expands `${...}` in its own template syntax, so plain strings
// here use those references intentionally — the lint rule is off for this file:
/* eslint-disable no-template-curly-in-string */

// Phase-1 semantic-release config for the scratch-editor monorepo.
//
// Runs inside the release-prep job of publish.yml. Produces:
//   - a version bump applied to every workspace via scripts/npm-version.sh
//   - a release commit with the changelog embedded in the commit body
//   - a git tag pointing at the release commit
//   - .release-version and .release-channel files for the workflow to read
//     as job outputs (npm_tag is derived from .release-channel: empty = latest)
//
// The bump commit and tag are pushed to a local bare repository (configured
// via --repository-url in the workflow) rather than to origin. The finalize
// job bundles those refs and pushes them to origin only after npm publish
// succeeds, so a publish failure leaves no orphan state on origin.
//
// No @semantic-release/npm: per-package publishing stays in the cd job.
// No @semantic-release/github: the GitHub release is created by finalize,
// using the commit body as the release notes.

module.exports = {
    branches: [
        'develop',
        '+([0-9])?(.{+([0-9]),x}).x',
        { name: 'release/*', prerelease: '${name.replace(/^release\\//, "")}' },
        { name: 'hotfix/*', prerelease: '${name.replace(/^hotfix\\//, "")}' }
    ],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'npm version "${nextRelease.version}" --no-git-tag-version',
                publishCmd: 'printf "%s" "${nextRelease.version}" > .release-version && printf "%s" "${nextRelease.channel || \'\'}" > .release-channel'
            }
        ],
        [
            '@semantic-release/git',
            {
                assets: [
                    'package.json',
                    'package-lock.json',
                    'packages/*/package.json'
                ],
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
            }
        ]
    ]
};
