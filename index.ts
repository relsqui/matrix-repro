async function main() {
  process.exit(1);
}

if (process.mainModule === module) {
  main()
    .catch((e) => {
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}