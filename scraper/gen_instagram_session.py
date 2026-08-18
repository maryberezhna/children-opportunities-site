"""Одноразовий скрипт для генерації Instagram-сесії (instaloader).

Найнадійніший шлях — забрати ВЖЕ ЖИВУ сесію з браузера, де ви залогінені
в Instagram: жодного запиту на логін не робиться, тож і checkpoint від
Meta неможливий. Password-логін лишився запасним шляхом.

Запустіть локально:
    cd scraper && pip install instaloader browser_cookie3
    python gen_instagram_session.py

Перед запуском: відкрийте instagram.com у своєму звичайному браузері та
увійдіть в акаунт dityam.com.ua. Якщо Instagram показує «Підтвердьте, що
це ви» (checkpoint) — підтвердьте.

Скрипт збереже сесію і, якщо встановлено GitHub CLI, сам запише секрети
INSTAGRAM_USERNAME та INSTAGRAM_SESSION_B64 у репозиторій.
Примітки: для Chrome macOS спитає доступ до Keychain («Chrome Safe
Storage») — дозвольте; для Safari терміналу може знадобитися Full Disk
Access (System Settings → Privacy & Security).
"""
import base64
import getpass
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import instaloader

REPO = "maryberezhna/children-opportunities-site"


def _make_loader():
    return instaloader.Instaloader(quiet=True)


def _try_browsers():
    """Повертає залогінений Instaloader із cookies браузера або None."""
    try:
        import browser_cookie3
    except ImportError:
        print("ℹ️  browser_cookie3 не встановлено (pip install browser_cookie3) — "
              "пропускаю імпорт із браузера.")
        return None

    browsers = [
        ("Chrome", browser_cookie3.chrome),
        ("Firefox", browser_cookie3.firefox),
        ("Safari", browser_cookie3.safari),
        ("Edge", browser_cookie3.edge),
        ("Brave", browser_cookie3.brave),
    ]
    for name, loader_fn in browsers:
        try:
            cj = loader_fn(domain_name=".instagram.com")
        except Exception:
            continue
        if not any(c.name == "sessionid" and c.value for c in cj):
            continue
        L = _make_loader()
        L.context._session.cookies.update(cj)
        try:
            username = L.test_login()
        except Exception:
            username = None
        if username:
            print(f"✅ Знайдено живу сесію @{username} у {name}.")
            L.context.username = username
            return L, username
        print(f"ℹ️  У {name} є cookies Instagram, але сесія не активна.")
    return None


def _password_login():
    username = input("Instagram username (акаунт dityam.com.ua): ").strip().lstrip("@")
    password = getpass.getpass("Пароль (не відображається): ")
    L = _make_loader()
    try:
        L.login(username, password)
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        code = input("Код 2FA з застосунку/SMS: ").strip()
        L.two_factor_login(code)
    except instaloader.exceptions.BadCredentialsException:
        sys.exit("❌ Неправильний логін або пароль.")
    except Exception as e:
        sys.exit(f"❌ Логін не вдався: {type(e).__name__}: {e}\n"
                 "Якщо це checkpoint — увійдіть на instagram.com у браузері, "
                 "підтвердьте вхід і запустіть скрипт ще раз: він забере "
                 "сесію прямо з браузера, без повторного логіну.")
    print("✅ Логін успішний.")
    return L, username


result = _try_browsers()
if result is None:
    print("Живої сесії у браузерах не знайдено — пробую логін паролем.")
    result = _password_login()
L, username = result

with tempfile.TemporaryDirectory() as tmp:
    session_file = Path(tmp) / "session"
    L.save_session_to_file(str(session_file))
    session_b64 = base64.b64encode(session_file.read_bytes()).decode()

gh = shutil.which("gh")
if gh:
    for name, value in (("INSTAGRAM_USERNAME", username),
                        ("INSTAGRAM_SESSION_B64", session_b64)):
        subprocess.run([gh, "secret", "set", name, "--repo", REPO],
                       input=value.encode(), check=True)
        print(f"✅ Секрет {name} записано в {REPO}")
    print("\nГотово. Наступний нічний запуск скрапера підхопить сесію.")
else:
    print("\ngh CLI не знайдено — додайте секрети вручну "
          "(Settings → Secrets and variables → Actions):\n")
    print(f"INSTAGRAM_USERNAME = {username}\n")
    print(f"INSTAGRAM_SESSION_B64 =\n{session_b64}")
