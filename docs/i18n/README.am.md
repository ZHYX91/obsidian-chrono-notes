# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes በObsidian ውስጥ ለየጊዜው ማስታወሻዎች፣ ተግባራት፣ በዓላት፣ የአካባቢ ክስተቶች እና የቀን ክልል ማስታወሻዎችን የሚያቀናብር የቀን መቁጠሪያ ያክላል።

## ባህሪያት

- የሳምንት፣ የወር፣ የዓመት እና የክፍለ ዘመን እይታዎች የማስታወሻ ሁኔታን፣ ተግባራትን እና ስታቲስቲክስን ያሳያሉ።
- ዕለታዊ፣ ሳምንታዊ፣ ወርሃዊ፣ ሩብ ዓመታዊ፣ ዓመታዊ፣ የአሥርት ዓመት እና የክፍለ ዘመን ማስታወሻዎች በአብነቶች ይፈጠራሉ።
- በማስታወሻዎች መካከል መንቀሳቀስ፣ የተግባር ሂደት፣ የሙቀት ካርታ እና የቀን ክልል ማስታወሻዎች ይደገፋሉ።
- የቻይና፣ የፋርስ፣ የኢትዮጵያ፣ የዕብራይስጥ፣ የሕንድ እና የእስልምና የቀን መቁጠሪያዎችን ማሳየት ይቻላል።
- የአካባቢ ICS ፋይሎችን ለንባብ ብቻ ይጠቀማል፤ የYAML ቀን እሴቶችን ሳይቀይር የማሳያ ቅርጽን ይቀይራል።

## መስፈርቶች እና ተኳኋኝነት

Obsidian 1.12.7 ወይም ከዚያ በላይ በኮምፒውተር ወይም በሞባይል ያስፈልጋል። በVault ውስጥ ያሉ ICS ፋይሎች በሚደገፉ መሣሪያዎች ይሰራሉ፤ ከVault ውጭ ያሉ መንገዶች በኮምፒውተር ብቻ ይሰራሉ።

## መጫን

**የማኅበረሰብ ተሰኪዎች፦** በObsidian ቅንብሮች ውስጥ የማኅበረሰብ ተሰኪዎችን ይክፈቱ፣ **Chrono Notes** ይፈልጉና ይጫኑት እና ያንቁት።

**በእጅ፦** `chrono-notes-<version>.zip` ከ[የቅርብ ጊዜ ልቀት](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) ያውርዱና ወደ `Vault/.obsidian/plugins/` ያውጡት። `chrono-notes/` ውስጥ `main.js`፣ `manifest.json` እና `styles.css` ይገኛሉ። Obsidian እንደገና ይጫኑና ተሰኪውን ያንቁ።

**ማዘመን፦** `data.json` የምትኬ ቅጂ ያስቀምጡ። ቅንብሮችን እንደገና ለማስጀመር ካልፈለጉ ይህን ፋይል አይሰርዙ።

## አጠቃቀም

በቅንብሮች ውስጥ የማስታወሻ ዓይነቶችን፣ መንገዶችን እና አብነቶችን ይምረጡ። የቀን መቁጠሪያውን ከጎን አሞሌ ወይም ከትእዛዝ ዝርዝር ይክፈቱ። **አንድ ጊዜ መጫን ቀኑን ብቻ ይመርጣል፤ ማስታወሻ አይፈጥርም።** ለመክፈት ወይም ለመፍጠር ሁለት ጊዜ ይጫኑ ወይም Enter ይጫኑ። በንክኪ ማያ ላይ ተጭነው ይያዙ።

## ቅንብሮች

የቋንቋ፣ የሳምንት መጀመሪያ ቀን፣ የቀን ማሳያ ቅርጽ፣ የፋይል መንገድ እና አብነት ቅንብሮችን መቀየር ይችላሉ። የፋይል ስም ቋንቋን መቀየር ያሉትን ፋይሎች አይሰይምም፤ መጀመሪያ ቅድመ እይታውን ያረጋግጡ።

## ገደቦች

ICS በአካባቢ ለንባብ ብቻ ነው፤ የርቀት ምዝገባዎችን በቀጥታ አያወርድም። በአንድ ማደስ እስከ 32 ምንጮች ይነበባሉ። `RRULE` ወይም `RDATE` ያላቸው ተደጋጋሚ ክስተቶች ይቆጠራሉ እንጂ አይዘረጉም። ገና ያልታወጁ በዓላትን አይተነብይም።

## ግላዊነት እና ደህንነት

ተሰኪው ለቀን መቁጠሪያ እይታ አስፈላጊ የሆኑ Markdown ማስታወሻዎችን እና የተመረጡ ICS ፋይሎችን ያነባል። መረጃን ወደ ውጭ አይልክም፣ መለያም አያስፈልግም። መረጃ ጠቋሚው በመሣሪያው IndexedDB ውስጥ ይቀመጣል። ከቅንጥብ ሰሌዳ አያነብም፤ ቀንን የሚጽፈው «ቀን ቅዳ» ሲመረጥ ብቻ ነው።

## ልማት

Node.js 24.19.0 እና npm 11.17.0 ይጠቀሙ። `npm ci` እና `npm run check` ያሂዱ። [የሥርዓት ንድፍ](../architecture.en.md) እና [የሙከራ መመሪያ](../testing-strategy.en.md) ይመልከቱ።

## ድጋፍ

ለጥያቄዎች [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions) ይጠቀሙ። ሊደገሙ የሚችሉ ችግኝቶችን በ[Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) ያሳውቁ። የደህንነት ችግኝቶችን [በግል](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new) ያሳውቁ፤ የVault የግል ይዘትን አይጋሩ።

## ፈቃድ

[MIT](../../LICENSE) © ZhengYX

## ምስጋና

በ[Calendar](https://github.com/liamcain/obsidian-calendar-plugin) እና [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar) ሥራ ተነሳስቷል።
