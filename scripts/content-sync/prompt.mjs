import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { info, support, warn } from './utils.mjs';

export async function askStaleFileAction() {
  info('Some repo files are not in Obsidian anymore.');
  console.log('Action choices:');
  console.log('- remove: delete stale files permanently');
  console.log('- backup: move stale files to backup folder');
  console.log('- abort: stop now with no destructive changes');

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const answer = (await rl.question('Choose remove / backup / abort: ')).trim().toLowerCase();
      if (answer === 'remove' || answer === 'backup' || answer === 'abort') {
        return answer;
      }

      warn('Invalid choice.');
      console.log('Action: type remove, backup, or abort.');
      support('PROMPT-INVALID-CHOICE');
    }
  } finally {
    rl.close();
  }
}

