import { spawn } from "child_process";

async function failureFunction() {
  await spawn('powershell', ['.\\exit-1.ps1']);
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

if (process.mainModule === module) {
  main()
    .catch((e) => {
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}