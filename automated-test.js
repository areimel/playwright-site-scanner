const { spawn } = require('child_process');

// Start the CLI process
const child = spawn('node', ['dist/cli.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let step = 0;

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);

  // Handle different steps of the interactive process
  if (output.includes('What URL would you like to test?')) {
    child.stdin.write('https://alecreimel.com\n');
  } else if (output.includes('Would you like to crawl the entire site and test all pages?')) {
    child.stdin.write('Y\n');
  } else if (output.includes('Choose your tests:')) {
    // Select all tests by pressing space for each and then enter
    // Since we can't easily interact with the checkbox, we'll just press enter
    // to select the default (none) and then see if our fix works
    child.stdin.write('\n');
  } else if (output.includes('Ready to start testing?')) {
    child.stdin.write('Y\n');
  } else if (output.includes('Test session failed') || output.includes('Test session cancelled')) {
    console.log('Test completed with result');
    child.stdin.end();
  }
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
  console.log(`CLI process exited with code ${code}`);
});