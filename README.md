# Appveyor Matrix Experiments

* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)
* [Build matrix documentation.](https://www.appveyor.com/docs/build-configuration/#build-matrix)
* [Commit filtering documentation.](https://www.appveyor.com/docs/how-to/filtering-commits/)

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

* **Change:** Started a run on master with no modifiers (triggered from the web UI).
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

* **Change:** Pushed a commit to master with no modifiers.
* **Expected/Why:** Maybe the order of qualifiers is the other way; run `only` the specified jobs unless the `only_commits` condition is met? Or if that condition is met?
* **Result:** `test` and `extra` jobs ran. This is the closest approximation to the behavior in the real repo in the failure case.

## [full ci]

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358514)


* **Change:** No code changes in this one, just added `[full ci]` to the commit message to see what would happen.
* **Expected/Why:** Same as previous; this is the case in which that's supposed to happen.
* **Result:** Same as previous.


## simple push

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358586)

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

* **Change:** Reverted to except/except/only and pushed.
* **Expected/Why:** Wanted to see if starting from the UI made a difference the first time, expected it to run only `test`.
* **Result:** _No_ jobs ran. (Apparently this leaves an empty build that appears to be queuing forever. Weird.) The event log says that the branch `master` wasn't in the white list for either of the `nightly` or `release` special cases, which is correct; for the `test` and `extra` jobs, it says the commit message didn't match the condition. This is more surprising than if it had worked backwards and just run `extra`.

## except/only/only for `extra`

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358700)

```
-
  branches:
    except:
      - /^release.*/
      - nightly
  matrix:
    only:
      - JOB_NAME: extra
  only_commits:
    message: /\[full ci\]/
```

* **Change:** Flipped `except` `test` into `only` `extra`, on the theory of having the `only_commits` instruction only apply to that job. (I can't remember why I didn't do it this way in the original now.)
* **Expected/Why:** Only the `test` job runs as long as I don't provide the commit message flag, but I'm not sure how this will interact with the other special cases.
* **Result:** Only `test` ran! Good start.

## [full ci] again

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358732)

* **Change:** No code changes, but ran the above config with `[full ci]`.
* **Expected/Why:** `test` and `extra` run, this is the intended behavior.
* **Result:** `test` and `extra` ran! So far so good.

## nightly

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26358756)

* **Change:** Tagged a commit as `nightly` and pushed the tag.
* **Expected/Why:** Only the `nightly` job runs, following the special case block.
* **Result:** `nightly` and `test` both run. I'm genuinely unsure why `test` was included here.

I have a couple of ideas for where to go next (try overtly excluding `test` for `nightly` and `release` and then recreate the tag; see what happens on a release branch) but it's 7pm and I will save that for later.

## explicit only blocks

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26411614)

```
-
  branches:
    only:
      - master
      - /^feat.*/
  skip_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - JOB_NAME: test

-
  branches:
    only:
      - master
      - /^feat.*/
  only_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - JOB_NAME: test
      - JOB_NAME: extra
```

* **Change:** Instead of leaving the default case implicit, have two separate blocks for the default case and the extended run.
* **Expected/Why:** Only `test` runs.
* **Result:** So far so good!

## [full ci] with two explicit blocks

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26413961)

* **Change:** No code change, just adding [full ci] to the above.
* **Expected/Why:** `test` and `extra` run, following the second block.
* **Result:** Only `extra` ran. :(

## only/only/only

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26484714)

```
-
  branches:
    only:
      - master
      - /^feat.*/
  only_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - JOB_NAME: extra
```

* **Change:** Per Owen's suggestion in my Appveyor ticket, remove the second block and only specify the behavior for the `extra` job. I had to double-check that I hadn't already tried this; it's almost exactly [except/only/only](#exceptonlyonly) but I hadn't yet switched to opting branches in yet. I'm starting to understand that the way I'm thinking about this (as some kind of selection/action combination) is incorrect; they're _all_ just selections.
* **Expected/Why:** I forgot to think of an expectation before actually trying it.
* **Result:** Only `test` ran, so far so good again.

## only x3 [full ci]

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26484856)

* **Change:** No change, just adding `[full ci]` to the above.
* **Expected/Why:** `test` and `extra` both run, if Owen's right about how this works.
* **Result:** Success! Finally! Now to verify the other special cases.

## only x3 (nightly)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26484892)

* **Change:** Deleted previous `nightly` tag, recreated, and pushed it.
* **Expected/Why:** `nightly` runs (because we hit that block), `test` runs (by default), `extra` does not.
* **Result:** Also success! Couple more cases to try, the release branch and then both of these special cases with the `[full ci]` addition (although I'm feeling more confident about the result of that now).

## only x3 (release)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485061)

* **Change:** Cut a `release-x` branch and push.
* **Expected/Why:** `release` job runs because of that special block, `test` runs by default, nothing else.
* **Result:** Success!

## only x3 (release, `[full ci]`)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485095)

* **Change:** Same as above but with `[full ci]`.
* **Expected/Why:** `release` and `test` run for the same reasons as before, `extra` also runs.
* **Result:** Oh wait no, `extra` doesn't run in this case because I told it not to. Given the way it's now configured, I think I can remove that branch constraint and let people have that if they want to; shouldn't do anything unwanted otherwise.

## only x3 (release, no `extra` constraint)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485144)

```
-
  only_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - JOB_NAME: extra
```

* **Change:** Remove branch filter from `extra` job.
* **Expected/Why:** `release` because we're still on a release branch, `test` by default, `extra` because we just removed its constraint.
* **Result:** Success! Man ... now that this is done it looks pretty simple. Let's merge this back in and test master again.

## only x3 (master, no `extra` constraint)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485200)

* **Change:** Merge the above back to master.
* **Expected/Why:** `test` and `extra` run for the same reasons they did before.
* **Result:** Oh wait no I didn't even tell it to run `extra`. Just `test`. That's fine.

## only x3 (master, `[full ci]` without branch constraint)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485236)

* **Change:** Add `[full ci]` to the above.
* **Expected/Why:** `test` and `extra` run.
* **Result:** Yep, works. Let's double-check the tag but I'm feeling confident this is solved.

## only x3 (nightly, no branch constraint)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485297)

* **Change:** Replace the nightly tag.
* **Expected/Why:** `nightly` because of the special block and `test` by default.
* **Result:** Yup. Last test, breaking the tag again.

## only x3 (nightly, full)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485386)

* **Change:** Replace the nightly tag and add `[full ci]`.
* **Expected/Why:** `nightly` and `test` run for the same reasons as above, `extra` runs because of commit flag.
* **Result:**  Oops forgot what I was doing and didn't add the commit flag, let me do that one more time ... whoa weird.
  * Okay, so. [First time](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485346) it did the expected thing without the commit flag (the nightly job fails because I deleted the job while it was queued, that's nothing to be concerned about).
  * I added the commit flag and pushed again, but this time forgot to push tags so it just [ran like a master build](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485382) with `[full ci]` on, which is fine.
  * But then I pushed tags and it did the [same thing](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485386), without running the `nightly` job?
  * Let me try that again getting all the parts right on a fresh commit to verify.

## only x3 (nightly, full, take 2)

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26485472)

* **Change:** Added `[full ci]`, pushed the `nightly` tag, and did a `push --tags` the first time this time.
* **Expected/Why:** I want `nightly`, `test`, and `extra`, but given the above I think I might just get `test` and `extra`? I'm not sure which of those outcomes would be more confusing.
* **Result:** I got all three! Well, that's preferable at least, but it implies something kinda weird happens when the commit and the tag get pushed separately.

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->