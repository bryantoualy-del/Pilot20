import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";
import standalone from "ajv/dist/standalone/index.js";
const schema = JSON.parse(
  fs.readFileSync("src/forge/magic-item.schema.json", "utf8"),
);
const ajv = new Ajv({
  allErrors: true,
  code: { source: true, esm: true },
  strict: false,
});
fs.writeFileSync(
  "src/forge/validate-item.js",
  standalone(ajv, ajv.compile(schema)).replace(
    /require\("ajv\/dist\/runtime\/ucs2length"\)\.default/g,
    "(s => [...s].length)",
  ),
);
