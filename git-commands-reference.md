# Git Commands Reference

## Viewing Changes Before Pulling

When your local branch is behind the remote branch, you can examine the changes before pulling them.

### 1. See commit history of pending changes

```bash
git log HEAD..origin/main --oneline
```

Shows a compact list of commits that are in `origin/main` but not in your current branch.

### 2. See detailed commit information

```bash
git log HEAD..origin/main
```

Shows full commit messages, authors, and timestamps for the pending changes.

### 3. See actual code changes (diff)

```bash
git diff HEAD..origin/main
```

Shows the exact line-by-line changes that will be applied when you pull.

### 4. See which files will be modified

```bash
git diff --name-only HEAD..origin/main
```

Shows just the filenames that have changes.

### 5. See summary of changes per file

```bash
git diff --stat HEAD..origin/main
```

Shows which files changed and how many lines were added/removed in each.

### 6. See the latest commit on remote branch

```bash
git show origin/main
```

Shows the most recent commit that will be pulled.

### 7. Visual representation of commit history

```bash
git log --graph --oneline HEAD..origin/main
```

Shows a visual representation of the commit history with branching patterns.

## Viewing Changes for Specific Files

### 1. See changes for a specific file

```bash
git diff HEAD..origin/main -- path/to/your/file.ext
```

### 2. See changes for multiple specific files

```bash
git diff HEAD..origin/main -- file1.js file2.vue
```

### 3. See changes for all files in a directory

```bash
git diff HEAD..origin/main -- src/components/
```

### 4. See the entire content of a file as it will be after pulling

```bash
git show origin/main:path/to/your/file.ext
```

### Important Note About File Syntax

- Use `--` separator followed by a space before file paths
- ❌ Wrong: `git diff HEAD..origin/main --wrangler.toml`
- ✅ Correct: `git diff HEAD..origin/main -- wrangler.toml`

## Understanding Diff Output

When you see output like:

```
diff --git a/wrangler.toml b/wrangler.toml
new file mode 100644
index 0000000..3b904c9
--- /dev/null
+++ b/wrangler.toml
```

This means:

- `new file mode 100644` - This is a completely new file
- `--- /dev/null` - The file doesn't exist in your current branch
- `+++ b/wrangler.toml` - The file will be created when you pull

## Options for Handling Changes

### Option 1: Don't pull (simplest)

Simply continue working with your current code. You're not required to pull immediately.

### Option 2: Create backup branch first (safest)

```bash
git branch backup-before-pull
git pull
```

If you don't like the changes:

```bash
git reset --hard backup-before-pull
```

### Option 3: Pull and reset if needed

```bash
git pull
# Test the changes...
# If you don't like them:
git reset --hard HEAD~7  # Goes back 7 commits (adjust number as needed)
```

### Option 4: Work on separate branch (Testing Changes Safely)

This approach creates a "sandbox" where you can test the remote changes without affecting your main work.

**Step-by-step explanation:**

1. **Create and switch to a new branch:**

   ```bash
   git checkout -b test-new-changes
   ```

   - Creates a new branch called `test-new-changes`
   - Switches to that branch immediately
   - This branch starts as an exact copy of your current state

2. **Pull the remote changes into your test branch:**

   ```bash
   git pull origin main
   ```

   - Downloads and merges the 7 commits from `origin/main`
   - Your test branch now has all the new changes
   - Your original `main` branch remains unchanged

3. **Test the changes:**

   ```bash
   # Run your application, check functionality, review code
   npm run dev        # or whatever your dev command is
   npm run build      # test if it still builds
   # Browse through the code changes
   ```

4. **If you like the changes - merge them:**

   ```bash
   git checkout main
   git merge test-new-changes
   git branch -d test-new-changes  # Clean up (lowercase -d)
   ```

5. **If you don't like the changes - discard them:**
   ```bash
   git checkout main              # Go back to your original state
   git branch -D test-new-changes # Delete the test branch (uppercase -D forces deletion)
   ```

**Why this approach is great:**

- ✅ **Zero risk** - Your main branch stays untouched
- ✅ **Full testing** - You can run, build, and thoroughly test the changes
- ✅ **Easy rollback** - Just delete the branch if you don't like it
- ✅ **Clean history** - No messy resets in your main branch
- ✅ **Collaborative** - You can still work on main while testing changes

**Visual representation:**

```
Before:
main: A---B---C (your current work)
origin/main: A---B---C---D---E---F---G (7 commits ahead)

After creating test branch:
main: A---B---C (unchanged)
test-new-changes: A---B---C---D---E---F---G (with new changes)

If you like it:
main: A---B---C---D---E---F---G (merged)

If you don't like it:
main: A---B---C (exactly as before)
test-new-changes: (deleted)
```

### Option 5: Cherry-pick specific changes

```bash
git log HEAD..origin/main --oneline  # See available commits
git cherry-pick <commit-hash>  # Apply only specific commits
```

## Backup Strategy for Configuration Files

### Finding Files in WSL

```bash
# Find all wrangler.toml files
find . -name "wrangler.toml" -type f

# Find any specific file pattern
find . -name "*.toml" -type f
```

### Creating Backups

```bash
# Create backup directory
mkdir -p bk-wrangler

# Copy all wrangler.toml files with descriptive names
find . -name "wrangler.toml" -type f | while read file; do
  folder=$(dirname "$file" | sed 's|./||' | sed 's|/|-|g')
  cp "$file" "bk-wrangler/${folder}-wrangler.toml"
done

# Add backup folder to .gitignore
echo "bk-wrangler/" >> .gitignore

# Verify backup
ls -la bk-wrangler/
```

### Creating Automated Backup Script

```bash
cat > backup-wrangler.sh << 'EOF'
#!/bin/bash
echo "Creating wrangler backup..."
mkdir -p bk-wrangler

# Find and copy all wrangler.toml files
find . -name "wrangler.toml" -not -path "./bk-wrangler/*" | while read file; do
    # Create backup filename by replacing slashes with dashes
    backup_name=$(echo "$file" | sed 's|./||' | sed 's|/|-|g')
    cp "$file" "bk-wrangler/$backup_name"
    echo "Backed up: $file -> bk-wrangler/$backup_name"
done

echo "Backup complete!"
EOF

chmod +x backup-wrangler.sh
```

## Common Git Status Commands

```bash
# Check current status
git status

# See what branch you're on and how far behind/ahead
git status -b

# See what changes are staged
git diff --cached

# See what changes are in working directory
git diff
```

## Pro Tips

1. **Always check changes before pulling** - Use `git diff HEAD..origin/main` to see what's coming
2. **Use the `--` separator** correctly when specifying file paths
3. **Create backups** before major pulls if you're unsure
4. **Work in branches** when testing new changes
5. **Use descriptive branch names** for your backups and test branches

## Emergency Commands

If you've pulled and want to undo:

```bash
# Go back to previous state (replace N with number of commits)
git reset --hard HEAD~N

# Or go back to a specific commit
git reset --hard <commit-hash>

# Or use your backup branch
git reset --hard backup-before-pull
```

Remember: `git reset --hard` will permanently lose uncommitted changes, so use with caution!
