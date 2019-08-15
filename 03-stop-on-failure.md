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

## failure is fun!

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734942)

```
async function main() {
  process.exit(1);
}
```

```
build_script:
- echo "Before."
- npm start
- echo "After."
- ps: Write-Host "After, but in Powershell."
```

* **Change:** First things first, make sure that if we exit non-zero the job dies. Added some extra lines around the actual npm call in the build script to mimic the real config. (I don't think it'll matter when they're in separate items like this but no harm in being thorough.)
* **Expected/Why:** The job fails.
* **Result:** It would have been pretty weird if that hadn't worked. Let's make it more complicated.

## failing, but complicated

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26735088)

```
async function failureFunction() {
  throw new Error('Oh no, an exception!');
}
async function runThisFunction(func: Function) {
  try {
    return await func();
  } catch (error) {
    console.error('Caught error in runThisFunction.');
    throw error;
  }
}

async function main() {
  await runThisFunction(async () => {
    try {
      await failureFunction();
    } catch (e) {
      console.error(`Error in the function passed to runThisFunction:`, e);
      throw e;
    }
  });
}
```

* **Change:** In the real code there's a lot more happening between all this silly redundancy, of course, I just copied the structure of the code and removed the functionality. If I still can't repro the problem I'll try to go a level or two deeper (the actual error is coming from an external binary).
* **Expected/Why:** The correct behavior is for the job to fail, but if it doesn't it would mean I'm on the right track.
* **Result:** Darn, it failed correctly. (What a weird sentence.)

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->