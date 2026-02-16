import { spawn } from 'node:child_process';
import { fail, support } from './utils.mjs';

function runGit(args) {
  return new Promise((resolve) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function ensureGitReady(config) {
  const check = await runGit(['rev-parse', '--is-inside-work-tree']);
  if (check.code !== 0) {
    fail('This folder is not a git repository.');
    console.log('Action: run this command inside the worldofaletheia repository root.');
    support('GIT-NOT-REPO');
    throw new Error('Not in git repository.');
  }

  if (config.requireCleanWorkingTreeBeforePull) {
    const status = await runGit(['status', '--porcelain']);
    if (status.code !== 0) {
      throw new Error('Failed to check git status.');
    }
    if (status.stdout.trim()) {
      fail('Local git changes were found before pull.');
      console.log('Action: commit or stash local changes, then run content sync again.');
      support('GIT-WORKTREE-NOT-CLEAN');
      throw new Error('Worktree is not clean.');
    }
  }
}

export async function gitPullFastForwardOnly() {
  const pull = await runGit(['pull', '--ff-only']);
  if (pull.code !== 0) {
    fail('Could not update from remote with fast-forward only.');
    console.log('Action: stop and call for help before continuing.');
    support('GIT-PULL-DIVERGED');
    throw new Error(`git pull failed: ${pull.stderr || pull.stdout}`);
  }
}

export async function gitCommitAndPush({ commitMessage }) {
  const add = await runGit(['add', 'src/content', 'src/assets', '.content-sync-backups']);
  if (add.code !== 0) {
    throw new Error(`git add failed: ${add.stderr || add.stdout}`);
  }

  const status = await runGit(['status', '--porcelain']);
  if (status.code !== 0) {
    throw new Error(`git status failed: ${status.stderr || status.stdout}`);
  }

  if (!status.stdout.trim()) {
    return { changed: false };
  }

  const commit = await runGit(['commit', '-m', commitMessage]);
  if (commit.code !== 0) {
    throw new Error(`git commit failed: ${commit.stderr || commit.stdout}`);
  }

  const push = await runGit(['push']);
  if (push.code !== 0) {
    fail('Could not push content changes to remote.');
    console.log('Action: pull latest changes and retry, or call for help.');
    support('GIT-PUSH-REJECTED');
    throw new Error(`git push failed: ${push.stderr || push.stdout}`);
  }

  return { changed: true };
}
