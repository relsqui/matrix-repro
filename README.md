# Appveyor Matrix Experiments

* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)
* [Build matrix documentation.](https://www.appveyor.com/docs/build-configuration/#build-matrix)
* [Commit filtering documentation.](https://www.appveyor.com/docs/how-to/filtering-commits/)

---

* [Notes on initial setup of the Appveyor config in this repo.](initial-setup.md)

---

I realized after deploying my original config solution that I need non-nightly tags (releases, in the real case) to get a full build too, so now I'm going to work on that.

At config execution time we don't know whether we're building from a tag -- at least, I don't think it gives us any tools for that. But release tags are on release branches, so we can enable the extra jobs for the release branch and just have them quick-pass if the tag isn't set. Let's try it!

---

##

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547242)

```
for:
-
  branches:
    only:
      - /^release.*/
  matrix:
    only:
      - JOB_NAME: release
      - JOB_NAME: extra

# ...

build_script:
- ps: >-
    if ($env:JOB_NAME -eq "extra") {
      # job will start on any release branch build, but it should only actually
      # execute on release candidate tags or by request
      if (not ($env:APPVEYOR_REPO_TAG -or $env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*[full ci]*')) {
        Write-Host "Not a release candidate and full ci was not requested, bailing."
        Exit-AppveyorBuild
      }
    }
    Write-Host "Running $env:JOB_NAME job ($env:JOB_DESC).
```

* **Change:** Added the `extra` job to the release section, and then added a check in the build script which bails out of that job unless it's actually supposed to run (because we're building a release candidate or we requested a full run).
* **Expected/Why:** No change because we're building on master.
* **Result:** No change, only `test` ran.

##

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547580)

* **Change:** Start a `release-*` branch and do a basic CI run.
* **Expected/Why:** The `test` and `release` jobs run as usual; the `extra` job starts but bails because of the check in the build script.
* **Result:** Typo in the powershell (`not` should be `-not`), so the `extra` job errored and then actually executed. Learned a thing about powershell not bailing when it doesn't parse, which I guess makes sense, bash is like that too.

##

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547629)

* **Change:** Just fixed that typo.
* **Expected/Why:** Same as before for the same reasons.
* **Result:** Huh. The extra job still runs? Why?


<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->