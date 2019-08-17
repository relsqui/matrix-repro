# How do .catch and .finally interact?

* **[Back to main.](README.md)**

This one really isn't Appveyor-related at all. It's a continuation of [the previous experiment](03-stop-on-failure.md), where I was fixing an error getting eaten. Specifically, after a teammate pointed out a flaw in the solution I went with (what happens if the cleanup function fails in the catch block?), I want to drill down a bit into how to solve that properly. Really this is just me learning about how Javascript works.

My original question was which applies first between `.catch` and `.finally`, because I wanted to know if I could use `.finally` to run a cleanup function before `.catch` exits with an error code. That question doesn't actually make sense, though; `.catch`/`.finally` aren't a language construct (like `try`/`catch`), they're functions, they'll run in whatever order I put them in. But I'm still not sure whether `.finally` solves my problem, because I don't know if the error will still make it to `.catch`. So let's play with it.

---

<!-- For easy copy/paste:

##

[Appveyor run.]()

```
```

* **Change:** 
* **Expected/Why:** 
* **Result:** 

-->
