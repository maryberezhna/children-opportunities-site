from utm import UTM_ORGANIZER_EMAIL, UTM_PLUS_BOT, tag_keyboard, tag_site_links, with_utm


def test_adds_tag_to_site_page():
    assert with_utm("https://dityam.com.ua/o/x", UTM_PLUS_BOT) == (
        "https://dityam.com.ua/o/x?utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus")


def test_existing_query_and_hash():
    assert with_utm("https://dityam.com.ua/konkursy?vik=10#top", UTM_PLUS_BOT) == (
        "https://dityam.com.ua/konkursy?vik=10&utm_source=telegram&utm_medium=social"
        "&utm_campaign=dityam_plus#top")


def test_leaves_foreign_admin_and_tagged_urls():
    for url in ("https://t.me/DityamPlusBot", "https://dityam.com.ua.evil.com/o/x",
                "https://dityam.com.ua/admin/edit/5", "https://dityam.com.ua/api/x",
                "https://dityam.com.ua/o/x?utm_source=instagram"):
        assert with_utm(url, UTM_PLUS_BOT) == url


def test_html_only_href_changes_and_amp_escaped():
    html = '<a href="https://dityam.com.ua/o/x">https://dityam.com.ua/o/x</a>'
    assert tag_site_links(html, UTM_ORGANIZER_EMAIL) == (
        '<a href="https://dityam.com.ua/o/x?utm_source=email&amp;utm_medium=email'
        '&amp;utm_campaign=organizer_letter">https://dityam.com.ua/o/x</a>')


def test_keyboard_tags_only_site_urls():
    kb = {"inline_keyboard": [[{"text": "Сайт", "url": "https://dityam.com.ua/o/x"},
                               {"text": "👍", "callback_data": "fb:yes"}]]}
    out = tag_keyboard(kb, UTM_PLUS_BOT)
    assert out["inline_keyboard"][0][0]["url"].endswith("utm_campaign=dityam_plus")
    assert out["inline_keyboard"][0][1] == {"text": "👍", "callback_data": "fb:yes"}
    assert tag_keyboard(kb, None) is kb
