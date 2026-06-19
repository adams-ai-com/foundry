const FOUNDRY = 'https://foundry.adams-ai.com'

const dot        = document.getElementById('dot')
const statusText = document.getElementById('status-text')
const loginBtn   = document.getElementById('login-btn')

chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (res) => {
  if (res?.authed) {
    dot.classList.replace('gray', 'green')
    statusText.textContent = 'Signed in to Foundry'
  } else {
    statusText.textContent = 'Not signed in'
    loginBtn.style.display = 'block'
  }
})
