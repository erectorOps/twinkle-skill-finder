from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


DEFAULT_SOURCE_URL = (
    "https://twinklestarknights.wikiru.jp/"
    "?%E3%83%86%E3%83%BC%E3%83%96%E3%83%AB%2F"
    "%E5%85%A8%E3%82%AD%E3%83%A3%E3%83%A9%E7%B7%8F%E5%90%88"
)
DEFAULT_CHARACTERS_PATH = Path("src/data/characters.json")
DEFAULT_OUTPUT_PATH = Path("src/data/release_dates.json")
TARGET_TABLE_ID = "sortabletable1"


@dataclass
class TableCell:
    text: str


class WikiTableParser(HTMLParser):
    def __init__(self, table_id: str) -> None:
        super().__init__(convert_charrefs=True)
        self.table_id = table_id
        self.in_target_table = False
        self.table_depth = 0
        self.in_row = False
        self.in_cell = False
        self.rows: list[list[TableCell]] = []
        self.current_row: list[TableCell] = []
        self.current_cell_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)
        if tag == "table" and attrs_map.get("id") == self.table_id:
            self.in_target_table = True
            self.table_depth = 1
            return

        if not self.in_target_table:
            return

        if tag == "table":
            self.table_depth += 1
        elif tag == "tr":
            self.in_row = True
            self.current_row = []
        elif tag in {"td", "th"} and self.in_row:
            self.in_cell = True
            self.current_cell_parts = []
        elif tag == "br" and self.in_cell:
            self.current_cell_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if not self.in_target_table:
            return

        if tag in {"td", "th"} and self.in_cell:
            text = normalize_text("".join(self.current_cell_parts))
            self.current_row.append(TableCell(text=text))
            self.in_cell = False
            return

        if tag == "tr" and self.in_row:
            if self.current_row:
                self.rows.append(self.current_row)
            self.in_row = False
            return

        if tag == "table":
            self.table_depth -= 1
            if self.table_depth <= 0:
                self.in_target_table = False

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.current_cell_parts.append(data)


def normalize_text(value: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def normalize_header(value: str) -> str:
    return re.sub(r"\s+", "", value)


def normalize_date(value: str) -> str | None:
    match = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", value)
    if not match:
        return None

    year, month, day = (int(part) for part in match.groups())
    return f"{year:04d}-{month:02d}-{day:02d}"


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; twinkle-skill-finder/"
                "build-release-dates)"
            )
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def parse_release_rows(html: str) -> list[dict[str, object]]:
    parser = WikiTableParser(TARGET_TABLE_ID)
    parser.feed(html)

    if not parser.rows:
        raise RuntimeError(f"対象テーブルが見つかりません: id={TARGET_TABLE_ID}")

    header_row = next(
        (
            row
            for row in parser.rows
            if "No" in [normalize_header(cell.text) for cell in row]
            and "実装日" in [normalize_header(cell.text) for cell in row]
        ),
        None,
    )
    if header_row is None:
        raise RuntimeError("対象テーブルに No / 実装日 のヘッダーが見つかりません")

    headers = [normalize_header(cell.text) for cell in header_row]
    indexes = {header: index for index, header in enumerate(headers)}

    required_headers = ["No", "★", "キャラ名", "名前(ヨミ)", "実装日", "入手方法"]
    missing_headers = [header for header in required_headers if header not in indexes]
    if missing_headers:
        raise RuntimeError(f"必要な列が見つかりません: {', '.join(missing_headers)}")

    items: list[dict[str, object]] = []
    seen_data_row = 0

    for row in parser.rows:
        texts = [cell.text for cell in row]
        if len(texts) <= max(indexes.values()):
            continue
        if normalize_header(texts[indexes["No"]]) == "No":
            continue

        wiki_no = texts[indexes["No"]]
        if not re.fullmatch(r"\d{6}", wiki_no):
            continue

        release_date_raw = texts[indexes["実装日"]]
        release_date = normalize_date(release_date_raw)
        if release_date is None:
            continue

        seen_data_row += 1
        name_parts = texts[indexes["キャラ名"]].split("\n", 1)
        unit_name = name_parts[0] if name_parts else ""
        character_name = name_parts[1] if len(name_parts) > 1 else texts[indexes["名前(ヨミ)"]]

        items.append(
            {
                "wiki_no": wiki_no,
                "wiki_unit_id_hint": int(f"1{wiki_no}"),
                "rarity": int(texts[indexes["★"]]),
                "unit_name": unit_name,
                "character_name": character_name,
                "character_name_kana": texts[indexes["名前(ヨミ)"]],
                "release_date": release_date,
                "release_date_raw": release_date_raw,
                "obtain": texts[indexes["入手方法"]],
                "wiki_row_order": seen_data_row,
            }
        )

    if not items:
        raise RuntimeError("実装日を持つキャラ行が見つかりません")

    for release_order, item in enumerate(
        sorted(items, key=lambda item: (item["release_date"], item["wiki_row_order"])),
        start=1,
    ):
        item["release_order"] = release_order

    return sorted(items, key=lambda item: item["wiki_row_order"])


def normalize_match_value(value: object) -> str:
    normalized = unicodedata.normalize("NFKC", str(value))
    return re.sub(r"\s+", "", normalized)


def canonical_unit_name(unit_name: object) -> str:
    normalized = unicodedata.normalize("NFKC", str(unit_name)).strip()
    match = re.fullmatch(r"\[([^\]]+)\]\s*.+", normalized)
    if match:
        normalized = match.group(1)
    return re.sub(r"\s+", "", normalized)


def canonical_character_name(character_name: object) -> str:
    return normalize_match_value(character_name)


def base_character_name(character_name: object) -> str:
    return re.sub(r"《[^》]+》$", "", canonical_character_name(character_name))


def match_key(unit_name: object, character_name: object) -> str:
    return "\t".join(
        [
            canonical_unit_name(unit_name),
            canonical_character_name(character_name),
        ]
    )


def unit_key(unit_name: object) -> str:
    return canonical_unit_name(unit_name)


def load_characters(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []

    characters = json.loads(path.read_text(encoding="utf-8"))
    return [character for character in characters if isinstance(character, dict)]


def attach_unit_ids(
    items: list[dict[str, object]],
    characters: list[dict[str, object]],
) -> list[dict[str, object]]:
    by_id = {
        int(character["unit_id"]): character
        for character in characters
        if "unit_id" in character
    }

    by_name: dict[str, list[dict[str, object]]] = {}
    by_unit_name: dict[str, list[dict[str, object]]] = {}
    by_unit_and_base_character: dict[str, list[dict[str, object]]] = {}
    for character in characters:
        if "unit_name" not in character or "character_name" not in character:
            continue
        by_name.setdefault(
            match_key(character["unit_name"], character["character_name"]),
            [],
        ).append(character)
        by_unit_name.setdefault(unit_key(character["unit_name"]), []).append(character)
        by_unit_and_base_character.setdefault(
            "\t".join(
                [
                    unit_key(character["unit_name"]),
                    base_character_name(character["character_name"]),
                ]
            ),
            [],
        ).append(character)

    matched_items: list[dict[str, object]] = []
    for item in items:
        unit_id: int | None = None
        match_method = "none"
        hint_id = int(item["wiki_unit_id_hint"])
        hinted_character = by_id.get(hint_id)

        if hinted_character and match_key(
            hinted_character.get("unit_name", ""),
            hinted_character.get("character_name", ""),
        ) == match_key(item["unit_name"], item["character_name"]):
            unit_id = hint_id
            match_method = "wiki_no_and_name"
        else:
            candidates = by_name.get(match_key(item["unit_name"], item["character_name"]), [])
            if len(candidates) == 1:
                unit_id = int(candidates[0]["unit_id"])
                match_method = "name"
            else:
                base_candidates = by_unit_and_base_character.get(
                    "\t".join(
                        [
                            unit_key(item["unit_name"]),
                            base_character_name(item["character_name"]),
                        ]
                    ),
                    [],
                )
                if len(base_candidates) == 1:
                    unit_id = int(base_candidates[0]["unit_id"])
                    match_method = "unit_name_and_base_character_name"
                else:
                    unit_candidates = by_unit_name.get(unit_key(item["unit_name"]), [])
                    if len(unit_candidates) == 1:
                        unit_id = int(unit_candidates[0]["unit_id"])
                        match_method = "unique_unit_name"
                    elif len(candidates) > 1 or len(base_candidates) > 1 or len(unit_candidates) > 1:
                        match_method = "ambiguous_name"
                    elif hinted_character:
                        match_method = "wiki_no_name_mismatch"

        matched = dict(item)
        matched["unit_id"] = unit_id
        matched["match_method"] = match_method
        matched_items.append(matched)

    return matched_items


def build_payload(
    items: list[dict[str, object]],
    source_url: str,
    characters: list[dict[str, object]],
) -> dict[str, object]:
    character_ids = {
        int(character["unit_id"])
        for character in characters
        if isinstance(character, dict) and "unit_id" in character
    }
    matched_items = attach_unit_ids(items, characters)
    item_ids = {
        int(item["unit_id"])
        for item in matched_items
        if item.get("unit_id") is not None
    }
    matched_ids = sorted(item_ids & character_ids)
    unmatched_wiki_items = [
        {
            "wiki_no": item["wiki_no"],
            "wiki_unit_id_hint": item["wiki_unit_id_hint"],
            "unit_name": item["unit_name"],
            "character_name": item["character_name"],
            "match_method": item["match_method"],
        }
        for item in matched_items
        if item.get("unit_id") is None
    ]
    missing_in_wiki = sorted(character_ids - item_ids)

    return {
        "source_url": source_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(matched_items),
        "matched_count": len(matched_ids) if character_ids else None,
        "unmatched_wiki_items": unmatched_wiki_items,
        "missing_in_wiki": missing_in_wiki,
        "items": matched_items,
    }


def write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--characters", type=Path, default=DEFAULT_CHARACTERS_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--strict", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    html = fetch_html(args.source_url)
    items = parse_release_rows(html)
    characters = load_characters(args.characters)
    payload = build_payload(items, args.source_url, characters)

    if args.strict and payload["missing_in_wiki"]:
        print(
            f"Wiki側に存在しないローカルキャラがあります: {len(payload['missing_in_wiki'])}",
            file=sys.stderr,
        )
        return 1

    write_json(args.output, payload)

    print(f"wrote: {args.output}")
    print(f"release rows: {payload['count']}")
    if characters:
        print(f"matched: {payload['matched_count']} / {len(characters)}")
        print(f"unmatched wiki items: {len(payload['unmatched_wiki_items'])}")
        print(f"missing in wiki: {len(payload['missing_in_wiki'])}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
