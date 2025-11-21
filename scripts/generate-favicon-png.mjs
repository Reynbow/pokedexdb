#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");
const SVG_PATH = join(ROOT_DIR, "public", "favicon.svg");
const PNG_PATH = join(ROOT_DIR, "public", "favicon-og.png");

// Size for Discord embed thumbnail (small square)
const SIZE = 128;

try {
  // Read the SVG
  const svgContent = await readFile(SVG_PATH, "utf8");
  
  // For a simple approach, we'll create an HTML file that renders the SVG to canvas
  // and then converts it to PNG. However, this requires a headless browser.
  // 
  // Alternative: Use sharp if available, or create a base64 data URL approach
  // 
  // For now, let's create a simple solution using a data URL approach
  // that can be used with a headless browser or sharp library
  
  console.log("Creating PNG from SVG...");
  console.log("Note: This script requires either:");
  console.log("  1. Install 'sharp' package: npm install --save-dev sharp");
  console.log("  2. Or use an online SVG to PNG converter");
  console.log("  3. Or manually create a 128x128 PNG from the SVG");
  
  // Check if sharp is available
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch (e) {
    console.log("\nSharp not found. Creating a simple base64 approach...");
    // Fallback: create instructions for manual conversion
    console.log("\nTo create the PNG manually:");
    console.log("1. Open favicon.svg in a browser or image editor");
    console.log("2. Export as PNG at 128x128 pixels");
    console.log("3. Save as public/favicon-og.png");
    process.exit(0);
  }
  
  // Convert SVG to PNG using sharp
  const buffer = await sharp(Buffer.from(svgContent))
    .resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  await writeFile(PNG_PATH, buffer);
  console.log(`✓ Created ${PNG_PATH} (${SIZE}x${SIZE}px)`);
  
} catch (error) {
  console.error("Error:", error.message);
  process.exitCode = 1;
}

