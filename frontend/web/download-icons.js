import fs from 'fs/promises';
import path from 'path';

const icons = [
  'file-description-icon', 'book-icon', 'clipboard-icon', 'radio-icon', 
  'camera-icon', 'code-icon', 'chart-bar-icon', 'chart-line-icon', 
  'logout-icon', 'gear-icon', 'user-icon', 'clock-icon', 'refresh-icon', 
  'save-icon', 'brain-circuit-icon', 'mail-filled-icon', 'bulb-svg', 
  'magnifier-icon'
];

async function downloadIcons() {
  const targetDir = path.join(process.cwd(), 'src', 'components', 'ui');
  await fs.mkdir(targetDir, { recursive: true });

  for (const icon of icons) {
    try {
      console.log(`Downloading ${icon}...`);
      const response = await fetch(`https://itshover.com/r/${icon}.json`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const content = data.files[0].content;
      
      const filePath = path.join(targetDir, `${icon}.jsx`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Saved ${icon}.jsx`);
    } catch (e) {
      console.error(`❌ Failed to download ${icon}:`, e.message);
    }
  }
}

downloadIcons();
