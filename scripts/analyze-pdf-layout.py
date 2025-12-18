import sys
from PyPDF2 import PdfReader
from pdfrw import PdfReader as PdfRwReader, PdfWriter, PdfDict, PdfArray, PdfName
import json

def analyze_pdf(pdf_path):
    """Analyze PDF to find text positions"""
    reader = PdfReader(pdf_path)
    page = reader.pages[0]
    
    # Try to extract text with positions
    print("PDF Analysis:")
    print(f"Page size: {page.mediabox.width} x {page.mediabox.height}")
    print("\nText content:")
    print(page.extract_text())
    
    # Check for existing annotations
    if '/Annots' in page:
        print("\nExisting annotations found")
        annots = page['/Annots']
        if annots:
            print(f"Number of annotations: {len(annots)}")

if __name__ == '__main__':
    pdf_path = r'E:\GRITSYNC\public\USCIS Files\g-1145.pdf'
    analyze_pdf(pdf_path)







