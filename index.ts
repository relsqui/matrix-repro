function fail() {
  throw new Error('Failing.');
}

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
