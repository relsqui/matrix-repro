import { spawnPromise } from 'spawn-rx';

async function main() {
  return spawnPromise('Add-AppveyorMessage', ['-message', 'yep, this spawns powershell']);
}

if (process.mainModule === module) {
  main()
    .catch(async (e) => {
      console.log('Caught error running main:');
      console.error(e.stack);
      process.exit(-1);
    });
}
