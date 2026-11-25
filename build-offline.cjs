"use strict";

const { readFileSync, writeFileSync } = require("node:fs");
const { basename, join } = require("node:path");

const read = (name, encoding) => readFileSync(join(__dirname, name), encoding);
const escapeAttribute = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const scripts = [];
const html = read("index.html", "utf8")
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, path) =>
    "<style>\n" + read(path, "utf8") + "\n</style>")
  .replace(/<script defer src="([^"]+)"><\/script>\s*/g, (_, path) => {
    scripts.push("<script>\n" + read(path, "utf8").replace(/<\/script/gi, "<\\/script") + "\n</script>\n");
    return "";
  })
  .replace(/src="(assets\/[^"]+\.png)"/g, (_, path) =>
    `src="data:image/png;base64,${read(path).toString("base64")}"`)
  .replace(/href="(\.\.\/pdf\/[^"]+)"/g, (_, href) => {
    const path = decodeURIComponent(href);
    const base64 = read(path).toString("base64");
    return `href="data:application/pdf;base64,${base64}" download="${escapeAttribute(basename(path))}"`;
  });

// The inline scripts must run after the calculator markup is available.
const license = read("vendor/JSZip-LICENSE.md", "utf8").replaceAll("-->", "--&gt;");
const standalone = html.replace("</body>", () =>
  "<!-- JSZip license\n" + license + "\n-->\n" +
  scripts.join("") + "</body>");

writeFileSync(join(__dirname, "출장여비계산기.html"), standalone, "utf8");
