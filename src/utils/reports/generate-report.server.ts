// Server-only helper: generate AI text + PDF for a report and upload to storage.
// Called from server functions (admin path) and from the Stripe webhook (paid path).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ChartRow {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  city: string;
  country: string;
  planets: unknown;
  ascendant: number | null;
  midheaven: number | null;
}

interface ProductRow {
  report_type: string;
  name: string;
  tagline: string;
  description: string;
  page_estimate: string;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

interface Section {
  heading: string;
  body: string;
}

function parseSections(markdown: string): Section[] {
  // Split on lines starting with "## " (h2). Keep everything before first h2 as intro.
  const lines = markdown.split(/\r?\n/);
  const sections: Section[] = [];
  let currentHeading = "Introduction";
  let buffer: string[] = [];
  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) sections.push({ heading: currentHeading, body });
    buffer = [];
  };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      flush();
      currentHeading = m[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections.length > 0 ? sections : [{ heading: "Report", body: markdown }];
}

async function buildPDF(
  reportName: string,
  subjectName: string,
  sections: Section[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const lineHeight = 14;
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const writeWrapped = (
    text: string,
    size: number,
    typeface: typeof font,
    color = rgb(0.1, 0.1, 0.15),
  ) => {
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const w = typeface.widthOfTextAtSize(test, size);
      if (w > maxWidth && line) {
        if (y < margin + lineHeight) {
          page = pdf.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(line, { x: margin, y, size, font: typeface, color });
        y -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      if (y < margin + lineHeight) {
        page = pdf.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(line, { x: margin, y, size, font: typeface, color });
      y -= lineHeight;
    }
  };

  // Cover page
  page.drawText("Cosmic Blueprint", {
    x: margin,
    y,
    size: 24,
    font: fontBold,
    color: rgb(0.35, 0.25, 0.7),
  });
  y -= 40;
  writeWrapped(reportName, 20, fontBold, rgb(0, 0, 0));
  y -= 10;
  writeWrapped(`Prepared for ${subjectName}`, 12, font, rgb(0.3, 0.3, 0.3));
  y -= 20;

  for (const section of sections) {
    y -= 20;
    if (y < margin + 60) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    writeWrapped(section.heading, 16, fontBold, rgb(0.2, 0.15, 0.4));
    y -= 6;
    // Split body into paragraphs
    for (const para of section.body.split(/\n\s*\n/)) {
      const cleaned = para.replace(/[#*_`>]/g, "").trim();
      if (!cleaned) continue;
      writeWrapped(cleaned, 11, font);
      y -= 6;
    }
  }

  return pdf.save();
}

/**
 * Generate the AI content + PDF for a pending report and persist them.
 * Marks the report status as 'completed' on success, 'failed' on error.
 */
export async function generateReportContent(reportId: string): Promise<void> {
  // 1) Load report + chart + product
  const { data: report, error: reportErr } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (reportErr || !report) throw new Error(`Report not found: ${reportId}`);

  const { data: chart, error: chartErr } = await supabaseAdmin
    .from("birth_charts")
    .select("*")
    .eq("id", report.chart_id)
    .single();
  if (chartErr || !chart) throw new Error(`Chart not found: ${report.chart_id}`);

  const { data: product, error: prodErr } = await supabaseAdmin
    .from("report_products")
    .select("*")
    .eq("report_type", report.report_type)
    .maybeSingle();
  if (prodErr || !product) throw new Error(`Product not found: ${report.report_type}`);

  const typedChart = chart as unknown as ChartRow;
  const typedProduct = product as unknown as ProductRow;

  try {
    // 2) Generate AI text
    const system =
      "You are a master astrologer writing in-depth, warm, and insightful personal astrology reports based on Swiss Ephemeris data. Use clear ## H2 section headings. Avoid disclaimers.";

    const planetsJson = JSON.stringify(typedChart.planets, null, 2);
    const userPrompt = `Write a detailed "${typedProduct.name}" (${typedProduct.tagline}) for ${typedChart.name}.

Birth: ${typedChart.birth_date} at ${typedChart.birth_time}, ${typedChart.city}, ${typedChart.country}.
Ascendant: ${typedChart.ascendant ?? "n/a"}°  Midheaven: ${typedChart.midheaven ?? "n/a"}°
Planetary positions (degrees of ecliptic longitude):
${planetsJson}

Report focus: ${typedProduct.description}

Structure the output with 6-10 ## H2 sections specific to a ${typedProduct.report_type} report. Each section should be 2-4 substantive paragraphs. Reference the actual planet positions and aspects above. Do not include a title — start directly with the first ## section.`;

    const markdown = await callAI(system, userPrompt);
    const sections = parseSections(markdown);

    // 3) Build PDF
    const pdfBytes = await buildPDF(typedProduct.name, typedChart.name, sections);

    // 4) Upload PDF to storage
    const storagePath = `${report.user_id}/${reportId}.pdf`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("report-pdfs")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

    // 5) Persist content + storage path + status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateErr } = await (supabaseAdmin as any)
      .from("reports")
      .update({
        content: { markdown, sections },
        storage_path: storagePath,
        status: "completed",
      })
      .eq("id", reportId);
    if (updateErr) throw new Error(`Report update failed: ${updateErr.message}`);
  } catch (err) {
    console.error("[generateReportContent] failed:", (err as Error).message);
    await supabaseAdmin
      .from("reports")
      .update({ status: "failed" })
      .eq("id", reportId);
    throw err;
  }
}
