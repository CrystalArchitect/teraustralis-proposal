# JATS interchange

[`review-pack.xml`](review-pack.xml) is a **JATS 1.3** article wrapping the Review Pack for machine interchange (Crossref-shaped metadata, not a journal).

It is **not**:

- a minted DOI
- an ISSN
- peer review
- CARE compliance
- a substitute for [review.html](https://proposal.teraustralis.com.au/review.html)

Canonical page remains the HTML sitting. This file names the same object so a stranger can parse title, author, date, rights, and the three references we actually opened.

Validate well-formedness:

```bash
python3 -c "import xml.etree.ElementTree as ET; ET.parse('jats/review-pack.xml'); print('well-formed')"
```

Full DTD/XSD validation needs the NISO JATS 1.3 article DTD; we do not vendor it here.
