# Appveyor Matrix Experiments

[Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)

Here's the full set of jobs defined in this appveyor.yml:

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

The goal here is to find an additional section I can put in the `for` block that will result in:
* the `release` job running only for release branches
* the `nightly` job running only for a tag (or branch) called `nightly`
* the `test` and `extra` jobs running when `[full ci]` is added to the commit message, and
* only `test` running in all other cases.

The rest of this file will be me experimenting, taking notes, and thinking out loud.

## initial commit (except/except/only)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358291)

```
-
  branches:
    except:
      - /^release.*/
      - nightly
  matrix:
    except:
      - JOB_NAME: tests
  only_commits:
    message: /\[full ci\]/
```

* **Action:** Started a run on master with no modifiers (triggered from the web UI).
* **Expected/Why:** This block takes effect, since we're not on any of the exception branches. The `only_commits` doesn't apply since we didn't add that commit message, so we skip jobs `except` for the `tests` job.
* **Result:** _All_ jobs ran. That might be because I started it from the web UI? Will experiment more.

## except/only/only

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358314)

```
-
  branches:
    except:
      - /^release.*/
      - nightly
  matrix:
    only:
      - JOB_NAME: tests
  only_commits:
    message: /\[full ci\]/
```

* **Action:** Pushed a commit to master with no modifiers.
* **Expected/Why:** Maybe the order of qualifiers is the other way; run `only` the specified jobs unless the `only_commits` condition is met? Or if that condition is met?
* **Result:** `test` and `extra` jobs ran. This is the closest approximation to the behavior in the real repo in the failure case.

## [full ci]

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358514)


* **Action:** No code changes in this one, just added `[full ci]` to the commit message to see what would happen.
* **Expected/Why:** Same as previous; this is the case in which that's supposed to happen.
* **Result:** Same as previous.


<!-- For easy copy/paste:

##

[Appveyor run.]()

* **Action:** 
* **Expected/Why:** 
* **Result:** 

-->