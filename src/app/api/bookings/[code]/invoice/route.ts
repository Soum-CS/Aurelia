import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { db } from "@/lib/db";
import { formatDate, formatINR, nightsBetween } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/[code]/invoice — the authoritative invoice as a PDF,
 * generated server-side from the actual booking record (never from anything
 * the browser sent). Only confirmed bookings receive an invoice.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const booking = await db.booking.findUnique({
    where: { code: decodeURIComponent(code) },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "INVOICE_UNAVAILABLE", message: `This booking is ${booking.status}; no invoice is issued until it is confirmed.` },
      { status: 409 },
    );
  }

  // hotel contact block from the configured dataset when available
  let hotelAddress = "";
  let hotelPhone = "";
  try {
    const { getDatasetHotel } = await import("@/lib/hotels/csv-provider");
    const hotel = await getDatasetHotel(booking.providerBookingId ?? "");
    if (hotel) {
      hotelAddress = `${hotel.address}, ${hotel.city}, ${hotel.state}`;
      hotelPhone = hotel.phone_number;
    }
  } catch {
    /* dataset unavailable — fall back to recorded fields only */
  }

  const total = booking.totalInr ?? booking.total;
  const nights = nightsBetween(
    booking.checkIn.toISOString().slice(0, 10),
    booking.checkOut.toISOString().slice(0, 10),
  );
  const invoiceNo = `INV-${booking.code.replace("AUR-", "")}`;

  const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `${invoiceNo} · Aurelia` } });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  /* ── header ── */
  const W = doc.page.width - 112;
  doc.rect(0, 0, doc.page.width, 118).fill("#211b13");
  doc.fill("#c9a25e").font("Helvetica-Bold").fontSize(22).text("AURELIA", 56, 34, { characterSpacing: 6 });
  doc.fill("#efe7d8").font("Helvetica").fontSize(9)
    .text(hotelAddress || (booking.hotelName ?? "Aurelia partner hotel"), 56, 66, { width: W, lineGap: 2 });
  if (hotelPhone) doc.text(`Tel ${hotelPhone}`, 56, doc.y + 1);

  doc.fill("#2f4a38").roundedRect(W + 56 - 128, 34, 128, 26, 13).fill();
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(10)
    .text("TAX INVOICE", W + 56 - 128, 42, { width: 128, align: "center" });

  /* ── meta ── */
  let y = 148;
  doc.fill("#211b13");
  doc.font("Helvetica-Bold").fontSize(15).text(`${booking.hotelName}`, 56, y);
  y += 20;
  doc.font("Helvetica").fontSize(10).fill("#555555")
    .text(`${booking.roomName ?? "Room"} · Booking ${booking.code}`, 56, y);
  y += 14;
  doc.text(`Invoice ${invoiceNo} · Issued ${formatDate(booking.createdAt)}`, 56, y);

  /* ── guest & stay columns ── */
  y += 28;
  const colW = W / 2;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#a5763f")
    .text("BILLED TO", 56, y, { characterSpacing: 1.5 })
    .text("STAY DETAILS", 56 + colW, y, { characterSpacing: 1.5 });
  doc.fill("#211b13").font("Helvetica-Bold").fontSize(11)
    .text(booking.guestName, 56, y + 16);
  doc.font("Helvetica").fontSize(9.5).fill("#444444");
  let gy = y + 32;
  if (booking.guestEmail) { doc.text(booking.guestEmail, 56, gy); gy += 13; }
  if (booking.guestPhone) { doc.text(booking.guestPhone, 56, gy); gy += 13; }

  doc.text(`${formatDate(booking.checkIn)} → ${formatDate(booking.checkOut)}`, 56 + colW, y + 16);
  doc.fontSize(9.5).fill("#444444")
    .text(`${nights} night${nights === 1 ? "" : "s"} · ${booking.guests} guest${booking.guests === 1 ? "" : "s"} · ${booking.rooms} room${booking.rooms === 1 ? "" : "s"}`, 56 + colW, y + 33);

  y = Math.max(gy, y + 52) + 12;

  /* ── charges table ── */
  doc.rect(56, y, W, 24).fill("#f3ecdd");
  doc.fill("#6f6353").font("Helvetica-Bold").fontSize(8.5)
    .text("DESCRIPTION", 68, y + 8, { characterSpacing: 1.5 })
    .text("AMOUNT (INR)", 56 + W - 68, y + 8, { width: 60, align: "right", characterSpacing: 1.5 });
  y += 24;

  function line(label: string, amount: string) {
    doc.fill("#211b13").font("Helvetica").fontSize(10.5)
      .text(label, 68, y + 9, { width: W - 160 });
    doc.text(amount, 56 + W - 68, y + 9, { width: 60, align: "right" });
    doc.moveTo(56, y + 27).lineTo(56 + W, y + 27).strokeColor("#e6dcc9").lineWidth(0.75).stroke();
    y += 27;
  }

  line(
    `Accommodation · ${booking.rooms} room × ${nights} night${nights === 1 ? "" : "s"} (taxes included)`,
    formatINR(total),
  );

  /* ── total row ── */
  y += 6;
  doc.rect(56, y, W, 34).fill("#211b13");
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(11)
    .text("GRAND TOTAL", 68, y + 11, { characterSpacing: 1.5 });
  doc.fontSize(14)
    .text(formatINR(total), 56 + W - 168, y + 9, { width: 160, align: "right" });
  y += 50;

  /* ── payment ── */
  doc.roundedRect(56, y, W, 46, 8).fillAndStroke("#eef4ee", "#cfe0d2");
  doc.fill("#2f4a38").font("Helvetica-Bold").fontSize(10)
    .text(`Payment status: ${booking.paymentStatus === "PAID" ? "PAID" : booking.paymentStatus}`, 68, y + 9);
  doc.font("Helvetica").fontSize(9.5).fill("#44584a")
    .text("Method: Razorpay (secure server-verified payment)", 68, y + 23);
  if (booking.paymentId) {
    doc.font("Courier").fontSize(8.5)
      .text(`Payment ID: ${booking.paymentId}`, 68, y + 35);
  }
  y += 62;

  /* ── footer ── */
  doc.fill("#6f6353").font("Helvetica").fontSize(9)
    .text(
      "Thank you for choosing Aurelia. This invoice was generated from the verified payment record of your booking.",
      56, Math.max(y, doc.page.height - 120), { width: W, align: "center", lineGap: 3 },
    );
  doc.fill("#a5763f").font("Helvetica-Oblique").fontSize(9)
    .text("See your stay. Shape your stay. Live your stay.", 56, doc.y + 4, { width: W, align: "center" });

  doc.end();

  const pdf = await done;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aurelia-invoice-${invoiceNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
