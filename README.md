# Appveyor Matrix Experiments

* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)
* [Build matrix documentation.](https://www.appveyor.com/docs/build-configuration/#build-matrix)
* [Commit filtering documentation.](https://www.appveyor.com/docs/how-to/filtering-commits/)
---
* [First page of notes.](initial-setup.md)

Here's the full set of jobs defined in appveyor.yml for this repo:

```
environment:
  matrix:
  - JOB_NAME: test
    JOB_DESC: "the one that should run every time"

  - JOB_NAME: release
    JOB_DESC: "the one that should run on the release branch"

  - JOB_NAME: nightly
    JOB_DESC: "the one that should run on the nightly tag"

  - JOB_NAME: extra
    JOB_DESC: "the one that should only run by request"
```

And here are the special cases defined in the `for` block:

```
for:
-
  branches:
    only:
      - /^release.*/
  matrix:
    only:
      - JOB_NAME: release

-
  branches:
    only:
      - nightly
  matrix:
    only:
      - JOB_NAME: nightly
```

[Here are the notes](initial-setup.md) from the initial setup of the appveyor config file. I realized after deploying that solution that I need non-nightly tags (releases, in the real case) to get a full build too, so now I'm going to work on that.

At config execution time we don't know whether we're building from a tag -- at least, I don't think it gives us any tools for that. But release tags are on release branches, so we can enable the extra jobs for the release branch and just have them quick-pass if the tag isn't set.

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->