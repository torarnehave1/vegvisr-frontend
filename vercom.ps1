param(
    [Parameter(Mandatory=$true)]
    [string]$commitMessage
)

# Read the current version from VERSION file
$versionFile = "VERSION"
$currentVersion = (Get-Content $versionFile -ErrorAction Stop).Trim()

# Handle merge conflict markers if present
if ($currentVersion -match '<<<<<<< HEAD') {
    # Extract both versions from the conflict
    $versions = $currentVersion -split '======='
    $version1 = ($versions[0] -replace '<<<<<<< HEAD', '').Trim()
    $version2 = ($versions[1] -replace '>>>>>>>.*', '').Trim()
    
    # Remove 'v' prefix if present
    $version1 = $version1 -replace '^v', ''
    $version2 = $version2 -replace '^v', ''
    
    # Compare versions and take the higher one
    $version1Parts = $version1 -split '\.'
    $version2Parts = $version2 -split '\.'
    
    $isVersion2Higher = $false
    for ($i = 0; $i -lt 3; $i++) {
        if ([int]$version2Parts[$i] -gt [int]$version1Parts[$i]) {
            $isVersion2Higher = $true
            break
        }
        elseif ([int]$version2Parts[$i] -lt [int]$version1Parts[$i]) {
            break
        }
    }
    
    $currentVersion = if ($isVersion2Higher) { "v$version2" } else { "v$version1" }
}

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

# Stage all changes
git add .

# Create the commit message with version
$fullCommitMessage = "$commitMessage ($newVersion)"

# Commit the changes
git commit -m $fullCommitMessage

Write-Host "Version incremented to $newVersion and changes committed with message: $fullCommitMessage"
