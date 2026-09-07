const fs = require('fs');
const path = require('path');

// Try to use Jimp to pad the image
try {
  const Jimp = require('jimp-compact');
  
  async function padImage() {
    const logoPath = path.join(__dirname, '../assets/images/mako-logo.png');
    const outPath = path.join(__dirname, '../assets/images/icon-padded.png');
    
    // Read the logo
    const logo = await Jimp.read(logoPath);
    
    // Scale logo to fit comfortably in 1024x1024 (e.g., 600x600 max)
    logo.scaleToFit(600, 600);
    
    // Create a new 1024x1024 transparent image
    const background = await new Jimp(1024, 1024, 0x00000000);
    
    // Composite the logo onto the center of the background
    const x = (1024 - logo.bitmap.width) / 2;
    const y = (1024 - logo.bitmap.height) / 2;
    
    background.composite(logo, x, y);
    
    // Write the output
    await background.writeAsync(outPath);
    console.log('Successfully created padded icon at', outPath);
  }
  
  padImage().catch(err => {
    console.error('Error padding image:', err);
    process.exit(1);
  });
} catch (e) {
  console.log('jimp-compact not found, trying other methods...');
  process.exit(1);
}
