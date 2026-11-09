# Кандидат 0.2.3 и выпуск проверенных файлов

Статус на 2026-11-09: подготовка в fix/sequential-audit-fixes, PR #10 — draft.
Production остаётся на прежнем коде0.2.2 с Node22.22.0. Подготовка механизма
не разрешает публикацию, создание release tag, merge main или backend deploy.

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
Сначала read-only job verify, затем отдельный job с contents:write скачивает и
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
репозиторий. После build не менять ветку до verify/publish: expected source
должен совпадать с checkout всего workflow. Иначе проверка остановится.
Режим publish сейчас запускать не нужно: выпуск требует отдельного поручения.

## Ошибки и восстановление

Ни существующие published releases, ни drafts, ни теги не перезаписываются.
При ошибке до публикации новый draft/tag могут остаться для ручного разбора;
скрипт не удаляет их и не продолжает вслепую после повторного запуска.
Если сеть оборвалась при финальном PATCH, проверить статус релиза в GitHub:
отсутствие ответа само по себе не доказывает, что публикации не было.
Полученный receipt сохраняется в workflow artifacts/summary при успехе.

## Что осталось до реального выпуска

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

URL в latest.json относятся к будущему v0.2.3 и до публикации могут вернуть404.
Исходные latest.json — неподписанные шаблоны; готовый манифест генерируется для
фактических байтов сборки. Не подменять им результат build/verify.
