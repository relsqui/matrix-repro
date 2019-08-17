# Stop build on packaging failure

* **[Back to main.](README.md)**
* [Full build history for this repo.](https://ci.appveyor.com/project/relsqui/matrix-repro/history)

We had a packager failure in the real repo that was reported as a successful job. I see that it was supposed to raise the error and exit with -1, which should cause a job failure, and I'm not sure why it didn't. Let's mock up the relevant code bits and figure out why.

This isn't necessarily an Appveyor-specific problem (although it might be), I'm just using my nice fast test setup since I have it already.

---

## scrub the config

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734591)

```yaml
image: Visual Studio 2015

build_script:
- ps: Write-Host "So far so good."
```

* **Change:** I don't need any of the filtering stuff here, and I don't expect to need much of the code I'm about to write again, so I'm making a branch and ripping out most of the Appveyor config, then I'll copy the notes back to master later.
* **Expected/Why:** Single job runs and prints a message. I'm only pushing this part alone to make sure I didn't miss any minimal requirements in the config.
* **Result:** So far so good indeed.

## node all the things

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26734859)

```typescript
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

```typescript
async function main() {
  process.exit(1);
}
```

```yaml
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

```typescript
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

## fail, but in powershell

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26735296)

```typescript
async function failureFunction() {
  await spawn('powershell', ['.\\exit-1.ps1']);
}
```

* **Change:** The real case is spawning an external binary that fails, so let's do that too.
* **Expected/Why:** Actually, I just realized this won't work because the powershell command is going to succeed (at running a script that fails), I need the command itself to fail. Oops.
* **Result:** Yeah, this job succeeds (correctly). This isn't the same problem as the one I'm investigating, because the exception really does get passed up the chain in that case. Let's try another way to fail.

## courting ENOENT

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26735346)

```typescript
async function failureFunction() {
  await spawn('something that does not exist');
}
```

* **Change:** This will definitely fail.
* **Expected/Why:** I suspect it's the wrong kind of failure too, though. I'm trying it because it's easy but I'm not sure where the ENOENT will actually get raised or if that matters.
* **Result:** Yeah, failed but didn't repro the problem. Although I noticed something else in this case -- the failure isn't getting propagated up the chain of error reporting, it's just killing the whole process immediately. That's weird. Is spawn not throwing a regular exception? Or do those not work the way I think they do?

## make spawn more complicated too

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26735830)

```typescript
import { spawn } from './spawn-promise';

async function failureFunction() {
  const cmd = 'ls';
  const args = ['something nonexistent'];
  console.log(await spawn(cmd, args));
}
```

* **Change:** Noticed that `spawn` in the real case isn't default spawn, so I grabbed the promise wrapper out of the library (at the version we're using). Tested this locally and it produces the chain of errors I wanted, so should be a good test on the remote, as long as I'm remembering correctly that `ls` is aliased to `Get-ChildItem` in Powershell (or the cmd equivalent, I forget what shell you wind up in when you `spawn` in Appveyor). Find out in a sec I guess.
* **Expected/Why:** Hopefully this will print the error chain but pass the job.
* **Result:** Nope, failed like it was supposed to. :( WTH. Let me pore over the original error some more and see if I can track down what exactly is different between the flow in that code and in my code.

... ah. After that and having dinner, I'm pretty sure I figured it out.

## .then

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26736719)

```typescript
if (process.mainModule === module) {
  main()
    // .then((res) => console.log('Resolved: ', res), (rej) => { throw rej; })
    .then((res) => console.log('Resolved: ', res), (rej) => console.log('Rejected: ', rej))
    .catch((e) => {
      console.log('Caught error running main:');
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** The piece of logic I hadn't carried over was the `.then` block from the `main()` call. After adding some logging I noticed that when it just calls external functions (as it does in the real code), that `caught error running main` message never prints -- we're eating the error at the last second before handling it. I already have what I think (from local testing) is the fix, commented. (While I was here, I realized I could add syntax highlighting to my code blocks, so I did that retroactively.)
* **Expected/Why:** I think this will repro the error in CI -- it will print out that it failed, but the job will succeed.
* **Result:** Yup! :tada: So switching to the commented line should fix it, and that shows me what I need to fix in the real code.

## cleanup

[Appveyor run.](https://ci.appveyor.com/project/relsqui/matrix-repro/builds/26737079)

```
async function cleanup() {
  console.log('Cleaning up.');
}

if (process.mainModule === module) {
  main()
    .then(() => cleanup())
    .catch((e) => {
      cleanup();
      console.log('Caught error running main:');
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Confirmed that the line which was commented above works, and then realized I could tidy it up a little more. This version is also a little truer to what's happening in the real code.
* **Expected/Why:** Tested locally (on both the failure and success cases), so I know this'll print the error and should die and kill the job properly as well.
* **Result:** Heck yeah, ship it. I'll see if I can get rid of some of the error reporting redundancy while I'm there, too, heh.

---

(I ended up deciding to merge the whole thing in after all, I can always go back and find the commit filter stuff if I need it but I have other things to test in the meantime, some of which can use this node setup.)
