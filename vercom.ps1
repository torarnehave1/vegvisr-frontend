# Check if VERSION file exists, if not create it
if (-not (Test-Path VERSION)) {
    "v1.0.0" | Out-File VERSION
}

# Read current version
$current_version = Get-Content VERSION

# Remove 'v' and split into major, minor, patch
$version = $current_version.Substring(1)
$parts = $version.Split('.')
# Pad the array with zeros if it has fewer than 3 components
while ($parts.Count -lt 3) {
    $parts += "0"
}
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Bump patch version
$patch++

# Create new version string
$new_version = "v$major.$minor.$patch"

# Update VERSION file
$new_version | Out-File VERSION

# Stage all changes except VERSION file
git add .

# Get commit message from arguments or use default
$commit_msg = if ($args.Count -gt 0) { $args -join ' ' } else { "Automated commit" }

# Commit with version and custom message
git commit -m "$new_version`: $commit_msg"

Write-Host "Committed as $new_version`: $commit_msg" 