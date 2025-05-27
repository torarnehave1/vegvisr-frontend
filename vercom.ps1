param(
    [Parameter(Mandatory=$true)]
    [string]$commitMessage
)

# Read the current version from VERSION file
$versionFile = "VERSION"
$currentVersion = (Get-Content $versionFile -ErrorAction Stop).Trim()

# Remove 'v' prefix if present
$currentVersion = $currentVersion -replace '^v', ''

# Parse the version number
$versionParts = $currentVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2]

# Increment the patch version
$patch++

# Create the new version string with 'v' prefix
$newVersion = "v$major.$minor.$patch"

# Update the VERSION file
Set-Content -Path $versionFile -Value $newVersion

# Add the VERSION file to git
git add $versionFile

# Create the commit message with version
$fullCommitMessage = "$commitMessage ($newVersion)"

# Commit the changes
git commit -m $fullCommitMessage

Write-Host "Version incremented to $newVersion and changes committed with message: $fullCommitMessage"
