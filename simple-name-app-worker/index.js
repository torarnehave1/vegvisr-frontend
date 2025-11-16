// Simple Name Display App - Cloudflare Worker
// This app takes a name and displays it for 3 seconds

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Main app route - serve HTML
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(getAppHTML(), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html;charset=UTF-8'
      }
    })
  }
  
  // API endpoint to process name
  if (url.pathname === '/api/display-name' && request.method === 'POST') {
    try {
      const { name } = await request.json()
      
      if (!name || !name.trim()) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Name is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        })
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: `Hello, ${name.trim()}! 👋`,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      })
    }
  }
  
  // 404 for unknown routes
  return new Response('Not Found', { 
    status: 404,
    headers: corsHeaders
  })
}

function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Name Display App</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    
    h1 {
      color: #333;
      margin-bottom: 30px;
      font-size: 28px;
    }
    
    .input-group {
      margin-bottom: 20px;
    }
    
    input {
      width: 100%;
      padding: 15px;
      font-size: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      outline: none;
      transition: border-color 0.3s;
    }
    
    input:focus {
      border-color: #667eea;
    }
    
    button {
      width: 100%;
      padding: 15px;
      font-size: 18px;
      font-weight: bold;
      color: white;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    
    button:active {
      transform: translateY(0);
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    
    .message-div {
      margin-top: 30px;
      padding: 20px;
      border-radius: 10px;
      font-size: 20px;
      font-weight: bold;
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: scale(0.9);
      transition: opacity 0.3s, transform 0.3s;
    }
    
    .message-div.show {
      opacity: 1;
      transform: scale(1);
    }
    
    .message-div.success {
      background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
      color: #2c3e50;
    }
    
    .message-div.error {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    
    .footer {
      margin-top: 30px;
      font-size: 14px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>👋 Name Display App</h1>
    
    <div class="input-group">
      <input 
        type="text" 
        id="nameInput" 
        placeholder="Enter your name..." 
        autocomplete="off"
      >
    </div>
    
    <button id="displayButton">Show My Name</button>
    
    <div id="messageDiv" class="message-div"></div>
    
    <div class="footer">
      Powered by Cloudflare Workers ⚡
    </div>
  </div>
  
  <script>
    const nameInput = document.getElementById('nameInput');
    const displayButton = document.getElementById('displayButton');
    const messageDiv = document.getElementById('messageDiv');
    let timeoutId = null;
    
    // Handle Enter key
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        displayButton.click();
      }
    });
    
    displayButton.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      
      if (!name) {
        showMessage('Please enter your name!', 'error');
        return;
      }
      
      // Disable button during request
      displayButton.disabled = true;
      displayButton.textContent = 'Processing...';
      
      try {
        const response = await fetch('/api/display-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showMessage(data.message, 'success');
        } else {
          showMessage(data.error || 'Something went wrong!', 'error');
        }
      } catch (error) {
        showMessage('Network error! Please try again.', 'error');
      } finally {
        displayButton.disabled = false;
        displayButton.textContent = 'Show My Name';
      }
    });
    
    function showMessage(message, type) {
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Reset classes
      messageDiv.className = 'message-div';
      messageDiv.textContent = message;
      
      // Force reflow to restart animation
      void messageDiv.offsetWidth;
      
      // Show message with appropriate style
      messageDiv.classList.add('show', type);
      
      // Hide after 3 seconds
      timeoutId = setTimeout(() => {
        messageDiv.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>`
}
