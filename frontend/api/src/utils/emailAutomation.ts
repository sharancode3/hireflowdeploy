import { env } from "../env";
import nodemailer from "nodemailer";

type EmailCategory =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_UPDATED"
  | "JOB_POSTED"
  | "APPLICATION_CONFIRMATION"
  | "DEADLINE_REMINDER"
  | "RESUME_SHARED";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  category: EmailCategory;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
};

function sanitize(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
  }

  smtpTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return smtpTransporter;
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  if (env.EMAIL_MODE === "disabled") return;

  const line = [
    "[hireflow-email]",
    `mode=${env.EMAIL_MODE}`,
    `category=${payload.category}`,
    `to=${sanitize(payload.to)}`,
    `from=${sanitize(env.EMAIL_FROM)}`,
    `subject=${sanitize(payload.subject)}`,
  ].join(" ");

  if (env.EMAIL_MODE === "smtp") {
    const transporter = getSmtpTransporter();
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });
    return;
  }

  console.log(line);
  console.log(payload.text);
  if (payload.html) {
    console.log(payload.html);
  }
}

function renderHireflowEmailTemplate(params: {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return [
    "<!doctype html>",
    "<html><body style='margin:0;background:#0A0A0F;color:#D0D0D0;font-family:Arial,sans-serif;'>",
    "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='padding:24px 0;'>",
    "<tr><td align='center'>",
    "<table role='presentation' width='620' cellpadding='0' cellspacing='0' style='max-width:620px;background:#12121A;border:1px solid #2A2A3A;border-radius:14px;overflow:hidden;'>",
    "<tr><td style='background:#111827;padding:18px 24px;'>",
    "<div style='font-size:20px;font-weight:700;color:#FFFFFF;'>Hireflow</div>",
    "</td></tr>",
    `<tr><td style='padding:22px 24px;'><h2 style='margin:0 0 12px;color:#FFFFFF;'>${params.title}</h2><p style='margin:0 0 20px;line-height:1.5;'>${params.body}</p><a href='${params.ctaHref}' style='display:inline-block;background:#1A73E8;color:#FFFFFF;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;'>${params.ctaLabel}</a></td></tr>`,
    "</table>",
    "</td></tr></table></body></html>",
  ].join("");
}

export async function sendApplicationConfirmationEmail(params: {
  to: string;
  applicantName: string;
  jobTitle: string;
  companyName: string;
  applicationsUrl: string;
}) {
  const body = `Hi ${params.applicantName}, your application for ${params.jobTitle} at ${params.companyName} has been submitted successfully.`;
  await sendTransactionalEmail({
    to: params.to,
    category: "APPLICATION_CONFIRMATION",
    subject: `Application received: ${params.jobTitle}`,
    text: `${body}\nTrack your application: ${params.applicationsUrl}`,
    html: renderHireflowEmailTemplate({
      title: "Application Submitted",
      body,
      ctaLabel: "Track Your Application",
      ctaHref: params.applicationsUrl,
    }),
  });
}

export async function sendDeadlineReminderEmail(params: {
  to: string;
  firstName: string;
  jobTitle: string;
  companyName: string;
  jobsUrl: string;
}) {
  const body = `${params.firstName}, a job you interacted with is nearing its deadline: ${params.jobTitle} at ${params.companyName}.`;
  await sendTransactionalEmail({
    to: params.to,
    category: "DEADLINE_REMINDER",
    subject: `Reminder: ${params.jobTitle} closes soon`,
    text: `${body}\nOpen job details: ${params.jobsUrl}`,
    html: renderHireflowEmailTemplate({
      title: "Deadline Reminder",
      body,
      ctaLabel: "View Job",
      ctaHref: params.jobsUrl,
    }),
  });
}

export async function sendResumeShareEmail(params: {
  to: string;
  senderName: string;
  resumeTitle: string;
  pdfBuffer: Buffer;
}) {
  const subject = `${params.senderName} shared a resume from Hireflow`;
  const body = `Hi,\n\n${params.senderName} shared a resume titled \"${params.resumeTitle}\" with you.\nPlease find the PDF attached.\n\nSent via Hireflow.`;
  await sendTransactionalEmail({
    to: params.to,
    category: "RESUME_SHARED",
    subject,
    text: body,
    html: renderHireflowEmailTemplate({
      title: "Resume Shared",
      body: `${params.senderName} shared a resume titled "${params.resumeTitle}" with you. The PDF is attached to this email.`,
      ctaLabel: "Open Hireflow",
      ctaHref: "https://hireflow.local",
    }),
    attachments: [
      {
        filename: `${params.resumeTitle || "Resume"}.pdf`,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
