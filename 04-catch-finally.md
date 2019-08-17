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
* **Result:** Yup.

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

Oh, and I guess node complains because we didn't technically handle the rejection anywhere. Quick detour, does defining the reject function explicitly handle that?

<!-- For easy copy/paste:

##

```typescript
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->
