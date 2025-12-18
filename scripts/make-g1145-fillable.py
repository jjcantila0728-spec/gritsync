#!/usr/bin/env python3
"""
Script to make G-1145 PDF fillable by adding form fields.
"""

from pdfrw import PdfReader, PdfWriter, PdfDict, PdfArray, PdfName, PdfString, IndirectPdfDict
import sys
import os

def create_text_field(name, x, y, width, height, page):
    """Create a text field annotation"""
    # PDF coordinates: bottom-left is (0,0), top-right is (width, height)
    # y coordinate needs to be from bottom
    rect = PdfArray([x, y, x + width, y + height])
    
    field = IndirectPdfDict(
        Type=PdfName('Annot'),
        Subtype=PdfName('Widget'),
        FT=PdfName('Tx'),  # Text field
        T=PdfString(name),
        Rect=rect,
        F=4,  # Print flag
        Ff=0,  # Field flags (0 = editable)
        V=PdfString(''),  # Default value
        DA=PdfString('/Helv 10 Tf 0 g'),  # Default appearance
    )
    
    # Border style
    field.BS = PdfDict(
        Type=PdfName('Border'),
        W=1,  # Border width
        S=PdfName('S'),  # Solid border
    )
    
    # Border color (black)
    field.BC = PdfArray([0, 0, 0])
    
    # Set parent page
    field.P = page
    
    return field

def make_g1145_fillable():
    """Add fillable form fields to G-1145 PDF"""
    
    input_path = r'E:\GRITSYNC\public\USCIS Files\g-1145.pdf'
    output_path = r'E:\GRITSYNC\public\USCIS Files\g-1145-fillable.pdf'
    
    # Read the PDF
    reader = PdfReader(input_path)
    
    if len(reader.pages) == 0:
        print("Error: PDF has no pages")
        return False
    
    page = reader.pages[0]
    
    # Get page dimensions
    mediabox = page.MediaBox or page.CropBox
    page_width = float(mediabox[2])
    page_height = float(mediabox[3])
    
    print(f"Page dimensions: {page_width} x {page_height}")
    
    # Field positions (estimated based on form layout)
    # Y coordinates are from bottom of page
    # Based on typical USCIS form layout, fields appear near bottom
    
    # First row: Last Name, First Name, Middle Name
    # These are in a table row, approximately at y=200 from bottom
    row1_y = 200
    field_height = 18
    field_width = 130
    
    last_name_x = 50
    first_name_x = 200
    middle_name_x = 350
    
    # Second row: Email Address, Mobile Phone Number
    row2_y = row1_y - 30
    
    email_x = 50
    email_width = 200
    
    phone_x = 280
    phone_width = 200
    
    # Create form fields
    fields = []
    
    # Last Name
    fields.append(create_text_field(
        'lastName',
        last_name_x,
        row1_y,
        field_width,
        field_height,
        page
    ))
    
    # First Name
    fields.append(create_text_field(
        'firstName',
        first_name_x,
        row1_y,
        field_width,
        field_height,
        page
    ))
    
    # Middle Name
    fields.append(create_text_field(
        'middleName',
        middle_name_x,
        row1_y,
        field_width,
        field_height,
        page
    ))
    
    # Email Address
    fields.append(create_text_field(
        'emailAddress',
        email_x,
        row2_y,
        email_width,
        field_height,
        page
    ))
    
    # Mobile Phone Number
    fields.append(create_text_field(
        'mobilePhoneNumber',
        phone_x,
        row2_y,
        phone_width,
        field_height,
        page
    ))
    
    # Add fields to page annotations
    if page.Annots is None:
        page.Annots = PdfArray()
    else:
        # Ensure it's a PdfArray
        if not isinstance(page.Annots, PdfArray):
            annots_list = list(page.Annots) if hasattr(page.Annots, '__iter__') else []
            page.Annots = PdfArray(annots_list)
    
    # Add new fields to annotations
    for field in fields:
        page.Annots.append(field)
    
    # Create or update AcroForm dictionary
    if reader.Root.AcroForm is None:
        reader.Root.AcroForm = IndirectPdfDict(
            Fields=PdfArray(),
            NeedAppearances=PdfName('true'),
            DA=PdfString('/Helv 10 Tf 0 g'),
        )
    else:
        # Ensure Fields array exists
        if reader.Root.AcroForm.Fields is None:
            reader.Root.AcroForm.Fields = PdfArray()
        elif not isinstance(reader.Root.AcroForm.Fields, PdfArray):
            fields_list = list(reader.Root.AcroForm.Fields) if hasattr(reader.Root.AcroForm.Fields, '__iter__') else []
            reader.Root.AcroForm.Fields = PdfArray(fields_list)
    
    # Add fields to AcroForm
    for field in fields:
        reader.Root.AcroForm.Fields.append(field)
    
    # Write the modified PDF
    writer = PdfWriter()
    writer.write(output_path, reader)
    
    print(f"\nSuccessfully created fillable PDF at: {output_path}")
    print("\nForm fields added:")
    print("  - Last Name")
    print("  - First Name")
    print("  - Middle Name")
    print("  - Email Address")
    print("  - Mobile Phone Number")
    
    return True

if __name__ == '__main__':
    try:
        success = make_g1145_fillable()
        if not success:
            sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

