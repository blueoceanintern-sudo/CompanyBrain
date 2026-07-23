import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.SMTP_FROM ?? 'Company\'s Brain <noreply@companybrain.io>'
const LOGIN_URL = `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/login`

function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{{${k}}}`, v),
    template
  )
}

async function loadTemplate(name: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../email-templates/${name}.html`).text()
}

export async function sendOrgAdminWelcome(params: {
  to: string
  name: string
  orgName: string
  temporaryPassword: string
}): Promise<void> {
  const template = await loadTemplate('org-admin-welcome')
  const html = fillTemplate(template, {
    name: params.name,
    email: params.to,
    orgName: params.orgName,
    temporaryPassword: params.temporaryPassword,
    loginUrl: LOGIN_URL,
  })

  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: `You're the new admin for ${params.orgName} on Company's Brain`,
    html,
  })
}

export async function sendUserInvite(params: {
  to: string
  name: string
  orgName: string
  temporaryPassword: string
}): Promise<void> {
  const template = await loadTemplate('user-invite')
  const html = fillTemplate(template, {
    name: params.name,
    email: params.to,
    orgName: params.orgName,
    temporaryPassword: params.temporaryPassword,
    loginUrl: LOGIN_URL,
  })

  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: `You've been added to ${params.orgName}'s knowledge base`,
    html,
  })
}

export async function sendPasswordReset(params: {
  to: string
  resetUrl: string
}): Promise<void> {
  const template = await loadTemplate('password-reset')
  const html = fillTemplate(template, {
    resetUrl: params.resetUrl,
  })

  await transporter.sendMail({
    from: FROM,
    to: params.to,
    subject: `Reset your Company's Brain password`,
    html,
  })
}
