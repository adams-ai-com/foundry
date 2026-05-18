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
    // Dev mode: log the link — check stdout or `journalctl -u foundry-workspace`
    console.log(`\n[MAGIC LINK] ${email}\n${url}\n`)
  }
}
