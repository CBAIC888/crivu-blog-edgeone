#!/usr/bin/env python3
"""Build the self-contained 《世界一词的探索》 record page.

The generated page contains the manuscript, selected images, styles, scripts,
and the existing interactive museum. It can be opened directly from disk.
"""

from __future__ import annotations

import base64
import html
import io
import re
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path("/Users/cbaic/Desktop/自媒體文件/世界專題")
MANUSCRIPT = Path("/tmp/world-record.93MVYs/總稿.txt")
MUSEUM = ROOT / "private/7a531e1b4bcab1950e2214b8/index.html"
OUTPUT = ROOT / "records/world-word-history/index.html"
CARD_COVER = ROOT / "assets/img/uploads/20260723/world-word-exploration-cover.png"


GALLERY = [
    {
        "file": "素材/B_公版圖像/B01_藍色彈珠_NASA_Apollo17_1972.jpg",
        "title": "蓝色弹珠",
        "meta": "1972 · 地球",
        "caption": "阿波罗十七号拍摄的地球。现代汉语中的“世界”，常常首先令人想到这颗完整的星球。",
        "credit": "Earth: NASA/Apollo 17, AS17-148-22727 · Public Domain",
        "kind": "公版图像",
    },
    {
        "file": "素材/B_公版圖像/B02_犍陀羅坐佛_TheMet_2003.593.1_CC0.jpg",
        "title": "犍陀罗坐佛",
        "meta": "一世纪至二世纪中叶 · 犍陀罗",
        "caption": "佛教进入汉地以前，已经沿着跨地域交通与语言网络传播。造像只作时代与文化背景，不对应某次具体译经。",
        "credit": "The Metropolitan Museum of Art, 2003.593.1 · CC0",
        "kind": "馆藏图像",
    },
    {
        "file": "素材/H_生成補景/安世高1.png",
        "title": "安世高",
        "meta": "人物复原示意",
        "caption": "安世高约于东汉桓帝时期来到洛阳译经。现存材料没有可靠的写生肖像，此图仅作历史人物想象。",
        "credit": "生成图像 · 人物复原示意，不作为历史肖像证据",
        "kind": "复原示意",
    },
    {
        "file": "素材/H_生成補景/支娄迦谶2.png",
        "title": "支娄迦谶",
        "meta": "人物复原示意",
        "caption": "支娄迦谶来自月氏，约于二世纪后期在洛阳从事译经，是早期大乘佛典汉译的重要人物。",
        "credit": "生成图像 · 人物复原示意，不作为历史肖像证据",
        "kind": "复原示意",
    },
    {
        "file": "素材/H_生成補景/H03_東漢譯經協作_歷史重構示意.png",
        "title": "东汉译经协作",
        "meta": "历史重构示意",
        "caption": "外国僧人诵出或口授，通晓不同语言者转译，汉地参与者笔录、校订。具体流程因译经活动而异。",
        "credit": "生成图像 · 历史重构示意，不作为现场记录",
        "kind": "历史重构",
    },
    {
        "file": "素材/B_公版圖像/B03_約1800中國世界地圖_LoC.jpg",
        "title": "中国世界地图",
        "meta": "约1800年 · 地图",
        "caption": "十九世纪前后的世界图景，仍处在传统地理秩序与全球知识逐渐交接的时刻。",
        "credit": "China–World Map, ca. 1800, Library of Congress · Public Domain Mark",
        "kind": "公版图像",
    },
    {
        "file": "素材/B_公版圖像/B07_玄奘像_TheMet_CC0.jpg",
        "title": "玄奘像",
        "meta": "人物画",
        "caption": "玄奘所译《阿毗达磨俱舍论》保存了小千、中千与大千世界的层级说明。",
        "credit": "Portrait of Xuanzang, The Metropolitan Museum of Art · CC0",
        "kind": "馆藏图像",
    },
    {
        "file": "素材/B_公版圖像/B08_馬禮遜像_GeorgeChinnery_公版.jpg",
        "title": "马礼逊像",
        "meta": "十九世纪 · 中西译词",
        "caption": "马礼逊一八二二年出版的《华英字典》，已在 world 条目下列出“世界”等中文表达。",
        "credit": "Attributed to George Chinnery · Public Domain",
        "kind": "公版图像",
    },
    {
        "file": "素材/D_文獻原頁/D01_後漢書_西域傳_世傳夢金人.png",
        "title": "《后汉书·西域传》原页",
        "meta": "佛教初传记载",
        "caption": "“世传明帝梦见金人”只能说明至迟在五世纪，正史已经收录了这则后世传说。",
        "credit": "《后汉书·西域传》录文页 · 文献原页",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D02_後漢書_楚王英傳_伊蒲塞桑門.png",
        "title": "《后汉书·楚王英传》原页",
        "meta": "永平八年 · 公元65年",
        "caption": "诏书中的“伊蒲塞”与“桑门”，为汉地上层社会出现佛教活动提供了较具体的早期材料。",
        "credit": "《后汉书·楚王英传》录文页 · 文献原页",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D25b_馬禮遜華英字典_WORLD原頁_1822.png",
        "title": "马礼逊《华英字典》WORLD 条",
        "meta": "1822 · 辞书原页",
        "caption": "world 条下已经列出“地球”“普天下”“世间”“世界”等中文表达。",
        "credit": "Robert Morrison, A Dictionary of the Chinese Language · Public Domain scan",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D26c_羅存德英華字典_WORLD原頁_1866-1869.png",
        "title": "罗存德《英华字典》WORLD 条",
        "meta": "1866—1869 · 辞书原页",
        "caption": "罗存德在 world 条下并列“世”“世界”“天下”“寰宇”等译词。",
        "credit": "Wilhelm Lobscheid, English and Chinese Dictionary · Public Domain scan",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D27a_天下萬國世界_論文首頁.png",
        "title": "《从“天下”“万国”到“世界”》首页",
        "meta": "2006 · 研究论文",
        "caption": "金观涛、刘青峰以近代中文文献词频，讨论晚清政治语言中的“世界”转折。",
        "credit": "《二十一世纪》总第94期 · 论文首页，仅作研究依据说明",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D27b_天下萬國世界_詞頻段落.png",
        "title": "“天下、万国、世界”词频段落",
        "meta": "1830—1926 · 语料趋势",
        "caption": "论文所述趋势显示，一八九五年后“世界”使用增加，并逐渐超过“万国”与“天下”。",
        "credit": "金观涛、刘青峰论文节录 · 仅呈现原文所述相对趋势",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D28a_Nattier_論文首頁.png",
        "title": "Nattier 早期汉译佛典研究",
        "meta": "2008 · 研究文献",
        "caption": "Jan Nattier 对东汉、三国早期汉译佛典及传统译者署名进行了系统辨析。",
        "credit": "A Guide to the Earliest Chinese Buddhist Translations · 研究文献首页",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D33a_早期中國佛經譯者_論文首頁.png",
        "title": "早期中国佛经译者研究",
        "meta": "2015 · 翻译史研究",
        "caption": "研究讨论早期译经者、参与者及翻译程序，为“协作性翻译”的判断提供背景。",
        "credit": "Early Chinese Buddhist Translators · 研究论文首页",
        "kind": "文献原页",
    },
    {
        "file": "素材/D_文獻原頁/D34a_Karashima_詞表首頁.png",
        "title": "支娄迦谶译词表首页",
        "meta": "2011 · 译词研究",
        "caption": "Karashima 的译词表帮助核对早期汉译中 loka、lokadhātu 等词语的使用与对应。",
        "credit": "Seishi Karashima, A Glossary of Lokakṣema’s Translation · 研究文献首页",
        "kind": "文献原页",
    },
]


NOTE_LINKS = {
    1: [
        ("识典古籍录文", "https://www.shidianguji.com/zh/book/LS0003/chapter/1j7lpovv5qf5l_141"),
        ("中国哲学书电子化计划", "https://ctext.org/text.pl?if=gb&node=77782&show=parallel"),
        ("Open Library书目信息", "https://openlibrary.org/books/OL17924229M/The_Buddhist_conquest_of_China"),
    ],
    6: [
        ("中国哲学书电子化计划", "https://ctext.org/pre-qin-and-han?searchu=%E4%B8%96%E7%95%8C&reqtype=stats"),
    ],
    7: [
        ("DOI", "https://doi.org/10.3390/rel13100947"),
        ("DOI", "https://doi.org/10.2143/JA.293.2.2011780"),
    ],
    8: [
        ("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0313_001"),
        ("IRIAB全文PDF", "https://iriab.soka.ac.jp/content/pdf/bppb/Vol.%20X.%20J.%20Nattier,%20A%20Guide%20to%20the%20Earliest%20Chinese%20Buddhist%20Translations%20Texts%20from%20the%20Eastern%20Han%20and%20Three%20Kingdoms%20Periods%20(2008)%20ISBN%20978-4-904234-00-6.pdf"),
        ("书目信息", "https://buddhism.lib.ntu.edu.tw/en/search/search_detail.jsp?seq=281552"),
    ],
    9: [("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0417_001")],
    10: [("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0222_001")],
    11: [("全文PDF", "https://glossaries.dila.edu.tw/data/lokaksema.dila.pdf")],
    12: [
        ("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0235_001"),
        ("GRETIL梵本", "https://gretil.sub.uni-goettingen.de/gretil/1_sanskr/4_rellit/buddh/vchedppu.htm"),
    ],
    13: [
        ("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0262_001"),
        ("GRETIL梵本", "https://gretil.sub.uni-goettingen.de/gretil/corpustei/transformations/html/sa_saddharmapuNDarIkasUtra.htm"),
    ],
    14: [("CBETA", "https://cbetaonline.dila.edu.tw/zh/T0224_003")],
    15: [
        ("卷一题署及异文", "https://cbetaonline.dila.edu.tw/zh/T0945_001"),
        ("卷四原文", "https://cbetaonline.dila.edu.tw/zh/T0945_004"),
    ],
    16: [
        ("DOI", "https://doi.org/10.3390/rel13060474"),
        ("Routledge", "https://www.taylorfrancis.com/chapters/edit/10.4324/9781003434917-3/chinese-tibetan-sources-dh%C4%81ra%E1%B9%87%C4%AB-roll-seven-%C5%9B%C5%ABra%E1%B9%83gama-s%C5%ABtra-george-keyworth"),
    ],
    17: [("CBETA", "https://cbetaonline.dila.edu.tw/zh/T1558_011")],
    22: [
        ("Internet Archive扫描页", "https://archive.org/details/b2201178x_0006/page/n490/mode/1up"),
        ("Internet Archive扫描页", "https://archive.org/details/lobscheid-english-and-chinese-dictionary-1866-69-volumes-1-4/page/n2020/mode/1up"),
    ],
    23: [("全文PDF", "https://www.cuhk.edu.hk/ics/21c/media/articles/c094-200511104.pdf")],
}


def image_data(path: Path, max_side: int, quality: int = 78) -> str:
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        output = io.BytesIO()
        image.save(output, "WEBP", quality=quality, method=6)
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    return f"data:image/webp;base64,{encoded}"


def write_card_cover(source: Path) -> None:
    CARD_COVER.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw)
        image.thumbnail((900, 1200), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        image.save(CARD_COVER, "PNG", optimize=True)


def inline_note_refs(text: str, notes: bool = False, note_number: int | None = None) -> str:
    escaped = html.escape(text, quote=True)
    if notes:
        remaining = list(NOTE_LINKS.get(note_number or 0, []))

        def source_link(match: re.Match[str]) -> str:
            matched_label = match.group(1)
            for index, (label, url) in enumerate(remaining):
                if label != matched_label:
                    continue
                remaining.pop(index)
                return (
                    f'<a class="note-source" href="{html.escape(url, quote=True)}" '
                    f'target="_blank" rel="noopener noreferrer" aria-label="打开来源：{html.escape(label, quote=True)}">'
                    f'[{html.escape(label)}]</a>'
                )
            return match.group(0)

        return re.sub(r"\[([^\]]+)\]", source_link, escaped)
    return re.sub(
        r"\[(\d+)\]",
        lambda match: f'<a class="note-ref" href="#note-{match.group(1)}" aria-label="查看注释 {match.group(1)}">[{match.group(1)}]</a>',
        escaped,
    )


def article_html(text: str) -> tuple[str, str]:
    lines = [line.replace("\u00a0", " ").strip() for line in text.replace("\r\n", "\n").split("\n")]
    if lines:
        lines = lines[1:]

    parts: list[str] = []
    toc: list[str] = []
    section_number = 0
    in_notes = False

    for line in lines:
        if not line:
            continue
        if line == "引言":
            parts.append('<section class="article-section" id="article-intro"><p class="section-index">序</p><h2>引言</h2>')
            toc.append('<a href="#article-intro"><span>序</span>引言</a>')
            continue
        if re.match(r"^[一二三四五六七八九十]+、", line):
            if parts:
                parts.append("</section>")
            section_number += 1
            section_id = f"article-{section_number:02d}"
            title = html.escape(line)
            parts.append(
                f'<section class="article-section" id="{section_id}"><p class="section-index">{section_number:02d}</p><h2>{title}</h2>'
            )
            toc.append(f'<a href="#{section_id}"><span>{section_number:02d}</span>{title}</a>')
            continue
        if line == "参考注释":
            if parts:
                parts.append("</section>")
            in_notes = True
            parts.append('<section class="article-section article-notes" id="article-notes"><p class="section-index">附</p><h2>参考注释</h2>')
            toc.append('<a href="#article-notes"><span>附</span>参考注释</a>')
            continue

        note_match = re.match(r"^\[(\d+)\]\s*(.*)$", line) if in_notes else None
        if note_match:
            number, body = note_match.groups()
            parts.append(
                f'<p class="note" id="note-{number}"><a class="note-number" href="#article" aria-label="返回正文">[{number}]</a>{inline_note_refs(body, notes=True, note_number=int(number))}</p>'
            )
            continue

        css_class = ""
        if line.startswith("佛教没有创造「世」"):
            css_class = ' class="article-conclusion"'
        parts.append(f"<p{css_class}>{inline_note_refs(line)}</p>")

    if parts:
        parts.append("</section>")
    return "\n".join(parts), "\n".join(toc)


def main() -> None:
    if not MANUSCRIPT.exists():
        raise SystemExit(f"Missing exported manuscript: {MANUSCRIPT}")

    manuscript = MANUSCRIPT.read_text(encoding="utf-8")
    article, toc = article_html(manuscript)
    museum_payload = base64.b64encode(MUSEUM.read_bytes()).decode("ascii")

    cover_path = SOURCE_ROOT / "封面/世界_繁體版.png"
    cover = image_data(cover_path, 1800, 82)
    write_card_cover(cover_path)

    gallery_items = []
    for index, item in enumerate(GALLERY):
        is_document = item["kind"] == "文献原页"
        data = image_data(SOURCE_ROOT / item["file"], 2200 if is_document else 1900, 84 if is_document else 78)
        gallery_items.append(
            f'''<figure class="archive-card" data-archive-card>
              <button class="archive-image" type="button" data-lightbox-index="{index}" aria-label="放大查看：{html.escape(item['title'])}">
                <img src="{data}" alt="{html.escape(item['title'])}" loading="lazy" decoding="async">
              </button>
              <figcaption>
                <span class="archive-kind">{html.escape(item['kind'])}</span>
                <h3>{html.escape(item['title'])}</h3>
                <p class="archive-meta">{html.escape(item['meta'])}</p>
                <p>{html.escape(item['caption'])}</p>
                <small>{html.escape(item['credit'])}</small>
              </figcaption>
            </figure>'''
        )

    document = rf'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <meta name="description" content="从先秦两汉的旧字、东汉译经与佛教宇宙论出发，追索「世界」一词近两千年的形成、传播与意义变化。">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#f1ede3">
  <meta property="og:type" content="article">
  <meta property="og:title" content="「世界」一词真的是佛教带进汉语的吗？">
  <meta property="og:description" content="从先秦两汉的旧字、东汉译经与佛教宇宙论出发，追索「世界」一词近两千年的形成、传播与意义变化。">
  <meta property="og:url" content="https://cbc688.com/records/world-word-history/">
  <meta property="og:site_name" content="CRIVU">
  <meta property="og:image" content="https://cbc688.com/assets/img/uploads/20260723/world-word-exploration-cover.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="「世界」一词真的是佛教带进汉语的吗？">
  <meta name="twitter:description" content="从先秦两汉的旧字、东汉译经与佛教宇宙论出发，追索「世界」一词近两千年的形成、传播与意义变化。">
  <meta name="twitter:image" content="https://cbc688.com/assets/img/uploads/20260723/world-word-exploration-cover.png">
  <title>「世界」一词真的是佛教带进汉语的吗？ · CRIVU</title>
  <link rel="canonical" href="https://cbc688.com/records/world-word-history/">
  <link rel="alternate" type="application/rss+xml" title="CRIVU RSS" href="/rss.xml">
  <script>
    (() => {{
      try {{
        const saved = localStorage.getItem('crivu-theme');
        document.documentElement.dataset.theme = ['white','light','dark'].includes(saved) ? saved : 'white';
      }} catch {{ document.documentElement.dataset.theme = 'white'; }}
    }})();
  </script>
  <style>
    :root {{
      --serif:"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif;
      --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans CJK SC",sans-serif;
    }}
    :root[data-theme="white"] {{
      --paper:#fff; --paper-deep:#f3f1ec; --ink:#151513; --muted:#69675f;
      --line:rgba(25,24,20,.16); --gold:#8c672b; --gold-light:#c4a66c; --night:#151713;
      --chrome:rgba(255,255,255,.9); --soft:#f6f4ef; --field:#fff;
      --nav-bg:rgba(255,255,255,.76); --nav-bg-fallback:rgba(255,255,255,.96); --nav-ink:#1a1814;
      --nav-ink-dim:rgba(26,24,20,.58); --nav-line:rgba(26,24,20,.1); --nav-field:rgba(26,24,20,.04); --nav-field-focus:rgba(26,24,20,.08);
      --dropdown-bg:#fff; --comments-panel-bg:#e9e8e6; --comments-panel-field:rgba(255,255,255,.76);
    }}
    :root[data-theme="light"] {{
      --paper:#f1ede3; --paper-deep:#e5ddcd; --ink:#171714; --muted:#6f6b61;
      --line:rgba(31,30,25,.18); --gold:#8c672b; --gold-light:#c4a66c; --night:#11130f;
      --chrome:rgba(241,237,227,.9); --soft:#e9e1d2; --field:#f7f2e8;
      --nav-bg:rgba(245,241,232,.72); --nav-bg-fallback:rgba(245,241,232,.95); --nav-ink:#1a1814;
      --nav-ink-dim:rgba(26,24,20,.58); --nav-line:rgba(26,24,20,.1); --nav-field:rgba(26,24,20,.04); --nav-field-focus:rgba(26,24,20,.08);
      --dropdown-bg:#fbf8f1; --comments-panel-bg:#ded3bf; --comments-panel-field:rgba(255,252,244,.76);
    }}
    :root[data-theme="dark"] {{
      --paper:#171815; --paper-deep:#20211d; --ink:#eee9df; --muted:#aaa59a;
      --line:rgba(238,233,223,.16); --gold:#d1aa62; --gold-light:#dfbb74; --night:#090a08;
      --chrome:rgba(23,24,21,.91); --soft:#22231f; --field:#1d1e1a;
      --nav-bg:rgba(20,22,23,.7); --nav-bg-fallback:rgba(20,22,23,.95); --nav-ink:#e8e2d4;
      --nav-ink-dim:rgba(232,226,212,.55); --nav-line:rgba(232,226,212,.1); --nav-field:rgba(255,255,255,.06); --nav-field-focus:rgba(255,255,255,.11);
      --dropdown-bg:#1a1d1f; --comments-panel-bg:#252b2c; --comments-panel-field:rgba(15,17,18,.58);
    }}
    * {{ box-sizing:border-box; }}
    html {{ scroll-behavior:smooth; color-scheme:light; background:var(--paper); }}
    :root[data-theme="dark"] {{ color-scheme:dark; }}
    body {{ margin:0; min-width:320px; padding-top:92px; color:var(--ink); background:var(--paper); font-family:var(--serif); transition:color .25s ease,background .25s ease; }}
    button,a {{ color:inherit; font:inherit; }}
    a {{ text-decoration-thickness:1px; text-underline-offset:4px; }}
    button {{ cursor:pointer; }}
    button:focus-visible,a:focus-visible {{ outline:2px solid var(--gold); outline-offset:4px; }}
    [hidden] {{ display:none!important; }}
    .skip-link {{ position:fixed; left:16px; top:-80px; z-index:200; padding:10px 14px; background:var(--ink); color:white; }}
    .skip-link:focus {{ top:12px; }}
    .reading-progress {{ position:fixed; z-index:195; left:0; top:91px; width:0; height:1px; background:var(--gold); }}
    .site-header {{ position:fixed; inset:0 0 auto; z-index:200; height:56px; color:var(--nav-ink); border-bottom:1px solid var(--nav-line); background:var(--nav-bg-fallback); font-family:"Helvetica Neue","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif; backdrop-filter:saturate(160%) blur(14px); }}
    @supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))) {{ .site-header {{ background:var(--nav-bg); }} }}
    .site-header__inner {{ max-width:1180px; height:100%; display:flex; align-items:center; gap:24px; margin:0 auto; padding:0 24px; }}
    .site-header__brand {{ flex:none; padding-right:.18em; color:var(--nav-ink); text-decoration:none; font-family:"Iowan Old Style","Palatino Linotype","Noto Serif SC","Source Han Serif SC","Songti SC","STSong","PingFang SC",serif; font-size:19px; font-weight:600; line-height:1.75; letter-spacing:.18em; }}
    .site-header__nav {{ display:flex; align-items:center; gap:4px; margin-left:8px; }}
    .site-header__nav a {{ padding:6px 12px; border-radius:3px; color:var(--nav-ink-dim); text-decoration:none; font-family:"Helvetica Neue","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif; font-size:12px; font-weight:500; line-height:1.75; letter-spacing:.18em; transition:background .15s,color .15s; }}
    .site-header__nav a:hover {{ color:var(--nav-ink); background:var(--nav-field); }}
    .site-header__nav a.active {{ color:var(--nav-ink); background:var(--nav-field-focus); }}
    .site-header__actions {{ display:flex; align-items:center; gap:10px; margin-left:auto; }}
    .site-header__search {{ position:relative; }}
    .site-header__search .icon {{ position:absolute; left:12px; top:50%; width:14px; height:14px; border:1.5px solid currentColor; border-radius:50%; opacity:.55; pointer-events:none; transform:translateY(-50%); }}
    .site-header__search .icon::after {{ content:""; position:absolute; top:100%; left:100%; width:7px; height:1.5px; background:currentColor; transform:translate(-3px,-3px) rotate(45deg); transform-origin:0 0; }}
    .site-header__search input {{ width:208px; padding:7px 12px 7px 34px; border:1px solid var(--nav-line); border-radius:4px; color:var(--nav-ink); background:var(--nav-field); font-family:"Helvetica Neue","PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif; font-size:13px; line-height:1.75; letter-spacing:.04em; transition:background .2s,border-color .2s,width .2s; }}
    .site-header__search input::placeholder {{ color:var(--nav-ink-dim); }}
    .site-header__search input:focus {{ width:244px; outline:0; border-color:var(--line); background:var(--nav-field-focus); }}
    .search-results {{ position:absolute; top:calc(100% + 10px); right:0; z-index:210; display:none; width:380px; max-height:440px; overflow:auto; border:1px solid var(--nav-line); border-radius:4px; background:var(--dropdown-bg); box-shadow:0 18px 40px -20px rgba(0,0,0,.45); }}
    .search-results.is-open {{ display:block; }}
    .search-empty {{ padding:18px 20px; color:var(--muted); font:13px/1.6 var(--sans); }}
    .search-hit {{ display:block; padding:13px 17px; border-bottom:1px solid var(--line); color:var(--ink); text-decoration:none; }} .search-hit:last-child {{ border-bottom:0; }} .search-hit:hover {{ background:var(--nav-field); }}
    .search-hit__title {{ display:block; margin-bottom:3px; font:500 15px/1.45 var(--serif); }} .search-hit__meta {{ color:var(--muted); font:10px/1.5 var(--sans); letter-spacing:.1em; }}
    .theme-toggle,.mobile-menu-toggle {{ width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:1px solid var(--nav-line); border-radius:4px; color:var(--nav-ink); background:var(--nav-field); transition:background .2s,border-color .2s,transform .2s; }}
    .theme-toggle:hover,.mobile-menu-toggle:hover {{ background:var(--nav-field-focus); }}
    .theme-toggle:active,.mobile-menu-toggle:active {{ transform:scale(.94); }}
    .theme-toggle svg {{ width:16px; height:16px; }}
    .mobile-menu-toggle svg {{ width:18px; height:18px; }}
    .theme-toggle .sun {{ display:none; }}
    :root[data-theme="light"] .theme-toggle .sun,:root[data-theme="dark"] .theme-toggle .sun {{ display:block; }}
    :root[data-theme="light"] .theme-toggle .moon,:root[data-theme="dark"] .theme-toggle .moon {{ display:none; }}
    .mobile-menu-toggle {{ display:none; }}
    .record-nav {{ position:fixed; z-index:190; left:0; right:0; top:56px; height:36px; display:flex; align-items:stretch; justify-content:center; gap:2px; border-bottom:1px solid var(--nav-line); background:var(--nav-bg-fallback); font-family:var(--sans); backdrop-filter:saturate(150%) blur(12px); }}
    @supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))) {{ .record-nav {{ background:var(--nav-bg); }} }}
    .record-nav button {{ min-width:78px; padding:0 13px; border:0; border-bottom:1px solid transparent; color:var(--nav-ink-dim); background:transparent; font:600 9px/35px var(--sans); letter-spacing:.12em; }}
    .record-nav button:hover {{ color:var(--nav-ink); background:var(--nav-field); }}
    .record-nav button[aria-current="page"] {{ color:var(--nav-ink); border-bottom-color:var(--gold); }}
    .hero {{ position:relative; min-height:calc(88svh - 92px); display:grid; grid-template-columns:minmax(330px,.98fr) minmax(320px,.72fr); align-items:center; gap:clamp(38px,7vw,108px); padding:clamp(30px,4vw,58px) max(6vw,42px) clamp(68px,7vw,104px); overflow:hidden; background:linear-gradient(135deg,var(--paper) 0 58%,var(--paper-deep) 58%); }}
    .hero::before {{ content:"世"; position:absolute; right:-.03em; bottom:-.31em; color:rgba(78,63,36,.045); font-size:min(70vw,900px); line-height:1; pointer-events:none; }}
    .hero-copy {{ position:relative; z-index:1; width:min(690px,100%); justify-self:end; }}
    .hero h1 {{ margin:0; font-size:clamp(3.6rem,7.4vw,8.4rem); font-weight:500; line-height:.92; letter-spacing:-.075em; }}
    .hero h1 span {{ display:block; margin-top:.1em; color:transparent; -webkit-text-stroke:1px var(--ink); transform:translateX(clamp(24px,6vw,92px)); }}
    .hero-deck {{ margin:36px 0 0; max-width:38em; color:var(--muted); font-size:clamp(1rem,1.3vw,1.18rem); line-height:1.95; }}
    .hero-deck a {{ color:var(--gold); font-weight:600; }}
    .hero-actions {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:32px; }}
    .primary-action,.secondary-action {{ min-height:46px; padding:0 20px; border:1px solid var(--ink); border-radius:999px; font:650 12px/1 var(--sans); letter-spacing:.08em; }}
    .primary-action {{ color:var(--paper); background:var(--ink); }}
    .secondary-action {{ background:transparent; }}
    .hero-side {{ position:relative; z-index:1; width:min(460px,100%); align-self:center; justify-self:start; }}
    .hero-cover {{ position:relative; width:min(430px,100%); margin:0 auto; }}
    .hero-cover::before {{ content:""; position:absolute; inset:5% -6% -6% 7%; border:1px solid var(--line); }}
    .hero-cover img {{ position:relative; display:block; width:100%; height:auto; object-fit:contain; filter:saturate(.86) contrast(1.03); box-shadow:0 22px 54px rgba(43,38,27,.16); }}
    .hero-cover figcaption {{ margin-top:10px; color:var(--muted); font:500 9px/1.55 var(--sans); letter-spacing:.05em; }}
    .comments-band {{ padding:26px max(5vw,28px) 0; background:var(--paper); }}
    .comments-entry {{ width:min(1080px,100%); display:grid; grid-template-columns:minmax(120px,.34fr) minmax(0,1.3fr) auto; align-items:center; gap:20px; margin:0 auto; padding:16px 18px; overflow:hidden; border:1px solid var(--line); border-radius:12px; color:var(--ink); background:var(--soft); box-shadow:0 9px 28px rgba(43,38,27,.07); text-align:left; transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease; }}
    .comments-entry:hover {{ border-color:color-mix(in srgb,var(--gold) 38%,var(--line)); box-shadow:0 13px 32px rgba(43,38,27,.1); transform:translateY(-1px); }}
    .comments-entry__head {{ display:grid; gap:7px; font-family:var(--sans); }}
    .comments-entry__title {{ display:flex; align-items:center; gap:8px; font-size:11px; font-weight:700; letter-spacing:.12em; }}
    .comments-entry__title::before {{ content:"“"; width:24px; height:24px; display:grid; place-items:center; border-radius:50%; color:var(--gold); background:color-mix(in srgb,var(--gold) 12%,transparent); font:600 16px/1 var(--serif); }}
    .comments-entry__count {{ color:var(--muted); font-size:9px; font-weight:600; letter-spacing:.04em; }}
    .comments-entry__previews {{ min-width:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }}
    .comments-entry__preview {{ display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:8px; min-width:0; padding:9px 11px; border:1px solid var(--line); border-radius:8px; background:var(--comments-panel-field); font-family:var(--sans); }}
    .comments-entry__preview strong {{ max-width:7em; overflow:hidden; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }}
    .comments-entry__preview em {{ min-width:0; overflow:hidden; color:var(--muted); font-size:9px; font-style:normal; text-overflow:ellipsis; white-space:nowrap; }}
    .comments-entry__empty {{ grid-column:1/-1; padding:9px 11px; border:1px dashed var(--line); border-radius:8px; color:var(--muted); background:var(--comments-panel-field); font:500 10px/1.5 var(--sans); }}
    .comments-entry__foot {{ display:flex; align-items:center; gap:12px; padding-left:18px; border-left:1px solid var(--line); color:var(--gold); font:700 9px/1.4 var(--sans); letter-spacing:.08em; white-space:nowrap; }}
    .comments-entry__foot span:last-child {{ font-size:15px; }}
    .comments-sheet {{ position:fixed; z-index:260; inset:0; display:grid; align-items:end; background:rgba(8,9,7,.46); backdrop-filter:blur(3px); }}
    .comments-sheet__panel {{ height:min(62svh,650px); min-height:430px; overflow:hidden; border-top:1px solid var(--line); border-radius:16px 16px 0 0; background:var(--comments-panel-bg); box-shadow:0 -24px 70px rgba(0,0,0,.24); }}
    .comments-sheet__inner {{ width:min(980px,100%); height:100%; display:grid; grid-template-rows:auto minmax(0,1fr); margin:0 auto; padding:20px 28px 24px; }}
    .comments-sheet__top {{ display:flex; align-items:center; justify-content:space-between; gap:20px; padding-bottom:15px; border-bottom:1px solid var(--line); }}
    .comments-sheet__top h2 {{ margin:0; font-size:clamp(1.35rem,2vw,1.8rem); font-weight:500; }}
    .comments-sheet__close {{ width:32px; height:32px; border:1px solid var(--line); border-radius:50%; color:var(--ink); background:transparent; font:400 20px/1 var(--sans); }}
    .comments-compact {{ min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); color:var(--ink); }}
    .comments-compact__head {{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:9px; }}
    .comments-compact__head h3 {{ margin:0; font:650 10px/1 var(--sans); letter-spacing:.13em; }}
    .comments-compact__count {{ color:var(--muted); font:600 9px/1 var(--sans); white-space:nowrap; }}
    .comments-mobile-tabs {{ display:none; }}
    .comments-compact__body {{ min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(320px,.82fr); gap:24px; padding-top:12px; }}
    .comments-compact__list {{ min-height:0; overflow:auto; padding-right:12px; border-right:1px solid var(--line); scrollbar-width:thin; }}
    .comments-compact__list .comments__empty {{ margin:0; padding:14px 13px; border:1px dashed var(--line); border-radius:9px; color:var(--muted); background:var(--comments-panel-field); font:500 11px/1.5 var(--sans); }}
    .comments-compact__list .comment-item {{ margin:0 0 9px; padding:11px 13px 12px; border:1px solid var(--line); border-radius:9px; background:var(--comments-panel-field); box-shadow:0 6px 18px rgba(35,31,24,.06); }}
    .comments-compact__list .comment-item:last-child {{ margin-bottom:0; }}
    .comments-compact__list .comment-item__head {{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 7px; font-family:var(--sans); }}
    .comments-compact__list .comment-item__head strong {{ display:flex; align-items:center; gap:7px; font-size:11px; }}
    .comments-compact__list .comment-item__head strong::before {{ content:""; width:5px; height:5px; border-radius:50%; background:var(--gold); }}
    .comments-compact__list .comment-item__head time {{ color:var(--muted); font-size:9px; white-space:nowrap; }}
    .comments-compact__list .comment-item p {{ margin:0; color:var(--ink); font-size:12px; line-height:1.62; white-space:pre-wrap; overflow-wrap:anywhere; }}
    .comments-compact__form {{ position:relative; display:grid; align-content:start; gap:10px; padding:14px; border:1px solid var(--line); border-radius:10px; background:var(--comments-panel-field); overflow:auto; }}
    .comments-compact__fields {{ display:grid; grid-template-columns:1fr 1fr; gap:7px; }}
    .comments-compact label {{ display:grid; gap:3px; color:var(--muted); font:600 8px/1.2 var(--sans); letter-spacing:.06em; }}
    .comments-compact input,.comments-compact textarea {{ width:100%; padding:7px 9px; border:1px solid var(--line); border-radius:5px; color:var(--ink); background:var(--comments-panel-bg); font:11px/1.35 var(--sans); }}
    .comments-compact textarea {{ height:48px; min-height:48px; resize:none; }}
    .comments-compact .comments-compact__trap {{ position:absolute; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none; }}
    .comments-compact input:focus,.comments-compact textarea:focus {{ outline:1px solid var(--gold); outline-offset:0; }}
    .comments-compact__verification {{ display:grid; gap:5px; color:var(--muted); font:600 8px/1.35 var(--sans); letter-spacing:.05em; }}
    .comments-compact__turnstile {{ min-height:0; max-width:100%; overflow:hidden; }}
    .comments-compact__actions {{ display:flex; align-items:center; justify-content:space-between; gap:10px; }}
    .comments-compact__actions button {{ min-height:28px; padding:0 11px; border:0; border-radius:4px; color:var(--paper); background:var(--ink); font:650 9px/1 var(--sans); letter-spacing:.08em; }}
    .comments-compact__actions button:disabled {{ cursor:wait; opacity:.55; }}
    .comments-compact__status {{ min-width:0; margin:0; overflow:hidden; color:var(--muted); font:550 8px/1.4 var(--sans); text-overflow:ellipsis; white-space:nowrap; }}
    .comments-compact__status[data-tone="success"] {{ color:#3f7550; }} .comments-compact__status[data-tone="error"] {{ color:#a54949; }}
    .article-layout {{ display:grid; grid-template-columns:minmax(210px,280px) minmax(0,760px); justify-content:center; align-items:start; gap:clamp(44px,8vw,126px); padding:clamp(84px,10vw,150px) max(5vw,28px); }}
    .article-toc {{ position:sticky; top:116px; align-self:start; max-height:calc(100vh - 144px); overflow:auto; padding-right:20px; }}
    .article-toc h2 {{ margin:0 0 22px; color:var(--muted); font:650 10px/1 var(--sans); letter-spacing:.22em; }}
    .article-toc a {{ display:grid; grid-template-columns:30px 1fr; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); color:var(--muted); text-decoration:none; font-size:13px; line-height:1.5; }}
    .article-toc a span {{ color:var(--gold); font:600 10px/1.6 var(--sans); }}
    .mobile-toc {{ display:none; }}
    .article {{ min-width:0; }}
    .article-label {{ margin:0 0 70px; color:var(--muted); font:600 11px/1 var(--sans); letter-spacing:.18em; }}
    .article-section {{ scroll-margin-top:90px; margin-bottom:110px; }}
    .article-section .section-index {{ margin:0 0 18px; color:var(--gold); font:650 11px/1 var(--sans); letter-spacing:.22em; }}
    .article-section h2 {{ margin:0 0 34px; font-size:clamp(1.55rem,2.7vw,2.35rem); font-weight:500; line-height:1.3; letter-spacing:-.025em; }}
    .article-section>p {{ margin:0 0 1.12em; font-size:clamp(1.04rem,1.3vw,1.16rem); line-height:2.02; text-align:justify; text-justify:inter-ideograph; }}
    .note-ref {{ margin-left:.08em; color:var(--gold); text-decoration:none; font:600 .68em/1 var(--sans); vertical-align:super; }}
    .article-conclusion {{ margin:54px -38px!important; padding:34px 38px; border-left:2px solid var(--gold); background:var(--soft); font-size:clamp(1.15rem,1.7vw,1.42rem)!important; line-height:1.9!important; }}
    .article-notes {{ margin-bottom:0; padding-top:22px; border-top:1px solid var(--line); }}
    .article-notes .note {{ position:relative; padding-left:38px; color:var(--muted); font:400 .88rem/1.85 var(--sans); text-align:left; }}
    .note-number {{ position:absolute; left:0; color:var(--gold); text-decoration:none; }}
    .note-source {{ color:var(--gold); text-decoration-color:color-mix(in srgb,var(--gold) 44%,transparent); }}
    .note-source:hover {{ color:var(--ink); text-decoration-color:var(--ink); }}
    .archive {{ padding:clamp(82px,10vw,150px) max(5vw,36px); color:#ede7d9; background:var(--night); }}
    .archive-head {{ max-width:1320px; margin:0 auto 72px; }}
    .archive-kicker {{ margin:0 0 18px; color:var(--gold-light); font:650 11px/1 var(--sans); letter-spacing:.22em; }}
    .archive-head h2 {{ margin:0; font-size:clamp(2.8rem,6.5vw,6.4rem); font-weight:500; line-height:.95; letter-spacing:-.055em; }}
    .archive-grid {{ display:grid; grid-template-columns:repeat(12,1fr); gap:clamp(28px,5vw,72px) 22px; max-width:1320px; margin:0 auto; }}
    .archive-card {{ grid-column:span 4; margin:0; }}
    .archive-card:nth-child(5n+1),.archive-card:nth-child(5n+4) {{ grid-column:span 7; }}
    .archive-card:nth-child(5n+2),.archive-card:nth-child(5n+5) {{ grid-column:span 5; }}
    .archive-image {{ display:block; width:100%; padding:0; overflow:hidden; border:0; background:#23231e; }}
    .archive-image img {{ display:block; width:100%; height:auto; object-fit:contain; filter:saturate(.82); transition:transform .6s cubic-bezier(.22,1,.36,1),filter .3s ease; }}
    .archive-image:hover img {{ transform:scale(1.025); filter:saturate(1); }}
    .archive-card figcaption {{ padding-top:20px; }}
    .archive-kind {{ display:inline-block; margin-bottom:12px; color:var(--gold-light); font:650 10px/1 var(--sans); letter-spacing:.15em; }}
    .archive-card h3 {{ margin:0; font-size:clamp(1.35rem,2.2vw,2rem); font-weight:500; }}
    .archive-meta {{ color:#999284!important; font:500 11px/1.4 var(--sans)!important; letter-spacing:.08em; }}
    .archive-card p {{ margin:12px 0 0; color:#c3bcad; font-size:.93rem; line-height:1.78; }}
    .archive-card small {{ display:block; margin-top:13px; color:#817b70; font:500 10px/1.65 var(--sans); }}
    .record-footer {{ display:flex; justify-content:space-between; gap:24px; padding:34px max(5vw,36px); color:#8e887b; background:var(--night); border-top:1px solid rgba(255,255,255,.1); font:500 11px/1.6 var(--sans); }}
    .museum-shell {{ position:fixed; z-index:160; inset:0; display:grid; grid-template-rows:48px 1fr; background:#0d0f0c; }}
    .museum-bar {{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:0 14px; color:#ded6c7; border-bottom:1px solid rgba(221,180,94,.18); background:#12130f; }}
    .museum-back {{ justify-self:start; min-height:34px; padding:0 12px; border:1px solid rgba(221,180,94,.34); border-radius:999px; color:#d9cdb4; background:transparent; font:600 11px/1 var(--sans); }}
    .museum-title {{ color:#a79e8d; font:600 11px/1 var(--sans); letter-spacing:.14em; }}
    .museum-mark {{ justify-self:end; color:#ddb45e; font:600 11px/1 var(--sans); letter-spacing:.14em; }}
    #museumFrame {{ display:block; width:100%; height:100%; border:0; background:#161611; }}
    body.museum-open,body.comments-open {{ overflow:hidden; }}
    body.museum-open .site-header,body.museum-open .record-nav {{ display:none; }}
    .lightbox {{ position:fixed; z-index:220; inset:0; display:grid; grid-template-rows:1fr auto; padding:36px; background:rgba(8,9,7,.94); }}
    .lightbox-stage {{ min-height:0; display:grid; grid-template-columns:48px minmax(0,1fr) 48px; align-items:center; gap:18px; }}
    .lightbox-stage img {{ display:block; width:100%; height:100%; max-height:calc(100vh - 150px); object-fit:contain; }}
    .lightbox button {{ width:44px; height:44px; border:1px solid rgba(255,255,255,.25); border-radius:50%; color:#eee7d9; background:rgba(20,20,17,.68); font:400 24px/1 var(--sans); }}
    .lightbox-close {{ position:absolute; right:22px; top:18px; }}
    .lightbox-caption {{ margin:18px auto 0; color:#b9b2a5; font:500 12px/1.6 var(--sans); text-align:center; }}
    @media (max-width:900px) {{
      .site-header__inner {{ gap:18px; padding-inline:18px; }}
      .hero {{ grid-template-columns:1fr; min-height:auto; padding:48px 24px 68px; background:linear-gradient(155deg,var(--paper) 0 60%,var(--paper-deep) 60%); }}
      .hero-copy {{ justify-self:center; }} .hero-side {{ width:min(460px,100%); justify-self:center; }}
      .hero-cover {{ width:min(430px,82vw); }}
      .article-layout {{ grid-template-columns:1fr; padding-inline:24px; }} .article-toc {{ position:relative; top:auto; max-height:none; padding:22px; border:1px solid var(--line); }}
      .archive-card:nth-child(n) {{ grid-column:span 6; }}
    }}
    @media (max-width:760px) {{
      .site-header__inner {{ position:relative; gap:7px; padding:0 24px; }}
      .site-header__brand {{ padding-right:.18em; font-size:16px; letter-spacing:.12em; }}
      .site-header__nav {{ min-width:0; flex:1 1 auto; justify-content:space-evenly; gap:0; margin-left:0; }}
      .site-header__nav a {{ padding:5px 3px; font-size:10px; letter-spacing:.04em; white-space:nowrap; }}
      .site-header__nav a[href="/"],.site-header__nav a[href="/rss.xml"] {{ display:none; }}
      .site-header__actions {{ flex:none; gap:6px; margin-left:0; }}
      .site-header__search {{ display:none; }} .mobile-menu-toggle {{ display:inline-flex; }}
      .theme-toggle,.mobile-menu-toggle {{ width:30px; height:30px; }}
      .site-header.mobile-menu-open .site-header__nav {{ position:absolute; top:calc(100% + 6px); left:4vw; right:4vw; display:flex; flex-direction:column; align-items:stretch; gap:4px; margin:0; padding:66px 8px 8px; border:1px solid var(--nav-line); border-radius:14px; background:var(--dropdown-bg); box-shadow:0 10px 24px -10px rgba(0,0,0,.25); z-index:80; }}
      .site-header.mobile-menu-open .site-header__nav a,.site-header.mobile-menu-open .site-header__nav a[href="/"],.site-header.mobile-menu-open .site-header__nav a[href="/rss.xml"] {{ display:flex; align-items:center; min-height:44px; padding:12px 14px; border-radius:10px; color:var(--nav-ink); font-size:14px; letter-spacing:.06em; }}
      .site-header.mobile-menu-open .site-header__search {{ position:absolute; top:calc(100% + 18px); left:calc(4vw + 9px); right:calc(4vw + 9px); z-index:81; display:block; margin:0; }}
      .site-header.mobile-menu-open .site-header__search input {{ width:100%; padding:11px 14px 11px 40px; border-radius:8px; font-size:16px; background:var(--dropdown-bg); }}
      .site-header.mobile-menu-open .site-header__search .icon {{ left:14px; opacity:1; }}
      .site-header.mobile-menu-open .search-results {{ position:absolute; top:calc(100% + 8px); left:0; right:0; width:auto; max-height:280px; }}
      .site-header.mobile-menu-open .mobile-menu-toggle .mm-line-top {{ transform:translateY(5px) rotate(45deg); transform-origin:center; }}
      .site-header.mobile-menu-open .mobile-menu-toggle .mm-line-mid {{ opacity:0; }}
      .site-header.mobile-menu-open .mobile-menu-toggle .mm-line-bot {{ transform:translateY(-5px) rotate(-45deg); transform-origin:center; }}
      .mobile-menu-toggle .mm-line {{ transition:transform .18s ease,opacity .18s ease; }}
      .site-header__search input,.comments-compact input,.comments-compact textarea {{ font-size:16px; }}
      .hero {{ grid-template-columns:minmax(0,1fr); align-content:start; padding-top:32px; padding-bottom:30px; }}
      .hero-copy,.hero-side {{ display:contents; }}
      .hero h1 {{ order:1; width:min(690px,100%); justify-self:center; font-size:clamp(3.25rem,18vw,5rem); }}
      .hero h1 span {{ transform:translateX(12px); }}
      .hero-cover {{ order:2; width:min(430px,86vw); margin-top:30px; }}
      .hero-deck {{ order:3; width:min(690px,100%); justify-self:center; margin-top:30px; line-height:1.82; }}
      .hero-actions {{ order:4; width:min(690px,100%); justify-self:center; }}
      .comments-band {{ padding:16px 18px 0; }}
      .comments-entry {{ grid-template-columns:minmax(0,1fr) auto; gap:10px 12px; padding:14px; }}
      .comments-entry__head {{ grid-column:1; grid-row:1; }}
      .comments-entry__previews {{ grid-column:1/-1; grid-row:2; grid-template-columns:1fr; }}
      .comments-entry__foot {{ grid-column:2; grid-row:1; padding:8px 10px; border:1px solid var(--line); border-radius:999px; }}
      .comments-entry__foot span:first-child {{ font-size:0; }}
      .comments-entry__foot span:first-child::after {{ content:"查看评论"; font-size:9px; }}
      .comments-sheet__panel {{ height:58dvh; min-height:0; }}
      .comments-sheet__inner {{ padding:14px 14px 16px; }}
      .comments-sheet__top {{ padding-bottom:11px; }}
      .comments-sheet__top h2 {{ font-size:1.22rem; }}
      .comments-compact {{ grid-template-rows:auto auto minmax(0,1fr); }}
      .comments-compact__head {{ margin:10px 0 7px; }}
      .comments-mobile-tabs {{ display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:3px; border:1px solid var(--line); border-radius:8px; background:var(--comments-panel-field); }}
      .comments-mobile-tabs button {{ min-height:30px; border:0; border-radius:5px; color:var(--muted); background:transparent; font:650 10px/1 var(--sans); letter-spacing:.08em; }}
      .comments-mobile-tabs button[aria-selected="true"] {{ color:var(--ink); background:var(--comments-panel-bg); box-shadow:0 2px 8px rgba(35,31,24,.08); }}
      .comments-compact__body {{ display:block; min-height:0; padding-top:9px; overflow:hidden; }}
      .comments-compact__list,.comments-compact__form {{ height:100%; }}
      .comments-compact__list {{ max-height:none; padding-right:2px; border-right:0; border-bottom:0; overflow:auto; }}
      .comments-compact__form {{ padding:11px; overflow:auto; }}
      .comments-compact__body[data-mobile-tab="list"] .comments-compact__form {{ display:none; }}
      .comments-compact__body[data-mobile-tab="form"] .comments-compact__list {{ display:none; }}
      .article-section h2 {{ margin-bottom:32px; }} .article-conclusion {{ margin-inline:0!important; padding:28px 24px; }}
      .mobile-toc {{ position:fixed; z-index:185; left:-36px; top:50%; display:block; opacity:0; pointer-events:none; transition:left .18s ease,opacity .18s ease; }}
      .mobile-toc.is-visible {{ left:0; opacity:1; pointer-events:auto; }}
      .mobile-toc__toggle {{ width:36px; min-height:68px; padding:10px 8px; border:1px solid var(--line); border-left:0; border-radius:0 9px 9px 0; color:var(--ink); background:color-mix(in srgb,var(--paper) 92%,transparent); box-shadow:8px 10px 26px rgba(35,31,24,.14); font:650 10px/1.45 var(--sans); letter-spacing:.12em; writing-mode:vertical-rl; transform:translateY(-50%); backdrop-filter:blur(12px); }}
      .mobile-toc__panel {{ position:fixed; left:9px; top:103px; bottom:18px; width:min(310px,calc(100vw - 28px)); overflow:auto; padding:15px 16px 17px; border:1px solid var(--line); border-radius:11px; color:var(--ink); background:color-mix(in srgb,var(--paper) 96%,transparent); box-shadow:0 20px 55px rgba(35,31,24,.24); backdrop-filter:blur(18px); }}
      .mobile-toc__head {{ position:sticky; top:-15px; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:16px; margin:-15px -16px 8px; padding:14px 15px 11px; border-bottom:1px solid var(--line); background:var(--paper); }}
      .mobile-toc__head strong {{ font:650 11px/1 var(--sans); letter-spacing:.16em; }}
      .mobile-toc__close {{ width:28px; height:28px; padding:0; border:1px solid var(--line); border-radius:50%; color:var(--ink); background:transparent; font:400 17px/1 var(--sans); }}
      .mobile-toc__links a {{ display:grid; grid-template-columns:28px 1fr; gap:8px; padding:9px 0; border-bottom:1px solid var(--line); color:var(--muted); text-decoration:none; font-size:12px; line-height:1.45; }}
      .mobile-toc__links a:last-child {{ border-bottom:0; }}
      .mobile-toc__links a span {{ color:var(--gold); font:650 9px/1.6 var(--sans); }}
      .archive {{ padding-inline:20px; }}
      .archive-grid {{ display:flex; flex-direction:column; gap:58px; }}
      .archive-card:nth-child(n) {{ width:100%; grid-column:auto; }}
      .archive-image {{ width:100%; overflow:visible; }}
      .archive-image img {{ width:100%; max-width:100%; height:auto; max-height:none; aspect-ratio:auto; object-fit:contain; }}
      .museum-title {{ display:none; }}
      .lightbox {{ padding:18px 8px 26px; }} .lightbox-stage {{ grid-template-columns:38px minmax(0,1fr) 38px; gap:4px; }}
      .lightbox button {{ width:36px; height:36px; }}
    }}
    @media (max-width:580px) {{
      body {{ overflow-x:hidden; }}
      .record-nav button {{ min-width:68px; padding-inline:10px; }}
      .hero {{ padding:22px 18px 30px; }}
      .hero h1 {{ font-size:clamp(3rem,17vw,4.5rem); }}
      .hero-deck {{ margin-top:27px; font-size:.98rem; }}
      .hero-actions {{ display:grid; grid-template-columns:1fr 1fr; }}
      .hero-actions .primary-action {{ grid-column:1/-1; }}
      .primary-action,.secondary-action {{ min-height:42px; padding-inline:13px; font-size:10px; }}
      .hero-cover {{ width:100%; }}
      .article-layout {{ gap:54px; padding:48px 18px 78px; }}
      .article-toc {{ padding:17px; }}
      .article-label {{ margin-bottom:44px; }}
      .article-section {{ margin-bottom:76px; }}
      .article-section>p {{ font-size:1rem; line-height:1.92; text-align:left; }}
      .article-section h2 {{ font-size:1.55rem; }}
      .article-notes .note {{ padding-left:31px; font-size:.82rem; overflow-wrap:anywhere; }}
      .archive-head {{ margin-bottom:48px; }}
      .archive-grid {{ gap:52px; }}
      .archive-card figcaption {{ padding-top:15px; }}
      .record-footer {{ display:block; padding-inline:20px; }}
    }}
    @media (max-width:420px) {{
      .comments-sheet__panel {{ height:58dvh; min-height:0; }}
      .comments-sheet__inner {{ padding:14px 10px 16px; }}
      .comments-compact__fields {{ grid-template-columns:1fr; }}
      .comments-compact__status {{ white-space:normal; }}
    }}
    @media (prefers-reduced-motion:reduce) {{ * {{ scroll-behavior:auto!important; transition-duration:.001ms!important; animation-duration:.001ms!important; }} }}
    @media print {{ .site-header,.record-nav,.reading-progress,.hero-actions,.comments-band,.comments-sheet,.article-toc,.archive,.record-footer {{ display:none!important; }} body {{ padding-top:0; }} .hero {{ min-height:0; padding:30px 0; background:white; }} .hero-cover {{ display:none; }} .article-layout {{ display:block; padding:0; }} .article-section {{ break-inside:auto; }} }}
  </style>
  <link rel="stylesheet" href="/assets/css/world-reader.css?v=__BUILD_VERSION__">
</head>
<body>
  <a class="skip-link" href="#article">跳至正文</a>
  <div class="reading-progress" id="readingProgress" aria-hidden="true"></div>
  <header class="site-header" id="siteHeader">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">CRIVU</a>
      <nav class="site-header__nav" id="primaryNav" aria-label="博客导航">
        <a href="/">首頁</a>
        <a href="/articles.html">文章</a>
        <a href="/issues.html">期刊</a>
        <a class="active" href="/records.html">紀錄</a>
        <a href="/about.html">關於</a>
        <a href="/rss.xml">rss</a>
      </nav>
      <div class="site-header__actions">
        <form class="site-header__search" id="globalSearchForm" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="搜尋" aria-label="搜尋文章" autocomplete="off">
          <div id="globalSearchResults" class="search-results" role="listbox"></div>
        </form>
        <button class="mobile-menu-toggle" id="mobileMenuBtn" type="button" aria-label="展開選單" aria-expanded="false" aria-controls="primaryNav">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><line class="mm-line mm-line-top" x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.8"/><line class="mm-line mm-line-mid" x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8"/><line class="mm-line mm-line-bot" x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.8"/></svg>
        </button>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="切換背景主題">
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
      </div>
    </div>
  </header>
  <nav class="record-nav" aria-label="专题内容">
    <button type="button" data-view="article" aria-current="page">阅读</button>
    <button type="button" data-view="museum" aria-current="false">展览</button>
    <button type="button" data-view="gallery" aria-current="false">图像</button>
  </nav>

  <main id="recordMain">
    <section class="hero" aria-labelledby="recordTitle">
      <div class="hero-copy">
        <h1 id="recordTitle">世界一词<span>的探索</span></h1>
        <p class="hero-deck">我们每天都在说“世界”。只是，这两个早已存在的汉字，究竟怎样在译经、诗歌、小说与近代知识中逐渐结合，容纳了我们今日所理解的地球、历史、网络与内心？若想先从时间线、译词与历史场景理解这段变化，可进入<a href="#chapter-00" data-open-museum>[互动展览]</a>浏览。</p>
        <div class="hero-actions">
          <button class="primary-action" type="button" data-view="article">开始阅读</button>
          <button class="secondary-action" type="button" data-view="museum">进入互动展览</button>
          <button class="secondary-action" type="button" data-view="gallery">查看图像档案</button>
        </div>
      </div>
      <aside class="hero-side" aria-label="专题封面">
        <figure class="hero-cover">
          <img src="{cover}" alt="世界一词的探索专题封面" fetchpriority="high" decoding="async">
          <figcaption>从两个古老汉字出发，沿着近两千年的翻译与使用，重新辨认一个最熟悉的词。</figcaption>
        </figure>
      </aside>
    </section>

    <section class="comments-band" aria-label="专题评论入口">
      <button class="comments-entry" id="commentsEntry" type="button" aria-haspopup="dialog">
          <span class="comments-entry__head"><span class="comments-entry__title">最新评论</span><span class="comments-entry__count" id="commentsEntryCount">读取中</span></span>
          <span class="comments-entry__previews" id="commentsEntryPreviews"><span class="comments-entry__empty">暂无评论</span></span>
          <span class="comments-entry__foot"><span>查看与写评论</span><span aria-hidden="true">→</span></span>
      </button>
    </section>

    <aside class="mobile-toc" id="mobileToc" aria-label="随行文章目录">
      <button class="mobile-toc__toggle" id="mobileTocToggle" type="button" aria-expanded="false" aria-controls="mobileTocPanel">目录</button>
      <div class="mobile-toc__panel" id="mobileTocPanel" hidden>
        <header class="mobile-toc__head"><strong>文章目录</strong><button class="mobile-toc__close" id="mobileTocClose" type="button" aria-label="关闭文章目录">×</button></header>
        <nav class="mobile-toc__links" id="mobileTocLinks" aria-label="文章章节"></nav>
      </div>
    </aside>

    <section class="article-layout" id="article">
      <aside class="article-toc" id="articleToc" aria-label="文章目录">
        <h2>文章目录</h2>
        {toc}
      </aside>
      <article class="article">
        <p class="article-label">据现有文献与证据整理</p>
        {article}
      </article>
    </section>

    <section class="archive" id="gallery" aria-labelledby="galleryTitle">
      <header class="archive-head">
        <div><p class="archive-kicker">IMAGE ARCHIVE · {len(GALLERY):02d}</p><h2 id="galleryTitle">图像档案</h2></div>
      </header>
      <div class="archive-grid">{''.join(gallery_items)}</div>
    </section>
  </main>

  <footer class="record-footer"><span>© 2026 CRIVU · 世界一词的探索</span></footer>

  <section class="comments-sheet" id="commentsSheet" hidden role="dialog" aria-modal="true" aria-labelledby="commentsSheetTitle" data-comments data-comments-slug="world-word-exploration" data-comments-empty="暂无评论" data-comments-defer-turnstile>
    <div class="comments-sheet__panel">
      <div class="comments-sheet__inner">
        <header class="comments-sheet__top"><h2 id="commentsSheetTitle">专题评论</h2><button class="comments-sheet__close" id="commentsSheetClose" type="button" aria-label="关闭评论">×</button></header>
        <section class="comments-compact" aria-labelledby="commentsListTitle">
          <header class="comments-compact__head"><h3 id="commentsListTitle">已审核评论</h3><span class="comments-compact__count" id="commentCount">读取中</span></header>
          <div class="comments-mobile-tabs" role="tablist" aria-label="评论视图">
            <button type="button" role="tab" aria-selected="true" data-comments-mobile-tab="list">评论列表</button>
            <button type="button" role="tab" aria-selected="false" data-comments-mobile-tab="form">写评论</button>
          </div>
          <div class="comments-compact__body" data-mobile-tab="list">
            <div class="comments-compact__list" data-comments-list><p class="comments__empty">评论加载中…</p></div>
            <form class="comments-compact__form" data-comments-form>
              <div class="comments-compact__fields">
                <label>昵称<input name="authorName" maxlength="32" autocomplete="name" required placeholder="如何称呼"></label>
                <label>邮箱（不公开）<input name="email" type="email" maxlength="160" autocomplete="email" placeholder="选填"></label>
              </div>
              <label>内容<textarea name="body" maxlength="1200" required placeholder="关于这个词、这段历史，或你自己的世界……"></textarea></label>
              <label class="comments-compact__trap" aria-hidden="true"><span>Website</span><input name="website" tabindex="-1" autocomplete="off"></label>
              <div class="comments-compact__verification"><span>安全验证 · 审核后公开</span><div class="comments-compact__turnstile" data-comments-turnstile></div></div>
              <div class="comments-compact__actions"><p class="comments-compact__status" data-comments-status aria-live="polite"></p><button type="submit" data-comments-submit disabled>提交评论</button></div>
            </form>
          </div>
        </section>
      </div>
    </div>
  </section>

  <section class="museum-shell" id="museumShell" hidden aria-label="世界词语博物馆">
    <header class="museum-bar">
      <button class="museum-back" id="museumBack" type="button">← 返回专题</button>
      <span class="museum-title">世界词语博物馆</span>
      <span class="museum-mark">互动展览</span>
    </header>
    <iframe id="museumFrame" title="世界词语博物馆互动展览"></iframe>
  </section>

  <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="图像预览">
    <button class="lightbox-close" id="lightboxClose" type="button" aria-label="关闭">×</button>
    <div class="lightbox-stage">
      <button id="lightboxPrev" type="button" aria-label="上一张">‹</button>
      <img id="lightboxImage" src="" alt="">
      <button id="lightboxNext" type="button" aria-label="下一张">›</button>
    </div>
    <p class="lightbox-caption" id="lightboxCaption"></p>
  </div>

  <script id="museumPayload" type="application/octet-stream">{museum_payload}</script>
  <script>
    (() => {{
      const body = document.body;
      const main = document.querySelector('#recordMain');
      const shell = document.querySelector('#museumShell');
      const frame = document.querySelector('#museumFrame');
      const progress = document.querySelector('#readingProgress');
      const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
      const navViewButtons = Array.from(document.querySelectorAll('.record-nav [data-view]'));
      let museumLoaded = false;
      let returnScroll = 0;

      const themes = ['white', 'light', 'dark'];
      const themeLabels = {{ white:'白色', light:'纸黄', dark:'深色' }};
      const applyTheme = (theme) => {{
        const selected = themes.includes(theme) ? theme : 'white';
        document.documentElement.dataset.theme = selected;
        document.querySelector('meta[name="theme-color"]').content = selected === 'dark' ? '#171815' : selected === 'light' ? '#f1ede3' : '#ffffff';
        document.querySelectorAll('[data-theme-toggle]').forEach((button) => {{
          button.setAttribute('aria-label', `目前是${{themeLabels[selected]}}背景，点按切换背景主题`);
          button.title = `目前：${{themeLabels[selected]}}，点按切换背景`;
        }});
        try {{ localStorage.setItem('crivu-theme', selected); }} catch {{}}
      }};
      applyTheme(document.documentElement.dataset.theme);
      document.querySelectorAll('[data-theme-toggle]').forEach((button) => button.addEventListener('click', () => {{
        const current = document.documentElement.dataset.theme || 'white';
        applyTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
      }}));

      const siteHeader = document.querySelector('#siteHeader');
      const menuButton = document.querySelector('#mobileMenuBtn');
      const primaryNav = document.querySelector('#primaryNav');
      const closeMenu = () => {{ siteHeader.classList.remove('mobile-menu-open'); menuButton.setAttribute('aria-expanded','false'); }};
      menuButton.addEventListener('click', () => {{
        const open = !siteHeader.classList.contains('mobile-menu-open');
        siteHeader.classList.toggle('mobile-menu-open', open);
        menuButton.setAttribute('aria-expanded', String(open));
      }});
      primaryNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
      addEventListener('keydown', (event) => {{ if (event.key === 'Escape') closeMenu(); }});

      const searchInput = document.querySelector('#globalSearchInput');
      const searchResults = document.querySelector('#globalSearchResults');
      let searchablePosts = [];
      let searchLoading = null;
      const loadSearch = () => {{
        if (searchLoading) return searchLoading;
        searchLoading = fetch('/posts/posts.json').then((response) => response.ok ? response.json() : {{ items:[] }}).then((data) => {{ searchablePosts = (data.items || []).filter((item) => item?.published !== false); }}).catch(() => {{ searchablePosts = []; }});
        return searchLoading;
      }};
      const closeSearch = () => {{ searchResults.classList.remove('is-open'); searchResults.replaceChildren(); }};
      const renderSearch = () => {{
        const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
        if (!query) {{ closeSearch(); return; }}
        const matches = searchablePosts.filter((item) => `${{item.title || ''}} ${{item.excerpt || ''}} ${{item.body || ''}}`.toLocaleLowerCase('zh-CN').includes(query)).slice(0,8);
        searchResults.replaceChildren();
        searchResults.classList.add('is-open');
        if (!matches.length) {{
          const empty = document.createElement('div');
          empty.className = 'search-empty';
          empty.textContent = `找不到与“${{searchInput.value.trim()}}”相符的文章。`;
          searchResults.append(empty);
          return;
        }}
        matches.forEach((item) => {{
          const link = document.createElement('a');
          link.className = 'search-hit';
          link.href = item.slug ? `/articles/${{encodeURIComponent(item.slug)}}` : '/articles.html';
          const title = document.createElement('span');
          title.className = 'search-hit__title';
          title.textContent = item.title || '未命名文章';
          const meta = document.createElement('span');
          meta.className = 'search-hit__meta';
          meta.textContent = String(item.date || '').slice(0,10);
          link.append(title, meta);
          searchResults.append(link);
        }});
      }};
      searchInput.addEventListener('focus', () => loadSearch().then(renderSearch));
      searchInput.addEventListener('input', () => loadSearch().then(renderSearch));
      document.addEventListener('click', (event) => {{ if (!searchResults.contains(event.target) && event.target !== searchInput) closeSearch(); }});
      searchInput.addEventListener('keydown', (event) => {{ if (event.key === 'Escape') {{ closeSearch(); searchInput.blur(); }} }});

      const commentsRoot = document.querySelector('[data-comments]');
      const commentCount = document.querySelector('#commentCount');
      const commentsEntryCount = document.querySelector('#commentsEntryCount');
      const commentsEntryPreviews = document.querySelector('#commentsEntryPreviews');
      const commentsSheet = document.querySelector('#commentsSheet');
      const commentsEntry = document.querySelector('#commentsEntry');
      const commentsSheetClose = document.querySelector('#commentsSheetClose');
      const commentsHeading = document.querySelector('#commentsListTitle');
      const commentsBody = document.querySelector('.comments-compact__body');
      const commentsMobileTabs = Array.from(document.querySelectorAll('[data-comments-mobile-tab]'));
      const setCommentsTab = (tab) => {{
        const selected = tab === 'form' ? 'form' : 'list';
        commentsBody.dataset.mobileTab = selected;
        commentsHeading.textContent = selected === 'form' ? '写下评论' : '已审核评论';
        commentCount.hidden = selected === 'form';
        commentsMobileTabs.forEach((button) => {{
          const active = button.dataset.commentsMobileTab === selected;
          button.setAttribute('aria-selected', String(active));
          button.tabIndex = active ? 0 : -1;
        }});
      }};
      commentsMobileTabs.forEach((button) => button.addEventListener('click', () => setCommentsTab(button.dataset.commentsMobileTab)));
      commentsMobileTabs.forEach((button, index) => button.addEventListener('keydown', (event) => {{
        if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const target = commentsMobileTabs[(index + direction + commentsMobileTabs.length) % commentsMobileTabs.length];
        setCommentsTab(target.dataset.commentsMobileTab);
        target.focus();
      }}));
      setCommentsTab('list');
      const renderCommentPreviews = (comments) => {{
        const approvedComments = Array.isArray(comments) ? comments : [];
        commentsEntryPreviews.replaceChildren();
        commentCount.textContent = `${{approvedComments.length}} 条评论`;
        commentsEntryCount.textContent = `${{approvedComments.length}} 条评论`;
        if (!approvedComments.length) {{
          const entryEmpty = document.createElement('span');
          entryEmpty.className = 'comments-entry__empty';
          entryEmpty.textContent = '暂无评论';
          commentsEntryPreviews.append(entryEmpty);
          return;
        }}
        [...approvedComments].reverse().slice(0,2).forEach((item) => {{
          const preview = document.createElement('span');
          preview.className = 'comments-entry__preview';
          const previewName = document.createElement('strong');
          previewName.textContent = item.authorName;
          const previewBody = document.createElement('em');
          previewBody.textContent = item.body;
          preview.append(previewName, previewBody);
          commentsEntryPreviews.append(preview);
        }});
      }};
      renderCommentPreviews([]);
      commentsRoot.addEventListener('comments:loaded', (event) => renderCommentPreviews(event.detail?.comments || []));

      const openComments = () => {{
        setCommentsTab('list');
        commentsSheet.hidden = false;
        commentsRoot.dispatchEvent(new Event('comments:visible'));
        body.classList.add('comments-open');
        main.setAttribute('aria-hidden','true');
        siteHeader.setAttribute('aria-hidden','true');
        commentsSheetClose.focus();
      }};
      const closeComments = () => {{
        if (commentsSheet.hidden) return;
        commentsSheet.hidden = true;
        body.classList.remove('comments-open');
        main.removeAttribute('aria-hidden');
        siteHeader.removeAttribute('aria-hidden');
        commentsEntry.focus();
      }};
      commentsEntry.addEventListener('click', openComments);
      commentsSheetClose.addEventListener('click', closeComments);
      commentsSheet.addEventListener('click', (event) => {{ if (event.target === commentsSheet) closeComments(); }});
      addEventListener('keydown', (event) => {{ if (event.key === 'Escape') closeComments(); }});

      const decodePayload = () => {{
        const binary = atob(document.querySelector('#museumPayload').textContent.trim());
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }};
      const museumChapter = () => /^#chapter-\d{{2}}/.test(location.hash) ? location.hash.slice(1).split('/')[0] : 'chapter-00';
      const sendMuseumToChapter = () => {{
        const chapter = museumChapter();
        const go = () => frame.contentWindow?.WorldMuseum?.goToChapter?.(chapter);
        go(); setTimeout(go, 180); setTimeout(go, 650);
      }};
      const openMuseum = (updateHash = true) => {{
        closeComments();
        returnScroll = window.scrollY;
        shell.hidden = false;
        body.classList.add('museum-open');
        main.setAttribute('aria-hidden', 'true');
        navViewButtons.forEach((button) => button.setAttribute('aria-current', String(button.dataset.view === 'museum' ? 'page' : 'false')));
        if (updateHash && !/^#chapter-\d{{2}}/.test(location.hash)) history.pushState(null, '', '#chapter-00');
        if (!museumLoaded) {{
          frame.addEventListener('load', sendMuseumToChapter, {{ once:true }});
          frame.srcdoc = decodePayload();
          museumLoaded = true;
        }} else {{ sendMuseumToChapter(); }}
        document.querySelector('#museumBack').focus();
      }};
      const closeMuseum = (target = 'article') => {{
        shell.hidden = true;
        body.classList.remove('museum-open');
        main.removeAttribute('aria-hidden');
        navViewButtons.forEach((button) => button.setAttribute('aria-current', String(button.dataset.view === target ? 'page' : 'false')));
        history.replaceState(null, '', target === 'gallery' ? '#gallery' : '#article');
        requestAnimationFrame(() => target === 'gallery' ? document.querySelector('#gallery').scrollIntoView() : window.scrollTo(0, returnScroll));
      }};
      const showView = (view) => {{
        if (view === 'museum') return openMuseum();
        if (!shell.hidden) return closeMuseum(view);
        const target = document.querySelector(view === 'gallery' ? '#gallery' : '#article');
        navViewButtons.forEach((button) => button.setAttribute('aria-current', String(button.dataset.view === view ? 'page' : 'false')));
        history.pushState(null, '', view === 'gallery' ? '#gallery' : '#article');
        target.scrollIntoView({{ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' }});
      }};

      viewButtons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
      document.querySelectorAll('[data-open-museum]').forEach((link) => link.addEventListener('click', (event) => {{ event.preventDefault(); openMuseum(); }}));
      document.querySelector('#museumBack').addEventListener('click', () => closeMuseum('article'));
      addEventListener('hashchange', () => {{ if (/^#chapter-\d{{2}}/.test(location.hash)) openMuseum(false); }});
      if (/^#chapter-\d{{2}}/.test(location.hash)) openMuseum(false);

      const updateProgress = () => {{
        const article = document.querySelector('#article');
        const start = article.offsetTop;
        const end = start + article.offsetHeight - innerHeight;
        const value = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
        progress.style.width = `${{value * 100}}%`;
      }};
      addEventListener('scroll', updateProgress, {{ passive:true }}); updateProgress();

      const articleToc = document.querySelector('#articleToc');
      const mobileToc = document.querySelector('#mobileToc');
      const mobileTocToggle = document.querySelector('#mobileTocToggle');
      const mobileTocPanel = document.querySelector('#mobileTocPanel');
      const mobileTocClose = document.querySelector('#mobileTocClose');
      const mobileTocLinks = document.querySelector('#mobileTocLinks');
      articleToc.querySelectorAll('a').forEach((link) => mobileTocLinks.append(link.cloneNode(true)));
      const closeMobileToc = (restoreFocus = false) => {{
        if (mobileTocPanel.hidden) return;
        mobileTocPanel.hidden = true;
        mobileTocToggle.setAttribute('aria-expanded','false');
        if (restoreFocus) mobileTocToggle.focus();
      }};
      const syncMobileToc = () => {{
        const isMobile = matchMedia('(max-width:760px)').matches;
        const tocBottom = articleToc.getBoundingClientRect().bottom + scrollY;
        const passed = isMobile && scrollY > tocBottom - 96;
        mobileToc.classList.toggle('is-visible', passed);
        if (!passed) closeMobileToc();
      }};
      mobileTocToggle.addEventListener('click', () => {{
        const opening = mobileTocPanel.hidden;
        mobileTocPanel.hidden = !opening;
        mobileTocToggle.setAttribute('aria-expanded', String(opening));
        if (opening) mobileTocClose.focus();
      }});
      mobileTocClose.addEventListener('click', () => closeMobileToc(true));
      mobileTocLinks.addEventListener('click', (event) => {{ if (event.target.closest('a')) closeMobileToc(); }});
      document.addEventListener('click', (event) => {{
        if (!mobileTocPanel.hidden && !mobileToc.contains(event.target)) closeMobileToc();
      }});
      addEventListener('keydown', (event) => {{ if (event.key === 'Escape') closeMobileToc(true); }});
      addEventListener('scroll', syncMobileToc, {{ passive:true }});
      addEventListener('resize', syncMobileToc, {{ passive:true }});
      syncMobileToc();

      const gallery = Array.from(document.querySelectorAll('[data-archive-card]')).map((card) => ({{
        src: card.querySelector('img').src,
        alt: card.querySelector('img').alt,
        caption: `${{card.querySelector('h3').textContent}} · ${{card.querySelector('small').textContent}}`,
      }}));
      const lightbox = document.querySelector('#lightbox');
      const lightboxImage = document.querySelector('#lightboxImage');
      const lightboxCaption = document.querySelector('#lightboxCaption');
      let lightboxIndex = 0;
      let returnFocus = null;
      const showImage = (index) => {{
        lightboxIndex = (index + gallery.length) % gallery.length;
        lightboxImage.src = gallery[lightboxIndex].src;
        lightboxImage.alt = gallery[lightboxIndex].alt;
        lightboxCaption.textContent = `${{String(lightboxIndex + 1).padStart(2,'0')}} / ${{String(gallery.length).padStart(2,'0')}} · ${{gallery[lightboxIndex].caption}}`;
      }};
      const openLightbox = (index, trigger) => {{ returnFocus = trigger; showImage(index); lightbox.hidden = false; body.style.overflow = 'hidden'; document.querySelector('#lightboxClose').focus(); }};
      const closeLightbox = () => {{ lightbox.hidden = true; body.style.overflow = ''; lightboxImage.removeAttribute('src'); returnFocus?.focus(); }};
      document.querySelectorAll('[data-lightbox-index]').forEach((button) => button.addEventListener('click', () => openLightbox(Number(button.dataset.lightboxIndex), button)));
      document.querySelector('#lightboxPrev').addEventListener('click', () => showImage(lightboxIndex - 1));
      document.querySelector('#lightboxNext').addEventListener('click', () => showImage(lightboxIndex + 1));
      document.querySelector('#lightboxClose').addEventListener('click', closeLightbox);
      addEventListener('keydown', (event) => {{
        if (lightbox.hidden) return;
        if (event.key === 'Escape') closeLightbox();
        if (event.key === 'ArrowLeft') showImage(lightboxIndex - 1);
        if (event.key === 'ArrowRight') showImage(lightboxIndex + 1);
      }});
    }})();
  </script>
  <script src="/assets/js/world-reader.js?v=__BUILD_VERSION__" defer></script>
  <script src="/assets/js/comments.js?v=world-record-comments-20260723-2" type="module"></script>
</body>
</html>'''

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(document, encoding="utf-8")
    print(f"Built {OUTPUT} ({OUTPUT.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
