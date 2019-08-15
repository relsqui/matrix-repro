# Stop build on packaging failure

* **[Back to main.](README.md)**
* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)

We had a packager failure in the real repo that was reported as a successful job. I see that it was supposed to raise the error and exit with -1, which should cause a job failure, and I'm not sure why it didn't. Let's mock up the relevant code bits and figure out why.

This isn't necessarily an Appveyor-specific problem (although it might be), I'm just using my nice fast test setup since I have it already.

---

## scrub the config

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734591)

```
image: Visual Studio 2015

build_script:
- ps: Write-Host "So far so good."
```

* **Change:** I don't need any of the filtering stuff here, and I don't expect to need much of the code I'm about to write again, so I'm making a branch and ripping out most of the Appveyor config, then I'll copy the notes back to master later.
* **Expected/Why:** Single job runs and prints a message. I'm only pushing this part alone to make sure I didn't miss any minimal requirements in the config.
* **Result:** So far so good indeed.

## node all the things

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734859)

```
async function main() {
  console.log("Still works.");
}

if (process.mainModule === module) {
  main()
    .catch((e) => {
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Set up the skeleton of a node project so I can repro the live problem. Made sure to peg the version of packages to the same ones we're actually using.
* **Expected/Why:** Should just print a message but I wouldn't be surprised if there's some piece of setup I forgot. (Works locally though.)
* **Result:** Okay cool. Now let's cause some failures!

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->