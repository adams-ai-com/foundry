export async function sendMagicLink(email: string, url: string) {
  if (process.env.SMTP_HOST) {
    const { createTransport } = await import('nodemailer')
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@foundry.local',
      to: email,
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
    const { createTransport } = await import('nodemailer')
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@foundry.local',
      to: email,
      subject: `You've been invited to Foundry`,
      text: `${inviterEmail} has invited you to join Foundry as ${roleLabel}.\n\nAccept your invitation:\n${inviteUrl}\n\nThis link expires in 7 days.`,
      html: `<p>${inviterEmail} has invited you to join <strong>Foundry</strong> as <strong>${roleLabel}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    })
  } else {
    console.log(`\n[INVITE] ${email} (${role}) invited by ${inviterEmail}\n${inviteUrl}\n`)
  }
}
