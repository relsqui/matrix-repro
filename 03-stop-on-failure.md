# Stop build on packaging failure

* **[Back to main.](README.md)**
* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)

We had a packager failure in the real repo that was reported as a successful job. I see that it was supposed to raise the error and exit with -1, which should cause a job failure, and I'm not sure why it didn't. Let's mock up the relevant code bits and figure out why.

This isn't necessarily an Appveyor-specific problem (although it might be), I'm just using my nice fast test setup since I have it already.

---

##

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734591)

```
image: Visual Studio 2015

build_script:
- ps: Write-Host "So far so good."
```

* **Change:** I don't need any of the filtering stuff here, and I don't expect to need much of the code I'm about to write again, so I'm making a branch and ripping out most of the Appveyor config, then I'll copy the notes back to master later.
* **Expected/Why:** Single job runs and prints a message. I'm only pushing this part alone to make sure I didn't miss any minimal requirements in the config.
* **Result:** So far so good indeed.

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->