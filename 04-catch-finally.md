# How do .catch and .finally interact?

* **[Back to main.](README.md)**

This one really isn't Appveyor-related at all. It's a continuation of [the previous experiment](03-stop-on-failure.md), where I was fixing an error getting eaten. Specifically, after a teammate pointed out a flaw in the solution I went with (what happens if the cleanup function fails in the catch block?), I want to drill down a bit into how to solve that properly. Really this is just me learning about how Javascript works.

My original question was which applies first between `.catch` and `.finally`, because I wanted to know if I could use `.finally` to run a cleanup function before `.catch` exits with an error code. That question doesn't actually make sense, though; `.catch`/`.finally` aren't a language construct (like `try`/`catch`), they're functions, they'll run in whatever order I put them in. But I'm still not sure whether `.finally` solves my problem, because I don't know if the error will still make it to `.catch`. So let's play with it.

---

## initial state

```
async function fail() {
  throw new Error('Failing.');
}

async function main() {
  console.log('Main.');
  // fail();
}

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

* **Change:** This is how we left off in experiment 3, except I've removed all the complexity that turned out not to matter.
* **Expected/Why:** Nothing's broken so it should just exit cleanly.
* **Result:** Yup. I'm not going to paste it every time but for comparison, here's what that looks like:

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
0
```

My understanding right now is that if we fail in `main`, it will be handled properly (and exit with -1), but if we fail in `cleanup` it will not. Let's verify that:

## fail in `main`

```typescript
async function main() {
  console.log('Main.');
  fail();
}
```

* **Change:** Uncomment the failure in `main`.
* **Expected/Why:** We get a stack trace and a -1 exit code, because the error will fall through to `.catch`.
* **Result:** Y--hey wait.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
(node:57312) UnhandledPromiseRejectionWarning: Error: Failing.
    at /Users/finnre/matrix-repro/index.ts:2:9
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at fail (/Users/finnre/matrix-repro/index.ts:37:12)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
(node:57312) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 1)
(node:57312) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
0
```

Node complains because we didn't technically handle the rejection anywhere, which is fine, but it's doing that instead of ... ohh no wait. It's complaining because `cleanup` is async and we're not doing anything about that. Fair enough.

## await cleanup

```typescript
if (process.mainModule === module) {
  main()
    .then(() => cleanup())
    .catch(async (e) => {
      await cleanup();
      console.log('Caught error running main:');
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Make the `.catch` handler async so we can await ... okay I'm tired of putting backticks around everything. So we can await cleanup. (I've made this mistake like three times while working on this, I'm sure eventually the lesson will stick??)
* **Expected/Why:** The result we wanted above, a stack trace and a -1 exit code.
* **Result:** Okay, now what.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
(node:57518) UnhandledPromiseRejectionWarning: Error: Failing.
    at /Users/finnre/matrix-repro/index.ts:2:9
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at fail (/Users/finnre/matrix-repro/index.ts:38:12)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
(node:57518) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 1)
(node:57518) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
0
```

I need to start reading my errors and not just assuming I know what they are. This is the same one and they really are about the exception I'm throwing. That's weird. I thought this was what .catch was for. Let me check real quick what happens if there's no .then at all, so .catch is connected directly to the relevant function?

## no .then

```typescript
if (process.mainModule === module) {
  main()
    // .then(() => cleanup())
    .catch(async (e) => {
      await cleanup();
      console.log('Caught error running main:');
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Commented out .then so we can see .catch working at all.
* **Expected/Why:** Okay, before even running this one I realized that there's another place we're not handling an async function properly, which is the failure call! There's actually no reason for that to be async so let me fix it in the other direction just to make my life easier. Breaking format for a sec to do that (this is in addition to the above changes):

```typescript
function fail() {
  throw new Error('Failing.');
}
```

Now the expected result, again, is the stack trace and error message, here we go.

* **Result:** Yay!

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Failing.
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at main (/Users/finnre/matrix-repro/index.ts:41:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:15:3)
    at Module._compile (module.js:660:30)
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T00_55_23_738Z-debug.log
255
```

Also, I learned that printing the message is redundant with the stack, let's stop doing that.

```typescript
    .catch(async (e) => {
      await cleanup();
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
```

Interesting that the exit code wound up as 255, is that really an unsigned char? What even would define that? Bash, I guess? Choosing not to research it right now but there's an easy way to verify that's what's going on at least.

## exit -2

```typescript
      process.exit(-2);
```

* **Change:** Exit -2 instead.
* **Expected/Why:** If I'm right that it's an unsigned char, this should be 254. Otherwise node is just overriding it, which is kinda rude.
* **Result:** K cool.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at main (/Users/finnre/matrix-repro/index.ts:41:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:15:3)
    at Module._compile (module.js:660:30)
npm ERR! code ELIFECYCLE
npm ERR! errno 254
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 254
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T00_59_52_384Z-debug.log
254
```

... anyway, where were we. Let's restore .then now that we know it's not the culprit.

## restore .then

* **Change:** Not bothering to paste it, just uncommented the .then line again. Also switching the exit code back to -1 because it'll bug me if it's off by one for no reason.
* **Expected/Why:** We still get the stack and error message we want.
* **Result:** Okay, back on track.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at main (/Users/finnre/matrix-repro/index.ts:41:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:15:3)
    at Module._compile (module.js:660:30)
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_05_06_504Z-debug.log
255
```

Onwards to verifying that failing in cleanup works (that is, doesn't work) the way we expect.

## fail in cleanup

```typescript
async function main() {
  console.log('Main.');
}

async function cleanup() {
  console.log('Cleaning up.');
  fail();
}
```

* **Change:** Moved the failure call to cleanup instead of main.
* **Expected/Why:** Had to actually sit and think about this one. Main will run and terminate normally, .then will call cleanup, cleanup will throw, and I _think_ that will go to .catch, at which point cleanup will run again (erk) and throw again (erk) and node will die without getting to the `Caught error running main` print. Final answer.
* **Result:** Oh huh. True but not quite how I expected:

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Cleaning up.
(node:58657) UnhandledPromiseRejectionWarning: Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:11:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at cleanup (/Users/finnre/matrix-repro/index.ts:49:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:18:13)
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
(node:58657) UnhandledPromiseRejectionWarning: Unhandled promise rejection. This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). (rejection id: 5)
(node:58657) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
0
```

I had remarked to my teammate that if we don't mind the cleanup not running in the failure case, we don't actually care if it throws inside .catch, because the CI job is going to die anyway. But it's not, because it exits with 0, so we really do need to handle this properly. (Also, the cleanup might matter outside of CI.)

This is a case where it would be handy if node actually did exit with a non-zero code like it keeps threatening to. :P

Anyway, one last thing before getting into .finally: let's verify the solution that I went with in the real code, which I think works, but is just kinda ugly which is why I'm trying to improve on it.

## clean up and then re-throw

```typescript
if (process.mainModule === module) {
  main()
    .then(() => cleanup(), async (err) => { await cleanup(); throw err; })
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Define a reject function, in which we call the cleanup function, wait for it to complete, and then throw the error out to .catch.
* **Expected/Why:** Clean failure. Specifically, main exits normally, we drop to .then's resolve function, we run cleanup, it fails, we drop to .catch, and it prints the stack.
* **Result:** Nailed it.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:11:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at cleanup (/Users/finnre/matrix-repro/index.ts:49:12)
    at /Users/finnre/matrix-repro/index.ts:16:17
    at <anonymous>
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_19_09_520Z-debug.log
255
```

Actually the better test of this case is putting the failure back in main, so that we hit the reject function and fall out of cleanup there. I'll check that real quick but I'm not going to paste the result unless it's unexpected.

It was not! Onwards.

## .finally, finally

```typescript
if (process.mainModule === module) {
  main()
    .finally(() => cleanup())
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Instead of .then, use .finally, since we want to do the same thing (ish) no matter how we resolve.
* **Expected/Why:** My guess is that this doesn't actually work -- we lose the error information in .finally. The failure is in main right now, so we'll throw from main, clean up in finally, and never print the stack.
* **Result:** Wh--hey.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.

/Users/finnre/matrix-repro/index.ts:16
    .finally(() => cleanup())
            ^
TypeError: main(...).finally is not a function
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:16:13)
    at Module._compile (module.js:660:30)
    at Module.m._compile (/Users/finnre/matrix-repro/node_modules/ts-node/src/index.ts:473:23)
    at Module._extensions..js (module.js:671:10)
    at Object.require.extensions.(anonymous function) [as .ts] (/Users/finnre/matrix-repro/node_modules/ts-node/src/index.ts:476:12)
    at Module.load (module.js:573:32)
    at tryModuleLoad (module.js:513:12)
    at Function.Module._load (module.js:505:3)
    at Function.Module.runMain (module.js:701:10)
    at Object.<anonymous> (/Users/finnre/matrix-repro/node_modules/ts-node/src/bin.ts:158:12)
npm ERR! code ELIFECYCLE
npm ERR! errno 1
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 1
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_24_12_293Z-debug.log
1
```

...

.finally is supposed to be in node 10, which I thought is what I was ...

```
$ node --version
v9.5.0
```

Fair enough.

Oh, right, I set it up in my Appveyor config when I was doing CI testing, but I never thought to update it on my local machine.

After a bit of a detour screwing up and fixing my npm setup ...

```
$ sudo n 10.12.0

  installing : node-v10.12.0
       mkdir : /usr/local/n/versions/node/10.12.0
       fetch : https://nodejs.org/dist/v10.12.0/node-v10.12.0-darwin-x64.tar.gz
   installed : v10.12.0 (with npm 6.4.1)

SFO-M-FELLIS03:matrix-repro finnre$ node --version
v10.12.0
```

Now then.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at main (/Users/finnre/matrix-repro/index.ts:41:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:15:3)
    at Module._compile (internal/modules/cjs/loader.js:688:30)
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_37_04_593Z-debug.log
255
```

Oh shit! It's not often these surprise me by _working_.

... how does this work?

.finally and .catch aren't actually defining a sequence of code blocks, they're defining handlers. I guess promises are smart enough to run both the "okay whatever happened I'm all done" handler and the "something threw an exception in here" handler when both of those things are true.

This does kind of imply that my original question was correct! The order in which those handlers get triggered matters, but it seems to be the correct one. I want to investigate a couple more things though.

First of all, does the order in which they're _defined_ matter? I expect not, but let's check 'cause it's easy.

## .catch .finally

```typescript
if (process.mainModule === module) {
  main()
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    })
    .finally(() => cleanup());
}
```

* **Change:** Switch the order in which the .catch and .finally handlers are defined.
* **Expected/Why:** Same as above. I wouldn't expect the order in which handlers are defined to affect the order in which they're run, but it would be a good thing to know if that's wrong. (If it is wrong, we'll see the stack print, but cleanup won't run.)
* **Result:** Ooh interesting!

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:7:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at main (/Users/finnre/matrix-repro/index.ts:41:12)
    at Object.<anonymous> (/Users/finnre/matrix-repro/index.ts:15:3)
    at Module._compile (internal/modules/cjs/loader.js:688:30)
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_49_57_520Z-debug.log
255
```

Stack, no cleanup. And now (as I speculated earlier) it makes sense that I couldn't find a defined order anywhere; the order is the one in which they're defined.

That's ... a little confusing to figure out, but actually pretty nice. It means I can make it do the thing I want.

(I guess this might be because we're actually returning new promises through the chain each time? But in that case I don't know how the exception makes it from main out to the .catch block when .finally is defined first, and we saw that it does. This is kinda making me want to dig into the spec or the code and find out, but uh ... not at 7pm on a Friday.)

One more thing before I wrap up for the night. Let's switch back to the handler order we actually want and make sure it does the right thing when the error is in cleanup.

## .finally .catch when cleanup fails

```typescript
async function main() {
  console.log('Main.');
}

async function cleanup() {
  console.log('Cleaning up.');
  fail();
}

if (process.mainModule === module) {
  main()
    .finally(() => cleanup())
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
}
```

* **Change:** Put the handlers back in order and moved the failure to the cleanup function.
* **Expected/Why:** I think this'll also work. Main will complete cleanly and hit the .finally, cleanup will run and fail, and .catch will print the stack.
* **Result:** Oh, that worked but brought up another interesting point.

```
$ npm start; echo $?

> matrix-repro@1.0.0 start /Users/finnre/matrix-repro
> ts-node index.ts

Main.
Cleaning up.
Caught error running main:
Error: Failing.
    at fail (/Users/finnre/matrix-repro/index.ts:2:9)
    at /Users/finnre/matrix-repro/index.ts:11:3
    at step (/Users/finnre/matrix-repro/index.ts:31:23)
    at Object.next (/Users/finnre/matrix-repro/index.ts:12:53)
    at /Users/finnre/matrix-repro/index.ts:6:71
    at new Promise (<anonymous>)
    at __awaiter (/Users/finnre/matrix-repro/index.ts:2:12)
    at cleanup (/Users/finnre/matrix-repro/index.ts:49:12)
    at /Users/finnre/matrix-repro/index.ts:16:20
    at <anonymous>
npm ERR! code ELIFECYCLE
npm ERR! errno 255
npm ERR! matrix-repro@1.0.0 start: `ts-node index.ts`
npm ERR! Exit status 255
npm ERR! 
npm ERR! Failed at the matrix-repro@1.0.0 start script.
npm ERR! This is probably not a problem with npm. There is likely additional logging output above.

npm ERR! A complete log of this run can be found in:
npm ERR!     /Users/finnre/.npm/_logs/2019-08-17T01_58_54_181Z-debug.log
255
```

"Caught error running main" is just inaccurate. In the real code there isn't a message there, although maybe there should be -- I just added that in the demo to keep me oriented. So I won't worry about it for now. I'm just going to apply this fix to my branch on the real repo and then call it a night.
