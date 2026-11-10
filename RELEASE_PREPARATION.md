# Кандидат 0.2.3 и выпуск проверенных файлов

Статус на 2026-11-09: desktopv0.2.3 опубликован из проверенного кандидата
42596623845/sourceed6139a через publish42641201516. Public assets/signatures,
основной updater route и реальный portable0.2.2→0.2.3 проверены (native переход
по отчёту пользователя). PR #10 остаётся draft. Backend — прежний0.2.2 с
Node22.22.0; main merge и backend deploy ещё не одобрены.

## Три ручных режима desktop-build.yml

`build` — значение по умолчанию. Выполняет тесты и матрицу совместимости,
собирает portable RVxis.exe, NSIS и MSI. Проверяет production config, версии,
подписи Minisign всех трёх бинарников, совпадение voice-chat.exe с portable.
Артефакт RVxis-Windows-x64 содержит binaries/signatures, latest.json,
RELEASE_NOTES.md и release-candidate.json formatVersion2 с хешами и source commit.
Run summary показывает run ID, полный source SHA и ZIP SHA-256. Релиз не создаётся.

`verify` — только чтение GitHub с contents:read/actions:read. Нужны одобренные
candidate_run_id, expected_source и expected_digest. Проверяется успешный ручной
build именно в этом репозитории, один неистёкший артефакт, API digest и хеш
фактически скачанного ZIP. Распаковка допускает ровно ожидаемые файлы, запрещает
выход из каталога, дубликаты и превышение лимитов. Затем сверяются source/version,
PE version portable, signatures, alias, notes и manifest hashes. Существующий
тег/релиз или версия не новее latest блокируют выпуск. Создаётся только receipt.

`publish` — отдельный запуск после явного одобрения конкретного кандидата.
Нужны те же три координаты и точная строка `PUBLISH v0.2.3` в publish_confirmation.
Сначала read-only job verify, затем отдельный publish job скачивает и
повторно проверяет тот же ZIP. Создаёт тег на одобренный source commit и draft
релиза, загружает только проверенные файлы. Все загруженные файлы скачиваются
обратно и сверяются по SHA-256, повторно проверяются tag/latest. Только затем
draft становится публичным. Компилятор, сборка frontend и backend deploy здесь
не запускаются. Подписывающий private key при продвижении не нужен.

Старый push-tag путь пересборки/публикации удалён. `bump-version.js --push`
останавливается до изменения файлов; обычный bump только синхронизирует версии.
Push main всё ещё запускает Deploy to VPS — main пока не трогать.
До слияния в main остаётся прежний workflow. Не создавайте теги вручную:
новый publish создаёт тег на проверенном коммите этой ветки.

## Запуск на тестовой ветке

В Actions → Build Desktop App (Tauri v2) → Run workflow выбрать
fix/sequential-audit-fixes и mode=build. Если форма показывает старые поля
default branch, запуск без новых полей тоже означает build.

Verify/publish можно запустить с явными inputs через GitHub CLI, не меняя main.
Это существующий workflow, уже доступный на default branch; [GitHub описывает
dispatch на выбранном ref через CLI/API](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).
Пример ТОЛЬКО проверки, координаты берутся из одобренного build:

```bash
gh workflow run desktop-build.yml --repo railenine/voice-chat \
  --ref fix/sequential-audit-fixes \
  -f mode=verify -f candidate_run_id=<RUN_ID> \
  -f expected_source=<FULL_COMMIT_SHA> -f expected_digest=<ZIP_SHA256>
```

CLI использует локальную авторизацию gh; не передавать ключи/токены в чат или
репозиторий. Исходники кандидата загружаются отдельным checkout строго по
expected_source и не исполняются. Проверяющий код берётся из checkout workflow
по github.sha. Оба checkout должны быть чистыми и совпадать со своими SHA;
receipt фиксирует sourceCommit и verifierCommit отдельно. Поэтому исправление
проверяющего кода не требует пересборки уже одобренного EXE и не меняет его
source/digest. Для кандидата42596623845 сохраняются sourceed6139a и прежний ZIP.
Desktop0.2.3 уже выпущен; повторно публиковать тот же tag нельзя.

## Ошибки и восстановление

### Права публикации кандидата с изменениями workflow

Run42610802728: verify прошёл, publish остановился на POST /git/refs с403,
несмотря на подтверждённый Contents write у GITHUB_TOKEN. Тегv0.2.3 и релиз
не созданы. Кандидат ed6139a меняет .github/workflows относительно main.
[GitHub требует Workflows write для такого target](https://docs.github.com/en/rest/releases/releases#create-a-release);
обычный GITHUB_TOKEN это право получить не может. Повтор без исправления
авторизации не устраняет причину. Не переносить target на main/другой SHA.

Для publish нужен repository Actions secret DESKTOP_RELEASE_TOKEN: fine-grained
PAT с коротким сроком действия, только для railenine/voice-chat, Contents:
Read and write и Workflows: Read and write (Metadata read добавляется GitHub).
Actions write, доступ ко всем репозиториям и административные права не нужны.
Создание такого токена и добавление секрета выполняет владелец; значение не
передавать в чат, файлы, логи или репозиторий. После выпуска временный PAT
можно отозвать; для регулярных выпусков предпочтителен отдельный GitHub App.

GITHUB_TOKEN остаётся read-only и читает Actions artifact. DESKTOP_RELEASE_TOKEN
передаётся только шагу publish и используется для тегов, релиза, загрузки и
чтения draft assets. Build/verify не получают его и не требуют его наличия.
Publish без секрета останавливается до API-запросов. Тест проверяет раздельные
Authorization для Actions и releases, отсутствие токенов на storage redirect,
а также сохранение всех проверок подписей/байтов перед публикацией.

После добавления секрета запустить НОВЫЙ workflow на исправленной ветке с
прежними candidate_run_id/expected_source/expected_digest. Пересборка не нужна.
Реальные права нового PAT и write/upload/readback остаются проверкой GitHub,
локальный mock их выдать или подтвердить не может.

Ни существующие published releases, ни drafts, ни теги не перезаписываются.
При ошибке до публикации новый draft/tag могут остаться для ручного разбора;
скрипт не удаляет их и не продолжает вслепую после повторного запуска.
Если сеть оборвалась при финальном PATCH, проверить статус релиза в GitHub:
отсутствие ответа само по себе не доказывает, что публикации не было.
Полученный receipt сохраняется в workflow artifacts/summary при успехе.

Actions ZIP download использует Accept application/vnd.github+json, а обратное
скачивание release assets — application/octet-stream; эти API различаются.
Первый verify42598215169 остановился с415 из-за общего octet-stream заголовка,
до распаковки/публикации. Regression теперь воспроизводит это различие и отказ.

## Текущий серверный этап после desktop выпуска

Push CI на рабочей ветке теперь сохраняет server-release-candidate только
после quality gate: tar.gz с dist/package/lock/server/scripts и внешний
server-candidate.json (source/tree/run/version/size/SHA256). Это подготовка,
не деплой. Брать только артефакт успешного push run с проверенным head SHA,
не PR merge SHA. Архив исключает .env, .git, node_modules и desktop binaries.
Полный workflow должен быть success, включая отдельный Linux rollback job.

Кандидат сначала распаковывается в НОВЫЙ /var/www/voice-chat-releases/<SHA>.
Обязательны проверка SHA256 архива и безопасного списка путей до распаковки;
существующий каталог не перезаписывать. Активные symlinks пока не менять.
Вызов с runtime Node22.22.0 и RVXIS_FRONTEND=/var/www/voice-chat:

```bash
RVXIS_RELEASE=<FULL_SHA> bash scripts/deploy-candidate.sh --verify-only
```

Команда выполняется из каталога кандидата с /opt/rvxis-runtime/current/bin
в PATH. Устанавливает production dependencies только в кандидате, связывает
его .env с существующим shared env и запускает короткий production probe на
127.0.0.1:3101. После успешного health/version/releaseId завершает probe без
изменения frontend/backend links и без PM2 restart. Это не проверка живых
голосовых сессий, nginx assets и полного функционала клиента.

Последующая активация требует отдельного одобрения и уведомления о коротком
разрыве signaling/SFU-сессий при restart. Старые0.2.2 клиенты несовместимы с
новыми protected APIs/rejoin; один успешный тест не доказывает обновление всех.
Сохранить прежние target paths и рабочий rollback. При автоматическом откате
NODE_ENV восстанавливается в прежнее production/development/test или unset,
вместо прежнего принудительного production. Тесты Linux проверяют verify-only
с сохранением PID/links, отказ плохого probe, legacy unset rollback, активацию
и откат уже production-кандидата. Push main всё ещё активирует автоматически:
не merge PR во время проверки. Coturn/LiveKit не меняются.

## Исторический план до desktop выпуска

1. Свежий build formatVersion2 и verify на GitHub. Прежний run42515045176
   успешно подтвердил ключ проекта для7fa1bfc, но не содержит исправление
   отсутствующего токена и новый полный отчёт. Продвигать его нельзя.
2. Проверить реальный native переход0.2.2→0.2.3 и доставку опубликованных файлов.
   Локальные signing fixtures/Chromium не заменяют этот этап. Minisign не является
   Windows Authenticode. Новая проверка MSI также относится к Minisign.
3. Выпускать сначала desktop при backend0.2.2, подтвердить переход пользователей,
   затем отдельно backend/web. Матрица COMPATIBILITY.md подтвердила этот порядок.
   minClientVersion не блокирует старые клиенты, доля обновившихся не измеряется.
4. Отдельное одобрение публикации конкретных run/source/digest. Затем отдельно
   согласованная активация backend. Сейчас ни один из этих шагов не выполнен.

URL опубликованного v0.2.3 уже доступны и проверены.
Исходные latest.json — неподписанные шаблоны; готовый манифест генерируется для
фактических байтов сборки. Не подменять им результат build/verify.
