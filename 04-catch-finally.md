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

<!-- For easy copy/paste:

##

```typescript
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->
