# Contributing

When contributing to this repository, please first open an issue so that the community of contributors to this repository can discuss the suggestion before a change is made.

## Pull Request Process

Once you have finished making your changes:

1. Make sure that your code satisfies the standards laid out in the [testing](#testing) and [coding style](#coding-style) section of this document.
2. Update README.md with details on any changes to the interface or behavior of the plugin.
3. Submit your PR, using the PR template provided to describe the details of your changes.

Then,

4. For substantial changes to the plugin, we will try to get at least two community sign-offs and some discussion of the PR before merging.
   * For non-controversial or minor PRs (e.g. phrasing updates in the documentation, minor refactoring of constants), one approval will be sufficient to move forward.
5. A contributor with push access to the repo will merge the PR after all tests and fixes have occured.
6. A new release will be published (if appropriate).

### Testing

At the time of the writing of this document, we are in the process of developing a full testing plan, but it will likely include unit and integration tests run locally and by our CI tool as well as more manual end-to-end tests. Please refer to issues 33-35 for the discussion. This document will be updated as the process becomes more concrete.

### Coding Style

This repository uses [prettier](https://prettier.io/) to enforce a uniform coding style. You may install an editor plugin for prettier, but code will also be auto-formatted via a git hook whenever you commit code.

### Code of Conduct

Please be polite and respectful in all your communication and actions towards others in the serverless-finch community.
