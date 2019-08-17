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
