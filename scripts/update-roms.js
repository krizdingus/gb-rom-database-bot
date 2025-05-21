#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { loadRomData } = require('../loadRomData');

// Get the absolute path to the Python script
const scriptPath = path.join(__dirname, 'fetch_gb_roms.py');

// Function to update ROMs and reload data
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
        console.log('\nPython script completed successfully. Reloading ROM data...');

        // Reload the ROM data
        const result = loadRomData();
        if (result.success) {
          console.log('ROM data reloaded successfully!');
          resolve(true);
        } else {
          console.error('Failed to reload ROM data');
          reject(new Error('Failed to reload ROM data'));
        }
      } else {
        console.error(`\nPython script exited with code ${code}`);
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
