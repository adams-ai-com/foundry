// Inject the "Edit in Foundry" banner when the browser is rendering a PDF directly.
// This fires when the tab's content-type is application/pdf (Chrome PDF viewer)
// or when the page is a bare .pdf URL with no HTML body.
;(function () {
  const isPdfPage =
    document.contentType === 'application/pdf' ||
    (/\.pdf(\?.*)?$/i.test(location.href) && document.body && document.body.children.length === 0)

  if (!isPdfPage) return

  // Avoid injecting twice
  if (document.getElementById('foundry-pdf-bar')) return

  const bar = document.createElement('div')
  bar.id = 'foundry-pdf-bar'
  bar.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:2147483647',
    'background:#111827', 'color:#f9fafb',
    'padding:10px 20px',
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-size:13px', 'line-height:1',
    'box-shadow:0 2px 8px rgba(0,0,0,.4)',
    'gap:12px',
  ].join(';')

  bar.innerHTML = `
    <span style="font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:11px;color:#9ca3af">Foundry PDF</span>
    <span style="color:#d1d5db;flex:1;padding:0 8px">Want to edit this PDF?</span>
    <button id="foundry-edit-btn" style="
      background:#3b82f6;color:#fff;border:none;border-radius:6px;
      padding:7px 18px;font-size:13px;font-weight:600;cursor:pointer;
      white-space:nowrap;transition:opacity .15s
    ">Edit in Foundry</button>
    <button id="foundry-close-btn" style="
      background:none;border:none;color:#6b7280;cursor:pointer;
      font-size:20px;line-height:1;padding:0 4px;flex-shrink:0
    " title="Dismiss">×</button>
  `

  // Insert before body content (Chrome PDF viewer has a thin body)
  document.documentElement.insertBefore(bar, document.body)

  const editBtn = document.getElementById('foundry-edit-btn')
  const closeBtn = document.getElementById('foundry-close-btn')

  closeBtn.addEventListener('click', () => bar.remove())

  editBtn.addEventListener('click', async () => {
    editBtn.textContent = 'Opening…'
    editBtn.disabled = true
    editBtn.style.opacity = '.6'

    chrome.runtime.sendMessage({ type: 'UPLOAD_URL', url: location.href }, (res) => {
      if (chrome.runtime.lastError || !res) {
        editBtn.textContent = 'Error — try again'
        editBtn.disabled = false
        editBtn.style.opacity = '1'
        return
      }
      if (res.error === 'not_authed') {
        editBtn.textContent = 'Sign in to Foundry'
        editBtn.disabled = false
        editBtn.style.opacity = '1'
        editBtn.onclick = () => chrome.runtime.sendMessage({ type: 'UPLOAD_URL', url: location.href })
        return
      }
      if (!res.ok) {
        editBtn.textContent = 'Failed — try again'
        editBtn.disabled = false
        editBtn.style.opacity = '1'
        return
      }
      // Success — editor opened in new tab
      editBtn.textContent = 'Opened ✓'
    })
  })
})()
