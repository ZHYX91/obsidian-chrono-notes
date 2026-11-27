import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const catalogDirectory = fileURLToPath(new URL("../src/shared/i18n/catalogs", import.meta.url));
const keyModule = "chrono:message-keys";

// Keep the authored objects, insertion order and frozen plural forms intact. Only the
// repeated property-name tokens become references to one bundled table of strings.
async function catalogKeys(file, source) {
  const { default: ts } = await import("typescript");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declarations = parsed.statements.filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations]);
  const declaration = declarations.find(({ name }) => ts.isIdentifier(name) && name.text.endsWith("_MESSAGES"));
  let expression = declaration?.initializer;
  while (expression && !ts.isObjectLiteralExpression(expression)) {
    if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) ||
        ts.isParenthesizedExpression(expression)) {
      expression = expression.expression;
    } else if (ts.isCallExpression(expression) && expression.expression.getText(parsed) === "Object.freeze" &&
        expression.arguments.length === 1) {
      expression = expression.arguments[0];
    } else {
      throw new Error(`Expected a static message catalog in ${file}`);
    }
  }
  assert.ok(expression, `Missing message catalog in ${file}`);
  return expression.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property) && ts.isStringLiteral(property.name),
      `Expected a literal message key in ${file}`);
    return { key: property.name.text, start: property.name.getStart(parsed), end: property.name.end };
  });
}

export function compactMessageKeys() {
  return {
    name: "compact-message-keys",
    setup(build) {
      const canonical = path.join(catalogDirectory, "zh-cn.ts");
      let indices;
      build.onStart(async () => {
        const entries = await catalogKeys(canonical, await readFile(canonical, "utf8"));
        indices = new Map(entries.map(({ key }, index) => [key, index]));
        assert.equal(indices.size, entries.length, "Duplicate canonical message key");
      });
      build.onResolve({ filter: /^chrono:message-keys$/ }, () => ({
        path: keyModule, namespace: keyModule,
      }));
      build.onLoad({ filter: /.*/, namespace: keyModule }, () => ({
        contents: `export const keys = ${JSON.stringify([...indices.keys()])};`,
        watchFiles: [canonical],
      }));
      build.onLoad({ filter: /[/\\]i18n[/\\]catalogs[/\\][^/\\]+\.ts$/ }, async ({ path: file }) => {
        if (path.dirname(file) !== catalogDirectory || path.basename(file) === "index.ts") return;
        const source = await readFile(file, "utf8");
        const entries = await catalogKeys(file, source);
        assert.equal(new Set(entries.map(({ key }) => key)).size, entries.length, `Duplicate message key in ${file}`);
        assert.equal(entries.length, indices.size, `Incomplete message catalog in ${file}`);

        const chunks = [`import { keys as bundledMessageKeys } from "${keyModule}";\n`];
        let offset = 0;
        for (const { key, start, end } of entries) {
          const index = indices.get(key);
          assert.notEqual(index, undefined, `Unknown message key ${key} in ${file}`);
          chunks.push(source.slice(offset, start), `[bundledMessageKeys[${index}]]`);
          offset = end;
        }
        chunks.push(source.slice(offset));
        return { contents: chunks.join(""), loader: "ts", watchFiles: [file, canonical] };
      });
    },
  };
}
