"""Static SEO contract for draft public routes; no live HTTP requests."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import re
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / "frontend"
NS = {"s":"http://www.sitemaps.org/schemas/sitemap/0.9","x":"http://www.w3.org/1999/xhtml"}

class SEOContractTests(unittest.TestCase):
    def test_sitemap_matches_public_routes(self):
        app = (ROOT/"src/App.js").read_text(encoding="utf8")
        blog = (ROOT/"src/Blog.js").read_text(encoding="utf8")
        sector_definition = re.search(r"const SECTOR_SLUGS = \[(.*?)\]", app).group(1)
        sectors = set(re.findall(r'"([^"]+)"', sector_definition))
        articles = set(re.findall(r'slug: "([^"]+)"', blog))
        expected = {"/","/blog"} | {"/"+s for s in sectors} | {"/blog/"+s for s in articles}
        urls = ET.parse(ROOT/"public/sitemap.xml").getroot().findall("s:url",NS)
        paths = []
        for node in urls:
            loc = urlsplit(node.findtext("s:loc",namespaces=NS))
            self.assertEqual((loc.scheme,loc.netloc,loc.query,loc.fragment),("https","docuanalytics.online","",""))
            paths.append(loc.path)
            alternatives = node.findall("x:link",NS)
            self.assertEqual({link.attrib["hreflang"] for link in alternatives},{"it","en","es","de","fr","x-default"})
            for link in alternatives:
                target = urlsplit(link.attrib["href"])
                lang = link.attrib["hreflang"]
                self.assertEqual((target.scheme,target.netloc,target.path,target.fragment),("https","docuanalytics.online",loc.path,""))
                self.assertEqual(parse_qs(target.query),{} if lang in ("it","x-default") else {"lang":[lang]})
        self.assertEqual(set(paths),expected)
        self.assertEqual(len(paths),len(set(paths)))
    def test_home_and_robots_use_same_origin(self):
        html = (ROOT/"public/index.html").read_text(encoding="utf8")
        robots = (ROOT/"public/robots.txt").read_text(encoding="utf8")
        self.assertIn('rel="canonical" href="https://docuanalytics.online/"', html)
        self.assertIn("Sitemap: https://docuanalytics.online/sitemap.xml", robots)

if __name__ == "__main__":
    unittest.main()
