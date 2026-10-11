"""Builds synthetic EcoSure-style PDFs for tests (no real community data).

The report follows the layout the original parse.py relied on: bold labels with values to
the right on page 1, the score in large type, white section bars, question rows on grey
bands with the criticality at x 470-520 and points past x 530, then Response/Comment/Findings
and photos, and a Detailed standards section with manager and health inspection answers.
The CAP copies the column layout of real EcoSure CAP exports.

    pip install pymupdf && python3 scripts/make_fixtures.py
"""
import pymupdf, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'tests', 'fixtures')
GREY, BAR = (0.949, 0.949, 0.949), (0.12, 0.23, 0.24)
# A Unicode font so bullets and the ≤ sign survive (the built-in Helvetica drops them).
FONT_DIR = '/usr/share/fonts/truetype/dejavu/'
REG = dict(fontname='DejaVuSans', fontfile=FONT_DIR + 'DejaVuSans.ttf')
BOLD = dict(fontname='DejaVuSans-Bold', fontfile=FONT_DIR + 'DejaVuSans-Bold.ttf')

def photo(color):
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 320, 240), 0)
    pix.set_rect(pix.irect, color)
    return pix.tobytes('jpeg')

def report():
    doc = pymupdf.open()
    p = doc.new_page(width=595, height=842)
    def t(x, y, s, size=9, bold=False, color=(0, 0, 0)):
        p.insert_text((x, y), s, fontsize=size, color=color, **(BOLD if bold else REG))
    t(40, 60, 'Food Safety Evaluation', 14, True)
    for i, (lab, val) in enumerate([('Location ID', 'TEST-01 - Kitchen 2'), ('Property Name', 'Sample Terrace - Kitchen #2'), ('Address Line', '1 Test Way'),
                                    ('City', 'Testville'), ('Start Date Time', '10/14/2026 09:05 AM*'), ('End Date Time', '10/14/2026 12:40 PM')]):
        t(40, 100 + i * 16, lab, 9, True); t(160, 100 + i * 16, val)
    t(420, 140, '91%', 40, True)
    y = 230
    p.draw_rect(pymupdf.Rect(30, y - 12, 565, y + 4), color=None, fill=BAR); t(40, y, 'Actionable standards', 10, True, (1, 1, 1)); y += 30
    rows = [
        ('PROTECTION FROM CONTAMINATION / Hierarchy/Storage Conditions/Contamination Observed/Food Integrity',
         ['Food stored in packages, covered containers, or', 'wrappings'], 'Storage', 'Major', '3', 'Sheet pan of muffins uncovered in walk-in cooler.',
         ['Container holding unwrapped food without a lid'], 1),
        ('TIME / TEMPERATURE CONTROL FOR SAFETY (HIGH RISK) / Proper Cold Holding Requirements Met',
         ['High risk foods in cold holding are held at ≤ 41° F', '(5°C)'], 'Temps', 'Critical', '5', 'Sliced ham in reach-in at 46F. Manager discarded.',
         ['TCS food in reach-in cooler is > 41° F (5°C)', 'Reach-in door left open during prep'], 2),
        ('CHEMICALS / Chemicals / Toxic Substances Properly Identified, Stored, Used',
         ['Chemicals are properly labeled'], 'Chem', 'Minor', '1', 'Spray bottle without a label at dish station.', ['Working container not labeled'], 0),
    ]
    for sec, q, cat, crit, pts, comment, finds, nph in rows:
        if y > 640:
            p = doc.new_page(width=595, height=842); y = 60
        p.draw_rect(pymupdf.Rect(30, y - 12, 565, y + 4), color=None, fill=BAR); t(40, y, sec[:95], 8.5, False, (1, 1, 1)); y += 24
        p.draw_rect(pymupdf.Rect(30, y - 12, 565, y + 12 * len(q) - 6), color=None, fill=GREY)
        for k, line in enumerate(q): t(40, y + 12 * k, line)
        t(410, y, cat); t(480, y, crit); t(540, y, pts); y += 12 * len(q) + 14
        t(40, y, 'Response:', 8, True); t(100, y, 'No'); y += 14
        t(40, y, 'Comment:', 8, True); y += 12; t(40, y, comment); y += 14
        t(40, y, 'Findings:', 8, True); y += 12
        for f in finds: t(40, y, '• ' + f); y += 12
        for k in range(nph):
            p.insert_image(pymupdf.Rect(40 + k * 130, y, 160 + k * 130, y + 90), stream=photo((200 - 60 * k, 120, 60 + 60 * k)))
        y += 104 if nph else 10
    p = doc.new_page(width=595, height=842); y = 60
    t(40, y, 'Detailed standards', 12, True); y += 24
    for lab, ans in [('Manager First Name', 'Pat'), ('Manager Last Name', 'Example'), ('Date of last Health Department Inspection', '03/02/2026'), ('Result of last Health Department Inspection', 'Pass')]:
        t(40, y, lab); t(40, y + 12, 'Answer:', 8, True); t(40, y + 24, ans); y += 44
    t(40, y, 'Positive Feedback', 10, True); t(40, y + 14, 'Findings:', 8, True)
    t(40, y + 28, '• The team was engaged and asked great questions.'); t(40, y + 40, '• Chemicals were stored away from food.')
    doc.subset_fonts(); doc.save(os.path.join(OUT, 'sample-report.pdf'), garbage=4, deflate=True)

def cap():
    doc = pymupdf.open()
    p = doc.new_page(width=595, height=842)
    def t(x, y, s, size=9, color=(0, 0, 0)):
        p.insert_text((x, y + size * 0.9), s, fontsize=size, color=color, **REG)
    t(241, 61, 'Client Confidentiality Header'); t(219, 82, 'Corrective Action Plan', 16); t(261, 105, 'Status: Pending'); t(244, 121, 'Sample Terrace - Kitchen #2')
    t(35, 174, 'Unit Number:', 8); t(116, 174, '99 - Kitchen 2', 8)
    t(201, 193, 'Audit Type:', 8); t(282, 193, 'Initial', 8); t(201, 212, 'Announce Date:', 8); t(282, 212, 'Oct-14-2026', 8)
    t(406, 174, 'Status:', 8); t(487, 174, 'Pending', 8); t(406, 212, 'Submitted date:', 8); t(487, 212, '10/18/2026', 8)
    t(36, 267, 'Food Safety', 9, (1, 1, 1))
    y = 284
    for cid, item, plan, comment in [('6.1.3', ['Food stored in packages, covered containers, or', 'wrappings'], ['Other -', 'Retrained AM crew on covering', 'pans before storage.'], 'Sheet pan uncovered.'),
                                     ('7.5.1', ['High risk foods in cold holding are held', 'at ≤ 41° F (5°C)'], ['Repair -', 'Reach-in gasket replaced 10/16/2026.'], 'Ham at 46F.')]:
        for x, h in [(35, 'Client ID'), (87, 'Item'), (260, 'Action Plan'), (433, 'Project owner'), (535, 'Due date')]: t(x, y, h, 6.5)
        y += 18; t(35, y, cid)
        for k, s in enumerate(item): t(86, y + 12 * k, s)
        for k, s in enumerate(plan): t(259, y + 14 * k, s)
        t(432, y, 'Pat Example'); t(516, y, '10/21/2026'); y += 14 * len(plan) + 30
        t(36, y, 'Touchpoint:'); t(36, y + 13, 'Storage'); t(36, y + 33, 'Primary comment:'); t(36, y + 46, comment)
        p.insert_image(pymupdf.Rect(38, y + 66, 88, y + 116), stream=photo((90, 160, 140)))
        y += 160
    doc.subset_fonts(); doc.save(os.path.join(OUT, 'sample-cap.pdf'), garbage=4, deflate=True)

report(); cap(); print('fixtures written to', os.path.abspath(OUT))
