/** Draw the signal share card onto a canvas and return a PNG blob. */
export interface ShareCardData {
  handle: string;
  token: string;
  direction: string;
  entry: string;
  target: string;
  stop: string;
  thesis: string;
  signalId: string;
}

export function signalUrl(signalId: string): string {
  return `https://veritasalpha.xyz/?s=${signalId}`;
}

/** Generate a PNG image of the signal card (for Web Share API / download). */
export async function generateShareImage(data: ShareCardData): Promise<Blob | null> {
  try {
    const W = 600, H = 380, DPR = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(DPR, DPR);

    const ink = "#11110f";
    const paper = "#faf9f5";
    const signal = "#d4f75a";
    const muted = "rgba(244,242,234,0.5)";
    const line = "rgba(244,242,234,0.12)";
    const isLong = data.direction === "LONG";

    // Background
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, W, H);

    // Grid texture
    ctx.strokeStyle = "rgba(244,242,234,0.07)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Checkmark + VERITAS brand
    ctx.fillStyle = signal;
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("✓", 26, 46);
    ctx.fillStyle = paper;
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.letterSpacing = "0.14em";
    ctx.fillText("VERITAS", 44, 46);
    ctx.letterSpacing = "0";

    // Direction badge
    const badgeW = 60, badgeH = 22, badgeX = W - badgeW - 26, badgeY = 28;
    ctx.fillStyle = isLong ? "rgba(212,247,90,0.18)" : "rgba(194,59,34,0.18)";
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    ctx.strokeStyle = isLong ? "rgba(212,247,90,0.45)" : "rgba(194,59,34,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);
    ctx.fillStyle = isLong ? signal : "#ff7b65";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.direction, badgeX + badgeW / 2, badgeY + 15);
    ctx.textAlign = "left";

    // Big token text
    ctx.fillStyle = paper;
    ctx.font = "bold 64px Arial, sans-serif";
    ctx.fillText(`$${data.token}`, 26, 130);

    // Divider
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(26, 148); ctx.lineTo(W - 26, 148); ctx.stroke();

    // Price levels
    const cols = [
      { k: "ENTRY", v: data.entry, color: paper, x: 26 },
      { k: "TARGET ↑", v: data.target, color: signal, x: 220 },
      { k: "STOP ↓", v: data.stop, color: "#ff7b65", x: 414 },
    ];
    for (const col of cols) {
      ctx.fillStyle = muted;
      ctx.font = "10px monospace";
      ctx.fillText(col.k, col.x, 172);
      ctx.fillStyle = col.color;
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.fillText(col.v.slice(0, 10), col.x, 200);
    }

    // Divider 2
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(26, 220); ctx.lineTo(W - 26, 220); ctx.stroke();

    // Thesis (if any)
    if (data.thesis) {
      ctx.fillStyle = "rgba(244,242,234,0.72)";
      ctx.font = "italic 13px Arial, sans-serif";
      const t = data.thesis.length > 72 ? data.thesis.slice(0, 72) + "…" : data.thesis;
      ctx.fillText(`"${t}"`, 26, 248);
    }

    // Bottom divider
    ctx.strokeStyle = line;
    ctx.beginPath(); ctx.moveTo(26, 340); ctx.lineTo(W - 26, 340); ctx.stroke();

    // Handle + footer
    ctx.fillStyle = paper;
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillText(`@${data.handle || "anon"}`, 26, 363);
    ctx.fillStyle = "rgba(244,242,234,0.4)";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText("SEALED ON SUI × WALRUS · veritasalpha.xyz", W - 26, 363);
    ctx.textAlign = "left";

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
  } catch {
    return null;
  }
}

/** Build the share text for a signal. */
export function buildShareText(data: ShareCardData): string {
  const url = signalUrl(data.signalId);
  return [
    `$${data.token} ${data.direction} call — sealed on Veritas 🔐`,
    ``,
    `Entry: $${data.entry}`,
    `Target: $${data.target}  ·  Stop: $${data.stop}`,
    data.thesis ? `"${data.thesis}"` : "",
    ``,
    `Cryptographically sealed on Sui × Walrus.`,
    `Can't edit. Can't delete. Verify it yourself 👇`,
    url,
    ``,
    `#Veritas #Sui #DeFi #Walrus`,
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}

/** Native Web Share → falls back to Twitter intent. */
export async function nativeShare(data: ShareCardData): Promise<void> {
  const url = signalUrl(data.signalId);
  const text = buildShareText(data);
  const title = `$${data.token} ${data.direction} — Veritas`;

  if (typeof navigator.share === "function") {
    try {
      const blob = await generateShareImage(data);
      const sharePayload: ShareData = { title, text, url };
      if (
        blob &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File([blob], "veritas-call.png", { type: "image/png" })] })
      ) {
        sharePayload.files = [new File([blob], "veritas-call.png", { type: "image/png" })];
      }
      await navigator.share(sharePayload);
      return;
    } catch {
      // User cancelled or share failed — fall through to Twitter
    }
  }

  // Desktop / fallback: open Twitter intent
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(tweetUrl, "_blank", "noopener,noreferrer");
}
