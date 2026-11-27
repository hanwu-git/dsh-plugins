# -*- coding: utf-8 -*-
"""Inspect a DOCX and dump a full format baseline (styles, defaults, page setup, numbering)."""
import sys
from docx import Document
from docx.shared import Pt

path = sys.argv[1]
doc = Document(path)

def fmt_font(f):
    if f is None:
        return None
    east = None
    rpr = getattr(getattr(f, "_element", None), "rPr", None) if f is not None else None
    rf = getattr(rpr, "rFonts", None)
    if rf is not None:
        east = rf.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia")
    spacing = None
    if rpr is not None and getattr(rpr, "spacing", None) is not None:
        spacing = rpr.spacing.val
    return {
        "name_ascii": f.name,
        "name_eastAsia": east,
        "size_pt": f.size.pt if f.size else None,
        "bold": f.bold,
        "italic": f.italic,
        "color": f.color.rgb if (f.color and f.color.rgb) else None,
        "underline": f.underline,
        "strike": f.strike,
        "highlight": f.highlight_color,
        "spacing": spacing,
    }

def fmt_para(p):
    pf = p.paragraph_format
    return {
        "style": p.style.name if p.style else None,
        "alignment": str(pf.alignment) if pf.alignment is not None else None,
        "first_line_indent_pt": pf.first_line_indent.pt if pf.first_line_indent else None,
        "left_indent_pt": pf.left_indent.pt if pf.left_indent else None,
        "right_indent_pt": pf.right_indent.pt if pf.right_indent else None,
        "line_spacing": pf.line_spacing,
        "line_rule": pf.line_spacing_rule,
        "space_before_pt": pf.space_before.pt if pf.space_before else None,
        "space_after_pt": pf.space_after.pt if pf.space_after else None,
        "keep_with_next": pf.keep_with_next,
    }

print("=" * 80)
print("DOCUMENT DEFAULTS (docDefaults)")
print("=" * 80)
styles_el = doc.styles.element
docDefaults = styles_el.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}docDefaults")
if docDefaults is not None:
    rPrDefault = docDefaults.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPrDefault")
    if rPrDefault is not None:
        rPr = rPrDefault.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr")
        if rPr is not None:
            import lxml.etree as etree
            print(etree.tostring(rPr, pretty_print=True).decode("utf-8"))
    pPrDefault = docDefaults.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPrDefault")
    if pPrDefault is not None:
        pPr = pPrDefault.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr")
        if pPr is not None:
            import lxml.etree as etree
            print(etree.tostring(pPr, pretty_print=True).decode("utf-8"))

print()
print("=" * 80)
print("STYLE DEFINITIONS (paragraph styles in use / common)")
print("=" * 80)
want = {"Normal", "Body Text", "Heading 1", "Heading 2", "Heading 3", "Heading 4", "Heading 5", "Title", "Subtitle", "Caption", "List Paragraph", "TOC 1", "TOC 2", "TOC 3"}
for s in doc.styles:
    try:
        name = s.name
    except Exception:
        continue
    if name not in want:
        continue
    print("-" * 60)
    print("STYLE:", name, "| builtin:", getattr(s, "builtin", None), "| type:", s.type)
    f = s.font
    print("  font:", fmt_font(f))
    try:
        pf = s.paragraph_format
        print("  para:", fmt_para_dict := {
            "alignment": str(pf.alignment) if pf.alignment is not None else None,
            "first_line_indent_pt": pf.first_line_indent.pt if pf.first_line_indent else None,
            "left_indent_pt": pf.left_indent.pt if pf.left_indent else None,
            "line_spacing": pf.line_spacing,
            "line_rule": str(pf.line_spacing_rule),
            "space_before_pt": pf.space_before.pt if pf.space_before else None,
            "space_after_pt": pf.space_after.pt if pf.space_after else None,
        })
    except Exception as e:
        print("  para: n/a", e)
    # raw rPr / pPr from element for full detail (spacing/kern etc.)
    import lxml.etree as etree
    el = s.element
    rPr = el.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr")
    if rPr is not None:
        print("  rPr xml:", etree.tostring(rPr).decode("utf-8"))
    pPr = el.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr")
    if pPr is not None:
        print("  pPr xml:", etree.tostring(pPr).decode("utf-8"))

print()
print("=" * 80)
print("PAGE SETUP")
print("=" * 80)
for sec in doc.sections:
    print("section:", {
        "page_width_cm": round(sec.page_width.cm, 2) if sec.page_width else None,
        "page_height_cm": round(sec.page_height.cm, 2) if sec.page_height else None,
        "orientation": str(sec.orientation),
        "top_margin_cm": round(sec.top_margin.cm, 2) if sec.top_margin else None,
        "bottom_margin_cm": round(sec.bottom_margin.cm, 2) if sec.bottom_margin else None,
        "left_margin_cm": round(sec.left_margin.cm, 2) if sec.left_margin else None,
        "right_margin_cm": round(sec.right_margin.cm, 2) if sec.right_margin else None,
        "header_distance_cm": round(sec.header_distance.cm, 2) if sec.header_distance else None,
        "footer_distance_cm": round(sec.footer_distance.cm, 2) if sec.footer_distance else None,
        "header_first": sec.different_first_page_header_footer,
    })

print()
print("=" * 80)
print("NUMBERING (numbering.xml present & outline levels)")
print("=" * 80)
import zipfile
with zipfile.ZipFile(path) as z:
    names = z.namelist()
    print("has numbering.xml:", "word/numbering.xml" in names)
    if "word/numbering.xml" in names:
        data = z.read("word/numbering.xml").decode("utf-8")
        import re
        num_ids = re.findall(r'<w:num w:numId="(\d+)"', data)
        abs_ids = re.findall(r'<w:abstractNumId w:val="(\d+)"', data)
        print("numIds:", num_ids, "abstractNumIds:", abs_ids)
        # sample first abstract num's lvl 0-2 format
        m = re.search(r'<w:abstractNum[^>]*w:abstractNumId="0".*?</w:abstractNum>', data, re.S)
        if m:
            for lvl in re.findall(r'<w:lvl w:ilvl="[0-2]".*?</w:lvl>', m.group(0), re.S):
                fmt_m = re.search(r'w:numFmt w:val="([^"]+)"', lvl)
                txt_m = re.search(r'w:lvlText w:val="([^"]*)"', lvl)
                start_m = re.search(r'w:start w:val="([^"]+)"', lvl)
                print("  lvl:", lvl.split('w:ilvl="')[1][:1], "numFmt:", fmt_m.group(1) if fmt_m else None,
                      "lvlText:", txt_m.group(1) if txt_m else None,
                      "start:", start_m.group(1) if start_m else None)

print()
print("=" * 80)
print("ACTUAL CONTENT SAMPLE (first 40 paragraphs with effective formatting)")
print("=" * 80)
for i, p in enumerate(doc.paragraphs[:40]):
    txt = p.text.strip()
    if not txt:
        continue
    runs_info = []
    for r in p.runs[:2]:
        runs_info.append({"text_head": r.text[:20], "font": fmt_font(r.font)})
    print(f"[{i}] {fmt_para(p)}")
    for ri in runs_info:
        print("     run:", ri)

print()
print("=" * 80)
print("TABLE SAMPLE (first table: column widths & header font)")
print("=" * 80)
if doc.tables:
    t = doc.tables[0]
    print("table rows:", len(t.rows), "cols:", len(t.columns))
    hdr = t.rows[0].cells
    for c in hdr[:3]:
        for p in c.paragraphs[:1]:
            for r in p.runs[:1]:
                print("  header cell run:", fmt_font(r.font))
    for row in t.rows[1:3]:
        for c in row.cells[:3]:
            for p in c.paragraphs[:1]:
                for r in p.runs[:1]:
                    print("  body cell run:", fmt_font(r.font))
    break_out = True
else:
    print("no tables")

print()
print("=" * 80)
print("HEADER / FOOTER SAMPLE")
print("=" * 80)
sec = doc.sections[0]
for name, part in [("header", sec.header), ("footer", sec.footer), ("first_page_header", sec.first_page_header), ("first_page_footer", sec.first_page_footer)]:
    texts = [p.text.strip() for p in part.paragraphs if p.text.strip()]
    print(name, "texts:", texts[:5])
