<template>
  <div class="downloads-page">
    <div class="downloads-container">
      <h1>Download Hallo Vegvisr</h1>
      <p class="subtitle">Create and manage knowledge graphs from your Android device</p>

      <div class="download-card">
        <div class="app-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
            <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24a11.463 11.463 0 0 0-8.94 0L5.65 5.67a.643.643 0 0 0-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/>
          </svg>
        </div>
        <div class="app-info">
          <h2>Hallo Vegvisr for Android</h2>
          <p>Version 1.0.0</p>
          <p class="app-size">Size: ~51 MB</p>
        </div>
        <a href="https://apps.vegvisr.org/download/hallo-vegvisr.apk" class="download-button" download>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          Download APK
        </a>
      </div>

      <div class="install-instructions">
        <h3>Installation Instructions</h3>
        <ol>
          <li>Download the APK file by clicking the button above</li>
          <li>Open the downloaded file on your Android device</li>
          <li>If prompted, enable "Install from unknown sources" in your device settings</li>
          <li>Follow the on-screen instructions to complete the installation</li>
        </ol>
      </div>

      <div class="features">
        <h3>Features</h3>
        <ul>
          <li>Create knowledge graphs with markdown content</li>
          <li>Add images and YouTube videos to your graphs</li>
          <li>SMS-based authentication for easy login</li>
          <li>View and edit your graphs on the go</li>
          <li>Sync with vegvisr.org for web viewing</li>
        </ul>
      </div>

      <div class="requirements">
        <h3>Requirements</h3>
        <p>Android 5.0 (Lollipop) or higher</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Downloads page for Hallo Vegvisr Android app
</script>

<style scoped>
.downloads-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.downloads-container {
  max-width: 600px;
  width: 100%;
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  margin-top: 2rem;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 0.5rem;
}

.subtitle {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
}

.download-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 2rem;
}

.app-icon {
  color: #3DDC84;
  margin-bottom: 1rem;
}

.app-info {
  text-align: center;
  margin-bottom: 1.5rem;
}

.app-info h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.app-info p {
  color: #666;
  margin: 0.25rem 0;
}

.app-size {
  font-size: 0.9rem;
}

.download-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #3DDC84;
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s, transform 0.2s;
}

.download-button:hover {
  background: #32c973;
  transform: translateY(-2px);
}

.download-button svg {
  fill: white;
}

.install-instructions,
.features,
.requirements {
  margin-bottom: 1.5rem;
}

h3 {
  color: #333;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #eee;
}

ol, ul {
  padding-left: 1.5rem;
  color: #555;
}

li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.requirements p {
  color: #666;
}

@media (max-width: 480px) {
  .downloads-page {
    padding: 1rem;
  }

  .downloads-container {
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .download-card {
    padding: 1.5rem;
  }
}
</style>
