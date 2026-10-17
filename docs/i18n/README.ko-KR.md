# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes는 Obsidian에서 주기 노트, 작업, 지역 공휴일, 로컬 일정, 기간 노트를 함께 관리할 수 있는 달력 플러그인입니다.

## 주요 기능

- 주·월·연·세기 달력에서 노트 상태, 작업, 통계, 미리 보기를 확인할 수 있습니다.
- 일간·주간·월간·분기·연간·10년·세기 노트를 내장 템플릿이나 Templater로 만들 수 있습니다.
- 노트 간 탐색, 작업 진행률, 히트맵, 선택한 날짜 범위의 기간 노트를 지원합니다.
- 중국 음력·간지, 페르시아력, 에티오피아력, 히브리력, 인도력, 이슬람력과 중국 본토·싱가포르 공휴일을 표시할 수 있습니다.
- 로컬 ICS 일정은 읽기 전용입니다. 날짜 속성의 YAML 값은 그대로 두고 표시 형식만 바꿀 수 있습니다.

## 요구 사항 및 호환성

데스크톱 또는 모바일 Obsidian 1.12.7 이상이 필요합니다. Vault 안에 저장된 ICS 파일은 지원 플랫폼에서 사용할 수 있으며, Vault 외부 경로는 데스크톱에서만 사용할 수 있습니다. 다른 역법은 실행 환경에서 제공하는 데이터에 따라 표시됩니다.

## 설치

**커뮤니티 플러그인:** Obsidian의 **설정 → 커뮤니티 플러그인 → 탐색**에서 **Chrono Notes**를 검색하고 **설치**, **활성화**를 차례로 선택합니다.

**수동 설치:** [최신 릴리스](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)에서 `chrono-notes-<version>.zip`을 받아 `Vault/.obsidian/plugins/`에 압축을 풉니다. `chrono-notes/` 폴더에 `main.js`, `manifest.json`, `styles.css`가 있어야 합니다. Obsidian을 다시 로드한 뒤 활성화합니다.

**업데이트:** 기존 `data.json`은 백업 후 보관하세요. 설정을 초기화하려는 경우가 아니라면 삭제하지 마세요.

## 사용 방법

설정에서 사용할 주기 노트 종류와 경로, 템플릿을 지정하고 리본 아이콘이나 명령 팔레트로 달력을 엽니다. **날짜를 한 번 클릭하면 선택만 되며 노트가 만들어지지 않습니다.** 두 번 클릭하거나 Enter를 누르면 노트를 열거나 만듭니다. 터치 화면에서는 길게 누르고, 오른쪽 클릭으로 날짜 메뉴를 엽니다. Ctrl/Cmd+클릭 또는 가운데 클릭으로 새 탭에서 열 수 있습니다.

## 설정

언어, 주 시작 요일, 날짜 표시 형식, 노트 경로와 템플릿을 설정할 수 있습니다. 파일 이름에 쓰는 언어를 변경해도 기존 파일은 이름이 바뀌지 않으므로 경로 미리 보기를 확인하세요. 화면 표시, 작업, 통계, 기간 노트 및 달력 확장 기능에는 별도 설정이 있습니다.

## 제한 사항

ICS 파일은 로컬 읽기 전용이며 원격 구독을 직접 가져오지 않습니다. 기본적으로 갱신할 때 최대 32개 원본을 읽습니다. `RRULE`과 `RDATE` 반복 일정은 펼치지 않고 건수만 집계합니다. 아직 발표되지 않은 공휴일은 예측하지 않습니다. 일부 달력은 실행 환경에 따라 사용할 수 없습니다.

## 개인정보 보호 및 보안

달력과 색인을 만들기 위해 필요한 Markdown 노트와 선택한 로컬 ICS 파일을 읽습니다. 노트나 일정 데이터를 업로드하지 않으며 계정도 필요 없습니다. 파생 색인은 기기의 IndexedDB에 저장하고 언제든 다시 만들 수 있습니다. 클립보드는 읽지 않으며 '날짜 복사'를 선택한 경우에만 날짜를 기록합니다.

## 개발

Node.js 24.19.0 및 npm 11.17.0을 사용하세요. `npm ci`, `npm run check`를 실행하고 [아키텍처](../architecture.en.md)와 [테스트 전략](../testing-strategy.en.md)을 참고하세요.

## 지원

질문과 아이디어는 [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions)에서, 재현 가능한 오류는 [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose)에 등록하세요. 보안 취약점은 [비공개로 신고](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new)하고 개인 Vault 내용은 공개하지 마세요.

## 라이선스

[MIT](../../LICENSE) © ZhengYX

## 감사의 말

[Calendar](https://github.com/liamcain/obsidian-calendar-plugin)와 [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)에서 영감을 얻었습니다.
