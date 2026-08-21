const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { ImageAnnotatorClient } = require("@google-cloud/vision");
const admin = require("firebase-admin");

admin.initializeApp();

const visionClient = new ImageAnnotatorClient();

function parseNumber(s) {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 1000) / 1000;
}

function classifyLine(line) {
  const l = line.trim();
  if (!l) return null;
  if (/^\d+[.,]\d{1,2}$/.test(l)) return { type: "price", value: parseNumber(l) };
  if (/^\d+\s+unitats?\s+x$/i.test(l)) return { type: "qty_line", quantity: parseInt(l) };
  if (/^unitats?\s+x$/i.test(l)) return { type: "unit_line" };
  if (/^\+/.test(l)) return { type: "product", name: l.replace(/^\+\s*/, "").trim() };
  if (/^-/.test(l)) return { type: "skip" };
  const low = l.toLowerCase();
  const skipPatterns = [
    /^total\b/i, /^subtotal/i, /^canvi$/i, /^pagament/i, /^efectiu/i,
    /^targetes?$/i, /^visa/i, /^mastercard/i, /^iva\b/i, /^descompte/i,
    /^data$/i, /^hora$/i, /^caixa/i, /^rebut/i, /^factura/i, /^resum/i,
    /^persona/i, /^caixer/i, /^compte/i, /^codi/i, /^descripci/i,
    /^preu$/i, /^quantitat/i, /^import/i, /^imatge/i, /^producte/i,
    /^diners/i, /^credit/i, /^debit/i, /^bizum/i, /^oferta/i,
    /^bonificacio/i, /^impost/i, /^recarrec/i, /^compres/i, /^compra/i,
    /^supermercat/i, /^botiga/i, /^client/i, /^gràcies/i, /^gracias/i,
    /^reclamacions/i, /^atenció/i, /^informaci/i, /^servei/i,
    /^desglossament/i, /^articles/i, /^acumulat/i, /^detall/i,
    /^moviments/i, /^euros/i, /^bon dia/i, /^total acumulat/i,
    /^en aquest/i, /^la compra/i, /^targeta client/i, /^total d/i,
    /^articles\s*=/i, /^base$/i, /^núm/i, /^secció/i, /^barr/i
  ];
  for (const p of skipPatterns) { if (p.test(l)) return { type: "skip" }; }
  if (l.includes("€") || /\/u$/i.test(l)) return { type: "skip" };
  if (/^\d+$/.test(l)) return { type: "standalone_num", value: parseInt(l) };
  const letters = (l.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letters < 3) return { type: "skip" };
  if (letters < l.length * 0.75) return { type: "skip" };
  return { type: "product", name: l };
}

function parseReceiptText(text) {
  const lines = text.split("\n").map((l) => l.replace(/\s{2,}/g, " ").trim()).filter(Boolean);
  const classified = lines.map((l) => classifyLine(l)).filter(Boolean);

  for (let i = 0; i < classified.length - 1; i++) {
    if (classified[i].type === "standalone_num" && classified[i + 1].type === "product") {
      classified[i] = { type: "qty_for_next", quantity: classified[i].value };
    }
  }

  const products = [];
  const orphanPrices = [];
  let pendingQty = null;
  let skipNextPrice = false;

  for (const c of classified) {
    if (skipNextPrice && c.type === "price") {
      skipNextPrice = false;
      continue;
    }
    skipNextPrice = false;

    if (c.type === "product") {
      products.push({ name: c.name, quantity: pendingQty, unit: "u", price: null });
      pendingQty = null;
    } else if (c.type === "qty_for_next") {
      pendingQty = c.quantity;
    } else if (c.type === "qty_line") {
      if (products.length > 0) products[products.length - 1].quantity = c.quantity;
      skipNextPrice = true;
    } else if (c.type === "unit_line") {
      skipNextPrice = true;
    } else if (c.type === "standalone_num") {
      if (products.length > 0 && products[products.length - 1].quantity == null) {
        products[products.length - 1].quantity = c.value;
      }
    } else if (c.type === "price") {
      if (products.length > 0 && products[products.length - 1].price == null) {
        products[products.length - 1].price = c.value;
      } else {
        orphanPrices.push(c.value);
      }
    }
  }

  if (orphanPrices.length > 0) {
    let pi = 0;
    for (const p of products) {
      if (p.price == null && pi < orphanPrices.length) {
        p.price = orphanPrices[pi++];
      }
    }
  }

  return products.filter((p) => p.price != null).map((p) => ({ ...p, quantity: p.quantity || 1 }));
}

exports.scanReceipt = onCall({ memory: "512MiB", timeoutSeconds: 120 }, async (request) => {
  const { image } = request.data;
  if (!image) {
    throw new HttpsError("invalid-argument", "No image provided");
  }

  try {
    const base64 = image.replace(/^data:image\/\w+;base64,/, "");

    const [result] = await visionClient.textDetection({
      image: { content: base64 },
    });

    const text = result.textAnnotations?.[0]?.description || "";
    if (!text.trim()) {
      return { text: "", items: [] };
    }

    const items = parseReceiptText(text);
    return { text, items };
  } catch (err) {
    console.error("scanReceipt error:", err.message || err);
    if (err.details) console.error("details:", JSON.stringify(err.details));
    throw new HttpsError("internal", "Failed to process receipt", { detail: err.message });
  }
});

exports.identifyFood = onCall({ memory: "512MiB", timeoutSeconds: 60 }, async (request) => {
  const { image } = request.data;
  if (!image) {
    throw new HttpsError("invalid-argument", "No image provided");
  }

  try {
    const base64 = image.replace(/^data:image\/\w+;base64,/, "");

    const [labelResult, textResult] = await Promise.all([
      visionClient.labelDetection({ image: { content: base64 } }),
      visionClient.textDetection({ image: { content: base64 } })
    ]);

    const labels = (labelResult[0].labelAnnotations || [])
      .map((l) => ({ description: l.description, score: l.score }))
      .filter((l) => l.score >= 0.5);

    const rawText = textResult[0].textAnnotations?.[0]?.description || "";

    return { labels, rawText };
  } catch (err) {
    console.error("identifyFood error:", err.message || err);
    throw new HttpsError("internal", "Failed to identify food", { detail: err.message });
  }
});
