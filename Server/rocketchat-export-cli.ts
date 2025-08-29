#!/usr/bin/env ts-node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RocketChat Export CLI Utility
 * 
 * This utility allows administrators to export 1:1 conversations from RocketChat
 * and save them as JSON files that can be imported into the patient care system.
 * 
 * Usage:
 *   npx ts-node rocketchat-export-cli.ts --server <url> --username <user> --password <pass> --output <file>
 * 
 * Example:
 *   npx ts-node rocketchat-export-cli.ts --server https://rocket.example.com --username admin --password secret --output export.json
 */

import { RocketChatExporter } from './src/lib/rocketchat-exporter';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  return options;
}

function showUsage() {
  console.log(`
RocketChat Export CLI Utility

Usage:
  npx ts-node rocketchat-export-cli.ts --server <url> --username <user> --password <pass> --output <file>

Options:
  --server    RocketChat server URL (e.g., https://rocket.example.com)
  --username  RocketChat username with admin privileges
  --password  RocketChat password
  --output    Output JSON file path (optional, defaults to rocketchat_export_YYYY-MM-DD.json)

Example:
  npx ts-node rocketchat-export-cli.ts --server https://rocket.example.com --username admin --password secret --output export.json

This tool will:
  1. Connect to your RocketChat server
  2. Export all 1:1 conversations (direct messages)
  3. Save the data in JSON format compatible with the import system
  4. Include participant information and message history
`);
}

async function main() {
  const options = parseArgs();

  // Validate required arguments
  if (!options.server || !options.username || !options.password) {
    console.error('❌ Error: Missing required arguments');
    showUsage();
    process.exit(1);
  }

  // Set default output file if not provided
  if (!options.output) {
    const date = new Date().toISOString().slice(0, 10);
    options.output = `rocketchat_export_${date}.json`;
  }

  console.log('🚀 Starting RocketChat export...');
  console.log(`📡 Server: ${options.server}`);
  console.log(`👤 Username: ${options.username}`);
  console.log(`📄 Output: ${options.output}`);
  console.log('');

  try {
    // Create exporter instance
    const exporter = new RocketChatExporter({
      serverUrl: options.server,
      username: options.username,
      password: options.password
    });

    // Export conversations
    console.log('🔐 Authenticating with RocketChat...');
    const conversations = await exporter.exportDirectMessages();

    // Save to file
    const exportData = {
      export_info: {
        source: 'rocketchat',
        server_url: options.server,
        exported_at: new Date().toISOString(),
        conversation_count: conversations.length,
        tool: 'RocketChat Export CLI v1.0'
      },
      conversations: conversations
    };

    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log('');
    console.log('✅ Export completed successfully!');
    console.log(`📊 Exported ${conversations.length} conversations`);
    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`📏 File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Review the exported data in the JSON file');
    console.log('  2. Upload the file through the admin interface import feature');
    console.log('  3. Or use the direct import API endpoint');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Export failed:');
    console.error(`   ${error.message}`);
    console.error('');
    console.error('💡 Troubleshooting tips:');
    console.error('   • Verify the RocketChat server URL is correct and accessible');
    console.error('   • Ensure the username and password are correct');
    console.error('   • Check that the user has admin privileges in RocketChat');
    console.error('   • Verify network connectivity to the RocketChat server');
    console.error('');
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unexpected error:', error?.message || error);
  process.exit(1);
});

// Show usage if no arguments provided
if (process.argv.length <= 2) {
  showUsage();
  process.exit(0);
}

// Run the main function
main().catch(console.error);