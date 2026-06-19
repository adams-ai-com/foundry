const FOUNDRY = 'https://foundry.adams-ai.com'

// ── Context menu setup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Right-click on a PDF link
  chrome.contextMenus.create({
    id: 'foundry-link',
    title: 'Edit in Foundry PDF',
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.pdf', '*://*/*.PDF', '*://*/*.pdf?*', '*://*/*.PDF?*'],
  })
  // Right-click on page when the page itself is a PDF
  chrome.contextMenus.create({
    id: 'foundry-page',
    title: 'Edit in Foundry PDF',
    contexts: ['page'],
    documentUrlPatterns: ['*://*/*.pdf', '*://*/*.PDF', '*://*/*.pdf?*', '*://*/*.PDF?*'],
  })
})

chrome.contextMenus.onClicked.addListener((info) => {
  const url = info.linkUrl || info.pageUrl
  if (url) uploadAndOpen(url)
})

// ── Message from content script ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'UPLOAD_URL') {
    uploadAndOpen(msg.url).then(sendResponse)
    return true
  }
  if (msg.type === 'CHECK_AUTH') {
    checkAuth().then(authed => sendResponse({ authed }))
    return true
  }
})

// ── Core helpers ──────────────────────────────────────────────────────────────

async function checkAuth() {
  try {
    const res = await fetch(`${FOUNDRY}/pdf/api/auth/me`, { credentials: 'include' })
    return res.ok
  } catch {
    return false
  }
}

async function uploadAndOpen(url) {
  try {
    const res = await fetch(`${FOUNDRY}/pdf/api/pdf/upload-from-url`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (res.status === 401) {
      // Not logged in — open Foundry login, they can retry after signing in
      chrome.tabs.create({ url: `${FOUNDRY}/login` })
      return { ok: false, error: 'not_authed' }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      return { ok: false, error: text }
    }

    const { jobId } = await res.json()
    chrome.tabs.create({ url: `${FOUNDRY}/pdf/editor/${jobId}` })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message ?? 'Network error' }
  }
}
