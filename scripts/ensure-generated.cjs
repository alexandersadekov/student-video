// src/generated и src/local не хранятся в git: там лежат импортированные ролики
// и личный материал. После свежего клона этих файлов нет, и сборка упала бы на
// импорте, поэтому перед стартом студии создаём пустые заглушки.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const stubs = [
  {
    file: path.join(root, "src", "generated", "Registry.tsx"),
    body:
      "// Заглушка: сюда scripts/import-video.py допишет импортированные ролики.\n" +
      "export const ImportedCompositions = () => <></>;\n",
  },
  {
    file: path.join(root, "src", "generated", "emoji.ts"),
    body:
      "// Заглушка: список личных эмодзи пишет scripts/emoji-from-font.py.\n" +
      "export const LOCAL_EMOJI: string[] = [];\n",
  },
  {
    file: path.join(root, "src", "local", "Local.tsx"),
    body:
      "// Заглушка для личных композиций. Эта папка не попадает в git.\n" +
      "export const LocalCompositions = () => <></>;\n",
  },
];

for (const { file, body } of stubs) {
  if (fs.existsSync(file)) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, "utf8");
  console.log(`created ${path.relative(root, file)}`);
}
