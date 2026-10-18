/**
 * Test Runner - Runs all test suites sequentially.
 */

async function main() {
  console.log('=============================================');
  console.log('Running Test Suite: Phase 1');
  console.log('=============================================');
  await import('./phase1.test.js');

  console.log('\n=============================================');
  console.log('Running Test Suite: Phase 2');
  console.log('=============================================');
  await import('./phase2.test.js');

  console.log('\n=============================================');
  console.log('Running Test Suite: Phase 3');
  console.log('=============================================');
  await import('./phase3.test.js');

  console.log('\n=============================================');
  console.log('Running Test Suite: Phase 4');
  console.log('=============================================');
  await import('./phase4.test.js');

  console.log('\n=============================================');
  console.log('Running Test Suite: Phase 5');
  console.log('=============================================');
  await import('./phase5.test.js');

  console.log('\n=============================================');
  console.log('Running Test Suite: Phase 6');
  console.log('=============================================');
  await import('./phase6.test.js');

  console.log('\n=============================================');
  console.log('All Test Suites Completed Successfully! ✔');
  console.log('=============================================');
}

main().catch((err) => {
  console.error('Test Runner Failed:', err);
  process.exit(1);
});
