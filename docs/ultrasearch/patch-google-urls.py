from pathlib import Path
import re

root = Path(__file__).resolve().parent
target = root / "http_search.go"
if not (root / "google_result_url.go").is_file():
    raise SystemExit("Missing google_result_url.go; copy the helper first.")
source = target.read_text()
if "padicheckGoogleResultURL(href)" in source:
    print("Google URL patch is already applied.")
else:
    pattern = re.compile(
        r'(?m)^([ \t]*)href, exists := a\.Attr\("href"\)\r?\n'
        r'[ \t]*if !exists \|\| strings\.Contains\(href, "google\.com"\) \{\r?\n'
        r'[ \t]*return\r?\n[ \t]*\}'
    )
    if len(list(pattern.finditer(source))) != 1:
        raise SystemExit("Expected parser block not found exactly once; no changes made.")

    def replacement(match):
        indent = match.group(1)
        return "\n".join(indent + line for line in [
            'href, exists := a.Attr("href")',
            'if !exists { return }',
            'href, valid := padicheckGoogleResultURL(href)',
            'if !valid { return }',
        ])

    updated = pattern.sub(replacement, source)
    temporary = target.with_name("http_search.go.padicheck-tmp")
    temporary.write_text(updated)
    temporary.replace(target)
    print("Google result URL patch applied. Rebuild before restarting the service.")
