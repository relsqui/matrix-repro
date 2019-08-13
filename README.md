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

## parens for everybody

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548150)

* **Change:** Added parens about each condition in the compound expression.
* **Expected/Why:** It does the thing!
* **Result:** What the hell it still doesn't do the thing. Back to the shell.

```
PS /Users/finnre> $env:truthy = ('foo' -eq 'foo')
PS /Users/finnre> $env:truthy
True
PS /Users/finnre> write-host (-not (($env:truthy) -or ($env:stuff -like $env:wildcard)))
False
PS /Users/finnre> write-host (-not (($env:truthy) -or ('some other string' -like $env:wildcard)))
False
PS /Users/finnre> $env:falsey = ('foo' -eq 'bar')
PS /Users/finnre> $env:falsey
False
PS /Users/finnre> write-host (-not (($env:falsey) -or ('some other string' -like $env:wildcard)))
False
```

... okay, I was with you up until that last one, Powershell. Those interior conditions should both be false, so the `-or` should be false, so the `-not` should be true. Which of those expectations is wrong?

```
PS /Users/finnre> write-host ($env:falsey)
False
PS /Users/finnre> write-host ('some other string' -like $env:wildcard)
False
PS /Users/finnre> write-host (($env:falsey) -or ('some other string' -like $env:wildcard))
True
```

UM???

```
PS /Users/finnre> write-host (1 -eq 2)
False
PS /Users/finnre> write-host ((1 -eq 2) -or (1 -eq 2))
False
```

Okay so boolean logic isn't just, you know, broken. Do I ... need to quote my string var or something? I don't see how that could produce the output I'm seeing but it's worth checking. (I'll spare you the copy/paste, that wasn't it.)

... maybe my expressions are producing more complex outputs that are getting cast to booleans in some inconsistent way? What does `-like` actually return? [Docs say](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_comparison_operators?view=powershell-6) `Returns true when string matches wildcard pattern` which is what I expected.

... but later on that same page:

> The equality operators (`-eq`, `-ne`) return a value of TRUE or the matches when one or more of the input values is identical to the specified pattern

_Or_ the matches?!

```
PS> "abc" -ne "abc"
False
```

```
PS> "abc", "def" -ne "abc"
def
```

Oh when you give it more than one, all right, fair enough. Am I doing that by mistake maybe? That's the kind of thing I was looking for.

Oh. Oh oh oh oh. I think I know what's going on. I think I got lucky enough to make the same mistake in my local shell testing and my config -- otherwise this would be a lot _more_ confusing.

I bet `$env:APPVEYOR_REPO_TAG` is a _string_. And as an artifact of me not knowing what I was doing when I was setting it:

```
PS /Users/finnre> write-host $env:falsey
False
PS /Users/finnre> write-host ($env:falsey -like 'false')
True
PS /Users/finnre> write-host ($env:falsey -like 'False')
True
```

That's not weird, `-like` is case insensitive by default. And after some googling:

```
PS /Users/finnre> write-host $env:falsey.GetType()
System.String
```

Well then.

## string booleans

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548574)

```
-      if (-not (($env:APPVEYOR_REPO_TAG) # ...
+      if (-not (($env:APPVEYOR_REPO_TAG -like 'True') # ...
```

* **Change:** Treat the tag variable as a string instead of a powershell boolean.
* **Expected/Why:** At this point who knows what to expect?! Nah jk I still think this'll work. `test` and `release` run normally, `extra` catches and bails.
* **Result:** ... oh, interesting.

```
is commit message like '*[full ci]*'? False
Not a release candidate and full ci was not requested, bailing.
Running extra job (the one that should only run by request).
Build was forcibly terminated
Build success
```

So it did catch the condition it was supposed to, it just then proceeded into the main job anyway. Curious. I'm treating `Exit-AppveyorBuild` as an immediate return or exit statement but maybe I shouldn't, maybe it decides whether to run the whole script as one.

## split condition from main execution

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548662)

```
- ps: >-
    if ($env:JOB_NAME -eq "extra") {
      # job will start on any release branch build, but it should only run on tags or by request
      Write-Host "is commit message like '*`[full ci`]*'?" ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*`[full ci`]*');
      if (-not (($env:APPVEYOR_REPO_TAG -like 'True') -or ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*`[full ci`]*'))) {
        Write-Host "Not a release candidate and full ci was not requested, bailing.";
        Exit-AppveyorBuild;
      }
    }

- ps: Write-Host "Running $env:JOB_NAME job ($env:JOB_DESC)."
```

* **Change:** Put the bail test in a different one from the code we want to execute if we don't bail.
* **Expected/Why:** Stopping after the bailout. This isn't really a Powershell script I'm writing, it's still a yaml file, some of whose string entries are Powershell scripts.
* **Result:** Effing finally.

```
Not a release candidate and full ci was not requested, bailing.
Build was forcibly terminated
Build success
```

## put the bailout condition in the init section

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548698/job/jj3wxfi9k9msstns)

```
init:
- ps: >-
    if ($env:JOB_NAME -eq "extra") {
      # job will start on any release branch build, but it should only run on tags or by request
      Write-Host "is commit message like '*`[full ci`]*'?" ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*`[full ci`]*');
      if (-not (($env:APPVEYOR_REPO_TAG -like 'True') -or ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*`[full ci`]*'))) {
        Write-Host "Not a release candidate and full ci was not requested, bailing.";
        Exit-AppveyorBuild;
      }
    }

build_script:
- ps: Write-Host "Running $env:JOB_NAME job ($env:JOB_DESC).";
```

* **Change:** Doing that reminded me that in our actual config, we do that kind of test in the `init` section since it happens way earlier (in real time) than the build script. Let's do that here too.
* **Expected/Why:** Same as previous, shouldn't be a functional change.
* **Result:** Same as previous. So now we can get down to testing the actual cases this is supposed to work in.

## full ci on release

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548722)

* **Change:** No code change, just making sure `[full ci]` still works as intended on the release branch.
* **Expected/Why:** The `extra` job fully executes, along with `test` and `release`.
* **Result:** Yep.

## tag on release branch

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548774)

* **Change:** Made and pushed a lightweight tag on a commit that doesn't request full ci.
* **Expected/Why:** `extra` runs anyway, since it should pass the check in the `init` block.
* **Result:** Oh, hm, right. Pushing the tag itself didn't trigger a build at all: `Commit "cdb67cae" skipped as branch "0.1.0" does not match any configuration`. Pushing the actual commit again afterwards does, but it's not a tag build so it doesn't fit the condition (nor should it). Let me refresh my memory about how this works in the real repo.

## push commit, then tag

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548863)

* **Change:** Last time, I did a `git push --tags` thinking it would get commit and also tag, which it didn't seem to -- a commit job didn't start. This time I did just `git push` first and then `git push origin 0.1.1` (a new tag I just made), and that worked. This is weirdly finicky. (I suspect `git push --tags` in that second case would also have helped but I'm not too worried about that part right now, that's not in the scope of the problem I'm trying to solve.)
* **Expected/Why:** `extra` job runs fully along with the others.
* **Result:** Yep! I think that's all the cases we need to test on the release branch, so let's go back to master and make sure we didn't break anything.

## back on master

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26548915)

* **Change:** Merge in all that change we made on the release branch.
* **Expected/Why:** On the merge commit on master, only `test` runs, since we're not invoking any of the special cases. `extra` shouldn't even trigger.
* **Result:** Indeed.

## nightly on master

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26549079)

* **Change:** Pushed the `nightly` tag on master (and took the opportunity to confirm my theory that `git push` and then `git push --tags` does what I want).
* **Expected/Why:** The `extra` job still doesn't trigger, even though it's a tag build, because it's filtered out at the branch name level.
* **Result:** Yup, just `test` and `nightly`.

I'm feeling pretty comfortable with this solution at this point. Let's go implement it in the main repo.

## manage extra jobs with a flag

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26568240)

```
  - JOB_NAME: extra1
    JOB_DESC: "the first one that should only run by request"
    IS_EXTRA: true

  - JOB_NAME: extra2
    JOB_DESC: "the second one that should only run by request"
    IS_EXTRA: true

  - JOB_NAME: extra3
    JOB_DESC: "the third one that should only run by request"
    IS_EXTRA: true

  - JOB_NAME: extra4
    JOB_DESC: "the fourth one that should only run by request"
    IS_EXTRA: true
```

```
for:
-
  branches:
    only:
      - /^release.*/
  matrix:
    only:
      - JOB_NAME: release
      - IS_EXTRA: true
```

```
-
  only_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - IS_EXTRA: true
```

```
init:
- ps: >-
    if ($env:IS_EXTRA -like 'true') {
```

* **Change:** Added several extra jobs and managed them with a common flag rather than by name. This is a closer fit to the real repo and I want to test it here first.
* **Expected/Why:** Hopefully, no change in behavior from the above at all. This commit specifically should just build `test` because it's on master and didn't request full ci.
* **Result:** So far so good. Let's test `[full ci]` and then a release branch with and without a tag.

## [full ci] with flag management

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26568364)

* **Change:** Same code as the above with `[full ci]` applied.
* **Expected/Why:** `test` and all the `extra` jobs run.
* **Result:** Just `test`. :cry:

That's kinda weird. This part worked fine when I was naming the jobs. What happens if I name all of them instead of using the group variable? (This bodes ill for my shortcut, though.)

## split out extra jobs in the commit message filter block

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26568505)

```
-
  only_commits:
    message: /\[full ci\]/
  matrix:
    only:
      - JOB_NAME: extra1
      - JOB_NAME: extra2
      - JOB_NAME: extra3
      - JOB_NAME: extra4
```

* **Change:** Just the above, not messing with the variables elsewhere yet.
* **Expected/Why:** Honestly I'll be unhappy if this is different from the above, but checking to see if this actually causes them all to start in the `[full ci]` case.
* **Result:** Well, okay, at least it's not that. Seriously what the heck though. This did work before, and the only difference is which variable I'm testing ... isn't it?

Reverting this change before I continue.

Ooh! Had an idea while typing out a question for Appveyor. Maybe this is a boolean/string thing again? `true` is a boolean in the yaml spec, but it may not be compared that way. It could be wrong in either direction but I'm going to guess first that we're storing a string and testing a boolean ... wait hang on, we use these in the real repo, don't we?

Yeah, we totally both set and test booleans in yaml and the real config without problems. Well ... still, easy to check. Let's make them all explicitly strings, that's easy enough.

## boolean strings on purpose this time

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26569312)

* **Change:** Added single quotes around `true` for all the `IS_EXTRA` uses.
* **Expected/Why:** Maybe the extra jobs would actually run with `[full ci]`?
* **Result:** Nah. Let's go ahead and [ask Appveyor about it](https://help.appveyor.com/discussions/questions/40351-why-did-one-of-these-commit-filters-work-and-not-the-other).

## does breaking release fix master?

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26575574)

```
for:
   matrix:
     only:
       - JOB_NAME: release
       # - IS_EXTRA: 'true'
```

* **Change:** I hate that I even typed that heading, but I looked at an older example where `[full ci]` was working on master and apart from breaking out a bunch of individual extra jobs, the only difference was that I'd enabled the extra jobs on the release branch in the interim. So what happens if we comment that out and then run with the flag?
* **Expected/Why:** If this works then I need to update my understanding of how this config is applied. If it doesn't, back to the drawing board I guess.
* **Result:** Ah. That worked. Well then. Let's go back and learn some more about how this works.

## use different variables for `[full ci]` jobs and release-included jobs

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26575853)

```
  - JOB_NAME: release
    JOB_DESC: "the one that should run on the release branch"
    START_ON_RELEASE: true
```

```
  - JOB_NAME: extra1
    JOB_DESC: "the first one that should only run by request"
    IS_EXTRA: true
    START_ON_RELEASE: true
```

```
for:
-
  branches:
    only:
      - /^release.*/
  matrix:
    only:
      - START_ON_RELEASE: true
```

* **Change:** If the variable check has to be exclusive between filter blocks, what if we use two different variables to mark the same condition in different places? (This is kind of a hack but it's less hacky than the other alternatives I can think of.)
* **Expected/Why:** I'm still not sure how Appveyor parses these, so I honestly don't know if this will work or not. If the condition has to be unique, this will work. If the actual selected set of jobs does, it won't, but I don't think that can possibly be true and everything else work the way it does?
* **Result:** Only `test` ran (with `[full ci]` in the commit message). I don't understand _anything_ any more. Might be time to go home, haha.

Okay, after going home and coming back I learned two important things from Appveyor:

* When you put `matrix.only` and `branches.only` in a `for` block, what's happening is "for only these jobs, run on only these branches" and _not_ "for only these branches, run only these jobs." You can specify them in either order which makes this really unclear, and I'm reversing the way I write them in the config immediately.

* _These blocks are ordered_. Given the above, and also how matrix config works and everything else before the actual build scripts, the possibility of these being ordered literally did not occur to me. That does a lot to narrow down the field of how this is supposed to behave.

Naturally, there's no explicit documentation about how multiple limits (`branches.only` but also `only_commits`) interact with each other. I'm guessing they're intersected (has to be on the branch and have the commit message) rather than unioned (either), and also whether or not that's true, I suspect treating it that way will get me a more readable config.

That said, if I'm wrong, it's the fastest way to get the config I actually want, so let's check real quick.

## only branch + only commit + `[full ci]`

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26646172)

```
-
  matrix:
    only:
      - IS_EXTRA: true
  only_commits:
    message: /\[full ci\]/
  branches:
    only:
      - /^release.*
```

* **Change:** Specify both a commit message filter and a branch filter, then run with `[full ci]` on master (since that's where we left off with broken behavior).
* **Expected/Why:** I think this isn't going to work, because it'll look for both conditions and only one will be met, but I'm kinda hoping I'm wrong because it simplifies things in the immediate term.
* **Result:** Indeed, only `test` ran, which makes my current problem harder but at least I understand why.

Reverting that change and thinking about what to try next.

Seems like if I want a more complex condition than "only here" or "except here," and I can't use an environment variable as a condition (although it sounds like they're working on that), then I have to just not use this mechanism at all and filter in the config file. Annoying but at least easy.

## always filter extra jobs manually

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26649476)

```
init:
- ps: >-
    if ($env:IS_EXTRA -like 'true') {
      # run extra jobs when asked in the commit message or on any non-nightly tag
      if (-not ((($env:APPVEYOR_REPO_TAG -like 'true') -and -not ($env:APPVEYOR_REPO_TAG_NAME -like 'nightly')) -or ($env:APPVEYOR_REPO_COMMIT_MESSAGE -like '*`[full ci`]*'))) {
        Write-Host "Not a release candidate and full ci was not requested, bailing.";
        Exit-AppveyorBuild;
      }
    }
```

* **Change:** Removed the `extra` section entirely from the `for` block, and used the above logic to filter jobs instead. Running this with `[full ci]` on master.
* **Expected/Why:** Unless I messed up my Powershell again, this should actually run all the extra jobs.
* **Result:** Wh ... that actually didn't even trigger Appveyor at all (like, there's nothing in the event log). Maybe because I amended the commit to add `[full ci]`? I'm pretty sure I've done that before though. Pushing another commit without amending just to see what happens.

Yeah, weird, that did it. Huh. Anyway, once it went through it worked. Choosing not to worry about why the hook didn't go through unless I have trouble with it again.

Now let's make sure it does the right thing on a release branch.

## release branch, no request for extra

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26674716)

* **Change:** On a release branch, push a commit without a tag or `[full ci]`.
* **Expected/Why:** Extra jobs don't run.
* **Result:** Er, rather, extra jobs run but bail out, which is correct. Let's test the request and tag cases and then pop back to master and do the same there.

## release branch, full ci

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26674785)

* **Change:** Release branch commit with `[full ci]`.
* **Expected/Why:** Extra jobs actually run.
* **Result:** Correct.

## release branch with tag

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26678322)

* **Change:** Make a commit on a release branch without `[full ci]`. Add a new tag (`0.1.2`) and `git push --tags`.
* **Expected/Why:** Extra jobs actually run, again.
* **Result:** Er, tag didn't build because the tag name didn't match any config. Huh? I thought this worked before. Let me try making a new tag on the same commit and pushing just the tag?

Did that with `0.1.3` and this time it didn't even pop up in Appveyor at all. ... oh _right_ I haven't pushed the _commit_ yet just the tags, derp. I should read more about how git manages tags so it'll be easier to remember how they work.

Okay, made and pushed a new commit (just removing the empty file from before), tagged `0.1.4` and pushed tags. That started a regular branch build and a tag build (which is normal, if silly).

The regular branch build started extra jobs and then failed, which is correct. The tag build actually ran the extra jobs. Perfect.

Left to test:

* `[full ci]` on a release branch
* regular master build
* `nightly` tag from master

My "I could automate this" sense is tingling but it's probably not worth the trouble. If I were _going_ to go to the trouble I should do it with the real config anyway, copied into a test repo. (Actually, huh, that's not a bad idea.)

## `[full ci]` on release branch

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26678529)

* **Change:** No code changes, same as previous but with `[full ci]`.
* **Expected/Why:** All extra jobs run again because they still pass the filter.
* **Result:** Worked. Also, even though the actual runs are short, waiting for all these extra jobs to queue is tedious, I think I'll cut it down to two (since the thing I'm really testing here is just managing the plurality).

Merging this back in to master now.

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->