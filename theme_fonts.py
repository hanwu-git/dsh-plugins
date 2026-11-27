# -*- coding: utf-8 -*-
"""Resolve theme fonts + accent colors from a DOCX."""
import sys, zipfile, re
path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    for n in [x for x in z.namelist() if 'theme' in x and x.endswith('.xml')]:
        data = z.read(n).decode('utf-8')
        major = re.search(r'<a:majorFont>.*?<a:latin typeface="([^"]*)".*?<a:ea typeface="([^"]*)"', data, re.S)
        minor = re.search(r'<a:minorFont>.*?<a:latin typeface="([^"]*)".*?<a:ea typeface="([^"]*)"', data, re.S)
        print(n)
        if major:
            print('  majorFont: latin=', major.group(1), ' ea=', major.group(2))
        if minor:
            print('  minorFont: latin=', minor.group(1), ' ea=', minor.group(2))
    st = z.read('word/styles.xml').decode('utf-8')
    for tag in ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']:
        m = re.search(r'<w:' + tag + r' w:val="([0-9A-Fa-f]{6})"', st)
        if m:
            print(tag, '=', m.group(1))
    m = re.search(r'<a:accent1 val="([0-9A-Fa-f]{6})"', z.read('word/theme/theme1.xml').decode('utf-8'))
    print('theme accent1 =', m.group(1) if m else None)
