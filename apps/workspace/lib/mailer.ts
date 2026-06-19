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
      subject: 'Sign in to Foundry',
      text: `Click to sign in:\n\n${url}\n\nExpires in 15 minutes.`,
      html: `<p>Click to sign in to Foundry:</p><p><a href="${url}">${url}</a></p><p>Expires in 15 minutes.</p>`,
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
      subject: `You've been invited to Foundry`,
      text: `${inviterEmail} has invited you to join Foundry as ${roleLabel}.\n\nAccept your invitation:\n${inviteUrl}\n\nThis link expires in 7 days.`,
      html: `<p>${inviterEmail} has invited you to join <strong>Foundry</strong> as <strong>${roleLabel}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    })
  } else {
    console.log(`\n[INVITE] ${email} (${role}) invited by ${inviterEmail}\n${inviteUrl}\n`)
  }
}

export async function sendEmailOTP(email: string, code: string) {
  const display = `${code.slice(0, 3)} ${code.slice(3)}`
  if (process.env.SMTP_HOST) {
    const t = await makeTransport()
    await t.sendMail({
      from: FROM(), to: email,
      subject: `${display} — Your Foundry sign-in code`,
      text: `Your Foundry sign-in code is: ${display}\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`,
      html: `<p style="font-family:sans-serif">Your Foundry sign-in code is:</p><p style="font-family:monospace;font-size:32px;letter-spacing:8px;font-weight:bold">${display}</p><p style="font-family:sans-serif;color:#666">This code expires in 10 minutes. If you did not request this, ignore this email.</p>`,
    })
  } else {
    console.log(`\n[EMAIL OTP] ${email}\nCode: ${display}\n`)
  }
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
