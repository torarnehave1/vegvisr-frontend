import { Octokit } from '@octokit/rest'
import fs from 'fs/promises'
import path from 'path'

const uploadImageToGitHub = async (filePath, repoOwner, repoName, targetPath, branch = 'main') => {
  const octokit = new Octokit({
    auth: 'your_personal_access_token', // Replace with your GitHub PAT
  })

  try {
    // Read the image file and convert it to Base64
    const fileContent = await fs.readFile(filePath)
    const base64Content = fileContent.toString('base64')

    // Define the target file path in the repository
    const targetFilePath = path.join(targetPath, path.basename(filePath))

    // Check if the file already exists in the repository
    let sha
    try {
      const { data } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: targetFilePath,
        ref: branch,
      })
      sha = data.sha // Get the SHA of the existing file
    } catch (error) {
      if (error.status !== 404) {
        throw error // Re-throw if it's not a "file not found" error
      }
    }

    // Create or update the file in the repository
    const response = await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: targetFilePath,
      message: `Upload image: ${path.basename(filePath)}`,
      content: base64Content,
      branch,
      sha, // Include SHA if updating an existing file
    })

    console.log('File uploaded successfully:', response.data.content.html_url)
  } catch (error) {
    console.error('Error uploading file:', error.message)
  }
}

// Example usage
uploadImageToGitHub(
  'path/to/your/image.png', // Local image file path
  'your-github-username', // GitHub repository owner
  'your-repo-name', // GitHub repository name
  'images', // Target folder in the repository
)
