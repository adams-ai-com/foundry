async function makeTransport() {
  const { createTransport } = await import('nodemailer')
  return createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
}

const FROM = () => process.env.SMTP_FROM ?? 'noreply@foundry.local'

export async function sendMagicLink(email: string, url: string) {
  if (process.env.SMTP_HOST) {
    const t = await makeTransport()
    await t.sendMail({
      from: FROM(), to: email,
      subject: 'Sign in to OpenWork Loft',
      text: `Click to sign in:\n\n${url}\n\nExpires in 15 minutes.`,
      html: `<p>Click to sign in to OpenWork Loft:</p><p><a href="${url}">${url}</a></p><p>Expires in 15 minutes.</p>`,
    })
  } else {
    console.log(`\n[MAGIC LINK] ${email}\n${url}\n`)
  }
}

export async function sendInvite(
  email: string,
  inviteUrl: string,
  inviterEmail: string,
  role: string,
) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  if (process.env.SMTP_HOST) {
    const t = await makeTransport()
    await t.sendMail({
      from: FROM(), to: email,
      subject: `You've been invited to OpenWork Loft`,
      text: `${inviterEmail} has invited you to join OpenWork Loft as ${roleLabel}.\n\nAccept your invitation:\n${inviteUrl}\n\nThis link expires in 7 days.`,
      html: `<p>${inviterEmail} has invited you to join <strong>OpenWork Loft</strong> as <strong>${roleLabel}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    })
  } else {
    console.log(`\n[INVITE] ${email} (${role}) invited by ${inviterEmail}\n${inviteUrl}\n`)
  }
}

export async function sendEmailOTP(email: string, code: string) {
  const guardianUrl = process.env.GUARDIAN_URL
  const guardianSecret = process.env.GUARDIAN_FOUNDRY_SECRET

  if (guardianUrl && guardianSecret) {
    const { createHmac } = await import('crypto')
    const body = JSON.stringify({
      action: 'mailgun-send-foundry-otp',
      params: { recipient: email, code },
    })
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = createHmac('sha256', guardianSecret).update(`${ts}:${body}`).digest('hex')
    const res = await fetch(`${guardianUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Guardian-Signature': `${ts}:${sig}`,
        'X-Guardian-Caller': 'foundry_srv',
      },
      body,
    })
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Guardian OTP send failed: ${err}`)
    }
    return
  }

  // Fallback: log to stdout when Guardian is not configured
  const display = `${code.slice(0, 3)} ${code.slice(3)}`
  console.log(`\n[EMAIL OTP] ${email}\nCode: ${display}\n`)
}

export async function sendSecurityAlert(to: string, subject: string, body: string) {
  if (process.env.SMTP_HOST) {
    const t = await makeTransport()
    await t.sendMail({
      from: FROM(), to,
      subject,
      text: body,
      html: `<p style="font-family:sans-serif">${body.replace(/\n/g, '<br>')}</p>`,
    })
  } else {
    console.log(`\n[SECURITY ALERT] → ${to}\n${subject}\n${body}\n`)
  }
}
