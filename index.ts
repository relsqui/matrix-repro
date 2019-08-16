import { spawn } from './spawn-promise';

async function failureFunction() {
  const cmd = 'ls';
  const args = ['something nonexistent'];
  console.log(await spawn(cmd, args));
}

async function runThisFunction(func: Function) {
  try {
    return await func();
  } catch (error) {
    console.log('Caught error in runThisFunction:');
    console.log(JSON.stringify(error));
    throw error;
  }
}

async function main() {
  await runThisFunction(async () => {
    try {
      await failureFunction();
    } catch (e) {
      console.log(`Error in the function passed to runThisFunction:`, e);
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