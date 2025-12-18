import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function makeG1145Fillable() {
  try {
    // Read the existing PDF
    const pdfPath = path.join(__dirname, '../public/USCIS Files/g-1145.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    // Create a form
    const form = pdfDoc.getForm();
    
    // Field positions (estimated based on typical USCIS form layout)
    // Y coordinates are from bottom of page in PDF coordinate system
    // X coordinates are from left
    
    // Row 1: Last Name, First Name, Middle Name
    // These appear to be in a table row near the bottom
    const row1Y = height - 200; // Approximate Y position for first row
    const lastNameX = 50;
    const firstNameX = 200;
    const middleNameX = 350;
    const fieldWidth = 130;
    const fieldHeight = 20;
    
    // Last Name field
    const lastNameField = form.createTextField('lastName');
    lastNameField.setText('');
    lastNameField.addToPage(firstPage, {
      x: lastNameX,
      y: row1Y,
      width: fieldWidth,
      height: fieldHeight,
    });
    
    // First Name field
    const firstNameField = form.createTextField('firstName');
    firstNameField.setText('');
    firstNameField.addToPage(firstPage, {
      x: firstNameX,
      y: row1Y,
      width: fieldWidth,
      height: fieldHeight,
    });
    
    // Middle Name field
    const middleNameField = form.createTextField('middleName');
    middleNameField.setText('');
    middleNameField.addToPage(firstPage, {
      x: middleNameX,
      y: row1Y,
      width: fieldWidth,
      height: fieldHeight,
    });
    
    // Row 2: Email Address and Mobile Phone Number
    const row2Y = row1Y - 30; // Second row below first
    
    // Email Address field (spans wider)
    const emailField = form.createTextField('emailAddress');
    emailField.setText('');
    emailField.addToPage(firstPage, {
      x: lastNameX,
      y: row2Y,
      width: fieldWidth * 1.5,
      height: fieldHeight,
    });
    
    // Mobile Phone Number field
    const phoneField = form.createTextField('mobilePhoneNumber');
    phoneField.setText('');
    phoneField.addToPage(firstPage, {
      x: firstNameX + 50,
      y: row2Y,
      width: fieldWidth,
      height: fieldHeight,
    });
    
    // Save the PDF
    const modifiedPdfBytes = await pdfDoc.save();
    const outputPath = path.join(__dirname, '../public/USCIS Files/g-1145-fillable.pdf');
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    console.log('Successfully created fillable PDF at:', outputPath);
    console.log('Form fields added:');
    console.log('  - Last Name');
    console.log('  - First Name');
    console.log('  - Middle Name');
    console.log('  - Email Address');
    console.log('  - Mobile Phone Number');
    
  } catch (error) {
    console.error('Error creating fillable PDF:', error);
    throw error;
  }
}

makeG1145Fillable().catch(console.error);

