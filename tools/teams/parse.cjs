// Reads the unpacked workbook into JSON: sheet names, every sheet as rows of cell text, and picture anchors.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "book");
const read = p => fs.readFileSync(path.join(root, p), "utf8").replace(/<(\/?)x:/g, "<$1");
const unesc = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// Sheet names in workbook order with their rId → target.
const wb = read("xl/workbook.xml");
const rels = Object.fromEntries([...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"|<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)].map(m => m[1] ? [m[1], m[2]] : [m[4], m[3]]));
const sheets = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].map(m => {
  const a = m[1], name = unesc(/name="([^"]*)"/.exec(a)[1]), rid = /r:id="([^"]*)"/.exec(a)[1];
  return { name, file: rels[rid].replace(/^\//, "") };
});
// Shared strings (rich text runs concatenated).
const ss = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
function readSheet(file) {
  const xml = read(file), rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], ref = /r="([A-Z]+)(\d+)"/.exec(attrs), type = /t="([^"]*)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const inner = c[2] ?? "";
      let value = null;
      if (type === "s") value = ss[Number(/<v>([^<]*)<\/v>/.exec(inner)?.[1])];
      else if (type === "inlineStr") value = unesc([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
      else if (type === "b") value = /<v>1<\/v>/.test(inner);
      else { const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1]; value = v == null ? null : isNaN(Number(v)) ? unesc(v) : Number(v); }
      if (value != null && value !== "") cells[colIndex(ref[1])] = value;
      cells.__row = Number(ref[2]);
    }
    if (Object.keys(cells).length > 1) rows.push(cells);
  }
  return rows;
}
const out = { sheets: [] };
for (const s of sheets) {
  const rows = readSheet(s.file), maxCol = Math.max(0, ...rows.flatMap(r => Object.keys(r).filter(k => k !== "__row").map(Number)));
  out.sheets.push({ name: s.name, file: s.file, rowCount: rows.length, rows: rows.map(r => ({ row: r.__row, cells: Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? null) })) });
}
// Pictures: anchor cell → media file (sheet1 only has a drawing).
const drawingRels = Object.fromEntries([...read("xl/drawings/_rels/drawing1.xml.rels").matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"|<Relationship [^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)].map(m => m[1] ? [m[1], m[2]] : [m[4], m[3]]));
out.pictures = [...read("xl/drawings/drawing1.xml").matchAll(/<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g)].map(m => ({
  col: Number(/<xdr:col>(\d+)<\/xdr:col>/.exec(m[1])[1]), row: Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(m[1])[1]) + 1,
  name: /name="([^"]*)"/.exec(m[1])[1], media: drawingRels[/r:embed="([^"]+)"/.exec(m[1])[1]].replace(/^\//, "")
}));
fs.writeFileSync(path.join(__dirname, "book.json"), JSON.stringify(out, null, 1));
console.log(out.sheets.map(s => `${s.name} (${s.file}): ${s.rowCount} rows`).join("\n"));
console.log("pictures:", out.pictures.length, JSON.stringify(out.pictures.slice(0, 3)));
