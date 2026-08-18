"""Одноразовий скрипт для генерації Instagram-сесії (instaloader).

Логін з домашнього IP виглядає для Meta як звичайний вхід; логін паролем
з IP GitHub Actions — як атака, і акаунт ловить checkpoint. Тому сесію
створюємо локально ОДИН РАЗ, а в CI передаємо її вміст через секрет.

Запустіть локально:
    cd scraper && pip install instaloader
    python gen_instagram_session.py

Скрипт залогіниться (підтримує 2FA), збереже сесію і, якщо встановлено
GitHub CLI, сам запише секрети INSTAGRAM_USERNAME та INSTAGRAM_SESSION_B64
у репозиторій. Пароль нікуди не зберігається і в секрети не потрапляє.
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

username = input("Instagram username (акаунт dityam.com.ua): ").strip().lstrip("@")
password = getpass.getpass("Пароль (не відображається): ")

L = instaloader.Instaloader(quiet=True)
try:
    L.login(username, password)
except instaloader.exceptions.TwoFactorAuthRequiredException:
    code = input("Код 2FA з застосунку/SMS: ").strip()
    L.two_factor_login(code)
except instaloader.exceptions.BadCredentialsException:
    sys.exit("❌ Неправильний логін або пароль.")
except Exception as e:
    sys.exit(f"❌ Логін не вдався: {type(e).__name__}: {e}\n"
             "Якщо це checkpoint — відкрийте instagram.com у браузері, "
             "підтвердьте вхід і запустіть скрипт ще раз.")

print("✅ Логін успішний.")

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
