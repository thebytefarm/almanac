# Releasing Almanac

Almanac uses Changesets to version `almanac-md`, maintain its changelog, create Git tags, and publish to npm. Releases exist only on npm; the workflow does not create GitHub Releases.

## Normal releases

Every pull request that changes the published package includes a changeset created with `pnpm changeset`. After the pull request merges to `main`, `.github/workflows/release.yml` creates or updates `changeset-release/main` with the accumulated version and changelog changes.

Review and merge that release pull request. The next release workflow run packs the package in a job with read-only repository access, then publishes the exact tarball from a separate job with npm OIDC permission. No npm token is stored in GitHub.

The npm trusted publisher must use:

- Organization: `thebytefarm`
- Repository: `almanac`
- Workflow filename: `release.yml`

## First release

npm requires a package to exist before its trusted publisher can be configured. The first `0.1.0-rc.0` release therefore needs one manual publish:

1. Merge the initial Changesets release pull request so `main` contains version `0.1.0-rc.0` and its changelog.
2. Check out the merged `main` commit and run `pnpm validate`.
3. Confirm npm authentication with `npm whoami`.
4. Run `pnpm run release --otp=<current-code>`. This publishes the package and creates the local Changesets Git tag.
5. Push the generated `almanac-md@0.1.0-rc.0` tag.
6. Configure the npm trusted publisher with the values above.
7. Set the GitHub Actions repository variable `NPM_TRUSTED_PUBLISHING` to `true`.
8. Require two-factor authentication and disallow token-based publishing for the package.

After bootstrap, `.github/workflows/release.yml` owns npm publishing and pushes the matching Git tag. It does not create a GitHub Release. Never add an npm token to the repository or GitHub Actions.
