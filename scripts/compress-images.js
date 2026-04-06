/**
 * 压缩项目中的大图，目标单张 < 200KB，尺寸过大的等比缩小
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const TARGET_MAX_KB = 200;
const TARGET_MAX_BYTES = TARGET_MAX_KB * 1024;
const MAX_WIDTH = 280; // 保证单张 < 200KB（图标类）

const files = [
  'images/gaming-icon.png',
  'images/secondhand-icon.png',
  'images/express-icon.png',
  'subpackages/store/images/wechat-pay-qrcode.png'
];

const root = path.join(__dirname, '..');

async function compress(fileRel) {
  const abs = path.join(root, fileRel);
  if (!fs.existsSync(abs)) {
    console.log('Skip (not found):', fileRel);
    return;
  }
  const stat = fs.statSync(abs);
  if (stat.size <= TARGET_MAX_BYTES) {
    console.log('Skip (already small):', fileRel, (stat.size / 1024).toFixed(1), 'KB');
    return;
  }
  try {
    let pipeline = sharp(abs);
    const meta = await pipeline.metadata();
    let width = meta.width;
    if (width > MAX_WIDTH) width = MAX_WIDTH;
    pipeline = sharp(abs).resize(width, null, { withoutEnlargement: true });
    const out = await pipeline
      .png({ compressionLevel: 9 })
      .toBuffer();
    if (out.length < stat.size) {
      fs.writeFileSync(abs, out);
      console.log('OK:', fileRel, (stat.size / 1024).toFixed(1), '->', (out.length / 1024).toFixed(1), 'KB');
    } else {
      console.log('No gain:', fileRel);
    }
  } catch (err) {
    console.error('Error', fileRel, err.message);
  }
}

(async () => {
  for (const f of files) await compress(f);
})();
