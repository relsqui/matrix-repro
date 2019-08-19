import { spawnPromise } from 'spawn-rx';

async function main() {
  return spawnPromise('appveyor', ['AddMessage', 'this spawns cmd']);
}

if (process.mainModule === module) {
  main()
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
}
