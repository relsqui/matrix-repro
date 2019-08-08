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

## adding a conditional filter

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

## test filter on a release branch

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547580)

* **Change:** Start a `release-*` branch and do a basic CI run.
* **Expected/Why:** The `test` and `release` jobs run as usual; the `extra` job starts but bails because of the check in the build script.
* **Result:** Typo in the Powershell (`not` should be `-not`), so the `extra` job errored and then actually executed. Learned a thing about Powershell not bailing when it doesn't parse, which I guess makes sense, bash is like that too.

## fix powershell typo

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547629)

* **Change:** Just fixed that typo.
* **Expected/Why:** Same as before for the same reasons.
* **Result:** Huh. The extra job still runs? Why?

## examine the environment

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547700)

```
    Write-Host "JOB_NAME: $env:JOB_NAME"
    Write-Host "APPVEYOR_REPO_TAG: $env:APPVEYOR_REPO_TAG"
    Write-Host "APPVEYOR_REPO_COMMIT_MESSAGE: $env:APPVEYOR_REPO_COMMIT_MESSAGE"
```

* **Change:** Let's make sure all these variables are what they're supposed to be.
* **Expected/Why:** On the extra job for this run, they should be `extra`, `false`, and the commit message, respectively.
* **Result:** Okay this calls for a code block, because what.

```
JOB_NAME: extra Write-Host APPVEYOR_REPO_TAG: false Write-Host APPVEYOR_REPO_COMMIT_MESSAGE: Let's peek at those environment variables. if True
  # job will start on any release branch build, but it should only run on tags or by request
  if (-not ($env:APPVEYOR_REPO_TAG -or $env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*[full ci]*')) {
    Write-Host "Not a release candidate and full ci was not requested, bailing."
    Exit-AppveyorBuild
  }
 Write-Host Running extra job (the one that should only run by request).
 ```

 All of that is _output_! I think the lines are getting run together here -- I'm not sure if Powershell itself requires semicolons for multi-line blocks, but I think defining it in a yaml file on Appveyor might. (Shoutout to my goofy bash side project that involves eval'ing a lot of multiline bash strings, thought of this because I saw that problem there.)

 As a bonus, that `if True` at the beginning tells me that the job name condition is working; it's evaluating `($env:JOB_NAME -eq 'extra')` which is a wild thing to be able to accidentally mid-string.

## apply semicolons

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547770)

* **Change:** Just added a semicolon after each Powershell statement.
* **Expected/Why:** Same as above, and maybe also the logic actually works now?
* **Result:** Variables are correct, logic still failing. This is gonna be something really silly, isn't it.

## examine the condition that's most likely to be broken

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547819)

```
      Write-Host "is commit message like '*[full ci]*'? ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*[full ci]*')";
```

* **Change:** Applying what we learned about string interpolation of boolean expressions a minute ago, let's check the output of that part of the logic specifically. It's the more complicated condition and I'm wondering if I'm missing a syntax thing, like single/double quotes or the brackets being meaningful (although that should be a blob, not a regex). While I'm here, I also added some parens around this condition in the actual test, on the offchance `x -or y -like z` doesn't do what I expect.
* **Expected/Why:** This is supposed to be false, but it's not working, so maybe it's true!
* **Result:** That didn't work at all, I don't think the expression interpolation thing works in quotes. :sweat_smile: This kind of thing is easier to test locally though, so let me jam on syntax in a shell for a sec. (Also, the extra parens didn't fix it either, so I'm taking them back out for tidiness.)

## more powershell syntax

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26547939)

```
PS /Users/finnre> $env:stuff = 'foo [bar] baz'
PS /Users/finnre> write-host "is stuff like bar?" ($env:stuff -like '*[bar]*')
is stuff like bar? True
```

```
      Write-Host "is commit message like '*[full ci]*'?" ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*[full ci]*');
```

* **Change:** Just fixing syntax.
* **Expected/Why:** This should print the question and then the boolean response, which is still supposed to be `False` but maybe isn't.
* **Result:** It's `True`! So at least we have the culprit. I bet it's the square brackets. Similarly, this works:

```
PS /Users/finnre> $env:stuff = 'foo [bar] baz'
PS /Users/finnre> write-host "is stuff like bar?" ($env:stuff -like '*[foo]*')
is stuff like bar? True
```

Should've tested that before. [Powershell wildcards support square brackets.](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_wildcards?view=powershell-6) I was even reading that page earlier, I just didn't look past what I was looking for (about `*`), serves me right really. Let's just ... escape those.

## escape square brackets

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548016)

* **Change:** Escaped the square brackets in the test and the print with graves.
* **Expected/Why:** Condition reports False and logic works.
* **Result:** WTH, the condition is reported as False and the logic still doesn't work? Something to do with the compound logic maybe? Let's test that locally too.

```
PS /Users/finnre> write-host $env:stuff
foo [bar] baz
PS /Users/finnre> write-host $env:wildcard
*`[bar`]*
PS /Users/finnre> write-host $env:stuff -like $env:wildcard
foo [bar] baz -like *`[bar`]*
PS /Users/finnre> write-host ($env:stuff -like $env:wildcard)
True
PS /Users/finnre> write-host (False -or $env:stuff -like $env:wildcard)

PS /Users/finnre> write-host (False -or ($env:stuff -like $env:wildcard))

```

... what??

```
PS /Users/finnre> write-host (True -or ($env:stuff -like $env:wildcard)) 

PS /Users/finnre> write-host (('foo' -eq 'foo') -or ($env:stuff -like $env:wildcard))
True
PS /Users/finnre> write-host ((True) -or ($env:stuff -like $env:wildcard))
True
```

Oh. The parens really did matter. Kinda weird, but fine. I like type systems because they force you to intentionally resolve ambiguity, I guess I can get behind mandatory booleans in complex boolean logic for the same reason.

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->