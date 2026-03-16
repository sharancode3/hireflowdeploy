import type { GeneratedResume } from "../types";

type JsPdfCtor = typeof import("jspdf");

function safeText(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function addHeading(doc: any, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text, x, y);
  doc.setFont("helvetica", "normal");
}

function addParagraph(doc: any, text: string, x: number, y: number, maxWidth: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(10);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

export async function downloadGeneratedResumePdf(resume: GeneratedResume) {
  const s = resume.snapshot;

  const mod: JsPdfCtor = await import("jspdf");
  const jsPDF = mod.jsPDF;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 40;
  const marginY = 42;
  const maxWidth = pageWidth - marginX * 2;

  let y = marginY;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(safeText(s.fullName) || "Resume", marginX, y);
  y += 22;

  const headline = safeText(s.headline);
  if (headline) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(headline, marginX, y);
    y += 16;
  }

  const contactBits = [safeText(s.location), safeText(s.phone), safeText(s.desiredRole)].filter(Boolean);
  if (contactBits.length) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(contactBits.join("  •  "), marginX, y);
    doc.setTextColor(0);
    y += 16;
  }

  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  // Summary
  const about = safeText(s.about);
  if (about) {
    addHeading(doc, "Summary", marginX, y);
    y += 14;
    y = addParagraph(doc, about, marginX, y, maxWidth);
    y += 10;
  }

  // Skills
  const skills = (s.skills ?? []).map((x) => safeText(x)).filter(Boolean);
  if (skills.length) {
    addHeading(doc, "Skills", marginX, y);
    y += 14;
    y = addParagraph(doc, skills.join(", "), marginX, y, maxWidth);
    y += 10;
  }

  // Experience
  const experience = s.experience ?? [];
  if (experience.length) {
    addHeading(doc, "Experience", marginX, y);
    y += 14;
    doc.setFontSize(10);

    for (const it of experience) {
      const title = [safeText(it.title), safeText(it.company)].filter(Boolean).join(" — ");
      const dates = [safeText(it.startDate)?.slice(0, 10), safeText(it.endDate)?.slice(0, 10) || "Present"].filter(Boolean).join(" to ");
      const meta = [dates, safeText(it.location)].filter(Boolean).join("  •  ");

      doc.setFont("helvetica", "bold");
      doc.text(title || "(Role)", marginX, y);
      y += 12;

      doc.setFont("helvetica", "normal");
      if (meta) {
        doc.setTextColor(80);
        doc.text(meta, marginX, y);
        doc.setTextColor(0);
        y += 12;
      }

      const summary = safeText(it.summary);
      if (summary) {
        y = addParagraph(doc, summary, marginX, y, maxWidth);
        y += 8;
      } else {
        y += 6;
      }

      if (y > pageHeight - marginY - 80) {
        doc.addPage();
        y = marginY;
      }
    }

    y += 4;
  }

  // Education
  const education = s.education ?? [];
  if (education.length) {
    addHeading(doc, "Education", marginX, y);
    y += 14;

    for (const it of education) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(safeText(it.institution) || "(Institution)", marginX, y);
      y += 12;

      doc.setFont("helvetica", "normal");
      const line = [safeText(it.degree), safeText(it.fieldOfStudy)].filter(Boolean).join(" • ");
      const years = `${it.startYear} – ${it.endYear ?? "Present"}`;
      doc.setTextColor(80);
      doc.text([line, years].filter(Boolean).join("  •  ") || years, marginX, y);
      doc.setTextColor(0);
      y += 14;

      if (y > pageHeight - marginY - 80) {
        doc.addPage();
        y = marginY;
      }
    }

    y += 4;
  }

  // Projects
  const projects = s.projects ?? [];
  if (projects.length) {
    addHeading(doc, "Projects", marginX, y);
    y += 14;

    for (const it of projects) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(safeText(it.name) || "(Project)", marginX, y);
      y += 12;

      doc.setFont("helvetica", "normal");
      const summary = safeText(it.summary);
      if (summary) {
        y = addParagraph(doc, summary, marginX, y, maxWidth);
        y += 6;
      }

      const pSkills = (it.skills ?? []).map((x) => safeText(x)).filter(Boolean);
      if (pSkills.length) {
        doc.setTextColor(80);
        y = addParagraph(doc, `Tech: ${pSkills.join(", ")}`, marginX, y, maxWidth);
        doc.setTextColor(0);
        y += 6;
      }

      if (y > pageHeight - marginY - 80) {
        doc.addPage();
        y = marginY;
      }
    }
  }

  const fullName = safeText(s.fullName);
  const namePart = fullName
    ? fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .join("_")
    : "Resume";
  const fallbackTitle = (safeText(resume.title) || "Resume").replace(/[^a-z0-9\- _]/gi, "").trim() || "Resume";
  const filename = `${namePart || fallbackTitle}_Resume.pdf`;
  doc.save(filename);
}
