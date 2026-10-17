import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultProjectRoot = path.resolve(path.dirname(scriptPath), "..");
const config = {
  repository: "ZHYX91/obsidian-chrono-notes",
  languages: [
    {
      label: "English",
      path: "README.md",
      sections: ["Features","Requirements and compatibility","Installation","Usage","Settings","Limitations","Privacy and security","Development","Support","License","Acknowledgements"],
    },
    {
      label: "简体中文",
      path: "docs/i18n/README.zh-CN.md",
      sections: ["功能特性","使用要求与兼容性","安装","使用","设置","限制","隐私与安全","开发","支持","许可证","致谢"],
    },
    {
      label: "繁體中文",
      path: "docs/i18n/README.zh-TW.md",
      sections: ["功能特色","需求與相容性","安裝","使用方式","設定","限制","隱私與安全","開發","支援","授權","致謝"],
    },
    {
      label: "Deutsch",
      path: "docs/i18n/README.de-DE.md",
      sections: ["Funktionen","Voraussetzungen und Kompatibilität","Installation","Verwendung","Einstellungen","Einschränkungen","Datenschutz und Sicherheit","Entwicklung","Hilfe","Lizenz","Danksagung"],
    },
    {
      label: "Français",
      path: "docs/i18n/README.fr-FR.md",
      sections: ["Fonctionnalités","Prérequis et compatibilité","Installation","Utilisation","Paramètres","Limites","Confidentialité et sécurité","Développement","Assistance","Licence","Remerciements"],
    },
    {
      label: "Español",
      path: "docs/i18n/README.es-ES.md",
      sections: ["Funciones","Requisitos y compatibilidad","Instalación","Uso","Configuración","Limitaciones","Privacidad y seguridad","Desarrollo","Ayuda","Licencia","Agradecimientos"],
    },
    {
      label: "Português",
      path: "docs/i18n/README.pt-BR.md",
      sections: ["Recursos","Requisitos e compatibilidade","Instalação","Como usar","Configurações","Limitações","Privacidade e segurança","Desenvolvimento","Suporte","Licença","Agradecimentos"],
    },
    {
      label: "Русский",
      path: "docs/i18n/README.ru-RU.md",
      sections: ["Возможности","Требования и совместимость","Установка","Использование","Настройки","Ограничения","Конфиденциальность и безопасность","Разработка","Поддержка","Лицензия","Благодарности"],
    },
    {
      label: "日本語",
      path: "docs/i18n/README.ja-JP.md",
      sections: ["主な機能","動作環境と互換性","インストール","使い方","設定","制限事項","プライバシーとセキュリティ","開発","サポート","ライセンス","謝辞"],
    },
    {
      label: "한국어",
      path: "docs/i18n/README.ko-KR.md",
      sections: ["주요 기능","요구 사항 및 호환성","설치","사용 방법","설정","제한 사항","개인정보 보호 및 보안","개발","지원","라이선스","감사의 말"],
    },
    {
      label: "Tiếng Việt",
      path: "docs/i18n/README.vi-VN.md",
      sections: ["Tính năng","Yêu cầu và khả năng tương thích","Cài đặt","Cách sử dụng","Thiết lập","Giới hạn","Quyền riêng tư và bảo mật","Phát triển","Hỗ trợ","Giấy phép","Lời cảm ơn"],
    },
    {
      label: "العربية",
      path: "docs/i18n/README.ar.md",
      sections: ["الميزات","المتطلبات والتوافق","التثبيت","طريقة الاستخدام","الإعدادات","القيود","الخصوصية والأمان","التطوير","الدعم","الترخيص","شكر وتقدير"],
    },
    {
      label: "فارسی",
      path: "docs/i18n/README.fa.md",
      sections: ["امکانات","پیش‌نیازها و سازگاری","نصب","روش استفاده","تنظیمات","محدودیت‌ها","حریم خصوصی و امنیت","توسعه","پشتیبانی","مجوز","سپاسگزاری"],
    },
    {
      label: "עברית",
      path: "docs/i18n/README.he.md",
      sections: ["יכולות","דרישות ותאימות","התקנה","אופן השימוש","הגדרות","מגבלות","פרטיות ואבטחה","פיתוח","תמיכה","רישיון","תודות"],
    },
    {
      label: "አማርኛ",
      path: "docs/i18n/README.am.md",
      sections: ["ባህሪያት","መስፈርቶች እና ተኳኋኝነት","መጫን","አጠቃቀም","ቅንብሮች","ገደቦች","ግላዊነት እና ደህንነት","ልማት","ድጋፍ","ፈቃድ","ምስጋና"],
    },
    {
      label: "हिन्दी",
      path: "docs/i18n/README.hi.md",
      sections: ["मुख्य सुविधाएँ","आवश्यकताएँ और अनुकूलता","इंस्टॉल करना","इस्तेमाल कैसे करें","सेटिंग्स","सीमाएँ","गोपनीयता और सुरक्षा","विकास","सहायता","लाइसेंस","आभार"],
    },
  ],
  requiredTokens: [
    "https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest",
    "`main.js`",
    "`manifest.json`",
    "`styles.css`",
    "`data.json`",
  ],
};

const ignoredDirectories = new Set([".git", "coverage", "dist", "node_modules", "release"]);
const normalizePath = (filePath) => filePath.split(path.sep).join("/");

function expectedNavigation(filePath) {
  return config.languages
    .map(({ label, path: targetPath }) => {
      const target = filePath === "README.md"
        ? `https://github.com/${config.repository}/blob/main/${targetPath}`
        : path.posix.relative(path.posix.dirname(filePath), targetPath);
      return `[${label}](${target})`;
    })
    .join(" · ");
}

function stripCodeFences(source) {
  return source.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gmu, "");
}

function collectTargets(source) {
  const targets = [];
  const visibleSource = stripCodeFences(source);
  for (const match of visibleSource.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*)?\)/gu)) {
    targets.push({ kind: match[1] === "!" ? "image" : "link", target: match[2] });
  }
  for (const match of visibleSource.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/giu)) {
    targets.push({ kind: "image", target: match[1] });
  }
  return targets;
}

function decodeTarget(rawTarget, filePath, errors) {
  const withoutWrapper = rawTarget.replace(/^<|>$/gu, "");
  try {
    return decodeURIComponent(withoutWrapper.split("#", 1)[0].split("?", 1)[0]);
  } catch {
    errors.push(`${filePath} contains an invalid encoded target: ${rawTarget}`);
    return null;
  }
}

function validateRepositoryPath(projectRoot, filePath, rawTarget, repositoryPath, errors) {
  const absoluteTarget = path.resolve(projectRoot, repositoryPath);
  const relativeTarget = path.relative(projectRoot, absoluteTarget);
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    errors.push(`${filePath} contains a repository target outside the repository: ${rawTarget}`);
  } else if (!existsSync(absoluteTarget)) {
    errors.push(`${filePath} contains a missing repository target: ${rawTarget}`);
  }
}

function classifyRepositoryUrl(rawTarget) {
  let url;
  try {
    url = new URL(rawTarget);
  } catch {
    return null;
  }
  const blobPrefix = `/${config.repository}/blob/main/`;
  const rawPrefix = `/${config.repository}/main/`;
  if (url.hostname === "github.com" && url.pathname.startsWith(blobPrefix)) {
    return { kind: "blob", path: url.pathname.slice(blobPrefix.length) };
  }
  if (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith(rawPrefix)) {
    return { kind: "raw", path: url.pathname.slice(rawPrefix.length) };
  }
  return null;
}

function validateTargets(projectRoot, filePath, source, errors) {
  const isRoot = filePath === "README.md";
  for (const { kind, target: rawTarget } of collectTargets(source)) {
    if (rawTarget.startsWith("#")) {
      continue;
    }
    const repositoryUrl = classifyRepositoryUrl(rawTarget);
    if (repositoryUrl) {
      if (!isRoot) {
        errors.push(`${filePath} must use a relative target for repository content: ${rawTarget}`);
        continue;
      }
      if (kind === "image" && repositoryUrl.kind !== "raw") {
        errors.push(`${filePath} must use raw.githubusercontent.com for repository images: ${rawTarget}`);
      }
      if (kind === "link" && repositoryUrl.kind !== "blob") {
        errors.push(`${filePath} must use github.com blob/main for repository documents: ${rawTarget}`);
      }
      const decoded = decodeTarget(repositoryUrl.path, filePath, errors);
      if (decoded) {
        validateRepositoryPath(projectRoot, filePath, rawTarget, decoded, errors);
      }
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)) {
      continue;
    }
    const decoded = decodeTarget(rawTarget, filePath, errors);
    if (!decoded) {
      continue;
    }
    if (isRoot) {
      errors.push(`${filePath} must use a canonical absolute GitHub target for repository content: ${rawTarget}`);
      continue;
    }
    const repositoryPath = path.resolve(path.dirname(path.resolve(projectRoot, filePath)), decoded);
    const relativePath = path.relative(projectRoot, repositoryPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      errors.push(`${filePath} contains a relative target outside the repository: ${rawTarget}`);
    } else if (!existsSync(repositoryPath)) {
      errors.push(`${filePath} contains a missing relative target: ${rawTarget}`);
    }
  }
}

function listLocalizedReadmes(projectRoot, directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        listLocalizedReadmes(projectRoot, path.join(directory, entry.name), result);
      }
      continue;
    }
    if (entry.isFile() && /^README[._-][A-Za-z0-9].*\.md$/u.test(entry.name)) {
      result.push(normalizePath(path.relative(projectRoot, path.join(directory, entry.name))));
    }
  }
  return result;
}

export function checkReadmeI18n(projectRoot = defaultProjectRoot) {
  const errors = [];
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
  const translatedReadmes = config.languages.slice(1).map(({ path: filePath }) => filePath);
  const actualTranslatedReadmes = readdirSync(path.join(projectRoot, "docs/i18n"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^README.*\.md$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const expectedTranslatedReadmes = translatedReadmes.map((filePath) => path.basename(filePath)).sort();
  if (JSON.stringify(actualTranslatedReadmes) !== JSON.stringify(expectedTranslatedReadmes)) {
    errors.push(`docs/i18n README set must be exactly: ${expectedTranslatedReadmes.join(", ")}`);
  }

  for (const language of config.languages) {
    const filePath = language.path;
    const absolutePath = path.join(projectRoot, filePath);
    if (!existsSync(absolutePath)) {
      errors.push(`Missing README file: ${filePath}`);
      continue;
    }
    const source = readFileSync(absolutePath, "utf8").replace(/^\uFEFF/u, "");
    const lines = source.split(/\r\n|\n|\r/u);
    if (lines[0] !== `# ${manifest.name}`) {
      errors.push(`${filePath} must start with the canonical title: # ${manifest.name}`);
    }
    const navigation = expectedNavigation(filePath);
    if (lines[1] !== "" || lines[2] !== navigation || lines[3] !== "") {
      errors.push(`${filePath} must place its canonical language navigation after the title`);
    }
    const actualSections = [...source.matchAll(/^## (.+)$/gmu)].map((match) => match[1].trim());
    if (JSON.stringify(actualSections) !== JSON.stringify(language.sections)) {
      errors.push(`${filePath} must use the configured H2 section order`);
    }
    const sectionSubheadings = new Map();
    let currentSection = null;
    for (const match of source.matchAll(/^(##|###) (.+)$/gmu)) {
      if (match[1] === "##") currentSection = match[2].trim();
      else if (currentSection !== null) {
        sectionSubheadings.set(currentSection, (sectionSubheadings.get(currentSection) ?? 0) + 1);
      }
    }
    const installationHeading = language.sections[2];
    const usageHeading = language.sections[3];
    const totalSubheadings = [...sectionSubheadings.values()].reduce((a, b) => a + b, 0);
    if (
      sectionSubheadings.get(installationHeading) !== 3 ||
      sectionSubheadings.get(usageHeading) !== 2 ||
      totalSubheadings !== 5
    ) {
      errors.push(`${filePath} must include 3 installation and 2 usage subsections`);
    }
    const imageBase = filePath === "README.md"
      ? `https://raw.githubusercontent.com/${config.repository}/main/docs/assets/`
      : "../assets/";
    for (const imageName of ["chrono-notes-desktop-en.png", "chrono-notes-android-en.png"]) {
      if (!source.includes(`](${imageBase}${imageName})`)) {
        errors.push(`${filePath} must link screenshot ${imageName}`);
      }
    }
    for (const codeToken of ["DEC[s]", "[C]CEN", "{{days}}", "chrono-notes: interval"]) {
      if (!source.includes(codeToken)) {
        errors.push(`${filePath} is missing supported workflow example: ${codeToken}`);
      }
    }
    for (const token of config.requiredTokens) {
      if (!source.includes(token)) {
        errors.push(`${filePath} is missing required README contract token: ${token}`);
      }
    }
    validateTargets(projectRoot, filePath, source, errors);
  }

  const allowed = new Set(translatedReadmes);
  for (const readmePath of listLocalizedReadmes(projectRoot, projectRoot).sort()) {
    if (!allowed.has(readmePath)) {
      errors.push(`Localized README is outside the configured layout: ${readmePath}`);
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const errors = checkReadmeI18n();
  if (errors.length > 0) {
    console.error("README i18n contract failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`README i18n contract passed: ${config.languages.length} public README files.`);
  }
}
