#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Get the absolute path to the Python script
const scriptPath = path.join(__dirname, 'fetch_gb_roms.py');

// Function to update ROMs
async function updateRoms() {
  console.log('Starting ROM update process...\n');

  // Spawn the Python process
  const pythonProcess = spawn('python3', [scriptPath], {
    stdio: 'inherit', // This will pipe stdout/stderr to the parent process
    cwd: path.join(__dirname, '..'), // Run from project root to ensure correct paths
  });

  // Wait for the Python process to complete
  return new Promise((resolve, reject) => {
    pythonProcess.on('close', code => {
      if (code === 0) {
        // This script is its own process, so it can't reload the running bot's
        // in-memory index. Reloading here would only have reloaded data into a
        // process that was about to exit.
        console.log('\nPython script completed successfully. rom-list.json is up to date.');
        console.log('The running bot still holds the old list. To pick up the new one:');
        console.log("  - self-hosted: kill -HUP $(pgrep -f 'node index.js')");
        console.log('  - hosted (Railway and friends): restart or redeploy the service');
        resolve(true);
      } else {
        console.error(`\nPython script exited with code ${code}`);
        console.error('rom-list.json was left as it was.');
        reject(new Error(`Python script failed with exit code ${code}`));
      }
    });

    pythonProcess.on('error', err => {
      console.error('Failed to start Python process:', err);
      reject(err);
    });
  });
}

// Run the update if this script is called directly
if (require.main === module) {
  updateRoms()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { updateRoms };
